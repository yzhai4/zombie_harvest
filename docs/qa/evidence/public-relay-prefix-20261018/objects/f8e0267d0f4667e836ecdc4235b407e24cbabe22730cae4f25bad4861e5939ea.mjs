// Method-only navigation over observations supplied by the public viewport.
// No game imports, WorldSnapshot, native save, hidden coordinates or execution.
const key=p=>Math.round(p.x)+','+Math.round(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const directions=[[1,0,'ArrowRight','east'],[0,1,'ArrowDown','south'],[-1,0,'ArrowLeft','west'],[0,-1,'ArrowUp','north']];
export function createPublicNavigation({known=new Map(),blockedEdges=new Set()}={}){
  const exhausted=new Map(),returnRetired=new Set();let initial=null,restPosition=null,frontier=null,waypoint=null,lastDecision=null,returnProbes=0;
  const passable=p=>{const t=known.get(key(p));return !!t&&!t.water&&!t.building;};
  const unknown=p=>directions.filter(([dx,dy])=>!known.has(key({x:p.x+dx,y:p.y+dy}))).map(d=>d[3]);
  const signature=p=>unknown(p).join('|');
  function retire(p,reason){const k=key(p);exhausted.delete(k);exhausted.set(k,{signature:signature(p),reason});if(exhausted.size>128)exhausted.delete(exhausted.keys().next().value);if(frontier&&key(frontier)===k)frontier=null;waypoint=null;}
  function observe(v){
    if(!initial&&v.player)initial={...v.player,observedAt:v.at};
    for(const t of v.tiles||[])if(t.visible!==false&&!(t.classes||[]).includes('fogged')&&[t.x,t.y].every(Number.isFinite))known.set(key(t),{...t,observedAt:known.get(key(t))?.observedAt??v.at,lastObservedAt:v.at,source:'public viewport tile'});
    if(v.player&&(v.buttons||[]).some(b=>/^campRest(30|60)$/.test(b.context||'')&&!b.disabled))restPosition={...v.player,observedAt:v.at,source:'public player position with enabled campRest context',navigationArrival:.2,returnKind:'observed-rest'};
  }
  function component(v){
    if(!v.player)return {nodes:[],previous:new Map()};
    let start={x:Math.round(v.player.x),y:Math.round(v.player.y)};
    if(!passable(start)){const nearby=[...known.values()].filter(p=>passable(p)&&distance(p,v.player)<=.76).sort((a,b)=>distance(a,v.player)-distance(b,v.player));if(!nearby.length)return {nodes:[],previous:new Map()};start={x:nearby[0].x,y:nearby[0].y};}
    const nodes=[start],previous=new Map([[key(start),null]]);
    for(let i=0;i<nodes.length;i++)for(const[dx,dy]of directions){const p=nodes[i],q={x:p.x+dx,y:p.y+dy},k=key(q);if(previous.has(k)||!passable(q)||blockedEdges.has(key(p)+'>'+k))continue;previous.set(k,p);nodes.push(q);}
    return {nodes,previous};
  }
  function route(v,target,reach=1.01,part=component(v)){
    const end=part.nodes.find(p=>distance(p,target)<=reach+1e-8);if(!end)return null;
    const result=[];for(let p=end;p;p=part.previous.get(key(p)))result.push(p);return result.reverse();
  }
  function chooseExploration(v,markers=[]){
    const part=component(v),reachable=markers.filter(p=>route(v,p,1.01,part)),deferred=markers.filter(p=>!reachable.includes(p)).map(p=>({x:p.x,y:p.y,tag:p.tag,observedAt:p.observedAt,reason:'no connection in observed component; retained'}));
    const marker=reachable.sort((a,b)=>distance(v.player,a)-distance(v.player,b))[0];
    if(marker){frontier=null;lastDecision={kind:'marker',goal:{x:marker.x,y:marker.y,tag:marker.tag,observedAt:marker.observedAt},reachableNodes:part.nodes.length,deferred};return {goal:marker,kind:'marker',decision:lastDecision};}
    if(frontier&&distance(v.player,frontier)<=.2)retire(frontier,'arrived within0.2; fresh public observation already sampled');
    if(frontier&&!route(v,frontier,.2,part))retire(frontier,'no longer connected after public movement observation');
    if(!frontier){
      const candidates=part.nodes.filter(p=>unknown(p).length&&exhausted.get(key(p))?.signature!==signature(p));
      for(const p of candidates.filter(p=>distance(v.player,p)<=.2))retire(p,'current public observation at frontier center yielded no remaining new tile');
      frontier=candidates.filter(p=>distance(v.player,p)>.2&&exhausted.get(key(p))?.signature!==signature(p)).sort((a,b)=>b.x-a.x||distance(v.player,a)-distance(v.player,b)||a.y-b.y)[0]||null;
      if(frontier)frontier={...frontier,observedAt:known.get(key(frontier))?.observedAt,source:'observed reachable tile with an unknown four-neighbor'};
    }
    lastDecision={kind:'frontier',goal:frontier?{...frontier}:null,reachableNodes:part.nodes.length,unknownDirections:frontier?unknown(frontier):[],deferred,exhaustedCount:exhausted.size};
    return {goal:frontier,kind:'frontier',decision:lastDecision};
  }
  function plan(v,target,arrival=1.05){
    arrival=Math.min(arrival,target.navigationArrival??arrival);const targetId=target.x+','+target.y+'@'+arrival;
    if(distance(v.player,target)<=arrival){waypoint=null;return {arrived:true};}
    if(waypoint?.targetId!==targetId||!passable(waypoint.point)||distance(v.player,waypoint.point)<=.18)waypoint=null;
    if(!waypoint){const points=route(v,target,Math.min(1.01,arrival));if(!points)return {failed:'no route in observed reachable component'};waypoint={targetId,point:points.length>1?points[1]:points[0]};}
    const p=waypoint.point,dx=p.x-v.player.x,dy=p.y-v.player.y;
    const d=Math.abs(dx)>=Math.abs(dy)?directions.find(d=>d[0]===Math.sign(dx)):directions.find(d=>d[1]===Math.sign(dy));
    if(!d)return {failed:'no direction from continuous public position to latched waypoint'};
    return {key:d[2],holdMs:Math.max(35,Math.min(150,Math.round(Math.max(Math.abs(dx),Math.abs(dy))*420))),waypoint:{...p},goal:{x:target.x,y:target.y},arrival};
  }
  function recordMove(before,after,step){
    if(!after.player||distance(after.player,before.player)<.025){const d=directions.find(d=>d[2]===step.key);if(d)blockedEdges.add(key(before.player)+'>'+key({x:Math.round(before.player.x)+d[0],y:Math.round(before.player.y)+d[1]}));waypoint=null;return false;}return true;
  }
  function returnGoal(v){
    if(restPosition&&route(v,restPosition,.2))return {...restPosition};
    if(returnProbes>=3)return null;
    // Generic building is only a bounded public probe, never assumed a shelter.
    const named=[...known.values()].filter(t=>/临时营地|庇护所/.test(t.tag||'')).map(t=>({...t,returnKind:'named-public-marker'}));
    const generic=[...known.values()].filter(t=>t.building&&String(t.tag||'').trim()==='建筑').map(t=>({...t,returnKind:'generic-public-building'}));
    const candidates=[...named,...generic,...(initial?[{...initial,tag:'initial publicly observed player position',returnKind:'initial-public-position'}]:[])].filter(p=>!returnRetired.has(key(p))&&route(v,p,1.01));
    return candidates.sort((a,b)=>(a.returnKind==='initial-public-position')-(b.returnKind==='initial-public-position')||distance(a,initial||v.player)-distance(b,initial||v.player))[0]||null;
  }
  function retireReturn(p){if(!p||p.returnKind==='observed-rest'||returnRetired.has(key(p)))return false;returnRetired.add(key(p));returnProbes++;waypoint=null;return true;}
  return {observe,passable,component,route,chooseExploration,plan,recordMove,retireFrontier:retire,returnGoal,retireReturn,get decision(){return lastDecision;},get state(){return {exhaustedFrontiers:[...exhausted].map(([tile,v])=>({tile,...v})),returnProbes,waypoint,initialPublicPosition:initial,observedRestPosition:restPosition};}};
}
