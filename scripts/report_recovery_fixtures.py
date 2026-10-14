"""Declarative B1-B16 mutations of verified public saves; never gameplay.

No reducer, successful battle receipt, or resident is manufactured here.
Timestamp changes and corrupted receipt references are explicit fixture
mutations. Envelopes/checksums are built by real JS in
the browser runner, before the game loader. Source files remain untouched.
"""
from __future__ import annotations

import copy


def payload_of(envelope):
    if not isinstance(envelope, dict) or not isinstance(envelope.get("payload"), dict):
        raise ValueError("full source envelope required")
    return copy.deepcopy(envelope["payload"])


def close_evidence(payload, threat_id):
    commands = payload["worldMeta"]["replay"]["commands"]
    events = [e for e in payload["worldMeta"]["events"] if e["type"] == "threat.closed" and e.get("payload", {}).get("threatId") == threat_id]
    if len(events) != 1:
        raise ValueError("real closed source must have one specific close event")
    event = events[0]
    linked = [c for c in commands if c["commandId"] == event["commandId"] and c["type"] == "threat.close" and c.get("payload", {}).get("threatId") == threat_id]
    if len(linked) != 1:
        raise ValueError("real closed source lacks unique exact replay join")
    return event


def cases(day_envelope, resolved_envelope, closed_envelope):
    day, resolved, closed = map(payload_of, (day_envelope, resolved_envelope, closed_envelope))
    battle = resolved.get("nightBattle")
    if not isinstance(battle, dict) or battle.get("resolved") is not True or not battle.get("instanceId"):
        raise ValueError("full real resolved source required")
    threat_id = battle["instanceId"]
    closed_event = close_evidence(closed, threat_id)
    if closed.get("nightBattle") is not None:
        raise ValueError("closed source still has battle")
    if len({n["id"] for n in day["npcs"]}) != 10 or len({n["id"] for n in resolved["npcs"]}) != 10:
        raise ValueError("full fixed-roster public sources required")
    actual_resolved = [e for e in resolved["worldMeta"]["events"] if e["type"] == "threat.resolved" and e.get("payload", {}).get("threatId") == threat_id]
    if len(actual_resolved) != 1 or actual_resolved[0]["seq"] >= closed_event["seq"]:
        raise ValueError("matching real resolved/closed order required")
    rows = []

    def add(key, group, baseline, phase, mutations=(), **extra):
        row = {"key": key, "group": group, "payload": copy.deepcopy(baseline), "phase": phase,
               "mutations": list(mutations), "source": "closed" if baseline is closed else "day" if baseline is day else "resolved"}
        row.update(extra)
        rows.append(row)
        return row["payload"]

    add("DAY-control", "DAY", day, "day", public_gather_route=True)
    add("B1-complete-resolved", "B1", resolved, "report", close=True)
    p = add("B2-contradictory-night-false", "B2", resolved, "report", ["night=false; requires one resolved-night-flag migration"], close=True,
        migration=True,migration_instance=threat_id,migration_reason="resolved-night-flag")
    p["night"] = False
    retained = copy.deepcopy(closed)
    retained["nightBattle"], retained["night"] = copy.deepcopy(battle), True
    # Freeze already-closed DAY for exact no-compensation checks; a separate
    # normal DAY control proves the actual public clock advances.
    retained["worldMeta"]["clock"]["paused"] = True
    add("B3-already-closed-residue", "B3", retained, "closed-day", ["reattach matching real resolved battle", "night=true", "clock.paused=true"], expected_close=closed_event, source="closed", migration=True, migration_instance=threat_id)
    p = add("B4-empty-close-compatible", "B4", retained, "closed-day", ["exact real close payload={}", "reattach matching battle", "clock.paused=true"], expected_close=closed_event, source="closed", migration=True, migration_instance=threat_id)
    next(e for e in p["worldMeta"]["events"] if e["eventId"] == closed_event["eventId"])["payload"] = {}
    for label in ("wrong-command", "wrong-threat", "wrong-type", "nonempty-no-id", "missing-replay", "duplicate-command"):
        p = add("B4-reject-" + label, "B4", retained, "recovery", ["invalid exact close/replay linkage: " + label], source="closed")
        event = next(e for e in p["worldMeta"]["events"] if e["eventId"] == closed_event["eventId"])
        command = next(c for c in p["worldMeta"]["replay"]["commands"] if c["commandId"] == closed_event["commandId"])
        if label == "wrong-command": event["commandId"] = "qa-no-such-command"
        elif label == "wrong-threat": event["payload"]["threatId"] = "qa-wrong-threat"
        elif label == "wrong-type": command["type"] = "resource.collect"
        elif label == "nonempty-no-id": event["payload"] = {"day": p["day"]}
        elif label == "missing-replay": p["worldMeta"]["replay"]["commands"].remove(command)
        else: p["worldMeta"]["replay"]["commands"].append(copy.deepcopy(command))
    started = [e for e in resolved["worldMeta"]["events"] if e["type"] == "threat.started" and f"threat-{e['payload']['day']}-{e['payload']['hour']}-{e['tick']['world'] % 60}-{e['seq']}" == threat_id]
    if len(started) != 1:
        raise ValueError("old writer exact started reference is unavailable")
    start = started[0]
    start_commands = [c for c in resolved["worldMeta"]["replay"]["commands"] if c["commandId"] == start["commandId"]]
    if len(start_commands) != 1 or start_commands[0]["type"] != "threat.start" or start["seq"] >= actual_resolved[0]["seq"]:
        raise ValueError("precise real started/replay/resolved causation required")
    clock = start["tick"]["world"]
    if start["payload"]["day"] != clock // 1440 + 1 or start["payload"]["hour"] != (clock % 1440) // 60:
        raise ValueError("old writer start tick/calendar mismatch")
    for label in ("legacy-id", "explicit-start-reference"):
        p = add("B5-" + label, "B5", resolved, "report", ["omit instanceId", "add precise legacy reference: " + label], migration=True, close=True, migration_instance=threat_id)
        p["nightBattle"].pop("instanceId")
        if label == "legacy-id": p["nightBattle"]["id"] = threat_id
        else:
            p["nightBattle"]["startedEventId"] = start["eventId"]
            p["nightBattle"]["startCommandId"] = start["commandId"]
    for label in ("wrong-legacy-id", "unique-resolved-without-reference"):
        p = add("B5-no-guess-" + label, "B5", resolved, "legacy-day", ["omit instanceId", "legacy reference cannot prove report identity: " + label, "clock.paused=true"], migration=True, migration_instance=None)
        p["nightBattle"].pop("instanceId")
        if label == "wrong-legacy-id": p["nightBattle"]["id"] = "qa-wrong-sequence-id"
        p["worldMeta"]["clock"]["paused"] = True
    p = add("B5-wrong-start-sequence", "B5", resolved, "legacy-day", ["omit instanceId", "start event reference wrong seq", "clock.paused=true"], migration=True, migration_instance=None)
    p["nightBattle"].pop("instanceId")
    p["nightBattle"]["startedEventId"] = "evt-qa-wrong-seq"
    p["nightBattle"]["startCommandId"] = start["commandId"]
    p["worldMeta"]["clock"]["paused"] = True
    p = add("B6-unidentified-missing-arrays", "B6", resolved, "legacy-day", ["omit all report identity references", "omit historical feed/enemies/supportIds", "clock.paused=true"], migration=True, migration_instance=None)
    for field in ("instanceId", "id", "startedEventId", "startCommandId", "feed", "enemies", "supportIds"):
        p["nightBattle"].pop(field, None)
    p["worldMeta"]["clock"]["paused"] = True
    p = add("B6-global-critical-array-invalid", "B6", resolved, "recovery", ["worldMeta.events becomes object"])
    p["worldMeta"]["events"] = {}
    receipt_stats = actual_resolved[0]["payload"]
    p = add("B7-missing-historical-stats", "B7", resolved, "report", ["omit battle kills/breaches/finalDamage/wallDamage/npcDeaths/feed/enemies/supportIds; retain exact resolved receipt statistics"], missing_stats=True, close=True,
        display_stats={"kills":receipt_stats["kills"],"breaches":receipt_stats["breaches"],"damage":receipt_stats["damage"],"walls":None,"npcDeaths":None}, receipt_backed_stats=True)
    for field in ("kills", "breaches", "finalDamage", "wallDamage", "npcDeaths", "feed", "enemies", "supportIds"):
        p["nightBattle"].pop(field, None)
    p = add("B7-battle-and-receipt-stats-missing", "B7", resolved, "report", ["offline omit battle statistical/history fields", "offline omit only kills/breaches/damage from exact resolved receipt; retain eventId/seq/type/tick/threatId/route and all identity/causation"], missing_stats=True, close=True,
        display_stats={"kills":None,"breaches":None,"damage":None,"walls":None,"npcDeaths":None})
    for field in ("kills", "breaches", "finalDamage", "wallDamage", "npcDeaths", "feed", "enemies", "supportIds"):
        p["nightBattle"].pop(field, None)
    receipt=next(e for e in p["worldMeta"]["events"] if e["eventId"]==actual_resolved[0]["eventId"])
    for field in ("kills","breaches","damage"): receipt["payload"].pop(field, None)
    for group, include in (("B8", True), ("B9", False)):
        p = add(group + "-loss", group, resolved, "loss", ["HP=0", "finalDamage/campDamage=stored hpBefore", "retain original resolved.damage0; explicit offline stored-result conflict cannot confirm report identity", "gameOver=lose" if include else "omit gameOver"],
            migration=not include,migration_instance=None,restart=True,identity_conflict="battle finalDamage100 versus original resolved.damage0; migration instance must remain null")
        p["hp"] = 0
        p["nightBattle"]["finalDamage"] = p["nightBattle"]["campDamage"] = battle["hpBefore"]
        if include: p["gameOver"] = "lose"
        else: p.pop("gameOver", None)
    for label in ("unknown-terminal", "invalid-terminal-type", "isolated-hp-zero", "lose-with-positive-hp", "night-without-battle", "array-envelope"):
        source = day if label in ("isolated-hp-zero", "night-without-battle", "array-envelope") else resolved
        p = add("B10-" + label, "B10", source, "recovery", ["terminal/integrity contradiction: " + label], raw_kind="array" if label == "array-envelope" else None)
        if label == "unknown-terminal": p["gameOver"], p["hp"] = "unknown-future-ending", 0
        elif label == "invalid-terminal-type": p["gameOver"] = {"kind": "lose"}
        elif label == "isolated-hp-zero": p["hp"] = 0
        elif label == "lose-with-positive-hp": p["gameOver"] = "lose"
        elif label == "night-without-battle": p["night"], p["nightBattle"] = True, None
    p = add("B11-unresolved-with-safe-backup", "B11", resolved, "recover-backup", ["battle.resolved=false", "real DAY envelope in .bak"], backup="day", migration=True, rollback=True)
    p["nightBattle"]["resolved"] = False
    for label in ("unresolved-no-backup", "malformed-battle-invalid-backup"):
        p = add("B12-" + label, "B12", resolved, "recovery", ["unsafe battle, no valid backup: " + label], restart_after_reloads=True, backup_raw="{bad JSON" if "malformed" in label else None)
        p["nightBattle"]["resolved"] = False
        if "malformed" in label: p["nightBattle"]["enemies"] = None
    for label in ("bad-json", "bad-checksum", "critical-structure"):
        p = add("B13-" + label + "-with-resolved-backup", "B13", day, "recover-backup", ["invalid main " + label, "real resolved envelope in .bak"], backup="resolved", migration=True, rollback=True, raw_kind=label)
        if label == "critical-structure": p["npcs"] = [copy.deepcopy(p["npcs"][0])]
    p = add("B14-spent-cp-roster-outpost", "B14", resolved, "report", ["trust80/collapse10, spent CP1/max4 granted current day", "ration/upkeep current day", "same existing IDs: carpenter injured, guardJi dead, guardChen garrisoned", "secured watermill upkeep already paid"], close=False, complex_invariants=True)
    cs = p["contentState"]
    cs["meters"].update(campTrust=80, campCollapse=10)
    cs.update(commandPoints=1, commandPointsMax=4, commandPointsGrantedDay=p["day"])
    p["world"].update(lastRationDay=p["day"], lastDailyUpkeepDay=p["day"])
    injured, dead, guard = (next(n for n in p["npcs"] if n["id"] == key) for key in ("carpenter", "guardJi", "guardChen"))
    injured.update(hp=40, lifeState="injured", wounds=[{"type": "qa-explicit-stored-wound", "severity": 2, "healed": False}])
    dead.update(hp=0, lifeState="dead", supportRequested=False, order=None, currentOrder=None)
    guard.update(garrisonedOutpostId="waterMill", supportRequested=False, order=None, currentOrder=None, scheduleState="据点驻守")
    cs["outposts"]["waterMill"] = {"status": "secured", "guardNpcIds": [guard["id"]], "guardSlots": 2,
        "securedAt": (p["day"]-1)*1440+p["hour"]*60+p["minute"], "lastUpkeepDay": p["day"], "lastUpkeepResult": "paid", "vacancyReason": None}
    add("B15-report-public-restart", "B15", resolved, "report", [], restart=True, restart_button="restartSessionBtn", queue_required=False)
    p = add("B15-real-loss-pending-checkpoint", "B15", day, "real-loss-race", ["DAY HP1", "remove buildings for deterministic exposed defense", "supportRequested=false", "clock.paused=false"], queue_required=True)
    p["hp"], p["buildings"], p["worldMeta"]["clock"]["paused"] = 1, [], False
    for n in p["npcs"]: n["supportRequested"] = False
    p = add("B16-midnight-double-start-close-visibility", "B16", resolved, "report", ["stored report date23:59; keep real original event ledger/instance", "world.totalMinutes and scheduleMinutes reanchored by same date delta", "stored player SAN50 below cap to expose repeated close compensation"], close=True, duplicate_start=True, duplicate_close=True, visibility=True, pure_read=True)
    original_minute = (p["day"]-1)*1440+p["hour"]*60+p["minute"]
    p["hour"], p["minute"] = 23, 59
    p["world"]["totalMinutes"] = (p["day"]-1)*1440+1439
    p["worldMeta"]["clock"]["scheduleMinutes"] += p["world"]["totalMinutes"] - original_minute
    p["sanity"] = 50
    add("B16-loss-double-restart", "B16", rows[next(i for i,r in enumerate(rows) if r["key"]=="B8-loss")]["payload"], "loss", ["B8 explicit loss fields", "double public restart"], restart=True, duplicate_restart=True)
    return rows


def production18_rows(sources):
    rows=[]
    for kind in ("day","resolved","closed",*(["initial"] if "initial" in sources else [])):
        original=payload_of(sources[kind])
        if original.get("version")!=18 or "contentState" in original:
            raise ValueError("genuine absent-content SAVE18 source required")
        rows.append({"key":"production18compat-"+kind,"group":"production18compat","source":"production18-"+kind,
            "payload":original,"phase":"production18","legacy_kind":kind,"mutations":[],"migration":True})
    for label,value in (("null",None),("array",[]),("bad-object",{"contentVersion":"invalid"})):
        payload=payload_of(sources["day"]);payload["contentState"]=value
        rows.append({"key":"production18compat-reject-content-"+label,"group":"production18compat","source":"production18-day","payload":payload,
            "phase":"recovery","mutations":["derived genuine18 DAY: own contentState="+label+"; must reject, not use absent-field adapter"]})
    payload=payload_of(sources["day"]);payload["world"]["totalMinutes"]=0
    rows.append({"key":"production18compat-reject-world-noninitial","group":"production18compat","source":"production18-day","payload":payload,
        "phase":"recovery","mutations":["real DAY18 06:10 with world0; not the proven06:00/empty-ledger sentinel, must reject"]})
    return rows
