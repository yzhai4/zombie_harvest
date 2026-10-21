import sys
sys.dont_write_bytecode = True
import json
import hashlib
from pathlib import Path

out = Path(__file__).resolve().parent
qa = Path(sys.argv[1]).resolve()
failed = Path(sys.argv[2]).resolve()
sys.path.insert(0, str(out / 'inputs'))
from report_recovery_full import public_crop_evidence, public_crop_reload_evidence
refs = []
def sha(b):
    return hashlib.sha256(b).hexdigest()
def archive(name, data, kind):
    target = out / name
    assert not target.exists()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    refs.append({'path': name, 'sha256': sha(data), 'kind': kind})
    return json.loads(data)

helper_hash = sha((out / 'inputs' / 'report_recovery_full.py').read_bytes())
assert helper_hash == '7a6d4f7ac30c4ddb54343cb7208fa8930b6ed4262157c187f14457a2bc77e6d2'
old_report_bytes = (qa / 'result-guard-v2.json').read_bytes()
assert sha(old_report_bytes) == '6cf61c79eb81721c0f65eb402ce521b5dc7a54d3902e1e180aa8e671196494d6'
old_report = archive('legacy-inputs/original-report.json', old_report_bytes, 'unchanged-original-prior-run-report')
assert old_report['htmlSha256'] == '51faa0c7c62607aa0d4e280a5bc056e4eb01b374b1ae3f45782c232445ae1662'
assert all(row['htmlSha256'] == old_report['htmlSha256'] for row in old_report['documentResponses'])
manifest = archive('legacy-inputs/original-export-manifest.json', (qa / 'export-guard-v2-complete' / 'manifest.json').read_bytes(), 'unchanged-prior-export-manifest')
assert manifest['originalReportSha256'] == sha(old_report_bytes)
legacy = []
for filename, expected in [('151-harvest-pending-save.json', '3ee04716ce42de286b94b33b3737d54152fa864a13e0d6f3c2fbf5b1fe98a4c6'), ('152-harvest-save.json', '21e8e0b70be04df693784f92f242659a3ebcd3b47c918a246850cc2da3318846')]:
    data = (qa / 'artifacts' / 'result-guard-v2' / filename).read_bytes()
    assert sha(data) == expected
    rows = [r for r in manifest['artifacts'] if r.get('relativePath') == 'artifacts/' + filename]
    assert len(rows) == 1 and rows[0]['sha256'] == expected and rows[0]['fnvMatches'] is True
    value = archive('legacy-inputs/' + filename, data, 'unchanged-actual-prior-browser-writer')
    snapshots = [s for s in old_report['snapshots'] if s['path'].replace('\\', '/').endswith('/' + filename)]
    assert len(snapshots) == 1 and snapshots[0]['checksum'] == value['checksum'] and snapshots[0]['htmlSha256'] == old_report['htmlSha256']
    legacy.append(value['payload'])
legacy_result = public_crop_evidence(legacy[0], legacy[1], 'bld-mazjx8')
assert legacy_result['ok'] is True and legacy_result['receiptContract'] == 'legacy-empty'
negative = []
for name in ('before-harvest', 'after-harvest', 'after-actual-reload'):
    value = archive('actor-negative-inputs/6b8-' + name + '.json', (failed / 'writers' / (name + '.json')).read_bytes(), 'unchanged-actual-6b8-source-writer')
    negative.append(value['payload'])
source_binding = archive('actor-negative-inputs/6b8-source-execution.json', (failed / 'source-execution.json').read_bytes(), 'unchanged-6b8-actual-source-execution-report')
assert source_binding['sourceHtmlSha256'] == '6b8ea0f508265fcc439ceba2bd1aab8a88c1c31169709883cb8e0162a7bc151f'
negative_result = public_crop_evidence(negative[0], negative[1], 'bld-mazjx8')
negative_reload = public_crop_reload_evidence(negative[1], negative[2], 'bld-mazjx8')
assert negative_result['ok'] is False and negative_result['foodAccounting']['ok'] is True
assert negative_result['checks']['one new crop receipt joins one exact public crop command'] is False
assert negative_reload['ok'] is True
result = {'schema': 'ActualWriterLegacyAndActorCompatibilityControlsV1', 'ok': True,
          'legacy': legacy_result, 'sixB8ActorNegative': negative_result, 'sixB8Reload': negative_reload,
          'legacySourceBinding': {'htmlSha256': old_report['htmlSha256'], 'originalReportSha256': sha(old_report_bytes),
                                  'scope': 'existing original browser writer pair and original report/export manifest verified; no old runtime re-executed, no new legacy receipt produced'},
          'pythonHelperSha256': helper_hash, 'runnerSha256': sha(Path(__file__).read_bytes()),
          'refs': refs, 'browserStarted': False, 'receiptFabricated': False}
(out / 'legacy-and-actor-evidence.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'ok': result['ok'], 'legacy': legacy_result['ok'], 'legacyContract': legacy_result['receiptContract'],
                  'actual6b8ActorRejected': not negative_result['ok'], 'sixB8FoodAccounting': negative_result['foodAccounting']['ok'],
                  'sixB8Reload': negative_reload['ok'], 'legacyBefore': legacy_result['beforeMinute'], 'legacyAfter': legacy_result['afterMinute']}, ensure_ascii=False))
