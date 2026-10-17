// SCENARIO_C1_CORE_START
const SCENARIO_C1_WORLD_KEYS = Object.freeze(['ordinaryNpcCount','foodMultiplier','medicineMultiplier','materialMultiplier','initialEnemyMultiplier','waveGrowthMultiplier','eventFrequency']);
const SCENARIO_C1_BASE_WORLD = Object.freeze({ ordinaryNpcCount:10, foodMultiplier:1, medicineMultiplier:1, materialMultiplier:1, initialEnemyMultiplier:1, waveGrowthMultiplier:1, eventFrequency:1 });
const SCENARIO_C1_APPLIED = Object.freeze(['seed','world.foodMultiplier','events']);
const SCENARIO_C1_BASELINE_ONLY = Object.freeze(['world.ordinaryNpcCount','world.medicineMultiplier','world.materialMultiplier','world.initialEnemyMultiplier','world.waveGrowthMultiplier','world.eventFrequency']);
function scenarioRecord(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.prototype.toString.call(v) === '[object Object]'; }
function scenarioKeys(v, allowed, required = []) { return scenarioRecord(v) && Object.keys(v).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(v,k)); }
function scenarioCanonical(v) { if (Array.isArray(v)) return '[' + v.map(scenarioCanonical).join(',') + ']'; if (scenarioRecord(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+scenarioCanonical(v[k])).join(',') + '}'; return JSON.stringify(v); }
function stableHash(v) { let h=2166136261; const s=scenarioCanonical(v); for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
function scenarioDigest(v) { return 'fnv1a-utf16-canonical-hex-v1:' + stableHash(v); }
function scenarioUint32(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff; }
function scenarioAi(v) { return scenarioKeys(v,['generativeDialogue','observerCommentary','generatedWorldEvents','learnedWorldModel','policyVersion']) && Object.entries(v).every(([k,x])=>k==='policyVersion'?x==='observer-expression-v1':typeof x==='boolean'&&(k==='observerCommentary'||x===false)); }
// A deliberately closed compiler, not a second effect interpreter. Its output is
// consumed by the existing EventChainDef/GateV1/effect transaction machinery.
function scenarioRulesDigest(value) {
  const prose=new Set(['title','description','text','label','hint']);
  const project=v=>Array.isArray(v)?v.map(project):scenarioRecord(v)?Object.fromEntries(Object.entries(v).filter(([k])=>!prose.has(k)).map(([k,x])=>[k,project(x)])):v;
  return scenarioDigest(project(value));
}
function compileScenarioEvents(packageValue) {
  const fail=reason=>{throw new Error(reason);};
  const shape=(value,keys,required=keys)=>{if(!scenarioKeys(value,keys,required))fail('shape:'+keys.join('/'));};
  const id=value=>typeof value==='string'&&value.length<=120&&!['constructor','prototype','__proto__'].includes(value)&&/^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/.test(value);
  const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=4000;
  const integer=(value,min,max)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
  const equal=(a,b)=>scenarioCanonical(a)===scenarioCanonical(b);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const events=packageValue?.events;
  shape(events,['registry','storylets']);
  if(!Array.isArray(events.registry)||!Array.isArray(events.storylets)||!events.storylets.length||events.storylets.length>32)fail('event-lists');
  const refs=new Set();
  for(const ref of events.registry){shape(ref,['kind','id']);if(!['eventDef','eventChain'].includes(ref.kind)||!id(ref.id))fail('typed-ref');const key=ref.kind+':'+ref.id;if(refs.has(key))fail('duplicate-ref');refs.add(key);if(ref.kind==='eventDef'&&ref.id!=='relay-chain-001')fail('unsupported-external-ref');}
  const ids=new Set(),sources=new Set(),flags=new Set(),historyKeys=new Set(),definitions=[];
  const condition=gate=>{
    if(!scenarioRecord(gate))fail('gate-object');
    if(gate.type==='food_days'){shape(gate,['type','max']);if(typeof gate.max!=='number'||!Number.isFinite(gate.max)||gate.max<0||gate.max>1)fail('food-days');}
    else if(gate.type==='role_available'){shape(gate,['type','role','healthyOnly']);if(gate.role!=='quartermaster'||gate.healthyOnly!==true)fail('role-gate');}
    else if(gate.type==='flag'){shape(gate,['type','id','value']);if(!id(gate.id)||gate.value!==false)fail('flag-gate');}
    else fail('unsupported-gate');
  };
  const effect=entry=>{
    if(!scenarioRecord(entry))fail('effect-object');
    if(entry.op==='addResource'){shape(entry,['op','key','value']);if(entry.key!=='food'||!integer(entry.value,1,100))fail('resource-effect');}
    else if(entry.op==='adjustMeter'){shape(entry,['op','key','value']);if(!['resonancePressure','campCollapse'].includes(entry.key)||!integer(entry.value,0,100))fail('meter-effect');}
    else if(entry.op==='unlock'){shape(entry,['op','key']);if(!id(entry.key))fail('unlock-effect');}
    else if(entry.op==='recordHistory'){
      shape(entry,['op','key','payload']);if(typeof entry.key!=='string'||!entry.key||entry.key.length>160)fail('history-key');
      const payload=entry.payload;
      if(payload?.route==='ration')shape(payload,['route']);
      else{shape(payload,['route','sourceId','amount','resonancePressure']);if(payload.route!=='emergency-cache'||!id(payload.sourceId)||!integer(payload.amount,1,100)||!integer(payload.resonancePressure,0,100))fail('history-payload');}
    } else fail('unsupported-effect');
  };
  for(const story of events.storylets){
    shape(story,['id','chainId','title','description','definitionVersion','category','phase','priority','gateVersion','evaluatePreconditions','gate','preconditions','startConditions','nodes','fallback','hooks','repeatable','optional','source','expression']);
    if(!id(story.id)||story.chainId!==story.id||ids.has(story.id))fail('story-id');ids.add(story.id);
    if(!text(story.title)||!text(story.description)||!integer(story.definitionVersion,2,Number.MAX_SAFE_INTEGER)||story.category!=='survival'||!equal(story.phase,['day_1','day_13'])||!integer(story.priority,0,100)||story.gateVersion!==1||story.evaluatePreconditions!==true||story.repeatable!==true||story.optional!==true||!equal(story.hooks,['onDayStart']))fail('story-contract');
    shape(story.expression,['observerCommentary']);shape(story.expression.observerCommentary,['authority']);if(story.expression.observerCommentary.authority!=='expression_only')fail('expression-authority');
    shape(story.source,['id','food','retrievalLimit','flag']);const source=story.source;
    if(!id(source.id)||!id(source.flag)||!integer(source.food,1,100)||source.retrievalLimit!==1||sources.has(source.id)||flags.has(source.flag))fail('finite-source');sources.add(source.id);flags.add(source.flag);
    shape(story.gate,['version','phase','nightAllowed','preconditions']);
    if(story.gate.version!==1||story.gate.phase!=='DAY'||story.gate.nightAllowed!==false||!Array.isArray(story.preconditions)||story.preconditions.length!==1||story.preconditions[0]?.type!=='food_days')fail('story-gate');
    story.preconditions.forEach(condition);
    if(!equal(story.preconditions,story.gate.preconditions)||!equal(story.preconditions,story.startConditions))fail('gate-conflict');
    if(!Array.isArray(story.nodes)||story.nodes.length!==1)fail('single-node-required');
    const node=story.nodes[0];shape(node,['nodeId','title','text','choices']);
    if(!id(node.nodeId)||!text(node.title)||!text(node.text)||!Array.isArray(node.choices)||node.choices.length!==2)fail('node-contract');
    const choiceIds=new Set();let paid=0,recordOnly=0;
    for(const choice of node.choices){
      shape(choice,['id','label','hint','requires','effects']);
      if(!id(choice.id)||choiceIds.has(choice.id)||!text(choice.label)||!text(choice.hint)||!Array.isArray(choice.requires)||!Array.isArray(choice.effects)||!choice.effects.length)fail('choice-contract');choiceIds.add(choice.id);
      choice.requires.forEach(condition);choice.effects.forEach(effect);
      const history=choice.effects.filter(x=>x.op==='recordHistory');
      if(history.length!==1||history[0].key!==story.id+':'+choice.id||historyKeys.has(history[0].key))fail('history-identity');historyKeys.add(history[0].key);
      const resources=choice.effects.filter(x=>x.op==='addResource');
      if(!resources.length){
        if(choice.effects.length!==1||choice.requires.length||history[0].payload.route!=='ration')fail('safe-choice');recordOnly++;
      } else {
        paid++;
        const expectedGates=[{type:'role_available',role:'quartermaster',healthyOnly:true},{type:'flag',id:source.flag,value:false}];
        const grants=choice.effects.filter(x=>x.op==='unlock'),meters=choice.effects.filter(x=>x.op==='adjustMeter'),receipt=history[0].payload;
        if(choice.effects.length!==4||resources.length!==1||grants.length!==1||meters.length!==1||!equal(choice.requires,expectedGates)||resources[0].value!==source.food||grants[0].key!==source.flag||meters[0].key!=='resonancePressure'||receipt.route!=='emergency-cache'||receipt.sourceId!==source.id||receipt.amount!==resources[0].value||receipt.resonancePressure!==meters[0].value)fail('source-budget-or-protection');
      }
    }
    if(paid!==1||recordOnly!==1)fail('source-path-count');
    shape(story.fallback,['ifMissingNpc','ifInsufficientPopulation','ifExpired','ifSkipped']);
    for(const key of ['ifMissingNpc','ifInsufficientPopulation']){
      const fallback=story.fallback[key];shape(fallback,['id','effects']);
      if(!id(fallback.id)||!Array.isArray(fallback.effects)||fallback.effects.length!==1)fail('fallback-contract');
      fallback.effects.forEach(effect);
      if(fallback.effects[0].op!=='adjustMeter'||fallback.effects[0].key!=='campCollapse')fail('fallback-reward');
    }
    if(story.fallback.ifExpired!=='ledger_only'||story.fallback.ifSkipped!=='ledger_only')fail('fallback-exit');
    const {source:sourceMetadata,expression:expressionMetadata,...definition}=story;
    definitions.push(clone(definition));
  }
  if(events.registry.length!==ids.size+1||!refs.has('eventDef:relay-chain-001')||[...ids].some(value=>!refs.has('eventChain:'+value)))fail('registry-definition-mismatch');
  // Reject shared flags used as another source or cross-definition aliases too.
  if([...sources].some(value=>flags.has(value)))fail('source-flag-alias');
  return {compilerVersion:'scenario-event-chain-v1',registry:clone(events.registry),definitions,catalogDigest:scenarioDigest(events),rulesDigest:scenarioRulesDigest(events)};
}
function validateScenarioPackage(p) {
  const issues=[];
  if(!scenarioKeys(p,['schemaVersion','scenario','metadata','world','difficulty','events','ai','continuity'],['schemaVersion','scenario','metadata','world','difficulty','events','ai','continuity'])) return {ok:false,issues:['package-shape']};
  if(p.schemaVersion!==1||!scenarioKeys(p.scenario,['id','version','contentVersion'],['id','version','contentVersion'])||p.scenario.id!=='zombie-farm'||p.scenario.version!==1||p.scenario.contentVersion!==3) issues.push('scenario-version');
  if(!scenarioKeys(p.metadata,['title','campaign'],['title'])||typeof p.metadata.title!=='string'||!p.metadata.title||p.metadata.campaign!==undefined&&typeof p.metadata.campaign!=='string') issues.push('metadata');
  const worldOkay=(w,full)=>scenarioKeys(w,SCENARIO_C1_WORLD_KEYS,full?SCENARIO_C1_WORLD_KEYS:[])&&Object.values(w).every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100);
  if(!worldOkay(p.world,true)) issues.push('world-shape');
  if(!scenarioKeys(p.difficulty,['presets','playerCustomizable'],['presets','playerCustomizable'])||!scenarioKeys(p.difficulty.presets,['standard','hard'],['standard'])||Object.values(p.difficulty.presets).some(w=>!worldOkay(w,false))||scenarioCanonical(p.difficulty.playerCustomizable)!==scenarioCanonical(['world.foodMultiplier'])) issues.push('difficulty');
  if(Array.isArray(p.events?.storylets)&&p.events.storylets.some(story=>story?.definitionVersion!==undefined&&(!Number.isSafeInteger(story.definitionVersion)||story.definitionVersion<1))) issues.push('storylet-definition-version');
  try { compileScenarioEvents(p); } catch(error) { issues.push('event-compile:'+error.message); }
  if(!scenarioKeys(p.ai,['generativeFeaturesDefault','policies'],['generativeFeaturesDefault','policies'])||p.ai.generativeFeaturesDefault!==false||!scenarioKeys(p.ai.policies,['observer'],['observer'])||!scenarioKeys(p.ai.policies.observer,['authority'],['authority'])||p.ai.policies.observer.authority!=='expression_only') issues.push('ai-authority');
  if(!scenarioKeys(p.continuity,['importContracts','exportContracts'],['importContracts','exportContracts'])||scenarioCanonical(p.continuity.importContracts)!=='[]'||scenarioCanonical(p.continuity.exportContracts)!==scenarioCanonical(['observer_core_v1'])) issues.push('unsupported-continuity');
  return {ok:issues.length===0,issues};
}
function resolveScenarioConfig(p,o={}) {
  const valid=validateScenarioPackage(p); if(!valid.ok) throw new Error(valid.issues.join(','));
  if(!scenarioKeys(o,['seed','difficultyProfile','gameVersion','worldConfig','aiConfig'])) throw new Error('boot-options');
  const seed=Object.hasOwn(o,'seed')?o.seed:0x5eedc0de, profile=Object.hasOwn(o,'difficultyProfile')?o.difficultyProfile:'standard';
  if(!scenarioUint32(seed)) throw new Error('seed-uint32');
  if(typeof profile!=='string'||!Object.hasOwn(p.difficulty.presets,profile)) throw new Error('unknown-profile');
  if(profile!=='standard') throw new Error('unsupported-profile');
  if(Object.hasOwn(o,'gameVersion')&&o.gameVersion!=='zfarm-world-1.0') throw new Error('game-version');
  if(Object.hasOwn(o,'worldConfig')&&!scenarioKeys(o.worldConfig,SCENARIO_C1_WORLD_KEYS)) throw new Error('world-config');
  if(Object.hasOwn(o,'aiConfig')&&!scenarioAi(o.aiConfig)) throw new Error('unsupported-ai-config');
  const worldConfig={...p.world,...p.difficulty.presets[profile],...(o.worldConfig||{})};
  for(const [key,value] of Object.entries(worldConfig)) {
    if(typeof value!=='number'||!Number.isFinite(value)) throw new Error('world-config');
    if(key==='foodMultiplier'?(value<0||value>2):value!==(key==='ordinaryNpcCount'?10:1)) throw new Error('unsupported-config:'+key);
  }
  return {scenarioId:p.scenario.id,schemaVersion:1,scenarioVersion:1,contentVersion:3,gameVersion:'zfarm-world-1.0',seed,difficultyProfile:profile,worldConfig,aiConfig:{generativeDialogue:false,observerCommentary:o.aiConfig?.observerCommentary===true,generatedWorldEvents:false,learnedWorldModel:false,policyVersion:'observer-expression-v1'}};
}
function createScenarioSnapshot(p,o={}) {
  const snapshot=resolveScenarioConfig(p,o);
  snapshot.binding={version:1,status:'bound',bindingId:'scenario-initial-v1',baselineId:'zombie-farm-authored-initial-v1',packageDigest:scenarioDigest(p),configDigest:scenarioDigest(snapshot),appliedKeys:[...SCENARIO_C1_APPLIED],baselineOnlyKeys:[...SCENARIO_C1_BASELINE_ONLY],deferredKeys:['continuity'],initialAiConfig:{...snapshot.aiConfig}};
  const compiled=compileScenarioEvents(p);
  snapshot.contentBinding={version:1,status:'bound',compilerVersion:compiled.compilerVersion,catalogDigest:compiled.catalogDigest,rulesDigest:compiled.rulesDigest,registry:compiled.registry};
  return snapshot;
}
// SCENARIO_C1_CORE_END
export { validateScenarioPackage, resolveScenarioConfig, createScenarioSnapshot, stableHash, scenarioCanonical, scenarioDigest, compileScenarioEvents, scenarioRulesDigest };
