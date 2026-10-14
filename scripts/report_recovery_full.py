"""B1-B16 browser driver. No game-state mutation after before-loader seed.

Timer observation delegates native APIs unchanged; the observed 650ms queue
is required for B15, rather than inferred from a synthetic resolved fixture.
Invalid/empty storage is retained as raw evidence, never a fabricated save.
"""
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from report_recovery_fixtures import cases, production18_rows

SAVE_KEY = "zombie-harvest-progress-v12"
TRACE_KEY = "zfarm-qa-native-timer-observation"
SOURCE21_WRITER_SHA256 = "8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0"
SOURCE21_ORIGINAL_SHA256 = {
    "day": "ec20cf74f593e159301e1a507072a52c99b701664c1c366a33e6176efe0cfd38",
    "resolved": "d7d8240aace117a0525d9d3e0bc4178d9f270b51d8cb48f414b0901a39faf1d7",
    "closed": "4cded7359f15367f5efc36b2e178a2fb32df7a453f536059be7f08b68740dfe1",
}
JS_ENVELOPE = """p=>{let h=2166136261,s=JSON.stringify(p);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return {...p,payload:p,version:p.version,checksum:(h>>>0).toString(16),savedAt:(p.day-1)*1440+p.hour*60+p.minute,reason:'qa-explicit-report-fixture'};}"""
JS_VALIDATE = """e=>{let h=2166136261,s=JSON.stringify(e.payload);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}const p=e.payload,m=(p.day-1)*1440+p.hour*60+p.minute;return {ok:(h>>>0).toString(16)===e.checksum&&e.savedAt===m&&p.world.totalMinutes===m&&p.version===21&&p.contentState.contentVersion===3,checksum:(h>>>0).toString(16)}}"""
JS_VALIDATE_18 = """e=>{let h=2166136261,s=JSON.stringify(e.payload);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}const p=e.payload,m=(p.day-1)*1440+p.hour*60+p.minute,w=p.world,x=p.worldMeta;
 const empty=v=>Array.isArray(v)&&v.length===0;const sentinel=p.day===1&&p.hour===6&&p.minute===0&&w.totalMinutes===0&&w.lastRationDay===1&&w.lastDailyUpkeepDay===1&&x.eventSeq===0&&x.commandSeq===0&&empty(x.events)&&empty(x.seenCommands)&&empty(x.replay.commands)&&p.night===false&&p.nightBattle===null;
 return {ok:e.version===18&&p.version===18&&!Object.hasOwn(p,'contentState')&&!Object.hasOwn(e,'contentState')&&(h>>>0).toString(16)===e.checksum&&e.savedAt===m&&(w.totalMinutes===m||sentinel),initialSentinel:sentinel,checksum:(h>>>0).toString(16)}}"""
TIMER_OBSERVER = r"""(() => {
 if(window!==top)return;const key='zfarm-qa-native-timer-observation',generation=performance.timeOrigin;
 const native={setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,setInterval:window.setInterval,clearInterval:window.clearInterval,random:Math.random};
 function record(event){try{const a=JSON.parse(sessionStorage.getItem(key)||'[]');a.push({...event,generation,at:Date.now()});sessionStorage.setItem(key,JSON.stringify(a.slice(-800)));}catch(_) {}}
 const wrap=(kind,original)=>function(callback,delay,...args){let id;const stack=String(new Error().stack||'');
   const wrapped=typeof callback==='function'?function(...values){record({type:'fired',kind,id,delay:Number(delay)});return callback.apply(this,values);}:callback;
   id=original.call(window,wrapped,delay,...args);record({type:'scheduled',kind,id,delay:Number(delay),stack});return id;};
 window.setTimeout=wrap('timeout',native.setTimeout);window.setInterval=wrap('interval',native.setInterval);
 for(const [name,kind,fn] of [['clearTimeout','timeout',native.clearTimeout],['clearInterval','interval',native.clearInterval]])window[name]=function(id){record({type:'cleared',kind,id});return fn.call(window,id);};
 window.__zfarmQaRandomCalls=0;Math.random=function(){window.__zfarmQaRandomCalls++;return native.random.call(Math);};
 document.addEventListener('visibilitychange',()=>record({type:'visibility',state:document.visibilityState}));
 document.addEventListener('click',event=>{const button=event.target?.closest?.('#continueBtn,#restartSessionBtn,#resetSaveBtn');
   if(button&&(button.id==='restartSessionBtn'||button.id==='resetSaveBtn'||button.textContent.includes('重新开始')))
     record({type:'restart-intent',selector:'#'+button.id,trusted:event.isTrusted,disabled:button.disabled,text:button.textContent});},true);
})();"""


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_archive21(raw, kind):
    actual = hashlib.sha256(raw).hexdigest()
    if actual != SOURCE21_ORIGINAL_SHA256[kind]:
        raise ValueError("archived public SAVE21 original file SHA mismatch: " + kind)
    return {"originalFileSHA256": actual, "originalWriterHTMLSHA256": SOURCE21_WRITER_SHA256,
            "originalProvenance": "previously-captured-public-play-original; source-pinned-by-full-suite"}


def minute(payload):
    return (payload["day"] - 1) * 1440 + payload["hour"] * 60 + payload["minute"]


def protection(payload):
    """Projection only; no rule implementation or new gameplay facts."""
    fields = ("hp", "energy", "wood", "stone", "food", "seeds", "parts", "medicine", "morale", "sanity", "sanityClock",
              "player", "campaign", "campStanding", "specialItems", "relayProject", "hordeForecast", "contentState", "buildings", "resources", "landmarks")
    npc_fields = ("id", "hp", "maxHp", "lifeState", "wounds", "needs", "sanity", "hero", "bond", "relations", "garrisonedOutpostId", "order", "currentOrder", "workHistory")
    return {**{key: copy.deepcopy(payload.get(key)) for key in fields},
            "npcs": [{key: copy.deepcopy(n.get(key)) for key in npc_fields} for n in payload["npcs"]],
            "maintenance": {key: payload["world"].get(key) for key in ("lastRationDay", "lastDailyUpkeepDay")},
            "rng": {key: value for key, value in payload["worldMeta"].items() if "rng" in key.lower()}}


def original_persistent_fields_preserved(payload, original, initial_clock_correction=False):
    """Compare the original writer's complete persistent fields.

    Known boot transients are explicitly excluded; this projection never
    normalizes or installs a game state. The initial18 correction is only
    requested for its independently authenticated, exact sentinel fixture.
    """
    if not isinstance(payload, dict): return False
    expected = copy.deepcopy(original)
    if initial_clock_correction: expected["world"]["totalMinutes"] = 360
    excluded = {"version", "contentState", "gameOver", "night", "nightBattle", "worldMeta", "npcs", "motion", "settings"}
    if not all(payload.get(key) == value for key, value in expected.items() if key not in excluded): return False
    if len(payload.get("npcs", [])) != len(expected["npcs"]): return False
    if not all(all(actual.get(key) == value for key, value in saved.items()) for saved, actual in zip(expected["npcs"], payload["npcs"])): return False
    old_motion, new_motion = expected["motion"], payload.get("motion", {})
    if not all(new_motion.get(k) == v for k, v in old_motion.items() if k not in ("accumulator", "input")): return False
    if new_motion.get("accumulator") != 0 or new_motion.get("input") != {"x": 0, "y": 0}: return False
    if not all(payload.get("settings", {}).get(k) == v for k, v in expected["settings"].items() if k != "continuousWorld"): return False
    meta_transient = {"activeCommandId", "feedback", "projections", "lastCheckpointReason", "lastEventId", "eventSeq", "events"}
    if not all(payload.get("worldMeta", {}).get(k) == v for k, v in expected["worldMeta"].items() if k not in meta_transient): return False
    return all(event in payload["worldMeta"].get("events", []) for event in expected["worldMeta"]["events"])


def new_events(payload, prior):
    return [e for e in payload["worldMeta"]["events"] if e["seq"] > prior["worldMeta"]["eventSeq"]]


def active_intervals(trace):
    active = {}
    for event in trace:
        key = (event["generation"], event.get("id"))
        if event["type"] == "scheduled" and event.get("kind") == "interval": active[key] = event
        if event["type"] == "cleared": active.pop(key, None)
    current = max((e["generation"] for e in trace), default=0)
    return [e for (generation, _), e in active.items() if generation == current and e.get("delay") in (620, 1200)]


def pending_checkpoints(trace):
    pending = {}
    for event in trace:
        key = (event["generation"], event.get("id"))
        if event["type"] == "scheduled" and event.get("kind") == "timeout" and event.get("delay") == 650 and "requestCheckpoint" in event.get("stack", ""):
            pending[key] = event
        if event["type"] in ("cleared", "fired"): pending.pop(key, None)
    return list(pending.values())


def validate_legacy_capture(args):
    if not args.legacy_writer_report:return None
    raw=Path(args.legacy_writer_report).read_bytes();report=json.loads(raw)
    if (report.get("mode")!="exact-production18-public-writer-capture" or report.get("ok") is not True
        or report.get("saveInjection") is not False or report.get("hiddenGameCalls") is not False
        or report.get("htmlSha256")!=args.legacy_html_sha256):raise ValueError("production18 writer provenance report mismatch")
    for kind,stage in (("day","DAY18"),("resolved","RESOLVED18"),("closed","CLOSED18")):
        records=[a for a in report["artifacts"] if a["stage"]==stage]
        original=Path(getattr(args,"legacy_"+kind+"_source")).read_bytes();decoded=json.loads(original);e=decoded["envelope"] if "envelope" in decoded else decoded
        if len(records)!=1 or records[0]["sha256"]!=hashlib.sha256(original).hexdigest() or records[0]["checksum"]!=e["checksum"] or records[0]["version"]!=18 or records[0]["contentStatePresent"] is not False:raise ValueError("production18 original file provenance mismatch: "+kind)
    return {"reportSHA256":hashlib.sha256(raw).hexdigest(),"writerHTMLSHA256":report["htmlSha256"],"sourceCommit":report["sourceCommit"],"mode":report["mode"],"saveInjection":False,"hiddenGameCalls":False}


def validate_initial_capture(args):
    if not args.legacy_initial_source:return None
    raw=Path(args.legacy_initial_source).read_bytes();report_raw=Path(args.legacy_initial_report).read_bytes();report=json.loads(report_raw)
    records=[a for a in report.get("artifacts",[]) if a["stage"]=="INITIAL18-reload"]
    decoded=json.loads(raw);e=decoded["envelope"] if "envelope" in decoded else decoded
    if (report.get("mode")!="exact-production18-first-start-reload-capture" or report.get("ok") is not True
        or report.get("saveInjection") is not False or report.get("hiddenGameCalls") is not False or report.get("htmlSha256")!=args.legacy_html_sha256
        or len(records)!=1 or records[0]["sha256"]!=hashlib.sha256(raw).hexdigest() or records[0]["checksum"]!=e["checksum"]):
        raise ValueError("real production18 initial writer provenance mismatch")
    return {"reportSHA256":hashlib.sha256(report_raw).hexdigest(),"writerHTMLSHA256":report["htmlSha256"],"sourceCommit":report["sourceCommit"],"mode":report["mode"],"saveInjection":False,"hiddenGameCalls":False}


def fixture_source_checks(args):
    """Static fixture/observer development checks, never game execution."""
    class NodeBuilder:
        def evaluate(self, expression, value):
            code = "const fs=require('node:fs');const x=JSON.parse(fs.readFileSync(0,'utf8'));const fn=("+expression+");process.stdout.write(JSON.stringify(fn(x)));"
            result = subprocess.run(["node","-e",code],input=json.dumps(value,ensure_ascii=True),text=True,encoding="utf-8",capture_output=True,timeout=15)
            if result.returncode:raise AssertionError("development JS checksum/fixture check failed")
            return json.loads(result.stdout)
    builder=NodeBuilder();sources={};meta={}
    for key in ("day","resolved","closed"):
        path=getattr(args,key+"_source",None) or (args.fixture_source/("public-"+key+"-source-envelope.json") if args.fixture_source else None)
        if path is None:raise ValueError("--check-fixtures requires archived sources for "+key)
        raw=Path(path).read_bytes();provenance=validate_archive21(raw,key);decoded=json.loads(raw);envelope=decoded["envelope"] if "envelope" in decoded else decoded
        if not builder.evaluate(JS_VALIDATE,envelope)["ok"]:raise AssertionError("original source integrity failure: "+key)
        sources[key]=envelope;meta[key]={"fileSHA256":hashlib.sha256(raw).hexdigest(),"checksum":envelope["checksum"],**provenance}
    unchanged=copy.deepcopy(sources)
    rows=cases(sources["day"],sources["resolved"],sources["closed"])
    assert sources==unchanged and len({r["key"] for r in rows})==len(rows)
    assert {r["group"] for r in rows}=={"DAY",*["B"+str(n) for n in range(1,17)]}
    original_ids={n["id"] for n in sources["resolved"]["payload"]["npcs"]}
    # Development controls for the comparison itself, not game execution.
    source_projection = copy.deepcopy(sources["resolved"]["payload"])
    source_projection["motion"].update(accumulator=0, input={"x":0,"y":0})
    assert original_persistent_fields_preserved(source_projection, sources["resolved"]["payload"])
    for label in ("quests", "resident-relations", "command-history"):
        changed=copy.deepcopy(source_projection)
        if label=="quests":changed["quests"]={"developer-only-invalid-domain":True}
        elif label=="resident-relations":changed["npcs"][0]["relations"]={"developer-only-invalid-relation":True}
        else:changed["worldMeta"]["replay"]["commands"]=[]
        assert not original_persistent_fields_preserved(changed,sources["resolved"]["payload"]),"whole-source comparison missed "+label
    for row in rows:
        if row.get("raw_kind")!="critical-structure":assert {n["id"] for n in row["payload"]["npcs"]}==original_ids
        if row["key"]!="DAY-control" and row["key"]!="B1-complete-resolved":assert row["mutations"] or row.get("restart")
        assert builder.evaluate(JS_VALIDATE,builder.evaluate(JS_ENVELOPE,row["payload"]))["ok"]
    negative=[]
    for label in ("wrong-close-instance","duplicate-close-command","missing-start-causation"):
        damaged=copy.deepcopy(sources)
        if label=="wrong-close-instance":
            event=next(e for e in damaged["closed"]["payload"]["worldMeta"]["events"] if e["type"]=="threat.closed" and e["payload"].get("threatId")==sources["resolved"]["payload"]["nightBattle"]["instanceId"])
            event["payload"]["threatId"]="developer-wrong-instance"
        elif label=="duplicate-close-command":
            close=next(e for e in damaged["closed"]["payload"]["worldMeta"]["events"] if e["type"]=="threat.closed" and e["payload"].get("threatId")==sources["resolved"]["payload"]["nightBattle"]["instanceId"])
            command=next(c for c in damaged["closed"]["payload"]["worldMeta"]["replay"]["commands"] if c["commandId"]==close["commandId"])
            damaged["closed"]["payload"]["worldMeta"]["replay"]["commands"].append(copy.deepcopy(command))
        else:damaged["resolved"]["payload"]["worldMeta"]["events"]=[e for e in damaged["resolved"]["payload"]["worldMeta"]["events"] if e["type"]!="threat.started"]
        try:cases(damaged["day"],damaged["resolved"],damaged["closed"])
        except ValueError:negative.append(label)
        else:raise AssertionError("fixture source mismatch accepted: "+label)
    # Execute exact native observer in a development VM. Fake timer/RNG values
    # below are controls for delegation only, never a game or a battle fixture.
    observer_control = r"""const vm=require('node:vm'),store=new Map(),scheduled=new Map();let next=0,nativeRandomCalls=0,nativeFired=0;
 const w={setTimeout(fn,delay,...args){const id=++next;scheduled.set(id,()=>fn(...args));return id;},clearTimeout(id){scheduled.delete(id);},setInterval(fn,delay){return ++next;},clearInterval(id){},};
 const math=Object.create(Math);math.random=()=>{nativeRandomCalls++;return .37;};const doc={addEventListener(){}};
 const ctx={window:w,top:w,performance:{timeOrigin:17},document:doc,Math:math,Date,Error,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
 vm.createContext(ctx);vm.runInContext(OBSERVER,ctx);vm.runInContext('function requestCheckpoint(){return window.setTimeout(()=>window.fired=true,650)};window.id=requestCheckpoint();window.value=Math.random();',ctx);
 if(w.value!==.37||nativeRandomCalls!==1||!scheduled.has(w.id))throw Error('native delegation');w.clearTimeout(w.id);if(scheduled.has(w.id))throw Error('native cancellation');
 const events=JSON.parse(store.get('zfarm-qa-native-timer-observation'));if(!events.some(e=>e.type==='scheduled'&&e.delay===650&&e.stack.includes('requestCheckpoint'))||!events.some(e=>e.type==='cleared'))throw Error('queue audit');
 process.stdout.write(JSON.stringify({nativeObserverDelegation:true,gameplayExecuted:false}));""".replace("OBSERVER",json.dumps(TIMER_OBSERVER))
    result=subprocess.run(["node","-e",observer_control],text=True,encoding="utf-8",capture_output=True,timeout=15)
    assert result.returncode==0,result.stderr
    legacy_meta={};legacy_negatives=[];legacy_originals={}
    if getattr(args,"legacy_day_source",None):
        for key in ("day","resolved","closed",*(["initial"] if args.legacy_initial_source else [])):
            raw=Path(getattr(args,"legacy_"+key+"_source")).read_bytes();decoded=json.loads(raw);envelope=decoded["envelope"] if "envelope" in decoded else decoded
            assert builder.evaluate(JS_VALIDATE_18,envelope)["ok"],"real production18 source integrity failed"
            legacy_meta[key]={"fileSHA256":hashlib.sha256(raw).hexdigest(),"checksum":envelope["checksum"],"saveVersion":18,"writerHTMLSHA256":args.legacy_html_sha256}
            legacy_originals[key]=envelope
        for label,value in (("null",None),("array",[]),("bad-object",{"contentVersion":"invalid"})):
            derived=copy.deepcopy(legacy_originals["day"]["payload"]);derived["contentState"]=value
            assert not builder.evaluate(JS_VALIDATE_18,builder.evaluate(JS_ENVELOPE,derived))["ok"]
            legacy_negatives.append("own-content-"+label+"-not-absent-adapter")
        noninitial=copy.deepcopy(legacy_originals["day"]["payload"]);noninitial["world"]["totalMinutes"]=0
        assert not builder.evaluate(JS_VALIDATE_18,builder.evaluate(JS_ENVELOPE,noninitial))["ok"]
        legacy_negatives.append("world-zero-noninitial-rejected")
        identity=legacy_originals["resolved"]["payload"]["nightBattle"]["instanceId"]
        closes=legacy_originals["closed"]["payload"]["worldMeta"]["events"]
        commands=legacy_originals["closed"]["payload"]["worldMeta"]["replay"]["commands"]
        linked=[e for e in closes if e["type"]=="threat.closed" and e["payload"]=={}
                and len([c for c in commands if c["commandId"]==e["commandId"] and c["type"]=="threat.close" and c["payload"].get("threatId")==identity])==1]
        assert len(linked)==1,"real production18 empty close lacks exact replay linkage"
    legacy_provenance=validate_legacy_capture(args)
    initial_provenance=validate_initial_capture(args)
    legacy_rows=production18_rows(legacy_originals) if legacy_originals else []
    print(json.dumps({"mode":"fixture-contract-source-checks","gameplayExecuted":False,"browserStarted":False,"gameplayPassCount":None,
        "sources":meta,"declaredCases":len(rows),"currentWriterInitialCaseDeclared":True,"matrix":[{"key":r["key"],"group":r["group"],"expectedPhase":r["phase"],"mutations":r["mutations"]} for r in rows],
        "sourceNegativeControls":negative,"wholeSourceComparisonNegativeControls":["quests","resident-relations","command-history"],"originalsUnmodified":True,"nativeObserverDelegation":True,
        "production18compatSources":legacy_meta,"production18compatBrowserStatus":"not-run","production18compatDeclaredCases":len(legacy_rows),
        "production18compatMatrix":[{"key":r["key"],"expectedPhase":r["phase"],"mutations":r["mutations"]} for r in legacy_rows],
        "production18AdapterNegativeControls":legacy_negatives,"production18WriterProvenance":legacy_provenance,"production18InitialWriterProvenance":initial_provenance,"ok":True},ensure_ascii=True),flush=True)


class FullSuite:
    def __init__(self, runner, browser, builder):
        self.r, self.browser, self.builder = runner, browser, builder
        self.sources = {}
        self.source_meta = {}

    def load_sources(self):
        args = self.r.args
        for key in ("day", "resolved", "closed"):
            path = getattr(args, key + "_source", None)
            if path is None and args.fixture_source:
                path = args.fixture_source / ("public-" + key + "-source-envelope.json")
            if path is None: raise ValueError("full suite requires archived --" + key + "-source (no synthetic source fallback)")
            path = Path(path)
            raw = path.read_bytes()
            provenance = validate_archive21(raw, key)
            parsed = json.loads(raw)
            envelope = parsed["envelope"] if "envelope" in parsed else parsed
            checked = self.builder.evaluate(JS_VALIDATE, envelope)
            if not checked["ok"]: raise ValueError("archived source integrity failed: " + key)
            self.sources[key] = copy.deepcopy(envelope)
            source_file = "source-" + key + "-original.json"
            (self.r.directory / source_file).write_bytes(raw)
            self.source_meta[key] = {"file": source_file, "sourceBasename": path.name,
                **provenance, "checksum": envelope["checksum"],
                "sourceMode": "archived-public-play-save", "renderedHTMLIsSeparateFrozenBuild": True}

    def current_initial(self):
        row={"key":"CURRENT-public-first-start-reload","group":"current-writer"}
        case={"group":"current-writer","status":"running","fixtureMode":False,"saveInjection":False,"hiddenGameCalls":False,"mode":"public-first-start-immediate-reload"}
        self.r.result["cases"][row["key"]]=case
        start=len(self.r.result["actualChecks"])
        context=self.browser.new_context(viewport={"width":1440,"height":900});page=self.r.page(context,row["key"]);page.add_init_script(TIMER_OBSERVER)
        try:
            self.r.source(page.goto(self.r.args.url,wait_until="domcontentloaded",timeout=self.r.timeout()),row["key"])
            boot=self.snapshot(page,row,"blank-public-boot")
            self.check(row,"new context actually has no old save",not any(boot["keysPresent"].values()),fatal=True)
            if not self.accessible(page,"#continueSaveBtn"):
                self.blocked(row,"fresh public new-game start");return
            page.locator("#continueSaveBtn").click()
            # Immediate reload, before screenshots or a synthetic world anchor.
            self.r.reload(page,row["key"])
            saved=self.snapshot(page,row,"actual-immediate-pagehide-save",allow_invalid=True);payload=self.primary(saved)
            self.check(row,"actual new writer initial save has valid world/date/FNV",payload is not None and payload["day"]==1 and payload["hour"]==6 and payload["minute"]==0
                       and payload["world"]["totalMinutes"]==360 and saved["envelope"]["savedAt"]==360 and payload["version"]==21 and payload["contentState"]["contentVersion"]==3)
            trace=saved["nativeObservation"]["events"]
            first_generation=min((e["generation"] for e in trace),default=0)
            self.check(row,"initial boundary observed before any real world tick",not any(e["generation"]==first_generation and e["type"]=="fired" and e.get("kind")=="interval" and e.get("delay")==1200 for e in trace))
            self.check(row,"initial save contains no migration or encounter outcome",payload is not None and not any(e["type"] in ("save.migrated","threat.started","threat.resolved","threat.closed") for e in payload["worldMeta"]["events"]))
            if not self.accessible(page,"#continueSaveBtn"):
                self.blocked(row,"continue real new writer save");return
            page.locator("#continueSaveBtn").click();self.snapshot(page,row,"continued-actual-initial-save")
            for repeat in (1,2):
                self.r.reload(page,row["key"])
                observed=self.snapshot(page,row,"actual-initial-reload-"+str(repeat),allow_invalid=True);p=self.primary(observed)
                self.check(row,"new writer initial reload legal without rewards "+str(repeat),p is not None and len({n["id"] for n in p["npcs"]})==10
                           and not any(e["type"]=="save.migrated" for e in p["worldMeta"]["events"]))
                if self.accessible(page,"#continueSaveBtn"):page.locator("#continueSaveBtn").click()
                else:self.blocked(row,"public initial reload continue");break
                self.snapshot(page,row,"actual-initial-reload-started-"+str(repeat))
        except Exception as error:
            case["exception"]={"type":type(error).__name__,"message":str(error)};self.r.result["errors"].append("exception:"+row["key"]+":"+str(error))
            try:self.snapshot(page,row,"failure",allow_invalid=True)
            except Exception as capture_error:case["failureCaptureError"]=type(capture_error).__name__
        finally:
            checks=self.r.result["actualChecks"][start:];case["actualCheckCount"]=len(checks)
            case["status"]="passed" if checks and all(c["ok"] for c in checks) and "exception" not in case else "failed"
            context.close();self.r.persist()

    def load_legacy(self):
        rows=[]
        if not self.r.args.legacy_day_source:return rows
        provenance=validate_legacy_capture(self.r.args)
        self.r.result["production18WriterProvenance"]=provenance
        for kind in ("day","resolved","closed",*(["initial"] if self.r.args.legacy_initial_source else [])):
            path=Path(getattr(self.r.args,"legacy_"+kind+"_source"));raw=path.read_bytes();decoded=json.loads(raw)
            envelope=decoded["envelope"] if "envelope" in decoded else decoded
            if not self.builder.evaluate(JS_VALIDATE_18,envelope)["ok"]:raise ValueError("production18 original integrity failed: "+kind)
            source_key="production18-"+kind
            self.sources[source_key]=copy.deepcopy(envelope)
            filename="source-"+source_key+"-original.json";(self.r.directory/filename).write_bytes(raw)
            self.source_meta[source_key]={"file":filename,"sourceBasename":path.name,"originalFileSHA256":hashlib.sha256(raw).hexdigest(),
                "checksum":envelope["checksum"],"sourceMode":"actual-production18-writer-public-save","saveVersion":18,
                "writerHTMLSHA256":self.r.args.legacy_html_sha256,"renderedHTMLIsSeparateFrozenBuild":True}
        self.r.result["production18InitialWriterProvenance"]=validate_initial_capture(self.r.args)
        return production18_rows({kind:self.sources["production18-"+kind] for kind in ("day","resolved","closed",*(["initial"] if self.r.args.legacy_initial_source else []))})

    def trace(self, page):
        return page.evaluate("key=>({events:JSON.parse(sessionStorage.getItem(key)||'[]'),randomCalls:window.__zfarmQaRandomCalls||0})", TRACE_KEY)

    def snapshot(self, page, row, stage, allow_invalid=False):
        observed = self.r.capture(page, row["key"], stage, allow_invalid=allow_invalid)
        observed["nativeObservation"] = self.trace(page)
        artifact = self.r.result["artifacts"][-1]
        write(self.r.directory / artifact["file"], observed)
        return observed

    def check(self, row, name, ok, detail=None, fatal=False):
        self.r.check(row["key"], name, ok, detail, fatal)

    def accessible(self, page, selector):
        control = page.locator(selector)
        return control.count() == 1 and control.is_visible() and control.is_enabled()

    def blocked(self, row, action):
        self.r.result["cases"][row["key"]]["blockedAction"] = action
        self.check(row, "required public action is available: " + action, False)

    def flush(self, page, row, stage):
        # Use an actual public reload to flush lifecycle; never invoke saveProgress.
        self.r.reload(page, row["key"])
        return self.snapshot(page, row, stage, allow_invalid=True)

    def primary(self, observation):
        if "validationError" in observation or not isinstance(observation.get("envelope"), dict): return None
        return observation["envelope"]["payload"]

    def migration(self, row, observed, expected, input_envelope, first=True):
        payload = self.primary(observed)
        if payload is None:
            self.check(row, "migration has an actual legal primary save", False)
            return
        events = [e for e in new_events(payload, expected) if e["type"] == "save.migrated"]
        self.check(row, "one persisted migration, not a second boot reward", len(events) == 1)
        if len(events) != 1: return
        fact = events[0]["payload"]
        selected = self.sources[row.get("backup", row["source"])]["checksum"] if row.get("backup") else input_envelope["checksum"]
        self.check(row, "migration precise selected checksum/date and schema", fact.get("migration") == "resolved-report-recovery-001"
                   and fact.get("migrationVersion") == 1 and bool(fact.get("reason"))
                   and fact.get("selectedChecksum") == selected
                   and fact.get("selectedDate") == {k: expected[k] for k in ("day", "hour", "minute")}
                   and fact.get("rollback") is bool(row.get("rollback"))
                   and fact.get("sourceCategory") == ("backup" if row.get("backup") else "primary"), fact)
        original_valid = row.get("raw_kind") not in ("array","bad-json","bad-checksum","critical-structure")
        self.check(row, "migration original source provenance is exact or explicitly untrusted",
                   "originalChecksum" in fact and "originalDate" in fact
                   and fact["originalChecksum"] == (input_envelope["checksum"] if original_valid else None)
                   and fact["originalDate"] == ({key:row["payload"][key] for key in ("day","hour","minute")} if original_valid else None))
        if "migration_instance" in row:
            self.check(row, "migration uses only confirmed instance or null", fact.get("instanceId") == row["migration_instance"])

    def report_checks(self, page, row, observed, expected):
        dom = observed["dom"]
        self.check(row, "actual report visible in summary mode", dom["reportVisible"] and "summary-mode" in dom["overlayClass"])
        self.check(row, "report public clock preserves original minute", self.dom_minute(dom) == minute(expected))
        battle = expected["nightBattle"]
        if row.get("missing_stats"):
            self.check(row, "all missing statistics explicitly show unrecorded", all("未记录" in dom[key] for key in ("kills", "breaches", "damage", "walls", "npcDeaths")))
            self.check(row, "historical display has no NaN/undefined fabricated zero", "NaN" not in dom["feed"] and "undefined" not in dom["feed"])
        else:
            damage = battle.get("finalDamage")
            self.check(row, "existing kills/damage/breaches restored", dom["kills"].strip() == str(battle["kills"])
                       and dom["breaches"].strip() == str(battle["breaches"])
                       and dom["damage"].strip() == (f"-{damage}" if damage else "0"))
        if row["phase"] == "loss":
            self.check(row, "loss title and restart public CTA", "失守" in dom["title"] and "重新开始" in dom["cta"] and self.accessible(page, "#continueBtn"))
            self.check(row, "loss ordinary supply control disabled", not dom["buttons"]["eatBtn"]["enabled"])
        else:
            self.check(row, "normal report close publicly usable", "关闭报告" in dom["cta"] and self.accessible(page, "#continueBtn"))

    def dom_minute(self, dom):
        import re
        day, clock = re.search(r"第\s*(\d+)\s*天", dom["day"]), re.search(r"(\d{1,2}):(\d{2})", dom["time"])
        if not day or not clock: raise ValueError("public calendar unavailable")
        return (int(day[1])-1)*1440+int(clock[1])*60+int(clock[2])

    def freeze_checks(self, row, observed, expected, permit_migration=False):
        payload = self.primary(observed)
        self.check(row, "actual frozen primary save is legal", payload is not None)
        if payload is None: return
        self.check(row, "frozen calendar/roster/economy/plan/CP/garrison unchanged", minute(payload) == minute(expected) and protection(payload) == protection(expected))
        new = new_events(payload, expected)
        self.check(row, "no new success/need/economy fact while frozen", all(e["type"] == "save.migrated" for e in new) if permit_migration else not new, [e["type"] for e in new])
        self.check(row, "actual checkpoint writer replaced fixture reason", observed["envelope"].get("reason") in ("pagehide", "visibility-hidden", "visibility-visible"))
        def history(battle):
            return {key:value for key,value in (battle or {}).items() if key not in ("instanceId","id","startedEventId","startCommandId")}
        self.check(row, "report enemy/history arrays not mutated by display", history(payload.get("nightBattle")) == history(expected.get("nightBattle")))
        if row["phase"] == "loss": self.check(row, "loss persisted explicitly", payload.get("gameOver") == "lose" and payload["hp"] == 0)
        self.check(row, "no active world/battle interval in report/recovery", not active_intervals(observed["nativeObservation"]["events"]))

    def close(self, page, row, expected):
        if not self.accessible(page, "#continueBtn"):
            self.blocked(row, "visible normal report close")
            return None
        if row.get("duplicate_close"):
            # Two DOM clicks on the same existing, visible public control;
            # no handler/reducer invocation and no synthetic command identity.
            page.locator("#continueBtn").evaluate("e=>{e.click();e.click();}")
        else: page.locator("#continueBtn").click()
        closed = self.r.settle(page, lambda o: o["envelope"]["payload"].get("nightBattle") is None
                               and any(e["type"] == "threat.closed" and e.get("payload", {}).get("threatId") == self.sources["resolved"]["payload"]["nightBattle"]["instanceId"]
                                       for e in new_events(o["envelope"]["payload"], expected)))
        p = closed["envelope"]["payload"]
        threat_id = self.sources["resolved"]["payload"]["nightBattle"]["instanceId"]
        events = [e for e in new_events(p, expected) if e["type"] == "threat.closed" and e.get("payload", {}).get("threatId") == threat_id]
        command = [c for c in p["worldMeta"]["replay"]["commands"] if c["commandId"] == events[0]["commandId"]] if events else []
        self.check(row, "one exact close/replay at original report time", len(events) == 1 and events[0]["tick"]["world"] == minute(expected)
                   and events[0]["payload"] == {"threatId": threat_id, **{k: expected[k] for k in ("day", "hour", "minute")}}
                   and len(command) == 1 and command[0]["type"] == "threat.close" and command[0]["payload"]["threatId"] == threat_id)
        close_id = events[0]["commandId"] if len(events) == 1 else None
        compensation = [e for e in new_events(p, expected) if e["type"] == "sanity.changed"
                        and e.get("payload", {}).get("targetId") == "player-1"
                        and e.get("payload", {}).get("reason") == "尸潮结束后回到营地"]
        close_san = min(100, expected["sanity"] + 3)
        self.check(row, "first close has one exact SAN compensation receipt within cap",
                   len(compensation) == (1 if close_san != expected["sanity"] else 0)
                   and all(e["causationId"] == close_id and e["tick"]["world"] == minute(expected)
                           and e["payload"]["before"] == expected["sanity"] and e["payload"]["after"] == close_san
                           and e["payload"]["delta"] == close_san - expected["sanity"] for e in compensation))
        # Closing restarts the real DAY clock. The precise close receipt is
        # immutable; a later screenshot/checkpoint can include natural day4
        # ration/upkeep/SAN drift, so do not mislabel that as duplicate close.
        if minute(p) == minute(expected):
            self.check(row, "same-minute close has expected SAN and keeps supply/CP/plan/ration/upkeep",
                       p["sanity"] == close_san
                       and all(p[k] == expected[k] for k in ("hp", "wood", "stone", "food", "seeds", "parts", "medicine", "contentState"))
                       and all(p["world"].get(k) == expected["world"].get(k) for k in ("lastRationDay", "lastDailyUpkeepDay")))
        else:
            advanced = [e for e in new_events(p, expected) if e["type"] == "time.advanced" and events
                        and e["seq"] > events[0]["seq"] and e["tick"]["world"] > minute(expected)]
            self.check(row, "later DAY observation has actual post-close clock receipts", minute(p) > minute(expected) and bool(advanced))
            self.r.result["cases"][row["key"]]["closeObservationLimit"] = "natural-DAY-time-advanced; exact compensation proven by close-linked receipt, no permanent resource/SAN equality claim"
        self.snapshot(page, row, "after-public-close")
        self.r.result["cases"][row["key"]]["publicCloseExecuted"] = True
        return copy.deepcopy(p)

    def restart(self, page, row, selector, queued=None):
        if not self.accessible(page, selector):
            self.blocked(row, "visible public restart " + selector)
            return False
        # The last actual observation is recorded before action, not invented
        # after navigation. Queued B15 must restart before its real 650ms due.
        if queued:
            current = self.trace(page)["events"]
            pending = pending_checkpoints(current)
            matching = [e for e in pending if e["generation"] == queued["generation"] and e["id"] == queued["id"]]
            elapsed = page.evaluate("at=>Date.now()-at", queued["at"])
            self.check(row, "real checkpoint pending before restart within650ms", len(matching) == 1 and elapsed < 650, {"elapsedMs": elapsed, "schedule": queued}, fatal=True)
        with page.expect_navigation(wait_until="domcontentloaded", timeout=self.r.timeout(10)) as navigation:
            if row.get("duplicate_restart"): page.locator(selector).evaluate("e=>{e.click();e.click();}")
            else: page.locator(selector).click()
        self.r.source(navigation.value, row["key"])
        after = self.snapshot(page, row, "after-public-restart")
        if queued:
            trace=after["nativeObservation"]["events"]
            intents=[e for e in trace if e["type"]=="restart-intent" and e["generation"]==queued["generation"] and e["selector"]==selector and e["at"]>=queued["at"]]
            intent=min(intents,key=lambda e:e["at"]) if intents else None
            race=bool(intent and intent["trusted"] and intent["at"]-queued["at"]<650 and not any(
                e["type"]=="fired" and e["generation"]==queued["generation"] and e.get("id")==queued["id"] and e["at"]<=intent["at"] for e in trace))
            self.check(row,"actual trusted public restart event beat queued save deadline",race,{"intent":intent,"queued":queued})
            self.r.result["cases"][row["key"]]["actual650msRaceIntentProven"]=race
        self.check(row, "all old known storage keys absent immediately", not any(after["keysPresent"].values()))
        page.wait_for_timeout(2800)
        after = self.snapshot(page, row, "after650ms-and-two-ticks")
        self.check(row, "old storage remains absent after queue/tick deadline", not any(after["keysPresent"].values()))
        for repeat in (1, 2):
            self.r.reload(page, row["key"])
            fresh = self.snapshot(page, row, "restart-reload-" + str(repeat))
            self.check(row, "no old key after actual restart reload " + str(repeat), not any(fresh["keysPresent"].values()))
        if not self.accessible(page, "#continueSaveBtn"):
            self.blocked(row, "fresh public new-game start")
            return False
        page.locator("#continueSaveBtn").click()
        fresh = self.r.settle(page, lambda o: o["envelope"]["payload"]["hp"] == 100 and o["envelope"]["payload"]["day"] == 1)
        p = fresh["envelope"]["payload"]
        self.check(row, "new session fixed population and no previous encounter", len({n["id"] for n in p["npcs"]}) == 10 and p.get("nightBattle") is None
                   and not any(e["type"] in ("threat.started", "threat.resolved", "threat.closed") for e in p["worldMeta"]["events"]))
        self.snapshot(page, row, "fresh-public-new-game")
        self.r.result["cases"][row["key"]]["publicResetExecuted"] = True
        return True

    def loss_race(self, page, row):
        self.snapshot(page, row, "public-low-hp-day")
        if not self.accessible(page, "#endDayBtn"):
            self.blocked(row, "real public encounter from low HP DAY")
            return
        page.locator("#endDayBtn").click()
        page.wait_for_function("()=>document.body.classList.contains('threat-map-active')", timeout=self.r.timeout(10))
        # No attacks or hidden state; allow the actual exposed camp to lose.
        page.wait_for_function("()=>document.getElementById('nightOverlay')?.classList.contains('summary-mode')&&document.getElementById('nightTitle')?.textContent.includes('失守')", timeout=self.r.timeout(100), polling=20)
        actual = self.trace(page)
        pending = pending_checkpoints(actual["events"])
        self.check(row, "actual battle loss has a native queued checkpoint", bool(pending), {"pending": pending}, fatal=True)
        queued = max(pending, key=lambda e:e["at"])
        # Small JSON read, then public click. A pre-click screenshot could itself
        # miss the 650ms race; actual post-action screens are captured above.
        evidence = page.evaluate("()=>({at:Date.now(),title:document.getElementById('nightTitle').textContent,cta:document.getElementById('continueBtn').textContent,overlay:document.getElementById('nightOverlay').className,hp:document.getElementById('hpLabel')?.textContent||document.getElementById('hpValue')?.textContent||null})")
        write(self.r.directory / (row["key"] + "-actual-loss-before-restart.json"), {"publicDOM": evidence, "nativeTimerObservation": actual, "fixtureMode": True, "battleResolvedByPublicPlay": True, "legalResolvedEnvelopeNotYetWritten": True})
        self.r.result["cases"][row["key"]]["realPublicLossEvidence"] = {"file":row["key"]+"-actual-loss-before-restart.json", "pendingCheckpoint":queued}
        self.restart(page, row, "#continueBtn", queued=queued)

    def production18(self,page,row,expected,envelope):
        if not self.accessible(page,"#continueSaveBtn"):
            self.blocked(row,"actual production18 public continue")
            return
        page.locator("#continueSaveBtn").click()
        immediate=self.r.settle(page,lambda o:o["envelope"]["payload"].get("version")==21 and any(e["type"]=="save.migrated" for e in o["envelope"]["payload"]["worldMeta"]["events"]))
        filename=row["key"]+"-immediate-primary-readback.json"
        write(self.r.directory/filename,immediate)
        self.r.result["cases"][row["key"]]["immediateReadbackFile"]=filename
        migrated=self.snapshot(page,row,"production18-immediate-readback")
        p=self.primary(immediate)
        # Optional identity adaptation must not be mistaken for copied battle
        # rewards. Compare report history separately from its legacy ID fields.
        def history(value):return {k:v for k,v in (value or {}).items() if k not in ("instanceId","id","startedEventId","startCommandId")}
        self.check(row,"production18 complete original persistent domains preserved",original_persistent_fields_preserved(p,expected,initial_clock_correction=row["legacy_kind"]=="initial"))
        meta_fields=[k for k in expected["worldMeta"] if k not in ("events","eventSeq","lastCheckpointReason","lastEventId","feedback","projections","activeCommandId")]
        self.check(row,"production18 seed/RNG/clock/replay/seen commands preserved",p is not None and all(p["worldMeta"].get(k)==expected["worldMeta"][k] for k in meta_fields))
        self.check(row,"production18 keeps exact resident IDs and all old resident fields",p is not None
                   and [n["id"] for n in p["npcs"]]==[n["id"] for n in expected["npcs"]]
                   and all(all(n.get(k)==v for k,v in old.items()) for old,n in zip(expected["npcs"],p["npcs"])))
        self.check(row,"production18 report history not re-simulated",p is not None and history(p.get("nightBattle"))==history(expected.get("nightBattle")))
        original_events=expected["worldMeta"]["events"]
        facts=[e for e in p["worldMeta"]["events"] if e["seq"]>expected["worldMeta"]["eventSeq"]] if p else []
        migration=[e for e in facts if e["type"]=="save.migrated"]
        self.check(row,"production18 one actual migration and old ledger preserved",p is not None and len(migration)==1
                   and all(e in p["worldMeta"]["events"] for e in original_events))
        if len(migration)==1:
            f=migration[0]["payload"]
            self.check(row,"production18 migration exact adapter/source/checksum/date",f.get("migration")=="resolved-report-recovery-001" and f.get("migrationVersion")==1
                       and f.get("adapter")=="save18-pre-content-to-save21" and f.get("fromSaveVersion")==18 and f.get("fromContentVersion")==0
                       and f.get("sourceCategory")=="primary" and f.get("originalChecksum")==envelope["checksum"] and f.get("selectedChecksum")==envelope["checksum"]
                       and f.get("originalDate")=={k:expected[k] for k in ("day","hour","minute")} and f.get("selectedDate")=={k:expected[k] for k in ("day","hour","minute")} and f.get("rollback") is False,f)
            if row["legacy_kind"]=="initial":
                self.check(row,"production18 exact initial sentinel corrected without date advancement",
                           "save18-initial-clock-sentinel" in f.get("reason","") and f.get("worldClockCorrection")=={"before":0,"after":360,"calendarUnchanged":True,"writer":"SAVE18-initial-sentinel"}
                           and p["world"]["totalMinutes"]==360 and minute(p)==360 and all(e["type"]=="save.migrated" for e in facts))
        def defaults(payload):
            c=payload["contentState"];plan=c["planMeeting"]
            return (c["contentVersion"]==3 and c["commandPoints"]==0 and c["commandPointsMax"]==0 and c["commandPointsGrantedDay"]==payload["day"]
                and plan["status"]=="idle" and not plan["candidates"] and not plan["history"] and not c["npcRoster"]["promotionHistory"])
        self.check(row,"production18 new content defaults have no retroactive plan/CP/promotion",p is not None and defaults(p))
        initial_heroes={"commander","radio","doctor"}
        self.check(row,"production18 static L0 initial heroes and ordinary locked defaults",p is not None and all(
            n.get("hero",{}).get("tier")==("hero" if n["id"] in initial_heroes else "ordinary")
            and n.get("hero",{}).get("status")==("promoted" if n["id"] in initial_heroes else "locked")
            and (n["id"] in initial_heroes or (n["hero"].get("activeSkill") is None and n["hero"].get("passiveSkill") is None))
            and isinstance(n.get("attributes"),dict) and bool(n["attributes"]) and n.get("garrisonedOutpostId") is None for n in p["npcs"]))
        if row["legacy_kind"]=="resolved":
            view={**row,"phase":"report"}
            self.report_checks(page,view,migrated,expected)
            page.wait_for_timeout(2800)
            waiting=self.snapshot(page,row,"production18-report-two-ticks")
            self.check(row,"production18 pending report remains same date with no live timer",self.dom_minute(waiting["dom"])==minute(expected)
                       and not active_intervals(waiting["nativeObservation"]["events"]))
        else:
            self.check(row,"production18 DAY/closed returns ordinary visible session",not migrated["dom"]["reportVisible"] and not migrated["dom"]["startVisible"])
        for repeat in (1,2):
            self.r.reload(page,row["key"])
            obs=self.snapshot(page,row,"production18-reload-"+str(repeat),allow_invalid=True);current=self.primary(obs)
            self.check(row,"production18 persisted once, no repeated migration "+str(repeat),current is not None
                       and len([e for e in new_events(current,expected) if e["type"]=="save.migrated"])==1 and defaults(current))
            self.check(row,"production18 no replayed resolved/closed/plan "+str(repeat),current is not None
                       and not any(e["type"] in ("threat.started","threat.resolved","threat.closed","plan.meeting.created","plan.meeting.resolved","npc.promoted") for e in new_events(current,expected)))
            if self.accessible(page,"#continueSaveBtn"):page.locator("#continueSaveBtn").click()
            else:self.blocked(row,"production18 continued after reload");break
            self.snapshot(page,row,"production18-reload-started-"+str(repeat),allow_invalid=True)

    def execute(self, row):
        key = row["key"]
        case = {"group":row["group"],"phaseContract":row["phase"],"status":"running","fixtureMode":True,"source":self.source_meta[row["source"]],
                "mutations":row["mutations"],"expectedDefect":self.r.args.expect_html_sha256=="8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0" and row["phase"]!="day",
                "nativeTimerObservation":True,"isNaturalPlaythrough":False}
        self.r.result["cases"][key] = case
        start = len(self.r.result["actualChecks"])
        envelope = self.builder.evaluate(JS_ENVELOPE, row["payload"])
        raw = self.builder.evaluate("e=>JSON.stringify(e)", envelope)
        if row.get("raw_kind") == "array": raw = self.builder.evaluate("e=>JSON.stringify([e])", envelope)
        elif row.get("raw_kind") == "bad-json": raw = "{qa-invalid-JSON"
        elif row.get("raw_kind") == "bad-checksum":
            envelope = copy.deepcopy(envelope);envelope["checksum"] = "qa-invalid-checksum";raw = self.builder.evaluate("e=>JSON.stringify(e)", envelope)
        storage = {SAVE_KEY:raw}
        if row.get("backup"): storage[SAVE_KEY+".bak"] = self.builder.evaluate("e=>JSON.stringify(e)", self.sources[row["backup"]])
        elif row.get("backup_raw"): storage[SAVE_KEY+".bak"] = row["backup_raw"]
        if row.get("restart") or row["phase"] == "real-loss-race":
            # Seed known legacy/corrupt keys explicitly, solely to test removal.
            for k in self.r.known_save_keys:
                if k not in (SAVE_KEY, SAVE_KEY+".bak"): storage[k]=raw
        write(self.r.directory / (key+"-input.json"), {"fixtureMode":True,"storage":storage,"source":case["source"],"mutations":row["mutations"],
              "primaryHasConstructedFNV":row.get("raw_kind") not in ("array","bad-json","bad-checksum"),
              "unsafeRecoveryFixture":row["phase"] in ("recovery","recover-backup")})
        context = self.browser.new_context(viewport={"width":1440,"height":900})
        page = self.r.page(context,key)
        marker = "report-contract-"+uuid.uuid4().hex
        origin = urlsplit(self.r.args.url).scheme+"://"+urlsplit(self.r.args.url).netloc
        bootstrap = {"marker":marker,"origin":origin,"storage":storage}
        page.add_init_script("(()=>{const f="+json.dumps(bootstrap,ensure_ascii=True)+";if(window!==top||location.origin!==f.origin||window.name===f.marker)return;for(const [k,v]of Object.entries(f.storage))localStorage.setItem(k,v);window.name=f.marker;})();")
        page.add_init_script(TIMER_OBSERVER)
        expected = copy.deepcopy(self.sources[row["backup"]]["payload"] if row.get("backup") else row["payload"])
        phase = row["phase"]
        try:
            self.r.source(page.goto(self.r.args.url,wait_until="domcontentloaded",timeout=self.r.timeout()),key)
            boot = self.snapshot(page,row,"boot-before-start",allow_invalid=True)
            self.check(row,"fixture seeded exactly once before loader",page.evaluate("m=>window.name===m",marker),fatal=True)
            if phase=="production18":
                self.production18(page,row,expected,envelope)
                return
            if phase in ("recovery","recover-backup"):
                self.check(row,"recovery stays on visible public start overlay",boot["dom"]["startVisible"] and bool(boot["dom"]["recoveryStatus"]))
                self.check(row,"unsafe primary cannot start simulation",not boot["dom"]["buttons"]["continueSaveBtn"]["enabled"])
                if phase == "recover-backup":
                    backup_text = boot["dom"]["buttons"]["restoreBackupBtn"]["text"]
                    self.check(row,"safe backup choice gives its complete actual date", self.accessible(page,"#restoreBackupBtn")
                               and ("第"+str(expected["day"])+"天") in "".join(backup_text.split())
                               and (str(expected["hour"]).zfill(2)+":"+str(expected["minute"]).zfill(2)) in backup_text, backup_text)
                    if not self.accessible(page,"#restoreBackupBtn"):
                        self.blocked(row,"explicit safe backup choice")
                        return
                    page.locator("#restoreBackupBtn").click()
                    immediate = self.r.settle(page,lambda o:o["envelope"]["checksum"] != envelope["checksum"] and any(e["type"]=="save.migrated" for e in new_events(o["envelope"]["payload"],expected)))
                    filename=key+"-immediate-backup-primary-readback.json"
                    write(self.r.directory/filename,immediate)
                    self.r.result["cases"][key]["immediateReadbackFile"]=filename
                    recovered = self.snapshot(page,row,"after-explicit-safe-backup")
                    self.check(row,"selected original backup not overwritten by bad main",recovered["rawStorage"].get(SAVE_KEY+".bak")==storage[SAVE_KEY+".bak"])
                    restored_payload = self.primary(immediate)
                    self.check(row,"whole selected checkpoint installed without main-field mixing",restored_payload is not None
                               and protection(restored_payload)==protection(expected) and original_persistent_fields_preserved(restored_payload,expected)
                               and minute(restored_payload)==minute(expected))
                    self.migration(row,immediate,expected,envelope)
                    phase = "report" if expected.get("nightBattle") else "day"
                    boot = recovered
                else:
                    page.wait_for_timeout(2800)
                    waiting = self.snapshot(page,row,"recovery-two-ticks",allow_invalid=True)
                    self.check(row,"recovery has no simulation interval",not active_intervals(waiting["nativeObservation"]["events"]))
                    self.check(row,"unsafe original storage preserved without success save",waiting["rawStorage"].get(SAVE_KEY)==storage[SAVE_KEY])
                    for repeat in (1,2):
                        self.r.reload(page,key)
                        obs=self.snapshot(page,row,"blocked-reload-"+str(repeat),allow_invalid=True)
                        self.check(row,"unsafe remains explicitly blocked on reload "+str(repeat),obs["dom"]["startVisible"] and not obs["dom"]["buttons"]["continueSaveBtn"]["enabled"] and not active_intervals(obs["nativeObservation"]["events"]))
                    if row.get("restart_after_reloads"):
                        self.restart(page,row,"#resetSaveBtn")
                    else:
                        self.check(row,"recovery offers accessible public reset",self.accessible(page,"#resetSaveBtn"))
                    return
            if self.accessible(page,"#continueSaveBtn"):
                if row.get("duplicate_start"):page.locator("#continueSaveBtn").evaluate("e=>{e.click();e.click();}")
                else:page.locator("#continueSaveBtn").click()
            elif phase != "recover-backup" and boot["dom"]["startVisible"]:
                self.blocked(row,"public continue/start")
                return
            started=self.snapshot(page,row,"after-public-start",allow_invalid=True)
            if phase=="real-loss-race":
                self.loss_race(page,row)
                return
            if phase in ("report","loss"):
                self.report_checks(page,row,started,expected)
                for keypress in ("g","r","n","f","c","w","e"):
                    page.keyboard.press(keypress)
                page.wait_for_timeout(2800)
                waiting=self.snapshot(page,row,"two-ticks-and-public-guard-attempts",allow_invalid=True)
                self.report_checks(page,row,waiting,expected)
                self.check(row,"no simulation timer allocated while reading report",not active_intervals(waiting["nativeObservation"]["events"]))
                if row.get("visibility"):
                    before_visibility = len(self.trace(page)["events"])
                    page.keyboard.down("w");page.keyboard.down("e");page.wait_for_timeout(450)
                    other=context.new_page();other.goto("about:blank");other.bring_to_front()
                    page.wait_for_timeout(2800);page.bring_to_front();other.close()
                    page.keyboard.up("w");page.keyboard.up("e")
                    self.snapshot(page,row,"after-real-tab-hide-return",allow_invalid=True)
                    observed_visibility=[e for e in self.trace(page)["events"][before_visibility:] if e["type"]=="visibility"]
                    self.check(row,"actual document hidden and visible lifecycle observed",any(e["state"]=="hidden" for e in observed_visibility) and any(e["state"]=="visible" for e in observed_visibility),observed_visibility)
                if row.get("pure_read") or row.get("complex_invariants") or row.get("missing_stats"):
                    before=self.trace(page)["randomCalls"]
                    # Report input policy deliberately freezes terminal access.
                    # Read only the actual rendered report/public SAVE_KEY;
                    # internal plan/CP renderer purity is a source-check scope.
                    self.snapshot(page,row,"read-existing-public-report-fields",allow_invalid=True)
                    self.check(row,"observing report fields consumes no observed Math.random",self.trace(page)["randomCalls"]==before)
                    self.r.result["cases"][key]["pureReadCoverage"]={"browser":"existing public report DOM and read-only primary save",
                        "sourceOnly":"internal report/CP/plan projector state, arrays and seeded RNG; terminal stays gated during report"}
                # Real lifecycle checkpoint now provides a legal post-boot
                # state, rather than treating still-seeded storage as output.
                written=self.flush(page,row,"first-real-lifecycle-save")
                self.freeze_checks(row,written,expected,permit_migration=bool(row.get("migration")))
                if row.get("migration"):self.migration(row,written,expected,envelope)
                if self.accessible(page,"#continueSaveBtn"):page.locator("#continueSaveBtn").click()
                self.snapshot(page,row,"resume-after-first-lifecycle",allow_invalid=True)
                if row.get("restart"):
                    self.restart(page,row,"#"+row.get("restart_button","continueBtn"))
                    return
                closed=None
                if row.get("close"):closed=self.close(page,row,expected)
            else:
                self.check(row,"no report after DAY/alreadyclosed/legacy boot",not started["dom"]["reportVisible"])
                page.wait_for_timeout(2800)
                if phase=="day":self.check(row,"normal DAY clock advances",self.dom_minute(self.snapshot(page,row,"day-two-ticks")["dom"])>minute(expected))
                written=self.flush(page,row,"first-real-lifecycle-save")
                p=self.primary(written)
                if phase in ("closed-day","legacy-day"):
                    self.check(row,"cleanup/degrade retains all protected original consequences",p is not None and protection(p)==protection(expected) and minute(p)==minute(expected) and p.get("nightBattle") is None)
                    self.check(row,"cleanup/degrade produces no new close or rewards",p is not None and all(e["type"]=="save.migrated" for e in new_events(p,expected)))
                    if phase=="closed-day":
                        self.check(row,"existing real close never duplicated",p is not None and len([e for e in p["worldMeta"]["events"] if e["type"]=="threat.closed" and e["commandId"]==row["expected_close"]["commandId"]])==1)
                        self.migration(row,written,expected,envelope)
                    else:
                        self.check(row,"legacy downgrade notice is explicit",bool(written["dom"]["recoveryNotice"]))
                        self.migration(row,written,expected,envelope)
                if self.accessible(page,"#continueSaveBtn"):page.locator("#continueSaveBtn").click()
                closed=copy.deepcopy(p) if p else None
            for repeat in (1,2):
                self.r.reload(page,key)
                written=self.snapshot(page,row,"actual-reload-"+str(repeat),allow_invalid=True)
                p=self.primary(written)
                self.check(row,"actual legal lifecycle primary on reload "+str(repeat),p is not None and written["envelope"].get("reason") in ("pagehide","visibility-hidden","visibility-visible","save-migrated","report-recovery-migrated"))
                if phase in ("report","loss") and closed is None:
                    self.freeze_checks(row,written,expected,permit_migration=bool(row.get("migration")))
                if row.get("migration"):self.migration(row,written,expected,envelope,first=False)
                if closed is not None:
                    self.check(row,"same closed facts without repeated boot compensation "+str(repeat),p is not None
                               and [e for e in p["worldMeta"]["events"] if e["type"]=="threat.closed"]==[e for e in closed["worldMeta"]["events"] if e["type"]=="threat.closed"]
                               and not any(e["type"]=="sanity.changed" and e.get("payload",{}).get("reason")=="尸潮结束后回到营地" for e in new_events(p,closed)))
                    if p is not None and minute(p)==minute(closed):
                        self.check(row,"same-minute reload keeps exact SAN "+str(repeat),p["sanity"]==closed["sanity"])
                    elif p is not None:
                        self.check(row,"natural DAY time since close is backed by actual clock events "+str(repeat),minute(p)>minute(closed)
                                   and any(e["type"]=="time.advanced" for e in new_events(p,closed)))
                if not self.accessible(page,"#continueSaveBtn"):
                    self.blocked(row,"public start after actual reload")
                    break
                page.locator("#continueSaveBtn").click()
                started=self.snapshot(page,row,"actual-reload-started-"+str(repeat),allow_invalid=True)
                if phase in ("report","loss") and closed is None:self.report_checks(page,row,started,expected)
                else:self.check(row,"day restored without stale report "+str(repeat),not started["dom"]["reportVisible"])
                intervals=active_intervals(started["nativeObservation"]["events"])
                self.check(row,"at most one appropriate simulation timer "+str(repeat),len(intervals)<=1 and not any(e["delay"]==620 for e in intervals))
        except Exception as error:
            case["exception"]={"type":type(error).__name__,"message":str(error)}
            self.r.result["errors"].append("exception:"+key+":"+type(error).__name__+":"+str(error))
            try:self.snapshot(page,row,"failure",allow_invalid=True)
            except Exception as capture_error:case["failureCaptureError"]=type(capture_error).__name__
        finally:
            checks=self.r.result["actualChecks"][start:]
            case["actualCheckCount"]=len(checks)
            case["status"]="passed" if checks and all(c["ok"] for c in checks) and "exception" not in case else "failed"
            context.close()
            self.r.persist()

    def run(self):
        self.load_sources()
        rows=cases(self.sources["day"],self.sources["resolved"],self.sources["closed"])
        legacy_rows=self.load_legacy();rows.extend(legacy_rows)
        self.r.result.update(mode="explicit-B1-B16-boot-contracts",sourceEnvelopes=self.source_meta,
                             plannedCases=["CURRENT-public-first-start-reload"]+[r["key"] for r in rows],notYetImplemented=[],
                             fullMatrixPrepared=True,
                             contractGroups=["current-writer","DAY"]+["B"+str(i) for i in range(1,17)],
                             instrumentation={"nativeTimerObserver":True,"MathRandomObserver":True,"delegatesNativeAPIs":True,"gameFunctionsCalled":False})
        self.r.result["production18compat"]={"requiredForRelease":True,"provided":bool(legacy_rows),"status":"pending-browser" if legacy_rows else "not-provided",
            "writerHTMLSHA256":self.r.args.legacy_html_sha256,"cases":[r["key"] for r in legacy_rows]}
        if legacy_rows:self.r.result["contractGroups"].append("production18compat")
        self.r.persist()
        self.current_initial()
        for row in rows:self.execute(row)
        groups={group:[r["key"] for r in rows if r["group"]==group] for group in self.r.result["contractGroups"]}
        groups["current-writer"]=["CURRENT-public-first-start-reload"]
        self.r.result["coverage"]={group:{"cases":keys,"allActuallyAttempted":all(k in self.r.result["cases"] for k in keys),
            "allActualCasesPassed":all(self.r.result["cases"].get(k,{}).get("status")=="passed" for k in keys)} for group,keys in groups.items()}
        self.r.result["sourceOnlyRequirements"]=["pure renderer internal array/RNG projection verified separately by extracted source checker",
            "storage removal failure/stale generation callbacks require source controls; not inferred from this browser suite",
            "normal threat.close CommandBus terminal Gate is source-checked because public loss CTA routes session.restart"]
        self.r.result["production18compat"]["status"]="passed" if legacy_rows and all(self.r.result["cases"].get(r["key"],{}).get("status")=="passed" for r in legacy_rows) else "failed" if legacy_rows else "not-provided"
        self.r.result["releaseCoverageComplete"]=bool(legacy_rows) and all(v["allActualCasesPassed"] for v in self.r.result["coverage"].values())
        self.r.persist()
