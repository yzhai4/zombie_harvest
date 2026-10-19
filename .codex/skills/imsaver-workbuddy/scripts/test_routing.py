"""Offline controls for costly fallback boundaries; never call a model."""
import importlib.util
import json
import argparse
import contextlib
import io
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

    def exercise_route(self, first, second=None, state=None):
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp)
            if state:
                wb.write_json(local / 'route-state.json', state)
            calls = []
            def invoke(model, *_):
                calls.append(model)
                value = dict(first if len(calls) == 1 else second)
                value['requestedModel'] = model
                return value, 'draft' if value['status'] == 'success' else ''
            args = argparse.Namespace(root=tmp, out=str(local / 'output'), summary_chars=20, timeout=1, effort='low', output_tokens=4096)
            with patch.object(wb, 'home', return_value=local), \
                 patch.object(wb, 'runtime', return_value=({'version': 'test'}, 'node', 'cli')), \
                 patch.object(wb, 'credential', return_value='test-only-key'), \
                 patch.object(wb, 'bundle', return_value=('task', {'sources': []})), \
                 contextlib.redirect_stdout(io.StringIO()):
                result = wb.run_task(args, invoke_fn=invoke)
            receipt = json.loads((local / 'output' / 'receipt.json').read_text())
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


if __name__ == '__main__':
    unittest.main()
