"""Bounded NDJSON collector. Progress excludes partial and thinking content."""
import hashlib
import json
import os
import queue
import subprocess
import threading
import time
from pathlib import Path


def collect_process(argv, cwd, env, prompt, total_timeout, first_output_timeout,
                    idle_timeout, progress_path, requested_model, redact):
    started = time.monotonic()
    events = queue.Queue()
    hashes = {k: hashlib.sha256() for k in ('stdout', 'stderr')}
    stderr_tail = bytearray()
    counts = dict(eventCount=0, partialCount=0, textCharacters=0, thinkingCharacters=0, protocolErrors=0)
    rows = []
    first_event = first_model = last_model = None
    result_seen = False
    timeout_reason = None
    terminated = False
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               creationflags=creationflags)

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
        nonlocal first_event, first_model, last_model, result_seen
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
        stop()
        for thread in threads:
            thread.join(timeout=2)
        while not events.empty():
            consume(events.get_nowait())
        publish('timeout' if timeout_reason else ('result_received' if result_seen else 'exited_without_result'))
    return dict(rows=rows, exitCode=process.returncode, timeoutReason=timeout_reason, processId=process.pid,
                processTerminated=process.poll() is not None, processKilled=terminated, resultSeen=result_seen,
                stdoutSha256=hashes['stdout'].hexdigest(), stderrSha256=hashes['stderr'].hexdigest(),
                stderrTail=redact(stderr_tail.decode('utf-8', errors='replace')),
                firstEventSeconds=first_event, firstModelActivitySeconds=first_model,
                readersStopped=all(not t.is_alive() for t in threads), **counts)
