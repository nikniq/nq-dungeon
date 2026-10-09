// Dungeon Adventure — a small roguelike on a canvas.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const hpBar = document.getElementById('hpbar');
const logEl = document.getElementById('log');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const restartBtn = document.getElementById('restart');

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2 };
const COLORS = {
  wall: '#0b2230', wallDim: '#08192a', floor: '#1b4a62', floorDim: '#10303f',
  exit: '#5fe17a', player: '#ffd86b', gold: '#f5c542', potion: '#7bdfff', unknown: '#060c14',
};
const MONSTER_TYPES = [
  { name: 'Rat',    color: '#c98f5a', hp: 3,  atk: 1, xp: 2,  minFloor: 1 },
  { name: 'Goblin', color: '#7ad36b', hp: 5,  atk: 2, xp: 4,  minFloor: 1 },
  { name: 'Skeleton', color: '#dcdcdc', hp: 8, atk: 3, xp: 7, minFloor: 2 },
  { name: 'Orc',    color: '#ff6b6b', hp: 12, atk: 4, xp: 12, minFloor: 3 },
  { name: 'Wraith', color: '#b18cff', hp: 10, atk: 5, xp: 16, minFloor: 4 },
];
const FINAL_FLOOR = 5;
const VIEW_RADIUS = 7;

const cols = 40, rows = 30;
const tileSize = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
canvas.width = tileSize * cols;
canvas.height = tileSize * rows;

let map, seen, visible, monsters, potions, golds, exit;
let player, floor, gameOver, turn;

// ---------- helpers ----------
const rnd = (n) => Math.floor(Math.random() * n);
const inBounds = (x, y) => x > 0 && x < cols - 1 && y > 0 && y < rows - 1;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const getMonsterAt = (x, y) => monsters.find((m) => m.x === x && m.y === y);
const getPotionAt = (x, y) => potions.find((p) => p.x === x && p.y === y);
const getGoldAt = (x, y) => golds.find((g) => g.x === x && g.y === y);

function log(text, cls = '') {
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  logEl.prepend(li);
  while (logEl.children.length > 8) logEl.removeChild(logEl.lastChild);
}

function xpToNext(level) { return 10 + (level - 1) * 8; }

// ---------- map generation ----------
function createMap() {
  map = Array.from({ length: rows }, () => new Array(cols).fill(TILE.WALL));
  seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  // Rooms joined by L-shaped corridors: each new room is dug out and then
  // connected to the previous one, so every room is reachable.
  const rooms = [];
  const carve = (x, y) => { if (inBounds(x, y)) map[y][x] = TILE.FLOOR; };
  for (let attempt = 0; attempt < 60 && rooms.length < 9 + floor; attempt++) {
    const w = 4 + rnd(6), h = 3 + rnd(4);
    const x = 1 + rnd(cols - w - 2), y = 1 + rnd(rows - h - 2);
    const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
    if (rooms.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 1 && y + h + 1 > o.y)) continue;
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) carve(c, r);
    if (rooms.length) {
      const prev = rooms[rooms.length - 1];
      let cx = prev.cx, cy = prev.cy;
      const horizontalFirst = Math.random() < 0.5;
      const digX = () => { while (cx !== room.cx) { cx += Math.sign(room.cx - cx); carve(cx, cy); } };
      const digY = () => { while (cy !== room.cy) { cy += Math.sign(room.cy - cy); carve(cx, cy); } };
      if (horizontalFirst) { digX(); digY(); } else { digY(); digX(); }
    }
    rooms.push(room);
  }
  // A few extra links between random rooms so there are loops to escape through.
  for (let i = 0; i < 2 && rooms.length > 2; i++) {
    const a = rooms[rnd(rooms.length)], b = rooms[rnd(rooms.length)];
    let cx = a.cx, cy = a.cy;
    while (cx !== b.cx) { cx += Math.sign(b.cx - cx); carve(cx, cy); }
    while (cy !== b.cy) { cy += Math.sign(b.cy - cy); carve(cx, cy); }
  }
}

// Breadth-first distances from a point; used for exit placement and monster pathing.
function bfs(sx, sy, blockMonsters) {
  const d = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const q = [[sx, sy]];
  d[sy][sx] = 0;
  while (q.length) {
    const [cx, cy] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny) || map[ny][nx] === TILE.WALL || d[ny][nx] !== -1) continue;
      if (blockMonsters && getMonsterAt(nx, ny)) continue;
      d[ny][nx] = d[cy][cx] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}

function floorCells(exclude) {
  const out = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    if (map[r][c] === TILE.FLOOR && !exclude(c, r)) out.push({ x: c, y: r });
  }
  return out;
}

function placePlayer() {
  const cells = floorCells(() => false);
  const start = cells[rnd(cells.length)];
  player.x = start.x; player.y = start.y;
}

function placeExit() {
  // Put the exit on the floor cell farthest from the player, so each floor is a real trek.
  const d = bfs(player.x, player.y, false);
  let best = null, bestD = -1;
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    if (map[r][c] === TILE.FLOOR && d[r][c] > bestD) { bestD = d[r][c]; best = { x: c, y: r }; }
  }
  exit = best;
  map[exit.y][exit.x] = TILE.EXIT;
}

function placeMonsters() {
  monsters = [];
  const pool = MONSTER_TYPES.filter((t) => t.minFloor <= floor);
  const cells = floorCells((c, r) => dist({ x: c, y: r }, player) < 6);
  const count = 10 + floor * 3;
  for (let i = 0; i < count && cells.length; i++) {
    const cell = cells.splice(rnd(cells.length), 1)[0];
    const t = pool[rnd(pool.length)];
    monsters.push({ ...cell, type: t, hp: t.hp + Math.floor(floor / 2), maxHp: t.hp + Math.floor(floor / 2), atk: t.atk, awake: false });
  }
}

function placeItems() {
  potions = []; golds = [];
  const cells = floorCells((c, r) => (c === player.x && r === player.y) || getMonsterAt(c, r));
  for (let i = 0; i < 6 && cells.length; i++) {
    const cell = cells.splice(rnd(cells.length), 1)[0];
    potions.push({ ...cell, heal: 5 });
  }
  for (let i = 0; i < 8 + floor * 2 && cells.length; i++) {
    const cell = cells.splice(rnd(cells.length), 1)[0];
    golds.push({ ...cell, amount: 5 + rnd(10) + floor * 2 });
  }
}

// ---------- visibility ----------
function updateVisibility() {
  visible = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const d = bfs(player.x, player.y, false);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (d[r][c] !== -1 && d[r][c] <= VIEW_RADIUS) {
      visible[r][c] = true; seen[r][c] = true;
      // Reveal the walls that border visible floor so corridors have edges.
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = c + dx, ny = r + dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && map[ny][nx] === TILE.WALL) {
          visible[ny][nx] = true; seen[ny][nx] = true;
        }
      }
    }
  }
}

// ---------- drawing ----------
function draw() {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = map[r][c];
    // The whole layout is always drawn; the lit area around the player is
    // brighter, and only monsters and items are hidden outside it.
    let color;
    if (visible[r][c]) color = t === TILE.WALL ? COLORS.wall : t === TILE.EXIT ? COLORS.exit : COLORS.floor;
    else color = t === TILE.WALL ? COLORS.wallDim : t === TILE.EXIT ? '#2f7a43' : COLORS.floorDim;
    ctx.fillStyle = color;
    ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
  }
  const now = performance.now();
  for (const g of golds) {
    if (!visible[g.y][g.x]) continue;
    const cx = g.x * tileSize + tileSize / 2, cy = g.y * tileSize + tileSize / 2;
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 5, cy);
    ctx.closePath(); ctx.fill();
  }
  for (const p of potions) {
    if (!visible[p.y][p.x]) continue;
    const cx = p.x * tileSize + tileSize / 2, cy = p.y * tileSize + tileSize / 2;
    const pulse = 1 + 0.25 * Math.sin(now / 300 + p.x + p.y);
    const rad = Math.max(3, (tileSize / 4) * pulse);
    ctx.fillStyle = 'rgba(123,223,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.potion; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
  }
  for (const m of monsters) {
    if (!visible[m.y][m.x]) continue;
    ctx.fillStyle = m.type.color;
    ctx.fillRect(m.x * tileSize + 2, m.y * tileSize + 2, tileSize - 4, tileSize - 4);
    if (m.hp < m.maxHp) {
      ctx.fillStyle = '#300';
      ctx.fillRect(m.x * tileSize + 2, m.y * tileSize, tileSize - 4, 2);
      ctx.fillStyle = '#f33';
      ctx.fillRect(m.x * tileSize + 2, m.y * tileSize, (tileSize - 4) * (m.hp / m.maxHp), 2);
    }
    if (!m.awake) {
      ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
      ctx.fillText('z', m.x * tileSize + tileSize - 7, m.y * tileSize + 9);
    }
  }
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(player.x * tileSize + 2, player.y * tileSize + 2, tileSize - 4, tileSize - 4);
}

function updateStats() {
  statsEl.textContent = `Floor ${floor}/${FINAL_FLOOR} | HP ${player.hp}/${player.maxHp} | ATK ${player.atk} | Lv ${player.level} (${player.xp}/${xpToNext(player.level)} XP) | Gold ${player.gold}`;
  hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  hpBar.style.background = player.hp / player.maxHp > 0.5 ? '#5fe17a' : player.hp / player.maxHp > 0.25 ? '#f5c542' : '#ff6b6b';
}

// ---------- combat ----------
function gainXp(n) {
  player.xp += n;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    player.maxHp += 4; player.atk += 1; player.hp = player.maxHp;
    log(`Level up! You are now level ${player.level}. HP and attack increased.`, 'good');
  }
}

function playerAttack(m) {
  const dmg = player.atk + rnd(2);
  m.hp -= dmg; m.awake = true;
  if (m.hp <= 0) {
    monsters = monsters.filter((x) => x !== m);
    log(`You slay the ${m.type.name} (+${m.type.xp} XP).`, 'good');
    gainXp(m.type.xp);
  } else {
    log(`You hit the ${m.type.name} for ${dmg}.`);
  }
}

function monsterAttack(m) {
  const dmg = Math.max(1, m.atk - (player.level > 3 ? 1 : 0));
  player.hp -= dmg;
  log(`${m.type.name} hits you for ${dmg}.`, 'bad');
}

function stepMonsters() {
  const d = bfs(player.x, player.y, false);
  for (const m of monsters.slice()) {
    if (m.hp <= 0) continue;
    if (!m.awake && visible[m.y][m.x] && dist(m, player) <= 6 && Math.random() < 0.7) m.awake = true;
    if (dist(m, player) === 1) { monsterAttack(m); continue; }
    if (!m.awake) continue;
    // Chase: step to the neighbour closest to the player, falling back to a random step.
    let best = null, bestD = d[m.y][m.x];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = m.x + dx, ny = m.y + dy;
      if (map[ny][nx] === TILE.WALL || getMonsterAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
      if (d[ny][nx] !== -1 && d[ny][nx] < bestD) { bestD = d[ny][nx]; best = [nx, ny]; }
    }
    if (!best && Math.random() < 0.5) {
      const [dx, dy] = dirs[0];
      const nx = m.x + dx, ny = m.y + dy;
      if (map[ny][nx] === TILE.FLOOR && !getMonsterAt(nx, ny) && !(nx === player.x && ny === player.y)) best = [nx, ny];
    }
    if (best) { m.x = best[0]; m.y = best[1]; }
  }
}

function endGame(title, text) {
  gameOver = true;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.add('show');
}

function nextFloor() {
  floor++;
  if (floor > FINAL_FLOOR) {
    endGame('You escaped!', `You cleared all ${FINAL_FLOOR} floors with ${player.gold} gold at level ${player.level}. Press R to play again.`);
    return;
  }
  log(`You descend to floor ${floor}.`, 'good');
  buildFloor();
}

function tryMove(dx, dy) {
  if (gameOver) return;
  const nx = player.x + dx, ny = player.y + dy;
  if (!inBounds(nx, ny) || map[ny][nx] === TILE.WALL) return;
  const m = getMonsterAt(nx, ny);
  if (m) {
    playerAttack(m);
  } else {
    player.x = nx; player.y = ny;
    const pot = getPotionAt(nx, ny);
    if (pot) {
      const healed = Math.min(pot.heal, player.maxHp - player.hp);
      player.hp += healed;
      potions = potions.filter((p) => p !== pot);
      log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
    }
    const g = getGoldAt(nx, ny);
    if (g) {
      player.gold += g.amount;
      golds = golds.filter((x) => x !== g);
      log(`You pick up ${g.amount} gold.`, 'good');
    }
    if (map[ny][nx] === TILE.EXIT) { nextFloor(); if (gameOver) { updateStats(); return; } updateVisibility(); updateStats(); draw(); return; }
  }
  turn++;
  stepMonsters();
  updateVisibility();
  updateStats();
  if (player.hp <= 0) {
    player.hp = 0; updateStats();
    endGame('You died', `You fell on floor ${floor} after ${turn} turns with ${player.gold} gold. Press R to try again.`);
  }
  draw();
}

function wait() { if (!gameOver) tryMove(0, 0); }

// ---------- input ----------
const KEYS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1], k: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1], j: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], h: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0], l: [1, 0],
};
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') { init(); return; }
  if (e.key === '.' || e.key === ' ') { e.preventDefault(); wait(); return; }
  const dir = KEYS[e.key];
  if (dir) { e.preventDefault(); tryMove(dir[0], dir[1]); }
});
document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const [dx, dy] = btn.dataset.move.split(',').map(Number);
    if (dx === 0 && dy === 0) wait(); else tryMove(dx, dy);
  });
});
restartBtn.addEventListener('click', init);
overlay.addEventListener('click', init);

// ---------- setup ----------
function buildFloor() {
  createMap();
  placePlayer();
  placeExit();
  placeMonsters();
  placeItems();
  updateVisibility();
}

function init() {
  player = { x: 1, y: 1, hp: 20, maxHp: 20, atk: 3, level: 1, xp: 0, gold: 0 };
  floor = 1; gameOver = false; turn = 0;
  overlay.classList.remove('show');
  logEl.innerHTML = '';
  buildFloor();
  log('You enter the dungeon. Find the green exit on each floor.');
  updateStats(); draw();
}

function loop() { if (!gameOver) draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
init();
