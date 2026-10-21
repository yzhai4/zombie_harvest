# -*- coding: utf-8 -*-
"""Offline negative controls and actual stdin/stdout MCP integration tests."""

import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import uuid

HERE = Path(__file__).resolve().parent
SERVER = HERE / "project_gateway.py"
EVIDENCE = Path(tempfile.mkdtemp(prefix="imsaver-gateway-tests-"))
EVIDENCE.mkdir(exist_ok=True)
RUN = EVIDENCE / (time.strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8])
RUN.mkdir()
REAL_ROOT = Path(os.environ['IMSAVER_TEST_SOURCE_ROOT']).resolve() if os.environ.get('IMSAVER_TEST_SOURCE_ROOT') else next(
    (parent for parent in HERE.parents if (parent / 'dist/index.html').is_file()), None)


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


class Client:
    def __init__(self, root, control, max_chars=180000, max_tools=48, name=None, protocol="2025-11-25"):
        control.mkdir(parents=True, exist_ok=True)
        self.audit = control / "audit.jsonl"
        self.state = control / "budget.json"
        self.name = name or uuid.uuid4().hex[:8]
        self.transcript = control / ("stdio-" + self.name + ".jsonl")
        self.events = []
        self.seq = 0
        self.responses = queue.Queue()
        self.closed = False
        command = [sys.executable, "-I", "-B", str(SERVER), "--root", str(root),
                   "--audit", str(self.audit), "--budget-state", str(self.state),
                   "--session-id", self.name, "--max-chars", str(max_chars),
                   "--max-tools", str(max_tools)]
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, cwd=str(HERE))
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()
        init = self.request("initialize", {"protocolVersion": protocol, "capabilities": {},
                                           "clientInfo": {"name": "offline-negative-controls", "version": "1"}})
        assert init["result"]["serverInfo"]["name"] == "imsaver_project", init
        assert init["result"]["protocolVersion"] == (protocol if protocol in (
            "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05") else "2025-11-25")
        self.notify("notifications/initialized")

    def _reader(self):
        for raw in self.process.stdout:
            self.responses.put(raw)
        self.responses.put(None)

    def request(self, method, params=None):
        self.seq += 1
        message = {"jsonrpc": "2.0", "id": self.seq, "method": method}
        if params is not None:
            message["params"] = params
        return self.raw_request(compact(message), self.seq)

    def raw_request(self, raw, expected_id=None):
        self.events.append({"direction": "stdin", "raw": raw})
        self.process.stdin.write((raw + "\n").encode("utf-8"))
        self.process.stdin.flush()
        response = self.responses.get(timeout=25)
        if response is None:
            raise AssertionError("gateway exited before response")
        decoded = response.decode("utf-8", errors="strict")
        assert decoded.endswith("\n") and decoded.count("\n") == 1
        self.events.append({"direction": "stdout", "raw": decoded.rstrip("\n")})
        value = json.loads(decoded)
        assert value["jsonrpc"] == "2.0", value
        if expected_id is not None:
            assert value["id"] == expected_id, value
        return value

    def notify(self, method):
        raw = compact({"jsonrpc": "2.0", "method": method})
        self.events.append({"direction": "stdin", "raw": raw})
        self.process.stdin.write((raw + "\n").encode("utf-8"))
        self.process.stdin.flush()

    def call(self, name, arguments):
        value = self.request("tools/call", {"name": name, "arguments": arguments})
        assert "result" in value, value
        result = value["result"]
        assert len(result["content"]) == 1 and result["content"][0]["type"] == "text"
        return result["isError"], json.loads(result["content"][0]["text"]), result["content"][0]["text"]

    def close(self):
        if self.closed:
            return
        self.closed = True
        self.process.stdin.close()
        try:
            exit_code = self.process.wait(timeout=25)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
            raise AssertionError("gateway did not exit after EOF")
        self.thread.join(timeout=2)
        stderr = self.process.stderr.read().decode("utf-8", errors="strict")
        self.process.stdout.close()
        self.process.stderr.close()
        self.events.append({"event": "process_terminal", "pid": self.process.pid,
                            "exit_code": exit_code, "stderr": stderr})
        self.transcript.write_text("".join(compact(event) + "\n" for event in self.events), encoding="utf-8")
        assert exit_code == 0 and stderr == "", (exit_code, stderr)


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.work = RUN / self._testMethodName
        self.work.mkdir()
        self.root = self.work / "project"
        self.root.mkdir()
        self.control = self.work / "control"
        self.clients = []
        self.write("docs/guide.md", "首行\r\nliteral NEEDLE [a.*]\r\nconst key = value; api_key = environment;\r\n")
        self.write("src/code.js", "const key = 'test';\nconst token = process.env.API_KEY;\n// NEEDLE [a.*]\n")
        self.write("dist/index.html", "<!doctype html>\n" + "<!-- safe project line -->\n" * 45000)
        self.write("leaky.md", "VISIBLE_BEFORE\n" + "sk-" + "a1" * 24 + "\nVISIBLE_AFTER\n")
        self.write("workbuddy-leaky.md", "VISIBLE_CK_BEFORE\n" + "ck_" + "abCD12ef.ghIJ34klMNop" + "\nVISIBLE_CK_AFTER\n")
        self.write("platform-leaky.md", "VISIBLE_PT_BEFORE\n" + "pt_" + "abCD12ef.ghIJ34klMNop" + "\nVISIBLE_PT_AFTER\n")
        self.write("private.md", "visible\n-----BEGIN PRIVATE KEY-----\nsynthetic-not-a-key\n")
        for path in (".env", ".env.local", "credentials.json", "private.key", "private.pem",
                     "node_modules/a.js", ".git/config.txt", "profile/settings.md", "profiles/settings.md",
                     ".openai/auth.json", "secrets/hidden.md"):
            self.write(path, "FORBIDDEN_CONTENT_CANARY\n")
        self.write("binary.md", b"binary\x00payload")
        self.write("invalid-utf8.md", b"\xff\xfe")

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_bytes(content.encode("utf-8"))

    def client(self, **kwargs):
        client = Client(self.root, self.control, **kwargs)
        self.clients.append(client)
        return client

    def tearDown(self):
        for client in self.clients:
            client.close()

    def test_handshake_exact_hash_lines_and_eof(self):
        client = self.client()
        tools = client.request("tools/list")["result"]["tools"]
        self.assertEqual([tool["name"] for tool in tools], ["project_list", "project_search", "project_read"])
        self.assertTrue(all(tool["annotations"]["readOnlyHint"] for tool in tools))
        error, payload, text = client.call("project_read", {"path": "docs/guide.md", "start_line": 2, "end_line": 3})
        self.assertFalse(error)
        self.assertEqual(payload["lines"], [{"line": 2, "text": "literal NEEDLE [a.*]"},
                                            {"line": 3, "text": "const key = value; api_key = environment;"}])
        self.assertEqual(payload["sha256"], hashlib.sha256((self.root / "docs/guide.md").read_bytes()).hexdigest())
        self.assertEqual(payload["budget"]["used_chars"], len(text))
        client.close()
        audit = [json.loads(line) for line in client.audit.read_text(encoding="utf-8").splitlines()]
        self.assertEqual([event["event"] for event in audit], ["server_started", "tool_call", "server_stopped"])
        self.assertEqual({event["pid"] for event in audit}, {client.process.pid})
        self.assertEqual(len({event["budget"]["budget_id"] for event in audit}), 1)
        self.assertEqual(audit[1]["sources"][0]["start_line"], 2)
        self.assertNotIn("literal NEEDLE", compact(audit))
        self.assertNotIn("FORBIDDEN_CONTENT_CANARY", compact(audit))

    def test_listing_pagination_and_secret_file_hiding(self):
        client = self.client()
        paths = []
        cursor = None
        while True:
            args = {"max_files": 2}
            if cursor:
                args["cursor"] = cursor
            error, payload, _ = client.call("project_list", args)
            self.assertFalse(error)
            paths.extend(item["path"] for item in payload["files"])
            cursor = payload.get("next_cursor")
            if not cursor:
                break
        self.assertEqual(paths, ["dist/index.html", "docs/guide.md", "src/code.js"])
        self.assertEqual(len(paths), len(set(paths)))
        error, payload, _ = client.call("project_list", {"glob": "**/*.js"})
        self.assertFalse(error)
        self.assertEqual([item["path"] for item in payload["files"]], ["src/code.js"])

    def test_literal_glob_search_and_no_secret_exposure(self):
        client = self.client()
        error, payload, _ = client.call("project_search", {"query": "[a.*]", "glob": "**/*.md", "max_results": 1})
        self.assertFalse(error)
        self.assertEqual(len(payload["matches"]), 1)
        match = payload["matches"][0]
        self.assertEqual((match["path"], match["line"], match["text"]), ("docs/guide.md", 2, "literal NEEDLE [a.*]"))
        self.assertEqual(match["sha256"], hashlib.sha256((self.root / "docs/guide.md").read_bytes()).hexdigest())
        error, payload, _ = client.call("project_search", {"query": "VISIBLE", "glob": "**/*.md"})
        self.assertFalse(error)
        self.assertEqual(payload["matches"], [])
        error, payload, _ = client.call("project_search", {"query": "forbidden_content_canary", "case_sensitive": False})
        self.assertFalse(error)
        self.assertEqual(payload["matches"], [])

    def test_reject_traversal_absolute_unc_ads_and_protected_paths(self):
        client = self.client()
        paths = ("../outside.md", "docs/../../outside.md", "C:/Windows/win.ini", "/etc/passwd",
                 "\\\\server\\share\\secret.md", "C:relative.md", "docs\\..\\..\\outside.md", "docs/guide.md:stream",
                 "docs/guide.md.", "docs//guide.md", "CON.txt", ".env", ".env.local", "credentials.json",
                 "private.key", "private.pem", "profile/settings.md", "node_modules/a.js", ".git/config.txt")
        for path in paths:
            with self.subTest(path=path):
                error, payload, text = client.call("project_read", {"path": path})
                self.assertTrue(error)
                self.assertNotIn("FORBIDDEN_CONTENT_CANARY", text)
                self.assertNotIn("lines", payload)
        for name in ("project_list", "project_search"):
            args = {"path": "../"}
            if name == "project_search":
                args["query"] = "anything"
            error, _, _ = client.call(name, args)
            self.assertTrue(error)

    def test_whole_file_secret_detection_without_keyword_false_positive(self):
        client = self.client()
        for path in ("leaky.md", "workbuddy-leaky.md", "platform-leaky.md", "private.md"):
            error, payload, text = client.call("project_read", {"path": path, "start_line": 1, "end_line": 1})
            self.assertTrue(error)
            self.assertEqual(payload["error"], "credential_signature_denied")
            self.assertNotIn("VISIBLE", text)
            self.assertNotIn("sk-", text)
            self.assertNotIn("ck_", text)
            self.assertNotIn("pt_", text)
        error, payload, _ = client.call("project_read", {"path": "src/code.js"})
        self.assertFalse(error)
        self.assertIn("const key", payload["lines"][0]["text"])
        for path in ("binary.md", "invalid-utf8.md"):
            error, _, _ = client.call("project_read", {"path": path})
            self.assertTrue(error)

    def test_symlink_or_junction_outside_root_when_supported(self):
        outside_dir = self.work / "outside"
        outside_dir.mkdir()
        outside = outside_dir / "outside.md"
        outside.write_text("OUTSIDE_SYMLINK_CANARY\n", encoding="utf-8")
        link = self.root / "escape.md"
        link_type = "symlink"
        relative = "escape.md"
        try:
            os.symlink(str(outside), str(link))
        except (OSError, NotImplementedError):
            if os.name != "nt":
                self.skipTest("symlink creation unavailable")
            try:
                import _winapi
                _winapi.CreateJunction(str(outside_dir), str(self.root / "escape"))
                link_type = "windows_junction"
                relative = "escape/outside.md"
            except (OSError, AttributeError, NotImplementedError) as exc:
                self.skipTest("symlink/junction creation unavailable: " + type(exc).__name__)
        client = self.client()
        error, _, text = client.call("project_read", {"path": relative})
        self.assertTrue(error)
        self.assertNotIn("OUTSIDE_SYMLINK_CANARY", text)
        error, payload, text = client.call("project_list", {})
        self.assertFalse(error)
        self.assertNotIn("escape.md", text)
        self.assertNotIn("escape/outside.md", text)
        (self.work / "reparse-verification.json").write_text(compact({
            "mechanism": link_type, "read_denied": True, "list_hidden": True,
        }) + "\n", encoding="utf-8")

    def test_hardlink_outside_root_rejected(self):
        outside = self.work / "outside.md"
        outside.write_text("OUTSIDE_HARDLINK_CANARY\n", encoding="utf-8")
        try:
            os.link(str(outside), str(self.root / "hardlink.md"))
        except (OSError, NotImplementedError) as exc:
            self.skipTest("hardlink creation unavailable: " + type(exc).__name__)
        client = self.client()
        error, _, text = client.call("project_read", {"path": "hardlink.md"})
        self.assertTrue(error)
        self.assertNotIn("OUTSIDE_HARDLINK_CANARY", text)

    def test_read_bounds_and_one_megabyte_file(self):
        client = self.client()
        error, payload, _ = client.call("project_read", {"path": "dist/index.html", "start_line": 30000, "end_line": 30199})
        self.assertFalse(error)
        self.assertEqual(len(payload["lines"]), 200)
        self.assertGreater(payload["file_bytes"], 1000000)
        self.assertEqual(payload["lines"][0]["line"], 30000)
        error, _, _ = client.call("project_read", {"path": "dist/index.html", "start_line": 1, "end_line": 201})
        self.assertTrue(error)
        self.write("long.md", "L" * 21000 + "\n")
        error, payload, text = client.call("project_read", {"path": "long.md"})
        self.assertTrue(error)
        self.assertEqual(payload["error"], "single_line_exceeds_read_limit")
        self.assertNotIn("LLLL", text)
        self.write("many.md", ("m" * 1000 + "\n") * 30)
        error, payload, text = client.call("project_read", {"path": "many.md"})
        self.assertFalse(error)
        self.assertLessEqual(len(payload["lines"]), 20)
        self.assertLessEqual(len(text), 20000)
        self.assertTrue(payload["range_truncated"])
        self.assertEqual(payload["next_start_line"], len(payload["lines"]) + 1)

    def test_shared_tool_budget_concurrent_processes_and_no_reset(self):
        first = self.client(max_tools=3, name="first")
        second = self.client(max_tools=3, name="second")
        def invoke(client):
            return client.call("project_read", {"path": "src/code.js", "start_line": 1, "end_line": 1})
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(invoke, (first, second)))
        outcomes.extend([invoke(first), invoke(second)])
        self.assertEqual([result[0] for result in outcomes].count(False), 3)
        self.assertEqual(outcomes[-1][1]["error"], "tool_budget_exhausted")
        state = json.loads(first.state.read_text(encoding="utf-8"))
        self.assertEqual(state["used_tools"], 3)
        self.assertLessEqual(state["used_chars"], 180000)
        self.assertEqual(len({result[1]["budget"]["budget_id"] for result in outcomes}), 1)
        first.close()
        second.close()
        third = self.client(max_tools=3, name="third")
        error, payload, _ = invoke(third)
        self.assertTrue(error)
        self.assertEqual(payload["error"], "tool_budget_exhausted")
        third.close()
        audit = [json.loads(line) for line in third.audit.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(sum(event["event"] == "server_started" for event in audit), 3)
        self.assertEqual(sum(event["event"] == "server_stopped" for event in audit), 3)

    def test_shared_character_budget_rejects_full_content_before_output(self):
        first = self.client(max_chars=800, name="first")
        error, payload, text = first.call("project_read", {"path": "src/code.js", "start_line": 1, "end_line": 1})
        self.assertFalse(error)
        self.assertEqual(payload["budget"]["used_chars"], len(text))
        second = self.client(max_chars=800, name="second")
        error, denied, text = second.call("project_read", {"path": "src/code.js", "start_line": 1, "end_line": 1})
        self.assertTrue(error)
        self.assertEqual(denied["error"], "char_budget_exhausted")
        self.assertNotIn("const key", text)
        self.assertEqual(payload["budget"]["used_chars"], denied["budget"]["used_chars"])
        state = json.loads(first.state.read_text(encoding="utf-8"))
        self.assertLessEqual(state["used_chars"], 800)
        self.assertEqual(state["used_tools"], 2)

    def test_schema_negative_controls_and_protocol_framing(self):
        client = self.client()
        error, _, _ = client.call("project_read", {"path": "src/code.js", "command": "write something"})
        self.assertTrue(error)
        error, _, _ = client.call("project_read", {"path": "src/code.js", "start_line": True})
        self.assertTrue(error)
        error, _, _ = client.call("project_search", {"query": "NEEDLE", "max_results": 51})
        self.assertTrue(error)
        malformed = client.raw_request('{"jsonrpc":"2.0","id":99,"method":"ping","method":"tools/list"}')
        self.assertEqual(malformed["error"]["code"], -32700)
        malformed = client.raw_request('{"jsonrpc":"2.0","id":100,"method":"ping","params":{"x":NaN}}')
        self.assertEqual(malformed["error"]["code"], -32700)
        self.assertEqual(client.request("ping")["result"], {})
        self.assertEqual(client.request("resources/list")["error"]["code"], -32601)
        self.assertEqual(client.request("tools/call", {"name": "execute", "arguments": {}})["error"]["code"], -32602)

    def test_supported_protocols_and_immutable_budget_binding(self):
        for index, protocol in enumerate(("2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25", "unknown")):
            control = self.work / ("protocol-" + str(index))
            client = Client(self.root, control, name="protocol-" + str(index), protocol=protocol)
            self.clients.append(client)
            self.assertEqual(len(client.request("tools/list")["result"]["tools"]), 3)
            client.close()
        original = self.client(name="bound")
        original.close()
        before = original.state.read_bytes()
        command = [sys.executable, "-I", "-B", str(SERVER), "--root", str(self.root),
                   "--audit", str(original.audit), "--budget-state", str(original.state), "--max-tools", "1"]
        value = subprocess.run(command, input=b"", stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        self.assertEqual(value.returncode, 1)
        self.assertEqual(value.stdout, b"")
        self.assertEqual(value.stderr, b"project_gateway: policy_or_io_failure\r\n" if os.name == "nt" else b"project_gateway: policy_or_io_failure\n")
        self.assertEqual(original.state.read_bytes(), before)
        (self.work / "startup-denied.json").write_text(compact({
            "exit_code": value.returncode, "stdout": value.stdout.decode("utf-8"),
            "stderr": value.stderr.decode("utf-8"), "state_unchanged": True,
        }) + "\n", encoding="utf-8")

    def test_real_source_root_build_hash_and_lines(self):
        if REAL_ROOT is None or not REAL_ROOT.exists():
            self.skipTest("provided read-only source snapshot absent")
        source = REAL_ROOT / "dist/index.html"
        before = source.read_bytes()
        expected_sha = hashlib.sha256(before).hexdigest()
        client = Client(REAL_ROOT, self.work / "real-control", name="real-source")
        self.clients.append(client)
        error, payload, _ = client.call("project_read", {"path": "dist/index.html", "start_line": 1, "end_line": 8})
        self.assertFalse(error)
        self.assertEqual(payload["sha256"], expected_sha)
        self.assertEqual(payload["file_bytes"], len(before))
        expected_lines = before.decode("utf-8").split("\n")
        self.assertEqual(payload["lines"], [{"line": index + 1, "text": line.rstrip("\r")}
                                            for index, line in enumerate(expected_lines[:8])])
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), expected_sha)
        (self.work / "real-source-verification.json").write_text(compact({
            "root": str(REAL_ROOT), "path": "dist/index.html", "sha256_before": expected_sha,
            "sha256_after": expected_sha, "bytes": len(before), "range": [1, 8], "read_only": True,
        }) + "\n", encoding="utf-8")


class EvidenceResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = []

    def addSuccess(self, test):
        self.records.append({"test": test.id(), "status": "passed"})
        super().addSuccess(test)

    def addSkip(self, test, reason):
        self.records.append({"test": test.id(), "status": "skipped", "reason": reason})
        super().addSkip(test, reason)

    def addFailure(self, test, err):
        self.records.append({"test": test.id(), "status": "failed"})
        super().addFailure(test, err)

    def addError(self, test, err):
        self.records.append({"test": test.id(), "status": "error"})
        super().addError(test, err)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(GatewayTests)
    result = unittest.TextTestRunner(verbosity=2, resultclass=EvidenceResult).run(suite)
    summary = {
        "status": "passed" if result.wasSuccessful() else "failed", "python": sys.version,
        "gateway_sha256": hashlib.sha256(SERVER.read_bytes()).hexdigest(),
        "test_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "run_dir": str(RUN), "tests_run": result.testsRun, "skipped": len(result.skipped),
        "failures": len(result.failures), "errors": len(result.errors), "tests": result.records,
    }
    (RUN / "terminal-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(compact(summary))
    sys.exit(0 if result.wasSuccessful() else 1)
