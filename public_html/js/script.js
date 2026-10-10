// Dungeon Adventure — a small roguelike on a canvas.
//
// World model: the dungeon is endless. It is generated in 32x32 chunks on
// demand, seeded per floor, every chunk links to its neighbours through the
// middle of each edge, so the whole thing is one connected cave. The town
// and the building interiors are small bounded maps. A camera keeps the
// hero in the middle of the view at all times.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const hpBar = document.getElementById('hpbar');
const logEl = document.getElementById('log');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const restartBtn = document.getElementById('restart');

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2, SHOP: 3, INN: 4, FOUNTAIN: 5, DOOR: 6, FURNITURE: 7, BED: 8 };
const TOWN = 0;           // floor number of the town square
const FINAL_FLOOR = 5;
const VIEW_RADIUS = 8;    // how far the hero sees in the dungeon
const CHUNK = 32;
const T = 32;             // tile size in canvas pixels (sprites are 8px, drawn 4x)
const SIM_RADIUS = 28;    // monsters further than this from the hero stand still

const MONSTER_TYPES = [
  { name: 'Rat',      sprite: 'rat',      hp: 3,  atk: 1, xp: 2,  minFloor: 1 },
  { name: 'Goblin',   sprite: 'goblin',   hp: 5,  atk: 2, xp: 4,  minFloor: 1 },
  { name: 'Skeleton', sprite: 'skeleton', hp: 8,  atk: 3, xp: 7,  minFloor: 2 },
  { name: 'Orc',      sprite: 'orc',      hp: 12, atk: 4, xp: 12, minFloor: 3 },
  { name: 'Wraith',   sprite: 'wraith',   hp: 10, atk: 5, xp: 16, minFloor: 4 },
];

// ---------- state ----------
let floor, player, gameOver, turn, kills;
let scene = 'world';           // 'world' | 'house' | 'dungeon'
let bounded = null;            // { w, h, tiles[][] } for town and interiors
let chunks = new Map();        // dungeon chunks keyed "cx,cy"
let floorSeed = 1;
let monsters = [], potions = [], golds = [], shops = [], npcs = [];
let exit = null, houses = [], ground = null, decor = null, interior = null, bubble = null;
let visible = new Set();       // "x,y" keys lit this turn
let cam = { x: 0, y: 0 };      // top-left of the view in world pixels

// ---------- helpers ----------
const rnd = (n) => Math.floor(Math.random() * n);
const key = (x, y) => `${x},${y}`;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// Monsters are looked up by position through an index, since the list grows
// with every chunk the hero uncovers.
let monsterIndex = new Map(), monstersDirty = true;
function reindexMonsters() { monsterIndex = new Map(); for (const m of monsters) monsterIndex.set(key(m.x, m.y), m); monstersDirty = false; }
const getMonsterAt = (x, y) => { if (monstersDirty) reindexMonsters(); return monsterIndex.get(key(x, y)); };
const getPotionAt = (x, y) => potions.find((p) => p.x === x && p.y === y);
const getGoldAt = (x, y) => golds.find((g) => g.x === x && g.y === y);
const getNpcAt = (x, y) => npcs.find((n) => n.x === x && n.y === y);
const safeZone = () => floor === TOWN;
const inTown = () => scene === 'world';   // outdoors on the overworld
const isVisible = (x, y) => safeZone() || visible.has(key(x, y));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Seeded random for chunk generation (mulberry32) and a cheap hash.
function hash32(...nums) {
  let h = 2166136261;
  for (const n of nums) { h ^= (n | 0) + 0x9e3779b9; h = Math.imul(h, 16777619); h ^= h >>> 15; }
  return h >>> 0;
}
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const noise = (x, y, salt = 0) => hash32(x, y, salt) / 4294967295;

// ---------- tiles: one accessor for every scene ----------
const BLANK_CHUNK = { tiles: new Uint8Array(CHUNK * CHUNK), seen: new Uint8Array(CHUNK * CHUNK), rooms: [] };
function getChunk(cx, cy) {
  const k = key(cx, cy);
  let ch = chunks.get(k);
  if (!ch) {
    if (coop.active) { coop.need.add(k); return BLANK_CHUNK; }
    ch = scene === 'world' ? generateWorldChunk(cx, cy) : generateChunk(cx, cy); chunks.set(k, ch);
  }
  return ch;
}
function getTile(x, y) {
  if (bounded) return (x >= 0 && y >= 0 && x < bounded.w && y < bounded.h) ? bounded.tiles[y][x] : TILE.WALL;
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  return getChunk(cx, cy).tiles[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)];
}
function setTile(x, y, t) {
  if (bounded) { if (x >= 0 && y >= 0 && x < bounded.w && y < bounded.h) bounded.tiles[y][x] = t; return; }
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  getChunk(cx, cy).tiles[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] = t;
}
function wasSeen(x, y) {
  if (bounded) return true;
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  const ch = chunks.get(key(cx, cy));
  return ch ? ch.seen[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] === 1 : false;
}
function markSeen(x, y) {
  if (bounded) return;
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  const ch = getChunk(cx, cy);
  if (ch !== BLANK_CHUNK) ch.seen[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] = 1;
}
const walkable = (t) => t !== TILE.WALL && t !== TILE.FOUNTAIN && t !== TILE.FURNITURE;

// ---------- account save/load ----------
const ACCOUNT = window.DUNGEON || { user: false };
const ITEMS = ACCOUNT.items || { weapons: {}, armor: {}, consumables: {}, bag_size: 12 };
const itemInfo = (id) => ITEMS.weapons[id] || ITEMS.armor[id] || ITEMS.consumables[id] || null;
const itemKind = (id) => ITEMS.weapons[id] ? 'weapon' : ITEMS.armor[id] ? 'armor' : 'consumable';
const weaponAtk = () => (player.weapon && ITEMS.weapons[player.weapon]) ? ITEMS.weapons[player.weapon].atk : 0;
const armorDef = () => (player.armor && ITEMS.armor[player.armor]) ? ITEMS.armor[player.armor].def : 0;
const SAVE_EVERY_TURNS = 20;

async function saveProgress(event, keepalive = false) {
  if (!ACCOUNT.user || !player || coop.active) return;
  try {
    const res = await fetch(ACCOUNT.saveUrl, {
      method: 'POST', keepalive, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf },
      body: JSON.stringify({ event, floor, level: player.level, xp: player.xp, gold: player.gold,
        hp: player.hp, max_hp: player.maxHp, atk: player.atk, kills, weapon: player.weapon, armor: player.armor, bag: player.bag,
        wx: player.wx ?? 20, wy: player.wy ?? 21, home: homeTown }),
    });
    if (!res.ok) throw new Error(res.status);
    kills = 0;
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

// ---------- co-op ----------
// With a party, the dungeon lives on the server: moves are sent as actions,
// the world comes back as snapshots, and the page polls between actions.
const coop = { active: false, party: null, seq: 0, need: new Set(), others: [], timer: null, busy: false, monsterById: new Map() };
const partyEl = document.getElementById('party');

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || `HTTP ${res.status}`), { status: res.status });
  return data;
}

async function refreshParty() {
  if (!ACCOUNT.user) return null;
  try {
    const data = await api(ACCOUNT.partyUrl);
    coop.party = data.party;
    renderParty();
    return data;
  } catch (e) { return null; }
}

function renderParty() {
  if (!partyEl) return;
  const p = coop.party;
  if (!p) {
    partyEl.innerHTML = `<div class="party-head"><b>Party</b> <span class="muted">Explore the dungeon together.</span></div>
      <div class="party-actions"><button type="button" id="party-create">Create a party</button>
      <form id="party-join" class="inline-form"><input type="text" id="party-code" maxlength="6" placeholder="Join code" autocomplete="off"><button type="submit">Join</button></form></div>`;
    partyEl.querySelector('#party-create').addEventListener('click', async () => { try { coop.party = (await api(ACCOUNT.partyUrl, {})).party; renderParty(); log(`Party created. Share the code ${coop.party.code}.`, 'good'); } catch (e) { log(e.message, 'bad'); } });
    partyEl.querySelector('#party-join').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = partyEl.querySelector('#party-code').value.trim().toUpperCase();
      try { coop.party = (await api(ACCOUNT.partyUrl + '/join', { code })).party; renderParty(); log(`You joined the party ${coop.party.code}.`, 'good'); } catch (err) { log(err.message, 'bad'); }
    });
    return;
  }
  partyEl.innerHTML = `<div class="party-head"><b>Party</b> <span class="code">${p.code}</span> <span class="muted">${p.floor > 0 ? `on floor ${p.floor}` : 'in town'} · share the code to invite</span>
      <button type="button" id="party-leave">Leave</button></div>
    <ul class="party-list">${p.members.map((m) => `<li><span class="dot ${m.online ? 'on' : ''}"></span>${m.name} <span class="muted">Lv ${m.level}${m.in_dungeon ? ' · in the dungeon' : ''}</span></li>`).join('')}</ul>
    <p class="muted small">${p.floor > 0 ? 'Take the gate at the bottom of the square to join them.' : 'When anyone takes the gate, the party\'s floor begins. Stairs move everyone down together.'}</p>`;
  partyEl.querySelector('#party-leave').addEventListener('click', async () => {
    try { await api(ACCOUNT.partyUrl + '/leave', {}); } catch (e) {}
    if (coop.active) stopCoop();
    coop.party = null; renderParty(); log('You left the party.');
    if (scene === 'dungeon') { returnHome(); afterSceneChange(); }
  });
}

function neededChunks() {
  const { x0, y0, x1, y1 } = viewBounds();
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
    if (!chunks.has(key(cx, cy))) coop.need.add(key(cx, cy));
  }
  return [...coop.need].join('|');
}

function applySnapshot(snap) {
  if (snap.seq !== undefined) coop.seq = Math.max(coop.seq, snap.seq);
  for (const [k, tiles] of Object.entries(snap.chunks || {})) {
    const existing = chunks.get(k);
    const arr = new Uint8Array(CHUNK * CHUNK);
    for (let i = 0; i < arr.length; i++) arr[i] = tiles.charCodeAt(i) - 48;
    chunks.set(k, { tiles: arr, seen: existing ? existing.seen : new Uint8Array(CHUNK * CHUNK), rooms: [] });
    coop.need.delete(k);
    bgDirty = true;
  }
  if (snap.party) { coop.party = snap.party; renderParty(); }
  const me = snap.me;
  if (me) {
    Object.assign(player, { hp: me.hp, maxHp: me.max_hp, atk: me.atk, level: me.level, xp: me.xp, gold: me.gold, weapon: me.weapon, armor: me.armor, bag: me.bag || [] });
    coop.memberId = me.id;
    if (me.x !== player.x || me.y !== player.y) { player.x = me.x; player.y = me.y; if (Math.abs(player.x - (player.rx ?? me.x)) > 3) settle(player); }
  }
  if (snap.exit) exit = { x: snap.exit[0], y: snap.exit[1] };
  if (snap.monsters) {
    const next = new Map();
    for (const [id, x, y, t, hp, maxHp, awake] of snap.monsters) {
      const prev = coop.monsterById.get(id);
      const m = prev || { id, rx: x, ry: y };
      if (prev && (prev.x !== x) ) m.face = Math.sign(x - prev.x);
      Object.assign(m, { x, y, type: MONSTER_TYPES[t], hp, maxHp, awake: !!awake });
      next.set(id, m);
    }
    coop.monsterById = next;
    monsters = [...next.values()]; monstersDirty = true;
  }
  if (snap.potions) potions = snap.potions.map(([x, y]) => ({ x, y, heal: 5 }));
  if (snap.golds) golds = snap.golds.map(([x, y, amount]) => ({ x, y, amount }));
  if (snap.shops) shops = snap.shops.map(([x, y]) => ({ x, y }));
  if (snap.members) {
    const prev = new Map(coop.others.map((o) => [o.id, o]));
    coop.others = snap.members.map((o) => { const old = prev.get(o.id); const n = old || { rx: o.x, ry: o.y }; if (old && old.x !== o.x) n.face = Math.sign(o.x - old.x); return Object.assign(n, o); });
  }
  for (const l of snap.log || []) log(l.text, l.cls);
  for (const h of snap.hits || []) {
    floatText(h.x, h.y, `-${h.dmg}`, h.who === 'player' ? '#ffd86b' : '#ff6b6b');
    if (h.who === 'monster' && h.x === player.x && h.y === player.y) player.flashUntil = performance.now() + 120;
    else { const m = monsters.find((mm) => mm.x === h.x && mm.y === h.y); if (m) m.flashUntil = performance.now() + 120; }
  }
  for (const ev of snap.events || []) {
    if (ev.type === 'floor') { floor = ev.floor; chunks = new Map(); coop.monsterById = new Map(); coop.need.clear(); bgDirty = true; settle(player); buildLegend(); }
    if (ev.type === 'win') { stopCoop(); returnHome(); afterSceneChange(); log(`You escaped the dungeon together! The town square welcomes you back.`, 'good'); return; }
    if (ev.type === 'death' && ev.member === coop.memberId) { stopCoop(); endGame('You died', `You fell on floor ${floor}. Your party fights on without you. Press R to start over in town.`); return; }
  }
  if (me && !me.in_dungeon && coop.active && !gameOver) { stopCoop(); returnHome(); afterSceneChange(); return; }
  if ((snap.flags || []).includes('shop')) openShop('shop');
  updateCamera(); updateVisibility(); updateStats();
}

async function enterCoop() {
  try {
    scene = 'dungeon'; bounded = null; ground = null; decor = null; houses = []; npcs = []; interior = null;
    chunks = new Map(); monsters = []; potions = []; golds = []; shops = []; coop.monsterById = new Map(); coop.others = []; coop.need.clear(); coop.seq = 0;
    coop.active = true;
    const snap = await api(ACCOUNT.partyUrl + '/enter', {});
    floor = snap.floor;
    applySnapshot(snap);
    settle(player); afterSceneChange();
    log(`You join your party on floor ${floor}. Follow the compass to the stairs.`, 'good');
    await pollState();
    coop.timer = setInterval(pollState, 350);
  } catch (e) {
    coop.active = false;
    log('Could not join the party floor: ' + e.message, 'bad');
    returnHome(); afterSceneChange();
  }
}

function stopCoop() {
  coop.active = false;
  if (coop.timer) clearInterval(coop.timer);
  coop.timer = null; coop.others = []; coop.monsterById = new Map();
}

async function pollState() {
  if (!coop.active || coop.busy) return;
  coop.busy = true;
  try {
    const snap = await api(`${ACCOUNT.partyUrl}/state?since=${coop.seq}&chunks=${encodeURIComponent(neededChunks())}`);
    if (coop.active) applySnapshot(snap);
  } catch (e) {
    if (e.status === 409) { stopCoop(); returnHome(); afterSceneChange(); }
  } finally { coop.busy = false; }
}

async function coopAction(action) {
  if (!coop.active) return;
  try {
    const snap = await api(ACCOUNT.partyUrl + '/act', { ...action, since: coop.seq, chunks: neededChunks() });
    if (coop.active) applySnapshot(snap);
  } catch (e) { log('Action failed: ' + e.message, 'bad'); }
}

// ---------- pixel sprites ----------
const PAL = { k: '#1b1b2f', w: '#f4f4f4', y: '#ffd86b', o: '#ff9f43', r: '#e74c3c', g: '#7ad36b', G: '#2e7d32', b: '#4a90e2', B: '#1f3a93',
  p: '#b18cff', P: '#ff9ecf', s: '#f1c27d', h: '#8b5a2b', H: '#5b3a1a', e: '#c0c0c0', E: '#6d6d6d', t: '#d9b382', c: '#7bdfff', d: '#8b2e2e' };
const SPRITES = {
  player:   ['..yyyy..', '.yssssy.', '.sksssk.', '..ssss..', '.bbbbbb.', 'ybbbbbby', '..bb.bb.', '..HH.HH.'],
  rat:      ['........', '.hh...h.', 'hkhh.hh.', 'hhhhhhh.', '.hhhhhhh', '..hhhh.h', '.h.h.h..', '........'],
  goblin:   ['.g....g.', '.gggggg.', '.gkggkg.', '..gggg..', '.hGGGGh.', '..GGGG..', '..G..G..', '..h..h..'],
  skeleton: ['..wwww..', '..wkwk..', '..wwww..', '...ww...', '.wwwwww.', '.ew.wwe.', '..w..w..', '..e..e..'],
  orc:      ['.dd..dd.', '.dddddd.', '.dkddkd.', '.ddwwdd.', 'hHHHHHHh', '.HHHHHH.', '.HH..HH.', '.kk..kk.'],
  wraith:   ['..pppp..', '.pppppp.', '.pkppkp.', '.pppppp.', '.pppppp.', '.pppppp.', '.p.pp.p.', '........'],
  merchant: ['..hhhh..', '.hssssh.', '..sksk..', '...ss...', '.hhhhhh.', 'hhyyyyhh', '.hhhhhh.', '..HH.HH.'],
  innkeeper:['..HHHH..', '..ssss..', '..sksk..', '...ss...', '.PPPPPP.', '.wPPPPw.', '.PPPPPP.', '..HH.HH.'],
  guard:    ['..eeee..', '..ssss..', '..sksk..', '..eeee..', '.eeeeee.', 'weeeeeew', '.ee..ee.', '.EE..EE.'],
  elder:    ['..wwww..', '..ssss..', '..sksk..', '..swws..', '.GGGGGG.', '.GGGGGG.', '..GGGG..', '..HH.HH.'],
  child:    ['........', '..oooo..', '..ssss..', '..sksk..', '..bbbb..', '.bbbbbb.', '..b..b..', '..H..H..'],
  villager: ['..hhhh..', '.hssssh.', '.hsksk..', '..ssss..', '.rrrrrr.', '.rrrrrr.', '..rrrr..', '..H..H..'],
  farmer:   ['.tttttt.', '..tttt..', '..ssss..', '..sksk..', '.GGGGGG.', '.GhhhhG.', '..hh.hh.', '..HH.HH.'],
  potion:   ['...ww...', '...ee...', '..cccc..', '.cccccc.', '.ccwccc.', '.cccccc.', '..cccc..', '........'],
  gold:     ['........', '..yyyy..', '.yyooyy.', '.yoyyoy.', '.yyooyy.', '..yyyy..', 'yyyyyyyy', '.yyyyyy.'],
  stairs:   ['kkkkkkkk', 'kEEEEEEk', 'kkEEEEEk', 'kkkEEEEk', 'kkkkEEEk', 'kkkkkEEk', 'kkkkkkEk', 'kkkkkkkk'],
  tree:     ['..GGGG..', '.GGgGGG.', 'GGgGGGGG', 'GGGGGgGG', '.GGGGGG.', '..GGGG..', '...HH...', '...HH...'],
  flower:   ['........', '........', '...P....', '..PwP.y.', '...P.yoy', '...G..y.', '..GG.G..', '........'],
  lamp:     ['...kk...', '..kyyk..', '..kyyk..', '...kk...', '...kk...', '...kk...', '...kk...', '..kkkk..'],
  torch:    ['...yy...', '..yooy..', '..oyyo..', '...oo...', '...hh...', '...hh...', '...hh...', '........'],
  bones:    ['........', '.e......', '..e.ee..', '....e...', '.e....e.', '..ee....', '......e.', '........'],
  counter:  ['........', 'hhhhhhhh', 'HHHHHHHH', 'HhHHHHhH', 'HhHHHHhH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH'],
  shelf:    ['HHHHHHHH', 'HcHbHyHH', 'HHHHHHHH', 'HrHHHcHH', 'HHHHHHHH', 'HyHbHHHH', 'HHHHHHHH', 'HHHHHHHH'],
  bed:      ['hhhhhhhh', 'hwwwwwwh', 'hwwPPPPh', 'hrrrrrrh', 'hrrrrrrh', 'hrrrrrrh', 'hhhhhhhh', 'h......h'],
  table:    ['........', 'hhhhhhhh', 'HHHHHHHH', '.H....H.', '.H....H.', '.H....H.', '.H....H.', '........'],
  barrel:   ['..hhhh..', '.hHHHHh.', '.hhhhhh.', '.hHHHHh.', '.hHHHHh.', '.hhhhhh.', '.hHHHHh.', '..hhhh..'],
  rack:     ['H.e..e.H', 'H.e..e.H', 'HHHHHHHH', 'H.e..e.H', 'H.e..e.H', 'HHHHHHHH', 'H......H', 'H......H'],
  chest:    ['........', '.hhhhhh.', '.hHHHHh.', '.hhyyhh.', '.hHHHHh.', '.hHHHHh.', '.hhhhhh.', '........'],
  fire:     ['EEEEEEEE', 'E......E', 'E..oo..E', 'E.oyyo.E', 'E.oyyo.E', 'EorrrroE', 'EEEEEEEE', 'EEEEEEEE'],
  plant:    ['...G....', '..GgG...', '.GgGGG..', '..GGG...', '...G....', '..hhh...', '..hHh...', '..hhh...'],
  rug:      ['rrrrrrrr', 'ryyyyyyr', 'ryrrrryr', 'ryryyryr', 'ryryyryr', 'ryrrrryr', 'ryyyyyyr', 'rrrrrrrr'],
};
// 16x16 versions of the creatures and key items; these win over the 8x8 ones.
const BIG_SPRITES = {
  rat: ['................', '................', '................', '.......hh.....h.', '......hhhh...hh.', '.....hkhhhh.hh..', '....hhhhhhhhh...', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhhh.', '..hhhhhhhhhhh.h.', '...hhhhhhhhhh.h.', '....hh.hh.hh....', '....hh.hh.hh....', '................', '................'],
  goblin: ['....g......g....', '...gg......gg...', '...gggggggggg...', '..gggggggggggg..', '..ggkgggggkggg..', '..gggggggggggg..', '...ggggwwgggg...', '....gggggggg....', '...HGGGGGGGGH...', '..hHGGGGGGGGHh..', '..h.GGGGGGGG.h..', '....GGGGGGGG....', '....GGG..GGG....', '....GGG..GGG....', '...hhh....hhh...', '................'],
  skeleton: ['.....wwwwww.....', '....wwwwwwww....', '....wkkwwkkw....', '....wwwwwwww....', '.....wkwkww.....', '......wwww......', '.......ww.......', '....wwwwwwww....', '...w.wwwwww.w...', '...w.w.ww.w.w...', '...e.wwwwww.e...', '.....w.ww.w.....', '......w..w......', '......w..w......', '.....ee..ee.....', '................'],
  orc: ['...dd......dd...', '..dddd....dddd..', '..dddddddddddd..', '.dddddddddddddd.', '.ddkkddddddkkdd.', '.dddddddddddddd.', '..ddddwwwwdddd..', '...dddwddwddd...', '..HHHHHHHHHHHH..', '.hHHHHHHHHHHHHh.', '.h.HHHHHHHHHH.h.', 'eee.HHHHHHHH.eee', '....HHHH.HHHH...', '....HHHH.HHHH...', '...kkkk...kkkk..', '................'],
  wraith: ['......pppp......', '.....pppppp.....', '....pppppppp....', '....pkppppkp....', '....pppppppp....', '.....pppppp.....', '....pppppppp....', '...pppppppppp...', '..pppppppppppp..', '..pppppppppppp..', '..pppppppppppp..', '..pp.pppppp.pp..', '..p..pp..pp..p..', '.....p....p.....', '................', '................'],
  potion: ['......wwww......', '......weew......', '......eeee......', '.......cc.......', '.....cccccc.....', '....cccccccc....', '...cccwwccccc...', '...ccwccccccc...', '...ccwccccccc...', '...cccccccccc...', '...cccccccccc...', '....cccccccc....', '.....cccccc.....', '................', '................', '................'],
  gold: ['................', '................', '.....yyyyyy.....', '....yyooooyy....', '...yyoyyyyoyy...', '...yoyyyyyyoy...', '...yoyyyyyyoy...', '...yyoyyyyoyy...', '..yyyyooooyyyy..', '.yyyyyyyyyyyyyy.', '.yooooooooooooy.', '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..', '................', '................', '................'],
  stairs: ['kkkkkkkkkkkkkkkk', 'kEEEEEEEEEEEEEEk', 'kEEEEEEEEEEEEEEk', 'kkkEEEEEEEEEEEEk', 'kkkEEEEEEEEEEEEk', 'kkkkkkEEEEEEEEEk', 'kkkkkkEEEEEEEEEk', 'kkkkkkkkkEEEEEEk', 'kkkkkkkkkEEEEEEk', 'kkkkkkkkkkkkEEEk', 'kkkkkkkkkkkkEEEk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'],
  tree: ['......GGGG......', '....GGGGGGGG....', '...GGgGGGGGGG...', '..GGGGGGGgGGGG..', '..GgGGGGGGGGGG..', '.GGGGGGGGGGGGGG.', '.GGGGGgGGGGgGGG.', '.GGGGGGGGGGGGGG.', '..GGGGGGGGGGGG..', '..GGGgGGGGGGGG..', '...GGGGGGGGGG...', '.....GGGGGG.....', '......HHHH......', '......HHHH......', '......HHHH......', '.....HHHHHH.....'],
  player: ['.....yyyyyy.....', '....yyyyyyyy....', '....yyssssyy....', '....ysssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....bbbbbbbb....', '...bbbbbbbbbb...', '..sbbbbyybbbbs..', '..s.bbbbbbbb.s..', '....bbbbbbbb....', '....bbb..bbb....', '....bbb..bbb....', '...HHH....HHH...', '................'],
  merchant: ['.....hhhhhh.....', '....hhhhhhhh....', '....hhsssshh....', '....hsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '..shhhhyyhhhhs..', '..s.hhhhhhhh.s..', '....hhhhhhhh....', '....hhh..hhh....', '....hhh..hhh....', '...HHH....HHH...', '................'],
  innkeeper: ['.....HHHHHH.....', '....HHHHHHHH....', '....HHssssHH....', '....Hsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....PPPPPPPP....', '...PPPPPPPPPP...', '..sPPPPwwPPPPs..', '..s.PPPPPPPP.s..', '....PPPPPPPP....', '....PPP..PPP....', '....PPP..PPP....', '...HHH....HHH...', '................'],
  guard: ['.....eeeeee.....', '....eeeeeeee....', '....eessssee....', '....esssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....eeeeeeee....', '...eeeeeeeeee...', '..seeeewweeees..', '..s.eeeeeeee.s..', '....eeeeeeee....', '....EEE..EEE....', '....EEE..EEE....', '...HHH....HHH...', '................'],
  elder: ['.....wwwwww.....', '....wwwwwwww....', '....wwssssww....', '....wsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....GGGGGGGG....', '...GGGGGGGGGG...', '..sGGGGGGGGGGs..', '..s.GGGGGGGG.s..', '....GGGGGGGG....', '....GGG..GGG....', '....GGG..GGG....', '...HHH....HHH...', '................'],
  child: ['.....oooooo.....', '....oooooooo....', '....oossssoo....', '....osssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....bbbbbbbb....', '...bbbbbbbbbb...', '..sbbbbbbbbbbs..', '..s.bbbbbbbb.s..', '....bbbbbbbb....', '....bbb..bbb....', '....bbb..bbb....', '...HHH....HHH...', '................'],
  villager: ['.....hhhhhh.....', '....hhhhhhhh....', '....hhsssshh....', '....hsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....rrrrrrrr....', '...rrrrrrrrrr...', '..srrrrrrrrrrs..', '..s.rrrrrrrr.s..', '....rrrrrrrr....', '....rrr..rrr....', '....rrr..rrr....', '...HHH....HHH...', '................'],
  farmer: ['.....tttttt.....', '....tttttttt....', '....ttsssstt....', '....tsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....GGGGGGGG....', '...GGGGGGGGGG...', '..sGGGGhhGGGGs..', '..s.GGGGGGGG.s..', '....GGGGGGGG....', '....hhh..hhh....', '....hhh..hhh....', '...HHH....HHH...', '................'],
};
const spriteCache = {};
function sprite(name) {
  if (spriteCache[name]) return spriteCache[name];
  const rows = BIG_SPRITES[name] || SPRITES[name];
  const c = document.createElement('canvas'); c.width = c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  spriteCache[name] = c;
  return c;
}
// Draw a sprite at a world position (tiles, may be fractional while moving).
// `off` is the camera for the live layer and the cache origin for the background.
let off = { x: 0, y: 0 };
function drawSprite(g, name, x, y, alpha = 1, pad = 3, flip = false, flash = false) {
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  const dx = x * T - off.x + pad, dy = y * T - off.y + pad, size = T - pad * 2;
  let img = sprite(name);
  if (flash) {
    // whiten only the sprite's own pixels, via a scratch canvas
    const src = img;
    scratch.width = scratch.height = src.width;
    const sg = scratch.getContext('2d');
    sg.clearRect(0, 0, scratch.width, scratch.height);
    sg.drawImage(src, 0, 0);
    sg.globalCompositeOperation = 'source-atop'; sg.fillStyle = 'rgba(255,255,255,0.85)'; sg.fillRect(0, 0, scratch.width, scratch.height);
    sg.globalCompositeOperation = 'source-over';
    img = scratch;
  }
  if (flip) { g.save(); g.translate(dx + size, dy); g.scale(-1, 1); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, size, size); g.restore(); }
  else g.drawImage(img, dx, dy, size, size);
  g.globalAlpha = 1;
}
const scratch = document.createElement('canvas');

// ---------- townsfolk and buildings ----------
const NPC_TYPES = [
  { sprite: 'guard', name: 'Bren the guard', lines: [
    'Keep your armor on down there. The orcs hit like a mule.',
    'Saw a wraith once. Could not hit it with a stick. Should have bought a better sword.',
    'The dungeon goes on forever, they say. The stairs down are always somewhere. Watch the compass.'] },
  { sprite: 'child', name: 'Pip', lines: [
    'Did you see a skeleton? Are they scary? Can I come?',
    'I found a dagger once. Dad made me sell it.',
    'The fountain is lucky. Everyone says so.'] },
  { sprite: 'villager', name: 'Greta', lines: [
    'Monsters sleep until they notice you. Walk softly and pick your fights.',
    'The merchant pays half what he charges. Sell him the junk, keep the good blade.',
    'There are merchants down in the dungeon too, if you wander far enough.'] },
  { sprite: 'farmer', name: 'Tomas the farmer', lines: [
    'Rats in the dungeon, rats in my barn. At least yours give experience.',
    'Old Mara brews potions cheaper than the shop. Her cottage is the one at the bottom left.',
    'Clear all five floors and you come back up with everything you carried.'] },
];
const INDOOR_NPCS = {
  fenwick: { sprite: 'merchant', name: 'Fenwick the merchant', action: 'shop', lines: ['Finest steel this side of the dungeon. Come to the counter.'] },
  dottie: { sprite: 'innkeeper', name: 'Dottie the innkeeper', action: 'inn', lines: ['A bed is a bed. Take any that is free.'] },
  orla: { sprite: 'guard', name: 'Captain Orla', lines: [
    'The watch does not go below the first floor. That is what adventurers are for.',
    'Skeletons shrug off weak blows. Bring at least a mace by floor two.',
    'If you die down there, you come back with nothing but your name. Choose when to turn back.'] },
  mara: { sprite: 'elder', name: 'Old Mara', action: 'potions', lines: ['Potions, ten gold. Cheaper than Fenwick and twice as fresh.'] },
  hilde: { sprite: 'villager', name: 'Hilde', lines: [
    'Make yourself at home, but mind the chest. Pip thinks it is a dragon hoard.',
    'The inn heals you for free. Rest before you go down.',
    'Sell the merchant your spare gear; half price is better than carrying it.'] },
};
const BUILDINGS = {
  shop:  { name: "Fenwick's Goods", sign: 'SHOP', roof: '#6d3b8b', npcs: { M: 'fenwick' }, layout: [
    '################', '#SSSSSSSSSSSSS.#', '#.....M........#', '#..CCCCCCCC....#', '#..............#',
    '#.b............#', '#.b....T.......#', '#.........rr...#', '#..............#', '#######D########'] },
  watch: { name: 'The Watch House', sign: 'WATCH', roof: '#7a4a2a', npcs: { G: 'orla' }, layout: [
    '################', '#RRRR......c.c.#', '#..............#', '#...G..........#', '#..............#',
    '#..T.T.........#', '#..............#', '#.........BB...#', '#..............#', '#######D########'] },
  inn:   { name: 'The Sleeping Rat', sign: 'INN', roof: '#8b2e2e', npcs: { I: 'dottie' }, layout: [
    '################', '#BB.BB.BB..f...#', '#..............#', '#..............#', '#......I.......#',
    '#....CCCCC.....#', '#..T.......T...#', '#..............#', '#..T.b.....T...#', '#######D########'] },
  herbs: { name: "Mara's Cottage", sign: 'HERBS', roof: '#2e7d32', npcs: { E: 'mara' }, layout: [
    '################', '#SS.f..........#', '#..............#', '#..E...........#', '#..CCC.........#',
    '#..............#', '#.....T....B...#', '#..p...........#', '#..............#', '#######D########'] },
  home:  { name: "Hilde's House", sign: '', roof: '#7a4a2a', npcs: { H: 'hilde' }, layout: [
    '################', '#f......BB.BB..#', '#..............#', '#....T.........#', '#..H...rr......#',
    '#......rr......#', '#..c...........#', '#..........p...#', '#..............#', '#######D########'] },
};
const FURNITURE = {
  C: { sprite: 'counter', name: 'Counter', solid: true }, S: { sprite: 'shelf', name: 'Shelves', solid: true },
  B: { sprite: 'bed', name: 'Bed', solid: false }, T: { sprite: 'table', name: 'Table', solid: true },
  b: { sprite: 'barrel', name: 'Barrel', solid: true }, R: { sprite: 'rack', name: 'Weapon rack', solid: true },
  c: { sprite: 'chest', name: 'Chest', solid: true }, f: { sprite: 'fire', name: 'Fireplace', solid: true },
  p: { sprite: 'plant', name: 'Potted plant', solid: true }, r: { sprite: 'rug', name: 'Rug', solid: false },
};

// ---------- messages ----------
const messages = [];
function log(text, cls = '') {
  messages.push({ text, cls, at: performance.now() });
  while (messages.length > 3) messages.shift();
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  logEl.prepend(li);
  while (logEl.children.length > 8) logEl.removeChild(logEl.lastChild);
}
function xpToNext(level) { return 10 + (level - 1) * 8; }

// ---------- the overworld ----------
// One seeded world for everyone. Terrain comes from value noise; towns sit on
// a lattice with a little jitter and are joined by roads, so you can always
// walk from one to the next. Each town has a name, its own set of buildings,
// a fountain, townsfolk and a gate down into the dungeon.
const WORLD_SEED = 7331, TOWN_SPACING = 96, TW = 40, TH = 30;
const GROUND = { GRASS: 0, FOREST: 1, SAND: 2, WATER: 3, MOUNTAIN: 4, ROAD: 5, COBBLE: 6, TREE: 7 };
const worldChunks = new Map();   // kept across scene changes
const towns = new Map();         // lattice key -> town
let homeTown = '0,0';            // the town whose gate you last took
const SYL_A = ['Ash', 'Bar', 'Cal', 'Dun', 'El', 'Fen', 'Gar', 'Hol', 'Ist', 'Kel', 'Lor', 'Mor', 'Nor', 'Ost', 'Pem', 'Quil', 'Rav', 'Sil', 'Tor', 'Ul', 'Vel', 'Wyn'];
const SYL_B = ['bury', 'ford', 'gate', 'haven', 'holm', 'mere', 'moor', 'ton', 'vale', 'wick', 'worth', 'by', 'stead', 'bridge', 'march'];

function valueNoise(x, y, salt, scale) {
  const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const n00 = noise(x0, y0, salt), n10 = noise(x0 + 1, y0, salt), n01 = noise(x0, y0 + 1, salt), n11 = noise(x0 + 1, y0 + 1, salt);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}
function terrainAt(x, y) {
  const h = valueNoise(x, y, WORLD_SEED, 26) * 0.6 + valueNoise(x, y, WORLD_SEED + 1, 9) * 0.3 + valueNoise(x, y, WORLD_SEED + 2, 4) * 0.1;
  if (h < 0.3) return GROUND.WATER;
  if (h < 0.34) return GROUND.SAND;
  if (h > 0.84) return GROUND.MOUNTAIN;
  if (h > 0.62) return valueNoise(x, y, WORLD_SEED + 3, 5) > 0.5 ? GROUND.TREE : GROUND.FOREST;
  return GROUND.GRASS;
}

function townAt(i, j) {
  const k = key(i, j);
  if (towns.has(k)) return towns.get(k);
  const origin = i === 0 && j === 0;
  const jx = origin ? 0 : Math.floor((noise(i, j, 91) - 0.5) * 32), jy = origin ? 0 : Math.floor((noise(i, j, 92) - 0.5) * 32);
  const cx = i * TOWN_SPACING + 20 + jx, cy = j * TOWN_SPACING + 15 + jy;
  const x0 = cx - 20, y0 = cy - 15;
  const name = origin ? 'Hearth' : SYL_A[Math.floor(noise(i, j, 93) * SYL_A.length)] + SYL_B[Math.floor(noise(i, j, 94) * SYL_B.length)];
  const town = { key: k, i, j, name, cx, cy, x0, y0, houses: [], npcs: null, spawn: { x: cx, y: cy + 3 }, gate: { x: cx, y: y0 + 26 } };
  const add = (lx, ly, w, h, id) => town.houses.push({ x: x0 + lx, y: y0 + ly, w, h, id, doorX: x0 + lx + Math.floor(w / 2), doorY: y0 + ly + h - 1, town: k, ...BUILDINGS[id] });
  add(6, 4, 6, 4, 'shop'); add(28, 4, 6, 4, 'inn');
  if (origin || noise(i, j, 95) < 0.7) add(16, 3, 8, 3, 'watch');
  if (origin || noise(i, j, 96) < 0.65) add(6, 22, 6, 4, 'herbs');
  if (origin || noise(i, j, 97) < 0.7) add(28, 22, 6, 4, 'home');
  towns.set(k, town);
  return town;
}
function townContaining(x, y) {
  const i0 = Math.round((x - 20) / TOWN_SPACING), j0 = Math.round((y - 15) / TOWN_SPACING);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const t = townAt(i, j);
    if (x >= t.x0 && x < t.x0 + TW && y >= t.y0 && y < t.y0 + TH) return t;
  }
  return null;
}
function nearbyTowns(x, y, reach = 1) {
  const i0 = Math.round((x - 20) / TOWN_SPACING), j0 = Math.round((y - 15) / TOWN_SPACING), out = [];
  for (let i = i0 - reach; i <= i0 + reach; i++) for (let j = j0 - reach; j <= j0 + reach; j++) out.push(townAt(i, j));
  return out;
}
function nearestOtherTown(x, y) {
  const here = townContaining(x, y);
  let best = null, bd = Infinity;
  for (const t of nearbyTowns(x, y, 1)) {
    if (here && t.key === here.key) continue;
    const d = Math.abs(t.cx - x) + Math.abs(t.cy - y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
// Town layout in local coordinates, shared by the stamp and the renderer.
function townTile(town, wx, wy) {
  const lx = wx - town.x0, ly = wy - town.y0;
  const cx = 20, cy = 15;
  let g = GROUND.GRASS, t = TILE.FLOOR;
  if (ly >= cy - 6 && ly <= cy + 6 && lx >= cx - 11 && lx <= cx + 11) g = GROUND.COBBLE;
  if (lx >= cx - 1 && lx <= cx + 1) g = GROUND.COBBLE;            // the path through the square to the roads
  if (ly >= cy - 1 && ly <= cy && lx >= cx - 1 && lx <= cx) { t = TILE.FOUNTAIN; g = GROUND.COBBLE; }
  for (const h of town.houses) {
    if (wx >= h.x && wx < h.x + h.w && wy >= h.y && wy < h.y + h.h) t = (wx === h.doorX && wy === h.doorY) ? TILE.DOOR : TILE.WALL;
  }
  if (wx === town.gate.x && wy === town.gate.y) t = TILE.EXIT;
  return [t, g];
}
function generateWorldChunk(cx, cy) {
  const tiles = new Uint8Array(CHUNK * CHUNK), gr = new Uint8Array(CHUNK * CHUNK);
  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const g = terrainAt(ox + x, oy + y);
    gr[y * CHUNK + x] = g;
    tiles[y * CHUNK + x] = (g === GROUND.WATER || g === GROUND.MOUNTAIN || g === GROUND.TREE) ? TILE.WALL : TILE.FLOOR;
  }
  const mark = (wx, wy) => {
    const lx = wx - ox, ly = wy - oy;
    if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) return;
    gr[ly * CHUNK + lx] = GROUND.ROAD; tiles[ly * CHUNK + lx] = TILE.FLOOR;
  };
  // roads: every town links east and south to its lattice neighbours
  const i0 = Math.floor((ox - 20) / TOWN_SPACING), j0 = Math.floor((oy - 15) / TOWN_SPACING);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const a = townAt(i, j);
    for (const b of [townAt(i + 1, j), townAt(i, j + 1)]) {
      let x = a.cx, y = a.cy;
      while (x !== b.cx) { x += Math.sign(b.cx - x); mark(x, y); mark(x, y + 1); }
      while (y !== b.cy) { y += Math.sign(b.cy - y); mark(x, y); mark(x + 1, y); }
    }
  }
  // town stamps
  for (const town of nearbyTowns(ox + CHUNK / 2, oy + CHUNK / 2, 1)) {
    for (let y = Math.max(oy, town.y0); y < Math.min(oy + CHUNK, town.y0 + TH); y++) for (let x = Math.max(ox, town.x0); x < Math.min(ox + CHUNK, town.x0 + TW); x++) {
      const [t, g] = townTile(town, x, y);
      tiles[(y - oy) * CHUNK + (x - ox)] = t; gr[(y - oy) * CHUNK + (x - ox)] = g;
    }
  }
  return { tiles, seen: new Uint8Array(CHUNK * CHUNK), rooms: [], ground: gr };
}
function groundAt(x, y) {
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  const ch = getChunk(cx, cy);
  return ch.ground ? ch.ground[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] : GROUND.GRASS;
}
function townNpcs(town) {
  if (town.npcs) return town.npcs;
  town.npcs = [];
  const spots = [];
  for (let y = town.cy - 5; y <= town.cy + 5; y++) for (let x = town.cx - 10; x <= town.cx + 10; x++) {
    if (townTile(town, x, y)[0] === TILE.FLOOR && Math.abs(x - town.cx) + Math.abs(y - town.cy) >= 4) spots.push({ x, y });
  }
  const count = town.key === '0,0' ? NPC_TYPES.length : 2 + Math.floor(noise(town.i, town.j, 98) * 3);
  for (let n = 0; n < count && spots.length; n++) {
    const cell = spots.splice(Math.floor(noise(town.i, town.j, 100 + n) * spots.length), 1)[0];
    town.npcs.push({ ...cell, type: NPC_TYPES[(n + Math.floor(noise(town.i, town.j, 99) * 4)) % NPC_TYPES.length], pause: rnd(3), home: { x: town.cx, y: town.cy } });
  }
  return town.npcs;
}
// Houses and townsfolk of the towns around the hero become the live lists.
function refreshTownContext() {
  if (scene !== 'world') return;
  const near = nearbyTowns(player.x, player.y, 1);
  houses = near.flatMap((t) => t.houses);
  npcs = near.flatMap((t) => townNpcs(t));
}
function createWorld() {
  scene = 'world';
  bounded = null; ground = null; decor = null; interior = null;
  chunks = worldChunks;
  shops = []; monsters = []; potions = []; golds = []; exit = null; monstersDirty = true;
  refreshTownContext();
}
// Back to the overworld at the home town's square (after a dive, a death, or leaving a party).
function returnHome() {
  floor = TOWN;
  createWorld();
  const [i, j] = homeTown.split(',').map(Number);
  const t = townAt(i, j);
  player.x = t.spawn.x; player.y = t.spawn.y; player.wx = player.x; player.wy = player.y;
  settle(player);
  refreshTownContext();
}

function createInterior(house) {
  scene = 'house';
  const def = BUILDINGS[house.id];
  bounded = { w: 16, h: 10, tiles: Array.from({ length: 10 }, () => new Array(16).fill(TILE.WALL)) };
  decor = Array.from({ length: 10 }, () => new Array(16).fill(null));
  ground = null; shops = []; monsters = []; potions = []; golds = []; npcs = []; exit = null;
  def.layout.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') return;
    bounded.tiles[y][x] = TILE.FLOOR;
    if (ch === 'D') { bounded.tiles[y][x] = TILE.DOOR; player.x = x; player.y = y - 1; return; }
    if (FURNITURE[ch]) {
      decor[y][x] = FURNITURE[ch];
      bounded.tiles[y][x] = ch === 'B' ? TILE.BED : FURNITURE[ch].solid ? TILE.FURNITURE : TILE.FLOOR;
    } else if (def.npcs[ch]) {
      npcs.push({ x, y, type: INDOOR_NPCS[def.npcs[ch]], fixed: true, pause: 0 });
    }
  }));
}

function enterBuilding(house) {
  interior = { house };
  createInterior(house);
  afterSceneChange();
  log(`You enter ${house.name}.`);
}
function leaveBuilding() {
  const h = interior.house;
  interior = null;
  createWorld();
  player.x = h.doorX; player.y = h.doorY + 1; player.wx = player.x; player.wy = player.y; settle(player);
  for (const n of npcs) if (n.x === player.x && n.y === player.y) { n.y += 1; }
  afterSceneChange();
  log('You step back out onto the square.');
}

function talk(n) {
  const line = n.type.lines[rnd(n.type.lines.length)];
  log(`${n.type.name}: ${line}`);
  bubble = { x: n.x, y: n.y, text: line, until: performance.now() + 4000 };
  if (n.type.action === 'shop') openShop('shop');
  else if (n.type.action === 'potions') openShop('potions');
  else if (n.type.action === 'inn') restAtInn();
}
function stepNpcs() {
  for (const n of npcs) {
    if (n.fixed || n.pause-- > 0) continue;
    n.pause = 1 + rnd(4);
    const [dx, dy] = DIRS[rnd(4)];
    const nx = n.x + dx, ny = n.y + dy;
    if (getTile(nx, ny) !== TILE.FLOOR || getNpcAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
    if (n.home && (Math.abs(nx - n.home.x) > 13 || Math.abs(ny - n.home.y) > 9)) continue;
    if (dx) n.face = dx;
    n.x = nx; n.y = ny;
    if (bubble && bubble.x === n.x - dx && bubble.y === n.y - dy) { bubble.x = n.x; bubble.y = n.y; }
  }
}
function useFurniture(d) {
  const id = interior && interior.house.id;
  if (d.sprite === 'counter' && id === 'shop') return openShop('shop');
  if (d.sprite === 'counter' && id === 'herbs') return openShop('potions');
  if (d.sprite === 'counter' && id === 'inn') return restAtInn();
  const flavour = {
    shelf: id === 'herbs' ? 'Jars of dried roots and something that is still moving.' : 'Neatly labelled stock. Fenwick does not like browsing hands.',
    table: 'A sturdy table. Someone has carved a map of the first floor into it. It is wrong.',
    barrel: 'It smells of ale. Mostly.',
    rack: 'Spears and shields, property of the town watch. Not for sale.',
    chest: id === 'watch' ? 'Locked. The watch keeps its pay in here.' : "Hilde's things. Best leave them.",
    fire: 'The fire crackles. Warm, after the dungeon.',
    plant: 'A healthy fern. Someone waters it.',
  };
  log(flavour[d.sprite] || `${d.name}.`);
}
function restAtInn() {
  if (player.hp < player.maxHp) { player.hp = player.maxHp; log('You rest at the inn and recover fully.', 'good'); }
  else log('You are already in perfect health.');
  updateStats();
}

// ---------- the endless dungeon ----------
// Each chunk digs a few rooms, joins them, and runs corridors from the first
// room to the middle of all four edges. Neighbouring chunks meet at those
// midpoints, so every chunk is reachable from every other.
function generateChunk(cx, cy) {
  const rand = seededRandom(hash32(floorSeed, cx, cy));
  const r = (n) => Math.floor(rand() * n);
  const tiles = new Uint8Array(CHUNK * CHUNK).fill(TILE.WALL);
  const seen = new Uint8Array(CHUNK * CHUNK);
  const at = (x, y) => y * CHUNK + x;
  const carve = (x, y) => { if (x >= 0 && y >= 0 && x < CHUNK && y < CHUNK) tiles[at(x, y)] = TILE.FLOOR; };
  const rooms = [];
  for (let attempt = 0; attempt < 30 && rooms.length < 3 + r(3); attempt++) {
    const w = 4 + r(6), h = 3 + r(5);
    const x = 2 + r(CHUNK - w - 4), y = 2 + r(CHUNK - h - 4);
    const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
    if (rooms.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 1 && y + h + 1 > o.y)) continue;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) carve(xx, yy);
    rooms.push(room);
  }
  const link = (ax, ay, bx, by) => {
    let x = ax, y = ay;
    if (rand() < 0.5) { while (x !== bx) { x += Math.sign(bx - x); carve(x, y); } while (y !== by) { y += Math.sign(by - y); carve(x, y); } }
    else { while (y !== by) { y += Math.sign(by - y); carve(x, y); } while (x !== bx) { x += Math.sign(bx - x); carve(x, y); } }
  };
  for (let i = 1; i < rooms.length; i++) link(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  const hub = rooms[0];
  const mid = CHUNK / 2;
  for (const [ex, ey] of [[mid, 0], [mid, CHUNK - 1], [0, mid], [CHUNK - 1, mid]]) { carve(ex, ey); link(ex, ey, hub.cx, hub.cy); }
  // dressing: bones and torches recorded as deterministic noise at draw time
  const chunk = { cx, cy, tiles, seen, rooms, populated: false };
  populateChunk(chunk, rand);
  return chunk;
}

// Monsters, potions, gold and sometimes a merchant for a freshly dug chunk.
function populateChunk(chunk, rand) {
  const r = (n) => Math.floor(rand() * n);
  const ox = chunk.cx * CHUNK, oy = chunk.cy * CHUNK;
  const cells = [];
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) if (chunk.tiles[y * CHUNK + x] === TILE.FLOOR) cells.push({ x: ox + x, y: oy + y });
  const spawnChunk = chunk.cx === 0 && chunk.cy === 0;
  const pool = MONSTER_TYPES.filter((t) => t.minFloor <= floor);
  const take = () => cells.splice(r(cells.length), 1)[0];
  const mCount = Math.min(cells.length / 10, 6 + floor * 2 + r(4));
  for (let i = 0; i < mCount && cells.length; i++) {
    const cell = take();
    if (spawnChunk && dist(cell, { x: ox + CHUNK / 2, y: oy + CHUNK / 2 }) < 7) continue;
    const t = pool[r(pool.length)];
    monsters.push({ ...cell, type: t, hp: t.hp + Math.floor(floor / 2), maxHp: t.hp + Math.floor(floor / 2), atk: t.atk, awake: false });
    monstersDirty = true;
  }
  for (let i = 0; i < 2 + r(3) && cells.length; i++) potions.push({ ...take(), heal: 5 });
  for (let i = 0; i < 5 + floor + r(4) && cells.length; i++) golds.push({ ...take(), amount: 5 + r(10) + floor * 2 });
  if ((spawnChunk || rand() < 0.2) && chunk.rooms.length) {
    const room = chunk.rooms[spawnChunk ? 0 : r(chunk.rooms.length)];
    const sx = ox + room.x + r(room.w), sy = oy + room.y + r(room.h);
    if (!(spawnChunk && sx === ox + room.cx && sy === oy + room.cy)) {
      chunk.tiles[(sy - oy) * CHUNK + (sx - ox)] = TILE.SHOP;
      shops.push({ x: sx, y: sy });
    }
  }
}

function createDungeon() {
  scene = 'dungeon';
  bounded = null; ground = null; decor = null; houses = []; npcs = []; interior = null;
  chunks = new Map(); monsters = []; potions = []; golds = []; shops = []; monstersDirty = true;
  floorSeed = hash32(Date.now() & 0xffff, floor, rnd(1e6));
  const spawn = getChunk(0, 0);
  player.x = spawn.rooms[0].cx; player.y = spawn.rooms[0].cy;
  // The stairs down: a few chunks away in a random direction, in that chunk's first room.
  const angle = Math.random() * Math.PI * 2, far = 2 + rnd(2);
  const ex = Math.round(Math.cos(angle) * far) || 2, ey = Math.round(Math.sin(angle) * far);
  const target = getChunk(ex, ey);
  exit = { x: ex * CHUNK + target.rooms[0].cx, y: ey * CHUNK + target.rooms[0].cy };
  setTile(exit.x, exit.y, TILE.EXIT);
  monsters = monsters.filter((m) => !(m.x === exit.x && m.y === exit.y)); monstersDirty = true;
}

// ---------- visibility and pathing ----------
// Breadth-first distances from a point, out to a limit. Returns a Map of "x,y" -> steps.
function bfs(sx, sy, limit, blockMonsters) {
  const d = new Map([[key(sx, sy), 0]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [cx, cy] = q.shift();
    const dd = d.get(key(cx, cy));
    if (dd >= limit) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (d.has(k) || !walkable(getTile(nx, ny))) continue;
      if (blockMonsters && getMonsterAt(nx, ny)) continue;
      d.set(k, dd + 1);
      q.push([nx, ny]);
    }
  }
  return d;
}

function updateVisibility() {
  bgDirty = true;
  visible = new Set();
  if (safeZone()) return;
  const d = bfs(player.x, player.y, VIEW_RADIUS, false);
  for (const k of d.keys()) {
    visible.add(k);
    const [x, y] = k.split(',').map(Number);
    markSeen(x, y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (getTile(x + dx, y + dy) === TILE.WALL) { visible.add(key(x + dx, y + dy)); markSeen(x + dx, y + dy); }
    }
  }
}

// ---------- camera and animation ----------
// Everything that moves has a render position (rx, ry) that glides to its
// tile position; the camera follows the hero's render position so the hero
// stays centred while the world slides underneath.
const floats = [];
function floatText(x, y, text, color) { floats.push({ x, y, text, color, at: performance.now() }); }
function settle(o) { o.rx = o.x; o.ry = o.y; }
function animate(now) {
  const ease = (o) => {
    if (o.rx === undefined) settle(o);
    o.rx += (o.x - o.rx) * 0.35; o.ry += (o.y - o.ry) * 0.35;
    if (Math.abs(o.x - o.rx) < 0.01) o.rx = o.x;
    if (Math.abs(o.y - o.ry) < 0.01) o.ry = o.y;
  };
  ease(player);
  for (const m of monsters) if (cheb(m, player) <= SIM_RADIUS) ease(m);
  for (const n of npcs) ease(n);
  updateCamera();
}
function updateCamera() {
  const px = player.rx ?? player.x, py = player.ry ?? player.y;
  cam.x = Math.round(px * T + T / 2 - canvas.width / 2);
  cam.y = Math.round(py * T + T / 2 - canvas.height / 2);
}
// Offset in pixels for a creature's lunge towards what it just attacked.
function lunge(o, now) {
  if (!o.lunge || now > o.lunge.until) return [0, 0];
  const f = (o.lunge.until - now) / 140;
  return [o.lunge.dx * 8 * f, o.lunge.dy * 8 * f];
}
function viewBounds() {
  return { x0: Math.floor(cam.x / T) - 1, y0: Math.floor(cam.y / T) - 1, x1: Math.ceil((cam.x + canvas.width) / T) + 1, y1: Math.ceil((cam.y + canvas.height) / T) + 1 };
}
function bgBounds() {
  return { x0: Math.floor(bgOrigin.x / T), y0: Math.floor(bgOrigin.y / T), x1: Math.ceil((bgOrigin.x + bg.width) / T), y1: Math.ceil((bgOrigin.y + bg.height) / T) };
}

// ---------- drawing ----------
const bg = document.createElement('canvas');
bg.width = canvas.width + T * 2; bg.height = canvas.height + T * 2;
const bgx = bg.getContext('2d');
let bgDirty = true;
let bgOrigin = { x: 0, y: 0 };

function drawBrick(g, c, r, lit) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 1);
  const faceBelow = walkable(getTile(c, r + 1));   // a wall with floor below shows its face
  g.fillStyle = faceBelow ? (n < 0.5 ? '#3b4f66' : '#374a60') : (n < 0.5 ? '#232f3e' : '#1f2b39');
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(X, Y + T / 2 - 1, T, 2); g.fillRect(X, Y + T - 2, T, 2);
  g.fillRect(X + T / 2 - 1, Y, 2, T / 2); g.fillRect(X + (n < 0.5 ? 4 : T - 6), Y + T / 2, 2, T / 2);
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(X, Y, T, 2);
  if (faceBelow) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X, Y + T - 6, T, 6); }
}
function drawStone(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 7);
  g.fillStyle = n < 0.5 ? '#1c4b63' : '#1a4559'; g.fillRect(X, Y, T, T);
  g.fillStyle = '#163d50';
  if (n < 0.25) g.fillRect(X + 6, Y + 8, 4, 3); else if (n < 0.5) g.fillRect(X + 20, Y + 22, 6, 2); else if (n < 0.6) g.fillRect(X + 12, Y + 16, 2, 2);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(X, Y + T - 1, T, 1); g.fillRect(X + T - 1, Y, 1, T);
}
function drawCobble(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, q = T / 2;
  g.fillStyle = '#4b5563'; g.fillRect(X, Y, T, T);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const n = noise(c * 2 + i, r * 2 + j, 3);
    g.fillStyle = n < 0.33 ? '#6b7280' : n < 0.66 ? '#5e6672' : '#737b88';
    g.fillRect(X + i * q + 2, Y + j * q + 2, q - 4, q - 4);
  }
}
function drawGrass(g, c, r, forest = false) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 11);
  g.fillStyle = forest ? (n < 0.5 ? '#2f5f2c' : '#336a30') : (n < 0.5 ? '#3f7d3a' : '#448a3f'); g.fillRect(X, Y, T, T);
  g.fillStyle = forest ? '#3f7d3a' : '#5aa352';
  if (n < 0.3) { g.fillRect(X + 7, Y + 10, 2, 5); g.fillRect(X + 20, Y + 18, 2, 5); }
  else if (n < 0.6) { g.fillRect(X + 15, Y + 5, 2, 5); g.fillRect(X + 24, Y + 23, 2, 4); }
}
function drawWater(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 21);
  g.fillStyle = n < 0.5 ? '#1d4ed8' : '#1e40af'; g.fillRect(X, Y, T, T);
  g.fillStyle = '#60a5fa';
  if (n < 0.3) g.fillRect(X + 6, Y + 10, 10, 2); else if (n < 0.55) g.fillRect(X + 16, Y + 22, 10, 2);
  // a lighter shore where land touches
  if (groundAt(c, r - 1) !== GROUND.WATER || groundAt(c - 1, r) !== GROUND.WATER) { g.fillStyle = 'rgba(147,197,253,0.35)'; g.fillRect(X, Y, T, 3); }
}
function drawSand(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 23);
  g.fillStyle = n < 0.5 ? '#e7d3a1' : '#dfc78f'; g.fillRect(X, Y, T, T);
  g.fillStyle = '#cdb272'; if (n < 0.3) g.fillRect(X + 9, Y + 14, 3, 3); else if (n < 0.6) g.fillRect(X + 20, Y + 6, 2, 2);
}
function drawMountain(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 25);
  g.fillStyle = n < 0.5 ? '#6b7280' : '#5b6370'; g.fillRect(X, Y, T, T);
  g.fillStyle = '#4b5563'; g.beginPath(); g.moveTo(X + 4, Y + T - 4); g.lineTo(X + T / 2, Y + 6); g.lineTo(X + T - 4, Y + T - 4); g.closePath(); g.fill();
  g.fillStyle = '#e5e7eb'; g.beginPath(); g.moveTo(X + T / 2 - 5, Y + 13); g.lineTo(X + T / 2, Y + 6); g.lineTo(X + T / 2 + 5, Y + 13); g.closePath(); g.fill();
}
function drawRoad(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 27);
  g.fillStyle = n < 0.5 ? '#a8865a' : '#9f7e53'; g.fillRect(X, Y, T, T);
  g.fillStyle = '#8c6d45'; if (n < 0.35) g.fillRect(X + 8, Y + 12, 4, 3); else if (n < 0.7) g.fillRect(X + 20, Y + 20, 3, 3);
}
function drawHouse(g, h) {
  const X = h.x * T - off.x, Y = h.y * T - off.y, W = h.w * T, H = h.h * T, roofH = Math.floor(H * 0.45);
  g.fillStyle = '#d9b382'; g.fillRect(X, Y + roofH, W, H - roofH);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = Y + roofH + 6; y < Y + H; y += 10) g.fillRect(X, y, W, 2);
  g.fillStyle = h.roof; g.fillRect(X - 4, Y, W + 8, roofH);
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = Y + 6; y < Y + roofH; y += 8) g.fillRect(X - 4, y, W + 8, 2);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X - 4, Y, W + 8, 3);
  for (let wx = X + 12; wx < X + W - 12; wx += 40) {
    g.fillStyle = '#7bdfff'; g.fillRect(wx, Y + roofH + 10, 14, 14);
    g.fillStyle = '#1b2733'; g.fillRect(wx + 6, Y + roofH + 10, 2, 14); g.fillRect(wx, Y + roofH + 16, 14, 2);
  }
  const dx = h.doorX * T - off.x + 6;
  g.fillStyle = '#5b3a1a'; g.fillRect(dx, Y + H - 22, 20, 22);
  g.fillStyle = '#ffd86b'; g.fillRect(dx + 14, Y + H - 12, 3, 3);
  if (h.sign) {
    const sw = Math.max(26, h.sign.length * 8 + 8);
    g.fillStyle = '#f4f4f4'; g.fillRect(dx + 10 - sw / 2, Y + roofH - 7, sw, 13);
    g.fillStyle = '#1b1b2f'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(h.sign, dx + 10, Y + roofH);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }
}

function renderBackground() {
  bgDirty = false;
  const g = bgx;
  off = bgOrigin;
  const { x0, y0, x1, y1 } = bgBounds();
  if (scene === 'house') {
    g.fillStyle = '#060c14'; g.fillRect(0, 0, bg.width, bg.height);
    for (let r = Math.max(0, y0); r <= Math.min(bounded.h - 1, y1); r++) for (let c = Math.max(0, x0); c <= Math.min(bounded.w - 1, x1); c++) {
      const t = bounded.tiles[r][c], X = c * T - off.x, Y = r * T - off.y;
      if (t === TILE.WALL) {
        g.fillStyle = r === 0 ? '#5b3a1a' : '#6b4423'; g.fillRect(X, Y, T, T);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 6; y < T; y += 10) g.fillRect(X, Y + y, T, 2);
        if (r === 0 && c > 0 && c < 15 && noise(c, r, 2) < 0.3) { g.fillStyle = '#7bdfff'; g.fillRect(X + 9, Y + 8, 14, 14); g.fillStyle = '#1b2733'; g.fillRect(X + 15, Y + 8, 2, 14); g.fillRect(X + 9, Y + 14, 14, 2); }
      } else {
        g.fillStyle = noise(c, r, 4) < 0.5 ? '#a97c50' : '#b08656'; g.fillRect(X, Y, T, T);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X, Y + T - 2, T, 2); g.fillRect(X + (c % 2) * (T / 2), Y, 2, T);
        if (t === TILE.DOOR) { g.fillStyle = '#5b3a1a'; g.fillRect(X + 4, Y + 2, T - 8, T - 2); g.fillStyle = '#ffd86b'; g.fillRect(X + T - 10, Y + T / 2, 3, 3); }
        if (decor[r][c]) drawSprite(g, decor[r][c].sprite, c, r, 1, 2);
      }
    }
    g.fillStyle = '#e6eef8'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
    g.fillText(interior.house.name, bounded.w * T / 2 - off.x, -cam.y - 10);
    g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif';
    g.fillText('Walk into things to use them. The door at the bottom leads out.', bounded.w * T / 2 - off.x, bounded.h * T - off.y + 20);
    g.textAlign = 'start';
    return;
  }
  if (scene === 'world') {
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
      const t = getTile(c, r), gnd = groundAt(c, r);
      if (gnd === GROUND.COBBLE || t === TILE.FOUNTAIN) drawCobble(g, c, r);
      else if (gnd === GROUND.WATER) drawWater(g, c, r);
      else if (gnd === GROUND.SAND) drawSand(g, c, r);
      else if (gnd === GROUND.MOUNTAIN) drawMountain(g, c, r);
      else if (gnd === GROUND.ROAD) drawRoad(g, c, r);
      else if (gnd === GROUND.FOREST || gnd === GROUND.TREE) { drawGrass(g, c, r, true); if (gnd === GROUND.TREE) drawSprite(g, 'tree', c, r, 1, 1); }
      else { drawGrass(g, c, r); if (t === TILE.FLOOR && noise(c, r, 9) < 0.06) drawSprite(g, 'flower', c, r); }
      if (t === TILE.FOUNTAIN) {
        const X = c * T - off.x, Y = r * T - off.y;
        g.fillStyle = '#9ca3af'; g.fillRect(X, Y, T, T);
        g.fillStyle = '#6b7280';
        if (getTile(c - 1, r) !== TILE.FOUNTAIN) g.fillRect(X, Y, 5, T); else g.fillRect(X + T - 5, Y, 5, T);
        if (getTile(c, r - 1) !== TILE.FOUNTAIN) g.fillRect(X, Y, T, 5); else g.fillRect(X, Y + T - 5, T, 5);
      }
      if (t === TILE.EXIT) {
        const X = c * T - off.x, Y = r * T - off.y;
        g.fillStyle = '#374151'; g.fillRect(X - 6, Y - 6, T + 12, T + 12);
        g.fillStyle = '#9ca3af'; g.fillRect(X - 6, Y - 6, T + 12, 4);
        drawSprite(g, 'stairs', c, r);
      }
    }
    for (const h of houses) if (h.x <= x1 && h.x + h.w >= x0 && h.y <= y1 && h.y + h.h >= y0) drawHouse(g, h);
    for (const town of nearbyTowns(player.x, player.y, 1)) {
      if (town.cx < x0 - 12 || town.cx > x1 + 12 || town.cy < y0 - 8 || town.cy > y1 + 8) continue;
      for (const [lc, lr] of [[town.cx - 11, town.cy - 6], [town.cx + 11, town.cy - 6], [town.cx - 11, town.cy + 6], [town.cx + 11, town.cy + 6]]) drawSprite(g, 'lamp', lc, lr);
      g.fillStyle = 'rgba(6,12,20,0.6)'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
      const w = g.measureText(town.name).width + 14;
      g.fillRect(town.cx * T - off.x + T - w / 2, town.y0 * T - off.y + T * 1.2, w, 20);
      g.fillStyle = '#ffd86b'; g.textBaseline = 'top'; g.fillText(town.name, town.cx * T - off.x + T, town.y0 * T - off.y + T * 1.2 + 3);
      g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    }
    return;
  }
  // dungeon
  g.fillStyle = '#060c14'; g.fillRect(0, 0, bg.width, bg.height);
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
    if (!wasSeen(c, r)) continue;
    const t = getTile(c, r);
    if (t === TILE.WALL) drawBrick(g, c, r);
    else {
      drawStone(g, c, r);
      if (t === TILE.FLOOR && noise(c, r, 13) < 0.03) drawSprite(g, 'bones', c, r, 0.8);
      if (t === TILE.EXIT) drawSprite(g, 'stairs', c, r);
      if (t === TILE.SHOP) { g.fillStyle = 'rgba(192,132,252,0.25)'; g.fillRect(c * T - off.x, r * T - off.y, T, T); }
    }
  }
  // light falls off towards the edge of sight
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
    if (!wasSeen(c, r)) continue;
    const lit = visible.has(key(c, r));
    const dd = cheb({ x: c, y: r }, player);
    const dark = !lit ? 0.68 : Math.min(0.5, Math.max(0, (dd - 3) / VIEW_RADIUS) * 0.6);
    if (dark > 0) { g.fillStyle = `rgba(4,10,18,${dark})`; g.fillRect(c * T - off.x, r * T - off.y, T, T); }
  }
}

function drawBubble(g, b) {
  g.font = '13px sans-serif';
  const pad = 6, lines = [];
  let line = '';
  for (const word of b.text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width + pad * 2 > 300 && line) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2, bh = lines.length * 17 + pad * 2;
  let bx = b.x * T - cam.x + T / 2 - bw / 2, by = b.y * T - cam.y - bh - 8;
  bx = Math.max(4, Math.min(canvas.width - bw - 4, bx)); if (by < 4) by = b.y * T - cam.y + T + 8;
  g.fillStyle = 'rgba(244,244,244,0.95)';
  g.beginPath(); g.roundRect(bx, by, bw, bh, 6); g.fill();
  g.fillStyle = '#1b1b2f'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, bx + pad, by + pad + i * 17));
  g.textBaseline = 'alphabetic';
}

function drawHud(g, now) {
  const where = scene === 'house' ? interior.house.name : inTown() ? (townContaining(player.x, player.y)?.name ?? 'The wilds') : `Floor ${floor}/${FINAL_FLOOR}`;
  const text = `${where}   HP ${player.hp}/${player.maxHp}   ATK ${player.atk + weaponAtk()}   DEF ${armorDef()}   Lv ${player.level}   Gold ${player.gold}`;
  g.font = 'bold 13px sans-serif';
  const w = g.measureText(text).width + 20;
  g.fillStyle = 'rgba(6,12,20,0.78)';
  g.beginPath(); g.roundRect(8, 8, w, 36, 6); g.fill();
  g.fillStyle = '#e6eef8'; g.textBaseline = 'top'; g.fillText(text, 18, 14);
  const ratio = Math.max(0, player.hp / player.maxHp);
  g.fillStyle = '#06202c'; g.fillRect(18, 32, w - 20, 6);
  g.fillStyle = ratio > 0.5 ? '#5fe17a' : ratio > 0.25 ? '#f5c542' : '#ff6b6b'; g.fillRect(18, 32, (w - 20) * ratio, 6);
  if (coop.active && coop.party) {
    g.font = '12px sans-serif';
    const rows = coop.party.members.filter((m) => m.id !== coop.memberId);
    rows.forEach((m, i) => {
      const other = coop.others.find((o) => o.id === m.id);
      const text = `${m.name}  ${other ? `${other.hp}/${other.max_hp} HP` : m.in_dungeon ? 'nearby' : 'in town'}`;
      g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, 50 + i * 22, g.measureText(text).width + 20, 18, 5); g.fill();
      g.fillStyle = other ? '#9fd4ff' : '#a8c0d8'; g.fillText(text, 18, 53 + i * 22);
    });
  }
  // compass: to the stairs in the dungeon, to the next town outdoors
  const target = scene === 'dungeon' ? exit : (inTown() ? (() => { const t = nearestOtherTown(player.x, player.y); return t ? { x: t.cx, y: t.cy, name: t.name } : null; })() : null);
  if (target) {
    const dx = target.x - player.x, dy = target.y - player.y, d = Math.abs(dx) + Math.abs(dy);
    const what = scene === 'dungeon' ? 'Stairs' : target.name;
    const label = d === 0 ? `${what}: here` : `${what} ${Math.abs(dy) > Math.abs(dx) / 2 ? (dy < 0 ? 'N' : 'S') : ''}${Math.abs(dx) > Math.abs(dy) / 2 ? (dx < 0 ? 'W' : 'E') : ''}  ${d} tiles`;
    g.font = 'bold 12px sans-serif';
    const cw = g.measureText(label).width + 36;
    const bx = canvas.width - cw - 8;
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(bx, 8, cw, 28, 6); g.fill();
    g.fillStyle = '#5fe17a'; g.fillText(label, bx + 30, 15);
    // arrow
    const ang = Math.atan2(dy, dx), ax = bx + 16, ay = 22;
    g.strokeStyle = '#5fe17a'; g.lineWidth = 2; g.beginPath();
    g.moveTo(ax - Math.cos(ang) * 7, ay - Math.sin(ang) * 7); g.lineTo(ax + Math.cos(ang) * 7, ay + Math.sin(ang) * 7); g.stroke();
    g.beginPath(); g.moveTo(ax + Math.cos(ang) * 7, ay + Math.sin(ang) * 7);
    g.lineTo(ax + Math.cos(ang + 2.5) * 5, ay + Math.sin(ang + 2.5) * 5); g.lineTo(ax + Math.cos(ang - 2.5) * 5, ay + Math.sin(ang - 2.5) * 5); g.closePath(); g.fillStyle = '#5fe17a'; g.fill();
  }
  if (scene === 'dungeon' || inTown()) drawMinimap(g);
  g.font = '13px sans-serif';
  const recent = messages.filter((m) => now - m.at < 9000);
  if (recent.length) {
    const lh = 18, pad = 8, bw = canvas.width - 16, bh = recent.length * lh + pad * 2;
    g.fillStyle = 'rgba(6,12,20,0.78)';
    g.beginPath(); g.roundRect(8, canvas.height - bh - 8, bw, bh, 6); g.fill();
    recent.forEach((m, i) => {
      const age = now - m.at;
      g.globalAlpha = age > 6000 ? 1 - (age - 6000) / 3000 : 1;
      g.fillStyle = m.cls === 'good' ? '#9ef0b0' : m.cls === 'bad' ? '#ff9b9b' : '#e6eef8';
      g.fillText(m.text, 18, canvas.height - bh - 8 + pad + i * lh);
    });
    g.globalAlpha = 1;
  }
  g.textBaseline = 'alphabetic';
}

// Explored tiles around the hero, dungeon only.
const WORLD_MAP_COLORS = ['#448a3f', '#336a30', '#dfc78f', '#1d4ed8', '#6b7280', '#a8865a', '#6b7280', '#2e7d32'];
function drawMinimap(g) {
  const px = scene === 'world' ? 2 : 3, hw = scene === 'world' ? 48 : 30, hh = scene === 'world' ? 32 : 20;
  const W = (hw * 2 + 1) * px, H = (hh * 2 + 1) * px, X = canvas.width - W - 8, Y = 44;
  g.fillStyle = 'rgba(6,12,20,0.78)'; g.fillRect(X - 2, Y - 2, W + 4, H + 4);
  for (let dy = -hh; dy <= hh; dy++) for (let dx = -hw; dx <= hw; dx++) {
    const x = player.x + dx, y = player.y + dy;
    if (scene === 'world') {
      const t = getTile(x, y), gnd = groundAt(x, y);
      g.fillStyle = t === TILE.EXIT ? '#5fe17a' : (t === TILE.WALL && gnd === GROUND.GRASS) ? '#d9b382' : WORLD_MAP_COLORS[gnd];
      g.fillRect(X + (dx + hw) * px, Y + (dy + hh) * px, px, px);
      continue;
    }
    if (!wasSeen(x, y)) continue;
    const t = getTile(x, y);
    g.fillStyle = t === TILE.WALL ? '#2b3a4a' : t === TILE.EXIT ? '#5fe17a' : t === TILE.SHOP ? '#c084fc' : '#4b7f99';
    g.fillRect(X + (dx + hw) * px, Y + (dy + hh) * px, px, px);
  }
  g.fillStyle = '#ffd86b'; g.fillRect(X + hw * px, Y + hh * px, px, px);
}

function draw() {
  if (!player || scene === null) return;
  const now = performance.now();
  animate(now);
  const originX = Math.floor(cam.x / T) * T - T, originY = Math.floor(cam.y / T) * T - T;
  if (originX !== bgOrigin.x || originY !== bgOrigin.y) { bgOrigin = { x: originX, y: originY }; bgDirty = true; }
  if (bgDirty) renderBackground();
  off = cam;
  ctx.drawImage(bg, bgOrigin.x - cam.x, bgOrigin.y - cam.y);
  const { x0, y0, x1, y1 } = viewBounds();
  const inView = (o) => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1;
  if (inTown()) for (const town of nearbyTowns(player.x, player.y, 1)) {
    if (town.cx < x0 || town.cx > x1 || town.cy < y0 || town.cy > y1) continue;
    const X = (town.cx - 1) * T - cam.x + 5, Y = (town.cy - 1) * T - cam.y + 5, S = T * 2 - 10;
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(X, Y, S, S);
    for (let i = 0; i < 3; i++) {
      const rr = ((now / 900 + i / 3) % 1) * (S / 2);
      ctx.beginPath(); ctx.arc(X + S / 2, Y + S / 2, rr, 0, Math.PI * 2); ctx.strokeStyle = `rgba(244,244,244,${0.7 - rr / (S / 2) * 0.7})`; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(X + S / 2 - 2, Y + S / 2 - 16 + Math.sin(now / 200) * 3, 4, 16);
  }
  if (scene === 'dungeon') {
    // wall torches flicker where the noise says there is one
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
      if (!visible.has(key(c, r)) || getTile(c, r) !== TILE.WALL || !walkable(getTile(c, r + 1)) || noise(c, r, 17) >= 0.06) continue;
      ctx.fillStyle = `rgba(255,159,67,${0.12 + 0.08 * Math.sin(now / 120 + c)})`;
      ctx.beginPath(); ctx.arc(c * T - cam.x + T / 2, r * T - cam.y + T, T * 1.6, 0, Math.PI * 2); ctx.fill();
      drawSprite(ctx, 'torch', c, r, 1, 6);
    }
  }
  for (const g of golds) if (inView(g) && isVisible(g.x, g.y)) drawSprite(ctx, 'gold', g.x, g.y);
  for (const p of potions) {
    if (!inView(p) || !isVisible(p.x, p.y)) continue;
    ctx.fillStyle = `rgba(123,223,255,${0.18 + 0.12 * Math.sin(now / 300 + p.x + p.y)})`;
    ctx.beginPath(); ctx.arc(p.x * T - cam.x + T / 2, p.y * T - cam.y + T / 2, T * 0.55, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, 'potion', p.x, p.y);
  }
  for (const sh of shops) if (inView(sh) && isVisible(sh.x, sh.y)) drawSprite(ctx, 'merchant', sh.x, sh.y);
  if (scene === 'house') {
    for (let r = 0; r < bounded.h; r++) for (let c = 0; c < bounded.w; c++) {
      if (decor[r][c] && decor[r][c].sprite === 'fire') {
        ctx.fillStyle = `rgba(255,159,67,${0.15 + 0.1 * Math.sin(now / 150)})`;
        ctx.beginPath(); ctx.arc(c * T - cam.x + T / 2, r * T - cam.y + T / 2, T * 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const shadow = (x, y) => { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x * T - cam.x + T / 2, y * T - cam.y + T - 4, T * 0.3, 4, 0, 0, Math.PI * 2); ctx.fill(); };
  const bob = (o, idle = true) => (idle ? Math.sin(now / 260 + (o.x * 7 + o.y * 13)) * 0.03 : 0);
  if (safeZone()) for (const n of npcs) if (inView(n)) { const [lx, ly] = [n.rx ?? n.x, n.ry ?? n.y]; shadow(lx, ly); drawSprite(ctx, n.type.sprite, lx, ly - bob(n), 1, 3, n.face === -1); }
  for (const o of coop.others) {
    if (!inView(o)) continue;
    if (o.rx === undefined) settle(o);
    o.rx += (o.x - o.rx) * 0.35; o.ry += (o.y - o.ry) * 0.35;
    shadow(o.rx, o.ry);
    drawSprite(ctx, 'player', o.rx, o.ry - bob(o), 1, 3, o.face === -1);
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    const label = `${o.name} ${o.hp}/${o.max_hp}`; const lw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(6,12,20,0.7)'; ctx.fillRect(o.rx * T - cam.x + T / 2 - lw / 2, o.ry * T - cam.y - 16, lw, 14);
    ctx.fillStyle = '#9fd4ff'; ctx.fillText(label, o.rx * T - cam.x + T / 2, o.ry * T - cam.y - 5);
    ctx.textAlign = 'start';
  }
  for (const m of monsters) {
    if (!inView(m) || !isVisible(m.x, m.y)) continue;
    const [ldx, ldy] = lunge(m, now);
    const lx = (m.rx ?? m.x) + ldx / T, ly = (m.ry ?? m.y) + ldy / T - bob(m, m.awake);
    shadow(lx, ly);
    drawSprite(ctx, m.type.sprite, lx, ly, 1, 3, m.face === -1, m.flashUntil > now);
    if (m.hp < m.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, T - 6, 3);
      ctx.fillStyle = '#f33'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, (T - 6) * (m.hp / m.maxHp), 3);
    }
    if (!m.awake) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('z', lx * T - cam.x + T - 10, ly * T - cam.y + 11 + Math.sin(now / 400) * 2); }
  }
  {
    const [ldx, ldy] = lunge(player, now);
    const lx = (player.rx ?? player.x) + ldx / T, ly = (player.ry ?? player.y) + ldy / T - bob(player);
    shadow(lx, ly);
    ctx.fillStyle = 'rgba(255,216,107,0.16)'; ctx.beginPath(); ctx.arc(lx * T - cam.x + T / 2, ly * T - cam.y + T / 2, T * 0.7, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, 'player', lx, ly, 1, 3, player.face === -1, player.flashUntil > now);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], age = now - f.at;
    if (age > 800) { floats.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - age / 800; ctx.fillStyle = f.color; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x * T - cam.x + T / 2, f.y * T - cam.y - age / 40);
    ctx.textAlign = 'start'; ctx.globalAlpha = 1;
  }
  if (bubble) { if (now > bubble.until) bubble = null; else drawBubble(ctx, bubble); }
  if (inspected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(inspected.x * T - cam.x + 1, inspected.y * T - cam.y + 1, T - 2, T - 2); }
  drawHud(ctx, now);
}

// ---------- inspecting tiles (hover / tap) ----------
const tipEl = document.getElementById('tip');
const legendEl = document.getElementById('legend');
let inspected = null;

function describeTile(x, y) {
  if (!player) return null;
  const t = getTile(x, y);
  if (scene === 'dungeon' && !wasSeen(x, y)) return null;
  if (x === player.x && y === player.y) return `You — ${player.hp}/${player.maxHp} HP, attack ${player.atk + weaponAtk()}`;
  const n = safeZone() && getNpcAt(x, y);
  if (n) return `${n.type.name} — walk into them to ${n.type.action === 'shop' || n.type.action === 'potions' ? 'trade' : n.type.action === 'inn' ? 'rest' : 'chat'}`;
  if (isVisible(x, y)) {
    const m = getMonsterAt(x, y);
    if (m) return `${m.type.name} — ${m.hp}/${m.maxHp} HP, attack ${m.atk}${m.awake ? '' : ' (asleep)'}`;
    if (getPotionAt(x, y)) return 'Potion — restores 5 HP';
    const g = getGoldAt(x, y);
    if (g) return `Gold — ${g.amount} pieces`;
  }
  if (t === TILE.SHOP) return 'Merchant — step here to buy and sell gear';
  if (t === TILE.FOUNTAIN) return 'The town fountain';
  if (t === TILE.DOOR) {
    if (scene === 'house') return 'Door — back out to the square';
    const h = houses.find((hh) => hh.doorX === x && hh.doorY === y);
    return h ? `${h.name} — step onto the door to go in` : 'Door';
  }
  if (scene === 'house' && decor[y] && decor[y][x]) return decor[y][x].sprite === 'bed' ? 'Bed — lie down to rest' : `${decor[y][x].name} — walk into it`;
  if (inTown() && t === TILE.WALL) { const h = houses.find((hh) => x >= hh.x && x < hh.x + hh.w && y >= hh.y && y < hh.y + hh.h); if (h) return `${h.name} — the door is at the bottom`; }
  if (t === TILE.EXIT) return inTown() ? 'Dungeon gate — step here to begin your descent' : 'Stairs down — the exit from this floor';
  if (inTown()) {
    const gnd = groundAt(x, y);
    if (gnd === GROUND.WATER) return 'Water — too deep to cross';
    if (gnd === GROUND.MOUNTAIN) return 'Mountains — no way over';
    if (gnd === GROUND.TREE) return 'Dense trees — find a way round';
    if (gnd === GROUND.ROAD) { const nt = nearestOtherTown(x, y); return `Road${nt ? ' — leads towards ' + nt.name : ''}`; }
    if (gnd === GROUND.SAND) return 'Sand';
  }
  return null;
}
function tileFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  return { x: Math.floor(((e.clientX - rect.left) * sx + cam.x) / T), y: Math.floor(((e.clientY - rect.top) * sy + cam.y) / T) };
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
  } else clearInspect();
}
function clearInspect() { inspected = null; tipEl.classList.remove('show'); }
canvas.addEventListener('mousemove', inspect);
canvas.addEventListener('mouseleave', clearInspect);
canvas.addEventListener('click', inspect);

function buildLegend() {
  legendEl.innerHTML = '';
  const add = (spriteName, label, detail, dim = false) => {
    const li = document.createElement('li');
    const c = document.createElement('canvas'); c.width = c.height = 18; c.className = 'swatch';
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.globalAlpha = dim ? 0.35 : 1;
    g.drawImage(sprite(spriteName), 1, 1, 16, 16);
    li.appendChild(c);
    li.insertAdjacentHTML('beforeend', `<b>${label}</b> <span class="muted">${detail}</span>`);
    legendEl.appendChild(li);
  };
  add('player', 'You', '');
  if (scene === 'house') {
    for (const n of npcs) add(n.type.sprite, n.type.name, n.type.action === 'inn' ? 'rest for free' : n.type.action ? 'buy and sell' : 'chat');
    add('bed', 'Bed', 'rest'); add('counter', 'Counter', 'trade or rest');
    return;
  }
  for (const t of MONSTER_TYPES) {
    const locked = t.minFloor > Math.max(floor, 1);
    add(t.sprite, t.name, locked ? `from floor ${t.minFloor}` : `${t.hp} HP, attack ${t.atk}, ${t.xp} XP`, locked);
  }
  add('potion', 'Potion', '+5 HP');
  add('gold', 'Gold', '');
  add('merchant', 'Merchant', 'buy and sell');
  if (inTown()) {
    add('guard', 'Townsfolk', 'walk into them to chat');
    add('stairs', 'Gate', 'into the dungeon');
    add('tree', 'Forest, water, mountains', 'impassable; roads join the towns');
  } else add('stairs', 'Stairs', 'follow the compass');
}

function updateStats() {
  const where = scene === 'house' ? interior.house.name : inTown() ? (townContaining(player.x, player.y)?.name ?? 'The wilds') : `Floor ${floor}/${FINAL_FLOOR}`;
  statsEl.textContent = `${where} | HP ${player.hp}/${player.maxHp} | ATK ${player.atk}${weaponAtk() ? '+' + weaponAtk() : ''} | DEF ${armorDef()} | Lv ${player.level} (${player.xp}/${xpToNext(player.level)} XP) | Gold ${player.gold}`;
  hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  hpBar.style.background = player.hp / player.maxHp > 0.5 ? '#5fe17a' : player.hp / player.maxHp > 0.25 ? '#f5c542' : '#ff6b6b';
  renderInventory();
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
  const now = performance.now();
  player.lunge = { dx: Math.sign(m.x - player.x), dy: Math.sign(m.y - player.y), until: now + 140 };
  if (m.x !== player.x) player.face = Math.sign(m.x - player.x);
  m.flashUntil = now + 120;
  floatText(m.x, m.y, `-${dmg}`, '#ffd86b');
  if (m.hp <= 0) {
    monsters = monsters.filter((x) => x !== m); monstersDirty = true;
    kills++;
    log(`You slay the ${m.type.name} (+${m.type.xp} XP).`, 'good');
    gainXp(m.type.xp);
    dropLoot(m);
  } else log(`You hit the ${m.type.name} for ${dmg}.`);
}
function monsterAttack(m) {
  const dmg = Math.max(1, m.atk - armorDef());
  player.hp -= dmg;
  const now = performance.now();
  m.lunge = { dx: Math.sign(player.x - m.x), dy: Math.sign(player.y - m.y), until: now + 140 };
  if (player.x !== m.x) m.face = Math.sign(player.x - m.x);
  player.flashUntil = now + 120;
  floatText(player.x, player.y, `-${dmg}`, '#ff6b6b');
  log(`${m.type.name} hits you for ${dmg}.`, 'bad');
}
function stepMonsters() {
  const d = bfs(player.x, player.y, SIM_RADIUS, false);
  for (const m of monsters) {
    if (m.hp <= 0 || cheb(m, player) > SIM_RADIUS) continue;
    if (!m.awake && isVisible(m.x, m.y) && dist(m, player) <= 6 && Math.random() < 0.7) m.awake = true;
    if (dist(m, player) === 1) { monsterAttack(m); continue; }
    if (!m.awake) continue;
    let best = null, bestD = d.get(key(m.x, m.y)) ?? Infinity;
    const dirs = DIRS.slice().sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!walkable(getTile(nx, ny)) || getMonsterAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
      const nd = d.get(key(nx, ny));
      if (nd !== undefined && nd < bestD) { bestD = nd; best = [nx, ny]; }
    }
    if (!best && Math.random() < 0.5) {
      const [dx, dy] = dirs[0];
      const nx = m.x + dx, ny = m.y + dy;
      if (getTile(nx, ny) === TILE.FLOOR && !getMonsterAt(nx, ny) && !(nx === player.x && ny === player.y)) best = [nx, ny];
    }
    if (best) { if (best[0] !== m.x) m.face = Math.sign(best[0] - m.x); monsterIndex.delete(key(m.x, m.y)); m.x = best[0]; m.y = best[1]; monsterIndex.set(key(m.x, m.y), m); }
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
    returnHome();
    afterSceneChange();
    log(`You escaped the dungeon with ${player.gold} gold at level ${player.level}! The town square welcomes you back.`, 'good');
    saveProgress('win');
    return;
  }
  createDungeon();
  afterSceneChange();
  log(floor === 1 ? 'You descend into the dungeon. Follow the compass to the stairs.' : `You descend to floor ${floor}.`, 'good');
  saveProgress('progress');
}

function tryMove(dx, dy) {
  if (gameOver || !player || shopOpen) return;
  const nx = player.x + dx, ny = player.y + dy;
  const t = getTile(nx, ny);
  if (coop.active) {
    if (dx) player.face = dx;
    if (dx === 0 && dy === 0) { coopAction({ type: 'wait' }); return; }
    if (t === TILE.WALL) return;
    const blocked = getMonsterAt(nx, ny) || coop.others.some((o) => o.x === nx && o.y === ny);
    if (blocked) {
      const m = getMonsterAt(nx, ny);
      if (m) player.lunge = { dx, dy, until: performance.now() + 140 };
    } else { player.x = nx; player.y = ny; updateCamera(); updateVisibility(); }
    coopAction({ type: 'move', dx, dy });
    draw();
    return;
  }
  if (t === TILE.WALL || t === TILE.FOUNTAIN) return;
  const n = safeZone() && getNpcAt(nx, ny);
  if (n) { talk(n); draw(); return; }
  if (t === TILE.FURNITURE) { useFurniture(decor[ny][nx]); draw(); return; }
  if (t === TILE.DOOR) {
    if (scene === 'house') leaveBuilding(); else enterBuilding(houses.find((h) => h.doorX === nx && h.doorY === ny));
    return;
  }
  if (dx) player.face = dx;
  const m = getMonsterAt(nx, ny);
  if (m) playerAttack(m);
  else {
    player.x = nx; player.y = ny;
    const pot = getPotionAt(nx, ny);
    if (pot) {
      const healed = Math.min(pot.heal, player.maxHp - player.hp);
      player.hp += healed;
      potions = potions.filter((p) => p !== pot);
      log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
      if (healed > 0) floatText(nx, ny, `+${healed}`, '#9ef0b0');
    }
    const g = getGoldAt(nx, ny);
    if (g) { player.gold += g.amount; golds = golds.filter((x) => x !== g); log(`You pick up ${g.amount} gold.`, 'good'); floatText(nx, ny, `+${g.amount}g`, '#f5c542'); }
    if (t === TILE.SHOP) openShop('shop');
    if (t === TILE.BED) {
      if (interior && interior.house.id === 'inn') restAtInn();
      else log(player.hp < player.maxHp ? 'Not your bed. You lie down anyway, but it does not help.' : 'A bed. Not yours.');
    }
    if (t === TILE.EXIT) {
      if (inTown()) { const here = townContaining(nx, ny); if (here) homeTown = here.key; player.wx = nx; player.wy = ny + 1; }
      if (inTown() && coop.party && ACCOUNT.user) { enterCoop(); return; }
      nextFloor(); return;
    }
    if (inTown()) { player.wx = nx; player.wy = ny; }
  }
  turn++;
  if (turn % SAVE_EVERY_TURNS === 0) saveProgress('progress');
  if (safeZone()) stepNpcs(); else stepMonsters();
  if (inTown() && (turn % 8 === 0)) refreshTownContext();
  updateCamera();
  updateVisibility();
  updateStats();
  if (player.hp <= 0) {
    player.hp = 0; updateStats();
    endGame('You died', `You fell on floor ${floor} after ${turn} turns with ${player.gold} gold. Press R to try again.`);
    { const t = townAt(...homeTown.split(',').map(Number)); player.wx = t.spawn.x; player.wy = t.spawn.y; }
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
  if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
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
overlay.addEventListener('click', init);
window.addEventListener('pagehide', () => { if (coop.active) stopCoop(); });

const stageEl = canvas.parentElement;
const fsBtn = document.getElementById('fullscreen');
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else stageEl.requestFullscreen?.().catch(() => log('Fullscreen is not available in this browser.', 'bad'));
}
function fitCanvas() {
  if (!document.fullscreenElement) { canvas.style.width = ''; canvas.style.height = ''; return; }
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}
fsBtn?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => { fitCanvas(); if (fsBtn) fsBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
window.addEventListener('resize', fitCanvas);
let touchStart = null;
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart || shopOpen) return;
  const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  e.preventDefault();
  if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0); else tryMove(0, Math.sign(dy));
});
window.addEventListener('pagehide', () => { if (!gameOver) saveProgress('progress', true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !gameOver) saveProgress('progress', true); });

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
  if (coop.active) { coopAction({ type: 'equip', where: idx }).then(renderShop); return; }
  const id = player.bag[idx];
  const kind = itemKind(id);
  if (kind === 'consumable') return;
  const slot = kind === 'weapon' ? 'weapon' : 'armor';
  player.bag.splice(idx, 1);
  if (player[slot]) player.bag.push(player[slot]);
  player[slot] = id;
  log(`You equip the ${itemInfo(id).name}.`, 'good');
  updateStats(); renderShop(); draw();
}
function drinkPotion(idx) {
  if (gameOver || !player) return;
  if (coop.active) { coopAction({ type: 'drink' }).then(renderShop); return; }
  if (idx === undefined) idx = player.bag.findIndex((id) => itemKind(id) === 'consumable');
  if (idx < 0) { log('You have no potions in your bag.'); draw(); return; }
  const it = itemInfo(player.bag[idx]);
  const healed = Math.min(it.heal, player.maxHp - player.hp);
  player.bag.splice(idx, 1);
  player.hp += healed;
  log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
  updateStats(); renderShop(); draw();
}
function dropLoot(m) {
  if (Math.random() > 0.12 || bagFull()) return;
  const pool = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor, ...ITEMS.consumables }).filter(([, it]) => it.floor <= floor);
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
const SHOPS = {
  shop: { title: 'Merchant', stock: (id, it) => it.floor <= Math.max(floor, 1) + 1, price: (it) => it.price, greet: 'The merchant greets you. Buy and sell with the buttons, Esc to leave.' },
  potions: { title: "Mara's potions", stock: (id) => id === 'potion', price: (it) => it.price - 2, greet: 'Mara sets out her potions. She buys gear too, at half price.' },
};
let shopKind = 'shop';
const buyPrice = (id) => SHOPS[shopKind].price(itemInfo(id));
function openShop(kind = 'shop') {
  if (!shopEl) return;
  shopKind = kind; shopOpen = true; shopEl.hidden = false;
  document.querySelector('#shop h2').textContent = SHOPS[kind].title;
  log(SHOPS[kind].greet);
  renderShop();
}
function closeShop() { if (!shopEl) return; shopOpen = false; shopEl.hidden = true; }
function renderShop() {
  if (!shopOpen) return;
  shopGold.textContent = `${player.gold} gold`;
  shopBuy.innerHTML = '';
  const stock = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor, ...ITEMS.consumables }).filter(([id, it]) => SHOPS[shopKind].stock(id, it));
  for (const [id] of stock) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = `Buy ${buyPrice(id)}g`;
    btn.disabled = player.gold < buyPrice(id) || bagFull();
    btn.addEventListener('click', () => buy(id));
    li.append(itemLabel(id), btn);
    shopBuy.appendChild(li);
  }
  shopSell.innerHTML = '';
  const owned = [];
  if (player.weapon) owned.push({ id: player.weapon, where: 'weapon' });
  if (player.armor) owned.push({ id: player.armor, where: 'armor' });
  player.bag.forEach((id, idx) => owned.push({ id, where: idx }));
  if (!owned.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nothing to sell'; shopSell.appendChild(li); }
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
  if (coop.active) { coopAction({ type: 'buy', item: id }).then(renderShop); return; }
  const it = itemInfo(id), price = buyPrice(id);
  if (player.gold < price || bagFull()) return;
  player.gold -= price; player.bag.push(id);
  log(`You buy a ${it.name} for ${price} gold.`, 'good');
  updateStats(); renderShop(); draw();
}
function sell(o) {
  if (coop.active) { coopAction({ type: 'sell', where: o.where }).then(renderShop); return; }
  const price = sellPrice(o.id);
  if (typeof o.where === 'string') player[o.where] = null; else player.bag.splice(o.where, 1);
  player.gold += price;
  log(`You sell the ${itemInfo(o.id).name} for ${price} gold.`, 'good');
  updateStats(); renderShop(); draw();
}
document.getElementById('shop-close')?.addEventListener('click', closeShop);

// ---------- setup ----------
function afterSceneChange() {
  bubble = null; closeShop(); clearInspect(); floats.length = 0;
  settle(player); for (const n of npcs) settle(n);
  updateCamera(); updateVisibility(); buildLegend(); updateStats(); draw();
}
function startRun(saved) {
  player = { x: 1, y: 1, hp: 20, maxHp: 20, atk: 3, level: 1, xp: 0, gold: 0, weapon: null, armor: null, bag: [] };
  floor = TOWN; interior = null; gameOver = false; turn = 0; kills = 0;
  overlay.classList.remove('show');
  logEl.innerHTML = ''; messages.length = 0;
  if (saved) {
    floor = saved.floor || TOWN;
    Object.assign(player, { hp: saved.hp, maxHp: saved.max_hp, atk: saved.atk, level: saved.level, xp: saved.xp, gold: saved.gold,
      weapon: itemInfo(saved.weapon) ? saved.weapon : null, armor: itemInfo(saved.armor) ? saved.armor : null,
      bag: (saved.bag || []).filter(itemInfo).slice(0, ITEMS.bag_size) });
  }
  if (saved && saved.home && /^-?\d+,-?\d+$/.test(saved.home)) homeTown = saved.home;
  if (floor === TOWN) {
    createWorld();
    const t = townAt(...homeTown.split(',').map(Number));
    if (saved && Number.isInteger(saved.wx) && Number.isInteger(saved.wy) && walkable(getTile(saved.wx, saved.wy))) { player.x = saved.wx; player.y = saved.wy; }
    else { player.x = t.spawn.x; player.y = t.spawn.y; }
    player.wx = player.x; player.wy = player.y; settle(player); refreshTownContext();
  } else createDungeon();
  afterSceneChange();
  if (saved && saved.floor > 0) log(`Welcome back, ${saved.name}. You resume on floor ${floor}. Follow the compass to the stairs.`, 'good');
  else if (saved && saved.level > 1) log(`Welcome back, ${saved.name}. ${townContaining(player.x, player.y) ? 'You are in ' + townContaining(player.x, player.y).name + '.' : 'You are out in the wilds.'} Roads lead to other towns.`, 'good');
  else log(`${saved ? saved.name + ' arrives' : 'You arrive'} in Hearth. Step onto a house door to go inside, take the gate at the bottom into the dungeon, or follow a road to the next town.`);
}
let starting = false;
async function init() {
  if (starting) return;
  starting = true;
  stopCoop();
  try {
    const [saved, partyInfo] = await Promise.all([loadProgress(), refreshParty()]);
    if (partyInfo && partyInfo.in_dungeon) {
      startRun({ ...saved, floor: 0 });
      await enterCoop();
    } else {
      startRun(saved && coop.party && coop.party.floor === 0 && saved.floor > 0 ? { ...saved, floor: 0 } : saved);
    }
  } finally { starting = false; }
}
function loop() { if (!gameOver) draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
init();
