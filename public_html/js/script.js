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

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2, SHOP: 3, INN: 4, FOUNTAIN: 5, DOOR: 6, FURNITURE: 7, BED: 8 };
const TOWN = 0; // floor number of the town square
const COLORS = {
  wall: '#0b2230', wallDim: '#08192a', floor: '#1b4a62', floorDim: '#10303f',
  exit: '#5fe17a', player: '#ffd86b', gold: '#f5c542', potion: '#7bdfff', unknown: '#060c14', shop: '#c084fc', inn: '#ff9ecf', fountain: '#3b82f6', townFloor: '#3a4a3a', townWall: '#5b4636',
};
const MONSTER_TYPES = [
  { name: 'Rat',    color: '#c98f5a', sprite: 'rat', hp: 3,  atk: 1, xp: 2,  minFloor: 1 },
  { name: 'Goblin', color: '#7ad36b', sprite: 'goblin', hp: 5,  atk: 2, xp: 4,  minFloor: 1 },
  { name: 'Skeleton', color: '#dcdcdc', sprite: 'skeleton', hp: 8, atk: 3, xp: 7, minFloor: 2 },
  { name: 'Orc',    color: '#ff6b6b', sprite: 'orc', hp: 12, atk: 4, xp: 12, minFloor: 3 },
  { name: 'Wraith', color: '#b18cff', sprite: 'wraith', hp: 10, atk: 5, xp: 16, minFloor: 4 },
];
const FINAL_FLOOR = 5;
const VIEW_RADIUS = 7;

const cols = 40, rows = 30;
const tileSize = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
canvas.width = tileSize * cols;
canvas.height = tileSize * rows;

let map, seen, visible, monsters, potions, golds, exit, shops;
let houses = [], npcs = [], ground = null, bubble = null;
let interior = null, decor = null; // set while the player is inside a building
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

// ---------- pixel sprites ----------
// 8x8 glyphs; each letter is a palette colour, '.' is transparent. They are
// rasterised once into small canvases and drawn scaled with no smoothing.
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
  potion:   ['...ww...', '...ee...', '..cccc..', '.cccccc.', '.ccwccc.', '.cccccc.', '..cccc..', '........'],
  gold:     ['........', '..yyyy..', '.yyooyy.', '.yoyyoy.', '.yyooyy.', '..yyyy..', 'yyyyyyyy', '.yyyyyy.'],
  stairs:   ['kkkkkkkk', 'kEEEEEEk', 'kkEEEEEk', 'kkkEEEEk', 'kkkkEEEk', 'kkkkkEEk', 'kkkkkkEk', 'kkkkkkkk'],
  tree:     ['..GGGG..', '.GGgGGG.', 'GGgGGGGG', 'GGGGGgGG', '.GGGGGG.', '..GGGG..', '...HH...', '...HH...'],
  flower:   ['........', '........', '...P....', '..PwP.y.', '...P.yoy', '...G..y.', '..GG.G..', '........'],
  lamp:     ['...kk...', '..kyyk..', '..kyyk..', '...kk...', '...kk...', '...kk...', '...kk...', '..kkkk..'],
  farmer:   ['.tttttt.', '..tttt..', '..ssss..', '..sksk..', '.GGGGGG.', '.GhhhhG.', '..hh.hh.', '..HH.HH.'],
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
const spriteCache = {};
function sprite(name) {
  if (spriteCache[name]) return spriteCache[name];
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d');
  SPRITES[name].forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  spriteCache[name] = c;
  return c;
}
function drawSprite(g, name, x, y, size = tileSize, alpha = 1) {
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  const pad = Math.floor(size * 0.1);
  g.drawImage(sprite(name), x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
  g.globalAlpha = 1;
}

// Townsfolk. The outdoor ones wander the square; the indoor ones keep their
// post and may do something when you walk into them (action).
const NPC_TYPES = [
  { sprite: 'guard', name: 'Bren the guard', lines: [
    'Keep your armor on down there. The orcs on floor three hit like a mule.',
    'Saw a wraith once. Could not hit it with a stick. Should have bought a better sword.',
    'The stairs are at the bottom of the square. Mind the step.'] },
  { sprite: 'elder', name: 'Old Mara', lines: [
    'Monsters sleep until they notice you. Walk softly and pick your fights.',
    'The merchant pays half what he charges. Sell him the junk, keep the good blade.',
    'Every floor has a merchant too, if you survive long enough to find him.'] },
  { sprite: 'child', name: 'Pip', lines: [
    'Did you see a skeleton? Are they scary? Can I come?',
    'I found a dagger once. Dad made me sell it.',
    'The fountain is lucky. Everyone says so.'] },
  { sprite: 'farmer', name: 'Tomas the farmer', lines: [
    'Rats in the dungeon, rats in my barn. At least yours give experience.',
    'Old Mara brews potions cheaper than the shop. Her cottage is the one at the bottom left.',
    'Clear all five floors and you come back up with everything you carried.'] },
];
const INDOOR_NPCS = {
  fenwick: { sprite: 'merchant', name: 'Fenwick the merchant', action: 'shop', lines: [
    'Finest steel this side of the dungeon. Come to the counter.'] },
  dottie: { sprite: 'innkeeper', name: 'Dottie the innkeeper', action: 'inn', lines: [
    'A bed is a bed. Take any that is free.'] },
  orla: { sprite: 'guard', name: 'Captain Orla', lines: [
    'The watch does not go below the first floor. That is what adventurers are for.',
    'Skeletons shrug off weak blows. Bring at least a mace by floor two.',
    'If you die down there, you come back with nothing but your name. Choose when to turn back.'] },
  mara: { sprite: 'elder', name: 'Old Mara', action: 'potions', lines: [
    'Potions, ten gold. Cheaper than Fenwick and twice as fresh.'] },
  hilde: { sprite: 'villager', name: 'Hilde', lines: [
    'Make yourself at home, but mind the chest. Pip thinks it is a dragon hoard.',
    'The inn heals you for free. Rest before you go down.',
    'Sell the merchant your spare gear; half price is better than carrying it.'] },
};

// Building interiors. 16x10 rooms drawn in the middle of the map.
//  # wall  . floor  D door  C counter  S shelf  B bed  T table  b barrel
//  R weapon rack  c chest  f fireplace  p plant  r rug  letters = who stands there
const BUILDINGS = {
  shop:     { name: "Fenwick's Goods", sign: 'SHOP', roof: '#6d3b8b', npcs: { M: 'fenwick' }, layout: [
    '################', '#SSSSSSSSSSSSS.#', '#.....M........#', '#..CCCCCCCC....#', '#..............#',
    '#.b............#', '#.b....T.......#', '#.........rr...#', '#..............#', '#######D########'] },
  watch:    { name: 'The Watch House', sign: 'WATCH', roof: '#7a4a2a', npcs: { G: 'orla' }, layout: [
    '################', '#RRRR......c.c.#', '#..............#', '#...G..........#', '#..............#',
    '#..T.T.........#', '#..............#', '#.........BB...#', '#..............#', '#######D########'] },
  inn:      { name: 'The Sleeping Rat', sign: 'INN', roof: '#8b2e2e', npcs: { I: 'dottie' }, layout: [
    '################', '#BB.BB.BB..f...#', '#..............#', '#..............#', '#......I.......#',
    '#....CCCCC.....#', '#..T.......T...#', '#..............#', '#..T...b...T...#', '#######D########'] },
  herbs:    { name: "Mara's Cottage", sign: 'HERBS', roof: '#2e7d32', npcs: { E: 'mara' }, layout: [
    '################', '#SS.f..........#', '#..............#', '#..E...........#', '#..CCC.........#',
    '#..............#', '#.....T....B...#', '#..p...........#', '#..............#', '#######D########'] },
  home:     { name: "Hilde's House", sign: '', roof: '#7a4a2a', npcs: { H: 'hilde' }, layout: [
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

const messages = []; // recent lines drawn inside the game view
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
  ground = Array.from({ length: rows }, () => new Array(cols).fill('grass'));
  const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
  for (let r = 2; r < rows - 2; r++) for (let c = 3; c < cols - 3; c++) map[r][c] = TILE.FLOOR;
  // Cobbled plaza in the middle, grass around the houses, a cobbled path to the gate.
  for (let r = cy - 6; r <= cy + 6; r++) for (let c = cx - 11; c <= cx + 11; c++) ground[r][c] = 'cobble';
  for (let r = cy + 6; r < rows - 2; r++) for (let c = cx - 1; c <= cx + 1; c++) ground[r][c] = 'cobble';
  for (let r = 2; r < cy - 6; r++) for (let c = cx - 1; c <= cx + 1; c++) ground[r][c] = 'cobble';
  houses = [];
  const house = (x, y, w, h, id) => {
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) map[r][c] = TILE.WALL;
    const doorX = x + Math.floor(w / 2), doorY = y + h - 1;
    map[doorY][doorX] = TILE.DOOR;
    houses.push({ x, y, w, h, id, doorX, doorY, ...BUILDINGS[id] });
  };
  house(6, 4, 6, 4, 'shop'); house(16, 3, 8, 3, 'watch'); house(28, 4, 6, 4, 'inn');
  house(6, rows - 8, 6, 4, 'herbs'); house(28, rows - 8, 6, 4, 'home');
  for (let r = cy - 1; r <= cy; r++) for (let c = cx - 1; c <= cx; c++) map[r][c] = TILE.FOUNTAIN;
  shops = [];
  exit = { x: cx, y: rows - 5 }; map[exit.y][exit.x] = TILE.EXIT; // the gate down into the dungeon (clear of the message strip)
  player.x = cx; player.y = cy + 3;
  monsters = []; potions = []; golds = [];
  // Townsfolk start on the plaza and wander from there.
  npcs = [];
  const spots = floorCells((c, r) => ground[r][c] !== 'cobble' || Math.abs(c - cx) + Math.abs(r - cy) < 4);
  for (const t of NPC_TYPES) {
    if (!spots.length) break;
    const cell = spots.splice(rnd(spots.length), 1)[0];
    npcs.push({ ...cell, type: t, pause: rnd(3) });
  }
  bubble = null;
}

function createInterior(house) {
  const def = BUILDINGS[house.id];
  const ox = Math.floor((cols - 16) / 2), oy = Math.floor((rows - 10) / 2);
  map = Array.from({ length: rows }, () => new Array(cols).fill(TILE.WALL));
  seen = Array.from({ length: rows }, () => new Array(cols).fill(true));
  decor = Array.from({ length: rows }, () => new Array(cols).fill(null));
  ground = null; shops = []; monsters = []; potions = []; golds = []; npcs = []; exit = null;
  def.layout.forEach((row, r) => [...row].forEach((ch, c) => {
    const x = ox + c, y = oy + r;
    if (ch === '#') return;
    map[y][x] = TILE.FLOOR;
    if (ch === 'D') { map[y][x] = TILE.DOOR; player.x = x; player.y = y - 1; return; }
    if (FURNITURE[ch]) {
      decor[y][x] = FURNITURE[ch];
      map[y][x] = ch === 'B' ? TILE.BED : FURNITURE[ch].solid ? TILE.FURNITURE : TILE.FLOOR;
    } else if (def.npcs[ch]) {
      npcs.push({ x, y, type: INDOOR_NPCS[def.npcs[ch]], fixed: true, pause: 0 });
    }
  }));
  interior.ox = ox; interior.oy = oy;
}

function enterBuilding(house) {
  interior = { house };
  buildFloor();
  log(`You enter ${house.name}.`);
  updateStats(); draw();
}

function leaveBuilding() {
  const h = interior.house;
  interior = null;
  buildFloor();
  player.x = h.doorX; player.y = h.doorY + 1;
  if (getNpcAt(player.x, player.y)) npcs = npcs.filter((n) => !(n.x === player.x && n.y === player.y));
  log(`You step back out onto the square.`);
  updateStats(); draw();
}

// Walking into furniture: a few pieces do something, the rest just describe themselves.
function useFurniture(d, x, y) {
  const action = interior && interior.house.id;
  if (d.sprite === 'counter' && action === 'shop') return openShop('shop');
  if (d.sprite === 'counter' && action === 'herbs') return openShop('potions');
  if (d.sprite === 'counter' && action === 'inn') return restAtInn();
  const flavour = {
    shelf: action === 'herbs' ? 'Jars of dried roots and something that is still moving.' : 'Neatly labelled stock. Fenwick does not like browsing hands.',
    table: 'A sturdy table. Someone has carved a map of the first floor into it. It is wrong.',
    barrel: 'It smells of ale. Mostly.',
    rack: 'Spears and shields, property of the town watch. Not for sale.',
    chest: action === 'watch' ? 'Locked. The watch keeps its pay in here.' : "Hilde's things. Best leave them.",
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

const getNpcAt = (x, y) => npcs.find((n) => n.x === x && n.y === y);

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
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd(4)];
    const nx = n.x + dx, ny = n.y + dy;
    if (map[ny][nx] !== TILE.FLOOR || getNpcAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
    if (Math.abs(nx - Math.floor(cols / 2)) > 13 || Math.abs(ny - Math.floor(rows / 2)) > 9) continue; // stay near the square
    n.x = nx; n.y = ny;
    if (bubble && bubble.x === n.x - dx && bubble.y === n.y - dy) { bubble.x = n.x; bubble.y = n.y; }
  }
}

const safeZone = () => floor === TOWN;          // town or inside a building: no monsters
const inTown = () => floor === TOWN && !interior; // outdoors on the square

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
  bgDirty = true;
  if (safeZone()) { visible = Array.from({ length: rows }, () => new Array(cols).fill(true)); return; }
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
// The map (ground, walls, houses, stairs) is rendered once per turn into an
// offscreen layer; sprites and animations are drawn over it every frame.
const bg = document.createElement('canvas');
bg.width = canvas.width; bg.height = canvas.height;
const bgx = bg.getContext('2d');
let bgDirty = true;

// Deterministic per-tile noise so textures do not shimmer between frames.
function noise(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function tileRect(g, c, r, color) { g.fillStyle = color; g.fillRect(c * tileSize, r * tileSize, tileSize, tileSize); }

function drawBrick(g, c, r) {
  const X = c * tileSize, Y = r * tileSize, n = noise(c, r);
  g.fillStyle = n < 0.5 ? '#2a3b4d' : '#273749';
  g.fillRect(X, Y, tileSize, tileSize);
  g.fillStyle = '#1b2733';
  const half = tileSize / 2;
  g.fillRect(X, Y + half - 1, tileSize, 1); g.fillRect(X, Y + tileSize - 1, tileSize, 1);
  g.fillRect(X + half - 1, Y, 1, half); g.fillRect(X + (n < 0.5 ? 2 : tileSize - 3), Y + half, 1, half);
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(X, Y, tileSize, 1);
}

function drawStone(g, c, r, base, dark) {
  const X = c * tileSize, Y = r * tileSize;
  g.fillStyle = base; g.fillRect(X, Y, tileSize, tileSize);
  g.fillStyle = dark;
  const n = noise(c, r, 7);
  if (n < 0.25) g.fillRect(X + 3, Y + 4, 2, 2);
  else if (n < 0.5) g.fillRect(X + 12, Y + 13, 3, 1);
  else if (n < 0.6) g.fillRect(X + 7, Y + 10, 1, 1);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X, Y + tileSize - 1, tileSize, 1); g.fillRect(X + tileSize - 1, Y, 1, tileSize);
}

function drawCobble(g, c, r) {
  const X = c * tileSize, Y = r * tileSize;
  g.fillStyle = '#4b5563'; g.fillRect(X, Y, tileSize, tileSize);
  const q = tileSize / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const n = noise(c * 2 + i, r * 2 + j, 3);
    g.fillStyle = n < 0.33 ? '#6b7280' : n < 0.66 ? '#5e6672' : '#737b88';
    g.fillRect(X + i * q + 1, Y + j * q + 1, q - 2, q - 2);
  }
}

function drawGrass(g, c, r) {
  const X = c * tileSize, Y = r * tileSize, n = noise(c, r, 11);
  g.fillStyle = n < 0.5 ? '#3f7d3a' : '#448a3f'; g.fillRect(X, Y, tileSize, tileSize);
  g.fillStyle = '#5aa352';
  if (n < 0.3) { g.fillRect(X + 4, Y + 6, 1, 3); g.fillRect(X + 12, Y + 11, 1, 3); }
  else if (n < 0.6) { g.fillRect(X + 9, Y + 3, 1, 3); g.fillRect(X + 15, Y + 14, 1, 2); }
}

function drawHouse(g, h) {
  const X = h.x * tileSize, Y = h.y * tileSize, W = h.w * tileSize, H = h.h * tileSize;
  const roofH = Math.floor(H * 0.45);
  // walls
  g.fillStyle = '#d9b382'; g.fillRect(X, Y + roofH, W, H - roofH);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = Y + roofH + 4; y < Y + H; y += 6) g.fillRect(X, y, W, 1);
  // roof with an overhang and shingle lines
  g.fillStyle = h.roof;
  g.fillRect(X - 2, Y, W + 4, roofH);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = Y + 4; y < Y + roofH; y += 5) g.fillRect(X - 2, y, W + 4, 1);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X - 2, Y, W + 4, 2);
  // windows
  g.fillStyle = '#7bdfff';
  for (let wx = X + 8; wx < X + W - 8; wx += 24) { g.fillRect(wx, Y + roofH + 6, 8, 8); g.fillStyle = '#1b2733'; g.fillRect(wx + 3, Y + roofH + 6, 2, 8); g.fillRect(wx, Y + roofH + 9, 8, 2); g.fillStyle = '#7bdfff'; }
  // door at the bottom middle
  const dx = h.doorX * tileSize + 4;
  g.fillStyle = '#5b3a1a'; g.fillRect(dx, Y + H - 14, 12, 14);
  g.fillStyle = '#ffd86b'; g.fillRect(dx + 9, Y + H - 8, 2, 2);
  // sign
  if (h.sign) {
    const sw = Math.max(16, h.sign.length * 5 + 6);
    g.fillStyle = '#f4f4f4'; g.fillRect(dx + 6 - sw / 2, Y + roofH - 4, sw, 8);
    g.fillStyle = '#1b1b2f'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(h.sign, dx + 6, Y + roofH);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }
}

function renderBackground() {
  bgDirty = false;
  const g = bgx;
  const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
  if (interior) {
    g.fillStyle = '#060c14'; g.fillRect(0, 0, bg.width, bg.height);
    const { ox, oy } = interior;
    for (let r = oy; r < oy + 10; r++) for (let c = ox; c < ox + 16; c++) {
      const t = map[r][c];
      const X = c * tileSize, Y = r * tileSize;
      if (t === TILE.WALL) {
        g.fillStyle = r === oy ? '#5b3a1a' : '#6b4423'; g.fillRect(X, Y, tileSize, tileSize);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 4; y < tileSize; y += 6) g.fillRect(X, Y + y, tileSize, 1);
        if (r === oy && c > ox && c < ox + 15 && noise(c, r, 2) < 0.3) { g.fillStyle = '#7bdfff'; g.fillRect(X + 6, Y + 5, 8, 8); g.fillStyle = '#1b2733'; g.fillRect(X + 9, Y + 5, 2, 8); g.fillRect(X + 6, Y + 8, 8, 2); }
      } else {
        g.fillStyle = noise(c, r, 4) < 0.5 ? '#a97c50' : '#b08656'; g.fillRect(X, Y, tileSize, tileSize);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X, Y + tileSize - 1, tileSize, 1); g.fillRect(X + (c % 2) * (tileSize / 2), Y, 1, tileSize);
        if (t === TILE.DOOR) { g.fillStyle = '#5b3a1a'; g.fillRect(X + 2, Y + 2, tileSize - 4, tileSize - 2); g.fillStyle = '#ffd86b'; g.fillRect(X + tileSize - 6, Y + tileSize / 2, 2, 2); }
        if (decor[r][c]) drawSprite(g, decor[r][c].sprite, c, r, tileSize, 1);
      }
    }
    g.fillStyle = '#e6eef8'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
    g.fillText(interior.house.name, canvas.width / 2, oy * tileSize - 8);
    g.fillStyle = '#a8c0d8'; g.font = '11px sans-serif';
    g.fillText('Walk into things to use them. The door at the bottom leads out.', canvas.width / 2, (oy + 10) * tileSize + 16);
    g.textAlign = 'start';
    return;
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = map[r][c];
    if (inTown()) {
      if (ground[r][c] === 'cobble' || t === TILE.FOUNTAIN) drawCobble(g, c, r); else drawGrass(g, c, r);
      if (t === TILE.WALL && (r < 2 || r >= rows - 2 || c < 3 || c >= cols - 3)) {
        // the hedge and trees that fence the town in
        if (noise(c, r, 5) < 0.45) drawSprite(g, 'tree', c, r);
        else { g.fillStyle = '#2e7d32'; g.fillRect(c * tileSize + 2, r * tileSize + 2, tileSize - 4, tileSize - 4); }
      } else if (t === TILE.FLOOR && ground[r][c] === 'grass' && noise(c, r, 9) < 0.08) {
        drawSprite(g, 'flower', c, r);
      }
      if (t === TILE.FOUNTAIN) {
        g.fillStyle = '#9ca3af';
        g.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
        g.fillStyle = '#6b7280';
        g.fillRect(c * tileSize + (c === cx - 1 ? 0 : tileSize - 3), r * tileSize, 3, tileSize);
        g.fillRect(c * tileSize, r * tileSize + (r === cy - 1 ? 0 : tileSize - 3), tileSize, 3);
      }
      if (t === TILE.EXIT) {
        // the dungeon gate: an archway in the hedge with stairs leading down
        g.fillStyle = '#374151'; g.fillRect(c * tileSize - 4, r * tileSize - 4, tileSize + 8, tileSize + 8);
        g.fillStyle = '#9ca3af'; g.fillRect(c * tileSize - 4, r * tileSize - 4, tileSize + 8, 3);
        drawSprite(g, 'stairs', c, r);
      }
    } else {
      if (t === TILE.WALL) drawBrick(g, c, r);
      else drawStone(g, c, r, '#1b4a62', '#153a4d');
      if (t === TILE.EXIT) drawSprite(g, 'stairs', c, r);
      if (!visible[r][c]) { g.fillStyle = 'rgba(4,10,18,0.62)'; g.fillRect(c * tileSize, r * tileSize, tileSize, tileSize); }
    }
  }
  if (inTown()) {
    for (const h of houses) drawHouse(g, h);
    // lamp posts at the plaza corners
    for (const [lc, lr] of [[cx - 11, cy - 6], [cx + 11, cy - 6], [cx - 11, cy + 6], [cx + 11, cy + 6]]) drawSprite(g, 'lamp', lc, lr);
  }
}

function drawBubble(g, b) {
  g.font = '11px sans-serif';
  const pad = 5, w = Math.min(g.measureText(b.text).width + pad * 2, canvas.width - 8), lines = [];
  // wrap to the bubble width
  let line = '';
  for (const word of b.text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width + pad * 2 > Math.min(260, w) && line) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  const bw = Math.min(260, Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2), bh = lines.length * 14 + pad * 2;
  let bx = b.x * tileSize + tileSize / 2 - bw / 2, by = b.y * tileSize - bh - 6;
  bx = Math.max(4, Math.min(canvas.width - bw - 4, bx)); if (by < 4) by = b.y * tileSize + tileSize + 6;
  g.fillStyle = 'rgba(244,244,244,0.95)';
  g.beginPath(); g.roundRect(bx, by, bw, bh, 6); g.fill();
  g.fillStyle = '#1b1b2f'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, bx + pad, by + pad + i * 14));
  g.textBaseline = 'alphabetic';
}

function drawHud(g, now) {
  // Stats strip along the top edge.
  const text = `${interior ? interior.house.name : inTown() ? 'Town' : `Floor ${floor}/${FINAL_FLOOR}`}   HP ${player.hp}/${player.maxHp}   ATK ${player.atk + weaponAtk()}   DEF ${armorDef()}   Lv ${player.level}   Gold ${player.gold}`;
  g.font = 'bold 11px sans-serif';
  const w = g.measureText(text).width + 16;
  g.fillStyle = 'rgba(6,12,20,0.78)';
  g.beginPath(); g.roundRect(6, 6, w, 30, 6); g.fill();
  g.fillStyle = '#e6eef8'; g.textBaseline = 'top'; g.fillText(text, 14, 11);
  const ratio = Math.max(0, player.hp / player.maxHp);
  g.fillStyle = '#06202c'; g.fillRect(14, 26, w - 16, 5);
  g.fillStyle = ratio > 0.5 ? '#5fe17a' : ratio > 0.25 ? '#f5c542' : '#ff6b6b'; g.fillRect(14, 26, (w - 16) * ratio, 5);
  // Recent messages along the bottom edge, newest last, fading with age.
  g.font = '11px sans-serif';
  const recent = messages.filter((m) => now - m.at < 9000);
  if (recent.length) {
    const lh = 15, pad = 6, bw = canvas.width - 12, bh = recent.length * lh + pad * 2;
    g.fillStyle = 'rgba(6,12,20,0.78)';
    g.beginPath(); g.roundRect(6, canvas.height - bh - 6, bw, bh, 6); g.fill();
    recent.forEach((m, i) => {
      const age = now - m.at;
      g.globalAlpha = age > 6000 ? 1 - (age - 6000) / 3000 : 1;
      g.fillStyle = m.cls === 'good' ? '#9ef0b0' : m.cls === 'bad' ? '#ff9b9b' : '#e6eef8';
      g.fillText(m.text, 14, canvas.height - bh - 6 + pad + i * lh);
    });
    g.globalAlpha = 1;
  }
  g.textBaseline = 'alphabetic';
}

function draw() {
  if (!map) return;
  if (bgDirty) renderBackground();
  ctx.drawImage(bg, 0, 0);
  const now = performance.now();
  if (inTown()) {
    // fountain water, rippling
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    const X = (cx - 1) * tileSize + 3, Y = (cy - 1) * tileSize + 3, S = tileSize * 2 - 6;
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(X, Y, S, S);
    ctx.fillStyle = 'rgba(123,223,255,0.7)';
    for (let i = 0; i < 3; i++) {
      const rr = ((now / 900 + i / 3) % 1) * (S / 2);
      ctx.beginPath(); ctx.arc(X + S / 2, Y + S / 2, rr, 0, Math.PI * 2); ctx.strokeStyle = `rgba(244,244,244,${0.7 - rr / (S / 2) * 0.7})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(X + S / 2 - 1, Y + S / 2 - 10 + Math.sin(now / 200) * 2, 2, 10);
  }
  for (const g of golds) if (visible[g.y][g.x]) drawSprite(ctx, 'gold', g.x, g.y);
  for (const p of potions) {
    if (!visible[p.y][p.x]) continue;
    const pulse = 0.35 + 0.25 * Math.sin(now / 300 + p.x + p.y);
    ctx.fillStyle = `rgba(123,223,255,${pulse * 0.5})`;
    ctx.beginPath(); ctx.arc(p.x * tileSize + tileSize / 2, p.y * tileSize + tileSize / 2, tileSize * 0.55, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, 'potion', p.x, p.y);
  }
  for (const sh of shops) {
    ctx.fillStyle = 'rgba(192,132,252,0.25)'; ctx.fillRect(sh.x * tileSize, sh.y * tileSize, tileSize, tileSize);
    drawSprite(ctx, 'merchant', sh.x, sh.y);
  }
  if (interior) {
    const now2 = performance.now();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (decor[r] && decor[r][c] && decor[r][c].sprite === 'fire') {
        ctx.fillStyle = `rgba(255,159,67,${0.15 + 0.1 * Math.sin(now2 / 150)})`;
        ctx.beginPath(); ctx.arc(c * tileSize + tileSize / 2, r * tileSize + tileSize / 2, tileSize, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  if (safeZone()) for (const n of npcs) drawSprite(ctx, n.type.sprite, n.x, n.y);
  for (const m of monsters) {
    if (!visible[m.y][m.x]) continue;
    drawSprite(ctx, m.type.sprite, m.x, m.y);
    if (m.hp < m.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(m.x * tileSize + 2, m.y * tileSize, tileSize - 4, 2);
      ctx.fillStyle = '#f33'; ctx.fillRect(m.x * tileSize + 2, m.y * tileSize, (tileSize - 4) * (m.hp / m.maxHp), 2);
    }
    if (!m.awake) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
      ctx.fillText('z', m.x * tileSize + tileSize - 6, m.y * tileSize + 8);
    }
  }
  // the hero, with a soft glow so they stand out on any ground
  ctx.fillStyle = 'rgba(255,216,107,0.18)';
  ctx.beginPath(); ctx.arc(player.x * tileSize + tileSize / 2, player.y * tileSize + tileSize / 2, tileSize * 0.6, 0, Math.PI * 2); ctx.fill();
  drawSprite(ctx, 'player', player.x, player.y);
  if (bubble) { if (now > bubble.until) bubble = null; else drawBubble(ctx, bubble); }
  drawHud(ctx, now);
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
  const n = safeZone() && getNpcAt(x, y);
  if (n) return `${n.type.name} — walk into them to ${n.type.action === 'shop' || n.type.action === 'potions' ? 'trade' : n.type.action === 'inn' ? 'rest' : 'chat'}`;
  if (map[y][x] === TILE.DOOR) {
    if (interior) return 'Door — back out to the square';
    const h = houses.find((hh) => hh.doorX === x && hh.doorY === y);
    return h ? `${h.name} — step onto the door to go in` : 'Door';
  }
  if (interior && decor[y][x]) return decor[y][x].sprite === 'bed' ? 'Bed — lie down to rest' : `${decor[y][x].name} — walk into it`;
  if (inTown() && map[y][x] === TILE.WALL) { const h = houses.find((hh) => x >= hh.x && x < hh.x + hh.w && y >= hh.y && y < hh.y + hh.h); if (h) return `${h.name} — the door is at the bottom`; }
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
  for (const t of MONSTER_TYPES) {
    const locked = t.minFloor > Math.max(floor, 1);
    add(t.sprite, t.name, locked ? `from floor ${t.minFloor}` : `${t.hp} HP, attack ${t.atk}, ${t.xp} XP`, locked);
  }
  add('potion', 'Potion', '+5 HP');
  add('gold', 'Gold', '');
  add('merchant', 'Merchant', 'buy and sell');
  if (interior) {
    legendEl.innerHTML = '';
    for (const n of npcs) add(n.type.sprite, n.type.name, n.type.action === 'inn' ? 'rest for free' : n.type.action ? 'buy and sell' : 'chat');
    add('bed', 'Bed', 'rest'); add('counter', 'Counter', 'trade or rest');
  } else if (inTown()) {
    add('guard', 'Townsfolk', 'walk into them to chat');
    add('merchant', 'Shop', 'top-left house'); add('innkeeper', 'Inn', 'top-right house');
    add('stairs', 'Gate', 'into the dungeon');
  } else {
    add('stairs', 'Exit', 'stairs down');
  }
}

function updateStats() {
  statsEl.textContent = `${interior ? interior.house.name : inTown() ? 'Town' : `Floor ${floor}/${FINAL_FLOOR}`} | HP ${player.hp}/${player.maxHp} | ATK ${player.atk}${weaponAtk() ? '+' + weaponAtk() : ''} | DEF ${armorDef()} | Lv ${player.level} (${player.xp}/${xpToNext(player.level)} XP) | Gold ${player.gold}`;
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
  if (!inBounds(nx, ny) || map[ny][nx] === TILE.WALL || map[ny][nx] === TILE.FOUNTAIN) return;
  const n = safeZone() && getNpcAt(nx, ny);
  if (n) { talk(n); draw(); return; }
  if (map[ny][nx] === TILE.FURNITURE) { useFurniture(decor[ny][nx], nx, ny); draw(); return; }
  if (map[ny][nx] === TILE.DOOR) {
    if (interior) leaveBuilding();
    else enterBuilding(houses.find((h) => h.doorX === nx && h.doorY === ny));
    return;
  }
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
    if (map[ny][nx] === TILE.SHOP) { openShop('shop'); }
    if (map[ny][nx] === TILE.BED) {
      if (interior && interior.house.id === 'inn') restAtInn();
      else log(player.hp < player.maxHp ? 'Not your bed. You lie down anyway, but it does not help.' : 'A bed. Not yours.');
    }
    if (map[ny][nx] === TILE.EXIT) { nextFloor(); if (gameOver) { updateStats(); return; } updateVisibility(); updateStats(); draw(); return; }
  }
  turn++;
  if (turn % SAVE_EVERY_TURNS === 0) saveProgress('progress');
  if (safeZone()) stepNpcs(); else stepMonsters();
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

// Fullscreen: the stage (canvas plus its overlays) fills the screen and the
// canvas is fitted to it keeping its 4:3 shape. F toggles it too.
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

// Swipe to move, tap to inspect (phones in fullscreen have no D-pad).
let touchStart = null;
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart || shopOpen) return;
  const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // a tap: the click handler inspects
  e.preventDefault();
  if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0); else tryMove(0, Math.sign(dy));
});
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

const SHOPS = {
  shop: { title: 'Merchant', stock: (id, it) => it.floor <= Math.max(floor, 1) + 1, price: (it) => it.price, greet: 'The merchant greets you. Buy and sell with the buttons, Esc to leave.' },
  potions: { title: "Mara's potions", stock: (id) => id === 'potion', price: (it) => it.price - 2, greet: 'Mara sets out her potions. She buys gear too, at half price.' },
};
let shopKind = 'shop';
const buyPrice = (id) => SHOPS[shopKind].price(itemInfo(id));

function openShop(kind = 'shop') {
  if (!shopEl) return;
  shopKind = kind;
  shopOpen = true;
  shopEl.hidden = false;
  document.querySelector('#shop h2').textContent = SHOPS[kind].title;
  log(SHOPS[kind].greet);
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
    .filter(([id, it]) => SHOPS[shopKind].stock(id, it));
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
  const it = itemInfo(id), price = buyPrice(id);
  if (player.gold < price || bagFull()) return;
  player.gold -= price;
  player.bag.push(id);
  log(`You buy a ${it.name} for ${price} gold.`, 'good');
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
  bubble = null;
  closeShop();
  if (safeZone()) {
    if (interior) createInterior(interior.house); else createTown();
  } else {
    interior = null; decor = null;
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
  floor = TOWN; interior = null;
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
