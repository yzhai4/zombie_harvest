"""Read-only byte/provenance closure after the completed one-minute experiment.

This does not import the game, run a validator, or execute a scene.
"""
from pathlib import Path
import hashlib
import json
import re

out = Path(__file__).resolve().parent
root = out.parents[2] / 'zombie_harvest-30eeefb5c20e4e8105dfe76e64ce9f806e3373cd'
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda p: json.loads(p.read_text(encoding='utf-8'))

report = load(out / 'report.json')
terminal = load(out / 'terminal.json')
assert report['status'] == 'COMPLETED_OBSERVATION' and not report['errors']
assert terminal['terminal'] and terminal['exitCode'] == 0
assert terminal['reportSha256'] == sha((out / 'report.json').read_bytes())
assert report['mainPairInputDifferences'] == ['/npcs/0/needs/energy']
assert report['noPulseInputDifferences'] == ['/npcs/0/workClock']
assert len(report['nativeValidations']) == 7
assert all(row['ok'] for row in report['nativeValidations'])
assert [s['id'] for s in report['scenes']] == ['low-due-pulse', 'normal-due-pulse', 'low-not-yet-due']

for row in report['artifacts']:
    p = (out / row['path']).resolve()
    assert p.is_relative_to(out)
    raw = p.read_bytes()
    assert len(raw) == row['bytes'] and sha(raw) == row['sha256'], row['path']

bindings = [
    ('dist/index.html', 'source.html', report['sourceHtmlSha256']),
    ('scripts/lib/source-runtime-fixture.mjs', 'dependencies/source-runtime-fixture.mjs', report['helperSha256']),
    ('scripts/check-report-recovery.mjs', 'dependencies/check-report-recovery.mjs', report['ioAdapterSha256']),
]
for current, frozen, expected in bindings:
    assert sha((root / current).read_bytes()) == expected
    assert sha((out / frozen).read_bytes()) == expected
assert sha((out / 'runner-executed.mjs').read_bytes()) == report['runnerSha256']
assert (out / 'runner-executed.mjs').read_bytes() == (out / 'run-repro.mjs').read_bytes()
assert sha((out / 'input-memo.md').read_bytes()) == report['memoSha256']
assert sha((out / 'inputs/original-fresh-native.json').read_bytes()) == report['originalWriterSha256']

paths = sorted(p for p in out.rglob('*') if p.is_file() and p.name not in {'index.json', 'closure-receipt.json'})
rows = [dict(path=p.relative_to(out).as_posix(), bytes=p.stat().st_size, sha256=sha(p.read_bytes())) for p in paths]
index = {
    'schema': 'NpcRoutinePlanningGapEvidenceIndexV1',
    'status': 'COMPLETED_OBSERVATION',
    'sourceHtmlSha256': report['sourceHtmlSha256'],
    'gameplayReexecutedForIndex': False,
    'files': rows,
    'fileCount': len(rows),
    'bytes': sum(r['bytes'] for r in rows),
    'sourceBindings': [dict(repoPath=a, frozenPath=b, sha256=c) for a, b, c in bindings],
    'nativeReport': 'report.json',
    'terminal': 'terminal.json',
    'findings': 'findings.md',
    'sceneCount': len(report['scenes']),
    'actualAdvanceCount': 3,
    'actualMinutesPerIndependentScene': 1,
    'nativeValidatorResults': report['nativeValidations'],
    'qaExports': 'qa-exports.js',
    'executionLog': 'process-events.json',
    'scope': dict(naturalGameplay=False, balance=False, browser=False, candidateFix=False),
}

privacy_patterns = [r'(?i)[A-Z]:[/\\]Users[/\\]', r'(?i)Bearer\s+[A-Za-z0-9._~-]{12,}', r'gh[pousr]_[A-Za-z0-9]{20,}', r'-----BEGIN .*PRIVATE KEY-----']
# Only publication text metadata is scanned; original source/native records are retained unchanged.
privacy_scan_paths = ['findings.md', 'report.json', 'terminal.json', 'process-events.json', 'process.stdout.log', 'process.stderr.log']
privacy_hits = []
for rel in privacy_scan_paths:
    text = (out / rel).read_text(encoding='utf-8')
    for pattern in privacy_patterns:
        if re.search(pattern, text):
            privacy_hits.append(dict(path=rel, pattern=pattern))
assert not privacy_hits

index_raw = (json.dumps(index, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
assert not (out / 'index.json').exists()
(out / 'index.json').write_bytes(index_raw)
receipt = {
    'schema': 'NpcRoutinePlanningGapEvidenceClosureV1',
    'status': 'BYTES_VERIFIED',
    'index': dict(path='index.json', bytes=len(index_raw), sha256=sha(index_raw)),
    'report': dict(path='report.json', sha256=sha((out / 'report.json').read_bytes())),
    'findings': dict(path='findings.md', sha256=sha((out / 'findings.md').read_bytes())),
    'terminal': terminal,
    'declaredOriginalArtifactsVerified': len(report['artifacts']),
    'sourceInputsStillMatch': True,
    'runnerOriginalBytesPreserved': True,
    'nativeReportRewritten': False,
    'rootEdited': False,
    'gameplayReexecutedForClosure': False,
    'privacy': dict(paths=privacy_scan_paths, hits=privacy_hits, historicalNativeAndSourceUnchanged=True),
}
receipt_raw = (json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
assert not (out / 'closure-receipt.json').exists()
(out / 'closure-receipt.json').write_bytes(receipt_raw)
print(json.dumps(dict(indexSha256=sha(index_raw), receiptSha256=sha(receipt_raw), findingsSha256=receipt['findings']['sha256'], indexedFiles=len(rows), indexedBytes=index['bytes'], originalArtifactsVerified=len(report['artifacts']), actualAdvances=3, terminalExitCode=terminal['exitCode'], privacyHits=0), ensure_ascii=False))
