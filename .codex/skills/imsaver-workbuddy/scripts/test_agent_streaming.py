"""Offline tests of the real bounded collector subprocess lifecycle.

All fixture streams, stderr, progress and receipts stay in a private temporary
directory. No official runtime, provider request, or credential is used.
"""
import ctypes
import json
import os
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

import streaming
from streaming import MESSAGE_BUDGET_SCOPE, collect_process


HERE = Path(__file__).resolve().parent
ARTIFACTS = Path(tempfile.mkdtemp(prefix='wb-agstream-')) / uuid.uuid4().hex[:8]
PRE = r'''import json,os,sys,time
from pathlib import Path
prompt=sys.stdin.read()
Path('input-metadata.json').write_text(json.dumps({'characters':len(prompt),'eof':True,'pid':os.getpid()}))
def emit(row):
 raw=json.dumps(row,ensure_ascii=False)+'\n'
 with open('fixture-stdout.ndjson','ab') as log: log.write(raw.encode('utf-8'))
 sys.stdout.write(raw);sys.stdout.flush()
def err(text):
 raw=text+'\n'
 with open('fixture-stderr.txt','ab') as log: log.write(raw.encode('utf-8'))
 sys.stderr.write(raw);sys.stderr.flush()
err('offline fixture stderr')
emit({'type':'system','subtype':'init','session_id':'session-root','parent_tool_use_id':None})
'''


def start(message, parent=None):
    return {'type': 'stream_event', 'session_id': 'session-root', 'parent_tool_use_id': parent,
            '_requestId': 'request-root', '_messageId': message,
            'event': {'type': 'message_start', 'message': {'id': message, 'model': 'test-model'}}}


def assistant(message, parent=None, content=None):
    return {'type': 'assistant', 'session_id': 'session-root', 'parent_tool_use_id': parent,
            '_requestId': 'request-root', '_messageId': message,
            'message': {'id': message, 'model': 'test-model', 'content': content or [],
                        'stop_reason': 'end_turn', 'usage': {'input_tokens': 3, 'output_tokens': 5},
                        'providerData': {'model': 'test-model', 'rawUsage': {'credit': 0}}}}


class AgentCollectorTests(unittest.TestCase):
    def run_child(self, code, total=3, first=.8, idle=.8, cap=None, agent=True, redactor=None):
        directory = ARTIFACTS / (self._testMethodName[5:17] + '-' + uuid.uuid4().hex[:6])
        directory.mkdir(parents=True)
        progress = directory / 'progress.json'
        env = {key: value for key, value in os.environ.items() if key.upper() in
               ('SYSTEMROOT', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT', 'PYTHONUTF8')}
        began = time.monotonic()
        result = collect_process([sys.executable, '-u', '-c', PRE + code], str(directory),
                                 env, 'offline fixture input', total, first, idle,
                                 str(progress), 'test-model', redactor or (lambda s: s.replace('SECRET', '[redacted]')),
                                 agent_mode=agent, max_model_messages=cap)
        elapsed = time.monotonic() - began
        result_path = directory / 'collector-receipt.json'
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        self.assertTrue(result['readersStopped'])
        self.assertTrue(result['processTerminated'])
        if agent and os.name == 'nt':
            self.assertTrue(result['jobObjectBound'])
            self.assertEqual(result['jobObjectCleanup'],
                             {'terminateRequested': True, 'closed': True, 'activeProcessesRemaining': 0})
        self.assertTrue((directory / 'fixture-stdout.ndjson').is_file())
        self.assertTrue((directory / 'fixture-stderr.txt').is_file())
        return result, json.loads(progress.read_text(encoding='utf-8')), directory, elapsed

    def emits(self, *rows):
        return ''.join('emit(' + repr(row) + ')\n' for row in rows)

    def test_parent_child_lineage_and_unique_model_and_tool_counts(self):
        root = assistant('m-root', content=[{'type': 'tool_use', 'id': 'agent-tool',
                                              'name': 'Agent', 'input': {'prompt': 'PRIVATE_TOOL_INPUT'}}])
        child = assistant('m-child', parent='agent-tool', content=[{'type': 'tool_use', 'id': 'read-tool',
                                                 'name': 'Read', 'input': {'path': 'PRIVATE_PATH'}}])
        code = self.emits(start('m-root'), root, start('m-child', 'agent-tool'), child,
                          {'type': 'stream_event', 'parent_tool_use_id': 'agent-tool',
                           'event': {'type': 'content_block_start', 'content_block':
                                     {'type': 'tool_use', 'name': 'Read', 'id': 'read-tool', 'input': {'private': 1}}}},
                          {'type': 'result', 'subtype': 'success', 'is_error': False,
                           'parent_tool_use_id': 'agent-tool', 'session_id': 'session-root', 'result': 'child done'},
                          {'type': 'result', 'subtype': 'success', 'is_error': False,
                           'parent_tool_use_id': None, 'session_id': 'session-root', 'result': 'root done'})
        r, state, _, _ = self.run_child(code, cap=2)
        self.assertEqual((r['modelMessageCount'], r['toolCount'], r['subagentLanes']), (2, 2, 1))
        self.assertIsNone(r['timeoutReason'])
        self.assertTrue(r['resultSeen'])
        self.assertEqual(r['budgetScope'], MESSAGE_BUDGET_SCOPE)
        self.assertEqual([x['type'] for x in r['rows'] if x['type'] in ('result', 'child_result')],
                         ['child_result', 'result'])
        for row in [x for x in r['rows'] if x['type'] in ('assistant', 'stream_event') and 'message' in x.get('event', x)]:
            self.assertIn('session_id', row)
            self.assertIn('_requestId', row)
            self.assertIn('_messageId', row)
        tools = [x for x in r['rows'] if x['type'] == 'tool_use']
        self.assertEqual([(x['id'], x['parent_tool_use_id']) for x in tools],
                         [('agent-tool', None), ('read-tool', 'agent-tool')])
        messages = [x['message'] for x in r['rows'] if x['type'] == 'assistant']
        self.assertEqual([x['id'] for x in messages], ['m-root', 'm-child'])
        self.assertTrue(any(x.get('providerData', {}).get('rawUsage', {}).get('credit') == 0 for x in r['rows']))
        self.assertEqual((state['modelMessageCount'], state['toolCount'], state['subagentLanes']), (2, 2, 1))
        self.assertNotIn('PRIVATE_TOOL_INPUT', json.dumps(r))

    def test_same_message_id_start_and_completion_and_repeated_frames_count_once(self):
        r, _, _, _ = self.run_child(self.emits(start('same'), start('same'), assistant('same'), assistant('same'),
            {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'ok'}), cap=1)
        self.assertEqual(r['modelMessageCount'], 1)
        self.assertIsNone(r['timeoutReason'])

    def test_reused_message_id_in_different_parent_lanes_counts_separately(self):
        r, _, _, _ = self.run_child(self.emits(start('same'), assistant('same'), start('same', 'child'),
            assistant('same', 'child'), {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'ok'}), cap=2)
        self.assertEqual((r['modelMessageCount'], r['subagentLanes']), (2, 1))

    def test_child_success_does_not_impersonate_root_terminal_result(self):
        r, state, _, _ = self.run_child(self.emits(start('child-m', 'agent-tool'), assistant('child-m', 'agent-tool'),
            {'type': 'result', 'subtype': 'success', 'is_error': False,
             'parent_tool_use_id': 'agent-tool', 'result': 'child answer'}))
        self.assertFalse(r['resultSeen'])
        self.assertEqual(state['phase'], 'exited_without_result')
        self.assertEqual([x['type'] for x in r['rows'] if x['type'].endswith('result')], ['child_result'])

    def test_root_cancellation_terminal_reason_remains_available(self):
        r, _, _, _ = self.run_child(self.emits({'type': 'result', 'subtype': 'success', 'is_error': False,
            'terminal_reason': 'aborted_tools', 'result': 'cancelled',
            'permission_denials': [{'tool_input': {'source': 'PRIVATE_TOOL_INPUT'}}]}))
        self.assertEqual(r['rows'][-1]['terminal_reason'], 'aborted_tools')
        self.assertNotIn('permission_denials', r['rows'][-1])

    def test_init_registry_tool_names_exclude_schemas_descriptions_and_unknown_entries(self):
        r, state, _, _ = self.run_child(self.emits(
            {'type': 'system', 'subtype': 'init', 'session_id': 's', '_requestId': 'r',
             'tools': ['Agent', 'Read', {'name': 'mcp__project__read', 'description': 'PRIVATE_DESCRIPTION',
                        'inputSchema': {'source': 'PRIVATE_TOOL_SCHEMA'}}, 'Agent', 7, {'prompt': 'PRIVATE_TOOL_BODY'}]},
            {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done'}))
        offered = [x for x in r['rows'] if 'registryTools' in x]
        self.assertEqual(offered[0]['registryTools'], ['Agent', 'Read', 'mcp__project__read'])
        self.assertEqual(offered[0]['toolInventoryScope'], 'cli_registry_not_actual_request_tools')
        self.assertNotIn('offeredTools', offered[0])
        self.assertEqual((offered[0]['session_id'], offered[0]['_requestId']), ('s', 'r'))
        self.assertFalse(offered[0]['recognizedActivity'])
        for marker in ('PRIVATE_DESCRIPTION', 'PRIVATE_TOOL_SCHEMA', 'PRIVATE_TOOL_BODY'):
            self.assertNotIn(marker, json.dumps(r) + json.dumps(state))

    def test_completed_tool_input_selectors_survive_start_dedup_without_body_or_extra_count(self):
        r, _, _, _ = self.run_child(self.emits(
            start('m'),
            {'type': 'stream_event', 'parent_tool_use_id': None,
             'event': {'type': 'content_block_start', 'content_block':
                       {'type': 'tool_use', 'name': 'Agent', 'id': 'agent-tool', 'input': {}}}},
            assistant('m', content=[{'type': 'tool_use', 'name': 'Agent', 'id': 'agent-tool',
                       'input': {'subagent_type': 'reviewer', 'model': 'test-model', 'run_in_background': False,
                                 'name': '', 'team_name': None, 'resume': '',
                                 'prompt': 'PRIVATE_AGENT_PROMPT', 'description': 'PRIVATE_DESCRIPTION',
                                 'source': 'SOURCE_FULLTEXT_PRIVATE'}}]),
            {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done'}))
        self.assertEqual(r['toolCount'], 1)
        self.assertEqual(len([x for x in r['rows'] if x['type'] == 'tool_use']), 1)
        inputs = [x for x in r['rows'] if x['type'] == 'tool_input_metadata']
        self.assertEqual(len(inputs), 2)
        self.assertEqual((inputs[-1]['subagent_type'], inputs[-1]['model'], inputs[-1]['run_in_background']),
                         ('reviewer', 'test-model', False))
        self.assertTrue(all(inputs[-1][key] for key in ('namePresent', 'teamNamePresent', 'resumePresent')))
        self.assertTrue(all(not inputs[0][key] for key in ('namePresent', 'teamNamePresent', 'resumePresent')))
        for marker in ('PRIVATE_AGENT_PROMPT', 'PRIVATE_DESCRIPTION', 'SOURCE_FULLTEXT_PRIVATE'):
            self.assertNotIn(marker, json.dumps(r))

    def test_agent_background_mode_and_unsupported_option_presence_are_safe_metadata(self):
        r, _, _, _ = self.run_child(self.emits(
            assistant('one', content=[{'type': 'tool_use', 'name': 'Agent', 'id': 'a', 'input': {
                'subagent_type': 'reviewer', 'model': 'test-model', 'mode': 'plan', 'background': True,
                'run_in_background': False, 'max_turns': 1, 'prompt': 'PRIVATE_PROMPT', 'description': 'PRIVATE_DESCRIPTION'}}]),
            assistant('two', content=[{'type': 'tool_use', 'name': 'Agent', 'id': 'b', 'input': {
                'subagent_type': 'reviewer', 'mode': 'default', 'background': False, 'unknown_option': 'PRIVATE_UNKNOWN'}}]),
            {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done'}))
        inputs = [x for x in r['rows'] if x['type'] == 'tool_input_metadata']
        self.assertEqual((inputs[0]['background'], inputs[0]['run_in_background'], inputs[0]['mode']),
                         (True, False, 'plan'))
        self.assertFalse(inputs[0]['unsupportedOptionPresent'])
        self.assertEqual((inputs[1]['background'], inputs[1]['mode']), (False, 'default'))
        self.assertTrue(inputs[1]['unsupportedOptionPresent'])
        for marker in ('PRIVATE_PROMPT', 'PRIVATE_DESCRIPTION', 'PRIVATE_UNKNOWN'):
            self.assertNotIn(marker, json.dumps(r))

    def test_legal_tool_progress_prevents_short_idle_timeout(self):
        code = self.emits(start('m')) + "for i in range(8):\n emit({'type':'tool_progress','tool_use_id':'t','tool_name':'Read','elapsed_time_seconds':i*.08}); time.sleep(.08)\n"
        code += self.emits({'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done'})
        r, _, _, elapsed = self.run_child(code, total=2, idle=.22)
        self.assertIsNone(r['timeoutReason'])
        self.assertGreater(elapsed, .55)
        self.assertEqual(r['toolCount'], 0)

    def test_tool_progress_does_not_extend_total_deadline(self):
        code = self.emits(start('m')) + "for i in range(100):\n emit({'type':'tool_progress','tool_use_id':'t','tool_name':'Read','elapsed_time_seconds':i*.05}); time.sleep(.05)\n"
        r, _, _, elapsed = self.run_child(code, total=.65, first=.5, idle=.22)
        self.assertEqual(r['timeoutReason'], 'total_timeout')
        self.assertTrue(r['processKilled'])
        self.assertLess(elapsed, 4)

    def test_tool_result_and_lifecycle_update_activity_without_storing_bodies(self):
        code = self.emits(start('m')) + '''
for i in range(6):
 emit({'type':'user','message':{'content':[{'type':'tool_result','tool_use_id':'t','content':'PRIVATE_TOOL_RESULT'}]}})
 time.sleep(.07)
 emit({'type':'system','subtype':'task_progress','task_id':'task-child','tool_use_id':'agent-tool','description':'PRIVATE_DESCRIPTION','usage':{'total_tokens':i,'tool_uses':i,'duration_ms':i*140}})
 time.sleep(.07)
'''
        code += self.emits({'type': 'system', 'subtype': 'task_started', 'task_id': 'new', 'tool_use_id': 'child', 'task_type': 'Agent', 'description': 'PRIVATE_DESCRIPTION'},
                           {'type': 'system', 'subtype': 'task_updated', 'task_id': 'new', 'patch': {'status': 'completed', 'source': 'PRIVATE_PATCH'}},
                           {'type': 'system', 'subtype': 'task_notification', 'task_id': 'new', 'status': 'completed', 'summary': 'PRIVATE_SUMMARY'},
                           {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done'})
        r, _, _, _ = self.run_child(code, total=2, idle=.22)
        self.assertIsNone(r['timeoutReason'])
        serialized = json.dumps(r)
        for marker in ('PRIVATE_TOOL_RESULT', 'PRIVATE_DESCRIPTION', 'PRIVATE_PATCH', 'PRIVATE_SUMMARY'):
            self.assertNotIn(marker, serialized)
        lifecycle = [x for x in r['rows'] if x.get('subtype') in ('task_started', 'task_updated', 'task_notification')]
        self.assertTrue(all(x['recognizedActivity'] for x in lifecycle))
        self.assertEqual(r['subagentLanes'], 1)

    def test_unknown_text_and_malformed_progress_do_not_refresh_idle(self):
        code = self.emits(start('m')) + '''
for i in range(100):
 emit({'type':'system','subtype':'unrecognized','text':'PRIVATE_ARBITRARY_TEXT','task_id':'x'})
 emit({'type':'tool_progress','tool_use_id':'t','text':'PRIVATE_ARBITRARY_TEXT'})
 emit({'type':'system','subtype':'task_progress','task_id':'x','description':'PRIVATE_ARBITRARY_TEXT'})
 time.sleep(.04)
'''
        r, _, _, _ = self.run_child(code, total=2, idle=.24)
        self.assertEqual(r['timeoutReason'], 'idle_timeout')
        self.assertNotIn('PRIVATE_ARBITRARY_TEXT', json.dumps(r))
        self.assertTrue(all(not x['recognizedActivity'] for x in r['rows'] if 'recognizedActivity' in x))

    def test_unrecognized_system_and_init_do_not_satisfy_first_activity(self):
        code = "for i in range(100):\n emit({'type':'system','subtype':'task_started','description':'PRIVATE_TEXT'}); time.sleep(.04)\n"
        r, _, _, _ = self.run_child(code, first=.35, total=2)
        self.assertEqual(r['timeoutReason'], 'first_output_timeout')
        self.assertIsNone(r['firstModelActivitySeconds'])

    def test_malformed_model_and_tool_metadata_do_not_manufacture_activity(self):
        code = '''
for i in range(100):
 emit({'type':'assistant','message':{'content':'PRIVATE_ARBITRARY_TEXT'}})
 emit({'type':'stream_event','event':{'type':'message_start','message':{'content':'PRIVATE_ARBITRARY_TEXT'}}})
 emit({'type':'stream_event','event':{'delta':{'type':['unknown'],'text':'PRIVATE_ARBITRARY_TEXT'}}})
 emit({'type':'tool_use','text':'PRIVATE_ARBITRARY_TEXT'})
 time.sleep(.04)
'''
        r, _, _, _ = self.run_child(code, first=.35, total=2)
        self.assertEqual(r['timeoutReason'], 'first_output_timeout')
        self.assertEqual(r['modelMessageCount'], 0)
        self.assertIsNone(r['firstModelActivitySeconds'])
        self.assertNotIn('PRIVATE_ARBITRARY_TEXT', json.dumps(r))

    def test_message_budget_stops_process_and_windows_descendant_tree(self):
        code = '''
if os.name=='nt':
 import subprocess
 script="import time;from pathlib import Path;p=Path('descendant-heartbeat');\\nwhile True: p.write_text(str(time.time()));time.sleep(.025)"
 child=subprocess.Popen([sys.executable,'-u','-c',script],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 Path('descendant-pid').write_text(str(child.pid))
 time.sleep(.15)
'''
        code += self.emits(start('one'), assistant('one'), start('two')) + 'time.sleep(30)\n'
        r, state, directory, elapsed = self.run_child(code, total=3, cap=1)
        self.assertEqual(r['timeoutReason'], 'budget_timeout')
        self.assertEqual(r['modelMessageCount'], 2)
        self.assertTrue(r['processKilled'])
        self.assertFalse(r['resultSeen'])
        self.assertEqual(state['phase'], 'timeout')
        self.assertLess(elapsed, 4)
        if os.name == 'nt':
            pid = int((directory / 'descendant-pid').read_text())
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel.OpenProcess.restype = ctypes.c_void_p
            kernel.OpenProcess.argtypes = (ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32)
            kernel.WaitForSingleObject.argtypes = (ctypes.c_void_p, ctypes.c_uint32)
            kernel.CloseHandle.argtypes = (ctypes.c_void_p,)
            handle = kernel.OpenProcess(0x100000, 0, pid)
            if handle:
                try:
                    self.assertEqual(kernel.WaitForSingleObject(handle, 1000), 0, 'descendant remains alive')
                finally:
                    kernel.CloseHandle(handle)

    def test_cap_is_checked_for_buffered_stream_even_when_child_already_exited(self):
        r, _, _, _ = self.run_child(self.emits(start('one'), start('two'),
            {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'already exited'}), cap=1)
        self.assertEqual(r['timeoutReason'], 'budget_timeout')

    @unittest.skipUnless(os.name == 'nt', 'Windows Job Object semantics')
    def test_exited_root_and_buffered_budget_cap_still_terminate_living_descendant(self):
        code = '''
import subprocess
script="import time;from pathlib import Path;p=Path('descendant-heartbeat');\\nwhile True: p.write_text(str(time.time()));time.sleep(.025)"
child=subprocess.Popen([sys.executable,'-u','-c',script])
Path('descendant-pid').write_text(str(child.pid))
time.sleep(.1)
'''
        code += self.emits(start('pause-for-root-exit'), start('second')) + 'os._exit(0)\n'

        def delayed_metadata(value):
            if value == 'pause-for-root-exit':
                time.sleep(.2)
            return value

        r, _, directory, _ = self.run_child(code, cap=1, redactor=delayed_metadata)
        self.assertEqual(r['exitCode'], 0, 'root must exit itself before budget cleanup')
        self.assertEqual(r['timeoutReason'], 'budget_timeout')
        self.assertTrue(r['processKilled'], 'living descendant must require cleanup after root exit')
        stamp = (directory / 'descendant-heartbeat').read_text()
        time.sleep(.1)
        self.assertEqual((directory / 'descendant-heartbeat').read_text(), stamp)

    @unittest.skipUnless(os.name == 'nt', 'Windows suspended launch and Job Object binding')
    def test_job_binding_failure_reaps_suspended_root_before_it_runs(self):
        directory = ARTIFACTS / ('bind-fail-' + uuid.uuid4().hex[:6])
        directory.mkdir(parents=True)
        launched = []
        actual_popen = streaming.subprocess.Popen

        def launch(*args, **kwargs):
            process = actual_popen(*args, **kwargs)
            launched.append(process)
            return process

        with patch.object(streaming.subprocess, 'Popen', side_effect=launch), \
             patch.object(streaming, '_WindowsProcessTree', side_effect=OSError('offline binding failure')):
            with self.assertRaisesRegex(OSError, 'offline binding failure'):
                collect_process([sys.executable, '-u', '-c', PRE + 'time.sleep(5)'], str(directory),
                                dict(os.environ), 'input', 1, 1, 1, str(directory / 'progress.json'),
                                'test-model', lambda s: s, agent_mode=True)
        self.assertEqual(len(launched), 1)
        self.assertIsNotNone(launched[0].poll())
        self.assertTrue(all(pipe.closed for pipe in (launched[0].stdin, launched[0].stdout, launched[0].stderr)))
        self.assertFalse((directory / 'input-metadata.json').exists(), 'unbound suspended CLI must not execute')

    @unittest.skipUnless(os.name == 'nt', 'Windows Job Object breakaway restrictions')
    def test_job_does_not_allow_descendant_breakaway(self):
        code = '''
import subprocess
try:
 child=subprocess.Popen([sys.executable,'-u','-c','import time;time.sleep(10)'],creationflags=0x01000000)
except OSError:
 Path('breakaway-rejected').write_text('true')
else:
 Path('breakaway-rejected').write_text('false')
 child.kill();child.wait()
'''
        code += self.emits({'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done'})
        _, _, directory, _ = self.run_child(code)
        self.assertEqual((directory / 'breakaway-rejected').read_text(), 'true')

    def test_usage_metrics_keep_numeric_credit_and_model_usage_without_embedded_bodies(self):
        r, state, _, _ = self.run_child(self.emits(
            {'type': 'provider_event', 'model': 'test-model', 'providerData': {'model': 'test-model',
             'rawUsage': {'credit': 0, 'total_tokens': 7, 'provider_numeric_string': '2.5',
                          'source': 'PRIVATE_SOURCE', 'thinking': 'PRIVATE_THINKING',
                          'tool_input': {'prompt': 'PRIVATE_TOOL_INPUT'}, 'diagnostic': 'PRIVATE_DIAGNOSTIC'}}},
            {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'done',
             'modelUsage': {'test-model': {'inputTokens': 3, 'outputTokens': 5}},
             'usage': {'input_tokens': 3, 'service_tier': 'standard', 'content': 'PRIVATE_CONTENT'}}))
        raw = [x['providerData']['rawUsage'] for x in r['rows'] if 'providerData' in x][0]
        self.assertEqual(raw, {'credit': 0, 'total_tokens': 7, 'provider_numeric_string': '2.5'})
        self.assertEqual(r['rows'][-1]['modelUsage'], {'test-model': {'inputTokens': 3, 'outputTokens': 5}})
        self.assertEqual(r['rows'][-1]['usage'], {'input_tokens': 3, 'service_tier': 'standard'})
        for marker in ('PRIVATE_SOURCE', 'PRIVATE_THINKING', 'PRIVATE_TOOL_INPUT', 'PRIVATE_DIAGNOSTIC', 'PRIVATE_CONTENT'):
            self.assertNotIn(marker, json.dumps(r) + json.dumps(state))

    def test_partial_thinking_tool_input_and_source_echo_are_not_persisted(self):
        rows = [start('m'),
                {'type': 'stream_event', 'event': {'type': 'content_block_delta', 'delta': {'type': 'text_delta', 'text': 'PRIVATE_PARTIAL'}}},
                {'type': 'stream_event', 'event': {'type': 'content_block_delta', 'delta': {'type': 'thinking_delta', 'thinking': 'PRIVATE_THINKING'}}},
                {'type': 'stream_event', 'event': {'type': 'content_block_delta', 'delta': {'type': 'input_json_delta', 'partial_json': 'PRIVATE_ARGUMENT_DELTA'}}},
                {'type': 'stream_event', 'event': {'type': 'content_block_start', 'content_block': {'type': 'thinking', 'thinking': 'PRIVATE_BLOCK_THINKING', 'signature': 'PRIVATE_SIGNATURE'}}},
                {'type': 'user', 'message': {'content': 'SOURCE_FULLTEXT_PRIVATE'}},
                assistant('m', content=[{'type': 'text', 'text': 'PRIVATE_ASSISTANT_BODY'}, {'type': 'tool_use', 'id': 't', 'name': 'Read', 'input': {'source': 'PRIVATE_TOOL_INPUT'}}]),
                {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'safe final'}]
        r, state, directory, _ = self.run_child(self.emits(*rows))
        safe = json.dumps(r) + json.dumps(state)
        for marker in ('PRIVATE_PARTIAL', 'PRIVATE_THINKING', 'PRIVATE_ARGUMENT_DELTA', 'PRIVATE_BLOCK_THINKING',
                       'PRIVATE_SIGNATURE', 'SOURCE_FULLTEXT_PRIVATE', 'PRIVATE_ASSISTANT_BODY', 'PRIVATE_TOOL_INPUT'):
            self.assertNotIn(marker, safe)
        self.assertEqual(r['textCharacters'], len('PRIVATE_PARTIAL'))
        self.assertEqual(r['thinkingCharacters'], len('PRIVATE_THINKING'))
        self.assertIn('SOURCE_FULLTEXT_PRIVATE', (directory / 'fixture-stdout.ndjson').read_text(encoding='utf-8'))

    def test_anonymous_messages_are_explicitly_counted_and_cap_applies(self):
        r, _, _, _ = self.run_child(self.emits(assistant(None), assistant(None)) + 'time.sleep(5)\n', cap=1)
        self.assertEqual(r['modelMessageCount'], 2)
        self.assertEqual(r['unidentifiedModelMessageCount'], 2)
        self.assertEqual(r['timeoutReason'], 'budget_timeout')

    def test_invalid_caps_fail_before_process_launch(self):
        for cap in (0, -1, 1.5, True, '1'):
            with self.subTest(cap=cap), self.assertRaises(ValueError):
                collect_process(['must-not-launch'], str(HERE), {}, '', 1, 1, 1, str(HERE / 'must-not-exist'),
                                'test-model', lambda s: s, agent_mode=True, max_model_messages=cap)

    def test_default_mode_ignores_cap_and_preserves_legacy_child_result_behavior(self):
        r, state, _, _ = self.run_child(self.emits(start('a'), start('b'),
            {'type': 'result', 'parent_tool_use_id': 'child', 'subtype': 'success', 'is_error': False, 'result': 'legacy'}),
            cap=1, agent=False)
        self.assertTrue(r['resultSeen'])
        self.assertIsNone(r['timeoutReason'])
        self.assertNotIn('modelMessageCount', r)
        self.assertNotIn('modelMessageCount', state)
        self.assertEqual(r['rows'][-1]['type'], 'result')


if __name__ == '__main__':
    unittest.main()
