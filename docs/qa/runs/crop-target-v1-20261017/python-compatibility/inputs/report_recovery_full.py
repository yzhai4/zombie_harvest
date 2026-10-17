"""B1-B16 browser driver. No game-state mutation after before-loader seed.

Timer observation delegates native APIs unchanged; the observed 650ms queue
is required for B15, rather than inferred from a synthetic resolved fixture.
Invalid/empty storage is retained as raw evidence, never a fabricated save.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import signal
import subprocess
import tempfile
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
 document.addEventListener('visibilitychange',event=>record({type:'visibility',state:document.visibilityState,trusted:event.isTrusted}));
 document.addEventListener('click',event=>{const button=event.target?.closest?.('#continueBtn,#restartSessionBtn,#resetSaveBtn');
   if(button&&(button.id==='restartSessionBtn'||button.id==='resetSaveBtn'||button.textContent.includes('重新开始')))
     record({type:'restart-intent',selector:'#'+button.id,trusted:event.isTrusted,disabled:button.disabled,text:button.textContent});},true);
})();"""


def visibility_evidence(events):
    """Actual native events only; input calls and synthetic events are not proof."""
    for index,hidden in enumerate(events):
        if hidden.get("type")!="visibility" or hidden.get("state")!="hidden" or hidden.get("trusted") is not True:continue
        for visible in events[index+1:]:
            if (visible.get("type")=="visibility" and visible.get("state")=="visible" and visible.get("trusted") is True
                and visible.get("generation")==hidden.get("generation") and visible.get("at",-1)>=hidden.get("at",0)):
                return {"ok":True,"hidden":hidden,"visible":visible,"observedHiddenDurationMs":visible["at"]-hidden["at"]}
    return {"ok":False,"events":events}


def native_port_endpoint(text):
    lines=text.splitlines()
    if len(lines)!=2 or not lines[0].isdigit() or not 1<=int(lines[0])<=65535 or not lines[1].startswith("/devtools/browser/"):
        raise ValueError("owned Chrome DevToolsActivePort invalid")
    return "http://127.0.0.1:"+lines[0]


def owned_group_exists(pid):
    try:os.killpg(pid,0)
    except ProcessLookupError:return False
    return True


class NativeVisibilitySession:
    """One owned Chrome and its existing default context, never new_context.

    The profile is a temporary sibling outside the artifact run. no_defaults
    avoids Playwright focus/media emulation; no visibility CDP command is sent.
    """
    def __init__(self,runner,chromium,process_factory=subprocess.Popen,group_signaler=None,group_checker=None):
        self.r,self.chromium,self.process_factory=runner,chromium,process_factory
        self.group_signaler=group_signaler if group_signaler is not None else (os.killpg if os.name=="posix" else None)
        self.group_checker=group_checker if group_checker is not None else (owned_group_exists if os.name=="posix" else None)
        self.private_parent=runner.args.out.resolve().parent;self.artifact_root=runner.directory.resolve()
        self.temporary=self.profile=self.process=self.browser=self.context=self.initial_page=None
        self.cleanup_info={"owned":True,"profileOutsideRun":True,"profileRetained":False,"profileReused":False}
        self.closed=False;self.cleanup_errors=[]

    def open(self):
        try:
            if not self.r.args.headed or not os.environ.get("DISPLAY") or self.chromium is None:
                raise ValueError("native visibility requires headed Chrome, DISPLAY and Chromium connector")
            self.private_parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            self.profile=Path(tempfile.mkdtemp(prefix=".zfarm-native-visibility-",dir=self.private_parent)).resolve()
            self.temporary=True  # No destructor/finalizer can remove a live profile.
            if not self.profile.is_relative_to(self.private_parent) or self.profile.is_relative_to(self.artifact_root) or not self.profile.name.startswith(".zfarm-native-visibility-"):
                raise ValueError("native profile escaped private QA parent or entered run artifacts")
            command=[self.r.args.chrome,"--no-sandbox","--disable-dev-shm-usage","--no-first-run","--no-default-browser-check",
                "--remote-debugging-port=0","--remote-debugging-address=127.0.0.1","--user-data-dir="+str(self.profile),"--window-size=1440,1050","about:blank"]
            self.process=self.process_factory(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            port_file=self.profile/"DevToolsActivePort";deadline=time.monotonic()+self.r.timeout(10)/1000
            while not port_file.is_file():
                if self.process.poll() is not None:raise RuntimeError("owned Chrome exited before readiness")
                if time.monotonic()>=deadline:raise TimeoutError("owned Chrome native visibility readiness timeout")
                time.sleep(.05)
            endpoint=native_port_endpoint(port_file.read_text(encoding="utf-8"))
            self.browser=self.chromium.connect_over_cdp(endpoint,no_defaults=True,timeout=self.r.timeout(10))
            if len(self.browser.contexts)!=1:raise RuntimeError("owned native Chrome did not expose one existing default context")
            self.context=self.browser.contexts[0]
            if len(self.context.pages)!=1 or self.context.pages[0].url!="about:blank":raise RuntimeError("owned native Chrome is not a fresh blank default context")
            self.initial_page=self.context.pages[0]
            return self.context
        except Exception:
            self.close()
            raise

    def close(self):
        if self.closed:return self.cleanup_errors
        self.closed=True
        if self.browser is not None:
            self.cleanup_info["browserCloseAttempted"]=True
            try:self.browser.close()
            except Exception as error:self.cleanup_errors.append("CDP browser close:"+type(error).__name__)
        if self.process is not None:
            # start_new_session gives only this owned Chrome its process group.
            if self.group_signaler is not None:
                try:self.group_signaler(self.process.pid,signal.SIGTERM)
                except ProcessLookupError:pass
                except Exception as error:self.cleanup_errors.append("owned group terminate:"+type(error).__name__)
            if self.process.poll() is None:
                try:self.process.terminate()
                except ProcessLookupError:pass
                except Exception as error:self.cleanup_errors.append("owned Chrome terminate:"+type(error).__name__)
            try:self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.cleanup_info["forceKillUsed"]=True
                if self.group_signaler is not None:
                    try:self.group_signaler(self.process.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                    except Exception as error:self.cleanup_errors.append("owned group kill:"+type(error).__name__)
                try:self.process.kill()
                except ProcessLookupError:pass
                except Exception as error:self.cleanup_errors.append("owned Chrome kill:"+type(error).__name__)
                try:self.process.wait(timeout=5)
                except Exception as error:self.cleanup_errors.append("owned Chrome stop:"+type(error).__name__)
            except Exception as error:self.cleanup_errors.append("owned Chrome wait:"+type(error).__name__)
            self.cleanup_info["ownedProcessStopped"]=self.process.poll() is not None
            group_stopped=True
            if self.group_checker is not None:
                try:
                    if self.group_checker(self.process.pid):
                        self.cleanup_info["ownedGroupKillUsed"]=True
                        try:self.group_signaler(self.process.pid,signal.SIGKILL)
                        except ProcessLookupError:pass
                        group_deadline=time.monotonic()+2
                        while self.group_checker(self.process.pid) and time.monotonic()<group_deadline:time.sleep(.05)
                        group_stopped=not self.group_checker(self.process.pid)
                except Exception as error:
                    group_stopped=False;self.cleanup_errors.append("owned process-group check:"+type(error).__name__)
            self.cleanup_info["ownedProcessGroupStopped"]=group_stopped
            if not group_stopped:self.cleanup_errors.append("owned process group still alive")
        else:self.cleanup_info["ownedProcessStopped"]=True
        if self.process is None:self.cleanup_info["ownedProcessGroupStopped"]=True
        if self.temporary is not None:
            safe=(self.profile is not None and self.profile.is_relative_to(self.private_parent)
                and not self.profile.is_relative_to(self.artifact_root) and self.profile.name.startswith(".zfarm-native-visibility-"))
            if safe and self.cleanup_info["ownedProcessStopped"] and self.cleanup_info["ownedProcessGroupStopped"]:
                try:shutil.rmtree(self.profile)
                except Exception as error:self.cleanup_errors.append("owned profile removal:"+type(error).__name__)
            else:self.cleanup_errors.append("owned profile cleanup boundary or process still alive")
            self.cleanup_info["profileRemoved"]=not self.profile.exists()
            self.cleanup_info["profileRetained"]=self.profile.exists()
        else:self.cleanup_info["profileRemoved"]=True
        self.cleanup_info["ok"]=not self.cleanup_errors and self.cleanup_info["ownedProcessStopped"] and self.cleanup_info["profileRemoved"]
        return self.cleanup_errors


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
    actual_events=payload["worldMeta"].get("events",[]);watermark=expected["worldMeta"]["eventSeq"]
    appended=[e for e in actual_events if e["seq"]>watermark]
    if len(appended)>1 or any(e["type"]!="save.migrated" or e["seq"]!=watermark+1 for e in appended): return False
    if payload["worldMeta"]["eventSeq"]!=watermark+len(appended):return False
    # The actual progress writer serializes the latest 300 ledger entries.
    # Only that exact prefix rollover plus a unique migration is admissible;
    # a missing middle/tail event, edited event or extra success fact rejects.
    return actual_events==(expected["worldMeta"]["events"]+appended)[-300:]


def new_events(payload, prior):
    return [e for e in payload["worldMeta"]["events"] if e["seq"] > prior["worldMeta"]["eventSeq"]]


def continuous_events(payload, prior):
    """Evidence projection: accept only the complete actual saved event window."""
    events = new_events(payload, prior)
    return events if ([e["seq"] for e in events] == list(range(prior["worldMeta"]["eventSeq"] + 1,
                                                             payload["worldMeta"]["eventSeq"] + 1))
        and payload["worldMeta"]["events"] == (prior["worldMeta"]["events"] + events)[-300:]) else None


def accounted_food(events, before):
    """Recorded NPC meals are the only allowed competing food change here."""
    # Frozen-source nonfood events reachable from the clock/NPC/relay loops.
    # Unknown types fail closed, including landmark.discovered and all content
    # effect/history events: a blacklist cannot prove a +3 crop yield.
    nonfood = {"time.advanced","sanity.changed","sanity.thresholdCrossed","npc.work.completed","npc.work.blocked",
        "npc.event.triggered","npc.event.cancelled","npc.promotion.eligible","frontier.zombieSpawned","threat.forecastChanged",
        "relay.projectBlocked","relay.constructionStarted","relay.materialsGathered","relay.materialsCommitted","relay.stationOnline",
        "combat.damage.applied","combat.entity.defeated"}
    def food_field(value):
        if isinstance(value, dict):return any("food" in str(k).lower() or food_field(v) for k,v in value.items())
        if isinstance(value, list):return any(food_field(v) for v in value)
        return False
    unsupported = [e for e in events if
        (e["type"] != "npc.need.fulfilled" and
            (e["type"] not in nonfood and not (e["type"] == "quest.completed" and e.get("payload", {}).get("reward") == "parts+1")
             or food_field(e.get("payload", {}))))
        or (e["type"] == "npc.need.fulfilled" and (e.get("payload", {}).get("need") != "hunger"
            or set(e.get("payload", {})) != {"npcId","need","food"}))]
    ids = {n["id"] for n in before["npcs"]}
    meals = [e for e in events if e["type"] == "npc.need.fulfilled" and e.get("payload", {}).get("need") == "hunger"]
    meals_valid = all(e["payload"].get("npcId") in ids and type(e["payload"].get("food")) is int
                      and e["payload"]["food"] == 1 and e.get("actorId") == e["payload"]["npcId"] for e in meals)
    return {"ok": not unsupported and meals_valid, "unsupported": unsupported, "meals": meals,
            "npcFoodConsumed": sum(e["payload"].get("food", 0) for e in meals) if meals_valid else None}


def day_control_evidence(controls):
    return {"legacyDisabledCleared": all(controls.get(k, {}).get("enabled") is True for k in ("gatherBtn","buildBtn","cropBtn","endDayBtn")),
            "publicThreeVisibleEnabled": all(controls.get(k, {}).get("visible") is True and controls.get(k, {}).get("enabled") is True
                for k in ("gatherBtn","buildBtn","endDayBtn"))}


def clock_window_evidence(before, after, events):
    """Actual saved clock receipts must join uniquely and explain all minutes."""
    clocks=[e for e in events if e["type"]=="time.advanced"]
    joined=all(len([c for c in after["worldMeta"]["replay"]["commands"] if c["commandId"]==e["commandId"]
        and c["type"]=="world.advance" and c.get("payload",{}).get("minutes")==e.get("payload",{}).get("minutes")])==1
        and type(e.get("payload",{}).get("minutes")) in (int,float) and e["payload"]["minutes"]>0 for e in clocks)
    minutes=sum(e.get("payload",{}).get("minutes",0) for e in clocks) if joined else None
    return {"ok":joined and minutes==minute(after)-minute(before),"clockReceipts":clocks,
            "clockMinutes":minutes,"actualCalendarDelta":minute(after)-minute(before)}


def public_crop_evidence(before, after, garden_id):
    """Check actual pre/post artifacts, not a crop reducer or invented receipt.

    Legacy empty receipts require the original null-target command and all
    same-garden/food/time evidence. New target proof v1 additionally requires
    exact identity, harvest operation, gross payment and the real child join.
    Neither receipt shape substitutes for the actual saved artifact changes.
    """
    window = continuous_events(after, before)
    events = window or []
    crops = [e for e in events if e["type"] == "crop.changed"]
    event = crops[0] if len(crops) == 1 else None
    command_id = event.get("commandId") if event else None
    commands = [c for c in after["worldMeta"]["replay"]["commands"] if c["commandId"] == command_id] if command_id else []
    before_crop_commands = {c["commandId"] for c in before["worldMeta"]["replay"]["commands"] if c["type"] == "crop.change"}
    new_crop_commands = [c for c in after["worldMeta"]["replay"]["commands"] if c["type"] == "crop.change" and c["commandId"] not in before_crop_commands]
    advances = [e for e in events if e["type"] == "time.advanced" and e.get("causationId") == command_id] if command_id else []
    advance = advances[0] if len(advances) == 1 else None
    advance_commands = [c for c in after["worldMeta"]["replay"]["commands"] if advance and c["commandId"] == advance["commandId"]]
    clock=clock_window_evidence(before,after,events)
    old_gardens = [b for b in before["buildings"] if b.get("id") == garden_id]
    new_gardens = [b for b in after["buildings"] if b.get("id") == garden_id]
    old = old_gardens[0] if len(old_gardens) == 1 else {}
    actual = new_gardens[0] if len(new_gardens) == 1 else {}
    before_ids=[n["id"] for n in before["npcs"]];after_ids=[n["id"] for n in after["npcs"]]
    food = accounted_food([e for e in events if e["type"] != "crop.changed"], before)
    stable_day = before["day"] == after["day"] and all(before["world"].get(k) == after["world"].get(k)
        for k in ("lastRationDay", "lastDailyUpkeepDay"))
    payload = event.get("payload") if event else None
    legacy = payload == {} and len(commands) == 1 and commands[0].get("payload") == {"buildingId": None}
    proof_v1 = isinstance(payload, dict) and type(payload.get("proofVersion")) is int and payload["proofVersion"] == 1
    proof_checks = {}
    if proof_v1:
        obj = lambda value: value if isinstance(value, dict) else {}
        number = lambda value: type(value) in (int, float) and float("-inf") < value < float("inf")
        target, payment, resources, proof_clock, proof_advance = (obj(payload.get(k)) for k in ("target", "payment", "resources", "clock", "advance"))
        paid_before, paid_after, cost = (obj(payment.get(k)) for k in ("before", "after", "cost"))
        resource_before, resource_paid, resource_action, resource_after = (obj(resources.get(k)) for k in ("before", "afterPayment", "afterAction", "after"))
        resource_keys = ("wood", "stone", "food", "parts", "medicine", "seeds", "energy")
        valid_resources = all(set(value) == set(resource_keys) and all(number(value[k]) for k in resource_keys)
            for value in (resource_before, resource_paid, resource_action, resource_after))
        crop_fields = ("planted", "ready", "growth")
        def crop_state(value):
            return isinstance(value, dict) and set(value) == set(crop_fields) and type(value.get("planted")) is bool \
                and type(value.get("ready")) is bool and number(value.get("growth"))
        clock_before, clock_after = (obj(proof_clock.get(k)) for k in ("before", "after"))
        def calendar(value):
            return set(value) == {"day", "hour", "minute", "world"} and all(type(value[k]) is int for k in value) \
                and value["day"] >= 1 and 0 <= value["hour"] < 24 and 0 <= value["minute"] < 60 and minute(value) == value["world"]
        proof_checks = {
            "v1 exact live garden identity and harvest operation": payload.get("ok") is True and payload.get("buildingId") == garden_id
                and payload.get("buildingType") == "garden" and payload.get("operation") == "harvest"
                and target.get("id") == garden_id and target.get("type") == "garden" and target.get("presentAtCompletion") is True,
            "v1 target transitions match the same actual garden": all(crop_state(target.get(k)) for k in ("before", "afterAction", "atCompletion"))
                and target.get("before") == {k: old.get(k) for k in crop_fields}
                and target.get("afterAction") == {"planted": False, "ready": False, "growth": 0}
                and target.get("atCompletion") == {k: actual.get(k) for k in crop_fields},
            "v1 gross six energy and zero seeds payment": set(cost) == {"energy", "seeds"}
                and all(type(cost[k]) is int for k in cost) and cost == {"energy": 6, "seeds": 0}
                and set(paid_before) == set(paid_after) == {"energy", "seeds"}
                and all(number(value[k]) for value in (paid_before, paid_after) for k in ("energy", "seeds"))
                and paid_before.get("energy", 0) >= 6 and paid_before.get("energy", 0) - paid_after.get("energy", 0) == 6
                and paid_before.get("seeds") == paid_after.get("seeds") == before["seeds"] == after["seeds"],
            "v1 full resources separate payment and crop yield": valid_resources
                and all(resource_before[k] == paid_before.get(k) and resource_paid[k] == paid_after.get(k) for k in ("energy", "seeds"))
                and all(resource_paid[k] == resource_before[k] - (6 if k == "energy" else 0) for k in resource_keys)
                and all(resource_action[k] == resource_paid[k] + (3 if k == "food" else 0) for k in resource_keys)
                and isinstance(payload.get("yield"), dict) and all(type(payload["yield"].get(k)) is int for k in ("food", "medicine"))
                and payload.get("yield") == {"food": 3, "medicine": 0},
            "v1 child proof exactly joins actual advance event": bool(advance and command_id) and bool(advance.get("eventId"))
                and proof_advance == {"commandId": advance.get("commandId"), "eventId": advance.get("eventId"),
                    "causationId": command_id, "minutes": 20, "tick": advance.get("tick")},
            "v1 twenty minute clock is within actual observed window": calendar(clock_before) and calendar(clock_after)
                and proof_clock.get("requestedMinutes") == 20 and proof_clock.get("elapsedMinutes") == 20
                and clock_after.get("world", 0) - clock_before.get("world", 0) == 20
                and minute(before) <= clock_before.get("world", -1) < clock_after.get("world", -1) <= minute(after)
                and bool(advance) and clock_after.get("world") == advance.get("tick", {}).get("world"),
            "v1 parent command has the exact target id": len(commands) == 1 and commands[0].get("payload") == {"buildingId": garden_id},
        }
    receipt_contract = "legacy-empty" if legacy else "target-proof-v1" if proof_v1 else "unsupported"
    checks = {
        "complete actual harvest event window": window is not None and bool(window),
        "harvest preserves the same unique source NPC identities": len(before_ids)==len(set(before_ids))
            and len(after_ids)==len(set(after_ids)) and sorted(before_ids)==sorted(after_ids),
        "same mature garden actually becomes harvested": bool(old and actual) and old.get("type") == "garden"
            and old.get("ready") is True and old.get("planted") is True and old.get("growth", 0) >= 2
            and all(actual.get(k) == old.get(k) for k in ("id", "x", "y", "type"))
            and actual.get("ready") is False and actual.get("planted") is False and actual.get("growth") == 0,
        "harvesting the mature garden does not spend seeds": after["seeds"]==before["seeds"],
        "one new crop receipt joins one exact public crop command": bool(command_id) and len(crops) == 1 and len(commands) == 1
            and event.get("actorId") == "player-1"
            and commands[0]["type"] == "crop.change" and (legacy or proof_v1 and all(proof_checks.values()))
            and commands[0].get("actorId") == "player-1" and len(new_crop_commands) == 1 and new_crop_commands[0] == commands[0]
            and after["worldMeta"]["seenCommands"].count(command_id) == 1,
        "harvest receipt has an exact supported evidence contract": legacy or proof_v1 and all(proof_checks.values()),
        "harvest advances twenty minutes by its own causal replay": bool(advance and event) and len(advance_commands) == 1
            and advance.get("payload", {}).get("minutes") == 20 and advance_commands[0]["type"] == "world.advance"
            and advance_commands[0].get("payload") == {"minutes": 20} and advance["seq"] < event["seq"]
            and advance["tick"]["world"] == event["tick"]["world"],
        "harvest observation time is backed by all actual clock commands": bool(clock["clockReceipts"]) and clock["ok"],
        "harvest food gain is exactly three after recorded NPC meals": stable_day and food["ok"]
            and after["food"] - before["food"] + food["npcFoodConsumed"] == 3,
    }
    return {"ok": all(checks.values()), "checks": checks, "gardenBefore": old, "gardenAfter": actual,
            "beforeMinute": minute(before), "afterMinute": minute(after), "beforeEventSeq": before["worldMeta"]["eventSeq"],
            "afterEventSeq": after["worldMeta"]["eventSeq"], "foodBefore": before["food"], "foodAfter": after["food"],
            "foodAccounting": food, "receipts": crops, "commands": commands, "causalAdvance": advances,
            "causalAdvanceCommands": advance_commands, "clockEvidence":clock,
            "receiptContract":receipt_contract,"targetProofChecks":proof_checks}


def public_crop_reload_evidence(before, after, garden_id):
    """Pure artifact comparison for no repeated harvest after actual reload."""
    window = continuous_events(after, before)
    events = window or []
    old = [b for b in before["buildings"] if b.get("id") == garden_id]
    actual = [b for b in after["buildings"] if b.get("id") == garden_id]
    food = accounted_food(events, before)
    clock=clock_window_evidence(before,after,events)
    before_ids=[n["id"] for n in before["npcs"]];after_ids=[n["id"] for n in after["npcs"]]
    checks = {
        "reload has a complete saved event window since harvest": window is not None,
        "reload calendar delta is backed by all exact clock replay joins": clock["ok"],
        "reload retains the same unique source NPC identities": len(before_ids)==len(set(before_ids))
            and len(after_ids)==len(set(after_ids)) and sorted(before_ids)==sorted(after_ids),
        "reload keeps the exact harvested garden": len(old) == len(actual) == 1 and actual[0] == old[0]
            and actual[0].get("ready") is False and actual[0].get("planted") is False and actual[0].get("growth") == 0,
        "reload retains the actual post-harvest seed inventory": after["seeds"]==before["seeds"],
        "reload never repeats crop receipt or command": not any(e["type"] == "crop.changed" for e in events)
            and [c for c in after["worldMeta"]["replay"]["commands"] if c["type"] == "crop.change"]
                == [c for c in before["worldMeta"]["replay"]["commands"] if c["type"] == "crop.change"],
        "reload food retains harvest yield with only recorded NPC meals": before["day"] == after["day"] and food["ok"]
            and all(before["world"].get(k) == after["world"].get(k) for k in ("lastRationDay", "lastDailyUpkeepDay"))
            and after["food"] == before["food"] - food["npcFoodConsumed"],
    }
    return {"ok": all(checks.values()), "checks": checks, "foodAccounting": food,"clockEvidence":clock,
            "beforeMinute": minute(before), "afterMinute": minute(after), "foodBefore": before["food"], "foodAfter": after["food"]}


def close_receipts_unchanged(before, after):
    wanted = lambda e: e["type"] == "threat.closed" or e["type"] == "sanity.changed" and e.get("payload", {}).get("targetId") == "player-1" and e.get("payload", {}).get("reason") == "尸潮结束后回到营地"
    return [e for e in after["worldMeta"]["events"] if wanted(e)] == [e for e in before["worldMeta"]["events"] if wanted(e)]


def crop_method_controls():
    """Synthetic comparison witnesses only; never booted or gameplay results."""
    checks=[]
    controls={k:{"visible":k!="cropBtn","enabled":True} for k in ("gatherBtn","buildBtn","cropBtn","endDayBtn")}
    assert all(day_control_evidence(controls).values())
    for key,field in (("cropBtn","enabled"),("gatherBtn","visible"),("buildBtn","enabled"),("endDayBtn","visible")):
        bad=copy.deepcopy(controls);bad[key][field]=False
        assert not all(day_control_evidence(bad).values())
        checks.append("day-controls-reject-"+key+"-"+field)
    before={"day":3,"hour":1,"minute":0,"food":5,"seeds":2,"energy":40,"wood":12,"stone":10,"parts":2,"medicine":1,"npcs":[{"id":"developer-only-npc"}],
        "buildings":[{"id":"developer-only-garden","x":7,"y":14,"type":"garden","ready":True,"planted":True,"growth":2}],
        "world":{"lastRationDay":3,"lastDailyUpkeepDay":3},
        "worldMeta":{"eventSeq":10,"events":[],"seenCommands":[],"replay":{"commands":[]}}}
    after=copy.deepcopy(before);after["minute"]=20;after["food"]=8;after["energy"]=35
    after["buildings"][0].update(ready=False,planted=False,growth=0)
    after["worldMeta"].update(eventSeq=12,seenCommands=["developer-crop","developer-advance"],events=[
        {"eventId":"developer-advance-event","seq":11,"type":"time.advanced","commandId":"developer-advance","causationId":"developer-crop","tick":{"world":2960},"payload":{"minutes":20}},
        {"eventId":"developer-crop-event","seq":12,"type":"crop.changed","actorId":"player-1","commandId":"developer-crop","tick":{"world":2960},"payload":{}}])
    after["worldMeta"]["replay"]["commands"]=[{"commandId":"developer-crop","type":"crop.change","actorId":"player-1","payload":{"buildingId":None}},
        {"commandId":"developer-advance","type":"world.advance","payload":{"minutes":20}}]
    garden="developer-only-garden"
    assert public_crop_evidence(before,after,garden)["ok"]
    checks.append("accept-empty-real-shaped-crop-payload-with-positive-artifact-evidence")
    # Pure comparison controls for the new writer shape. These values are
    # synthetic witnesses, not captures, source-VM runs or browser gameplay.
    proof_after=copy.deepcopy(after)
    proof_after["worldMeta"]["replay"]["commands"][0]["payload"]={"buildingId":garden}
    resource_keys=("wood","stone","food","parts","medicine","seeds","energy")
    resources_before={k:before[k] for k in resource_keys}
    resources_paid=copy.deepcopy(resources_before);resources_paid["energy"]-=6
    resources_action=copy.deepcopy(resources_paid);resources_action["food"]+=3
    resources_after={k:proof_after[k] for k in resource_keys}
    proof={"ok":True,"proofVersion":1,"buildingId":garden,"buildingType":"garden","operation":"harvest",
        "target":{"id":garden,"type":"garden","before":{"planted":True,"ready":True,"growth":2},
            "afterAction":{"planted":False,"ready":False,"growth":0},"atCompletion":{"planted":False,"ready":False,"growth":0},"presentAtCompletion":True},
        "payment":{"cost":{"energy":6,"seeds":0},"before":{"energy":40,"seeds":2},"after":{"energy":34,"seeds":2}},
        "yield":{"food":3,"medicine":0},"resources":{"before":resources_before,"afterPayment":resources_paid,"afterAction":resources_action,"after":resources_after},
        "clock":{"before":{"day":3,"hour":1,"minute":0,"world":2940},"after":{"day":3,"hour":1,"minute":20,"world":2960},"requestedMinutes":20,"elapsedMinutes":20},
        "advance":{"commandId":"developer-advance","eventId":"developer-advance-event","causationId":"developer-crop","minutes":20,"tick":{"world":2960}}}
    proof_after["worldMeta"]["events"][-1]["payload"]=proof
    evidence=public_crop_evidence(before,proof_after,garden)
    assert evidence["ok"] and evidence["receiptContract"]=="target-proof-v1" and all(evidence["targetProofChecks"].values())
    checks.append("accept-synthetic-v1-harvest-proof-with-gross-six-energy-and-real-shaped-artifact-joins")
    for label in ("wrong-building-id","wrong-parent-target","null-parent-target","wrong-operation","wrong-building-type","wrong-target-id",
                  "wrong-target-before","wrong-target-after","missing-target","wrong-child-command","wrong-child-event","wrong-child-causation",
                  "wrong-child-tick","wrong-child-minutes","wrong-payment-energy","wrong-payment-cost","seed-payment","wrong-resource-payment",
                  "wrong-resource-yield","wrong-clock","wrong-yield","no-actual-food-yield","command-rejected","unsupported-version","missing-proof",
                  "wrong-event-actor","wrong-command-actor"):
        bad=copy.deepcopy(proof_after);p=bad["worldMeta"]["events"][-1]["payload"]
        if label=="wrong-building-id":p["buildingId"]="unrelated-garden"
        elif label=="wrong-parent-target":bad["worldMeta"]["replay"]["commands"][0]["payload"]["buildingId"]="unrelated-garden"
        elif label=="null-parent-target":bad["worldMeta"]["replay"]["commands"][0]["payload"]["buildingId"]=None
        elif label=="wrong-operation":p["operation"]="plant"
        elif label=="wrong-building-type":p["buildingType"]="greenhouse"
        elif label=="wrong-target-id":p["target"]["id"]="unrelated-garden"
        elif label=="wrong-target-before":p["target"]["before"]["ready"]=False
        elif label=="wrong-target-after":p["target"]["afterAction"]["planted"]=True
        elif label=="missing-target":p["target"]["presentAtCompletion"]=False
        elif label=="wrong-child-command":p["advance"]["commandId"]="unrelated-advance"
        elif label=="wrong-child-event":p["advance"]["eventId"]="unrelated-event"
        elif label=="wrong-child-causation":p["advance"]["causationId"]="unrelated-parent"
        elif label=="wrong-child-tick":p["advance"]["tick"]["world"]+=1
        elif label=="wrong-child-minutes":p["advance"]["minutes"]=1
        elif label=="wrong-payment-energy":p["payment"]["after"]["energy"]+=1
        elif label=="wrong-payment-cost":p["payment"]["cost"]["energy"]=4
        elif label=="seed-payment":p["payment"]["after"]["seeds"]-=1
        elif label=="wrong-resource-payment":p["resources"]["afterPayment"]["energy"]+=1
        elif label=="wrong-resource-yield":p["resources"]["afterAction"]["food"]+=1
        elif label=="wrong-clock":p["clock"]["after"]["world"]+=1
        elif label=="wrong-yield":p["yield"]["food"]=30
        elif label=="no-actual-food-yield":bad["food"]=before["food"]
        elif label=="wrong-event-actor":bad["worldMeta"]["events"][-1]["actorId"]="system"
        elif label=="wrong-command-actor":bad["worldMeta"]["replay"]["commands"][0]["actorId"]="system"
        elif label=="command-rejected":
            bad["worldMeta"]["eventSeq"]+=1
            bad["worldMeta"]["events"].append({"seq":13,"type":"command.rejected","commandId":"developer-crop","payload":{"reason":"developer-only-rejection"}})
        elif label=="unsupported-version":p["proofVersion"]=2
        elif label=="missing-proof":bad["worldMeta"]["events"][-1]["payload"]={}
        assert not public_crop_evidence(before,bad,garden)["ok"],"v1 crop evidence accepted "+label
        checks.append("reject-synthetic-v1-"+label)
    proof_meal=copy.deepcopy(proof_after);proof_meal["food"]-=1;proof_meal["worldMeta"]["eventSeq"]=13
    proof_meal["worldMeta"]["events"].append({"seq":13,"type":"npc.need.fulfilled","actorId":"developer-only-npc","payload":{"npcId":"developer-only-npc","need":"hunger","food":1}})
    assert public_crop_evidence(before,proof_meal,garden)["ok"]
    checks.append("accept-synthetic-v1-harvest-with-recorded-subsequent-NPC-meal")
    for contract,source in (("legacy",after),("v1",proof_after)):
        neutral=copy.deepcopy(source);neutral["worldMeta"]["eventSeq"]=14
        neutral["worldMeta"]["events"].extend([
            {"seq":13,"type":"combat.damage.applied","actorId":"developer-only-tower","payload":{"sourceId":"developer-only-tower","targetId":"developer-only-enemy","amount":10}},
            {"seq":14,"type":"combat.entity.defeated","actorId":"developer-only-tower","payload":{"entityId":"developer-only-enemy","entityKind":"event-enemy"}}])
        assert public_crop_evidence(before,neutral,garden)["ok"]
        checks.append("accept-synthetic-"+contract+"-harvest-with-known-neutral-combat")
        for label,event_type,data in (
            ("damage-nested-food","combat.damage.applied",{"details":{"food":0}}),
            ("defeat-nested-food","combat.entity.defeated",{"rewards":[{"food":2}]}),
            ("defeat-food-delta","combat.entity.defeated",{"foodDelta":0}),
            ("unknown-combat-loot","combat.loot.granted",{"parts":1})):
            bad=copy.deepcopy(source);bad["worldMeta"]["eventSeq"]=13
            bad["worldMeta"]["events"].append({"seq":13,"type":event_type,"payload":data})
            assert not public_crop_evidence(before,bad,garden)["ok"],"crop food evidence accepted "+label
            checks.append("reject-synthetic-"+contract+"-"+label)
    for label in ("noop-garden","wrong-garden","food-no-yield","seed-spent","changed-roster","duplicate-crop","wrong-replay-type","duplicate-replay",
                  "invented-buildingId","wrong-causation","wrong-duration","missing-window","wrong-clock-total","missing-seen-command",
                  "unknown-food-action","landmark-food","content-food","future-food","nonfood-type-food-payload","bad-NPC-meal","wrong-event-actor"):
        bad=copy.deepcopy(after)
        if label=="noop-garden":bad["buildings"]=copy.deepcopy(before["buildings"])
        elif label=="wrong-garden":bad["buildings"][0]["id"]="unrelated-garden"
        elif label=="food-no-yield":bad["food"]=before["food"]
        elif label=="seed-spent":bad["seeds"]-=1
        elif label=="changed-roster":bad["npcs"][0]["id"]="unrelated-NPC"
        elif label=="duplicate-crop":
            bad["worldMeta"]["eventSeq"]+=1;e=copy.deepcopy(bad["worldMeta"]["events"][-1]);e["seq"]=13;bad["worldMeta"]["events"].append(e)
        elif label=="wrong-replay-type":bad["worldMeta"]["replay"]["commands"][0]["type"]="resource.collect"
        elif label=="duplicate-replay":bad["worldMeta"]["replay"]["commands"].append(copy.deepcopy(bad["worldMeta"]["replay"]["commands"][0]))
        elif label=="invented-buildingId":bad["worldMeta"]["replay"]["commands"][0]["payload"]["buildingId"]=garden
        elif label=="wrong-causation":bad["worldMeta"]["events"][0]["causationId"]="unrelated-command"
        elif label=="wrong-duration":bad["worldMeta"]["events"][0]["payload"]["minutes"]=1
        elif label=="missing-window":bad["worldMeta"]["events"].pop(0)
        elif label=="wrong-clock-total":bad["minute"]=22
        elif label=="missing-seen-command":bad["worldMeta"]["seenCommands"].remove("developer-crop")
        elif label=="wrong-event-actor":bad["worldMeta"]["events"][-1]["actorId"]="system"
        else:
            bad["worldMeta"]["eventSeq"]+=1
            variants={"unknown-food-action":("player.ate",{}),"landmark-food":("landmark.discovered",{"landmarkType":"waterMill"}),
                "content-food":("content.effects.applied",{"effects":[{"op":"adjustResource","key":"food","value":2}]}),
                "future-food":("developer-only-future-event",{}),"nonfood-type-food-payload":("npc.work.completed",{"delta":{"food":2}}),
                "bad-NPC-meal":("npc.need.fulfilled",{"npcId":"developer-only-npc","need":"hunger","food":True})}
            kind,data=variants[label]
            bad["worldMeta"]["events"].append({"seq":13,"type":kind,"payload":data})
        assert not public_crop_evidence(before,bad,garden)["ok"],"crop evidence accepted "+label
        checks.append("reject-"+label)
    meal=copy.deepcopy(after);meal["food"]-=1;meal["worldMeta"]["eventSeq"]=13
    meal["worldMeta"]["events"].append({"seq":13,"type":"npc.need.fulfilled","actorId":"developer-only-npc","payload":{"npcId":"developer-only-npc","need":"hunger","food":1}})
    assert public_crop_evidence(before,meal,garden)["ok"]
    checks.append("account-recorded-NPC-meal-without-inventing-crop-delta")
    old_before=copy.deepcopy(before);old_after=copy.deepcopy(after)
    old={"seq":10,"type":"developer-only-original","payload":{"unchanged":True}}
    old_before["worldMeta"]["events"]=[old];old_after["worldMeta"]["events"].insert(0,copy.deepcopy(old))
    assert public_crop_evidence(old_before,old_after,garden)["ok"]
    interleaved=copy.deepcopy(old_after);interleaved["worldMeta"]["events"][0:2]=list(reversed(interleaved["worldMeta"]["events"][0:2]))
    assert not public_crop_evidence(old_before,interleaved,garden)["ok"]
    checks.append("reject-old-new-ledger-interleave")
    old_after["worldMeta"]["events"][0]["payload"]["unchanged"]=False
    assert not public_crop_evidence(old_before,old_after,garden)["ok"]
    checks.append("reject-rewritten-retained-old-ledger")
    assert public_crop_reload_evidence(after,after,garden)["ok"]
    clock_after=copy.deepcopy(after);clock_after["minute"]+=1;clock_after["worldMeta"]["eventSeq"]+=1
    clock_after["worldMeta"]["events"].append({"seq":13,"type":"time.advanced","commandId":"developer-reload-clock","payload":{"minutes":1}})
    clock_after["worldMeta"]["replay"]["commands"].append({"commandId":"developer-reload-clock","type":"world.advance","payload":{"minutes":1}})
    assert public_crop_reload_evidence(after,clock_after,garden)["ok"]
    checks.append("reload-accept-exact-real-shaped-natural-clock-join")
    for label in ("minute-without-clock","unjoined-clock","wrong-clock-total","seed-inventory-changed"):
        bad=copy.deepcopy(clock_after)
        if label=="minute-without-clock":bad=copy.deepcopy(after);bad["minute"]+=1
        elif label=="unjoined-clock":bad["worldMeta"]["replay"]["commands"].pop()
        elif label=="wrong-clock-total":bad["minute"]+=1
        else:bad["seeds"]-=1
        assert not public_crop_reload_evidence(after,bad,garden)["ok"],"reload evidence accepted "+label
        checks.append("reload-reject-"+label)
    for label in ("repeat-crop","garden-reset","changed-roster","lost-food","missing-window"):
        bad=copy.deepcopy(after)
        if label=="garden-reset":bad["buildings"]=copy.deepcopy(before["buildings"])
        elif label=="changed-roster":bad["npcs"][0]["id"]="unrelated-NPC"
        elif label=="lost-food":bad["food"]-=1
        elif label=="missing-window":bad["worldMeta"]["eventSeq"]+=1
        else:
            bad["worldMeta"]["eventSeq"]+=1
            bad["worldMeta"]["events"].append({"seq":13,"type":"crop.changed","payload":{}})
        assert not public_crop_reload_evidence(after,bad,garden)["ok"],"reload evidence accepted "+label
        checks.append("reload-reject-"+label)
    close=copy.deepcopy(after);close["worldMeta"]["events"].append({"seq":13,"type":"threat.closed","payload":{"threatId":"developer-only-threat"}})
    assert not close_receipts_unchanged(after,close)
    checks.append("reject-new-close-during-public-crop-route")
    return {"mode":"developer-crop-evidence-controls","syntheticComparisonWitnesses":True,"gameplayExecuted":False,
            "browserStarted":False,"controls":checks,"ok":True}


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
    crop_rows=[r for r in rows if r.get("public_crop_route")]
    assert len(crop_rows)==1 and crop_rows[0]["key"]=="B1-complete-resolved"
    assert len([b for b in crop_rows[0]["payload"]["buildings"] if b["type"]=="garden" and b["x"]==7 and b["y"]==14
                and b.get("ready") is True and b.get("planted") is True and b.get("growth")==2])==1
    crop_controls=crop_method_controls()
    original_ids={n["id"] for n in sources["resolved"]["payload"]["npcs"]}
    # Development controls for the comparison itself, not game execution.
    source_projection = copy.deepcopy(sources["resolved"]["payload"])
    source_projection["motion"].update(accumulator=0, input={"x":0,"y":0})
    assert original_persistent_fields_preserved(source_projection, sources["resolved"]["payload"])
    for label in ("quests", "resident-relations", "command-history", "ledger-middle-delete"):
        changed=copy.deepcopy(source_projection)
        if label=="quests":changed["quests"]={"developer-only-invalid-domain":True}
        elif label=="resident-relations":changed["npcs"][0]["relations"]={"developer-only-invalid-relation":True}
        elif label=="command-history":changed["worldMeta"]["replay"]["commands"]=[]
        else:changed["worldMeta"]["events"].pop(12)
        assert not original_persistent_fields_preserved(changed,sources["resolved"]["payload"]),"whole-source comparison missed "+label
    for row in rows:
        if row.get("raw_kind")!="critical-structure":assert {n["id"] for n in row["payload"]["npcs"]}==original_ids
        if row["key"]!="DAY-control" and row["key"]!="B1-complete-resolved":assert row["mutations"] or row.get("restart")
        assert builder.evaluate(JS_VALIDATE,builder.evaluate(JS_ENVELOPE,row["payload"]))["ok"]
    backed=next(r for r in rows if r["key"]=="B7-missing-historical-stats")
    absent=next(r for r in rows if r["key"]=="B7-battle-and-receipt-stats-missing")
    original_receipt=next(e for e in sources["resolved"]["payload"]["worldMeta"]["events"] if e["type"]=="threat.resolved" and e["payload"].get("threatId")==sources["resolved"]["payload"]["nightBattle"]["instanceId"])
    missing_receipt=next(e for e in absent["payload"]["worldMeta"]["events"] if e["eventId"]==original_receipt["eventId"])
    assert next(e for e in backed["payload"]["worldMeta"]["events"] if e["eventId"]==original_receipt["eventId"])==original_receipt
    assert all(missing_receipt[k]==v for k,v in original_receipt.items() if k!="payload")
    assert missing_receipt["payload"]=={k:v for k,v in original_receipt["payload"].items() if k not in ("kills","breaches","damage")}
    assert backed["display_stats"]=={"kills":4,"breaches":2,"damage":0,"walls":None,"npcDeaths":None}
    assert all(v is None for v in absent["display_stats"].values())
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
        "sourceNegativeControls":negative,"B7DisplayContracts":{"receiptPresent":"exact kills4/breaches2/damage0; wall/NPC deaths unrecorded","battleAndReceiptAbsent":"all five unrecorded; real event identity/seq retained","offlineMutationsExplicit":True},
        "wholeSourceComparisonNegativeControls":["quests","resident-relations","command-history","ledger-middle-delete"],"originalsUnmodified":True,"nativeObserverDelegation":True,
        "publicCropCase":"B1-complete-resolved","cropEvidenceMethodControls":crop_controls,
        "production18compatSources":legacy_meta,"production18compatBrowserStatus":"not-run","production18compatDeclaredCases":len(legacy_rows),
        "production18compatMatrix":[{"key":r["key"],"expectedPhase":r["phase"],"mutations":r["mutations"]} for r in legacy_rows],
        "production18AdapterNegativeControls":legacy_negatives,"production18WriterProvenance":legacy_provenance,"production18InitialWriterProvenance":initial_provenance,"ok":True},ensure_ascii=True),flush=True)


class FullSuite:
    def __init__(self, runner, browser, builder,chromium=None):
        self.r, self.browser, self.builder = runner, browser, builder
        self.chromium=chromium
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
        case={"group":"current-writer","status":"running","fixtureMode":False,"saveInjection":False,"hiddenGameCalls":False,"mode":"public-first-start-immediate-reload","contextMode":"regular-Playwright-new-context"}
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
        if row.get("migration_reason"):
            self.check(row,"migration has the exact required repair reason",row["migration_reason"] in fact["reason"].split(","),fact["reason"])

    def report_checks(self, page, row, observed, expected):
        dom = observed["dom"]
        self.check(row, "actual report visible in summary mode", dom["reportVisible"] and "summary-mode" in dom["overlayClass"])
        self.check(row, "report public clock preserves original minute", self.dom_minute(dom) == minute(expected))
        battle = expected["nightBattle"]
        defense=battle.get("defense")
        self.check(row,"saved defense is projected rather than template default",dom["defense"].strip()==str(defense) if isinstance(defense,(int,float)) else "未记录" in dom["defense"],
                   {"expected":defense if isinstance(defense,(int,float)) else "未记录","actual":dom["defense"]})
        support=battle.get("supportIds")
        self.check(row,"saved support count or missing history is explicit",dom["support"].strip()==str(len(support)) if isinstance(support,list) else "未记录" in dom["support"],
                   {"expected":len(support) if isinstance(support,list) else "未记录","actual":dom["support"]})
        if row.get("missing_stats"):
            for key,value in row["display_stats"].items():
                expected_text = (f"-{value}" if value else "0") if key=="damage" and value is not None else str(value)
                self.check(row, "statistic reflects exact historical evidence: "+key,
                           "未记录" in dom[key] if value is None else dom[key].strip()==expected_text,
                           {"expected":"未记录" if value is None else expected_text,"actual":dom[key],"receiptFallback":bool(row.get("receipt_backed_stats"))})
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
        after_close=self.snapshot(page, row, "after-public-close")
        controls={k:after_close["dom"]["buttons"][k] for k in ("gatherBtn","buildBtn","cropBtn","endDayBtn")}
        control_evidence=day_control_evidence(controls)
        self.check(row,"all four legacy DAY controls have disabled cleared after real close",control_evidence["legacyDisabledCleared"],controls)
        self.check(row,"three constant public DAY controls visibly enabled after real close",
                   control_evidence["publicThreeVisibleEnabled"],controls)
        self.r.result["cases"][row["key"]]["cropControlPolicy"]={"legacyCropButton":controls["cropBtn"],
            "legacyHidden":not controls["cropBtn"]["visible"],
            "meaning":"legacy-hidden duplicate; not clicked or treated as a public entry",
            "publicSelector":'#contextActions [data-context-action="crop"]',"cssModified":False,"hiddenClick":False}
        self.r.result["cases"][row["key"]]["publicCloseEvidence"]={"originalReportMinute":minute(expected),
            "closeObservationMinute":minute(p),"closeObservationEventSeq":p["worldMeta"]["eventSeq"],
            "closeReceipt":events,"closeCommands":command,"SANCompensation":compensation,
            "resourceEqualityScope":"navigation/action-before; same-minute close observation only"}
        if row["group"]=="B1":
            self.r.result["cases"][row["key"]]["publicGatherCoverage"]={"B1":"DAY gather button visible/enabled only; no positive collection claimed at report position",
                "actualSuccessCase":"DAY-control explicit public tree route with positive wood/receipt/replay"}
            if not self.accessible(page,"#buildBtn"):
                self.blocked(row,"real DAY build button after close")
            else:
                page.locator("#buildBtn").click()
                opened=self.snapshot(page,row,"after-close-public-build-open")
                self.check(row,"public build drawer actually opens after report close",opened["dom"]["buildDrawerVisible"] and "open" in opened["dom"]["buildDrawerClass"]
                           and self.accessible(page,'#buildDrawer [data-build="wall"]'))
                page.locator("#buildBtn").click()
                dismissed=self.snapshot(page,row,"after-close-public-build-dismiss")
                self.check(row,"public build drawer actually closes",not dismissed["dom"]["buildDrawerVisible"] and "open" not in dismissed["dom"]["buildDrawerClass"])
        self.r.result["cases"][row["key"]]["publicCloseExecuted"] = True
        if row.get("public_crop_route"):
            return self.public_post_close_harvest(page,row,p)
        return copy.deepcopy(p)

    def public_post_close_harvest(self,page,row,close_baseline):
        """B1 actual visible crop action; the original close facts stay separate."""
        case=self.r.result["cases"][row["key"]]
        original=[b for b in row["payload"]["buildings"] if b["type"]=="garden" and b["x"]==7 and b["y"]==14]
        self.check(row,"B1 authentic input has the original mature garden",len(original)==1 and original[0].get("ready") is True
                   and original[0].get("planted") is True and original[0].get("growth")==2,original,fatal=True)
        garden_id=original[0]["id"]
        page.keyboard.press("Escape")
        start=self.r.position(page);route=[]
        for x,y in ((start[0],11.6),(8.2,11.6),(8.2,13.4),(7.2,13.4),(7.2,14.2)):
            previous=self.r.position(page);self.r.navigate(page,x,y);actual=self.r.position(page)
            route.append({"waypoint":[x,y],"before":list(previous),"after":list(actual),"feedback":"visible location-label/connected player-marker"})
        case["publicCropRoute"]={"waypoints":route,"target":{"id":garden_id,"x":7,"y":14},"input":"public WASD and visible map click"}
        position=self.r.position(page)
        self.check(row,"B1 public garden waypoint reached",abs(position[0]-7.2)<.3 and abs(position[1]-14.2)<.3,list(position),fatal=True)
        tile='#world .tile[data-x="7"][data-y="14"]'
        if not self.accessible(page,tile):
            self.blocked(row,"visible original garden map tile after report close")
            raise AssertionError("original garden public map tile unavailable")
        page.locator(tile).click()
        selector='#contextActions [data-context-action="crop"]'
        if not self.accessible(page,selector):
            self.blocked(row,"visible enabled mature garden context action after close")
            raise AssertionError("original garden public crop action unavailable")
        route_dom=self.snapshot(page,row,"after-close-public-garden-route")
        self.check(row,"actual dynamic crop entry is visible enabled harvest",route_dom["dom"]["contextCrop"]["visible"]
                   and route_dom["dom"]["contextCrop"]["enabled"] and "收获" in route_dom["dom"]["contextCrop"]["text"],route_dom["dom"]["contextCrop"],fatal=True)
        # A real reload writes the current route position via registered
        # lifecycle handlers. This is the pre-click food/calendar baseline;
        # the still-seeded old report is never used as a harvest checkpoint.
        baseline=self.flush(page,row,"before-public-harvest-real-lifecycle-save")
        baseline_file=self.r.result["artifacts"][-1]["file"]
        before=self.primary(baseline)
        self.check(row,"harvest baseline is an actual legal lifecycle checkpoint",before is not None
                   and baseline["envelope"].get("reason") in ("pagehide","visibility-hidden")
                   and before.get("night") is False and before.get("nightBattle") is None
                   and abs(before["player"]["x"]-position[0])<.35 and abs(before["player"]["y"]-position[1])<.35
                   and before["worldMeta"]["eventSeq"]>=close_baseline["worldMeta"]["eventSeq"]
                   and before["energy"]>=6 and close_receipts_unchanged(close_baseline,before),
                   {"reason":baseline["envelope"].get("reason"),"checksum":baseline["envelope"].get("checksum")},fatal=True)
        if not self.accessible(page,"#continueSaveBtn"):
            self.blocked(row,"public start from pre-harvest lifecycle checkpoint")
            raise AssertionError("public start unavailable after crop baseline reload")
        page.locator("#continueSaveBtn").click()
        page.locator(tile).click()
        if not self.accessible(page,selector):
            self.blocked(row,"visible crop action restored at saved garden position")
            raise AssertionError("public crop action missing after actual route reload")
        action_before=self.snapshot(page,row,"before-public-harvest-visible-action")
        action_file=self.r.result["artifacts"][-1]["file"]
        self.check(row,"public restored crop action still says enabled harvest",action_before["dom"]["contextCrop"]["visible"]
                   and action_before["dom"]["contextCrop"]["enabled"] and "收获" in action_before["dom"]["contextCrop"]["text"],action_before["dom"]["contextCrop"],fatal=True)
        page.locator(selector).click()
        self.r.settle(page,lambda o:any(e["type"]=="crop.changed" for e in new_events(o["envelope"]["payload"],before)))
        actual=self.snapshot(page,row,"after-actual-public-harvest")
        after_file=self.r.result["artifacts"][-1]["file"]
        after=self.primary(actual)
        self.check(row,"harvest result is an actual legal saved envelope",after is not None,fatal=True)
        evidence=public_crop_evidence(before,after,garden_id)
        for name,ok in evidence["checks"].items():self.check(row,"B1 "+name,ok,evidence)
        self.check(row,"public navigation and crop do not repeat original close or SAN compensation",close_receipts_unchanged(close_baseline,after))
        case["publicHarvest"]={"scope":"B1 public crop after exact close; not another close/compensation",
            "beforeChecksum":baseline["envelope"]["checksum"],"afterChecksum":actual["envelope"]["checksum"],
            "actionDate":({"day":evidence["receipts"][0]["tick"]["world"]//1440+1,
                "hour":evidence["receipts"][0]["tick"]["world"]%1440//60,"minute":evidence["receipts"][0]["tick"]["world"]%60} if evidence["receipts"] else None),
            "beforeDate":{k:before[k] for k in ("day","hour","minute")},"afterDate":{k:after[k] for k in ("day","hour","minute")},
            "originalCloseMinute":minute(close_baseline),"gardenId":garden_id,"evidence":evidence,
            "beforeLifecycleArtifact":baseline_file,"beforeVisibleActionArtifact":action_file,"afterHarvestArtifact":after_file,
            "reloadBaseline":"actual post-harvest saved envelope","postBootStateInjection":False}
        self.r.persist()
        return copy.deepcopy(after)

    def public_day_gather(self,page,row):
        """Actual public route from genuine DAY; no B1 success is inferred."""
        page.keyboard.press("Escape")
        route=[]
        start=self.r.position(page)
        for x,y in ((start[0],11.5),(8.2,11.5),(8.2,8.2)):
            before=self.r.position(page);self.r.navigate(page,x,y);actual=self.r.position(page)
            route.append({"waypoint":[x,y],"before":list(before),"after":list(actual),"feedback":"visible location-label/connected player-marker"})
        self.r.result["cases"][row["key"]]["publicGatherRoute"]=route
        waypoint=self.r.position(page)
        self.check(row,"DAY public tree waypoint actually reached",abs(waypoint[0]-8.2)<.3 and abs(waypoint[1]-8.2)<.3,list(waypoint))
        before=self.r.settle(page,lambda o:abs(o["envelope"]["payload"]["player"]["x"]-waypoint[0])<.35
                             and abs(o["envelope"]["payload"]["player"]["y"]-waypoint[1])<.35)
        self.snapshot(page,row,"day-before-public-gather")
        old=before["envelope"]["payload"];seq=old["worldMeta"]["eventSeq"]
        selector='#contextActions [data-context-action="gather"]'
        if not self.accessible(page,selector):
            self.blocked(row,"visible tree gather affordance on public DAY route");return
        page.locator(selector).click()
        def receipts(p):
            return [e for e in new_events(p,old) if e["type"]=="resource.collected" and e.get("payload",{}).get("delta",{}).get("wood",0)>0]
        actual=self.r.settle(page,lambda o:o["envelope"]["payload"]["wood"]>old["wood"] and bool(receipts(o["envelope"]["payload"])))
        p=actual["envelope"]["payload"];events=receipts(p)
        command=[c for c in p["worldMeta"]["replay"]["commands"] if len(events)==1 and c["commandId"]==events[0]["commandId"]]
        self.check(row,"DAY actual gather increases wood with one new positive receipt",p["wood"]>old["wood"] and len(events)==1 and events[0]["seq"]>seq,events)
        self.check(row,"DAY positive receipt joins exact public collect command",len(command)==1 and command[0]["type"]=="resource.collect"
                   and command[0].get("payload",{}).get("resourceId")==events[0]["payload"].get("resourceId"),command)
        self.r.result["cases"][row["key"]]["publicGather"]={"scope":"DAY-control public action on authentic DAY fixture; not a B1 collection claim",
            "woodBefore":old["wood"],"woodAfter":p["wood"],"beforeEventSeq":seq,"receipts":events,"commands":command,"postBootStateInjection":False}
        self.snapshot(page,row,"day-after-actual-public-gather")

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
        context=page=owned_native=None
        marker = "report-contract-"+uuid.uuid4().hex
        origin = urlsplit(self.r.args.url).scheme+"://"+urlsplit(self.r.args.url).netloc
        bootstrap = {"marker":marker,"origin":origin,"storage":storage}
        expected = copy.deepcopy(self.sources[row["backup"]]["payload"] if row.get("backup") else row["payload"])
        phase = row["phase"]
        try:
            if row.get("visibility") and self.r.args.native_visibility:
                owned_native=NativeVisibilitySession(self.r,self.chromium)
                context=owned_native.open()
                case["contextMode"]="owned-native-Chrome-CDP-existing-default"
                case["nativeVisibility"]={"noDefaults":True,"existingDefaultContext":True,"newContextUsed":False,
                    "profileReused":False,"profileInArtifacts":False,"focusMediaEmulationOverrides":False,"syntheticVisibilityEvents":False}
                page=self.r.page(context,key,existing_page=owned_native.initial_page)
            else:
                context=self.browser.new_context(viewport={"width":1440,"height":900})
                case["contextMode"]="regular-Playwright-new-context"
                page=self.r.page(context,key)
            # Identical one-time, before-loader fixture and observer in both
            # routes. Native uses the original blank default page, no new_ctx.
            page.add_init_script("(()=>{const f="+json.dumps(bootstrap,ensure_ascii=True)+";if(window!==top||location.origin!==f.origin||window.name===f.marker)return;for(const [k,v]of Object.entries(f.storage))localStorage.setItem(k,v);window.name=f.marker;})();")
            page.add_init_script(TIMER_OBSERVER)
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
            if phase=="legacy-day":
                self.check(row,"legacy downgrade notice visible in the actual first document",started["dom"]["recoveryNoticeVisible"] and bool(started["dom"]["recoveryNotice"].strip()),started["dom"]["recoveryNotice"])
                self.r.result["cases"][key]["legacyNoticeCoverage"]="first after-public-start document; persistent recovery is proven by exact migration/save, not notice text in a new document"
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
                    page.wait_for_timeout(2800)
                    hidden_state=page.evaluate("document.visibilityState")
                    page.bring_to_front()
                    page.wait_for_function("()=>document.visibilityState==='visible'",timeout=self.r.timeout(5))
                    page.wait_for_timeout(100)
                    visible_state=page.evaluate("document.visibilityState")
                    other.close()
                    page.keyboard.up("w");page.keyboard.up("e")
                    self.snapshot(page,row,"after-real-tab-hide-return",allow_invalid=True)
                    observed_visibility=[e for e in self.trace(page)["events"][before_visibility:] if e["type"]=="visibility"]
                    evidence=visibility_evidence(observed_visibility)
                    self.check(row,"actual trusted hidden then visible lifecycle observed",evidence["ok"] and hidden_state=="hidden" and visible_state=="visible",
                        {"nativeEvents":evidence,"hiddenState":hidden_state,"returnedState":visible_state})
                    case["visibilityCoverage"]={"requestedHiddenMs":2800,"actualEvidence":evidence,
                        "hiddenState":hidden_state,"returnedState":visible_state,"atLeast60sCatchup":"source-only; browser requests 2800ms, no targeted 60s hold"}
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
                if phase=="day":
                    self.check(row,"normal DAY clock advances",self.dom_minute(self.snapshot(page,row,"day-two-ticks")["dom"])>minute(expected))
                    if row.get("public_gather_route"):self.public_day_gather(page,row)
                written=self.flush(page,row,"first-real-lifecycle-save")
                p=self.primary(written)
                if phase in ("closed-day","legacy-day"):
                    self.check(row,"cleanup/degrade retains all protected original consequences",p is not None and protection(p)==protection(expected) and minute(p)==minute(expected) and p.get("nightBattle") is None)
                    self.check(row,"cleanup/degrade produces no new close or rewards",p is not None and all(e["type"]=="save.migrated" for e in new_events(p,expected)))
                    if phase=="closed-day":
                        self.check(row,"existing real close never duplicated",p is not None and len([e for e in p["worldMeta"]["events"] if e["type"]=="threat.closed" and e["commandId"]==row["expected_close"]["commandId"]])==1)
                        self.migration(row,written,expected,envelope)
                    else:
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
                        self.check(row,"natural DAY time since reload baseline is backed by actual clock events "+str(repeat),minute(p)>minute(closed)
                                   and any(e["type"]=="time.advanced" for e in new_events(p,closed)))
                    if row.get("public_crop_route") and p is not None:
                        harvest=public_crop_reload_evidence(closed,p,case["publicHarvest"]["gardenId"])
                        for name,ok in harvest["checks"].items():self.check(row,"B1 "+name+" "+str(repeat),ok,harvest)
                        self.check(row,"B1 reload retains exact original close and SAN receipts "+str(repeat),close_receipts_unchanged(closed,p))
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
            if page is not None:
                try:self.snapshot(page,row,"failure",allow_invalid=True)
                except Exception as capture_error:case["failureCaptureError"]=type(capture_error).__name__
        finally:
            if owned_native is not None:
                owned_native.close()
                case["nativeContextCleanup"]=owned_native.cleanup_info
                case["nativeVisibilityActual"]={"diskProfileCreated":owned_native.profile is not None,
                    "CDPNoDefaultsConnected":owned_native.browser is not None,"existingDefaultContextSelected":owned_native.context is not None,
                    "profileRemoved":owned_native.cleanup_info.get("profileRemoved") is True}
                self.check(row,"owned native Chrome and outside-run profile cleaned",owned_native.cleanup_info.get("ok") is True,owned_native.cleanup_info)
            elif context is not None:
                try:context.close()
                except Exception as error:
                    case["contextCleanupError"]=type(error).__name__
                    self.check(row,"regular context cleanup succeeded",False,type(error).__name__)
            checks=self.r.result["actualChecks"][start:]
            case["actualCheckCount"]=len(checks)
            case["status"]="passed" if checks and all(c["ok"] for c in checks) and "exception" not in case else "failed"
            self.r.persist()

    def run(self):
        self.load_sources()
        rows=cases(self.sources["day"],self.sources["resolved"],self.sources["closed"])
        legacy_rows=self.load_legacy();rows.extend(legacy_rows)
        self.r.result.update(mode="explicit-B1-B16-boot-contracts",sourceEnvelopes=self.source_meta,
                             plannedCases=["CURRENT-public-first-start-reload"]+[r["key"] for r in rows],notYetImplemented=[],
                             preparedCaseCount=len(rows)+1,
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
            "normal threat.close CommandBus terminal Gate is source-checked because public loss CTA routes session.restart",
            "backup write/readback failure and retry are source-checked; browser B11/B13 cover real successful explicit restore only",
            "B5 same-minute multiple-candidate ambiguity is source-checked; browser covers exact references and wrong/missing references",
            "at least60000ms visibility catchup branch remains source-only; B16 browser requests actual native hide2800ms and requires trusted events"]
        self.r.result["production18compat"]["status"]="passed" if legacy_rows and all(self.r.result["cases"].get(r["key"],{}).get("status")=="passed" for r in legacy_rows) else "failed" if legacy_rows else "not-provided"
        required_kinds=("day","resolved","closed","initial")
        self.r.result["production18compat"]["providedOriginalKinds"]=[k for k in required_kinds if "production18-"+k in self.sources]
        self.r.result["production18compat"]["allRequiredOriginalsCompleted"]=all(self.r.result["cases"].get("production18compat-"+k,{}).get("status")=="passed" for k in required_kinds)
        self.r.result["releaseCoverageComplete"]=bool(legacy_rows) and self.r.result["production18compat"]["allRequiredOriginalsCompleted"] \
            and bool(self.r.result["plannedCases"]) and len(self.r.result["cases"])==len(self.r.result["plannedCases"]) \
            and all(v["cases"] and v["allActuallyAttempted"] and v["allActualCasesPassed"] for v in self.r.result["coverage"].values())
        self.r.persist()
