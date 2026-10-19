import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
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


if __name__ == '__main__':
    unittest.main()
