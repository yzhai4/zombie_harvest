(() => {
  const canvas = document.querySelector('#gameCanvas');
  const ctx = canvas.getContext('2d');
  const toast = document.querySelector('#toast');
  const state = {
    cols: 14, rows: 18, tile: 30,
    player: { x: 7, y: 12, health: 82, stamina: 64 },
    resources: { wood: 36, stone: 18, food: 12 },
    nodes: [{ x: 3, y: 8, type: 'tree', amount: 4 }, { x: 11, y: 5, type: 'tree', amount: 3 }, { x: 2, y: 14, type: 'stone', amount: 3 }, { x: 11, y: 13, type: 'crop', amount: 2 }],
    walls: [{ x: 5, y: 11 }, { x: 6, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 }],
    zombies: [{ x: 2, y: 3, hp: 2 }, { x: 11, y: 4, hp: 2 }, { x: 10, y: 16, hp: 2 }],
    paused: false,
    wave: 138,
    lastTick: 0,
    attackFlash: 0,
  };

  const colors = { grass: '#244937', grass2: '#2a513d', path: '#5a503c', water: '#205260', wall: '#a17b51' };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const key = (x, y) => `${x},${y}`;
  const blocked = (x, y) => state.walls.some(w => w.x === x && w.y === y);

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio * rect.width / 420, 0, 0, ratio * rect.height / 560, 0, 0);
    draw();
  }
  function draw() {
    const W = 420, H = 560, tw = W / state.cols, th = H / state.rows;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.grass; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
      const n = (x * 9 + y * 3) % 11;
      ctx.fillStyle = n < 3 ? colors.grass2 : colors.grass;
      ctx.fillRect(x * tw, y * th, tw + 1, th + 1);
      if ((x * 3 + y * 7) % 17 === 0) { ctx.fillStyle = '#67905c'; ctx.fillRect(x * tw + tw * .22, y * th + th * .68, 2, 4); }
    }
    // Water strip and path.
    ctx.fillStyle = colors.water; ctx.fillRect(0, 0, tw * 2, H);
    ctx.fillStyle = colors.path; ctx.fillRect(tw * 2, th * 10, tw * 12, th * 2.6);
    ctx.fillStyle = '#78694b'; ctx.fillRect(tw * 6, th * 1, tw * 2.1, th * 17);
    // Fence perimeter and building.
    ctx.strokeStyle = '#c0925c'; ctx.lineWidth = 4; ctx.strokeRect(tw * 4.1, th * 9.8, tw * 6, th * 4.2);
    ctx.fillStyle = '#563d32'; ctx.fillRect(tw * 5.1, th * 10.25, tw * 3.9, th * 2.4);
    ctx.fillStyle = '#8b6147'; ctx.fillRect(tw * 5.25, th * 10.4, tw * 3.6, th * 1.1);
    ctx.fillStyle = '#2a201c'; ctx.fillRect(tw * 6.5, th * 11.45, tw * .85, th * 1.2);
    // Walls.
    state.walls.forEach(w => { ctx.fillStyle = colors.wall; ctx.fillRect(w.x * tw + 3, w.y * th + 5, tw - 6, th - 8); ctx.fillStyle = '#d7aa6e'; ctx.fillRect(w.x * tw + 5, w.y * th + 7, tw - 10, 3); });
    // Resource nodes.
    state.nodes.forEach(n => { if (n.amount <= 0) return; const cx = (n.x + .5) * tw, cy = (n.y + .55) * th; ctx.font = `${Math.round(tw * .9)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.type === 'tree' ? '🌲' : n.type === 'stone' ? '🪨' : '🌽', cx, cy); });
    // Zombies.
    state.zombies.forEach(z => { const cx = (z.x + .5) * tw, cy = (z.y + .55) * th; ctx.font = `${Math.round(tw * .84)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🧟', cx, cy); ctx.fillStyle = '#151612'; ctx.fillRect(cx - tw * .28, cy - th * .46, tw * .56, 3); ctx.fillStyle = '#ef795d'; ctx.fillRect(cx - tw * .28, cy - th * .46, tw * .56 * z.hp / 2, 3); });
    // Player ring and sprite.
    const px = (state.player.x + .5) * tw, py = (state.player.y + .54) * th;
    ctx.beginPath(); ctx.fillStyle = 'rgba(186, 228, 140, .2)'; ctx.arc(px, py + th * .18, tw * .42, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${Math.round(tw * 1.02)}px sans-serif`; ctx.fillText('🧑‍🌾', px, py);
    if (state.attackFlash > 0) { ctx.strokeStyle = '#ffc780'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, tw * .8, -.9, .8); ctx.stroke(); }
    // Compass/legend.
    ctx.textAlign = 'left'; ctx.font = '700 9px sans-serif'; ctx.fillStyle = 'rgba(230, 255, 198, .72)'; ctx.fillText('N', tw * 6.1, th * .7);
  }
  function message(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(message.timer); message.timer = setTimeout(() => toast.classList.remove('show'), 1800); }
  function updateHud() {
    document.querySelector('#healthText').textContent = `${state.player.health}/100`; document.querySelector('#healthBar').style.width = `${state.player.health}%`;
    document.querySelector('#staminaText').textContent = `${state.player.stamina}/100`; document.querySelector('#staminaBar').style.width = `${state.player.stamina}%`;
    document.querySelector('#woodText').textContent = state.resources.wood; document.querySelector('#stoneText').textContent = state.resources.stone; document.querySelector('#foodText').textContent = state.resources.food;
    const mins = String(Math.floor(state.wave / 60)).padStart(2, '0'); const secs = String(state.wave % 60).padStart(2, '0'); document.querySelector('#waveText').textContent = `${mins}:${secs}`;
  }
  function move(dx, dy) {
    if (state.paused) return;
    const nx = clamp(state.player.x + dx, 2, state.cols - 1), ny = clamp(state.player.y + dy, 0, state.rows - 1);
    if (blocked(nx, ny)) { message('围栏挡住了去路'); return; }
    state.player.x = nx; state.player.y = ny; state.player.stamina = clamp(state.player.stamina - 1, 0, 100); draw(); updateHud();
  }
  function gather() {
    const target = state.nodes.find(n => n.amount > 0 && Math.abs(n.x - state.player.x) + Math.abs(n.y - state.player.y) <= 1);
    if (!target) { message('靠近树、石头或作物才能采集'); return; }
    if (state.player.stamina < 5) { message('体力不足，先吃点东西'); return; }
    target.amount--; state.player.stamina -= 5;
    const type = target.type === 'tree' ? 'wood' : target.type === 'stone' ? 'stone' : 'food'; state.resources[type] += target.type === 'crop' ? 2 : 3;
    message(target.type === 'crop' ? '收获了 2 份食物' : `获得了 ${target.type === 'tree' ? '3 木材' : '3 石块'}`); draw(); updateHud();
  }
  function build() {
    if (state.resources.wood < 6) { message('木材不够，需要 6'); return; }
    const candidates = [{ x: state.player.x + 1, y: state.player.y }, { x: state.player.x - 1, y: state.player.y }, { x: state.player.x, y: state.player.y + 1 }, { x: state.player.x, y: state.player.y - 1 }];
    const spot = candidates.find(p => p.x > 1 && p.x < state.cols - 1 && p.y >= 0 && p.y < state.rows && !blocked(p.x, p.y) && !(p.x === state.player.x && p.y === state.player.y));
    if (!spot) { message('这里没有可建造的位置'); return; }
    state.walls.push(spot); state.resources.wood -= 6; message('围栏建好了，今晚更安全'); draw(); updateHud();
  }
  function attack() {
    if (state.player.stamina < 8) { message('体力不足，无法挥砍'); return; }
    state.player.stamina -= 8; state.attackFlash = 1;
    const z = state.zombies.find(z => Math.abs(z.x - state.player.x) + Math.abs(z.y - state.player.y) <= 1);
    if (z) { z.hp--; if (z.hp <= 0) { state.zombies = state.zombies.filter(item => item !== z); message('僵尸倒下了'); } else message('命中！再来一下'); } else message('挥砍落空，别浪费体力');
    draw(); updateHud(); setTimeout(() => { state.attackFlash = 0; draw(); }, 160);
  }
  function tick(now) {
    if (!state.paused && now - state.lastTick > 1000) {
      state.lastTick = now; state.wave = Math.max(0, state.wave - 1);
      if (state.wave === 0) { state.wave = 180; state.zombies.push({ x: 2 + Math.floor(Math.random() * 10), y: 1, hp: 2 }); message('尸潮来袭！守住营地'); }
      if (state.player.stamina < 100) state.player.stamina = clamp(state.player.stamina + 1, 0, 100);
      updateHud();
    }
    requestAnimationFrame(tick);
  }
  document.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => ({ up: move(0, -1), down: move(0, 1), left: move(-1, 0), right: move(1, 0) }[btn.dataset.move])));
  document.querySelector('#gatherButton').addEventListener('click', gather); document.querySelector('#buildButton').addEventListener('click', build); document.querySelector('#attackButton').addEventListener('click', attack);
  document.querySelector('#pauseButton').addEventListener('click', () => { state.paused = !state.paused; document.querySelector('#pauseButton').textContent = state.paused ? '▶' : 'Ⅱ'; message(state.paused ? '游戏已暂停' : '继续行动'); });
  document.querySelector('#bagButton').addEventListener('click', () => message('背包：绷带 × 2，旧手电 × 1'));
  document.querySelector('#mapButton').addEventListener('click', () => message('探索模式即将开放'));
  document.querySelector('#craftButton').addEventListener('click', () => message('制作台：短斧、木栅栏、诱饵'));
  document.querySelector('#questButton').addEventListener('click', () => message('任务：修好 3 格北侧围栏，奖励 20 木材'));
  window.addEventListener('resize', resize); resize(); updateHud(); requestAnimationFrame(tick);
})();
