"""Offline controls for costly fallback boundaries; never call a model."""
import importlib.util
import json
import argparse
import contextlib
import io
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('wb_run', Path(__file__).with_name('run.py'))
wb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wb)


def cli_result(model=wb.PRIMARY, error=False, text='OK', code=0):
    rows = [{'providerData': {'model': model, 'rawUsage': {'credit': 0}}},
            {'type': 'result', 'subtype': 'error_api' if error else 'success',
             'is_error': error, 'result': text}]
    return wb.parse_attempt(json.dumps(rows), '', code, wb.PRIMARY)[0]


class Routing(unittest.TestCase):
    def test_success_discussing_quota_does_not_fallback(self):
        a = cli_result(text='The example mentions quota exceeded and HTTP 429.')
        self.assertEqual(a['status'], 'success')
        self.assertFalse(wb.usage_limit(a))
        self.assertEqual(a['rawUsage'][0]['credit'], 0)

    def test_explicit_limit_is_eligible(self):
        for msg in ['API Error: 429 Too Many Requests', 'insufficient_quota', '用量达到上限']:
            self.assertTrue(wb.usage_limit(cli_result(error=True, text=msg)), msg)

    def test_unrelated_failures_do_not_fallback(self):
        for msg in ['API Error: 401 Unauthorized', 'context_length_exceeded',
                    'API Error: 500 Internal Server Error', 'Request timed out']:
            self.assertFalse(wb.usage_limit(cli_result(error=True, text=msg)), msg)
        self.assertFalse(wb.usage_limit({'status': 'timeout'}))

    def test_context_limit_wins_over_generic_limit_phrase(self):
        self.assertFalse(wb.usage_limit(cli_result(error=True, text='429 context window limit exceeded')))

    def test_wrong_actual_model_is_not_success(self):
        self.assertEqual(cli_result(model='hy4-preview')['status'], 'model_mismatch')

    def test_stream_uses_actual_model_not_init_declaration(self):
        rows = [{'type': 'system', 'subtype': 'init', 'model': wb.PRIMARY},
                {'type': 'stream_event', 'event': {'type': 'message_start', 'message': {'model': wb.PRIMARY}}},
                {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'ready'}]
        result, text = wb.parse_attempt(json.dumps(rows), '', 0, wb.PRIMARY)
        self.assertEqual((result['status'], text), ('success', 'ready'))
        self.assertEqual(result['rawUsage'], [])
        result, _ = wb.parse_attempt(json.dumps([rows[0], rows[2]]), '', 0, wb.PRIMARY)
        self.assertEqual(result['status'], 'model_mismatch')

    def test_stream_error_array_can_supply_actual_quota_failure(self):
        rows = [{'type': 'result', 'subtype': 'error_during_execution', 'is_error': True,
                 'errors': ['API Error: 429 Too Many Requests']}]
        result, _ = wb.parse_attempt(json.dumps(rows), '', 1, wb.PRIMARY)
        self.assertTrue(wb.usage_limit(result))

    def test_incomplete_stream_preserves_observed_identity_without_success_or_usage(self):
        rows = [{'type': 'stream_event', 'event': {'type': 'message_start', 'message': {'model': wb.PRIMARY}}}]
        result, text = wb.parse_attempt(json.dumps(rows), '', 1, wb.PRIMARY)
        self.assertEqual(result['status'], 'missing_result')
        self.assertEqual(result['modelIds'], [wb.PRIMARY])
        self.assertIsNone(result['usage'])
        self.assertEqual(text, '')

    def test_terminal_success_requires_explicit_success_metadata(self):
        rows = [{'providerData': {'model': wb.PRIMARY}}, {'type': 'result', 'result': 'draft'}]
        result, text = wb.parse_attempt(json.dumps(rows), '', 0, wb.PRIMARY)
        self.assertEqual(result['status'], 'unconfirmed_result')
        self.assertEqual(text, '')

    def test_missing_or_broken_response_is_not_quota(self):
        a, _ = wb.parse_attempt('invalid', '429', 1, wb.PRIMARY)
        self.assertEqual(a['status'], 'process_error')
        self.assertFalse(wb.usage_limit(a))

    def test_cooldown_requires_real_limit_marker_and_expires(self):
        self.assertEqual(wb.selected_route({}, 100)[0][0], wb.PRIMARY)
        state = {'reason': 'observed_primary_usage_limit', 'untilEpoch': 200}
        self.assertEqual(wb.selected_route(state, 100)[0], [wb.FALLBACK])
        self.assertEqual(wb.selected_route(state, 201)[0][0], wb.PRIMARY)
        state['reason'] = 'timeout'
        self.assertEqual(wb.selected_route(state, 100)[0][0], wb.PRIMARY)

    def test_status_preserves_zero_credit_and_does_not_invent_missing_usage(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(wb.task_status(tmp)['status'], 'pending_receipt')
            wb.write_json(Path(tmp) / 'receipt.json', {
                'status': 'success', 'selectedModel': wb.PRIMARY,
                'attempts': [{'modelIds': [wb.PRIMARY], 'rawUsage': [{'credit': 0}]}]})
            self.assertEqual(wb.task_status(tmp)['usage'], [{'credit': 0}])
            wb.write_json(Path(tmp) / 'receipt.json', {
                'status': 'timeout', 'selectedModel': wb.PRIMARY,
                'attempts': [{'billingUnknown': True}]})
            self.assertEqual(wb.task_status(tmp)['usage'], [])
            self.assertTrue(wb.task_status(tmp)['billingUnknown'])

    def exercise_route(self, first, second=None, state=None, requested_model=None):
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp)
            if state is not None:
                wb.write_json(local / 'route-state.json', state)
            state_path = local / 'route-state.json'
            state_before = state_path.read_bytes() if state_path.exists() else None
            calls = []
            def invoke(model, *_):
                calls.append(model)
                value = dict(first if len(calls) == 1 else second)
                value['requestedModel'] = model
                return value, 'draft' if value['status'] == 'success' else ''
            args = argparse.Namespace(root=tmp, out=str(local / 'output'), summary_chars=20, timeout=1, effort='low', output_tokens=4096,
                                      first_output_timeout=1, idle_timeout=1, model=requested_model)
            with patch.object(wb, 'home', return_value=local), \
                 patch.object(wb, 'runtime', return_value=({'version': 'test'}, 'node', 'cli')), \
                 patch.object(wb, 'credential', return_value='test-only-key'), \
                 patch.object(wb, 'bundle', return_value=('task', {'sources': []})), \
                 patch.object(wb, 'write_json', wraps=wb.write_json) as writes, \
                 contextlib.redirect_stdout(io.StringIO()):
                result = wb.run_task(args, invoke_fn=invoke)
            receipt = json.loads((local / 'output' / 'receipt.json').read_text())
            if requested_model is not None:
                self.assertEqual(state_path.read_bytes() if state_path.exists() else None, state_before)
                self.assertFalse(any(Path(call.args[0]) == state_path for call in writes.call_args_list))
            return calls, result, receipt

    def test_real_orchestration_switches_once_and_records_primary_failure(self):
        calls, code, receipt = self.exercise_route({'status': 'api_error', 'error': 'API Error: 429'},
                                                  {'status': 'success'})
        self.assertEqual(calls, [wb.PRIMARY, wb.FALLBACK])
        self.assertEqual(code, 0)
        self.assertEqual(receipt['attempts'][0]['status'], 'api_error')

    def test_orchestration_never_retries_failed_fallback(self):
        calls, code, _ = self.exercise_route({'status': 'api_error', 'error': 'insufficient_quota'},
                                            {'status': 'api_error', 'error': 'API Error: 429'})
        self.assertEqual(calls, [wb.PRIMARY, wb.FALLBACK])
        self.assertEqual(code, 1)

    def test_orchestration_does_not_switch_on_timeout_or_auth(self):
        for failure in [{'status': 'timeout'}, {'status': 'api_error', 'error': '401 Unauthorized'}]:
            calls, code, _ = self.exercise_route(failure)
            self.assertEqual(calls, [wb.PRIMARY])
            self.assertEqual(code, 1)

    def test_explicit_models_never_switch_retry_or_modify_cooldown(self):
        cooldown = {'reason': 'observed_primary_usage_limit', 'untilEpoch': 9999999999,
                    'evidenceReceipt': 'existing-real-quota-receipt'}
        failures = [{'status': 'api_error', 'error': '429 quota exhausted'},
                    {'status': 'timeout', 'timeoutReason': 'total_timeout'},
                    {'status': 'api_error', 'error': '401 Unauthorized'}]
        for model in (wb.PRIMARY, wb.FALLBACK):
            for state in (None, cooldown):
                for outcome in [{'status': 'success'}] + failures:
                    with self.subTest(model=model, state=state, outcome=outcome):
                        calls, code, receipt = self.exercise_route(outcome, state=state, requested_model=model)
                        self.assertEqual(calls, [model])
                        self.assertEqual(code, 0 if outcome['status'] == 'success' else 1)
                        self.assertEqual(receipt['routeReason'], 'user_requested_model')
                        self.assertEqual(receipt['requestedModel'], model)
                        self.assertEqual(len(receipt['attempts']), 1)

    def test_default_route_still_respects_active_cooldown(self):
        state = {'reason': 'observed_primary_usage_limit', 'untilEpoch': 9999999999}
        calls, _, receipt = self.exercise_route({'status': 'success'}, state=state)
        self.assertEqual(calls, [wb.FALLBACK])
        self.assertEqual(receipt['routeReason'], 'recorded_usage_limit_cooldown')
        self.assertIsNone(receipt['requestedModel'])

    def test_cli_parser_accepts_explicit_deepseek_and_rejects_other_models(self):
        with tempfile.TemporaryDirectory() as tmp:
            argv = ['run.py', 'run', '--root', str(Path(tmp) / 'source'), '--task', 'task.md',
                    '--out', str(Path(tmp) / 'output'), '--model', wb.FALLBACK]
            with patch.object(sys, 'argv', argv), patch.object(wb, 'run_task', return_value=0) as run_task:
                self.assertEqual(wb.main(), 0)
                self.assertEqual(run_task.call_args.args[0].model, wb.FALLBACK)
            with patch.object(sys, 'argv', argv[:-1] + ['unknown-model']), \
                 patch.object(wb, 'run_task') as run_task, contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    wb.main()
                self.assertEqual(error.exception.code, 2)
                run_task.assert_not_called()

    def test_parse_retains_terminal_metadata_without_thinking_content(self):
        rows = [{'type': 'assistant', 'message': {'model': wb.FALLBACK, 'stop_reason': 'max_tokens'}},
                {'type': 'assistant', 'message': {'model': wb.FALLBACK, 'stop_reason': 'end_turn'}},
                {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'draft',
                 'num_turns': 1, 'duration_api_ms': 1234}]
        result, text = wb.parse_attempt(json.dumps(rows), '', 0, wb.FALLBACK)
        self.assertEqual((result['status'], text), ('success', 'draft'))
        self.assertEqual((result['num_turns'], result['duration_api_ms'], result['stop_reason']),
                         (1, 1234, 'end_turn'))
        rows[-1].update(num_turns=0, duration_api_ms=0, subtype='error_api', is_error=True)
        result, text = wb.parse_attempt(json.dumps(rows), '', 1, wb.FALLBACK)
        self.assertEqual((result['status'], text), ('api_error', ''))
        self.assertEqual((result['num_turns'], result['duration_api_ms']), (0, 0))

    def test_status_returns_bounded_diagnostics_and_request_lower_bound(self):
        with tempfile.TemporaryDirectory() as tmp:
            wb.write_json(Path(tmp) / 'receipt.json', {
                'status': 'timeout', 'selectedModel': wb.FALLBACK, 'routeReason': 'user_requested_model',
                'requestedModel': wb.FALLBACK, 'attempts': [{
                    'timeoutReason': 'total_timeout', 'observedProviderRequestCount': 2,
                    'requestObservation': 'private_cli_log_lower_bound', 'num_turns': 1,
                    'duration_api_ms': 456, 'stop_reason': 'max_tokens',
                    'requestedThinkingEnabled': False, 'requestedThinkingTokens': 1024,
                    'thinkingSettingsScope': 'client_requests_not_provider_token_guarantees',
                    'stream': {'eventCount': 12, 'thinkingCharacters': 99, 'textCharacters': 0,
                               'rows': [{'thinking': 'PRIVATE_REASONING'}], 'stderrTail': 'PRIVATE_LOG'}}]})
            status = wb.task_status(tmp)
            self.assertEqual(status['timeoutReason'], 'total_timeout')
            self.assertEqual(status['stream'], {'eventCount': 12, 'thinkingCharacters': 99, 'textCharacters': 0})
            self.assertEqual(status['observedProviderRequestCount'], 2)
            self.assertEqual(status['requestObservation'], 'private_cli_log_lower_bound')
            self.assertEqual((status['num_turns'], status['duration_api_ms'], status['stop_reason']),
                             (1, 456, 'max_tokens'))
            self.assertFalse(status['requestedThinkingEnabled'])
            self.assertNotIn('PRIVATE_', json.dumps(status))


if __name__ == '__main__':
    unittest.main()
