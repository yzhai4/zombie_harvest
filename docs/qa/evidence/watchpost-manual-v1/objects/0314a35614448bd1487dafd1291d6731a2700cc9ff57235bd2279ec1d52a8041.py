"""Prepare/run the unchanged canonical episode method only after explicit source freeze.

This launcher is not executed during method preparation. It preserves the original
runner/import structure by executing ROOT/scripts/browser-content-episode-v1.mjs.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess

ap = argparse.ArgumentParser(description=__doc__)
for flag in ['root', 'out', 'expect-html-sha256', 'node', 'playwright-module', 'program-files']:
    ap.add_argument('--' + flag, required=True)
ap.add_argument('--expect-runner-sha256', default='a91f58668aae7f0d5e2132fc5712bb4fca1f30cee403cadf7949bccea20f5be5')
a = ap.parse_args()
root, out = Path(a.root).resolve(), Path(a.out).resolve()
assert not out.exists() and not out.is_relative_to(root)
paths = ['dist/index.html', 'dist/actor-sprites.js', 'scripts/browser-content-episode-v1.mjs',
         'scripts/lib/source-runtime-fixture.mjs', 'scripts/fixtures/content-episode-v1/save21-pre-identity-active.json',
         'scripts/check-report-recovery.mjs']


def ref(rel):
    b = (root / rel).read_bytes()
    return {'path': rel, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}


before = [ref(p) for p in paths]
assert before[0]['sha256'] == a.expect_html_sha256
assert before[2]['sha256'] == a.expect_runner_sha256, 'keep original primary browser contract; do not rebase runner imports casually'
out.mkdir(parents=True)
shutil.copyfile(root / paths[2], out / 'runner-executed.mjs')
shutil.copyfile(Path(__file__), out / 'launcher-executed.py')
env = dict(os.environ)
env.update(ZH_PLAYWRIGHT_MODULE=a.playwright_module, ZH_BROWSER_CHANNEL='chrome',
           ProgramFiles=a.program_files, PROGRAMFILES=a.program_files)
command = [a.node, str(root / paths[2]), '--out', str(out)]
v = {'runner': 'browser-content-episode-execution-v1', 'status': 'RUNNING',
     'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'command': command,
     'inputs': before, 'naturalGameplay': False, 'browserChannel': 'chrome',
     'chromeProgramFilesEnvironmentSet': True, 'sourceHtmlSha256': a.expect_html_sha256}


def write():
    (out / 'execution.json').write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


write()
try:
    with (out / 'stdout.txt').open('wb') as so, (out / 'stderr.txt').open('wb') as se:
        p = subprocess.run(command, cwd=root, env=env, stdout=so, stderr=se)
    v.update(status='TERMINAL', exitCode=p.returncode)
except Exception as e:
    v.update(status='LAUNCHER_ERROR', exitCode=None, error={'name': type(e).__name__, 'message': str(e)})
finally:
    v.update(finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), unchanged=before == [ref(p) for p in paths])
    report = out / 'report.json'
    if report.exists(): v['reportSha256'] = hashlib.sha256(report.read_bytes()).hexdigest()
    write()
print(json.dumps(v, ensure_ascii=False))
raise SystemExit(v['exitCode'] if v['exitCode'] is not None else 1)
