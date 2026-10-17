// SCENARIO_C1_CORE_START
const SCENARIO_C1_WORLD_KEYS = Object.freeze(['ordinaryNpcCount','foodMultiplier','medicineMultiplier','materialMultiplier','initialEnemyMultiplier','waveGrowthMultiplier','eventFrequency']);
const SCENARIO_C1_BASE_WORLD = Object.freeze({ ordinaryNpcCount:10, foodMultiplier:1, medicineMultiplier:1, materialMultiplier:1, initialEnemyMultiplier:1, waveGrowthMultiplier:1, eventFrequency:1 });
const SCENARIO_C1_APPLIED = Object.freeze(['seed','world.foodMultiplier']);
const SCENARIO_C1_BASELINE_ONLY = Object.freeze(['world.ordinaryNpcCount','world.medicineMultiplier','world.materialMultiplier','world.initialEnemyMultiplier','world.waveGrowthMultiplier','world.eventFrequency','events']);
const SCENARIO_C1_CATALOG = {"registry":["relay-chain-001","zh-food-shortage-001"],"storylets":[{"id":"zh-food-shortage-001","trigger":{"type":"food_days","max":1},"fallback":{"ifMissingNpc":"shortage_deferred","ifInsufficientPopulation":"shortage_deferred","ifExpired":"ledger_only","ifSkipped":"ledger_only"},"choices":[{"id":"ration","effects":[{"op":"recordHistory","key":"zh-food-shortage-001:ration","payload":{"route":"ration"}}]},{"id":"forage","requires":[{"type":"role_available","role":"quartermaster","healthyOnly":true},{"type":"flag","id":"zh-shortage-cache-retrieved","value":false}],"effects":[{"op":"addResource","key":"food","value":2},{"op":"adjustMeter","key":"resonancePressure","value":2},{"op":"unlock","key":"zh-shortage-cache-retrieved"},{"op":"recordHistory","key":"zh-food-shortage-001:forage","payload":{"route":"emergency-cache","sourceId":"zh-shortage-cache-001","amount":2,"resonancePressure":2}}]}],"expression":{"observerCommentary":{"authority":"expression_only"}},"repeatable":true,"source":{"id":"zh-shortage-cache-001","food":2,"retrievalLimit":1,"flag":"zh-shortage-cache-retrieved"},"definitionVersion":2}]};
function scenarioRecord(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.prototype.toString.call(v) === '[object Object]'; }
function scenarioKeys(v, allowed, required = []) { return scenarioRecord(v) && Object.keys(v).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(v,k)); }
function scenarioCanonical(v) { if (Array.isArray(v)) return '[' + v.map(scenarioCanonical).join(',') + ']'; if (scenarioRecord(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+scenarioCanonical(v[k])).join(',') + '}'; return JSON.stringify(v); }
function stableHash(v) { let h=2166136261; const s=scenarioCanonical(v); for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
function scenarioDigest(v) { return 'fnv1a-utf16-canonical-hex-v1:' + stableHash(v); }
function scenarioUint32(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff; }
function scenarioAi(v) { return scenarioKeys(v,['generativeDialogue','observerCommentary','generatedWorldEvents','learnedWorldModel','policyVersion']) && Object.entries(v).every(([k,x])=>k==='policyVersion'?x==='observer-expression-v1':typeof x==='boolean'&&(k==='observerCommentary'||x===false)); }
function validateScenarioPackage(p) {
  const issues=[];
  if(!scenarioKeys(p,['schemaVersion','scenario','metadata','world','difficulty','events','ai','continuity'],['schemaVersion','scenario','metadata','world','difficulty','events','ai','continuity'])) return {ok:false,issues:['package-shape']};
  if(p.schemaVersion!==1||!scenarioKeys(p.scenario,['id','version','contentVersion'],['id','version','contentVersion'])||p.scenario.id!=='zombie-farm'||p.scenario.version!==1||p.scenario.contentVersion!==3) issues.push('scenario-version');
  if(!scenarioKeys(p.metadata,['title','campaign'],['title'])||typeof p.metadata.title!=='string'||!p.metadata.title||p.metadata.campaign!==undefined&&typeof p.metadata.campaign!=='string') issues.push('metadata');
  const worldOkay=(w,full)=>scenarioKeys(w,SCENARIO_C1_WORLD_KEYS,full?SCENARIO_C1_WORLD_KEYS:[])&&Object.values(w).every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100);
  if(!worldOkay(p.world,true)) issues.push('world-shape');
  if(!scenarioKeys(p.difficulty,['presets','playerCustomizable'],['presets','playerCustomizable'])||!scenarioKeys(p.difficulty.presets,['standard','hard'],['standard'])||Object.values(p.difficulty.presets).some(w=>!worldOkay(w,false))||scenarioCanonical(p.difficulty.playerCustomizable)!==scenarioCanonical(['world.foodMultiplier'])) issues.push('difficulty');
  if(Array.isArray(p.events?.storylets)&&p.events.storylets.some(story=>story?.definitionVersion!==undefined&&(!Number.isSafeInteger(story.definitionVersion)||story.definitionVersion<1))) issues.push('storylet-definition-version');
  if(scenarioCanonical(p.events)!==scenarioCanonical(SCENARIO_C1_CATALOG)) issues.push('unsupported-event-catalog');
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
  return snapshot;
}
// SCENARIO_C1_CORE_END
export { validateScenarioPackage, resolveScenarioConfig, createScenarioSnapshot, stableHash, scenarioCanonical, scenarioDigest };
