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

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2, SHOP: 3, INN: 4, FOUNTAIN: 5, DOOR: 6, FURNITURE: 7, BED: 8, SITE: 9, CHEST: 10, TRAP: 11 };
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
  { name: 'Bat',      sprite: 'bat',      hp: 2,  atk: 1, xp: 2,  minFloor: 1, erratic: true },
  { name: 'Spider',   sprite: 'spider',   hp: 5,  atk: 2, xp: 5,  minFloor: 2, poison: true },
  { name: 'Archer',   sprite: 'archer',   hp: 4,  atk: 2, xp: 6,  minFloor: 2, ranged: 4 },
];
// Hero classes: base stats, a sprite, and one ability on the 1 key.
const CLASSES = {
  warrior: { name: 'Warrior', hp: 24, atk: 3, sprite: 'player', ability: 'Shield Wall', cooldown: 25, blurb: 'Take 2 less damage from every hit for 6 turns.' },
  ranger:  { name: 'Ranger',  hp: 18, atk: 3, sprite: 'ranger', ability: 'Arrow',       cooldown: 3,  blurb: 'Shoot the nearest monster in a straight line, up to 6 tiles. Rangers also spot traps two tiles away.' },
  mage:    { name: 'Mage',    hp: 16, atk: 2, sprite: 'mage',   ability: 'Fireball',    cooldown: 8,  blurb: 'Burn every monster within 2 tiles of the nearest one in sight (range 5).' },
};
const heroClass = () => CLASSES[player && player.cls] || CLASSES.warrior;

// Perks: one choice of three at every level up. Some stack, most are once.
const PERKS = {
  tough:       { name: 'Tough',       desc: '+6 max HP',                                 max: 99 },
  brawn:       { name: 'Brawn',       desc: '+1 attack',                                 max: 99 },
  thick_skin:  { name: 'Thick skin',  desc: '+1 defence, without armor',                 max: 3 },
  quickened:   { name: 'Quickened',   desc: 'Ability cooldown 20% shorter',              max: 2 },
  packrat:     { name: 'Packrat',     desc: '+4 bag slots',                              max: 1 },
  vampiric:    { name: 'Vampiric',    desc: 'Heal 1 HP on every kill',                   max: 1 },
  hunter:      { name: 'Hunter',      desc: '+50% XP from kills',                        max: 1 },
  lucky:       { name: 'Lucky',       desc: '+25% gold from the floor and chests',       max: 1 },
  second_wind: { name: 'Second wind', desc: 'Survive a killing blow at 1 HP, once per dive', max: 1 },
  nimble:      { name: 'Nimble',      desc: 'Dodge one melee hit in four',               max: 1 },
};
const perkCount = (id) => (player && player.perks ? player.perks.filter((p) => p === id).length : 0);
const bagSize = () => ITEMS.bag_size + 4 * perkCount('packrat');
let perkChoices = null;   // the three on offer while the picker is open

// Achievements award a title the moment they unlock; the newest title shows on the profile.
const ACHIEVEMENTS = {
  first_blood: { label: 'First blood', title: 'the Blooded' },
  slayer_50:   { label: 'Fifty monsters slain', title: 'the Slayer' },
  boss_slayer: { label: 'Slew a boss', title: 'Boss-slayer' },
  delver:      { label: 'Reached floor five', title: 'the Delver' },
  escapist:    { label: 'Escaped a town dungeon', title: 'the Escapee' },
  cave:        { label: 'Cleared a goblin cave', title: 'Cave-crawler' },
  warren:      { label: 'Cleared an orc warren', title: 'Orc-bane' },
  crypt:       { label: 'Cleared a crypt', title: 'Crypt-breaker' },
  tower:       { label: "Cleared a wizard's tower", title: 'Tower-topper' },
  explorer:    { label: 'Visited five settlements', title: 'the Wayfarer' },
  royal:       { label: 'Spoke with the King', title: 'the Courtier' },
  rich:        { label: 'Held a thousand gold', title: 'Moneybags' },
  errands:     { label: 'Completed five quests', title: 'the Errand-runner' },
  survivor:    { label: 'Cheated death', title: 'the Unkillable' },
  night_owl:   { label: 'Killed a beast after dark', title: 'the Night Owl' },
};
function unlock(id) {
  if (!player || !ACHIEVEMENTS[id] || player.achievements.includes(id)) return;
  player.achievements.push(id);
  player.title = ACHIEVEMENTS[id].title;
  log(`Achievement: ${ACHIEVEMENTS[id].label}. You are now ${player.title}.`, 'good');
  floatText(player.x, player.y - 1, '★', '#ffd86b');
  sfx.play('quest');
}

// One-time tips for new players, remembered per browser.
let tipShown = new Set();
try { tipShown = new Set(JSON.parse(localStorage.getItem('dungeon-tips') || '[]')); } catch (e) { /* ignore */ }
let toast = null;
function tip(id, text) {
  if (tipShown.has(id)) return;
  tipShown.add(id);
  try { localStorage.setItem('dungeon-tips', JSON.stringify([...tipShown])); } catch (e) { /* ignore */ }
  toast = { text, until: performance.now() + 7000 };
}
let shake = null;
function shakeScreen(mag, ms = 220) { shake = { mag, until: performance.now() + ms }; }

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
const safeZone = () => scene === 'house' || (scene === 'world' && !!townContaining(player.x, player.y)); // towns and rooms: no monsters
const mName = (m) => m.name || m.type.name;
const inTown = () => scene === 'world';   // outdoors on the overworld
const isVisible = (x, y) => scene !== 'dungeon' || visible.has(key(x, y));
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
function getChunk(cx, cy) {
  const k = key(cx, cy);
  let ch = chunks.get(k);
  if (!ch) { ch = scene === 'world' ? generateWorldChunk(cx, cy) : generateChunk(cx, cy); chunks.set(k, ch); }
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
  getChunk(cx, cy).seen[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] = 1;
}
const walkable = (t) => t !== TILE.WALL && t !== TILE.FOUNTAIN && t !== TILE.FURNITURE && t !== TILE.CHEST;

// ---------- account save/load ----------
const ACCOUNT = window.DUNGEON || { user: false };
const ITEMS = ACCOUNT.items || { weapons: {}, armor: {}, consumables: {}, bag_size: 12 };
const itemInfo = (id) => ITEMS.weapons[id] || ITEMS.armor[id] || ITEMS.consumables[id] || null;
const itemKind = (id) => ITEMS.weapons[id] ? 'weapon' : ITEMS.armor[id] ? 'armor' : 'consumable';
const weaponAtk = () => ((player.weapon && ITEMS.weapons[player.weapon]) ? ITEMS.weapons[player.weapon].atk + (player.weaponPlus || 0) : 0);
const armorDef = () => ((player.armor && ITEMS.armor[player.armor]) ? ITEMS.armor[player.armor].def + (player.armorPlus || 0) : 0) + perkCount('thick_skin');
const SAVE_EVERY_TURNS = 20;

async function saveProgress(event, keepalive = false) {
  if (!ACCOUNT.user || !player) return;
  try {
    const res = await fetch(ACCOUNT.saveUrl, {
      method: 'POST', keepalive, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf },
      body: JSON.stringify({ event, floor, level: player.level, xp: player.xp, gold: player.gold,
        hp: player.hp, max_hp: player.maxHp, atk: player.atk, kills, weapon: player.weapon, armor: player.armor, bag: player.bag,
        wx: player.wx ?? 20, wy: player.wy ?? 21, home: homeTown,
        quests: (player.quests || []).slice(-12).map((q) => ({ id: q.id, kind: q.kind, label: q.label, need: q.need, have: q.have, done: !!q.done, target: q.target, giver: q.giver, reward: q.reward })),
        quests_done: player.questsDone || 0, class: player.cls,
        perks: player.perks, achievements: player.achievements, title: player.title || null,
        meta: { visited: player.meta.visited.slice(-80), second_wind: !!player.meta.second_wind },
        weapon_plus: player.weaponPlus || 0, armor_plus: player.armorPlus || 0 }),
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

// ---------- sound (synthesised, no files) ----------
const sfx = (() => {
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('dungeon-muted') === '1'; } catch (e) { /* storage may be blocked */ }
  const ensure = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) => {
    const c = ensure(); if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur);
  };
  const sounds = {
    step: () => tone(150, 0.04, 'triangle', 0.025),
    hit: () => tone(240, 0.09, 'square', 0.07, -140),
    hurt: () => tone(120, 0.2, 'sawtooth', 0.07, -70),
    gold: () => { tone(880, 0.06, 'square', 0.045); tone(1320, 0.09, 'square', 0.045, 0, 0.06); },
    potion: () => tone(500, 0.14, 'sine', 0.06, 320),
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, 'square', 0.055, 0, i * 0.09)),
    stairs: () => tone(320, 0.35, 'triangle', 0.06, -220),
    door: () => tone(180, 0.1, 'triangle', 0.05, 90),
    quest: () => [659, 880, 1109].forEach((f, i) => tone(f, 0.16, 'triangle', 0.06, 0, i * 0.11)),
    boss: () => { tone(70, 0.7, 'sawtooth', 0.09, -25); tone(105, 0.7, 'sawtooth', 0.05, -35, 0.05); },
    die: () => [330, 262, 196, 131].forEach((f, i) => tone(f, 0.26, 'sawtooth', 0.06, 0, i * 0.18)),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.065, 0, i * 0.11)),
    arrow: () => tone(900, 0.12, 'sawtooth', 0.04, -600),
    fire: () => { tone(90, 0.4, 'sawtooth', 0.08, 120); tone(400, 0.25, 'square', 0.04, -300, 0.05); },
    shield: () => tone(260, 0.25, 'triangle', 0.07, 140),
    trap: () => { tone(700, 0.08, 'square', 0.07, -500); tone(140, 0.2, 'sawtooth', 0.07, -60, 0.06); },
    chest: () => [392, 523, 659].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.08)),
    poison: () => tone(200, 0.3, 'sine', 0.05, -120),
  };
  return {
    play: (n) => { try { sounds[n] && sounds[n](); } catch (e) { /* audio is best-effort */ } },
    unlock: ensure,
    toggle: () => { muted = !muted; try { localStorage.setItem('dungeon-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ } return muted; },
    get muted() { return muted; },
  };
})();

// ---------- day and night ----------
// A day is 480 turns. Night darkens the surface, lamps glow, and beasts in
// the wilds notice you from further away.
const DAY_LENGTH = 480;
const dayClock = () => ((turn + 150) % DAY_LENGTH) / DAY_LENGTH;
const dayNumber = () => Math.floor((turn + 150) / DAY_LENGTH) + 1;
function dayPhase() { const t = dayClock(); return t < 0.08 ? 'dawn' : t < 0.55 ? 'day' : t < 0.66 ? 'dusk' : 'night'; }
function nightTint() {
  const t = dayClock();
  if (t < 0.08) return `rgba(255,180,120,${0.18 * (1 - t / 0.08)})`;
  if (t < 0.55) return null;
  if (t < 0.66) return `rgba(255,140,60,${0.25 * ((t - 0.55) / 0.11)})`;
  const k = t < 0.72 ? (t - 0.66) / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1;
  return `rgba(8,16,60,${0.5 * Math.min(1, k)})`;
}

// ---------- bosses ----------
const BOSS_NAMES = { Rat: 'the Rat King', Goblin: 'the Goblin Chieftain', Skeleton: 'the Bone Lord', Orc: 'the Orc Warchief', Wraith: 'the Lich', Bat: 'the Bat Matriarch', Spider: 'the Brood Mother', Archer: 'the Goblin Marksman' };
function placeBoss(room, ox, oy) {
  const def = dungeonDef || { pool: null, danger: 0 };
  const pool = def.pool || MONSTER_TYPES.filter((t) => t.minFloor <= floor);
  const type = pool.reduce((a, b) => (b.xp > a.xp ? b : a));
  const danger = def.danger || 0;
  const cells = [];
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
    const wx = ox + x, wy = oy + y;
    if (getTile(wx, wy) === TILE.FLOOR && !getMonsterAt(wx, wy) && dist({ x: wx, y: wy }, exit) <= 2) cells.push({ x: wx, y: wy });
  }
  const cell = cells[rnd(cells.length)] || { x: exit.x + 1, y: exit.y };
  if (getTile(cell.x, cell.y) === TILE.WALL) setTile(cell.x, cell.y, TILE.FLOOR);
  const hp = type.hp * 4 + danger * 4 + floor * 2;
  monsters.push({ ...cell, type, name: BOSS_NAMES[type.name], hp, maxHp: hp, atk: type.atk + 1 + Math.ceil(danger / 2), awake: false, boss: true });
  monstersDirty = true;
}
const bossAlive = () => scene === 'dungeon' && monsters.some((m) => m.boss);

// ---------- quests ----------
// Captains, castellans and the King ask for sites to be cleared; townsfolk
// ask for a tally of a monster. Rewards pay out the moment a quest completes.
const QUEST_MAX = 3;
const QUEST_GIVERS_CLEAR = ['Captain Orla', 'Bren the guard', 'The Castellan', 'King Aldric'];
function questsActive() { return player.quests.filter((q) => !q.done); }
function questDoneIds() { return new Set(player.quests.filter((q) => q.done).map((q) => q.id)); }
function offerQuest(n) {
  if (!player.quests) player.quests = [];
  if (questsActive().length >= QUEST_MAX) return false;
  const here = townContaining(player.x, player.y) || nearestTownTo(player.x, player.y);
  const danger = Math.max(Math.abs(here.i), Math.abs(here.j));
  const have = new Set(player.quests.map((q) => q.id));
  let q = null;
  if (QUEST_GIVERS_CLEAR.includes(n.type.name)) {
    const done = questDoneIds();
    const cands = nearbySites(here.cx, here.cy, 2)
      .filter((st) => !have.has('clear:' + st.key) && !done.has('clear:' + st.key))
      .sort((a, b) => (Math.abs(a.x - here.cx) + Math.abs(a.y - here.cy)) - (Math.abs(b.x - here.cx) + Math.abs(b.y - here.cy)));
    const st = cands[0];
    if (st) q = { id: 'clear:' + st.key, kind: 'clear', label: `Clear ${st.name.startsWith('The ') ? st.name : 'the ' + st.name} (${st.floors} floors, danger ${stars(st.danger).replace(/☆/g, '')})`, target: st.key, need: 1, have: 0, done: false, giver: n.type.name, reward: 80 + 70 * st.danger };
  } else {
    const types = danger < 2 ? ['Rat', 'Goblin'] : danger < 4 ? ['Goblin', 'Orc', 'Skeleton'] : ['Orc', 'Skeleton', 'Wraith'];
    const type = types[rnd(types.length)];
    const need = 5 + 3 * danger + rnd(4);
    const id = `slay:${type}:${here.key}:${player.quests.length}`;
    if (!player.quests.some((x) => !x.done && x.kind === 'slay' && x.target === type)) q = { id, kind: 'slay', label: `Slay ${need} ${type.toLowerCase()}s for ${n.type.name} of ${here.name}`, target: type, need, have: 0, done: false, giver: n.type.name, reward: 30 + 20 * danger + need * 4 };
  }
  if (!q) return false;
  player.quests.push(q);
  log(`Quest accepted: ${q.label}. Reward ${q.reward} gold.`, 'good');
  sfx.play('quest');
  bubble = { x: n.x, y: n.y, text: q.kind === 'clear' ? 'See it done and the gold is yours.' : 'Bring me word when it is done.', until: performance.now() + 4000 };
  return true;
}
function questProgress(kind, target, amount = 1) {
  if (!player || !player.quests) return;
  for (const q of player.quests) {
    if (q.done || q.kind !== kind || q.target !== target) continue;
    q.have = Math.min(q.need, q.have + amount);
    if (q.have >= q.need) {
      q.done = true;
      player.gold += q.reward;
      player.questsDone = (player.questsDone || 0) + 1;
      if (player.questsDone >= 5) unlock('errands');
      log(`Quest complete: ${q.label}. +${q.reward} gold.`, 'good');
      floatText(player.x, player.y, `+${q.reward}g`, '#f5c542');
      sfx.play('quest');
    } else if (kind === 'slay') log(`${q.have}/${q.need} ${target.toLowerCase()}s slain for ${q.giver}.`);
  }
  // keep the list short: finished quests fall off after a while
  const done = player.quests.filter((q) => q.done);
  if (done.length > 6) player.quests.splice(player.quests.indexOf(done[0]), 1);
}
let questsOpen = false;
function drawQuests(g) {
  g.fillStyle = 'rgba(6,12,20,0.9)'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#e6eef8'; g.font = 'bold 18px sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillText('Quests', 24, 18);
  g.font = '13px sans-serif'; g.fillStyle = '#a8c0d8';
  g.fillText(`${player.questsDone || 0} completed in total  ·  Q or Esc closes  ·  ask captains, the King or townsfolk for more`, 110, 23);
  let y = 60;
  const active = questsActive(), done = player.quests.filter((q) => q.done).slice(-5).reverse();
  g.font = 'bold 14px sans-serif'; g.fillStyle = '#ffd86b'; g.fillText(active.length ? 'Active' : 'No active quests. Walk into a guard captain, the King, or any townsperson.', 24, y); y += 26;
  for (const q of active) {
    g.fillStyle = '#e6eef8'; g.font = '14px sans-serif'; g.fillText(`• ${q.label}`, 32, y);
    g.fillStyle = '#9fd4ff'; g.font = '12px sans-serif'; g.fillText(`${q.have}/${q.need}  ·  reward ${q.reward} gold  ·  from ${q.giver}`, 48, y + 18);
    g.fillStyle = '#06202c'; g.fillRect(48, y + 36, 240, 5); g.fillStyle = '#5fe17a'; g.fillRect(48, y + 36, 240 * (q.have / q.need), 5);
    y += 52;
  }
  if (done.length) { y += 8; g.font = 'bold 14px sans-serif'; g.fillStyle = '#a8c0d8'; g.fillText('Completed', 24, y); y += 24; }
  for (const q of done) { g.fillStyle = '#9ef0b0'; g.font = '13px sans-serif'; g.fillText(`✓ ${q.label}`, 32, y); y += 20; }
  // achievements and perks down the right
  let ay = 60; const ax = canvas.width - 360;
  g.font = 'bold 14px sans-serif'; g.fillStyle = '#ffd86b'; g.fillText(`Achievements ${player.achievements.length}/${Object.keys(ACHIEVEMENTS).length}${player.title ? '  ·  ' + player.title : ''}`, ax, ay); ay += 24;
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) { const got = player.achievements.includes(id); g.fillStyle = got ? '#9ef0b0' : '#4b5563'; g.font = '12px sans-serif'; g.fillText(`${got ? '★' : '☆'} ${a.label}`, ax, ay); ay += 17; }
  ay += 10; g.font = 'bold 14px sans-serif'; g.fillStyle = '#ffd86b'; g.fillText('Perks', ax, ay); ay += 22;
  const counts = {}; for (const pid of player.perks) counts[pid] = (counts[pid] || 0) + 1;
  if (!player.perks.length) { g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText('None yet. Level up to choose one.', ax, ay); }
  for (const [pid, n] of Object.entries(counts)) { g.fillStyle = '#cfe9ff'; g.font = '12px sans-serif'; let t = `${PERKS[pid].name}${n > 1 ? ' ×' + n : ''}: ${PERKS[pid].desc}`; while (g.measureText(t).width > 340 && t.length > 8) t = t.slice(0, -4) + '…'; g.fillText(t, ax, ay); ay += 17; }
  g.textBaseline = 'alphabetic';
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
BIG_SPRITES.cave = ['................','......EEEE......','....EEEEEEEE....','...EEEkkkkEEE...','..EEkkkkkkkkEE..','..EkkkkkkkkkkE..','.EEkkkkkkkkkkEE.','.EkkkkkkkkkkkkE.','.EkkkkkkkkkkkkE.','EEkkkkkkkkkkkkEE','EkkkkkkkkkkkkkkE','EkkkkkkkkkkkkkkE','EEkkkkkkkkkkkkEE','GGEEkkkkkkkkEEGG','GGGGGGGGGGGGGGGG','................'];
BIG_SPRITES.warren = ['................','................','.....hhhhhh.....','...hhhkkkkhhh...','..hhkkkkkkkkhh..','.hhkkkkkkkkkkhh.','.hkkkkkkkkkkkkh.','hhkkkkkkkkkkkkhh','hkkkkkkkkkkkkkkh','hkkkkeekkkkeekkh','hhkkkkkkkkkkkkhh','.hkkkkkkkkkkkkh.','.hhhkkkkkkkkhhh.','GGGhhhhhhhhhhGGG','GGGGGGGGGGGGGGGG','................'];
BIG_SPRITES.crypt = ['....EEEEEEEE....','...EEEEEEEEEE...','..EEEEEwwEEEEE..','..EEEEwwwwEEEE..','..EEEEEwwEEEEE..','..EEEEEwwEEEEE..','..EEEkkkkkkEEE..','..EEkkkkkkkkEE..','..EEkkkkkkkkEE..','..EEkkkkkkkkEE..','..EEkkkkkkkkEE..','..EEkkkkkkkkEE..','..EEkkkkkkkkEE..','.EEEEEEEEEEEEEE.','EEEEEEEEEEEEEEEE','................'];
BIG_SPRITES.tower = ['......pppp......','.....pppppp.....','....pppppppp....','.....eeeeee.....','.....eEeeEe.....','.....eeeeee.....','.....eeyyee.....','.....eeeeee.....','.....eEeeEe.....','.....eeeeee.....','.....eeeeee.....','....eeeeeeee....','....eeekkeee....','....eeekkeee....','GGGGeeekkeeeGGGG','................'];
BIG_SPRITES.ranger = ['.....GGGGGG.....', '....GGGGGGGG....', '....GGssssGG....', '....Gsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....GGGGGGGG....', '...GGGGGGGGGG...', '..sGGGGyyGGGGs..', '..s.GGGGGGGG.s..', '....GGGGGGGG....', '....hhh..hhh....', '....hhh..hhh....', '...HHH....HHH...', '................'];
BIG_SPRITES.mage = ['.....pppppp.....', '....pppppppp....', '....ppsssspp....', '....psssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....pppppppp....', '...pppppppppp...', '..sppppyypppps..', '..s.pppppppp.s..', '....pppppppp....', '....BBB..BBB....', '....BBB..BBB....', '...HHH....HHH...', '................'];
BIG_SPRITES.bat = ['................', '................', '................', '..k..........k..', '.kkk........kkk.', '.kkkk..kk..kkkk.', '..kkkkkkkkkkkk..', '...kkkkkkkkkk...', '....kkrkkrkk....', '.....kkkkkk.....', '......kkkk......', '.......kk.......', '................', '................', '................', '................'];
BIG_SPRITES.spider = ['................', '................', '...k........k...', '..k.k......k.k..', '..k..kkkkkk..k..', '.k..kkkkkkkk..k.', '.k.kkrkkkkrkk.k.', '..kkkkkkkkkkkk..', '.k..kkkkkkkk..k.', '.k...kkkkkk...k.', '..k..k....k..k..', '..k.k......k.k..', '...k........k...', '................', '................', '................'];
BIG_SPRITES.archer = ['....g......g....', '...gg......gg...', '...gggggggggg...', '..gggggggggggg..', '..ggkgggggkggg..', '..gggggggggggg..', '...ggggwwgggg...', '....gggggggg....', '...hHHHHHHHHh...', '..hhHHHHHHHHhh..', '..h.HHHHHHHH.h..', '.h..HHHHHHHH..h.', '.h..HHH..HHH..h.', '.h..HHH..HHH..h.', '....hhh..hhh....', '................'];
BIG_SPRITES.trap = ['................', '................', '................', '................', '..e.....e.....e.', '.eee...eee...eee', '.eee...eee...eee', '.EEE...EEE...EEE', '.EEE...EEE...EEE', 'EEEEEEEEEEEEEEEE', 'EEEEEEEEEEEEEEEE', '................', '................', '................', '................', '................'];
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
  smith: { sprite: 'guard', name: 'Durn the smith', action: 'smithy', lines: ['Blades and hammers, a tenth off the usual. Come to the counter.'] },
  armourer: { sprite: 'guard', name: 'Ysolde the armourer', action: 'armoury', lines: ['Armor only, and cheaper than any merchant. Try the counter.'] },
  apothecary: { sprite: 'elder', name: 'Brother Cael', action: 'apothecary', lines: ['Potions and elixirs. An elixir will bring you back from the brink.'] },
  quartermaster: { sprite: 'guard', name: 'The Royal Quartermaster', action: 'royal', lines: ['By the King\'s leave: the finest steel in the realm, if your purse can bear it.'] },
  lord: { sprite: 'guard', name: 'The Castellan', lines: [
    'This castle guards the road. Bandits in the hills, worse things below.',
    'The King holds court at the grand castle. Bring him a tale worth hearing.',
    'Our smithy and armoury serve any hero who serves the realm.'] },
  king: { sprite: 'merchant', name: 'King Aldric', lines: [
    'Welcome, hero. The realm has need of those who go below and come back up.',
    'My quartermaster keeps the royal armoury. Dragonscale, if you have the gold.',
    'The crypts and towers in the wilds are older than my crown. Clear them and the realm sleeps easier.',
    'Every town\'s gate leads to the same dark. The further from Hearth, the deeper the dark.'] },
  bram: { sprite: 'farmer', name: 'Bram the mason', lines: [
    'I laid every stone of this plaza. Mind your boots.',
    'The caves out in the country are older than any town. Older than the dungeon, some say.',
    'Towers in the wilds? Wizards. Never trust a man who lives above the ground floor.'] },
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
BUILDINGS.market = { ...BUILDINGS.shop, name: 'Market Hall', sign: 'MARKET', roof: '#b45309' };
BUILDINGS.smithy = { name: 'The Smithy', sign: 'SMITH', roof: '#374151', npcs: { M: 'smith' }, layout: [
  '################', '#RRRR.f.....SSS#', '#..............#', '#..M...........#', '#..CCCCC.......#',
  '#..............#', '#.b.......T....#', '#..............#', '#..............#', '#######D########'] };
BUILDINGS.armoury = { name: 'The Armoury', sign: 'ARMOUR', roof: '#1f2937', npcs: { M: 'armourer' }, layout: [
  '################', '#SSSSS....RRRRR#', '#..............#', '#......M.......#', '#....CCCCC.....#',
  '#..............#', '#..c.......c...#', '#..............#', '#..............#', '#######D########'] };
BUILDINGS.apothecary = { name: 'The Apothecary', sign: 'POTIONS', roof: '#065f46', npcs: { E: 'apothecary' }, layout: [
  '################', '#SSSSSSSS..f...#', '#..............#', '#....E.........#', '#..CCCCCC......#',
  '#..............#', '#..p.......T...#', '#..............#', '#..............#', '#######D########'] };
BUILDINGS.keep = { name: 'The Keep', sign: 'KEEP', roof: '#4b5563', npcs: { G: 'lord' }, layout: [
  '################', '#RR..........RR#', '#......rr......#', '#......Gr......#', '#......rr......#',
  '#..T........T..#', '#......rr......#', '#..c...rr...c..#', '#......rr......#', '#######D########'] };
BUILDINGS.throne = { name: 'The Royal Hall', sign: 'HALL', roof: '#7c2d12', npcs: { G: 'king' }, layout: [
  '################', '#f....rrrr....f#', '#.....rGrr.....#', '#.....rrrr.....#', '#......rr......#',
  '#..T...rr...T..#', '#......rr......#', '#..T...rr...T..#', '#......rr......#', '#######D########'] };
BUILDINGS.royal = { name: 'The Royal Armoury', sign: 'ROYAL', roof: '#7c2d12', npcs: { M: 'quartermaster' }, layout: [
  '################', '#SSSSSSSSSSSSSS#', '#..............#', '#......M.......#', '#...CCCCCCCC...#',
  '#..............#', '#.RR........RR.#', '#..............#', '#..c........c..#', '#######D########'] };
BUILDINGS.throne.npcs = { G: 'king' };
BUILDINGS.cottage = { ...BUILDINGS.home, name: "Bram's Cottage", npcs: { H: 'bram' }, roof: '#9a3412' };
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

// ---------- dungeons: the town gate and the special sites ----------
// A dungeon definition says how many floors there are, who lives there, how
// well it pays, how far you can see, and how dangerous it is. Danger grows
// with distance from Hearth and adds to every monster's health and attack.
const byName = (...names) => MONSTER_TYPES.filter((t) => names.includes(t.name));
const SITE_TYPES = {
  cave:   { label: 'Goblin Cave', sprite: 'cave',   floors: [2, 3], pool: byName('Rat', 'Goblin', 'Bat', 'Spider', 'Orc'), gold: 1.6, potions: 1, view: 7, loot: 0.12, treasure: 60, prefixes: ['Mossy', 'Dripping', 'Echoing', 'Low', 'Black'] },
  warren: { label: 'Orc Warren',  sprite: 'warren', floors: [2, 2], pool: byName('Goblin', 'Archer', 'Orc'),         gold: 1.2, potions: 1, view: 8, loot: 0.3,  treasure: 80, prefixes: ['Bloody', 'Broken-Tusk', 'Red', 'Grim', 'Ironhide'] },
  crypt:  { label: 'Crypt',       sprite: 'crypt',  floors: [3, 3], pool: byName('Skeleton', 'Spider', 'Wraith'),    gold: 1,   potions: 1, view: 6, loot: 0.15, treasure: 120, prefixes: ['Forgotten', 'Silent', 'Weeping', 'Sunken', 'Nameless'], xp: 1.5 },
  tower:  { label: "Wizard's Tower", sprite: 'tower', floors: [3, 4], pool: byName('Wraith', 'Skeleton', 'Bat', 'Archer'), gold: 1.3, potions: 2, view: 9, loot: 0.18, treasure: 200, prefixes: ['Leaning', 'Glass', 'Moonlit', 'Shattered', 'Violet'] },
};
let dungeonDef = null;   // set when a gate or a site is entered
let revealedTraps = new Set();   // traps the hero has found, by "x,y"
let guestRespawn = null;         // a guest's hero after a death, so R does not start from scratch
function townDungeon(town) {
  const danger = Math.max(Math.abs(town.i), Math.abs(town.j));
  return { kind: 'town', name: `${town.name} dungeon`, floors: 5, pool: null, gold: 1 + danger * 0.15, potions: 1, view: 8, loot: 0.12, treasure: 0, danger, xp: 1, home: town.key };
}
function siteDungeon(site) {
  const st = SITE_TYPES[site.type];
  return { kind: 'site', name: site.name, floors: site.floors, pool: st.pool, gold: st.gold, potions: st.potions, view: st.view, loot: st.loot, treasure: st.treasure, danger: site.danger, xp: st.xp || 1, site };
}
const stars = (danger) => '★'.repeat(Math.min(5, 1 + danger)) + '☆'.repeat(Math.max(0, 4 - danger));

// ---------- the overworld ----------
// One seeded world for everyone. Terrain comes from value noise; towns sit on
// a lattice with a little jitter and are joined by roads, so you can always
// walk from one to the next. Each town has a name, its own set of buildings,
// a fountain, townsfolk and a gate down into the dungeon.
const WORLD_SEED = 7331, TOWN_SPACING = 96, TW = 40, TH = 30;
const GROUND = { GRASS: 0, FOREST: 1, SAND: 2, WATER: 3, MOUNTAIN: 4, ROAD: 5, COBBLE: 6, TREE: 7, RAMPART: 8 };
const worldChunks = new Map();   // kept across scene changes
const towns = new Map();         // lattice key -> town
let homeTown = '0,0';            // the town whose gate you last took
let worldMonsters = [];          // beasts roaming the wilds, kept with the world chunks
const SYL_A = ['Ash', 'Bar', 'Cal', 'Dun', 'El', 'Fen', 'Gar', 'Hol', 'Ist', 'Kel', 'Lor', 'Mor', 'Nor', 'Ost', 'Pem', 'Quil', 'Rav', 'Sil', 'Tor', 'Ul', 'Vel', 'Wyn', 'Bre', 'Cor', 'Dra', 'Ever', 'Glen', 'Har', 'Lin', 'Thorn'];
const SYL_M = ['', '', '', 'en', 'er', 'wood', 'stone', 'water', 'ling', 'ash', 'oak'];
const SYL_B = ['bury', 'ford', 'gate', 'haven', 'holm', 'mere', 'moor', 'ton', 'vale', 'wick', 'worth', 'by', 'stead', 'bridge', 'march', 'field', 'cross', 'fall', 'hollow', 'rest'];
// Well-mixed per-cell randomness; plain noise() clumps badly for small lattice indices.
const cellRand = (i, j, salt) => hash32(i * 7919 + 13, j * 104729 + 29, salt * 2654435761) / 4294967295;
function townName(i, j) {
  const h = hash32(i * 7919, j * 104729, 4242);
  return SYL_A[h % SYL_A.length] + SYL_M[Math.floor(h / 64) % SYL_M.length] + SYL_B[Math.floor(h / 4096) % SYL_B.length];
}

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

const TOWN_SIZES = {
  village: { plaza: [7, 4], houses: [[12, 6, 6, 4, 'shop'], [22, 6, 6, 4, 'inn']], folk: [1, 2], walled: false },
  town:    { plaza: [11, 6], houses: [[6, 4, 6, 4, 'shop'], [28, 4, 6, 4, 'inn'], [16, 3, 8, 3, 'watch'], [6, 22, 6, 4, 'herbs'], [28, 22, 6, 4, 'home']], folk: [2, 4], walled: false },
  city:    { plaza: [15, 8], houses: [[3, 3, 6, 4, 'shop'], [31, 3, 6, 4, 'inn'], [14, 2, 12, 3, 'market'], [3, 23, 6, 4, 'herbs'], [31, 23, 6, 4, 'home'], [12, 24, 6, 4, 'cottage'], [22, 24, 8, 3, 'watch']], folk: [4, 6], walled: false },
  castle:  { plaza: [16, 10], houses: [[14, 3, 12, 4, 'keep'], [4, 4, 6, 4, 'smithy'], [30, 4, 6, 4, 'armoury'], [4, 22, 6, 4, 'watch'], [30, 22, 6, 4, 'inn']], folk: [2, 4], walled: true },
  grand:   { plaza: [16, 10], houses: [[12, 3, 16, 5, 'throne'], [3, 4, 7, 4, 'royal'], [31, 4, 6, 4, 'smithy'], [3, 22, 6, 4, 'armoury'], [31, 22, 6, 4, 'watch'], [14, 23, 6, 4, 'apothecary'], [22, 23, 6, 4, 'inn']], folk: [4, 6], walled: true },
};
const GRAND_CASTLE = { i: 2, j: -1 };   // the King's seat, the only one of its kind
const SPECIAL_SHOPS = ['smithy', 'armoury', 'apothecary'];
// Score a candidate centre by how much solid, open ground surrounds it.
function landScore(cx, cy) {
  let score = 0;
  for (let dy = -12; dy <= 12; dy += 6) for (let dx = -18; dx <= 18; dx += 6) {
    const g = terrainAt(cx + dx, cy + dy);
    score += g === GROUND.GRASS ? 2 : (g === GROUND.FOREST || g === GROUND.SAND) ? 1 : g === GROUND.WATER ? -2 : g === GROUND.MOUNTAIN ? -3 : 0;
  }
  return score;
}
function townAt(i, j) {
  const k = key(i, j);
  if (towns.has(k)) return towns.get(k);
  const origin = i === 0 && j === 0;
  if (!origin && !(i === GRAND_CASTLE.i && j === GRAND_CASTLE.j) && cellRand(i, j, 90) < 0.28) { towns.set(k, null); return null; }   // some cells are just wilderness
  // try a few spots in the cell and keep the one on the best land
  let cx = i * TOWN_SPACING + 20, cy = j * TOWN_SPACING + 15, best = -Infinity;
  if (!origin) {
    for (let n = 0; n < 5; n++) {
      const tx = i * TOWN_SPACING + 20 + Math.floor((cellRand(i, j, 91 + n) - 0.5) * 56), ty = j * TOWN_SPACING + 15 + Math.floor((cellRand(i, j, 191 + n) - 0.5) * 56);
      const sc = landScore(tx, ty);
      if (sc > best) { best = sc; cx = tx; cy = ty; }
    }
  }
  const x0 = cx - 20, y0 = cy - 15;
  const grand = i === GRAND_CASTLE.i && j === GRAND_CASTLE.j;
  const sizeRoll = cellRand(i, j, 89);
  const size = origin ? 'town' : grand ? 'grand' : sizeRoll < 0.3 ? 'village' : sizeRoll < 0.72 ? 'town' : sizeRoll < 0.88 ? 'city' : 'castle';
  const def = TOWN_SIZES[size];
  const base = origin ? 'Hearth' : townName(i, j);
  const name = grand ? 'Castle Aurum' : size === 'castle' ? `Castle ${base}` : base;
  const town = { key: k, i, j, name, size, plaza: def.plaza, walled: def.walled, cx, cy, x0, y0, houses: [], npcs: null, spawn: { x: cx, y: cy + 3 }, gate: { x: cx, y: y0 + (def.walled ? 26 : 28) }, folk: def.folk };
  // a specialist shop in every city, and in some towns in place of the home
  let plan = def.houses.map((h) => h.slice());
  if (!origin && !def.walled) {
    const special = SPECIAL_SHOPS[Math.floor(cellRand(i, j, 88) * SPECIAL_SHOPS.length)];
    if (size === 'city') plan = plan.map((h) => h[4] === 'market' ? [h[0], h[1], h[2], h[3], special] : h);
    else if (size === 'town' && cellRand(i, j, 87) < 0.4) plan = plan.map((h) => h[4] === 'home' ? [h[0], h[1], h[2], h[3], special] : h);
  }
  for (const [lx, ly, w, h, id] of plan) {
    town.houses.push({ x: x0 + lx, y: y0 + ly, w, h, id, doorX: x0 + lx + Math.floor(w / 2), doorY: y0 + ly + h - 1, town: k, ...BUILDINGS[id] });
  }
  towns.set(k, town);
  return town;
}
// The nearest town along one axis, skipping empty cells (up to three away).
function neighbourTown(i, j, di, dj) {
  for (let n = 1; n <= 3; n++) { const t = townAt(i + di * n, j + dj * n); if (t) return t; }
  return null;
}
function townContaining(x, y) {
  const i0 = Math.round((x - 20) / TOWN_SPACING), j0 = Math.round((y - 15) / TOWN_SPACING);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const t = townAt(i, j);
    if (t && x >= t.x0 && x < t.x0 + TW && y >= t.y0 && y < t.y0 + TH) return t;
  }
  return null;
}
function nearbyTowns(x, y, reach = 1) {
  const i0 = Math.round((x - 20) / TOWN_SPACING), j0 = Math.round((y - 15) / TOWN_SPACING), out = [];
  for (let i = i0 - reach; i <= i0 + reach; i++) for (let j = j0 - reach; j <= j0 + reach; j++) { const t = townAt(i, j); if (t) out.push(t); }
  return out;
}
function nearestOtherTown(x, y) {
  const here = townContaining(x, y);
  let best = null, bd = Infinity;
  for (const t of nearbyTowns(x, y, 2)) {
    if (here && t.key === here.key) continue;
    const d = Math.abs(t.cx - x) + Math.abs(t.cy - y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
// Town layout in local coordinates, shared by the stamp and the renderer.
function townTile(town, wx, wy) {
  const lx = wx - town.x0, ly = wy - town.y0;
  const cx = 20, cy = 15, [pw, ph] = town.plaza;
  let g = GROUND.GRASS, t = TILE.FLOOR;
  if (ly >= cy - ph && ly <= cy + ph && lx >= cx - pw && lx <= cx + pw) g = GROUND.COBBLE;
  if (town.walled) {
    if (lx >= 1 && lx <= 38 && ly >= 1 && ly <= 28) g = GROUND.COBBLE;   // paved bailey
    const onRing = (lx === 1 || lx === 38 || ly === 1 || ly === 28) && lx >= 1 && lx <= 38 && ly >= 1 && ly <= 28;
    const gap = ((ly === 1 || ly === 28) && lx >= 19 && lx <= 21) || ((lx === 1 || lx === 38) && ly >= 14 && ly <= 16);
    const tower = (lx <= 2 || lx >= 37) && (ly <= 2 || ly >= 27);
    if ((onRing && !gap) || tower) { t = TILE.WALL; g = GROUND.RAMPART; }
  }
  if (lx >= cx - 1 && lx <= cx + 1) g = GROUND.COBBLE;            // the path through the square to the roads
  if (ly >= cy - 1 && ly <= cy && lx >= cx - 1 && lx <= cx) { t = TILE.FOUNTAIN; g = GROUND.COBBLE; }
  for (const h of town.houses) {
    if (wx >= h.x && wx < h.x + h.w && wy >= h.y && wy < h.y + h.h) t = (wx === h.doorX && wy === h.doorY) ? TILE.DOOR : TILE.WALL;
  }
  if (wx === town.gate.x && wy === town.gate.y) t = TILE.EXIT;
  return [t, g];
}
// Special dungeons out in the country: one in roughly half the lattice cells,
// kept clear of the cell's town and joined to the nearest town by a trail.
const sites = new Map();
function siteAt(i, j) {
  const k = key(i, j);
  if (sites.has(k)) return sites.get(k);
  if (cellRand(i, j, 300) > 0.55) { sites.set(k, null); return null; }
  const types = Object.keys(SITE_TYPES);
  const type = types[Math.floor(cellRand(i, j, 301) * types.length)], st = SITE_TYPES[type];
  let x = i * TOWN_SPACING + 8 + Math.floor(cellRand(i, j, 302) * 80), y = j * TOWN_SPACING + 6 + Math.floor(cellRand(i, j, 303) * 80);
  const town = townAt(i, j);
  if (town && x >= town.x0 - 3 && x < town.x0 + TW + 3 && y >= town.y0 - 3 && y < town.y0 + TH + 3) { x = town.x0 + TW + 12 + Math.floor(noise(i, j, 304) * 20); }
  const danger = Math.max(Math.abs(i), Math.abs(j)) + (type === 'tower' || type === 'crypt' ? 1 : 0);
  const floors = st.floors[0] + Math.floor(cellRand(i, j, 305) * (st.floors[1] - st.floors[0] + 1));
  const name = type === 'tower' ? `The ${st.prefixes[Math.floor(cellRand(i, j, 306) * st.prefixes.length)]} Tower`
    : type === 'crypt' ? `${st.prefixes[Math.floor(cellRand(i, j, 306) * st.prefixes.length)]} Crypt of ${SYL_A[Math.floor(cellRand(i, j, 307) * SYL_A.length)]}${SYL_B[Math.floor(cellRand(i, j, 308) * SYL_B.length)]}`
    : `${st.prefixes[Math.floor(cellRand(i, j, 306) * st.prefixes.length)]} ${st.label}`;
  const site = { key: k, i, j, x, y, type, name, floors, danger, sprite: st.sprite };
  sites.set(k, site);
  return site;
}
function nearbySites(x, y, reach = 1) {
  const i0 = Math.round((x - 20) / TOWN_SPACING), j0 = Math.round((y - 15) / TOWN_SPACING), out = [];
  for (let i = i0 - reach; i <= i0 + reach; i++) for (let j = j0 - reach; j <= j0 + reach; j++) { const st = siteAt(i, j); if (st) out.push(st); }
  return out;
}
const siteAtTile = (x, y) => nearbySites(x, y, 1).find((st) => st.x === x && st.y === y) || null;
function nearestTownTo(x, y) {
  let best = null, bd = Infinity;
  for (const t of nearbyTowns(x, y, 2)) { const d = Math.abs(t.cx - x) + Math.abs(t.cy - y); if (d < bd) { bd = d; best = t; } }
  return best || townAt(0, 0);
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
  // roads: every town links east and south to the next town along, skipping empty cells
  const i0 = Math.floor((ox - 20) / TOWN_SPACING), j0 = Math.floor((oy - 15) / TOWN_SPACING);
  for (let i = i0 - 3; i <= i0 + 1; i++) for (let j = j0 - 3; j <= j0 + 1; j++) {
    const a = townAt(i, j);
    if (!a) continue;
    for (const b of [neighbourTown(i, j, 1, 0), neighbourTown(i, j, 0, 1)]) {
      if (!b) continue;
      let x = a.cx, y = a.cy;
      while (x !== b.cx) { x += Math.sign(b.cx - x); mark(x, y); mark(x, y + 1); }
      while (y !== b.cy) { y += Math.sign(b.cy - y); mark(x, y); mark(x + 1, y); }
    }
  }
  // trails from each special site to its nearest town, then the site itself on a cleared patch
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const st = siteAt(i, j);
    if (!st) continue;
    const t = nearestTownTo(st.x, st.y);
    let x = st.x, y = st.y;
    while (y !== t.cy) { y += Math.sign(t.cy - y); mark(x, y); }
    while (x !== t.cx) { x += Math.sign(t.cx - x); mark(x, y); }
    for (let yy = st.y - 2; yy <= st.y + 2; yy++) for (let xx = st.x - 2; xx <= st.x + 2; xx++) {
      const lx = xx - ox, ly = yy - oy;
      if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) continue;
      gr[ly * CHUNK + lx] = GROUND.GRASS; tiles[ly * CHUNK + lx] = (xx === st.x && yy === st.y) ? TILE.SITE : TILE.FLOOR;
    }
  }
  // town stamps
  for (const town of nearbyTowns(ox + CHUNK / 2, oy + CHUNK / 2, 1)) {
    for (let y = Math.max(oy, town.y0); y < Math.min(oy + CHUNK, town.y0 + TH); y++) for (let x = Math.max(ox, town.x0); x < Math.min(ox + CHUNK, town.x0 + TW); x++) {
      const [t, g] = townTile(town, x, y);
      tiles[(y - oy) * CHUNK + (x - ox)] = t; gr[(y - oy) * CHUNK + (x - ox)] = g;
    }
  }
  // beasts of the wilds: a few per chunk, never on roads or near a settlement
  const rand = seededRandom(hash32(WORLD_SEED, cx, cy));
  const danger = Math.max(Math.abs(Math.round((ox - 20) / TOWN_SPACING)), Math.abs(Math.round((oy - 15) / TOWN_SPACING)));
  const spots = [];
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const g = gr[y * CHUNK + x];
    if (tiles[y * CHUNK + x] !== TILE.FLOOR || (g !== GROUND.GRASS && g !== GROUND.FOREST)) continue;
    const wx = ox + x, wy = oy + y;
    if (nearbyTowns(wx, wy, 1).some((t) => wx >= t.x0 - 8 && wx < t.x0 + TW + 8 && wy >= t.y0 - 8 && wy < t.y0 + TH + 8)) continue;
    spots.push({ x: wx, y: wy });
  }
  const pool = [...byName('Rat', 'Goblin'), ...(danger >= 2 ? byName('Orc') : []), ...(danger >= 3 ? byName('Skeleton') : []), ...(danger >= 5 ? byName('Wraith') : [])];
  const count = spots.length > 60 ? Math.floor(rand() * 3) : 0;
  for (let i = 0; i < count; i++) {
    const cell = spots.splice(Math.floor(rand() * spots.length), 1)[0];
    const t = pool[Math.floor(rand() * pool.length)];
    const hp = t.hp + danger;
    worldMonsters.push({ ...cell, type: t, hp, maxHp: hp, atk: t.atk + Math.floor(danger / 2), awake: false, wild: true });
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
  const count = town.key === '0,0' ? NPC_TYPES.length : town.folk[0] + Math.floor(noise(town.i, town.j, 98) * (town.folk[1] - town.folk[0] + 1));
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
  shops = []; monsters = worldMonsters; potions = []; golds = []; exit = null; monstersDirty = true;
  refreshTownContext();
}
// Back to the overworld at the home town's square (after a dive or a death).
function returnHome() {
  floor = TOWN;
  createWorld();
  const [i, j] = homeTown.split(',').map(Number);
  const t = townAt(i, j) || townAt(0, 0);
  homeTown = t.key;
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
  sfx.play('door');
  log(`You enter ${house.name}.`);
}
function leaveBuilding() {
  const h = interior.house;
  interior = null;
  createWorld();
  player.x = h.doorX; player.y = h.doorY + 1; player.wx = player.x; player.wy = player.y; settle(player);
  refreshTownContext();   // the house list must follow the hero's outdoor position, not the room's
  for (const n of npcs) if (n.x === player.x && n.y === player.y) { n.y += 1; }
  afterSceneChange();
  log('You step back out onto the square.');
}

function talk(n) {
  if (n.type.name === 'King Aldric') unlock('royal');
  const line = n.type.lines[rnd(n.type.lines.length)];
  log(`${n.type.name}: ${line}`);
  bubble = { x: n.x, y: n.y, text: line, until: performance.now() + 4000 };
  if (n.type.action === 'inn') restAtInn();
  else if (n.type.action && SHOPS[n.type.action]) openShop(n.type.action);
  else offerQuest(n);
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
  const counters = { shop: 'shop', market: 'shop', herbs: 'potions', smithy: 'smithy', armoury: 'armoury', apothecary: 'apothecary', royal: 'royal' };
  if (d.sprite === 'counter' && counters[id]) return openShop(counters[id]);
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
  const def = dungeonDef || { pool: null, gold: 1, potions: 1, danger: 0 };
  const pool = def.pool || MONSTER_TYPES.filter((t) => t.minFloor <= floor);
  const danger = def.danger || 0;
  const take = () => cells.splice(r(cells.length), 1)[0];
  const mCount = Math.min(cells.length / 10, 6 + floor * 2 + r(4));
  for (let i = 0; i < mCount && cells.length; i++) {
    const cell = take();
    if (spawnChunk && dist(cell, { x: ox + CHUNK / 2, y: oy + CHUNK / 2 }) < 7) continue;
    const t = pool[r(pool.length)];
    const hp = t.hp + Math.floor(floor / 2) + danger;
    monsters.push({ ...cell, type: t, hp, maxHp: hp, atk: t.atk + Math.floor(danger / 2), awake: false });
    monstersDirty = true;
  }
  for (let i = 0; i < Math.round((2 + r(3)) * def.potions) && cells.length; i++) potions.push({ ...take(), heal: 5 });
  // a chest or two in the rooms, and spike traps in the corridors
  for (let i = 0; i < 1 + r(2) && chunk.rooms.length; i++) {
    const room = chunk.rooms[r(chunk.rooms.length)];
    const x = ox + room.x + r(room.w), y = oy + room.y + r(room.h);
    if (chunk.tiles[(y - oy) * CHUNK + (x - ox)] === TILE.FLOOR && !(spawnChunk && dist({ x, y }, { x: ox + room.cx, y: oy + room.cy }) < 2)) chunk.tiles[(y - oy) * CHUNK + (x - ox)] = TILE.CHEST;
  }
  for (let i = 0; i < 1 + r(3) && cells.length; i++) {
    const c = take();
    const inRoom = chunk.rooms.some((rm) => c.x >= ox + rm.x && c.x < ox + rm.x + rm.w && c.y >= oy + rm.y && c.y < oy + rm.y + rm.h);
    if (!inRoom && !(spawnChunk && dist(c, { x: ox + CHUNK / 2, y: oy + CHUNK / 2 }) < 8)) chunk.tiles[(c.y - oy) * CHUNK + (c.x - ox)] = TILE.TRAP;
  }
  for (let i = 0; i < 5 + floor + r(4) && cells.length; i++) golds.push({ ...take(), amount: Math.round((5 + r(10) + floor * 2) * def.gold) });
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
  chunks = new Map(); monsters = []; potions = []; golds = []; shops = []; monstersDirty = true; revealedTraps = new Set();
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
  if (floor === (dungeonDef ? dungeonDef.floors : FINAL_FLOOR)) {
    placeBoss(target.rooms[0], ex * CHUNK, ey * CHUNK);
    setTimeout(() => { log(`Something large guards the stairs on this floor. Kill it to break the seal.`, 'bad'); sfx.play('boss'); }, 50);
  }
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
  if (scene !== 'dungeon') return;
  const d = bfs(player.x, player.y, dungeonDef ? dungeonDef.view : VIEW_RADIUS, false);
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
function drawRampart(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 29);
  g.fillStyle = n < 0.5 ? '#64748b' : '#5b6b7f'; g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X, Y + T / 2 - 1, T, 2); g.fillRect(X + (n < 0.5 ? T / 2 : T / 4), Y, 2, T / 2); g.fillRect(X + (n < 0.5 ? T / 4 : T * 0.7), Y + T / 2, 2, T / 2);
  if (groundAt(c, r - 1) !== GROUND.RAMPART) { g.fillStyle = '#94a3b8'; for (let i = 0; i < T; i += 8) g.fillRect(X + i, Y, 4, 5); }
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y + T - 3, T, 3);
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
      if (gnd === GROUND.RAMPART) drawRampart(g, c, r);
      else if (gnd === GROUND.COBBLE || t === TILE.FOUNTAIN) drawCobble(g, c, r);
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
      if (t === TILE.SITE) { const st = siteAtTile(c, r); if (st) drawSprite(g, st.sprite, c, r, 1, 0); }
    }
    for (const st of nearbySites(player.x, player.y, 1)) {
      if (st.x < x0 || st.x > x1 || st.y < y0 || st.y > y1) continue;
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const w = g.measureText(st.name).width + 12;
      g.fillStyle = 'rgba(6,12,20,0.65)'; g.fillRect(st.x * T - off.x + T / 2 - w / 2, st.y * T - off.y - 20, w, 16);
      g.fillStyle = '#c084fc'; g.fillText(st.name, st.x * T - off.x + T / 2, st.y * T - off.y - 6);
      g.textAlign = 'start'; g.textBaseline = 'alphabetic';
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
      if (t === TILE.CHEST) drawSprite(g, 'chest', c, r, 1, 4);
      if (t === TILE.TRAP && revealedTraps.has(key(c, r))) drawSprite(g, 'trap', c, r, 1, 2);
    }
  }
  // light falls off towards the edge of sight
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
    if (!wasSeen(c, r)) continue;
    const lit = visible.has(key(c, r));
    const dd = cheb({ x: c, y: r }, player);
    const dark = !lit ? 0.68 : Math.min(0.5, Math.max(0, (dd - 3) / (dungeonDef ? dungeonDef.view : VIEW_RADIUS)) * 0.6);
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
  const where = scene === 'house' ? interior.house.name : inTown() ? `${townContaining(player.x, player.y)?.name ?? 'The wilds'} · day ${dayNumber()}, ${dayPhase()}` : `${dungeonDef ? dungeonDef.name : 'Dungeon'} ${floor}/${dungeonDef ? dungeonDef.floors : FINAL_FLOOR}`;
  const text = `${where}   HP ${player.hp}/${player.maxHp}   ATK ${player.atk + weaponAtk()}   DEF ${armorDef()}   Lv ${player.level}   Gold ${player.gold}`;
  g.font = 'bold 13px sans-serif';
  const w = g.measureText(text).width + 20;
  g.fillStyle = 'rgba(6,12,20,0.78)';
  g.beginPath(); g.roundRect(8, 8, w, 36, 6); g.fill();
  g.fillStyle = '#e6eef8'; g.textBaseline = 'top'; g.fillText(text, 18, 14);
  const ratio = Math.max(0, player.hp / player.maxHp);
  g.fillStyle = '#06202c'; g.fillRect(18, 32, w - 20, 6);
  g.fillStyle = ratio > 0.5 ? '#5fe17a' : ratio > 0.25 ? '#f5c542' : '#ff6b6b'; g.fillRect(18, 32, (w - 20) * ratio, 6);
  {
    const cls = heroClass();
    const parts = [`1: ${cls.ability} ${player.cooldown > 0 ? `(${player.cooldown})` : '(ready)'}`];
    if (player.shield > 0) parts.push(`Shield ${player.shield}`);
    if (player.poison > 0) parts.push(`Poisoned ${player.poison}`);
    g.font = '12px sans-serif';
    const at = parts.join('   ');
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, 50, g.measureText(at).width + 20, 20, 5); g.fill();
    g.fillStyle = player.poison > 0 ? '#9ef0b0' : player.cooldown > 0 ? '#a8c0d8' : '#7bdfff'; g.fillText(at, 18, 54);
  }
  const q = player.quests && questsActive()[0];
  if (q) {
    g.font = '12px sans-serif';
    const qt = `Quest: ${q.label}  ${q.have}/${q.need}${questsActive().length > 1 ? `  (+${questsActive().length - 1} more, Q)` : '  (Q)'}`;
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, 74, Math.min(canvas.width - 16, g.measureText(qt).width + 20), 20, 5); g.fill();
    g.fillStyle = '#9ef0b0'; g.fillText(qt, 18, 78);
  }
  // compass: to the stairs in the dungeon, to the next town outdoors
  const target = scene === 'dungeon' ? exit : (inTown() ? (() => { const t = nearestOtherTown(player.x, player.y); return t ? { x: t.cx, y: t.cy, name: t.name } : null; })() : null);
  if (target) {
    const dx = target.x - player.x, dy = target.y - player.y, d = Math.abs(dx) + Math.abs(dy);
    const what = scene === 'dungeon' ? (bossAlive() ? 'Stairs (sealed)' : 'Stairs') : target.name;
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
const WORLD_MAP_COLORS = ['#448a3f', '#336a30', '#dfc78f', '#1d4ed8', '#6b7280', '#a8865a', '#6b7280', '#2e7d32', '#94a3b8'];
function drawMinimap(g) {
  const px = scene === 'world' ? 2 : 3, hw = scene === 'world' ? 48 : 30, hh = scene === 'world' ? 32 : 20;
  const W = (hw * 2 + 1) * px, H = (hh * 2 + 1) * px, X = canvas.width - W - 8, Y = 44;
  g.fillStyle = 'rgba(6,12,20,0.78)'; g.fillRect(X - 2, Y - 2, W + 4, H + 4);
  for (let dy = -hh; dy <= hh; dy++) for (let dx = -hw; dx <= hw; dx++) {
    const x = player.x + dx, y = player.y + dy;
    if (scene === 'world') {
      const t = getTile(x, y), gnd = groundAt(x, y);
      g.fillStyle = t === TILE.EXIT ? '#5fe17a' : t === TILE.SITE ? '#c084fc' : (t === TILE.WALL && gnd === GROUND.GRASS) ? '#d9b382' : WORLD_MAP_COLORS[gnd];
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
  ctx.save();
  if (shake && now < shake.until) { const k = (shake.until - now) / 220; ctx.translate((Math.random() - 0.5) * shake.mag * 2 * k, (Math.random() - 0.5) * shake.mag * 2 * k); } else shake = null;
  drawScene(now);
  ctx.restore();
}
const isRainy = () => cellRand(dayNumber(), 0, 777) < 0.3;
function drawScene(now) {
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
  if (scene !== 'dungeon') for (const n of npcs) if (inView(n)) { const [lx, ly] = [n.rx ?? n.x, n.ry ?? n.y]; shadow(lx, ly); drawSprite(ctx, n.type.sprite, lx, ly - bob(n), 1, 3, n.face === -1); }
  for (const m of monsters) {
    if (!inView(m) || !isVisible(m.x, m.y)) continue;
    const [ldx, ldy] = lunge(m, now);
    const lx = (m.rx ?? m.x) + ldx / T, ly = (m.ry ?? m.y) + ldy / T - bob(m, m.awake);
    shadow(lx, ly);
    drawSprite(ctx, m.type.sprite, lx, ly, 1, m.boss ? -5 : 3, m.face === -1, m.flashUntil > now);
    if (m.boss) {
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const label = m.name[0].toUpperCase() + m.name.slice(1), lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(6,12,20,0.7)'; ctx.fillRect(lx * T - cam.x + T / 2 - lw / 2, ly * T - cam.y - 22, lw, 14);
      ctx.fillStyle = '#ff9b9b'; ctx.fillText(label, lx * T - cam.x + T / 2, ly * T - cam.y - 11);
      ctx.textAlign = 'start';
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x - 4, ly * T - cam.y - 6, T + 8, 4);
      ctx.fillStyle = '#f33'; ctx.fillRect(lx * T - cam.x - 4, ly * T - cam.y - 6, (T + 8) * (m.hp / m.maxHp), 4);
    } else if (m.hp < m.maxHp) {
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
    if (player.shield > 0) { ctx.strokeStyle = `rgba(123,223,255,${0.5 + 0.3 * Math.sin(now / 120)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx * T - cam.x + T / 2, ly * T - cam.y + T / 2, T * 0.62, 0, Math.PI * 2); ctx.stroke(); }
    drawSprite(ctx, heroClass().sprite, lx, ly, 1, 3, player.face === -1, player.flashUntil > now || player.poison > 0 && Math.floor(now / 300) % 3 === 0);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], age = now - f.at;
    if (age > 800) { floats.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - age / 800; ctx.fillStyle = f.color; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x * T - cam.x + T / 2, f.y * T - cam.y - age / 40);
    ctx.textAlign = 'start'; ctx.globalAlpha = 1;
  }
  if (scene === 'world') {
    // shimmer on water in view
    ctx.fillStyle = 'rgba(191,219,254,0.55)';
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
      if (groundAt(c, r) !== GROUND.WATER) continue;
      const ph = (now / 900 + noise(c, r, 31) * 7) % 1;
      if (ph < 0.35) ctx.fillRect(c * T - cam.x + 6 + ph * 40, r * T - cam.y + 10 + noise(c, r, 33) * 14, 8, 2);
    }
    if (isRainy()) {
      ctx.strokeStyle = 'rgba(190,210,240,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const x = (i * 97 + now * 0.9) % (canvas.width + 60) - 30, y = (i * 53 + now * 1.3) % (canvas.height + 40) - 20;
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,40,70,0.18)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const tint = nightTint();
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (dayPhase() === 'night' || dayPhase() === 'dusk') {
      for (const town of nearbyTowns(player.x, player.y, 1)) {
        for (const [lc, lr] of [[town.cx - 11, town.cy - 6], [town.cx + 11, town.cy - 6], [town.cx - 11, town.cy + 6], [town.cx + 11, town.cy + 6]]) {
          if (lc < x0 || lc > x1 || lr < y0 || lr > y1) continue;
          const gx = lc * T - cam.x + T / 2, gy = lr * T - cam.y + 10;
          const grd = ctx.createRadialGradient(gx, gy, 4, gx, gy, T * 2.2);
          grd.addColorStop(0, 'rgba(255,216,107,0.35)'); grd.addColorStop(1, 'rgba(255,216,107,0)');
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(gx, gy, T * 2.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
  if (bubble) { if (now > bubble.until) bubble = null; else drawBubble(ctx, bubble); }
  if (inspected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(inspected.x * T - cam.x + 1, inspected.y * T - cam.y + 1, T - 2, T - 2); }
  drawHud(ctx, now);
  if (toast && !perkChoices && !questsOpen && !mapOpen) {
    if (now > toast.until) toast = null;
    else {
      ctx.font = '13px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      const words = toast.text.split(' '), lines = []; let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > 520) { lines.push(line); line = w; } else line = t; }
      lines.push(line);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28, bh = lines.length * 18 + 16, bx = canvas.width / 2 - bw / 2, by = 104;
      ctx.globalAlpha = Math.min(1, (toast.until - now) / 600);
      ctx.fillStyle = 'rgba(255,216,107,0.95)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
      ctx.fillStyle = '#1b1b2f'; lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, by + 8 + i * 18));
      ctx.globalAlpha = 1; ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }
  if (mapOpen) drawWorldMap(ctx, now);
  if (questsOpen) drawQuests(ctx);
  if (perkChoices) drawPerks(ctx);
}

// ---------- the world map ----------
// A wide view of the surface around the hero, sampled every other tile and
// cached until the hero has moved a fair way. Towns are named, roads drawn.
let mapOpen = false;
const MAP_STEP = 2, MAP_PX = 3;
const mapCache = { ox: null, oy: null, canvas: document.createElement('canvas') };
const MAP_COLORS = ['#3f7d3a', '#2f5f2c', '#dfc78f', '#1d4ed8', '#6b7280', '#a8865a', '#6b7280', '#2e7d32'];

function toggleMap() {
  if (scene !== 'world') { log('The map shows the surface. You are ' + (scene === 'dungeon' ? 'underground.' : 'indoors.')); return; }
  mapOpen = !mapOpen;
  draw();
}
function renderWorldMap() {
  const W = Math.floor((canvas.width - 40) / MAP_PX), H = Math.floor((canvas.height - 96) / MAP_PX);  // samples
  const ox = Math.floor((player.x - W * MAP_STEP / 2) / 16) * 16, oy = Math.floor((player.y - H * MAP_STEP / 2) / 16) * 16;
  if (mapCache.ox === ox && mapCache.oy === oy) return;
  const c = mapCache.canvas; c.width = W * MAP_PX; c.height = H * MAP_PX;
  const g = c.getContext('2d');
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    g.fillStyle = MAP_COLORS[terrainAt(ox + sx * MAP_STEP, oy + sy * MAP_STEP)];
    g.fillRect(sx * MAP_PX, sy * MAP_PX, MAP_PX, MAP_PX);
  }
  const toPx = (x, y) => [((x - ox) / MAP_STEP) * MAP_PX, ((y - oy) / MAP_STEP) * MAP_PX];
  // roads between lattice neighbours, then the towns on top
  const i0 = Math.floor((ox - 20) / TOWN_SPACING) - 1, i1 = Math.floor((ox + W * MAP_STEP) / TOWN_SPACING) + 1;
  const j0 = Math.floor((oy - 15) / TOWN_SPACING) - 1, j1 = Math.floor((oy + H * MAP_STEP) / TOWN_SPACING) + 1;
  g.strokeStyle = '#a8865a'; g.lineWidth = 2;
  for (let i = i0 - 2; i <= i1; i++) for (let j = j0 - 2; j <= j1; j++) {
    const a = townAt(i, j);
    if (!a) continue;
    for (const b of [neighbourTown(i, j, 1, 0), neighbourTown(i, j, 0, 1)]) {
      if (!b) continue;
      const [ax, ay] = toPx(a.cx, a.cy), [bx, by] = toPx(b.cx, b.cy);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, ay); g.lineTo(bx, by); g.stroke();
    }
  }
  g.lineWidth = 1; g.strokeStyle = '#8c6d45';
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const st = siteAt(i, j);
    if (!st) continue;
    const t = nearestTownTo(st.x, st.y), [sx, sy] = toPx(st.x, st.y), [tx, ty] = toPx(t.cx, t.cy);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, ty); g.lineTo(tx, ty); g.stroke();
  }
  g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const st = siteAt(i, j);
    if (!st) continue;
    const [sx, sy] = toPx(st.x, st.y);
    g.fillStyle = '#c084fc'; g.fillRect(sx - 4, sy - 4, 8, 8); g.fillStyle = '#1b1b2f'; g.fillRect(sx - 2, sy - 2, 4, 4);
    g.font = '10px sans-serif'; g.fillStyle = '#e9d5ff'; g.fillText(`${st.name} ${stars(st.danger).replace(/☆/g, '')}`, sx, sy - 6); g.font = 'bold 11px sans-serif';
  }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const t = townAt(i, j);
    if (!t) continue;
    const [x, y] = toPx(t.x0, t.y0), w = (TW / MAP_STEP) * MAP_PX, h = (TH / MAP_STEP) * MAP_PX;
    const sw = t.size === 'village' ? w * 0.6 : w, sh = t.size === 'village' ? h * 0.6 : h, sx = x + (w - sw) / 2, sy = y + (h - sh) / 2;
    g.fillStyle = t.walled ? '#94a3b8' : '#6b7280'; g.fillRect(sx, sy, sw, sh);
    if (t.walled) { g.fillStyle = '#475569'; g.fillRect(sx + 3, sy + 3, sw - 6, sh - 6); g.fillStyle = t.size === 'grand' ? '#ffd86b' : '#94a3b8'; g.fillRect(sx + sw / 2 - 5, sy + sh / 2 - 5, 10, 10); }
    else { g.fillStyle = '#d9b382'; g.fillRect(sx + 4, sy + 4, sw - 8, 6); g.fillRect(sx + 4, sy + sh - 10, sw - 8, 6); }
    g.fillStyle = '#5fe17a'; g.fillRect(x + w / 2 - 2, sy + sh - 6, 4, 4);
    const label = (t.key === homeTown ? t.name + ' (home)' : t.name) + (t.size === 'grand' ? ' ♛' : ''), lw = g.measureText(label).width + 8;
    g.fillStyle = 'rgba(6,12,20,0.75)'; g.fillRect(x + w / 2 - lw / 2, sy - 16, lw, 14);
    g.fillStyle = t.size === 'grand' ? '#fbbf24' : '#ffd86b'; g.fillText(label, x + w / 2, sy - 3);
  }
  g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  mapCache.ox = ox; mapCache.oy = oy;
}
function drawWorldMap(g, now) {
  renderWorldMap();
  const c = mapCache.canvas, X = Math.floor((canvas.width - c.width) / 2), Y = 56;
  g.fillStyle = 'rgba(6,12,20,0.92)'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(c, X, Y);
  g.strokeStyle = '#12384a'; g.lineWidth = 2; g.strokeRect(X - 1, Y - 1, c.width + 2, c.height + 2);
  // the hero
  const px = X + ((player.x - mapCache.ox) / MAP_STEP) * MAP_PX, py = Y + ((player.y - mapCache.oy) / MAP_STEP) * MAP_PX;
  g.fillStyle = 'rgba(255,216,107,0.35)'; g.beginPath(); g.arc(px, py, 8 + Math.sin(now / 200) * 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd86b'; g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2); g.fill();
  g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd86b'; g.fillText('You', px, py - 10);
  // title line
  const here = townContaining(player.x, player.y);
  g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText('World map', 20, 14);
  g.font = '13px sans-serif'; g.fillStyle = '#a8c0d8';
  g.fillText(`${here ? here.name : 'The wilds'}  ·  position ${player.x}, ${player.y}  ·  each square is ${MAP_STEP} tiles  ·  M or Esc closes`, 112, 18);
  // legend
  const items = [['#3f7d3a', 'grass'], ['#2e7d32', 'forest'], ['#1d4ed8', 'water'], ['#6b7280', 'mountains / town'], ['#a8865a', 'road'], ['#5fe17a', 'gate'], ['#c084fc', 'cave, crypt or tower (★ danger)']];
  let lx = 20; const ly = canvas.height - 26;
  g.font = '12px sans-serif'; g.textBaseline = 'middle';
  for (const [col, name] of items) { g.fillStyle = col; g.fillRect(lx, ly - 5, 10, 10); g.fillStyle = '#cfe9ff'; g.fillText(name, lx + 14, ly); lx += g.measureText(name).width + 30; }
  g.textAlign = 'start'; g.textBaseline = 'alphabetic';
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
  const n = scene !== 'dungeon' && getNpcAt(x, y);
  if (n) return `${n.type.name} — walk into them to ${n.type.action === 'shop' || n.type.action === 'potions' ? 'trade' : n.type.action === 'inn' ? 'rest' : 'chat'}`;
  if (isVisible(x, y)) {
    const m = getMonsterAt(x, y);
    if (m) return `${m.boss ? m.name[0].toUpperCase() + m.name.slice(1) + ' (boss)' : m.type.name} — ${m.hp}/${m.maxHp} HP, attack ${m.atk}${m.awake ? '' : ' (asleep)'}`;
    if (getPotionAt(x, y)) return 'Potion — restores 5 HP';
    const g = getGoldAt(x, y);
    if (g) return `Gold — ${g.amount} pieces`;
  }
  if (t === TILE.SHOP) return 'Merchant — step here to buy and sell gear';
  if (t === TILE.CHEST) return 'Chest — walk into it to open';
  if (t === TILE.TRAP && revealedTraps.has(key(x, y))) return 'Spike trap — step around it';
  if (t === TILE.FOUNTAIN) return 'The town fountain';
  if (t === TILE.DOOR) {
    if (scene === 'house') return 'Door — back out to the square';
    const h = houses.find((hh) => hh.doorX === x && hh.doorY === y);
    return h ? `${h.name} — step onto the door to go in` : 'Door';
  }
  if (scene === 'house' && decor[y] && decor[y][x]) return decor[y][x].sprite === 'bed' ? 'Bed — lie down to rest' : `${decor[y][x].name} — walk into it`;
  if (inTown() && t === TILE.WALL) { const h = houses.find((hh) => x >= hh.x && x < hh.x + hh.w && y >= hh.y && y < hh.y + hh.h); if (h) return `${h.name} — the door is at the bottom`; if (groundAt(x, y) === GROUND.RAMPART) return 'Castle wall — the gates are in the middle of each side'; }
  if (t === TILE.EXIT) return inTown() ? 'Dungeon gate — step here to begin your descent' : 'Stairs down — the exit from this floor';
  if (t === TILE.SITE && inTown()) { const st = siteAtTile(x, y); if (st) return `${st.name} — ${st.floors} floors, danger ${stars(st.danger)}, step in to explore`; }
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
function perkClick(e) {
  if (!perkChoices) return false;
  const rect = canvas.getBoundingClientRect(), sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * sx, py = (e.clientY - rect.top) * sy;
  const w = 260, gap = 24, x0 = (canvas.width - (w * 3 + gap * 2)) / 2;
  if (py >= 200 && py <= 350) for (let i = 0; i < 3; i++) if (px >= x0 + i * (w + gap) && px <= x0 + i * (w + gap) + w) { choosePerk(i); return true; }
  return true;
}
function inspect(e) {
  if (e.type === 'click' && perkClick(e)) return;
  if (mapOpen || perkChoices) { clearInspect(); return; }
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
  add(heroClass().sprite, `You, ${heroClass().name}`, `1: ${heroClass().ability}`);
  if (scene === 'house') {
    for (const n of npcs) add(n.type.sprite, n.type.name, n.type.action === 'inn' ? 'rest for free' : n.type.action ? 'buy and sell' : 'chat');
    add('bed', 'Bed', 'rest'); add('counter', 'Counter', 'trade or rest');
    return;
  }
  const pool = (scene === 'dungeon' && dungeonDef && dungeonDef.pool) ? dungeonDef.pool : MONSTER_TYPES;
  const danger = scene === 'dungeon' && dungeonDef ? dungeonDef.danger : 0;
  for (const t of pool) {
    const locked = !(dungeonDef && dungeonDef.pool) && t.minFloor > Math.max(floor, 1);
    add(t.sprite, t.name, locked ? `from floor ${t.minFloor}` : `${t.hp + danger} HP, attack ${t.atk + Math.floor(danger / 2)}, ${t.xp} XP`, locked);
  }
  add('potion', 'Potion', '+5 HP');
  add('gold', 'Gold', '');
  add('merchant', 'Merchant', 'buy and sell');
  if (inTown()) {
    add('guard', 'Townsfolk', 'walk into them to chat');
    add('stairs', 'Gate', 'into the dungeon');
    add('tree', 'Forest, water, mountains', 'impassable; roads join the towns');
    add('cave', 'Caves, crypts, towers', 'short dungeons with a boss and a hoard');
    add('rat', 'Beasts of the wilds', 'roam outside the towns, bolder at night');
  } else { add('stairs', 'Stairs', 'follow the compass'); add('chest', 'Chest', 'gold, sometimes gear'); add('trap', 'Spike trap', 'hidden until found'); }
}

function updateStats() {
  const where = scene === 'house' ? interior.house.name : inTown() ? (townContaining(player.x, player.y)?.name ?? 'The wilds') : `${dungeonDef ? dungeonDef.name : 'Dungeon'} ${floor}/${dungeonDef ? dungeonDef.floors : FINAL_FLOOR}`;
  statsEl.textContent = `${where} | HP ${player.hp}/${player.maxHp} | ATK ${player.atk}${weaponAtk() ? '+' + weaponAtk() : ''} | DEF ${armorDef()} | Lv ${player.level} (${player.xp}/${xpToNext(player.level)} XP) | Gold ${player.gold}`;
  hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  hpBar.style.background = player.hp / player.maxHp > 0.5 ? '#5fe17a' : player.hp / player.maxHp > 0.25 ? '#f5c542' : '#ff6b6b';
  renderInventory();
}

// ---------- combat ----------
function offerPerks() {
  if (!player.pendingPerks || perkChoices) return;
  const avail = Object.keys(PERKS).filter((id) => perkCount(id) < PERKS[id].max);
  perkChoices = [];
  while (perkChoices.length < 3 && avail.length) perkChoices.push(avail.splice(rnd(avail.length), 1)[0]);
  tip('perk', 'Level up! Pick a perk with 1, 2 or 3, or click one. Perks stay with your hero for good.');
}
function choosePerk(i) {
  const id = perkChoices && perkChoices[i];
  if (!id) return;
  player.perks.push(id);
  if (id === 'tough') { player.maxHp += 6; player.hp += 6; }
  if (id === 'brawn') player.atk += 1;
  log(`Perk taken: ${PERKS[id].name}, ${PERKS[id].desc}.`, 'good');
  sfx.play('levelup');
  player.pendingPerks--; perkChoices = null;
  updateStats(); buildLegend();
  if (player.pendingPerks > 0) offerPerks();
  draw();
}
function drawPerks(g) {
  g.fillStyle = 'rgba(6,12,20,0.9)'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.textBaseline = 'top'; g.textAlign = 'center';
  g.fillStyle = '#ffd86b'; g.font = 'bold 22px sans-serif'; g.fillText(`Level ${player.level}! Choose a perk`, canvas.width / 2, 120);
  g.fillStyle = '#a8c0d8'; g.font = '13px sans-serif'; g.fillText('Press 1, 2 or 3, or click a card', canvas.width / 2, 152);
  const w = 260, h = 150, gap = 24, x0 = (canvas.width - (w * 3 + gap * 2)) / 2, y0 = 200;
  perkChoices.forEach((id, i) => {
    const x = x0 + i * (w + gap);
    g.fillStyle = '#06202c'; g.beginPath(); g.roundRect(x, y0, w, h, 10); g.fill();
    g.strokeStyle = '#12384a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#7bdfff'; g.font = 'bold 15px sans-serif'; g.fillText(`${i + 1}`, x + 24, y0 + 16);
    g.fillStyle = '#e6eef8'; g.font = 'bold 17px sans-serif'; g.fillText(PERKS[id].name, x + w / 2, y0 + 44);
    g.fillStyle = '#cfe9ff'; g.font = '13px sans-serif';
    const words = PERKS[id].desc.split(' '); let line = '', ly = y0 + 80;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w - 30) { g.fillText(line, x + w / 2, ly); ly += 18; line = wd; } else line = t; }
    g.fillText(line, x + w / 2, ly);
    if (perkCount(id)) { g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText(`taken ×${perkCount(id)}`, x + w / 2, y0 + h - 24); }
  });
  g.textAlign = 'start'; g.textBaseline = 'alphabetic';
}
function gainXp(n) {
  n = Math.round(n * (perkCount('hunter') ? 1.5 : 1));
  player.xp += n;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    player.maxHp += 4; player.atk += 1; player.hp = player.maxHp;
    log(`Level up! You are now level ${player.level}. HP and attack increased.`, 'good');
    sfx.play('levelup');
    player.pendingPerks = (player.pendingPerks || 0) + 1;
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
  sfx.play('hit');
  if (m.hp <= 0) killMonster(m);
  else log(`You hit ${m.boss ? m.name : 'the ' + m.type.name} for ${dmg}.`);
}
function killMonster(m) {
  {
    monsters = monsters.filter((x) => x !== m); monstersDirty = true;
    if (scene === 'world') worldMonsters = monsters;
    kills++; player.lifetimeKills = (player.lifetimeKills || 0) + 1;
    if (perkCount('vampiric') && player.hp < player.maxHp) { player.hp += 1; floatText(player.x, player.y, '+1', '#9ef0b0'); }
    unlock('first_blood');
    if (player.lifetimeKills >= 50) unlock('slayer_50');
    if (scene === 'world' && dayPhase() === 'night') unlock('night_owl');
    if (m.boss) unlock('boss_slayer');
    const xp = Math.round(m.type.xp * (dungeonDef ? dungeonDef.xp : 1) * (m.boss ? 5 : 1));
    if (m.boss) {
      log(`You slay ${m.name}! The seal on the stairs breaks.`, 'good');
      const purse = 40 + 30 * (dungeonDef ? dungeonDef.danger : 0) + floor * 10;
      player.gold += purse; floatText(m.x, m.y, `+${purse}g`, '#f5c542');
      sfx.play('win');
    } else log(`You slay the ${mName(m)} (+${xp} XP).`, 'good');
    gainXp(xp);
    questProgress('slay', m.type.name, 1);
    if (m.boss) { const keep = dungeonDef; dungeonDef = { ...(dungeonDef || {}), loot: 1 }; dropLoot(m); dungeonDef = keep; } else dropLoot(m);
  }
}
function monsterAttack(m, ranged = false) {
  if (!ranged && perkCount('nimble') && Math.random() < 0.25) { log(`You dodge ${m.boss ? m.name : 'the ' + m.type.name}.`, 'good'); floatText(player.x, player.y, 'dodge', '#7bdfff'); return; }
  const dmg = Math.max(1, m.atk - armorDef() - (player.shield > 0 ? 2 : 0));
  player.hp -= dmg;
  if (dmg >= player.maxHp * 0.25 || m.boss) shakeScreen(m.boss ? 6 : 4);
  if (player.hp <= 0 && perkCount('second_wind') && !player.meta.second_wind) {
    player.meta.second_wind = true; player.hp = 1;
    log('Second wind! You refuse to fall.', 'good'); unlock('survivor'); sfx.play('shield');
  }
  if (m.type.poison && !player.poison && Math.random() < 0.5) { player.poison = 4; log('You are poisoned! A potion will cure it.', 'bad'); sfx.play('poison'); tip('poison', 'Poison costs 1 HP a turn for four turns. Any potion cures it. Press P to drink one from your bag.'); }
  if (ranged) { for (let d = 1; d < Math.abs(m.x - player.x) + Math.abs(m.y - player.y); d++) floatText(m.x + Math.sign(player.x - m.x) * d, m.y + Math.sign(player.y - m.y) * d, '➤', '#d9b382'); }
  const now = performance.now();
  m.lunge = { dx: Math.sign(player.x - m.x), dy: Math.sign(player.y - m.y), until: now + 140 };
  if (player.x !== m.x) m.face = Math.sign(player.x - m.x);
  player.flashUntil = now + 120;
  floatText(player.x, player.y, `-${dmg}`, '#ff6b6b');
  log(`${m.boss ? m.name[0].toUpperCase() + m.name.slice(1) : m.type.name} hits you for ${dmg}.`, 'bad');
  sfx.play('hurt');
}
function stepMonsters() {
  const d = bfs(player.x, player.y, SIM_RADIUS, false);
  for (const m of monsters) {
    if (m.hp <= 0 || cheb(m, player) > SIM_RADIUS) continue;
    const wake = scene === 'world' ? (dayPhase() === 'night' ? 10 : 6) : 6;
    if (!m.awake && isVisible(m.x, m.y) && dist(m, player) <= wake && Math.random() < 0.7) m.awake = true;
    if (dist(m, player) === 1) { monsterAttack(m); continue; }
    if (!m.awake) continue;
    if (m.type.ranged && (m.x === player.x || m.y === player.y)) {
      const dd = Math.abs(m.x - player.x) + Math.abs(m.y - player.y);
      if (dd <= m.type.ranged) {
        let clear = true;
        for (let k = 1; k < dd; k++) if (!walkable(getTile(m.x + Math.sign(player.x - m.x) * k, m.y + Math.sign(player.y - m.y) * k))) clear = false;
        if (clear) { monsterAttack(m, true); continue; }
      }
    }
    let best = null, bestD = d.get(key(m.x, m.y)) ?? Infinity;
    const dirs = DIRS.slice().sort(() => Math.random() - 0.5);
    if (m.type.erratic && Math.random() < 0.5) bestD = Infinity;   // bats flap about
    if (m.type.ranged && dist(m, player) <= 2) {
      // archers back off to shoot again
      for (const [dx, dy] of dirs) {
        const nx = m.x + dx, ny = m.y + dy;
        if (walkable(getTile(nx, ny)) && !getMonsterAt(nx, ny) && dist({ x: nx, y: ny }, player) > dist(m, player)) { best = [nx, ny]; break; }
      }
      if (best) { monsterIndex.delete(key(m.x, m.y)); m.x = best[0]; m.y = best[1]; monsterIndex.set(key(m.x, m.y), m); continue; }
    }
    for (const [dx, dy] of dirs) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!walkable(getTile(nx, ny)) || getMonsterAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
      if (scene === 'world' && townContaining(nx, ny)) continue;   // beasts keep out of settlements
      const nd = d.get(key(nx, ny));
      if (nd !== undefined && nd < bestD) { bestD = nd; best = [nx, ny]; }
    }
    if (!best && Math.random() < 0.5) {
      const [dx, dy] = dirs[0];
      const nx = m.x + dx, ny = m.y + dy;
      if (getTile(nx, ny) === TILE.FLOOR && !getMonsterAt(nx, ny) && !(nx === player.x && ny === player.y) && !(scene === 'world' && townContaining(nx, ny))) best = [nx, ny];
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
  if (!dungeonDef) dungeonDef = townDungeon(townAt(...homeTown.split(',').map(Number)) || townAt(0, 0));
  if (floor > dungeonDef.floors) {
    const def = dungeonDef;
    sfx.play('win');
    if (def.kind === 'site') { questProgress('clear', def.site.key, 1); unlock(def.site.type); } else unlock('escapist');
    if (def.treasure) {
      const hoard = Math.round(def.treasure * (1 + def.danger * 0.5));
      player.gold += hoard;
      log(`At the bottom of the ${def.name} you find a hoard: ${hoard} gold!`, 'good');
    }
    if (def.kind === 'site') {
      floor = TOWN; createWorld();
      player.x = def.site.x; player.y = def.site.y + 1; player.wx = player.x; player.wy = player.y; settle(player); refreshTownContext();
      afterSceneChange();
      log(`You climb back out of the ${def.name} into daylight.`, 'good');
    } else {
      returnHome();
      afterSceneChange();
      log(`You escaped the dungeon with ${player.gold} gold at level ${player.level}! The town square welcomes you back.`, 'good');
    }
    dungeonDef = null;
    saveProgress('win');
    return;
  }
  createDungeon();
  afterSceneChange();
  sfx.play('stairs');
  if (floor === 1) { player.meta.second_wind = false; tip('dungeon', 'The compass points to the stairs. Walk into monsters to attack, press 1 for your ability, P for a potion.'); }
  if (floor >= 5) unlock('delver');
  if (floor === dungeonDef.floors) tip('boss', 'A boss waits by the stairs on the last floor. Clear the room, use your ability, keep a potion ready.');
  log(floor === 1 ? `You descend into the ${dungeonDef.name}${dungeonDef.danger ? ' (danger ' + stars(dungeonDef.danger) + ')' : ''}. Follow the compass to the stairs.` : `You descend to floor ${floor}.`, 'good');
  saveProgress('progress');
}

function tryMove(dx, dy) {
  if (gameOver || !player || shopOpen || perkChoices) return;
  const nx = player.x + dx, ny = player.y + dy;
  const t = getTile(nx, ny);
  if (t === TILE.WALL || t === TILE.FOUNTAIN) return;
  const n = scene !== 'dungeon' && getNpcAt(nx, ny);
  if (n) { talk(n); draw(); return; }
  if (t === TILE.FURNITURE) { useFurniture(decor[ny][nx]); draw(); return; }
  if (t === TILE.DOOR) {
    if (scene === 'house') leaveBuilding(); else enterBuilding(houses.find((h) => h.doorX === nx && h.doorY === ny));
    return;
  }
  if (dx) player.face = dx;
  if (t === TILE.CHEST) { openChest(nx, ny); endTurn(false); return; }
  const m = getMonsterAt(nx, ny);
  if (m) playerAttack(m);
  else {
    player.x = nx; player.y = ny;
    if (t === TILE.TRAP && (dx || dy)) springTrap(nx, ny);
    const pot = getPotionAt(nx, ny);
    if (pot) {
      const healed = Math.min(pot.heal, player.maxHp - player.hp);
      player.hp += healed;
      potions = potions.filter((p) => p !== pot);
      log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
      if (healed > 0) floatText(nx, ny, `+${healed}`, '#9ef0b0');
      if (player.poison > 0) { player.poison = 0; log('The potion purges the poison.', 'good'); }
      sfx.play('potion');
    }
    const g = getGoldAt(nx, ny);
    if (g) { const amt = Math.round(g.amount * (perkCount('lucky') ? 1.25 : 1)); player.gold += amt; golds = golds.filter((x) => x !== g); log(`You pick up ${amt} gold.`, 'good'); floatText(nx, ny, `+${amt}g`, '#f5c542'); sfx.play('gold'); if (player.gold >= 1000) unlock('rich'); }
    if (t === TILE.SHOP) openShop('shop');
    if (t === TILE.BED) {
      if (interior && interior.house.id === 'inn') restAtInn();
      else log(player.hp < player.maxHp ? 'Not your bed. You lie down anyway, but it does not help.' : 'A bed. Not yours.');
    }
    if (t === TILE.EXIT && bossAlive()) {
      const b = monsters.find((m) => m.boss);
      log(`The stairs are sealed while ${b.name} lives.`, 'bad');
    } else if (t === TILE.EXIT) {
      if (inTown()) { const here = townContaining(nx, ny) || nearestTownTo(nx, ny); homeTown = here.key; player.wx = nx; player.wy = ny + 1; dungeonDef = townDungeon(here); }
      nextFloor(); return;
    }
    if (t === TILE.SITE && inTown()) {
      const site = siteAtTile(nx, ny);
      if (site) {
        homeTown = nearestTownTo(nx, ny).key; player.wx = nx; player.wy = ny;
        dungeonDef = siteDungeon(site);
        log(`You enter the ${site.name}: ${site.floors} floors, danger ${stars(site.danger)}.`, 'good');
        nextFloor(); return;
      }
    }
    if (inTown()) { player.wx = nx; player.wy = ny; }
  }
  endTurn(!m && (dx || dy));
}

// Everything that happens once the hero has acted: the world moves, timers tick.
function endTurn(moved) {
  turn++;
  if (moved && turn % 2 === 0) sfx.play('step');
  if (player.cooldown > 0) player.cooldown--;
  if (player.shield > 0 && --player.shield === 0) log('Your shield wall fades.');
  if (player.poison > 0) {
    player.poison--; player.hp -= 1; floatText(player.x, player.y, '-1', '#7ad36b');
    if (player.poison === 0) log('The poison wears off.', 'good');
  }
  if (turn % SAVE_EVERY_TURNS === 0) saveProgress('progress');
  if (scene !== 'dungeon') stepNpcs();
  if (scene !== 'house') stepMonsters();
  if (inTown() && (turn % 8 === 0)) refreshTownContext();
  if (player.cls === 'ranger' && scene === 'dungeon') {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const k = key(player.x + dx, player.y + dy);
      if (getTile(player.x + dx, player.y + dy) === TILE.TRAP && !revealedTraps.has(k)) { revealedTraps.add(k); log('Your keen eyes spot a spike trap.', 'good'); bgDirty = true; }
    }
  }
  updateCamera();
  updateVisibility();
  updateStats();
  if (player.hp <= 0) die();
  if (!gameOver && player.pendingPerks > 0) offerPerks();
  if (inTown()) {
    const here = townContaining(player.x, player.y);
    if (here && !player.meta.visited.includes(here.key)) { player.meta.visited.push(here.key); if (player.meta.visited.length >= 5) unlock('explorer'); }
    if (dayPhase() === 'night') tip('night', 'Night has fallen. Beasts in the wilds notice you from further away, but towns stay safe.');
  }
  draw();
}

function die() {
  player.hp = 0; updateStats();
  const t = townAt(...homeTown.split(',').map(Number)) || townAt(0, 0);
  const lost = Math.ceil(player.gold / 2);
  endGame('You fell', `You fell ${scene === 'world' ? 'in the wilds' : 'on ' + (dungeonDef ? dungeonDef.name : 'the dungeon') + ' floor ' + floor} after ${turn} turns. You wake at the inn in ${t.name}: level and gear kept, ${lost} gold and your potions gone. Press R to carry on.`);
  player.wx = t.spawn.x; player.wy = t.spawn.y;
  sfx.play('die');
  if (!ACCOUNT.user) {
    guestRespawn = { name: null, floor: 0, level: player.level, xp: player.xp, gold: player.gold - lost, hp: player.maxHp, max_hp: player.maxHp, atk: player.atk,
      weapon: player.weapon, armor: player.armor, bag: player.bag.filter((id) => itemKind(id) !== 'consumable'), quests: [], quests_done: player.questsDone || 0,
      wx: t.spawn.x, wy: t.spawn.y, home: t.key, class: player.cls, guest: true,
      perks: player.perks, achievements: player.achievements, title: player.title, meta: player.meta, weapon_plus: player.weaponPlus, armor_plus: player.armorPlus, kills: player.lifetimeKills };
  }
  saveProgress('death');
}

function openChest(x, y) {
  const danger = dungeonDef ? dungeonDef.danger : 0;
  const gold = Math.round((20 + rnd(30)) * (1 + danger * 0.5) * (dungeonDef ? dungeonDef.gold : 1) * (perkCount('lucky') ? 1.25 : 1));
  player.gold += gold;
  setTile(x, y, TILE.FLOOR); bgDirty = true;
  log(`You open the chest: ${gold} gold.`, 'good');
  if (player.gold >= 1000) unlock('rich');
  floatText(x, y, `+${gold}g`, '#f5c542');
  sfx.play('chest');
  if (Math.random() < 0.4 && !bagFull()) { const keep = dungeonDef; dungeonDef = { ...(dungeonDef || {}), loot: 1 }; dropLoot({ type: { name: 'chest' } }); dungeonDef = keep; }
}
function springTrap(x, y) {
  const dmg = 3 + floor + (dungeonDef ? dungeonDef.danger : 0);
  revealedTraps.add(key(x, y)); bgDirty = true;
  player.hp -= dmg;
  log(`Spikes shoot up from the floor! You take ${dmg} damage.`, 'bad');
  shakeScreen(4);
  tip('trap', 'Spike traps hide in corridors and show once sprung. Step around them. Rangers see them two tiles away.');
  floatText(x, y, `-${dmg}`, '#ff6b6b');
  player.flashUntil = performance.now() + 150;
  sfx.play('trap');
}

// ---------- class abilities ----------
function lineTarget(range) {
  // the nearest monster along one of the four straight lines, with nothing in between
  let best = null;
  for (const [dx, dy] of DIRS) {
    for (let d = 1; d <= range; d++) {
      const x = player.x + dx * d, y = player.y + dy * d;
      if (!walkable(getTile(x, y))) break;
      const m = getMonsterAt(x, y);
      if (m) { if (!best || d < best.d) best = { m, d, dx, dy }; break; }
    }
  }
  return best;
}
function useAbility() {
  if (gameOver || !player || shopOpen || scene === 'house' || perkChoices) return;
  const cls = heroClass();
  if (player.cooldown > 0) { log(`${cls.ability} is not ready (${player.cooldown} turns).`); draw(); return; }
  const cooldownFor = () => Math.max(1, Math.ceil(cls.cooldown * (1 - 0.2 * perkCount('quickened'))));
  if (player.cls === 'warrior') {
    player.shield = 6; player.cooldown = cooldownFor();
    log('You raise your shield wall: 2 less damage from every hit for 6 turns.', 'good');
    sfx.play('shield'); endTurn(false); return;
  }
  if (player.cls === 'ranger') {
    const t = lineTarget(6);
    if (!t) { log('No target in a straight line. Arrows fly up, down, left or right.'); draw(); return; }
    const dmg = player.atk + weaponAtk() + 1 + rnd(2);
    if (t.dx) player.face = t.dx;
    t.m.hp -= dmg; t.m.awake = true; t.m.flashUntil = performance.now() + 120;
    floatText(t.m.x, t.m.y, `-${dmg}`, '#ffd86b');
    for (let d = 1; d < t.d; d++) floatText(player.x + t.dx * d, player.y + t.dy * d, '➤', '#d9b382');
    sfx.play('arrow');
    log(`Your arrow hits ${t.m.boss ? t.m.name : 'the ' + t.m.type.name} for ${dmg}.`);
    if (t.m.hp <= 0) killMonster(t.m);
    player.cooldown = cooldownFor(); endTurn(false); return;
  }
  if (player.cls === 'mage') {
    let target = null, bd = Infinity;
    for (const m of monsters) { const d = cheb(m, player); if (d <= 5 && isVisible(m.x, m.y) && d < bd) { bd = d; target = m; } }
    if (!target) { log('No monster in sight to aim at.'); draw(); return; }
    const dmg = 5 + player.level + rnd(3);
    const hit = monsters.filter((m) => cheb(m, target) <= 2);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.random() < 0.5) floatText(target.x + i, target.y + j, '✸', '#ff9f43');
    sfx.play('fire');
    log(`Your fireball bursts over ${hit.length} ${hit.length === 1 ? 'monster' : 'monsters'} for ${dmg} each.`, 'good');
    for (const m of hit) { m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg}`, '#ffd86b'); }
    for (const m of hit) if (m.hp <= 0) killMonster(m);
    player.cooldown = cooldownFor(); endTurn(false); return;
  }
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
  sfx.unlock();
  if (e.key === 'Escape') { closeShop(); if (mapOpen || questsOpen) { mapOpen = false; questsOpen = false; draw(); } return; }
  if (shopOpen) return;
  if (e.key === 'm' || e.key === 'M') { questsOpen = false; toggleMap(); return; }
  if (e.key === 'q' || e.key === 'Q') { mapOpen = false; questsOpen = !questsOpen; draw(); return; }
  if (e.key === 'n' || e.key === 'N') { toggleSound(); return; }
  if (perkChoices) { if (['1', '2', '3'].includes(e.key)) choosePerk(Number(e.key) - 1); return; }
  if (e.key === '1') { e.preventDefault(); useAbility(); return; }
  if ((mapOpen || questsOpen) && KEYS[e.key]) { mapOpen = false; questsOpen = false; }
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
document.getElementById('worldmap')?.addEventListener('click', toggleMap);
document.getElementById('quests')?.addEventListener('click', () => { mapOpen = false; questsOpen = !questsOpen; draw(); });
document.getElementById('ability')?.addEventListener('click', () => { sfx.unlock(); useAbility(); });
// guests pick a class on their first visit; the choice is remembered in this browser
const classPick = document.getElementById('classpick');
function chooseClass(cls) {
  if (!CLASSES[cls]) return;
  player.cls = cls;
  if (player.level === 1 && player.xp === 0) { player.maxHp = CLASSES[cls].hp; player.hp = CLASSES[cls].hp; player.atk = CLASSES[cls].atk; }
  try { localStorage.setItem('dungeon-class', cls); } catch (e) { /* ignore */ }
  if (classPick) classPick.hidden = true;
  const ab = document.getElementById('ability'); if (ab) ab.textContent = `${CLASSES[cls].ability} (1)`;
  log(`You are a ${CLASSES[cls].name}. ${CLASSES[cls].blurb}`, 'good');
  buildLegend(); updateStats(); draw();
}
classPick?.querySelectorAll('[data-class]').forEach((b) => b.addEventListener('click', () => { sfx.unlock(); chooseClass(b.dataset.class); }));
const soundBtn = document.getElementById('sound');
function toggleSound() { const muted = sfx.toggle(); if (soundBtn) soundBtn.textContent = muted ? 'Sound off' : 'Sound on'; log(muted ? 'Sound off.' : 'Sound on.'); }
if (soundBtn) soundBtn.textContent = sfx.muted ? 'Sound off' : 'Sound on';
soundBtn?.addEventListener('click', () => { sfx.unlock(); toggleSound(); });
canvas.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
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
  if (ITEMS.weapons[id]) return `${it.name}${id === player.weapon && player.weaponPlus ? ' +' + player.weaponPlus : ''} (+${it.atk + (id === player.weapon ? player.weaponPlus || 0 : 0)} attack)`;
  if (ITEMS.armor[id]) return `${it.name}${id === player.armor && player.armorPlus ? ' +' + player.armorPlus : ''} (${it.def + (id === player.armor ? player.armorPlus || 0 : 0)} defence)`;
  return `${it.name} (+${it.heal} HP)`;
}
function renderInventory() {
  if (!invBag || !player) return;
  invWeapon.textContent = player.weapon ? itemLabel(player.weapon) : 'Bare hands';
  invArmor.textContent = player.armor ? itemLabel(player.armor) : 'None';
  invBag.innerHTML = '';
  if (!player.bag.length) {
    const li = document.createElement('li'); li.className = 'empty'; li.textContent = `empty (0/${bagSize()})`; invBag.appendChild(li); return;
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
function bagFull() { return player.bag.length >= bagSize(); }
function equip(idx) {
  const id = player.bag[idx];
  const kind = itemKind(id);
  if (kind === 'consumable') return;
  const slot = kind === 'weapon' ? 'weapon' : 'armor';
  player.bag.splice(idx, 1);
  if (player[slot]) player.bag.push(player[slot]);
  if (slot === 'weapon' && player.weaponPlus) { log('Your sharpening stays with the old weapon.'); player.weaponPlus = 0; }
  if (slot === 'armor' && player.armorPlus) { log('Your reinforcement stays with the old armor.'); player.armorPlus = 0; }
  player[slot] = id;
  log(`You equip the ${itemInfo(id).name}.`, 'good');
  updateStats(); renderShop(); draw();
}
function drinkPotion(idx) {
  if (gameOver || !player) return;
  if (idx === undefined) idx = player.bag.findIndex((id) => itemKind(id) === 'consumable');
  if (idx < 0) { log('You have no potions in your bag.'); draw(); return; }
  const it = itemInfo(player.bag[idx]);
  const healed = Math.min(it.heal, player.maxHp - player.hp);
  player.bag.splice(idx, 1);
  player.hp += healed;
  if (player.poison > 0) { player.poison = 0; log('The potion purges the poison.', 'good'); }
  log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
  updateStats(); renderShop(); draw();
}
function dropLoot(m) {
  if (Math.random() > (dungeonDef ? dungeonDef.loot : 0.12) || bagFull()) return;
  if (!dungeonDef) return;   // beasts of the wilds carry nothing
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
  smithy: { title: 'The Smithy', stock: (id, it) => ITEMS.weapons[id] && it.floor <= 5, price: (it) => Math.round(it.price * 0.9), greet: 'The smith wipes his hands. Every blade on the wall is for sale, a tenth off.' },
  armoury: { title: 'The Armoury', stock: (id, it) => ITEMS.armor[id] && it.floor <= 5, price: (it) => Math.round(it.price * 0.9), greet: 'Racks of mail and plate. The armourer names fair prices.' },
  apothecary: { title: 'The Apothecary', stock: (id) => id === 'potion' || id === 'elixir', price: (it) => it.price, greet: 'Shelves of bottles. Potions, and elixirs for the desperate.' },
  royal: { title: 'The Royal Armoury', stock: () => true, price: (it) => it.price, greet: 'The quartermaster unlocks the cabinet. Everything the realm can forge, at the King\'s prices.' },
};
let shopKind = 'shop';
const buyPrice = (id) => SHOPS[shopKind].price(itemInfo(id));
function openShop(kind = 'shop') {
  if (!shopEl) return;
  tip('shop', 'Buy with the buttons, sell anything at half price. Smithies and armouries also sharpen and reinforce what you wear.');
  shopKind = kind; shopOpen = true; shopEl.hidden = false;
  document.querySelector('#shop h2').textContent = SHOPS[kind].title;
  log(SHOPS[kind].greet);
  renderShop();
}
function closeShop() { if (!shopEl) return; shopOpen = false; shopEl.hidden = true; }
const UPGRADE_COST = (plus) => 100 * (plus + 1) + 50 * plus;
function upgradeRow(slot) {
  const id = player[slot], plus = slot === 'weapon' ? (player.weaponPlus || 0) : (player.armorPlus || 0);
  const li = document.createElement('li');
  if (!id) { li.className = 'empty'; li.textContent = slot === 'weapon' ? 'Equip a weapon to have it sharpened' : 'Equip armor to have it reinforced'; return li; }
  const btn = document.createElement('button'); btn.type = 'button';
  if (plus >= 3) { li.append(`${itemInfo(id).name} +${plus} is as good as it gets`); li.className = 'empty'; return li; }
  const cost = UPGRADE_COST(plus);
  btn.textContent = `${slot === 'weapon' ? 'Sharpen' : 'Reinforce'} ${cost}g`;
  btn.disabled = player.gold < cost;
  btn.addEventListener('click', () => {
    if (player.gold < cost) return;
    player.gold -= cost;
    if (slot === 'weapon') player.weaponPlus = plus + 1; else player.armorPlus = plus + 1;
    log(`${itemInfo(id).name} is now +${plus + 1}.`, 'good'); sfx.play('chest');
    updateStats(); renderShop(); draw();
  });
  li.append(`${itemInfo(id).name} +${plus} → +${plus + 1} (${slot === 'weapon' ? '+1 attack' : '+1 defence'})`, btn);
  return li;
}
function renderShop() {
  if (!shopOpen) return;
  shopGold.textContent = `${player.gold} gold`;
  shopBuy.innerHTML = '';
  if (shopKind === 'smithy' || shopKind === 'royal') shopBuy.appendChild(upgradeRow('weapon'));
  if (shopKind === 'armoury' || shopKind === 'royal') shopBuy.appendChild(upgradeRow('armor'));
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
  const it = itemInfo(id), price = buyPrice(id);
  if (player.gold < price || bagFull()) return;
  player.gold -= price; player.bag.push(id);
  log(`You buy a ${it.name} for ${price} gold.`, 'good');
  updateStats(); renderShop(); draw();
}
function sell(o) {
  const price = sellPrice(o.id);
  if (typeof o.where === 'string') { player[o.where] = null; if (o.where === 'weapon') player.weaponPlus = 0; else player.armorPlus = 0; } else player.bag.splice(o.where, 1);
  player.gold += price;
  if (player.gold >= 1000) unlock('rich');
  log(`You sell the ${itemInfo(o.id).name} for ${price} gold.`, 'good');
  updateStats(); renderShop(); draw();
}
document.getElementById('shop-close')?.addEventListener('click', closeShop);

// ---------- setup ----------
function afterSceneChange() {
  bubble = null; closeShop(); clearInspect(); floats.length = 0; mapOpen = false;
  settle(player); for (const n of npcs) settle(n);
  updateCamera(); updateVisibility(); buildLegend(); updateStats(); draw();
}
function startRun(saved) {
  player = { x: 1, y: 1, hp: 24, maxHp: 24, atk: 3, level: 1, xp: 0, gold: 0, weapon: null, armor: null, bag: [], quests: [], questsDone: 0, cls: 'warrior', cooldown: 0, shield: 0, poison: 0,
    perks: [], achievements: [], title: null, meta: { visited: [], second_wind: false }, weaponPlus: 0, armorPlus: 0, lifetimeKills: 0, pendingPerks: 0 };
  questsOpen = false; mapOpen = false; revealedTraps = new Set(); perkChoices = null; toast = null;
  floor = TOWN; interior = null; gameOver = false; turn = 0; kills = 0;
  overlay.classList.remove('show');
  logEl.innerHTML = ''; messages.length = 0;
  if (saved) {
    floor = saved.floor || TOWN;
    Object.assign(player, { hp: saved.hp, maxHp: saved.max_hp, atk: saved.atk, level: saved.level, xp: saved.xp, gold: saved.gold,
      weapon: itemInfo(saved.weapon) ? saved.weapon : null, armor: itemInfo(saved.armor) ? saved.armor : null,
      bag: (saved.bag || []).filter(itemInfo).slice(0, ITEMS.bag_size),
      quests: Array.isArray(saved.quests) ? saved.quests.filter((q) => q && q.id && q.kind && q.label).slice(-12) : [],
      questsDone: saved.quests_done || 0, cls: CLASSES[saved.class] ? saved.class : 'warrior',
      perks: Array.isArray(saved.perks) ? saved.perks.filter((id) => PERKS[id]) : [],
      achievements: Array.isArray(saved.achievements) ? saved.achievements.filter((id) => ACHIEVEMENTS[id]) : [],
      title: saved.title || null, lifetimeKills: saved.kills || 0,
      meta: { visited: Array.isArray(saved.meta?.visited) ? saved.meta.visited : [], second_wind: !!saved.meta?.second_wind },
      weaponPlus: saved.weapon_plus || 0, armorPlus: saved.armor_plus || 0 });
    // heroes made before classes existed start with the warrior's numbers; fresh heroes take their class's
    if (player.level === 1 && player.xp === 0 && player.maxHp === 20) { player.maxHp = heroClass().hp; player.hp = Math.min(player.hp + heroClass().hp - 20, heroClass().hp); player.atk = heroClass().atk; }
  } else {
    let remembered = null; try { remembered = localStorage.getItem('dungeon-class'); } catch (e) { /* ignore */ }
    if (CLASSES[remembered]) { player.cls = remembered; player.maxHp = CLASSES[remembered].hp; player.hp = player.maxHp; player.atk = CLASSES[remembered].atk; }
    else if (classPick) classPick.hidden = false;
  }
  { const ab = document.getElementById('ability'); if (ab) ab.textContent = `${heroClass().ability} (1)`; }
  tip('start', 'Arrow keys or WASD to move. Walk into people to talk, into doors to enter. The green gate at the bottom of the square leads into the dungeon.');
  if (saved && saved.home && /^-?\d+,-?\d+$/.test(saved.home)) homeTown = saved.home;
  if (floor === TOWN) {
    createWorld();
    const t = townAt(...homeTown.split(',').map(Number)) || townAt(0, 0);
    homeTown = t.key;
    if (saved && Number.isInteger(saved.wx) && Number.isInteger(saved.wy) && walkable(getTile(saved.wx, saved.wy))) { player.x = saved.wx; player.y = saved.wy; }
    else { player.x = t.spawn.x; player.y = t.spawn.y; }
    player.wx = player.x; player.wy = player.y; settle(player); refreshTownContext();
  } else {
    // back underground: the site whose entrance we saved, or the home town's gate
    const site = saved && Number.isInteger(saved.wx) ? siteAtTile(saved.wx, saved.wy) : null;
    dungeonDef = site ? siteDungeon(site) : townDungeon(townAt(...homeTown.split(',').map(Number)) || townAt(0, 0));
    createDungeon();
  }
  afterSceneChange();
  if (saved && saved.guest) log(`You wake at the inn with ${player.gold} gold, your gear and your level. The dungeon is still there.`, 'good');
  else if (saved && saved.floor > 0) log(`Welcome back, ${saved.name}. You resume on floor ${floor}. Follow the compass to the stairs.`, 'good');
  else if (saved && saved.level > 1) log(`Welcome back, ${saved.name}. ${townContaining(player.x, player.y) ? 'You are in ' + townContaining(player.x, player.y).name + '.' : 'You are out in the wilds.'} Roads lead to other towns.`, 'good');
  else log(`${saved ? saved.name + ' arrives' : 'You arrive'} in Hearth. Step onto a house door to go inside, take the gate at the bottom into the dungeon, or follow a road to the next town.`);
}
let starting = false;
async function init() {
  if (starting) return;
  starting = true;
  try {
    const saved = await loadProgress();
    const respawn = guestRespawn; guestRespawn = null;
    startRun(saved || respawn);
  } finally { starting = false; }
}
function loop() { if (!gameOver) draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
init();
