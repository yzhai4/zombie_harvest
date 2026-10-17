import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const EXPECT='c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571';
const sha=b=>createHash('sha256').update(b).digest('hex');
const require=createRequire(import.meta.url);
export async function createPilot({repoRoot,outputBase,playwrightModulePath,browserExecutablePath}){
 const ROOT=repoRoot,BASE=outputBase;assert.ok(path.isAbsolute(ROOT)&&path.isAbsolute(BASE)&&path.isAbsolute(playwrightModulePath));
 const source=fs.readFileSync(path.join(ROOT,'dist/index.html')),sprites=fs.readFileSync(path.join(ROOT,'dist/actor-sprites.js'));assert.equal(sha(source),EXPECT);
 const {chromium}=require(playwrightModulePath);
 const server=createServer((q,r)=>{const u=new URL(q.url,'http://localhost').pathname;if(u==='/'||u==='/index.html'){r.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});r.end(source);}else if(u==='/actor-sprites.js'){r.writeHead(200,{'Content-Type':'text/javascript;charset=utf-8'});r.end(sprites);}else{r.writeHead(404);r.end();}});
 await new Promise((a,b)=>{server.once('error',b);server.listen(0,'127.0.0.1',a);});
 assert.ok(path.isAbsolute(browserExecutablePath)&&fs.existsSync(browserExecutablePath));
 let browser;try{browser=await chromium.launch({headless:true,executablePath:browserExecutablePath});}catch(e){await new Promise(r=>server.close(r));throw e;}const arms=[],pending=[];
 const method=fs.readFileSync(fileURLToPath(import.meta.url)),methodHash=sha(method);
 async function begin(id,inputPath,protocolPath){
  assert.ok(['A','B'].includes(id));assert.ok(!arms.some(x=>x.id===id));const raw=fs.readFileSync(inputPath,'utf8');
  const expected=id==='A'?'ebd2c2a6f1ab12b0e62dc6ba235231b4a229916759cdf1662c2594ed9ac4c7e6':'d0d160f8b03c6323e51611ff6013895d52713d0775bcd56dc8d84ba86b46fded';assert.equal(sha(raw),expected);
  const out=path.join(BASE,'browser-'+id+'-method03');assert.ok(!fs.existsSync(out));fs.mkdirSync(out);
  fs.writeFileSync(path.join(out,'input-native.json'),raw);fs.writeFileSync(path.join(out,'source.html'),source);fs.writeFileSync(path.join(out,'actor-sprites.js'),sprites);fs.writeFileSync(path.join(out,'method-executed.mjs'),method);
  const protocol=fs.readFileSync(protocolPath);fs.writeFileSync(path.join(out,'protocol-executed.md'),protocol);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  assert.equal((await context.storageState()).origins.length,0);
  const report={schema:'ControlledRelayPilotV1',id,status:'OVERLAY_PREPARED',sourceHtmlSha256:EXPECT,methodSha256:methodHash,inputSha256:expected,protocolSha256:sha(protocol),browserVersion:browser.version(),policy:{controlledPrebootFixture:true,freshNatural:false,aiOffRequired:true,timeRate:1,wallBudgetSeconds:480,majorActionBudget:10,publicActionsOnly:true,goalSources:'public HUD/context and currently rendered non-fogged tiles only',privilegedWriterUse:'outcome verification and conservative safety veto only; no goal locations',noModelOrGameStateMutation:true,noEnemyDeletionOrResourceGrant:true},documents:[],errors:[],actions:[],snapshots:[],safety:[],majorActions:0,setupStartedAt:Date.now()};
  const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const page=await context.newPage();page.setDefaultTimeout(8000);
  await context.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('qa-controlled-relay-seeded')){localStorage.setItem(key,raw);sessionStorage.setItem('qa-controlled-relay-seeded','1');}},{key:'zombie-harvest-progress-v12',raw});
  page.on('pageerror',e=>{report.errors.push({type:'pageerror',message:e.message});write();});
  page.on('response',response=>{if(response.request().resourceType()==='document'&&response.frame()===page.mainFrame())pending.push((async()=>{const b=await response.body(),file='main-'+report.documents.length+'.html';fs.writeFileSync(path.join(out,file),b);report.documents.push({file,sha256:sha(b),status:response.status(),url:response.url()});if(sha(b)!==EXPECT||!response.ok())report.errors.push({type:'main-document',sha256:sha(b),status:response.status()});write();})().catch(e=>{report.errors.push({type:'main-response',message:e.message});write();}));});
  let seq=0,finished=false,timer=null;report.interactionAttempts=0;
  async function ui(){return page.evaluate(()=>{
   const t=id=>document.getElementById(id)?.innerText||'';
   const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden';};
   const pos=t('mapRegionLabel').match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/),tm=t('timeLabel').match(/(\d\d):(\d\d)/);
   return {day:Number(t('dayLabel').match(/\d+/)?.[0]),hour:Number(tm?.[1]),minute:Number(tm?.[2]),hp:Number(t('hpValue')),energy:Number(t('energyValue')),food:Number(t('foodValue')),wood:Number(t('woodValue')),stone:Number(t('stoneValue')),player:pos?{x:Number(pos[1])-1,y:Number(pos[2])-1}:null,alert:t('alertPill'),contextTitle:t('contextTitle'),context:t('contextActions'),quest:t('questList'),relay:t('relayStatus'),rest:t('campRestStatus'),overlayVisible:vis(document.getElementById('startOverlay')),modal:t('infoModal'),buttons:[...document.querySelectorAll('button')].filter(vis).map(e=>({id:e.id,text:e.innerText,disabled:e.disabled,context:e.dataset.contextAction,npcId:e.dataset.npcId})),selects:[...document.querySelectorAll('select')].filter(vis).map(e=>({id:e.id,value:e.value,options:[...e.options].map(x=>({value:x.value,text:x.text}))})),tiles:[...document.querySelectorAll('#world .tile:not(.fogged)')].map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=x>=0&&x<innerWidth&&y>=0&&y<innerHeight?document.elementFromPoint(x,y):null;return{x:Number(e.dataset.x),y:Number(e.dataset.y),tag:e.querySelector('.tag')?.textContent||'',text:e.innerText,water:e.classList.contains('water'),building:e.classList.contains('building-footprint'),visible:vis(e),clickable:!!h&&(h===e||e.contains(h)),buildingType:e.querySelector('[data-building-type]')?.dataset.buildingType||null};})};
  });}
  async function native(){return page.evaluate(()=>localStorage.getItem('zombie-harvest-progress-v12'));}
  async function live(){return page.evaluate(()=>document.getElementById('startOverlay').classList.contains('hidden')?WorldSnapshot.capture():null);}
  async function capture(label,image=true){const prefix=String(seq++).padStart(3,'0')+'-'+label.replace(/[^a-z0-9_-]/gi,'_'),raw=await native(),view=await ui(),files=[];if(raw){const f=prefix+'-native.json';fs.writeFileSync(path.join(out,f),raw);files.push({file:f,sha256:sha(raw),kind:'actual-localStorage-writer'});}const uf=prefix+'-ui.json';fs.writeFileSync(path.join(out,uf),JSON.stringify(view,null,2)+'\n');files.push({file:uf,sha256:sha(fs.readFileSync(path.join(out,uf))),kind:'public-DOM'});if(image){const f=prefix+'.png';await page.screenshot({path:path.join(out,f),timeout:8000});files.push({file:f,sha256:sha(fs.readFileSync(path.join(out,f))),kind:'actual-screenshot'});}report.snapshots.push({label,at:Date.now(),files});write();return{view,files};}
  function budget(){if(finished)throw Error('arm terminal');if(report.startedAt&&Date.now()-report.startedAt>480000)throw Error('pilot480s budget exceeded');if(report.majorActions>10)throw Error('major action budget exceeded');}
  async function safety(minutes=0){const v=await ui(),raw=await native();assert.ok(raw&&v.player);const p=JSON.parse(raw).payload,clock=x=>(x.day-1)*1440+x.hour*60+x.minute,lag=Math.max(0,clock(v)-clock(p));const enemies=p.worldZombies.filter(z=>z.hp>0).map(z=>{const speed=({normal:.065,runner:.12,brute:.04})[z.kind],m=z.speedFactor===undefined?1:Number(z.speedFactor),distance=Math.hypot(z.x-v.player.x,z.y-v.player.y);return{id:z.id,kind:z.kind,distance,known:Number.isFinite(speed)&&Number.isFinite(m)&&m>0,envelope:1.25+(speed||.12)*m*(minutes+lag+2)+.6};});const s={at:Date.now(),minutes,lag,playerHp:v.hp,playerEnergy:v.energy,enemies,veto:enemies.some(z=>!z.known||z.distance<=z.envelope)||v.hp<=35};report.safety.push(s);write();return s;}
  async function action(spec){
   budget();assert.ok(spec.note);if(spec.major)assert.ok(report.majorActions<10);if(spec.interaction){assert.ok(report.interactionAttempts<30);report.interactionAttempts++;}
   const publicBefore=await ui(),worldMinute=v=>(v.day-1)*1440+v.hour*60+v.minute;
   if(report.startWorldMinute!==undefined)assert.ok(worldMinute(publicBefore)-report.startWorldMinute+(spec.minutes||0)<=480,'world-minute budget');
   if(spec.minutes!==undefined){const s=await safety(spec.minutes);if(s.veto)throw Error('conservative safety veto; no action performed');}
   const beforeLive=await live(),a={...spec,startedAt:Date.now(),before:await capture('before-'+(spec.label||spec.kind),false)};report.actions.push(a);write();
   try{
    if(spec.kind==='click'){const l=page.locator(spec.selector);assert.equal(await l.count(),1);assert.ok(await l.isVisible()&&await l.isEnabled());await l.click();if(spec.selector==='#continueSaveBtn'&&!report.startedAt){await page.waitForFunction(()=>document.getElementById('startOverlay').classList.contains('hidden'));assert.ok(await native());report.startedAt=Date.now();report.startWorldMinute=worldMinute(await ui());report.status='RUNNING';timer=setTimeout(()=>{finish('BUDGET_EXHAUSTED','480-second real wall budget reached').catch(e=>{report.errors.push({type:'deadline-cleanup',message:e.message});write();});},480000);}}
    else if(spec.kind==='key'){assert.ok(typeof spec.key==='string'&&spec.key.length<=24);if(spec.holdMs){assert.ok(spec.holdMs<=800);await page.keyboard.down(spec.key);try{await page.waitForTimeout(spec.holdMs);}finally{await page.keyboard.up(spec.key);}}else await page.keyboard.press(spec.key);}
    else if(spec.kind==='select')await page.locator(spec.selector).selectOption(spec.value);
    else if(spec.kind==='wait'){assert.ok(spec.ms<=3000);await page.waitForTimeout(spec.ms);}
    else if(spec.kind==='reload')await page.reload({waitUntil:'domcontentloaded'});
    else throw Error('unsupported public pilot operation');
    await page.waitForTimeout(120);a.after=await capture('after-'+(spec.label||spec.kind),false);const afterLive=await live();
    if(afterLive){const oldIds=new Set(beforeLive?.worldMeta?.replay?.commands?.map(c=>c.commandId)||[]),events=afterLive.worldMeta.events.filter(e=>e.seq>(beforeLive?.worldMeta?.eventSeq||0));a.newEvents=events;a.newCommands=afterLive.worldMeta.replay.commands.filter(c=>!oldIds.has(c.commandId));a.actualWorldMinuteDelta=beforeLive?worldMinute(afterLive)-worldMinute(beforeLive):0;
     if(spec.major){const parents=a.newCommands.filter(c=>spec.commandType?c.type===spec.commandType:c.type!=='world.advance'),accepted=parents.filter(c=>!events.some(e=>e.type==='command.rejected'&&e.commandId===c.commandId)),paidInterrupted=parents.filter(c=>events.some(e=>e.type==='time.advanced'&&e.causationId===c.commandId&&(e.payload?.minutes||e.payload?.requestedMinutes||0)>0));a.majorCounted=accepted.length>0||paidInterrupted.length>0;a.majorBasis={acceptedParentIds:accepted.map(c=>c.commandId),paidInterruptedParentIds:paidInterrupted.map(c=>c.commandId)};if(a.majorCounted)report.majorActions++;}
    }a.endedAt=Date.now();write();return a.after.view;
   }catch(e){a.error=e.message;a.endedAt=Date.now();write();throw e;}
  }
  async function finish(status,reason){if(finished)return report;finished=true;if(timer)clearTimeout(timer);try{await capture('final',true);}catch(e){report.errors.push({type:'final-capture',message:e.message});}report.status=status;report.reason=reason;report.endedAt=Date.now();report.elapsedWallMs=report.startedAt?report.endedAt-report.startedAt:null;await context.close();await Promise.all(pending);report.cleanup={contextClosed:context.pages().length===0};write();return report;}
  const entry={id,out,page,context,report,ui,native,capture,safety,action,finish};arms.push(entry);write();
  const response=await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});assert.equal(sha(await response.body()),EXPECT);
  await capture('overlay-prepared',true);return entry;
 }
 async function close(){for(const a of arms)if(!a.report.endedAt)await a.finish('STOPPED_OPERATOR','session closing');await browser.close();await new Promise(r=>server.close(r));return{browserClosed:!browser.isConnected(),serverClosed:!server.listening,arms:arms.map(a=>({id:a.id,status:a.report.status,errors:a.report.errors.length}))};}
 return{begin,close,browserVersion:browser.version(),sourceHash:EXPECT};
}

