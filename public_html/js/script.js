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

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2, SHOP: 3, INN: 4, FOUNTAIN: 5 };
const TOWN = 0; // floor number of the town square
const COLORS = {
  wall: '#0b2230', wallDim: '#08192a', floor: '#1b4a62', floorDim: '#10303f',
  exit: '#5fe17a', player: '#ffd86b', gold: '#f5c542', potion: '#7bdfff', unknown: '#060c14', shop: '#c084fc', inn: '#ff9ecf', fountain: '#3b82f6', townFloor: '#3a4a3a', townWall: '#5b4636',
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

let map, seen, visible, monsters, potions, golds, exit, shops;
let player, floor, gameOver, turn, kills;

// ---------- account save/load ----------
// window.DUNGEON is set by the page: user is true when someone is logged in.
const ACCOUNT = window.DUNGEON || { user: false };
const ITEMS = ACCOUNT.items || { weapons: {}, armor: {}, consumables: {}, bag_size: 12 };
const itemInfo = (id) => ITEMS.weapons[id] || ITEMS.armor[id] || ITEMS.consumables[id] || null;
const itemKind = (id) => ITEMS.weapons[id] ? 'weapon' : ITEMS.armor[id] ? 'armor' : 'consumable';
const weaponAtk = () => (player.weapon && ITEMS.weapons[player.weapon]) ? ITEMS.weapons[player.weapon].atk : 0;
const armorDef = () => (player.armor && ITEMS.armor[player.armor]) ? ITEMS.armor[player.armor].def : 0;

const SAVE_EVERY_TURNS = 20;

async function saveProgress(event, keepalive = false) {
  if (!ACCOUNT.user || !player) return;
  try {
    const res = await fetch(ACCOUNT.saveUrl, {
      method: 'POST',
      keepalive,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf },
      credentials: 'same-origin',
      body: JSON.stringify({ event, floor, level: player.level, xp: player.xp, gold: player.gold,
        hp: player.hp, max_hp: player.maxHp, atk: player.atk, kills,
        weapon: player.weapon, armor: player.armor, bag: player.bag }),
    });
    if (!res.ok) throw new Error(res.status);
    kills = 0; // counted server-side now
  } catch (e) {
    log('Could not save progress (' + e.message + ').', 'bad');
  }
}

async function loadProgress() {
  if (!ACCOUNT.user) return null;
  try {
    const res = await fetch(ACCOUNT.loadUrl, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    log('Could not load your hero (' + e.message + ').', 'bad');
    return null;
  }
}

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

function createTown() {
  // A walled square: houses around the edge, a fountain in the middle,
  // the merchant and the inn on the square, the dungeon entrance at the bottom.
  map = Array.from({ length: rows }, () => new Array(cols).fill(TILE.WALL));
  seen = Array.from({ length: rows }, () => new Array(cols).fill(true));
  for (let r = 3; r < rows - 3; r++) for (let c = 4; c < cols - 4; c++) map[r][c] = TILE.FLOOR;
  const house = (x, y, w, h) => { for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) map[r][c] = TILE.WALL; };
  house(6, 5, 6, 4); house(16, 4, 7, 3); house(28, 5, 6, 4);
  house(6, rows - 9, 6, 4); house(28, rows - 9, 6, 4);
  const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
  for (let r = cy - 1; r <= cy; r++) for (let c = cx - 1; c <= cx; c++) map[r][c] = TILE.FOUNTAIN;
  shops = [{ x: 12, y: 7 }]; map[7][12] = TILE.SHOP;          // merchant outside the top-left house
  map[7][27] = TILE.INN;                                        // inn outside the top-right house
  exit = { x: cx, y: rows - 4 }; map[exit.y][exit.x] = TILE.EXIT; // dungeon entrance
  player.x = cx; player.y = cy + 3;
  monsters = []; potions = []; golds = [];
}

const inTown = () => floor === TOWN;

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

function placeShop() {
  // A merchant stands a few steps from where you arrive on each floor.
  shops = [];
  const d = bfs(player.x, player.y, false);
  const cells = floorCells((c, r) => d[r][c] < 2 || d[r][c] > 6);
  if (!cells.length) return;
  const cell = cells[rnd(cells.length)];
  map[cell.y][cell.x] = TILE.SHOP;
  shops.push(cell);
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
  if (inTown()) { visible = Array.from({ length: rows }, () => new Array(cols).fill(true)); return; }
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
  if (!map) return;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = map[r][c];
    // The whole layout is always drawn; the lit area around the player is
    // brighter, and only monsters and items are hidden outside it.
    let color;
    if (t === TILE.FOUNTAIN) color = COLORS.fountain;
    else if (inTown()) color = t === TILE.WALL ? COLORS.townWall : t === TILE.EXIT ? COLORS.exit : COLORS.townFloor;
    else if (visible[r][c]) color = t === TILE.WALL ? COLORS.wall : t === TILE.EXIT ? COLORS.exit : COLORS.floor;
    else color = t === TILE.WALL ? COLORS.wallDim : t === TILE.EXIT ? '#2f7a43' : COLORS.floorDim;
    ctx.fillStyle = color;
    ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
  }
  if (inTown()) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (map[r][c] !== TILE.INN) continue;
      ctx.fillStyle = COLORS.inn;
      ctx.fillRect(c * tileSize + 2, r * tileSize + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = '#06202c';
      ctx.font = `bold ${Math.floor(tileSize * 0.8)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', c * tileSize + tileSize / 2, r * tileSize + tileSize / 2 + 1);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }
  for (const sh of shops) {
    ctx.fillStyle = COLORS.shop;
    ctx.fillRect(sh.x * tileSize + 2, sh.y * tileSize + 2, tileSize - 4, tileSize - 4);
    ctx.fillStyle = '#06202c';
    ctx.font = `bold ${Math.floor(tileSize * 0.75)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', sh.x * tileSize + tileSize / 2, sh.y * tileSize + tileSize / 2 + 1);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
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
    ctx.fillStyle = '#06202c';
    ctx.font = `bold ${Math.floor(tileSize * 0.7)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.type.name[0], m.x * tileSize + tileSize / 2, m.y * tileSize + tileSize / 2 + 1);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    if (!m.awake) {
      ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
      ctx.fillText('z', m.x * tileSize + tileSize - 7, m.y * tileSize + 9);
    }
  }
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(player.x * tileSize + 2, player.y * tileSize + 2, tileSize - 4, tileSize - 4);
  if (inspected) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(inspected.x * tileSize + 1, inspected.y * tileSize + 1, tileSize - 2, tileSize - 2);
  }
}

// ---------- inspecting tiles (hover / tap) ----------
const tipEl = document.getElementById('tip');
const legendEl = document.getElementById('legend');
let inspected = null;

function describeTile(x, y) {
  if (!map || !inBounds(x, y) || !visible[y][x]) return null;
  if (x === player.x && y === player.y) return `You — ${player.hp}/${player.maxHp} HP, attack ${player.atk}`;
  const m = getMonsterAt(x, y);
  if (m) return `${m.type.name} — ${m.hp}/${m.maxHp} HP, attack ${m.atk}${m.awake ? '' : ' (asleep)'}`;
  if (getPotionAt(x, y)) return 'Potion — restores 5 HP';
  const g = getGoldAt(x, y);
  if (g) return `Gold — ${g.amount} pieces`;
  if (map[y][x] === TILE.SHOP) return 'Merchant — step here to buy and sell gear';
  if (map[y][x] === TILE.INN) return 'Inn — step here to recover all your HP';
  if (map[y][x] === TILE.FOUNTAIN) return 'The town fountain';
  if (map[y][x] === TILE.EXIT && inTown()) return 'Dungeon entrance — step here to begin your descent';
  if (map[y][x] === TILE.EXIT) return 'Stairs down — the exit from this floor';
  return null;
}

function tileFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  return { x: Math.floor((e.clientX - rect.left) * sx / tileSize), y: Math.floor((e.clientY - rect.top) * sy / tileSize) };
}

function inspect(e) {
  const t = tileFromEvent(e);
  const text = describeTile(t.x, t.y);
  if (text) {
    inspected = t;
    tipEl.textContent = text;
    tipEl.classList.add('show');
    const rect = canvas.parentElement.getBoundingClientRect();
    tipEl.style.left = `${Math.min(e.clientX - rect.left + 12, rect.width - tipEl.offsetWidth - 8)}px`;
    tipEl.style.top = `${e.clientY - rect.top + 16}px`;
  } else {
    clearInspect();
  }
}

function clearInspect() {
  inspected = null;
  tipEl.classList.remove('show');
}

canvas.addEventListener('mousemove', inspect);
canvas.addEventListener('mouseleave', clearInspect);
canvas.addEventListener('click', inspect);

function buildLegend() {
  legendEl.innerHTML = '';
  const add = (swatchStyle, label, detail, glyph = '') => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="swatch" style="${swatchStyle}">${glyph}</span><b>${label}</b> <span class="muted">${detail}</span>`;
    legendEl.appendChild(li);
  };
  add(`background:${COLORS.player}`, 'You', '');
  for (const t of MONSTER_TYPES) {
    const locked = t.minFloor > Math.max(floor, 1);
    add(`background:${t.color};${locked ? 'opacity:.35' : ''}`, t.name, locked ? `from floor ${t.minFloor}` : `${t.hp} HP, attack ${t.atk}, ${t.xp} XP`, t.name[0]);
  }
  add(`background:${COLORS.potion};border-radius:50%`, 'Potion', '+5 HP');
  add(`background:${COLORS.gold};transform:rotate(45deg) scale(.7)`, 'Gold', '');
  add(`background:${COLORS.shop}`, 'Merchant', 'buy and sell', '$');
  if (inTown()) {
    add(`background:${COLORS.inn}`, 'Inn', 'full heal', '+');
    add(`background:${COLORS.exit}`, 'Entrance', 'into the dungeon');
  } else {
    add(`background:${COLORS.exit}`, 'Exit', 'stairs down');
  }
}

function updateStats() {
  statsEl.textContent = `${inTown() ? 'Town' : `Floor ${floor}/${FINAL_FLOOR}`} | HP ${player.hp}/${player.maxHp} | ATK ${player.atk}${weaponAtk() ? '+' + weaponAtk() : ''} | DEF ${armorDef()} | Lv ${player.level} (${player.xp}/${xpToNext(player.level)} XP) | Gold ${player.gold}`;
  renderInventory();
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
  const dmg = player.atk + weaponAtk() + rnd(2);
  m.hp -= dmg; m.awake = true;
  if (m.hp <= 0) {
    monsters = monsters.filter((x) => x !== m);
    kills++;
    log(`You slay the ${m.type.name} (+${m.type.xp} XP).`, 'good');
    gainXp(m.type.xp);
    dropLoot(m);
  } else {
    log(`You hit the ${m.type.name} for ${dmg}.`);
  }
}

function monsterAttack(m) {
  const dmg = Math.max(1, m.atk - armorDef());
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
    floor = TOWN;
    buildFloor();
    log(`You escaped the dungeon with ${player.gold} gold at level ${player.level}! The town square welcomes you back.`, 'good');
    saveProgress('win');
    return;
  }
  log(floor === 1 ? 'You descend into the dungeon.' : `You descend to floor ${floor}.`, 'good');
  buildFloor();
  saveProgress('progress');
}

function tryMove(dx, dy) {
  if (gameOver || !map) return;
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
    if (map[ny][nx] === TILE.SHOP) { openShop(); }
    if (map[ny][nx] === TILE.INN) {
      if (player.hp < player.maxHp) { player.hp = player.maxHp; log('You rest at the inn and recover fully.', 'good'); }
      else log('The innkeeper nods. You are already in perfect health.');
    }
    if (map[ny][nx] === TILE.EXIT) { nextFloor(); if (gameOver) { updateStats(); return; } updateVisibility(); updateStats(); draw(); return; }
  }
  turn++;
  if (turn % SAVE_EVERY_TURNS === 0) saveProgress('progress');
  stepMonsters();
  updateVisibility();
  updateStats();
  if (player.hp <= 0) {
    player.hp = 0; updateStats();
    endGame('You died', `You fell on floor ${floor} after ${turn} turns with ${player.gold} gold. Press R to try again.`);
    saveProgress('death');
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
  if (e.key === 'Escape') { closeShop(); return; }
  if (shopOpen) return;
  if (e.key === 'r' || e.key === 'R') { init(); return; }
  if (e.key === 'p' || e.key === 'P') { drinkPotion(); return; }
  if (e.key === '.' || e.key === ' ') { e.preventDefault(); wait(); return; }
  const dir = KEYS[e.key];
  if (dir) { e.preventDefault(); tryMove(dir[0], dir[1]); }
});
document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (shopOpen) return;
    const [dx, dy] = btn.dataset.move.split(',').map(Number);
    if (dx === 0 && dy === 0) wait(); else tryMove(dx, dy);
  });
});
restartBtn.addEventListener('click', init);
// Save when the tab is closed or backgrounded, so a mid-floor run is not lost.
window.addEventListener('pagehide', () => { if (!gameOver) saveProgress('progress', true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !gameOver) saveProgress('progress', true); });
overlay.addEventListener('click', init);

// ---------- inventory ----------
const invWeapon = document.getElementById('inv-weapon');
const invArmor = document.getElementById('inv-armor');
const invBag = document.getElementById('inv-bag');

function itemLabel(id) {
  const it = itemInfo(id);
  if (!it) return id;
  if (ITEMS.weapons[id]) return `${it.name} (+${it.atk} attack)`;
  if (ITEMS.armor[id]) return `${it.name} (${it.def} defence)`;
  return `${it.name} (+${it.heal} HP)`;
}

function renderInventory() {
  if (!invBag || !player) return;
  invWeapon.textContent = player.weapon ? itemLabel(player.weapon) : 'Bare hands';
  invArmor.textContent = player.armor ? itemLabel(player.armor) : 'None';
  invBag.innerHTML = '';
  if (!player.bag.length) {
    const li = document.createElement('li'); li.className = 'empty'; li.textContent = `empty (0/${ITEMS.bag_size})`; invBag.appendChild(li); return;
  }
  player.bag.forEach((id, idx) => {
    const li = document.createElement('li');
    const kind = itemKind(id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = kind === 'consumable' ? 'Drink' : 'Equip';
    btn.addEventListener('click', () => kind === 'consumable' ? drinkPotion(idx) : equip(idx));
    li.append(itemLabel(id), btn);
    invBag.appendChild(li);
  });
}

function bagFull() { return player.bag.length >= ITEMS.bag_size; }

function equip(idx) {
  const id = player.bag[idx];
  const kind = itemKind(id);
  if (kind === 'consumable') return;
  const slot = kind === 'weapon' ? 'weapon' : 'armor';
  player.bag.splice(idx, 1);
  if (player[slot]) player.bag.push(player[slot]);
  player[slot] = id;
  log(`You equip the ${itemInfo(id).name}.`, 'good');
  updateStats(); renderShop();
}

function drinkPotion(idx) {
  if (gameOver || !player) return;
  if (idx === undefined) idx = player.bag.findIndex((id) => itemKind(id) === 'consumable');
  if (idx < 0) { log('You have no potions in your bag.'); return; }
  const it = itemInfo(player.bag[idx]);
  const healed = Math.min(it.heal, player.maxHp - player.hp);
  player.bag.splice(idx, 1);
  player.hp += healed;
  log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
  updateStats(); renderShop();
}

function dropLoot(m) {
  if (Math.random() > 0.12 || bagFull()) return;
  const pool = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor, ...ITEMS.consumables })
    .filter(([, it]) => it.floor <= floor);
  if (!pool.length) return;
  const [id, it] = pool[rnd(pool.length)];
  player.bag.push(id);
  log(`The ${m.type.name} drops a ${it.name}.`, 'good');
}

// ---------- shop ----------
const shopEl = document.getElementById('shop');
const shopBuy = document.getElementById('shop-buy');
const shopSell = document.getElementById('shop-sell');
const shopGold = document.getElementById('shop-gold');
let shopOpen = false;

const sellPrice = (id) => Math.floor(itemInfo(id).price / 2);

function openShop() {
  if (!shopEl) return;
  shopOpen = true;
  shopEl.hidden = false;
  log('The merchant greets you. Buy and sell with the buttons, Esc to leave.');
  renderShop();
}

function closeShop() {
  if (!shopEl) return;
  shopOpen = false;
  shopEl.hidden = true;
}

function renderShop() {
  if (!shopOpen) return;
  shopGold.textContent = `${player.gold} gold`;
  shopBuy.innerHTML = '';
  const stock = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor, ...ITEMS.consumables })
    .filter(([, it]) => it.floor <= Math.max(floor, 1) + 1);
  for (const [id, it] of stock) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = `Buy ${it.price}g`;
    btn.disabled = player.gold < it.price || bagFull();
    btn.addEventListener('click', () => buy(id));
    li.append(itemLabel(id), btn);
    shopBuy.appendChild(li);
  }
  shopSell.innerHTML = '';
  const owned = [];
  if (player.weapon) owned.push({ id: player.weapon, where: 'weapon' });
  if (player.armor) owned.push({ id: player.armor, where: 'armor' });
  player.bag.forEach((id, idx) => owned.push({ id, where: idx }));
  if (!owned.length) {
    const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nothing to sell'; shopSell.appendChild(li);
  }
  for (const o of owned) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = `Sell ${sellPrice(o.id)}g`;
    btn.addEventListener('click', () => sell(o));
    li.append(itemLabel(o.id) + (typeof o.where === 'string' ? ' (equipped)' : ''), btn);
    shopSell.appendChild(li);
  }
}

function buy(id) {
  const it = itemInfo(id);
  if (player.gold < it.price || bagFull()) return;
  player.gold -= it.price;
  player.bag.push(id);
  log(`You buy a ${it.name} for ${it.price} gold.`, 'good');
  updateStats(); renderShop();
}

function sell(o) {
  const price = sellPrice(o.id);
  if (typeof o.where === 'string') player[o.where] = null; else player.bag.splice(o.where, 1);
  player.gold += price;
  log(`You sell the ${itemInfo(o.id).name} for ${price} gold.`, 'good');
  updateStats(); renderShop();
}

document.getElementById('shop-close')?.addEventListener('click', closeShop);

// ---------- setup ----------
function buildFloor() {
  if (inTown()) {
    createTown();
  } else {
    createMap();
    placePlayer();
    placeShop();
    placeExit();
    placeMonsters();
    placeItems();
  }
  updateVisibility();
  clearInspect();
  buildLegend();
}

function startRun(saved) {
  player = { x: 1, y: 1, hp: 20, maxHp: 20, atk: 3, level: 1, xp: 0, gold: 0, weapon: null, armor: null, bag: [] };
  floor = 1; gameOver = false; turn = 0; kills = 0;
  closeShop();
  overlay.classList.remove('show');
  logEl.innerHTML = '';
  floor = TOWN;
  if (saved) {
    floor = saved.floor || TOWN;
    Object.assign(player, { hp: saved.hp, maxHp: saved.max_hp, atk: saved.atk, level: saved.level, xp: saved.xp, gold: saved.gold,
      weapon: itemInfo(saved.weapon) ? saved.weapon : null, armor: itemInfo(saved.armor) ? saved.armor : null,
      bag: (saved.bag || []).filter(itemInfo).slice(0, ITEMS.bag_size) });
  }
  buildFloor();
  if (saved && saved.floor > 0) {
    log(`Welcome back, ${saved.name}. You resume on floor ${floor}.`, 'good');
  } else if (saved && saved.level > 1) {
    log(`Welcome back to town, ${saved.name}. The dungeon entrance is at the bottom of the square.`, 'good');
  } else {
    log(`${saved ? saved.name + ' arrives' : 'You arrive'} in the town square. Visit the merchant ($) and the inn (+), then take the entrance at the bottom.`);
  }
  updateStats(); draw();
}

let starting = false;
async function init() {
  if (starting) return;
  starting = true;
  try {
    startRun(await loadProgress());
  } finally {
    starting = false;
  }
}

function loop() { if (!gameOver) draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
init();
