# -*- coding: utf-8 -*-
"""Offline caller/guard acceptance. No model, runtime credentials, or API calls."""

import concurrent.futures
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest import mock
import uuid

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import agent_guard as guard
import project_agents as caller
import streaming

EVIDENCE = Path(tempfile.mkdtemp(prefix='imsaver-agent-tests-'))
EVIDENCE.mkdir(exist_ok=True)
RUN = EVIDENCE / (time.strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:8])
RUN.mkdir()
PRIVATE_PROMPT = 'PRIVATE_PROMPT_CANARY_f8dcb2'
PRIVATE_SOURCE = 'PRIVATE_SOURCE_CANARY_4b71a9'
OFFLINE_KEY = 'offline-placeholder-for-tests'
PINNED_NONPROJECT_TOOLS = frozenset((
    'PowerShell', 'EnterPlanMode', 'ExitPlanMode', 'TaskCreate', 'TaskGet',
    'TaskUpdate', 'TaskList', 'SkillManage', 'Component', 'Mods',
    'AskUserQuestion', 'AskUserForStructuredInput', 'StructuredOutput',
    'SendUserMessage', 'LSP', 'ImageGen', 'LibraryUpload', 'VideoGen',
    'AudioTranscribe', 'Artifact', 'ArtifactControl', 'EnterWorktree',
    'LeaveWorktree', 'CronCreate', 'CronDelete', 'CronList', 'WeChatReply',
    'WeComReply', 'PushNotification', 'ReportFindings', 'ComputerUse',
    'ListMcpResources', 'ReadMcpResource', 'WaitForMcpServers', 'Monitor',
    'REPL', 'A2AGetAgentCard', 'A2ASendMessage', 'A2AGetTask', 'A2ACancelTask',
    'MessageColleague', 'SpeakInChannel', 'ChannelTasks', 'CreateColleague',
    'CreateChannel', 'ListColleagues',
))


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def root_rows():
    return [
        {'type': 'assistant', 'message': {'id': 'root-message', 'model': guard.MODEL}},
        {'type': 'tool_use', 'name': guard.MCP_TOOLS[2], 'id': 'read-1'},
        {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'ROOT_OK',
         'usage': {'input_tokens': 7, 'output_tokens': 3},
         'modelUsage': {guard.MODEL: {'inputTokens': 7, 'outputTokens': 3}}},
    ]


def observation(rows=None, **changes):
    value = {'rows': root_rows() if rows is None else rows, 'exitCode': 0,
             'stderrTail': '', 'timeoutReason': None, 'protocolErrors': 0,
             'processTerminated': True, 'readersStopped': True, 'processId': 0}
    value.update(changes)
    return value


def spawn_rows(roles):
    values = root_rows()[:-1]
    for index, role in enumerate(roles):
        identity = 'spawn-' + str(index)
        values.extend([
            {'type': 'tool_use', 'name': 'Agent', 'id': identity},
            {'type': 'tool_input_metadata', 'name': 'Agent', 'id': identity,
             'subagent_type': role, 'model': guard.MODEL, 'run_in_background': False,
             'namePresent': False, 'teamNamePresent': False, 'resumePresent': False},
        ])
    return values + root_rows()[-1:]


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.work = RUN / self._testMethodName
        self.work.mkdir()
        self.root = self.work / 'project'
        self.root.mkdir()
        (self.root / 'guide.md').write_text('Read-only synthetic project.\n', encoding='utf-8')
        self.control = self.work / 'control'
        self.control.mkdir()
        self.state = self.control / 'guard.json'
        self.audit = self.control / 'guard.jsonl'

    def invoke_guard(self, event=None, raw=None):
        payload = raw if raw is not None else compact(event).encode('utf-8')
        command = [sys.executable, '-B', str(HERE / 'agent_guard.py'),
                   '--state', str(self.state), '--audit', str(self.audit)]
        value = subprocess.run(command, input=payload, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, timeout=12,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        record = {'stdin_sha256': hashlib.sha256(payload).hexdigest(), 'stdin_bytes': len(payload),
                  'stdout': value.stdout.decode('utf-8', errors='replace'),
                  'stderr': value.stderr.decode('utf-8', errors='replace'), 'exit_code': value.returncode}
        (self.control / ('terminal-' + uuid.uuid4().hex + '.json')).write_text(compact(record) + '\n', encoding='utf-8')
        self.assertEqual(value.returncode, 0, record['stderr'])
        self.assertEqual(value.stderr, b'')
        lines = value.stdout.decode('utf-8').splitlines()
        self.assertEqual(len(lines), 1)
        reply = json.loads(lines[0])
        self.assertEqual(reply['hookSpecificOutput']['hookEventName'], 'PreToolUse')
        # Input is hashed above; prompt/source bodies never enter transcripts.
        return reply['hookSpecificOutput']

    def agent_event(self, role='evidence-reader', **fields):
        args = {'subagent_type': role, 'prompt': PRIVATE_PROMPT, 'description': PRIVATE_SOURCE}
        args.update(fields)
        return {'tool_name': 'Agent', 'tool_input': args}

    def test_guard_real_stdin_exact_tools_and_no_prompt_in_audit(self):
        for name in guard.MCP_TOOLS:
            reply = self.invoke_guard({'tool_name': name, 'tool_input': {'query': PRIVATE_SOURCE}})
            self.assertEqual(reply['permissionDecision'], 'allow')
        for name in ('Read', 'Bash', 'Write', 'SendMessage', 'TeamCreate', 'PowerShell',
                     'REPL', 'ComputerUse', 'MessageColleague', 'mcp__other__project_read'):
            reply = self.invoke_guard({'tool_name': name, 'tool_input': {'content': PRIVATE_SOURCE}})
            self.assertEqual(reply['permissionDecision'], 'deny')
        audit = self.audit.read_text(encoding='utf-8')
        self.assertNotIn(PRIVATE_PROMPT, audit)
        self.assertNotIn(PRIVATE_SOURCE, audit)
        self.assertNotIn('tool_input', audit)

    def test_guard_agent_options_and_unknown_roles_deny(self):
        bad = [self.agent_event('unknown-role')]
        for fields in ({'name': 'instance'}, {'team_name': 'team'}, {'teamName': 'team'},
                       {'resume': 'old-session'}, {'run_in_background': True}, {'background': True},
                       {'model': 'other-model'}, {'mode': 'acceptEdits'}, {'permissionMode': 'default'}):
            bad.append(self.agent_event(**fields))
        for event in bad:
            with self.subTest(options=sorted(event['tool_input'])):
                self.assertEqual(self.invoke_guard(event)['permissionDecision'], 'deny')
        reply = self.invoke_guard(self.agent_event(model=guard.MODEL, mode='dontAsk', run_in_background=False))
        self.assertEqual(reply['permissionDecision'], 'allow')
        self.assertEqual(self.invoke_guard(self.agent_event())['permissionDecisionReason'], 'role_already_used')

    def test_guard_spawn_two_cross_process_shared_lock(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            replies = list(pool.map(self.invoke_guard, [self.agent_event(role) for role in guard.ROLES]))
        self.assertEqual(sum(reply['permissionDecision'] == 'allow' for reply in replies), 2)
        self.assertEqual(sum(reply['permissionDecisionReason'] == 'spawn_budget_exhausted' for reply in replies), 1)
        state = json.loads(self.state.read_text(encoding='utf-8'))
        self.assertEqual(len(state['roles']), 2)
        self.assertEqual(len(set(state['roles'])), 2)
        self.assertEqual(state['maxSpawns'], 2)
        reply = self.invoke_guard(self.agent_event(guard.ROLES[0]))
        self.assertEqual(reply['permissionDecision'], 'deny')
        self.assertEqual(len(json.loads(self.state.read_text(encoding='utf-8'))['roles']), 2)

    def test_guard_malformed_oversized_and_corrupt_state_fail_closed(self):
        for raw in (b'not-json', b'[]', b'X' * 65537):
            self.assertEqual(self.invoke_guard(raw=raw)['permissionDecision'], 'deny')
        self.state.write_text('{invalid', encoding='utf-8')
        self.assertEqual(self.invoke_guard(self.agent_event())['permissionDecision'], 'deny')

    def test_parse_success_with_project_tools_and_root_usage(self):
        rows = root_rows()
        rows.insert(0, {'type': 'provider_metadata', 'providerData': {'model': guard.MODEL,
                                                                    'rawUsage': {'credit': 0, 'input_tokens': 99}}})
        result, text = caller.parse_agent_result(observation(rows))
        self.assertEqual((result['status'], text), ('success', 'ROOT_OK'))
        self.assertEqual(result['toolCalls'], 1)
        self.assertEqual(result['usage'], {'input_tokens': 7, 'output_tokens': 3})
        self.assertEqual(result['modelUsage'], {guard.MODEL: {'inputTokens': 7, 'outputTokens': 3}})
        self.assertFalse(result['billingUnknown'])
        self.assertEqual(result['usageScope'], 'root_cli_aggregate_not_added_to_provider_or_child_rows')

    def test_parse_child_cannot_supply_or_override_root_result(self):
        child = {'type': 'result', 'subtype': 'success', 'is_error': False,
                 'result': 'CHILD_MUST_NOT_WIN', 'parent_tool_use_id': 'spawn-0'}
        rows = root_rows()[:-1] + [child]
        result, text = caller.parse_agent_result(observation(rows))
        self.assertEqual(result['status'], 'missing_result')
        self.assertEqual(text, '')
        result, text = caller.parse_agent_result(observation(root_rows() + [child]))
        self.assertEqual((result['status'], text), ('success', 'ROOT_OK'))
        child['type'] = 'child_result'
        result, text = caller.parse_agent_result(observation(root_rows() + [child]))
        self.assertEqual((result['status'], text), ('success', 'ROOT_OK'))

    def test_parse_illegal_tool_recursive_agent_and_spawn_limits(self):
        cases = []
        rows = root_rows()
        rows.insert(1, {'type': 'tool_use', 'name': 'Write', 'id': 'illegal'})
        cases.append(rows)
        rows = spawn_rows(['evidence-reader'])
        rows[2]['parent_tool_use_id'] = 'parent-agent'
        cases.append(rows)
        cases.append(spawn_rows(list(guard.ROLES)))
        cases.append(spawn_rows(['evidence-reader', 'evidence-reader']))
        for rows in cases:
            result, text = caller.parse_agent_result(observation(rows))
            self.assertEqual(result['status'], 'tool_contract_violation')
            self.assertEqual(text, '')
        result, text = caller.parse_agent_result(observation(spawn_rows(['evidence-reader', 'runtime-auditor'])))
        self.assertEqual((result['status'], text), ('success', 'ROOT_OK'))
        self.assertEqual(result['spawnCalls'], 2)

    def test_parse_forbidden_agent_options_and_model_mismatch(self):
        for options in ({'subagent_type': 'unknown-role'}, {'model': 'other-model'},
                        {'namePresent': True}, {'teamNamePresent': True}, {'resumePresent': True},
                        {'run_in_background': True}):
            rows = spawn_rows(['evidence-reader'])
            rows[3].update(options)
            result, text = caller.parse_agent_result(observation(rows))
            self.assertEqual(result['status'], 'tool_contract_violation', options)
            self.assertEqual(text, '')
        rows = root_rows()
        rows[0]['message']['model'] = 'other-model'
        result, text = caller.parse_agent_result(observation(rows))
        self.assertEqual(result['status'], 'model_mismatch')
        self.assertEqual(text, '')

    def test_parse_abort_timeout_and_unconfirmed_cleanup_never_success(self):
        for terminal in ('aborted_streaming', 'aborted_tools'):
            rows = root_rows()
            rows[-1]['terminal_reason'] = terminal
            result, text = caller.parse_agent_result(observation(rows))
            self.assertEqual(result['status'], 'cancelled_result')
            self.assertEqual(text, '')
        for changes in ({'timeoutReason': 'idle_timeout'}, {'processTerminated': False},
                        {'readersStopped': False}, {'protocolErrors': 1}, {'exitCode': 1}):
            result, text = caller.parse_agent_result(observation(**changes))
            self.assertNotEqual(result['status'], 'success')
            self.assertEqual(text, '')

    def test_streaming_agent_empty_start_then_complete_and_no_body_leak(self):
        rows, counts = [], {'partialCount': 0, 'textCharacters': 0, 'thinkingCharacters': 0}
        stream = streaming._AgentStream(rows, counts, lambda value: value)
        wire = [
            {'type': 'stream_event', 'event': {'type': 'message_start', 'message': {'id': 'root', 'model': guard.MODEL}}},
            {'type': 'stream_event', 'event': {'type': 'content_block_start', 'content_block': {
                'type': 'tool_use', 'id': 'agent-live', 'name': 'Agent', 'input': {}}}},
            {'type': 'stream_event', 'event': {'type': 'content_block_delta', 'delta': {
                'type': 'input_json_delta', 'partial_json': PRIVATE_PROMPT}}},
            {'type': 'assistant', 'message': {'id': 'root', 'model': guard.MODEL, 'content': [{
                'type': 'tool_use', 'id': 'agent-live', 'name': 'Agent', 'input': {
                    'subagent_type': 'evidence-reader', 'prompt': PRIVATE_PROMPT,
                    'description': PRIVATE_SOURCE, 'model': guard.MODEL, 'run_in_background': False}}]}},
            {'type': 'assistant', 'parent_tool_use_id': 'agent-live', 'message': {
                'id': 'child', 'model': guard.MODEL, 'content': [{'type': 'text', 'text': PRIVATE_SOURCE}]}},
            {'type': 'result', 'parent_tool_use_id': 'agent-live', 'subtype': 'success',
             'is_error': False, 'result': 'CHILD_OK'},
            root_rows()[-1],
        ]
        for frame in wire:
            stream.consume(frame)
        self.assertNotIn(PRIVATE_PROMPT, compact(rows))
        self.assertNotIn(PRIVATE_SOURCE, compact(rows))
        result, text = caller.parse_agent_result(observation(rows))
        self.assertEqual((result['status'], text), ('success', 'ROOT_OK'))
        self.assertEqual(result['spawnCalls'], 1)

    def test_permission_and_role_config_exact_whitelists(self):
        agents = caller.make_agents()
        self.assertEqual(set(agents), set(guard.ROLES))
        for agent in agents.values():
            self.assertEqual(agent['model'], guard.MODEL)
            self.assertEqual(agent['tools'], list(guard.MCP_TOOLS))
            self.assertIn('Agent', agent['disallowedTools'])
            self.assertEqual(agent['permissionMode'], 'dontAsk')
            self.assertIs(agent['background'], False)
        settings = caller.make_settings(self.control, 'high')
        allowed = ['Agent(' + role + ')' for role in guard.ROLES] + list(guard.MCP_TOOLS)
        self.assertEqual(settings['permissions']['allow'], allowed)
        self.assertEqual(settings['permissions']['defaultMode'], 'dontAsk')
        self.assertEqual(settings['permissions']['deny'], caller.DENY)
        hook = settings['hooks']['PreToolUse'][0]['hooks'][0]
        self.assertEqual(hook['allowedEnvVars'], ['PATH', 'SystemRoot', 'TEMP', 'TMP'])
        self.assertIn(str(HERE / 'agent_guard.py'), hook['command'])
        self.assertNotIn(PRIVATE_PROMPT, compact(settings))

    def test_legacy_adapter_copy_matches_canonical_bytes(self):
        # The frozen, previously accepted tool-free adapter is preserved bytewise.
        self.assertEqual(hashlib.sha256((HERE / 'run.py').read_bytes()).hexdigest(),
                         'b9c9eaafb4e075e9b39156c42bf04f906a8d20996ef0f8c080ee1e876eec4c7f')

    def test_pinned_runtime_inventory_denied_on_all_permission_surfaces(self):
        self.assertTrue(PINNED_NONPROJECT_TOOLS.issubset(set(caller.DENY)))
        settings = caller.make_settings(self.control, 'high')
        self.assertTrue(PINNED_NONPROJECT_TOOLS.issubset(set(settings['permissions']['deny'])))
        for agent in caller.make_agents().values():
            self.assertTrue(PINNED_NONPROJECT_TOOLS.issubset(set(agent['disallowedTools'])))
            self.assertTrue(PINNED_NONPROJECT_TOOLS.isdisjoint(set(agent['tools'])))

    def test_caller_run_config_environment_and_private_receipt_without_api(self):
        task = self.work / 'task.md'
        task.write_text('Review synthetic project evidence.\n', encoding='utf-8')
        private_home = self.work / 'private-home'
        private_home.mkdir()
        args = SimpleNamespace(root=str(self.root), task=str(task), out=str(self.work / 'out'),
                               effort='high', timeout=20, child_timeout=10, first_output_timeout=10,
                               idle_timeout=10, read_chars=180000, read_tools=48, output_tokens=4096,
                               model_messages=40, summary_chars=100)
        captured = {}
        def offline_collect(*positional, **kwargs):
            captured.update(argv=positional[0], cwd=positional[1], env=positional[2],
                            prompt=positional[3], options=kwargs)
            return observation()
        environment = {'PATH': os.environ.get('PATH', ''), 'SystemRoot': os.environ.get('SystemRoot', 'C:/Windows'),
                       'TEMP': str(self.work), 'TMP': str(self.work),
                       'CODEBUDDY_CODE_SUBAGENT_MODEL': 'inherited-unsafe-model',
                       'CODEBUDDY_MODEL': 'inherited-unsafe-model', 'IMSAVER_KEY': 'inherited-value',
                       'ANTHROPIC_API_KEY': 'inherited-value', 'OPENAI_API_KEY': 'inherited-value',
                       'AWS_SECRET_ACCESS_KEY': 'inherited-value', 'GITHUB_TOKEN': 'inherited-value',
                       'PASSWORD': 'inherited-value', 'SOME_CREDENTIAL': 'inherited-value',
                       'x_auth_value': 'inherited-value', 'BROWSER_COOKIE': 'inherited-value'}
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(caller.legacy, 'runtime', return_value=(
                {'version': 'offline'}, sys.executable, HERE / 'never-run-cli')))
            stack.enter_context(mock.patch.object(caller.legacy, 'credential', return_value=OFFLINE_KEY))
            stack.enter_context(mock.patch.object(caller.legacy, 'home', return_value=private_home))
            stack.enter_context(mock.patch.object(caller, 'collect_process', side_effect=offline_collect))
            stack.enter_context(mock.patch.dict(caller.os.environ, environment, clear=True))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            self.assertEqual(caller.run_task(args), 0)
        argv, env = captured['argv'], captured['env']
        self.assertEqual(argv[argv.index('--model') + 1], guard.MODEL)
        self.assertEqual(argv[argv.index('--tools') + 1], ','.join(('Agent',) + guard.MCP_TOOLS))
        self.assertEqual(argv[argv.index('--setting-sources') + 1], '')
        self.assertIn('--strict-mcp-config', argv)
        self.assertIn('--no-session-persistence', argv)
        denied_args = argv[argv.index('--disallowedTools') + 1:argv.index('--permission-mode')]
        self.assertTrue(PINNED_NONPROJECT_TOOLS.issubset(set(denied_args)))
        self.assertEqual(env['CODEBUDDY_CODE_SUBAGENT_MODEL'], guard.MODEL)
        self.assertEqual(env['CODEBUDDY_CODE_MAX_SUBAGENTS_PER_SESSION'], '2')
        self.assertEqual(env['CODEBUDDY_CODE_MAX_CONCURRENT_SUBAGENTS'], '2')
        self.assertEqual(env['CODEBUDDY_DISABLE_BUILTIN_SUBAGENTS'], '1')
        self.assertEqual(env['CODEBUDDY_DISABLE_FORK_SUBAGENT'], '1')
        self.assertEqual(env['CODEBUDDY_API_KEY'], OFFLINE_KEY)
        self.assertNotIn('CODEBUDDY_MODEL', env)
        self.assertTrue(all(name not in env for name in ('IMSAVER_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY')))
        self.assertTrue(all(name not in env for name in (
            'AWS_SECRET_ACCESS_KEY', 'GITHUB_TOKEN', 'PASSWORD', 'SOME_CREDENTIAL', 'x_auth_value', 'BROWSER_COOKIE')))
        self.assertEqual(captured['options'], {'agent_mode': True, 'max_model_messages': 40})
        self.assertEqual(list(Path(captured['cwd']).iterdir()), [])
        sandbox = Path(env['CODEBUDDY_CONFIG_DIR']).parent
        mcp = json.loads((sandbox / 'mcp.json').read_text(encoding='utf-8'))['mcpServers']['imsaver_project']
        self.assertEqual(mcp['command'], sys.executable)
        self.assertTrue(all(value == '' for value in mcp['env'].values()))
        self.assertIn(str(self.root), mcp['args'])
        receipt = json.loads((Path(args.out) / 'receipt.json').read_text(encoding='utf-8'))
        self.assertEqual(receipt['status'], 'success')
        self.assertEqual(receipt['codeBinding'], 'verified')
        self.assertEqual(receipt['codeSha256'], receipt['codeEndSha256'])
        self.assertFalse(receipt['limits']['costHardCap'])
        self.assertEqual((Path(args.out) / 'response.md').read_text(encoding='utf-8'), 'ROOT_OK\n')
        self.assertNotIn(OFFLINE_KEY, compact(receipt))
        status = caller.task_status(args.out)
        self.assertEqual(status['status'], 'success')
        self.assertEqual(status['gatewayCleanup']['status'], 'no_gateway_started')

    def test_runner_code_drift_cannot_save_success_or_response(self):
        task = self.work / 'task.md'
        task.write_text('Review synthetic project evidence.\n', encoding='utf-8')
        private_home = self.work / 'private-home'
        private_home.mkdir()
        args = SimpleNamespace(root=str(self.root), task=str(task), out=str(self.work / 'out'),
                               effort='high', timeout=20, child_timeout=10, first_output_timeout=10,
                               idle_timeout=10, read_chars=180000, read_tools=48, output_tokens=4096,
                               model_messages=40, summary_chars=100)
        code_names = {'project_agents.py', 'project_gateway.py', 'agent_guard.py', 'streaming.py', 'run.py'}
        original_read = Path.read_bytes
        actual_guard = original_read(HERE / 'agent_guard.py')
        phase = {'collected': False, 'initial_reads': set()}
        def simulated_read(path):
            raw = original_read(path)
            if path.parent == HERE and path.name in code_names:
                if not phase['collected']:
                    phase['initial_reads'].add(path.name)
                elif path.name == 'agent_guard.py':
                    return raw + b'\n# simulated code drift; actual file remains unchanged\n'
            return raw
        def offline_runtime():
            self.assertEqual(phase['initial_reads'], code_names)
            return {'version': 'offline'}, sys.executable, HERE / 'never-run-cli'
        def offline_collect(*positional, **kwargs):
            phase['collected'] = True
            return observation()
        output = io.StringIO()
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(Path, 'read_bytes', new=simulated_read))
            stack.enter_context(mock.patch.object(caller.legacy, 'runtime', side_effect=offline_runtime))
            stack.enter_context(mock.patch.object(caller.legacy, 'credential', return_value=OFFLINE_KEY))
            stack.enter_context(mock.patch.object(caller.legacy, 'home', return_value=private_home))
            stack.enter_context(mock.patch.object(caller, 'collect_process', side_effect=offline_collect))
            stack.enter_context(contextlib.redirect_stdout(output))
            self.assertEqual(caller.run_task(args), 1)
        receipt = json.loads((Path(args.out) / 'receipt.json').read_text(encoding='utf-8'))
        self.assertEqual(receipt['status'], 'runner_source_changed')
        self.assertEqual(receipt['attempts'][0]['status'], 'runner_source_changed')
        self.assertEqual(receipt['codeBinding'], 'stale')
        self.assertNotEqual(receipt['codeSha256']['agent_guard.py'], receipt['codeEndSha256']['agent_guard.py'])
        self.assertFalse((Path(args.out) / 'response.md').exists())
        self.assertNotIn('responseSha256', receipt)
        self.assertEqual(json.loads(output.getvalue())['summary'], '')
        self.assertEqual(original_read(HERE / 'agent_guard.py'), actual_guard)

    def test_real_stream_timeout_reaps_process_and_child_result_not_root(self):
        frames = [root_rows()[0], {'type': 'result', 'parent_tool_use_id': 'child-1',
                                   'subtype': 'success', 'is_error': False, 'result': 'CHILD_ONLY'}]
        code = "import json,sys,time; time.sleep(0.1); "
        code += "[print(json.dumps(row),flush=True) for row in " + repr(frames) + "]; time.sleep(60)"
        observed = streaming.collect_process([sys.executable, '-I', '-B', '-c', code], self.control,
            dict(os.environ), PRIVATE_PROMPT, 0.8, 3, 3, self.control / 'progress.json',
            guard.MODEL, lambda value: value, agent_mode=True, max_model_messages=5)
        self.assertEqual(observed['timeoutReason'], 'total_timeout')
        self.assertTrue(observed['processTerminated'])
        self.assertTrue(observed['readersStopped'])
        self.assertFalse(observed['resultSeen'])
        result, text = caller.parse_agent_result(observed)
        self.assertEqual((result['status'], text), ('timeout', ''))
        serialized = compact(observed)
        self.assertNotIn(PRIVATE_PROMPT, serialized)
        (self.control / 'collector-terminal.json').write_text(serialized + '\n', encoding='utf-8')

    @unittest.skipUnless(os.name == 'nt', 'owned gateway cleanup uses Windows process identity')
    def test_real_owned_gateway_cleanup_reclaims_only_session_process(self):
        session = 'offline-' + uuid.uuid4().hex
        controls = {'audit': self.control / 'gateway.jsonl', 'state': self.control / 'budget.json', 'session': session}
        process = subprocess.Popen([sys.executable, '-I', '-B', str(HERE / 'project_gateway.py'),
            '--root', str(self.root), '--audit', str(controls['audit']), '--budget-state', str(controls['state']),
            '--session-id', session], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            deadline = time.monotonic() + 5
            while not controls['audit'].exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(controls['audit'].exists())
            cleanup = caller.gateway_cleanup(controls)
            (self.control / 'cleanup-terminal.json').write_text(compact(cleanup) + '\n', encoding='utf-8')
            self.assertEqual(cleanup['status'], 'confirmed', cleanup)
            self.assertEqual(len(cleanup['processes']), 1)
            self.assertEqual(cleanup['processes'][0]['pid'], process.pid)
            self.assertTrue(cleanup['processes'][0]['owned'])
            self.assertTrue(cleanup['processes'][0]['reclaimed'])
            self.assertTrue(cleanup['processes'][0]['terminated'])
            process.wait(timeout=5)
        finally:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=5)
            for pipe in (process.stdin, process.stdout, process.stderr):
                pipe.close()


class EvidenceResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = []

    def addSuccess(self, test):
        self.records.append({'test': test.id(), 'status': 'passed'})
        super().addSuccess(test)

    def addSkip(self, test, reason):
        self.records.append({'test': test.id(), 'status': 'skipped', 'reason': reason})
        super().addSkip(test, reason)

    def addFailure(self, test, err):
        self.records.append({'test': test.id(), 'status': 'failed', 'traceback': self._exc_info_to_string(err, test)})
        super().addFailure(test, err)

    def addError(self, test, err):
        self.records.append({'test': test.id(), 'status': 'error', 'traceback': self._exc_info_to_string(err, test)})
        super().addError(test, err)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(AgentTests)
    result = unittest.TextTestRunner(verbosity=2, resultclass=EvidenceResult).run(suite)
    hashes = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in (
        'test_project_agents.py', 'project_agents.py', 'agent_guard.py', 'project_gateway.py', 'streaming.py', 'run.py')}
    summary = {'status': 'passed' if result.wasSuccessful() else 'failed', 'python': sys.version,
               'run_dir': str(RUN), 'tests_run': result.testsRun, 'skipped': len(result.skipped),
               'failures': len(result.failures), 'errors': len(result.errors), 'code_sha256': hashes,
               'tests': result.records, 'model_or_api_calls': 0, 'real_credential_access': False}
    (RUN / 'terminal-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(compact(summary))
    sys.exit(0 if result.wasSuccessful() else 1)
