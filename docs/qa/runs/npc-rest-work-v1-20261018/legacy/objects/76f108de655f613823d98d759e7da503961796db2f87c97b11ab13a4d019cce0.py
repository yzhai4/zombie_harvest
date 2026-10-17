"""Prepare unapplied, narrow method diffs; no game/test execution or repo edits."""
from pathlib import Path
import difflib, hashlib, json

out=Path(__file__).resolve().parent
root=out.parents[3]/'zombie_harvest-30eeefb5c20e4e8105dfe76e64ce9f806e3373cd'
sha=lambda b:hashlib.sha256(b).hexdigest()
def diff(name, old, new):
    text=''.join(difflib.unified_diff(old.splitlines(keepends=True),new.splitlines(keepends=True),fromfile='a/'+name,tofile='b/'+name))
    p=out/'method-suggestions'/Path(name).name
    p.parent.mkdir(exist_ok=True)
    p.with_suffix('.diff').write_text(text,encoding='utf-8')
    # Unapplied proposal only. Preserve it so an implementer can inspect exact bytes.
    p.write_text(new,encoding='utf-8')
    return dict(path=name,executedOriginalSha256=sha(old.encode()),suggestedSha256=sha(new.encode()),suggestedPath=p.relative_to(out).as_posix(),diff=p.with_suffix('.diff').relative_to(out).as_posix(),applied=False,executed=False)

attention=(out/'methods/attention-executed.mjs').read_text(encoding='utf-8')
shortage=(root/'scripts/check-shortage-choice-v2.mjs').read_text(encoding='utf-8')
start='function hasOnlyExpectedScenarioLegacyMigration(runtime, envelope) {'
a=attention.index(start);b=attention.index('\n\nconst args',a)
c=shortage.index(start);d=shortage.index('\nconst root',c)
attention_new=attention[:a]+shortage[c:d]+attention[b:]
assert attention_new != attention

c2=(out/'methods/c2-boot-executed.mjs').read_text(encoding='utf-8')
old="for(const key of ['attributes','hero','garrisonedOutpostId'])if(!Object.hasOwn(before.npcs[i],key))delete npcs[i][key];assert.deepEqual(npcs[i],before.npcs[i],'old NPC facts retained; only absent established additive NPC domains excluded');"
new="for(const key of ['attributes','hero','garrisonedOutpostId'])if(!Object.hasOwn(before.npcs[i],key))delete npcs[i][key];if(!Object.hasOwn(before.npcs[i],'routineIntent')){assert.equal(npcs[i].routineIntent,null,'only the exact new null default is additive');delete npcs[i].routineIntent;}assert.deepEqual(npcs[i],before.npcs[i],'old NPC facts retained; only absent established additive NPC domains excluded');"
assert c2.count(old)==1
c2_new=c2.replace(old,new)
old_end="assert.deepEqual([after.worldMeta.seed,after.worldMeta.rngState,after.worldMeta.replay.seed,after.worldMeta.commandSeq,after.worldMeta.seenCommands,after.worldMeta.replay.commands],[before.worldMeta.seed,before.worldMeta.rngState,before.worldMeta.replay.seed,before.worldMeta.commandSeq,before.worldMeta.seenCommands,before.worldMeta.replay.commands]);}"
new_end="""assert.deepEqual([after.worldMeta.seed,after.worldMeta.rngState,after.worldMeta.replay.seed,after.worldMeta.commandSeq,after.worldMeta.seenCommands,after.worldMeta.replay.commands],[before.worldMeta.seed,before.worldMeta.rngState,before.worldMeta.replay.seed,before.worldMeta.commandSeq,before.worldMeta.seenCommands,before.worldMeta.replay.commands]);
  const missing=before.npcs.filter(n=>!Object.hasOwn(n,'routineIntent')).map(n=>n.id);
  if(missing.length){
    const added=after.worldMeta.events.filter(e=>e.seq>before.worldMeta.eventSeq);
    assert.equal(added.length,1,'one actual additive boot migration, no routine business event');
    assert.equal(added[0].type,'save.migrated');
    assert.equal(after.worldMeta.eventSeq,before.worldMeta.eventSeq+1);
    assert.deepEqual(after.worldMeta.events.slice(0,before.worldMeta.events.length),before.worldMeta.events,'old event prefix retained');
    assert.deepEqual(added[0].payload.npcRoutineIntentAdapters,[{adapter:'npc-routine-intent-v1',npcIds:missing,defaultValue:null}]);
    assert.equal(added[0].payload.reason.split(',').filter(x=>x==='npc-routine-intent-v1').length,1);
    assert.equal(added[0].payload.addedDomains.filter(x=>x==='npc.routineIntent').length,1);
  }
}"""
assert c2_new.count(old_end)==1
c2_new=c2_new.replace(old_end,new_end)
rows=[diff('scripts/check-npc-threat-attention.mjs',attention,attention_new),diff('scripts/check-scenario-boot-c2.mjs',c2,c2_new)]
(out/'method-suggestions/index.json').write_text(json.dumps(dict(schema='ImpactMethodSuggestionsV1',scope='Unapplied metadata/default-domain adjustment only; original failures remain',suggestions=rows),indent=2)+'\n',encoding='utf-8')
print(json.dumps(rows))
