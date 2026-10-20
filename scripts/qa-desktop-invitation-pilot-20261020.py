"""A finite public-input check, not a player study."""
import functools,hashlib,http.server,json,os,pathlib,threading,time,traceback
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path.cwd();OUT=ROOT/'qa-output';OUT.mkdir(exist_ok=True)
EXPECTED='86ca99869d174f56287309229cd36017ef69aa92122809c62dd998c16497446f'
assert hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()==EXPECTED
KEY='zombie-harvest-progress-v12'
ACTIONS=json.loads(os.environ.get('PUBLIC_ACTIONS_JSON','[]'))
READ=r'''() => {
 const text=id=>document.getElementById(id)?.textContent||'';
 const pos=text('mapRegionLabel').match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/);
 const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
 return {day:text('dayLabel'),time:text('timeLabel'),hp:text('basicHpValue'),energy:text('basicEnergyValue'),alert:text('basicAlertValue'),player:pos?{x:Number(pos[1])-1,y:Number(pos[2])-1}:null,context:text('contextActions'),contextTitle:text('contextTitle'),body:document.body.innerText,
 buttons:[...document.querySelectorAll('button:not(.tile)')].filter(vis).map(e=>({id:e.id,label:e.innerText,disabled:e.disabled,action:e.dataset.contextAction,npcId:e.dataset.npcId})),
 tiles:[...document.querySelectorAll('#world .tile:not(.fogged)')].map(e=>({x:+e.dataset.x,y:+e.dataset.y,tag:e.querySelector('.tag')?.textContent||'',text:e.innerText,water:e.classList.contains('water'),building:e.classList.contains('building-footprint')}))};}'''
def explore_public(page, entry, deadline):
 from collections import deque
 import math
 known={}; visited=set(); blocked=set(); waypoint=None; target=None; stall=0; detours=0
 entry['method']='Public rendered, non-fogged map cells and public coordinate HUD only; no world-state navigation. Does not assert human discovery.'
 entry['limit']={'seconds':30,'keyPulses':160,'frontiers':6,'hpFloor':60}
 entry['steps']=[];entry['targets']=[];entry['discoveredLabels']=[]
 end=min(deadline,time.monotonic()+30)
 if page.locator('#infoModal').is_visible():page.locator('#infoModalClose').click()
 def route(v, goal=None):
  start=(round(v['player']['x']),round(v['player']['y']));q=deque([start]); prev={start:None};found=None
  while q:
   xy=q.popleft();x,y=xy
   if goal is not None:
    match=math.dist(xy,goal)<=1.0
   else:
    match=xy not in visited and xy!=start and any(0<=nx<36 and 0<=ny<24 and (nx,ny)not in known for nx,ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
   if match:found=xy;break
   for n in [(x+1,y),(x,y+1),(x-1,y),(x,y-1)]:
    t=known.get(n)
    if t and not t['water'] and not t['building'] and n not in prev and n not in blocked:
     prev[n]=xy;q.append(n)
  if found is None:return None
  result=[]
  while found is not None:result.append(found);found=prev[found]
  return list(reversed(result))
 while time.monotonic()<end and len(entry['steps'])<160:
  v=page.evaluate(READ);p=(v['player']['x'],v['player']['y'])
  if float(v['hp'])<60:entry['stop']='PUBLIC_HP_FLOOR';break
  for t in v['tiles']:
   xy=(t['x'],t['y'])
   if t['tag'] and (xy not in known or known[xy]['tag']!=t['tag']):entry['discoveredLabels'].append({'tile':t,'time':v['time']})
   known[xy]=t
  tower=next(((t['x'],t['y']) for t in known.values() if '广播塔'in t['tag']),None)
  ready=next((b for b in v['buttons'] if b.get('action')=='landmark' and '广播塔'in b['label']),None)
  if ready:
   entry['stop']='TOWER_PUBLIC_ACTION_OBSERVED';entry['publicAction']=ready;break
  if tower and target!=tower:target=tower;waypoint=None;entry['targets'].append({'kind':'disclosedTower','target':target,'time':v['time']})
  if target and not tower and math.dist(p,target)<.25:visited.add(target);target=None;waypoint=None
  if target is None:
   if len(entry['targets'])>=6:entry['stop']='FRONTIER_LIMIT';break
   path=route(v)
   if not path:entry['stop']='NO_KNOWN_FRONTIER_PATH';break
   target=path[-1];entry['targets'].append({'kind':'visibleFrontier','target':target,'time':v['time']});waypoint=None
  if waypoint is None or math.dist(p,waypoint)<.18:
   path=route(v,target)
   if not path:entry['stop']='NO_KNOWN_TARGET_PATH';break
   waypoint=path[1] if len(path)>1 else path[0]
   if len(path)==1 and not tower:visited.add(target);target=None;waypoint=None;continue
  dx=waypoint[0]-p[0];dy=waypoint[1]-p[1]
  key=('d'if dx>0 else'a')if abs(dx)>.12 else('s'if dy>0 else's' if False else'w')
  distance=abs(dx)if abs(dx)>.12 else abs(dy);ms=max(55,min(200,int(distance/2*1000)))
  page.keyboard.down(key)
  try:page.wait_for_timeout(ms)
  finally:page.keyboard.up(key)
  page.wait_for_timeout(35);after=page.evaluate(READ);p2=(after['player']['x'],after['player']['y'])
  entry['steps'].append({'from':p,'to':p2,'key':key,'ms':ms,'hp':after['hp'],'time':after['time'],'context':after['contextTitle']})
  stall=stall+1 if math.dist(p,p2)<.05 else 0
  if stall>=3:
   blocked.add(tuple(waypoint));waypoint=None;stall=0;detours+=1
   if detours>3:entry['stop']='OBSERVED_COLLISION_METHOD_LIMIT';break
 else:entry['stop']='SEGMENT_BUDGET'
 entry['knownTileCount']=len(known)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class Server(http.server.ThreadingHTTPServer): allow_reuse_address=True
server=Server(('127.0.0.1',8765),functools.partial(Quiet,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'sourceCommit':'140d71918fab9ad8c536f7189dc088f6a934a025','sourceHtmlSha256':EXPECTED,'viewport':{'width':1440,'height':900},'scope':'public-input prefix with rendered DOM map automation, independent of A08; not human understanding or three-day acceptance','gameStateWrites':False,'initScript':False,'forceClicks':False,'actions':[],'errors':[],'status':'STARTED'}
at=time.monotonic();context=None
try:
 with sync_playwright() as p:
  context=p.chromium.launch_persistent_context(str(OUT/'profile'),headless=True,viewport=report['viewport'])
  page=context.pages[0] if context.pages else context.new_page();page.set_default_timeout(4000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto('http://127.0.0.1:8765/',wait_until='load')
  response=page.request.get('http://127.0.0.1:8765/');assert hashlib.sha256(response.body()).hexdigest()==EXPECTED
  report['beforeBootRaw']=page.evaluate('(k)=>localStorage.getItem(k)',KEY)
  report['startUi']=page.evaluate(READ)
  if page.locator('#startOverlay').is_visible():
   start=page.locator('#continueSaveBtn');report['actions'].append({'type':'publicStartOrContinue','label':start.inner_text()});start.click()
  page.wait_for_timeout(900);report['initialUi']=page.evaluate(READ)
  page.screenshot(path=str(OUT/'initial.png'))
  for a in ACTIONS:
   if time.monotonic()-at>35:raise RuntimeError('per-segment 35-second limit')
   v=page.evaluate(READ);assert float(v['hp'])>=60,'public HP safety floor'
   entry={'request':a,'beforeUi':v};report['actions'].append(entry)
   if a['type']=='key':
    assert a['key'] in ['w','a','s','d','Escape'];ms=int(a.get('ms',100));assert 0<ms<=1200
    page.keyboard.down(a['key']);page.wait_for_timeout(ms);page.keyboard.up(a['key'])
   elif a['type']=='click':
    loc=page.locator(a['selector']);assert loc.count()==1 and loc.is_visible() and loc.is_enabled(),'unique visible enabled target';entry['label']=loc.inner_text();loc.click()
   elif a['type']=='explore':
    explore_public(page,entry,at+33)
   elif a['type']=='wait':
    assert int(a['ms'])<=3000;page.wait_for_timeout(int(a['ms']))
   else:raise ValueError('unregistered public input')
   page.wait_for_timeout(80);entry['afterUi']=page.evaluate(READ)
  report['finalUi']=page.evaluate(READ);page.screenshot(path=str(OUT/'final.png'))
  raw=page.evaluate('(k)=>localStorage.getItem(k)',KEY)
  if raw:(OUT/'normal-writer.json').write_text(raw);report['normalWriterSha256']=hashlib.sha256(raw.encode()).hexdigest()
  report['status']='PUBLIC_PREFIX_RECORDED'
  context.close();context=None;report['browserClosed']=True
except Exception:
 report['status']='FAILED';report['error']=traceback.format_exc()
finally:
 if context:
  try:context.close();report['browserClosed']=True
  except Exception as e:report['cleanupError']=repr(e)
 server.shutdown();server.server_close();report['elapsedMs']=round((time.monotonic()-at)*1000)
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({k:report[k] for k in ['status','elapsedMs','errors']},ensure_ascii=False))
 if 'error' in report:print(report['error'])
 if 'finalUi'in report:
  v=report['finalUi'];print(json.dumps({k:v[k] for k in ['day','time','hp','player','contextTitle','context','buttons']},ensure_ascii=False));print('DISCLOSED TILES',json.dumps([t for t in v['tiles'] if t['tag']],ensure_ascii=False))
 if report['status']=='FAILED':raise SystemExit(1)
