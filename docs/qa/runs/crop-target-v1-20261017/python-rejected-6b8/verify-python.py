import sys
sys.dont_write_bytecode = True
import json
import hashlib
from pathlib import Path

out = Path(__file__).resolve().parent
sys.path.insert(0, str(out / 'inputs'))
from report_recovery_full import public_crop_evidence, public_crop_reload_evidence

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()
def payload(name):
    return json.loads((out / 'writers' / (name + '.json')).read_text(encoding='utf-8'))['payload']

expected = 'f7d7d0ecc6f5523a545b71be229bf493236f4dfae7400a1156e037d9b7687d31'
assert digest(out / 'inputs' / 'report_recovery_full.py') == expected
source = json.loads((out / 'source-execution.json').read_text(encoding='utf-8'))
garden_id = source['gardenId']
harvest = public_crop_evidence(payload('before-harvest'), payload('after-harvest'), garden_id)
reload = public_crop_reload_evidence(payload('after-harvest'), payload('after-actual-reload'), garden_id)
result = {'schema': 'ActualWriterPythonCropEvidenceV1', 'ok': harvest['ok'] and reload['ok'], 'harvest': harvest, 'reload': reload,
          'sourceHtmlSha256': source['sourceHtmlSha256'], 'originalWriterSha256': source['originalWriterSha256'],
          'pythonHelperSha256': expected, 'pythonRunnerSha256': digest(Path(__file__)),
          'sourceExecutionSha256': digest(out / 'source-execution.json'), 'pythonVersion': sys.version.split()[0],
          'browserStarted': False, 'naturalGameplay': False, 'receiptFabricated': False, 'helperUnmodified': True}
(out / 'python-evidence.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({'ok': result['ok'], 'harvest': harvest['ok'], 'reload': reload['ok'],
                  'receiptContract': harvest['receiptContract'],
                  'failedHarvest': [k for k,v in harvest['checks'].items() if not v],
                  'unsupportedActualEvents': [e['type'] for e in harvest['foodAccounting']['unsupported']]}, ensure_ascii=False))
sys.exit(0 if result['ok'] else 1)
