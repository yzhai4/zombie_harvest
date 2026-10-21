from pathlib import Path
from datetime import datetime,timezone
import subprocess,hashlib,json,shutil
OUT=Path(__file__).parent
FROZEN=OUT/'frozen-inputs'
sha=lambda b:hashlib.sha256(b).hexdigest()
now=lambda:datetime.now(timezone.utc).isoformat()
def put(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
original=json.loads((OUT/'closure.json').read_text())
corrected=[]
for order,name,script in [(18,'combat-intent','check-combat-intent-v1.mjs'),(23,'event-gate','check-event-gate-v1.mjs')]:
 d=OUT/'dependency-corrected'/f'{order:02d}-{name}';d.mkdir(parents=True,exist_ok=False)
 cmd=[shutil.which('node'),'scripts/'+script]
 start=now();put(d/'started.json',{'command':cmd,'cwd':str(FROZEN),'startedAt':start,'reason':'same checker and HTML; add omitted schema dependency only'})
 r=subprocess.run(cmd,cwd=FROZEN,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 (d/'stdout.log').write_bytes(r.stdout);(d/'stderr.log').write_bytes(r.stderr)
 report=None
 try:report=json.loads(r.stdout)
 except ValueError:pass
 row={'order':order,'name':name,'status':'terminal','startedAt':start,'finishedAt':now(),'exitCode':r.returncode,'command':cmd,'sourceHtmlSha256':original['sourceHtmlSha256'],'runner':{'path':'scripts/'+script,'sha256':sha((FROZEN/'scripts'/script).read_bytes())},'stdout':{'path':'stdout.log','sha256':sha(r.stdout),'bytes':len(r.stdout)},'stderr':{'path':'stderr.log','sha256':sha(r.stderr),'bytes':len(r.stderr)},'originalPreBusinessMethodFailureRetained':True,'path':d.relative_to(OUT).as_posix()}
 if isinstance(report,dict):row['reported']={k:report[k] for k in ['runner','ok','count','passed','errors','failures'] if k in report}
 put(d/'terminal.json',row);corrected.append(row);print(json.dumps(row),flush=True)
byname={r['name']:r for r in corrected}
rows=[byname.get(r['name'],r) for r in original['rows']]
closure={'schema':'CI294DependencyCorrectedClosureV1','finishedAt':now(),'sourceHtmlSha256':original['sourceHtmlSha256'],'uniqueContracts':44,'passed':sum(r['exitCode']==0 for r in rows),'failed':sum(r['exitCode']!=0 for r in rows),'reusedCurrentContracts':14,'firstPassExecutions':30,'dependencyOnlyReruns':2,'originalClosureSha256':sha((OUT/'closure.json').read_bytes()),'schemaDependencyIndexSha256':sha((OUT/'added-required-schema-dependencies.json').read_bytes()),'rows':rows,'oldFailuresUnchanged':True,'browserExecuted':False,'requireGitExecuted':False}
put(OUT/'dependency-corrected-closure.json',closure)
print(json.dumps({k:closure[k] for k in ['schema','uniqueContracts','passed','failed','dependencyOnlyReruns']}))
