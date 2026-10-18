import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

mode = sys.argv[1] if len(sys.argv) == 2 else None
if mode not in ['validate', 'run']:
    raise SystemExit('usage: launch-A07.py validate|run; no default gameplay')
directory = Path(__file__).resolve().parent
config = json.loads((directory/'launch-config.json').read_text(encoding='utf-8'))
manifest_path = directory/'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for row in manifest['files']:
    content = Path(row['path']).read_bytes()
    assert hashlib.sha256(content).hexdigest() == row['sha256'], row['path']
    assert len(content) == row['bytes'], row['path']
command = [config['nodeExecutable'], *config['validateNodeFlags' if mode == 'validate' else 'runNodeFlags'],
           config['driver'], *config['argvValidate' if mode == 'validate' else 'argvRun']]
assert command[command.index('--chrome-executable')+1] == config['chromeExecutable']
assert isinstance(command[command.index('--chrome-executable')+1], str)
if mode == 'validate':
    raise SystemExit(subprocess.run(command, shell=False).returncode)
output = Path(config['executionRoot'])
assert not output.exists(), 'new immutable execution required'
output.mkdir()
assert not Path(config['businessOutput']).exists()
launch = {'schema':'ActualPublicA07ExecutionV1','status':'RUNNING',
          'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':command,
          'manifestSha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
          'scope':'Controlled continuation: last world-tick normal613, charged world floor273, rollback >=1 not refunded; prior failures and prior branch scope unchanged. Exit0 only session/proof validity; relay/branch separate.',
          'browserEvidence':'pending actual terminal'}
(output/'execution.json').write_text(json.dumps(launch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
begin = time.monotonic()
with (output/'stdout.log').open('wb') as stdout, (output/'stderr.log').open('wb') as stderr:
    process = subprocess.Popen(command,shell=False,stdout=stdout,stderr=stderr)
    launch['pid'] = process.pid
    (output/'execution.json').write_text(json.dumps(launch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    code = process.wait()
launch.update(status='TERMINAL',exitCode=code,elapsedSeconds=time.monotonic()-begin,
              finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
launch['inputsUnchanged'] = all(hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()==row['sha256'] for row in manifest['files'])
launch['browserEvidence'] = 'actual terminal; inspect native session, branch and relay outcomes separately'
(output/'execution.json').write_text(json.dumps(launch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
raise SystemExit(code)
