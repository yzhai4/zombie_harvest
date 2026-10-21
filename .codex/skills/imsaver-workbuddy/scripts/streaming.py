"""Bounded NDJSON collector. Progress excludes partial and thinking content."""
import hashlib
import json
import math
import os
import queue
import re
import subprocess
import threading
import time
from pathlib import Path


MESSAGE_BUDGET_SCOPE = 'observed_model_messages_not_upstream_api_requests_or_cost'
_LINEAGE_KEYS = ('parent_tool_use_id', 'session_id', '_requestId', '_messageId')
_TASK_SUBTYPES = ('task_started', 'task_progress', 'task_updated', 'task_notification')
_TASK_STATUSES = ('pending', 'running', 'paused', 'completed', 'failed', 'killed', 'stopped')
_BODY_KEYS = frozenset(('source', 'thinking', 'text', 'content', 'prompt', 'tool_input',
                        'input', 'arguments', 'partial_json', 'signature', 'description',
                        'result', 'errors', 'errors_info'))
_AGENT_INPUT_OPTIONS = frozenset(('subagent_type', 'prompt', 'description', 'model', 'mode',
                                  'max_turns', 'run_in_background', 'background'))


def _metric_metadata(value):
    """Keep usage metrics, without accepting arbitrary source/content strings."""
    if isinstance(value, dict):
        return {key: _metric_metadata(item) for key, item in value.items()
                if isinstance(key, str) and re.fullmatch(r'[A-Za-z0-9_./:-]{1,96}', key)
                and key.lower() not in _BODY_KEYS
                and (item is None or isinstance(item, (dict, list, int, float, bool))
                     or (isinstance(item, str) and (
                         re.fullmatch(r'[+-]?[0-9]+(?:\.[0-9]+)?', item)
                         or (key == 'service_tier' and item in ('standard', 'priority', 'batch')))))}
    if isinstance(value, list):
        return [_metric_metadata(item) for item in value
                if item is None or isinstance(item, (dict, list, int, float, bool))]
    return value


class _WindowsProcessTree:
    """Agent-only Job Object keeps descendants reachable after root CLI exit."""

    def __init__(self, process):
        import ctypes
        from ctypes import wintypes
        self.ctypes = ctypes
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        handle = wintypes.HANDLE
        self.kernel.CreateJobObjectW.argtypes = (ctypes.c_void_p, wintypes.LPCWSTR)
        self.kernel.CreateJobObjectW.restype = handle
        self.kernel.SetInformationJobObject.argtypes = (handle, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD)
        self.kernel.AssignProcessToJobObject.argtypes = (handle, handle)
        self.kernel.TerminateJobObject.argtypes = (handle, wintypes.UINT)
        self.kernel.QueryInformationJobObject.argtypes = (handle, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.c_void_p)
        self.kernel.CloseHandle.argtypes = (handle,)
        self.kernel.CreateToolhelp32Snapshot.argtypes = (wintypes.DWORD, wintypes.DWORD)
        self.kernel.CreateToolhelp32Snapshot.restype = handle
        self.kernel.OpenThread.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        self.kernel.OpenThread.restype = handle
        self.kernel.ResumeThread.argtypes = (handle,)
        self.kernel.ResumeThread.restype = wintypes.DWORD
        self.closed = self.termination_requested = False
        self.active_remaining = None

        class BasicLimits(ctypes.Structure):
            _fields_ = [('PerProcessUserTimeLimit', ctypes.c_longlong), ('PerJobUserTimeLimit', ctypes.c_longlong),
                        ('LimitFlags', wintypes.DWORD), ('MinimumWorkingSetSize', ctypes.c_size_t),
                        ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', wintypes.DWORD),
                        ('Affinity', ctypes.c_size_t), ('PriorityClass', wintypes.DWORD), ('SchedulingClass', wintypes.DWORD)]

        class IoCounters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_ulonglong) for name in
                        ('ReadOperationCount', 'WriteOperationCount', 'OtherOperationCount',
                         'ReadTransferCount', 'WriteTransferCount', 'OtherTransferCount')]

        class ExtendedLimits(ctypes.Structure):
            _fields_ = [('BasicLimitInformation', BasicLimits), ('IoInfo', IoCounters),
                        ('ProcessMemoryLimit', ctypes.c_size_t), ('JobMemoryLimit', ctypes.c_size_t),
                        ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t)]

        class Accounting(ctypes.Structure):
            _fields_ = [(name, ctypes.c_longlong) for name in
                        ('TotalUserTime', 'TotalKernelTime', 'ThisPeriodTotalUserTime', 'ThisPeriodTotalKernelTime')]
            _fields_ += [(name, wintypes.DWORD) for name in
                         ('TotalPageFaultCount', 'TotalProcesses', 'ActiveProcesses', 'TotalTerminatedProcesses')]

        self.accounting_type = Accounting
        self.wintypes = wintypes
        self.handle = self.kernel.CreateJobObjectW(None, None)
        if not self.handle:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            limits = ExtendedLimits()
            limits.BasicLimitInformation.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if not self.kernel.SetInformationJobObject(self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
                raise ctypes.WinError(ctypes.get_last_error())
            if not self.kernel.AssignProcessToJobObject(self.handle, int(process._handle)):
                raise ctypes.WinError(ctypes.get_last_error())
        except BaseException:
            self.close()
            raise

    def resume_root(self, process_id):
        """Resume the single initial thread only after assignment to the job."""
        ctypes, wintypes = self.ctypes, self.wintypes

        class ThreadEntry(ctypes.Structure):
            _fields_ = [(name, wintypes.DWORD) for name in
                        ('dwSize', 'cntUsage', 'th32ThreadID', 'th32OwnerProcessID')]
            _fields_ += [('tpBasePri', wintypes.LONG), ('tpDeltaPri', wintypes.LONG), ('dwFlags', wintypes.DWORD)]

        self.kernel.Thread32First.argtypes = (wintypes.HANDLE, ctypes.POINTER(ThreadEntry))
        self.kernel.Thread32Next.argtypes = (wintypes.HANDLE, ctypes.POINTER(ThreadEntry))
        snapshot = self.kernel.CreateToolhelp32Snapshot(0x00000004, 0)  # TH32CS_SNAPTHREAD
        if snapshot == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            entry = ThreadEntry()
            entry.dwSize = ctypes.sizeof(entry)
            present = self.kernel.Thread32First(snapshot, ctypes.byref(entry))
            while present:
                if entry.th32OwnerProcessID == process_id:
                    thread = self.kernel.OpenThread(0x0002, False, entry.th32ThreadID)  # THREAD_SUSPEND_RESUME
                    if not thread:
                        raise ctypes.WinError(ctypes.get_last_error())
                    try:
                        if self.kernel.ResumeThread(thread) == 0xffffffff:
                            raise ctypes.WinError(ctypes.get_last_error())
                    finally:
                        self.kernel.CloseHandle(thread)
                    return
                present = self.kernel.Thread32Next(snapshot, ctypes.byref(entry))
            raise RuntimeError('Suspended root process has no resumable initial thread')
        finally:
            self.kernel.CloseHandle(snapshot)

    def active_processes(self):
        usage = self.accounting_type()
        if not self.kernel.QueryInformationJobObject(self.handle, 1, self.ctypes.byref(usage),
                                                     self.ctypes.sizeof(usage), None):
            raise self.ctypes.WinError(self.ctypes.get_last_error())
        return usage.ActiveProcesses

    def terminate(self):
        was_active = self.active_processes() > 0
        if not self.kernel.TerminateJobObject(self.handle, 1):
            raise self.ctypes.WinError(self.ctypes.get_last_error())
        self.termination_requested = True
        deadline = time.monotonic() + 5
        while True:
            self.active_remaining = self.active_processes()
            if self.active_remaining == 0:
                break
            if time.monotonic() >= deadline:
                raise TimeoutError('Windows agent Job Object still has active descendants')
            time.sleep(.01)
        return was_active

    def close(self):
        if self.handle:
            if not self.kernel.CloseHandle(self.handle):
                raise self.ctypes.WinError(self.ctypes.get_last_error())
            self.handle = None
            self.closed = True


class _AgentStream:
    """Metadata-only agent protocol handling, separate from legacy collection."""

    def __init__(self, rows, counts, redact):
        self.rows, self.counts, self.redact = rows, counts, redact
        self.messages, self.tools, self.lanes = set(), set(), set()
        self.anonymous_messages = 0
        counts.update(modelMessageCount=0, toolCount=0, subagentLanes=0,
                      unidentifiedModelMessageCount=0)

    def scalar(self, value):
        return self.redact(value)[:512] if isinstance(value, str) else value

    def fields(self, row, keys):
        return {key: self.scalar(row[key]) for key in keys if key in row
                and (row[key] is None or isinstance(row[key], (str, int, float, bool)))}

    def lineage(self, row):
        parent = row.get('parent_tool_use_id')
        if isinstance(parent, str) and parent:
            self.lanes.add(parent)
            self.counts['subagentLanes'] = len(self.lanes)
        return self.fields(row, _LINEAGE_KEYS)

    def provider(self, data, lineage):
        if not isinstance(data, dict):
            return
        safe = self.fields(data, ('model',))
        if isinstance(data.get('rawUsage'), dict):
            safe['rawUsage'] = _metric_metadata(data['rawUsage'])
        if safe:
            self.rows.append(dict(type='provider_metadata', providerData=safe, **lineage))

    def message(self, row, message):
        # A stream start and completed assistant with the same model message id
        # represent one observed message. A request id can span several messages.
        identity = message.get('id') or row.get('_messageId')
        lane = row.get('parent_tool_use_id')
        lane = lane if isinstance(lane, str) and lane else None
        if isinstance(identity, str) and identity:
            key = (lane, identity)
        else:
            self.anonymous_messages += 1
            self.counts['unidentifiedModelMessageCount'] += 1
            key = ('anonymous', self.anonymous_messages)
        if key not in self.messages:
            self.messages.add(key)
            self.counts['modelMessageCount'] += 1

    def tool(self, row, block, lineage):
        identity = block.get('id') or block.get('tool_use_id')
        lane = row.get('parent_tool_use_id')
        lane = lane if isinstance(lane, str) and lane else None
        key = (lane, identity) if isinstance(identity, str) and identity else None
        tool_input = block.get('input')
        if isinstance(tool_input, dict):
            # Start frames often carry input={}; a completed tool_use carries
            # the selected role/model. Save only these selectors and presence
            # flags, even when the actual call metadata has already been seen.
            metadata = self.fields(block, ('name', 'id', 'tool_use_id'))
            for selector in ('subagent_type', 'model', 'mode'):
                if isinstance(tool_input.get(selector), str):
                    metadata[selector] = self.scalar(tool_input[selector])
            for boolean in ('run_in_background', 'background'):
                if isinstance(tool_input.get(boolean), bool):
                    metadata[boolean] = tool_input[boolean]
            metadata.update(namePresent='name' in tool_input,
                            teamNamePresent='team_name' in tool_input or 'teamName' in tool_input,
                            resumePresent='resume' in tool_input,
                            unsupportedOptionPresent=any(key not in _AGENT_INPUT_OPTIONS for key in tool_input))
            self.rows.append(dict(type='tool_input_metadata', **metadata, **lineage))
        if key is not None and key in self.tools:
            return
        if key is not None:
            self.tools.add(key)
        safe = self.fields(block, ('name', 'id', 'tool_use_id'))
        self.rows.append(dict(type='tool_use', **safe, **lineage))
        self.counts['toolCount'] += 1

    @staticmethod
    def valid_id(value):
        return isinstance(value, str) and bool(value)

    @staticmethod
    def nonnegative(value):
        return (isinstance(value, (int, float)) and not isinstance(value, bool)
                and math.isfinite(value) and value >= 0)

    def known_message(self, message):
        return isinstance(message, dict) and (
            self.valid_id(message.get('id')) or self.valid_id(message.get('model')))

    def known_tool(self, block):
        return (self.valid_id(block.get('name'))
                and self.valid_id(block.get('id') or block.get('tool_use_id')))

    def task_activity(self, row):
        if not self.valid_id(row.get('task_id')):
            return False
        subtype = row.get('subtype')
        if subtype == 'task_started':
            return isinstance(row.get('description'), str)
        if subtype == 'task_progress':
            usage = row.get('usage')
            return isinstance(usage, dict) and all(self.nonnegative(usage.get(key))
                for key in ('total_tokens', 'tool_uses', 'duration_ms'))
        if subtype == 'task_notification':
            return row.get('status') in ('completed', 'failed', 'stopped')
        if subtype == 'task_updated':
            patch = row.get('patch')
            return row.get('status') in _TASK_STATUSES or (
                isinstance(patch, dict) and patch.get('status') in _TASK_STATUSES)
        return False

    def consume(self, row):
        """Return (recognized activity, root result). Never save partial bodies."""
        kind = row.get('type')
        lineage = self.lineage(row)
        self.provider(row.get('providerData'), lineage)
        active, root_result = False, False
        if kind == 'stream_event':
            self.counts['partialCount'] += 1
            event = row.get('event')
            if not isinstance(event, dict):
                self.rows.append(dict(type='stream_event', **lineage))
                return False, False
            event_kind = event.get('type')
            safe_event = self.fields(event, ('type', 'index'))
            message = event.get('message')
            if isinstance(message, dict):
                safe_message = self.fields(message, ('id', 'model', 'stop_reason'))
                if isinstance(message.get('usage'), dict):
                    safe_message['usage'] = _metric_metadata(message['usage'])
                safe_event['message'] = safe_message
                self.provider(message.get('providerData'), lineage)
                if event_kind == 'message_start' and self.known_message(message):
                    self.message(row, message)
                    active = True
            if isinstance(event.get('usage'), dict):
                safe_event['usage'] = _metric_metadata(event['usage'])
            delta = event.get('delta')
            if isinstance(delta, dict):
                delta_kind = delta.get('type')
                field = ({'text_delta': 'text', 'thinking_delta': 'thinking',
                          'input_json_delta': 'partial_json'}.get(delta_kind)
                         if isinstance(delta_kind, str) else None)
                value = delta.get(field) if field else None
                if isinstance(value, str) and value:
                    active = True
                    if field in ('text', 'thinking'):
                        self.counts['textCharacters' if field == 'text' else 'thinkingCharacters'] += len(value)
                # Event type is safe; neither delta body nor stop sequence is retained.
                safe_event['delta'] = self.fields(delta, ('type', 'stop_reason'))
            block = event.get('content_block')
            if isinstance(block, dict) and block.get('type') in ('tool_use', 'function_call'):
                self.tool(row, block, lineage)
                active = active or self.known_tool(block)
            self.rows.append(dict(type='stream_event', event=safe_event, **lineage))
        elif kind == 'assistant':
            message = row.get('message')
            if not isinstance(message, dict):
                message = {}
            elif self.known_message(message):
                self.message(row, message)
                active = True
            content = message.get('content')
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') in ('tool_use', 'function_call'):
                        self.tool(row, block, lineage)
            safe = self.fields(message, ('id', 'model', 'stop_reason'))
            if isinstance(message.get('usage'), dict):
                safe['usage'] = _metric_metadata(message['usage'])
            self.provider(message.get('providerData'), lineage)
            self.rows.append(dict(type='assistant', message=safe, **lineage))
        elif kind == 'result':
            root_result = not bool(row.get('parent_tool_use_id'))
            safe = self.fields(row, ('subtype', 'is_error', 'duration_ms', 'duration_api_ms',
                                    'num_turns', 'total_cost_usd', 'terminal_reason'))
            for key in ('usage', 'modelUsage'):
                if isinstance(row.get(key), dict):
                    safe[key] = _metric_metadata(row[key])
            for key in ('result', 'structured_output', 'errors', 'errors_info'):
                if key in row:
                    safe[key] = json.loads(self.redact(json.dumps(row[key], ensure_ascii=False)))
            # No permission_denials.tool_input, _meta, or source echo is persisted.
            self.rows.append(dict(type='result' if root_result else 'child_result', **safe, **lineage))
        elif kind in ('tool_use', 'function_call', 'tool_call'):
            self.tool(row, row, lineage)
            active = self.known_tool(row)
        elif kind == 'tool_progress':
            safe = self.fields(row, ('tool_use_id', 'tool_name', 'elapsed_time_seconds'))
            active = (self.valid_id(row.get('tool_use_id')) and self.valid_id(row.get('tool_name'))
                      and self.nonnegative(row.get('elapsed_time_seconds')))
            self.rows.append(dict(type='tool_progress', recognizedActivity=active, **safe, **lineage))
        elif kind == 'user':
            message = row.get('message')
            content = message.get('content') if isinstance(message, dict) else None
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') == 'tool_result':
                        valid = self.valid_id(block.get('tool_use_id'))
                        active = active or valid
                        safe = self.fields(block, ('tool_use_id', 'is_error'))
                        self.rows.append(dict(type='tool_result', recognizedActivity=valid, **safe, **lineage))
            if not active:
                self.rows.append(dict(type='user', recognizedActivity=False, **lineage))
        elif kind in ('provider', 'provider_event'):
            safe = self.fields(row, ('type', 'subtype', 'model', 'request_id', 'finish_reason'))
            if isinstance(row.get('usage'), dict):
                safe['usage'] = _metric_metadata(row['usage'])
            if isinstance(row.get('rawUsage'), dict):
                safe['rawUsage'] = _metric_metadata(row['rawUsage'])
            self.rows.append(dict(**safe, **lineage))
        else:
            safe = self.fields(row, ('type', 'subtype', 'task_id', 'tool_use_id', 'task_type',
                                    'last_tool_name', 'status', 'reason', 'elapsed_ms'))
            if kind == 'system' and row.get('subtype') == 'init' and isinstance(row.get('tools'), list):
                offered = []
                for tool in row['tools']:
                    name = tool if isinstance(tool, str) else tool.get('name') if isinstance(tool, dict) else None
                    if isinstance(name, str) and name:
                        name = self.scalar(name)
                        if name not in offered:
                            offered.append(name)
                safe['registryTools'] = offered
                safe['toolInventoryScope'] = 'cli_registry_not_actual_request_tools'
            if kind == 'system' and row.get('subtype') in _TASK_SUBTYPES:
                active = self.task_activity(row)
                if isinstance(row.get('usage'), dict):
                    safe['usage'] = _metric_metadata(row['usage'])
                patch = row.get('patch')
                if isinstance(patch, dict) and patch.get('status') in _TASK_STATUSES:
                    safe['patch'] = {'status': patch['status']}
                if row.get('task_type') == 'Agent' and self.valid_id(row.get('tool_use_id')):
                    self.lanes.add(row['tool_use_id'])
                    self.counts['subagentLanes'] = len(self.lanes)
            elif kind == 'system' and row.get('subtype') == 'keepalive':
                active = row.get('reason') == 'reasoning_in_progress'
            self.rows.append(dict(recognizedActivity=active, **safe, **lineage))
        return active, root_result


def collect_process(argv, cwd, env, prompt, total_timeout, first_output_timeout,
                    idle_timeout, progress_path, requested_model, redact,
                    agent_mode=False, max_model_messages=None):
    """Collect a bounded process.

    The optional agent cap counts observed model messages, not upstream API
    requests or billed usage. CLI retries and unseen provider work may cost more.
    """
    if agent_mode and max_model_messages is not None and (
            not isinstance(max_model_messages, int) or isinstance(max_model_messages, bool)
            or max_model_messages < 1):
        raise ValueError('max_model_messages must be a positive integer or None')
    started = time.monotonic()
    events = queue.Queue()
    hashes = {k: hashlib.sha256() for k in ('stdout', 'stderr')}
    stderr_tail = bytearray()
    counts = dict(eventCount=0, partialCount=0, textCharacters=0, thinkingCharacters=0, protocolErrors=0)
    rows = []
    agent_stream = _AgentStream(rows, counts, redact) if agent_mode else None
    first_event = first_model = last_model = None
    result_seen = False
    timeout_reason = None
    terminated = False
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    if agent_mode and os.name == 'nt':
        creationflags |= 0x00000004  # CREATE_SUSPENDED: bind job before any CLI code runs.
    process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               creationflags=creationflags)
    process_tree = None
    if agent_mode and os.name == 'nt':
        try:
            process_tree = _WindowsProcessTree(process)
            process_tree.resume_root(process.pid)
        except BaseException:
            if process_tree is not None:
                process_tree.close()
            if process.poll() is None:
                process.kill()
            process.wait(timeout=5)
            for pipe in (process.stdin, process.stdout, process.stderr):
                pipe.close()
            raise

    def read_stdout():
        try:
            for raw in iter(process.stdout.readline, b''):
                hashes['stdout'].update(raw)
                events.put(raw)
        finally:
            process.stdout.close()

    def read_stderr():
        try:
            while True:
                raw = process.stderr.read(4096)
                if not raw:
                    break
                hashes['stderr'].update(raw)
                stderr_tail.extend(raw)
                del stderr_tail[:-8192]
        finally:
            process.stderr.close()

    def write_input():
        try:
            process.stdin.write(prompt.encode('utf-8'))
            process.stdin.flush()
        except (BrokenPipeError, OSError):
            pass
        finally:
            process.stdin.close()

    threads = [threading.Thread(target=f, daemon=True) for f in
               (read_stdout, read_stderr, write_input)]
    for thread in threads:
        thread.start()

    def publish(phase):
        state = dict(pid=process.pid, model=requested_model,
                     elapsedSeconds=round(time.monotonic() - started, 3),
                     firstEventSeconds=first_event, firstModelActivitySeconds=first_model,
                     resultSeen=result_seen, phase=phase, timeoutReason=timeout_reason,
                     **counts)
        path = Path(progress_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.tmp')
        temporary.write_text(json.dumps(state, ensure_ascii=False), encoding='utf-8')
        os.replace(str(temporary), str(path))

    def consume(raw):
        nonlocal first_event, first_model, last_model, result_seen, timeout_reason
        try:
            row = json.loads(raw)
        except (ValueError, UnicodeError):
            counts['protocolErrors'] += 1
            return
        if not isinstance(row, dict):
            counts['protocolErrors'] += 1
            return
        now = time.monotonic()
        counts['eventCount'] += 1
        if first_event is None:
            first_event = round(now - started, 3)
        if agent_stream is not None:
            active, root_result = agent_stream.consume(row)
            result_seen = result_seen or root_result
            if max_model_messages is not None and counts['modelMessageCount'] > max_model_messages:
                timeout_reason = 'budget_timeout'
            if active:
                last_model = now
                if first_model is None:
                    first_model = round(now - started, 3)
            return
        kind = row.get('type')
        provider = row.get('providerData')
        if isinstance(provider, dict):
            rows.append({'type': 'provider_metadata', 'providerData': {k: provider[k] for k in ('model', 'rawUsage') if k in provider}})
        active = kind == 'system' and row.get('subtype') == 'keepalive' and row.get('reason') == 'reasoning_in_progress'
        if kind == 'stream_event':
            counts['partialCount'] += 1
            event = row.get('event') or {}
            if isinstance(event, dict):
                msg = event.get('message')
                if isinstance(msg, dict):
                    rows.append({'type': 'stream_event', 'event': {'type': event.get('type'), 'message': {k: msg[k] for k in ('model', 'usage') if k in msg}}})
                block = event.get('content_block')
                if isinstance(block, dict) and block.get('type') in ('tool_use', 'function_call'):
                    rows.append({'type': 'tool_use', 'name': block.get('name'), 'id': block.get('id')})
            delta = event.get('delta', event) if isinstance(event, dict) else {}
            if isinstance(delta, dict):
                delta_type = delta.get('type')
                field = 'text' if delta_type == 'text_delta' else 'thinking'
                value = delta.get(field)
                if delta_type in ('text_delta', 'thinking_delta') and isinstance(value, str) and value:
                    counts['textCharacters' if field == 'text' else 'thinkingCharacters'] += len(value)
                    active = True
        if kind == 'assistant':
            message = row.get('message') or {}
            if not isinstance(message, dict):
                message = {}
            content = message.get('content', []) if isinstance(message, dict) else []
            if isinstance(content, str):
                active = active or bool(content)
            elif isinstance(content, list):
                active = active or any(isinstance(b, dict) and bool(b.get('text') or b.get('thinking') or b.get('input')) for b in content)
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') in ('tool_use', 'function_call'):
                        rows.append({'type': 'tool_use', 'name': block.get('name'), 'id': block.get('id')})
            pd = message.get('providerData')
            if isinstance(pd, dict):
                rows.append({'type': 'provider_metadata', 'providerData': {k: pd[k] for k in ('model', 'rawUsage') if k in pd}})
            safe = {k: message[k] for k in ('id', 'model', 'stop_reason', 'usage') if k in message}
            rows.append(dict(type='assistant', message=safe))
        elif kind == 'result':
            result_seen = True
            # Preserve final answer; partial and thinking content never enter rows.
            keys = ('type', 'subtype', 'session_id', 'is_error', 'duration_ms',
                    'duration_api_ms', 'num_turns', 'total_cost_usd', 'usage')
            safe = {k: row[k] for k in keys if k in row}
            for field in ('result', 'structured_output', 'errors', 'errors_info'):
                if field in row:
                    safe[field] = json.loads(redact(json.dumps(row[field], ensure_ascii=False)))
            rows.append(safe)
        elif kind in ('provider', 'provider_event'):
            keys = ('type', 'subtype', 'model', 'request_id', 'finish_reason', 'usage')
            rows.append({k: row[k] for k in keys if k in row})
        elif kind in ('tool_use', 'function_call', 'tool_call'):
            rows.append({k: row[k] for k in ('type', 'id', 'name') if k in row})
        if active:
            last_model = now
            if first_model is None:
                first_model = round(now - started, 3)

    def stop():
        nonlocal terminated
        if process.poll() is None:
            if os.name == 'nt':
                try:
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW, timeout=5)
                except (subprocess.TimeoutExpired, OSError):
                    pass
            if process.poll() is None:
                process.kill()
            terminated = True
        if process_tree is not None:
            terminated = process_tree.terminate() or terminated
        process.wait(timeout=5)

    try:
        publish('starting')
        next_progress = started + 1
        while True:
            try:
                consume(events.get(timeout=0.02))
            except queue.Empty:
                pass
            now = time.monotonic()
            if timeout_reason:
                stop()
                break
            if process.poll() is not None and not threads[0].is_alive() and events.empty():
                break
            if now - started >= total_timeout:
                timeout_reason = 'total_timeout'
            elif first_model is None and now - started >= first_output_timeout:
                timeout_reason = 'first_output_timeout'
            elif last_model is not None and now - last_model >= idle_timeout:
                timeout_reason = 'idle_timeout'
            if timeout_reason:
                stop()
                break
            if now >= next_progress:
                publish('model_active' if first_model is not None else 'waiting_for_model')
                next_progress = now + 1
    finally:
        try:
            stop()
            for thread in threads:
                thread.join(timeout=2)
            while not events.empty():
                consume(events.get_nowait())
            publish('timeout' if timeout_reason else ('result_received' if result_seen else 'exited_without_result'))
        finally:
            if process_tree is not None:
                process_tree.close()
    agent_fields = dict(agentMode=True, modelMessageBudget=max_model_messages,
                       budgetScope=MESSAGE_BUDGET_SCOPE,
                       jobObjectBound=process_tree is not None,
                       jobObjectCleanup=dict(terminateRequested=process_tree.termination_requested,
                                             closed=process_tree.closed,
                                             activeProcessesRemaining=process_tree.active_remaining)
                       if process_tree is not None else None) if agent_mode else {}
    return dict(rows=rows, exitCode=process.returncode, timeoutReason=timeout_reason, processId=process.pid,
                processTerminated=process.poll() is not None, processKilled=terminated, resultSeen=result_seen,
                stdoutSha256=hashes['stdout'].hexdigest(), stderrSha256=hashes['stderr'].hexdigest(),
                stderrTail=redact(stderr_tail.decode('utf-8', errors='replace')),
                firstEventSeconds=first_event, firstModelActivitySeconds=first_model,
                readersStopped=all(not t.is_alive() for t in threads), **agent_fields, **counts)
