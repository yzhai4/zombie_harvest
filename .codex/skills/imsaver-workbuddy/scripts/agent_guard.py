# -*- coding: utf-8 -*-
"""Trusted host hook; supplemental policy, not the filesystem security boundary."""
import argparse
import json
import os
from pathlib import Path
import sys
import time
from project_gateway import FileLock

ROLES = ('evidence-reader', 'script-designer', 'runtime-auditor')
MCP_TOOLS = tuple('mcp__imsaver_project__project_' + n for n in ('list', 'search', 'read'))
MODEL = 'deepseek-v4.1-flash'


def decide(event, state_path, audit_path, max_spawns=2):
    tool = event.get('tool_name')
    args = event.get('tool_input')
    decision, reason, role = 'deny', 'tool_not_authorized', None
    if tool in MCP_TOOLS and isinstance(args, dict):
        decision, reason = 'allow', 'readonly_gateway_enforces_scope'
    elif tool == 'Agent' and isinstance(args, dict):
        role = args.get('subagent_type')
        allowed_fields = {'subagent_type', 'prompt', 'description', 'model', 'mode',
                          'max_turns', 'run_in_background', 'background'}
        if set(args) - allowed_fields:
            reason = 'unsupported_agent_options'
        elif role not in ROLES:
            reason = 'unknown_role'
        elif any(args.get(k) for k in ('run_in_background', 'background')):
            reason = 'background_not_authorized'
        elif args.get('model', MODEL) != MODEL or args.get('mode', 'dontAsk') != 'dontAsk':
            reason = 'model_or_permission_override'
        else:
            state_path, audit_path = Path(state_path), Path(audit_path)
            with FileLock(state_path.with_suffix('.lock')):
                state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'roles': []}
                if state.get('maxSpawns', max_spawns) != max_spawns:
                    reason = 'policy_changed'
                elif len(state['roles']) >= max_spawns:
                    reason = 'spawn_budget_exhausted'
                elif role in state['roles']:
                    reason = 'role_already_used'
                else:
                    state['roles'].append(role)
                    state['maxSpawns'] = max_spawns
                    tmp = state_path.with_suffix('.tmp-' + str(os.getpid()))
                    tmp.write_text(json.dumps(state), encoding='utf-8')
                    os.replace(str(tmp), str(state_path))
                    decision, reason = 'allow', 'bounded_custom_agent'
    row = {'time': time.time(), 'pid': os.getpid(), 'tool': tool if tool in MCP_TOOLS + ('Agent',) else 'other',
           'role': role if role in ROLES else None, 'decision': decision, 'reason': reason}
    with FileLock(Path(audit_path).with_suffix('.lock')):
        with open(audit_path, 'a', encoding='utf-8') as stream:
            stream.write(json.dumps(row) + '\n')
    return {'hookSpecificOutput': {'hookEventName': 'PreToolUse',
            'permissionDecision': decision, 'permissionDecisionReason': reason}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--state', required=True)
    parser.add_argument('--audit', required=True)
    parser.add_argument('--max-spawns', type=int, default=2)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.max_spawns <= 2:
        raise ValueError('Invalid spawn budget')
    for value in (args.state, args.audit):
        if not Path(value).is_absolute() or not Path(value).parent.is_dir():
            raise ValueError('Private absolute control path required')
    if args.self_test:
        print(json.dumps({'status': 'ready', 'roles': ROLES, 'tools': MCP_TOOLS}))
        return
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ValueError('Oversized hook input')
        event = json.loads(raw)
        if not isinstance(event, dict):
            raise ValueError('Invalid hook input')
        result = decide(event, args.state, args.audit, args.max_spawns)
    except Exception:
        result = {'hookSpecificOutput': {'hookEventName': 'PreToolUse',
                  'permissionDecision': 'deny', 'permissionDecisionReason': 'guard_input_or_state_error'}}
    print(json.dumps(result))


if __name__ == '__main__':
    main()
