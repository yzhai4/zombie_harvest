import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {root, saveKey, sourceRuntimeFactory} from './lib/source-runtime-fixture.mjs';

// Complete native boot inputs, actual page renderer and public controls only.
// Offline isolation below is TEST-ONLY, not natural play or balance evidence.
const args={};
for(let i=2;i<process.argv.length;i+=2){assert.ok(['--html','--input','--out','--expect-html-sha256','--expect-input-sha256','--playwright-module','--chrome-executable'].includes(process.argv[i])&&process.argv[i+1]&&!args[process.argv[i]]);args[process.argv[i]]=process.argv[i+1];}
for(const k of ['--html','--input','--out','--playwright-module','--chrome-executable'])assert.ok(path.isAbsolute(args[k]||''),k);
const hash=b=>createHash('sha256').update(b).digest('hex');
const html=fs.readFileSync(args['--html']),original=fs.readFileSync(args['--input']),sprites=fs.readFileSync(path.join(root,'dist/actor-sprites.js'));
assert.equal(hash(html),args['--expect-html-sha256']);assert.equal(hash(original),args['--expect-input-sha256']);
assert.ok(!fs.existsSync(args['--out']),'fresh output required');fs.mkdirSync(args['--out']);
const out=args['--out'],report={runner:'browser-camp-rest-feedback-v1',sourceHtmlSha256:hash(html),inputSha256:hash(original),runnerSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),naturalGameplay:false,humanExperience:false,postBootStateWrites:false,checks:[],errors:[],scenes:[],documents:[],captures:[],cleanup:{}};
for(const [name,bytes]of [['runner-executed.mjs',fs.readFileSync(fileURLToPath(import.meta.url))],['source.html',html],['input-original-native.json',original],['actor-sprites.js',sprites],['source-runtime-fixture-executed.mjs',fs.readFileSync(path.join(root,'scripts/lib/source-runtime-fixture.mjs'))],['io-adapter-executed.mjs',fs.readFileSync(path.join(root,'scripts/check-report-recovery.mjs'))]])fs.writeFileSync(path.join(out,name),bytes);
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const factory=sourceRuntimeFactory(args['--html']);
function derived(name,prepare){
 const r=factory([[saveKey,original.toString('utf8')]]);assert.equal(r.api.start().ok,true);r.tasks.clear();prepare(r.api.state);
 assert.equal(r.api.save({force:true,reason:'TEST-ONLY rest feedback '+name}),true);
 const raw=r.storage.get(saveKey);assert.equal(r.api.validate({raw,sourceCategory:'primary'}).ok,true,'derived complete writer validates');
 return raw;
}
const unknown=derived('unknown-speed',s=>{assert.ok(s.worldZombies.length);s.worldZombies[0].speedFactor=1.13;});
const safe=derived('safe-zero-supplies',s=>{
 s.worldZombies=[];s.zombies=[];s.food=0;s.energy=0;s.world.frontierExposure=0;s.world.frontierClock=0;
 s.npcs.forEach(n=>{n.needs={...n.needs,hunger:10,fatigue:10,stress:20,social:10,safety:10,energy:90};n.needClock=0;n.eventChain.cooldown=1000;});
});
const server=createServer((request,response)=>{const route=new URL(request.url,'http://localhost').pathname;const data=['/','/index.html'].includes(route)?html:route==='/actor-sprites.js'?sprites:null;response.writeHead(data?200:404,{'Content-Type':route.endsWith('.js')?'text/javascript;charset=utf-8':'text/html;charset=utf-8'});response.end(data||'');});
const require=createRequire(import.meta.url),{chromium}=require(args['--playwright-module']);let browser;const contexts=new Set();
async function boot(name,raw,changes){
 fs.writeFileSync(path.join(out,name+'-input-native.json'),raw);report.scenes.push({name,inputSha256:hash(Buffer.from(raw)),changes});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.add(context);
 await context.addInitScript(({raw,key})=>{if(!sessionStorage.getItem('rest-feedback-seeded')){localStorage.clear();localStorage.setItem(key,raw);sessionStorage.setItem('rest-feedback-seeded','1');}},{raw,key:saveKey});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push({scene:name,type:'pageerror',message:e.message}));
 const response=await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});assert.ok(response?.ok());const sha256=hash(await response.body());report.documents.push({scene:name,sha256});check(name+': actual document matches frozen source',sha256===report.sourceHtmlSha256);
 await page.locator('#continueSaveBtn').click();await page.waitForTimeout(750);
 return {name,page,context,raw:()=>page.evaluate(key=>localStorage.getItem(key),saveKey)};
}
async function publicView(page){return page.evaluate(()=>{
 const e=document.getElementById('campRestFeedback'),rect=e?.getBoundingClientRect();let visible=!!rect&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.left>=0&&rect.right<=innerWidth;
 for(let n=e;n&&visible;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)visible=false;}
 const buttons=[30,60].map(n=>{const b=document.querySelector('[data-context-action="campRest'+n+'"]');return {minutes:n,present:!!b,disabled:b?.disabled,description:b?.getAttribute('aria-describedby')};});
 return {feedback:e?.innerText??null,visible,rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}:null,fontSize:e?getComputedStyle(e).fontSize:null,opacity:e?getComputedStyle(e).opacity:null,buttons,status:document.getElementById('campRestStatus')?.innerText};
});}
async function capture(b,label){
 const raw=await b.raw(),view=await publicView(b.page),stem=b.name+'-'+label;
 const record={scene:b.name,label,public:view,files:[]};
 for(const [suffix,data]of [['-native.json',raw],['-ui.json',JSON.stringify(view,null,2)+'\n']]){const bytes=Buffer.from(data);fs.writeFileSync(path.join(out,stem+suffix),bytes);record.files.push({file:stem+suffix,bytes:bytes.length,sha256:hash(bytes)});}
 const image=await b.page.screenshot({path:path.join(out,stem+'.png'),timeout:5000});record.files.push({file:stem+'.png',bytes:image.length,sha256:hash(image)});report.captures.push(record);write();return view;
}
async function scene(name,raw,changes,run){let b;try{b=await boot(name,raw,changes);await run(b);}catch(error){report.errors.push({scene:name,type:'assertion-or-method',message:String(error.stack||error)});if(b)try{await capture(b,'failure');}catch(e){report.errors.push({scene:name,type:'capture',message:String(e)});}}finally{if(b){await b.context.close();contexts.delete(b.context);}}}
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true,executablePath:args['--chrome-executable']});report.browserVersion=browser.version();write();
 await scene('actual-danger',original.toString('utf8'),['Original A02 terminal native writer, no business-field derivation; no new natural prefix claim'],async b=>{
  let v=await capture(b,'desktop');check(b.name+': rest entries present disabled with visible coarse reason',v.buttons.every(x=>x.present&&x.disabled)&&v.visible&&/附近存在威胁/.test(v.feedback||''));
  check(b.name+': reason is outside disabled controls and linked accessibly',v.buttons.every(x=>x.description?.split(/\s+/).includes('campRestFeedback'))&&await b.page.locator('#campRestFeedback').evaluate(e=>!e.closest('button')));
  const before=JSON.parse(await b.raw()).payload.worldMeta.events.filter(e=>e.type==='camp.rest.started').length;
  await b.page.setViewportSize({width:390,height:844});await b.page.waitForTimeout(200);v=await capture(b,'390');
  check(b.name+': 390 visible explanation retains readable size',v.visible&&parseFloat(v.fontSize)>=12&&Number(v.opacity)>.7&&/附近存在威胁/.test(v.feedback||''));
  const after=JSON.parse(await b.raw()).payload;check(b.name+': inspection cannot start rest or change save schema',after.worldMeta.events.filter(e=>e.type==='camp.rest.started').length===before&&after.version===21&&after.contentState.contentVersion===3);
 });
 await scene('unknown-speed',unknown,['Offline complete writer derived from original; first existing enemy speedFactor1.13 outside rest safety envelope, accepted by actual loader; no enemy position edits'],async b=>{
  const v=await capture(b,'desktop');check(b.name+': unknown data is disabled with neutral reason',v.buttons.every(x=>x.present&&x.disabled)&&v.visible&&/无法确认/.test(v.feedback||'')&&!/附近存在威胁/.test(v.feedback||''));
  const ids=JSON.parse(unknown).payload.worldZombies.map(x=>x.id);check(b.name+': feedback discloses no enemy identity or coordinate',ids.every(id=>!v.feedback.includes(id))&&!/坐标|\d+(?:\.\d+)?格/.test(v.feedback));
 });
 await scene('safe-zero-supplies',safe,['Offline TEST-ONLY isolation: enemies removed, existing player position retained, food0/energy0, frontier clocks0, moderate NPC needs/cooldown1000; no player-gameplay survival claim'],async b=>{
  let v=await capture(b,'available');const initial=JSON.parse(await b.raw()).payload;
  check(b.name+': zero food and energy have no new hard gate',initial.food===0&&initial.energy===0&&v.visible&&v.buttons.every(x=>x.present&&!x.disabled));
  check(b.name+': available feedback clears old failure and retains risk',!/附近存在威胁|无法确认|仍被追踪/.test(v.feedback||'')&&/风险|安全|世界/.test(v.feedback||''));
  await b.page.locator('[data-context-action="campRest30"]').click();await b.page.waitForFunction(()=>!document.getElementById('campRestCancel').hidden);
  v=await publicView(b.page);check(b.name+': active feedback and controls agree',v.visible&&v.buttons.every(x=>x.disabled)&&/正在等候|等候中|等候进行/.test(v.feedback||''));
  await b.page.waitForFunction(()=>/\b[1-9]\d*\/30/.test(document.getElementById('campRestStatus').innerText));await b.page.locator('#campRestCancel').click();
  await b.page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).payload.worldMeta.events.some(e=>e.type==='camp.rest.stopped'&&e.payload.reason==='player-cancel'),saveKey);
  v=await capture(b,'cancelled');check(b.name+': cancel restores availability without stale active reason',v.visible&&v.buttons.every(x=>!x.disabled)&&!/正在等候|等候中|等候进行/.test(v.feedback||'')&&/等候停止/.test(v.status||''));
  const p=JSON.parse(await b.raw()).payload,stops=p.worldMeta.events.filter(e=>e.type==='camp.rest.stopped'),stop=stops.at(-1),starts=p.worldMeta.events.filter(e=>e.type==='camp.rest.started');
  check(b.name+': real paid-time prefix stops once with no food grant',starts.length===1&&stops.length===1&&stop.payload.completed>0&&stop.payload.completed<30&&p.food===0);
 });
}catch(error){report.errors.push({type:'setup',message:String(error.stack||error)});}
finally{
 for(const context of contexts)await context.close().catch(e=>report.errors.push({type:'context-close',message:String(e)}));report.cleanup.contextsClosed=contexts.size===0;
 if(browser)await browser.close().then(()=>report.cleanup.browserClosed=true).catch(e=>report.errors.push({type:'browser-close',message:String(e)}));
 if(server.listening)await new Promise(resolve=>server.close(resolve));report.cleanup.serverClosed=!server.listening;
 report.count=report.checks.length;report.passed=report.checks.filter(x=>x.ok).length;report.ok=report.errors.length===0&&report.count>0&&report.count===report.passed&&report.scenes.length===3;write();
 console.log(JSON.stringify({ok:report.ok,count:report.count,passed:report.passed,sourceHtmlSha256:report.sourceHtmlSha256,scenes:report.scenes.length,errors:report.errors,cleanup:report.cleanup}));if(!report.ok)process.exitCode=1;
}
