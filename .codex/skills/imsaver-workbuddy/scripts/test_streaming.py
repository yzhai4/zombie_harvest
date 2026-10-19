import json
import argparse
import contextlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from streaming import collect_process
import run as wb

PRE = '''import sys,time,json
sys.stdin.read()
def emit(x): print(json.dumps(x),flush=True)
emit({'type':'system','subtype':'init'})
'''
TEXT = "emit({'type':'stream_event','event':{'type':'content_block_delta','delta':{'type':'text_delta','text':'hello'}}})\n"


class CollectorTests(unittest.TestCase):
    def run_child(self, code, total=2, first=.8, idle=.8):
        with tempfile.TemporaryDirectory() as directory:
            progress = Path(directory) / 'progress.json'
            result = collect_process([sys.executable, '-u', '-c', PRE + code], directory,
                                     dict(os.environ), 'input', total, first, idle,
                                     str(progress), 'test-model', lambda s: s.replace('SECRET', '[redacted]'))
            state = progress.read_text(encoding='utf-8')
        self.assertTrue(result['readersStopped'])
        return result, state

    def test_success(self):
        r, _ = self.run_child(TEXT + """
emit({'type':'stream_event','event':{'type':'message_start','message':{'model':'test-model','usage':{'input_tokens':3}}}})
emit({'type':'assistant','message':{'model':'test-model','content':[{'type':'text','text':'hello'}],'providerData':{'model':'test-model','rawUsage':{'credit':0}}}})
emit({'type':'result','subtype':'success','is_error':False,'result':'hello'})
print('SECRET',file=sys.stderr)
""")
        self.assertEqual(r['exitCode'], 0)
        self.assertIsNone(r['timeoutReason'])
        self.assertEqual(r['textCharacters'], 5)
        self.assertTrue(r['resultSeen'])
        self.assertEqual(r['rows'][-1]['result'], 'hello')
        self.assertTrue(r['processTerminated'])
        self.assertFalse(r['processKilled'])
        self.assertEqual(r['protocolErrors'], 0)
        attempt, answer = wb.parse_attempt(json.dumps(r['rows']), r['stderrTail'], r['exitCode'], 'test-model')
        self.assertEqual((attempt['status'], answer), ('success', 'hello'))
        self.assertEqual(attempt['rawUsage'][0]['credit'], 0)
        self.assertNotIn('SECRET', r['stderrTail'])

    def test_init_is_not_model_activity(self):
        r, _ = self.run_child("for i in range(30):\n emit({'type':'system','subtype':'init'}); time.sleep(.05)", first=.3)
        self.assertEqual(r['timeoutReason'], 'first_output_timeout')
        self.assertIsNone(r['firstModelActivitySeconds'])

    def test_thinking_total_and_no_leak(self):
        r, state = self.run_child("""
for i in range(60):
 emit({'type':'stream_event','event':{'delta':{'type':'thinking_delta','thinking':'PRIVATE_REASONING'}}})
 emit({'type':'system','subtype':'keepalive','reason':'reasoning_in_progress'})
 time.sleep(.04)
""", total=.8, first=.5, idle=.3)
        self.assertEqual(r['timeoutReason'], 'total_timeout')
        self.assertGreater(r['thinkingCharacters'], 0)
        self.assertNotIn('PRIVATE_REASONING', state + json.dumps(r['rows']))

    def test_idle(self):
        r, _ = self.run_child(TEXT + 'time.sleep(2)', idle=.25)
        self.assertEqual(r['timeoutReason'], 'idle_timeout')
        self.assertTrue(r['processTerminated'])
        self.assertTrue(r['processKilled'])

    def test_eof_without_result(self):
        r, state = self.run_child(TEXT)
        self.assertEqual(r['exitCode'], 0)
        self.assertFalse(r['resultSeen'])
        self.assertEqual(json.loads(state)['phase'], 'exited_without_result')

    def test_result_does_not_bypass_deadline(self):
        r, _ = self.run_child(TEXT + "emit({'type':'result','subtype':'success'}); time.sleep(2)", total=.5, idle=2)
        self.assertEqual(r['timeoutReason'], 'total_timeout')
        self.assertTrue(r['resultSeen'])

    def test_malformed_message(self):
        r, _ = self.run_child("emit({'type':'assistant','message':'bad'}); print('not-json',flush=True); emit([]); emit({'type':'result','subtype':'success','result':'hello'})")
        self.assertEqual(r['exitCode'], 0)
        self.assertTrue(r['resultSeen'])
        self.assertEqual(r['protocolErrors'], 2)

    def test_tool_metadata(self):
        r, _ = self.run_child("""
emit({'type':'assistant','message':{'model':'test-model','content':[{'type':'tool_use','name':'Bash','id':'a','input':{'secret':'hidden'}}]}})
emit({'type':'function_call','name':'Read','id':'b','arguments':'private'})
emit({'type':'result','subtype':'success','is_error':False,'result':'done'})
""")
        self.assertIn({'type':'tool_use','name':'Bash','id':'a'}, r['rows'])
        self.assertNotIn('hidden', json.dumps(r['rows']))
        attempt, _ = wb.parse_attempt(json.dumps(r['rows']), '', r['exitCode'], 'test-model')
        self.assertEqual(attempt['status'], 'unexpected_tools')
        self.assertEqual(attempt['toolCalls'], 2)


class InvocationTests(unittest.TestCase):
    def fake_cli(self, directory):
        """A real offline child process; no official runtime or credentials."""
        script = Path(directory) / 'fake-cli.py'
        invocation_log = Path(directory) / 'fake-invocations.jsonl'
        script.write_text('''import sys,time,json,os
from pathlib import Path
prompt=sys.stdin.read()
model=sys.argv[sys.argv.index('--model')+1]
names=('CODEBUDDY_FIRST_TOKEN_TIMEOUT_MS','CODEBUDDY_STREAM_TIMEOUT_MS',
       'CODEBUDDY_RECOVERY_FIRST_TOKEN_TIMEOUT_MS','CODEBUDDY_EMPTY_STREAM_RETRY_MAX_ELAPSED_MS',
       'CODEBUDDY_MAX_RETRIES','CODEBUDDY_RETRY_WATCHDOG','CODEBUDDY_MODEL_401_MAX_RETRIES')
controls={name:os.environ[name] for name in names}
Path('child-controls.json').write_text(json.dumps({'argv':sys.argv[1:],'controls':controls,
                                                'stdinReachedEof':True}),encoding='utf-8')
with open(INVOCATION_LOG,'a',encoding='utf-8') as log: log.write(json.dumps({'model':model})+'\\n')
def emit(row): print(json.dumps(row),flush=True)
emit({'type':'system','subtype':'init'})
emit({'type':'stream_event','event':{'type':'message_start','message':{'model':model}}})
if prompt=='wait_for_internal_deadline':
 time.sleep(int(controls['CODEBUDDY_FIRST_TOKEN_TIMEOUT_MS'])/1000)
 emit({'type':'result','subtype':'error_api','is_error':True,'errors':['fake internal first-token timeout'],
       'num_turns':1,'duration_api_ms':int(controls['CODEBUDDY_FIRST_TOKEN_TIMEOUT_MS'])})
elif prompt=='quota_failure':
 emit({'type':'result','subtype':'error_api','is_error':True,'errors':['API Error: 429 quota exhausted']})
else:
 emit({'type':'assistant','message':{'model':model,'stop_reason':'end_turn','content':[{'type':'text','text':'OK'}]}})
 emit({'type':'result','subtype':'success','is_error':False,'result':'OK','num_turns':1,'duration_api_ms':7})
'''.replace('INVOCATION_LOG', repr(str(invocation_log))), encoding='utf-8')
        return script, invocation_log

    def test_child_controls_and_receipt_use_inner_deadlines_without_expanding_outer_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            local = Path(directory)
            (local / 'runs').mkdir()
            script, _ = self.fake_cli(directory)
            with patch.object(wb, 'home', return_value=local):
                result, answer = wb.invoke(wb.FALLBACK, 'success', 180, 'offline-fixture-key', {},
                                           sys.executable, script, first_output_timeout=90, idle_timeout=60)
            child = json.loads((Path(result['localRunDirectory']) / 'empty' / 'child-controls.json').read_text())
            self.assertEqual((result['status'], answer), ('success', 'OK'))
            self.assertTrue(child['stdinReachedEof'])
            self.assertEqual(result['timeouts'], {'total': 180, 'firstModelOutput': 90, 'modelIdle': 60})
            self.assertEqual(result['cliTimeoutsMs'], {'firstToken': 85000, 'streamIdle': 55000,
                             'recoveryFirstToken': 55000, 'emptyStreamRetryMaxElapsed': 85000})
            self.assertEqual(result['cliRecoveryGraceMs'], {'firstToken': 5000, 'streamIdle': 5000})
            self.assertEqual(child['controls'], {
                'CODEBUDDY_FIRST_TOKEN_TIMEOUT_MS': '85000', 'CODEBUDDY_STREAM_TIMEOUT_MS': '55000',
                'CODEBUDDY_RECOVERY_FIRST_TOKEN_TIMEOUT_MS': '55000',
                'CODEBUDDY_EMPTY_STREAM_RETRY_MAX_ELAPSED_MS': '85000',
                'CODEBUDDY_MAX_RETRIES': '0', 'CODEBUDDY_RETRY_WATCHDOG': '0',
                'CODEBUDDY_MODEL_401_MAX_RETRIES': '0'})
            self.assertTrue(result['cliRetryPolicy']['otherInternalRetriesMayOccur'])
            self.assertFalse(result['requestedThinkingEnabled'])
            self.assertEqual(result['thinkingSettingsScope'], 'client_requests_not_provider_token_guarantees')
            self.assertEqual((result['num_turns'], result['duration_api_ms'], result['stop_reason']), (1, 7, 'end_turn'))

    def test_internal_failure_can_finish_before_outer_first_activity_deadline(self):
        with tempfile.TemporaryDirectory() as directory:
            local = Path(directory)
            (local / 'runs').mkdir()
            script, _ = self.fake_cli(directory)
            with patch.object(wb, 'home', return_value=local):
                result, answer = wb.invoke(wb.FALLBACK, 'wait_for_internal_deadline', 3,
                                           'offline-fixture-key', {}, sys.executable, script,
                                           first_output_timeout=1, idle_timeout=1)
            self.assertEqual(result['status'], 'api_error')
            self.assertNotIn('timeoutReason', result)
            self.assertEqual(result['duration_api_ms'], 800)
            self.assertTrue(result['processTerminated'])
            self.assertFalse(result['stream']['processKilled'])
            self.assertEqual(answer, '')

    def test_explicit_model_real_child_quota_failure_does_not_switch_or_write_cooldown(self):
        for model in (wb.PRIMARY, wb.FALLBACK):
            with self.subTest(model=model), tempfile.TemporaryDirectory() as directory:
                local = Path(directory)
                script, invocation_log = self.fake_cli(directory)
                state_path = local / 'route-state.json'
                state_path.write_text('{"reason":"observed_primary_usage_limit","untilEpoch":9999999999}', encoding='utf-8')
                before = state_path.read_bytes()
                args = argparse.Namespace(root=directory, out=str(local / 'output'), summary_chars=20,
                                          timeout=3, effort='low', output_tokens=4096,
                                          first_output_timeout=1, idle_timeout=1, model=model)
                with patch.object(wb, 'home', return_value=local), \
                     patch.object(wb, 'runtime', return_value=({'version': 'offline-fixture'}, sys.executable, script)), \
                     patch.object(wb, 'credential', return_value='offline-fixture-key'), \
                     patch.object(wb, 'bundle', return_value=('quota_failure', {'sources': []})), \
                     contextlib.redirect_stdout(io.StringIO()):
                    exit_code = wb.run_task(args)
                receipt = json.loads((local / 'output' / 'receipt.json').read_text())
                self.assertEqual(exit_code, 1)
                self.assertEqual(receipt['routeReason'], 'user_requested_model')
                self.assertEqual(receipt['status'], 'api_error')
                self.assertEqual([a['requestedModel'] for a in receipt['attempts']], [model])
                self.assertEqual([json.loads(row)['model'] for row in invocation_log.read_text().splitlines()], [model])
                self.assertEqual(state_path.read_bytes(), before)

    def test_positive_millisecond_deadlines_for_tiny_inputs_and_invalid_values(self):
        for seconds in (1, .005, .001, .000001):
            with self.subTest(seconds=seconds):
                policy = wb.cli_deadlines(seconds, seconds, seconds)
                self.assertTrue(all(isinstance(value, int) and value >= 1 for value in policy.values()))
                self.assertEqual(policy['recoveryFirstToken'], min(policy['firstToken'], policy['streamIdle']))
                self.assertLessEqual(policy['emptyStreamRetryMaxElapsed'], max(1, int(seconds * 1000)))
                if seconds >= .005:
                    self.assertLess(policy['firstToken'], seconds * 1000)
        self.assertEqual(wb.cli_deadlines(1, 90, 60)['emptyStreamRetryMaxElapsed'], 1000)
        for value in (0, -1, float('inf'), float('nan')):
            with self.subTest(invalid=value), self.assertRaises(ValueError):
                wb.cli_deadlines(value, 1, 1)


if __name__ == '__main__':
    unittest.main()
