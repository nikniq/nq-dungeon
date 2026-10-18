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

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2, SHOP: 3, INN: 4, FOUNTAIN: 5, DOOR: 6, FURNITURE: 7, BED: 8, SITE: 9, CHEST: 10, TRAP: 11, WAYSTONE: 12, LAVA: 13, PLACE: 14, WAYOUT: 15, CRACK: 16, SPRING: 17, MONUMENT: 18 };
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
  { name: 'Slime',    sprite: 'slime',    hp: 10, atk: 2, xp: 6,  minFloor: 2, splits: true },
  { name: 'Necromancer', sprite: 'necromancer', hp: 9, atk: 2, xp: 18, minFloor: 4, raiser: true },
  { name: 'Mimic',    sprite: 'mimic',    hp: 14, atk: 4, xp: 20, minFloor: 99, noSpawn: true },
  { name: 'Knight',   sprite: 'darkknight', hp: 16, atk: 5, xp: 24, minFloor: 99, noSpawn: true },
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
  traveller:   { label: 'Travelled by waystone', title: 'the Wanderer' },
  good_dog:    { label: 'Your hound made ten kills', title: 'Houndmaster' },
  elite:       { label: 'Slew an elite monster', title: 'the Undaunted' },
  fellowship:  { label: 'Joined a party', title: 'the Companion' },
  naturalist:  { label: 'Slew every kind of monster', title: 'the Naturalist' },
  wanderer10:  { label: 'Discovered ten places', title: 'the Pathfinder' },
  collector:   { label: 'Found five treasures', title: 'the Treasure-seeker' },
  crownbearer: { label: 'Restored the Crown of Aurum', title: 'Crownbearer' },
  rider:       { label: 'Bought a horse', title: 'the Rider' },
  champion:    { label: 'Survived ten waves in the Grand Arena', title: 'Champion of Aurum' },
  four_realms: { label: 'Finished every realm questline', title: 'Friend of Four Realms' },
  abyss10:     { label: 'Reached floor 10 of the Deep', title: 'the Deepwalker' },
  abyss25:     { label: 'Reached floor 25 of the Deep', title: 'Lord of the Deep' },
  wayfarer:    { label: 'Met ten strangers on the road', title: 'the Wayfarer' },
  vault:       { label: 'Broke into a secret vault', title: 'the Delver of Secrets' },
  squire:      { label: 'Became a Squire of Aurum', title: 'the Squire' },
  knighted:    { label: 'Knighted by the King', title: 'Knight of Aurum' },
  baron:       { label: 'Bought a barony', title: 'Baron of Aurum' },
  civic:       { label: 'Became a Hero of the Cantons', title: 'Hero of the Cantons' },
  clansworn:   { label: 'Swore the clan oath', title: 'Clan-sworn' },
  guild:       { label: 'Joined the Merchants\' Guild', title: 'the Guildsman' },
  banker:      { label: 'Banked five thousand gold', title: 'the Magnate' },
};
function unlock(id) {
  if (!player || !ACHIEVEMENTS[id] || player.achievements.includes(id)) return;
  player.achievements.push(id);
  player.title = ACHIEVEMENTS[id].title;
  log(`Achievement: ${ACHIEVEMENTS[id].label}. You are now ${player.title}.`, 'good');
  track('unlock_achievement', { achievement_id: id });
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
// Each dungeon floor has a look (and lava floors a hazard). Story sites and site
// types pick their own; town dungeons get darker as you descend.
const THEMES = {
  stone:   { name: 'Stone halls',     floor: ['#1d4a60', '#1b4458', '#1f4e66'], face: '#2e3f53', cap: '#4c637c', capHi: '#5f7a95', bricks: ['#3a4f66', '#36495f', '#3f566f', '#33465b'], top: ['#202d3c', '#1d2937'], rim: '#34465a', moss: 0.08, bones: 0.03 },
  moss:    { name: 'Mossy caves',     floor: ['#1f4a3a', '#1c4434', '#22503f'], face: '#2d4636', cap: '#4f7a58', capHi: '#64946c', bricks: ['#3a5a44', '#36543f', '#3f604a', '#33503c'], top: ['#1d2e25', '#1a2a22'], rim: '#33503f', moss: 0.35, bones: 0.02 },
  flooded: { name: 'Flooded halls',   floor: ['#173f60', '#163a58', '#1a4468'], face: '#2b3e58', cap: '#4a6a8c', capHi: '#5c80a6', bricks: ['#34506c', '#304a66', '#385673', '#2e4660'], top: ['#1b2a3c', '#192737'], rim: '#33475f', moss: 0.05, bones: 0.02, puddles: true },
  bone:    { name: 'Bone crypts',     floor: ['#34343e', '#30303a', '#383844'], face: '#3b3b48', cap: '#5d5d6e', capHi: '#73738a', bricks: ['#45455a', '#404052', '#4a4a5e', '#3c3c4e'], top: ['#22222b', '#1f1f28'], rim: '#40404f', moss: 0.03, bones: 0.1 },
  lava:    { name: 'Ember deeps',     floor: ['#3a2622', '#35231f', '#402a25'], face: '#3d2a26', cap: '#6b3a2a', capHi: '#8a4a34', bricks: ['#4a302a', '#452c26', '#50342d', '#402924'], top: ['#241815', '#211613'], rim: '#4a2f28', moss: 0, bones: 0.04, lava: true },
  arcane:  { name: 'Arcane halls',    floor: ['#2c2452', '#28214c', '#30285a'], face: '#352c5c', cap: '#5a4a8c', capHi: '#7563b0', bricks: ['#41356c', '#3c3166', '#463a73', '#382e60'], top: ['#1e1936', '#1b1631'], rim: '#3d3366', moss: 0, bones: 0.02, runes: true },
};
let theme = 'stone';
const thm = () => THEMES[theme] || THEMES.stone;
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
const walkable = (t) => t !== TILE.WALL && t !== TILE.FOUNTAIN && t !== TILE.FURNITURE && t !== TILE.CHEST && t !== TILE.WAYSTONE && t !== TILE.PLACE && t !== TILE.WAYOUT && t !== TILE.CRACK && t !== TILE.SPRING && t !== TILE.MONUMENT;
const hazard = (x, y) => getTile(x, y) === TILE.LAVA || (getTile(x, y) === TILE.TRAP && revealedTraps.has(key(x, y)));

// ---------- account save/load ----------
const ACCOUNT = window.DUNGEON || { user: false };
const ITEMS = ACCOUNT.items || { weapons: {}, armor: {}, consumables: {}, bag_size: 12 };
ITEMS.relics = ITEMS.relics || {};
const itemInfo = (id) => ITEMS.weapons[id] || ITEMS.armor[id] || ITEMS.consumables[id] || ITEMS.relics[id] || null;
const itemKind = (id) => ITEMS.weapons[id] ? 'weapon' : ITEMS.armor[id] ? 'armor' : ITEMS.relics[id] ? 'relic' : 'consumable';
// The relic you wear changes how you play; see config/items.php for the list.
const wearing = (id) => !!player && player.relic === id;
const goldMult = () => (perkCount('lucky') ? 1.25 : 1) * (wearing('luckycoin') ? 1.4 : 1) * (wearing('ledger') ? 1.25 : 1);
const potionHeal = (h) => h * (wearing('royalsignet') ? 2 : 1);
const weaponAtk = () => ((player.weapon && ITEMS.weapons[player.weapon]) ? ITEMS.weapons[player.weapon].atk + (player.weaponPlus || 0) : 0) + (wearing('emberbrand') ? 2 : 0) + (wearing('crown') ? 2 : 0) + ((player.meta && player.meta.blessing && player.meta.blessing.turns > 0) ? (player.meta.blessing.atk || 0) : 0) + (realmState().rank >= 3 ? 1 : 0) + (wearing('bloodtorc') && player.hp <= player.maxHp / 2 ? 3 : 0);
const armorDef = () => ((player.armor && ITEMS.armor[player.armor]) ? ITEMS.armor[player.armor].def + (player.armorPlus || 0) : 0) + perkCount('thick_skin') + (wearing('bonecharm') ? 2 : 0) + (wearing('crown') ? 2 : 0)
  + ((player.meta && player.meta.blessing && player.meta.blessing.turns > 0) ? (player.meta.blessing.def || 0) : 0) + (realmState().rank >= 2 ? 1 : 0);
const SAVE_EVERY_TURNS = 20;
// What the hero has bought into in each realm: noble rank in Aurum, civic
// standing in the Cantons, a clan oath with the Clans, a League guild seat and bank account.
const realmState = () => (player && player.meta) ? (player.meta.realm || (player.meta.realm = { rank: 0, standing: 0, oath: false, guild: false, bank: 0 })) : { rank: 0, standing: 0, oath: false, guild: false, bank: 0 };

async function saveProgress(event, keepalive = false) {
  if (!ACCOUNT.user || !player) return;
  try {
    const res = await fetch(ACCOUNT.saveUrl, {
      method: 'POST', keepalive, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf },
      body: JSON.stringify({ event, floor: dungeonDef && dungeonDef.arena ? 0 : floor, level: player.level, xp: player.xp, gold: player.gold,
        hp: player.hp, max_hp: player.maxHp, atk: player.atk, kills, weapon: player.weapon, armor: player.armor, bag: player.bag,
        wx: player.wx ?? 20, wy: player.wy ?? 21, home: homeTown,
        quests: (player.quests || []).slice(-12).map((q) => ({ id: q.id, kind: q.kind, label: q.label, need: q.need, have: q.have, done: !!q.done, target: q.target, giver: q.giver, reward: q.reward })),
        quests_done: player.questsDone || 0, class: player.cls,
        perks: player.perks, achievements: player.achievements, title: player.title || null,
        meta: { visited: player.meta.visited.slice(-80), second_wind: !!player.meta.second_wind, hound: houndState(),
          story: story(), places: player.meta.places.slice(-400), looted: player.meta.looted.slice(-400), found: player.meta.found,
          bestiary: player.meta.bestiary || {}, blessing: player.meta.blessing && player.meta.blessing.turns > 0 ? player.meta.blessing : null, realm: realmState(), encounters: player.meta.encounters || 0,
          room: !!player.meta.room, stash: stash(), deepest: player.meta.deepest || 0, rq: player.meta.rq || {}, horse: !!player.meta.horse, arena: player.meta.arena || 0 },
        relic: player.relic || null,
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

// ---------- analytics ----------
// Sends a Google Analytics event when the page loaded the tag; a no-op otherwise.
function track(name, params = {}) {
  try { if (typeof window.gtag === 'function') window.gtag('event', name, { hero_class: player && player.cls, hero_level: player && player.level, ...params }); } catch (e) { /* never let analytics break play */ }
}

// ---------- multiplayer ----------
// Logged-in heroes post where they are every few hundred milliseconds and get
// back who else shares their space (the open world, a building, or a party's
// dungeon run) plus chat and combat messages. In a shared dungeon every client
// digs the same floor from the same seed; the hero who has been inside longest
// runs the monsters and posts a snapshot that the others follow.
const mp = {
  on: !!ACCOUNT.user && ACCOUNT.multiplayer !== false, me: null, cursor: null, entered: 0, players: new Map(), outbox: [], busy: false, timer: null,
  interval: 1500, party: null, invites: [], instance: null, hostId: null, dead: new Set(), graveyard: new Map(), bubbles: new Map(), target: null,
};
let entering = false;
async function mpApi(path, body) {
  const res = await fetch(path, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || `HTTP ${res.status}`), { status: res.status });
  return data;
}
function mpSpace() {
  if (gameOver || !player) return `limbo:${mp.me || 0}`;
  if (scene === 'house' && interior) return `house:${interior.house.town}:${interior.house.id}`;
  if (scene === 'dungeon') return mp.instance ? mp.instance.space : `solo:${mp.me || 0}`;
  return 'world';
}
function mpWhere() {
  if (scene === 'house' && interior) return interior.house.name;
  if (scene === 'dungeon') return `${dungeonDef ? dungeonDef.name : 'a dungeon'}, floor ${floor}`;
  return townContaining(player.x, player.y)?.name ?? 'the wilds';
}
// Heroes I can see: same space, and in a dungeon, the same floor.
const mpHere = () => [...mp.players.values()].filter((o) => scene !== 'dungeon' || o.data.floor === floor);
const mpPlayerAt = (x, y) => mpHere().find((o) => o.x === x && o.y === y) || null;
const inMyParty = (id) => !!mp.party && mp.party.members.some((m) => m.id === id);
const coopActive = () => scene === 'dungeon' && !!mp.instance && mp.instance.shared && mpHere().length > 0;
const coopHost = () => coopActive() && mp.hostId === mp.me;
const coopMember = () => coopActive() && mp.hostId !== mp.me;
function mpSend(ev) { if (mp.on) mp.outbox.push(ev); }
function mpKick() { if (!mp.on) return; clearTimeout(mp.timer); mp.timer = setTimeout(mpTick, 30); }
function mpStart() { if (!mp.on || mp.started) return; mp.started = true; mpTick(); setInterval(coopTick, 650); }
async function mpTick() {
  if (mp.busy) { mp.timer = setTimeout(mpTick, 120); return; }
  mp.busy = true;
  try { await mpSync(); } catch (e) { /* the next tick tries again */ }
  mp.busy = false;
  // fast when others are around, slow when alone, slower still when idle, paused when hidden
  const idle = performance.now() - (mp.lastActive || 0) > 20000;
  mp.interval = document.hidden ? 15000 : mpHere().length ? (scene === 'dungeon' ? 400 : 650) : idle ? 4000 : 1500;
  mp.timer = setTimeout(mpTick, mp.interval);
}
async function mpSync() {
  if (!player) return;
  const events = mp.outbox.splice(0, 40);
  const body = {
    space: mpSpace(), x: player.x, y: player.y,
    me: { face: player.face || 1, hp: player.hp, maxHp: player.maxHp, level: player.level, cls: player.cls, look: { w: player.weapon || null, a: player.armor || null, r: player.relic || null }, def: armorDef(), shield: player.shield || 0,
      floor, scene, where: mpWhere(), title: player.title || null,
      hound: hound && !hound.down && scene !== 'house' ? { x: hound.x, y: hound.y, face: hound.face || 1 } : null },
    state: coopHost() ? hostState() : null,
    events,
  };
  if (mp.cursor !== null) body.since = mp.cursor;
  let res;
  try { res = await mpApi(ACCOUNT.mpUrl + '/sync', body); }
  catch (e) { mp.outbox.unshift(...events.filter((ev) => ev.type === 'chat')); throw e; }
  mp.me = res.me; mp.cursor = res.cursor; mp.entered = res.entered;
  const seen = new Set();
  for (const p of res.players) {
    seen.add(p.id);
    const o = mp.players.get(p.id) || { id: p.id, rx: p.x, ry: p.y };
    if (o.x !== undefined && o.x !== p.x) o.face = Math.sign(p.x - o.x);
    if (Math.abs((o.rx ?? p.x) - p.x) > 4 || Math.abs((o.ry ?? p.y) - p.y) > 4) { o.rx = p.x; o.ry = p.y; }
    Object.assign(o, { x: p.x, y: p.y, data: p.data || {}, entered: p.entered, state: p.state });
    if (o.data.hound) { const h = o.hound || { rx: o.data.hound.x, ry: o.data.hound.y }; o.hound = Object.assign(h, o.data.hound); } else o.hound = null;
    mp.players.set(p.id, o);
  }
  for (const id of [...mp.players.keys()]) if (!seen.has(id)) mp.players.delete(id);
  const hadParty = !!mp.party;
  mp.party = res.party;
  if (!hadParty && mp.party) unlock('fellowship');
  for (const ev of res.events) mpEvent(ev);
  // whoever has been in this dungeon run longest runs the monsters
  const here = mpHere();
  let host = { id: mp.me, entered: mp.entered };
  for (const o of here) if (o.entered < host.entered || (o.entered === host.entered && o.id < host.id)) host = o;
  mp.hostId = host.id;
  if (coopMember()) { const h = mp.players.get(mp.hostId); if (h && h.state) applyHostState(h.state); }
  renderParty();
  monstersDirty = true;
}
function mpEvent(ev) {
  const p = ev.payload || {}, name = p.name || 'Someone';
  const known = mp.players.get(ev.from);
  if (ev.type === 'chat') {
    if (mpSpace() === 'world' && !known) return;   // out of earshot
    log(`${name}: ${p.text}`, 'chat');
    mp.bubbles.set(ev.from, { text: p.text, until: performance.now() + 5000 });
  } else if (ev.type === 'wave') {
    log(`${name} waves at you.`, 'chat');
    mp.bubbles.set(ev.from, { text: '*waves*', until: performance.now() + 3000 });
  } else if (ev.type === 'invite') {
    mp.invites = mp.invites.filter((i) => i.from !== ev.from).concat({ from: ev.from, name, at: Date.now() });
    log(`${name} invites you to their party. Press Y or use the party panel to accept.`, 'good');
    sfx.play('quest');
  } else if (ev.type === 'party') {
    log(p.text, 'chat');
  } else if (ev.type === 'hit') {
    if (coopHost() || (scene === 'dungeon' && mp.instance)) coopReceiveHit(ev.from, p);
  } else if (ev.type === 'killed') {
    coopKilled(p);
  } else if (ev.type === 'attack') {
    coopAttacked(p);
  } else if (ev.type === 'stairs') {
    if (scene === 'dungeon' && mp.instance && !bossAlive()) { log(`${name} leads the party down the stairs.`, 'good'); nextFloor(); }
  } else if (ev.type === 'floor') {
    if (scene === 'dungeon' && mp.instance && p.floor > floor) memberFollowFloor(p.floor);
  } else if (ev.type === 'escape') {
    if (scene === 'dungeon' && mp.instance && dungeonDef) { log(`${name} leads the party out of the ${dungeonDef.name}.`, 'good'); floor = dungeonDef.floors; nextFloor(); }
  }
}
// The snapshot the host shares: monsters near any hero, and everything that has died on this floor.
function hostState() {
  const heroes = [player, ...mpHere()];
  const mobs = [];
  for (const m of monsters) {
    if (!m.id || !heroes.some((h) => cheb(m, h) <= 36)) continue;
    mobs.push([m.id, m.x, m.y, m.hp, m.maxHp, m.awake ? 1 : 0, m.face || 0]);
  }
  return { floor, mobs, dead: [...mp.dead].slice(-500) };
}
const monsterById = (id) => monsters.find((m) => m.id === id);
function removeQuietly(m) {
  monsters = monsters.filter((x) => x !== m); monstersDirty = true;
  mp.graveyard.set(m.id, m); mp.dead.add(m.id);
  burst(m.x, m.y, '#9ca3af', 10, 60, { gravity: -40, life: 600, size: 4 });
}
function applyHostState(st) {
  if (!st || st.floor !== floor) { if (st && st.floor > floor) memberFollowFloor(st.floor); return; }
  for (const id of st.dead || []) { if (mp.dead.has(id)) continue; const m = monsterById(id); if (m) removeQuietly(m); else mp.dead.add(id); }
  for (const [id, x, y, hp, maxHp, aw, face] of st.mobs || []) {
    const m = monsterById(id);
    if (!m) continue;
    if (m.x !== x || m.y !== y) { m.face = face || Math.sign(x - m.x) || m.face; m.x = x; m.y = y; }
    m.hp = hp; m.maxHp = maxHp; m.awake = !!aw;
  }
  monstersDirty = true;
}
function memberFollowFloor(f) {
  if (!dungeonDef) return;
  if (f > dungeonDef.floors) { floor = dungeonDef.floors; nextFloor(); return; }
  floor = f - 1; nextFloor();
}
// A party member's blow: shown at once, settled by the host.
function coopHit(m, dmg, src) { mpSend({ to: mp.hostId, type: 'hit', payload: { id: m.id, dmg, src } }); mpKick(); }
function coopReceiveHit(from, p) {
  const m = monsterById(p.id);
  if (!m) return;
  m.hp -= p.dmg; m.awake = true; m.flashUntil = performance.now() + 120;
  floatText(m.x, m.y, `-${p.dmg}`, '#e9c48a');
  if (m.hp > 0) return;
  if (m.mod === 'explosive') {
    burst(m.x, m.y, '#ff9f43', 30, 170, { glow: true, life: 600, size: 3 });
    if (cheb(m, player) <= 1) { const blast = 3 + floor; player.hp -= blast; floatText(player.x, player.y, `-${blast}`, '#ff6b6b'); if (player.hp <= 0) die(); }
  }
  if (m.boss) log(`${p.name || 'Your ally'} slays ${m.name}! The seal on the stairs breaks.`, 'good');
  removeQuietly(m);
  mpSend({ to: from, type: 'killed', payload: { id: m.id, src: p.src } }); mpKick();
}
function coopKilled(p) {
  const m = monsterById(p.id) || mp.graveyard.get(p.id);
  if (!m || m.rewarded) return;
  m.rewarded = true;
  if (p.src === 'hound' && hound) houndScored();
  killMonster(m);
}
function coopAttacked(p) {
  if (gameOver || !player) return;
  const local = monsterById(p.id);
  const type = (local && local.type) || MONSTER_TYPES.find((t) => t.name === p.type) || MONSTER_TYPES[0];
  const m = local || { x: player.x + 1, y: player.y, type, hp: 1, maxHp: 1 };
  monsterAttack({ ...m, atk: p.atk, type, name: m.name, boss: m.boss, mod: m.mod }, !!p.ranged);
  if (local) local.lunge = { dx: Math.sign(player.x - local.x), dy: Math.sign(player.y - local.y), until: performance.now() + 140 };
  updateStats();
  if (player.hp <= 0) die();
  draw();
}
// The host moves the monsters on a steady beat while the party is together.
function coopTick() {
  if (!coopHost() || gameOver || !player) return;
  const heroes = [{ x: player.x, y: player.y, me: true }];
  for (const o of mpHere()) {
    heroes.push({ x: o.x, y: o.y, id: o.id, def: o.data.def || 0 });
    const cx = Math.floor(o.x / CHUNK), cy = Math.floor(o.y / CHUNK);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) getChunk(cx + dx, cy + dy);
  }
  stepMonsters(false, heroes);
  if (monsters.some((m) => m.mod === 'swift' && m.awake)) stepMonsters(true, heroes);
  updateVisibility(); updateStats();
  if (player.hp <= 0) die();
  draw();
}
async function enterDungeon(dkey) {
  entering = true;
  mp.instance = null;
  if (mp.on) {
    try {
      const r = await mpApi(ACCOUNT.mpUrl + '/enter', { dungeon: dkey });
      mp.instance = { space: r.space, seed: r.seed, shared: r.shared };
      floor = Math.max(0, r.floor - 1);
    } catch (e) { mp.instance = null; }
  }
  entering = false;
  const joining = mp.instance && mp.instance.shared && floor > 0;
  nextFloor();
  if (mp.instance && mp.instance.shared) log(joining ? `You rejoin your party on floor ${floor}.` : 'Your party can follow you down this same gate.', 'good');
  mpKick();
}
function openPlayerMenu(o) { mp.target = o; openShop('player'); }
function renderParty() {
  const el = document.getElementById('party');
  if (!el) return;
  const nearby = mpHere().length;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let html = `<div class="party-head"><b>Party</b> <span class="muted">${nearby ? `${nearby} ${nearby === 1 ? 'hero' : 'heroes'} nearby` : 'No other heroes nearby'}</span>`;
  if (mp.party) html += ` <button type="button" id="party-leave">Leave party</button>`;
  html += '</div>';
  if (mp.party) {
    html += '<ul class="party-list">' + mp.party.members.map((m) => `<li><span class="dot ${m.online ? 'on' : ''}"></span>${esc(m.name)}${m.id === mp.party.leader ? ' ♛' : ''} <span class="muted">Lv ${m.level} ${esc(m.cls)}${m.where ? ' · ' + esc(m.where) : ''}${m.id === mp.me ? ' (you)' : ''}</span></li>`).join('') + '</ul>';
    html += '<p class="muted small">Take the same gate or site entrance as your party to share the dungeon. Stairs take everyone down together.</p>';
  } else {
    html += '<p class="muted small">Walk into another hero to invite them to a party of up to four.</p>';
  }
  for (const i of mp.invites.filter((i) => Date.now() - i.at < 110000)) {
    html += `<div class="invite">${esc(i.name)} invites you to their party <button type="button" data-accept="${i.from}" class="primary">Accept (Y)</button> <button type="button" data-decline="${i.from}">Decline</button></div>`;
  }
  if (el.innerHTML !== html) {
    el.innerHTML = html;
    el.querySelector('#party-leave')?.addEventListener('click', async () => { try { await mpApi(ACCOUNT.mpUrl + '/leave'); mp.party = null; log('You left the party.'); renderParty(); } catch (e) { log(e.message, 'bad'); } });
    el.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => acceptInvite(Number(b.dataset.accept))));
    el.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', () => { mp.invites = mp.invites.filter((i) => i.from !== Number(b.dataset.decline)); renderParty(); }));
  }
}
async function acceptInvite(from) {
  const inv = from ? mp.invites.find((i) => i.from === from) : mp.invites[mp.invites.length - 1];
  if (!inv) return;
  try {
    const r = await mpApi(ACCOUNT.mpUrl + '/accept', { from: inv.from });
    mp.party = r.party; mp.invites = mp.invites.filter((i) => i.from !== inv.from);
    log(`You joined ${inv.name}'s party.`, 'good'); sfx.play('quest'); unlock('fellowship'); track('join_group', { group_id: String(r.party.id) });
  } catch (e) { log(e.message, 'bad'); mp.invites = mp.invites.filter((i) => i.from !== inv.from); }
  renderParty(); mpKick();
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
const ELITE_MODS = {
  armored:   { label: 'Armored',   color: '#cbd5e1', desc: 'takes 2 less damage from blows' },
  swift:     { label: 'Swift',     color: '#7bdfff', desc: 'acts twice a turn' },
  vampiric:  { label: 'Vampiric',  color: '#ff6b9b', desc: 'heals when it hits' },
  explosive: { label: 'Explosive', color: '#ff9f43', desc: 'bursts when slain' },
};
function makeElite(m, roll) {
  const ids = Object.keys(ELITE_MODS), id = ids[Math.floor(roll * ids.length) % ids.length];
  m.mod = id; m.elite = true; m.name = `${ELITE_MODS[id].label} ${m.type.name}`;
  m.hp = m.maxHp = Math.round(m.maxHp * 1.6);
}
const BOSS_NAMES = { Rat: 'the Rat King', Goblin: 'the Goblin Chieftain', Skeleton: 'the Bone Lord', Orc: 'the Orc Warchief', Wraith: 'the Lich', Bat: 'the Bat Matriarch', Spider: 'the Brood Mother', Archer: 'the Goblin Marksman', Slime: 'the Slime Queen', Necromancer: 'the Necromancer Lord' };
function placeBoss(room, ox, oy, R = Math.random) {
  const def = dungeonDef || { pool: null, danger: 0 };
  const pool = def.pool || MONSTER_TYPES.filter((t) => !t.noSpawn && t.minFloor <= floor);
  const type = def.boss ? MONSTER_TYPES.find((t) => t.name === def.boss.type) : pool.reduce((a, b) => (b.xp > a.xp ? b : a));
  const danger = def.danger || 0;
  const cells = [];
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
    const wx = ox + x, wy = oy + y;
    if (getTile(wx, wy) === TILE.FLOOR && !getMonsterAt(wx, wy) && dist({ x: wx, y: wy }, exit) <= 2) cells.push({ x: wx, y: wy });
  }
  const cell = cells[Math.floor(R() * cells.length)] || { x: exit.x + 1, y: exit.y };
  if (getTile(cell.x, cell.y) === TILE.WALL) setTile(cell.x, cell.y, TILE.FLOOR);
  const hp = type.hp * (def.boss ? 5 : 4) + danger * 4 + floor * 2;
  monsters.push({ ...cell, id: 'boss', type, name: def.boss ? def.boss.name : BOSS_NAMES[type.name], yields: !!(def.boss && def.boss.yields), hp, maxHp: hp, atk: type.atk + 1 + Math.ceil(danger / 2), awake: false, boss: true });
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
      .filter((st) => !st.deep && !(st.story && !storySiteOpen(st.story)) && !have.has('clear:' + st.key) && !done.has('clear:' + st.key))
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
      track('quest_complete', { kind: q.kind, reward: q.reward });
      floatText(player.x, player.y, `+${q.reward}g`, '#f5c542');
      sfx.play('quest');
    } else if (kind === 'slay') log(`${q.have}/${q.need} ${target.toLowerCase()}s slain for ${q.giver}.`);
  }
  // keep the list short: finished quests fall off after a while
  const done = player.quests.filter((q) => q.done);
  if (done.length > 6) player.quests.splice(player.quests.indexOf(done[0]), 1);
}
let questsOpen = false;
let lastRealm = null, lastTownKey = null;
let journalOpen = false, journalTab = 0;
const JOURNAL_TABS = ['Story', 'Places', 'Treasures', 'Bestiary', 'World'];
const MONSTER_LORE = {
  Rat: 'Fat, bold and everywhere. Where there are dungeons there are rats, and where there are rats there is something worse further down.',
  Goblin: 'Small, quick and greedy. They rob the dead, and do not always wait for them to be dead.',
  Skeleton: 'The restless dead of older wars. They remember how to fight, and nothing else.',
  Orc: 'Brutes from the deep halls. An orc that can count to ten is called a warchief.',
  Wraith: 'What is left when hate outlives the body. Cold to the touch and quick to anger.',
  Bat: 'They flit and bite and flit again. Annoying more than deadly, until there are fifty of them.',
  Spider: 'Patient hunters whose bite carries a poison. Any potion washes it out.',
  Archer: 'Goblins who learned that the safest fight is from a distance. They back away to shoot again.',
  Slime: 'A wobbling heap of hunger. Cut it in half and you have two smaller problems. Cut those, and you are done.',
  Necromancer: 'A robed fool who found a book he should not have. He keeps his distance and raises the dead to fight for him. Kill him first.',
  Knight: 'Sworn swords in black and grey who wear a small silver stag. They serve Prince Edric, and they fight like men with nothing left to lose.',
  Mimic: 'Not every chest wants to be opened. Some want to open you. Mimics pay well, if you live.',
};
function journalKey(e) {
  if (['j', 'J', 'Escape'].includes(e.key)) journalOpen = false;
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') journalTab = (journalTab + 1) % JOURNAL_TABS.length;
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') journalTab = (journalTab + JOURNAL_TABS.length - 1) % JOURNAL_TABS.length;
  else if (['1', '2', '3', '4', '5'].includes(e.key)) journalTab = Number(e.key) - 1;
  e.preventDefault(); draw();
}
function journalTabRects() { const w = Math.min(122, (canvas.width - 48) / JOURNAL_TABS.length - 6); return JOURNAL_TABS.map((t, i) => ({ x: 24 + i * (w + 6), y: 52, w, h: 30 })); }
function journalClick(px, py) {
  const hit = journalTabRects().findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  if (hit >= 0) journalTab = hit; else if (py < 52) journalOpen = false;
  draw();
}
function wrapText(g, text, x, y, maxW, lh) {
  let line = '', yy = y;
  for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); yy += lh; line = w; } else line = t; }
  if (line) { g.fillText(line, x, yy); yy += lh; }
  return yy;
}
function drawJournal(g) {
  g.fillStyle = 'rgba(6,12,20,0.94)'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillStyle = '#ffd86b'; g.font = 'bold 20px sans-serif'; g.fillText('Journal', 24, 16);
  g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText('J or Esc closes · ← → or 1-5 change page', 120, 22);
  journalTabRects().forEach((r, i) => {
    g.fillStyle = i === journalTab ? '#0b3142' : 'rgba(11,49,66,0.4)'; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 6); g.fill();
    g.fillStyle = i === journalTab ? '#ffd86b' : '#cfe9ff'; g.font = `bold ${r.w < 90 ? 11 : 13}px sans-serif`; g.fillText(r.w < 90 ? JOURNAL_TABS[i] : `${i + 1} ${JOURNAL_TABS[i]}`, r.x + (r.w < 90 ? 6 : 12), r.y + 8);
  });
  const W = canvas.width - 48, X = 24; let y = 100;
  const st = story();
  if (journalTab === 0) {
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText('The Shattered Crown', X, y); y += 26;
    const obj = storyObjective();
    g.fillStyle = '#9ef0b0'; g.font = '13px sans-serif'; y = wrapText(g, obj ? `Now: ${obj.text}.` : 'The crown is whole again. The realms are safe, for now.', X, y, W, 18) + 8;
    const steps = [['The summons', 'Answer King Aldric\'s call at Castle Aurum.', st.phase !== 'summons']];
    STORY_ORDER.forEach((id, i) => { const S = STORY_SITES[id]; const doneShard = i < st.ch || st.phase === 'done' || (i === st.ch && st.phase === 'return'); const known = i < st.ch || (i === st.ch && st.phase !== 'summons') || st.phase === 'done'; steps.push([known ? S.shard : '???', known ? `${S.title}, in ${REALMS[(() => { const st2 = siteAt(S.i, S.j); return realmOfTile(st2.x, st2.y); })()].short}.` : 'Not yet revealed.', doneShard]); });
    steps.push(['The crown restored', 'Bring all five shards to the King.', st.phase === 'done']);
    const clues = STORY_ORDER.filter((id, i) => i < st.ch || st.phase === 'done' || (i === st.ch && st.phase === 'return'));
    if (clues.length) steps.push(['Clues', clues.map((id) => SHARD_CLUE[id].who).join(', ') + (clues.length >= 2 ? '. They all point to Prince Edric.' : '.'), st.phase === 'done']);
    if (st.phase === 'done') steps.push(['The Deep', `The Gate of the Deep lies between Hearth and Castle Aurum. Your record: floor ${player.meta.deepest || 0}.`, (player.meta.deepest || 0) >= 25]);
    for (const [name, desc, done] of steps) {
      g.fillStyle = done ? '#9ef0b0' : '#e6eef8'; g.font = 'bold 14px sans-serif'; g.fillText(`${done ? '✓' : '•'} ${name}`, X, y);
      g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText(desc, X + 22, y + 18); y += 40;
    }
    y += 6; g.fillStyle = '#e6eef8'; g.font = 'bold 15px sans-serif'; g.fillText('The four realms', X, y); y += 24;
    for (const id of REALM_ORDER) {
      const R = REALMS[id];
      g.fillStyle = R.color; g.fillRect(X, y + 3, 10, 10);
      g.fillStyle = '#e6eef8'; g.font = 'bold 13px sans-serif'; g.fillText(`${R.name} · ${R.gov}`, X + 18, y);
      g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; y = wrapText(g, `${R.blurb} Ruled by ${R.ruler}.`, X + 18, y + 18, W - 18, 16) + 6;
    }
  } else if (journalTab === 1) {
    const found = player.meta.places.map((k) => placeAt(...k.split(',').map(Number))).filter(Boolean);
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText(`Places discovered: ${found.length}`, X, y); y += 26;
    if (!found.length) { g.fillStyle = '#a8c0d8'; g.font = '13px sans-serif'; wrapText(g, 'Standing stones, shrines, ruins, hermits, battlefields and wells lie out in the wilds. Walk near one to discover it.', X, y, W, 18); }
    const cols = canvas.width > 900 ? 2 : 1, colW = W / cols;
    found.slice(-40).forEach((pl, n) => {
      const cx = X + (n % cols) * colW, cy = y + Math.floor(n / cols) * 44;
      if (cy > canvas.height - 40) return;
      g.imageSmoothingEnabled = false; g.drawImage(sprite(pl.sprite), cx, cy, 32, 32);
      g.fillStyle = '#e6eef8'; g.font = 'bold 13px sans-serif'; g.fillText(pl.name[0].toUpperCase() + pl.name.slice(1), cx + 40, cy + 2);
      g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText(`${PLACE_TYPES[pl.type].label} · ${REALMS[realmOfTile(pl.x, pl.y)].short}${player.meta.looted.includes(pl.key) ? ' · searched' : ''}`, cx + 40, cy + 19);
    });
  } else if (journalTab === 2) {
    const all = Object.keys(ITEMS.relics);
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText(`Treasures found: ${player.meta.found.length} of ${all.length}`, X, y); y += 28;
    for (const id of all) {
      const it = ITEMS.relics[id], got = player.meta.found.includes(id);
      g.fillStyle = got ? '#ffd86b' : '#4b5563'; g.font = 'bold 14px sans-serif'; g.fillText(`${got ? '◆' : '◇'} ${got ? it.name : '???'}${player.relic === id ? '  (worn)' : ''}`, X, y);
      g.fillStyle = got ? '#cfe9ff' : '#6b7280'; g.font = '12px sans-serif'; y = wrapText(g, got ? it.desc : `Said to be found in ${it.found}.`, X + 22, y + 18, W - 22, 16) + 8;
      if (y > canvas.height - 30) break;
    }
  } else if (journalTab === 4) {
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText('The world', X, y); y += 26;
    const artW = Math.min(150, W * 0.3);
    if (canvas.width > 700) { g.save(); g.translate(X + W - artW, y); drawRealmArt(g, artW, artW); g.restore(); }
    const textW = canvas.width > 700 ? W - artW - 20 : W;
    for (const page of WORLD_INTRO) {
      if (y > canvas.height - 40) break;
      g.fillStyle = '#ffd86b'; g.font = 'bold 14px sans-serif'; g.fillText(page.title, X, y);
      g.fillStyle = '#cfe9ff'; g.font = '12px sans-serif'; y = wrapText(g, page.text, X, y + 18, textW, 16) + 10;
    }
  } else {
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText('Bestiary', X, y); y += 28;
    const cols = canvas.width > 900 ? 2 : 1, colW = W / cols;
    MONSTER_TYPES.forEach((t, n) => {
      const cx = X + (n % cols) * colW, cy = y + Math.floor(n / cols) * 74, k = (player.meta.bestiary || {})[t.name] || 0;
      if (cy > canvas.height - 60) return;
      g.globalAlpha = k ? 1 : 0.35; g.imageSmoothingEnabled = false; g.drawImage(sprite(t.sprite), cx, cy, 40, 40); g.globalAlpha = 1;
      g.fillStyle = k ? '#e6eef8' : '#6b7280'; g.font = 'bold 14px sans-serif'; g.fillText(k ? `${t.name} · ${k} slain` : '???', cx + 50, cy);
      g.fillStyle = k ? '#a8c0d8' : '#4b5563'; g.font = '12px sans-serif';
      wrapText(g, k ? `${t.hp} HP, attack ${t.atk}, ${t.xp} XP. ${MONSTER_LORE[t.name] || ''}` : 'Slay one to learn more.', cx + 50, cy + 18, colW - 70, 15);
    });
  }
  g.textBaseline = 'alphabetic';
}
function drawQuests(g) {
  g.fillStyle = 'rgba(6,12,20,0.9)'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#e6eef8'; g.font = 'bold 18px sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillText('Quests', 24, 18);
  g.font = '13px sans-serif'; g.fillStyle = '#a8c0d8';
  g.fillText(`${player.questsDone || 0} completed in total  ·  Q or Esc closes  ·  ask captains, the King or townsfolk for more`, 110, 23);
  let y = 60;
  const rqs = REALM_ORDER.filter((id) => { const st = rqState(id); return st.s >= 1 && st.s <= 4; });
  if (rqs.length) {
    g.font = 'bold 14px sans-serif'; g.fillStyle = '#ffd86b'; g.fillText('Realm quests', 24, y); y += 24;
    for (const id of rqs) {
      const st = rqState(id), Q = REALM_QUESTS[id], step = Q.steps[st.s - 1];
      g.fillStyle = REALMS[id].color; g.fillRect(32, y + 4, 8, 8);
      g.fillStyle = '#e6eef8'; g.font = '14px sans-serif'; g.fillText(`${Q.title} (${st.s === 4 ? 'done' : `step ${st.s} of 3`})`, 46, y);
      g.fillStyle = '#9fd4ff'; g.font = '12px sans-serif'; g.fillText(st.s === 4 ? `Report to ${Q.ruler}` : `${step.label}${step.need > 1 ? `: ${st.n}/${step.need}` : ''}  ·  from ${Q.ruler}`, 46, y + 18);
      y += 42;
    }
    y += 6;
  } else if (REALM_ORDER.some((id) => rqState(id).s === 0)) {
    g.font = '12px sans-serif'; g.fillStyle = '#a8c0d8';
    g.fillText('Realm leaders have errands too: Speaker Maren in Hearth, King Aldric, Chieftain Ulrek in Kar Thuldun, and the Goldspire bankers.', 24, y); y += 26;
  }
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
  if (canvas.width < 760) { g.textBaseline = 'alphabetic'; return; }
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
BIG_SPRITES.hound = ['................', '................', '..........HH....', '.........HhhH...', '.........hhhhh..', '.........hkhhhk.', '.H.......hhhhhh.', '..H......hhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hh.hh..hh.hh.', '...hh.hh..hh.hh.', '...HH.HH..HH.HH.', '................', '................'];
BIG_SPRITES.waystone = ['......EEEE......', '.....EeeeeE.....', '....EeeeeeeE....', '....EeeceeeE....', '....EecccceE....', '....EeeceeeE....', '....EeeceeeE....', '....EecccceE....', '....EeeceeeE....', '....EeeeeeeE....', '....EeeeeeeE....', '...EEeeeeeeEE...', '..EEEEEEEEEEEE..', '.GEEEEEEEEEEEEG.', 'GGGGGGGGGGGGGGGG', '................'];
BIG_SPRITES.bomb = ['................', '..........y.....', '.........o......', '........E.......', '.....kkkEkk.....', '....kkkkkkkk....', '...kkEkkkkkkk...', '...kEkkkkkkkk...', '...kkkkkkkkkk...', '...kkkkkkkkkk...', '...kkkkkkkkkk...', '....kkkkkkkk....', '.....kkkkkk.....', '................', '................', '................'];
BIG_SPRITES.stones = ['................', '..EE......EE....', '..Ee..EE..Ee....', '..Ee..Ee..Ee..EE', '..Ee..Ee..Ee..Ee', '..Ee..Ee..Ee..Ee', '..EE..Ee..EE..Ee', '......Ee......Ee', '..EE..EE..EE..EE', '..Ee..Ee..Ee..Ee', '..Ee..Ee..Ee..Ee', '..EE..EE..EE..EE', 'GGGGGGGGGGGGGGGG', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.shrine = ['.......yy.......', '......eeee......', '.....eeeeee.....', '....EEEEEEEE....', '.....e....e.....', '.....e.yy.e.....', '.....e.oo.e.....', '.....e....e.....', '.....eeeeee.....', '....EEEEEEEE....', '...EEEEEEEEEE...', '...EEEEEEEEEE...', '..GGGGGGGGGGGG..', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.ruin = ['................', '..e.............', '..ee.........e..', '..Ee........ee..', '..Ee..e.....Ee..', '..Ee..ee....Ee..', '..EE..Ee....EE..', '..Ee..Ee..e.Ee..', '..Ee..EE..e.Ee..', '.EEEe.Ee.EEeEEE.', '.EEEEEEEEEEEEEE.', '..E.E..EE.E..E..', 'GGGGGGGGGGGGGGGG', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.hut = ['.......tt.......', '......tttt......', '.....tttttt.....', '....tttttttt....', '...tttttttttt...', '..tttttttttttt..', '...hhhhhhhhhh...', '...hHhhhhhhHh...', '...hhhhkkhhhhh..', '...hhhhkkhhhhh..', '...hhhhkkhhhhh..', '...hhhhkkhhhhh..', '..GGGGGGGGGGGG..', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.battle = ['................', '...e.......e....', '...e.......e....', '...e...e...e....', '..eee..e..eee...', '...H...e...H....', '...H..eee..H....', '...H...H...H..e.', '...H...H...H..e.', '..........w..eee', '...w.......w..H.', '.w..w..w.....H..', 'GGGGGGGGGGGGGGGG', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.well = ['................', '...HHHHHHHHHH...', '...H........H...', '...H........H...', '...H....k...H...', '...H....k...H...', '...H....k...H...', '..EEEEEEEEEEEE..', '..EeeeeeeeeeeE..', '..EeccccccccecE.', '..EeeeeeeeeeeE..', '..EEEEEEEEEEEE..', 'GGGGGGGGGGGGGGGG', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.obelisk = ['.......yy.......', '......yppy......', '......pppp......', '......pPpp......', '......pppp......', '......ppPp......', '......pppp......', '......pPpp......', '......pppp......', '.....pppppp.....', '....pppppppp....', '...EEEEEEEEEE...', '..GGGGGGGGGGGG..', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.king = ['....y.y..y.y....', '....yyyyyyyy....', '....yrryyrry....', '....hsssssss....', '....sskssks.....', '....ssssssss....', '.....shhhhs.....', '....dddddddd....', '...ddyddddyddd..', '..sddyddddydds..', '..s.dyddddyd.s..', '....dddddddd....', '....ddd..ddd....', '....ddd..ddd....', '...HHH....HHH...', '................'];
BIG_SPRITES.wayout = ['....EEEEEEEE....', '...EEhhhhhhEE...', '..EEhHhhhhHhEE..', '..EhhHhhhhHhhE..', '..EhhHhhhhHhhE..', '..EhhHhhhhHhhE..', '..EhhHhhhhHhhE..', '..EhhHhhhyHhhE..', '..EhhHhhhyHhhE..', '..EhhHhhhhHhhE..', '..EhhHhhhhHhhE..', '..EhhHhhhhHhhE..', '..EhhHhhhhHhhE..', '..EEEEEEEEEEEE..', '.EEEEEEEEEEEEEE.', '................'];
// ---------- the hero's look: armour on the body, the weapon in hand ----------
// Built from the class sprite (hair/hat colour marks the class) by repainting
// the torso and legs for the armour and drawing the weapon beside the right hand.
const ARMOR_LOOK = {
  leather:     { torso: (x, y) => (y === 9 && (x === 7 || x === 8)) ? 'y' : (y === 10 ? 'H' : 'h'), legs: 'H' },
  chain:       { torso: (x, y) => ((x + y) % 2 ? 'e' : 'E'), legs: 'E' },
  scale:       { torso: (x, y) => (y % 2 ? ((x % 2) ? 'o' : 'h') : ((x % 2) ? 'h' : 'o')), legs: 'h' },
  plate:       { torso: (x, y) => (y === 7 || x === 3 || x === 12) ? 'E' : (x === 7 && y < 11 ? 'w' : 'e'), legs: 'e', helm: 'e' },
  dragonscale: { torso: (x, y) => ((x + y) % 2 ? 'r' : 'd'), legs: 'd', helm: 'd' },
};
// Weapon pixels as [x, y, colour], held in the right hand (column 13, rows 9-10).
const WEAPON_LOOK = {
  dagger:      [[14, 7, 'w'], [14, 8, 'e'], [14, 9, 'e'], [13, 10, 'y'], [14, 10, 'y'], [14, 11, 'H']],
  short_sword: [[14, 4, 'w'], [14, 5, 'e'], [14, 6, 'e'], [14, 7, 'e'], [14, 8, 'e'], [13, 9, 'y'], [14, 9, 'y'], [15, 9, 'y'], [14, 10, 'H'], [14, 11, 'H']],
  mace:        [[13, 3, 'E'], [14, 3, 'e'], [15, 3, 'E'], [13, 4, 'e'], [14, 4, 'E'], [15, 4, 'e'], [13, 5, 'E'], [14, 5, 'e'], [15, 5, 'E'], [14, 6, 'h'], [14, 7, 'h'], [14, 8, 'h'], [14, 9, 'h'], [14, 10, 'H'], [14, 11, 'H']],
  longsword:   [[14, 0, 'w'], [14, 1, 'w'], [14, 2, 'e'], [14, 3, 'e'], [14, 4, 'e'], [14, 5, 'e'], [14, 6, 'e'], [14, 7, 'e'], [12, 8, 'y'], [13, 8, 'y'], [14, 8, 'y'], [15, 8, 'y'], [14, 9, 'H'], [14, 10, 'H'], [14, 11, 'y']],
  warhammer:   [[12, 1, 'E'], [13, 1, 'E'], [14, 1, 'E'], [15, 1, 'E'], [12, 2, 'e'], [13, 2, 'e'], [14, 2, 'e'], [15, 2, 'E'], [12, 3, 'E'], [13, 3, 'E'], [14, 3, 'E'], [15, 3, 'E'], [14, 4, 'h'], [14, 5, 'h'], [14, 6, 'h'], [14, 7, 'h'], [14, 8, 'h'], [14, 9, 'h'], [14, 10, 'H'], [14, 11, 'H'], [14, 12, 'H']],
  greatsword:  [[14, 0, 'w'], [14, 1, 'w'], [15, 1, 'e'], [14, 2, 'w'], [15, 2, 'e'], [14, 3, 'w'], [15, 3, 'e'], [14, 4, 'w'], [15, 4, 'e'], [14, 5, 'w'], [15, 5, 'e'], [14, 6, 'w'], [15, 6, 'e'], [14, 7, 'w'], [15, 7, 'e'], [12, 8, 'y'], [13, 8, 'y'], [14, 8, 'y'], [15, 8, 'y'], [14, 9, 'd'], [14, 10, 'd'], [14, 11, 'y']],
};
// Unarmed rangers carry a bow and unarmed mages a staff; warriors fight with their fists.
const CLASS_IMPLEMENT = {
  ranger: [[14, 2, 'h'], [15, 3, 'h'], [15, 4, 'h'], [15, 5, 'h'], [15, 6, 'h'], [15, 7, 'h'], [15, 8, 'h'], [14, 9, 'h'], [14, 3, 'w'], [14, 4, 'w'], [14, 5, 'w'], [14, 6, 'w'], [14, 7, 'w'], [14, 8, 'w']],
  mage: [[14, 1, 'c'], [13, 2, 'c'], [14, 2, 'p'], [15, 2, 'c'], [14, 3, 'c'], [14, 4, 'h'], [14, 5, 'h'], [14, 6, 'h'], [14, 7, 'h'], [14, 8, 'h'], [14, 9, 'h'], [14, 10, 'h'], [14, 11, 'h'], [14, 12, 'H'], [14, 13, 'H']],
};
function heroLook(cls, weapon, armor, relic) {
  const base = (CLASSES[cls] || CLASSES.warrior).sprite;
  const name = `hero:${base}:${weapon || '-'}:${armor || '-'}:${relic || '-'}`;
  if (BIG_SPRITES[name]) return name;
  const rows = BIG_SPRITES[base].map((r) => [...r]);
  const A = ARMOR_LOOK[armor];
  if (A) {
    for (let y = 7; y <= 11; y++) for (let x = 0; x < 16; x++) if (rows[y][x] !== '.' && rows[y][x] !== 's') rows[y][x] = A.torso(x, y);
    for (let y = 12; y <= 13; y++) for (let x = 0; x < 16; x++) if (rows[y][x] !== '.') rows[y][x] = A.legs;
    if (A.helm) {
      // a helm over the hair, keeping a plume in the class colour on top
      const plume = rows[0][6];
      for (let y = 0; y <= 2; y++) for (let x = 0; x < 16; x++) if (rows[y][x] !== '.' && rows[y][x] !== 's') rows[y][x] = A.helm;
      rows[0][7] = plume; rows[0][8] = plume;
      for (let x = 4; x <= 11; x++) if (rows[3][x] !== '.') rows[3][x] = x === 4 || x === 11 ? A.helm : rows[3][x];
    }
  }
  if (relic === 'crown') { rows[0] = [...'....y.y..y.y....']; for (let x = 4; x <= 11; x++) rows[1][x] = x % 2 ? 'r' : 'y'; }
  else if (relic && relic !== 'houndcollar') rows[7][7] = relic === 'tideheart' ? 'c' : relic === 'emberbrand' ? 'o' : relic === 'starring' ? 'p' : 'y';   // a glint on the chest
  for (const [x, y, c] of (WEAPON_LOOK[weapon] || CLASS_IMPLEMENT[cls] || [])) rows[y][x] = c;
  BIG_SPRITES[name] = rows.map((r) => r.join(''));
  return name;
}
const playerSprite = () => heroLook(player.cls, player.weapon, player.armor, player.relic);
// A large portrait of the hero in their gear, beside the inventory.
function drawHeroPortrait() {
  const pc = document.getElementById('hero-portrait');
  if (!pc || !player) return;
  const g = pc.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, pc.width, pc.height);
  const grad = g.createRadialGradient(pc.width / 2, pc.height * 0.55, 4, pc.width / 2, pc.height * 0.55, pc.width * 0.7);
  grad.addColorStop(0, '#16384a'); grad.addColorStop(1, '#06202c');
  g.fillStyle = grad; g.fillRect(0, 0, pc.width, pc.height);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(pc.width / 2, pc.height - 14, pc.width * 0.3, 6, 0, 0, Math.PI * 2); g.fill();
  const img = sprite(playerSprite()), size = img.width * Math.floor((pc.width - 12) / img.width);
  g.drawImage(img, (pc.width - size) / 2, pc.height - size - 8, size, size);
  const plus = (n) => (n ? ` +${n}` : '');
  pc.title = `${heroClass().name}, level ${player.level}: ${player.weapon ? itemInfo(player.weapon).name + plus(player.weaponPlus) : 'bare hands'}, ${player.armor ? itemInfo(player.armor).name + plus(player.armorPlus) : 'no armour'}${player.relic ? ', ' + itemInfo(player.relic).name : ''}`;
}
BIG_SPRITES.slime = ['................', '................', '................', '................', '.......gg.......', '.....gggggg.....', '....ggggwggg....', '...gggggggggg...', '...ggkggggkgg...', '..gggggggggggg..', '..gggggggggggg..', '..ggggggggggggg.', '.gggggggggggggg.', '.GGGGGGGGGGGGGG.', '................', '................'];
BIG_SPRITES.necromancer = ['......kkkk......', '.....kkkkkk.....', '....kkkkkkkk....', '....kkwwwwkk....', '....kwkwwkwk....', '....kkwwwwkk....', '.....kkkkkk.....', '....kpppppppk...', '...kppppppppkc..', '..wkppppppppkh..', '..w.kpppppppkh..', '....kpppppppkh..', '....kpppppppkh..', '....kpppppppkh..', '...kkkk..kkkkh..', '................'];
BIG_SPRITES.mimic = ['................', '................', '..hhhhhhhhhhhh..', '.hHHHHHHHHHHHHh.', '.hHhhhhhhhhhhHh.', '.hHhrkhhhhrkhHh.', '.hHHHHHyyHHHHHh.', '.wkwkwkwkwkwkwk.', '.kkrrrrrrrrrrkk.', '.wkwkwkwkwkwkwk.', '.hHHHHHHHHHHHHh.', '.hHhhhhhhhhhhHh.', '.hHHHHHHHHHHHHh.', '..hhhhhhhhhhhh..', '..h..........h..', '................'];
BIG_SPRITES.abyss = ['................', '....EEEEEEEE....', '...EeeeeeeeeE...', '..EeEEEEEEEEeE..', '..EeEkkkkkkEeE..', '..EeEkkppkkEeE..', '..EeEkpPPpkEeE..', '..EeEkpPPpkEeE..', '..EeEkkppkkEeE..', '..EeEkkkkkkEeE..', '..EeEkkkkkkEeE..', '..EeEkkkkkkEeE..', '.EEEEEEEEEEEEEE.', 'GGGGGGGGGGGGGGGG', '.GGGGGGGGGGGGGG.', '................'];
BIG_SPRITES.horse = ['................', '................', '............HH..', '...........HhhH.', '..........Hhhkh.', '..........hhhhhh', '...hhhhhhhhhhh..', '..Hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '.H.hhhhhhhhhh...', '...hhhhhhhhhh...', '...hh.hh..hh.hh.', '...hh.hh..hh.hh.', '...hh.hh..hh.hh.', '...kk.kk..kk.kk.', '................'];
BIG_SPRITES.statue = ['......eeee......', '.....eEEEEe.....', '.....eEeeEe.....', '......eeee......', '.....eeeeee.....', '....eeEeeEee....', '...ee.eeee.ee...', '...e..eeee..e...', '......eeee......', '......ee.ee.....', '......ee.ee.....', '....EEEEEEEE....', '...EeeeeeeeeE...', '...EEEEEEEEEE...', '..EEEEEEEEEEEE..', '................'];
BIG_SPRITES.belltower = ['.......dd.......', '......dddd......', '.....dddddd.....', '....dddddddd....', '.....EeeeeE.....', '.....E.yy.E.....', '.....E.yy.E.....', '.....EeeeeE.....', '.....EEEEEE.....', '.....EeEEeE.....', '.....EEEEEE.....', '.....EeEEeE.....', '.....EEEEEE.....', '....EEEhhEEE....', '...EEEEhhEEEE...', '................'];
BIG_SPRITES.bonfire = ['................', '.......yy.......', '......yooy......', '.....yoryoy.....', '.....orrroo.....', '....yorryroy....', '....orrrrrro....', '....orryyrro....', '.....orrrro.....', '...hHhorroHhh...', '..hhHHhhhHHhh...', '...HhhHHHhhH....', '..EEe....eEE....', '..EeEE..EEeE....', '................', '................'];
BIG_SPRITES.darkknight = ['.....kkkkkk.....', '....kEEEEEEk....', '....kEkkkkEk....', '....kEkrrkEk....', '....kEEEEEEk....', '.....kEEEEk.....', '....kkkkkkkk....', '...kEEEyyEEEk.w.', '..kEEEEEEEEEEkw.', '..EkEEEEEEEEkEw.', '..E.kEEEEEEk.Ey.', '....kEEEEEEk..H.', '....kEEk.kEEk...', '....kEEk.kEEk...', '...kkkk...kkkk..', '................'];
BIG_SPRITES.letter = ['................', '................', '..tttttttttttt..', '..twwwwwwwwwwt..', '..twkkkkkkkwwt..', '..twwwwwwwwwwt..', '..twkkkkkkwwwt..', '..twwwwwwwwwwt..', '..twkkkkkkkkwt..', '..twwwwwwwwwwt..', '..twkkkkwwwwwt..', '..twwwwwwwwrrt..', '..twwwwwwwwrrt..', '..tttttttttttt..', '................', '................'];
const spriteCache = {};
// Creatures, items and props get a dark outline so they read on any ground;
// 16px sprites also get a light top rim and a darker bottom rim for volume.
const NO_OUTLINE = new Set(['stairs', 'trap', 'rug', 'counter', 'shelf', 'bed', 'table', 'rack', 'fire', 'flower']);
const EXTRA_OUTLINE = new Set(['chest', 'lamp', 'torch', 'barrel', 'plant', 'bones']);
const outlined = (name) => !NO_OUTLINE.has(name) && (!!BIG_SPRITES[name] || EXTRA_OUTLINE.has(name));
function sprite(name) {
  if (spriteCache[name]) return spriteCache[name];
  const rows = BIG_SPRITES[name] || SPRITES[name];
  const n = rows.length, o = outlined(name) ? 1 : 0, w = n + o * 2;
  const c = document.createElement('canvas'); c.width = c.height = w;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x + o, y + o, 1, 1); } }));
  const data = g.getImageData(0, 0, w, w).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < w && data[(y * w + x) * 4 + 3] > 0;
  if (n === 16) {
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x, y - 1)) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, y, 1, 1); }
      else if (!solid(x, y + 1)) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y, 1, 1); }
    }
  }
  if (o) {
    g.fillStyle = 'rgba(8,10,20,0.9)';
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
    }
  }
  c.base = n; c.border = o;
  spriteCache[name] = c;
  return c;
}
// Draw a sprite at a world position (tiles, may be fractional while moving).
// `off` is the camera for the live layer and the cache origin for the background.
let off = { x: 0, y: 0 };
function drawSprite(g, name, x, y, alpha = 1, pad = 3, flip = false, flash = false) {
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  let img = sprite(name);
  // whole-number scaling keeps every source pixel the same size on screen
  const scale = Math.max(1, Math.round((T - pad * 2) / img.base)), inner = img.base * scale, b = img.border * scale;
  const size = inner + b * 2;
  const dx = Math.round(x * T - off.x + (T - inner) / 2) - b, dy = Math.round(y * T - off.y + (T - inner) / 2) - b;
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
  speaker: { sprite: 'elder', name: 'Speaker Maren', action: 'council', lines: ['The Cantons answer to their people, and the people answer to their purses. Help us build.'] },
  councillor: { sprite: 'villager', name: 'The town councillor', action: 'council', lines: ['Every coin for the public works is written in the ledger, with your name beside it.'] },
  herald: { sprite: 'guard', name: 'The royal herald', action: 'court', lines: ['By the King\'s leave, titles of the realm may be granted to those who serve it. And pay for it.'] },
  chieftain: { sprite: 'guard', name: 'Chieftain Ulrek Stonehand', action: 'chieftain', lines: ['Kings buy loyalty. Merchants rent it. Among the clans, it is sworn over bread and salt at the fire.'] },
  shaman: { sprite: 'elder', name: 'The clan shaman', action: 'shaman', lines: ['The spirits listen to those who bring gifts. Gold will do. They are not proud.'] },
  banker: { sprite: 'merchant', name: 'Banker Vessa Orlov', action: 'bank', lines: ['Gold in a pocket is lost to the first goblin. Gold in my vault outlives you.'] },
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
  king: { sprite: 'king', name: 'King Aldric', action: 'court', lines: [
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
BUILDINGS.arena = { ...BUILDINGS.keep, name: 'The Grand Arena', sign: 'ARENA', roof: '#9a3412', npcs: {} };
BUILDINGS.cottage = { ...BUILDINGS.home, name: "Bram's Cottage", npcs: { H: 'bram' }, roof: '#9a3412' };
BUILDINGS.council = { name: 'The Council Hall', sign: 'COUNCIL', roof: '#166534', npcs: { G: 'speaker' }, layout: [
  '################', '#p....rrrr....p#', '#.....rGrr.....#', '#.....rrrr.....#', '#..TTT....TTT..#',
  '#..............#', '#..TTT....TTT..#', '#..............#', '#p............p#', '#######D########'] };
BUILDINGS.townhall = { ...BUILDINGS.council, name: 'The Town Hall', sign: 'HALL', npcs: { G: 'councillor' } };
BUILDINGS.herald = { name: "The King's Herald", sign: 'HERALD', roof: '#7c2d12', npcs: { G: 'herald' }, layout: [
  '################', '#RR....f.....RR#', '#..............#', '#......G.......#', '#....CCCCC.....#',
  '#..............#', '#..T.......T...#', '#......rr......#', '#......rr......#', '#######D########'] };
BUILDINGS.longhouse = { name: 'The Great Longhouse', sign: 'CLAN', roof: '#8c6a2c', npcs: { G: 'chieftain', E: 'shaman' }, layout: [
  '################', '#R.....G......R#', '#..............#', '#..rrrrrrrrrr..#', '#..rrrrfrrrrr..#',
  '#..rrrrrrrrrr..#', '#.E............#', '#..............#', '#b.B.B....B.B.b#', '#######D########'] };
BUILDINGS.shamanhut = { name: "The Shaman's Hut", sign: 'SPIRITS', roof: '#8c6a2c', npcs: { E: 'shaman' }, layout: [
  '################', '#pp....f.....pp#', '#..............#', '#....rrrrr.....#', '#....rrErr.....#',
  '#....rrrrr.....#', '#..............#', '#..b.......b...#', '#..............#', '#######D########'] };
BUILDINGS.exchange = { name: 'The Exchange', sign: 'BANK', roof: '#4c2f7a', npcs: { M: 'banker' }, layout: [
  '################', '#SSSS..ccc..SSS#', '#..............#', '#.....M........#', '#..CCCCCCCCC...#',
  '#..............#', '#..T.......T...#', '#p............p#', '#..............#', '#######D########'] };
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
// The Deep: the endgame, opened when the Crown is whole. Endless floors that grow
// harder, a boss every fifth floor, and a record of how far down you have been.
const DEEP_CELL = [1, -1];
const floorText = () => (dungeonDef && dungeonDef.arena ? `wave ${ARENA.wave} (best ${player.meta.arena || 0})` : dungeonDef && dungeonDef.endless ? `floor ${floor} (record ${player.meta.deepest || floor})` : `${floor}/${dungeonDef ? dungeonDef.floors : FINAL_FLOOR}`);
const DEEP_THEMES = ['stone', 'moss', 'flooded', 'bone', 'lava', 'arcane'];
const SITE_TYPES = {
  cave:   { label: 'Goblin Cave', sprite: 'cave',   floors: [2, 3], pool: byName('Rat', 'Goblin', 'Bat', 'Spider', 'Orc', 'Slime'), gold: 1.6, potions: 1, view: 7, loot: 0.12, treasure: 60, prefixes: ['Mossy', 'Dripping', 'Echoing', 'Low', 'Black'] },
  warren: { label: 'Orc Warren',  sprite: 'warren', floors: [2, 2], pool: byName('Goblin', 'Archer', 'Orc'),         gold: 1.2, potions: 1, view: 8, loot: 0.3,  treasure: 80, prefixes: ['Bloody', 'Broken-Tusk', 'Red', 'Grim', 'Ironhide'] },
  crypt:  { label: 'Crypt',       sprite: 'crypt',  floors: [3, 3], pool: byName('Skeleton', 'Spider', 'Wraith', 'Necromancer'),    gold: 1,   potions: 1, view: 6, loot: 0.15, treasure: 120, prefixes: ['Forgotten', 'Silent', 'Weeping', 'Sunken', 'Nameless'], xp: 1.5 },
  deep:   { label: 'The Deep', sprite: 'abyss', floors: [99, 99], pool: null, gold: 1.6, potions: 1.3, view: 7, loot: 0.22, treasure: 0, prefixes: [''], xp: 1.5 },
  tower:  { label: "Wizard's Tower", sprite: 'tower', floors: [3, 4], pool: byName('Wraith', 'Skeleton', 'Bat', 'Archer', 'Necromancer'), gold: 1.3, potions: 2, view: 9, loot: 0.18, treasure: 200, prefixes: ['Leaning', 'Glass', 'Moonlit', 'Shattered', 'Violet'] },
};
let dungeonDef = null;   // set when a gate or a site is entered
let entryWarned = null;  // { key, turn } after a warning that a dungeon is too hard
let wayoutWarned = -99;  // the turn the hero last bumped the way-out door
let revealedTraps = new Set();   // traps the hero has found, by "x,y"
let guestRespawn = null;         // a guest's hero after a death, so R does not start from scratch
function townDungeon(town) {
  const danger = Math.max(Math.abs(town.i), Math.abs(town.j));
  return { kind: 'town', name: `${town.name} dungeon`, floors: 5, pool: null, gold: 1 + danger * 0.15, potions: 1, view: 8, loot: 0.12, treasure: 0, danger, xp: 1, home: town.key };
}
function siteDungeon(site) {
  const st = SITE_TYPES[site.type];
  const def = { kind: 'site', name: site.name, floors: site.floors, pool: st.pool, gold: st.gold, potions: st.potions, view: st.view, loot: st.loot, treasure: st.treasure, danger: site.danger, xp: st.xp || 1, site };
  if (site.deep) Object.assign(def, { name: 'the Deep', endless: true, pool: null, danger: 5 });
  if (site.story) { const S = STORY_SITES[site.story]; Object.assign(def, { story: site.story, theme: S.theme, boss: S.boss, treasure: 150 + 60 * S.danger, xp: 1.5 }); }
  return def;
}
// The level a hero should be to take a dungeon on: danger adds two levels a
// step, and dungeons whose first floor already holds orcs or wraiths add more.
function recLevel(def) {
  if (!def) return 1;
  const pool = def.pool || MONSTER_TYPES.filter((t) => !t.noSpawn && t.minFloor <= 1);
  const hardest = Math.max(...pool.map((t) => t.atk));
  return Math.max(1, 1 + 2 * (def.danger || 0) + Math.max(0, hardest - 2));
}
const RATINGS = [
  { min: 3, label: 'Easy', color: '#9ca3af' },
  { min: 0, label: 'Fair', color: '#5fe17a' },
  { min: -2, label: 'Hard', color: '#fbbf24' },
  { min: -5, label: 'Very hard', color: '#f97316' },
  { min: -Infinity, label: 'Deadly', color: '#ef4444' },
];
function rating(def) {
  const rec = recLevel(def), diff = (player ? player.level : 1) - rec;
  return { rec, ...RATINGS.find((r) => diff >= r.min) };
}
const ratingText = (def) => { const r = rating(def); return `level ${r.rec}+ · ${r.label} for you`; };
const stars = (danger) => '★'.repeat(Math.min(5, 1 + danger)) + '☆'.repeat(Math.max(0, 4 - danger));

// ---------- the four realms ----------
// The land is split between four city-states with different governments. A
// lattice cell belongs to whichever capital is nearest.
const REALMS = {
  cantons: { name: 'Free Cantons of Hearth', short: 'the Free Cantons', gov: 'Democracy', ruler: 'Speaker Maren', capital: [0, 0], color: '#5fe17a',
    blurb: 'Free towns that elect a council every spring. Low tariffs, public works, and arguments in every tavern.' },
  aurum: { name: 'Kingdom of Aurum', short: 'the Kingdom', gov: 'Monarchy', ruler: 'King Aldric', capital: [2, -1], color: '#f5c542',
    blurb: 'Ruled by King Aldric from Castle Aurum. Castles on the hills, knights on the roads, and the King\'s law over all.' },
  kathar: { name: "Ka'thar Clans", short: 'the Clans', gov: 'Tribal', ruler: 'Chieftain Ulrek Stonehand', capital: [-3, 2], color: '#e0763a',
    blurb: 'Clans of the southern wilds, led by a chieftain chosen in battle and guided by shamans who speak with the spirits.' },
  league: { name: 'Goldspire League', short: 'the League', gov: 'Oligarchy', ruler: 'the Merchant Council', capital: [-2, -3], color: '#b18cff',
    blurb: 'City-states run by their richest merchant houses. Banks, guilds, fine goods, and prices to match.' },
};
const REALM_ORDER = ['cantons', 'aurum', 'kathar', 'league'];
function realmAt(i, j) {
  let best = 'cantons', bd = Infinity;
  for (const id of REALM_ORDER) { const [ci, cj] = REALMS[id].capital; const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = id; } }
  return best;
}
const cellOf = (x, y) => [Math.round((x - 20) / TOWN_SPACING), Math.round((y - 15) / TOWN_SPACING)];
const realmOfTile = (x, y) => realmAt(...cellOf(x, y));

// ---------- the story: The Shattered Crown ----------
const STORY_SITES = {
  dawn:   { i: 1, j: 1,   type: 'crypt', theme: 'bone',    danger: 1, floors: 3, title: 'The Sunken Chapel',  shard: 'Shard of Dawn',   relic: 'sunstone',   boss: { type: 'Skeleton', name: 'Sister Vey, the Hollow Nun' } },
  tides:  { i: -2, j: 2,  type: 'cave',  theme: 'flooded', danger: 2, floors: 3, title: 'The Drowned Grotto', shard: 'Shard of Tides',  relic: 'tideheart',  boss: { type: 'Spider', name: 'Morwen the Drowned' } },
  bones:  { i: 3, j: -2,  type: 'crypt', theme: 'bone',    danger: 3, floors: 3, title: 'The Barrow of Kings', shard: 'Shard of Bones', relic: 'bonecharm',  boss: { type: 'Wraith', name: 'the Barrow King' } },
  embers: { i: -4, j: 1,  type: 'cave',  theme: 'lava',    danger: 4, floors: 4, title: 'The Ember Deeps',    shard: 'Shard of Embers', relic: 'emberbrand', boss: { type: 'Orc', name: 'Gorrak Emberjaw' } },
  stars:  { i: -2, j: -4, type: 'tower', theme: 'arcane',  danger: 5, floors: 4, title: 'The Star Tower',     shard: 'Shard of Stars',  relic: 'starring',   boss: { type: 'Knight', name: 'Prince Edric, the Crownbreaker', yields: true } },
};
const STORY_ORDER = ['dawn', 'tides', 'bones', 'embers', 'stars'];
const STORY_AT = Object.fromEntries(Object.entries(STORY_SITES).map(([id, S]) => [`${S.i},${S.j}`, id]));
const story = () => player.meta.story || (player.meta.story = { ch: 0, phase: 'summons' });
function storySiteOpen(id) {
  const st = story(), idx = STORY_ORDER.indexOf(id);
  return st.phase === 'done' || idx < st.ch || (idx === st.ch && st.phase !== 'summons');
}
function storyObjective() {
  if (!player || !player.meta) return null;
  const st = story();
  const castle = townAt(...REALMS.aurum.capital);
  if (st.phase === 'summons') return { text: 'Travel to Castle Aurum and speak with King Aldric', short: 'Castle Aurum', x: castle.cx, y: castle.cy };
  if (st.phase === 'return') return { text: `Bring the ${STORY_SITES[STORY_ORDER[st.ch]].shard} to King Aldric`, short: 'Castle Aurum', x: castle.cx, y: castle.cy };
  if (st.phase === 'seek') { const S = STORY_SITES[STORY_ORDER[st.ch]], site = siteAt(S.i, S.j); return { text: `Find the ${S.shard} in ${S.title.replace(/^The /, 'the ')}`, short: S.title, x: site.x, y: site.y }; }
  return null;
}
// The opening: the history of the world, told once to every new hero before the
// herald arrives, and kept in the Journal's World page.
const WORLD_INTRO = [
  { who: 'The Age of the Crown', sprite: 'king', title: 'The Age of the Crown',
    text: 'A thousand years ago there was one kingdom and one crown. Aurel the Founder pulled five lights out of the dark, Dawn, Tides, Bones, Embers and Stars, and forged them into the Crown of Aurum. While the crown stayed whole, the land was quiet.' },
  { who: 'The Deep', sprite: 'wraith', title: 'The Deep',
    text: 'The lights were not taken from nothing. Beneath the world lies the Deep, old and patient and dreaming. Its dreams leak upward as caves, crypts and endless halls. Every town was built with a gate over one, so the watch could keep an eye on the dark.' },
  { who: 'The Sundering', art: 'realms', title: 'The Sundering',
    text: 'Three hundred years ago the War of Four Banners broke the old kingdom apart. The crown stayed at Castle Aurum with the last royal line. The rest of the land went its own way, and four realms rose from the wreck.' },
  { who: 'The four realms', art: 'realms', title: 'The four realms',
    text: "In the middle lie the Free Cantons of Hearth, who elect their council and argue about everything. To the north-east the Kingdom of Aurum keeps the crown, the castles and the King's law. In the south-west the Ka'thar Clans follow a chieftain chosen in battle and shamans who speak with spirits. And in the north-west the Goldspire League is run by its richest merchant houses, and sells everything." },
  { who: 'The roads between', sprite: 'stones', title: 'The roads between',
    text: 'Old roads run between the realms, past standing stones older than any of them, wayside shrines, ruined towns, lonely hermits and battlefields where the swords still stand. The waystone in every town remembers the roads, for a fee.' },
  { who: 'Five nights ago', sprite: 'skeleton', title: 'Five nights ago',
    text: 'Five nights ago, in the King\'s own hall, the Crown of Aurum cracked like ice and its five lights fled back into the dark. Since then the dungeons have stirred. Beasts walk the roads after sunset, and things climb out of the gates that nobody has seen in a lifetime.' },
  { who: 'And you', sprite: 'hero', title: 'And you',
    text: 'And you? You are nobody yet: a sword-arm in Hearth, a free town of the Cantons, with a little courage and nothing much to lose. That is about to change.' },
];
const INTRO_KEY = 'dungeon-world-intro';
function markIntroSeen() { try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* ignore */ } }
function introSeen() { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { return true; } }
// A tiny map of the four realms, for the pages that need one.
function drawRealmArt(g, w, h) {
  const cells = 11, cw = w / cells, ch = h / cells;
  for (let a = 0; a < cells; a++) for (let b = 0; b < cells; b++) {
    const i = a - 5, j = b - 5, R = REALMS[realmAt(i, j)];
    g.fillStyle = R.color; g.globalAlpha = 0.55 + 0.15 * cellRand(i, j, 7); g.fillRect(a * cw, b * ch, cw + 0.5, ch + 0.5);
  }
  g.globalAlpha = 1;
  for (const id of REALM_ORDER) {
    const [i, j] = REALMS[id].capital, x = (i + 5.5) * cw, y = (j + 5.5) * ch;
    g.fillStyle = '#0f1724'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = id === 'aurum' ? '#ffd86b' : '#f4f4f4'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
}
const PROLOGUE = [
  { who: 'A royal herald', sprite: 'guard', text: 'A rider in gold and crimson reins in beside the fountain. "Hero! I bear the seal of King Aldric of Aurum. Five nights ago the Crown of Aurum shattered upon its cushion, and its five shards vanished into the dark places of the world."' },
  { who: 'A royal herald', sprite: 'guard', text: '"The guards swear a cloaked figure walked out of the hall that night, and nobody saw a face. Since then the dungeons stir and beasts walk the roads. The King summons every sword that will answer. Ride east to Castle Aurum and kneel before him. Your compass will show the way."' },
  { who: 'The four realms', sprite: 'obelisk', text: 'This land is split between four realms that agree on very little: the Free Cantons of Hearth, the Kingdom of Aurum, the Ka\'thar Clans and the Goldspire League. On this, at least, they are afraid together.' },
];
const KING_SCENES = {
  summons: [
    { who: 'King Aldric', sprite: 'king', text: '"So you came. Good. Most did not." The King is younger than you expected, and more tired. "The shards went where old power sleeps. My scholars have found the first: the Sunken Chapel, south-east of Hearth, where the sisters of dawn once prayed."' },
    { who: 'King Aldric', sprite: 'king', text: '"Bring me the Shard of Dawn. I have broken the seal on the chapel door and marked the way on your map. Take care. Whatever woke in that chapel does not want it found."' },
  ],
  dawn: [{ who: 'King Aldric', sprite: 'king', text: '"The Shard of Dawn. It is warm, even now." Then you show him the scrap of letter, and the warmth goes out of his face. "My brother\'s crown. Whoever wrote this has a brother on a throne, and there are not many of us." He folds the scrap away. "The next shard lies in the Drowned Grotto, in the clan lands to the south-west. Keep your eyes open down there, and not only for monsters."' }],
  tides: [{ who: 'King Aldric', sprite: 'king', text: '"A rearing stag." The King turns the signet over and over. "The badge of my brother Edric. Our father sent him into exile ten years ago, for reasons I have never said aloud." He sets it down very carefully. "The third shard is in the Barrow of Kings, east of these walls, where our father sleeps. If Edric has been there, I need to know."' }],
  bones: [{ who: 'King Aldric', sprite: 'king', text: 'He reads the carving twice. "It should have been me." For a long moment the King says nothing. "Edric was the elder by an hour and the cleverer by a mile. Father chose me anyway, and Edric never forgave either of us." He straightens. "The fourth shard burns in the Ember Deeps, far to the west. Be careful on the roads. If Edric knows you are coming, he will not wait for you to arrive."' }],
  embers: [{ who: 'King Aldric', sprite: 'king', text: '"He paid an orc to keep it for him." The King weighs the purse of old royal silver. "Our mother\'s silver. He took it with him into exile." He unrolls a map and taps a tower in the north-west. "The Star Tower. That is where he will be, with the last shard. Bring it back, and if you can, bring him back too. Alive. He is still my brother."' }],
  stars: [
    { who: 'King Aldric', sprite: 'king', text: '"You brought him." Edric stands between two guards, unbowed and very tired. The brothers look at each other for a long time. "Why?" the King asks at last. "So that for once," Edric says, "you would need me to fix something. And instead you found a stranger."' },
    { who: 'King Aldric', sprite: 'king', text: '"I did need you," Aldric says quietly. "I always have. You are pardoned, brother, on one condition: you help me hold what you nearly broke." Edric opens his mouth to argue and then, for the first time in ten years, does not. The King turns to you. "Now. Five shards. Lay them on the cushion. There."' },
    { who: 'The Crown of Aurum', sprite: 'obelisk', text: 'The pieces drift together, and with a sound like a bell heard underwater the Crown of Aurum is whole again. Far beneath the world, something that was waking turns over, and goes back to sleep.' },
    { who: 'King Aldric', sprite: 'king', text: '"The four realms will argue for a hundred years about who saved them. I know the answer." He places the crown in your hands, not on his own head. "It chose you, Crownbearer. Wear it. The realm is in your debt, and so am I."' },
    { who: 'King Aldric', sprite: 'king', text: '"One more thing." He lowers his voice. "When the crown broke, a gate of black iron opened in the hills between Hearth and my walls. The Gate of the Deep. Whatever the five lights were holding down is still down there. Go as deep as you dare, and come back to tell me what you saw."' },
  ],
};
const SHARD_FOUND = {
  dawn: 'Behind the Hollow Nun\'s altar, wrapped in rotted silk, lies a sliver of gold that glows like the first light of morning: the Shard of Dawn. Beside it rests an amulet set with a warm, bright stone.',
  tides: 'In the deepest pool of the grotto, held in a nest of silk, the Shard of Tides glimmers like moonlight on water. Tangled with it is a pearl that beats, faintly, like a heart.',
  bones: 'On the Barrow King\'s throne, among the crowns of dead kings, the Shard of Bones gleams pale and cold. Around the throne\'s arm hangs a charm of yellowed bone.',
  embers: 'Gorrak\'s hoard is mostly slag and scorched coin, but at its heart the Shard of Embers glows like a coal that will never go out. Next to it, a ring still too hot to touch.',
  stars: 'At the top of the tower, where the ceiling is open to the sky, the Shard of Stars hangs in the air, turning slowly. Below it lies a ring that seems to hold a falling star.',
};

// The trail of clues that leads to Prince Edric, one beside each shard.
const SHARD_CLUE = {
  dawn: { who: 'A torn letter', sprite: 'letter', text: 'Under the altar cloth lies a scrap of a letter in a fine, careful hand: "...the chapel first, where the light is weakest. Once all five lights are scattered, my brother\'s crown is only a hat. E."' },
  tides: { who: 'A signet ring', sprite: 'chest', text: 'Tangled in the silk is a gold signet ring carved with a rearing stag. Whoever wore it was no ordinary thief.' },
  bones: { who: 'A fresh carving', sprite: 'skeleton', text: 'Cut into the arm of the Barrow King\'s throne, the marks still sharp: "Here sleeps my father, who chose wrong. It should have been me. E."' },
  embers: { who: 'A purse of silver', sprite: 'chest', text: 'Under the slag is a velvet purse of old royal silver, and a note: "For your trouble, and your silence. Hold the shard until I come for it. E."' },
  stars: { who: 'Prince Edric', sprite: 'darkknight', text: 'The knight in black pulls off his helm. He has the King\'s face, ten years harder. "Go on, then," Prince Edric says. "Take it to him. Tell him his brother lost again." He does not resist when you lead him down the stairs.' }
};

// ---------- places to visit ----------
const PLACE_TYPES = {
  stones:      { label: 'Standing Stones', sprite: 'stones', names: ['the Whispering Stones', 'the Ninefold Ring', 'the Grey Maidens', 'the Moonstones', 'the Weeping Circle'],
                 lore: 'Grey stones stand in a ring older than any realm. The grass inside is greener, and the air hums. Touch the stones and the ache goes out of your bones.' },
  shrine:      { label: 'Wayside Shrine', sprite: 'shrine', names: ['the Shrine of Saint Ilsa', 'the Shrine of the Wayfarer', 'the Lantern Shrine', 'the Shrine of Saint Corvin', 'the Shrine of Small Mercies'],
                 lore: 'A small stone shrine, its candles somehow still burning. Travellers kneel here before a hard road. Kneel, and you may rise braver.' },
  ruin:        { label: 'Ruins', sprite: 'ruin', names: ['the Ruins of Old Corvane', 'the Ruins of Halveth', 'the Glass Keep', 'the Ruins of Tor Ennis', 'the Fallen Hall'],
                 lore: 'Tumbled walls of a town nobody remembers. Ivy holds up what time has not knocked down. Something glints beneath the rubble.' },
  hermit:      { label: "Hermit's Hut", sprite: 'hut', names: ["Old Thom's hut", "Mother Ash's hut", "Brother Pell's hut", "the Owl Woman's hut"],
                 lore: 'A crooked hut with smoke curling from the chimney. The hermit inside has seen a great deal from this doorway, and will tell you some of it.' },
  battlefield: { label: 'Old Battlefield', sprite: 'battle', names: ['the Field of Broken Swords', 'Redmire', 'the Last Stand', 'Crowfield', 'the Weeping Field'],
                 lore: 'Rusted blades still stand where they fell, a whole army of them. Nobody farms this ground. Among the rust, one or two edges are still good.' },
  well:        { label: 'Wishing Well', sprite: 'well', names: ['the Wishing Well', 'the Old Well', 'the Silver Well', 'the Well of Small Wishes'],
                 lore: 'Coins glitter at the bottom of a mossy well. They say a coin thrown here is never wasted, though what it buys is up to the well.' },
};
const places = new Map();
function placeAt(i, j) {
  const k = key(i, j);
  if (places.has(k)) return places.get(k);
  let place = null;
  if (!(i === 0 && j === 0) && cellRand(i, j, 400) < 0.62) {
    const types = Object.keys(PLACE_TYPES), type = types[Math.floor(cellRand(i, j, 401) * types.length)], P = PLACE_TYPES[type];
    const town = townAt(i, j), site = siteAt(i, j);
    for (let n = 0; n < 6 && !place; n++) {
      const x = i * TOWN_SPACING + 6 + Math.floor(cellRand(i, j, 402 + n) * 84), y = j * TOWN_SPACING + 4 + Math.floor(cellRand(i, j, 412 + n) * 84);
      if (town && x >= town.x0 - 6 && x < town.x0 + TW + 6 && y >= town.y0 - 6 && y < town.y0 + TH + 6) continue;
      if (site && Math.abs(site.x - x) + Math.abs(site.y - y) < 10) continue;
      const g = terrainAt(x, y);
      if (g !== GROUND.GRASS && g !== GROUND.FOREST) continue;
      place = { key: k, i, j, x, y, type, sprite: P.sprite, name: P.names[Math.floor(cellRand(i, j, 420) * P.names.length)] };
    }
  }
  places.set(k, place);
  return place;
}
function nearbyPlaces(x, y, reach = 1) {
  const [i0, j0] = cellOf(x, y), out = [];
  for (let i = i0 - reach; i <= i0 + reach; i++) for (let j = j0 - reach; j <= j0 + reach; j++) { const p = placeAt(i, j); if (p) out.push(p); }
  return out;
}
const placeAtTile = (x, y) => nearbyPlaces(x, y, 1).find((p) => p.x === x && p.y === y) || null;
const discovered = (p) => player.meta.places.includes(p.key);

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
// Each realm names its towns its own way.
const REALM_NAMES = {
  aurum: [['King', 'Crown', 'Lion', 'Rose', 'Silver', 'High', 'Fair', 'Bright', 'Royal', 'Swan', 'Hart', 'Gilden'], ['', '', 's'], ['ford', 'mere', 'crest', 'hall', 'keep', 'bridge', 'haven', 'ward', 'gate', 'more', 'leigh']],
  kathar: [["Ka'", 'Ur', 'Dro', 'Gor', 'Thak', 'Vrel', 'Mok', 'Zan', 'Kesh', 'Ruk', 'Ost', 'Grom'], ['', '', 'a', 'u', 'ar'], ['gar', 'thul', 'mok', 'dun', 'rak', 'kesh', 'tor', 'zar', 'vek', 'nag']],
  league: [['Gold', 'Silver', 'Coin', 'Amber', 'Ivory', 'Velvet', 'Pearl', 'Gilt', 'Opal', 'Saffron', 'Marble', 'Ledger'], ['', '', ''], ['spire', 'port', 'market', 'mint', 'vault', 'haven', 'reach', 'quay', 'court', 'gate']],
};
const CAPITAL_NAMES = { kathar: 'Kar Thuldun', league: 'Goldspire' };
// Two towns close together never share a name: the later one takes a qualifier.
const NAME_QUALIFIERS = ['Little', 'Upper', 'Lower', 'Old', 'New', 'Great', 'High', 'Nether'];
function hasTown(i, j) {
  if (i === 0 && j === 0) return true;
  if (REALM_ORDER.some((id) => REALMS[id].capital[0] === i && REALMS[id].capital[1] === j)) return true;
  return !(cellRand(i, j, 90) < 0.28);
}
function uniqueTownName(i, j, realm) {
  const base = townName(i, j, realm);
  for (let dj = -8; dj <= 0; dj++) for (let di = -8; di <= 8; di++) {
    if (dj === 0 && di >= 0) continue;   // only towns that come earlier in reading order
    const i2 = i + di, j2 = j + dj;
    if (hasTown(i2, j2) && townName(i2, j2, realmAt(i2, j2)) === base) return `${NAME_QUALIFIERS[Math.floor(cellRand(i, j, 95) * NAME_QUALIFIERS.length)]} ${base}`;
  }
  return base;
}
function townName(i, j, realm = 'cantons') {
  const h = hash32(i * 7919, j * 104729, 4242);
  const [A, M, B] = REALM_NAMES[realm] || [SYL_A, SYL_M, SYL_B];
  return A[h % A.length] + M[Math.floor(h / 64) % M.length] + B[Math.floor(h / 4096) % B.length];
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
  grand:   { plaza: [16, 10], houses: [[12, 3, 16, 5, 'throne'], [3, 4, 7, 4, 'royal'], [31, 4, 6, 4, 'smithy'], [3, 22, 6, 4, 'armoury'], [31, 22, 6, 4, 'watch'], [14, 23, 6, 4, 'apothecary'], [22, 23, 6, 4, 'inn'], [32, 12, 5, 4, 'arena']], folk: [4, 6], walled: true },
};
const GRAND_CASTLE = { i: 2, j: -1 };
const REALM_SEATS = { cantons: ['council', 'townhall'], aurum: [null, 'herald'], kathar: ['longhouse', 'shamanhut'], league: ['exchange', 'exchange'] };
const REALM_ROOFS = { kathar: ['#a07a35', '#8c6a2c', '#b08840'], league: ['#4c2f7a', '#5b3a8b', '#3f2a63'], aurum: null, cantons: null };   // the King's seat, the only one of its kind
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
  const isCapital = REALM_ORDER.some((id) => REALMS[id].capital[0] === i && REALMS[id].capital[1] === j);
  if (!origin && !isCapital && !(i === GRAND_CASTLE.i && j === GRAND_CASTLE.j) && cellRand(i, j, 90) < 0.28) { towns.set(k, null); return null; }   // some cells are just wilderness
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
  const realm = realmAt(i, j), capitalOf = isCapital ? realm : null;
  // castles mostly belong to the Kingdom, and the Clans keep no walls
  let size = origin ? 'town' : grand ? 'grand' : capitalOf ? 'city' : sizeRoll < 0.3 ? 'village' : sizeRoll < 0.72 ? 'town' : sizeRoll < (realm === 'aurum' ? 0.8 : 0.88) ? 'city' : 'castle';
  if (size === 'castle' && realm === 'kathar') size = 'town';
  const def = TOWN_SIZES[size];
  const base = origin ? 'Hearth' : CAPITAL_NAMES[capitalOf] || uniqueTownName(i, j, realm);
  const name = grand ? 'Castle Aurum' : size === 'castle' ? `Castle ${base}` : base;
  const town = { key: k, i, j, name, size, realm, capital: !!capitalOf, plaza: def.plaza, walled: def.walled, cx, cy, x0, y0, houses: [], npcs: null, spawn: { x: cx, y: cy + 3 }, gate: { x: cx, y: y0 + (def.walled ? 26 : 28) }, folk: def.folk };
  // a specialist shop in every city, and in some towns in place of the home
  let plan = def.houses.map((h) => h.slice());
  if (!origin && !def.walled) {
    const special = SPECIAL_SHOPS[Math.floor(cellRand(i, j, 88) * SPECIAL_SHOPS.length)];
    if (size === 'city') plan = plan.map((h) => h[4] === 'market' ? [h[0], h[1], h[2], h[3], special] : h);
    else if (size === 'town' && cellRand(i, j, 87) < 0.4) plan = plan.map((h) => h[4] === 'home' ? [h[0], h[1], h[2], h[3], special] : h);
  }
  const seat = REALM_SEATS[realm][capitalOf ? 0 : 1];
  if (seat && size === 'town') plan.push([13, 22, 5, 4, seat]);
  else if (seat && size === 'city') plan = plan.map((h) => h[4] === 'cottage' ? [h[0], h[1], h[2], h[3], seat] : h);
  else if (seat && size === 'castle') plan.push([10, 22, 5, 4, seat]);
  const roof = REALM_ROOFS[realm];
  for (const [lx, ly, w, h, id] of plan) {
    town.houses.push({ x: x0 + lx, y: y0 + ly, w, h, id, doorX: x0 + lx + Math.floor(w / 2), doorY: y0 + ly + h - 1, town: k, ...BUILDINGS[id], ...(roof && !['throne', 'royal'].includes(id) ? { roof: roof[(lx + ly) % roof.length] } : {}) });
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
// ---------- what makes each town itself ----------
// A trade read from the land around it, a landmark in its square, and a named
// local leader with things to say about the place.
const TRADES = {
  fishing:   { label: 'fishing', famous: ['smoked eels', 'river pearls', 'fish stew', 'boats that never leak'], deal: 'potions' },
  salt:      { label: 'salt', famous: ['white salt from the pans', 'salted hams', 'pickled everything'], deal: 'potions' },
  mining:    { label: 'mining', famous: ['iron from the deep seams', 'miners who sing underground', 'cheap, honest steel'], deal: 'gear' },
  quarrying: { label: 'quarrying', famous: ['the grey stone of half the castles in the realm', 'master masons'], deal: null },
  timber:    { label: 'timber', famous: ['oak beams', 'longbows of yew', 'woodcarvings'], deal: null },
  hunting:   { label: 'hunting', famous: ['furs', 'tracking hounds', 'venison pies'], deal: 'potions' },
  farming:   { label: 'farming', famous: ['harvest fairs', 'golden wheat', 'the fattest pigs in the realm'], deal: 'potions' },
  wine:      { label: 'wine', famous: ['a red that stains the teeth', 'cellars older than the town', 'the autumn wine festival'], deal: null },
  wool:      { label: 'wool', famous: ['soft grey wool', 'sheepdog trials', 'warm cloaks'], deal: null },
  bees:      { label: 'beekeeping', famous: ['heather honey', 'honey mead', 'beeswax candles'], deal: 'potions' },
  pottery:   { label: 'pottery', famous: ['blue-glazed jars', 'kilns that burn all night'], deal: null },
  brewing:   { label: 'brewing', famous: ['dark ale', 'a brewery older than the Crown'], deal: null },
  horses:    { label: 'horse-breeding', famous: ['swift bay mares', 'the spring horse fair'], deal: 'horse' },
  smithing:  { label: 'smithing', famous: ['blades that hold an edge', 'the ring of a hundred anvils'], deal: 'gear' },
  glass:     { label: 'glassblowing', famous: ['coloured glass', 'mirrors for the Goldspire magnates'], deal: null },
  silk:      { label: 'silk', famous: ['silk from the southern traders', 'the finest tailors in the League'], deal: null },
};
const DEAL_TEXT = { potions: 'Potions and supplies are cheap here', gear: 'Weapons and armour are cheaper here', horse: 'Horses are a quarter cheaper at the stables here' };
const STATUE_OF = {
  cantons: ['Speaker Hollis the Founder', 'Bram the Mason', 'Old Mother Tansy', 'the First Council'],
  aurum: ['King Aurel the Founder', 'Queen Isolde the Wise', 'Sir Corvin of the Bridge', 'King Aldous the Builder'],
  kathar: ['Chieftain Varn the Tall'], league: ['Magnate Orlov the Elder', 'the Merchant Prince Callis', 'Lady Opaline Vess'],
};
const LANDMARKS = {
  statue:    { sprite: 'statue', name: (t, r) => `the statue of ${STATUE_OF[r][Math.floor(cellRand(t.i, t.j, 504) * STATUE_OF[r].length)]}`,
               lore: 'Pigeons sit on its head and children dare each other to climb it. A plaque lists the deeds of the one it shows, most of them true.' },
  oak:       { sprite: 'tree', name: () => 'the Moot Oak', lore: 'Disputes here are settled under its branches. The oak has heard every argument twice and agreed with none of them.' },
  well:      { sprite: 'well', name: () => 'the Old Well', lore: 'The water is cold and sweet. Locals swear the well is deeper than the dungeon, and nobody has ever checked.' },
  belltower: { sprite: 'belltower', name: () => 'the bell tower', lore: 'Its bell rings for weddings, fires and the change of the watch. It cracked once, and the town still argues about who did it.' },
  bonfire:   { sprite: 'bonfire', name: () => 'the Ever-Fire', lore: 'The clan fire has burned here since the town was founded. Each family adds a log at midwinter, and travellers are welcome to warm their hands.' },
  stones:    { sprite: 'stones', name: () => 'the Speaking Stones', lore: 'Elders gather at these stones to settle feuds. It is said that a lie told here makes the stones go cold.' },
  obelisk:   { sprite: 'obelisk', name: () => 'the Founders\' Column', lore: 'A column of polished stone carved with the names of the families who founded the town, and how much each of them paid.' },
};
const REALM_LANDMARKS = { cantons: ['statue', 'oak', 'well', 'belltower'], aurum: ['statue', 'belltower', 'obelisk', 'well'], kathar: ['bonfire', 'stones', 'oak'], league: ['obelisk', 'statue', 'well', 'belltower'] };
const LEADER_TITLES = { cantons: ['Reeve', 'Mayor'], aurum: ['Bailiff', 'Lord Mayor'], kathar: ['Elder', 'Headwoman'], league: ['Factor', 'Alderman'] };
const LEADER_NAMES = {
  cantons: ['Tobin', 'Marta', 'Hesketh', 'Wynn', 'Ada', 'Corran', 'Elsie', 'Pell'],
  aurum: ['Roderick', 'Isolde', 'Godfrey', 'Beatrix', 'Alaric', 'Matilda', 'Percival', 'Rosamund'],
  kathar: ['Druna', 'Vesk', 'Ottar', 'Kaela', 'Grom', 'Thessa', 'Brannoc', 'Ysra'],
  league: ['Callis', 'Opaline', 'Severin', 'Lucia', 'Marius', 'Vespera', 'Dorian', 'Celandine'],
};
function townIdentity(town) {
  if (town.identity) return town.identity;
  const i = town.i, j = town.j, realm = town.realm || realmAt(i, j);
  let water = 0, mountain = 0, forest = 0, sand = 0;
  for (let dy = -24; dy <= 24; dy += 4) for (let dx = -24; dx <= 24; dx += 4) {
    const g = terrainAt(town.cx + dx, town.cy + dy);
    if (g === GROUND.WATER) water++; else if (g === GROUND.MOUNTAIN) mountain++; else if (g === GROUND.FOREST || g === GROUND.TREE) forest++; else if (g === GROUND.SAND) sand++;
  }
  const cands = ['farming', 'wine', 'wool', 'bees', 'pottery', 'brewing', 'horses'];
  if (water >= 12) cands.push('fishing', 'fishing', 'fishing');
  if (sand >= 8 && water >= 8) cands.push('salt');
  if (mountain >= 2) cands.push('mining', 'mining', 'quarrying');
  if (forest >= 30) cands.push('timber', 'timber', 'hunting');
  if (realm === 'kathar') cands.push('hunting', 'hunting', 'horses');
  if (realm === 'league') cands.push('glass', 'silk', 'smithing');
  if (realm === 'aurum') cands.push('smithing', 'wine');
  if (realm === 'cantons') cands.push('farming', 'wool');
  const tradeId = cands[Math.floor(cellRand(i, j, 500) * cands.length)], trade = TRADES[tradeId];
  const famous = trade.famous[Math.floor(cellRand(i, j, 501) * trade.famous.length)];
  const lmIds = REALM_LANDMARKS[realm], lmId = lmIds[Math.floor(cellRand(i, j, 502) * lmIds.length)], L = LANDMARKS[lmId];
  const titles = LEADER_TITLES[realm], names = LEADER_NAMES[realm];
  const leader = `${titles[town.size === 'village' || town.size === 'town' ? 0 : 1]} ${names[Math.floor(cellRand(i, j, 503) * names.length)]}`;
  const sizeWord = town.size === 'grand' ? 'royal seat' : town.size === 'castle' ? 'castle town' : town.size;
  town.identity = { tradeId, trade, famous, landmark: { id: lmId, sprite: L.sprite, name: L.name(town, realm), lore: L.lore }, leader, sizeWord, realm,
    describe() { return `${town.name}: a ${trade.label} ${sizeWord} of the ${REALMS[realm].name}, known for ${famous}. ${this.landmark.name[0].toUpperCase() + this.landmark.name.slice(1)} stands in the square.${trade.deal ? ' ' + DEAL_TEXT[trade.deal] + '.' : ''}`; } };
  return town.identity;
}
// The town a shop belongs to, for local prices.
function shopTown() {
  if (scene === 'house' && interior && interior.house && interior.house.town) return townAt(...interior.house.town.split(',').map(Number));
  return scene === 'world' ? townContaining(player.x, player.y) : null;
}
function localDeal(id) {
  const t = shopTown(); if (!t) return 1;
  const deal = townIdentity(t).trade.deal;
  if (deal === 'potions' && ITEMS.consumables[id]) return 0.85;
  if (deal === 'gear' && (ITEMS.weapons[id] || ITEMS.armor[id])) return 0.9;
  return 1;
}
// The town's leader stands in the square with things to say about the place.
function leaderNpc(town) {
  const I = townIdentity(town);
  const site = nearbySites(town.cx, town.cy, 1).filter((st) => !st.deep).sort((a, b) => cheb(a, { x: town.cx, y: town.cy }) - cheb(b, { x: town.cx, y: town.cy }))[0];
  const place = nearbyPlaces(town.cx, town.cy, 1).sort((a, b) => cheb(a, { x: town.cx, y: town.cy }) - cheb(b, { x: town.cx, y: town.cy }))[0];
  const lines = [
    `Welcome to ${town.name}. We are a ${I.trade.label} ${I.sizeWord}, and folk come from all over for ${I.famous}.`,
    `Have you seen ${I.landmark.name}? ${I.landmark.lore}`,
  ];
  if (site) lines.push(`${site.name.startsWith('The ') ? site.name : 'The ' + site.name} lies ${compassWord(site.x - town.cx, site.y - town.cy).toLowerCase()} of here. ${site.danger >= 3 ? 'Folk who go in there do not always come out.' : 'Our young ones dare each other to go in.'}`);
  if (place) lines.push(`If you are walking ${compassWord(place.x - town.cx, place.y - town.cy).toLowerCase()}, look out for ${place.name}.`);
  if (I.trade.deal) lines.push(`${DEAL_TEXT[I.trade.deal]}. Tell them ${I.leader} sent you.`);
  return { sprite: I.realm === 'league' ? 'merchant' : I.realm === 'aurum' ? 'guard' : 'elder', name: `${I.leader} of ${town.name}`, lines, leader: true };
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
  if (wx === town.cx + 4 && wy === town.cy) { t = TILE.WAYSTONE; g = GROUND.COBBLE; }
  if (wx === town.cx - 6 && wy === town.cy - 2) { t = TILE.MONUMENT; g = GROUND.COBBLE; }
  return [t, g];
}
// Special dungeons out in the country: one in roughly half the lattice cells,
// kept clear of the cell's town and joined to the nearest town by a trail.
const sites = new Map();
function siteAt(i, j) {
  const k = key(i, j);
  if (sites.has(k)) return sites.get(k);
  if (i === DEEP_CELL[0] && j === DEEP_CELL[1]) {
    let x = i * TOWN_SPACING + 48, y = j * TOWN_SPACING + 70;
    const town = townAt(i, j);
    if (town && x >= town.x0 - 3 && x < town.x0 + TW + 3 && y >= town.y0 - 3 && y < town.y0 + TH + 3) y = town.y0 + TH + 10;
    const site = { key: k, i, j, x, y, type: 'deep', name: 'The Gate of the Deep', floors: 99, danger: 5, sprite: 'abyss', deep: true };
    sites.set(k, site);
    return site;
  }
  if (STORY_AT[k]) {
    const id = STORY_AT[k], S = STORY_SITES[id];
    let x = i * TOWN_SPACING + 12 + Math.floor(cellRand(i, j, 302) * 70), y = j * TOWN_SPACING + 10 + Math.floor(cellRand(i, j, 303) * 70);
    const town = townAt(i, j);
    if (town && x >= town.x0 - 3 && x < town.x0 + TW + 3 && y >= town.y0 - 3 && y < town.y0 + TH + 3) x = town.x0 + TW + 12;
    const site = { key: k, i, j, x, y, type: S.type, name: S.title, floors: S.floors, danger: S.danger, sprite: SITE_TYPES[S.type].sprite, story: id };
    sites.set(k, site);
    return site;
  }
  if (cellRand(i, j, 300) > 0.55) { sites.set(k, null); return null; }
  const types = Object.keys(SITE_TYPES).filter((t) => t !== 'deep');
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
  // landmarks on a small clearing
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const pl = placeAt(i, j);
    if (!pl) continue;
    for (let yy = pl.y - 1; yy <= pl.y + 1; yy++) for (let xx = pl.x - 1; xx <= pl.x + 1; xx++) {
      const lx = xx - ox, ly = yy - oy;
      if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) continue;
      if (xx === pl.x && yy === pl.y) { tiles[ly * CHUNK + lx] = TILE.PLACE; gr[ly * CHUNK + lx] = GROUND.GRASS; }
      else if (tiles[ly * CHUNK + lx] === TILE.WALL) { tiles[ly * CHUNK + lx] = TILE.FLOOR; gr[ly * CHUNK + lx] = GROUND.GRASS; }
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
  if (town.size !== 'grand' && spots.length) {
    const cell = spots.splice(Math.floor(cellRand(town.i, town.j, 505) * spots.length), 1)[0];
    town.npcs.push({ ...cell, type: leaderNpc(town), pause: rnd(3), home: { x: town.cx, y: town.cy } });
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
  floorMod = null;
  mp.instance = null;
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
  if (n.type.name === 'King Aldric') { unlock('royal'); if (storyKing()) return; }
  if (realmQuestTalk(n)) return;
  if (n.type.action && SERVICE_SHOPS.has(n.type.action)) { log(`${n.type.name}: ${n.type.lines[rnd(n.type.lines.length)]}`); openShop(n.type.action); return; }
  const line = n.type.lines[rnd(n.type.lines.length)];
  log(`${n.type.name}: ${line}`);
  bubble = { x: n.x, y: n.y, text: line, until: performance.now() + 4000 };
  if (n.type.action === 'inn') openShop('inn');
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
  if (d.sprite === 'counter' && id === 'inn') return openShop('inn');
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
// The arena floor: one open ring of sand with four pillars, and solid rock around it.
function arenaChunk(cx, cy) {
  const tiles = new Uint8Array(CHUNK * CHUNK).fill(TILE.WALL), rooms = [];
  if (cx === 0 && cy === 0) {
    const room = { x: 8, y: 10, w: 17, h: 11, cx: 16, cy: 15 };
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) tiles[y * CHUNK + x] = TILE.FLOOR;
    for (const [x, y] of [[11, 12], [21, 12], [11, 18], [21, 18]]) tiles[y * CHUNK + x] = TILE.WALL;
    rooms.push(room);
  }
  return { cx, cy, tiles, seen: new Uint8Array(CHUNK * CHUNK), rooms, vaults: [], populated: true };
}
function generateChunk(cx, cy) {
  if (dungeonDef && dungeonDef.arena) return arenaChunk(cx, cy);
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
  if (thm().lava) {
    rooms.forEach((rm, i) => {
      if ((cx === 0 && cy === 0 && i === 0) || rand() > 0.55 || rm.w < 4 || rm.h < 3) return;
      const pw = 2 + r(2), ph = 2, px = rm.x + r(Math.max(1, rm.w - pw)), py = rm.y + r(Math.max(1, rm.h - ph));
      for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) if (!(xx === rm.cx && yy === rm.cy) && tiles[at(xx, yy)] === TILE.FLOOR) tiles[at(xx, yy)] = TILE.LAVA;
    });
  }
  // a secret vault: a sealed 3x3 room behind a cracked wall, above or below a room
  const vaults = [];
  if (rand() < 0.3) {
    for (let tries = 0; tries < 12 && !vaults.length; tries++) {
      const rm = rooms[r(rooms.length)];
      if (cx === 0 && cy === 0 && rm === rooms[0]) continue;
      const up = rand() < 0.5, dx = rm.x + r(rm.w), dy = up ? rm.y - 1 : rm.y + rm.h, vy = up ? dy - 2 : dy + 2;
      let solid = true;
      for (let yy = vy - 2; yy <= vy + 2 && solid; yy++) for (let xx = dx - 2; xx <= dx + 2; xx++) {
        if (xx < 1 || yy < 1 || xx >= CHUNK - 1 || yy >= CHUNK - 1 || tiles[at(xx, yy)] !== TILE.WALL) { solid = false; break; }
      }
      if (!solid) continue;
      for (let yy = vy - 1; yy <= vy + 1; yy++) for (let xx = dx - 1; xx <= dx + 1; xx++) carve(xx, yy);
      tiles[at(dx, dy)] = TILE.CRACK;
      vaults.push({ x: dx, y: vy });
    }
  }
  // a healing spring in a quiet room now and then
  if (!(cx === 0 && cy === 0) && rand() < 0.14) {
    const rm = rooms[r(rooms.length)];
    if (rm.w >= 4 && rm.h >= 3 && tiles[at(rm.cx, rm.cy)] === TILE.FLOOR) tiles[at(rm.cx, rm.cy)] = TILE.SPRING;
  }
  // dressing: bones and torches recorded as deterministic noise at draw time
  const chunk = { cx, cy, tiles, seen, rooms, vaults, populated: false };
  populateChunk(chunk, rand);
  return chunk;
}

// Monsters, potions, gold and sometimes a merchant for a freshly dug chunk.
function populateChunk(chunk, rand) {
  const r = (n) => Math.floor(rand() * n);
  const ox = chunk.cx * CHUNK, oy = chunk.cy * CHUNK;
  const cells = [];
  const inVault = (x, y) => (chunk.vaults || []).some((v) => Math.abs(v.x - x) <= 1 && Math.abs(v.y - y) <= 1);
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) if (chunk.tiles[y * CHUNK + x] === TILE.FLOOR && !inVault(x, y)) cells.push({ x: ox + x, y: oy + y });
  const spawnChunk = chunk.cx === 0 && chunk.cy === 0;
  const def = dungeonDef || { pool: null, gold: 1, potions: 1, danger: 0 };
  // vault treasure: a chest in the middle and gold in the corners
  for (const v of chunk.vaults || []) {
    chunk.tiles[v.y * CHUNK + v.x] = TILE.CHEST;
    for (const [ddx, ddy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (rand() < 0.75) golds.push({ x: ox + v.x + ddx, y: oy + v.y + ddy, amount: Math.round((15 + r(15) + floor * 5) * (def.gold || 1)) });
    if (rand() < 0.5) potions.push({ x: ox + v.x, y: oy + v.y + 1, heal: 5 });
  }
  const pool = def.pool || MONSTER_TYPES.filter((t) => !t.noSpawn && t.minFloor <= floor);
  const danger = def.danger || 0;
  const take = () => cells.splice(r(cells.length), 1)[0];
  const mCount = Math.min(cells.length / (floorMod === 'swarming' ? 7 : 10), (6 + floor * 2 + r(4)) * (floorMod === 'swarming' ? 1.5 : 1));
  for (let i = 0; i < mCount && cells.length; i++) {
    const cell = take();
    if (spawnChunk && dist(cell, { x: ox + CHUNK / 2, y: oy + CHUNK / 2 }) < 7) continue;
    const t = pool[r(pool.length)];
    const hp = t.hp + Math.floor(floor / 2) + danger;
    monsters.push({ ...cell, id: `${chunk.cx},${chunk.cy}#${i}`, type: t, hp, maxHp: hp, atk: t.atk + Math.floor(danger / 2), awake: false });
    if (rand() < (0.07 + 0.01 * floor) * (floorMod === 'cursed' ? 3 : 1)) makeElite(monsters[monsters.length - 1], rand());
    monstersDirty = true;
  }
  for (let i = 0; i < Math.round((2 + r(3)) * def.potions) && cells.length; i++) potions.push({ ...take(), heal: 5 });
  // a chest or two in the rooms, and spike traps in the corridors
  for (let i = 0; i < 1 + r(2) + (floorMod === 'treasure' ? 1 : 0) && chunk.rooms.length; i++) {
    const room = chunk.rooms[r(chunk.rooms.length)];
    const x = ox + room.x + r(room.w), y = oy + room.y + r(room.h);
    if (chunk.tiles[(y - oy) * CHUNK + (x - ox)] === TILE.FLOOR && !(spawnChunk && dist({ x, y }, { x: ox + room.cx, y: oy + room.cy }) < 2)) chunk.tiles[(y - oy) * CHUNK + (x - ox)] = TILE.CHEST;
  }
  for (let i = 0; i < 1 + r(3) && cells.length; i++) {
    const c = take();
    const inRoom = chunk.rooms.some((rm) => c.x >= ox + rm.x && c.x < ox + rm.x + rm.w && c.y >= oy + rm.y && c.y < oy + rm.y + rm.h);
    if (!inRoom && !(spawnChunk && dist(c, { x: ox + CHUNK / 2, y: oy + CHUNK / 2 }) < 8)) chunk.tiles[(c.y - oy) * CHUNK + (c.x - ox)] = TILE.TRAP;
  }
  for (let i = 0; i < (5 + floor + r(4)) * (floorMod === 'treasure' ? 2 : 1) && cells.length; i++) golds.push({ ...take(), amount: Math.round((5 + r(10) + floor * 2) * def.gold * (floorMod === 'dark' ? 2 : 1)) });
  if ((spawnChunk || rand() < 0.2) && chunk.rooms.length) {
    const room = chunk.rooms[spawnChunk ? 0 : r(chunk.rooms.length)];
    const sx = ox + room.x + r(room.w), sy = oy + room.y + r(room.h);
    if (!(spawnChunk && sx === ox + room.cx && sy === oy + room.cy)) {
      chunk.tiles[(sy - oy) * CHUNK + (sx - ox)] = TILE.SHOP;
      shops.push({ x: sx, y: sy });
    }
  }
}

// Some floors have a twist, chosen by the floor's seed and shown on arrival.
const FLOOR_MODS = {
  dark:     { label: 'Dark floor', desc: 'you see three tiles less, but every gold pile is doubled' },
  swarming: { label: 'Swarming', desc: 'half again as many monsters, and 25% more XP' },
  treasure: { label: 'Treasure floor', desc: 'extra gold and chests' },
  cursed:   { label: 'Cursed', desc: 'elites everywhere, and 50% more XP' },
};
let floorMod = null;
const viewRadius = () => Math.max(3, (dungeonDef ? dungeonDef.view : VIEW_RADIUS) + (wearing('sunstone') ? 3 : 0) - (scene === 'dungeon' && floorMod === 'dark' ? 3 : 0));
function pickTheme() {
  if (dungeonDef && dungeonDef.theme) return dungeonDef.theme;
  if (dungeonDef && dungeonDef.endless) return DEEP_THEMES[(floor - 1) % DEEP_THEMES.length];
  if (dungeonDef && dungeonDef.kind === 'site') return { cave: 'moss', warren: 'stone', crypt: 'bone', tower: 'arcane' }[dungeonDef.site.type] || 'stone';
  return ['stone', 'moss', 'flooded', 'bone', 'lava'][Math.min(4, Math.max(0, floor - 1))];
}
function createDungeon() {
  scene = 'dungeon';
  bounded = null; ground = null; decor = null; houses = []; npcs = []; interior = null;
  chunks = new Map(); monsters = []; potions = []; golds = []; shops = []; monstersDirty = true; revealedTraps = new Set();
  // a party's run digs every floor from the same seed, so all of them see the same cave
  floorSeed = mp.instance ? hash32(mp.instance.seed, floor, 7) : hash32(Date.now() & 0xffff, floor, rnd(1e6));
  mp.dead = new Set(); mp.graveyard = new Map();
  theme = pickTheme();
  { const roll = hash32(floorSeed, 99) % 100, gentle = floor === 1 && !(dungeonDef && dungeonDef.danger);
    floorMod = !gentle && !(dungeonDef && dungeonDef.arena) && roll < 36 ? ['dark', 'swarming', 'treasure', 'cursed'][roll % 4] : null; }
  const R = seededRandom(hash32(floorSeed, 4242));
  const spawn = getChunk(0, 0);
  player.x = spawn.rooms[0].cx; player.y = spawn.rooms[0].cy;
  wayoutWarned = -99; crackHits.clear(); usedSprings.clear();
  { const room = spawn.rooms[0]; setTile(room.x, room.y, TILE.WAYOUT); monsters = monsters.filter((m) => !(m.x === room.x && m.y === room.y)); }
  if (dungeonDef && dungeonDef.arena) { exit = null; return; }
  // The stairs down: a few chunks away in a direction fixed by the seed, in that chunk's first room.
  const angle = R() * Math.PI * 2, far = 2 + Math.floor(R() * 2);
  const ex = Math.round(Math.cos(angle) * far) || 2, ey = Math.round(Math.sin(angle) * far);
  const target = getChunk(ex, ey);
  exit = { x: ex * CHUNK + target.rooms[0].cx, y: ey * CHUNK + target.rooms[0].cy };
  setTile(exit.x, exit.y, TILE.EXIT);
  monsters = monsters.filter((m) => !(m.x === exit.x && m.y === exit.y)); monstersDirty = true;
  if (floor === (dungeonDef ? dungeonDef.floors : FINAL_FLOOR) || (dungeonDef && dungeonDef.endless && floor % 5 === 0)) {
    placeBoss(target.rooms[0], ex * CHUNK, ey * CHUNK, R);
    setTimeout(() => { log(`Something large guards the stairs on this floor. Kill it to break the seal.`, 'bad'); sfx.play('boss'); }, 50);
  }
}

// ---------- visibility and pathing ----------
// Breadth-first distances from a point, out to a limit. Returns a Map of "x,y" -> steps.
function bfs(sx, sy, limit, blockMonsters, avoidHazards = false) {
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
      if (avoidHazards && hazard(nx, ny)) continue;
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
  const d = bfs(player.x, player.y, viewRadius(), false);
  for (const k of d.keys()) {
    visible.add(k);
    const [x, y] = k.split(',').map(Number);
    markSeen(x, y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!walkable(getTile(x + dx, y + dy))) { visible.add(key(x + dx, y + dy)); markSeen(x + dx, y + dy); }
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
  if (hound) ease(hound);
  for (const o of mp.players.values()) { ease(o); if (o.hound) ease(o.hound); }
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

function drawBrick(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y;
  const faceBelow = walkable(getTile(c, r + 1));   // a wall with floor below shows its face
  const th = thm();
  if (faceBelow) {
    g.fillStyle = th.face; g.fillRect(X, Y, T, T);
    g.fillStyle = th.cap; g.fillRect(X, Y, T, 6);            // the lit cap
    g.fillStyle = th.capHi; g.fillRect(X, Y, T, 1);
    const shades = th.bricks;
    for (let row = 0; row < 3; row++) {
      const by = Y + 6 + row * 8, shift = (row + c) % 2 ? 8 : 0;
      for (let bx = -16; bx < T; bx += 16) {
        const x0 = Math.max(X, X + bx + shift), x1 = Math.min(X + T, X + bx + shift + 16);
        if (x1 <= x0) continue;
        g.fillStyle = shades[Math.floor(noise(c * 4 + Math.floor((bx + shift) / 16) + 1, r * 3 + row, 51) * shades.length)];
        g.fillRect(x0, by, x1 - x0 - 1, 7);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x0, by, x1 - x0 - 1, 1);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X, Y + T - 3, T, 3);
  } else {
    const n = noise(c, r, 1);
    g.fillStyle = n < 0.5 ? th.top[0] : th.top[1]; g.fillRect(X, Y, T, T);
    g.fillStyle = 'rgba(255,255,255,0.035)';
    if (n < 0.3) g.fillRect(X + 6, Y + 9, 5, 3); else if (n < 0.6) g.fillRect(X + 19, Y + 20, 6, 3);
    // a pale rim where the wall top meets open floor
    g.fillStyle = th.rim;
    if (walkable(getTile(c, r - 1))) g.fillRect(X, Y, T, 2);
    if (walkable(getTile(c - 1, r))) g.fillRect(X, Y, 2, T);
    if (walkable(getTile(c + 1, r))) g.fillRect(X + T - 2, Y, 2, T);
  }
}
function drawStone(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 7), m = noise(c, r, 8), th = thm();
  g.fillStyle = th.floor[n < 0.33 ? 0 : n < 0.66 ? 1 : 2]; g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(X + 1, Y + 1, T - 2, T / 2 - 2);
  // flagstones laid in offset courses
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(X, Y + T / 2 - 1, T, 1); g.fillRect(X, Y + T - 1, T, 1);
  const s1 = (c + r) % 2 ? T / 2 : T / 4;
  g.fillRect(X + s1, Y, 1, T / 2); g.fillRect(X + ((s1 + T / 2) % T), Y + T / 2, 1, T / 2);
  if (m < 0.1) { g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 7; k++) g.fillRect(X + 8 + k * 2, Y + 6 + k + (k % 2), 2, 1); }
  else if (m < 0.1 + th.moss) { g.fillStyle = 'rgba(96,150,80,0.32)'; g.fillRect(X + 3, Y + T - 9, 9, 4); g.fillRect(X + 6, Y + T - 12, 5, 3); }
  if (th.puddles && noise(c, r, 91) < 0.18) { g.fillStyle = 'rgba(96,165,250,0.28)'; g.beginPath(); g.ellipse(X + T / 2, Y + T / 2 + 3, 11, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(219,234,254,0.25)'; g.fillRect(X + 10, Y + T / 2 + 1, 6, 1); }
  if (th.runes && noise(c, r, 93) < 0.05) { g.strokeStyle = 'rgba(167,139,250,0.45)'; g.lineWidth = 1; g.strokeRect(X + 9, Y + 9, 14, 14); g.beginPath(); g.moveTo(X + 16, Y + 9); g.lineTo(X + 16, Y + 23); g.moveTo(X + 9, Y + 16); g.lineTo(X + 23, Y + 16); g.stroke(); }
}
function drawLava(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 95);
  g.fillStyle = n < 0.5 ? '#b3361a' : '#c2411f'; g.fillRect(X, Y, T, T);
  g.fillStyle = '#ff7a1a'; g.fillRect(X + 4 + (n * 10 | 0), Y + 6, 9, 4); g.fillRect(X + 16, Y + 18 - (n * 6 | 0), 10, 4);
  g.fillStyle = '#ffd166'; g.fillRect(X + 8 + (n * 12 | 0), Y + 8, 3, 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  if (getTile(c, r - 1) !== TILE.LAVA) g.fillRect(X, Y, T, 3);
  if (getTile(c - 1, r) !== TILE.LAVA) g.fillRect(X, Y, 3, T);
}
// Shade the edges of a floor tile that sit against walls, for depth.
function floorShade(g, c, r, wall) {
  const X = c * T - off.x, Y = r * T - off.y;
  if (wall(c, r - 1)) { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(X, Y, T, 4); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y + 4, T, 4); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(X, Y + 8, T, 4); }
  if (wall(c - 1, r)) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X, Y, 3, T); g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(X + 3, Y, 3, T); }
  if (wall(c + 1, r)) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X + T - 3, Y, 3, T); }
}
// Plazas in each realm: Cantons grey cobbles, Kingdom sandstone, Clan packed earth, League marble.
const PAVING = {
  cantons: ['#4b5563', '#6b7280', '#5e6672', '#737b88'],
  aurum: ['#6b5a3f', '#a08a62', '#937d58', '#ab9670'],
  kathar: ['#5c4430', '#7a5c3d', '#6f5236', '#84653f'],
  league: ['#8a8698', '#d6d3e0', '#c8c4d6', '#e4e1ec'],
};
function drawCobble(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, q = T / 2;
  const P = PAVING[scene === 'world' ? realmOfTile(c, r) : 'cantons'];
  g.fillStyle = P[0]; g.fillRect(X, Y, T, T);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const n = noise(c * 2 + i, r * 2 + j, 3);
    g.fillStyle = n < 0.33 ? P[1] : n < 0.66 ? P[2] : P[3];
    g.fillRect(X + i * q + 2, Y + j * q + 2, q - 4, q - 4);
  }
}
function drawGrass(g, c, r, forest = false) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 11);
  // large soft patches from value noise so the field is not a checkerboard
  const v = valueNoise(c, r, 61, 6);
  g.fillStyle = forest ? (v < 0.5 ? '#2d5b2a' : '#336a30') : (v < 0.33 ? '#3c7837' : v < 0.66 ? '#418239' : '#468b3e');
  g.fillRect(X, Y, T, T);
  for (let k = 0; k < 6; k++) {
    const bx = X + 2 + Math.floor(noise(c * 7 + k, r, 41) * 27), by = Y + 3 + Math.floor(noise(c, r * 7 + k, 43) * 24);
    g.fillStyle = k % 3 === 0 ? (forest ? '#244a22' : '#33692f') : (forest ? '#3f7d3a' : '#5aa352');
    g.fillRect(bx, by, 1, 3); g.fillRect(bx + 1, by + 1, 1, 2);
  }
  if (n < 0.05 && !forest) { g.fillStyle = '#8b8f86'; g.fillRect(X + 18, Y + 20, 4, 3); g.fillStyle = '#a3a79c'; g.fillRect(X + 18, Y + 20, 3, 1); }
}
function drawWater(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 21);
  // shallows hug the shore, then a middle band, then deep water with soft variation
  let near = false, mid = false;
  for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (groundAt(c + dx, r + dy) !== GROUND.WATER) { near = true; break; }
  if (!near) for (let dy = -2; dy <= 2 && !mid; dy++) for (let dx = -2; dx <= 2; dx++) if ((Math.abs(dx) === 2 || Math.abs(dy) === 2) && groundAt(c + dx, r + dy) !== GROUND.WATER) { mid = true; break; }
  g.fillStyle = near ? '#2563eb' : mid ? '#1d4ed8' : (valueNoise(c, r, 71, 5) < 0.5 ? '#1e40af' : '#1c3a96');
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(96,165,250,0.6)';
  if (n < 0.3) g.fillRect(X + 6, Y + 10, 10, 2); else if (n < 0.55) g.fillRect(X + 16, Y + 22, 10, 2);
  // foam along every edge that meets land
  const wet = (dx, dy) => groundAt(c + dx, r + dy) === GROUND.WATER;
  g.fillStyle = 'rgba(219,234,254,0.7)';
  if (!wet(0, -1)) g.fillRect(X, Y, T, 3);
  if (!wet(0, 1)) g.fillRect(X, Y + T - 3, T, 3);
  if (!wet(-1, 0)) g.fillRect(X, Y, 3, T);
  if (!wet(1, 0)) g.fillRect(X + T - 3, Y, 3, T);
  g.fillStyle = 'rgba(191,219,254,0.3)';
  if (!wet(0, -1)) g.fillRect(X, Y + 3, T, 3);
  if (!wet(-1, 0)) g.fillRect(X + 3, Y, 3, T);
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
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(X + 8, Y + 10, W, H);   // shadow cast down and right
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
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(X, Y, T, 2);
        floorShade(g, c, r, (x, y) => x < 0 || y < 0 || x >= bounded.w || y >= bounded.h || bounded.tiles[y][x] === TILE.WALL);
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
      else if (gnd === GROUND.FOREST || gnd === GROUND.TREE) {
        drawGrass(g, c, r, true);
        if (gnd === GROUND.TREE) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(c * T - off.x + T / 2 + 4, r * T - off.y + T - 4, T * 0.42, 6, 0, 0, Math.PI * 2); g.fill(); drawSprite(g, 'tree', c, r, 1, 1); }
      }
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
      if (t === TILE.WAYSTONE) drawSprite(g, 'waystone', c, r, 1, 0);
      if (t === TILE.PLACE) { const pl = placeAtTile(c, r); if (pl) drawSprite(g, pl.sprite, c, r, 1, 0); }
      if (t === TILE.MONUMENT) { const tw = townContaining(c, r); if (tw) drawSprite(g, townIdentity(tw).landmark.sprite, c, r, 1, 0); }
    }
    for (const pl of nearbyPlaces(player.x, player.y, 1)) {
      if (!discovered(pl) || pl.x < x0 || pl.x > x1 || pl.y < y0 || pl.y > y1) continue;
      g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const label = pl.name[0].toUpperCase() + pl.name.slice(1), w = g.measureText(label).width + 10;
      g.fillStyle = 'rgba(6,12,20,0.6)'; g.fillRect(pl.x * T - off.x + T / 2 - w / 2, pl.y * T - off.y - 18, w, 15);
      g.fillStyle = '#9fd4ff'; g.fillText(label, pl.x * T - off.x + T / 2, pl.y * T - off.y - 5);
      g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    }
    for (const st of nearbySites(player.x, player.y, 1)) {
      if (st.x < x0 || st.x > x1 || st.y < y0 || st.y > y1) continue;
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const rt = rating(siteDungeon(st)), sub = `Lv ${rt.rec}+ · ${rt.label}`;
      const w = Math.max(g.measureText(st.name).width, g.measureText(sub).width) + 12;
      g.fillStyle = 'rgba(6,12,20,0.7)'; g.fillRect(st.x * T - off.x + T / 2 - w / 2, st.y * T - off.y - 34, w, 30);
      g.fillStyle = '#c084fc'; g.fillText(st.name, st.x * T - off.x + T / 2, st.y * T - off.y - 20);
      g.fillStyle = rt.color; g.fillText(sub, st.x * T - off.x + T / 2, st.y * T - off.y - 6);
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
    else if (t === TILE.CRACK) {
      drawBrick(g, c, r);
      const X = c * T - off.x, Y = r * T - off.y;
      g.strokeStyle = 'rgba(10,10,15,0.85)'; g.lineWidth = 2; g.beginPath();
      g.moveTo(X + 8, Y + 4); g.lineTo(X + 14, Y + 12); g.lineTo(X + 11, Y + 18); g.lineTo(X + 18, Y + 26);
      g.moveTo(X + 14, Y + 12); g.lineTo(X + 23, Y + 10); g.moveTo(X + 11, Y + 18); g.lineTo(X + 5, Y + 22); g.stroke();
    }
    else if (t === TILE.LAVA) drawLava(g, c, r);
    else {
      drawStone(g, c, r);
      floorShade(g, c, r, (x, y) => getTile(x, y) === TILE.WALL);
      if (t === TILE.FLOOR && noise(c, r, 13) < thm().bones) drawSprite(g, 'bones', c, r, 0.8);
      if (t === TILE.EXIT) drawSprite(g, 'stairs', c, r);
      if (t === TILE.SPRING) {
        const X = c * T - off.x, Y = r * T - off.y, dry = usedSprings.has(key(c, r));
        g.fillStyle = '#4b5563'; g.beginPath(); g.ellipse(X + T / 2, Y + T / 2 + 2, T / 2 - 1, T / 2 - 5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = dry ? '#374151' : '#38bdf8'; g.beginPath(); g.ellipse(X + T / 2, Y + T / 2 + 2, T / 2 - 5, T / 2 - 9, 0, 0, Math.PI * 2); g.fill();
        if (!dry) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(X + 10, Y + 13, 6, 2); g.fillRect(X + 18, Y + 18, 4, 2); }
      }
      if (t === TILE.WAYOUT) { g.fillStyle = 'rgba(255,216,107,0.18)'; g.fillRect(c * T - off.x - 4, r * T - off.y - 4, T + 8, T + 8); drawSprite(g, 'wayout', c, r); }
      if (t === TILE.SHOP) { g.fillStyle = 'rgba(192,132,252,0.25)'; g.fillRect(c * T - off.x, r * T - off.y, T, T); }
      if (t === TILE.CHEST) drawSprite(g, 'chest', c, r, 1, 4);
      if (t === TILE.TRAP && revealedTraps.has(key(c, r))) drawSprite(g, 'trap', c, r, 1, 2);
    }
  }
  // remembered but not currently seen: dimmed (the live light map does the rest)
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
    if (!wasSeen(c, r) || visible.has(key(c, r))) continue;
    g.fillStyle = 'rgba(4,10,18,0.5)'; g.fillRect(c * T - off.x, r * T - off.y, T, T);
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
  const where = scene === 'house' ? interior.house.name : inTown() ? `${townContaining(player.x, player.y)?.name ?? 'The wilds'}, ${REALMS[realmOfTile(player.x, player.y)].short} · day ${dayNumber()}, ${dayPhase()}` : `${dungeonDef ? dungeonDef.name : 'Dungeon'} ${floorText()}${dungeonDef ? ` · Lv ${recLevel(dungeonDef)}+` : ''}${floorMod ? ` · ${FLOOR_MODS[floorMod].label}` : ''}`;
  const compact = canvas.width < 560;
  const text = compact
    ? `HP ${player.hp}/${player.maxHp}  ATK ${player.atk + weaponAtk()}  DEF ${armorDef()}  Lv ${player.level}  ${player.gold}g`
    : `${where}   HP ${player.hp}/${player.maxHp}   ATK ${player.atk + weaponAtk()}   DEF ${armorDef()}   Lv ${player.level}   Gold ${player.gold}`;
  g.font = compact ? 'bold 11px sans-serif' : 'bold 13px sans-serif';
  const w = g.measureText(text).width + 20;
  g.fillStyle = 'rgba(6,12,20,0.78)';
  g.beginPath(); g.roundRect(8, 8, w, 40, 6); g.fill();
  g.fillStyle = '#0b2033'; g.fillRect(18, 40, w - 20, 3);
  g.fillStyle = '#7bdfff'; g.fillRect(18, 40, (w - 20) * Math.min(1, player.xp / xpToNext(player.level)), 3);
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
  const obj = scene !== 'dungeon' ? storyObjective() : null;
  let qOffset = 0;
  if (obj) {
    g.font = 'bold 12px sans-serif';
    let ot = `★ ${obj.text}`; while (g.measureText(ot).width > canvas.width - 40 && ot.length > 12) ot = ot.slice(0, -4) + '…';
    const oy = canvas.width < 560 ? 84 : 74;
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, oy, g.measureText(ot).width + 20, 20, 5); g.fill();
    g.fillStyle = '#ffd86b'; g.fillText(ot, 18, oy + 4);
    qOffset = 24;
  }
  const q = player.quests && questsActive()[0];
  if (q) {
    g.font = '12px sans-serif';
    const qt = `Quest: ${q.label}  ${q.have}/${q.need}${questsActive().length > 1 ? `  (+${questsActive().length - 1} more, Q)` : '  (Q)'}`;
    const qy = (canvas.width < 560 ? 84 : 74) + qOffset;
    let qtext = qt; while (g.measureText(qtext).width > canvas.width - 40 && qtext.length > 12) qtext = qtext.slice(0, -4) + '…';
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, qy, Math.min(canvas.width - 16, g.measureText(qtext).width + 20), 20, 5); g.fill();
    g.fillStyle = '#9ef0b0'; g.fillText(qtext, 18, qy + 4);
  }
  // compass: to the stairs in the dungeon, to the next town outdoors
  const target = scene === 'dungeon' ? exit : (inTown() ? (() => { if (mapPin) return { x: mapPin.x, y: mapPin.y, name: 'Pin' }; const o = storyObjective(); if (o) return { x: o.x, y: o.y, name: `★ ${o.short}` }; const t = nearestOtherTown(player.x, player.y); return t ? { x: t.cx, y: t.cy, name: t.name } : null; })() : null);
  if (target) {
    const dx = target.x - player.x, dy = target.y - player.y, d = Math.abs(dx) + Math.abs(dy);
    const what = scene === 'dungeon' ? (bossAlive() ? 'Stairs (sealed)' : 'Stairs') : target.name;
    const label = d === 0 ? `${what}: here` : `${what} ${Math.abs(dy) > Math.abs(dx) / 2 ? (dy < 0 ? 'N' : 'S') : ''}${Math.abs(dx) > Math.abs(dy) / 2 ? (dx < 0 ? 'W' : 'E') : ''}  ${d} tiles`;
    g.font = canvas.width < 560 ? 'bold 11px sans-serif' : 'bold 12px sans-serif';
    const cw = g.measureText(label).width + 36;
    const bx = canvas.width - cw - 8, cy0 = canvas.width < 560 ? 50 : 8;   // second row on narrow screens
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(bx, cy0, cw, 28, 6); g.fill();
    g.fillStyle = '#5fe17a'; g.fillText(label, bx + 30, cy0 + 7);
    // arrow
    const ang = Math.atan2(dy, dx), ax = bx + 16, ay = cy0 + 14;
    g.strokeStyle = '#5fe17a'; g.lineWidth = 2; g.beginPath();
    g.moveTo(ax - Math.cos(ang) * 7, ay - Math.sin(ang) * 7); g.lineTo(ax + Math.cos(ang) * 7, ay + Math.sin(ang) * 7); g.stroke();
    g.beginPath(); g.moveTo(ax + Math.cos(ang) * 7, ay + Math.sin(ang) * 7);
    g.lineTo(ax + Math.cos(ang + 2.5) * 5, ay + Math.sin(ang + 2.5) * 5); g.lineTo(ax + Math.cos(ang - 2.5) * 5, ay + Math.sin(ang - 2.5) * 5); g.closePath(); g.fillStyle = '#5fe17a'; g.fill();
  }
  if ((scene === 'dungeon' || inTown()) && canvas.width >= 480) drawMinimap(g);
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
  // the minimap shrinks on small screens so it never hides the view
  const small = canvas.width < 640;
  const px = small ? 1 : scene === 'world' ? 2 : 3, hw = small ? 40 : scene === 'world' ? 48 : 30, hh = small ? 28 : scene === 'world' ? 32 : 20;
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
    g.fillStyle = t === TILE.WALL ? '#2b3a4a' : t === TILE.EXIT ? '#5fe17a' : t === TILE.WAYOUT ? '#ffd86b' : t === TILE.SPRING ? '#38bdf8' : t === TILE.SHOP ? '#c084fc' : '#4b7f99';
    g.fillRect(X + (dx + hw) * px, Y + (dy + hh) * px, px, px);
  }
  for (const o of mpHere()) {
    const dx = o.x - player.x, dy = o.y - player.y;
    if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;
    g.fillStyle = inMyParty(o.id) ? '#5fe17a' : '#7bdfff'; g.fillRect(X + (dx + hw) * px - 1, Y + (dy + hh) * px - 1, px + 2, px + 2);
  }
  g.fillStyle = '#ffd86b'; g.fillRect(X + hw * px, Y + hh * px, px, px);
}

// ---------- lighting, particles, vignette ----------
const lightCanvas = document.createElement('canvas');
lightCanvas.width = canvas.width; lightCanvas.height = canvas.height;
const lctx = lightCanvas.getContext('2d');
// Darkness over the view with holes punched by each light; lights with a glow
// colour also add warm light on top.
function applyLighting(g, fill, lights) {
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
  lctx.fillStyle = fill; lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
  lctx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const a = L.a ?? 1, grd = lctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(0.5, `rgba(0,0,0,${a * 0.8})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = grd; lctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  lctx.globalCompositeOperation = 'source-over';
  g.drawImage(lightCanvas, 0, 0);
  g.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    if (!L.glow) continue;
    const gr = L.gr || L.r * 0.7, grd = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, gr);
    grd.addColorStop(0, L.glow); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(L.x - gr, L.y - gr, gr * 2, gr * 2);
  }
  g.globalCompositeOperation = 'source-over';
}
const particles = [];
let lastFrame = 0;
// A spray of particles from a tile. opts: life (ms), gravity (px/s²), size, glow, rise, spread, foot.
function burst(tx, ty, color, n = 10, speed = 90, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.8);
    particles.push({
      x: tx * T + T / 2 + (Math.random() - 0.5) * (opts.spread ?? 8), y: ty * T + (opts.foot ? T - 4 : T / 2) + (Math.random() - 0.5) * (opts.spread ?? 8),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.rise ?? 0), life: 0, max: (opts.life ?? 450) * (0.7 + Math.random() * 0.6),
      color, size: opts.size ?? 2 + Math.floor(Math.random() * 2), g: opts.gravity ?? 200, glow: !!opts.glow,
    });
  }
  if (particles.length > 600) particles.splice(0, particles.length - 600);
}
function drawParticles(g, now) {
  const dt = Math.min(50, Math.max(0, now - (lastFrame || now))) / 1000; lastFrame = now;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt * 1000;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
    g.globalAlpha = Math.max(0, 1 - p.life / p.max);
    g.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    g.fillStyle = p.color;
    g.fillRect(Math.round(p.x - cam.x - p.size / 2), Math.round(p.y - cam.y - p.size / 2), p.size, p.size);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
let vignette = null;
function buildVignette() {
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.width * 0.62);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  return c;
}
vignette = buildVignette();
// A small hop while gliding from one tile to the next.
const hop = (o) => { const d = Math.hypot(o.x - (o.rx ?? o.x), o.y - (o.ry ?? o.y)); return d > 0.02 && d <= 1.05 ? Math.sin(Math.min(1, d) * Math.PI) * 0.12 : 0; };

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
  const lights = [];
  if (scene === 'dungeon') {
    // wall torches flicker where the noise says there is one
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
      if (!visible.has(key(c, r)) || getTile(c, r) !== TILE.WALL || !walkable(getTile(c, r + 1)) || noise(c, r, 17) >= 0.06) continue;
      drawSprite(ctx, 'torch', c, r, 1, 6);
      const fl = 1 + 0.06 * Math.sin(now / 90 + c * 3) + 0.04 * Math.sin(now / 37 + r);
      lights.push({ x: c * T - cam.x + T / 2, y: r * T - cam.y + T * 0.6, r: T * 3.6 * fl, glow: 'rgba(255,140,50,0.28)', gr: T * 2.2 * fl });
      if (Math.random() < 0.06) burst(c, r - 0.2, '#ffb347', 1, 20, { gravity: -60, life: 700, glow: true, spread: 6, size: 2 });
    }
    if (exit && isVisible(exit.x, exit.y)) lights.push({ x: exit.x * T - cam.x + T / 2, y: exit.y * T - cam.y + T / 2, r: T * 1.8, glow: 'rgba(95,225,122,0.16)' });
    if (thm().lava) {
      let pools = 0;
      for (let r = y0; r <= y1 && pools < 14; r++) for (let c = x0; c <= x1 && pools < 14; c++) {
        if (getTile(c, r) !== TILE.LAVA || !visible.has(key(c, r))) continue;
        if (getTile(c - 1, r) === TILE.LAVA && getTile(c, r - 1) === TILE.LAVA) continue;   // one light per pool, roughly
        pools++;
        lights.push({ x: c * T - cam.x + T, y: r * T - cam.y + T / 2, r: T * 2.6, a: 0.7, glow: `rgba(255,110,40,${0.22 + 0.06 * Math.sin(now / 300 + c)})`, gr: T * 1.6 });
        if (Math.random() < 0.08) burst(c, r, '#ffb347', 1, 15, { gravity: -50, life: 600, glow: true, size: 2 });
      }
    }
    for (const m of monsters) if (m.boss && isVisible(m.x, m.y)) lights.push({ x: m.x * T - cam.x + T / 2, y: m.y * T - cam.y + T / 2, r: T * 2.5, a: 0.6, glow: `rgba(255,60,60,${0.14 + 0.06 * Math.sin(now / 200)})` });
  }
  for (const g of golds) if (inView(g) && isVisible(g.x, g.y)) drawSprite(ctx, 'gold', g.x, g.y);
  for (const p of potions) {
    if (!inView(p) || !isVisible(p.x, p.y)) continue;
    lights.push({ x: p.x * T - cam.x + T / 2, y: p.y * T - cam.y + T / 2, r: T * 1.3, a: 0.7, glow: 'rgba(123,223,255,0.18)' });
    ctx.fillStyle = `rgba(123,223,255,${0.18 + 0.12 * Math.sin(now / 300 + p.x + p.y)})`;
    ctx.beginPath(); ctx.arc(p.x * T - cam.x + T / 2, p.y * T - cam.y + T / 2, T * 0.55, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, 'potion', p.x, p.y);
  }
  for (const sh of shops) if (inView(sh) && isVisible(sh.x, sh.y)) drawSprite(ctx, 'merchant', sh.x, sh.y);
  if (scene === 'house') {
    for (let r = 0; r < bounded.h; r++) for (let c = 0; c < bounded.w; c++) {
      if (decor[r][c] && decor[r][c].sprite === 'fire') {
        const fl = 1 + 0.07 * Math.sin(now / 80 + c) + 0.04 * Math.sin(now / 31);
        lights.push({ x: c * T - cam.x + T / 2, y: r * T - cam.y + T / 2, r: T * 6 * fl, glow: 'rgba(255,140,50,0.3)', gr: T * 2.6 * fl });
        if (Math.random() < 0.15) burst(c, r - 0.1, '#ffb347', 1, 18, { gravity: -70, life: 800, glow: true, spread: 10, size: 2 });
      }
    }
  }
  {
    const path = hoverPath();
    if (path.length) {
      const target = path[path.length - 1];
      const hostile = getMonsterAt(hover.x, hover.y) && isVisible(hover.x, hover.y);
      ctx.fillStyle = hostile ? 'rgba(255,107,107,0.55)' : 'rgba(255,255,255,0.4)';
      for (let i = 0; i < path.length - 1; i++) { const p = path[i]; ctx.beginPath(); ctx.arc(p.x * T - cam.x + T / 2, p.y * T - cam.y + T / 2, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = hostile ? 'rgba(255,107,107,0.8)' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(target.x * T - cam.x + 3, target.y * T - cam.y + 3, T - 6, T - 6);
    }
    if (walk.active) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 150), tx = walk.tx * T - cam.x + T / 2, ty = walk.ty * T - cam.y + T / 2;
      ctx.strokeStyle = walk.monster ? `rgba(255,107,107,${0.5 + 0.4 * pulse})` : `rgba(255,216,107,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(tx, ty + T / 2 - 6, T * (0.32 + 0.08 * pulse), 6, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  const shadow = (x, y) => { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x * T - cam.x + T / 2, y * T - cam.y + T - 4, T * 0.3, 4, 0, 0, Math.PI * 2); ctx.fill(); };
  const bob = (o, idle = true) => (idle ? Math.sin(now / 260 + (o.x * 7 + o.y * 13)) * 0.03 : 0);
  if (scene !== 'dungeon') for (const n of npcs) if (inView(n)) { const [lx, ly] = [n.rx ?? n.x, n.ry ?? n.y]; shadow(lx, ly); drawSprite(ctx, n.type.sprite, lx, ly - bob(n) - hop(n), 1, 3, n.face === -1); }
  for (const o of mpHere()) {
    if (!inView(o)) continue;
    if (o.hound && inView(o.hound)) { shadow(o.hound.rx ?? o.hound.x, o.hound.ry ?? o.hound.y); drawSprite(ctx, 'hound', o.hound.rx ?? o.hound.x, (o.hound.ry ?? o.hound.y) - hop(o.hound), 1, 3, o.hound.face === -1); }
    const lx = o.rx ?? o.x, ly = (o.ry ?? o.y) - hop(o) - bob(o);
    shadow(lx, o.ry ?? o.y);
    drawSprite(ctx, o.data.look ? heroLook(o.data.cls, o.data.look.w, o.data.look.a, o.data.look.r) : (CLASSES[o.data.cls] || CLASSES.warrior).sprite, lx, ly, 1, 3, (o.data.face ?? o.face) === -1);
    const ally = inMyParty(o.id);
    const label = `${o.data.name || 'Hero'} · ${o.data.level || 1}`;
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    const lw = ctx.measureText(label).width + 10, tx = lx * T - cam.x + T / 2, ty = ly * T - cam.y - 8;
    ctx.fillStyle = 'rgba(6,12,20,0.72)'; ctx.beginPath(); ctx.roundRect(tx - lw / 2, ty - 13, lw, 15, 4); ctx.fill();
    ctx.fillStyle = ally ? '#9ef0b0' : '#e6eef8'; ctx.fillText(label, tx, ty - 2);
    ctx.textAlign = 'start';
    if (ally && o.data.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y - 3, T - 6, 3);
      ctx.fillStyle = '#5fe17a'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y - 3, (T - 6) * Math.max(0, o.data.hp / o.data.maxHp), 3);
    }
    const b = mp.bubbles.get(o.id);
    if (b && performance.now() < b.until) drawBubble(ctx, { x: lx, y: ly - 0.5, text: b.text });
    if (scene === 'dungeon') lights.push({ x: tx, y: ly * T - cam.y + T / 2, r: T * 4, a: 0.85 });
  }
  if (hound && !hound.down && scene !== 'house' && inView(hound)) {
    const [ldx, ldy] = lunge(hound, now);
    const lx = (hound.rx ?? hound.x) + ldx / T, ly = (hound.ry ?? hound.y) + ldy / T - hop(hound);
    shadow(lx, (hound.ry ?? hound.y));
    drawSprite(ctx, 'hound', lx, ly, 1, 3, hound.face === -1, hound.flashUntil > now);
    if (hound.hp < hound.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, T - 6, 3);
      ctx.fillStyle = '#5fe17a'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, (T - 6) * (hound.hp / hound.maxHp), 3);
    }
  }
  for (const m of monsters) {
    if (!inView(m) || !isVisible(m.x, m.y)) continue;
    const [ldx, ldy] = lunge(m, now);
    if (m.mod) {
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(now / 180);
      ctx.strokeStyle = ELITE_MODS[m.mod].color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse((m.rx ?? m.x) * T - cam.x + T / 2, (m.ry ?? m.y) * T - cam.y + T - 4, T * 0.44, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      lights.push({ x: (m.rx ?? m.x) * T - cam.x + T / 2, y: (m.ry ?? m.y) * T - cam.y + T / 2, r: T * 1.6, a: 0.5, glow: 'rgba(255,255,255,0.06)' });
    }
    const lx = (m.rx ?? m.x) + ldx / T, ly = (m.ry ?? m.y) + ldy / T - bob(m, m.awake) - hop(m);
    shadow(lx, ly);
    drawSprite(ctx, m.type.sprite, lx, ly, 1, m.boss ? -5 : m.small ? 8 : 3, m.face === -1, m.flashUntil > now);
    if (m.boss) {
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const label = m.name[0].toUpperCase() + m.name.slice(1), lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(6,12,20,0.7)'; ctx.fillRect(lx * T - cam.x + T / 2 - lw / 2, ly * T - cam.y - 34, lw, 14);
      ctx.fillStyle = '#ff9b9b'; ctx.fillText(label, lx * T - cam.x + T / 2, ly * T - cam.y - 23);
      ctx.textAlign = 'start';
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x - 8, ly * T - cam.y - 16, T + 16, 4);
      ctx.fillStyle = '#f33'; ctx.fillRect(lx * T - cam.x - 8, ly * T - cam.y - 16, (T + 16) * (m.hp / m.maxHp), 4);
    } else if (m.hp < m.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, T - 6, 3);
      ctx.fillStyle = '#f33'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, (T - 6) * (m.hp / m.maxHp), 3);
    }
    if (!m.awake) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('z', lx * T - cam.x + T - 10, ly * T - cam.y + 11 + Math.sin(now / 400) * 2); }
    if (m.stunned > 0) { ctx.fillStyle = '#ffd86b'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('✦', lx * T - cam.x + T / 2 - 5 + Math.sin(now / 120) * 4, ly * T - cam.y - 2); }
    if (m.enraged) { ctx.strokeStyle = `rgba(239,68,68,${0.5 + 0.3 * Math.sin(now / 150)})`; ctx.lineWidth = 2; ctx.strokeRect(lx * T - cam.x + 2, ly * T - cam.y + 2, T - 4, T - 4); }
    if (m.windup) {
      const pulse = 0.28 + 0.18 * Math.sin(now / 90);
      for (const k of m.windup) {
        const [x, y] = k.split(',').map(Number);
        ctx.fillStyle = `rgba(239,68,68,${pulse})`; ctx.fillRect(x * T - cam.x + 1, y * T - cam.y + 1, T - 2, T - 2);
        ctx.strokeStyle = 'rgba(255,120,120,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(x * T - cam.x + 2, y * T - cam.y + 2, T - 4, T - 4);
      }
    }
    if (m.mod) { ctx.fillStyle = ELITE_MODS[m.mod].color; ctx.font = 'bold 12px sans-serif'; ctx.fillText('★', lx * T - cam.x + 1, ly * T - cam.y + 10); }
  }
  {
    const [ldx, ldy] = lunge(player, now);
    const lx = (player.rx ?? player.x) + ldx / T, ly = (player.ry ?? player.y) + ldy / T - bob(player) - hop(player);
    shadow(lx, (player.ry ?? player.y) + ldy / T);
    if (player.shield > 0) { ctx.strokeStyle = `rgba(123,223,255,${0.5 + 0.3 * Math.sin(now / 120)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx * T - cam.x + T / 2, ly * T - cam.y + T / 2, T * 0.62, 0, Math.PI * 2); ctx.stroke(); }
    const mounted = riding();
    if (mounted) drawSprite(ctx, 'horse', lx, ly + 0.12, 1, 1, player.face === -1);
    drawSprite(ctx, playerSprite(), lx, ly - (mounted ? 0.38 : 0), 1, 3, player.face === -1, player.flashUntil > now || player.poison > 0 && Math.floor(now / 300) % 3 === 0);
  }
  const px = (player.rx ?? player.x) * T - cam.x + T / 2, py = (player.ry ?? player.y) * T - cam.y + T / 2;
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
    const t = dayClock();
    if (t >= 0.66) {
      // night: a light map with the hero's lantern, the plaza lamps and lit doorways
      const k = t < 0.72 ? (t - 0.66) / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1;
      const night = [{ x: px, y: py, r: T * 5.5, glow: 'rgba(255,200,120,0.08)' }];
      for (const town of nearbyTowns(player.x, player.y, 1)) {
        for (const [lc, lr] of [[town.cx - 11, town.cy - 6], [town.cx + 11, town.cy - 6], [town.cx - 11, town.cy + 6], [town.cx + 11, town.cy + 6]]) {
          if (lc < x0 - 4 || lc > x1 + 4 || lr < y0 - 4 || lr > y1 + 4) continue;
          night.push({ x: lc * T - cam.x + T / 2, y: lr * T - cam.y + 8, r: T * 3.8, glow: 'rgba(255,210,120,0.3)', gr: T * 2 });
        }
      }
      for (const town of nearbyTowns(player.x, player.y, 1)) {
        if (town.cx + 4 < x0 - 3 || town.cx + 4 > x1 + 3 || town.cy < y0 - 3 || town.cy > y1 + 3) continue;
        night.push({ x: (town.cx + 4) * T - cam.x + T / 2, y: town.cy * T - cam.y + T / 2, r: T * 2.2, a: 0.8, glow: `rgba(123,223,255,${0.18 + 0.06 * Math.sin(now / 400)})`, gr: T * 1.3 });
      }
      for (const h of houses) {
        if (h.doorX < x0 - 3 || h.doorX > x1 + 3 || h.doorY < y0 - 3 || h.doorY > y1 + 3) continue;
        night.push({ x: h.doorX * T - cam.x + T / 2, y: h.doorY * T - cam.y + T, r: T * 2.4, a: 0.8, glow: 'rgba(255,180,90,0.2)', gr: T * 1.4 });
      }
      applyLighting(ctx, `rgba(6,12,40,${0.72 * k})`, night);
      // fireflies drifting about
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 22; i++) {
        const fx = ((i * 211 + 37) % canvas.width) + Math.sin(now / 1300 + i * 1.7) * 26, fy = ((i * 137 + 91) % canvas.height) + Math.cos(now / 1100 + i * 2.3) * 20;
        const a = (0.5 + 0.5 * Math.sin(now / 300 + i * 4.1)) * k;
        ctx.fillStyle = `rgba(214,255,120,${0.75 * a})`; ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
        ctx.fillStyle = `rgba(214,255,120,${0.12 * a})`; ctx.beginPath(); ctx.arc(fx + 1, fy + 1, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const tint = nightTint();
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
  } else if (scene === 'dungeon') {
    const view = viewRadius(), fl = 1 + 0.025 * Math.sin(now / 110);
    lights.push({ x: px, y: py, r: T * (view + 1.5) * fl, glow: 'rgba(255,200,130,0.1)', gr: T * 3 });
    applyLighting(ctx, 'rgba(3,6,14,0.78)', lights);
    // dust drifting in the lantern light
    for (let i = 0; i < 16; i++) {
      const ang = i * 2.4 + now / (4000 + i * 90), rad = T * (1 + (i % 5) * 0.7);
      ctx.fillStyle = `rgba(255,236,200,${0.12 + 0.08 * Math.sin(now / 500 + i)})`;
      ctx.fillRect(Math.round(px + Math.cos(ang) * rad), Math.round(py + Math.sin(ang * 1.3) * rad * 0.8), 2, 2);
    }
  } else if (scene === 'house') {
    lights.push({ x: px, y: py, r: T * 7, a: 0.9 });
    applyLighting(ctx, 'rgba(25,12,2,0.32)', lights);
  }
  drawParticles(ctx, now);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], age = now - f.at;
    if (age > 800) { floats.splice(i, 1); continue; }
    const fx = f.x * T - cam.x + T / 2, fy = f.y * T - cam.y - age / 40 - Math.sin(Math.min(1, age / 250) * Math.PI) * 6;
    ctx.globalAlpha = 1 - age / 800; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,10,20,0.85)'; ctx.fillText(f.text, fx + 1, fy + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, fx, fy);
    ctx.textAlign = 'start'; ctx.globalAlpha = 1;
  }
  ctx.drawImage(vignette, 0, 0);
  if (bubble) { if (now > bubble.until) bubble = null; else drawBubble(ctx, bubble); }
  { const mine = mp.bubbles.get('me'); if (mine && now < mine.until) drawBubble(ctx, { x: player.rx ?? player.x, y: (player.ry ?? player.y) - 0.5, text: mine.text }); }
  if (inspected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(inspected.x * T - cam.x + 1, inspected.y * T - cam.y + 1, T - 2, T - 2); }
  drawHud(ctx, now);
  if (isTouch && !mapOpen && !questsOpen && !perkChoices) drawTouchButtons(ctx);
  if (player && !gameOver && player.hp > 0 && player.hp <= player.maxHp * 0.3 && !mapOpen && !journalOpen) {
    const a = 0.25 + 0.15 * Math.sin(now / 220);
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
    vg.addColorStop(0, 'rgba(180,0,0,0)'); vg.addColorStop(1, `rgba(180,0,0,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pots = player.bag.filter((id) => itemKind(id) === 'consumable' && itemInfo(id).heal).length;
    const msg = pots ? `Low health! Press P to drink a potion (${pots} left)` : scene === 'dungeon' ? 'Low health and no potions! Back off, or take the golden door out' : 'Low health! Rest at an inn';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mw = ctx.measureText(msg).width + 24, my = canvas.height - 128;
    ctx.fillStyle = 'rgba(60,0,0,0.85)'; ctx.beginPath(); ctx.roundRect(canvas.width / 2 - mw / 2, my - 14, mw, 28, 6); ctx.fill();
    ctx.fillStyle = '#ffd1d1'; ctx.fillText(msg, canvas.width / 2, my);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
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
  if (journalOpen) drawJournal(ctx);
  if (perkChoices) drawPerks(ctx);
}

// ---------- the world map ----------
// A wide view of the surface around the hero, sampled every other tile and
// cached until the hero has moved a fair way. Towns are named, roads drawn.
let mapOpen = false;
const MAP_STEP = 2, MAP_PX = 3;
const mapCache = { ox: null, oy: null, canvas: document.createElement('canvas') };
// A pin you drop on the world map; the compass points to it until you get there.
let mapPin = null;
try { mapPin = JSON.parse(localStorage.getItem('dungeon-pin') || 'null'); } catch (e) { mapPin = null; }
function savePin() { try { localStorage.setItem('dungeon-pin', JSON.stringify(mapPin)); } catch (e) { /* ignore */ } }
function mapClick(px, py) {
  const c = mapCache.canvas, X = Math.floor((canvas.width - c.width) / 2), Y = 56;
  if (mapCache.ox === null || px < X || py < Y || px > X + c.width || py > Y + c.height) return false;
  const wx = Math.round(mapCache.ox + ((px - X) / MAP_PX) * MAP_STEP), wy = Math.round(mapCache.oy + ((py - Y) / MAP_PX) * MAP_STEP);
  if (mapPin && Math.hypot(mapPin.x - wx, mapPin.y - wy) < MAP_STEP * 4) { mapPin = null; log('You take the pin out of your map.'); }
  else { mapPin = { x: wx, y: wy }; log('You pin the map. The compass now points to your pin.', 'good'); sfx.play('quest'); }
  savePin(); draw();
  return true;
}
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
  // realms: a wash of each realm's colour, and a line where they meet
  for (let sy = 0; sy < H; sy += 2) for (let sx = 0; sx < W; sx += 2) {
    const wx = ox + sx * MAP_STEP, wy = oy + sy * MAP_STEP, rid = realmOfTile(wx, wy);
    g.fillStyle = REALMS[rid].color; g.globalAlpha = 0.1; g.fillRect(sx * MAP_PX, sy * MAP_PX, MAP_PX * 2, MAP_PX * 2);
    if (realmOfTile(wx + MAP_STEP * 2, wy) !== rid || realmOfTile(wx, wy + MAP_STEP * 2) !== rid) { g.globalAlpha = 0.55; g.fillRect(sx * MAP_PX, sy * MAP_PX, MAP_PX, MAP_PX); }
    g.globalAlpha = 1;
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
    g.font = '10px sans-serif'; const rt = rating(siteDungeon(st)); g.fillStyle = '#e9d5ff'; g.fillText(st.name, sx, sy - 16); g.fillStyle = rt.color; g.fillText(`Lv ${rt.rec}+ ${rt.label}`, sx, sy - 6); g.font = 'bold 11px sans-serif';
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
  // places you have discovered
  g.font = '9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (const k of player.meta.places) {
    const pl = placeAt(...k.split(',').map(Number));
    if (!pl) continue;
    const [px, py] = toPx(pl.x, pl.y);
    if (px < 0 || py < 0 || px > c.width || py > c.height) continue;
    g.fillStyle = '#9fd4ff'; g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cfe9ff'; g.fillText(pl.name.replace(/^the /, ''), px, py - 4);
  }
  // realm names over their capitals
  g.font = 'bold 13px sans-serif';
  for (const id of REALM_ORDER) {
    const cap = townAt(...REALMS[id].capital); if (!cap) continue;
    const [px, py] = toPx(cap.cx, cap.y0);
    g.fillStyle = 'rgba(6,12,20,0.7)'; const lw = g.measureText(REALMS[id].name).width + 12; g.fillRect(px - lw / 2, py - 46, lw, 18);
    g.fillStyle = REALMS[id].color; g.fillText(REALMS[id].name, px, py - 31);
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
  // the story objective
  const obj = storyObjective();
  if (obj) {
    const ox2 = X + ((obj.x - mapCache.ox) / MAP_STEP) * MAP_PX, oy2 = Y + ((obj.y - mapCache.oy) / MAP_STEP) * MAP_PX;
    const inside = ox2 > X && oy2 > Y && ox2 < X + c.width && oy2 < Y + c.height;
    const cx2 = Math.max(X + 10, Math.min(X + c.width - 10, ox2)), cy2 = Math.max(Y + 10, Math.min(Y + c.height - 10, oy2));
    g.fillStyle = '#ffd86b'; g.font = `bold ${inside ? 18 : 14}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★', cx2, cy2 + Math.sin(now / 250) * 2);
    g.font = 'bold 11px sans-serif'; g.fillText(inside ? obj.short : `${obj.short} →`, cx2, cy2 + 16);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  // your pin
  if (mapPin) {
    const qx = X + ((mapPin.x - mapCache.ox) / MAP_STEP) * MAP_PX, qy = Y + ((mapPin.y - mapCache.oy) / MAP_STEP) * MAP_PX;
    if (qx > X && qy > Y && qx < X + c.width && qy < Y + c.height) {
      g.strokeStyle = '#1b1b2f'; g.lineWidth = 2; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx, qy - 12); g.stroke();
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(qx, qy - 15, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd1d1'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('Pin', qx, qy - 24); g.textAlign = 'left';
    }
  }
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
  g.fillText(`${here ? here.name : 'The wilds'}  ·  position ${player.x}, ${player.y}  ·  each square is ${MAP_STEP} tiles  ·  click to place or remove a pin  ·  M or Esc closes`, 112, 18);
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
  const other = mpPlayerAt(x, y);
  if (other) return `${other.data.name}${other.data.title ? ' ' + other.data.title : ''} — level ${other.data.level} ${other.data.cls}${inMyParty(other.id) ? ', in your party' : ''}${scene !== 'dungeon' ? '. Walk into them to invite or wave' : ''}`;
  if (houndAt(x, y)) return `Your hound — ${hound.hp}/${hound.maxHp} HP, bite ${hound.atk}, level ${hound.level}, ${hound.kills} kills`;
  if (t === TILE.MONUMENT) { const tw = townContaining(x, y); if (tw) { const L = townIdentity(tw).landmark; return `${L.name[0].toUpperCase() + L.name.slice(1)} — the pride of ${tw.name}. Walk into it to look closer`; } }
  if (getTile(x, y) === TILE.WAYSTONE) return 'Waystone — walk into it to travel to any town you have visited';
  const n = scene !== 'dungeon' && getNpcAt(x, y);
  if (n) return `${n.type.name} — walk into them to ${n.type.action === 'shop' || n.type.action === 'potions' ? 'trade' : n.type.action === 'inn' ? 'rest' : 'chat'}`;
  if (isVisible(x, y)) {
    const m = getMonsterAt(x, y);
    if (m) {
      const per = Math.max(1, player.atk + weaponAtk() + 0.5 - (m.mod === 'armored' ? 2 : 0)) * (!m.awake && !m.boss ? (player.weapon === 'dagger' ? 3 : 2) : 1);
      const hits = Math.max(1, Math.ceil(m.hp / per)), takes = Math.max(1, m.atk - armorDef());
      const threat = takes * 3 >= player.hp ? ' Dangerous for you now.' : '';
      return `${m.boss ? bossTitle(m) + ' (boss)' : m.elite ? `${m.name} (elite: ${ELITE_MODS[m.mod].desc})` : m.type.name} — ${m.hp}/${m.maxHp} HP. Hits you for ${takes}${m.type.ranged ? ' from range' : ''}${m.type.poison ? ' and may poison' : ''}; about ${hits} ${hits === 1 ? 'hit' : 'hits'} to kill${m.awake ? '' : '. Asleep: sneak attack for ' + (player.weapon === 'dagger' ? 'triple' : 'double') + ' damage'}.${threat}`;
    }
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
  if (t === TILE.EXIT && inTown()) { const tw = townContaining(x, y) || nearestTownTo(x, y); return `Dungeon gate — ${tw ? `${townDungeon(tw).floors} floors, ${ratingText(townDungeon(tw))}` : 'step here to begin your descent'}`; }
  if (t === TILE.EXIT) return 'Stairs down — the exit from this floor';
  if (t === TILE.CRACK) return `Cracked wall — it sounds hollow. Walk into it to break through (${player.weapon === 'warhammer' ? 'one blow with your warhammer' : 'three blows, or one with a warhammer or a bomb'}). The noise wakes monsters`;
  if (t === TILE.SPRING) return usedSprings.has(key(x, y)) ? 'A dry spring' : 'Healing spring — walk into it for full health, once';
  if (t === TILE.WAYOUT) return 'Way out — walk into it twice to leave the dungeon early, keeping your loot';
  if (t === TILE.SITE && inTown()) { const st0 = siteAtTile(x, y); if (st0 && st0.deep) return story().phase === 'done' ? `The Gate of the Deep — endless floors, a boss every fifth, ${ratingText(siteDungeon(st0))}. Your record: floor ${player.meta.deepest || 0}` : 'A gate of black iron, sealed while the Crown lies broken'; }
  if (t === TILE.SITE && inTown()) { const st = siteAtTile(x, y); if (st) return st.story && !storySiteOpen(st.story) ? `${st.name} — sealed with old gold` : `${st.name} — ${st.floors} floors, ${ratingText(siteDungeon(st))}${st.story ? ', a shard lies within' : ''}, step in to explore`; }
  if (t === TILE.PLACE && inTown()) { const pl = placeAtTile(x, y); if (pl) return discovered(pl) ? `${pl.name[0].toUpperCase() + pl.name.slice(1)} — ${PLACE_TYPES[pl.type].label}, walk into it` : 'Something old stands here — walk into it'; }
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
// ---------- mouse: click to walk, click to act ----------
// Click a spot to walk there by the shortest path; click a monster to walk up
// to it and keep swinging until it falls; click a person, door, shop, chest or
// waystone to walk over and use it. Hold the button and drag to steer.
// Walking stops on a key press, when you are hurt, or when a new foe closes in.
const walk = { active: false, tx: 0, ty: 0, monster: null, timer: null, holding: false, downAt: 0, hp: 0, near: new Set() };
const hover = { x: null, y: null, path: [], sig: '' };
const occupiedBy = (x, y) => getMonsterAt(x, y) || getNpcAt(x, y) || mpPlayerAt(x, y) || null;
function interactive(x, y) {
  const t = getTile(x, y);
  return !!occupiedBy(x, y) || [TILE.DOOR, TILE.SHOP, TILE.FURNITURE, TILE.CHEST, TILE.WAYSTONE, TILE.PLACE, TILE.WAYOUT, TILE.CRACK, TILE.SPRING, TILE.MONUMENT].includes(t);
}
// The tiles from the hero to a target (not including the hero's own tile), shortest first.
function pathTo(tx, ty, limit = 60) {
  let d = bfs(tx, ty, limit, false, true);
  if (d.get(key(player.x, player.y)) === undefined) d = bfs(tx, ty, limit, false);   // only through hazards if there is no other way
  if (d.get(key(player.x, player.y)) === undefined) return null;
  const path = []; let x = player.x, y = player.y;
  for (let i = 0; i < limit; i++) {
    const here = d.get(key(x, y));
    if (here === 0) break;
    let best = null;
    for (const [ax, ay] of DIRS) {
      const nd = d.get(key(x + ax, y + ay));
      if (nd !== undefined && nd < here && (!best || nd < best.d) && (nd === 0 || !getNpcAt(x + ax, y + ay))) best = { x: x + ax, y: y + ay, d: nd };
    }
    if (!best) break;
    path.push(best); x = best.x; y = best.y;
    if (best.d === 0) break;
  }
  return path;
}
function stopWalk() { walk.active = false; walk.monster = null; clearInterval(walk.timer); walk.timer = null; }
function startWalk(t) {
  stopWalk();
  if (t.x === player.x && t.y === player.y) { wait(); return; }   // clicking yourself waits a turn
  const m = isVisible(t.x, t.y) ? getMonsterAt(t.x, t.y) : null;
  Object.assign(walk, { active: true, tx: t.x, ty: t.y, monster: m, hp: player.hp, near: new Set(monsters.filter((mm) => dist(mm, player) <= 2)) });
  walkTick();
  if (walk.active) walk.timer = setInterval(walkTick, 125);
}
function walkTick() {
  if (!walk.active) return;
  if (gameOver || !player || shopOpen || perkChoices || mapOpen || questsOpen || entering) { stopWalk(); return; }
  if (player.hp < walk.hp && !walk.monster) { stopWalk(); log('You stop: something is hurting you.', 'bad'); return; }
  walk.hp = player.hp;
  const fresh = monsters.find((m) => m.awake && dist(m, player) <= 2 && !walk.near.has(m) && m !== walk.monster && isVisible(m.x, m.y));
  if (fresh && !safeZone()) { stopWalk(); log(`You stop: ${fresh.boss ? fresh.name : 'a ' + fresh.type.name.toLowerCase()} is close.`, 'bad'); return; }
  walk.near = new Set(monsters.filter((m) => dist(m, player) <= 2));
  if (walk.monster) {
    const m = walk.monster;
    if (!monsters.includes(m) || m.hp <= 0 || !isVisible(m.x, m.y) || cheb(m, player) > 20) { stopWalk(); return; }
    walk.tx = m.x; walk.ty = m.y;
    if (dist(m, player) === 1) { tryMove(m.x - player.x, m.y - player.y); return; }   // keep swinging
  }
  const dx = walk.tx - player.x, dy = walk.ty - player.y;
  if (!dx && !dy) { stopWalk(); return; }
  const sceneBefore = scene;
  if (Math.abs(dx) + Math.abs(dy) === 1) {
    const bump = interactive(walk.tx, walk.ty);
    tryMove(dx, dy);
    if (bump || scene !== sceneBefore) stopWalk();
    return;
  }
  const path = pathTo(walk.tx, walk.ty);
  if (!path || !path.length) { stopWalk(); return; }
  const next = path[0];
  const ox = player.x, oy = player.y;
  tryMove(next.x - player.x, next.y - player.y);
  if (scene !== sceneBefore || (player.x === ox && player.y === oy && !getMonsterAt(next.x, next.y))) stopWalk();
}
function hoverAt(t) {
  hover.x = t.x; hover.y = t.y;
  const occ = occupiedBy(t.x, t.y), tile = getTile(t.x, t.y);
  canvas.style.cursor = (occ && getMonsterAt(t.x, t.y) && isVisible(t.x, t.y)) ? 'crosshair' : (occ || interactive(t.x, t.y) || tile === TILE.EXIT || tile === TILE.SITE) ? 'pointer' : '';
}
function hoverPath() {
  if (hover.x === null || walk.active || isTouch || scene === 'dungeon' && !wasSeen(hover.x, hover.y)) return [];
  const sig = `${hover.x},${hover.y},${player.x},${player.y},${scene},${turn}`;
  if (sig !== hover.sig) { hover.sig = sig; hover.path = pathTo(hover.x, hover.y) || []; }
  return hover.path;
}
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || isTouch) return;
  if (journalOpen) { const { px, py } = canvasPoint(e.clientX, e.clientY); journalClick(px, py); return; }
  if (perkChoices || shopOpen) return;
  if (mapOpen) { const { px, py } = canvasPoint(e.clientX, e.clientY); if (mapClick(px, py)) return; }
  if (mapOpen || questsOpen) { mapOpen = false; questsOpen = false; draw(); return; }
  if (gameOver) return;
  e.preventDefault();
  sfx.unlock();
  clearInspect();
  startWalk(tileFromEvent(e));
  walk.holding = true; walk.downAt = performance.now();
});
canvas.addEventListener('mousemove', (e) => {
  // holding and dragging steers the walk toward the pointer
  if (walk.holding && walk.active && !walk.monster && performance.now() - walk.downAt > 220) { const t = tileFromEvent(e); walk.tx = t.x; walk.ty = t.y; }
});
window.addEventListener('mouseup', () => { walk.holding = false; });
// Right-click: the hero's ability, aimed at the tile under the pointer.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isTouch || !player || gameOver || perkChoices || shopOpen || journalOpen || mapOpen || questsOpen || storyOpen()) return;
  const wasWalking = walk.active;
  stopWalk();
  if (wasWalking) { draw(); return; }   // the first right-click only stops a walk
  sfx.unlock(); clearInspect();
  const t = tileFromEvent(e);
  useAbility(player.cls === 'warrior' ? null : t);
});

function perkClick(e) {
  if (!perkChoices) return false;
  const rect = canvas.getBoundingClientRect(), sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * sx, py = (e.clientY - rect.top) * sy;
  const { w, h, gap, x0, y0 } = perkLayout();
  if (py >= y0 && py <= y0 + h) for (let i = 0; i < 3; i++) if (px >= x0 + i * (w + gap) && px <= x0 + i * (w + gap) + w) { choosePerk(i); return true; }
  return true;
}
function inspect(e) {
  if (e.type === 'click') { if (!isTouch) perkClick(e); return; }   // clicks walk; they only pick perk cards here
  if (mapOpen || perkChoices || questsOpen) { clearInspect(); return; }
  const t = tileFromEvent(e);
  hoverAt(t);
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
canvas.addEventListener('mouseleave', () => { clearInspect(); hover.x = null; hover.path = []; canvas.style.cursor = ''; });
canvas.addEventListener('click', inspect);

function buildLegend() {
  legendEl.innerHTML = '';
  const add = (spriteName, label, detail, dim = false) => {
    const li = document.createElement('li');
    const c = document.createElement('canvas'); c.width = c.height = 18; c.className = 'swatch';
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.globalAlpha = dim ? 0.35 : 1;
    g.drawImage(sprite(spriteName), 0, 0, 18, 18);
    li.appendChild(c);
    li.insertAdjacentHTML('beforeend', `<b>${label}</b> <span class="muted">${detail}</span>`);
    legendEl.appendChild(li);
  };
  add(playerSprite(), `You, ${heroClass().name}`, `1: ${heroClass().ability}`);
  if (hound) add('hound', 'Your hound', hound.down ? 'resting at the inn' : `level ${hound.level}, bites ${hound.atk}`);
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
    add('waystone', 'Waystone', 'fast travel between visited towns');
    add('stairs', 'Gate', 'into the dungeon');
    add('tree', 'Forest, water, mountains', 'impassable; roads join the towns');
    add('cave', 'Caves, crypts, towers', 'short dungeons with a boss and a hoard');
    add('rat', 'Beasts of the wilds', 'roam outside the towns, bolder at night');
  } else { add('stairs', 'Stairs', 'follow the compass'); add('chest', 'Chest', 'gold, sometimes gear'); add('trap', 'Spike trap', 'hidden until found'); }
}

function updateStats() {
  const where = scene === 'house' ? interior.house.name : inTown() ? (townContaining(player.x, player.y)?.name ?? 'The wilds') : `${dungeonDef ? dungeonDef.name : 'Dungeon'} ${floorText()}`;
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
function perkLayout() {
  const gap = canvas.width < 640 ? 10 : 24, w = Math.min(260, Math.floor((canvas.width - 32 - gap * 2) / 3)), h = 150;
  return { w, h, gap, x0: Math.floor((canvas.width - (w * 3 + gap * 2)) / 2), y0: Math.max(170, Math.floor(canvas.height / 2 - 90)) };
}
function drawPerks(g) {
  g.fillStyle = 'rgba(6,12,20,0.9)'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.textBaseline = 'top'; g.textAlign = 'center';
  const top = perkLayout().y0;
  g.fillStyle = '#ffd86b'; g.font = 'bold 22px sans-serif'; g.fillText(`Level ${player.level}! Choose a perk`, canvas.width / 2, top - 80);
  g.fillStyle = '#a8c0d8'; g.font = '13px sans-serif'; g.fillText('Press 1, 2 or 3, or click a card', canvas.width / 2, top - 48);
  const { w, h, gap, x0, y0 } = perkLayout();
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
    player.maxHp += 4; player.atk += 1; player.hp = player.maxHp; mapCache.ox = null;
    log(`Level up! You are now level ${player.level}. HP and attack increased.`, 'good');
    sfx.play('levelup');
    burst(player.x, player.y, '#ffd86b', 40, 170, { glow: true, gravity: -40, life: 900, size: 3 });
    track('level_up', { level: player.level });
    player.pendingPerks = (player.pendingPerks || 0) + 1;
  }
}
// Each weapon fights differently, so choosing one is more than a bigger number.
const WEAPON_TRAITS = {
  dagger:      { name: 'Quick', desc: 'sneak attacks deal triple damage, and one stab in five strikes twice' },
  short_sword: { name: 'Keen', desc: 'one hit in five is a critical for double damage' },
  mace:        { name: 'Stunning', desc: 'one hit in four stuns the target for a turn' },
  longsword:   { name: 'Parrying', desc: 'parries one melee blow in five' },
  warhammer:   { name: 'Crushing', desc: 'knocks foes back a tile, or slams them into a wall for +3' },
  greatsword:  { name: 'Cleaving', desc: 'also hits every other foe beside you for half damage' },
};
const nameOf = (m) => (m.boss ? m.name : 'the ' + mName(m));
function moveMonster(m, x, y) { monsterIndex.delete(key(m.x, m.y)); m.x = x; m.y = y; monsterIndex.set(key(m.x, m.y), m); monstersDirty = true; }
function playerAttack(m) {
  const w = player.weapon, sneak = !m.awake && !m.boss, solo = !coopMember();
  let dmg = Math.max(1, player.atk + weaponAtk() + rnd(2) - (m.mod === 'armored' ? 2 : 0));
  const notes = [];
  if (sneak) { dmg *= w === 'dagger' ? 3 : 2; notes.push('Sneak attack!'); tip('sneak', 'Sleeping monsters take double damage from your first blow, triple with a dagger. Creep up on them.'); }
  else if (w === 'short_sword' && Math.random() < 0.2) { dmg *= 2; notes.push('Critical hit!'); }
  if (w === 'dagger' && Math.random() < 0.2) { const extra = Math.max(1, Math.floor(dmg / 2)); dmg += extra; notes.push('You stab twice!'); }
  // the hammer drives the foe back, or into the wall behind it
  if (w === 'warhammer' && solo && !m.boss && m.hp - dmg > 0) {
    const bx = m.x + Math.sign(m.x - player.x), by = m.y + Math.sign(m.y - player.y);
    if (walkable(getTile(bx, by)) && !getMonsterAt(bx, by) && !houndAt(bx, by) && !mpPlayerAt(bx, by)) { moveMonster(m, bx, by); notes.push('Knocked back!'); }
    else if (getTile(bx, by) === TILE.WALL) { dmg += 3; notes.push('Slammed into the wall!'); shakeScreen(3); }
  }
  m.hp -= dmg; m.awake = true;
  if (w === 'mace' && solo && m.hp > 0 && Math.random() < (m.boss ? 0.1 : 0.25)) { m.stunned = 1; notes.push(`${m.boss ? m.name : 'It'} is stunned!`); floatText(m.x, m.y, '✦', '#ffd86b'); }
  if (w === 'greatsword') {
    for (const o of monsters.filter((o) => o !== m && o.hp > 0 && dist(o, player) === 1)) {
      const cd = Math.max(1, Math.floor(dmg / 2));
      o.hp -= cd; o.awake = true; o.flashUntil = performance.now() + 120; floatText(o.x, o.y, `-${cd}`, '#ffd86b');
      notes.push(`The swing cleaves ${nameOf(o)} for ${cd}.`);
      if (coopMember()) coopHit(o, cd, 'hero'); else if (o.hp <= 0) killMonster(o);
    }
  }
  if (notes.length) log(notes.join(' '), 'good');
  const now = performance.now();
  player.lunge = { dx: Math.sign(m.x - player.x), dy: Math.sign(m.y - player.y), until: now + 140 };
  if (m.x !== player.x) player.face = Math.sign(m.x - player.x);
  m.flashUntil = now + 120;
  floatText(m.x, m.y, `-${dmg}`, '#ffd86b');
  burst(m.x, m.y, '#fff3c4', 7, 140, { glow: true, life: 260, gravity: 0, size: 2 });
  sfx.play('hit');
  if (coopMember()) { coopHit(m, dmg, 'hero'); log(`You hit ${m.boss ? m.name : 'the ' + mName(m)} for ${dmg}.`); }
  else if (m.hp <= 0) killMonster(m);
  else log(`You hit ${m.boss ? m.name : 'the ' + mName(m)} for ${dmg}.`);
}
function killMonster(m) {
  if (m.id) { mp.dead.add(m.id); mp.graveyard.set(m.id, m); }
  if (m.mod === 'explosive') {
    const blast = 3 + floor;
    burst(m.x, m.y, '#ff9f43', 36, 180, { glow: true, life: 600, size: 3 }); shakeScreen(5); sfx.play('fire');
    log(`The ${mName(m)} bursts!`, 'bad');
    if (cheb(m, player) <= 1) { player.hp -= blast; floatText(player.x, player.y, `-${blast}`, '#ff6b6b'); }
    if (hound && !hound.down && cheb(m, hound) <= 1) houndHurt(blast);
  }
  if (m.type.splits && !m.small && !m.boss && !coopMember()) splitSlime(m);
  if (m.purse) golds.push({ x: m.x, y: m.y, amount: m.purse });
  if (m.type.name === 'Mimic') { golds.push({ x: m.x, y: m.y, amount: 40 + floor * 15 + (dungeonDef ? dungeonDef.danger * 10 : 0) }); }
  if (m.elite) {
    unlock('elite');
    const purse = 20 + floor * 10 + (dungeonDef ? dungeonDef.danger * 8 : 0);
    golds.push({ x: m.x, y: m.y, amount: purse });
  }
  burst(m.x, m.y, '#9ca3af', 14, 60, { gravity: -40, life: 650, size: 4 });
  burst(m.x, m.y, m.boss ? '#ff9b9b' : '#e5e7eb', m.boss ? 40 : 10, m.boss ? 160 : 110, { life: 500, glow: !!m.boss });
  {
    monsters = monsters.filter((x) => x !== m); monstersDirty = true;
    if (scene === 'world') worldMonsters = monsters;
    kills++; player.lifetimeKills = (player.lifetimeKills || 0) + 1;
    player.meta.bestiary = player.meta.bestiary || {};
    const firstOfKind = !player.meta.bestiary[m.type.name];
    player.meta.bestiary[m.type.name] = (player.meta.bestiary[m.type.name] || 0) + 1;
    if (firstOfKind) log(`New journal entry: ${m.type.name}. Press J to read it.`, 'good');
    if (MONSTER_TYPES.every((t) => player.meta.bestiary[t.name])) unlock('naturalist');
    if (perkCount('vampiric') && player.hp < player.maxHp) { player.hp += 1; floatText(player.x, player.y, '+1', '#9ef0b0'); }
    unlock('first_blood');
    if (player.lifetimeKills >= 50) unlock('slayer_50');
    if (scene === 'world' && dayPhase() === 'night') unlock('night_owl');
    if (m.boss) { unlock('boss_slayer'); track('boss_killed', { boss: m.name, floor }); }
    const xp = Math.round(m.type.xp * (wearing('cantonsbadge') ? 1.2 : 1) * (m.small || m.raised ? 0.4 : 1) * (dungeonDef ? dungeonDef.xp : 1) * (m.boss ? 5 : 1) * (m.elite ? 2 : 1) * (scene === 'dungeon' ? (floorMod === 'swarming' ? 1.25 : floorMod === 'cursed' ? 1.5 : 1) : 1));
    if (m.boss) {
      log(dungeonDef && dungeonDef.arena ? `You defeat ${m.name}! The crowd is on its feet.` : m.yields ? `${bossTitle(m)} drops his sword and yields. The seal on the stairs breaks.` : `You slay ${m.name}! The seal on the stairs breaks.`, 'good');
      const purse = 40 + 30 * (dungeonDef ? dungeonDef.danger : 0) + floor * 10;
      player.gold += purse; floatText(m.x, m.y, `+${purse}g`, '#f5c542');
      sfx.play('win');
    } else log(`You slay the ${mName(m)} (+${xp} XP).`, 'good');
    gainXp(xp);
    questProgress('slay', m.type.name, 1);
    rqProgress('slay', m.type.name);
    if (m.elite) rqProgress('elite');
    if (m.boss) rqProgress('boss');
    if (m.boss) { const keep = dungeonDef; dungeonDef = { ...(dungeonDef || {}), loot: 1 }; dropLoot(m); dungeonDef = keep; } else dropLoot(m);
  }
}
let spawnCounter = 0;
function freeTileNear(cx, cy, reach = 1) {
  const spots = [];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const x = cx + dx, y = cy + dy;
    if ((dx || dy) && walkable(getTile(x, y)) && getTile(x, y) !== TILE.LAVA && !getMonsterAt(x, y) && !(x === player.x && y === player.y) && !houndAt(x, y) && !mpPlayerAt(x, y)) spots.push({ x, y });
  }
  return spots.length ? spots[rnd(spots.length)] : null;
}
function addMonster(type, x, y, extra = {}) {
  const danger = dungeonDef ? dungeonDef.danger || 0 : 0;
  const hp = extra.hp || type.hp + Math.floor(floor / 2) + danger;
  const m = { x, y, id: `spawn-${++spawnCounter}`, type, hp, maxHp: hp, atk: type.atk + Math.floor(danger / 2), awake: true, ...extra };
  monsters.push(m); monsterIndex.set(key(x, y), m); monstersDirty = true;
  return m;
}
function splitSlime(m) {
  let made = 0;
  for (let i = 0; i < 2; i++) {
    const spot = freeTileNear(m.x, m.y, 1) || (i === 0 ? { x: m.x, y: m.y } : null);
    if (!spot) continue;
    addMonster(m.type, spot.x, spot.y, { small: true, hp: Math.max(2, Math.ceil(m.maxHp / 3)), atk: Math.max(1, m.atk - 1), name: 'Small slime' });
    made++;
  }
  if (made) { log(`The slime splits in ${made === 2 ? 'two' : 'half'}!`, 'bad'); burst(m.x, m.y, '#7ad36b', 16, 90, { life: 500, size: 3 }); }
}
// Necromancers raise up to two skeletons at a time, every few beats.
function raiseDead(m) {
  const mine = monsters.filter((o) => o.raisedBy === m.id && o.hp > 0).length;
  if (mine >= 2) return false;
  const spot = freeTileNear(m.x, m.y, 1);
  if (!spot) return false;
  addMonster(MONSTER_TYPES.find((t) => t.name === 'Skeleton'), spot.x, spot.y, { raised: true, raisedBy: m.id });
  burst(spot.x, spot.y, '#b18cff', 18, 90, { glow: true, gravity: -60, life: 600 });
  if (isVisible(m.x, m.y)) { log(`The ${mName(m)} raises a skeleton from the floor!`, 'bad'); tip('necro', 'Necromancers keep raising skeletons while they live. Get to them first: an arrow, a fireball or a bomb works well.'); }
  return true;
}
function monsterAttack(m, ranged = false) {
  if (!ranged && perkCount('nimble') && Math.random() < 0.25) { log(`You dodge ${m.boss ? m.name : 'the ' + m.type.name}.`, 'good'); floatText(player.x, player.y, 'dodge', '#7bdfff'); return; }
  if (!ranged && player.weapon === 'longsword' && Math.random() < 0.2) { log(`You parry ${nameOf(m)}'s blow with your longsword.`, 'good'); floatText(player.x, player.y, 'parry', '#e6eef8'); sfx.play('shield'); return; }
  const dmg = Math.max(1, m.atk - armorDef() - (player.shield > 0 ? 2 : 0));
  player.hp -= dmg;
  if (m.mod === 'vampiric' && m.hp < m.maxHp) { const h = Math.min(dmg, m.maxHp - m.hp); m.hp += h; floatText(m.x, m.y, `+${h}`, '#ff6b9b'); }
  if (dmg >= player.maxHp * 0.25 || m.boss) shakeScreen(m.boss ? 6 : 4);
  burst(player.x, player.y, '#ff5a5a', 8, 110, { life: 380, size: 3 });
  if (isTouch && navigator.vibrate) { try { navigator.vibrate(dmg >= player.maxHp * 0.25 ? 60 : 25); } catch (e) { /* not allowed */ } }
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
// Monsters act for one beat. heroes defaults to just you; in a shared dungeon
// the host passes every hero present and each monster goes for the nearest.
function stepMonsters(swiftOnly = false, heroes = null) {
  heroes = heroes || [{ x: player.x, y: player.y, me: true }];
  const fields = new Map();
  const field = (i) => { if (!fields.has(i)) fields.set(i, bfs(heroes[i].x, heroes[i].y, SIM_RADIUS, false, true)); return fields.get(i); };
  const heroAt = (x, y) => heroes.some((h) => h.x === x && h.y === y);
  for (const m of monsters) {
    if (swiftOnly && m.mod !== 'swift') continue;
    if (m.hp <= 0) continue;
    if (m.stunned > 0) { m.stunned--; continue; }
    let hi = 0, hd = Infinity;
    heroes.forEach((h, i) => { const dd = cheb(m, h); if (dd < hd) { hd = dd; hi = i; } });
    if (hd > SIM_RADIUS) continue;
    const H = heroes[hi];
    if (hound && !hound.down && scene !== 'house' && dist(m, hound) === 1 && !heroes.some((h) => dist(m, h) === 1)) {
      if (!m.awake && Math.random() < 0.6) m.awake = true;
      if (m.awake && Math.random() < 0.7) { houndBitten(m); continue; }
    }
    const wake = (scene === 'world' ? (dayPhase() === 'night' ? 10 : 6) : 6) - (wearing('wardstone') ? 3 : 0);
    if (!m.awake && dist(m, H) <= wake && (H.me ? isVisible(m.x, m.y) : true) && Math.random() < 0.7) m.awake = true;
    if (m.boss && m.awake && !swiftOnly && bossTurn(m, H, heroes)) continue;
    const adjacent = heroes.find((h) => dist(m, h) === 1);
    if (adjacent) { strike(m, adjacent, false); continue; }
    if (!m.awake) continue;
    if (m.type.ranged && (m.x === H.x || m.y === H.y)) {
      const dd = Math.abs(m.x - H.x) + Math.abs(m.y - H.y);
      if (dd <= m.type.ranged) {
        let clear = true;
        for (let k = 1; k < dd; k++) if (!walkable(getTile(m.x + Math.sign(H.x - m.x) * k, m.y + Math.sign(H.y - m.y) * k))) clear = false;
        if (clear) { strike(m, H, true); continue; }
      }
    }
    const d = field(hi);
    let best = null, bestD = d.get(key(m.x, m.y)) ?? Infinity;
    const dirs = DIRS.slice().sort(() => Math.random() - 0.5);
    if (m.type.erratic && Math.random() < 0.5) bestD = Infinity;   // bats flap about
    if (m.type.raiser) { m.raiseCd = (m.raiseCd ?? 1) - 1; if (m.raiseCd <= 0 && dist(m, H) <= 7 && raiseDead(m)) { m.raiseCd = 4; continue; } }
    if ((m.type.ranged && dist(m, H) <= 2) || (m.type.raiser && dist(m, H) <= 3)) {
      // archers back off to shoot again
      for (const [dx, dy] of dirs) {
        const nx = m.x + dx, ny = m.y + dy;
        if (walkable(getTile(nx, ny)) && !getMonsterAt(nx, ny) && !houndAt(nx, ny) && !heroAt(nx, ny) && dist({ x: nx, y: ny }, H) > dist(m, H)) { best = [nx, ny]; break; }
      }
      if (best) { monsterIndex.delete(key(m.x, m.y)); m.x = best[0]; m.y = best[1]; monsterIndex.set(key(m.x, m.y), m); continue; }
    }
    for (const [dx, dy] of dirs) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!walkable(getTile(nx, ny)) || getTile(nx, ny) === TILE.LAVA || getMonsterAt(nx, ny) || heroAt(nx, ny) || houndAt(nx, ny)) continue;
      if (scene === 'world' && townContaining(nx, ny)) continue;   // beasts keep out of settlements
      const nd = d.get(key(nx, ny));
      if (nd !== undefined && nd < bestD) { bestD = nd; best = [nx, ny]; }
    }
    if (!best && Math.random() < 0.5) {
      const [dx, dy] = dirs[0];
      const nx = m.x + dx, ny = m.y + dy;
      if (getTile(nx, ny) === TILE.FLOOR && !getMonsterAt(nx, ny) && !heroAt(nx, ny) && !houndAt(nx, ny) && !(scene === 'world' && townContaining(nx, ny))) best = [nx, ny];
    }
    if (best) { if (best[0] !== m.x) m.face = Math.sign(best[0] - m.x); monsterIndex.delete(key(m.x, m.y)); m.x = best[0]; m.y = best[1]; monsterIndex.set(key(m.x, m.y), m); }
  }
}
// Bosses fight in two phases. Every few beats they wind up a heavy blow that
// lands on the tiles around them a beat later, marked in red: step out of it.
// At half health they enrage and call for help.
const bossTitle = (m) => m.name[0].toUpperCase() + m.name.slice(1);
function bossTurn(m, H, heroes) {
  if (!m.enraged && m.hp <= m.maxHp / 2) { enrageBoss(m); return true; }
  if (m.windup) {
    const area = new Set(m.windup);
    m.windup = null; m.slamCd = m.enraged ? 3 : 4;
    shakeScreen(7); sfx.play('boss');
    for (const k of area) { const [x, y] = k.split(',').map(Number); burst(x, y, '#ef4444', 5, 90, { life: 400, size: 3 }); }
    let hitAny = false;
    for (const h of heroes) {
      if (!area.has(key(h.x, h.y))) continue;
      hitAny = true;
      if (h.me) { const a = m.atk; m.atk = a * 2; monsterAttack(m); m.atk = a; }
      else mpSend({ to: h.id, type: 'attack', payload: { id: m.id, atk: m.atk * 2, ranged: false, type: m.type.name } });
    }
    if (hound && !hound.down && area.has(key(hound.x, hound.y))) houndHurt(m.atk);
    if (!hitAny) log(`${bossTitle(m)}'s blow smashes empty stone. You were clear.`, 'good');
    return true;
  }
  m.slamCd = (m.slamCd ?? 2) - 1;
  if (m.slamCd <= 0 && cheb(m, H) <= 1) {
    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && walkable(getTile(m.x + dx, m.y + dy))) tiles.push(key(m.x + dx, m.y + dy));
    m.windup = tiles;
    log(`${bossTitle(m)} raises its weapon high. Step out of the red!`, 'bad');
    tip('windup', 'Red tiles mark where a heavy blow will land next turn. Step out of them, or take double damage.');
    sfx.play('boss');
    return true;
  }
  return false;
}
function enrageBoss(m) {
  m.enraged = true; m.atk += 2;
  shakeScreen(8); sfx.play('boss');
  burst(m.x, m.y, '#ef4444', 40, 160, { glow: true, life: 700 });
  const def = dungeonDef || { pool: null };
  const pool = (def.pool || MONSTER_TYPES.filter((t) => !t.noSpawn && t.minFloor <= floor));
  const weak = pool.slice().sort((a, b) => a.xp - b.xp).slice(0, Math.max(1, Math.ceil(pool.length / 2)));
  let called = 0;
  for (let dy = -2; dy <= 2 && called < 2; dy++) for (let dx = -2; dx <= 2 && called < 2; dx++) {
    const x = m.x + dx, y = m.y + dy;
    if (!(dx || dy) || !walkable(getTile(x, y)) || getTile(x, y) === TILE.LAVA || getMonsterAt(x, y) || (x === player.x && y === player.y) || houndAt(x, y) || Math.random() < 0.4) continue;
    const t = weak[rnd(weak.length)], hp = t.hp + Math.floor(floor / 2) + (def.danger || 0);
    monsters.push({ x, y, id: `boss-add-${called}`, type: t, hp, maxHp: hp, atk: t.atk + Math.floor((def.danger || 0) / 2), awake: true });
    burst(x, y, '#c084fc', 14, 90, { glow: true, life: 500 });
    called++;
  }
  monstersDirty = true;
  log(`${bossTitle(m)} roars in fury: it hits harder now${called ? `, and ${called === 1 ? 'a minion answers' : 'two minions answer'} its call` : ''}!`, 'bad');
}
// A monster's blow lands on you directly, or is sent to the ally it hit.
function strike(m, hero, ranged) {
  if (hero.me) { monsterAttack(m, ranged); return; }
  m.lunge = { dx: Math.sign(hero.x - m.x), dy: Math.sign(hero.y - m.y), until: performance.now() + 140 };
  if (hero.x !== m.x) m.face = Math.sign(hero.x - m.x);
  mpSend({ to: hero.id, type: 'attack', payload: { id: m.id, atk: m.atk, ranged: !!ranged, type: m.type.name } });
  if (m.mod === 'vampiric') m.hp = Math.min(m.maxHp, m.hp + Math.max(1, m.atk - (hero.def || 0)));
}
function endGame(title, text) {
  gameOver = true;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.add('show');
}
function nextFloor() {
  const leading = coopHost() || (scene === 'dungeon' && mp.instance && mp.instance.shared && !coopMember());
  const runSpace = mp.instance && mp.instance.space;
  floor++;
  if (!dungeonDef) dungeonDef = townDungeon(townAt(...homeTown.split(',').map(Number)) || townAt(0, 0));
  if (floor > dungeonDef.floors) {
    const def = dungeonDef;
    if (leading && runSpace && mp.on) { mpApi(ACCOUNT.mpUrl + '/sync', { space: runSpace, x: player.x, y: player.y, events: [{ type: 'escape' }] }).catch(() => {}); }
    sfx.play('win');
    track('dungeon_cleared', { dungeon: def.kind === 'site' ? def.site.type : 'town', danger: def.danger, floors: def.floors });
    if (def.kind === 'site') { questProgress('clear', def.site.key, 1); unlock(def.site.type); } else unlock('escapist');
    rqProgress('clearIn', def.kind === 'site' ? realmOfTile(def.site.x, def.site.y) : realmAt(...(def.home || '0,0').split(',').map(Number)));
    if (def.story) setTimeout(() => storyShardFound(def.story), 60);
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
  if (dungeonDef.endless) {
    dungeonDef.danger = 5 + Math.floor((floor - 1) / 2);   // each pair of floors is harder than the last
    if (floor > (player.meta.deepest || 0)) {
      player.meta.deepest = floor;
      if (floor > 1) setTimeout(() => log(`A new record: floor ${floor} of the Deep.`, 'good'), 40);
    }
    if (floor >= 10) unlock('abyss10');
    if (floor >= 25) unlock('abyss25');
  }
  createDungeon();
  afterSceneChange();
  sfx.play('stairs');
  if (leading && floor > 1 && mp.on) { mpSend({ type: 'floor', payload: { floor } }); mpApi(ACCOUNT.mpUrl + '/floor', { space: runSpace, floor }).catch(() => {}); mpKick(); }
  if (floor === 1) track('dungeon_enter', { dungeon: dungeonDef.kind === 'site' ? dungeonDef.site.type : 'town', danger: dungeonDef.danger });
  else track('floor_reached', { floor, dungeon: dungeonDef.kind === 'site' ? dungeonDef.site.type : 'town' });
  if (floor === 1) { player.meta.second_wind = false; tip('dungeon', 'The compass points to the stairs. Walk into monsters to attack, press 1 for your ability, P for a potion.'); }
  if (floor >= 5) unlock('delver');
  if (floorMod) setTimeout(() => log(`${FLOOR_MODS[floorMod].label}: ${FLOOR_MODS[floorMod].desc}.`, floorMod === 'treasure' ? 'good' : 'bad'), 30);
  if (floor === dungeonDef.floors) tip('boss', 'A boss waits by the stairs on the last floor. Clear the room, use your ability, keep a potion ready.');
  log(floor === 1 ? `You descend into the ${dungeonDef.name} (${ratingText(dungeonDef)}). Follow the compass to the stairs. The golden door beside you leads back up if you want out.` : `You descend to floor ${floor}. A golden door here leads back to the surface.`, 'good');
  saveProgress('progress');
}

// A dungeon well above the hero's level asks for a second step before it lets them in.
function confirmEntry(def, k) {
  const r = rating(def);
  if (r.label !== 'Very hard' && r.label !== 'Deadly') return true;
  if (entryWarned && entryWarned.key === k && turn - entryWarned.turn <= 10) { entryWarned = null; return true; }
  entryWarned = { key: k, turn };
  log(`Warning: ${def.name} is meant for level ${r.rec} and up, and you are level ${player.level}. ${r.label === 'Deadly' ? 'You will very likely be defeated.' : 'Expect a hard fight.'} Step in again to enter anyway.`, 'bad');
  sfx.play('boss');
  return false;
}
// ---------- the Grand Arena at Castle Aurum ----------
// Waves of foes on the sand, gold for every wave, and the door out whenever you like.
// Falling here costs nothing: the arena masters drag you out.
const ARENA = { wave: 0, earned: 0, door: null, between: false, nextAt: 0 };
const CHAMPIONS = ['Grimjaw the Unbowed', 'Ironhide', 'the Red Duchess', 'Old Tusk', 'Sable the Swift', 'the Masked Knight'];
function offerArena(house) {
  showScene([{ who: 'The Grand Arena', sprite: 'guard',
    text: `The roar of the crowd spills out of the arena gate. "Waves of foes, each tougher than the last," the arena master says. "Gold for every wave you survive, a champion every fifth, and you can walk out between waves with your winnings. Fall, and we drag you out at no charge."${player.meta.arena ? ` Your best: wave ${player.meta.arena}.` : ''}`,
    choices: [
      { label: 'Step onto the sand', run: () => { setTimeout(() => startArena(house), 0); return null; } },
      { label: 'Not today', run: () => 'The crowd groans as you walk away.' },
    ] }]);
}
function startArena(house) {
  Object.assign(ARENA, { wave: 0, earned: 0, door: { x: house.doorX, y: house.doorY + 1 }, between: true, nextAt: turn + 2 });
  player.wx = ARENA.door.x; player.wy = ARENA.door.y;
  dungeonDef = { kind: 'arena', arena: true, name: 'the Grand Arena', floors: 1, pool: null, gold: 1, potions: 0, view: 12, loot: 0, treasure: 0, danger: 0, xp: 1, theme: 'stone' };
  floor = 1; mp.instance = null;
  createDungeon(); afterSceneChange();
  sfx.play('boss');
  log('You step onto the sand. The gate clangs shut behind you, the golden door in the corner leads out. The first wave is coming!', 'good');
  track('arena_enter');
}
function nextWave() {
  const w = ++ARENA.wave, room = getChunk(0, 0).rooms[0];
  dungeonDef.danger = Math.floor(w / 2);
  const pool = MONSTER_TYPES.filter((t) => !t.noSpawn && !t.raiser && !t.splits && t.minFloor <= Math.min(5, 1 + Math.floor(w / 2)));
  const spots = [];
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (getTile(x, y) === TILE.FLOOR && cheb({ x, y }, player) >= 4) spots.push({ x, y });
  const count = Math.min(10, 1 + w);
  for (let i = 0; i < count && spots.length; i++) {
    const c = spots.splice(rnd(spots.length), 1)[0], t = pool[rnd(pool.length)];
    addMonster(t, c.x, c.y, { hp: t.hp + w * 2, atk: t.atk + Math.floor(w / 3) });
  }
  if (w % 5 === 0 && spots.length) {
    const c = spots.splice(rnd(spots.length), 1)[0], t = MONSTER_TYPES.find((x) => x.name === 'Orc');
    addMonster(t, c.x, c.y, { id: 'boss', boss: true, name: CHAMPIONS[(w / 5 - 1) % CHAMPIONS.length], hp: 30 + w * 7, atk: 4 + Math.floor(w / 2) });
  }
  toast = { text: `Wave ${w}${w % 5 === 0 ? ': a champion enters the arena!' : ''}`, until: performance.now() + 2500 };
  sfx.play('boss'); shakeScreen(3);
  updateVisibility(); draw();
}
function arenaTurn() {
  if (!dungeonDef || !dungeonDef.arena || gameOver) return;
  if (ARENA.between) { if (turn >= ARENA.nextAt) { ARENA.between = false; nextWave(); } return; }
  if (monsters.length) return;
  const w = ARENA.wave, purse = 15 * w + 5 * w * w;
  player.gold += purse; ARENA.earned += purse;
  const heal = Math.ceil(player.maxHp * 0.2); player.hp = Math.min(player.maxHp, player.hp + heal);
  floatText(player.x, player.y, `+${purse}g`, '#f5c542'); sfx.play('win');
  if (w > (player.meta.arena || 0)) player.meta.arena = w;
  if (w >= 10) unlock('champion');
  log(`Wave ${w} cleared! The crowd throws ${purse} gold and you catch your breath (+${heal} HP). The next wave comes in three turns, or leave by the golden door.`, 'good');
  ARENA.between = true; ARENA.nextAt = turn + 3;
}
function leaveArena(fell) {
  const earned = ARENA.earned, waves = Math.max(0, ARENA.wave - (fell ? 1 : 0));
  floor = TOWN; createWorld();
  player.x = ARENA.door.x; player.y = ARENA.door.y; player.wx = player.x; player.wy = player.y;
  if (fell) player.hp = Math.max(1, Math.ceil(player.maxHp / 4));
  settle(player); refreshTownContext();
  dungeonDef = null; Object.assign(ARENA, { wave: 0, between: false });
  afterSceneChange();
  log(fell ? `You fall on the sand. The arena masters drag you out, battered but alive, with your ${earned} gold in winnings.` : `You leave the arena to cheers, ${earned} gold richer after ${waves} ${waves === 1 ? 'wave' : 'waves'}.`, fell ? 'bad' : 'good');
  track('arena_leave', { waves, earned, fell: !!fell });
  saveProgress('progress');
}
// Leaving early through the door by the entrance: keep everything, skip the hoard.
function leaveDungeon() {
  if (dungeonDef && dungeonDef.arena) { leaveArena(false); return; }
  const def = dungeonDef;
  sfx.play('stairs');
  track('dungeon_left', { dungeon: def ? (def.kind === 'site' ? def.site.type : 'town') : 'town', floor });
  floor = TOWN; createWorld();
  if (def && def.kind === 'site') { player.x = def.site.x; player.y = def.site.y + 1; }
  else {
    const t = townAt(...homeTown.split(',').map(Number)) || townAt(0, 0);
    player.x = t.gate.x; player.y = t.gate.y - 1;
  }
  player.wx = player.x; player.wy = player.y; settle(player); refreshTownContext();
  dungeonDef = null;
  afterSceneChange();
  log(`You slip out through the door and climb back up to daylight${def ? ` from the ${def.name}` : ''}. You keep everything you found.`, 'good');
  saveProgress('progress');
}
function tryMove(dx, dy) {
  if (gameOver || !player || shopOpen || perkChoices || entering || storyOpen() || controlsOpen()) return;
  const nx = player.x + dx, ny = player.y + dy;
  const t = getTile(nx, ny);
  if (t === TILE.WALL || t === TILE.FOUNTAIN) return;
  const n = scene !== 'dungeon' && getNpcAt(nx, ny);
  if (n) { talk(n); draw(); return; }
  if (t === TILE.FURNITURE) { useFurniture(decor[ny][nx]); draw(); return; }
  if (t === TILE.WAYSTONE) { openShop('travel'); draw(); return; }
  if (t === TILE.CRACK) { hitCrack(nx, ny, player.weapon === 'warhammer' ? 3 : 1); endTurn(false); return; }
  if (t === TILE.SPRING) { drinkSpring(nx, ny); endTurn(false); return; }
  if (t === TILE.WAYOUT) {
    if (turn - wayoutWarned <= 5) { wayoutWarned = -99; leaveDungeon(); return; }
    wayoutWarned = turn;
    if (dungeonDef && dungeonDef.arena) { log(`The way out. Walk into it again to leave the arena with your ${ARENA.earned} gold in winnings.`); draw(); return; }
    log(`A door back to the surface. Walk into it again to leave the ${dungeonDef ? dungeonDef.name : 'dungeon'} now: you keep what you carry, but skip ${dungeonDef && dungeonDef.treasure ? 'the hoard at the bottom' : 'the rest of the floors'}.`);
    draw(); return;
  }
  if (t === TILE.PLACE) { usePlace(placeAtTile(nx, ny)); draw(); return; }
  if (t === TILE.MONUMENT) { const tw = townContaining(nx, ny); if (tw) { const L = townIdentity(tw).landmark; log(`${L.name[0].toUpperCase() + L.name.slice(1)}. ${L.lore}`); } draw(); return; }
  const other = mpPlayerAt(nx, ny);
  if (other) { if (scene !== 'dungeon') openPlayerMenu(other); draw(); return; }
  if (t === TILE.DOOR) {
    const house = scene === 'house' ? null : houses.find((h) => h.doorX === nx && h.doorY === ny);
    if (house && house.id === 'arena') { offerArena(house); draw(); return; }
    if (scene === 'house') leaveBuilding(); else enterBuilding(house);
    return;
  }
  if (dx) player.face = dx;
  if (t === TILE.CHEST) { openChest(nx, ny); endTurn(false); return; }
  if (houndAt(nx, ny)) { hound.x = player.x; hound.y = player.y; }
  const m = getMonsterAt(nx, ny);
  if (m) playerAttack(m);
  else {
    player.x = nx; player.y = ny;
    if (t === TILE.TRAP && (dx || dy)) springTrap(nx, ny);
    if (t === TILE.LAVA) {
      const burn = 3 + floor;
      player.hp -= burn; floatText(nx, ny, `-${burn}`, '#ff9f43'); shakeScreen(3);
      burst(nx, ny, '#ff9f43', 14, 90, { glow: true, gravity: -80, life: 500 });
      log(`The lava sears you for ${burn}.`, 'bad');
      tip('lava', 'Lava burns every time you step in it. Walk around the pools; clicking a spot finds a safe path.');
    }
    const pot = getPotionAt(nx, ny);
    if (pot) {
      const healed = Math.min(potionHeal(pot.heal), player.maxHp - player.hp);
      player.hp += healed;
      potions = potions.filter((p) => p !== pot);
      log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
      if (healed > 0) floatText(nx, ny, `+${healed}`, '#9ef0b0');
      if (player.poison > 0) { player.poison = 0; log('The potion purges the poison.', 'good'); }
      sfx.play('potion'); burst(nx, ny, '#7bdfff', 14, 50, { glow: true, gravity: -90, life: 800 });
    }
    const g = getGoldAt(nx, ny);
    if (g) { const amt = Math.round(g.amount * (goldMult())); player.gold += amt; rqProgress('gold', null, amt); golds = golds.filter((x) => x !== g); log(`You pick up ${amt} gold.`, 'good'); floatText(nx, ny, `+${amt}g`, '#f5c542'); sfx.play('gold'); burst(nx, ny, '#ffd86b', 12, 70, { glow: true, gravity: -50, life: 650 }); if (player.gold >= 1000) unlock('rich'); }
    if (t === TILE.SHOP) openShop('shop');
    if (t === TILE.BED) {
      if (interior && interior.house.id === 'inn') restAtInn();
      else log(player.hp < player.maxHp ? 'Not your bed. You lie down anyway, but it does not help.' : 'A bed. Not yours.');
    }
    if (t === TILE.EXIT && bossAlive()) {
      const b = monsters.find((m) => m.boss);
      log(`The stairs are sealed while ${b.name} lives.`, 'bad');
    } else if (t === TILE.EXIT) {
      if (inTown()) {
        const here = townContaining(nx, ny) || nearestTownTo(nx, ny);
        if (!confirmEntry(townDungeon(here), 't:' + here.key)) { draw(); return; }
        homeTown = here.key; player.wx = nx; player.wy = ny + 1; dungeonDef = townDungeon(here);
        enterDungeon('t:' + here.key); return;
      }
      if (coopMember()) { mpSend({ to: mp.hostId, type: 'stairs' }); mpKick(); log('You call the party down the stairs.'); draw(); return; }
      nextFloor(); return;
    }
    if (t === TILE.SITE && inTown()) {
      const site = siteAtTile(nx, ny);
      if (site && site.deep && story().phase !== 'done') { player.x -= dx; player.y -= dy; log('A gate of black iron is set into the hillside, cold to the touch. It will not open while the Crown of Aurum lies broken.', 'bad'); draw(); return; }
      if (site && site.story && !storySiteOpen(site.story)) { player.x -= dx; player.y -= dy; log(`An old seal of gold bars the way into ${site.name.replace(/^The /, 'the ')}. King Aldric will know how to break it.`, 'bad'); draw(); return; }
      if (site) {
        if (!confirmEntry(siteDungeon(site), 's:' + site.key)) { player.x -= dx; player.y -= dy; draw(); return; }
        homeTown = nearestTownTo(nx, ny).key; player.wx = nx; player.wy = ny;
        dungeonDef = siteDungeon(site);
        log(`You enter the ${site.name}: ${site.floors} floors, danger ${stars(site.danger)}, ${ratingText(dungeonDef)}.`, 'good');
        enterDungeon('s:' + site.key); return;
      }
    }
    if (inTown()) { player.wx = nx; player.wy = ny; }
  }
  // on horseback the second tile comes free, if the road ahead is clear
  if (!m && (dx || dy) && riding() && !(walk.active && player.x === walk.tx && player.y === walk.ty)) {
    const x2 = player.x + dx, y2 = player.y + dy;
    if (getTile(x2, y2) === TILE.FLOOR && !getMonsterAt(x2, y2) && !getNpcAt(x2, y2) && !townContaining(x2, y2) && !getGoldAt(x2, y2) && !mpPlayerAt(x2, y2) && !houndAt(x2, y2)) {
      player.x = x2; player.y = y2; player.wx = x2; player.wy = y2;
      if (hound && !hound.down && cheb(hound, player) > 3) placeHound();
    }
  }
  endTurn(!m && (dx || dy));
}

// Everything that happens once the hero has acted: the world moves, timers tick.
// ---------- story scenes ----------
const storyEl = document.getElementById('story');
let sceneQueue = [], sceneDone = null;
const storyOpen = () => !!storyEl && !storyEl.hidden;
function showScene(pages, onDone) {
  if (!storyEl) { if (onDone) onDone(); return; }
  stopWalk?.();
  sceneQueue = pages.slice(); sceneDone = onDone || null;
  nextScenePage();
}
let scenePage = null;
function nextScenePage() {
  const page = sceneQueue.shift();
  scenePage = page || null;
  const box = document.getElementById('story-choices');
  if (box) box.innerHTML = '';
  if (!page) { storyEl.hidden = true; const done = sceneDone; sceneDone = null; if (done) done(); draw(); return; }
  storyEl.hidden = false;
  const choices = page.choices || [];
  document.getElementById('story-next').hidden = choices.length > 0;
  choices.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = i === 0 ? 'primary' : '';
    b.textContent = `${i + 1}. ${c.label}`; b.disabled = !!c.disabled;
    b.addEventListener('click', () => chooseScene(i));
    box?.appendChild(b);
  });
  document.getElementById('story-title').textContent = page.who;
  document.getElementById('story-text').textContent = page.text;
  document.getElementById('story-next').textContent = sceneQueue.length ? 'Continue' : 'Close';
  const pc = document.getElementById('story-portrait'), g = pc.getContext('2d');
  g.clearRect(0, 0, pc.width, pc.height); g.imageSmoothingEnabled = false;
  g.fillStyle = '#0f1724'; g.fillRect(0, 0, pc.width, pc.height);
  if (page.art === 'realms') drawRealmArt(g, pc.width, pc.height);
  else { const spr = sprite(page.sprite === 'hero' ? playerSprite() : page.sprite || 'player'); g.drawImage(spr, 8, 8, pc.width - 16, pc.height - 16); }
  const skip = document.getElementById('story-skip'); if (skip) skip.hidden = !sceneQueue.length || choices.length > 0;
}
// A choice runs its outcome; a returned string is shown as the result page.
function chooseScene(i) {
  const page = scenePage, c = page && page.choices && page.choices[i];
  if (!c || c.disabled) return;
  const result = c.run();
  if (typeof result === 'string') sceneQueue.unshift({ who: page.who, sprite: page.sprite, text: result });
  else if (result && result.text) sceneQueue.unshift({ who: page.who, sprite: page.sprite, ...result });
  updateStats();
  nextScenePage();
}
document.getElementById('story-next')?.addEventListener('click', () => nextScenePage());
document.getElementById('story-skip')?.addEventListener('click', () => skipScene());
// Esc or Skip jumps to the end of a scene; whatever the scene leads to still happens.
function skipScene() { sceneQueue = []; nextScenePage(); }
const controlsEl = document.getElementById('controls-help');
const controlsOpen = () => !!controlsEl && !controlsEl.hidden;
function toggleControls(show = !controlsOpen()) { if (!controlsEl) return; controlsEl.hidden = !show; if (show) stopWalk?.(); }
document.getElementById('controls')?.addEventListener('click', () => toggleControls());
document.getElementById('controls-close')?.addEventListener('click', () => toggleControls(false));
function giveRelic(id, where) {
  if (!ITEMS.relics[id] || player.meta.found.includes(id)) return false;
  player.meta.found.push(id);
  if (!player.relic) setRelic(id); else player.bag.push(id);
  log(`Treasure found: the ${itemInfo(id).name}. ${player.relic === id ? 'You wear it.' : 'It is in your bag; wear it from the inventory.'} ${itemInfo(id).desc}`, 'good');
  sfx.play('win');
  if (player.meta.found.length >= 5) unlock('collector');
  updateStats();
  return true;
}
function storyShardFound(id) {
  const st = story();
  if (STORY_ORDER[st.ch] !== id || st.phase !== 'seek') return;
  st.phase = 'return';
  const S = STORY_SITES[id];
  showScene([{ who: S.shard, sprite: 'obelisk', text: SHARD_FOUND[id] }, SHARD_CLUE[id]], () => { giveRelic(S.relic, S.title); log(`You hold the ${S.shard}. Take it to King Aldric at Castle Aurum.`, 'good'); });
  track('shard_found', { shard: id });
}
// Talking to the King moves the story along. Returns true when he had story to tell.
function storyKing() {
  const st = story();
  if (st.phase === 'summons') {
    showScene(KING_SCENES.summons, () => { st.phase = 'seek'; st.ch = 0; mapCache.ox = null; log('Objective: find the Shard of Dawn in the Sunken Chapel.', 'good'); saveProgress('progress'); });
    return true;
  }
  if (st.phase === 'return') {
    const id = STORY_ORDER[st.ch];
    showScene(KING_SCENES[id], () => {
      player.gold += 100 + 50 * st.ch; log(`The King rewards you with ${100 + 50 * st.ch} gold.`, 'good');
      if (id === 'stars') { st.phase = 'done'; st.ch = 5; giveRelic('crown'); unlock('crownbearer'); player.title = 'Crownbearer'; track('story_complete'); }
      else { st.ch++; st.phase = 'seek'; const S = STORY_SITES[STORY_ORDER[st.ch]]; log(`Objective: find the ${S.shard} in ${S.title.replace(/^The /, 'the ')}.`, 'good'); }
      mapCache.ox = null; updateStats(); saveProgress('progress');
    });
    return true;
  }
  return false;
}
// ---------- landmarks ----------
const placeCooldown = new Map();   // daily landmarks rest for a while after use
function discoverPlace(pl) {
  player.meta.places.push(pl.key);
  mapCache.ox = null; bgDirty = true;
  const P = PLACE_TYPES[pl.type], realm = REALMS[realmOfTile(pl.x, pl.y)];
  log(`Discovered: ${pl.name}, in ${realm.short}.`, 'good');
  sfx.play('quest');
  showScene([{ who: pl.name[0].toUpperCase() + pl.name.slice(1), sprite: pl.sprite, text: P.lore }]);
  if (player.meta.places.length >= 10) unlock('wanderer10');
  track('place_discovered', { type: pl.type });
}
function usePlace(pl) {
  if (!pl) return;
  rqProgress('place', pl.type);
  if (!discovered(pl)) discoverPlace(pl);
  const P = PLACE_TYPES[pl.type], name = pl.name[0].toUpperCase() + pl.name.slice(1);
  const resting = placeCooldown.has(pl.key) && turn - placeCooldown.get(pl.key) < DAY_LENGTH;
  const once = player.meta.looted.includes(pl.key);
  if (pl.type === 'stones') {
    if (resting) { log(`${name} are quiet. They will hum again tomorrow.`); return; }
    placeCooldown.set(pl.key, turn);
    player.hp = player.maxHp; player.poison = 0;
    burst(player.x, player.y, '#9fd4ff', 30, 90, { glow: true, gravity: -60, life: 900 });
    // the stones show the way to the nearest place you have not found
    const near = nearbyPlaces(pl.x, pl.y, 2).filter((p) => !discovered(p)).sort((a, b) => (Math.abs(a.x - pl.x) + Math.abs(a.y - pl.y)) - (Math.abs(b.x - pl.x) + Math.abs(b.y - pl.y)))[0];
    if (near) { player.meta.places.push(near.key); mapCache.ox = null; }
    log(`The stones hum. Your wounds close${near ? `, and for a moment you see ${near.name} clearly in your mind. It is marked on your map` : ''}.`, 'good');
  } else if (pl.type === 'shrine') {
    if (resting) { log(`The candles of ${pl.name} gutter. Come back tomorrow.`); return; }
    placeCooldown.set(pl.key, turn);
    player.meta.blessing = { atk: 2, turns: 300 };
    burst(player.x, player.y, '#ffd86b', 30, 90, { glow: true, gravity: -60, life: 900 });
    log('You kneel and rise braver: +2 attack for 300 turns.', 'good');
  } else if (pl.type === 'ruin' || pl.type === 'battlefield') {
    if (once) { log(`You have already searched ${pl.name}.`); return; }
    player.meta.looted.push(pl.key);
    const danger = Math.max(Math.abs(pl.i), Math.abs(pl.j));
    const gold = Math.round((50 + rnd(80) + danger * 25) * goldMult());
    player.gold += gold; floatText(player.x, player.y, `+${gold}g`, '#f5c542');
    burst(player.x, player.y, '#ffd86b', 24, 110, { glow: true, gravity: 120, life: 700, rise: 120 });
    log(`Among the ${pl.type === 'ruin' ? 'rubble' : 'rusted blades'} you find ${gold} gold.`, 'good');
    const relic = pl.type === 'ruin' ? 'houndcollar' : 'wardstone';
    if (!player.meta.found.includes(relic)) giveRelic(relic);
    else if (pl.type === 'battlefield' && !bagFull()) { const ws = Object.keys(ITEMS.weapons).filter((id) => ITEMS.weapons[id].floor <= Math.min(5, 1 + danger)); const w = ws[rnd(ws.length)]; player.bag.push(w); log(`One blade is still keen: a ${itemInfo(w).name}.`, 'good'); }
  } else if (pl.type === 'hermit') {
    const tales = [
      'The Sunken Chapel was a place of light once. The sisters there kept a lamp burning for three hundred years. Then one night it went out, and they did not come up again.',
      'The clans say the Drowned Grotto breathes. Twice a day the water rises, and twice a day something in the deep pool sings.',
      'In Goldspire they sell everything, even the stars. That tower to the north was built by a wizard who tried to buy one. It is said he succeeded.',
      'Four realms, four ways of ruling. A king, a council, a chieftain and a purse. And every one of them thinks the others are fools.',
      'If you find stones standing in a ring, touch them. They remember the old roads, and they will show you one.',
    ];
    showScene([{ who: name, sprite: 'elder', text: '"' + tales[cellRand(pl.i, pl.j, 430) * tales.length | 0] + '"' }], () => {
      if (!once) { player.meta.looted.push(pl.key); if (!player.meta.found.includes('luckycoin')) { log('"Take this, for the road. It has always been lucky for me. Mostly."', 'good'); giveRelic('luckycoin'); } }
      openShop('hermit');
    });
  } else if (pl.type === 'well') {
    if (player.gold < 10) { log('You have no coin to throw.'); return; }
    player.gold -= 10;
    const roll = Math.random();
    if (roll < 0.35) { player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp / 2)); log('You toss a coin. Cool water seems to wash through you: you feel much better.', 'good'); }
    else if (roll < 0.6) { player.meta.blessing = { atk: 2, turns: 150 }; log('You toss a coin. Your sword arm tingles: +2 attack for 150 turns.', 'good'); }
    else if (roll < 0.8) { const g2 = 25 + rnd(40); player.gold += g2; log(`You toss a coin, and the well tosses ${g2} back.`, 'good'); }
    else log('You toss a coin. Somewhere far below, it splashes. Nothing else happens. This time.');
    burst(player.x, player.y, '#7bdfff', 14, 60, { glow: true, gravity: -40, life: 600 });
  }
  updateStats();
}

// ---------- realm questlines ----------
// Each realm's leader has a three-step errand. State per realm: s = 0 not
// offered, 1-3 working on that step, 4 ready to report, 5 rewarded; n = progress.
const REALM_QUESTS = {
  cantons: { title: 'Wolves at the Door', ruler: 'Speaker Maren', sprite: 'elder', relic: 'cantonsbadge', gold: 150,
    intro: '"The council voted, at last, after three days of shouting," Speaker Maren says. "Beasts are strangling the roads and the markets are empty. We need someone who acts instead of debating. Will you help the Cantons?"',
    steps: [{ kind: 'slay', target: 'Goblin', need: 8, label: 'Drive goblins off the trade roads (slay 8)' },
            { kind: 'clearIn', target: 'cantons', need: 1, label: 'Clear a dungeon in the Free Cantons' },
            { kind: 'place', target: 'shrine', need: 1, label: 'Light a candle at a wayside shrine, for the travellers' }],
    outro: '"The roads are open and the markets are loud again." Maren pins a small enamel badge to your collar. "Every citizen gets a vote. You get this. Wear it, and the Cantons will remember."' },
  aurum: { title: "The King's Justice", ruler: 'King Aldric', sprite: 'king', relic: 'royalsignet', gold: 200,
    intro: '"There is another matter," the King says, "smaller than the crown, but it keeps me awake. Monsters with champions at their head raid my villages. Bring them the King\'s justice."',
    steps: [{ kind: 'elite', need: 3, label: 'Slay 3 elite monsters (starred)' },
            { kind: 'clearIn', target: 'aurum', need: 1, label: 'Clear a dungeon in the Kingdom of Aurum' },
            { kind: 'slay', target: 'Orc', need: 6, label: 'Break the orc warbands (slay 6 orcs)' }],
    outro: '"Justice done, and done well." The King twists a ring from his finger. "My signet. The royal apothecaries brewed for my father with this seal; potions will do twice the good for its bearer."' },
  kathar: { title: 'The Trial of Three', ruler: 'Chieftain Ulrek Stonehand', sprite: 'guard', relic: 'bloodtorc', gold: 120,
    intro: '"Outsiders who want clan respect take the Trial of Three," Ulrek says. "Hunt. Listen. Kill something that should not die. Do all three and come back, and I will believe you."',
    steps: [{ kind: 'slay', target: 'Spider', need: 6, label: 'The hunt: slay 6 spiders' },
            { kind: 'place', target: 'stones', need: 1, label: 'The listening: touch a ring of standing stones' },
            { kind: 'boss', need: 1, label: 'The kill: slay any dungeon boss' }],
    outro: 'Ulrek clasps your forearm in front of the whole longhouse. "Clan-friend." He fastens a heavy iron torc around your neck. "When you bleed, it remembers how we fight. Wear it with pride."' },
  league: { title: 'A Matter of Accounts', ruler: 'Banker Vessa Orlov', sprite: 'merchant', relic: 'ledger', gold: 250,
    intro: '"I am an investor," Vessa Orlov says, "and you are an investment. Show me returns. Bring gold up out of the dark, clear a League dungeon that is bad for business, and crack open some of those chests that idle adventurers leave lying about."',
    steps: [{ kind: 'gold', need: 300, label: 'Pick up 300 gold' },
            { kind: 'clearIn', target: 'league', need: 1, label: 'Clear a dungeon in the Goldspire League' },
            { kind: 'chest', need: 5, label: 'Open 5 treasure chests' }],
    outro: '"An excellent return." Vessa slides a slim book across the desk. "My personal ledger. Merchants who see it pay you as they would pay me, and gold has a way of finding its way to it."' },
};
const RULER_REALM = Object.fromEntries(Object.entries(REALM_QUESTS).map(([id, q]) => [q.ruler, id]));
const rqState = (id) => { const all = player.meta.rq || (player.meta.rq = {}); return all[id] || (all[id] = { s: 0, n: 0 }); };
function rqProgress(kind, target = null, amount = 1) {
  if (!player || !player.meta) return;
  for (const id of REALM_ORDER) {
    const st = rqState(id), Q = REALM_QUESTS[id];
    if (st.s < 1 || st.s > 3) continue;
    const step = Q.steps[st.s - 1];
    if (step.kind !== kind || (step.target && step.target !== target)) continue;
    st.n += amount;
    if (st.n < step.need) continue;
    st.n = 0; st.s++;
    sfx.play('quest');
    if (st.s === 4) log(`${Q.title}: all done. Return to ${Q.ruler}.`, 'good');
    else log(`${Q.title}: step done. Next: ${Q.steps[st.s - 1].label}.`, 'good');
    toast = { text: st.s === 4 ? `${Q.title} complete. Report to ${Q.ruler}.` : `${Q.title}: ${Q.steps[st.s - 1].label}`, until: performance.now() + 4000 };
  }
}
// Talking to a realm's leader: offer the questline, take the report, or let them trade.
function realmQuestTalk(n) {
  const id = RULER_REALM[n.type.name];
  if (!id) return false;
  const Q = REALM_QUESTS[id], st = rqState(id), trade = n.type.action;
  const tradeChoice = { label: trade === 'court' ? 'Ask about titles' : trade === 'council' ? 'Talk about public works' : trade === 'chieftain' ? 'Talk about the clans' : 'Do business', run: () => { setTimeout(() => openShop(trade), 0); return null; } };
  if (st.s === 0) {
    showScene([{ who: `${Q.ruler}: ${Q.title}`, sprite: Q.sprite, text: Q.intro, choices: [
      { label: 'I will do it', run: () => { st.s = 1; st.n = 0; log(`New quest, ${Q.title}: ${Q.steps[0].label}.`, 'good'); sfx.play('quest'); saveProgress('progress'); return `"Good." Your first task: ${Q.steps[0].label.toLowerCase()}. The quest log (Q) keeps track.`; } },
      tradeChoice,
      { label: 'Not now', run: () => '"The offer stands," they say.' },
    ] }]);
    return true;
  }
  if (st.s === 4) {
    showScene([{ who: `${Q.ruler}: ${Q.title}`, sprite: Q.sprite, text: Q.outro }], () => {
      st.s = 5; player.gold += Q.gold;
      log(`${Q.title} complete: ${Q.gold} gold.`, 'good');
      if (!giveRelic(Q.relic) && !player.meta.found.includes(Q.relic)) log('Your bag is too full for the gift. Come back with room.', 'bad');
      if (REALM_ORDER.every((r) => rqState(r).s === 5)) unlock('four_realms');
      updateStats(); saveProgress('progress');
    });
    return true;
  }
  if (st.s >= 1 && st.s <= 3) { const step = Q.steps[st.s - 1]; log(`${Q.ruler}: "How goes it? ${step.label}${step.need > 1 ? ` (${st.n}/${step.need})` : ''}."`); }
  return false;
}

// ---------- encounters on the road ----------
// Walking the wilds, every so often something happens: a choice, and its consequences.
let encounterClock = 0, lastEncounter = null;
const wildDanger = () => { const [i, j] = cellOf(player.x, player.y); return Math.max(Math.abs(i), Math.abs(j)); };
const potionIdx = () => player.bag.findIndex((id) => id === 'potion' || id === 'elixir');
function spawnFoes(type, n, name, extra = {}) {
  const d = wildDanger();
  let made = 0;
  for (let i = 0; i < n; i++) {
    const spot = freeTileNear(player.x, player.y, 2);
    if (!spot || townContaining(spot.x, spot.y)) continue;
    addMonster(type, spot.x, spot.y, { hp: type.hp + d * 2, atk: type.atk + Math.floor(d / 2), wild: true, ...(name ? { name } : {}), ...extra });
    made++;
  }
  monsters = worldMonsters; monstersDirty = true;
  return made;
}
function upgradeFor(slot) {
  const group = slot === 'weapon' ? ITEMS.weapons : ITEMS.armor, stat = slot === 'weapon' ? 'atk' : 'def';
  const now = player[slot] ? group[player[slot]][stat] : 0;
  const better = Object.keys(group).filter((id) => group[id][stat] > now && group[id].floor < 7).sort((a, b) => group[a][stat] - group[b][stat]);
  return better[Math.min(1, better.length - 1)] || null;   // two steps up when there is room, so it feels like a real gift
}
const ROAD_TALES = [
  'The bard sings of Aurel the Founder, who walked into the Deep with a lantern and came out with five lights and no shadow.',
  'The bard sings of the War of Four Banners, when brothers fought brothers for a crown none of them could wear.',
  'The bard sings of the first waystone, carved by a mason who was tired of walking. Its runes still hum his name.',
  'The bard sings of a necromancer who raised an army and forgot to raise a cook. It did not end well for anyone.',
  'The bard sings of the Goldspire magnates, who once bought a mountain because it was in the way of their view.',
];
const ENCOUNTERS = {
  caravan: () => ({ who: 'A merchant caravan', sprite: 'merchant',
    text: 'Three wagons and a tired ox draw up beside you. "Rare goods from all four realms," calls the caravan master. "Elixirs, bombs, and steel you will not find in any village."',
    choices: [
      { label: 'Browse their wares', run: () => { setTimeout(() => openShop('caravan'), 0); return null; } },
      { label: 'Wave and move on', run: () => 'The caravan creaks away down the road.' },
    ] }),
  bandits: () => {
    const toll = Math.max(10, Math.floor(player.gold * 0.1));
    return { who: 'Bandits on the road', sprite: 'archer',
      text: `Three figures step out from behind the trees, bows half-drawn. "Road tax," says the tallest. "${toll} gold, and nobody gets hurt."`,
      choices: [
        { label: `Pay the ${toll} gold`, disabled: player.gold < toll, run: () => { player.gold -= toll; return 'You count out the coins. The bandits melt back into the trees, laughing.'; } },
        { label: 'Draw your weapon', run: () => {
          const g = MONSTER_TYPES.find((t) => t.name === 'Goblin'), a = MONSTER_TYPES.find((t) => t.name === 'Archer');
          spawnFoes(g, 2, 'Bandit', { purse: 15 + wildDanger() * 10 }); spawnFoes(a, 1, 'Bandit archer', { purse: 15 + wildDanger() * 10 });
          shakeScreen(4); sfx.play('boss');
          return null; } },
        { label: 'Run for it', run: () => {
          if (Math.random() < 0.6) return 'You bolt into the brush. Arrows whistle past, but you are faster than they are.';
          const dmg = 3 + wildDanger(); player.hp = Math.max(1, player.hp - dmg); floatText(player.x, player.y, `-${dmg}`, '#ff6b6b');
          return `An arrow catches you in the shoulder for ${dmg} as you run, but you get away.`; } },
      ] };
  },
  knight: () => ({ who: 'A wounded knight', sprite: 'guard',
    text: 'A knight in dented mail sits against a milestone, pressing a hand to a bleeding side. "Orcs," he says. "Five of them. I got four." He eyes your pack. "You would not have a potion?"',
    choices: [
      { label: 'Give him a potion', disabled: potionIdx() < 0, run: () => {
        player.bag.splice(potionIdx(), 1);
        const slot = Math.random() < 0.5 ? 'weapon' : 'armor', up = upgradeFor(slot);
        if (up && !bagFull()) { player.bag.push(up); return `He drinks, and the colour comes back to his face. "Take this. I have a spare, and you have earned it." He hands you a ${itemInfo(up).name}.`; }
        const g = 60 + wildDanger() * 30; player.gold += g;
        return `He drinks, and the colour comes back to his face. He presses ${g} gold into your hand. "From the King's purse. He would want it."`; } },
      { label: 'Wish him luck and walk on', run: () => 'He nods, unsurprised. You do not look back.' },
    ] }),
  gambler: () => ({ who: 'A travelling gambler', sprite: 'merchant',
    text: 'A man with a feathered hat sits on a barrel, flipping a silver coin. "Heads, I double your stake. Tails, I keep it. Fairest game in the four realms."',
    choices: [
      ...[50, 200].map((bet) => ({ label: `Bet ${bet} gold`, disabled: player.gold < bet, run: () => {
        const win = Math.random() < (wearing('luckycoin') ? 0.6 : 0.48);
        player.gold += win ? bet : -bet;
        if (win && player.gold >= 1000) unlock('rich');
        return win ? `Heads! He pays out ${bet * 2} gold with a pained smile.` : `Tails. He pockets your ${bet} gold. "Better luck next time, friend."`; } })),
      { label: 'Keep your gold', run: () => 'He shrugs and goes back to flipping the coin. It lands tails, every time.' },
    ] }),
  altar: () => ({ who: 'A wayside altar', sprite: 'obelisk',
    text: 'Half sunk in the grass is an old wayside altar, its saint\'s name worn away by centuries of rain. The stone is smooth from the hands of travellers who stopped here to pray.',
    choices: [
      { label: 'Leave an offering of 150 gold (+1 attack for good)', disabled: player.gold < 150, run: () => {
        player.gold -= 150; player.atk += 1;
        burst(player.x, player.y, '#ffd86b', 24, 100, { glow: true, gravity: -40, life: 800 });
        return 'You lay the coins on the stone for the poor travellers who come after you. When you rise, your sword arm feels steadier than it has in years.'; } },
      { label: 'Kneel and pray', run: () => {
        if (Math.random() < 0.6) { player.meta.blessing = { name: "wayfarer's blessing", atk: 2, def: 1, turns: 300 }; return 'Warmth spreads through you, and the road ahead looks kinder: +2 attack and +1 defence for 300 turns.'; }
        player.poison = 5; return 'You kneel on a patch of nettles and stand up itching and queasy. Not every prayer is answered the way you hoped.'; } },
      { label: 'Leave it alone', run: () => 'Some gods are best left forgotten. You walk on.' },
    ] }),
  wolf: () => ({ who: 'An injured wolf', sprite: 'hound',
    text: hound ? 'A grey wolf lies in the ditch with a trap on its leg. Your hound whines at it. The wolf does not growl.' : 'A grey wolf lies in the ditch with a trap on its leg. It watches you with yellow eyes, too tired to growl.',
    choices: [
      { label: potionIdx() >= 0 ? 'Free it and pour a potion on the wound' : 'Free it and bind the wound', run: () => {
        const usedPotion = potionIdx() >= 0; if (usedPotion) player.bag.splice(potionIdx(), 1);
        if (!usedPotion && Math.random() < 0.5) { player.hp = Math.max(1, player.hp - 2); return 'You pry the trap open. The wolf bites you, once, hard, and limps into the trees.'; }
        if (!hound) { hound = { x: player.x, y: player.y, hp: 14, maxHp: 14, atk: 3, level: 1, kills: 0, down: false }; placeHound(); buildLegend(); return 'You pry the trap open and tend the leg. The wolf licks your hand, and when you set off it follows. You have a companion.'; }
        hound.maxHp += 3; hound.hp = hound.maxHp; return 'You pry the trap open. The wolf and your hound touch noses, and the wolf slips away. Your hound seems prouder, and tougher: +3 max HP.'; } },
      { label: 'Leave it', run: () => 'You leave the wolf to its fate. The road feels longer after that.' },
    ] }),
  stranger: () => {
    const obj = storyObjective();
    return { who: 'A hooded stranger', sprite: 'necromancer',
      text: 'A figure in a grey hood falls into step beside you. "You have the look of someone who goes into holes," they say. "I know where some of the holes are. And other things."',
      choices: [
        { label: 'Buy a map of nearby places (40 gold)', disabled: player.gold < 40, run: () => {
          const unknown = nearbyPlaces(player.x, player.y, 2).filter((p) => !discovered(p)).sort((a, b) => cheb(a, player) - cheb(b, player)).slice(0, 3);
          player.gold -= 40;
          if (!unknown.length) { player.gold += 40; return '"You have found everything I know of," they admit, and hand your coins back.'; }
          for (const p of unknown) player.meta.places.push(p.key);
          mapCache.ox = null; bgDirty = true;
          return `They sketch quickly: ${unknown.map((p) => p.name).join(', ')}. The places are marked on your map.`; } },
        { label: 'Ask about the crown', run: () => obj ? `"${obj.short}," they murmur. "${compassWord(obj.x - player.x, obj.y - player.y)} of here, ${Math.round(Math.hypot(obj.x - player.x, obj.y - player.y))} paces or so. Go well." When you turn, they are gone.` : '"The crown is whole," they say. "For now." When you turn, they are gone.' },
        { label: 'Walk faster', run: () => 'You lengthen your stride. When you glance back, the road is empty.' },
      ] };
  },
  bard: () => ({ who: 'A travelling bard', sprite: 'villager',
    text: 'A bard with a battered lute sits on a fence, tuning. "A song for the road, hero? Fifteen gold, and I will make you braver than you are."',
    choices: [
      { label: 'Pay 15 gold for a song', disabled: player.gold < 15, run: () => { player.gold -= 15; player.meta.blessing = { name: "bard's song", atk: 1, def: 1, turns: 250 }; return 'The song is about you, mostly, and mostly true. You feel ten feet tall: +1 attack and +1 defence for 250 turns.'; } },
      { label: 'Ask for a tale instead', run: () => ROAD_TALES[rnd(ROAD_TALES.length)] },
      { label: 'Not today', run: () => 'The bard plays you out with something mournful.' },
    ] }),
  camp: () => ({ who: 'An abandoned camp', sprite: 'stones',
    text: 'A cold fire pit, a torn tent, a pack spilled across the grass. Whoever camped here left in a hurry.',
    choices: [
      { label: 'Search the camp', run: () => {
        if (Math.random() < 0.3) { spawnFoes(MONSTER_TYPES.find((t) => t.name === 'Spider'), 2); return 'The tent moves. It is full of spiders. That explains the hurry.'; }
        const g = Math.round((15 + rnd(35) + wildDanger() * 10) * goldMult()); player.gold += g;
        const extra = Math.random() < 0.4 && !bagFull() ? ['potion', 'bomb', 'scroll'][rnd(3)] : null; if (extra) player.bag.push(extra);
        return `You find ${g} gold in the pack${extra ? `, and a ${itemInfo(extra).name}` : ''}.`; } },
      { label: 'Leave it be', run: () => 'Some hurries are catching. You move on.' },
    ] }),
  agents: () => ({ who: 'Grey cloaks on the road', sprite: 'darkknight',
    text: 'Riders in grey cloaks block the road, each wearing a small silver stag. "Prince Edric sends his regards," says their captain, "and asks you to stop running errands for his brother."',
    choices: [
      { label: 'Fight them', run: () => { const k = MONSTER_TYPES.find((t) => t.name === 'Knight'), a = MONSTER_TYPES.find((t) => t.name === 'Archer');
        spawnFoes(k, 2, 'Stag knight', { purse: 30 + wildDanger() * 10 }); spawnFoes(a, 1, 'Stag archer', { purse: 20 }); shakeScreen(4); sfx.play('boss'); return null; } },
      { label: 'Tell them the King knows everything', disabled: player.level < 6, run: () => 'The captain studies your face for a long moment, then turns his horse. "Then it is already over," he says, mostly to himself. The riders follow him into the trees.' },
      { label: 'Run for it', run: () => { if (Math.random() < 0.5) return 'You break for the trees and lose them in the undergrowth.'; const dmg = 4 + wildDanger(); player.hp = Math.max(1, player.hp - dmg); return `A crossbow bolt grazes you for ${dmg} before you lose them in the undergrowth.`; } },
    ] }),
  ambush: () => ({ who: 'Ambush!', sprite: 'orc',
    text: 'A branch snaps. Shapes rise out of the dark on both sides of the road. There is no time to run.',
    choices: [{ label: 'Fight!', run: () => {
      const d = wildDanger(), pool = [...byName('Goblin', 'Rat'), ...(d >= 2 ? byName('Orc') : []), ...(d >= 3 ? byName('Skeleton') : [])];
      for (let i = 0; i < 2 + rnd(2); i++) spawnFoes(pool[rnd(pool.length)], 1);
      shakeScreen(5); sfx.play('boss'); return null; } }] }),
};
function compassWord(dx, dy) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  return ['East', 'South-east', 'South', 'South-west', 'West', 'North-west', 'North', 'North-east'][((Math.round(a / 45) % 8) + 8) % 8];
}
function startEncounter() {
  const night = dayPhase() === 'night';
  const ids = Object.keys(ENCOUNTERS).filter((id) => id !== lastEncounter && id !== 'agents' && (id !== 'ambush' || night));
  const st = story();
  let id = night && Math.random() < 0.35 ? 'ambush' : ids.filter((x) => x !== 'agents')[rnd(ids.length - 1)] || 'caravan';
  if (st.ch === 3 && st.phase === 'seek' && !st.ambushed) { id = 'agents'; st.ambushed = true; }
  lastEncounter = id;
  player.meta.encounters = (player.meta.encounters || 0) + 1;
  if (player.meta.encounters >= 10) unlock('wayfarer');
  sfx.play('quest');
  track('encounter', { id });
  showScene([ENCOUNTERS[id]()]);
}

// ---------- the hound ----------
let hound = null;   // { x, y, rx, ry, hp, maxHp, atk, level, kills, down, face }
const HOUND_COST = 80;
const houndAt = (x, y) => !!hound && !hound.down && scene !== 'house' && hound.x === x && hound.y === y;
function houndState() { return hound ? { hp: Math.max(0, hound.hp), max_hp: hound.maxHp, atk: hound.atk, level: hound.level, kills: hound.kills, down: !!hound.down } : null; }
function placeHound() {
  if (!hound || hound.down || scene === 'house') return;
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = player.x + dx, y = player.y + dy, t = getTile(x, y);
    if (walkable(t) && t !== TILE.DOOR && t !== TILE.EXIT && t !== TILE.TRAP && t !== TILE.SITE && !getMonsterAt(x, y) && !getNpcAt(x, y)) { hound.x = x; hound.y = y; settle(hound); return; }
  }
  hound.x = player.x; hound.y = player.y; settle(hound);
}
function houndHurt(dmg) {
  hound.hp -= dmg; hound.flashUntil = performance.now() + 120;
  floatText(hound.x, hound.y, `-${dmg}`, '#ff9b9b');
  if (hound.hp <= 0) {
    hound.hp = 0; hound.down = true;
    log('Your hound is badly hurt and limps off home. An innkeeper can patch it up.', 'bad'); sfx.play('hurt');
    burst(hound.x, hound.y, '#b9976a', 12, 80, { life: 500 });
  }
}
function houndBitten(m) {
  const dmg = Math.max(1, m.atk - 1);
  m.lunge = { dx: Math.sign(hound.x - m.x), dy: Math.sign(hound.y - m.y), until: performance.now() + 140 };
  houndHurt(dmg);
}
function houndScored() {
  hound.kills++;
  if (hound.kills % 8 === 0) { hound.level++; hound.maxHp += 4; hound.atk += 1; hound.hp = hound.maxHp; log(`Your hound grows stronger (level ${hound.level}).`, 'good'); }
  if (hound.kills >= 10) unlock('good_dog');
}
// One step for the hound: bite an adjacent foe, chase one near the hero, or follow.
function stepHound() {
  if (!hound || hound.down || scene === 'house') return;
  if (cheb(hound, player) > 14) { placeHound(); return; }
  const foe = monsters.find((m) => dist(m, hound) === 1 && (m.awake || dist(m, player) <= 2));
  if (foe) {
    const dmg = Math.max(1, hound.atk + (wearing('houndcollar') ? 3 : 0) + rnd(2) - (foe.mod === 'armored' ? 2 : 0));
    foe.hp -= dmg; foe.awake = true; foe.flashUntil = performance.now() + 120;
    hound.lunge = { dx: Math.sign(foe.x - hound.x), dy: Math.sign(foe.y - hound.y), until: performance.now() + 140 };
    if (foe.x !== hound.x) hound.face = Math.sign(foe.x - hound.x);
    floatText(foe.x, foe.y, `-${dmg}`, '#e9c48a');
    if (coopMember()) { coopHit(foe, dmg, 'hound'); return; }
    if (foe.hp <= 0) { houndScored(); killMonster(foe); }
    return;
  }
  // a waking foe near the hero: go for it; otherwise stay at heel
  const target = monsters.filter((m) => m.awake && cheb(m, player) <= 4 && isVisible(m.x, m.y)).sort((a, b) => dist(a, hound) - dist(b, hound))[0];
  const goal = target || player;
  if (!target && cheb(hound, player) <= 1) return;
  const d = bfs(goal.x, goal.y, 16, false, true);
  let best = null, bestD = d.get(key(hound.x, hound.y)) ?? Infinity;
  for (const [dx, dy] of DIRS) {
    const nx = hound.x + dx, ny = hound.y + dy, nd = d.get(key(nx, ny));
    if (nd === undefined || nd >= bestD) continue;
    if (getMonsterAt(nx, ny) || (nx === player.x && ny === player.y) || getNpcAt(nx, ny) || getTile(nx, ny) === TILE.TRAP) continue;
    bestD = nd; best = [nx, ny];
  }
  if (best) { if (best[0] !== hound.x) hound.face = Math.sign(best[0] - hound.x); hound.x = best[0]; hound.y = best[1]; }
}

function endTurn(moved) {
  turn++;
  mp.lastActive = performance.now();
  if (moved && turn % 2 === 0) sfx.play('step');
  if (moved && scene === 'world') { const gnd = groundAt(player.x, player.y); if (gnd === GROUND.ROAD || gnd === GROUND.SAND) burst(player.x, player.y, gnd === GROUND.SAND ? '#e7d3a1' : '#b9976a', 3, 25, { foot: true, gravity: -10, life: 380, size: 2 }); }
  if (player.cooldown > 0) player.cooldown--;
  if (player.shield > 0 && --player.shield === 0) log('Your shield wall fades.');
  if (player.poison > 0) {
    player.poison--; player.hp -= 1; floatText(player.x, player.y, '-1', '#7ad36b');
    if (player.poison === 0) log('The poison wears off.', 'good');
  }
  if (turn % SAVE_EVERY_TURNS === 0) saveProgress('progress');
  if (scene !== 'dungeon') stepNpcs();
  stepHound();
  // in a shared dungeon the host moves monsters on a steady beat instead of per turn
  if (scene !== 'house' && !coopActive()) {
    stepMonsters();
    if (scene === 'dungeon' && monsters.some((m) => m.mod === 'swift' && m.awake)) stepMonsters(true);
  }
  if (inTown() && (turn % 8 === 0)) refreshTownContext();
  if (wearing('tideheart') && turn % 6 === 0 && player.hp > 0 && player.hp < player.maxHp) { player.hp++; floatText(player.x, player.y, '+1', '#7bdfff'); }
  if (player.meta.blessing && player.meta.blessing.turns > 0 && --player.meta.blessing.turns === 0) log(`The ${player.meta.blessing.name || 'shrine\'s blessing'} fades.`);
  if ((player.cls === 'ranger' || wearing('sunstone')) && scene === 'dungeon') {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const k = key(player.x + dx, player.y + dy);
      if (getTile(player.x + dx, player.y + dy) === TILE.TRAP && !revealedTraps.has(k)) { revealedTraps.add(k); log('Your keen eyes spot a spike trap.', 'good'); bgDirty = true; }
    }
  }
  updateCamera();
  updateVisibility();
  updateStats();
  if (player.hp <= 0) die();
  else arenaTurn();
  if (!gameOver && player.pendingPerks > 0) offerPerks();
  if (inTown()) for (const pl of nearbyPlaces(player.x, player.y, 1)) if (!discovered(pl) && cheb(pl, player) <= 3) discoverPlace(pl);
  if (mapPin && scene === 'world' && cheb(mapPin, player) <= 3) { mapPin = null; savePin(); log('You reach the spot you pinned on your map.', 'good'); }
  if (scene === 'world' && moved && !gameOver && !storyOpen() && !perkChoices && !townContaining(player.x, player.y) && !coopActive()
      && !monsters.some((m) => m.awake && cheb(m, player) <= 6)) {
    encounterClock++;
    if (encounterClock >= 60 && Math.random() < 0.05) { encounterClock = 0; stopWalk?.(); startEncounter(); }
  }
  if (inTown()) {
    const r = realmOfTile(player.x, player.y);
    if (lastRealm && r !== lastRealm) {
      const R = REALMS[r];
      log(`You cross into the ${R.name} (${R.gov}). ${R.blurb}`, 'good');
      toast = { text: `${R.name}. ${R.gov}, ruled by ${R.ruler}.`, until: performance.now() + 4000 };
    }
    lastRealm = r;
  }
  if (inTown()) {
    const here = townContaining(player.x, player.y);
    if (here && here.key !== lastTownKey) {
      const I = townIdentity(here);
      if (!player.meta.visited.includes(here.key)) log(I.describe(), 'good');
      toast = { text: `${here.name}. A ${I.trade.label} ${I.sizeWord} of ${REALMS[I.realm].short}, known for ${I.famous}.`, until: performance.now() + 3500 };
    }
    lastTownKey = here ? here.key : null;
    if (here && !player.meta.visited.includes(here.key)) { player.meta.visited.push(here.key); if (player.meta.visited.length >= 5) unlock('explorer'); }
    if (dayPhase() === 'night') tip('night', 'Night has fallen. Beasts in the wilds notice you from further away, but towns stay safe.');
  }
  draw();
}

function die() {
  if (dungeonDef && dungeonDef.arena && scene === 'dungeon') { leaveArena(true); return; }
  player.hp = 0; updateStats();
  const t = townAt(...homeTown.split(',').map(Number)) || townAt(0, 0);
  const lost = Math.ceil(player.gold / 2);
  endGame('You fell', `You fell ${scene === 'world' ? 'in the wilds' : 'on ' + (dungeonDef ? dungeonDef.name : 'the dungeon') + ' floor ' + floor} after ${turn} turns. You wake at the inn in ${t.name}: level and gear kept, ${lost} gold and your potions gone. Press R to carry on.`);
  player.wx = t.spawn.x; player.wy = t.spawn.y;
  sfx.play('die');
  track('hero_died', { where: scene === 'world' ? 'wilds' : (dungeonDef ? (dungeonDef.kind === 'site' ? dungeonDef.site.type : 'town') : 'dungeon'), floor, turns: turn });
  if (!ACCOUNT.user) {
    guestRespawn = { name: null, floor: 0, level: player.level, xp: player.xp, gold: player.gold - lost, hp: player.maxHp, max_hp: player.maxHp, atk: player.atk,
      weapon: player.weapon, armor: player.armor, bag: player.bag.filter((id) => itemKind(id) !== 'consumable'), quests: [], quests_done: player.questsDone || 0,
      wx: t.spawn.x, wy: t.spawn.y, home: t.key, class: player.cls, guest: true,
      perks: player.perks, achievements: player.achievements, title: player.title, meta: { ...player.meta, hound: houndState() }, weapon_plus: player.weaponPlus, armor_plus: player.armorPlus, kills: player.lifetimeKills };
  }
  saveProgress('death');
}

function openChest(x, y) {
  const danger = dungeonDef ? dungeonDef.danger : 0;
  if (scene === 'dungeon' && floor >= 2 && !coopActive() && !vaultAt(x, y) && Math.random() < 0.12) {
    setTile(x, y, TILE.FLOOR); bgDirty = true;
    const type = MONSTER_TYPES.find((t) => t.name === 'Mimic');
    const mm = addMonster(type, x, y, { hp: type.hp + floor * 2 + danger * 3, atk: type.atk + Math.floor(floor / 2) + Math.floor(danger / 2) });
    shakeScreen(5); sfx.play('boss');
    burst(x, y, '#8b5a2b', 20, 120, { life: 500, size: 3 });
    log('The chest sprouts teeth and lunges at you. A mimic!', 'bad');
    tip('mimic', 'Some chests deeper down are mimics. They hit hard but drop a fat purse.');
    monsterAttack(mm);
    return;
  }
  const gold = Math.round((20 + rnd(30)) * (1 + danger * 0.5) * (dungeonDef ? dungeonDef.gold : 1) * (goldMult()));
  player.gold += gold;
  setTile(x, y, TILE.FLOOR); bgDirty = true;
  log(`You open the chest: ${gold} gold.`, 'good');
  rqProgress('chest'); rqProgress('gold', null, gold);
  burst(x, y, '#ffd86b', 24, 110, { glow: true, gravity: 120, life: 700, rise: 120 });
  if (player.gold >= 1000) unlock('rich');
  floatText(x, y, `+${gold}g`, '#f5c542');
  sfx.play('chest');
  if (Math.random() < 0.4 && !bagFull()) { const keep = dungeonDef; dungeonDef = { ...(dungeonDef || {}), loot: 1 }; dropLoot({ type: { name: 'chest' } }); dungeonDef = keep; }
}
function vaultAt(x, y) {
  const ch = chunks.get(key(Math.floor(x / CHUNK), Math.floor(y / CHUNK)));
  if (!ch || !ch.vaults) return false;
  const lx = x - ch.cx * CHUNK, ly = y - ch.cy * CHUNK;
  return ch.vaults.some((v) => v.x === lx && v.y === ly);
}
// Cracked walls give way after three blows (one with a warhammer, or a bomb); the noise wakes things up.
const crackHits = new Map();
function hitCrack(x, y, blows = 1) {
  const k = key(x, y), n = (crackHits.get(k) || 0) + blows;
  burst(x, y, '#9ca3af', 10, 90, { life: 450, size: 3 }); shakeScreen(2); sfx.play('hit');
  for (const m of monsters) if (!m.awake && cheb(m, { x, y }) <= 6) m.awake = true;
  if (n < 3) { crackHits.set(k, n); log(`You strike the cracked wall. It shifts${n === 2 ? ' and groans: one more blow' : ''}.`); return; }
  crackHits.delete(k);
  setTile(x, y, TILE.FLOOR); bgDirty = true;
  burst(x, y, '#9ca3af', 30, 140, { life: 700, size: 4 }); shakeScreen(5);
  log('The wall crumbles into a hidden vault!', 'good');
  unlock('vault');
  updateVisibility();
}
// A healing spring: drink once for full health and a clean bill.
const usedSprings = new Set();
function drinkSpring(x, y) {
  const k = key(x, y);
  if (usedSprings.has(k)) { log('The spring is dry. It will fill again in a lifetime or two.'); return; }
  usedSprings.add(k); bgDirty = true;
  const healed = player.maxHp - player.hp;
  player.hp = player.maxHp; player.poison = 0;
  if (hound && hound.down) { hound.down = false; hound.hp = hound.maxHp; }
  burst(x, y, '#7bdfff', 30, 90, { glow: true, gravity: -80, life: 900 }); sfx.play('potion');
  floatText(player.x, player.y, healed ? `+${healed}` : '✓', '#9ef0b0');
  log(`You drink from the healing spring${healed ? ` and recover ${healed} HP` : ''}. It sinks away into the stone.`, 'good');
}
function springTrap(x, y) {
  const dmg = 3 + floor + (dungeonDef ? dungeonDef.danger : 0);
  revealedTraps.add(key(x, y)); bgDirty = true;
  player.hp -= dmg;
  log(`Spikes shoot up from the floor! You take ${dmg} damage.`, 'bad');
  burst(x, y, '#c0c0c0', 10, 120, { rise: 140, life: 400, size: 2 });
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
// A target the hero aimed at with the right mouse button: the arrow flies along that
// line, the fireball bursts there. Without one, the ability picks the nearest monster.
function aimedLine(aim, range) {
  const ddx = aim.x - player.x, ddy = aim.y - player.y;
  if ((ddx && ddy) || (!ddx && !ddy)) return null;
  const dx = Math.sign(ddx), dy = Math.sign(ddy);
  for (let d = 1; d <= range; d++) {
    const x = player.x + dx * d, y = player.y + dy * d;
    if (!walkable(getTile(x, y))) return null;
    const m = getMonsterAt(x, y);
    if (m) return { m, d, dx, dy };
  }
  return null;
}
function useAbility(aim = null) {
  if (gameOver || !player || shopOpen || scene === 'house' || perkChoices || storyOpen()) return;
  const cls = heroClass();
  if (player.cooldown > 0) { log(`${cls.ability} is not ready (${player.cooldown} turns).`); draw(); return; }
  const cooldownFor = () => Math.max(1, Math.ceil(cls.cooldown * (1 - 0.2 * perkCount('quickened')) * (wearing('starring') ? 0.5 : 1)));
  if (player.cls === 'warrior') {
    player.shield = 6; player.cooldown = cooldownFor();
    log('You raise your shield wall: 2 less damage from every hit for 6 turns.', 'good');
    burst(player.x, player.y, '#7bdfff', 24, 120, { glow: true, gravity: 0, life: 450 });
    sfx.play('shield'); endTurn(false); return;
  }
  if (player.cls === 'ranger') {
    const t = aim ? aimedLine(aim, 6) : lineTarget(6);
    if (!t) { log(aim ? 'No clear shot there. Arrows fly straight up, down, left or right, up to 6 tiles.' : 'No target in a straight line. Arrows fly up, down, left or right.'); draw(); return; }
    const dmg = Math.max(1, player.atk + weaponAtk() + 1 + rnd(2) - (t.m.mod === 'armored' ? 2 : 0));
    if (t.dx) player.face = t.dx;
    t.m.hp -= dmg; t.m.awake = true; t.m.flashUntil = performance.now() + 120;
    floatText(t.m.x, t.m.y, `-${dmg}`, '#ffd86b');
    for (let d = 1; d < t.d; d++) floatText(player.x + t.dx * d, player.y + t.dy * d, '➤', '#d9b382');
    sfx.play('arrow');
    log(`Your arrow hits ${t.m.boss ? t.m.name : 'the ' + t.m.type.name} for ${dmg}.`);
    if (coopMember()) coopHit(t.m, dmg, 'hero'); else if (t.m.hp <= 0) killMonster(t.m);
    player.cooldown = cooldownFor(); endTurn(false); return;
  }
  if (player.cls === 'mage') {
    let target = null, bd = Infinity;
    if (aim) {
      if (cheb(aim, player) > 5 || !isVisible(aim.x, aim.y)) { log('Too far, or out of sight. A fireball reaches 5 tiles.'); draw(); return; }
      if (!monsters.some((m) => cheb(m, aim) <= 2)) { log('Nothing there to burn.'); draw(); return; }
      target = aim;
    }
    else for (const m of monsters) { const d = cheb(m, player); if (d <= 5 && isVisible(m.x, m.y) && d < bd) { bd = d; target = m; } }
    if (!target) { log('No monster in sight to aim at.'); draw(); return; }
    const dmg = 5 + player.level + rnd(3);
    const hit = monsters.filter((m) => cheb(m, target) <= 2);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.random() < 0.5) floatText(target.x + i, target.y + j, '✸', '#ff9f43');
    sfx.play('fire');
    log(`Your fireball bursts over ${hit.length} ${hit.length === 1 ? 'monster' : 'monsters'} for ${dmg} each.`, 'good');
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) burst(target.x + i, target.y + j, Math.random() < 0.5 ? '#ff9f43' : '#ffd86b', 3, 70, { glow: true, gravity: -80, life: 600, size: 3 });
    for (const m of hit) { m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg}`, '#ffd86b'); }
    for (const m of hit) { if (coopMember()) coopHit(m, dmg, 'hero'); else if (m.hp <= 0) killMonster(m); }
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
  // typing in a form field never moves the hero
  if (e.target && e.target.closest && e.target.closest('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (storyOpen()) {
    const choices = scenePage && scenePage.choices;
    if (choices && choices.length) {
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); chooseScene(Number(e.key) - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); chooseScene(choices.length - 1); }   // the last choice is always the way out
      return;
    }
    if (['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); nextScenePage(); } else if (e.key === 'Escape') { e.preventDefault(); skipScene(); }
    return;
  }
  if (controlsOpen()) { if (['Escape', '?', 'Enter'].includes(e.key)) { e.preventDefault(); toggleControls(false); } return; }
  if (e.key === '?') { e.preventDefault(); toggleControls(true); return; }
  if (journalOpen) { journalKey(e); return; }
  sfx.unlock();
  if (walk.active && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) stopWalk();   // any key takes back control
  if (e.key === 'Enter' && chatInput) { e.preventDefault(); chatInput.focus(); return; }
  if ((e.key === 'y' || e.key === 'Y') && mp.invites.length) { acceptInvite(); return; }
  if (e.key === 'Escape') { closeShop(); if (mapOpen || questsOpen) { mapOpen = false; questsOpen = false; draw(); } return; }
  if (shopOpen) return;
  if (e.key === 'm' || e.key === 'M') { questsOpen = false; toggleMap(); return; }
  if (e.key === 'q' || e.key === 'Q') { mapOpen = false; questsOpen = !questsOpen; draw(); return; }
  if (e.key === 'j' || e.key === 'J') { mapOpen = false; questsOpen = false; journalOpen = true; draw(); return; }
  if (e.key === 'n' || e.key === 'N') { toggleSound(); return; }
  if (perkChoices) { if (['1', '2', '3'].includes(e.key)) choosePerk(Number(e.key) - 1); return; }
  if (e.key === '1') { e.preventDefault(); useAbility(); return; }
  if ((mapOpen || questsOpen) && KEYS[e.key]) { mapOpen = false; questsOpen = false; }
  if (e.key === 'r' || e.key === 'R') { init(); return; }
  if (e.key === 'p' || e.key === 'P') { drinkPotion(); return; }
  if (e.key === 'b' || e.key === 'B') { throwBomb(); return; }
  if (e.key === 't' || e.key === 'T') { readScroll(); return; }
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
const chatForm = document.getElementById('chat'), chatInput = document.getElementById('chat-input');
chatForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim().slice(0, 140);
  if (!text) { chatInput.blur(); return; }
  mpSend({ type: 'chat', payload: { text } }); mpKick();
  mp.bubbles.set('me', { text, until: performance.now() + 5000 });
  log(`You: ${text}`, 'chat');
  chatInput.value = ''; chatInput.blur(); draw();
});
overlay.addEventListener('click', init);

const stageEl = canvas.parentElement;
const fsBtn = document.getElementById('fullscreen');
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else stageEl.requestFullscreen?.().catch(() => log('Fullscreen is not available in this browser.', 'bad'));
}
// The canvas matches the space it is shown in, one canvas pixel per CSS pixel:
// a wider window shows more of the world at the same crisp tile size. Very
// large windows are capped and scaled up, to keep each frame cheap.
const MAX_W = 2400, MAX_H = 1400, MIN_H = 360;
function fitCanvas() {
  let cssW, cssH;
  if (document.fullscreenElement) { cssW = window.innerWidth; cssH = window.innerHeight; }
  else {
    const border = 8;
    cssW = Math.max(240, stageEl.clientWidth - border);
    const top = stageEl.getBoundingClientRect().top + window.scrollY;
    // landscape screens keep a 4:3 ceiling; portrait phones may run taller than wide
    cssH = Math.max(MIN_H, Math.min(window.innerHeight - top - 12 - border, Math.round(cssW * (cssW >= 700 ? 0.75 : 1.35))));
  }
  const w = Math.min(MAX_W, Math.round(cssW)), h = Math.min(MAX_H, Math.round(cssH));
  canvas.style.width = `${Math.round(cssW)}px`; canvas.style.height = `${Math.round(cssH)}px`;
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w; canvas.height = h;
  bg.width = w + T * 2; bg.height = h + T * 2;
  lightCanvas.width = w; lightCanvas.height = h;
  vignette = buildVignette();
  mapCache.ox = null; bgDirty = true;
  ctx.imageSmoothingEnabled = false;
  if (player) { updateCamera(); draw(); }
}
let fitQueued = false;
const queueFit = () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitCanvas(); }); };
fsBtn?.addEventListener('click', toggleFullscreen);
document.getElementById('worldmap')?.addEventListener('click', toggleMap);
document.getElementById('quests')?.addEventListener('click', () => { mapOpen = false; questsOpen = !questsOpen; draw(); });
document.getElementById('journal')?.addEventListener('click', () => { mapOpen = false; questsOpen = false; journalOpen = !journalOpen; draw(); });
document.getElementById('ability')?.addEventListener('click', () => { sfx.unlock(); useAbility(); });
// guests pick a class on their first visit; the choice is remembered in this browser
const classPick = document.getElementById('classpick');
let pendingPrologue = null;
function chooseClass(cls) {
  if (!CLASSES[cls]) return;
  player.cls = cls;
  if (player.level === 1 && player.xp === 0) { player.maxHp = CLASSES[cls].hp; player.hp = CLASSES[cls].hp; player.atk = CLASSES[cls].atk; }
  try { localStorage.setItem('dungeon-class', cls); } catch (e) { /* ignore */ }
  if (classPick) classPick.hidden = true;
  if (pendingPrologue) { const f = pendingPrologue; pendingPrologue = null; setTimeout(f, 300); }
  const ab = document.getElementById('ability'); if (ab) ab.textContent = `${CLASSES[cls].ability} (1)`;
  log(`You are a ${CLASSES[cls].name}. ${CLASSES[cls].blurb}`, 'good');
  track('select_class', { chosen: cls, guest: true });
  buildLegend(); updateStats(); draw();
}
classPick?.querySelectorAll('[data-class]').forEach((b) => b.addEventListener('click', () => { sfx.unlock(); chooseClass(b.dataset.class); }));
const soundBtn = document.getElementById('sound');
function toggleSound() { const muted = sfx.toggle(); if (soundBtn) soundBtn.textContent = muted ? 'Sound off' : 'Sound on'; log(muted ? 'Sound off.' : 'Sound on.'); }
if (soundBtn) soundBtn.textContent = sfx.muted ? 'Sound off' : 'Sound on';
soundBtn?.addEventListener('click', () => { sfx.unlock(); toggleSound(); });
canvas.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
document.addEventListener('fullscreenchange', () => { fitCanvas(); if (fsBtn) fsBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
window.addEventListener('resize', queueFit);
window.addEventListener('orientationchange', queueFit);
if (window.ResizeObserver) new ResizeObserver(queueFit).observe(stageEl);
fitCanvas();
// ---------- touch: tap or hold to walk ----------
// A tap walks one step toward the spot you touched; holding keeps walking
// toward it (re-aimed from wherever the hero now stands). Tapping a monster
// next to you attacks it. Round buttons on the right edge cover the rest.
let isTouch = false;
const touch = { id: null, sx: 0, sy: 0, timer: null };
function touchButtons() {
  if (!isTouch) return [];
  const r = canvas.width < 560 ? 24 : 28, x = canvas.width - r - 12, gap = r * 2 + 12;
  const y0 = Math.max(110, Math.round(canvas.height / 2 - gap * 1.5));
  const cls = heroClass();
  return [
    { id: 'ability', label: player.cooldown > 0 ? String(player.cooldown) : '✦', sub: cls.ability, x, y: y0, r, active: player.cooldown <= 0 },
    { id: 'potion', label: '♥', sub: 'Potion', x, y: y0 + gap, r, active: player.bag.some((id) => itemKind(id) === 'consumable' && itemInfo(id).heal) },
    { id: 'wait', label: '⏸', sub: 'Wait', x, y: y0 + gap * 2, r, active: true },
    { id: 'map', label: scene === 'world' ? 'M' : 'Q', sub: scene === 'world' ? 'Map' : 'Quests', x, y: y0 + gap * 3, r, active: true },
    { id: 'journal', label: 'J', sub: 'Journal', x, y: y0 + gap * 4, r, active: true },
  ];
}
function drawTouchButtons(g) {
  for (const b of touchButtons()) {
    g.globalAlpha = b.active ? 0.9 : 0.5;
    g.fillStyle = 'rgba(6,12,20,0.7)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = b.id === 'ability' && b.active ? '#7bdfff' : '#3b5b70'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#e6eef8'; g.font = `bold ${Math.round(b.r * 0.75)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(b.label, b.x, b.y - 2);
    g.font = '9px sans-serif'; g.fillStyle = '#a8c0d8'; g.fillText(b.sub, b.x, b.y + b.r - 7);
    g.globalAlpha = 1; g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }
}
function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { px: (clientX - rect.left) * canvas.width / rect.width, py: (clientY - rect.top) * canvas.height / rect.height };
}
function touchStep() {
  if (touch.id === null || gameOver || !player || shopOpen || perkChoices || mapOpen || questsOpen) return;
  const { px, py } = canvasPoint(touch.sx, touch.sy);
  const tx = Math.floor((px + cam.x) / T), ty = Math.floor((py + cam.y) / T);
  const dx = tx - player.x, dy = ty - player.y;
  if (!dx && !dy) { stopTouchWalk(); return; }
  // walk the shortest path when the spot can be reached, so obstacles are skirted
  if (walkable(getTile(tx, ty)) && Math.abs(dx) + Math.abs(dy) <= 40) {
    const d = bfs(tx, ty, 48, false), here = d.get(key(player.x, player.y));
    if (here !== undefined) {
      let best = null, bd = here;
      for (const [ax, ay] of DIRS) { const nd = d.get(key(player.x + ax, player.y + ay)); if (nd !== undefined && nd < bd) { bd = nd; best = [ax, ay]; } }
      if (best) { tryMove(best[0], best[1]); return; }
    }
  }
  // otherwise step along the longer axis; if that way is blocked, try the other
  const primary = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  const secondary = primary[0] ? (dy ? [0, Math.sign(dy)] : null) : (dx ? [Math.sign(dx), 0] : null);
  const blocked = ([ax, ay]) => !walkable(getTile(player.x + ax, player.y + ay)) && getTile(player.x + ax, player.y + ay) !== TILE.DOOR && !getMonsterAt(player.x + ax, player.y + ay) && !getNpcAt(player.x + ax, player.y + ay);
  const step = blocked(primary) && secondary && !blocked(secondary) ? secondary : primary;
  tryMove(step[0], step[1]);
}
function stopTouchWalk() { touch.id = null; clearInterval(touch.timer); touch.timer = null; }
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  isTouch = true;
  e.preventDefault();
  sfx.unlock();
  if (perkChoices) { perkClick(e); return; }
  if (journalOpen) { const { px, py } = canvasPoint(e.clientX, e.clientY); journalClick(px, py); return; }
  if (mapOpen) { const { px, py } = canvasPoint(e.clientX, e.clientY); if (mapClick(px, py)) return; }
  if (mapOpen || questsOpen) { mapOpen = false; questsOpen = false; draw(); return; }
  if (gameOver) { init(); return; }
  if (shopOpen) return;
  const { px, py } = canvasPoint(e.clientX, e.clientY);
  const btn = touchButtons().find((b) => Math.hypot(px - b.x, py - b.y) <= b.r + 6);
  if (btn) {
    if (btn.id === 'ability') useAbility();
    else if (btn.id === 'potion') drinkPotion();
    else if (btn.id === 'wait') wait();
    else if (btn.id === 'map') { if (scene === 'world') toggleMap(); else { questsOpen = true; draw(); } }
    else if (btn.id === 'journal') { journalOpen = true; draw(); }
    return;
  }
  stopTouchWalk();
  touch.id = e.pointerId; touch.sx = e.clientX; touch.sy = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  touchStep();
  touch.timer = setInterval(touchStep, 190);
}, { passive: false });
canvas.addEventListener('pointermove', (e) => { if (e.pointerId === touch.id) { touch.sx = e.clientX; touch.sy = e.clientY; } });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, (e) => { if (e.pointerId === touch.id) stopTouchWalk(); });
window.addEventListener('pagehide', () => { if (!gameOver) saveProgress('progress', true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !gameOver) saveProgress('progress', true); if (!document.hidden) { mp.lastActive = performance.now(); mpKick(); } });

// ---------- inventory ----------
const invWeapon = document.getElementById('inv-weapon');
const invArmor = document.getElementById('inv-armor');
const invBag = document.getElementById('inv-bag');
function itemLabel(id) {
  const it = itemInfo(id);
  if (!it) return id;
  if (ITEMS.weapons[id]) return `${it.name}${id === player.weapon && player.weaponPlus ? ' +' + player.weaponPlus : ''} (+${it.atk + (id === player.weapon ? player.weaponPlus || 0 : 0)} attack${WEAPON_TRAITS[id] ? ', ' + WEAPON_TRAITS[id].name : ''})`;
  if (ITEMS.armor[id]) return `${it.name}${id === player.armor && player.armorPlus ? ' +' + player.armorPlus : ''} (${it.def + (id === player.armor ? player.armorPlus || 0 : 0)} defence)`;
  if (ITEMS.relics[id]) return `${it.name} (${it.desc})`;
  if (it.use === 'bomb') return `${it.name} (blasts a 3×3 area)`;
  if (it.use === 'return') return `${it.name} (back to your home town)`;
  return `${it.name} (+${it.heal} HP)`;
}
function renderInventory() {
  if (!invBag || !player) return;
  drawHeroPortrait();
  invWeapon.textContent = player.weapon ? itemLabel(player.weapon) : 'Bare hands';
  invArmor.textContent = player.armor ? itemLabel(player.armor) : 'None';
  { const el = document.getElementById('inv-relic'); if (el) { el.textContent = player.relic ? itemInfo(player.relic).name : 'None'; el.title = player.relic ? itemInfo(player.relic).desc : 'Treasures are found, never bought.'; } }
  invBag.innerHTML = '';
  if (!player.bag.length) {
    const li = document.createElement('li'); li.className = 'empty'; li.textContent = `empty (0/${bagSize()})`; invBag.appendChild(li); return;
  }
  player.bag.forEach((id, idx) => {
    const li = document.createElement('li');
    const kind = itemKind(id);
    const btn = document.createElement('button');
    btn.type = 'button';
    const use = kind === 'consumable' ? (itemInfo(id).use === 'bomb' ? 'Throw' : itemInfo(id).use === 'return' ? 'Read' : 'Drink') : kind === 'relic' ? 'Wear' : 'Equip';
    btn.textContent = use;
    btn.addEventListener('click', () => kind === 'consumable' ? useItem(idx) : equip(idx));
    li.append(itemLabel(id), btn);
    invBag.appendChild(li);
  });
}
function bagFull() { return player.bag.length >= bagSize(); }
function setRelic(id) {
  if (player.relic === 'crown') { player.maxHp -= 10; player.hp = Math.min(player.hp, player.maxHp); }
  player.relic = id;
  if (id === 'crown') { player.maxHp += 10; player.hp += 10; }
  if (hound) { hound.maxHp = Math.max(1, hound.maxHp + (id === 'houndcollar' ? 6 : 0) - (hound.collar ? 6 : 0)); hound.collar = id === 'houndcollar'; hound.hp = Math.min(hound.hp, hound.maxHp); }
}
function equip(idx) {
  const id = player.bag[idx];
  const kind = itemKind(id);
  if (kind === 'consumable') return;
  if (kind === 'relic') {
    player.bag.splice(idx, 1);
    if (player.relic) player.bag.push(player.relic);
    setRelic(id);
    log(`You wear the ${itemInfo(id).name}: ${itemInfo(id).desc}`, 'good');
    updateStats(); renderShop(); buildLegend(); draw();
    return;
  }
  const slot = kind === 'weapon' ? 'weapon' : 'armor';
  player.bag.splice(idx, 1);
  if (player[slot]) player.bag.push(player[slot]);
  if (slot === 'weapon' && player.weaponPlus) { log('Your sharpening stays with the old weapon.'); player.weaponPlus = 0; }
  if (slot === 'armor' && player.armorPlus) { log('Your reinforcement stays with the old armor.'); player.armorPlus = 0; }
  player[slot] = id;
  log(`You equip the ${itemInfo(id).name}.`, 'good');
  updateStats(); renderShop(); draw();
}
function useItem(idx) {
  const it = itemInfo(player.bag[idx]);
  if (!it) return;
  if (it.use === 'bomb') throwBomb(idx);
  else if (it.use === 'return') readScroll(idx);
  else drinkPotion(idx);
}
function throwBomb(idx) {
  if (gameOver || !player || perkChoices) return;
  if (idx === undefined) idx = player.bag.indexOf('bomb');
  if (idx < 0) { log('You have no bombs.'); draw(); return; }
  if (scene === 'house' || safeZone()) { log('Not here. Bombs are for the dungeon and the wilds.'); draw(); return; }
  let target = null, bd = Infinity;
  for (const m of monsters) { const d = cheb(m, player); if (d <= 5 && isVisible(m.x, m.y) && d < bd) { bd = d; target = m; } }
  if (!target) {
    let crack = null;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const x = player.x + dx, y = player.y + dy; if (getTile(x, y) === TILE.CRACK && isVisible(x, y) && (!crack || cheb({ x, y }, player) < cheb(crack, player))) crack = { x, y }; }
    if (crack) target = crack;
  }
  if (!target) { log('Nothing in range to throw a bomb at.'); draw(); return; }
  player.bag.splice(idx, 1);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (getTile(target.x + dx, target.y + dy) === TILE.CRACK) hitCrack(target.x + dx, target.y + dy, 3);
  const dmg = 8 + floor * 2 + (dungeonDef ? dungeonDef.danger : 0);
  const hit = monsters.filter((m) => cheb(m, target) <= 1);
  burst(target.x, target.y, '#ff9f43', 40, 190, { glow: true, life: 600, size: 3 });
  burst(target.x, target.y, '#6b7280', 20, 70, { gravity: -40, life: 900, size: 5 });
  shakeScreen(6); sfx.play('fire');
  log(`Your bomb blasts ${hit.length} ${hit.length === 1 ? 'monster' : 'monsters'} for ${dmg}.`, 'good');
  for (const m of hit) { m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg}`, '#ffd86b'); }
  for (const m of hit) { if (coopMember()) coopHit(m, dmg, 'hero'); else if (m.hp <= 0) killMonster(m); }
  endTurn(false);
}
function readScroll(idx) {
  if (gameOver || !player || perkChoices) return;
  if (idx === undefined) idx = player.bag.indexOf('scroll');
  if (idx < 0) { log('You have no scroll of return.'); draw(); return; }
  if (scene === 'house' || safeZone()) { log('You are already safe in town.'); draw(); return; }
  player.bag.splice(idx, 1);
  burst(player.x, player.y, '#7bdfff', 40, 120, { glow: true, gravity: -120, life: 800 });
  sfx.play('stairs');
  const from = scene === 'dungeon' ? `the ${dungeonDef ? dungeonDef.name : 'dungeon'}` : 'the wilds';
  dungeonDef = null;
  returnHome(); afterSceneChange();
  log(`The scroll crumbles and whisks you out of ${from} to ${townContaining(player.x, player.y)?.name ?? 'town'}.`, 'good');
  saveProgress('progress');
}
function drinkPotion(idx) {
  if (gameOver || !player) return;
  if (idx === undefined) idx = player.bag.findIndex((id) => itemKind(id) === 'consumable' && itemInfo(id).heal);
  if (idx < 0) { log('You have no potions in your bag.'); draw(); return; }
  const it = itemInfo(player.bag[idx]);
  const healed = Math.min(potionHeal(it.heal), player.maxHp - player.hp);
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
function currentRealm() {
  if (scene === 'house' && interior && interior.house && interior.house.town) return realmAt(...interior.house.town.split(',').map(Number));
  if (scene === 'world') return realmOfTile(player.x, player.y);
  return homeTown ? realmAt(...homeTown.split(',').map(Number)) : 'cantons';
}
// Democracy keeps tariffs low; the League's merchant lords charge more but pay
// better for what you sell. Guild members and Cantons aldermen get a discount.
function priceMult() {
  const r = currentRealm(), rs = realmState();
  let m = r === 'cantons' ? 0.9 : r === 'league' && !rs.guild ? 1.15 : 1;
  m *= rs.guild ? 0.85 : rs.standing >= 1000 ? 0.9 : 1;   // the better of the two, not both
  return m;
}
const sellRate = () => (wearing('ledger') ? 0.7 : currentRealm() === 'league' ? 0.6 : 0.5);
const sellPrice = (id) => Math.floor(itemInfo(id).price * sellRate());
const SERVICE_SHOPS = new Set(['travel', 'player', 'court', 'council', 'chieftain', 'shaman', 'bank', 'hermit']);
const SHOPS = {
  shop: { title: 'Merchant', stock: (id, it) => it.floor <= Math.max(floor, 1) + 1, price: (it) => it.price, greet: 'The merchant greets you. Buy and sell with the buttons, Esc to leave.' },
  potions: { title: "Mara's potions", stock: (id) => id === 'potion', price: (it) => it.price - 2, greet: 'Mara sets out her potions. She buys gear too, at half price.' },
  smithy: { title: 'The Smithy', stock: (id, it) => ITEMS.weapons[id] && it.floor <= 5, price: (it) => Math.round(it.price * 0.9), greet: 'The smith wipes his hands. Every blade on the wall is for sale, a tenth off.' },
  armoury: { title: 'The Armoury', stock: (id, it) => ITEMS.armor[id] && it.floor <= 5, price: (it) => Math.round(it.price * 0.9), greet: 'Racks of mail and plate. The armourer names fair prices.' },
  apothecary: { title: 'The Apothecary', stock: (id) => id === 'potion' || id === 'elixir', price: (it) => it.price, greet: 'Shelves of bottles. Potions, and elixirs for the desperate.' },
  royal: { title: 'The Royal Armoury', stock: () => true, price: (it) => it.price, greet: 'The quartermaster unlocks the cabinet. Everything the realm can forge, at the King\'s prices.' },
  inn: { title: 'The inn', stock: () => false, price: (it) => it.price, greet: 'The innkeeper wipes the bar. A bed, or a hound for the road?' },
  travel: { title: 'Waystone', stock: () => false, price: (it) => it.price, greet: 'The runes hum under your hand. Choose a town you have visited.' },
  player: { title: 'Hero', stock: () => false, price: (it) => it.price, greet: '' },
};
SHOPS.apothecary.stock = (id) => id === 'potion' || id === 'elixir' || id === 'scroll';
let shopKind = 'shop';
const buyPrice = (id) => Math.max(1, Math.round(SHOPS[shopKind].price(itemInfo(id)) * priceMult() * (SERVICE_SHOPS.has(shopKind) ? 1 : localDeal(id))));
Object.assign(SHOPS, {
  court: { title: 'The Court of Aurum', stock: () => false, price: (it) => it.price, greet: 'The herald unrolls a long scroll of titles. Each comes with a seal, a ribbon, and a price.' },
  council: { title: 'The Council of the Cantons', stock: () => false, price: (it) => it.price, greet: 'The councillor opens the ledger of public works. Every donation is recorded by name.' },
  chieftain: { title: 'The Clan Fire', stock: () => false, price: (it) => it.price, greet: 'The chieftain looks you up and down. "Outsiders may swear the clan oath. Few do. It asks more than gold, but gold first: a gift for the clan hall."' },
  shaman: { title: 'The Spirits', stock: () => false, price: (it) => it.price, greet: 'The shaman throws herbs on the fire. "Which spirit would you walk with?"' },
  bank: { title: 'The Goldspire Exchange', stock: () => false, price: (it) => it.price, greet: 'The banker steeples her fingers. "Deposits are safe from death itself. There is a small fee."' },
  caravan: { title: 'The merchant caravan', stock: (id, it) => !!ITEMS.consumables[id] || (it.floor >= 3 && it.floor <= 7), price: (it) => Math.round(it.price * 0.95), greet: 'The caravan master throws back a tarp. Goods from every corner of the four realms.' },
  hermit: { title: "The hermit's maps", stock: () => false, price: (it) => it.price, greet: 'The hermit spreads out a bundle of hand-drawn maps. "Places I have been. Places I would not go again."' },
});
function openShop(kind = 'shop') {
  if (!shopEl) return;
  tip('shop', 'Buy with the buttons, sell anything at half price. Smithies and armouries also sharpen and reinforce what you wear.');
  shopKind = kind; shopOpen = true; shopEl.hidden = false;
  shopEl.classList.toggle('no-sell', SERVICE_SHOPS.has(kind));
  document.querySelector('#shop h2').textContent = kind === 'player' && mp.target ? `${mp.target.data.name}, level ${mp.target.data.level} ${mp.target.data.cls}` : SHOPS[kind].title;
  if (SHOPS[kind].greet) log(SHOPS[kind].greet);
  if (!SERVICE_SHOPS.has(kind) && kind !== 'inn') {
    const r = currentRealm(), rs = realmState();
    if (r === 'league' && !rs.guild) log('League prices: 15% dearer than elsewhere, but League merchants pay 60% when you sell.');
    else if (r === 'league') log('Your guild seal earns a bow: guild prices, and 60% when you sell.');
    else if (r === 'cantons') log('Cantons tariffs are low: 10% off everything here.');
  }
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
function shopRow(label, button, onClick, disabled = false) {
  const li = document.createElement('li');
  if (!button) { li.className = 'empty'; li.textContent = label; return li; }
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = button; btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  li.append(label, btn);
  return li;
}
// A room rented once opens a storage chest at every inn: the innkeepers' guild
// carries it between towns. What is in it is safe when you fall.
const ROOM_COST = 250, STASH_SIZE = 20;
const stash = () => player.meta.stash || (player.meta.stash = []);
function stashRows() {
  const rows = [];
  if (!player.meta.room) {
    rows.push(shopRow(`Rent a room for good: a storage chest at every inn, ${STASH_SIZE} items, safe even if you fall`, `Rent ${ROOM_COST}g`, () => {
      if (player.gold < ROOM_COST) return;
      player.gold -= ROOM_COST; player.meta.room = true; sfx.play('chest');
      log('The innkeeper hands you a brass key. "Any inn in the four realms will know it. Your chest travels with the guild wagons."', 'good');
      tip('stash', 'Store spare gear and treasures in your chest at any inn. The chest keeps them safe when you fall.');
      updateStats(); renderShop(); draw(); saveProgress('progress');
    }, player.gold < ROOM_COST));
    return rows;
  }
  const S = stash();
  const head = document.createElement('li'); head.className = 'empty stash-head'; head.textContent = `Your chest (${S.length}/${STASH_SIZE})${S.length ? '' : ': empty'}`; rows.push(head);
  S.forEach((id, i) => rows.push(shopRow(`${itemLabel(id)}`, 'Take', () => {
    if (bagFull()) return;
    player.bag.push(S.splice(i, 1)[0]); log(`You take the ${itemInfo(id).name} from your chest.`);
    updateStats(); renderShop(); draw(); saveProgress('progress');
  }, bagFull())));
  if (player.bag.length) {
    const h2 = document.createElement('li'); h2.className = 'empty stash-head'; h2.textContent = 'From your bag'; rows.push(h2);
    player.bag.forEach((id, i) => rows.push(shopRow(`${itemLabel(id)}`, 'Store', () => {
      if (S.length >= STASH_SIZE) return;
      S.push(player.bag.splice(i, 1)[0]); log(`You lock the ${itemInfo(id).name} in your chest.`);
      updateStats(); renderShop(); draw(); saveProgress('progress');
    }, S.length >= STASH_SIZE)));
  }
  return rows;
}
// A horse from the stables of any city or castle: in the open wilds every step
// covers two tiles. It waits in town and never goes underground.
const HORSE_COST = 400;
const riding = () => !!(player && player.meta && player.meta.horse) && scene === 'world' && !townContaining(player.x, player.y)
  && !monsters.some((m) => m.awake && cheb(m, player) <= 4);
function horseRows() {
  const town = interior && interior.house && interior.house.town ? townAt(...interior.house.town.split(',').map(Number)) : null;
  if (!town || !['city', 'castle', 'grand'].includes(town.size)) return player.meta.horse ? [] : [shopRow('The big inns of cities and castles keep stables, and sell horses')];
  if (player.meta.horse) return [shopRow('Your horse is fed and rested. It carries you two tiles a step in the open wilds')];
  const cost = townIdentity(town).trade.deal === 'horse' ? Math.round(HORSE_COST * 0.75) : HORSE_COST;
  return [shopRow('Buy a horse from the stables: ride two tiles a step through the open wilds', `Buy ${cost}g`, () => {
    if (player.gold < cost) return;
    player.gold -= cost; player.meta.horse = true; sfx.play('quest');
    log('The stable hand leads out a sturdy bay mare. Out in the wilds you ride; in towns and dungeons she waits for you.', 'good');
    tip('horse', 'In the open wilds you ride, two tiles a step. You dismount in towns, underground, and when monsters close in.');
    unlock('rider'); updateStats(); renderShop(); draw(); saveProgress('progress');
  }, player.gold < cost)];
}
function travelCost(town) { const c = 10 + Math.round((Math.abs(town.cx - player.x) + Math.abs(town.cy - player.y)) / 12); return realmState().standing >= 250 ? Math.ceil(c / 2) : c; }
function travelTo(town) {
  const cost = travelCost(town);
  if (player.gold < cost) return;
  player.gold -= cost;
  const distance = Math.abs(town.cx - player.x) + Math.abs(town.cy - player.y);
  closeShop();
  player.x = town.spawn.x; player.y = town.spawn.y; player.wx = player.x; player.wy = player.y;
  turn += Math.round(distance / 4);
  refreshTownContext(); afterSceneChange();
  burst(player.x, player.y, '#7bdfff', 36, 120, { glow: true, gravity: -100, life: 800 });
  sfx.play('stairs'); unlock('traveller');
  track('waystone_travel', { cost });
  log(`The waystone carries you to ${town.name} for ${cost} gold. The journey would have taken half a day.`, 'good');
  saveProgress('progress');
}
function renderShop() {
  if (!shopOpen) return;
  shopGold.textContent = `${player.gold} gold`;
  { const note = document.getElementById('shop-note'); if (note) note.textContent = SERVICE_SHOPS.has(shopKind) || shopKind === 'inn' ? 'Press Esc to leave.' : `Merchants here pay ${sellRate() === 0.6 ? '60%' : 'half'} of an item's price when you sell. Press Esc to leave.`; }
  shopBuy.innerHTML = '';
  if (shopKind === 'inn') {
    shopBuy.appendChild(player.hp < player.maxHp ? shopRow('A bed for the night (full health)', 'Rest, free', () => { restAtInn(); renderShop(); draw(); }) : shopRow('You are already in perfect health'));
    if (!hound) shopBuy.appendChild(shopRow('Hire a hound: 14 HP, bites for 3, follows you and fights', `Hire ${HOUND_COST}g`, () => {
      if (player.gold < HOUND_COST) return;
      player.gold -= HOUND_COST; hound = { x: player.x, y: player.y, hp: 14, maxHp: 14, atk: 3, level: 1, kills: 0, down: false };
      log('A shaggy hound pads over and sits at your feet. It waits outside while you are indoors.', 'good'); sfx.play('quest');
      tip('hound', 'Your hound follows you, bites anything that comes close, and grows stronger with kills. If it falls, an innkeeper patches it up for free.');
      updateStats(); buildLegend(); renderShop(); draw();
    }, player.gold < HOUND_COST));
    else if (hound.down || hound.hp < hound.maxHp) shopBuy.appendChild(shopRow(hound.down ? 'Your hound is back, bandaged and sorry for itself' : 'Patch up your hound', 'Heal, free', () => { hound.hp = hound.maxHp; hound.down = false; log('The innkeeper patches up your hound. Its tail thumps the floor.', 'good'); buildLegend(); renderShop(); draw(); }));
    else shopBuy.appendChild(shopRow(`Your hound is in fine fettle (level ${hound.level}, ${hound.kills} kills)`));
    for (const row of horseRows()) shopBuy.appendChild(row);
    for (const row of stashRows()) shopBuy.appendChild(row);
  }
  if (shopKind === 'player') {
    const o = mp.target;
    if (!o) return;
    if (inMyParty(o.id)) shopBuy.appendChild(shopRow(`${o.data.name} is in your party`));
    else if (mp.party && mp.party.members.length >= 4) shopBuy.appendChild(shopRow('Your party is full (four heroes)'));
    else shopBuy.appendChild(shopRow(`Invite ${o.data.name} to ${mp.party ? 'your' : 'a'} party`, 'Invite', async () => {
      try { await mpApi(ACCOUNT.mpUrl + '/invite', { user_id: o.id }); log(`You invite ${o.data.name} to your party.`, 'good'); } catch (e) { log(e.message, 'bad'); }
      closeShop(); draw();
    }));
    shopBuy.appendChild(shopRow(`Wave at ${o.data.name}`, 'Wave', () => { mpSend({ to: o.id, type: 'wave' }); mp.bubbles.set('me', { text: '*waves*', until: performance.now() + 3000 }); mpKick(); closeShop(); draw(); }));
    shopBuy.appendChild(shopRow(`See ${o.data.name}'s profile`, 'Open', () => { window.open(`/heroes/${encodeURIComponent(o.data.name)}`, '_blank', 'noopener'); }));
    return;
  }
  if (shopKind === 'travel') {
    const here = townContaining(player.x, player.y);
    const dests = player.meta.visited.map((k) => townAt(...k.split(',').map(Number))).filter((t) => t && (!here || t.key !== here.key));
    if (!dests.length) shopBuy.appendChild(shopRow('No other towns yet. Visit a town on foot and its waystone will answer.'));
    for (const t of dests.sort((a, b) => travelCost(a) - travelCost(b))) {
      const cost = travelCost(t);
      shopBuy.appendChild(shopRow(`${t.name}${t.size === 'grand' ? ' ♛' : t.walled ? ' (castle)' : ''}${t.key === homeTown ? ' (home)' : ''}, ${townIdentity(t).trade.label}`, `Travel ${cost}g`, () => travelTo(t), player.gold < cost));
    }
    return;
  }
  if (SERVICE_SHOPS.has(shopKind)) { for (const row of serviceRows(shopKind)) shopBuy.appendChild(row); return; }
  if (shopKind === 'smithy' || shopKind === 'royal') shopBuy.appendChild(upgradeRow('weapon'));
  if (shopKind === 'armoury' || shopKind === 'royal') shopBuy.appendChild(upgradeRow('armor'));
  const stock = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor, ...ITEMS.consumables }).filter(([id, it]) => SHOPS[shopKind].stock(id, it));
  for (const [id] of stock) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = `Buy ${buyPrice(id)}g`;
    btn.disabled = player.gold < buyPrice(id) || bagFull();
    btn.addEventListener('click', () => buy(id));
    const label = document.createElement('span');
    label.append(itemLabel(id));
    const cmp = compareToWorn(id);
    if (cmp) { const c = document.createElement('span'); c.className = `cmp ${cmp.cls}`; c.textContent = cmp.text; label.append(' ', c); }
    if (WEAPON_TRAITS[id]) { const d = document.createElement('small'); d.className = 'trait'; d.textContent = `${WEAPON_TRAITS[id].name}: ${WEAPON_TRAITS[id].desc}`; label.append(d); }
    li.append(label);
    if (cmp && cmp.cls === 'up') {
      const eq = document.createElement('button'); eq.type = 'button'; eq.className = 'primary'; eq.textContent = 'Buy & equip';
      eq.disabled = btn.disabled;
      eq.addEventListener('click', () => { if (buy(id)) equip(player.bag.length - 1); });
      li.append(eq);
    }
    li.append(btn);
    shopBuy.appendChild(li);
  }
  shopSell.innerHTML = '';
  const owned = [];
  if (player.weapon) owned.push({ id: player.weapon, where: 'weapon' });
  if (player.armor) owned.push({ id: player.armor, where: 'armor' });
  player.bag.forEach((id, idx) => { if (itemKind(id) !== 'relic') owned.push({ id, where: idx }); });
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
// ---------- the realms' gold sinks ----------
const NOBLE_RANKS = [
  { name: 'Squire of Aurum', cost: 300, desc: '+5 max HP' },
  { name: 'Knight of Aurum', cost: 1500, desc: '+1 defence, and the title Knight of Aurum' },
  { name: 'Baron of Aurum', cost: 5000, desc: '+1 attack, and the title Baron of Aurum' },
];
const CIVIC_TIERS = [
  { at: 250, name: 'Citizen', desc: 'waystone travel at half price' },
  { at: 1000, name: 'Alderman', desc: '10% off in every shop' },
  { at: 3000, name: 'Hero of the Cantons', desc: 'the title, and your name on the Honour Roll' },
];
const SPIRITS = [
  { id: 'wolf', name: 'Wolf spirit', cost: 80, desc: '+3 attack for 300 turns', bless: { name: 'wolf spirit', atk: 3, def: 0, turns: 300 } },
  { id: 'bear', name: 'Bear spirit', cost: 80, desc: '+3 defence for 300 turns', bless: { name: 'bear spirit', atk: 0, def: 3, turns: 300 } },
  { id: 'stag', name: 'Stag spirit', cost: 160, desc: '+2 attack and +2 defence for 400 turns', bless: { name: 'stag spirit', atk: 2, def: 2, turns: 400 } },
];
const BANK_FEE = 0.05;
function spend(cost) {
  if (player.gold < cost) return false;
  player.gold -= cost; sfx.play('chest'); return true;
}
function afterSpend() { updateStats(); renderShop(); draw(); saveProgress('progress'); }
function serviceRows(kind) {
  const rs = realmState(), rows = [];
  if (kind === 'court') {
    NOBLE_RANKS.forEach((r, n) => {
      if (n < rs.rank) rows.push(shopRow(`✓ ${r.name}`));
      else if (n === rs.rank) rows.push(shopRow(`Be named ${r.name}: ${r.desc}`, `${r.cost}g`, () => {
        if (!spend(r.cost)) return;
        rs.rank = n + 1;
        if (n === 0) { player.maxHp += 5; player.hp += 5; }
        if (n >= 1) player.title = r.name;
        burst(player.x, player.y, '#ffd86b', 30, 100, { glow: true, gravity: -60, life: 900 });
        log(n === 0 ? 'The herald pins a ribbon to your chest. You are a Squire of Aurum.' : n === 1 ? 'You kneel. A sword touches each shoulder. Rise, Knight of Aurum.' : 'A seal, a parchment and a small, muddy estate: you are a Baron of Aurum.', 'good');
        unlock(n === 0 ? 'squire' : n === 1 ? 'knighted' : 'baron');
        track('realm_spend', { realm: 'aurum', what: r.name, cost: r.cost });
        afterSpend();
      }, player.gold < r.cost));
    });
    if (rs.rank >= NOBLE_RANKS.length) rows.push(shopRow('You hold every title the herald can sell'));
  } else if (kind === 'council') {
    const next = CIVIC_TIERS.find((t) => rs.standing < t.at);
    const have = CIVIC_TIERS.filter((t) => rs.standing >= t.at).map((t) => t.name);
    rows.push(shopRow(`Your standing: ${rs.standing} gold given${have.length ? ` · ${have[have.length - 1]}` : ''}${next ? ` · ${next.at - rs.standing} more to become ${next.name} (${next.desc})` : ''}`));
    const works = ['mend the north bridge', 'light the high street', 'pave the market square', 'dig a new well', 'rebuild the schoolhouse', 'pay the town watch'];
    for (const amt of [50, 250, 1000]) rows.push(shopRow(`Donate ${amt} gold to public works`, `Give ${amt}g`, () => {
      if (!spend(amt)) return;
      const before = rs.standing; rs.standing += amt;
      log(`Your ${amt} gold will ${works[rnd(works.length)]}. The councillor writes your name in the ledger.`, 'good');
      for (const t of CIVIC_TIERS) if (before < t.at && rs.standing >= t.at) {
        log(`The council names you ${t.name}: ${t.desc}.`, 'good');
        burst(player.x, player.y, '#5fe17a', 30, 100, { glow: true, gravity: -60, life: 900 });
        if (t.at === 3000) { player.title = 'Hero of the Cantons'; unlock('civic'); }
      }
      track('realm_spend', { realm: 'cantons', what: 'donation', cost: amt });
      afterSpend();
    }, player.gold < amt));
  } else if (kind === 'chieftain') {
    if (rs.oath) rows.push(shopRow('You are clan-sworn. The shamans ask half price of you'));
    else rows.push(shopRow('Swear the clan oath: +6 max HP for good, the title Clan-sworn, and spirits at half price', '800g', () => {
      if (!spend(800)) return;
      rs.oath = true; player.maxHp += 6; player.hp += 6; player.title = 'Clan-sworn';
      log('You share bread and salt with the chieftain at the clan fire, and clasp his hand. The clan roars. You are Clan-sworn.', 'good');
      burst(player.x, player.y, '#e0763a', 30, 100, { glow: true, gravity: -60, life: 900 });
      unlock('clansworn'); track('realm_spend', { realm: 'kathar', what: 'oath', cost: 800 });
      afterSpend();
    }, player.gold < 800));
    for (const r of serviceRows('shaman')) rows.push(r);
  } else if (kind === 'shaman') {
    const b = player.meta.blessing;
    if (b && b.turns > 0) rows.push(shopRow(`You walk with the ${b.name || 'shrine\'s blessing'} for ${b.turns} more turns. A new spirit replaces it`));
    for (const sp of SPIRITS) {
      const cost = rs.oath ? Math.ceil(sp.cost / 2) : sp.cost;
      rows.push(shopRow(`${sp.name}: ${sp.desc}`, `${cost}g`, () => {
        if (!spend(cost)) return;
        player.meta.blessing = { ...sp.bless };
        log(`The smoke takes the shape of a ${sp.id}, and walks into you. ${sp.desc}.`, 'good');
        burst(player.x, player.y, '#e0763a', 24, 90, { glow: true, gravity: -60, life: 800 });
        track('realm_spend', { realm: 'kathar', what: sp.id, cost });
        afterSpend();
      }, player.gold < cost));
    }
    const healCost = rs.oath ? 8 : 15;
    rows.push(shopRow("Ancestors' breath: full health, poison drawn out", `${healCost}g`, () => {
      if (!spend(healCost)) return;
      player.hp = player.maxHp; player.poison = 0; log('The shaman blows smoke over your wounds. They close.', 'good'); afterSpend();
    }, player.gold < healCost || (player.hp >= player.maxHp && !player.poison)));
  } else if (kind === 'bank') {
    rows.push(shopRow(`Your account: ${rs.bank} gold. Deposits are kept safe when you fall. Fee ${BANK_FEE * 100}% on deposits`));
    const deposit = (amt) => {
      amt = Math.min(amt, player.gold); if (amt <= 0) return;
      const fee = Math.ceil(amt * BANK_FEE);
      player.gold -= amt; rs.bank += amt - fee;
      log(`You deposit ${amt} gold. After the fee, ${amt - fee} is in your account.`, 'good'); sfx.play('gold');
      if (rs.bank >= 5000) unlock('banker');
      afterSpend();
    };
    const withdraw = (amt) => {
      amt = Math.min(amt, rs.bank); if (amt <= 0) return;
      rs.bank -= amt; player.gold += amt; log(`You withdraw ${amt} gold.`, 'good'); sfx.play('gold');
      if (player.gold >= 1000) unlock('rich');
      afterSpend();
    };
    rows.push(shopRow('Deposit 100 gold', 'Deposit 100', () => deposit(100), player.gold < 100));
    rows.push(shopRow(`Deposit everything (${player.gold} gold)`, 'Deposit all', () => deposit(player.gold), player.gold <= 0));
    rows.push(shopRow('Withdraw 100 gold', 'Withdraw 100', () => withdraw(100), rs.bank < 100));
    rows.push(shopRow(`Withdraw everything (${rs.bank} gold)`, 'Withdraw all', () => withdraw(rs.bank), rs.bank <= 0));
    if (rs.guild) rows.push(shopRow('You hold a seat in the Merchants\' Guild: 15% off everywhere, and no League markup'));
    else rows.push(shopRow('Buy a seat in the Merchants\' Guild: 15% off in every shop in every realm, and no League markup', '1000g', () => {
      if (!spend(1000)) return;
      rs.guild = true; log('You sign the guild roll in purple ink. Merchants everywhere will know your seal.', 'good');
      unlock('guild'); track('realm_spend', { realm: 'league', what: 'guild', cost: 1000 });
      afterSpend();
    }, player.gold < 1000));
  } else if (kind === 'hermit') {
    const unknown = nearbyPlaces(player.x, player.y, 3).filter((p) => !discovered(p));
    rows.push(shopRow(unknown.length ? `A map of the three nearest places you have not found (${unknown.length} within a few days' walk)` : 'You have found every place the hermit knows about', unknown.length ? '60g' : null, () => {
      if (!spend(60)) return;
      const marks = unknown.sort((a, b) => (Math.abs(a.x - player.x) + Math.abs(a.y - player.y)) - (Math.abs(b.x - player.x) + Math.abs(b.y - player.y))).slice(0, 3);
      for (const p of marks) player.meta.places.push(p.key);
      mapCache.ox = null; bgDirty = true;
      log(`The hermit marks ${marks.map((p) => p.name).join(', ')} on your map.`, 'good');
      afterSpend();
    }, player.gold < 60));
  }
  return rows;
}
// How a weapon or armour compares with what the hero has on: ▲ better, ▼ worse.
function compareToWorn(id) {
  const w = ITEMS.weapons[id], a = ITEMS.armor[id];
  if (!w && !a) return null;
  const slot = w ? 'weapon' : 'armor', stat = w ? 'atk' : 'def', word = w ? 'attack' : 'defence';
  const worn = player[slot] ? itemInfo(player[slot])[stat] + (slot === 'weapon' ? player.weaponPlus || 0 : player.armorPlus || 0) : 0;
  const diff = (w || a)[stat] - worn;
  if (player[slot] === id) return { cls: 'same', text: '(wearing)' };
  return diff > 0 ? { cls: 'up', text: `▲ +${diff} ${word}` } : diff < 0 ? { cls: 'down', text: `▼ ${diff} ${word}` } : { cls: 'same', text: '= same' };
}
function buy(id) {
  const it = itemInfo(id), price = buyPrice(id);
  if (player.gold < price || bagFull()) return false;
  player.gold -= price; player.bag.push(id);
  log(`You buy a ${it.name} for ${price} gold.`, 'good');
  updateStats(); renderShop(); draw();
  return true;
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
  stopWalk(); hover.path = []; hover.sig = '';
  bubble = null; closeShop(); clearInspect(); floats.length = 0; particles.length = 0; mapOpen = false;
  mp.players.clear(); mpKick();
  settle(player); for (const n of npcs) settle(n);
  placeHound();
  updateCamera(); updateVisibility(); buildLegend(); updateStats(); draw();
}
function startRun(saved) {
  player = { x: 1, y: 1, hp: 24, maxHp: 24, atk: 3, level: 1, xp: 0, gold: 0, weapon: null, armor: null, bag: [], quests: [], questsDone: 0, cls: 'warrior', cooldown: 0, shield: 0, poison: 0,
    perks: [], achievements: [], title: null, meta: { visited: [], second_wind: false, places: [], looted: [], found: [], bestiary: {}, story: null, blessing: null, realm: null }, weaponPlus: 0, armorPlus: 0, lifetimeKills: 0, pendingPerks: 0, relic: null };
  questsOpen = false; mapOpen = false; revealedTraps = new Set(); perkChoices = null; toast = null;
  hound = null;
  { const h = saved && saved.meta && saved.meta.hound; if (h && h.max_hp) hound = { x: 0, y: 0, hp: h.hp, maxHp: h.max_hp, atk: h.atk, level: h.level, kills: h.kills, down: !!h.down }; }
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
      meta: { visited: Array.isArray(saved.meta?.visited) ? saved.meta.visited : [], second_wind: !!saved.meta?.second_wind,
        places: Array.isArray(saved.meta?.places) ? saved.meta.places : [], looted: Array.isArray(saved.meta?.looted) ? saved.meta.looted : [],
        found: Array.isArray(saved.meta?.found) ? saved.meta.found.filter((id) => ITEMS.relics[id]) : [],
        bestiary: saved.meta?.bestiary && !Array.isArray(saved.meta.bestiary) ? saved.meta.bestiary : {},
        story: saved.meta?.story && saved.meta.story.phase ? saved.meta.story : null, blessing: saved.meta?.blessing || null,
        realm: { rank: 0, standing: 0, oath: false, guild: false, bank: 0, ...(saved.meta?.realm || {}) }, encounters: Number(saved.meta?.encounters) || 0,
        room: !!saved.meta?.room, stash: Array.isArray(saved.meta?.stash) ? saved.meta.stash.filter(itemInfo).slice(0, STASH_SIZE) : [], deepest: Number(saved.meta?.deepest) || 0,
        rq: saved.meta?.rq && !Array.isArray(saved.meta.rq) ? saved.meta.rq : {}, horse: !!saved.meta?.horse, arena: Number(saved.meta?.arena) || 0 },
      relic: ITEMS.relics[saved.relic] ? saved.relic : null,
      weaponPlus: saved.weapon_plus || 0, armorPlus: saved.armor_plus || 0 });
    // heroes made before classes existed start with the warrior's numbers; fresh heroes take their class's
    if (player.level === 1 && player.xp === 0 && player.maxHp === 20) { player.maxHp = heroClass().hp; player.hp = Math.min(player.hp + heroClass().hp - 20, heroClass().hp); player.atk = heroClass().atk; }
  } else {
    let remembered = null; try { remembered = localStorage.getItem('dungeon-class'); } catch (e) { /* ignore */ }
    if (CLASSES[remembered]) { player.cls = remembered; player.maxHp = CLASSES[remembered].hp; player.hp = player.maxHp; player.atk = CLASSES[remembered].atk; }
    else if (classPick) classPick.hidden = false;
  }
  { const ab = document.getElementById('ability'); if (ab) ab.textContent = `${heroClass().ability} (1)`; }
  if (hound) hound.collar = player.relic === 'houndcollar';
  // heroes who started before the opening existed get to see it once
  if (player.meta.story && !introSeen()) { pendingPrologue = () => { markIntroSeen(); showScene(WORLD_INTRO, () => log('Press J and choose World to read this again.', 'good')); }; if (!classPick || classPick.hidden) setTimeout(() => { const f = pendingPrologue; pendingPrologue = null; if (f) f(); }, 400); }
  if (!player.meta.story) { player.meta.story = { ch: 0, phase: 'summons' }; pendingPrologue = () => { markIntroSeen(); showScene([...WORLD_INTRO, ...PROLOGUE], () => log('Objective: travel to Castle Aurum and speak with King Aldric. The ★ on your compass and map shows the way.', 'good')); };
    if (!classPick || classPick.hidden) setTimeout(() => { const f = pendingPrologue; pendingPrologue = null; if (f) f(); }, 400); }
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
    mp.instance = null;
    startRun(saved || respawn);
    mpStart(); mpKick();
  } finally { starting = false; }
}
// Gamepad: stick or d-pad moves; A ability, B potion, X wait, Y quests, LB bomb,
// RB scroll, Start map. In the perk picker A, B and X pick the three cards.
const pad = { prev: [], lastMove: 0 };
window.addEventListener('gamepadconnected', (e) => { log(`Gamepad connected. Stick moves; A ability, B potion, X wait, Y quests, Start map.`, 'good'); draw(); });
function pollGamepad(now) {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) return;
  const down = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const edge = (i) => down(i) && !pad.prev[i];
  let dx = 0, dy = 0;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (down(14) || ax < -0.5) dx = -1; else if (down(15) || ax > 0.5) dx = 1;
  else if (down(12) || ay < -0.5) dy = -1; else if (down(13) || ay > 0.5) dy = 1;
  if (perkChoices) { if (edge(0)) choosePerk(0); else if (edge(1)) choosePerk(1); else if (edge(2)) choosePerk(2); }
  else if (shopOpen) { if (edge(1)) closeShop(); }
  else if (gameOver) { if (edge(0) || edge(9)) init(); }
  else {
    if ((dx || dy) && now - pad.lastMove > 170) { pad.lastMove = now; mapOpen = false; questsOpen = false; tryMove(dx, dy); }
    if (edge(0)) useAbility();
    if (edge(1)) drinkPotion();
    if (edge(2)) wait();
    if (edge(3)) { mapOpen = false; questsOpen = !questsOpen; draw(); }
    if (edge(4)) throwBomb();
    if (edge(5)) readScroll();
    if (edge(9)) { questsOpen = false; toggleMap(); }
  }
  pad.prev = gp.buttons.map((b) => b.pressed);
}
function loop(now) { pollGamepad(now || performance.now()); if (!gameOver) draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
init();
