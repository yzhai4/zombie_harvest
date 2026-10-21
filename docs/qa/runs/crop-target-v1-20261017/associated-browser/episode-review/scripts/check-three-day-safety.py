"""Runner predicate controls plus real inline VM public meal/attack handlers.

No Playwright package is needed for these method controls. The game fixture is
an actual saved writer capture from the failed public run, not a fake event.
This test does not prove that the three-day browser route succeeds.
"""
from __future__ import annotations

import ast
import copy
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
source = ROOT / "scripts/server-three-days.py"
tree = ast.parse(source.read_text(encoding="utf-8"))
names = {"clock_minutes", "complete_event_window", "daytime_defense_budget", "daytime_action_dangers", "safety_meal_evidence"}
nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
assert {node.name for node in nodes} == names
secure_method = next(method for node in tree.body if isinstance(node, ast.ClassDef)
                     for method in node.body if isinstance(method, ast.FunctionDef) and method.name == "secure_training_area")
nodes.append(secure_method)
scope = {"math": math, "MAX_NAVIGATION_ATTACKS": 4}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), scope)
danger = scope["daytime_action_dangers"]
meal = scope["safety_meal_evidence"]
budget = scope["daytime_defense_budget"]
fixture_path = ROOT / "scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json"
fixture = json.loads(fixture_path.read_text(encoding="utf-8"))["payload"]
checks = []


def check(name, operation):
    try:
        assert operation()
        checks.append({"name": name, "ok": True})
    except Exception as error:
        checks.append({"name": name, "ok": False, "error": repr(error)})


check("actual failed-run threat is inside the long-action movement envelope",
      lambda: any(item["id"] == "wz-4" and item["distance"] < 2 for item in danger(fixture)))
dead = copy.deepcopy(fixture)
for enemy in dead["worldZombies"]:
    enemy["hp"] = 0
check("dead enemies do not reserve a safety intervention", lambda: danger(dead) == [])
runner = copy.deepcopy(dead)
runner["worldZombies"] = [{"id": "method-fast", "kind": "runner", "hp": 100,
    "x": runner["player"]["x"] + 8, "y": runner["player"]["y"], "speedFactor": 2}]
check("fast enemy outside six tiles still blocks a thirty-minute action", lambda: len(danger(runner)) == 1)
far = copy.deepcopy(runner)
far["worldZombies"][0]["x"] += 50
check("distant enemy does not cause unlimited defense retries", lambda: danger(far) == [])
bad = copy.deepcopy(runner)
bad["worldZombies"][0]["speedFactor"] = math.nan


def malformed_rejects():
    try:
        danger(bad)
    except ValueError:
        return True
    return False


check("invalid speed cannot silently make the safety envelope small", malformed_rejects)


class PermittedPublicAttack(Exception):
    pass


class DefenseGateFixture:
    """Run the actual pre-attack gate without opening a browser or clicking."""
    def __init__(self, kind, enemy_hp, player_hp):
        self.result = {}
        self.payload = {"player": {"x": 0, "y": 0}, "weapon": {"id": "rustAxe"}, "hp": player_hp,
                        "energy": 100, "food": 0, "worldZombies": [
                            {"id": "method-budget-enemy", "kind": kind, "hp": enemy_hp, "x": .5, "y": 0}]}

    def guard(self):
        pass

    def calendar(self):
        return 480

    def settle_save(self, *args):
        return {"envelope": {"payload": self.payload}}

    def survival(self, payload, stage):
        assert payload["hp"] > 0

    def check(self, name, condition, detail=None):
        assert condition, name

    def navigation_segment(self, *args):
        return {}

    def clear_navigation_threat(self, *args):
        raise PermittedPublicAttack()


def actual_defense_gate_allows(kind, enemy_hp, player_hp):
    try:
        scope["secure_training_area"](DefenseGateFixture(kind, enemy_hp, player_hp))
    except PermittedPublicAttack:
        return True
    except AssertionError as error:
        assert str(error) == "public defense has conservative health and energy budget", str(error)
        return False
    raise AssertionError("pre-attack gate neither rejected nor reached the public attack")


for kind, enemy_hp, expected in (("normal", 100, 26), ("runner", 100, 27), ("brute", 150, 68)):
    check(f"{kind} complete-fight budget includes its world bite and direct retaliation",
          lambda kind=kind, enemy_hp=enemy_hp, expected=expected: budget({"kind": kind, "hp": enemy_hp})["hpBudget"] == expected)
    check(f"{kind} actual defense gate rejects the exact reserve boundary",
          lambda kind=kind, enemy_hp=enemy_hp, expected=expected: not actual_defense_gate_allows(kind, enemy_hp, expected))
    check(f"{kind} actual defense gate permits only above the reserve boundary",
          lambda kind=kind, enemy_hp=enemy_hp, expected=expected: actual_defense_gate_allows(kind, enemy_hp, expected + 1))
check("brute 150HP versus player 51HP no longer passes the actual defense gate",
      lambda: not actual_defense_gate_allows("brute", 150, 51))


def unknown_kind_rejects(operation):
    try:
        operation()
    except ValueError as error:
        return "unsupported saved enemy kind" in str(error)
    return False


check("unknown defense profile fails closed", lambda: unknown_kind_rejects(lambda: budget({"kind": "unknown", "hp": 100})))
unknown = copy.deepcopy(runner)
unknown["worldZombies"][0].update(kind="unknown", x=1000)
check("even a distant unknown living enemy cannot bypass the long-action profile gate",
      lambda: unknown_kind_rejects(lambda: danger(unknown)))
program = r'''
import {readFileSync} from 'node:fs';
import {sourceRuntimeFactory,startRuntime,saveKey} from './scripts/lib/source-runtime-fixture.mjs';
const raw=readFileSync('scripts/fixtures/npc-threat-attention-v1/browser-writer-day1-1110-save21.json','utf8');
const r=startRuntime(sourceRuntimeFactory(),[[saveKey,raw]]);
function saved(){if(!r.api.save({force:true,reason:'TEST-ONLY-public-meal-control'}))throw Error('writer failed'); return JSON.parse(r.storage.get(saveKey)).payload;}
const before=saved();r.emit('eatBtn','click');const after=saved();
const attacks=[];
for(const [kind,hp] of [['normal',100],['runner',100],['brute',150]]){
  const q=startRuntime(sourceRuntimeFactory()),s=q.api.state;
  s.day=1;s.hour=8;s.minute=0;s.world.totalMinutes=480;s.hp=100;s.energy=100;s.buildings=[];
  s.npcs.forEach(n=>{n.x=0;n.y=0;n.supportRequested=false;n.behaviorState='work';});
  const enemy={id:'method-attack-'+kind,kind,hp,maxHp:hp,x:11.5,y:11,attackClock:2,
    aiState:'hunt',goal:{x:11,y:11},think:0,perception:{clock:0,targetId:'player-1',targetAt:480}};
  s.worldZombies=[enemy];
  const beforeHp=s.hp;q.emit('attackBtn','click');
  attacks.push({kind,enemyHp:hp,playerLoss:beforeHp-s.hp,enemyAfter:enemy.hp,
    worldBites:s.worldMeta.events.filter(e=>e.type==='combat.damage.applied'&&e.payload.targetId==='player-1').map(e=>e.payload.amount)});
}
process.stdout.write(JSON.stringify({before,after,attacks}));
'''
run = subprocess.run(["node", "--input-type=module", "-e", program], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
assert run.returncode == 0, run.stderr
actual = json.loads(run.stdout)
before, after = actual["before"], actual["after"]
for row in actual["attacks"]:
    profile = budget({"kind": row["kind"], "hp": row["enemyHp"]})
    check(f"actual inline {row['kind']} public attack matches both registered damage components",
          lambda row=row, profile=profile: row["playerLoss"] == profile["worldBite"] + profile["directRetaliation"]
          and row["worldBites"] == [profile["worldBite"]] and row["enemyAfter"] == row["enemyHp"] - 50)
check("actual inline public meal handler and full writer satisfy the method", lambda: meal(before, after) is not None)
check("old saved receipt is not a new meal", lambda: meal(before, before) is None)


def altered(operation):
    payload = copy.deepcopy(after)
    operation(payload)
    return meal(before, payload) is None


check("receipt without real food payment rejects", lambda: altered(lambda p: p.update(food=before["food"])))
check("receipt without restored health or energy rejects", lambda: altered(lambda p: p.update(hp=before["hp"], energy=before["energy"])))
check("cross-day ration ambiguity is not called a proven meal", lambda: altered(lambda p: p.update(day=p["day"] + 1)))


def duplicate_receipt(payload):
    receipt = next(event for event in reversed(payload["worldMeta"]["events"]) if event["type"] == "player.ate")
    extra = copy.deepcopy(receipt)
    extra["seq"] = payload["worldMeta"]["eventSeq"] + 1
    extra["eventId"] = "method-duplicate"
    payload["worldMeta"]["eventSeq"] += 1
    payload["worldMeta"]["events"].append(extra)


check("multiple meal receipts cannot be collapsed into one action", lambda: altered(duplicate_receipt))


def remove_command(payload):
    payload["worldMeta"]["replay"]["commands"] = [row for row in payload["worldMeta"]["replay"]["commands"] if row["type"] != "player.eat"]


check("missing real command rejects a purported meal", lambda: altered(remove_command))


def wrong_actor(payload):
    for row in payload["worldMeta"]["replay"]["commands"]:
        if row["type"] == "player.eat":
            row["actorId"] = "method-other-actor"


check("another actor command cannot explain the player meal", lambda: altered(wrong_actor))
report = {"runner": "three-day-safety-method-controls", "scope": "actual inline VM meal and attack handlers plus predicate controls; no browser completion claim",
          "checks": checks, "count": len(checks), "passed": sum(row["ok"] for row in checks),
          "sourceHtmlSha256": hashlib.sha256((ROOT / "dist/index.html").read_bytes()).hexdigest(),
          "runnerSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
          "fixtureSha256": hashlib.sha256(fixture_path.read_bytes()).hexdigest(), "naturalGameplay": False}
report["ok"] = report["passed"] == report["count"]
print(json.dumps(report, indent=2))
raise SystemExit(0 if report["ok"] else 1)
