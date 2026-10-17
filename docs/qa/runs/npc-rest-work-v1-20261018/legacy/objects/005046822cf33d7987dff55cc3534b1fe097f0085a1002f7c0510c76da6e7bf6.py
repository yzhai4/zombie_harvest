"""Verify retained bytes and native artifact references, without game execution."""
from pathlib import Path
import hashlib,json,re,difflib

out=Path(__file__).resolve().parent
root=out.parents[3]/'zombie_harvest-30eeefb5c20e4e8105dfe76e64ce9f806e3373cd'
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
matrix=load(out/'execution-matrix.json');terminal=load(out/'terminal.json');inputs=load(out/'input-index.json')
assert terminal['terminal'] and terminal['contractCount']==6 and terminal['processCount']==6
assert terminal['passedProcesses']==4 and terminal['failedProcesses']==2
assert terminal['allInputsUnchanged'] and all(r['inputsUnchanged'] for r in matrix['processes'])
assert sum(r['count'] for r in matrix['processes'])==356
assert sum(r['passed'] for r in matrix['processes'])==349
actual=sha((out/'source-executed.html').read_bytes());assert actual==terminal['sourceHtmlSha256']
for p in matrix['processes']:
    for key in ['runner','stdout','stderr','nativeReport']:
        ref=p[key];raw=(out/ref['path']).read_bytes();assert sha(raw)==ref['sha256'] and len(raw)==ref['bytes']

native_refs=[]
for report_rel in ['native/c1/report.json','native/c2/report.json','native/camp-rest.json']:
    p=out/report_rel;j=load(p)
    assert j.get('sourceHtmlSha256',j.get('sourceHash',j.get('source',{}).get('sha256')))==actual,(report_rel,'source hash')
    for ref in j.get('artifacts',[]):
        candidate=(p.parent/ref['path']).resolve();assert candidate.is_relative_to(out)
        raw=candidate.read_bytes();assert sha(raw)==ref['sha256'],ref['path']
        if 'bytes' in ref:assert len(raw)==ref['bytes']
        native_refs.append(dict(report=report_rel,path=candidate.relative_to(out).as_posix(),sha256=ref['sha256']))

current=(root/'dist/index.html').read_bytes();executed=(out/'source-executed.html').read_bytes()
scripts=lambda b:re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',b.decode())
current_delta=dict(executedHtmlSha256=actual,currentHtmlSha256=sha(current),businessInlineIdentical=scripts(current)==scripts(executed),originalSourceFileChangedDuringRun=True,transferPassToCurrentBuild=False)
assert current_delta['currentHtmlSha256']=='32185e4f592f7e0a6b897027908fe072e4c7a5889f771436cfa3c3da8b11609b'
assert current_delta['businessInlineIdentical']
diff=''.join(difflib.unified_diff(executed.decode().splitlines(keepends=True),current.decode().splitlines(keepends=True),fromfile='executed-dc265',tofile='current-32185',n=2))
(out/'current-root-css-only.diff').write_text(diff,encoding='utf-8')
paths=sorted(p for p in out.rglob('*') if p.is_file() and p.name not in {'artifact-index.json','closure-receipt.json'})
rows=[dict(path=p.relative_to(out).as_posix(),bytes=p.stat().st_size,sha256=sha(p.read_bytes()))for p in paths]
index=dict(schema='ImpactExecutionArtifactIndexV1',sourceHtmlSha256=actual,fileCount=len(rows),bytes=sum(r['bytes'] for r in rows),files=rows,nativeArtifactReferences=native_refs,currentRootDelta=current_delta)
index_raw=(json.dumps(index,indent=2)+'\n').encode();assert not (out/'artifact-index.json').exists();(out/'artifact-index.json').write_bytes(index_raw)
receipt=dict(schema='ImpactExecutionClosureV1',status='COMPLETED_WITH_FAILURES_BYTES_VERIFIED',sourceHtmlSha256=actual,indexSha256=sha(index_raw),processCount=6,passedProcesses=4,failedProcesses=2,checkCount=356,passedChecks=349,failedChecks=7,executionMatrixSha256=sha((out/'execution-matrix.json').read_bytes()),terminalSha256=sha((out/'terminal.json').read_bytes()),inputIndexSha256=sha((out/'input-index.json').read_bytes()),nativeArtifactReferenceCount=len(native_refs),currentRootDelta=current_delta,originalReportsChanged=False,methodSuggestionsApplied=False,methodSuggestionsExecuted=False,gameplayReexecutedForClosure=False,repoFilesEdited=False)
raw=(json.dumps(receipt,indent=2)+'\n').encode();assert not (out/'closure-receipt.json').exists();(out/'closure-receipt.json').write_bytes(raw)
print(json.dumps(dict(receiptSha256=sha(raw),indexSha256=sha(index_raw),files=len(rows),bytes=index['bytes'],nativeRefs=len(native_refs),matrixSha256=receipt['executionMatrixSha256'],terminalSha256=receipt['terminalSha256'])))
