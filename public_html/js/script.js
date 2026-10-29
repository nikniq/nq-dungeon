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

const TILE = { WALL: 0, FLOOR: 1, EXIT: 2, SHOP: 3, INN: 4, FOUNTAIN: 5, DOOR: 6, FURNITURE: 7, BED: 8, SITE: 9, CHEST: 10, TRAP: 11, WAYSTONE: 12, LAVA: 13, PLACE: 14, WAYOUT: 15, CRACK: 16, SPRING: 17, MONUMENT: 18, PLOT: 19, WARCAMP: 20, SHIP: 21, CAPTIVE: 22, TOTEM: 23, LEVER: 24, ALTAR: 25, TRIAL: 26 };
const TOWN = 0;           // floor number of the town square
const FINAL_FLOOR = 5;
const VIEW_RADIUS = 8;    // how far the hero sees in the dungeon
const CHUNK = 32;
const T = 32;             // tile size in canvas pixels (sprites are 8px, drawn 4x)
const SIM_RADIUS = 28;    // monsters further than this from the hero stand still

const MONSTER_TYPES = [
  { name: 'Rat',      sprite: 'rat',      hp: 3,  atk: 1, xp: 2,  minFloor: 1 },
  { name: 'Goblin',   sprite: 'goblin',   hp: 5,  atk: 2, xp: 4,  minFloor: 1 },
  { name: 'Skeleton', sprite: 'skeleton', hp: 8,  atk: 3, xp: 7,  minFloor: 2, tell: 'guard' },
  { name: 'Orc',      sprite: 'orc',      hp: 12, atk: 4, xp: 12, minFloor: 3, tell: 'chop' },
  { name: 'Wraith',   sprite: 'wraith',   hp: 10, atk: 5, xp: 16, minFloor: 4 },
  { name: 'Bat',      sprite: 'bat',      hp: 2,  atk: 1, xp: 2,  minFloor: 1, erratic: true },
  { name: 'Spider',   sprite: 'spider',   hp: 5,  atk: 2, xp: 5,  minFloor: 2, poison: true },
  { name: 'Archer',   sprite: 'archer',   hp: 4,  atk: 2, xp: 6,  minFloor: 2, ranged: 4, tell: 'aim' },
  { name: 'Slime',    sprite: 'slime',    hp: 10, atk: 2, xp: 6,  minFloor: 2, splits: true },
  { name: 'Necromancer', sprite: 'necromancer', hp: 9, atk: 2, xp: 18, minFloor: 4, raiser: true },
  { name: 'Mimic',    sprite: 'mimic',    hp: 14, atk: 4, xp: 20, minFloor: 99, noSpawn: true },
  { name: 'Knight',   sprite: 'darkknight', hp: 16, atk: 5, xp: 24, minFloor: 99, noSpawn: true },
  { name: 'Wyrm',     sprite: 'wyrm',     hp: 30, atk: 9, xp: 60, minFloor: 99, noSpawn: true },
  { name: 'Direwolf', sprite: 'direwolf', hp: 18, atk: 7, xp: 30, minFloor: 99, noSpawn: true },
  { name: 'Troll',    sprite: 'troll',    hp: 28, atk: 8, xp: 50, minFloor: 99, noSpawn: true, tell: 'chop' },
  // the ones with tricks: a thief who robs and runs, a shaman who mends its pack and keeps its distance,
  // a troll that knits itself back together, a basilisk whose bite turns you to stone, a goblin with a bomb
  { name: 'Thief',    sprite: 'thief',    hp: 6,  atk: 2, xp: 8,  minFloor: 2, thief: true },
  { name: 'Shaman',   sprite: 'shaman',   hp: 7,  atk: 1, xp: 14, minFloor: 3, ranged: 3, healer: true },
  { name: 'Bomber',   sprite: 'bomber',   hp: 5,  atk: 2, xp: 10, minFloor: 3, bomber: true },
  { name: 'Basilisk', sprite: 'basilisk', hp: 14, atk: 4, xp: 22, minFloor: 5, tell: 'glare' },
  { name: 'Cave troll', sprite: 'cavetroll', hp: 22, atk: 6, xp: 34, minFloor: 6, regen: 2, tell: 'chop' },
  // the beasts of the open sea: seen from the deck, hunted or avoided, never underground
  { name: 'Sea serpent', sprite: 'serpent', hp: 26, atk: 6, xp: 40, minFloor: 99, noSpawn: true, sea: true },
  { name: 'Pirate sloop', sprite: 'sloop', hp: 20, atk: 5, xp: 30, minFloor: 99, noSpawn: true, sea: true, purse: true },
  { name: 'Kraken', sprite: 'kraken', hp: 60, atk: 9, xp: 120, minFloor: 99, noSpawn: true, sea: true },
];
// Hero classes: base stats, a sprite, and one ability on the 1 key.
// Abilities run on mana: a pool that grows with level and refills a point a turn.
const maxMana = () => { const c = CLASSES[player.cls] || CLASSES.warrior; return c.mana + c.manaPerLevel * (player.level - 1); };
const abilityCost = (slot = 0) => { const A = (ABILITIES[player.cls] || ABILITIES.warrior)[slot]; return Math.max(1, Math.ceil(A.cost * (1 - 0.2 * perkCount('quickened')) * (wearing('starring') ? 0.5 : 1))); };
function restoreMana(n = Infinity) { player.mana = Math.min(maxMana(), (player.mana ?? 0) + n); }
const CLASSES = {
  warrior: { name: 'Warrior', hp: 24, atk: 3, sprite: 'player', ability: 'Shield Wall', mana: 20, manaPerLevel: 1, cost: 18, blurb: 'Shield Wall now; Whirlwind at level 5, War Cry at level 10.' },
  ranger:  { name: 'Ranger',  hp: 18, atk: 3, sprite: 'ranger', ability: 'Arrow',       mana: 12, manaPerLevel: 1, cost: 3,  blurb: 'Arrow now; Volley at level 5, Evade at level 10. Rangers also spot traps two tiles away.' },
  mage:    { name: 'Mage',    hp: 16, atk: 2, sprite: 'mage',   ability: 'Fireball',    mana: 24, manaPerLevel: 2, cost: 8,  blurb: 'Fireball now; Frost Nova at level 5, Blink at level 10.' },
};
const heroClass = () => CLASSES[player && player.cls] || CLASSES.warrior;

// Perks: one choice of three at every level up. Some stack, most are once.
const PERKS = {
  tough:       { name: 'Tough',       desc: '+6 max HP',                                 max: 99 },
  brawn:       { name: 'Brawn',       desc: '+1 attack',                                 max: 99 },
  thick_skin:  { name: 'Thick skin',  desc: '+1 defence, without armor',                 max: 3 },
  quickened:   { name: 'Quickened',   desc: 'Your ability costs 20% less mana',          max: 2 },
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
let perkCursor = 0;       // the card the arrow keys have highlighted
let aboard = false;       // the hero is at sea in their own ship

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
  good_dog:    { label: 'A pet of yours made ten kills', title: 'Beastmaster' },
  menagerie:   { label: 'Kept three pets at once', title: 'the Menagerist' },
  elite:       { label: 'Slew an elite monster', title: 'the Undaunted' },
  fellowship:  { label: 'Joined a party', title: 'the Companion' },
  naturalist:  { label: 'Slew every kind of monster', title: 'the Naturalist' },
  wanderer10:  { label: 'Discovered ten places', title: 'the Pathfinder' },
  collector:   { label: 'Found five treasures', title: 'the Treasure-seeker' },
  crownbearer: { label: 'Restored the Crown of Aurum', title: 'Crownbearer' },
  rescuer:     { label: 'Led a captive out of a dungeon', title: 'the Rescuer' },
  liberator:   { label: 'Rescued ten captives', title: 'the Liberator' },
  lairslayer:  { label: 'Slew a super boss in its lair', title: 'the Legend-slayer' },
  legend:      { label: 'Cleared all six lairs', title: 'the Living Legend' },
  dawnbreaker: { label: 'Reforged Dawnbreaker, the sword of the First King', title: 'the Dawnbringer' },
  proven:      { label: 'Passed a dungeon trial', title: 'the Proven' },
  unbroken:    { label: 'Passed ten dungeon trials', title: 'the Unbroken' },
  seawolf:     { label: 'Sank a pirate sloop', title: 'the Sea-wolf' },
  krakenslayer: { label: 'Killed a kraken', title: 'the Kraken-killer' },
  sailor:      { label: 'Took ship between ports', title: 'the Seafarer' },
  deepwarden:  { label: 'Closed the Dreaming Maw', title: 'Deepwarden' },
  general:     { label: 'Your army razed an orc warcamp', title: 'the General' },
  warlord:     { label: 'Five warcamps razed', title: 'the Warlord' },
  builder:     { label: 'Built a monument for other heroes', title: 'the Builder' },
  patron:      { label: 'Upgraded a monument', title: 'the Patron' },
  hunter:      { label: 'Collected three bounties', title: 'the Bounty Hunter' },
  angler:      { label: 'Caught a golden carp', title: 'the Angler' },
  camper:      { label: 'Made camp in the wilds', title: 'the Wanderer' },
  rider:       { label: 'Bought a horse', title: 'the Rider' },
  shipwright:  { label: 'Bought a ship', title: 'the Captain' },
  treasure:    { label: 'Dug up buried treasure', title: 'the Fortunate' },
  serpent:     { label: 'Killed a sea serpent', title: 'Serpentsbane' },
  champion:    { label: 'Survived ten waves in the Grand Arena', title: 'Champion of Aurum' },
  four_realms: { label: 'Finished every realm questline', title: 'Friend of Four Realms' },
  farshore:    { label: 'Crossed the Veil to the Far Shore', title: 'of the Far Shore' },
  seven_realms: { label: 'Finished every questline on both shores', title: 'Friend of Seven Realms' },
  hollowking:  { label: 'Slew the Hollow King', title: 'Breaker of the Barrow' },
  northbound:  { label: 'Answered the raven', title: 'the Far-Farer' },
  giantsbane:  { label: 'Slew Thrym, Jarl of the Frost Giants', title: 'Giantsbane' },
  castaway:    { label: 'Washed up on a shore after losing at sea', title: 'the Castaway' },
  delver:      { label: 'Took on the Daily Delve', title: 'the Delver' },
  enchanted:   { label: 'Found a magic weapon or armour', title: 'the Enchanted' },
  delve_champion: { label: 'Topped the Daily Delve board', title: 'Champion of the Delve' },
  longnight:   { label: 'Saw the sky tear', title: 'of the Long Night' },
  riftwarden:  { label: 'Closed five rifts to Midgard', title: 'Warden of the Rifts' },
  riftlord:    { label: 'Slew the Rift Lord', title: 'Shield of Seven Realms' },
  reckoning:   { label: 'Took up the rebuilding', title: 'the Steward' },
  mason:       { label: 'Sponsored three structures', title: 'the Mason' },
  founder:     { label: 'Sponsored ten structures across the realms', title: 'the Founder' },
  mandarin:    { label: 'Passed the imperial examination', title: 'the Mandarin' },
  pilgrim:     { label: 'Walked the nine gates of Suryapur', title: 'the Pilgrim' },
  boyar:       { label: "Seated on the Tsar's council", title: 'the Boyar' },
  abyss10:     { label: 'Reached floor 10 of the Deep', title: 'the Deepwalker' },
  abyss25:     { label: 'Reached floor 25 of the Deep', title: 'Lord of the Deep' },
  wayfarer:    { label: 'Met ten strangers on the road', title: 'the Wayfarer' },
  postern:     { label: "Found the Queen's postern", title: 'the Sly' },
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
// Player settings, kept per browser.
const settings = { music: 0.5, sfx: 0.8, shake: true, numbers: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('dungeon-settings') || '{}')); } catch (e) { /* defaults */ }
function saveSettings() { try { localStorage.setItem('dungeon-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
function shakeScreen(mag, ms = 220) { if (!settings.shake) return; shake = { mag, until: performance.now() + ms }; }

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
  frost:   { name: 'Halls of ice',     floor: ['#8fa9c0', '#86a0b8', '#98b2c9'], face: '#5c7b96', cap: '#c6d8e8', capHi: '#e3eef8', bricks: ['#7b99b3', '#7291ab', '#84a2bc', '#6c8aa4'], top: ['#48647e', '#425d76'], rim: '#6c89a3', moss: 0, bones: 0.04, puddles: false },
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
const getNpcAt = (x, y) => npcs.find((n) => n.x === x && n.y === y && !n.down);
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
const walkable = (t) => t !== TILE.WALL && t !== TILE.FOUNTAIN && t !== TILE.FURNITURE && t !== TILE.CHEST && t !== TILE.WAYSTONE && t !== TILE.PLACE && t !== TILE.WAYOUT && t !== TILE.CRACK && t !== TILE.SPRING && t !== TILE.MONUMENT && t !== TILE.PLOT && t !== TILE.WARCAMP && t !== TILE.SHIP && t !== TILE.CAPTIVE && t !== TILE.TOTEM && t !== TILE.LEVER && t !== TILE.ALTAR && t !== TILE.TRIAL;
const hazard = (x, y) => getTile(x, y) === TILE.LAVA || (getTile(x, y) === TILE.TRAP && revealedTraps.has(key(x, y)));

// ---------- account save/load ----------
const ACCOUNT = window.DUNGEON || { user: false };
const ITEMS = ACCOUNT.items || { weapons: {}, armor: {}, consumables: {}, bag_size: 12 };
ITEMS.relics = ITEMS.relics || {};
// Magic items: a dropped weapon or armour may carry an affix and a tier, written
// into its id as base~affix~tier (longsword~flaming~2). itemInfo composes the
// named, stat-adjusted item; everything else keeps treating the id as a string.
const AFFIXES = ITEMS.affixes || { weapon: {}, armor: {} };
const TIER_NAMES = ['', '', 'II', 'III'];
const parseItem = (id) => { if (typeof id !== 'string') return null; const p = id.split('~'); return p.length === 3 ? { base: p[0], affix: p[1], tier: Math.max(1, Math.min(3, Number(p[2]) || 1)) } : { base: id, affix: null, tier: 0 }; };
const baseOf = (id) => (parseItem(id) || { base: id }).base;
const affixOf = (id) => { const p = parseItem(id); return p && p.affix ? { id: p.affix, tier: p.tier, ...(AFFIXES.weapon[p.affix] || AFFIXES.armor[p.affix] || {}) } : null; };
const itemCache = new Map();
function itemInfo(id) {
  const p = parseItem(id); if (!p) return null;
  const base = ITEMS.weapons[p.base] || ITEMS.armor[p.base] || ITEMS.consumables[p.base] || ITEMS.relics[p.base] || null;
  if (!base || !p.affix) return base;
  if (itemCache.has(id)) return itemCache.get(id);
  const slot = ITEMS.weapons[p.base] ? 'weapon' : 'armor', A = AFFIXES[slot][p.affix] || { name: p.affix[0].toUpperCase() + p.affix.slice(1), desc: '' };
  const it = { ...base, base: p.base, affix: p.affix, tier: p.tier, name: `${A.name} ${base.name[0].toLowerCase() + base.name.slice(1)}${p.tier > 1 ? ' ' + TIER_NAMES[p.tier] : ''}`, price: Math.round(base.price * (1.6 + 0.6 * (p.tier - 1))), magic: A.desc };
  if (slot === 'weapon') it.atk = base.atk + p.tier + (p.affix === 'heavy' ? 2 : 0); else it.def = base.def + p.tier + (p.affix === 'sturdy' ? 1 : 0);
  itemCache.set(id, it);
  return it;
}
const itemKind = (id) => { const b = baseOf(id); return ITEMS.weapons[b] ? 'weapon' : ITEMS.armor[b] ? 'armor' : ITEMS.relics[b] ? 'relic' : 'consumable'; };
// a dropped weapon or armour sometimes comes enchanted, more often and better the deeper you are
function rollAffix(id) {
  const kind = itemKind(id), base = itemInfo(id);
  if ((kind !== 'weapon' && kind !== 'armor') || !base || base.floor >= 99) return id;
  const danger = dungeonDef ? dungeonDef.danger || 0 : 0;
  if (Math.random() > Math.min(0.65, 0.18 + floor * 0.05 + danger * 0.03)) return id;
  const pool = Object.keys(AFFIXES[kind]); if (!pool.length) return id;
  const r = Math.random() + floor * 0.03 + danger * 0.02, tier = r > 1.1 ? 3 : r > 0.75 ? 2 : 1;
  return `${id}~${pool[rnd(pool.length)]}~${tier}`;
}
const wornAffix = (slot) => affixOf(player[slot]);
// The relic you wear changes how you play; see config/items.php for the list.
const wearing = (id) => !!player && player.relic === id;
const goldMult = () => (perkCount('lucky') ? 1.25 : 1) * (wearing('luckycoin') ? 1.4 : 1) * (wearing('ledger') ? 1.25 : 1) * (wearing('founderseal') ? 1.15 : 1);
const potionHeal = (h) => h * (wearing('royalsignet') ? 2 : 1);
const weaponAtk = () => ((player.weapon && itemKind(player.weapon) === 'weapon') ? itemInfo(player.weapon).atk + (player.weaponPlus || 0) : 0) + (wearing('emberbrand') ? 2 : 0) + (wearing('crown') ? 2 : 0) + (wearing('deepheart') ? 3 : 0) + ((player.meta && player.meta.blessing && player.meta.blessing.turns > 0) ? (player.meta.blessing.atk || 0) : 0) + (realmState().rank >= 3 ? 1 : 0) + (wearing('bloodtorc') && player.hp <= player.maxHp / 2 ? 3 : 0) + (player.rage > 0 ? 2 : 0) + (wearing('bearcharm') && dayPhase() === 'night' ? 3 : 0) + (wearing('hollowcrown') ? 3 : 0) + (wearing('riftheart') ? 2 : 0);
const armorDef = () => ((player.armor && itemKind(player.armor) === 'armor') ? itemInfo(player.armor).def + (player.armorPlus || 0) : 0) + perkCount('thick_skin') + (wearing('sunlotus') && dayPhase() !== 'night' ? 2 : 0) + (wearing('hollowcrown') ? 3 : 0) + (wearing('frostheart') ? 4 : 0) + (wearing('riftheart') ? 2 : 0) + (wearing('founderseal') ? 1 : 0) + (wearing('bonecharm') ? 2 : 0) + (wearing('crown') ? 2 : 0) + (wearing('deepheart') ? 3 : 0)
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
        meta: { visited: player.meta.visited.slice(-80), second_wind: !!player.meta.second_wind, pets: petsState(),
          story: story(), places: player.meta.places.slice(-400), looted: player.meta.looted.slice(-400), found: player.meta.found,
          bestiary: player.meta.bestiary || {}, blessing: player.meta.blessing && player.meta.blessing.turns > 0 ? player.meta.blessing : null, realm: realmState(), encounters: player.meta.encounters || 0,
          room: !!player.meta.room, stash: stash(), deepest: player.meta.deepest || 0, rq: player.meta.rq || {}, horse: !!player.meta.horse, ship: player.meta.ship || null, charts: player.meta.charts || [], treasures: player.meta.treasures || 0, secrets: player.meta.secrets || [], story2: player.meta.story2 || null, story3: player.meta.story3 || null, story4: player.meta.story4 || null, story5: player.meta.story5 || null, delve: player.meta.delve || null, arena: player.meta.arena || 0, rod: !!player.meta.rod, forged: !!player.meta.forged, trials: player.meta.trials || 0, war: war(), act2: act2(), lairs: lairState(), rescued: player.meta.rescued || 0 },
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
    me: { face: player.face || 1, hp: player.hp, maxHp: player.maxHp, level: player.level, cls: player.cls, look: { w: baseOf(player.weapon) || null, a: baseOf(player.armor) || null, r: player.relic || null }, def: armorDef(), shield: player.shield || 0,
      floor, scene, where: mpWhere(), title: player.title || null,
      hound: livePets()[0] ? { x: livePets()[0].x, y: livePets()[0].y, face: livePets()[0].face || 1, kind: livePets()[0].kind } : null },
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
  if (p.src === 'hound' && livePets()[0]) petScored(livePets()[0]);
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
  if (mp.on && !(dungeonDef && dungeonDef.delve)) {   // the Daily Delve is a dream, and solo
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
  let ctx = null, muted = false, out = null;
  try { muted = localStorage.getItem('dungeon-muted') === '1'; } catch (e) { /* storage may be blocked */ }
  const ensure = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (ctx && !out) { out = ctx.createGain(); out.gain.value = settings.sfx; out.connect(ctx.destination); }
    return ctx;
  };
  const tone = (freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) => {
    const c = ensure(); if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur);
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
    unlock: () => { const c = ensure(); music.start(); return c; },
    toggle: () => { muted = !muted; try { localStorage.setItem('dungeon-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ } music.refresh(); return muted; },
    setVolume: (v) => { if (out) out.gain.value = v; },
    get ctx() { return ctx; },
    get muted() { return muted; },
  };
})();

// ---------- music ----------
// A small generative score: a bass note and a soft pad each bar, and a melody
// that wanders the mood's scale. Each place has its own mood; the arena adds drums.
const music = (() => {
  const MOODS = {
    town:    { bpm: 84, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 5, 7, 0], lead: 'triangle', density: 0.55, pad: 0.025 },
    night:   { bpm: 64, root: 57, scale: [0, 2, 3, 7, 9], prog: [0, 5, 3, 7], lead: 'sine', density: 0.35, pad: 0.03 },
    wilds:   { bpm: 72, root: 62, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 2, 7, 5], lead: 'triangle', density: 0.4, pad: 0.03 },
    dungeon: { bpm: 60, root: 50, scale: [0, 2, 3, 7, 8], prog: [0, 8, 3, 10], lead: 'sine', density: 0.28, pad: 0.04, drone: true },
    deep:    { bpm: 52, root: 45, scale: [0, 1, 3, 7, 8], prog: [0, 1, 0, 8], lead: 'sine', density: 0.22, pad: 0.045, drone: true },
    arena:   { bpm: 120, root: 52, scale: [0, 3, 5, 7, 10], prog: [0, 0, 3, 5], lead: 'square', density: 0.6, pad: 0.02, drums: true },
  };
  let gain = null, timer = null, mood = null, next = 0, step = 0, bar = 0, last = 2, noise = null;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const ctx = () => sfx.ctx;
  const vol = () => (sfx.muted ? 0 : settings.music * 0.35);
  function note(n, t, dur, type, v) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(midi(n), t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(gain); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kind) {
    const c = ctx();
    if (kind === 'kick') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(gain); o.start(t); o.stop(t + 0.25); return; }
    if (!noise) { noise = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    src.buffer = noise; f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : 7000;
    g.gain.setValueAtTime(kind === 'snare' ? 0.25 : 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'snare' ? 0.15 : 0.05));
    src.connect(f); f.connect(g); g.connect(gain); src.start(t); src.stop(t + 0.2);
  }
  function schedule() {
    const c = ctx(); if (!c || !mood || c.state !== 'running') return;
    const M = MOODS[mood], eighth = 60 / M.bpm / 2;
    if (next < c.currentTime) next = c.currentTime + 0.05;
    while (next < c.currentTime + 0.4) {
      const chord = M.prog[bar % M.prog.length], base = M.root + chord;
      if (step === 0) {
        note(base - 12, next, eighth * 8, 'sine', 0.12);
        note(base, next, eighth * 8, 'triangle', M.pad); note(base + (M.scale.includes(3) ? 3 : 4), next, eighth * 8, 'triangle', M.pad * 0.8); note(base + 7, next, eighth * 8, 'triangle', M.pad * 0.7);
        if (M.drone) note(M.root - 24, next, eighth * 8.5, 'sawtooth', 0.012);
      }
      if (M.drums) { if (step % 4 === 0) drum(next, 'kick'); if (step % 4 === 2) drum(next, 'snare'); drum(next, 'hat'); }
      if (Math.random() < M.density) {
        last = Math.max(0, Math.min(M.scale.length * 2 - 1, last + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const n = M.root + 12 + M.scale[last % M.scale.length] + 12 * Math.floor(last / M.scale.length) + (chord > 6 ? chord - 12 : chord) * 0;
        note(n, next, eighth * (Math.random() < 0.3 ? 3 : 1.6), M.lead, M.lead === 'square' ? 0.035 : 0.07);
      }
      next += eighth; step = (step + 1) % 8; if (step === 0) bar++;
    }
  }
  function ensureGain() { const c = ctx(); if (c && !gain) { gain = c.createGain(); gain.gain.value = vol(); gain.connect(c.destination); } return gain; }
  return {
    start() { if (!ctx()) return; ensureGain(); if (!timer) timer = setInterval(schedule, 120); },
    setMood(m) {
      if (m === mood) return;
      const c = ctx(); mood = m; bar = 0; step = 0;
      if (c && gain) { gain.gain.cancelScheduledValues(c.currentTime); gain.gain.setValueAtTime(0.0001, c.currentTime); gain.gain.linearRampToValueAtTime(vol(), c.currentTime + 1.5); }
      next = c ? c.currentTime + 0.3 : 0;
    },
    refresh() { const c = ctx(); if (c && gain) gain.gain.setTargetAtTime(vol(), c.currentTime, 0.1); },
    get mood() { return mood; },
  };
})();
function currentMood() {
  if (scene === 'dungeon') return dungeonDef && dungeonDef.arena ? 'arena' : dungeonDef && dungeonDef.endless ? 'deep' : 'dungeon';
  if (scene === 'house') return 'town';
  if (!player) return 'town';
  if (townContaining(player.x, player.y)) return dayPhase() === 'night' ? 'night' : 'town';
  return dayPhase() === 'night' ? 'night' : 'wilds';
}
// Browsers allow sound only after the player does something; any key or tap will do.
for (const ev of ['keydown', 'pointerdown']) document.addEventListener(ev, () => { if (!sfx.ctx || sfx.ctx.state !== 'running') sfx.unlock(); else music.start(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { const c = sfx.ctx; if (!c) return; if (document.hidden) c.suspend(); else c.resume(); });

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
  const sup = !!(def.boss && def.boss.hpMult);
  // a super boss is built for heroes of its lair's level: a big pool, and hits that bite through good armour
  const hp = sup ? type.hp * def.boss.hpMult + danger * 40 : type.hp * (def.boss ? 5 : 4) + danger * 4 + floor * 2;
  monsters.push({ ...cell, id: 'boss', type, name: def.boss ? def.boss.name : BOSS_NAMES[type.name], yields: !!(def.boss && def.boss.yields), superBoss: !!(def.boss && def.boss.hpMult), hp, maxHp: hp, atk: sup ? type.atk + danger : type.atk + 1 + Math.ceil(danger / 2), awake: false, boss: true });
  monstersDirty = true;
}
const bossAlive = () => scene === 'dungeon' && monsters.some((m) => m.boss);

// ---------- quests ----------
// Captains, castellans and the King ask for sites to be cleared; townsfolk
// ask for a tally of a monster. Rewards pay out the moment a quest completes.
const QUEST_MAX = 3;
const QUEST_GIVERS_CLEAR = ['Captain Orla', 'Bren the guard', 'The Castellan', 'King Aldric'];
// Each town's watch posts one bounty: a named beast prowling the wilds nearby.
const BOUNTY_GIVERS = ['Captain Orla', 'The Castellan'];
const BOUNTY_NAMES = ['Old Gnasher', 'the Widowmaker', 'Three-Toes', 'the Grey Terror', 'Mossback', 'Red Jaw', 'Crookback', 'Night-Eye', 'the Terror of the Ford', 'Ironhide'];
function bountyFor(town) {
  const i = town.i, j = town.j, d = Math.max(Math.abs(i), Math.abs(j));
  const names = d < 2 ? ['Goblin', 'Spider', 'Orc'] : d < 4 ? ['Orc', 'Spider', 'Skeleton'] : ['Orc', 'Wraith', 'Skeleton'];
  const type = MONSTER_TYPES.find((t) => t.name === names[Math.floor(cellRand(i, j, 511) * names.length)]);
  let angle = cellRand(i, j, 510) * Math.PI * 2, far = 26 + Math.floor(cellRand(i, j, 513) * 14), bx = town.cx, by = town.cy;
  for (let k = 0; k < 8; k++, angle += Math.PI / 4) { bx = Math.round(town.cx + Math.cos(angle) * far); by = Math.round(town.cy + Math.sin(angle) * far); if (isLand(bx, by)) break; }   // the beast prowls on land
  return { key: town.key, town, type, name: BOUNTY_NAMES[Math.floor(cellRand(i, j, 512) * BOUNTY_NAMES.length)], x: bx, y: by, reward: 80 + d * 60, danger: d };
}
const activeBounties = () => (player.quests || []).filter((q) => q.kind === 'bounty' && !q.done);
// Put each hunted beast back in the world (they are not saved, so a reload brings them back).
function spawnBounties() {
  if (scene !== 'world') return;
  for (const q of activeBounties()) {
    if (worldMonsters.some((m) => m.bounty === q.target)) continue;
    const t = townAt(...q.target.split(',').map(Number)); if (!t) continue;
    const b = bountyFor(t);
    let spot = null;
    for (let r = 0; r <= 8 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (getTile(x, y) === TILE.FLOOR && !townContaining(x, y) && !getMonsterAt(x, y) && !(x === player.x && y === player.y)) spot = { x, y };
    }
    if (!spot) continue;
    const hp = (b.type.hp + b.danger) * 3;
    worldMonsters.push({ ...spot, id: `bounty-${q.target}`, type: b.type, hp, maxHp: hp, atk: b.type.atk + 1 + Math.floor(b.danger / 2), awake: false, wild: true, bounty: q.target, name: b.name });
    monsters = worldMonsters; monstersDirty = true;
  }
}
function bountyTalk(n) {
  if (!BOUNTY_GIVERS.includes(n.type.name)) return false;
  const here = townContaining(player.wx ?? player.x, player.wy ?? player.y) || nearestTownTo(player.wx ?? player.x, player.wy ?? player.y);
  if (!here) return false;
  const b = bountyFor(here), id = 'bounty:' + here.key, dir = compassWord(b.x - here.cx, b.y - here.cy).toLowerCase();
  if (questDoneIds().has(id)) return false;
  const active = (player.quests || []).find((q) => q.id === id && !q.done);
  if (active) { log(`${n.type.name}: "${b.name} is still out there, ${dir} of town. Bring us its head and the purse is yours."`); return true; }
  if (questsActive().length >= QUEST_MAX) return false;
  showScene([{ who: `WANTED: ${b.name}`, sprite: b.type.sprite,
    text: `A notice is nailed to the board: a ${b.type.name.toLowerCase()} the size of a cart, called ${b.name}, has been raiding farms and travellers. It was last seen ${dir} of ${here.name}, about ${Math.round(Math.hypot(b.x - here.cx, b.y - here.cy))} paces out. Reward: ${b.reward} gold.`,
    choices: [
      { label: 'Take the bounty', run: () => {
        player.quests.push({ id, kind: 'bounty', label: `Hunt ${b.name}, last seen ${dir} of ${here.name}`, target: here.key, need: 1, have: 0, done: false, giver: n.type.name, reward: b.reward });
        sfx.play('quest'); track('bounty_taken', { town: here.name });
        tip('bounty', 'Bounty beasts are marked with a skull, on the map and in the wild. They are tougher than most, so bring potions.');
        return `"Good hunting," says ${n.type.name}. The beast is marked on your map with a skull.`; } },
      { label: 'Ask about other work', run: () => { setTimeout(() => { offerQuest(n); draw(); }, 0); return null; } },
      { label: 'Not now', run: () => 'You leave the notice on the board.' },
    ] }]);
  return true;
}
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
      .filter((st) => !st.deep && !st.lair && !(st.story && !storySiteOpen(st.story)) && !have.has('clear:' + st.key) && !done.has('clear:' + st.key))
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
const JOURNAL_TABS = ['Story', 'Places', 'Towns', 'Treasures', 'Bestiary', 'World', 'Guide'];
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
  Wyrm: 'The last of the old dragons, or near enough. It sleeps on gold and wakes hungry.',
  Direwolf: 'A wolf the size of a horse, with a pack that follows it like a shadow.',
  Troll: 'Trolls regrow what you cut off. Hit them hard, hit them often, and do not stop to admire your work.',
  Thief: 'A goblin with ambition. It will take a tenth of your purse in one grab and run for the dark; cut it down before it is gone and the gold comes back.',
  Shaman: 'The clever one of a goblin pack. It keeps its distance, spits hexes, and mends every wound around it. Kill it first.',
  Bomber: 'A goblin with a clay pot of pitch and a short fuse. Whatever kills it, it goes off, and it goes off beside you by choice.',
  Basilisk: 'A lizard the length of a man with a gaze that stiffens the blood. Its bite can leave you standing stone-still for a turn while it takes another.',
  'Cave troll': 'The grey troll of the deep halls knits its flesh back together as you watch. Fire stops the knitting.',
  'Sea serpent': 'A neck as thick as a mast, seen from a long way off if you are watching the water. It takes ships for whales. Steer round it, or meet it with a blade and a full belly.',
  'Pirate sloop': 'Black sails on the horizon. The sloop will run you down if it can, and it carries a strongbox, and sometimes a chart to where the rest of the strongbox went.',
  Kraken: 'The deep water of the far seas has something in it that the sloops will not talk about. It is the colour of a bruise and the size of a church. Harpoon it only with a very good reason.',
  Mimic: 'Not every chest wants to be opened. Some want to open you. Mimics pay well, if you live.',
};
function journalKey(e) {
  if (['j', 'J', 'Escape'].includes(e.key)) journalOpen = false;
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') journalTab = (journalTab + 1) % JOURNAL_TABS.length;
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') journalTab = (journalTab + JOURNAL_TABS.length - 1) % JOURNAL_TABS.length;
  else if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) journalTab = Number(e.key) - 1;
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
  g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText('J or Esc closes · ← → or 1-7 change page', 120, 22);
  journalTabRects().forEach((r, i) => {
    g.fillStyle = i === journalTab ? '#0b3142' : 'rgba(11,49,66,0.4)'; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 6); g.fill();
    g.fillStyle = i === journalTab ? '#ffd86b' : '#cfe9ff'; g.font = `bold ${r.w < 90 ? 11 : 13}px sans-serif`; g.fillText(r.w < 90 ? JOURNAL_TABS[i] : `${i + 1} ${JOURNAL_TABS[i]}`, r.x + (r.w < 90 ? 6 : 12), r.y + 8);
  });
  const W = canvas.width - 48, X = 24; let y = 100;
  const st = story();
  if (journalTab === 0) {
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText('Story 1: The Shattered Crown', X, y); y += 26;
    const obj = storyObjective();
    g.fillStyle = '#9ef0b0'; g.font = '13px sans-serif'; y = wrapText(g, obj ? `Now: ${obj.text}.` : 'The crown is whole again. The realms are safe, for now.', X, y, W, 18) + 8;
    const steps = [['The summons', 'Answer King Aldric\'s call at Castle Aurum.', st.phase !== 'summons']], S0 = lairState();
    STORY_ORDER.forEach((id, i) => { const S = STORY_SITES[id]; const doneShard = i < st.ch || st.phase === 'done' || (i === st.ch && st.phase === 'return'); const known = i < st.ch || (i === st.ch && st.phase !== 'summons') || st.phase === 'done'; steps.push([known ? S.shard : '???', known ? `${S.title}, in ${REALMS[(() => { const st2 = siteAt(S.i, S.j); return realmOfTile(st2.x, st2.y); })()].short}.` : 'Not yet revealed.', doneShard]); });
    steps.push(['The crown restored', 'Bring all five shards to the King.', st.phase === 'done']);
    const clues = STORY_ORDER.filter((id, i) => i < st.ch || st.phase === 'done' || (i === st.ch && st.phase === 'return'));
    if (clues.length) steps.push(['Clues', clues.map((id) => SHARD_CLUE[id].who).join(', ') + (clues.length >= 2 ? '. They all point to Prince Edric.' : '.'), st.phase === 'done']);
    if (lairKnown('hilt')) steps.push(['The Sundered Blade', player.meta.forged ? 'Dawnbreaker is whole again, and yours.' : `${forgePieces().length} of 3 pieces won: ${FORGE_ORDER.map((id) => `${LAIRS[id].piece} (${LAIRS[id].title}${S0.slain.includes(id) ? ', won' : S0.known.includes(id) ? ', on your map' : ''})`).join('; ')}. A master smith reforges it.`, !!player.meta.forged]);
    { const S = lairState(), known = LAIR_IDS.filter((id) => S.known.includes(id));
      steps.push(['Lairs of the super bosses', known.length ? known.map((id) => `${LAIRS[id].title}${S.slain.includes(id) ? ' (slain)' : ''}`).join('; ') + '.' : 'Six lie hidden in the world. Bards, hermits and prophets know the way.', S.slain.length >= Object.keys(LAIRS).length]); }
    if (st.phase === 'done') {
      const A = act2();
      steps.push(['Act II: What Sleeps Below', A.s === 0 ? 'Prince Edric, in the King\'s hall, has a problem to solve.' : A.s >= 6 ? 'The Dreaming Maw is closed. You are the Deepwarden.' : A.s === 5 ? 'Return to Prince Edric.' : ACT2_STEPS[A.s - 1].label + '.', A.s >= 6]);
      steps.push(['The Deep', `The Gate of the Deep lies between Hearth and Castle Aurum. Your record: floor ${player.meta.deepest || 0}.`, (player.meta.deepest || 0) >= 25]);
    }
    if (story1Done()) {
      const S2 = story2();
      steps.push(['Story 2: The Far Shore', S2.s === 0 ? 'Story 1 is told. Stand in any town and the next story will find you.' : S2.s === 3 ? 'The Hollow King is dust. Three crowns beyond the Veil call you friend, and the sea road is open for good.' : S2.s === 2 ? 'The three keys are yours and the Barrow is open. Go down the thousand steps.' : 'The Veil was a prison wall. Earn the three keys from the three crowns beyond it.', S2.s === 3]);
      if (S2.s >= 1) for (const r of FAR_REALMS) { const Q = REALM_QUESTS[r], rq = rqState(r); steps.push([`${Q.title} (the ${itemInfo(Q.relic).name})`, rq.s === 5 ? `${Q.ruler} gave you the key.` : rq.s === 4 ? `Report to ${Q.ruler}.` : rq.s === 0 ? `${Q.ruler} waits in ${CAPITAL_NAMES[r]}.` : Q.steps[rq.s - 1].label + '.', rq.s === 5]); }
      if (S2.s >= 2) steps.push(['The Thousand-Step Barrow', S2.s === 3 ? 'The Hollow King is slain.' : 'At the heart of the Far Shore. Six floors, and the Hollow King at the bottom.', S2.s === 3]);
      if (story4Done()) { const S5 = story5(); steps.push(['Story 5: The Rebuilding', S5.s === 0 ? 'Story 4 is told. Stand in any town and the reckoning will find you.' : S5.s === 2 ? `You are a Founder: ${S5.n} structures stand with your name on them.` : `Talk to town leaders to sponsor walls, buildings, memorials and roads: ${S5.n || 0}/${FOUNDER_AT} sponsored. The heroes page ranks the builders.`, S5.s === 2]); }
      if (story3Done()) { const S4 = story4(); steps.push(['Story 4: The Long Night', S4.s === 0 ? 'Story 3 is told. Stand in any town and watch the sky.' : S4.s === 2 ? 'The Rift Lord is dust and every rift is shut.' : `Rifts to Midgard open outside the towns. Kill a horde to close its rift: ${S4.closed || 0}/${RIFTS_TO_CLOSE} closed${(S4.closed || 0) >= RIFTS_TO_CLOSE ? '. The Rift Lord is coming' : ''}.`, S4.s === 2]); }
      if (S2.s === 3) { const S3 = story3(); steps.push(['Story 3: The Frozen Gate', S3.s === 0 ? 'Story 2 is told. Stand in any town and a raven will find you.' : S3.s === 2 ? 'Thrym is dead and the gate is shut. The north is quiet.' : 'A door of ice on an island in the far north opens on Midgard. Take passage to Hrafnvik and go down through it to Thrym, Jarl of the Frost Giants.', S3.s === 2]); }
    }
    for (const [name, desc, done] of steps) {
      g.fillStyle = done ? '#9ef0b0' : '#e6eef8'; g.font = 'bold 14px sans-serif'; g.fillText(`${done ? '✓' : '•'} ${name}`, X, y);
      g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText(desc, X + 22, y + 18); y += 40;
    }
    y += 6; g.fillStyle = '#e6eef8'; g.font = 'bold 15px sans-serif'; g.fillText(farShoreOpen() ? 'The seven realms' : 'The four realms', X, y); y += 24;
    for (const id of (farShoreOpen() ? ALL_REALMS : REALM_ORDER)) {
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
    const seen = player.meta.visited.map((k) => townAt(...k.split(',').map(Number))).filter(Boolean).reverse();
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText(`Towns visited: ${seen.length}`, X, y); y += 26;
    for (const t of seen) {
      if (y > canvas.height - 60) break;
      const I = townIdentity(t), N = notableNpc(t);
      g.fillStyle = REALMS[I.realm].color; g.fillRect(X, y + 3, 8, 8);
      g.fillStyle = '#e6eef8'; g.font = 'bold 14px sans-serif'; g.fillText(`${t.name} · ${TIER_WORDS[townTier(t)]} ${I.kind} of ${REALMS[I.realm].short}`, X + 14, y);
      g.fillStyle = '#cfe9ff'; g.font = '12px sans-serif'; y = wrapText(g, townLore(t), X + 14, y + 18, W - 14, 16);
      g.fillStyle = '#a8c0d8'; y = wrapText(g, `${I.leader} leads it. ${N.name}, ${N.role}, has a story to tell in the square.`, X + 14, y + 2, W - 14, 16) + 10;
    }
    if (!seen.length) { g.fillStyle = '#a8c0d8'; g.font = '13px sans-serif'; g.fillText('Every town has a history in its name and a notable local in its square. Visit some.', X, y); }
  } else if (journalTab === 3) {
    const all = Object.keys(ITEMS.relics);
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText(`Treasures found: ${player.meta.found.length} of ${all.length}`, X, y); y += 28;
    for (const id of all) {
      const it = ITEMS.relics[id], got = player.meta.found.includes(id);
      g.fillStyle = got ? '#ffd86b' : '#4b5563'; g.font = 'bold 14px sans-serif'; g.fillText(`${got ? '◆' : '◇'} ${got ? it.name : '???'}${player.relic === id ? '  (worn)' : ''}`, X, y);
      g.fillStyle = got ? '#cfe9ff' : '#6b7280'; g.font = '12px sans-serif'; y = wrapText(g, got ? it.desc : `Said to be found in ${it.found}.`, X + 22, y + 18, W - 22, 16) + 8;
      if (y > canvas.height - 30) break;
    }
  } else if (journalTab === 6) {
    g.fillStyle = '#e6eef8'; g.font = 'bold 16px sans-serif'; g.fillText("Adventurer's Guide", X, y); y += 22;
    g.fillStyle = '#a8c0d8'; g.font = '12px sans-serif'; g.fillText('Ideas for what to do next, from where you stand.', X, y); y += 26;
    for (const [head, text] of guideSuggestions()) {
      if (y > canvas.height - 40) break;
      g.fillStyle = '#ffd86b'; g.font = 'bold 14px sans-serif'; g.fillText(`➤ ${head}`, X, y);
      g.fillStyle = '#cfe9ff'; g.font = '12px sans-serif'; y = wrapText(g, text, X + 18, y + 18, W - 18, 16) + 10;
    }
  } else if (journalTab === 5) {
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
  const rqs = ALL_REALMS.filter((id) => { const st = rqState(id); return st.s >= 1 && st.s <= 4; });
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
  pine: ['.......G........', '......GGG.......', '.....GgGGG......', '......GGG.......', '.....GGgGG......', '....GGGGGGG.....', '...GGGgGGGGG....', '.....GGGGG......', '....GGgGGGG.....', '...GGGGGGGGG....', '..GGGgGGGGGGG...', '.GGGGGGGGgGGGG..', '.......HH.......', '.......HH.......', '.......HH.......', '......HHHH......'],
  pinesnow: ['.......w........', '......wGw.......', '.....wwGGG......', '......GGG.......', '.....wwGGG......', '....wwwGGGG.....', '...GGGgGGGGG....', '.....wwGGG......', '....wwwGGGG.....', '...wwwGGGGGG....', '..GGGgGGGGGGG...', '.wwwwGGGGgGGGG..', '.......HH.......', '.......HH.......', '.......HH.......', '......HHHH......'],
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
BIG_SPRITES.cat = ['................', '................', '................', '....t..t........', '....tttt........', '....tktk........', '....tttt.......t', '.....tttttttt.t.', '....tttttttttt..', '....tttttttt....', '....tt.tt.tt....', '....tt.tt.tt....', '....HH.HH.HH....', '................', '................', '................'];
BIG_SPRITES.boar = ['................', '................', '................', '................', '........HH......', '.......HHHHH....', '...HHHHHHHHHHk..', '..HHHHHHHHHHHH..', '..HHhhhhHHHHHHw.', '..HHhhhhhHHHHH..', '..HHHHHHHHHHHH..', '..HH.HH..HH.HH..', '..HH.HH..HH.HH..', '..kk.kk..kk.kk..', '................', '................'];
BIG_SPRITES.hawk = ['................', '................', '................', '......hhh.......', '.....hkhhy......', '......hhh.......', '..hhhhhwwhhhhh..', '.hhhhhhwwhhhhhh.', 'hhhhhhhwwhhhhhhh', '..hhhhhwwhhhhh..', '.....hhwwhh.....', '......hhhh......', '......h..h......', '.....yy..yy.....', '................', '................'];
BIG_SPRITES.bear = ['................', '....HH....HH....', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...HHkHHHHkHH...', '...HHHHhhHHHH...', '....HHHhkhHHH...', '..HHHHHHHHHHHHH.', '.HHHHHHHHHHHHHHH', '.HHHHHHHHHHHHHHH', '.HHHHHHHHHHHHHHH', '.HHHHHHHHHHHHHHH', '.HHHH.HHHH.HHHH.', '.HHHH.HHHH.HHHH.', '.kkkk.kkkk.kkkk.', '................'];
BIG_SPRITES.elephant = ['................', '....EEEEEEE.....', '..EEEEEEEEEEE...', '.EEEEkEEEEEEEE..', '.EEEEEEEEEEEEEE.', '..EEEEEEEEEEEEE.', '...EEwEEEEEEEEE.', '...EE.EEEEEEEEE.', '...EE.EEEEEEEEE.', '...EE.EEEEEEEEE.', '....E.EEE..EEE..', '....E.EEE..EEE..', '....E.EEE..EEE..', '......eee..eee..', '................', '................'];
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
BIG_SPRITES.thief = BIG_SPRITES.goblin.map((r) => r.replace(/g/g, 'e').replace(/G/g, 'E'));      // a goblin in grey rags
BIG_SPRITES.shaman = BIG_SPRITES.goblin.map((r) => r.replace(/G/g, 'p').replace(/w/g, 'y'));      // in a purple robe, with a bone in its teeth
BIG_SPRITES.bomber = BIG_SPRITES.goblin.map((r, i) => (i === 0 ? '....g..oo..g....' : r.replace(/G/g, 'r')));   // red-jacketed, fuse lit
BIG_SPRITES.wolf = BIG_SPRITES.hound.map((r) => r.replace(/h/g, 'e').replace(/H/g, 'E'));      // a grey hound is a wolf
BIG_SPRITES.husky = BIG_SPRITES.hound.map((r) => r.replace(/h/g, 'w').replace(/H/g, 'e'));     // and a white one a husky
BIG_SPRITES.mongoose = BIG_SPRITES.cat.map((r) => r.replace(/t/g, 'h'));                      // a brown cat shape is a mongoose
BIG_SPRITES.horse = ['................', '................', '............HH..', '...........HhhH.', '..........Hhhkh.', '..........hhhhhh', '...hhhhhhhhhhh..', '..Hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '.H.hhhhhhhhhh...', '...hhhhhhhhhh...', '...hh.hh..hh.hh.', '...hh.hh..hh.hh.', '...hh.hh..hh.hh.', '...kk.kk..kk.kk.', '................'];
BIG_SPRITES.statue = ['......eeee......', '.....eEEEEe.....', '.....eEeeEe.....', '......eeee......', '.....eeeeee.....', '....eeEeeEee....', '...ee.eeee.ee...', '...e..eeee..e...', '......eeee......', '......ee.ee.....', '......ee.ee.....', '....EEEEEEEE....', '...EeeeeeeeeE...', '...EEEEEEEEEE...', '..EEEEEEEEEEEE..', '................'];
BIG_SPRITES.belltower = ['.......dd.......', '......dddd......', '.....dddddd.....', '....dddddddd....', '.....EeeeeE.....', '.....E.yy.E.....', '.....E.yy.E.....', '.....EeeeeE.....', '.....EEEEEE.....', '.....EeEEeE.....', '.....EEEEEE.....', '.....EeEEeE.....', '.....EEEEEE.....', '....EEEhhEEE....', '...EEEEhhEEEE...', '................'];
BIG_SPRITES.bonfire = ['................', '.......yy.......', '......yooy......', '.....yoryoy.....', '.....orrroo.....', '....yorryroy....', '....orrrrrro....', '....orryyrro....', '.....orrrro.....', '...hHhorroHhh...', '..hhHHhhhHHhh...', '...HhhHHHhhH....', '..EEe....eEE....', '..EeEE..EEeE....', '................', '................'];
BIG_SPRITES.darkknight = ['.....kkkkkk.....', '....kEEEEEEk....', '....kEkkkkEk....', '....kEkrrkEk....', '....kEEEEEEk....', '.....kEEEEk.....', '....kkkkkkkk....', '...kEEEyyEEEk.w.', '..kEEEEEEEEEEkw.', '..EkEEEEEEEEkEw.', '..E.kEEEEEEk.Ey.', '....kEEEEEEk..H.', '....kEEk.kEEk...', '....kEEk.kEEk...', '...kkkk...kkkk..', '................'];
BIG_SPRITES.letter = ['................', '................', '..tttttttttttt..', '..twwwwwwwwwwt..', '..twkkkkkkkwwt..', '..twwwwwwwwwwt..', '..twkkkkkkwwwt..', '..twwwwwwwwwwt..', '..twkkkkkkkkwt..', '..twwwwwwwwwwt..', '..twkkkkwwwwwt..', '..twwwwwwwwrrt..', '..twwwwwwwwrrt..', '..tttttttttttt..', '................', '................'];
BIG_SPRITES.plot = ['................', '................', '..h..........h..', '..H..........H..', '..hEEEEEEEEEEh..', '...E.e....e.E...', '...E........E...', '...E..e.....E...', '...E.....e..E...', '...E........E...', '...E.e....e.E...', '..hEEEEEEEEEEh..', '..H..........H..', '................', '................', '................'];
BIG_SPRITES.herofountain = ['.......cc.......', '......cwwc......', '.......cc.......', '......eEEe......', '.......ee.......', '.......ee.......', '..EEEEEEEEEEEE..', '.EeccccccccccEE.', '.EcwccccccwcccE.', '.EccccccccccccE.', '.EEEEEEEEEEEEEE.', '..EeeeeeeeeeeE..', '..EEEEEEEEEEEE..', '.EEEEEEEEEEEEEE.', '................', '................'];
BIG_SPRITES.valorshrine = ['.......yy.......', '......yrry......', '.......yy.......', '....EEEEEEEE....', '....EeeeeeeE....', '....Ee.rr.eE....', '....Ee.rr.eE....', '....Ee.yy.eE....', '....EeeeeeeE....', '...EEEEEEEEEE...', '..EEeeeeeeeeEE..', '..EEEEEEEEEEEE..', '.EEEEEEEEEEEEEE.', '................', '................', '................'];
BIG_SPRITES.cache = ['......rr........', '......rrrr......', '......rr........', '......H.........', '..hhhhHhhhhhhh..', '..hHHHHHHHHHHh..', '..hHyyHHHHyyHh..', '..hhhhhhhhhhhh..', '..hHHHHyyHHHHh..', '..hHHHHyyHHHHh..', '..hHHHHHHHHHHh..', '..hhhhhhhhhhhh..', '..H..........H..', '................', '................', '................'];
BIG_SPRITES.beacon = ['......yoy.......', '.....yoroy......', '......yoy.......', '.....EEEEE......', '.....EeeeE......', '.....EEEEE......', '......EeE.......', '......EEE.......', '......EeE.......', '......EEE.......', '.....EEeEE......', '.....EEEEE......', '....EEeEEEE.....', '...EEEEEEEEE....', '................', '................'];
BIG_SPRITES.warcamp = ['................', '.......d........', '......dd........', '......d.........', '.....rrr....rr..', '....rrrrr..rrrr.', '...rrkrrrr.rkrr.', '..rrrkkrrrrrkkrr', '..rrrkkrrrrrkkrr', '..HHHHHHHHHHHHHH', '....E..oo...E...', '...EEE.oy..EEE..', '....E..oo...E...', '.H..H......H..H.', '................', '................'];
BIG_SPRITES.razedcamp = ['................', '................', '................', '................', '.....EkE....k...', '....kEkkk..kEk..', '...kkkEkkk.kkkk.', '..kEkkkkEkkkkEkk', '..kkkkEkkkkEkkkk', '..HHkHHHkHHHkHHH', '................', '....E.......E...', '...EEE.....EEE..', '....E.......E...', '................', '................'];
BIG_SPRITES.soldier = ['.....eeeeee.....', '....eeeeeeee....', '....eessssee....', '....esssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....eeeeeeee....', '...eeeeeeeeee.e.', '..seeeeeeeeeese.', '..s.eeeeeeee.se.', '....eeeeeeee..e.', '....EEE..EEE..e.', '....EEE..EEE..e.', '...HHH....HHH...', '................'];
BIG_SPRITES.ship = ['.......w........', '.......ww.......', '.......www......', '.......wwww.....', '.......wwwww....', '.......wwwwww...', '.......wwwww....', '.......www......', '.......w........', '..HHHHHHHHHHHH..', '.HhhhhhhhhhhhhH.', '.HhhhhhhhhhhhhH.', '..HHHHHHHHHHHH..', '...hhhhhhhhhh...', '................', '................'];
BIG_SPRITES.wyrm = ['......kk........', '.....krrk.......', '....krrrrk......', '...krrkrrrk.....', '..krrrrrrrrk....', '..krryyrrrrk....', '...krrrrrrrrk...', '....krrrrrrrk...', '.....krrrrrrrrk.', '....krrrrrrrrrk.', '...krrrkkrrrrk..', '..krrrk..krrk...', '..krrk....kk....', '...kk...........', '................', '................'];
BIG_SPRITES.serpent = BIG_SPRITES.wyrm.map((r) => r.replace(/r/g, 'G').replace(/d/g, 'g').replace(/o/g, 'c'));   // green coils, pale belly
BIG_SPRITES.kraken = BIG_SPRITES.wyrm.map((r) => r.replace(/r/g, 'p').replace(/d/g, 'P').replace(/o/g, 'B'));    // purple, and hungrier
BIG_SPRITES.sloop = BIG_SPRITES.ship.map((r) => r.replace(/w/g, 'E').replace(/h/g, 'H'));   // black sails
BIG_SPRITES.direwolf = ['................', '................', '..kk........kk..', '..kkk......kkk..', '..kkkkkkkkkkkk..', '..kkrkkkkkkrkk..', '..kkkkkkkkkkkk..', '...kkkwwkkkkk...', '....kkkkkkkk....', '..kkkkkkkkkkkkk.', '.kkkkkkkkkkkkkkk', '.kkkkkkkkkkkkkk.', '..kk.kk..kk.kk..', '..kk.kk..kk.kk..', '................', '................'];
BIG_SPRITES.basilisk = ['................', '................', '..............GG', '.............GkG', '............GGGG', '....GGGGGGGGGGy.', '...GGgGGGGGGGG..', '..GGGGGGGgGGG...', '..GGgGGGGGGGG...', '...GG.GG.GG.....', '...GG.GG.GG.....', '...HH.HH.HH.....', '................', '................', '................', '................'];
BIG_SPRITES.troll = ['.....GGGGGG.....', '....GGGGGGGG....', '....GGkGGkGG....', '....GGGGGGGG....', '.....GGwwGG.....', '....GGGGGGGG....', '..GGGGGGGGGGGG..', '.GGGGGGGGGGGGGG.', '.GGhGGGGGGGGhGG.', '.GGhGGGGGGGGhGG.', '..GGGGGGGGGGGG..', '...GGGGGGGGGG...', '...GGGG..GGGG...', '...GGGG..GGGG...', '..HHHHH..HHHHH..', '................'];
BIG_SPRITES.cavetroll = BIG_SPRITES.troll.map((r) => r.replace(/G/g, 'E').replace(/g/g, 'e'));   // the grey, deep-dwelling kind
BIG_SPRITES.totem = ['......kkkk......', '.....krrrrk.....', '.....kryyrk.....', '.....krrrrk.....', '......kkkk......', '.....hhhhhh.....', '....hkkhhkkh....', '....hhhhhhhh....', '.....hyyyyh.....', '.....hhhhhh.....', '....hkkhhkkh....', '....hhhhhhhh....', '.....hhhhhh.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '................'];
BIG_SPRITES.captive = ['.....hhhhhh.....', '....hhhhhhhh....', '....hhsssshh....', '....hsssssss....', '....sskssks.....', '....ssssssss....', '.....ssssss.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '..EEHHHHHHHHEE..', '..E.HHHHHHHH.E..', '....HHHHHHHH....', '....HHH..HHH....', '..EEEEE..EEEEE..', '...HH......HH...', '................'];
const spriteCache = {};
// Creatures, items and props get a dark outline so they read on any ground;
// 16px sprites also get a light top rim and a darker bottom rim for volume.
const NO_OUTLINE = new Set(['stairs', 'trap', 'rug', 'counter', 'shelf', 'bed', 'table', 'rack', 'fire', 'flower']);
const EXTRA_OUTLINE = new Set(['chest', 'lamp', 'torch', 'barrel', 'plant', 'bones']);
const outlined = (name) => !NO_OUTLINE.has(name) && (!!BIG_SPRITES[name] || EXTRA_OUTLINE.has(name));
// The Far Shore's people: the same folk, dressed their own way. Clothes take the
// realm's colour and each realm wears its hat: a straw hat, a turban, a fur hat.
const FAR_DRESS = {
  tianxia:   { map: { r: 'B', G: 'r', P: 'B', b: 'r', d: 'r' }, hat: ['.......tt.......', '....tttttttt....', '.ttttttttttttttt'] },
  suryadesh: { map: { r: 'o', G: 'o', P: 'y', b: 'P', d: 'o' }, hat: ['.....wwwwww.....', '....wwwwwwww....', '....wwssssww....'] },
  severin:   { map: { r: 'd', G: 'B', P: 'd', b: 'G', d: 'B' }, hat: ['....HHHHHHHH....', '...HHHHHHHHHH...', '...HHHHHHHHHH...'] },
};
for (const realm of Object.keys(FAR_DRESS)) for (const base of ['villager', 'elder', 'merchant', 'child', 'innkeeper', 'king']) {
  const D = FAR_DRESS[realm], rows = BIG_SPRITES[base].map((r) => [...r].map((ch) => (ch !== 's' && ch !== 'k' && ch !== 'H' && D.map[ch]) ? D.map[ch] : ch).join(''));
  if (base !== 'king') D.hat.forEach((h, i) => { rows[i] = h; });   // crowns stay crowns
  BIG_SPRITES[`${base}:${realm}`] = rows;
}
const farSprite = (base, realm) => BIG_SPRITES[`${base}:${realm}`] ? `${base}:${realm}` : base;
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
// Townsfolk of the Far Shore, with their own things to say.
const FAR_FOLK = {
  tianxia: [
    { sprite: 'villager:tianxia', name: 'Old Farmer Zhou', lines: ['The paddies flood in spring and the magistrate floods us with forms in autumn. Both grow rice, in the end.', 'The dead walked past my field last week. In step. They did not trample a single shoot. Very proper, the dead.', 'Lanterns at the festival, one for every ancestor. We are going to need a great many more lanterns.'] },
    { sprite: 'child:tianxia', name: 'Little Mei', lines: ['Grandfather says the Hollow King ate the wind. How do you eat wind? Do you chew?', 'I am going to sit the examination when I am big. Then I can tell everybody what to do.', 'The dragon under the hill is asleep. Everyone says. I put my ear on the ground and I heard it.'] },
    { sprite: 'merchant:tianxia', name: 'Tea-seller Lin', lines: ['Jasmine, oolong, or the brick tea the caravans drink. The brick tea tastes of caravan.', 'A seal on a paper is worth more than gold here. Gold you can lose. A seal, they hang you for.', 'The Empress reads every petition. Ten thousand clerks make sure she reads the right ones.'] },
    { sprite: 'elder:tianxia', name: 'Scholar Fang', lines: ['The classics say the Hollow King was a man once, before he gave up breathing as beneath him.', 'Three generals, three locks: the Seal, the Lotus, the Claw. The classics are quite clear. The classics are also a thousand years old.', 'Heaven\'s mandate passes to whoever keeps order. Keep some, and who knows what Heaven will say.'] },
  ],
  suryadesh: [
    { sprite: 'villager:suryadesh', name: 'Gopal the Mahout', lines: ['My elephant has walked the nine gates more times than any priest. She knows where the sweets are sold.', 'The spiders came up the pilgrim road in a line. Elephants do not like spiders. Nobody likes spiders.', 'Monsoon in six weeks. Then the roads are rivers and the rivers are roads.'] },
    { sprite: 'child:suryadesh', name: 'Little Anjali', lines: ['The stepwell has a hundred and eight steps. I counted. Twice. It is a hundred and seven the second time.', 'The Maharani rode past on an elephant with a gold hat. The elephant had the hat. Not the Maharani.', 'There is a thing in the old temple that says it is a god. Pandit says real gods do not have to say so.'] },
    { sprite: 'merchant:suryadesh', name: 'Spice-wife Rukmini', lines: ['Pepper, cardamom, saffron by the thread. The saffron is the price of a horse and worth it.', 'The Lotus of the Sun is kept in the ninth gate. The ninth gate is kept by the Maharani\'s aunt. Nobody gets past the aunt.', 'Pilgrims pay nothing on the roads. Everyone else pays me.'] },
    { sprite: 'elder:suryadesh', name: 'Pandit Harish', lines: ['The lotus closes at night and opens with the sun. So does the kingdom, more or less.', 'The Hollow King was broken here by a woman with a flower. The flower was a lie. The woman was not.', 'Make an offering at the shrines on the road. Not for the gods. For you. It makes you slower, and slower sees more.'] },
  ],
  severin: [
    { sprite: 'villager:severin', name: 'Trapper Yegor', lines: ['Sable, ermine, wolf. Bear, if you ask nicely and bring a bigger bear.', 'The dead came out of the taiga last month in a column. I have never seen orcs run before. I have now.', 'Winter is six weeks off. In Severin, winter is always six weeks off, until it is here.'] },
    { sprite: 'child:severin', name: 'Little Sasha', lines: ['Babushka says Grandfather Frost gives presents to good children and the Hollow King takes the breath of bad ones. I have been very good.', 'The Tsar has a bear that sleeps by the stove. I have a cat. The cat is braver.', 'There is a song about the barrow under the frozen river. It is a lullaby. It does not work.'] },
    { sprite: 'merchant:severin', name: 'Fur-seller Katya', lines: ['A coat for the winter, a hat for the wind, boots for the river. Buy all three or buy a coffin.', 'The Bear Charm is in the Tsar\'s terem, around the neck of the actual bear. Nobody has asked the bear.', 'Streltsy drink before they fight and after. During, they are surprisingly accurate.'] },
    { sprite: 'elder:severin', name: 'Deacon Ilya', lines: ['The third general was a boyar with a bear\'s claw on a cord. He put the last lock on the Barrow and went home to die of the cold, which is how we do things.', 'The dead do not feel the winter. It is the only advantage they have, and they are welcome to it.', 'Pray at the painted church if you like. The icons have seen the Hollow King before. They are not impressed by him either.'] },
  ],
};
const FAR_HARBOUR_NAMES = { tianxia: ['Harbourmaster Guo', 'Captain Shen Hai', 'Old Boatman Wu', 'Mistress Lu of the Junks'], suryadesh: ['Harbourmaster Nair', 'Captain Deva Varma', 'Old Kochu', 'Mother Meenakshi of the Dhows'], severin: ['Harbourmaster Volkov', 'Captain Zima', 'Old Lev the Ferryman', 'Mother Praskovya of the Koches'] };
const INDOOR_NPCS = {
  speaker: { sprite: 'elder', name: 'Speaker Maren', action: 'council', lines: ['The Cantons answer to their people, and the people answer to their purses. Help us build.'] },
  councillor: { sprite: 'villager', name: 'The town councillor', action: 'council', lines: ['Every coin for the public works is written in the ledger, with your name beside it.'] },
  herald: { sprite: 'guard', name: 'The royal herald', action: 'court', lines: ['By the King\'s leave, titles of the realm may be granted to those who serve it. And pay for it.'] },
  chieftain: { sprite: 'guard', name: 'Chieftain Ulrek Stonehand', action: 'chieftain', lines: ['Kings buy loyalty. Merchants rent it. Among the clans, it is sworn over bread and salt at the fire.'] },
  shaman: { sprite: 'elder', name: 'The clan shaman', action: 'shaman', lines: ['The spirits listen to those who bring gifts. Gold will do. They are not proud.'] },
  banker: { sprite: 'merchant', name: 'Banker Vessa Orlov', action: 'bank', lines: ['Gold in a pocket is lost to the first goblin. Gold in my vault outlives you.'] },
  empress: { sprite: 'king:tianxia', name: 'Empress Liang Wu', action: 'yamen', lines: ['Heaven grants its mandate to those who keep order. The examination halls are open to anyone who can hold a brush, or a sword.'] },
  magistrate: { sprite: 'elder:tianxia', name: 'The district magistrate', action: 'yamen', lines: ['Every petition is read, every tax is counted, every bandit is eventually hanged. The Empire is patient.'] },
  maharani: { sprite: 'elder:suryadesh', name: 'Maharani Devika Suryavansha', action: 'durbar', lines: ['The sun rises on nine gates and sets on nine gates. Between them, the Rajadom keeps its promises.'] },
  dewan: { sprite: 'merchant:suryadesh', name: 'The dewan', action: 'durbar', lines: ['The Maharani\'s treasury is in my keeping, and her roads. Pilgrims pay nothing. Everyone else pays something.'] },
  tsar: { sprite: 'king:severin', name: 'Tsar Fyodor the Patient', action: 'terem', lines: ['My grandfather said: the winter is long, the Tsar is far, and God is high. I am trying to be a little nearer than that.'] },
  voivode: { sprite: 'guard', name: 'The voivode', action: 'terem', lines: ['I hold this town for the Tsar, against wolves, raiders and the boyars, in roughly that order of difficulty.'] },
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
  edric: { sprite: 'darkknight', name: 'Prince Edric', lines: ['"My brother keeps me close now, where he can see me."'] },
  halvard: { sprite: 'darkknight', name: 'Ser Halvard', lines: [
    '"We have met. On the Ember road, and on the third floor of a tower, where you knocked me flat. No hard feelings. You fight well, for someone who does not fight for money."',
    '"I served the prince for ten years in exile, and I serve him still. The King keeps me on because a man who will follow the wrong brother that far will follow the right one anywhere."',
    '"The grey cloaks are disbanded. Most of them took the pardon. One or two did not, and are on the roads yet. If you meet them, tell them Halvard said to come home."'] },
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
// the seats of the Far Shore: the Empress's yamen, the Maharani's durbar hall, the Tsar's terem
BUILDINGS.yamen = { ...BUILDINGS.council, name: 'The Yamen', sign: 'YAMEN', roof: '#b91c1c', npcs: { G: 'empress' } };
BUILDINGS.magistracy = { ...BUILDINGS.council, name: "The Magistrate's Yamen", sign: 'YAMEN', roof: '#b91c1c', npcs: { G: 'magistrate' } };
BUILDINGS.durbar = { ...BUILDINGS.council, name: 'The Durbar Hall', sign: 'DURBAR', roof: '#d97706', npcs: { G: 'maharani' } };
BUILDINGS.kacheri = { ...BUILDINGS.council, name: 'The Kacheri', sign: 'KACHERI', roof: '#d97706', npcs: { G: 'dewan' } };
BUILDINGS.terem = { ...BUILDINGS.council, name: 'The Terem Palace', sign: 'TEREM', roof: '#1d4ed8', npcs: { G: 'tsar' } };
BUILDINGS.prikaz = { ...BUILDINGS.council, name: 'The Prikaz', sign: 'PRIKAZ', roof: '#1d4ed8', npcs: { G: 'voivode' } };
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
  cave:   { label: 'Goblin Cave', sprite: 'cave',   floors: [2, 3], pool: byName('Rat', 'Goblin', 'Bat', 'Spider', 'Orc', 'Slime', 'Thief', 'Bomber'), gold: 1.6, potions: 1, view: 7, loot: 0.12, treasure: 60, prefixes: ['Mossy', 'Dripping', 'Echoing', 'Low', 'Black'] },
  warren: { label: 'Orc Warren',  sprite: 'warren', floors: [2, 2], pool: byName('Goblin', 'Archer', 'Orc', 'Shaman', 'Bomber'),         gold: 1.2, potions: 1, view: 8, loot: 0.3,  treasure: 80, prefixes: ['Bloody', 'Broken-Tusk', 'Red', 'Grim', 'Ironhide'] },
  crypt:  { label: 'Crypt',       sprite: 'crypt',  floors: [3, 3], pool: byName('Skeleton', 'Spider', 'Wraith', 'Necromancer', 'Basilisk'),    gold: 1,   potions: 1, view: 6, loot: 0.15, treasure: 120, prefixes: ['Forgotten', 'Silent', 'Weeping', 'Sunken', 'Nameless'], xp: 1.5 },
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
  if (site.lair) { const L = LAIRS[site.lair]; Object.assign(def, { lair: site.lair, theme: L.theme, boss: L.boss, pool: byName(...L.pool), treasure: 200 + 40 * L.danger, xp: 2, loot: 0.3, gold: 1.5 }); }
  if (site.story) { const S = STORY_SITES[site.story]; Object.assign(def, { story: site.story, theme: S.theme, boss: S.boss, treasure: 150 + 60 * S.danger, xp: 1.5, ...(S.pool ? { pool: byName(...S.pool) } : {}) }); }
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
  aurum: { name: 'Kingdom of Aurum', short: 'the Kingdom', gov: 'Monarchy', ruler: 'King Aldric', capital: [3, -1], color: '#f5c542',
    blurb: 'Ruled by King Aldric from Castle Aurum. Castles on the hills, knights on the roads, and the King\'s law over all.' },
  kathar: { name: "Ka'thar Clans", short: 'the Clans', gov: 'Tribal', ruler: 'Chieftain Ulrek Stonehand', capital: [-3, 2], color: '#e0763a',
    blurb: 'Clans of the southern wilds, led by a chieftain chosen in battle and guided by shamans who speak with the spirits.' },
  league: { name: 'Goldspire League', short: 'the League', gov: 'Oligarchy', ruler: 'the Merchant Council', capital: [-2, -3], color: '#b18cff',
    blurb: 'City-states run by their richest merchant houses. Banks, guilds, fine goods, and prices to match.' },
  // the Far Shore: a continent beyond the Veil of storms, reached only in Story 2
  tianxia:   { name: 'Celestial Empire of Tianxia', short: 'the Empire', gov: 'Empire', ruler: 'Empress Liang Wu', capital: [11, -2], color: '#ff5c5c', far: true,
    blurb: 'Ruled from the Jade Throne by an empress and ten thousand scholar-officials. Walled cities, rice terraces, paper lanterns, and an examination for everything.' },
  suryadesh: { name: 'Rajadom of Suryadesh', short: 'the Rajadom', gov: 'Rajadom', ruler: 'Maharani Devika Suryavansha', capital: [11, 2], color: '#ffa726', far: true,
    blurb: 'River kingdoms under a sun-crowned queen: stepwells, spice bazaars, temple towers and elephants on the roads.' },
  severin:   { name: 'Tsardom of Severin', short: 'the Tsardom', gov: 'Tsardom', ruler: 'Tsar Fyodor the Patient', capital: [16, 0], color: '#7dd3fc', far: true,
    blurb: 'A cold northern crown of log towns, painted churches, boyars and bears, where winter is the oldest law.' },
};
const REALM_ORDER = ['cantons', 'aurum', 'kathar', 'league'];           // the four realms of Story 1
const FAR_REALMS = ['tianxia', 'suryadesh', 'severin'];                 // the Far Shore, Story 2
const ALL_REALMS = [...REALM_ORDER, ...FAR_REALMS];
function realmAt(i, j) {
  if (i === THULE.i && j === THULE.j) return 'severin';   // Hrafnvik keeps the Tsar's ways, whoever is nearest
  let best = 'cantons', bd = Infinity;
  for (const id of ALL_REALMS) { const [ci, cj] = REALMS[id].capital; const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = id; } }
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
  // Story 2: the prison at the heart of the Far Shore, opened by the three realms' keys
  hollow: { i: 13, j: 0,  type: 'crypt', theme: 'bone',    danger: 14, floors: 6, title: 'The Thousand-Step Barrow', far: true, relic: 'hollowcrown', boss: { type: 'Necromancer', name: 'the Hollow King', hpMult: 5 } },
  // Story 3: a portal in a hillside on the ice, and Midgard beyond it
  gate:   { i: 0, j: -10, type: 'crypt', theme: 'frost',   danger: 16, floors: 8, title: 'The Frozen Gate', far: true, fixed: [0, -32], pool: ['Skeleton', 'Direwolf', 'Troll', 'Wraith'], relic: 'frostheart', boss: { type: 'Troll', name: 'Thrym, Jarl of the Frost Giants', hpMult: 6 } },
  stars:  { i: -2, j: -4, type: 'tower', theme: 'arcane',  danger: 5, floors: 4, title: 'The Star Tower',     shard: 'Shard of Stars',  relic: 'starring',   boss: { type: 'Knight', name: 'Prince Edric, the Crownbreaker', yields: true } },
};
const STORY_ORDER = ['dawn', 'tides', 'bones', 'embers', 'stars'];
const STORY_AT = Object.fromEntries(Object.entries(STORY_SITES).map(([id, S]) => [`${S.i},${S.j}`, id]));
const story = () => player.meta.story || (player.meta.story = { ch: 0, phase: 'summons' });
function storySiteOpen(id) {
  if (id === 'hollow') return story2().s >= 2;   // the three keys unseal the Barrow
  if (id === 'gate') return story3().s >= 1;      // the raven's message opens the Frozen Gate
  const st = story(), idx = STORY_ORDER.indexOf(id);
  return st.phase === 'done' || idx < st.ch || (idx === st.ch && st.phase !== 'summons');
}
function storyObjective() {
  if (!player || !player.meta) return null;
  const st = story();
  const castle = townAt(...REALMS.aurum.capital);
  if (st.phase === 'summons') return { text: 'Travel to Castle Aurum and speak with King Aldric', short: 'Castle Aurum', x: castle.cx, y: castle.cy };
  if (st.phase === 'return') return { text: `Bring the ${STORY_SITES[STORY_ORDER[st.ch]].shard} to King Aldric`, short: 'Castle Aurum', x: castle.cx, y: castle.cy };
  if (st.phase === 'done' && act2().s >= 1 && act2().s <= 5) {
    const A = act2();
    if (A.s === 5 || (A.s >= 2 && !A.told)) return { text: A.s === 5 ? 'Return to Prince Edric at Castle Aurum' : 'Tell Prince Edric what you found', short: 'Castle Aurum', x: castle.cx, y: castle.cy };
    const gate = siteAt(...DEEP_CELL);
    return { text: ACT2_STEPS[A.s - 1].label, short: 'The Gate of the Deep', x: gate.x, y: gate.y };
  }
  if (st.phase === 'seek') { const S = STORY_SITES[STORY_ORDER[st.ch]], site = siteAt(S.i, S.j); return { text: `Find the ${S.shard} in ${S.title.replace(/^The /, 'the ')}`, short: S.title, x: site.x, y: site.y }; }
  if (story5().s === 1) { const here = townContaining(player.x, player.y) || nearestTownTo(player.x, player.y); return { text: `Sponsor the rebuilding: talk to a town leader (${story5().n || 0}/${FOUNDER_AT} structures)`, short: here ? here.name : 'A town', x: here ? here.cx : player.x, y: here ? here.cy : player.y }; }
  if (story4().s === 1) {
    const r = rifts[0], closed = story4().closed || 0;
    if (r) { const tn = townAt(...r.town.split(',').map(Number)); return { text: r.lord ? `Slay the Rift Lord at ${tn ? tn.name : 'the rift'}` : `Close the rift at ${tn ? tn.name : 'the town'}: kill its horde (${closed}/${RIFTS_TO_CLOSE} closed)`, short: 'The rift', x: r.x, y: r.y }; }
    return { text: closed >= RIFTS_TO_CLOSE ? 'Stay near a town: the Rift Lord is coming' : `Watch for rifts near the towns (${closed}/${RIFTS_TO_CLOSE} closed)`, short: 'The Long Night', x: player.x, y: player.y };
  }
  if (story3().s === 1) {
    const S = STORY_SITES.gate, site = siteAt(S.i, S.j);
    if (player.y >= ICE_Y) { const hp = homePort(); return { text: `Take passage north to Hrafnvik from a harbour${hp ? ` (${hp.name} is nearest Hearth)` : ''}`, short: 'The north', x: hp ? hp.cx : player.x, y: hp ? hp.cy : player.y - 100 }; }
    return { text: 'Go through the Frozen Gate and face Thrym, Jarl of the Frost Giants', short: S.title, x: site.x, y: site.y };
  }
  // between the stories: never leave the hero without a star to follow
  if (st.phase === 'done' && act2().s === 0) { const ed = castle; return { text: 'Speak with Prince Edric at Castle Aurum: Act II, What Sleeps Below', short: 'Castle Aurum', x: ed.cx, y: ed.cy }; }
  if (story1Done() && story2().s === 0) { const hp = homePort(); return { text: 'Story 1 is told. Walk into any town and the news of Story 2 will find you', short: hp ? hp.name : 'A town', x: hp ? hp.cx : castle.cx, y: hp ? hp.cy : castle.cy }; }
  if (story2().s === 1 && FAR_REALMS.every((r) => rqState(r).s === 5)) { setTimeout(() => { if (story2().s === 1 && !storyOpen()) unsealBarrow(); }, 0); }
  if (story2().s === 2) { const S = STORY_SITES.hollow, site = siteAt(S.i, S.j); return { text: 'Go down the Thousand-Step Barrow and face the Hollow King', short: S.title, x: site.x, y: site.y }; }
  if (story2().s === 1) {
    const next = FAR_REALMS.find((r) => rqState(r).s < 5);
    if (next) {
      const Q = REALM_QUESTS[next], rq = rqState(next), cap = townAt(...REALMS[next].capital);
      if (player.x <= VEIL_X) { const hp = homePort(); return { text: `Take passage across the Veil from a harbour${hp ? ` (${hp.name} is nearest Hearth)` : ''}`, short: 'The Veil', x: hp ? hp.cx : player.x + 100, y: hp ? hp.cy : player.y }; }
      return { text: rq.s === 0 ? `Seek ${Q.ruler} in ${cap.name} for a key to the Barrow` : rq.s === 4 ? `Report to ${Q.ruler} in ${cap.name}` : `${Q.title}: ${Q.steps[rq.s - 1].label}`, short: cap.name, x: cap.cx, y: cap.cy };
    }
  }
  return null;
}
// The opening: the history of the world, told once to every new hero before the
// herald arrives, and kept in the Journal's World page.
const WORLD_INTRO = [
  { who: 'The Age of the Crown', sprite: 'king', title: 'The Age of the Crown',
    text: 'A thousand years ago there was one kingdom and one crown. Aurel the Founder pulled five lights out of the dark, Dawn, Tides, Bones, Embers and Stars, and forged them into the Crown of Aurum. While the crown stayed whole, the land was quiet.' },
  { who: 'The Deep', sprite: 'wraith', title: 'The Deep',
    text: 'The lights were not taken from nothing. Beneath the world lies the Deep, old and patient and dreaming. Its dreams leak upward as caves, crypts and endless halls. Every town was built with a gate over one, so the watch could keep an eye on the dark.' },
  { who: 'The Sundering', art: 'realms', bg: 'map', title: 'The Sundering',
    text: 'Three hundred years ago the War of Four Banners broke the old kingdom apart. The crown stayed at Castle Aurum with the last royal line. The rest of the land went its own way, and four realms rose from the wreck.' },
  { who: 'The four realms', art: 'realms', bg: 'map', title: 'The four realms',
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
  for (const id of REALM_ORDER) {   // the four realms of the old world; the Far Shore is off this little map
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

// The Adventurer's Guide: a handful of sensible next steps for where the hero is now.
function guideSuggestions() {
  const out = [], rs = realmState(), st = story();
  const obj = storyObjective();
  if (obj) {
    const S = st.phase === 'seek' ? STORY_SITES[STORY_ORDER[st.ch]] : null;
    const need = S ? recLevel(siteDungeon(siteAt(S.i, S.j))) : 0;
    out.push(['Main story', `${obj.text}. Follow the gold star on your compass.`]);
    if (S && player.level < need - 1) out.push(['Get stronger first', `${S.title} is meant for level ${need}, and you are level ${player.level}. Town dungeons (Hearth's is level 1+) and bounties are good practice.`]);
  } else if (st.phase === 'done' && act2().s === 0) out.push(['Act II', 'Prince Edric waits in the King\'s hall at Castle Aurum with a problem only you can solve.']);
  else if (story1Done() && story2().s === 0) out.push(['Story 2', 'Story 1 is told. Stand in any town and the next one will find you.']);
  else if (story2Done() && story3().s === 0) out.push(['Story 3', 'Story 2 is told. Stand in any town and a raven will find you.']);
  else if (story3Done() && story4().s === 0) out.push(['Story 4', 'Story 3 is told. Stand in any town, and watch the sky.']);
  else if (story4Done() && story5().s === 0) out.push(['Story 5', 'Story 4 is told. Stand in any town and the reckoning will find you.']);
  else if (story5().s === 2) out.push(['Founder', `You are a Founder of the realms (${story5().n} structures). The leaders still keep their lists.`]);
  else if (story4().s === 2) out.push(['The Long Night', 'The Rift Lord is dust and every rift is shut. Four stories told.']);
  else if (story3().s === 2) out.push(['The Frozen Gate', 'Thrym is dead and the gate is shut. The north is quiet, and the raven is yours.']);
  else if (story2().s === 3) out.push(['The Far Shore', 'The Hollow King is dust and both shores are at peace. The sea road across the Veil is yours.']);
  else if (st.phase === 'done') out.push(['The Deep', `The Gate of the Deep lies between Hearth and Castle Aurum. Your record: floor ${player.meta.deepest || 0}.`]);
  if (player.hp < player.maxHp * 0.5) out.push(['Rest', 'Inns heal you for free. In the wilds, press C to make camp.']);
  if (player.pendingPerks) out.push(['Choose a perk', 'You have a perk to pick.']);
  { const next = abilityList().find((a, k) => k > 0 && player.level < a.level); if (next) out.push(['Next ability', `${next.name} comes at level ${next.level}: ${next.blurb}.`]); }
  const realm = currentRealm(), rq = rqState(realm), Q = REALM_QUESTS[realm];
  if (rq.s === 0) out.push(['Realm errand', `${Q.ruler} has work for heroes of ${REALMS[realm].short}.`]);
  else if (rq.s === 4) out.push(['Report back', `${Q.title} is done. Return to ${Q.ruler} for your reward.`]);
  if (!questsActive().length) out.push(['Find work', 'Watch captains post bounties on named beasts, and townsfolk want monsters cleared.']);
  if (!pets.length) out.push(['A companion', `Inns sell pets, and each realm keeps its own: hounds and cats in the Cantons, wolves, boars and bears among the Clans, hawks, huskies, elephants further afield. A hound is ${HOUND_COST} gold. You can keep ${PET_MAX}.`]);
  if (player.bag.length >= bagSize() - 2 && !player.meta.room) out.push(['Your bag is nearly full', `Rent a room at an inn (${ROOM_COST} gold) for a storage chest at every inn.`]);
  if (!delveDone() && player.level >= 3) out.push(['Today\'s Delve', `Lie down at any inn for the Delve of ${delveTheme().name}: the same dungeon for every hero today, one try, scored on the heroes page.`]);
  if (player.meta.ship && !charts().length && player.gold >= CHART_COST) out.push(['Buried treasure', `Harbourmasters sell charts (${CHART_COST} gold) to sea-chests on islands. Sail there and dig.`]);
  if (!player.meta.ship && farShoreOpen() && player.gold >= SHIP_COST * 0.75) out.push(['Set sail', `Harbourmasters sell ships (${SHIP_COST} gold): sail the open sea to islands and shores no road reaches.`]);
  if (!player.meta.horse && player.gold >= HORSE_COST * 0.75) out.push(['Ride', `Inns in cities and castles sell horses (${HORSE_COST} gold): two tiles a step in the wilds.`]);
  if (player.weapon && (player.weaponPlus || 0) < 3 && player.gold >= UPGRADE_COST(player.weaponPlus || 0)) out.push(['Sharpen your blade', `A smithy can make your ${itemInfo(player.weapon).name} +${(player.weaponPlus || 0) + 1}.`]);
  if (player.meta.places.length < 5) out.push(['Explore', 'Standing stones, shrines, ruins, hermits and wells lie in the wilds. Walk near them to discover them.']);
  if (!player.meta.rod) out.push(['Go fishing', 'Shops in fishing towns sell rods. Walk into water to cast a line.']);
  if (player.level >= 12 && !lairKnown('hilt')) out.push(['A blade to reforge', 'The master smiths of the smithing towns tell of a sword broken into three. Buy one a drink, or an axe.']);
  else if (lairKnown('hilt') && !player.meta.forged) { const next = FORGE_ORDER.find((id) => !lairState().slain.includes(id)); out.push(['The Sundered Blade', next ? `${forgePieces().length} of 3 pieces won. ${LAIRS[next].piece[0].toUpperCase() + LAIRS[next].piece.slice(1)} lies in ${LAIRS[next].title}${lairKnown(next) ? ', marked on your map' : ''}.` : 'All three pieces are won. Any master smith can reforge Dawnbreaker.']); }
  if (player.level >= 15 && LAIR_IDS.some((id) => !lairState().slain.includes(id))) out.push(['A legend to hunt', lairState().known.length ? `${LAIRS[lairState().known.find((id) => !lairState().slain.includes(id)) || lairState().known[0]].title[0].toUpperCase()}${LAIRS[lairState().known.find((id) => !lairState().slain.includes(id)) || lairState().known[0]].title.slice(1)} is on your map. Its master drops gear found nowhere else.` : 'Six super bosses lair in the far corners of the world. Buy a bard a drink, or a hermit a map.']);
  if (player.level >= 5 && !player.meta.arena) out.push(['Test your mettle', 'The Grand Arena at Castle Aurum pays gold for every wave you survive.']);
  if (ACCOUNT.user && player.gold >= BUILD.costs[0]) out.push(['Help other heroes', `Pay an innkeeper ${BUILD.costs[0]} gold to build a monument in the square that every hero can use.`]);
  if (armiesUnlocked() && player.gold >= 150 && !war().armies.some((a) => a.mine)) out.push(['Raise an army', 'Orc warcamps threaten every realm. Recruit soldiers at a realm\'s seat (the King, a council or town hall, the clan longhouse or a League bank) and send them to raze a camp.']);
  if (rs.rank === 0 && player.gold >= 300) out.push(['A title', 'The King or his heralds will make you a Squire of Aurum for 300 gold.']);
  if (!player.relic && player.meta.found.length) out.push(['Wear your treasure', 'You have a treasure in your bag. Wear it from the inventory.']);
  return out.slice(0, 9);
}
// After each shard is handed in, a rider finds the hero on the road with news of
// the realms, a hint, and a small gift from someone who is grateful.
const CHAPTER_RIDERS = [
  { who: 'A rider of the Cantons', sprite: 'villager', bg: 'road', gift: () => { player.gold += 40; return '40 gold'; },
    text: 'A rider in Cantons green catches you up on the road. "Speaker Maren sends this, with the council\'s thanks: forty gold, voted unanimously, which has never happened before." She leans closer. "And a warning. Grey riders with silver stags were seen on the south road. Nobody knows whose they are."' },
  { who: "A runner of the Ka'thar", sprite: 'farmer', bg: 'road', gift: () => { player.bag.push('potion'); if (!bagFull()) player.bag.push('potion'); return 'two potions'; },
    text: 'A clan runner falls into step beside you, barely breathing hard. "Ulrek says: the grotto is quiet, the fishers are back on the water, and the clans will not hinder you. Here." Two potions, wrapped in oilcloth. "He also says the stag riders have been asking after you. He told them you were in the Deep. He thought it was funny."' },
  { who: 'A courier of the League', sprite: 'merchant', bg: 'road', gift: () => { if (!bagFull()) player.bag.push('bomb'); return 'a bomb'; },
    text: 'A courier in League purple reins in and hands you a sealed note without a word. It is from Vessa Orlov. "The prince has been buying orc loyalty with royal silver. Follow the silver west; it ends in a pit of embers. Enclosed, something that goes bang. Invoice to follow." The courier is already gone.' },
  { who: "The King's own rider", sprite: 'guard', bg: 'road', gift: () => { if (!bagFull()) player.bag.push('elixir'); return 'an elixir'; },
    text: 'A rider in gold and crimson, lathered to the knees. "From the King\'s hand." An elixir, and a note in Aldric\'s cramped script: "Edric is at the Star Tower. He knows you are coming; he has always known when I was coming. My brother never did know when to run. Bring him back. A."' },
];
function chapterRider() {
  const st = story();
  if (st.phase !== 'seek' || st.ch < 1 || (st.riders || 0) >= st.ch) return false;
  const R = CHAPTER_RIDERS[st.ch - 1]; if (!R) return false;
  st.riders = st.ch;
  stopWalk?.(); sfx.play('quest');
  showScene([{ who: R.who, sprite: R.sprite, bg: R.bg, text: R.text }], () => { const got = R.gift(); log(`${R.who} leaves you ${got}.`, 'good'); updateStats(); saveProgress('progress'); });
  return true;
}
// What the townsfolk are saying, as the story moves on.
function storyRumour() {
  const st = story(), A = player.meta.act2 || { s: 0 };
  const pools = {
    summons: ['They say a herald rode through every town in the Cantons this week. Something about the crown.', 'Five lights in the sky, the night the crown broke. My cousin saw them. My cousin also sees things in his ale.', 'The gate has been noisier at night. The watch says it is nothing. The watch says that about everything.'],
    early: ['A hero went into the old chapel, they say, and came out again. Nobody comes out of that chapel.', 'Grey riders on the south road. Silver stags on their cloaks. Nobody knows whose.', 'The King has broken the seals on the old places. My grandmother would have had words about that.'],
    late: ["It's the prince. Everyone says so now. The one they exiled. He's behind the crown.", 'Riders in grey ambushed a caravan near the Ember road. They were looking for someone.', 'They say the last shard sits on top of a tower you can see from the Goldspire hills. Rather you than me.'],
    done: ['Bells rang in every realm the day the crown was mended. Even the League rang theirs, and they charge for bells.', 'The prince is pardoned, they say. Sitting in his brother\'s hall like nothing happened. Kings.', 'The beasts on the roads are thinner since the crown was whole. Not gone. Thinner.', 'There is bunting in the square and the council voted for a holiday. Two holidays. They are still arguing about the second.'],
    deep: ['Something went quiet under the hills. You can feel it in the well water, the old folk say.', 'The Deepwarden came through here once. Bought a potion and said thank you. A hero, and polite.'],
  };
  const key = A.s >= 6 ? 'deep' : st.phase === 'done' ? 'done' : st.phase === 'summons' ? 'summons' : st.ch >= 3 ? 'late' : 'early';
  const pool = pools[key];
  return pool[rnd(pool.length)];
}
// ---------- Act II: What Sleeps Below ----------
// After the crown is whole, the pardoned Prince Edric takes a seat in the King's
// hall and sends the hero into the Deep in stages: s = 0 not offered, 1-4 on a
// step, 5 ready to report, 6 done.
const ACT2_STEPS = [
  { floor: 5, label: 'Reach floor 5 of the Deep and bring back a stone from its walls' },
  { floor: 10, label: 'Slay the Warden of the Deep on floor 10', boss: { type: 'Orc', name: 'the Warden of the Deep' } },
  { floor: 15, label: 'Reach floor 15 and listen to what the walls are saying' },
  { floor: 20, label: 'Face the Dreaming Maw on floor 20', boss: { type: 'Wraith', name: 'the Dreaming Maw' } },
];
const act2 = () => player.meta.act2 || (player.meta.act2 = { s: 0 });
// ---------- the stories ----------
// Story 1, The Shattered Crown: the five shards (Act I) and What Sleeps Below (Act II).
// Story 2, The Far Shore: the Veil of storms parts and three realms beyond it ask for help.
const STORIES = [
  { n: 1, title: 'The Shattered Crown', acts: ['Act I: The Five Shards', 'Act II: What Sleeps Below'] },
  { n: 2, title: 'The Far Shore', acts: ['The Veil parts', 'Three keys, three crowns', 'The Thousand-Step Barrow'] },
  { n: 3, title: 'The Frozen Gate', acts: ['A raven from the north', 'Midgard'] },
  { n: 4, title: 'The Long Night', acts: ['Rifts', 'The Rift Lord'] },
  { n: 5, title: 'The Rebuilding', acts: ['The reckoning', 'The builders'] },
];
const story2 = () => player.meta.story2 || (player.meta.story2 = { s: 0 });   // 0 locked, 1 the keys, 2 the Barrow open, 3 done
const story1Done = () => !!player && !!player.meta && story().phase === 'done' && act2().s >= 6;
const farShoreOpen = () => !!player && !!player.meta && story2().s >= 1;
// Story 3, The Frozen Gate: a raven from the last village before the ice, and a
// portal in a hillside to Midgard, the middle earth of the old sagas.
const story3 = () => player.meta.story3 || (player.meta.story3 = { s: 0 });   // 0 locked, 1 open, 2 done
const story2Done = () => !!player && !!player.meta && story2().s >= 3;
const northOpen = () => !!player && !!player.meta && story3().s >= 1;
const STORY3_INTRO = [
  { who: 'A raven at the window', sprite: 'letter', bg: 'town', title: 'Story 3: The Frozen Gate',
    text: 'It is on the sill when you wake, black and patient, with a strip of birch bark tied to its leg. The bark says, in a hand that has not written much: "Hrafnvik. The gate in the hill is open. Giants. Come." The raven watches you read it, and then watches you some more.' },
  { who: 'Hrafnvik', sprite: 'villager:severin', bg: 'sea', title: 'Hrafnvik',
    text: 'Hrafnvik is the last village before the ice: forty souls, a pier, a church with a stove, on an island so far north that the sea around it freezes to the horizon in winter. Behind it is a hill, and in the hill a door of blue ice taller than a house, which the sagas say was shut by the gods and which the villagers, sensibly, do not go near.' },
  { who: 'Midgard', sprite: 'troll', bg: 'crypt', title: 'Midgard',
    text: 'The sagas call the land beyond the door Midgard, the middle earth of the old world, where the roots of the World Tree run through halls of ice and the frost giants wait for a winter that never ends. Thrym, Jarl of the Frost Giants, has been waiting the longest. Now the door is open, and what has come through it so far is draugr, direwolves, and a cold that puts out fires.' },
  { who: 'North', sprite: 'ship', bg: 'sea', title: 'North',
    text: 'Any harbourmaster will take you north to Hrafnvik now, through the pack ice, or you can sail yourself if your ship is stout. Go through the Frozen Gate, go down through Midgard, and shut it from the other side, which means Thrym. The journal (J) keeps the tale.' },
];
const STORY3_FINALE = [
  { who: 'Thrym falls', sprite: 'troll', bg: 'crypt', title: 'Thrym falls',
    text: 'The Jarl of the Frost Giants goes down like a cliff into the sea, and the cold goes out of the hall with him. For the first time in a thousand years something drips in Midgard. The roots of the World Tree creak, the way wood creaks in spring, and the door of blue ice behind you begins, very slowly, to close.' },
  { who: 'The last village', sprite: 'villager:severin', bg: 'sea', title: 'The last village',
    text: 'Hrafnvik meets you on the pier with the church bell going and the stove lit. Forty souls, a very great deal of fish, and the raven, which lands on your shoulder, considers your ear, and decides it is yours now. You are the Giantsbane, and the north is quiet.' },
];
function offerStory3() {
  if (story3().s !== 0 || !story2Done() || storyOpen()) return;
  story3().s = 1;
  sfx.play('quest'); unlock('northbound'); track('story3_opened');
  showScene(STORY3_INTRO, () => { log('Story 3, The Frozen Gate: take passage north to Hrafnvik from any harbour, and go through the gate in the hill.', 'good'); mapCache.ox = null; saveProgress('progress'); });
}
function frostJarlSlain() {
  if (story3().s >= 2) return;
  story3().s = 2; player.gold += 3000; unlock('giantsbane'); track('story3_done');
  showScene(STORY3_FINALE, () => { giveRelic('frostheart'); log('Story 3 complete: 3000 gold and the Frostheart. The Frozen Gate is shut.', 'good'); updateStats(); saveProgress('progress'); });
}
const thuleTown = () => townAt(THULE.i, THULE.j);
// Story 4, The Long Night: Thrym's death breaks the seal on Midgard's hosts, and
// rifts tear open outside the towns of the realms. Hordes pour out, march on the
// walls, cut down the watch and set the roofs burning until the hero stops them.
const story4 = () => player.meta.story4 || (player.meta.story4 = { s: 0, closed: 0 });   // 0 locked, 1 the rifts, 2 done
const story3Done = () => !!player && !!player.meta && story3().s >= 2;
const RIFTS_TO_CLOSE = 5, RIFT_EVERY = 90;
let rifts = [];   // { x, y, town, opened, lord }
const hordeFields = new Map();   // town key + turn -> distance field to its square
const STORY4_INTRO = [
  { who: 'The night the sky tore', sprite: 'wraith', bg: 'crypt', title: 'Story 4: The Long Night',
    text: 'It begins the week after Thrym falls. A farmer outside Hearth sees the air above his field split like cloth, and what comes through is not weather. The Frozen Gate was never the only door. Thrym was the lock on all of them, and the lock is dead.' },
  { who: 'The hosts of Midgard', sprite: 'troll', bg: 'crypt', title: 'The hosts of Midgard',
    text: 'Draugr in rusted mail, winter wolves, frost trolls, and the rift-wraiths that herd them: the hosts of the middle earth, who have waited a thousand years for a way in. Rifts open outside towns across every realm. The hordes march on the walls, the watch dies on the gate, and the roofs burn.' },
  { who: 'Close them', sprite: 'hero', bg: 'town', title: 'Close them',
    text: 'A rift stays open while its horde lives. Kill them to the last and it collapses. Close enough of them and whatever is opening them will have to come through itself. Watch the roads, watch the sky, and keep your pets close. The journal (J) keeps the tally.' },
];
const STORY4_FINALE = [
  { who: 'The Rift Lord falls', sprite: 'wraith', bg: 'crypt', title: 'The Rift Lord falls',
    text: 'It comes apart in a scream that is felt rather than heard, and every rift from the ice to the Far Shore folds shut in the same instant, like eyes closing. The hosts of Midgard, cut off from their door, go to dust where they stand.' },
  { who: 'Morning', sprite: 'hero', bg: 'town', title: 'Morning',
    text: 'The roofs are patched, the watch is buried with honours and hired again, and seven realms argue about who will pay for it. Four stories, four shores, and a hero who is, at last, allowed to sleep late. The Long Night is over.' },
];
function offerStory4() {
  if (story4().s !== 0 || !story3Done() || storyOpen()) return;
  story4().s = 1; story4().closed = 0;
  sfx.play('boss'); shakeScreen(6, 700); unlock('longnight'); track('story4_opened');
  showScene(STORY4_INTRO, () => { log('Story 4, The Long Night: rifts will open outside towns near you. Kill the horde to close a rift; close five and the Rift Lord comes.', 'bad'); saveProgress('progress'); });
}
const HORDE = [
  { type: 'Skeleton', name: 'Draugr', weight: 4 }, { type: 'Direwolf', name: 'Winter wolf', weight: 3 }, { type: 'Troll', name: 'Frost troll', weight: 1 }, { type: 'Wraith', name: 'Rift wraith', weight: 1 },
];
// a rift opens on open ground outside a town, and its horde comes through
function openRift(town, lord = false) {
  // somewhere outside the walls with a walkable road to the square: a tile 20 to 44 steps out on the town's field
  const field = bfs(town.cx, town.cy, 56, false, true); hordeFields.set(`${town.key}:${turn}`, field);
  const tries = [];
  for (const [k, d] of field) { if (d < 20 || d > 44) continue; const [x, y] = k.split(',').map(Number); if (getTile(x, y) === TILE.FLOOR && !townContaining(x, y) && !getMonsterAt(x, y) && cheb({ x, y }, player) > 6) tries.push({ x, y }); }
  if (!tries.length) return null;
  const { x, y } = tries[rnd(tries.length)], rift = { x, y, town: town.key, opened: turn, lord };
  rifts.push(rift);
  const danger = Math.max(wildDanger(), Math.floor(player.level / 6));
  const n = lord ? 6 : 5 + Math.min(6, Math.floor(player.level / 8));
  const pool = HORDE.flatMap((h) => Array(h.weight).fill(h));
  for (let i = 0; i < n; i++) {
    const h = pool[rnd(pool.length)], t = MONSTER_TYPES.find((m) => m.name === h.type), spot = freeTileNear(x, y, 3);
    if (!t || !spot) continue;
    addMonster(t, spot.x, spot.y, { hp: Math.round(t.hp * (1.5 + danger * 0.4)), atk: t.atk + Math.floor(danger / 2), name: h.name, horde: town.key, wild: true, purse: 15 + danger * 6, elite: h.type === 'Troll' });
  }
  if (lord) { const w = MONSTER_TYPES.find((m) => m.name === 'Wraith'), spot = freeTileNear(x, y, 2) || { x, y }; addMonster(w, spot.x, spot.y, { hp: Math.round(w.hp * 6 * (1 + danger * 0.3)), atk: w.atk + danger + 2, name: 'the Rift Lord', horde: town.key, wild: true, boss: true, superBoss: true, riftLord: true, purse: 500 }); }
  monsters = worldMonsters; monstersDirty = true;
  shakeScreen(7, 600); sfx.play('boss'); burst(x, y, '#c084fc', 40, 160, { glow: true, gravity: -40, life: 900, size: 3 });
  log(lord ? `The sky splits outside ${town.name} and something vast steps through: the Rift Lord, with his guard. This is the last door.` : `A rift tears open ${compassWord(x - town.cx, y - town.cy).toLowerCase()} of ${town.name}, and a horde of Midgard pours out towards the walls!`, 'bad');
  toast = { text: lord ? `The Rift Lord is at ${town.name}!` : `A rift has opened at ${town.name}! Kill the horde to close it.`, until: performance.now() + 5000 };
  track('rift_opened', { lord }); mapCache.ox = null;
  return rift;
}
const riftHorde = (r) => monsters.filter((m) => m.horde === r.town && m.hp > 0);
function tickRifts() {
  if (scene !== 'world' || story4().s !== 1) return;
  // open rifts close when their horde is dead
  for (const r of rifts.slice()) {
    if (riftHorde(r).length) continue;
    rifts = rifts.filter((x) => x !== r);
    const town = townAt(...r.town.split(',').map(Number));
    if (r.lord) continue;   // the lord's rift closes with him
    story4().closed = (story4().closed || 0) + 1;
    const g = 150 + 40 * story4().closed; player.gold += g; gainXp(40 + player.level * 2);
    burst(r.x, r.y, '#c084fc', 50, 180, { glow: true, gravity: 60, life: 900 }); sfx.play('win');
    log(`The last of the horde falls and the rift outside ${town ? town.name : 'the town'} folds shut. ${g} gold from the realm's purse. Rifts closed: ${story4().closed}/${RIFTS_TO_CLOSE}.`, 'good');
    if (story4().closed >= RIFTS_TO_CLOSE) unlock('riftwarden');
    saveProgress('progress');
  }
  // a new rift near the hero now and then; the Rift Lord once enough are closed
  const near = nearbyTowns(player.x, player.y, 1).filter((t) => t.size !== 'grand' && !t.thule && cheb({ x: t.cx, y: t.cy }, player) <= 70);
  if (!rifts.length && story4().closed >= RIFTS_TO_CLOSE && near.length && !monsters.some((m) => m.riftLord)) { openRift(near[rnd(near.length)], true); return; }
  if (rifts.length < 2 && story4().closed < RIFTS_TO_CLOSE && turn % RIFT_EVERY === 0 && near.length) openRift(near[rnd(near.length)]);
}
// a horde monster far from the hero still marches on its town, fights the watch at the walls and sets fires
function hordeStep(m) {
  const town = townAt(...m.horde.split(',').map(Number)); if (!town) return;
  const gd = npcs.find((n) => n.type.guard && !n.down && dist(m, n) === 1);
  if (gd) { const was = gd.hp; guardHurt(gd, m); if (gd.down && was > 0 && cheb(m, player) <= 30) log(`${gd.type.name} falls to the ${mName(m)} at the walls of ${town.name}!`, 'bad'); return; }
  const atSquare = cheb(m, { x: town.cx, y: town.cy }) <= town.plaza[0] + 2;
  const gnear = npcs.filter((n) => n.type.guard && !n.down && cheb(n, m) <= 8).sort((a, b2) => dist(a, m) - dist(b2, m))[0];   // the watch is the first thing they go for
  if (atSquare) { town.burning = turn; if (!town.burnLogged) { town.burnLogged = true; log(`${town.name} is burning!`, 'bad'); } if (!gnear && Math.random() < 0.6) return; }   // in the square they loot and burn
  const goal = gnear || (atSquare ? { x: town.cx + rnd(13) - 6, y: town.cy + rnd(9) - 4 } : { x: town.cx, y: town.cy });
  // march by a distance field: towards the guard, or down the town's field (shared by the whole horde each turn)
  let field = null;
  if (gnear) field = bfs(gnear.x, gnear.y, 14, false, true);
  else if (!atSquare) { const ck = `${town.key}:${turn}`; if (!hordeFields.has(ck)) { if (hordeFields.size > 6) hordeFields.clear(); hordeFields.set(ck, bfs(town.cx, town.cy, 56, false, true)); } field = hordeFields.get(ck); }
  if (field) {
    let best = null, bestD = field.get(key(m.x, m.y)) ?? Infinity;
    for (const [ax, ay] of DIRS) {
      const nx = m.x + ax, ny = m.y + ay, nd = field.get(key(nx, ny)), t = getTile(nx, ny);
      if (nd === undefined || nd >= bestD || (t !== TILE.FLOOR && t !== TILE.EXIT) || getMonsterAt(nx, ny) || getNpcAt(nx, ny) || houndAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
      bestD = nd; best = [nx, ny];
    }
    if (best) { moveMonster(m, best[0], best[1]); return; }
  }
  const dx = Math.sign(goal.x - m.x), dy = Math.sign(goal.y - m.y);
  const tries = Math.abs(goal.x - m.x) >= Math.abs(goal.y - m.y) ? [[dx, 0], [0, dy], [dx, dy]] : [[0, dy], [dx, 0], [dx, dy]];
  for (const [sx, sy] of tries) {
    if (!sx && !sy) continue;
    const nx = m.x + sx, ny = m.y + sy, t = getTile(nx, ny);
    if ((t !== TILE.FLOOR && t !== TILE.EXIT) || getMonsterAt(nx, ny) || getNpcAt(nx, ny) || houndAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
    moveMonster(m, nx, ny); return;
  }
}
const townBurning = (t) => !!t.burning && (turn - t.burning < 150 || monsters.some((m) => m.horde === t.key && m.hp > 0 && townContaining(m.x, m.y) === t));
function riftLordSlain() {
  if (story4().s >= 2) return;
  story4().s = 2; rifts = []; player.gold += 4000; unlock('riftlord'); track('story4_done');
  for (const m of monsters.slice()) if (m.horde) { burst(m.x, m.y, '#c084fc', 10, 80, { life: 400 }); monsters = monsters.filter((x) => x !== m); }
  worldMonsters = monsters; monstersDirty = true;
  showScene(STORY4_FINALE, () => { giveRelic('riftheart'); log('Story 4 complete: 4000 gold and the Riftheart. The Long Night is over.', 'good'); updateStats(); saveProgress('progress'); });
}
// the rifts themselves, and the fires they bring, drawn every frame
function drawRifts(g, now) {
  if (scene !== 'world') return;
  for (const r of rifts) {
    const x = r.x * T - cam.x + T / 2, y = r.y * T - cam.y + T / 2;
    if (x < -60 || y < -60 || x > canvas.width + 60 || y > canvas.height + 60) continue;
    const R = r.lord ? 30 : 20, rg = g.createRadialGradient(x, y, 2, x, y, R * 1.6); rg.addColorStop(0, 'rgba(192,132,252,0.55)'); rg.addColorStop(1, 'rgba(192,132,252,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, R * 1.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#120a24'; g.beginPath(); g.ellipse(x, y, R * 0.55, R, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const a = now / 400 + k * 1.6; g.strokeStyle = `rgba(216,180,254,${0.5 + 0.3 * Math.sin(a)})`; g.beginPath(); g.ellipse(x, y, R * (0.3 + k * 0.15), R * (0.55 + k * 0.15), a, a, a + 2.2); g.stroke(); }
    g.fillStyle = 'rgba(240,230,255,0.9)'; for (let k = 0; k < 6; k++) { const a = now / 300 + k; g.fillRect(x + Math.cos(a) * R * 0.5 - 1, y + Math.sin(a * 1.3) * R * 0.9 - 1, 2, 2); }
  }
  for (const t of nearbyTowns(player.x, player.y, 1)) {
    if (!townBurning(t)) continue;
    t.houses.forEach((h, i) => {
      if ((i + t.i) % 3 === 0) return;   // not every roof catches
      const X = h.x * T - cam.x, Y = h.y * T - cam.y, W = h.w * T;
      if (X > canvas.width + 60 || Y > canvas.height + 60 || X + W < -60 || Y < -120) return;
      for (let k = 0; k < Math.max(2, Math.round(W / 30)); k++) {
        const fx = X + 10 + (((k * 37 + h.x * 5) % Math.max(1, W - 20)) + Math.max(1, W - 20)) % Math.max(1, W - 20), ph = (((now / 260 + k * 0.7 + h.y) % 1) + 1) % 1, hgt = 14 + Math.sin(now / 90 + k) * 4;   // world coordinates go negative, so keep the phases positive
        g.fillStyle = 'rgba(255,120,30,0.85)'; g.beginPath(); g.moveTo(fx - 7, Y + 12); g.quadraticCurveTo(fx - 2, Y - 2, fx, Y + 12 - hgt); g.quadraticCurveTo(fx + 2, Y - 2, fx + 7, Y + 12); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,220,90,0.9)'; g.beginPath(); g.moveTo(fx - 3, Y + 12); g.quadraticCurveTo(fx, Y + 4, fx, Y + 12 - hgt * 0.55); g.quadraticCurveTo(fx, Y + 4, fx + 3, Y + 12); g.closePath(); g.fill();
        g.fillStyle = `rgba(60,55,60,${0.35 * (1 - ph)})`; g.beginPath(); g.arc(fx + Math.sin(ph * 6 + k) * 6, Y - 6 - ph * 50, 6 + ph * 10, 0, Math.PI * 2); g.fill();   // smoke
      }
      g.fillStyle = `rgba(255,120,30,${0.08 + 0.04 * Math.sin(now / 150 + i)})`; g.fillRect(X - 10, Y - 10, W + 20, h.h * T + 20);
    });
  }
}
const STORY2_INTRO = [
  { who: 'An envoy from across the Veil', sprite: 'merchant:tianxia', bg: 'sea', title: 'Story 2: The Far Shore',
    text: 'A ship with sails the colour of sunset puts into harbour, and a woman in grey silk asks for you by name. "For a thousand years the Veil of storms has closed the eastern sea," she says. "It was not weather. Our three founders raised it, to wall something in. When your Crown was mended and the Deep went quiet, the Veil fell. So did the wards beneath it."' },
  { who: 'The Hollow King', sprite: 'necromancer', bg: 'crypt', title: 'The Hollow King',
    text: '"Before there were three crowns there was one, and it was hollow. The Hollow King took the breath out of every living thing that would not kneel, and ruled a continent of the obedient dead. Three generals broke him: one with a seal, one with a lotus, one with a bear\'s claw. They could not kill him. They buried him under the Mountain of a Thousand Steps, each with a lock, and raised the Veil so that no fool from over the sea would ever come looking for the keys."' },
  { who: 'The Far Shore', sprite: 'ship', bg: 'sea', title: 'The Far Shore',
    text: '"The generals\' heirs rule now: the Celestial Empire of Tianxia, the Rajadom of Suryadesh and the Tsardom of Severin. The keys are their crown treasures. The Barrow has begun to breathe, the dead have begun to walk the roads, and the three crowns, who have not agreed on anything in a thousand years, agree that they want a fool from over the sea. Any harbourmaster sells passage now. Earn the three keys. Then go down the thousand steps." The journal (J) keeps the tale.' },
];
const BARROW_UNSEALED = [
  { who: 'The mountain breathes', sprite: 'stones', bg: 'crypt', title: 'The Barrow unsealed',
    text: 'The third key is barely in your hand when the ground shivers from one coast to the other. At the heart of the Far Shore the Mountain of a Thousand Steps splits along an old seam, and a cold wind comes out of it that smells of nothing at all. The Hollow King knows his keys have been gathered. He is waiting for whoever brings them.' },
  { who: 'The thousand steps', sprite: 'crypt', bg: 'crypt', title: 'The thousand steps',
    text: 'The Thousand-Step Barrow lies at the centre of the continent, between the three realms. Six floors of the obedient dead and the Hollow King at the bottom, stronger than anything you have fought. Bring potions. The three crowns will send their soldiers to hold the door, but what is below it is yours.' },
];
const STORY2_FINALE = [
  { who: 'The Hollow King falls', sprite: 'necromancer', bg: 'crypt', title: 'The Hollow King falls',
    text: 'He comes apart like a house of ash in a draught, and the breath he stole a thousand years ago goes out of the Barrow in one long sigh that bends the grass for a mile. The obedient dead lie down. The Mountain of a Thousand Steps is, at last, only a mountain.' },
  { who: 'Three crowns, one table', sprite: 'king:tianxia', bg: 'sea', title: 'Three crowns, one table',
    text: 'Empress, Maharani and Tsar sit at one table for the first time in living memory, and the table is set for you. The Veil is declared open for good, the sea road chartered, and the Hollow King\'s crown, which none of them will touch, is handed to you with tongs.' },
  { who: 'Friend of Seven Realms', sprite: 'hero', bg: 'sea', title: 'Friend of Seven Realms',
    text: 'Seven realms on two shores know your name now. There will be other stories. For tonight there is a feast, three kinds of wine, and a bear that has had rather too much of all of them.' },
];
function unsealBarrow() {
  story2().s = 2; sfx.play('boss'); shakeScreen(8, 900); track('barrow_unsealed');
  showScene(BARROW_UNSEALED, () => { log('The Thousand-Step Barrow is open. Follow the gold star.', 'good'); mapCache.ox = null; saveProgress('progress'); });
}
function hollowKingSlain() {
  if (story2().s >= 3) return;
  story2().s = 3; player.gold += 2000; unlock('hollowking'); unlock('seven_realms'); track('story2_done');
  showScene(STORY2_FINALE, () => { giveRelic('hollowcrown'); log('Story 2 complete: 2000 gold, the Hollow King\'s crown, and the sea road open for good.', 'good'); updateStats(); saveProgress('progress'); });
}
function offerStory2() {
  if (story2().s !== 0 || !story1Done() || storyOpen()) return;
  story2().s = 1;
  sfx.play('quest'); unlock('farshore'); track('story2_opened');
  showScene(STORY2_INTRO, () => { log('Story 2, The Far Shore: take passage across the Veil from any harbour, earn the three keys from the three crowns, and go down the thousand steps.', 'good'); mapCache.ox = null; saveProgress('progress'); });
}
// the port on each side of the Veil that the passage runs between
function farPort() { let best = null; for (let i = 8; i <= 21; i++) for (let j = -6; j <= 6; j++) { const t = townAt(i, j); if (t && t.harbour && (!best || Math.hypot(t.i - 9, t.j) < Math.hypot(best.i - 9, best.j))) best = t; } return best; }   // the Far Shore's western landfall
function homePort() { let best = null; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const t = townAt(i, j); if (t && t.harbour && (!best || Math.hypot(t.i, t.j) < Math.hypot(best.i, best.j))) best = t; } return best; }
const act2Active = () => story().phase === 'done' && act2().s >= 1 && act2().s <= 4;
const EDRIC_SCENES = {
  offer: [
    { who: 'Prince Edric', sprite: 'darkknight', text: '"My brother keeps me close now, where he can see me." Edric\'s smile has no bitterness left in it, only tiredness. "He also gave me a problem to solve, as penance. The five lights were holding something down. I broke the crown; I felt it wake. It is still awake."' },
    { who: 'Prince Edric', sprite: 'darkknight', text: '"The Gate of the Deep opened the night the crown broke. I have read everything in the royal library about what lies beneath, and it is not enough. I need someone to go down and come back. In stages, with proof. I will pay, and I will tell you everything I learn."' },
  ],
  step1: '"A stone from the fifth floor." He turns it over under a lamp. "Warm. They are all warm down there, you say? The library calls the Deep a dream, and the lights its lids. Then we are inside the dream now." He makes a note. "Deeper. There is a warden on the tenth floor, the old texts say. See what it guards."',
  step2: '"The Warden is dead, and you are not. Good." Edric unrolls a chart. "The Warden kept the lower halls closed. Below it the walls themselves are said to speak. Go to the fifteenth floor and listen. Write down what you hear, if you can bear to."',
  step3: '"\'It should have been me.\'" Edric reads the words you copied and goes very still. "My words. Carved on my father\'s throne by my own hand, and now the Deep says them back to you." He is quiet for a long moment. "It wears the shapes of our guilt. That is how it dreams. On the twentieth floor it has a mouth. Close it."',
  finale: [
    { who: 'Ser Halvard', sprite: 'darkknight', text: 'Halvard meets you at the hall door and, for the first time, salutes. "Twenty floors," he says. "I went down five once, for the prince, and came up grey. Go in. He has been pacing since dawn."' },
    { who: 'Prince Edric', sprite: 'darkknight', text: '"The Maw is closed." He says it twice, as if to be sure. "I have spent ten years believing I broke the world out of spite, and the truth is worse: I broke it out of carelessness, and a stranger mended it twice." He stands. "Aldric will want to give you a title. Let me give you something more useful."' },
    { who: 'King Aldric', sprite: 'king', text: '"The library says the Deep will dream again, in a hundred years or a thousand. Let it. The four realms have a hero now, and my brother, and a crown that is whole." He raises your hand before the court. "Deepwarden. Wherever you walk, the gates of Aurum are open."' },
  ],
};
function edricTalk(n) {
  if (n.type.name !== 'Prince Edric') return false;
  const A = act2();
  if (story().phase !== 'done') return false;
  if (A.s === 0) {
    showScene(EDRIC_SCENES.offer.concat([{ who: 'Prince Edric', sprite: 'darkknight', text: 'The gate lies in the hills between Hearth and Castle Aurum. Will you go down?', choices: [
      { label: 'I will go', run: () => { A.s = 1; A.n = 0; log(`Act II, What Sleeps Below: ${ACT2_STEPS[0].label}.`, 'good'); sfx.play('quest'); mapCache.ox = null; saveProgress('progress'); return '"Then go carefully. The first five floors should be within you. Bring me a stone from the fifth."'; } },
      { label: 'Not yet', run: () => '"The Deep is patient," Edric says. "Be patient with yourself too."' },
    ] }]));
    return true;
  }
  if (A.s === 5) {
    showScene(EDRIC_SCENES.finale, () => {
      A.s = 6; player.gold += 500;
      if (!giveRelic('deepheart') && !player.meta.found.includes('deepheart')) log('Your bag is too full for the gift. Come back with room.', 'bad');
      unlock('deepwarden'); player.title = 'Deepwarden';
      log('Act II complete: 500 gold, and the Heart of the Deep.', 'good');
      setTimeout(() => offerStory2(), 1200);   // Story 2 follows straight on
      mapCache.ox = null; updateStats(); saveProgress('progress');
    });
    return true;
  }
  const report = { 2: EDRIC_SCENES.step1, 3: EDRIC_SCENES.step2, 4: EDRIC_SCENES.step3 }[A.s];
  if (report && !A.told) {
    A.told = true;
    showScene([{ who: 'Prince Edric', sprite: 'darkknight', text: report }], () => { log(`Next: ${ACT2_STEPS[A.s - 1].label}.`, 'good'); saveProgress('progress'); });
    return true;
  }
  log(`Prince Edric: "${ACT2_STEPS[A.s - 1].label}. I will be here."`);
  return true;
}
// Called when the hero arrives on a Deep floor, and when a Deep boss falls.
function lairSlain(id) {
  const L = LAIRS[id], S = lairState();
  if (!lairKnown(id)) S.known.push(id);
  const first = !S.slain.includes(id);
  if (first) S.slain.push(id);
  unlock('lairslayer');
  if (LAIR_IDS.every((id) => S.slain.includes(id))) unlock('legend');
  if (L.forge) {
    const next = FORGE_ORDER.find((id) => !S.slain.includes(id));
    if (first) log(`Among the bones lies ${L.piece}. ${next ? `${forgePieces().length} of 3 pieces of Dawnbreaker are yours.` : 'All three pieces of Dawnbreaker are yours. Carry them to a master smith.'}`, 'good');
    if (next && !lairKnown(next)) revealLair(next, `Scratched into the warden's armour, a map:`);
    showScene([{ who: L.boss.name, sprite: MONSTER_TYPES.find((t) => t.name === L.boss.type).sprite, bg: L.theme === 'lava' ? 'lava' : L.theme === 'arcane' ? 'tower' : 'crypt',
      text: first ? `${L.boss.name[0].toUpperCase() + L.boss.name.slice(1)} is dead, and ${L.piece} is yours. ${next ? `${LAIRS[next].piece[0].toUpperCase() + LAIRS[next].piece.slice(1)} waits in ${LAIRS[next].title}.` : 'The sword of the First King is whole in all but the forging. Find a master smith.'}` : `${L.boss.name[0].toUpperCase() + L.boss.name.slice(1)} is dead again. The piece was already yours.` }]);
    track('lair_slain', { lair: id, first }); mapCache.ox = null; updateStats(); saveProgress('progress'); return;
  }
  const it = itemInfo(L.reward);
  if (first && !bagFull()) { player.bag.push(L.reward); log(`Among the bones lies ${it.name}: ${itemLabel(L.reward)}. There is no other like it.`, 'good'); }
  else if (first) { S.slain.pop(); log(`${it.name} lies among the bones, but your bag is full. Make room and come back.`, 'bad'); }
  showScene([{ who: L.boss.name, sprite: MONSTER_TYPES.find((t) => t.name === L.boss.type).sprite, bg: L.theme === 'lava' ? 'lava' : L.theme === 'flooded' ? 'grotto' : L.theme === 'arcane' ? 'tower' : 'crypt',
    text: first ? `${L.boss.name[0].toUpperCase() + L.boss.name.slice(1)} is dead. ${L.lore} The realms will tell this one for a long time.` : `${L.boss.name[0].toUpperCase() + L.boss.name.slice(1)} is dead again. Whatever brings them back, it has not learned.` }]);
  track('lair_slain', { lair: id, first });
  mapCache.ox = null; updateStats(); saveProgress('progress');
}
function act2Progress(kind, fl) {
  const A = act2();
  if (!act2Active()) return;
  const step = ACT2_STEPS[A.s - 1];
  if (fl !== step.floor) return;
  if ((step.boss && kind !== 'boss') || (!step.boss && kind !== 'floor')) return;
  const texts = {
    1: 'You pry a stone from the wall of the fifth floor. It is warm in your hand, like something breathing.',
    2: 'The Warden of the Deep falls, and somewhere far below a door that has been shut for a thousand years swings open.',
    3: 'The walls of the fifteenth floor whisper. The words are in your own voice: "It should have been me. It should have been me." You write them down with a shaking hand.',
    4: 'The Dreaming Maw closes with a sound like the world exhaling. In the silence that follows, the Deep feels, for the first time, merely deep.',
  };
  A.s++; A.told = false;
  showScene([{ who: 'The Deep', sprite: 'abyss', text: texts[A.s - 1] }], () => {
    log(A.s === 5 ? 'Return to Prince Edric at Castle Aurum.' : `Act II: ${ACT2_STEPS[A.s - 1].label}. Prince Edric will want to hear of this first.`, 'good');
    mapCache.ox = null; saveProgress('progress');
  });
  sfx.play('quest');
}
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
      if (town && x >= town.x0 - 6 && x < town.x0 + tw(town) + 6 && y >= town.y0 - 6 && y < town.y0 + th(town) + 6) continue;
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
const GRAND_W = 60, GRAND_H = 44;   // Castle Aurum's footprint
const tw = (t) => t.w || TW, th = (t) => t.h || TH;
const GROUND = { GRASS: 0, FOREST: 1, SAND: 2, WATER: 3, MOUNTAIN: 4, ROAD: 5, COBBLE: 6, TREE: 7, RAMPART: 8, DOCK: 9, SNOW: 10 };
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
  tianxia: [['Jin', 'Lin', 'Hua', 'Tian', 'Shen', 'Long', 'Bai', 'Yun', 'Feng', 'Ming', 'Qing', 'Lu'], ['', '', ''], ['zhou', 'jing', 'an', 'yang', 'cheng', 'he', 'shan', 'kou', 'ling', 'men']],
  suryadesh: [['Surya', 'Chandra', 'Ratna', 'Vijaya', 'Nila', 'Kamal', 'Indra', 'Deva', 'Padma', 'Hari', 'Amba', 'Mani'], ['', '', ''], ['pur', 'nagar', 'kot', 'garh', 'vati', 'puram', 'ghat', 'pura', 'giri', 'sagar']],
  severin: [['Novo', 'Belo', 'Krasno', 'Zlato', 'Vysoko', 'Staro', 'Volko', 'Sever', 'Cherno', 'Sveto', 'Dobro', 'Morozo'], ['', '', ''], ['grad', 'gorsk', 'slav', 'pol', 'vsk', 'yarsk', 'vo', 'zero', 'vka', 'borsk']],
};
const CAPITAL_NAMES = { kathar: 'Kar Thuldun', league: 'Goldspire', tianxia: 'Jinling', suryadesh: 'Suryapur', severin: 'Vysokograd' };
// Two towns close together never share a name: the later one takes a qualifier.
const NAME_QUALIFIERS = ['Little', 'Upper', 'Lower', 'Old', 'New', 'Great', 'High', 'Nether'];
function hasTown(i, j) {
  if (i === 0 && j === 0) return true;
  if (ALL_REALMS.some((id) => REALMS[id].capital[0] === i && REALMS[id].capital[1] === j)) return true;
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
// ---------- continents ----------
// Each realm has a continent of its own, centred on its capital, with open sea
// between them, narrow land bridges joining neighbours, and small islands beyond.
const CONT_RX = 124, CONT_RY = 150, BRIDGE_W = 11;   // continents are taller than they are wide, so the eastern pair keeps a strait
const CONTINENTS = [...REALM_ORDER.map((id) => ({ id, cx: REALMS[id].capital[0] * TOWN_SPACING + 20, cy: REALMS[id].capital[1] * TOWN_SPACING + 15 })),
  { id: 'farshore', cx: 13.5 * TOWN_SPACING + 20, cy: 15, rx: 480, ry: 400 },   // one wide continent shared by the three far realms
  { id: 'thule', cx: 20, cy: -10 * TOWN_SPACING + 15, rx: 60, ry: 60 }];     // Story 3: an icy island far to the north, with the Frozen Gate
const THULE = { i: 0, j: -10 }, THULE_IDX = 5, ICE_Y = -800;   // north of ICE_Y the land is snow and the sea is pack ice
const VEIL_X = 760;   // the Veil of storms: no ship crosses this longitude until Story 2 opens
const BRIDGES = [['cantons', 'aurum'], ['cantons', 'kathar'], ['cantons', 'league'], ['kathar', 'league']].map(([a, b]) => [CONTINENTS.find((c) => c.id === a), CONTINENTS.find((c) => c.id === b)]);
// Six hidden lairs, each with a super boss and a one-of-a-kind reward. They stay off
// the map until a bard, a hermit, a prophet or your own feet find them.
const LAIRS = {
  spider: { i: 1, j: 3,  title: "the Spider Queen's Hollow", type: 'cave',  theme: 'moss',    danger: 8,  pool: ['Spider', 'Bat', 'Goblin'], boss: { type: 'Spider', name: 'Mother Venom, the Spider Queen', hpMult: 9 }, reward: 'fangblade',
    lore: 'Every spider in the realms is her child, the clans say, and she has never forgiven anyone who stepped on one.' },
  wyrm:   { i: 5, j: -3, title: "the Wyrm's Roost", theme: 'lava', type: 'cave', danger: 12, pool: ['Orc', 'Bat', 'Skeleton'], boss: { type: 'Wyrm', name: 'Scald, the Old Wyrm', hpMult: 10 }, reward: 'wyrmscale',
    lore: 'Scald was old when Aurel forged the crown. He sleeps on the gold of three kingdoms and wakes, the farmers say, about once a century. It has been about a century.' },
  drowned: { i: -4, j: -4, title: "the Drowned King's Hall", type: 'crypt', theme: 'flooded', danger: 10, pool: ['Skeleton', 'Wraith', 'Spider'], boss: { type: 'Wraith', name: 'the Drowned King', hpMult: 9 }, reward: 'tidecaller',
    lore: 'A king of the sea-realm that was, before the League. His hall went under the waves and he did not notice, and he holds court there still.' },
  troll:  { i: -1, j: 4,  title: "Old Grumm's Bridge", type: 'warren', theme: 'stone', danger: 9,  pool: ['Orc', 'Goblin', 'Archer'], boss: { type: 'Troll', name: 'Old Grumm, the Bridge Troll', hpMult: 9 }, reward: 'trollhide',
    lore: 'There was a bridge once. Grumm ate the toll-keeper, then the toll, then most of the bridge. He is still hungry.' },
  lich:   { i: 4, j: 2,   title: "the Lich's Observatory", type: 'tower', theme: 'arcane',  danger: 13, pool: ['Skeleton', 'Wraith', 'Necromancer'], boss: { type: 'Necromancer', name: 'Vendrath the Unending', hpMult: 10 }, reward: 'staffofages',
    lore: 'Vendrath counted the stars for three hundred years and found that one of them was counting back. He has not been entirely himself since.' },
  wolf:   { i: -5, j: 1,  title: "the Direwolf's Den", type: 'cave', theme: 'bone', danger: 11, pool: ['Rat', 'Goblin', 'Orc'], boss: { type: 'Direwolf', name: 'Gnashfang, the Winter Wolf', hpMult: 9 }, reward: 'stormhammer',
    lore: 'The winters are longer where Gnashfang hunts. The clans leave a goat on the hill at midwinter and hope it is enough. It is not always enough.' },
  // The Sundered Blade: Dawnbreaker, the sword of the First King, broken into three and hidden on three
  // continents. The master smiths know the tale; the pieces are won from the wardens, and a smith reforges it.
  hilt:  { i: 6, j: 5,    title: 'the Forge of the First King', type: 'warren', theme: 'lava',   danger: 14, pool: ['Orc', 'Archer', 'Bomber'], boss: { type: 'Orc', name: 'Harrow, the Iron Warden', hpMult: 10 }, reward: 'dawnbreaker', forge: 'hilt', piece: 'the Hilt of Dawn',
    lore: 'Here the First King\'s smiths beat Dawnbreaker out of a fallen star. When the King fell, the orcs took the forge and have kept the fires lit ever since, not knowing why.' },
  blade: { i: 16, j: -2,  title: 'the Glass Pagoda', type: 'tower', theme: 'arcane', danger: 17, pool: ['Wraith', 'Necromancer', 'Shaman'], boss: { type: 'Wraith', name: 'the Hollow Smith', hpMult: 10 }, reward: 'dawnbreaker', forge: 'blade', piece: 'the Blade of Dawn',
    lore: 'The blade was carried over the sea to keep it from the usurper, and sealed in a tower of glass on the Far Shore. Its keeper swore to hold it until the King returned. He is still holding it.' },
  stone: { i: -2, j: -10, title: 'the Cairn of the Sun', type: 'crypt', theme: 'frost',  danger: 20, pool: ['Skeleton', 'Direwolf', 'Cave troll', 'Basilisk'], boss: { type: 'Direwolf', name: 'Hati, Who Hunts the Sun', hpMult: 11 }, reward: 'dawnbreaker', forge: 'stone', piece: 'the Sunstone Pommel',
    lore: 'The pommel stone holds the light of the star the blade was forged from. It was buried under a cairn on the ice of Thule, and the wolf that hunts the sun lies on it, waiting for the dark.' },
};
const FORGE_ORDER = ['hilt', 'blade', 'stone'];
const LAIR_IDS = Object.keys(LAIRS).filter((id) => !LAIRS[id].forge);        // the six true lairs
const forgePieces = () => FORGE_ORDER.filter((id) => lairState().slain.includes(id));
const LAIR_AT = Object.fromEntries(Object.entries(LAIRS).map(([id, L]) => [`${L.i},${L.j}`, id]));
const lairState = () => player.meta.lairs || (player.meta.lairs = { known: [], slain: [] });
const lairKnown = (id) => lairState().known.includes(id);
function revealLair(id, how) {
  if (lairKnown(id)) return false;
  lairState().known.push(id);
  const L = LAIRS[id];
  mapCache.ox = null;
  log(`${how} ${L.title[0].toUpperCase() + L.title.slice(1)} is marked on your map. ${L.lore}`, 'good');
  sfx.play('quest'); track('lair_revealed', { lair: id });
  return true;
}
function nearestUnknownLair(x, y) {
  return LAIR_IDS.filter((id) => !lairKnown(id)).map((id) => ({ id, site: siteAt(LAIRS[id].i, LAIRS[id].j) })).sort((a, b) => Math.hypot(a.site.x - x, a.site.y - y) - Math.hypot(b.site.x - x, b.site.y - y))[0] || null;
}
function lairHint(x, y) {
  const n = nearestUnknownLair(x, y); if (!n) return null;
  const d = Math.round(Math.hypot(n.site.x - x, n.site.y - y));
  return { ...n, text: `${LAIRS[n.id].title}, ${compassWord(n.site.x - x, n.site.y - y).toLowerCase()} of here, ${d} paces or so` };
}
// story sites and the Deep gate must be on land: a lobe of land around each of their cells
const LAND_ANCHORS = [...Object.values(STORY_SITES).map((S) => ({ x: S.i * TOWN_SPACING + 47, y: S.j * TOWN_SPACING + 45, r: 58 })), ...Object.values(LAIRS).map((L) => ({ x: L.i * TOWN_SPACING + 47, y: L.j * TOWN_SPACING + 45, r: 58 })), { x: DEEP_CELL[0] * TOWN_SPACING + 48, y: DEEP_CELL[1] * TOWN_SPACING + 60, r: 50 }];
function segDist(x, y, a, b) {
  const vx = b.cx - a.cx, vy = b.cy - a.cy, wx = x - a.cx, wy = y - a.cy;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - (a.cx + vx * t), y - (a.cy + vy * t));
}
function landness(x, y) {
  let v = -1;
  for (const c of CONTINENTS) v = Math.max(v, 1 - Math.hypot((x - c.cx) / (c.rx || CONT_RX), (y - c.cy) / (c.ry || CONT_RY)));
  for (const [a, b] of BRIDGES) v = Math.max(v, 0.3 - segDist(x, y, a, b) / BRIDGE_W * 0.22);
  for (const a of LAND_ANCHORS) v = Math.max(v, 0.45 - Math.hypot(x - a.x, y - a.y) / a.r * 0.4);
  // islands out in the sea
  if (v < -0.12 && valueNoise(x, y, WORLD_SEED + 11, 70) > 0.8) v = Math.max(v, 0.25);
  // a ragged coast
  return v + (valueNoise(x, y, WORLD_SEED + 9, 34) - 0.5) * 0.3 + (valueNoise(x, y, WORLD_SEED + 10, 11) - 0.5) * 0.1;
}
const isLand = (x, y) => landness(x, y) > 0.08;
const isSea = (x, y) => !isLand(x, y);
function continentOf(x, y) {
  let best = -1, bv = 0.2;
  CONTINENTS.forEach((c, k) => { const v = 1 - Math.hypot((x - c.cx) / (c.rx || CONT_RX), (y - c.cy) / (c.ry || CONT_RY)); if (v > bv) { bv = v; best = k; } });
  return best;
}
function terrainAt(x, y) {
  const g = terrainAtRaw(x, y);
  return y < ICE_Y && (g === GROUND.GRASS || g === GROUND.FOREST || g === GROUND.SAND) ? GROUND.SNOW : g;   // the far north lies under snow
}
function terrainAtRaw(x, y) {
  const L = landness(x, y);
  if (L <= 0.08) return GROUND.WATER;
  if (L < 0.125) return GROUND.SAND;   // the shore
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
  grand:   { plaza: [16, 10], houses: [[22, 9, 16, 5, 'throne'], [11, 10, 7, 4, 'royal'], [43, 10, 6, 4, 'smithy'], [11, 30, 6, 4, 'armoury'], [44, 30, 6, 4, 'watch'], [20, 31, 6, 4, 'apothecary'], [34, 31, 6, 4, 'inn'], [45, 20, 5, 4, 'arena'], [24, 3, 12, 3, 'market'], [14, 38, 6, 3, 'cottage'], [40, 38, 6, 3, 'home'], [2, 16, 5, 4, 'shop'], [53, 16, 5, 4, 'herbs']], folk: [6, 9], walled: true },
};
const GRAND_CASTLE = { i: 3, j: -1 };
const REALM_SEATS = { cantons: ['council', 'townhall'], aurum: [null, 'herald'], kathar: ['longhouse', 'shamanhut'], league: ['exchange', 'exchange'], tianxia: ['yamen', 'magistracy'], suryadesh: ['durbar', 'kacheri'], severin: ['terem', 'prikaz'] };
const REALM_ROOFS = { kathar: ['#a07a35', '#8c6a2c', '#b08840'], league: ['#4c2f7a', '#5b3a8b', '#3f2a63'], aurum: null, cantons: null, tianxia: ['#b91c1c', '#166534', '#9a3412'], suryadesh: ['#d97706', '#b45309', '#7c2d12'], severin: ['#1d4ed8', '#15803d', '#b91c1c'] };   // the King's seat, the only one of its kind
const SPECIAL_SHOPS = ['smithy', 'armoury', 'apothecary'];
// ---------- trade shops ----------
// Every town keeps a shop of its own kind, by the trade it is known for, selling
// specialities (items with a `trade` in the catalogue) found nowhere else.
const TRADE_SHOP = {
  fishing:   { name: 'The Fishmonger', sign: 'FISH', npc: 'the fishmonger', line: 'Smoked this morning. Eel for the road, and it settles a poisoned stomach.' },
  salt:      { name: 'The Salt House', sign: 'SALT', npc: 'the salter', line: 'Hams cured in our own salt. They keep for a year, and so will you, on them.' },
  mining:    { name: "The Miners' Store", sign: 'IRON', npc: 'the storekeeper', line: 'Iron rations. Taste of the mine, but you come up harder than you went down.' },
  quarrying: { name: "The Mason's Yard", sign: 'STONE', npc: 'the master mason', line: 'A whetstone from our own quarry puts an edge on anything. A pick, if you want to hit things properly.' },
  timber:    { name: 'The Woodyard', sign: 'WOOD', npc: 'the woodward', line: 'Pitch torches, from our own pines. The dark down there is only dark because nobody brought one.' },
  hunting:   { name: "The Hunters' Lodge", sign: 'LODGE', npc: 'the huntmaster', line: 'Venison pie, and a cloak that smells of the forest, so the forest does not smell you.' },
  farming:   { name: 'The Granary', sign: 'GRAIN', npc: 'the granary-keeper', line: 'Harvest loaf. Bread, honey and something the mages like. Keeps you going.' },
  wine:      { name: "The Vintner's", sign: 'WINE', npc: 'the vintner', line: 'A red that stains the teeth and steadies the hand. One bottle, before you go down. Not three.' },
  wool:      { name: 'The Woolmonger', sign: 'WOOL', npc: 'the woolmonger', line: 'Grey wool, carded here. A cloak off the rack turns a blade as well as it turns the rain, nearly.' },
  bees:      { name: 'The Honey House', sign: 'HONEY', npc: 'the beekeeper', line: 'Mead, from heather honey. Heals what ails you and gives a mage something to think with.' },
  pottery:   { name: "The Potter's Kiln", sign: 'KILN', npc: 'the potter', line: 'Firepots. Clay, pitch and a fuse. Cheaper than a bomb and nearly as rude.' },
  brewing:   { name: 'The Brewery', sign: 'ALE', npc: 'the brewer', line: 'Dark ale. Two cups and you will fight a troll. One cup and you might win.' },
  horses:    { name: 'The Saddlery', sign: 'TACK', npc: 'the saddler', line: 'Horse balm. Good for horses, better for hounds, and your bear will not complain either.' },
  shipping:  { name: "The Chandler's", sign: 'ROPE', npc: 'the chandler', line: 'Rum, rope and tar. The rum is the only one of the three you should drink.' },
  smithing:  { name: 'The Master Smith', sign: 'ANVIL', npc: 'the master smith', line: 'Steel axes, forged here and nowhere else. The merchants in the square sell knives.' },
  glass:     { name: 'The Glassworks', sign: 'GLASS', npc: 'the glassblower', line: 'A spyglass, ground here. Look through it from a hilltop and every place for miles shows itself.' },
  silk:      { name: 'The Silk House', sign: 'SILK', npc: 'the silk merchant', line: 'A silk cloak. Light as nothing, and it turns a blade better than you would think.' },
  rice:      { name: 'The Rice Store', sign: 'RICE', npc: 'the rice merchant', line: 'Rice wine, warm. Heals the body and loosens the mind, in that order.' },
  tea:       { name: 'The Tea House', sign: 'TEA', npc: 'the tea master', line: 'Jasmine tea. Clears the head, clears the blood, and takes a quarter of an hour you do not have. Drink it anyway.' },
  porcelain: { name: 'The Porcelain Works', sign: 'KILN', npc: 'the kiln master', line: 'A draught in a porcelain vial. The vial is worth more than the draught, and the draught will save your life.' },
  spices:    { name: 'The Spice Bazaar', sign: 'SPICE', npc: 'the spice merchant', line: 'Fire curry. Heals you, and for a while afterwards you hit like a man with something to prove.' },
  cotton:    { name: "The Dyers' Hall", sign: 'CLOTH', npc: 'the dyer', line: 'Clean cotton bandage, boiled twice. Binds a wound and draws a poison.' },
  furs:      { name: 'The Fur Trader', sign: 'FURS', npc: 'the fur trader', line: 'Sable, if you have the gold. Bear fat if you do not; it keeps the cold out either way.' },
};
const TRADE_SLOT = { village: [[2, 10, 6, 4], [32, 10, 6, 4], [2, 18, 6, 4]], town: [[34, 16, 5, 4], [1, 16, 5, 4], [1, 10, 5, 4]], city: [[35, 17, 5, 4], [0, 17, 5, 4], [0, 10, 5, 4]], castle: [[22, 22, 6, 4], [12, 22, 6, 4]], grand: [[2, 24, 5, 4], [53, 24, 5, 4]] };
for (const [t, T2] of Object.entries(TRADE_SHOP)) {
  BUILDINGS[`trade_${t}`] = { ...BUILDINGS.shop, name: T2.name, sign: T2.sign, roof: '#8b5a2b', trade: t, npcs: { M: `trader_${t}` } };
  INDOOR_NPCS[`trader_${t}`] = { sprite: 'merchant', name: T2.npc[0].toUpperCase() + T2.npc.slice(1), action: 'trade', lines: [T2.line, 'Specialities of the house. You will not find them in the square, or in any town that does not do what we do.'] };
}
const tradeKey = (I) => Object.keys(TRADES).find((k) => TRADES[k] === I.trade) || 'farming';
function addTradeShop(town) {
  const t = tradeKey(townIdentity(town));
  const slot = (TRADE_SLOT[town.size] || TRADE_SLOT.town).find(([lx, ly, w, h]) => !town.houses.some((o) => town.x0 + lx < o.x + o.w + 1 && town.x0 + lx + w + 1 > o.x && town.y0 + ly < o.y + o.h + 1 && town.y0 + ly + h + 1 > o.y));
  if (!slot) return;
  const [lx, ly, w, h] = slot, roof = REALM_ROOFS[town.realm];
  town.tradeShop = t;
  town.houses.push({ x: town.x0 + lx, y: town.y0 + ly, w, h, id: `trade_${t}`, doorX: town.x0 + lx + Math.floor(w / 2), doorY: town.y0 + ly + h - 1, town: town.key, ...BUILDINGS[`trade_${t}`], ...(roof ? { roof: roof[(lx + ly) % roof.length] } : {}) });
}
const tradeHere = () => (scene === 'house' && interior && interior.house && interior.house.trade) || null;
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
  const isCapital = ALL_REALMS.some((id) => REALMS[id].capital[0] === i && REALMS[id].capital[1] === j);
  const thule = i === THULE.i && j === THULE.j;
  if (!thule && continentOf(i * TOWN_SPACING + 20, j * TOWN_SPACING + 15) === THULE_IDX) { towns.set(k, null); return null; }   // the ice holds one village only
  const onContinent = continentOf(i * TOWN_SPACING + 20, j * TOWN_SPACING + 15) >= 0;
  if (!origin && !isCapital && !(i === GRAND_CASTLE.i && j === GRAND_CASTLE.j) && !onContinent && cellRand(i, j, 90) < 0.28) { towns.set(k, null); return null; }   // some island cells are just wilderness
  // try a few spots in the cell and keep the one on the best land
  let cx = i * TOWN_SPACING + 20, cy = j * TOWN_SPACING + 15, best = -Infinity;
  if (!origin) {
    for (let n = 0; n < 5; n++) {
      const tx = i * TOWN_SPACING + 20 + Math.floor((cellRand(i, j, 91 + n) - 0.5) * 56), ty = j * TOWN_SPACING + 15 + Math.floor((cellRand(i, j, 191 + n) - 0.5) * 56);
      const sc = landScore(tx, ty);
      if (sc > best) { best = sc; cx = tx; cy = ty; }
    }
  }
  const grand = i === GRAND_CASTLE.i && j === GRAND_CASTLE.j;
  const x0 = cx - (grand ? GRAND_W / 2 : 20), y0 = cy - (grand ? GRAND_H / 2 : 15);
  if (!origin && !isCapital && !grand && !thule && (landScore(cx, cy) < 8 || !isLand(cx, cy))) { towns.set(k, null); return null; }   // no towns in the sea
  const sizeRoll = cellRand(i, j, 89);
  const realm = thule ? 'severin' : realmAt(i, j), capitalOf = isCapital ? realm : null;
  // castles mostly belong to the Kingdom, and the Clans keep no walls
  let size = origin ? 'town' : grand ? 'grand' : thule ? 'village' : capitalOf ? 'city' : sizeRoll < 0.3 ? 'village' : sizeRoll < 0.72 ? 'town' : sizeRoll < (realm === 'aurum' ? 0.8 : 0.88) ? 'city' : 'castle';
  if (size === 'castle' && realm === 'kathar') size = 'town';
  const def = TOWN_SIZES[size];
  const base = origin ? 'Hearth' : CAPITAL_NAMES[capitalOf] || uniqueTownName(i, j, realm);
  const name = grand ? 'Castle Aurum' : thule ? 'Hrafnvik' : size === 'castle' ? `Castle ${base}` : base;
  const town = { key: k, i, j, name, size, realm, capital: !!capitalOf, plaza: def.plaza, walled: def.walled, thule, cx, cy, x0, y0, w: grand ? GRAND_W : TW, h: grand ? GRAND_H : TH, houses: [], npcs: null, spawn: { x: cx, y: cy + 3 }, gate: { x: cx, y: y0 + (grand ? GRAND_H - 4 : def.walled ? 26 : 28) }, folk: def.folk };
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
  town.harbour = harbourOf(town);
  addTradeShop(town);
  return town;
}
// A town near the open sea is a port: find the closest sea, run a pier out into it.
function harbourOf(town) {
  let best = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const edge = dx === 1 ? town.x0 + tw(town) : dx === -1 ? town.x0 - 1 : dy === 1 ? town.y0 + th(town) : town.y0 - 1;
    for (let along = -1; along <= 1; along++) {
      const sx = dx ? edge : town.cx + along * 8, sy = dy ? edge : town.cy + along * 6;
      for (let n = 1; n <= (town.thule ? 70 : 14); n++) {   // Hrafnvik's pier runs out over the shore ice to open water
        const x = sx + dx * n, y = sy + dy * n;
        if (!isSea(x, y)) continue;
        if (!best || n < best.n) best = { n, dx, dy, x: x - dx, y: y - dy };   // the last land tile
        break;
      }
    }
  }
  if (!best) return null;
  const len = 5;
  return { dx: best.dx, dy: best.dy, x: best.x, y: best.y, len, end: { x: best.x + best.dx * len, y: best.y + best.dy * len }, ship: { x: best.x + best.dx * (len + 1), y: best.y + best.dy * (len + 1) } };
}
const portAtTile = (x, y) => nearbyTowns(x, y, 1).find((t) => t.harbour && t.harbour.ship.x === x && t.harbour.ship.y === y) || null;
// The nearest town along one axis, skipping empty cells (up to three away).
function neighbourTown(i, j, di, dj) {
  for (let n = 1; n <= 3; n++) { const t = townAt(i + di * n, j + dj * n); if (t) return t; }
  return null;
}
function townContaining(x, y) {
  const i0 = Math.round((x - 20) / TOWN_SPACING), j0 = Math.round((y - 15) / TOWN_SPACING);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const t = townAt(i, j);
    if (t && x >= t.x0 && x < t.x0 + tw(t) && y >= t.y0 && y < t.y0 + th(t)) return t;
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
  shipping:  { label: 'shipping', famous: ['tall ships', 'the harbour market', "sailors' taverns that never close", 'charts of every coast'], deal: 'potions' },
  smithing:  { label: 'smithing', famous: ['blades that hold an edge', 'the ring of a hundred anvils'], deal: 'gear' },
  glass:     { label: 'glassblowing', famous: ['coloured glass', 'mirrors for the Goldspire magnates'], deal: null },
  silk:      { label: 'silk', famous: ['silk from the southern traders', 'the finest tailors in the League'], deal: null },
  rice:      { label: 'rice-farming', famous: ['flooded paddies', 'rice wine', 'the harvest lantern festival'], deal: 'potions' },
  tea:       { label: 'tea', famous: ['terraced tea gardens', 'the tea-house by the gate', 'jasmine tea pressed into bricks'], deal: 'potions' },
  porcelain: { label: 'porcelain', famous: ['blue-and-white porcelain', 'kilns that never cool'], deal: null },
  spices:    { label: 'spices', famous: ['the spice bazaar', 'saffron fields', 'pepper that makes knights weep'], deal: 'potions' },
  cotton:    { label: 'cotton', famous: ['printed cottons', 'dyers with blue hands'], deal: null },
  furs:      { label: 'fur-trapping', famous: ['sable and ermine', 'the winter fur fair', 'bearskin cloaks'], deal: 'gear' },
};
const DEAL_TEXT = { potions: 'Potions and supplies are cheap here', gear: 'Weapons and armour are cheaper here', horse: 'Horses are a quarter cheaper at the stables here' };
const STATUE_OF = {
  cantons: ['Speaker Hollis the Founder', 'Bram the Mason', 'Old Mother Tansy', 'the First Council'],
  aurum: ['King Aurel the Founder', 'Queen Isolde the Wise', 'Sir Corvin of the Bridge', 'King Aldous the Builder'],
  kathar: ['Chieftain Varn the Tall'], league: ['Magnate Orlov the Elder', 'the Merchant Prince Callis', 'Lady Opaline Vess'],
  tianxia: ['the First Emperor Shen Zu', 'the scholar Bai Juyin', 'General Long Feng', 'the Dowager Empress Hua'],
  suryadesh: ['Raja Vikram the Sun-born', 'the saint Padmini', 'Rani Chandravati', 'the elephant Gajendra'],
  severin: ['Tsar Ivan the Builder', 'Saint Sveta of the Snows', 'the boyar Dobrynya', 'Baba Morozova'],
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
const REALM_LANDMARKS = { tianxia: ['belltower', 'statue', 'well', 'obelisk'], suryadesh: ['well', 'statue', 'obelisk', 'belltower'], severin: ['belltower', 'bonfire', 'statue', 'well'], cantons: ['statue', 'oak', 'well', 'belltower'], aurum: ['statue', 'belltower', 'obelisk', 'well'], kathar: ['bonfire', 'stones', 'oak'], league: ['obelisk', 'statue', 'well', 'belltower'] };
const LEADER_TITLES = { cantons: ['Reeve', 'Mayor'], aurum: ['Bailiff', 'Lord Mayor'], kathar: ['Elder', 'Headwoman'], league: ['Factor', 'Alderman'], tianxia: ['Magistrate', 'Prefect'], suryadesh: ['Thakur', 'Nagar-seth'], severin: ['Starosta', 'Voivode'] };
const LEADER_NAMES = {
  cantons: ['Tobin', 'Marta', 'Hesketh', 'Wynn', 'Ada', 'Corran', 'Elsie', 'Pell'],
  aurum: ['Roderick', 'Isolde', 'Godfrey', 'Beatrix', 'Alaric', 'Matilda', 'Percival', 'Rosamund'],
  kathar: ['Druna', 'Vesk', 'Ottar', 'Kaela', 'Grom', 'Thessa', 'Brannoc', 'Ysra'],
  league: ['Callis', 'Opaline', 'Severin', 'Lucia', 'Marius', 'Vespera', 'Dorian', 'Celandine'],
  tianxia: ['Wei Lan', 'Zhao Ming', 'Liu Mei', 'Chen Bo', 'Xu Lian', 'Han Yu', 'Sun Qiao', 'Guo Ren'],
  suryadesh: ['Arjun', 'Meera', 'Devraj', 'Lakshmi', 'Bhima', 'Sita', 'Raghav', 'Kavita'],
  severin: ['Boris', 'Yelena', 'Dmitri', 'Olga', 'Pyotr', 'Anya', 'Vasily', 'Marfa'],
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
  if (realm === 'tianxia') cands.push('rice', 'rice', 'tea', 'silk', 'porcelain');
  if (realm === 'suryadesh') cands.push('spices', 'spices', 'cotton', 'rice');
  if (realm === 'severin') cands.push('furs', 'furs', 'timber', 'bees');
  const port = !!town.harbour;
  const seaTrades = ['fishing', 'fishing', 'shipping', 'shipping', 'salt'];
  const tradeId = port ? seaTrades[Math.floor(cellRand(i, j, 500) * seaTrades.length)] : cands[Math.floor(cellRand(i, j, 500) * cands.length)], trade = TRADES[tradeId];
  const famous = trade.famous[Math.floor(cellRand(i, j, 501) * trade.famous.length)];
  const lmIds = REALM_LANDMARKS[realm], lmId = lmIds[Math.floor(cellRand(i, j, 502) * lmIds.length)], L = LANDMARKS[lmId];
  const titles = LEADER_TITLES[realm], names = LEADER_NAMES[realm];
  const leader = `${titles[town.size === 'village' || town.size === 'town' ? 0 : 1]} ${names[Math.floor(cellRand(i, j, 503) * names.length)]}`;
  const sizeWord = town.size === 'grand' ? 'royal seat' : town.size === 'castle' ? 'castle town' : town.size;
  town.identity = { tradeId, trade, famous, landmark: { id: lmId, sprite: L.sprite, name: L.name(town, realm), lore: L.lore }, leader, sizeWord, realm, port,
    kind: sizeWord === 'royal seat' ? 'royal seat' : port ? `${trade.label} port` : `${trade.label} ${sizeWord}`,
    describe() { const tk = Object.keys(TRADES).find((k) => TRADES[k] === trade), T2 = TRADE_SHOP[tk], wares = Object.entries(ITEMS.consumables).concat(Object.entries(ITEMS.weapons), Object.entries(ITEMS.armor)).filter(([, it]) => it.trade === tk).map(([, it]) => it.name.toLowerCase()); return `${town.name}: ${sizeWord === 'royal seat' ? 'the' : 'a'} ${TIER_WORDS[townTier(town)]} ${this.kind} of the ${REALMS[realm].name}, known for ${famous}. ${this.landmark.name[0].toUpperCase() + this.landmark.name.slice(1)} stands in the square.${trade.deal ? ' ' + DEAL_TEXT[trade.deal] + '.' : ''}${T2 ? ` ${T2.name} by the square sells ${wares.join(', ')}.` : ''}`; } };
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
  if (deal === 'gear' && (itemKind(id) === 'weapon' || itemKind(id) === 'armor')) return 0.9;
  return 1;
}
// The town's leader stands in the square with things to say about the place.
function leaderNpc(town) {
  const I = townIdentity(town);
  const site = nearbySites(town.cx, town.cy, 1).filter((st) => !st.deep).sort((a, b) => cheb(a, { x: town.cx, y: town.cy }) - cheb(b, { x: town.cx, y: town.cy }))[0];
  const place = nearbyPlaces(town.cx, town.cy, 1).sort((a, b) => cheb(a, { x: town.cx, y: town.cy }) - cheb(b, { x: town.cx, y: town.cy }))[0];
  const lines = [
    { tianxia: `Welcome to ${town.name}, under the mandate of Heaven and the eye of the Empress. We are a ${I.trade.label} ${I.sizeWord}, known for ${I.famous}, and our paperwork is in order.`, suryadesh: `Welcome to ${town.name}, under the Sun and the Maharani. We are a ${I.trade.label} ${I.sizeWord}, known for ${I.famous}. Pilgrims eat free; everyone else eats well.`, severin: `Welcome to ${town.name}, under the Tsar and the snow. We are a ${I.trade.label} ${I.sizeWord}, known for ${I.famous}. Shut the door behind you.` }[town.realm] || `Welcome to ${town.name}. We are a ${I.trade.label} ${I.sizeWord}, and folk come from all over for ${I.famous}.`,
    `Have you seen ${I.landmark.name}? ${I.landmark.lore}`,
    townLore(town),
  ];
  if (site) lines.push(`${site.name.startsWith('The ') ? site.name : 'The ' + site.name} lies ${compassWord(site.x - town.cx, site.y - town.cy).toLowerCase()} of here. ${site.danger >= 3 ? 'Folk who go in there do not always come out.' : 'Our young ones dare each other to go in.'}`);
  if (place) lines.push(`If you are walking ${compassWord(place.x - town.cx, place.y - town.cy).toLowerCase()}, look out for ${place.name}.`);
  if (I.trade.deal) lines.push(`${DEAL_TEXT[I.trade.deal]}. Tell them ${I.leader} sent you.`);
  if (town.harbour) lines.push(`Our harbour is ${compassWord(town.harbour.dx, town.harbour.dy).toLowerCase()} of the square. The harbourmaster on the pier sells passage to any port on the sea, for those who would rather not walk the bridges.`);
  return { sprite: FAR_REALMS.includes(I.realm) ? farSprite('elder', I.realm) : I.realm === 'league' ? 'merchant' : I.realm === 'aurum' ? 'guard' : 'elder', name: `${I.leader} of ${town.name}`, lines, leader: true };
}
// ---------- what gives each town its character ----------
// A history read from the town's own name, syllable by syllable, and one notable
// local whose story ties the town's name, realm and trade to the larger tale.
const NAME_LORE = {
  cantons: {
    pre: { Ash: 'the ash grove the first settlers burned for charcoal', Bar: 'the barrow of a chieftain nobody remembers', Cal: 'Cal the Wanderer, who stopped here when his boots wore through', Dun: 'the dun hill it sits on', El: 'an elder tree that stood until the great storm', Fen: 'the fen it was drained from', Gar: 'the spear-garrison that once guarded the old road', Hol: 'the hollow oak the founders slept in', Ist: "an old word for 'east', from when this was the edge of the known world", Kel: 'the spring, kel in the old tongue, that never freezes', Lor: 'Lor the Lawgiver, who wrote the first canton charter', Mor: 'the moor it was carved out of', Nor: 'its founders, who came down from the north', Ost: 'its founders, who came from the east', Pem: 'the Pem family, whose descendants still argue at council', Quil: 'the reed quills its scribes were famous for', Rav: 'the ravens that roost in its roofs', Sil: 'the silver birches along the brook', Tor: 'the tor above the town', Ul: "Ul the Dyer, whose blue cloth made the town's first fortune", Vel: 'the veil of mist that lies on it every autumn morning', Wyn: 'Wyn the Miller, who built the first mill', Bre: 'the brewhouse that stood here before the houses', Cor: 'the stone ring, cor, that stood where the square is now', Dra: 'the dragon a shepherd swore he saw, three hundred years ago', Ever: 'the evergreens that shelter it from the wind', Glen: 'the glen it sits in', Har: "the hare on the founders' banner", Lin: 'the flax, lin, its weavers once spun', Thorn: 'the blackthorn hedge that was its first wall' },
    mid: { wood: 'the wood that once covered the valley', stone: 'the standing stone the founders hauled into the square', water: 'the spring in the square', oak: 'the moot oak', ash: 'the ash grove', ling: 'the heather, ling, on the hills' },
    suf: { bury: 'the earthwork, bury, its first families huddled behind', ford: 'the ford where the river could be crossed', gate: 'the toll-gate on the old road', haven: 'the shelter it gave travellers in the Sundering', holm: 'the river island it began on', mere: 'the mere whose fish fed the first settlers', moor: 'the moor around it', ton: 'the fenced farm, ton, it grew from', vale: 'the vale it lies in', wick: 'the dairy farm, wick, at its heart', worth: 'the enclosed homestead, worth, of its founder', by: 'the farmstead, by, of its founder', stead: 'the single steading it began as', bridge: 'the bridge that made it a market', march: 'its place on the old border between realms', field: 'the open field the first fair was held on', cross: 'the crossroads it guards', fall: 'the waterfall that turned its first mill', hollow: 'the hollow it hides in', rest: 'the resting place where pilgrims stopped' },
  },
  aurum: {
    pre: { King: 'a king who slept here once and liked the beds', Crown: 'the crown lands it was built on', Lion: 'the lion on the royal arms', Rose: 'the rose gardens of Queen Isolde the Wise', Silver: 'the silver mine that paid for its walls', High: 'its place on the high road', Fair: 'the fair the first king chartered', Bright: 'the beacon fire kept burning on its hill', Royal: 'the royal charter nailed to the hall door', Swan: 'the swans the queen set loose on its river', Hart: 'the white hart that led a hunting king here', Gilden: 'the gilded roof of its first chapel' },
    mid: {},
    suf: { ford: 'the ford where the river could be crossed', mere: 'the lake it stands beside', crest: 'the ridge it crowns', hall: 'the hall the first lord raised', keep: 'the keep that held the road', bridge: 'the bridge the king built', haven: 'the refuge it gave in the War of Four Banners', ward: 'the ward it kept over the border', gate: 'the gate of the old kingdom', more: 'the moorland around it', leigh: 'the clearing, leigh, in the royal forest' },
  },
  kathar: {
    pre: { "Ka'": "the clan-mother Ka'ra, first of her line", Ur: "ur, the old word for 'first fire'", Dro: 'Dro the Tall, who wrestled a bear on this spot', Gor: 'the gorge it stands above', Thak: 'the war-drum, thak, beaten here before every raid', Vrel: 'the river Vrel', Mok: 'the mok, the stubborn goats that graze its slopes', Zan: 'Zan the Seer, who dreamed its founding', Kesh: 'kesh, the salt the clans trade', Ruk: 'the ruk, the hawk on the clan banner', Ost: 'its founders, who came from the east', Grom: "Grom Stonehand, the chieftain's grandfather" },
    mid: {},
    suf: { gar: "gar, 'hearth' in the old tongue", thul: "thul, 'stone'", mok: 'the goat pens', dun: 'the dun, the earthen fort', rak: "rak, 'wall'", kesh: 'the salt pans', tor: 'the tor', zar: "zar, 'meeting-place'", vek: "vek, 'ford'", nag: "nag, 'high'" },
  },
  league: {
    pre: { Gold: 'the gold that was first counted here', Silver: 'the silver that paid for its charter', Coin: 'the first mint of the League', Amber: 'the amber traders from over the sea', Ivory: 'the ivory the Orlov house made its fortune in', Velvet: 'the velvet its tailors wove', Pearl: 'the pearl divers who founded it', Gilt: 'the gilt sign of its first bank', Opal: 'the opal mines in the hills', Saffron: 'the saffron fields that made its first magnates', Marble: 'the marble quarry', Ledger: "the great ledger in which every house's debts are kept" },
    mid: {},
    suf: { spire: 'the spire of its counting-house', port: 'its harbour', market: 'the market the League chartered', mint: 'its mint', vault: 'the vault under the exchange', haven: 'the haven it gave to ships', reach: 'its reach of river', quay: 'its quay', court: "the merchants' court", gate: 'its toll-gate' },
  },
  tianxia: {
    pre: { Jin: 'the gold, jin, the first magistrate found in its river', Lin: 'the forest, lin, it was cut from', Hua: 'the flowering plum trees, hua, of its first garden', Tian: 'heaven, tian, whose mandate its founder claimed', Shen: 'the spirit, shen, of the mountain above it', Long: 'the dragon, long, that is said to sleep under its hill', Bai: 'the white, bai, walls of its first fort', Yun: 'the clouds, yun, that sit on its roofs each morning', Feng: 'the wind, feng, that never stops on its plain', Ming: 'the brightness, ming, of its lanterns at festival', Qing: 'the clear, qing, water of its canal', Lu: 'the deer, lu, that grazed its first fields' },
    mid: {},
    suf: { zhou: 'zhou, a prefecture of the Empire', jing: 'jing, a capital, for it was one under an older dynasty', an: 'an, peace, which its charter promised', yang: 'yang, the sunny side of the river it stands on', cheng: 'cheng, its wall', he: 'he, the river', shan: 'shan, the mountain', kou: 'kou, the mouth of the valley', ling: 'ling, the ridge', men: 'men, the gate on the imperial road' },
  },
  suryadesh: {
    pre: { Surya: 'Surya, the sun, whose line the Maharani claims', Chandra: 'the moon, chandra, that lit its founding', Ratna: 'the jewels, ratna, its first raja wore', Vijaya: 'the victory, vijaya, won on its plain', Nila: 'the blue, nila, of its river', Kamal: 'the lotus, kamal, of its tank', Indra: 'Indra, lord of storms, whose temple stands here', Deva: 'the gods, deva, who were said to walk here', Padma: 'the lotus, padma, of its stepwell', Hari: 'Hari the preserver, in whose name it was founded', Amba: 'the mother goddess, Amba, of its shrine', Mani: 'the gem, mani, its traders dealt in' },
    mid: {},
    suf: { pur: 'pur, a town', nagar: 'nagar, a city', kot: 'kot, its fort', garh: 'garh, its citadel', vati: 'vati, the garden it was', puram: 'puram, a temple town', ghat: 'ghat, the steps down to its river', pura: 'pura, a walled town', giri: 'giri, its hill', sagar: 'sagar, the great tank of water at its heart' },
  },
  severin: {
    pre: { Novo: 'novo, new, for it was built after the old town burned', Belo: 'belo, white, for its stone church', Krasno: 'krasno, beautiful, or red, the boyars never agreed', Zlato: 'zlato, the gold of its onion dome', Vysoko: 'vysoko, high, on its bluff above the river', Staro: 'staro, old, older than the Tsardom', Volko: 'volk, the wolves that circled its first winter', Sever: 'sever, the north', Cherno: 'cherno, black, for the soil or the forest', Sveto: 'sveto, holy, for the hermit who lived here', Dobro: 'dobro, good, the land that fed it', Morozo: 'moroz, the frost that is its oldest neighbour' },
    mid: {},
    suf: { grad: 'grad, a town with walls', gorsk: 'gorsk, of the hills', slav: 'slav, glory', pol: 'pol, its field', vsk: 'the river it was named for', yarsk: 'the trading post, yar, it began as', vo: 'the village it still mostly is', zero: 'ozero, its lake', vka: 'the little river it sits on', borsk: 'bor, its pine forest' },
  },
};
const CAPITAL_LORE = {
  '0,0': 'Hearth was the first hearth lit after the Sundering: a camp of refugees around one fire, which became a town because nobody could agree on where else to go. The Free Cantons were born from that argument.',
  '3,-1': 'Castle Aurum has been the seat of kings since Aurel the Founder laid the crown on its cushion. Its walls have never been taken, though its hall has seen two brothers at war. Two rings of wall guard it now, the inner one raised after the War of Four Banners, and the servants whisper of ways through the thickness of the stone: a treasury walled up and forgotten, and a postern the old Queen used to slip out unseen.',
  '-3,2': "Kar Thuldun, 'the stone hearth', was raised around the Ever-Fire where the first clans swore peace with each other. The fire has not gone out since.",
  '-2,-3': 'Goldspire was a counting-house before it was a town. The merchant houses built the spire first, so that debts could be seen from the road.',
  '11,-2': 'Jinling, the Gold Hill, has held the Jade Throne through four dynasties. Its examination halls take in ten thousand candidates every spring and send out a hundred magistrates, and the city is run, the saying goes, by whoever wrote the best essay.',
  '11,2': 'Suryapur, the City of the Sun, climbs from its great stepwell to the Maharani\'s palace in nine terraces, one for each of its gates. Elephants are stabled at the second and the spice bazaar never closes.',
  '0,-10': 'Hrafnvik, the raven bay, is the last village before the ice: forty souls, a pier, a church with a stove, and a gate in the hill behind it that the sagas say leads to Midgard, the middle earth of the old world. The villagers do not go up the hill. The ravens do.',
  '16,0': 'Vysokograd, the High Town, sits on a bluff above the frozen river behind log walls three trees thick. The Tsar\'s terem glitters with painted domes, and the bears in the market are, mostly, tame.',
};
function townLore(town) {
  if (CAPITAL_LORE[town.key]) return CAPITAL_LORE[town.key];
  const realm = town.realm || 'cantons', L = NAME_LORE[realm], [A, M, B] = REALM_NAMES[realm] || [SYL_A, SYL_M, SYL_B];
  const h = hash32(town.i * 7919, town.j * 104729, 4242);
  const pre = A[h % A.length], mid = M[Math.floor(h / 64) % M.length], suf = B[Math.floor(h / 4096) % B.length];
  const parts = [L.pre[pre], L.mid[mid], L.suf[suf]].filter(Boolean);
  const tier = townTier(town), I = townIdentity(town);
  const age = ['was founded within living memory', 'is two hundred years old', 'was old when the Sundering came', 'has stood since the Age of the Crown'][Math.floor(cellRand(town.i, town.j, 810) * 4)];
  const fortune = tier === 0 ? `It has known better days: the ${I.trade.label} trade has thinned and the roofs want mending.` : tier === 1 ? `It gets by on its ${I.trade.label}, and asks for little.` : tier === 2 ? `Its ${I.trade.label} keeps it comfortable.` : `The ${I.trade.label} trade has made it rich, and it likes everyone to know.`;
  return `${town.name} takes its name from ${parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]}. It ${age}. ${fortune}`;
}
const NOTABLE_NAMES = {
  cantons: ['Old Garrick', 'Mother Wenna', 'Tobias Finch', 'Agnes Reed', 'Piet the Younger', 'Hesper Dale', 'Jonas Carrow', 'Lissa Wold', 'Bram Tuckett', 'Mab Fenner', 'Old Corran', 'Tilly Ashdown', 'Rufus Pell', 'Nan Hollis', 'Abel Thorne', 'Greta Wick'],
  aurum: ['Sir Oswin (retired)', 'Lady Maud', 'Benedict Hale', 'Cecily Ward', 'Old Anselm', 'Mathilde Crane', 'Roland the Lame', 'Edith Marlow', 'Dame Ottilie', 'Gervase Hart', 'Old Piers', 'Rosalind Fay', 'Hugh Lanyon', 'Isolde Vane', 'Brother Aldous', 'Joan Carver'],
  kathar: ['Old Vorna', 'Brak One-Eye', 'Tessaly', 'Grim Ulfar', 'Nessa Brightspear', 'Korrin', 'Mother Halla', 'Drenn the Quiet', 'Ysra Stonehand', 'Orm Redbeard', 'Kaela Wolfsong', 'Old Thurn', 'Brenna Hawk', 'Varl Ironfoot', 'Sela Nightwind', 'Gorm the Elder'],
  league: ['Magister Pell', 'Lucrezia Vane', 'Old Bartolo', 'Serena Oake', 'Cassius Mint', 'Widow Orsini', 'Fennimore', 'Dorothea Glass', 'Aurelio Spark', 'Beatrice Coin', 'Old Marcello', 'Vittoria Quill', 'Lorenzo Fane', 'Clara Ledger', 'Ambrose Dell', 'Petra Silverhand'],
  tianxia: ['Old Scholar Fang', 'Widow Lin', 'Master Wu the Cook', 'Grandmother Shen', 'Teahouse Zhang', 'Lady Hua Yan', 'Old Captain Lu', 'Sister Mei', 'Blind Li', 'Auntie Qing', 'Ferryman Guo', 'Dr Chen', 'Young Tian', 'Mother Yun', 'Uncle Bai', 'Scribe Feng'],
  suryadesh: ['Old Rani Devi', 'Pandit Harish', 'Mother Amba', 'Gopal the Mahout', 'Widow Sarla', 'Guru Bhaskar', 'Kamala of the Well', 'Old Vishnu', 'Sister Meenakshi', 'Ravi the Potter', 'Auntie Lata', 'Dancer Padma', 'Old Thakur Singh', 'Nurse Anjali', 'Beggar-king Kishan', 'Spice-wife Rukmini'],
  severin: ['Old Grandfather Frost', 'Babushka Vera', 'Deacon Ilya', 'Widow Katya', 'Blacksmith Oleg', 'Mother Agafya', 'One-armed Grisha', 'Sister Zoya', 'Old Ivan Bearkeeper', 'Nurse Nadia', 'Fisherman Lev', 'Aunt Praskovya', 'Scribe Fyodor', 'Young Sasha', 'Old Matrona', 'Trapper Yegor'],
};
// Twelve kinds of notable, each with a story told in three lines.
const NOTABLES = [
  { id: 'veteran', role: 'an old soldier', sprite: 'guard', lines: (c) => [
    `"Forty years in the watch of ${c.town}. I buried three captains and outdrank four. Now I sit by ${c.landmark} and tell the young ones they have it easy."`,
    c.storyTie,
    `"When you go into ${c.site}, keep your back to a wall. That is all the wisdom I have, and it cost me a knee."`] },
  { id: 'widow', role: 'who keeps a lamp in the window', sprite: 'villager', lines: (c) => [
    `"The one I married went into ${c.site} eleven years ago, for the gold. I keep a lamp in the window. People in ${c.town} think I am foolish. People in ${c.town} did not know my Wren."`,
    `"${c.leader} offered to have the lamp taken down, for the look of the place. I told ${c.leaderThem} where to put the ladder."`,
    c.storyTie] },
  { id: 'returned', role: 'the only one who came back', sprite: 'farmer', lines: (c) => [
    `"I went down ${c.site} once, with five friends. I came back with this limp and enough gold to buy the ${c.trade} yard. Nobody else came back at all."`,
    `"${c.town} calls me lucky. I have stopped correcting them."`,
    c.storyTie] },
  { id: 'witness', role: 'the child who saw the lights', sprite: 'child', lines: (c) => [
    `"The night the crown broke I was awake, up on ${c.landmark}. Five lights went up over the hills, like falling stars going the wrong way. Nobody in ${c.town} believed me until the dungeons woke."`,
    `"One of them came down near ${c.site}. I could show you, but Ma says I am not to go past the gate."`,
    c.storyTie] },
  { id: 'scholar', role: 'a scholar the library threw out', sprite: 'elder', lines: (c) => [
    `"The library at Goldspire dismissed me for writing that the Deep dreams. Then the crown broke. I came to ${c.town} because nobody here has read my book, which is restful."`,
    `"${c.lore}"`,
    c.storyTie] },
  { id: 'bard', role: 'the town bard', sprite: 'villager', lines: (c) => [
    `"Every town has a founding song. ${c.town}'s is in a key nobody can sing. Here is the gist: ${c.lore}"`,
    `"I wrote a verse about ${c.leader} once. I am no longer welcome at the ${c.leaderPlace}."`,
    c.storyTie] },
  { id: 'tradesman', role: 'the loudest voice in the trade', sprite: 'merchant', lines: (c) => [
    `"${c.famous[0].toUpperCase() + c.famous.slice(1)}? Mine. Everything ${c.town} is known for comes out of my yard, and ${c.leader} taxes it like it grew on trees."`,
    `"Beasts on the road are bad for trade. The watch does its best. Its best is ${c.guard}."`,
    c.storyTie] },
  { id: 'pilgrim', role: 'a pilgrim who never left', sprite: 'elder', lines: (c) => [
    `"I set out for ${c.place} forty years ago and got as far as ${c.town}. It seemed far enough. The stones will keep."`,
    `"${c.lore}"`,
    c.storyTie] },
  { id: 'greycloak', role: 'a stranger in a grey cloak', sprite: 'necromancer', lines: (c) => [
    `"I served a prince once. Grey cloak, silver stag. I do not talk about it, and ${c.town} has the decency not to ask."`,
    c.edricTie,
    `"If you see riders with a stag on their cloaks, ride the other way. Or do not. You look like you can handle yourself."`] },
  { id: 'healer', role: 'the healer who tends the watch', sprite: 'innkeeper', lines: (c) => [
    `"I have stitched every member of the ${c.town} watch at least twice. ${c.guard} is my best customer. Say nothing of it to them."`,
    `"Potions help, but so does not going into ${c.site} with a head cold. Rest first. The inn is cheap and I am not."`,
    c.storyTie] },
  { id: 'prophet', role: 'who says the Deep is waking', sprite: 'elder', lines: (c) => [
    c.lairTie,
    `"They laughed in ${c.town} when I said the ground was dreaming. Put your ear to ${c.landmark}. Go on. Tell me it is not breathing."`,
    c.deepTie,
    `"Five lights held it down. Five! And one of them in ${c.site}, or near enough. I have maps. Nobody looks at my maps."`] },
  { id: 'orphan', role: 'who lost a farm to the orcs', sprite: 'child', lines: (c) => [
    `"The orcs from ${c.camp} burned our farm when I was small. ${c.town} took me in. ${c.leader} says the watch will deal with the camp one day. One day is a long time."`,
    `"I am going to be a hero like you. I am saving for a sword. I have four copper and a button."`,
    c.storyTie] },
];
function storySiteNear(town) {
  let best = null, bd = 9;
  for (const id of STORY_ORDER) { const S = STORY_SITES[id]; const d = Math.max(Math.abs(S.i - town.i), Math.abs(S.j - town.j)); if (d < bd) { bd = d; best = id; } }
  return bd <= 2 ? best : null;
}
const FAR_NOTABLES = {
  tianxia: [
    { id: 'examiner', role: 'a retired examiner', sprite: 'elder:tianxia', lines: (c) => [`"Forty years I read essays in ${c.town}. Ten thousand a spring. I can tell a liar by his brushwork, and I can tell you the Hollow King is not a story."`, c.hollowTie, `"The magistrate at the ${c.leaderPlace} is one of mine. Second class, third year. Adequate. Tell ${c.leader} I said so."`] },
    { id: 'junkcaptain', role: 'an old junk captain', sprite: 'merchant:tianxia', lines: (c) => [`"I sailed to the edge of the Veil every year of my life from ${c.town}, and every year it threw me back. Then one morning it was not there. I wept. I am not ashamed."`, c.hollowTie, `"${c.site[0].toUpperCase()}${c.site.slice(1)} is where the inland folk lose their sons. Go careful, and go in daylight."`] },
    { id: 'lanternmaker', role: 'a lantern-maker', sprite: 'villager:tianxia', lines: (c) => [`"One lantern for every ancestor of ${c.town} at the festival. I have made them for thirty years. This year some of the ancestors came to collect theirs in person."`, c.hollowTie, `"${c.landmark[0].toUpperCase()}${c.landmark.slice(1)} is where we hang the first lantern. ${c.lore}"`] },
  ],
  suryadesh: [
    { id: 'mahout', role: "the Maharani's old mahout", sprite: 'villager:suryadesh', lines: (c) => [`"I taught the Maharani to ride before she could walk, and her elephant before it could stand. ${c.town} still feeds the elephant. The Maharani feeds herself."`, c.hollowTie, `"Walk the nine gates if you can. ${c.landmark[0].toUpperCase()}${c.landmark.slice(1)} is the oldest thing in ${c.town}, and it has seen worse than you."`] },
    { id: 'templedancer', role: 'a temple dancer, retired', sprite: 'innkeeper:suryadesh', lines: (c) => [`"Every step of the dance is a letter and every dance is a prayer. The one for the Lotus takes nine hours. I did it once, in ${c.town}, for a king who fell asleep."`, c.hollowTie, `"${c.site[0].toUpperCase()}${c.site.slice(1)} used to have a shrine at its mouth. The spiders took it. Pilgrims take the long way now."`] },
    { id: 'stepwellkeeper', role: 'the stepwell keeper', sprite: 'elder:suryadesh', lines: (c) => [`"A hundred and eight steps down to the water in ${c.town}, and I sweep every one. The water has been cold a thousand years. Lately it has been colder."`, c.hollowTie, `"The ${c.trade} trade keeps us. ${c.famous[0].toUpperCase()}${c.famous.slice(1)}, if you are buying."`] },
  ],
  severin: [
    { id: 'bearkeeper', role: "the Tsar's old bearkeeper", sprite: 'villager:severin', lines: (c) => [`"Forty bears I raised for the Tsar, and every one of them nicer than a boyar. ${c.town} still sends him cubs. He sends back vodka."`, c.hollowTie, `"${c.site[0].toUpperCase()}${c.site.slice(1)} is where the taiga keeps its dead. It keeps them badly, lately. They get out."`] },
    { id: 'iconpainter', role: 'an icon-painter', sprite: 'elder:severin', lines: (c) => [`"Gold leaf, egg and earth. I have painted every saint of ${c.town}, and the Hollow King once, so the children would know what not to pray to."`, c.hollowTie, `"${c.landmark[0].toUpperCase()}${c.landmark.slice(1)}: I painted the inside. ${c.lore}"`] },
    { id: 'streltsy', role: 'a retired streltsy', sprite: 'guard:severin:guard', lines: (c) => [`"Thirty winters in the Tsar's guard, and ${c.town} is the first place I have been warm. Mostly the stove. Partly the vodka."`, c.hollowTie, `"${c.camp[0].toUpperCase()}${c.camp.slice(1)} is where the orcs winter. Burn it before the snow, or they burn the granary after."`] },
  ],
};
function notableNpc(town) {
  if (town.notable) return town.notable;
  const I = townIdentity(town), realm = town.realm || 'cantons';
  const pool = FAR_NOTABLES[realm] || NOTABLES.filter((n) => !(n.id === 'greycloak' && realm === 'kathar'));
  const N = pool[Math.floor(cellRand(town.i, town.j, 800) * pool.length)];
  // a name no other town within two cells uses, so neighbours never share a notable
  const names = NOTABLE_NAMES[realm];
  const taken = new Set();
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const o = townAt(town.i + di, town.j + dj); if (o && o.notable) taken.add(o.notable.name); }
  let idx = Math.floor(cellRand(town.i, town.j, 801) * names.length), name = names[idx];
  for (let k = 0; k < names.length && taken.has(name); k++) name = names[(idx + 1 + k) % names.length];
  const at = { x: town.cx, y: town.cy };
  const site = nearbySites(town.cx, town.cy, 1).filter((st) => !st.deep).sort((a, b) => cheb(a, at) - cheb(b, at))[0];
  const place = nearbyPlaces(town.cx, town.cy, 1).sort((a, b) => cheb(a, at) - cheb(b, at))[0];
  const camp = campsNear(town.cx, town.cy, 2)[0];
  const sid = storySiteNear(town), S = sid && STORY_SITES[sid];
  const guards = townNpcs(town).filter((n) => n.type.guard);
  const storyTie = S ? {
    dawn: `"${S.title} is a day's walk from here. The sisters who prayed there used to buy candles in ${town.name}. Then one year they stopped coming, and the candle-maker never asked why."`,
    tides: `"Fishermen from ${town.name} will not go near ${S.title}. The water there sings, they say, and the ones who listen too long row out and do not row back."`,
    bones: `"The kings of Aurum lie in ${S.title}, and the old folk of ${town.name} say that on still nights you can hear them turning over. Lately the nights have not been still."`,
    embers: `"The ground is warm for a mile around ${S.title}. ${town.name} grows winter vegetables in the open because of it. We do not talk about what else grows down there."`,
    stars: `"You can see the top of ${S.title} from the hill above ${town.name} on a clear night, and sometimes a light in it. The wizard who built it bought a star, they say. I think he is still paying."`,
  }[sid] : `"${town.name} is a long way from anything in the old songs, and we like it that way. Whatever broke the crown, it broke it somewhere else."`;
  const edricTie = story().phase === 'done' ? `"The prince is pardoned now, I hear. Sitting in his brother's hall. Good for him. Some of us are still in grey cloaks with nowhere to sit."` : story().ch >= 2 ? `"He was not always what he became. He was the clever one, the elder by an hour, and he never forgave the hour."` : `"Ask me again when you know who you are hunting. You will."`;
  const deepTie = story().phase === 'done' ? `"The gate is open now, between Hearth and the castle. I told them. I told them for thirty years."` : `"There is a gate in the hills between Hearth and Castle Aurum that is not on any map. It will be, soon."`;
  const c = {
    town: town.name, landmark: I.landmark.name, trade: I.trade.label, famous: I.famous, leader: I.leader, leaderThem: 'them',
    leaderPlace: { kathar: 'longhouse', league: 'exchange', aurum: 'keep', tianxia: 'yamen', suryadesh: 'durbar hall', severin: 'terem' }[realm] || 'council hall',
    site: site ? (site.name.startsWith('The ') ? site.name.replace(/^The /, 'the ') : 'the ' + site.name) : 'the dungeon under the square',
    place: place ? place.name : 'the standing stones', camp: camp ? camp.name : 'the hills', guard: guards.length ? guards[0].type.name : 'the militia',
    lore: townLore(town), storyTie, edricTie, deepTie,
    hollowTie: (player && player.meta && story2().s >= 3) ? '"The Barrow is quiet now, and the dead stay down. Whoever did that, they say it was a fool from over the sea. I would buy that fool a drink."' : (player && player.meta && story2().s === 2) ? '"The mountain split last week. We all felt it. The keys are gathered, they say, and some fool from over the sea is going to walk down the thousand steps with them. Good luck to the fool."' : '"The dead walk the roads in step and the Barrow breathes at night. Our founders locked the Hollow King under the mountain with three keys. The three crowns have them. I hope they remember where."',
    lairTie: (() => { const near = LAIR_IDS.map((id) => ({ id, s: siteAt(LAIRS[id].i, LAIRS[id].j) })).sort((a, b) => Math.hypot(a.s.x - town.cx, a.s.y - town.cy) - Math.hypot(b.s.x - town.cx, b.s.y - town.cy))[0]; return `"And there is worse than the Deep, closer to home. ${LAIRS[near.id].title[0].toUpperCase() + LAIRS[near.id].title.slice(1)} lies ${compassWord(near.s.x - town.cx, near.s.y - town.cy).toLowerCase()} of ${town.name}. ${LAIRS[near.id].lore}"`; })(),
  };
  town.notable = { sprite: N.sprite, name, role: N.role, lines: N.lines(c), notable: true, tell: 0 };
  return town.notable;
}
// ---------- the harbour ----------
const HARBOUR_NAMES = ['Old Salt Maggs', 'Captain Reyes', 'Harbourmaster Finn', 'Mother Carrack', 'Captain Oduya', 'Harbourmaster Lusk', 'Tam Longboat', 'Captain Vashti'];
function harbourmasterNpc(town) {
  const pool = FAR_HARBOUR_NAMES[town.realm] || HARBOUR_NAMES, nm = pool[Math.floor(cellRand(town.i, town.j, 850) * pool.length)];
  return { sprite: farSprite('innkeeper', town.realm), name: `${nm} of ${town.name}`, action: 'harbour', lines: ['Passage to any port on this sea, and the next one, for a fair fare. The bridges are for people with time.', 'Mind the gulls. They have taken a whole pie off a knight before now.'], harbour: true };
}
function portsNear(town, reach = 4) {
  const out = [];
  for (let i = town.i - reach; i <= town.i + reach; i++) for (let j = town.j - reach; j <= town.j + reach; j++) { const t = townAt(i, j); if (t && t.harbour && t.key !== town.key) out.push(t); }
  return out.sort((a, b) => Math.hypot(a.cx - town.cx, a.cy - town.cy) - Math.hypot(b.cx - town.cx, b.cy - town.cy));
}
const fareTo = (from, to) => { const f = 15 + Math.round(Math.hypot(to.cx - from.cx, to.cy - from.cy) / 9); return wearing('jadeseal') ? Math.ceil(f / 2) : f; };
function sailTo(from, to) {
  const cost = fareTo(from, to);
  if (player.gold < cost) return;
  player.gold -= cost;
  const distance = Math.round(Math.hypot(to.cx - from.cx, to.cy - from.cy));
  closeShop();
  const H = to.harbour;
  player.x = H.x; player.y = H.y; player.wx = player.x; player.wy = player.y;
  turn += Math.round(distance / 3);
  refreshTownContext(); afterSceneChange();
  if (!player.meta.visited.includes(to.key)) player.meta.visited.push(to.key);
  burst(player.x, player.y, '#9fd4ff', 30, 100, { glow: true, gravity: -60, life: 900 });
  sfx.play('stairs'); unlock('sailor');
  track('sea_travel', { cost });
  log(`You take ship from ${from.name}. ${Math.round(distance / 3)} turns of grey water later you step onto the pier at ${to.name}.`, 'good');
  saveProgress('progress');
}
// ---------- monuments heroes build for each other ----------
// Every square has building plots. Heroes pay at an inn to build a monument on
// one, or to upgrade one that stands; the server keeps them, so every hero sees
// and can use them. Each hero can use each monument once every 20 minutes.
const BUILD = (window.DUNGEON && window.DUNGEON.buildings) || { slots: 3, costs: [300, 600, 1200], types: {} };
const PLOT_SPOTS = [[6, -2], [-6, 2], [6, 2]];
const PLOT_NAMES = ['north-east', 'south-west', 'south-east'];
const MONUMENT_SPRITES = { fountain: 'herofountain', shrine: 'valorshrine', cache: 'cache', beacon: 'beacon' };
const MONUMENT_COOLDOWN_MS = 20 * 60 * 1000;
// Castle Aurum's secrets, in local coordinates: the old treasury walled up in the
// outer bailey, and the Queen's postern, a hidden way straight through both rings.
const GRAND_TREASURY = { x: 3, y: 2 };
const GRAND_SECRETS = [
  { lx: 7, ly: 4, name: 'the walled-up treasury', found: 'A loose stone turns under your hand and a section of wall swings inward on oiled hinges. A chamber nobody has entered in a lifetime.' },
  { lx: 51, ly: 30, name: "the Queen's postern", found: 'You lean on a worn patch of stone and it gives. A narrow door in the inner wall, cut for someone who did not want to be seen leaving.' },
  { lx: 58, ly: 30, name: "the Queen's postern", found: 'A crack of daylight behind a hanging of ivy: the postern runs clean through the outer wall and out into the fields.' },
];
const secretsFound = () => (player && player.meta) ? (player.meta.secrets || (player.meta.secrets = [])) : [];
function grandSecret(town, lx, ly) {
  if (town.size !== 'grand') return null;
  const sec = GRAND_SECRETS.find((s) => s.lx === lx && s.ly === ly);
  return sec ? { ...sec, open: secretsFound().includes(key(town.x0 + lx, town.y0 + ly)) } : null;
}
function revealSecret(town, sec, x, y) {
  secretsFound().push(key(x, y));
  setTile(x, y, TILE.FLOOR); setGround(x, y, GROUND.COBBLE); bgDirty = true; mapCache.ox = null;
  shakeScreen(3); sfx.play('quest'); burst(x, y, '#d9c17a', 18, 80, { glow: true, gravity: -40, life: 700 });
  log(`${sec.found} You have found ${sec.name}.`, 'good');
  const all = GRAND_SECRETS.every((s) => secretsFound().includes(key(town.x0 + s.lx, town.y0 + s.ly)));
  unlock(sec.lx === GRAND_TREASURY.x + 4 ? 'vault' : 'postern');
  if (all) log('You know every secret of Castle Aurum now. The steward would be appalled.', 'good');
  track('secret_found', { name: sec.name }); updateStats(); saveProgress('progress'); draw();
}
function openTreasury(x, y) {
  player.meta.looted.push(key(x, y)); setTile(x, y, TILE.FLOOR); bgDirty = true;
  const gold = Math.round((500 + rnd(200)) * goldMult());
  player.gold += gold; floatText(x, y, `+${gold}g`, '#f5c542'); sfx.play('win');
  burst(x, y, '#ffd86b', 30, 120, { glow: true, gravity: 120, life: 800, rise: 140 });
  log(`An iron-bound chest under a century of dust: ${gold} gold in old royal coin.`, 'good');
  const up = upgradeFor(Math.random() < 0.5 ? 'weapon' : 'armor');
  if (up && !bagFull()) { player.bag.push(up); log(`Beneath the coin, oiled and wrapped: a ${itemInfo(up).name} of the old King's own.`, 'good'); }
  if (player.gold >= 1000) unlock('rich');
  track('treasury_opened'); updateStats(); saveProgress('progress');
}
function setGround(x, y, g) {
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), ch = getChunk(cx, cy);
  if (ch.ground) ch.ground[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] = g;
}
const plotSlot = (town, x, y) => PLOT_SPOTS.slice(0, BUILD.slots).findIndex(([dx, dy]) => x === town.cx + dx && y === town.cy + dy);
const townBuildings = new Map();   // town key -> { at, list }
const buildingAt = (town, slot) => { const e = townBuildings.get(town.key); return e ? e.list.find((b) => b.slot === slot) || null : null; };
async function fetchBuildings(keys, force = false) {
  if (!ACCOUNT.buildingsUrl) return;
  const now = performance.now();
  const want = keys.filter((k) => force || !townBuildings.has(k) || now - townBuildings.get(k).at > 60000);
  if (!want.length) return;
  for (const k of want) if (!townBuildings.has(k)) townBuildings.set(k, { at: now, list: [] }); else townBuildings.get(k).at = now;
  try {
    const r = await fetch(`${ACCOUNT.buildingsUrl}?towns=${encodeURIComponent(want.join('|'))}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const { buildings } = await r.json();
    for (const k of want) townBuildings.set(k, { at: now, list: buildings.filter((b) => b.town === k) });
    bgDirty = true; if (shopOpen) renderShop(); draw();
  } catch (e) { /* offline: keep what we had */ }
}
// ---------- Story 5: the rebuilding ----------
// Structures heroes sponsor at a town's leader, shared with every hero: walls, a
// building, a memorial in the square, paved roads. The server keeps them
// (town_projects); here they are applied to the generated town.
const PROJECTS = ACCOUNT.projects || {};
// where a sponsored building may stand, by town size: clear of the square and the houses a town starts with
const REBUILD_SLOTS = { village: [[2, 10, 6, 4], [32, 10, 6, 4], [2, 18, 6, 4], [32, 18, 6, 4], [12, 22, 6, 4], [22, 22, 6, 4]], town: [[1, 10, 5, 4], [34, 10, 5, 4], [1, 16, 5, 4], [34, 16, 5, 4], [20, 23, 6, 4]], city: [[0, 10, 5, 4], [35, 10, 5, 4], [0, 17, 5, 4], [35, 17, 5, 4]], castle: [[12, 22, 6, 4], [22, 22, 6, 4]], grand: [[24, 38, 6, 3], [2, 24, 5, 4], [53, 24, 5, 4]] };
const freeSlot = (town) => (REBUILD_SLOTS[town.size] || REBUILD_SLOTS.town).find(([lx, ly, w, h]) => !town.houses.some((o) => town.x0 + lx < o.x + o.w + 1 && town.x0 + lx + w + 1 > o.x && town.y0 + ly < o.y + o.h + 1 && town.y0 + ly + h + 1 > o.y)) || null;
const townProjects = new Map();   // town key -> { at, list }
const story5 = () => player.meta.story5 || (player.meta.story5 = { s: 0, n: 0 });   // 0 locked, 1 building, 2 founder
const story4Done = () => !!player && !!player.meta && story4().s >= 2;
const story5Open = () => !!player && !!player.meta && story5().s >= 1;
const FOUNDER_AT = 10;
const projectsOf = (town) => (townProjects.get(town.key) || { list: [] }).list;
const projectDone = (town, id) => projectsOf(town).find((p) => p.project === id) || null;
async function fetchProjects(keys, force = false) {
  if (!ACCOUNT.projectsUrl) return;
  const now = performance.now();
  const want = keys.filter((k) => force || !townProjects.has(k) || now - townProjects.get(k).at > 60000);
  if (!want.length) return;
  for (const k of want) if (!townProjects.has(k)) townProjects.set(k, { at: now, list: [] }); else townProjects.get(k).at = now;
  try {
    const r = await fetch(`${ACCOUNT.projectsUrl}?towns=${encodeURIComponent(want.join('|'))}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const { projects, mine } = await r.json();
    for (const k of want) townProjects.set(k, { at: now, list: projects.filter((p) => p.town === k) });
    if (player && player.meta && story5Open() && Number.isInteger(mine) && mine > (story5().n || 0)) story5().n = mine;
    for (const k of want) { const t = townAt(...k.split(',').map(Number)); if (t) applyProjects(t); }
    if (shopOpen) renderShop(); draw();
  } catch (e) { /* offline: keep what we had */ }
}
// make a town's sponsored structures real: walls, a new house, the memorial, paved roads
function applyProjects(town) {
  const list = projectsOf(town).slice().sort((a, b2) => a.project.localeCompare(b2.project));   // the same order for every hero, so buildings land in the same slots
  const sig = list.map((p) => p.project).join(',');
  if (town.projectSig === sig) return;
  town.projectSig = sig; town.projects = new Set(list.map((p) => p.project));
  if (town.baseWalled === undefined) town.baseWalled = town.walled;
  town.houses = town.houses.filter((h) => !h.sponsor); town.walled = town.baseWalled; town.memorial = null; town.paved = false;
  for (const p of list) {
    if (p.project === 'walls') town.walled = true;
    else if (p.project === 'memorial') town.memorial = p.builder;
    else if (p.project === 'road') town.paved = true;
    else if (BUILDINGS[p.project] && !town.houses.some((h) => h.id === p.project)) {
      const free = freeSlot(town);
      if (free) { const [lx, ly, w, h] = free, roof = REALM_ROOFS[town.realm]; town.houses.push({ x: town.x0 + lx, y: town.y0 + ly, w, h, id: p.project, doorX: town.x0 + lx + Math.floor(w / 2), doorY: town.y0 + ly + h - 1, town: town.key, ...BUILDINGS[p.project], ...(roof ? { roof: roof[(lx + ly) % roof.length] } : {}), sponsor: p.builder }); }
    }
  }
  // the chunks under the town (and its roads) are stamped again
  const reach = 2;
  for (let cy = Math.floor((town.y0 - 40) / CHUNK) - reach + 1; cy <= Math.floor((town.y0 + th(town) + 40) / CHUNK) + reach - 1; cy++) for (let cx = Math.floor((town.x0 - 40) / CHUNK) - reach + 1; cx <= Math.floor((town.x0 + tw(town) + 40) / CHUNK) + reach - 1; cx++) chunks.delete(key(cx, cy));
  town.identity = null; town.npcs = null; bgDirty = true; mapCache.ox = null;
  if (scene === 'world') { refreshTownContext(); if (townContaining(player.x, player.y) === town && !walkable(getTile(player.x, player.y))) { player.x = town.cx; player.y = town.cy + 3; settle(player); } placePets(); }
}
async function sponsorProject(town, id) {
  const P = PROJECTS[id]; if (!P) return;
  if (!ACCOUNT.user) { log('Create a hero (or log in) to sponsor rebuilding. What is built is shared with every hero, so it needs a name on it.', 'bad'); return; }
  if (player.gold < P.cost) return;
  try {
    const r = await fetch(ACCOUNT.projectsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf }, body: JSON.stringify({ town: town.key, project: id, gold: player.gold }) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) { log(res.message || 'The leader shakes their head. Try again in a moment.', 'bad'); await fetchProjects([town.key], true); return; }
    player.gold = res.gold;
    const e = townProjects.get(town.key) || { at: performance.now(), list: [] };
    e.list = e.list.filter((p) => p.project !== id).concat([res.project]); townProjects.set(town.key, e);
    applyProjects(town);
    story5().n = Number.isInteger(res.mine) ? res.mine : (story5().n || 0) + 1;   // the server's count is the truth
    sfx.play('win'); burst(player.x, player.y, '#ffd86b', 24, 110, { glow: true, gravity: -40, life: 800 });
    log(`${P.name} for ${town.name}: masons and carpenters set to work, and your name goes on the plinth. Structures sponsored: ${story5().n}.`, 'good');
    unlock('builder'); if (story5().n >= 3) unlock('mason');
    track('project_sponsored', { project: id });
    if (story5().n >= FOUNDER_AT && story5().s === 1) founderNamed();
    updateStats(); renderShop(); draw(); saveProgress('progress');
  } catch (e) { log('The messenger did not get through. Try again in a moment.', 'bad'); }
}
const STORY5_INTRO = [
  { who: 'The reckoning', sprite: 'elder', bg: 'town', title: 'Story 5: The Rebuilding',
    text: 'When the last rift shuts, seven realms count the cost: gates broken, watch houses burned, roads churned to mud, a watch buried in every town, and treasuries empty from the war. Every town leader keeps a list of what the town needs. And every hero who comes through the gate with gold in their purse is asked the same question.' },
  { who: 'What is needed', sprite: 'villager', bg: 'town', title: 'What is needed',
    text: 'Walls, where a town has none. A watch house, a smithy, a market hall, an apothecary, an armoury. A memorial in the square to those who fell. The roads out of town paved in stone. Talk to the leader of any town and they will show you the list. What you pay for stands for every hero who passes, with your name on it.' },
  { who: 'The builders', sprite: 'hero', bg: 'town', title: 'The builders',
    text: 'This story has no boss. Its heroes are the ones who build, and the heroes page keeps the tally. Raise ten structures across the realms and you will be named a Founder, which in the realms is the only title that lasts.' },
];
const STORY5_FINALE = [
  { who: 'Founder', sprite: 'king', bg: 'hall', title: 'Founder',
    text: 'Ten structures stand with your name on them, from here to the far shore. The King, the Empress, the councils and the clans do not agree on much, but they agree on this, and send a seal to prove it. Walls stand where you paid for stone. The roads are dry. Children are already climbing the memorials.' },
  { who: 'The realms rebuilt', sprite: 'hero', bg: 'town', title: 'The realms rebuilt',
    text: 'There will always be another list. But tonight the roofs are patched, the forges are lit, and somewhere a guard who owes you a watch house is buying the drinks. Five stories told, and the realms are better for every one of them.' },
];
function offerStory5() {
  if (story5().s !== 0 || !story4Done() || storyOpen()) return;
  story5().s = 1;
  sfx.play('quest'); unlock('reckoning'); track('story5_opened');
  showScene(STORY5_INTRO, () => { log('Story 5, The Rebuilding: talk to the leader of any town to sponsor walls, buildings, a memorial or paved roads. The heroes page ranks the builders.', 'good'); saveProgress('progress'); });
}
function founderNamed() {
  story5().s = 2; unlock('founder'); track('story5_done');
  showScene(STORY5_FINALE, () => { giveRelic('founderseal'); log("Story 5 complete: you are a Founder of the realms, and the Founder's Seal is yours.", 'good'); updateStats(); saveProgress('progress'); });
}
function rebuildRows(town) {
  const rows = [];
  if (!town) return rows;
  const built = projectsOf(town);
  rows.push(shopRow(`${town.name} after the Long Night: ${built.length ? `${built.length} of ${Object.keys(PROJECTS).length} works done` : 'nothing rebuilt yet'}. You have sponsored ${story5().n || 0} structure${(story5().n || 0) === 1 ? '' : 's'} across the realms${story5().s === 2 ? ', Founder' : `; ${FOUNDER_AT} makes a Founder`}.`));
  for (const [id, P] of Object.entries(PROJECTS)) {
    const done = projectDone(town, id);
    if (done) { rows.push(shopRow(`✓ ${P.name}, sponsored by ${done.builder}`)); continue; }
    if (id === 'walls' && town.walled) { rows.push(shopRow(`✓ ${P.name}: ${town.name} has its walls already`)); continue; }
    if (BUILDINGS[id] && town.houses.some((h) => h.id === id)) { rows.push(shopRow(`✓ ${P.name}: ${town.name} has one already`)); continue; }
    if (BUILDINGS[id] && !freeSlot(town)) { rows.push(shopRow(`${P.name}: no room left in ${town.name} for another building`)); continue; }
    rows.push(shopRow(`${P.name}: ${P.desc}`, `Sponsor ${P.cost}g`, () => sponsorProject(town, id), player.gold < P.cost));
  }
  return rows;
}
// ---------- the Daily Delve ----------
// One dungeon a day, generated from the date so every hero gets the same one,
// one scored try each: a hundred points a floor, five a kill, every coin, and a
// bonus for clearing it. It is a dream: falling in it ends the delve, not the hero.
const DELVE_THEMES = [
  { name: 'Embers', theme: 'lava', pool: ['Orc', 'Goblin', 'Bat', 'Slime'] }, { name: 'Bones', theme: 'bone', pool: ['Skeleton', 'Wraith', 'Necromancer', 'Spider'] },
  { name: 'Moss', theme: 'moss', pool: ['Spider', 'Goblin', 'Slime', 'Rat', 'Bat'] }, { name: 'Tides', theme: 'flooded', pool: ['Slime', 'Spider', 'Archer', 'Rat'] },
  { name: 'Stars', theme: 'arcane', pool: ['Wraith', 'Archer', 'Skeleton', 'Bat'] }, { name: 'Frost', theme: 'frost', pool: ['Skeleton', 'Direwolf', 'Troll', 'Wraith'] },
  { name: 'Stone', theme: 'stone', pool: ['Goblin', 'Orc', 'Archer', 'Mimic'] },
];
const delveDay = () => new Date().toISOString().slice(0, 10);
const delveDayNum = () => Math.floor(Date.parse(delveDay()) / 86400000);
const delveTheme = () => DELVE_THEMES[delveDayNum() % DELVE_THEMES.length];
let delve = null;   // { day, kills0, gold0 } while inside today's delve
let delveBoard = { at: 0, data: null };
function delveDef() {
  const T = delveTheme(), danger = Math.max(1, Math.min(14, Math.floor(player.level / 5)));
  return { kind: 'delve', delve: true, name: `the Delve of ${T.name}`, floors: 5, pool: byName(...T.pool), theme: T.theme, danger, gold: 1.4, potions: 1, view: 8, loot: 0.2, treasure: 120, xp: 1.2, seed: hash32(delveDayNum(), 7331, 99) };
}
const delveDone = () => !!player && !!player.meta && player.meta.delve === delveDay();
async function fetchDelveBoard(force = false) {
  if (!ACCOUNT.delveUrl || (!force && performance.now() - delveBoard.at < 60000)) return delveBoard.data;
  delveBoard.at = performance.now();
  try { const r = await fetch(ACCOUNT.delveUrl, { headers: { Accept: 'application/json' } }); if (r.ok) { delveBoard.data = await r.json(); if (delveBoard.data.mine && player && player.meta) player.meta.delve = delveDay(); if (shopOpen) renderShop(); } } catch (e) { /* offline */ }
  return delveBoard.data;
}
function enterDelve() {
  if (delveDone()) return;
  const here = townContaining(player.x, player.y) || nearestTownTo(player.x, player.y);
  closeShop(); if (scene === 'house') leaveBuilding();
  homeTown = here.key; player.wx = here.gate.x; player.wy = here.gate.y + 1;
  delve = { day: delveDay(), kills0: player.lifetimeKills, gold0: player.gold };
  dungeonDef = delveDef();
  log(`You lie down at the inn and the Delve of ${delveTheme().name} opens under you: five floors, danger ${stars(dungeonDef.danger)}, the same for every hero today. Floors, kills and gold all count. If you fall, you only wake.`, 'good');
  tip('delve', 'The Daily Delve is a dream: the same dungeon for everyone today, one try each. Score a hundred a floor, five a kill and every coin; clear all five floors for a bonus. Falling only wakes you.');
  track('delve_enter', { theme: delveTheme().name, danger: dungeonDef.danger });
  enterDungeon('delve:' + delveDay());
}
// the delve is over, cleared or not: score it, post it, and tell the hero where they stand
async function recordDelve(cleared) {
  if (!delve) return;
  const floorReached = cleared ? 5 : Math.max(1, Math.min(5, floor)), kills = Math.max(0, player.lifetimeKills - delve.kills0), gold = Math.max(0, player.gold - delve.gold0);
  const score = floorReached * 100 + kills * 5 + gold + (cleared ? 250 : 0);
  delve = null; player.meta.delve = delveDay(); unlock('delver');
  log(`The Delve of ${delveTheme().name}: ${cleared ? 'cleared' : `floor ${floorReached}`}, ${kills} kill${kills === 1 ? '' : 's'}, ${gold} gold. Score ${score}.`, 'good');
  track('delve_done', { score, floor: floorReached, cleared });
  if (!ACCOUNT.user) { log('Create a hero (or log in) and tomorrow\'s delve goes on the board.'); return; }
  try {
    const r = await fetch(ACCOUNT.delveUrl.replace(/\/today$/, ''), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf }, body: JSON.stringify({ floor: floorReached, kills, gold, cleared }) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) { log(res.message || 'The board did not take your score. Try again tomorrow.', 'bad'); return; }
    const m = res.mine, nth = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
    log(`You stand ${nth(m.rank)} of ${res.entries} on today's board${m.rank === 1 ? '. Champion, for now' : ''}. See the heroes page.`, 'good');
    if (m.rank === 1 && res.entries >= 3) unlock('delve_champion');
    delveBoard.at = 0; saveProgress('progress');
  } catch (e) { /* offline */ }
}
function delveRows() {
  const rows = [], T = delveTheme(), d = delveBoard.data;
  const def = delveDef();
  rows.push(shopRow(`Today's Delve of ${T.name} (danger ${stars(def.danger)}, ${ratingText(def)}): a dream-dungeon of five floors, the same for every hero today, one try each. A hundred points a floor, five a kill, every coin, and 250 for clearing it. Falling only wakes you.`,
    delveDone() ? 'Done today' : 'Enter', () => enterDelve(), delveDone()));
  if (d && d.mine) rows.push(shopRow(`Your delve today: ${d.mine.score} points (floor ${d.mine.floor}${d.mine.cleared ? ', cleared' : ''}, ${d.mine.kills} kills), ${d.mine.rank === 1 ? 'top of the board' : `${d.mine.rank} of ${d.entries}`}`));
  if (d && d.board && d.board.length) rows.push(shopRow(`Today's board: ${d.board.slice(0, 3).map((b, i) => `${i + 1}. ${b.name} ${b.score}`).join(' · ')}${d.yesterday ? ` · yesterday's champion ${d.yesterday.name} (${d.yesterday.score})` : ''}`));
  else if (d) rows.push(shopRow(d.yesterday ? `Nobody has delved yet today. Yesterday's champion: ${d.yesterday.name} with ${d.yesterday.score}.` : 'Nobody has delved yet today. Be the first on the board.'));
  if (!d) fetchDelveBoard();
  return rows;
}
const aOrAn = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const monumentName = (b) => `${BUILD.types[b.type] ? BUILD.types[b.type].name : b.type}`;
const levelDesc = (type, level) => (BUILD.types[type] ? BUILD.types[type].levels[level - 1] : '');
function monumentUsed(town, slot) { try { const m = JSON.parse(localStorage.getItem('dungeon-monuments') || '{}'); return Date.now() - (m[`${town.key}:${slot}`] || 0) < MONUMENT_COOLDOWN_MS; } catch (e) { return false; } }
function markMonumentUsed(town, slot) { try { const m = JSON.parse(localStorage.getItem('dungeon-monuments') || '{}'); m[`${town.key}:${slot}`] = Date.now(); localStorage.setItem('dungeon-monuments', JSON.stringify(m)); } catch (e) { /* ignore */ } }
function useMonument(town, slot) {
  const b = buildingAt(town, slot);
  if (!b) { log(`An empty building plot, staked out and waiting. Any innkeeper in ${town.name} will take your gold to build a monument here for every hero who passes.`); return; }
  const who = `${b.builder}'s ${monumentName(b)}`;
  if (monumentUsed(town, slot)) { log(`${who} has helped you recently. Give it a little while.`); return; }
  markMonumentUsed(town, slot);
  const L = b.level;
  if (b.type === 'fountain') {
    const heal = L >= 3 ? player.maxHp : Math.ceil(player.maxHp * (L === 2 ? 0.6 : 0.3));
    const got = Math.min(heal, player.maxHp - player.hp); player.hp += got; if (L >= 3) player.poison = 0;
    burst(player.x, player.y, '#7bdfff', 24, 80, { glow: true, gravity: -60, life: 800 });
    log(`You drink from ${who}${got ? ` and recover ${got} HP` : ''}.`, 'good');
  } else if (b.type === 'shrine') {
    player.meta.blessing = { name: `${b.builder}'s shrine`, atk: Math.min(2, L), def: L >= 3 ? 1 : 0, turns: 200 + 100 * L };
    burst(player.x, player.y, '#ffd86b', 24, 80, { glow: true, gravity: -60, life: 800 });
    log(`You kneel at ${who}: ${levelDesc('shrine', L)}.`, 'good');
  } else if (b.type === 'cache') {
    const gifts = L === 1 ? ['potion'] : L === 2 ? ['potion', 'bomb'] : ['elixir', 'bomb'];
    const got = []; for (const g of gifts) if (!bagFull()) { player.bag.push(g); got.push(itemInfo(g).name.toLowerCase()); }
    log(got.length ? `You open ${who} and take ${got.join(' and ')}. A note inside reads: "For whoever needs it. ${b.builder}."` : 'Your bag is too full to take anything.', got.length ? 'good' : '');
  } else if (b.type === 'beacon') {
    const found = nearbyPlaces(town.cx, town.cy, L).filter((p) => !discovered(p));
    for (const p of found) player.meta.places.push(p.key);
    mapCache.ox = null; bgDirty = true;
    burst(player.x, player.y, '#ff9f43', 30, 120, { glow: true, gravity: -120, life: 900 });
    log(found.length ? `You climb ${who} and light the fire. From up here you spot ${found.length} ${found.length === 1 ? 'place' : 'places'}, now marked on your map.` : `You climb ${who}. Everything in sight is already on your map.`, 'good');
  }
  sfx.play('quest'); updateStats();
}
async function buildMonument(town, slot, type, upgrade = false) {
  if (!ACCOUNT.user) { log('Create a hero (or log in) to build. Monuments are shared with every hero, so they need a name on them.', 'bad'); return; }
  const cost = upgrade ? BUILD.costs[(buildingAt(town, slot) || { level: 1 }).level] : BUILD.costs[0];
  if (player.gold < cost) return;
  try {
    const r = await fetch(`${ACCOUNT.buildingsUrl}${upgrade ? '/upgrade' : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': ACCOUNT.csrf }, body: JSON.stringify({ town: town.key, slot, type, gold: player.gold }) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) { log(res.message || 'The innkeeper shakes their head. Try again in a moment.', 'bad'); await fetchBuildings([town.key], true); return; }
    player.gold = res.gold;
    const e = townBuildings.get(town.key) || { at: performance.now(), list: [] };
    e.list = e.list.filter((b) => b.slot !== slot).concat([res.building]); townBuildings.set(town.key, e);
    bgDirty = true; sfx.play('win');
    const b = res.building;
    log(upgrade ? `Masons set to work on the ${monumentName(b)}. It is now level ${b.level}: ${levelDesc(b.type, b.level)}, for every hero who passes.`
      : `Builders raise ${aOrAn(monumentName(b))} ${monumentName(b)} on the ${PLOT_NAMES[slot]} plot of ${town.name}, with your name carved on it. Every hero who passes can use it: ${levelDesc(b.type, 1)}.`, 'good');
    unlock(upgrade ? 'patron' : 'builder');
    track(upgrade ? 'monument_upgrade' : 'monument_build', { type: b.type, level: b.level });
    updateStats(); renderShop(); draw(); saveProgress('progress');
  } catch (e) { log('The innkeeper could not reach the builders. Try again in a moment.', 'bad'); }
}
function monumentRows() {
  const town = shopTown(); if (!town) return [];
  const rows = [], head = document.createElement('li');
  head.className = 'empty stash-head'; head.textContent = `Monuments of ${town.name}: built by heroes, for every hero`; rows.push(head);
  const slots = PLOT_SPOTS.slice(0, BUILD.slots).map((_, i) => i);
  for (const slot of slots) {
    const b = buildingAt(town, slot);
    if (!b) continue;
    const by = `${b.builder}${b.upgrader && b.upgrader !== b.builder ? `, upgraded by ${b.upgrader}` : ''}`;
    if (b.level >= BUILD.costs.length) { rows.push(shopRow(`${monumentName(b)} (level ${b.level}, by ${by}): ${levelDesc(b.type, b.level)}. As grand as it gets`)); continue; }
    const cost = BUILD.costs[b.level];
    rows.push(shopRow(`${monumentName(b)} (level ${b.level}, by ${by}). Upgrade so it gives ${levelDesc(b.type, b.level + 1)}`, `Upgrade ${cost}g`, () => buildMonument(town, slot, b.type, true), player.gold < cost || !ACCOUNT.user));
  }
  const free = slots.find((slot) => !buildingAt(town, slot));
  if (free === undefined) rows.push(shopRow('Every plot in the square is built on'));
  else for (const [type, T0] of Object.entries(BUILD.types)) {
    rows.push(shopRow(`Build ${aOrAn(T0.name)} ${T0.name} on the ${PLOT_NAMES[free]} plot: ${T0.levels[0]}${ACCOUNT.user ? '' : ' (create a hero to build)'}`, `Build ${BUILD.costs[0]}g`, () => buildMonument(town, free, type), player.gold < BUILD.costs[0] || !ACCOUNT.user));
  }
  return rows;
}
// Town layout in local coordinates, shared by the stamp and the renderer.
function townTile(town, wx, wy) {
  const lx = wx - town.x0, ly = wy - town.y0;
  const cx = town.cx - town.x0, cy = town.cy - town.y0, [pw, ph] = town.plaza;
  let g = wy < ICE_Y ? GROUND.SNOW : GROUND.GRASS, t = TILE.FLOOR;
  if (ly >= cy - ph && ly <= cy + ph && lx >= cx - pw && lx <= cx + pw) g = GROUND.COBBLE;
  if (town.walled) {
    const W = tw(town), H = th(town);
    if (lx >= 1 && lx <= W - 2 && ly >= 1 && ly <= H - 2) g = GROUND.COBBLE;   // paved bailey
    // a ring of wall with a gate in the middle of each side and a tower at each corner
    const ring = (a, b, c2, d) => {
      const inside = lx >= a && lx <= c2 && ly >= b && ly <= d;
      const on = inside && (lx === a || lx === c2 || ly === b || ly === d);
      const gap = ((ly === b || ly === d) && lx >= cx - 1 && lx <= cx + 1) || ((lx === a || lx === c2) && ly >= cy - 1 && ly <= cy + 1);
      const tower = inside && (lx <= a + 1 || lx >= c2 - 1) && (ly <= b + 1 || ly >= d - 1);
      return (on && !gap) || tower;
    };
    if (ring(1, 1, W - 2, H - 2)) { t = TILE.WALL; g = GROUND.RAMPART; }
    if (town.size === 'grand') {
      if (ring(8, 7, W - 9, H - 8)) { t = TILE.WALL; g = GROUND.RAMPART; }   // the inner ring round the royal bailey
      const R = GRAND_TREASURY;   // a chamber hidden in the thickness of the outer wall
      if (lx >= R.x && lx <= R.x + 4 && ly >= R.y && ly <= R.y + 4) {
        if (lx === R.x || lx === R.x + 4 || ly === R.y || ly === R.y + 4) { t = TILE.WALL; g = GROUND.RAMPART; }
        else { t = TILE.FLOOR; g = GROUND.COBBLE; if (lx === R.x + 2 && ly === R.y + 2 && !(player && player.meta && player.meta.looted.includes(key(wx, wy)))) t = TILE.CHEST; }
      }
      const sec = grandSecret(town, lx, ly);
      if (sec) { if (sec.open) { t = TILE.FLOOR; g = GROUND.COBBLE; } else { t = TILE.WALL; g = GROUND.RAMPART; } }
    }
  }
  if (lx >= cx - 1 && lx <= cx + 1) g = GROUND.COBBLE;            // the path through the square to the roads
  if (ly >= cy - 1 && ly <= cy && lx >= cx - 1 && lx <= cx) { t = TILE.FOUNTAIN; g = GROUND.COBBLE; }
  for (const h of town.houses) {
    if (wx >= h.x && wx < h.x + h.w && wy >= h.y && wy < h.y + h.h) t = (wx === h.doorX && wy === h.doorY) ? TILE.DOOR : TILE.WALL;
  }
  if (wx === town.gate.x && wy === town.gate.y) t = TILE.EXIT;
  if (wx === town.cx + 4 && wy === town.cy) { t = TILE.WAYSTONE; g = GROUND.COBBLE; }
  if (wx === town.cx - 6 && wy === town.cy - 2) { t = TILE.MONUMENT; g = GROUND.COBBLE; }
  if (town.memorial && wx === town.cx - 4 && wy === town.cy + 3) { t = TILE.MONUMENT; g = GROUND.COBBLE; }   // the memorial of the Long Night
  if (plotSlot(town, wx, wy) >= 0) { t = TILE.PLOT; g = GROUND.COBBLE; }
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
    if (town && x >= town.x0 - 3 && x < town.x0 + tw(town) + 3 && y >= town.y0 - 3 && y < town.y0 + th(town) + 3) y = town.y0 + th(town) + 10;
    // the town may sprawl further than its plan (walls, rebuilt quarters): keep the gate clear of every town tile
    for (let k2 = 0; k2 < 60 && [[0, 0], [0, -3], [0, 3], [-3, 0], [3, 0]].some(([ox, oy]) => townContaining(x + ox, y + oy)); k2++) y++;
    const site = { key: k, i, j, x, y, type: 'deep', name: 'The Gate of the Deep', floors: 99, danger: 5, sprite: 'abyss', deep: true };
    sites.set(k, site);
    return site;
  }
  if (LAIR_AT[k]) {
    const id = LAIR_AT[k], L = LAIRS[id];
    let x = i * TOWN_SPACING + 12 + Math.floor(cellRand(i, j, 302) * 70), y = j * TOWN_SPACING + 10 + Math.floor(cellRand(i, j, 303) * 70);
    const town = townAt(i, j);
    if (town && x >= town.x0 - 3 && x < town.x0 + tw(town) + 3 && y >= town.y0 - 3 && y < town.y0 + th(town) + 3) x = town.x0 + tw(town) + 12;
    const site = { key: k, i, j, x, y, type: L.type, name: L.title[0].toUpperCase() + L.title.slice(1), floors: 2, danger: L.danger, sprite: SITE_TYPES[L.type].sprite, lair: id };
    sites.set(k, site);
    return site;
  }
  if (STORY_AT[k]) {
    const id = STORY_AT[k], S = STORY_SITES[id];
    let x = i * TOWN_SPACING + 12 + Math.floor(cellRand(i, j, 302) * 70), y = j * TOWN_SPACING + 10 + Math.floor(cellRand(i, j, 303) * 70);
    const town = townAt(i, j);
    if (S.fixed) { x = i * TOWN_SPACING + 20 + S.fixed[0]; y = j * TOWN_SPACING + 15 + S.fixed[1]; }
    else if (town && x >= town.x0 - 3 && x < town.x0 + tw(town) + 3 && y >= town.y0 - 3 && y < town.y0 + th(town) + 3) x = town.x0 + tw(town) + 12;
    const site = { key: k, i, j, x, y, type: S.type, name: S.title, floors: S.floors, danger: S.danger, sprite: SITE_TYPES[S.type].sprite, story: id };
    sites.set(k, site);
    return site;
  }
  if (cellRand(i, j, 300) > 0.55) { sites.set(k, null); return null; }
  const types = Object.keys(SITE_TYPES).filter((t) => t !== 'deep');
  const type = types[Math.floor(cellRand(i, j, 301) * types.length)], st = SITE_TYPES[type];
  let x = i * TOWN_SPACING + 8 + Math.floor(cellRand(i, j, 302) * 80), y = j * TOWN_SPACING + 6 + Math.floor(cellRand(i, j, 303) * 80);
  const town = townAt(i, j);
  if (town && x >= town.x0 - 3 && x < town.x0 + tw(town) + 3 && y >= town.y0 - 3 && y < town.y0 + th(town) + 3) { x = town.x0 + tw(town) + 12 + Math.floor(noise(i, j, 304) * 20); }
  if (!isLand(x, y)) { sites.set(k, null); return null; }
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
    if (gr[ly * CHUNK + lx] === GROUND.WATER && isSea(wx, wy)) return;   // roads stop at the shore
    const near = nearestTownTo(wx, wy);   // a town that paid for paving has stone roads for sixty tiles about
    gr[ly * CHUNK + lx] = near && near.paved && Math.abs(wx - near.cx) <= 60 && Math.abs(wy - near.cy) <= 50 ? GROUND.COBBLE : GROUND.ROAD; tiles[ly * CHUNK + lx] = TILE.FLOOR;
  };
  // the king's roads: straight across every land bridge, capital to capital
  for (const [a, b] of BRIDGES) {
    const steps = Math.ceil(Math.hypot(b.cx - a.cx, b.cy - a.cy));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(a.cx + (b.cx - a.cx) * k / steps), y = Math.round(a.cy + (b.cy - a.cy) * k / steps);
      if (x < ox - 1 || y < oy - 1 || x > ox + CHUNK || y > oy + CHUNK) continue;
      mark(x, y); mark(x + 1, y); mark(x, y + 1);
    }
  }
  // roads: every town links east and south to the next town along, skipping empty cells
  const i0 = Math.floor((ox - 20) / TOWN_SPACING), j0 = Math.floor((oy - 15) / TOWN_SPACING);
  for (let i = i0 - 3; i <= i0 + 1; i++) for (let j = j0 - 3; j <= j0 + 1; j++) {
    const a = townAt(i, j);
    if (!a) continue;
    for (const b of [neighbourTown(i, j, 1, 0), neighbourTown(i, j, 0, 1)]) {
      { const ca = continentOf(a.cx, a.cy); if (!b || ca < 0 || ca !== continentOf(b.cx, b.cy)) continue; }   // roads only within a continent, never across the sea
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
  // orc warcamps on a burnt clearing
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const wc = campAt(i, j);
    if (!wc) continue;
    for (let yy = wc.y - 1; yy <= wc.y + 1; yy++) for (let xx = wc.x - 1; xx <= wc.x + 1; xx++) {
      const lx = xx - ox, ly = yy - oy;
      if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) continue;
      if (xx === wc.x && yy === wc.y) { tiles[ly * CHUNK + lx] = TILE.WARCAMP; gr[ly * CHUNK + lx] = GROUND.SAND; }
      else if (tiles[ly * CHUNK + lx] === TILE.WALL) { tiles[ly * CHUNK + lx] = TILE.FLOOR; gr[ly * CHUNK + lx] = GROUND.GRASS; }
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
    for (let y = Math.max(oy, town.y0); y < Math.min(oy + CHUNK, town.y0 + th(town)); y++) for (let x = Math.max(ox, town.x0); x < Math.min(ox + CHUNK, town.x0 + tw(town)); x++) {
      const [t, g] = townTile(town, x, y);
      tiles[(y - oy) * CHUNK + (x - ox)] = t; gr[(y - oy) * CHUNK + (x - ox)] = g;
    }
  }
  // piers out into the sea, with a ship moored at the end
  for (const town of nearbyTowns(ox + CHUNK / 2, oy + CHUNK / 2, 1)) {
    const H = town.harbour; if (!H) continue;
    for (let n = 0; n <= H.len; n++) {
      const x = H.x + H.dx * n, y = H.y + H.dy * n, lx = x - ox, ly = y - oy;
      if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) continue;
      gr[ly * CHUNK + lx] = n === 0 ? gr[ly * CHUNK + lx] : GROUND.DOCK; tiles[ly * CHUNK + lx] = TILE.FLOOR;
    }
    const lx = H.ship.x - ox, ly = H.ship.y - oy;
    if (lx >= 0 && ly >= 0 && lx < CHUNK && ly < CHUNK) tiles[ly * CHUNK + lx] = TILE.SHIP;
  }
  // beasts of the wilds: a few per chunk, never on roads or near a settlement
  const rand = seededRandom(hash32(WORLD_SEED, cx, cy));
  const danger = Math.max(Math.abs(Math.round((ox - 20) / TOWN_SPACING)), Math.abs(Math.round((oy - 15) / TOWN_SPACING)));
  const spots = [];
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const g = gr[y * CHUNK + x];
    if (tiles[y * CHUNK + x] !== TILE.FLOOR || (g !== GROUND.GRASS && g !== GROUND.FOREST)) continue;
    const wx = ox + x, wy = oy + y;
    if (nearbyTowns(wx, wy, 1).some((t) => wx >= t.x0 - 8 && wx < t.x0 + tw(t) + 8 && wy >= t.y0 - 8 && wy < t.y0 + th(t) + 8)) continue;
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
  // the open sea has beasts of its own, in plain sight: sloops and serpents, and krakens in the far deeps
  const seaSpots = [];
  for (let y = 2; y < CHUNK - 2; y += 2) for (let x = 2; x < CHUNK - 2; x += 2) {
    const wx = ox + x, wy = oy + y;
    if (gr[y * CHUNK + x] !== GROUND.WATER || !isSea(wx, wy) || isLand(wx + 3, wy) || isLand(wx - 3, wy) || isLand(wx, wy + 3) || isLand(wx, wy - 3)) continue;
    if (nearbyTowns(wx, wy, 1).some((t) => Math.abs(t.cx - wx) < 26 && Math.abs(t.cy - wy) < 26)) continue;
    seaSpots.push({ x: wx, y: wy });
  }
  if (seaSpots.length >= 40) {
    const n = rand() < 0.35 ? 1 + Math.floor(rand() * 2) : 0;
    for (let i = 0; i < n; i++) {
      const cell = seaSpots.splice(Math.floor(rand() * seaSpots.length), 1)[0], roll = rand();
      const t = byName(roll < 0.5 ? 'Pirate sloop' : roll < 0.9 || danger < 4 ? 'Sea serpent' : 'Kraken')[0];
      const hp = Math.round(t.hp * (1 + danger * 0.25));
      worldMonsters.push({ ...cell, type: t, hp, maxHp: hp, atk: t.atk + Math.floor(danger / 2), awake: false, wild: true, sea: true, purse: t.purse ? 30 + danger * 20 + Math.floor(rand() * 30) : 0 });
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
  if (town.size !== 'grand' && spots.length) {
    const cell = spots.splice(Math.floor(cellRand(town.i, town.j, 505) * spots.length), 1)[0];
    town.npcs.push({ ...cell, type: leaderNpc(town), pause: rnd(3), home: { x: town.cx, y: town.cy } });
  }
  guardPlan(town).forEach((rank, k) => {
    const beat = guardBeat(town, k), post = beat[0], R = GUARD_RANKS[rank];
    town.npcs.push({ ...post, post, beat, leg: 1, type: guardNpc(town, rank, k), pause: rnd(3), home: { x: town.cx, y: town.cy }, hp: R.hp, maxHp: R.hp });
  });
  if (spots.length) {
    const cell = spots.splice(Math.floor(cellRand(town.i, town.j, 802) * spots.length), 1)[0];
    town.npcs.push({ ...cell, type: notableNpc(town), pause: rnd(3), home: { x: town.cx, y: town.cy } });
  }
  if (town.harbour) { const H = town.harbour; town.npcs.push({ x: H.end.x, y: H.end.y, type: harbourmasterNpc(town), fixed: true, pause: 0, home: { x: town.cx, y: town.cy } }); }
  // the townsfolk: Hearth keeps its four old hands, each Far Shore town one voice of its
  // culture, and every town fills the rest of its square with people of its own
  const far = FAR_FOLK[town.realm];
  const fixed = town.key === '0,0' ? NPC_TYPES.slice() : far ? [far[Math.floor(noise(town.i, town.j, 99) * far.length)]] : [];
  const count = town.key === '0,0' ? NPC_TYPES.length + 2 : Math.max(fixed.length + 2, town.folk[0] + Math.floor(noise(town.i, town.j, 98) * (town.folk[1] - town.folk[0] + 1)));
  const types = [...fixed, ...townFolk(town, count - fixed.length)];
  for (let n = 0; n < types.length && spots.length; n++) {
    const cell = spots.splice(Math.floor(noise(town.i, town.j, 100 + n) * spots.length), 1)[0];
    town.npcs.push({ ...cell, type: types[n], pause: rnd(3), home: { x: town.cx, y: town.cy } });
  }
  return town.npcs;
}
// ---------- the townsfolk ----------
// Every town has people of its own: a name from its realm, a trade, three things to
// say about their own town, a habit, and a piece of advice. The same town always
// has the same people (seeded by its cell), and no two in a square share a name or
// a trade. Each wears clothes of their own colour.
const FOLK_NAMES = {
  cantons: ['Hob', 'Wenna', 'Tobin', 'Agnes', 'Piet', 'Hesper', 'Jonas', 'Lissa', 'Bram', 'Mab', 'Corran', 'Tilly', 'Rufus', 'Nan', 'Abel', 'Greta', 'Wat', 'Dilly', 'Osk', 'Perrin'],
  aurum: ['Oswin', 'Maud', 'Benedict', 'Cecily', 'Anselm', 'Mathilde', 'Roland', 'Edith', 'Ottilie', 'Gervase', 'Piers', 'Rosalind', 'Hugh', 'Isolde', 'Aldous', 'Joan', 'Walter', 'Avice', 'Giles', 'Petronel'],
  kathar: ['Vorna', 'Brak', 'Tessaly', 'Ulfar', 'Nessa', 'Korrin', 'Halla', 'Drenn', 'Ysra', 'Orm', 'Kaela', 'Thurn', 'Brenna', 'Varl', 'Sela', 'Gorm', 'Runa', 'Skarl', 'Eyja', 'Torv'],
  league: ['Bartolo', 'Serena', 'Cassius', 'Orsina', 'Fennimore', 'Dorothea', 'Aurelio', 'Beatrice', 'Marcello', 'Vittoria', 'Lorenzo', 'Clara', 'Ambrose', 'Petra', 'Cosimo', 'Livia', 'Nico', 'Ottavia', 'Rinaldo', 'Zita'],
  tianxia: ['Bao', 'Lin', 'Wu', 'Shen', 'Zhang', 'Hua', 'Lu', 'Mei', 'Li', 'Qing', 'Guo', 'Chen', 'Tian', 'Yun', 'Bai', 'Feng', 'Jun', 'Xiu', 'Ping', 'Rong'],
  suryadesh: ['Devi', 'Harish', 'Amba', 'Gopal', 'Sarla', 'Bhaskar', 'Kamala', 'Vishnu', 'Meena', 'Ravi', 'Lata', 'Padma', 'Arjun', 'Anjali', 'Kishan', 'Rukmini', 'Dev', 'Sita', 'Mohan', 'Uma'],
  severin: ['Vera', 'Ilya', 'Katya', 'Oleg', 'Agafya', 'Grisha', 'Zoya', 'Ivan', 'Nadia', 'Lev', 'Praskovya', 'Fyodor', 'Sasha', 'Matrona', 'Yegor', 'Dunya', 'Mitya', 'Olga', 'Pyotr', 'Ksenia'],
};
const FOLK_QUIRKS = ['keeps bees on the roof and will not say how many', 'has not slept indoors since the comet', 'names every chicken after a king', 'whistles the same four notes all day', 'is feuding with the miller over a fence', 'reads the clouds and is wrong about rain', 'knits in the dark', 'has a goat that follows them to the tavern', 'swears the fountain spoke once', 'collects the teeth of everything they eat', 'walks the walls at dawn, counting stones', 'has never once lost at dice and will not play you', 'talks to the crows, and the crows answer', 'bakes a loaf for every traveller who comes back alive', 'keeps a jar of coins for a boat they will never buy', 'remembers every name and no face'];
const FOLK_TIPS = ['Sleeping monsters take double damage from your first blow. Walk softly.', 'Hover over a monster to see how hard it hits and how many blows it will take.', 'The merchant pays half what he charges. Sell the junk, keep the good blade.', 'Smithies sharpen what you carry. A plus or two is the difference, deeper down.', 'A chest that bites is a mimic. Hit it anyway; it drops a fat purse.', 'A ring of stones in a dungeon room is a trial. Pass it and you leave with something magic.', 'Guards follow you to the walls if something is at the gate. They do not follow you in.', 'The harbourmasters sell charts. An X on an island is a chest.', 'Inns rent rooms for good. The chest in it is the same chest in every inn in the world.', 'Rest at a fountain when the square is quiet. Potions are for underground.', 'The trade shop sells what nobody else does. Ours is by the sign.', 'A pet grows with every kill it makes. Let the small ones finish the rats.'];
// roles: a sprite, and three lines about the speaker's own town
const FOLK_ROLES = {
  old: [
    { role: 'baker', sprite: 'villager', lines: (c) => [`"Bread by ${c.landmark} every morning but Sunday. If it is burnt, ${c.leader} had the first loaf and it was fine."`, `"Everyone in ${c.town} owes me for a loaf. That is what a baker is: the one who knows who is skint."`, `"The ${c.trade} folk eat the most. Out at dawn and back with a hunger, every one of them."`] },
    { role: 'cooper', sprite: 'villager', lines: (c) => [`"Barrels. Everything in ${c.town} that is worth anything ends up in one of mine: ${c.famous}, mostly."`, `"They buy the staves in from ${c.realm}, and the iron hoops from wherever the iron is this year."`, `"A good barrel outlives its maker. Half the ones in the cellars under ${c.landmark} are my father's."`] },
    { role: 'weaver', sprite: 'villager', lines: (c) => [`"I weave the pattern of ${c.realm}, nothing else. Buyers come from three towns for it."`, `"You can tell a ${c.town} cloak by the hem. We double it. The wind off ${c.site} taught us that."`, `"The loom is older than the walls. When the walls come down, as walls do, the loom will still be here."`] },
    { role: 'midwife', sprite: 'villager', lines: (c) => [`"I delivered half of ${c.town}, including ${c.guard} at the gate, who was a difficult child and is a difficult adult."`, `"Nobody goes near ${c.site} with a baby coming. We know that much."`, `"${c.leader} sends for me when the fever comes round. I send for the apothecary. The apothecary sends for the priest."`] },
    { role: 'shepherd', sprite: 'farmer', lines: (c) => [`"Three hundred head on the hill above ${c.town}, and I know every one. The wolves know them too."`, `"Something has been taking lambs from the fold nearest ${c.site}. Not wolves. Wolves leave something."`, `"${c.famous}, they call it, the thing ${c.town} is known for. Where do they think the wool for it comes from?"`] },
    { role: 'miller', sprite: 'farmer', lines: (c) => [`"The mill turns when the river lets it. This year the river has been contrary."`, `"Every sack of ${c.town} flour passes through my hands, and ${c.leader} takes a tenth of it for the walls. The walls eat well."`, `"My grandfather built the mill race. The water does not know he is dead; it still goes where he told it."`] },
    { role: 'tanner', sprite: 'farmer', lines: (c) => [`"You smell it before you see it, the tannery. That is why we are downwind of ${c.landmark}."`, `"Boar hide, wolf hide, and once something from ${c.site} that I did not ask the name of. It made a fine coat."`, `"${c.town} boots last. Ask any guard who has walked the walls in them for twenty years."`] },
    { role: 'brewer', sprite: 'merchant', lines: (c) => [`"The ale in ${c.town} is mine, and so is the morning after. You are welcome to both."`, `"I brew for the tavern, for the guard, and for ${c.leader}, who drinks it with water. Imagine."`, `"The best barley comes from the fields toward ${c.site}, and nobody wants to harvest them. Strange, that."`] },
    { role: 'hunter', sprite: 'farmer', lines: (c) => [`"Boar in the woods, deer on the ridge, and lately things with too many legs near ${c.site}. I leave those."`, `"${c.town} eats what I bring in. In a bad winter that is me, two dogs, and a lot of luck."`, `"The tracks near the walls last week were nothing I have a name for. I told ${c.guard}. ${c.guard} told the walls."`] },
    { role: 'scribe', sprite: 'elder', lines: (c) => [`"I write the letters ${c.town} sends and read the ones it gets. Mostly tax. Occasionally love. Rarely both."`, `"${c.leader} cannot spell. Nobody is to know that, so I am telling only you."`, `"The chronicle of ${c.town} goes back nine hundred years. The last three pages are mine, and the least interesting."`] },
    { role: 'priest', sprite: 'elder', lines: (c) => [`"The chapel by ${c.landmark} is open to all. The collection plate more so."`, `"I bury the ones who go into ${c.site} and come back. The ones who do not come back I pray for, which is cheaper."`, `"Bless you, traveller. ${c.town} has needed blessing more than usual lately."`] },
    { role: 'beggar', sprite: 'elder', lines: (c) => [`"A coin for a story? No? Then a story for free: ${c.town} was not always this small."`, `"I sit by ${c.landmark} and see everyone. ${c.leader} walks past me every day and has for twenty years."`, `"I went down into ${c.site} once, when I had two good legs. That is the story of the legs."`] },
    { role: 'stablehand', sprite: 'farmer', lines: (c) => [`"Horses, mules, and once an elephant that a lord was bringing home. The elephant ate the stable."`, `"Travellers for ${c.site} leave their horses with me and most come back for them. Most."`, `"The ${c.trade} wagons go out at dawn. If you want a ride toward ${c.realm}, be here before the rooster."`] },
    { role: 'minstrel', sprite: 'child', lines: (c) => [`"A song for ${c.town}! It is mostly about ${c.famous}, because that rhymes with more things than you would think."`, `"I have a verse about ${c.leader}. I only sing it in other towns."`, `"The ballad of ${c.site} has forty stanzas and the hero dies in the ninth. Nobody wants to hear the other thirty-one."`] },
    { role: 'rat-catcher', sprite: 'child', lines: (c) => [`"A copper a tail, from ${c.leader}. ${c.town} has been good to me this year, which is bad for ${c.town}."`, `"The rats come up from under the square. Where do you think the dungeon stairs go?"`, `"Big ones near ${c.site}. Big as dogs. I do not catch those. I catch the normal ones and I count myself lucky."`] },
    { role: 'washerwoman', sprite: 'villager', lines: (c) => [`"I know what is in every pocket in ${c.town} on washing day. Mostly crumbs. Occasionally a letter. Once a finger."`, `"${c.guard} brings me a tunic a week with the same tear in the same place. I have stopped asking."`, `"The river below ${c.landmark} is the only clean water for a mile. Downstream of me is a different story."`] },
  ],
  tianxia: [
    { role: 'noodle-seller', sprite: 'merchant', lines: (c) => [`"Noodles! Pulled by hand, long as your life. Longer, if you eat here."`, `"${c.leader} eats at my stall when the yamen cooks are sulking, which is most days."`, `"The porters from ${c.site} road eat four bowls each. Whatever they carry, it is heavy."`] },
    { role: 'calligrapher', sprite: 'elder', lines: (c) => [`"One brushstroke tells me if a man will keep his word. Yours leans. Do not write anything down."`, `"I painted the sign over ${c.landmark}. Nobody looks up, so nobody knows it is the best thing in ${c.town}."`, `"The petitions to the Empress go through my brush. I make them beautiful. Beautiful petitions are still refused, but politely."`] },
    { role: 'ferryman', sprite: 'villager', lines: (c) => [`"The river is the real road in ${c.town}. The one the Empire built floods every spring, like the Empire."`, `"I ferried a thing from the ${c.site} side once that paid in old coins and did not breathe. I took the coins."`, `"Two cash to cross. Four back. Everybody wants to come back."`] },
    { role: 'silk-weaver', sprite: 'villager', lines: (c) => [`"Silk from ${c.town} goes to the capital and comes back on the backs of officials, three times the price."`, `"The worms eat mulberry, the weavers eat rice, and the magistrate eats both of us."`, `"A bolt of our ${c.famous} takes a season. A bandit takes it in a moment. That is why we love the guard."`] },
    { role: 'monk', sprite: 'elder', lines: (c) => [`"The temple above ${c.town} rings its bell at dawn. The bell is older than the Empire and does not care who rules."`, `"I meditated near ${c.site} for a year. Something there meditated back. I moved."`, `"Attachment is suffering, the sutras say. I am attached to tea. I suffer gladly."`] },
    { role: 'fortune-teller', sprite: 'child', lines: (c) => [`"Your fortune, traveller? The sticks say: a long road, a sharp blade, a short temper. The sticks say that to everyone, but for you they mean it."`, `"I told ${c.leader} the year would be hard. It was. Now I am the magistrate's fortune-teller and the year is still hard."`, `"Do not go toward ${c.site} on a day with an eight in it. Do not ask me which days have an eight in them."`] },
  ],
  suryadesh: [
    { role: 'dyer', sprite: 'villager', lines: (c) => [`"Indigo, saffron, madder. My hands have not been their own colour since I was nine."`, `"The cloth of ${c.town} is ${c.famous}, and every bolt of it went through my vats first."`, `"The pilgrims to ${c.site} wear white. By the time they come back I could sell them anything."`] },
    { role: 'bangle-seller', sprite: 'merchant', lines: (c) => [`"Glass bangles, a dozen for a copper. They break. That is the point; you come back."`, `"The Maharani bought a dozen from me once, through a servant, through a servant. I still have the copper."`, `"Nobody near ${c.site} wears bangles. Too much noise for a place that listens."`] },
    { role: 'temple-dancer', sprite: 'child', lines: (c) => [`"I dance the story of the nine gates at ${c.landmark} every festival. It takes a night, and I have the bruises."`, `"${c.leader} watches from the dais and claps at the wrong moments. We have stopped minding."`, `"The old dance has a step for ${c.site}. We leave it out now. The drummer says it brings things."`] },
    { role: 'boatman', sprite: 'villager', lines: (c) => [`"The river at ${c.town} is slow and brown and full of everything. I know where the crocodiles sleep."`, `"The ghats below ${c.landmark} are mine at dawn. The washermen have them by noon and the dead by dusk."`, `"I will not row toward ${c.site}. The water goes the wrong way there."`] },
    { role: 'spice-grinder', sprite: 'merchant', lines: (c) => [`"Pepper, cumin, cardamom. Sneeze all you like; it is a sign of quality."`, `"Every kitchen in ${c.town} buys from me, including the yamen of ${c.leader}, who likes it hot and will not admit it."`, `"The caravans from ${c.realm} bring the pepper. The road past ${c.site} they will not take any more, so the pepper is dear."`] },
    { role: 'astrologer', sprite: 'elder', lines: (c) => [`"The stars over ${c.town} are favourable this month. The stars over you are complicated."`, `"${c.leader} does nothing without my chart. I do nothing without ${c.leader}'s silver. The heavens approve of both."`, `"There is a star that sets behind ${c.site} and rises nowhere. I do not put it on the charts."`] },
  ],
  severin: [
    { role: 'icon-painter', sprite: 'elder', lines: (c) => [`"Gold leaf and egg. The saints of ${c.town} have my face, slightly, because the mirror was closer than the model."`, `"The church by ${c.landmark} has forty of mine. The boyar's chapel has one, and paid for forty."`, `"I painted a saint for the chapel near ${c.site}. The painting came back by itself. We do not discuss it."`] },
    { role: 'furrier', sprite: 'merchant', lines: (c) => [`"Sable, fox, bear. Winter in ${c.town} is nine months, and I am the reason anyone is left in spring."`, `"${c.famous}, they call our pelts in the south. In the south they have never been cold."`, `"The trappers near ${c.site} bring in hides I have no name for. I sell those to the south too."`] },
    { role: 'bathhouse-keeper', sprite: 'villager', lines: (c) => [`"Steam, birch, cold river. If you leave ${c.town} without trying the bania you were never here."`, `"Everyone is equal in the steam. ${c.leader} is a thin old thing with a scar, like the rest of us."`, `"The men who came back from ${c.site} would not take the heat. Sat in the snow outside, shaking. I let them."`] },
    { role: 'sled-driver', sprite: 'farmer', lines: (c) => [`"Six dogs and a sled, and the road is wherever the snow is hard. ${c.town} to ${c.realm} in three days, if the wolves are elsewhere."`, `"The dogs will not run toward ${c.site}. Dogs are not stupid. I have learned from the dogs."`, `"I carried the boyar's letter to the capital through the white wind. The answer came back by crow."`] },
    { role: 'beekeeper', sprite: 'farmer', lines: (c) => [`"Honey, wax, and mead, which is honey with ambition. The hives are in the lime trees past ${c.landmark}."`, `"The bees know things. They swarmed the week before the dead walked. I should have listened."`, `"${c.leader} buys the candle wax for the church and haggles like a trader from the League."`] },
    { role: 'bell-founder', sprite: 'villager', lines: (c) => [`"I cast the great bell in the tower of ${c.town}. It took a year and the voice of it is mine."`, `"A bell is bronze, tin, and a little silver, and whatever the town throws in the pour for luck. Ours has a ring in it, and a tooth."`, `"They say my bell can be heard from ${c.site}. They say things come to hear it."`] },
  ],
};
// a sprite in the speaker's own colours: the dominant clothing colour swapped for one of eight
const FOLK_TINTS = ['b', 'r', 'G', 'P', 'd', 'p', 'o', 'c'];
function folkSprite(base, realm, k) {
  const src = FAR_DRESS[realm] && !BIG_SPRITES[`${base}:${realm}`] ? farSprite('villager', realm) : farSprite(base, realm), name = `${src}:c${k % FOLK_TINTS.length}`;
  if (BIG_SPRITES[name]) return name;
  const rows = BIG_SPRITES[src]; if (!rows) return base;
  const counts = {};
  for (const r of rows) for (const ch of r) if (!'.skHhwe'.includes(ch)) counts[ch] = (counts[ch] || 0) + 1;
  const cloth = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const tint = FOLK_TINTS[k % FOLK_TINTS.length] === cloth ? FOLK_TINTS[(k + 1) % FOLK_TINTS.length] : FOLK_TINTS[k % FOLK_TINTS.length];
  BIG_SPRITES[name] = cloth ? rows.map((r) => r.split(cloth).join(tint)) : rows;
  return name;
}
function townFolk(town, n) {
  if (town.folkTypes) return town.folkTypes;
  const realm = town.realm || 'cantons', I = townIdentity(town);
  const roles = (FOLK_ROLES[realm] || FOLK_ROLES.old).slice(), names = (FOLK_NAMES[realm] || FOLK_NAMES.cantons).slice();
  const at = { x: town.cx, y: town.cy };
  const site = nearbySites(town.cx, town.cy, 1).filter((st) => !st.deep).sort((a, b) => cheb(a, at) - cheb(b, at))[0];
  const c = { town: town.name, landmark: I.landmark.name, trade: I.trade.label, famous: I.famous, leader: I.leader, realm: (REALMS[realm] || REALMS.cantons).short,
    site: site ? (site.name.startsWith('The ') ? site.name.replace(/^The /, 'the ') : 'the ' + site.name) : 'the dungeon under the square',
    guard: guardPlan(town).length ? guardNpc(town, guardPlan(town)[0], 0).name : 'the militia' };
  const out = [];
  for (let k = 0; k < n && roles.length && names.length; k++) {
    const R = roles.splice(Math.floor(cellRand(town.i, town.j, 910 + k) * roles.length), 1)[0];
    const first = names.splice(Math.floor(cellRand(town.i, town.j, 930 + k) * names.length), 1)[0];
    const name = realm === 'tianxia' ? `${R.role[0].toUpperCase() + R.role.slice(1)} ${first}` : `${first} the ${R.role}`;
    const quirk = FOLK_QUIRKS[Math.floor(cellRand(town.i, town.j, 950 + k) * FOLK_QUIRKS.length)], tipLine = FOLK_TIPS[Math.floor(cellRand(town.i, town.j, 970 + k) * FOLK_TIPS.length)];
    out.push({ sprite: folkSprite(R.sprite, realm, Math.floor(cellRand(town.i, town.j, 990 + k) * FOLK_TINTS.length)), name, role: R.role, folk: true,
      lines: [...R.lines(c), `"They say I ${quirk}. They are not wrong."`, tipLine] });
  }
  town.folkTypes = out;
  return out;
}
// ---------- the town watch ----------
// Every town keeps guards who walk a beat around the square and the gate, and
// sally out after anything that comes near the walls. Poor towns field a scruffy
// militiaman or two; rich ones a proper watch in realm colours; castles, knights.
const GUARD_RANKS = {
  militia: { title: 'Militiaman', hp: 10, atk: 3, armor: 0, names: ['Tam', 'Dob', 'Wat', 'Hob', 'Nell', 'Gil', 'Pim', 'Rue'] },
  guard:   { title: 'Guard', hp: 20, atk: 5, armor: 1, names: ['Aldo', 'Berta', 'Cass', 'Dunstan', 'Edda', 'Ferris', 'Greta', 'Hal', 'Ines', 'Jory'] },
  knight:  { title: 'Knight', hp: 36, atk: 8, armor: 3, names: ['Sir Corwin', 'Dame Ysolt', 'Sir Brannoc', 'Dame Elswyth', 'Sir Godric', 'Dame Rhoswen', 'Sir Alain', 'Dame Mirel'] },
};
const REALM_GUARD_TITLES = { kathar: { militia: 'Spear-carrier', guard: 'Warden', knight: 'Champion' }, league: { militia: 'Hired blade', guard: 'Watchman', knight: 'Captain' }, tianxia: { militia: 'Constable', guard: 'Imperial guard', knight: 'Banner captain' }, suryadesh: { militia: 'Lathi-man', guard: 'Sepoy', knight: 'Rajput' }, severin: { militia: 'Watch-cossack', guard: 'Streltsy', knight: 'Druzhinnik' } };
function guardSprite(realm, rank) {
  const name = `guard:${realm}:${rank}`;
  if (BIG_SPRITES[name]) return name;
  const col = { cantons: 'g', aurum: 'y', kathar: 'o', league: 'p', tianxia: 'r', suryadesh: 't', severin: 'B' }[realm] || 'e';
  const rows = BIG_SPRITES.soldier.map((r) => [...r]);
  for (let y = 6; y <= 13; y++) rows[y][14] = '.';   // drop the spear; each rank gets its own weapon
  if (rank === 'militia') {
    rows[0] = [...'.....HHHHHH.....']; rows[1] = [...'....HHHHHHHH....']; rows[2] = [...'....HHssssHH....']; rows[3] = [...'....Hsssssss....'];
    for (let y = 7; y <= 11; y++) for (let x = 2; x < 14; x++) if (rows[y][x] === 'e') rows[y][x] = 'h';
    for (let x = 4; x < 12; x++) if (rows[9][x] === 'h') rows[9][x] = 'H';
    rows[6][14] = 'H'; rows[7][14] = 'H'; for (let y = 8; y <= 11; y++) rows[y][14] = 'h';   // a club
  } else if (rank === 'guard') {
    for (let y = 7; y <= 11; y++) for (let x = 6; x <= 9; x++) if (rows[y][x] === 'e') rows[y][x] = col;
    rows[4][14] = 'w'; rows[5][14] = 'w'; for (let y = 6; y <= 12; y++) rows[y][14] = 'h';   // a spear
  } else {
    for (let y = 0; y <= 1; y++) for (let x = 0; x < 16; x++) if (rows[y][x] === 'e') rows[y][x] = 'w';
    rows[0][7] = col; rows[0][8] = col;
    for (let y = 7; y <= 13; y++) for (let x = 0; x < 16; x++) if (rows[y][x] === 'e' || rows[y][x] === 'E') rows[y][x] = (x >= 6 && x <= 9 && y <= 11) ? col : 'w';
    rows[3][14] = 'w'; for (let y = 4; y <= 9; y++) rows[y][14] = 'w'; rows[10][13] = 'y'; rows[10][14] = 'y'; rows[10][15] = 'y'; rows[11][14] = 'H';   // a sword
  }
  BIG_SPRITES[name] = rows.map((r) => r.join(''));
  return name;
}
function guardPlan(town) {
  const tier = townTier(town), knights = town.walled || town.size === 'grand';
  if (tier === 0) return ['militia'];
  if (tier === 1) return ['militia', 'guard'];
  if (tier === 2) return knights ? ['guard', 'guard', 'knight'] : ['guard', 'guard', 'guard'];
  if (tier === 3) return knights ? ['guard', 'guard', 'knight', 'knight'] : ['guard', 'guard', 'guard', 'guard', 'knight'];
  return ['knight', 'knight', 'knight', 'knight', 'knight', 'knight'];
}
const FAR_GUARD_NAMES = {
  tianxia: ['Wei Zhong', 'Li Shan', 'Zhang Hu', 'Chen Yong', 'Wang Lei', 'Zhao Ying', 'Liu Bao', 'Sun Jian', 'Ma Teng', 'Gao Shun', 'Xu Huang', 'Yan Liang'],
  suryadesh: ['Arjun Singh', 'Bhim Rao', 'Karan Dev', 'Vikram Rathore', 'Rani Lakshmi', 'Dev Varma', 'Jai Chauhan', 'Prithvi Raj', 'Surya Sen', 'Meera Bai', 'Harsh Tomar', 'Ravi Shekhar'],
  severin: ['Ivan Volkov', 'Pyotr Medved', 'Olga Snegova', 'Dmitri Kazak', 'Yuri Strelok', 'Boris Zima', 'Anya Lesnaya', 'Grigor Topor', 'Vasily Rekin', 'Marfa Dubova', 'Fyodor Kamen', 'Nikolai Burya'],
};
function guardNpc(town, rank, k) {
  const R = GUARD_RANKS[rank], realm = town.realm || 'cantons';
  const title = (REALM_GUARD_TITLES[realm] || {})[rank] || R.title;
  const pool = FAR_GUARD_NAMES[realm] || R.names;
  const nm = pool[(Math.floor(cellRand(town.i, town.j, 700) * pool.length) + k * 3) % pool.length];   // no two alike in one town
  const tier = townTier(town), b = bountyFor(town);
  const lines = [
    'The gate to the dungeon is at the south end of the square. Nobody goes down it on my watch without a potion in their pack.',
    tier === 0 ? 'We keep the beasts out. Mostly. The pay is a bowl of stew and the stew is mostly water.' : tier >= 3 ? `${town.name} pays its watch well, and it shows. Nothing with claws gets within a stone's throw of these walls.` : 'Anything that follows you to the gate meets us first. That is what we are for.',
    `There is a bounty on ${b.name} posted at the watch house, if you have the stomach for it.`,
    { aurum: "The King's peace holds in this town. Break it and you answer to me.", kathar: 'The clan fire burns all night. Warm your hands, then move along.', league: 'The merchant houses pay for this watch. Thieves are bad for business.', tianxia: "The Empress's law runs to the last village, and so do we. Mind both.", suryadesh: 'When the temple bells ring, the watch comes running. Do not make them ring.', severin: 'Winter is the Tsar\'s oldest soldier. We are only the second oldest.' }[realm] || 'The council votes on our wages every spring. Vote for more.',
  ];
  return { sprite: guardSprite(realm, rank), name: `${title} ${nm}`, lines, guard: true, rank };
}
// Waypoints around the square and out to the gate.
function guardBeat(town, k) {
  const [pw, ph] = town.plaza, c = { x: town.cx, y: town.cy };
  const ring = [[c.x - pw + 1, c.y - ph + 1], [c.x + pw - 1, c.y - ph + 1], [c.x + pw - 1, c.y + ph - 1], [town.gate.x, town.gate.y - 1], [c.x - pw + 1, c.y + ph - 1]];
  const start = k % ring.length;
  return ring.slice(start).concat(ring.slice(0, start)).map(([x, y]) => ({ x, y }));
}
function guardStrike(n, m) {
  const R = GUARD_RANKS[n.type.rank];
  const dmg = Math.max(1, R.atk + rnd(3) - (m.mod === 'armored' ? 2 : 0));
  m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120;
  n.lunge = { dx: Math.sign(m.x - n.x), dy: Math.sign(m.y - n.y), until: performance.now() + 140 };
  if (m.x !== n.x) n.face = Math.sign(m.x - n.x);
  floatText(m.x, m.y, `-${dmg}`, '#e9c48a');
  if (isVisible(m.x, m.y) || cheb(m, player) <= 12) sfx.play('hit');
  if (m.hp > 0) return;
  log(`${n.type.name} cuts down the ${mName(m)}.`, 'good');
  burst(m.x, m.y, '#e5e7eb', 10, 110, { life: 500 });
  if (m.sea) {
    if (m.purse) { player.gold += m.purse; floatText(m.x, m.y, `+${m.purse}g`, '#f5c542'); log(`${nameOf(m)[0].toUpperCase() + nameOf(m).slice(1)} goes down. You fish ${m.purse} gold out of the wreckage.`, 'good'); }
    if (m.type.name === 'Pirate sloop') { unlock('seawolf'); const ch = Math.random() < 0.35 ? foundChart('Pinned to the sloop\'s mast,') : ''; if (ch) log(ch.trim(), 'good'); }
    if (m.type.name === 'Kraken') unlock('krakenslayer');
    m.purse = 0;
  }
  if (m.purse) golds.push({ x: m.x, y: m.y, amount: m.purse });
  monsters = monsters.filter((x) => x !== m); if (scene === 'world') worldMonsters = monsters; monstersDirty = true;
}
function guardHurt(n, m) {
  const R = GUARD_RANKS[n.type.rank], dmg = Math.max(1, m.atk - R.armor);
  n.hp -= dmg; n.flashUntil = performance.now() + 120;
  m.lunge = { dx: Math.sign(n.x - m.x), dy: Math.sign(n.y - m.y), until: performance.now() + 140 };
  floatText(n.x, n.y, `-${dmg}`, '#ff9b9b');
  if (n.hp > 0) return;
  n.down = true; n.downUntil = turn + 150;
  log(`${n.type.name} falls! The watch will carry them back to the barracks.`, 'bad');
  burst(n.x, n.y, '#9ca3af', 10, 80, { life: 500 });
}
// One beat for every guard near the hero: fight what is close, chase what is near the walls, else patrol.
function stepGuards() {
  if (scene !== 'world') return;
  for (const n of npcs) {
    if (!n.type.guard || cheb(n, player) > SIM_RADIUS + 10) continue;   // only the watch near the hero acts
    if (n.down) { if (turn >= n.downUntil) { n.down = false; n.hp = n.maxHp; n.x = n.post.x; n.y = n.post.y; } continue; }
    if (n.hp < n.maxHp && turn % 10 === 0) n.hp++;
    const foe = monsters.find((m) => !m.bounty && dist(m, n) === 1);
    if (foe) { guardStrike(n, foe); continue; }
    const home = n.home;
    const near = monsters.filter((m) => !m.bounty && Math.abs(m.x - home.x) <= 24 && Math.abs(m.y - home.y) <= 20 && cheb(m, n) <= (m.horde ? 20 : 9)).sort((a, b) => dist(a, n) - dist(b, n))[0];   // the watch sallies further against a horde
    if (!near && n.pause-- > 0) continue;
    const goal = near || n.beat[n.leg];
    if (!near && dist(n, goal) <= 1) { n.leg = (n.leg + 1) % n.beat.length; n.pause = 2 + rnd(4); continue; }
    if (near) {   // with a foe in sight the watch finds a way round the fountain, the crowd and each other
      const d = bfs(near.x, near.y, 18, false, true);
      let best = null, bestD = d.get(key(n.x, n.y)) ?? Infinity;
      for (const [ax, ay] of DIRS) {
        const nx = n.x + ax, ny = n.y + ay, nd = d.get(key(nx, ny)), t = getTile(nx, ny);
        if (nd === undefined || nd >= bestD || (t !== TILE.FLOOR && t !== TILE.EXIT) || getNpcAt(nx, ny) || getMonsterAt(nx, ny) || houndAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
        bestD = nd; best = [nx, ny];
      }
      if (best) { if (best[0] !== n.x) n.face = Math.sign(best[0] - n.x); n.x = best[0]; n.y = best[1]; continue; }
    }
    const dx = Math.sign(goal.x - n.x), dy = Math.sign(goal.y - n.y);
    const tries = Math.abs(goal.x - n.x) >= Math.abs(goal.y - n.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const [sx, sy] of tries) {
      if (!sx && !sy) continue;
      const nx = n.x + sx, ny = n.y + sy, t = getTile(nx, ny);
      if (t !== TILE.FLOOR && t !== TILE.EXIT) continue;
      if (getNpcAt(nx, ny) || getMonsterAt(nx, ny) || houndAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
      if (sx) n.face = sx;
      n.x = nx; n.y = ny;
      if (bubble && bubble.x === n.x - sx && bubble.y === n.y - sy) { bubble.x = n.x; bubble.y = n.y; }
      break;
    }
    if (!near) n.pause = 1;
  }
}
// Houses and townsfolk of the towns around the hero become the live lists.
function refreshTownContext() {
  if (scene !== 'world') return;
  const near = nearbyTowns(player.x, player.y, 1);
  houses = near.flatMap((t) => t.houses);
  npcs = near.flatMap((t) => townNpcs(t));
  fetchBuildings(near.map((t) => t.key)); fetchProjects(near.map((t) => t.key));
}
function createWorld() {
  scene = 'world';
  floorMod = null; escort = null; totems.clear(); trial = null;
  if (dungeonDef && dungeonDef.arena) { dungeonDef = null; ARENA.wave = 0; ARENA.between = false; }
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
  if (house.id === 'throne' && story().phase === 'done' && !npcs.some((n) => n.x === 9 && n.y === 2)) { npcs.push({ x: 9, y: 2, type: INDOOR_NPCS.edric, fixed: true, pause: 0 }); npcs.push({ x: 12, y: 3, type: INDOOR_NPCS.halvard, fixed: true, pause: 0 }); }
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
  if (edricTalk(n)) return;
  if (realmQuestTalk(n)) return;
  if (n.type.action && SERVICE_SHOPS.has(n.type.action)) { log(`${n.type.name}: ${n.type.lines[rnd(n.type.lines.length)]}`); openShop(n.type.action); return; }
  const rumour = !n.type.notable && !n.type.leader && !n.type.guard && !n.type.action && Math.random() < 0.45 ? storyRumour() : null;
  const line = rumour || (n.type.notable ? n.type.lines[n.type.tell++ % n.type.lines.length] : n.type.lines[rnd(n.type.lines.length)]);
  if (n.type.notable && /worse than the Deep/.test(line)) { const id = Object.keys(LAIRS).find((k) => line.includes(LAIRS[k].title[0].toUpperCase() + LAIRS[k].title.slice(1))); if (id) revealLair(id, 'The prophet points:'); }
  log(`${n.type.name}: ${line}`);
  bubble = { x: n.x, y: n.y, text: line, until: performance.now() + (n.type.notable ? 6000 : 4000) };
  if (n.type.notable) { draw(); return; }
  if (n.type.leader && story5Open()) { openShop('rebuild'); return; }
  if (n.type.action === 'inn') openShop('inn');
  else if (n.type.action && SHOPS[n.type.action]) openShop(n.type.action);
  else if (!bountyTalk(n)) offerQuest(n);
}
function stepNpcs() {
  for (const n of npcs) {
    if (n.type.guard) continue;   // the watch has its own routine
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
  if (d.sprite === 'counter' && tradeHere()) return openShop('trade');
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
  const tired = player.hp < player.maxHp || (player.mana ?? 0) < maxMana();
  player.hp = player.maxHp; restoreMana();
  log(tired ? 'You rest at the inn and recover fully.' : 'You are already in perfect health.', tired ? 'good' : '');
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
  placeFloorEvents(chunk, rand);
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
const viewRadius = () => Math.max(3, (dungeonDef ? dungeonDef.view : VIEW_RADIUS) + (wearing('sunstone') ? 3 : 0) + (wearing('deepheart') ? 2 : 0) + (player && traitOf(player.weapon) === 'dawnbreaker' ? 2 : 0) + (player && player.torch > turn ? 2 : 0) - (scene === 'dungeon' && floorMod === 'dark' ? 3 : 0));
// ---------- things that happen on a floor ----------
// From the second floor down, rooms may hold a chained captive, a goblin totem
// that keeps spawning goblins until it is smashed, a lever that sinks the floor's
// traps, or an altar with a choice. Each gives the hero something to decide.
const CAPTIVE_NAMES = ['Wat the miller', 'Sister Ilse', 'Pip the apprentice', 'old Brom', 'Elka the trader', 'young Tam', 'Goody Marsh', 'Corran the scribe'];
let escort = null;   // a freed captive following the hero
const totems = new Map();   // "x,y" -> hits left
let eventSeed = 0;
function placeFloorEvents(chunk, rand) {
  if (!dungeonDef || dungeonDef.arena || floor < 2) return;
  const ox = chunk.cx * CHUNK, oy = chunk.cy * CHUNK, spawnChunk = chunk.cx === 0 && chunk.cy === 0;
  chunk.rooms.forEach((rm, i) => {
    if (spawnChunk && i === 0) return;
    const roll = rand();
    const kind = roll < 0.06 ? TILE.CAPTIVE : roll < 0.15 ? TILE.TOTEM : roll < 0.20 ? TILE.LEVER : roll < 0.25 ? TILE.ALTAR : roll < 0.31 ? TILE.TRIAL : null;
    if (!kind) return;
    const x = rm.x + 1 + Math.floor(rand() * Math.max(1, rm.w - 2)), y = rm.y + 1 + Math.floor(rand() * Math.max(1, rm.h - 2));
    if (chunk.tiles[y * CHUNK + x] !== TILE.FLOOR) return;
    chunk.tiles[y * CHUNK + x] = kind;
    if (kind === TILE.TOTEM) totems.set(key(ox + x, oy + y), 3);
  });
}
function freeCaptive(x, y) {
  setTile(x, y, TILE.FLOOR); bgDirty = true;
  const name = CAPTIVE_NAMES[(x * 7 + y * 13 + floor) % CAPTIVE_NAMES.length];
  if (escort) { log(`You strike the chains off ${name}. "Bless you. I will follow ${escort.name}'s lead." They fall in behind the others.`, 'good'); escort.extra = (escort.extra || 0) + 1; return; }
  escort = { x, y, rx: x, ry: y, name, hp: 14 + floor * 3, maxHp: 14 + floor * 3, face: 1 };
  log(`You strike the chains off ${name}. "The goblins took everything but my skin. Get me to the stairs, or the door, and I will see you paid." They will follow close; keep them away from teeth.`, 'good');
  tip('captive', 'A freed captive follows you. Lead them to the stairs or the golden door while they live and the realm pays a reward. Monsters will go for them.');
  sfx.play('quest'); burst(x, y, '#ffd86b', 16, 90, { glow: true, gravity: -60, life: 600 });
}
function stepEscort() {
  if (!escort || scene !== 'dungeon') return;
  if (cheb(escort, player) <= 1) return;
  const d = bfs(player.x, player.y, 14, true, true);
  let best = null, bestD = d.get(key(escort.x, escort.y)) ?? Infinity;
  for (const [dx, dy] of DIRS) { const nx = escort.x + dx, ny = escort.y + dy, nd = d.get(key(nx, ny)); if (nd !== undefined && nd < bestD && !getMonsterAt(nx, ny) && !houndAt(nx, ny) && !(nx === player.x && ny === player.y)) { bestD = nd; best = [nx, ny]; } }
  if (best) { if (best[0] !== escort.x) escort.face = Math.sign(best[0] - escort.x); escort.x = best[0]; escort.y = best[1]; }
  else if (cheb(escort, player) > 10) { escort.x = player.x; escort.y = player.y; }   // lost in the dark: they catch up
}
function escortHurt(m) {
  const dmg = Math.max(1, m.atk - 1);
  escort.hp -= dmg; floatText(escort.x, escort.y, `-${dmg}`, '#ff9b9b');
  m.lunge = { dx: Math.sign(escort.x - m.x), dy: Math.sign(escort.y - m.y), until: performance.now() + 140 };
  if (escort.hp > 0) { if (Math.random() < 0.3) log(`${escort.name} cries out: "Help!"`, 'bad'); return; }
  log(`${escort.name} falls to ${nameOf(m)}. You could not save them.`, 'bad');
  burst(escort.x, escort.y, '#9ca3af', 14, 80, { life: 500 });
  escort = null;
}
// At the stairs or the way-out door with the captive beside you: a reward.
function rescueCheck() {
  if (!escort || cheb(escort, player) > 2) return;
  const n = 1 + (escort.extra || 0), gold = Math.round((60 + floor * 25) * n * goldMult());
  player.gold += gold; gainXp(10 * floor * n);
  log(`${escort.name}${n > 1 ? ` and ${n - 1} ${n > 2 ? 'others' : 'other'}` : ''} will live. "The council will hear of this. Take this, for the road." ${gold} gold, and the thanks of the realm.`, 'good');
  floatText(player.x, player.y, `+${gold}g`, '#f5c542'); sfx.play('win');
  player.meta.rescued = (player.meta.rescued || 0) + n;
  unlock('rescuer'); if (player.meta.rescued >= 10) unlock('liberator');
  rqProgress('gold', null, gold);
  track('captive_rescued', { floor, n });
  escort = null;
}
function smashTotem(x, y) {
  const k = key(x, y), left = (totems.get(k) || 3) - (traitOf(player.weapon) === 'warhammer' ? 3 : 1);
  burst(x, y, '#8b5a2b', 10, 90, { life: 450, size: 3 }); sfx.play('hit'); shakeScreen(2);
  if (left > 0) { totems.set(k, left); log(`You hack at the goblin totem. ${left} more ${left === 1 ? 'blow' : 'blows'} should do it.`); return; }
  totems.delete(k); setTile(x, y, TILE.FLOOR); bgDirty = true;
  const gold = Math.round((15 + floor * 5) * goldMult()); player.gold += gold; gainXp(6 + 3 * floor);
  burst(x, y, '#ff9f43', 24, 130, { glow: true, life: 600, size: 3 }); shakeScreen(4); sfx.play('fire');
  log(`The totem splinters. The goblins' drums fall silent. You find ${gold} gold in the offerings.`, 'good');
  floatText(x, y, `+${gold}g`, '#f5c542');
}
// Sea beasts wake when a ship comes within seven tiles, close over open water, and
// strike from alongside. They lose interest fourteen tiles out.
function seaMonsterStep(m, H) {
  const free = (x, y) => seaTile(x, y) && !getMonsterAt(x, y) && !(player.x === x && player.y === y) && !mpPlayerAt(x, y) && !shipAt(x, y);
  if (!m.awake) {
    if (cheb(m, H) <= 7 && Math.random() < 0.5) { m.awake = true; if (isVisible(m.x, m.y)) log(`${nameOf(m)[0].toUpperCase() + nameOf(m).slice(1)} turns toward your sail.`, 'bad'); }
    else if (Math.random() < 0.3) { const [dx, dy] = DIRS[rnd(4)]; if (free(m.x + dx, m.y + dy)) moveMonster(m, m.x + dx, m.y + dy); }
    return;
  }
  if (dist(m, H) === 1) { strike(m, H, false); return; }
  if (cheb(m, H) > 14) { m.awake = false; return; }
  let best = null, bestD = cheb(m, H);
  for (const [dx, dy] of DIRS.slice().sort(() => Math.random() - 0.5)) { const nx = m.x + dx, ny = m.y + dy; if (!free(nx, ny)) continue; const nd = cheb({ x: nx, y: ny }, H); if (nd < bestD) { bestD = nd; best = [nx, ny]; } }
  if (best) moveMonster(m, best[0], best[1]);
}
function tickTotems() {
  if (scene !== 'dungeon' || turn % 6 !== 0) return;
  for (const [k, hp] of totems) {
    const [x, y] = k.split(',').map(Number);
    if (cheb({ x, y }, player) > SIM_RADIUS || getTile(x, y) !== TILE.TOTEM) continue;
    if (monsters.filter((m) => m.type.name === 'Goblin' && cheb(m, { x, y }) <= 5).length >= 3) continue;
    const spot = freeTileNear(x, y, 1); if (!spot) continue;
    addMonster(MONSTER_TYPES.find((t) => t.name === 'Goblin'), spot.x, spot.y, { awake: isVisible(x, y) });
    if (isVisible(x, y)) { burst(spot.x, spot.y, '#7ad36b', 10, 80, { life: 400 }); log('Drums beat, and another goblin crawls out from behind the totem.', 'bad'); tip('totem', 'A goblin totem keeps calling goblins. Walk into it to smash it (three blows, one with a warhammer).'); }
  }
}
// Trials: a ring of stones in a room from the second floor down. Take one up and the
// stones wake: the Swarm sends a monster every other turn for twelve turns and asks
// only that you stand; Blood loose five at once and asks for all of them dead within
// twenty turns. Pass, and the stones pay gold and a sure magic item. Fail, or walk
// away, and they go dark. A trial ends with the floor.
const TRIALS = {
  swarm: { label: 'Trial of the Swarm', turns: 12, need: 0, desc: 'Stand your ground twelve turns while the stones send what they will, every other turn.' },
  blood: { label: 'Trial of Blood', turns: 20, need: 5, desc: 'Five foes at once. All of them dead within twenty turns.' },
};
let trial = null;   // { kind, x, y, turns, kills, need }
const trialKindAt = (x, y) => (hash32(x * 31 + y * 17 + floor * 7) & 1) ? 'blood' : 'swarm';
function trialSpawn(x, y, n) {
  const pool = (dungeonDef && dungeonDef.pool) || MONSTER_TYPES.filter((t) => !t.noSpawn && t.minFloor <= floor);
  let made = 0;
  for (let i = 0; i < n * 4 && made < n; i++) {
    const spot = freeTileNear(x + rnd(7) - 3, y + rnd(7) - 3, 1); if (!spot || cheb(spot, player) < 2 || getMonsterAt(spot.x, spot.y)) continue;
    const t = pool[rnd(pool.length)]; addMonster(t, spot.x, spot.y, { awake: true, trial }); burst(spot.x, spot.y, '#ff8c5a', 10, 80, { life: 400 }); made++;
  }
  return made;
}
function useTrial(x, y) {
  if (trial) { log(`${TRIALS[trial.kind].label} is already under way. ${trial.turns} turns to go.`, 'bad'); return; }
  const kind = trialKindAt(x, y), Tr = TRIALS[kind];
  showScene([{ who: Tr.label, sprite: 'shrine', bg: 'crypt', text: `Four standing stones round a rune that glows when you come near. The old words on them promise a reward to the proven. ${Tr.desc}`,
    choices: [
      { label: 'Take up the trial', run: () => { startTrial(kind, x, y); return `The rune flares red. ${kind === 'blood' ? 'Shapes tear themselves out of the dark on every side.' : 'Something stirs in the dark beyond the stones.'}`; } },
      { label: 'Not today', run: () => 'The glow fades. The stones can wait; they have waited long enough.' },
    ] }], () => { updateStats(); draw(); });
}
function startTrial(kind, x, y) {
  const Tr = TRIALS[kind];
  trial = { kind, x, y, turns: Tr.turns, kills: 0, need: Tr.need, started: turn };
  sfx.play('boss'); shakeScreen(3);
  if (kind === 'blood') trial.need = trialSpawn(x, y, 5) || 1;
  tip('trial', 'A trial is under way: the turns left show in the location line. Stay within twelve tiles of the stones or they go dark.');
  track('trial_start', { kind, floor });
}
function tickTrial() {
  if (!trial || scene !== 'dungeon') return;
  if (cheb(trial, player) > 12) { endTrial(false, 'You have left the stones behind. The rune goes dark.'); return; }
  trial.turns--;
  if (trial.kind === 'swarm' && trial.turns > 0 && trial.turns % 2 === 0) { if (trialSpawn(trial.x, trial.y, 1) && isVisible(trial.x, trial.y)) log('The stones send another.', 'bad'); }
  if (trial.kind === 'blood' && trial.kills >= trial.need) { endTrial(true); return; }
  if (trial.turns <= 0) { if (trial.kind === 'swarm') endTrial(true); else endTrial(false, 'The twentieth turn passes with foes still standing. The rune goes dark.'); }
}
function endTrial(won, why) {
  const { x, y, kind } = trial; trial = null;
  setTile(x, y, TILE.FLOOR); bgDirty = true;
  if (!won) { log(why, 'bad'); track('trial_fail', { kind, floor }); return; }
  const danger = dungeonDef ? dungeonDef.danger || 0 : 0;
  const gold = Math.round((40 + 20 * floor) * (1 + danger * 0.5) * goldMult());
  player.gold += gold; player.meta.trials = (player.meta.trials || 0) + 1;
  const bases = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor }).filter(([, it]) => it.floor < 99 && it.floor <= floor + 1 && !it.trade).sort((a, b) => b[1].floor - a[1].floor).slice(0, 4);
  let gift = '';
  if (bases.length && !bagFull()) {
    const [base] = bases[rnd(bases.length)], kindOf = itemKind(base), pool = Object.keys(AFFIXES[kindOf]);
    const id = `${base}~${pool[rnd(pool.length)]}~${Math.min(3, 1 + (floor >= 4 ? 1 : 0) + (kind === 'blood' ? 1 : 0))}`;
    player.bag.push(id); gift = ` and ${itemLabel(id)}`; floatText(player.x, player.y, '✦ magic', '#c084fc'); unlock('enchanted');
  } else if (bases.length) gift = '. A blade lies among the stones too, but your bag is full';
  gainXp(10 + floor * 4 + danger * 3);
  log(`${TRIALS[kind].label} is passed. The stones crumble and leave ${gold} gold${gift}.`, 'good');
  burst(x, y, '#ffd86b', 30, 120, { glow: true, gravity: 100, life: 800 }); sfx.play('win');
  unlock('proven'); if (player.meta.trials >= 10) unlock('unbroken');
  track('trial_won', { kind, floor }); updateStats();
}
function pullLever(x, y) {
  setTile(x, y, TILE.FLOOR); bgDirty = true;
  let n = 0;
  for (const ch of chunks.values()) for (let k = 0; k < ch.tiles.length; k++) if (ch.tiles[k] === TILE.TRAP) { ch.tiles[k] = TILE.FLOOR; n++; }
  revealedTraps = new Set(); shakeScreen(4); sfx.play('chest');
  log(n ? `A grinding of gears somewhere in the walls, and the spikes on this floor sink away for good: ${n} traps disarmed.` : 'A grinding of gears. Whatever this lever did, it did it somewhere else.', 'good');
}
function useAltar(x, y) {
  showScene([{ who: 'A dungeon altar', sprite: 'shrine', bg: 'crypt',
    text: 'An altar of black stone stands in the gloom, its carvings worn to nothing. A font of dark water bubbles at its foot. Something here still listens.',
    choices: [
      { label: 'Offer 50 gold', disabled: player.gold < 50, run: () => {
        player.gold -= 50; const roll = Math.random();
        if (roll < 0.4) { player.meta.blessing = { name: "altar's favour", atk: 2, def: 1, turns: 250 }; return 'The coins sink into the stone. Strength runs up your arms: +2 attack and +1 defence for 250 turns.'; }
        if (roll < 0.7) { for (const ch of chunks.values()) ch.seen.fill(1); mapCache.ox = null; bgDirty = true; return 'The coins sink into the stone, and the walls of this floor unfold in your mind: you know every passage now.'; }
        player.maxHp += 2; player.hp += 2; return 'The coins sink into the stone. You feel hardier: +2 max HP, for good.'; } },
      { label: 'Drink from the font', run: () => {
        const roll = Math.random();
        if (roll < 0.5) { const h = Math.min(player.maxHp - player.hp, Math.ceil(player.maxHp / 2)); player.hp += h; return `The water is cold and tastes of iron. You recover ${h} HP.`; }
        if (roll < 0.8) { restoreMana(); return 'The water is cold and tastes of lightning. Your mana is full.'; }
        player.poison = 4; return 'The water is cold and tastes of something that died in it. You are poisoned.'; } },
      { label: 'Leave it be', run: () => 'You step away. The bubbling slows, as if disappointed.' },
    ] }], () => { setTile(x, y, TILE.FLOOR); bgDirty = true; updateStats(); draw(); });
}
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
  floorSeed = dungeonDef && dungeonDef.seed ? hash32(dungeonDef.seed, floor, 7) : mp.instance ? hash32(mp.instance.seed, floor, 7) : hash32(Date.now() & 0xffff, floor, rnd(1e6));   // a seeded dungeon (the Daily Delve) is the same for everyone
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
  if (floor === (dungeonDef ? dungeonDef.floors : FINAL_FLOOR) || (dungeonDef && dungeonDef.endless && floor % 5 === 0) || (dungeonDef && dungeonDef.midBossFloor === floor)) {
    placeBoss(target.rooms[0], ex * CHUNK, ey * CHUNK, R);
    setTimeout(() => { log(dungeonDef && dungeonDef.midBossFloor === floor ? 'Grey cloaks hold this floor. Their captain has the key to the stairs.' : `Something large guards the stairs on this floor. Kill it to break the seal.`, 'bad'); sfx.play('boss'); }, 50);
  }
}

// ---------- visibility and pathing ----------
// Breadth-first distances from a point, out to a limit. Returns a Map of "x,y" -> steps.
function bfs(sx, sy, limit, blockMonsters, avoidHazards = false, sea = false) {
  const d = new Map([[key(sx, sy), 0]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [cx, cy] = q.shift();
    const dd = d.get(key(cx, cy));
    if (dd >= limit) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (d.has(k) || !(walkable(getTile(nx, ny)) || (sea && seaTile(nx, ny)))) continue;
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
// Projectiles: an arrow is drawn in flight from shooter to target (shaft, head and
// fletching, turned to its line, with a fading trail), and a shaman's hex as a
// glowing orb with sparks. The damage lands at once; this is what you see.
const shots = [];
function shoot(x0, y0, x1, y1, kind = 'arrow') {
  const tiles = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  shots.push({ x0, y0, x1, y1, kind, at: performance.now(), dur: Math.max(140, 55 * tiles), done: false });
}
function drawShots(g, now) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const sh = shots[i], p = Math.min(1, (now - sh.at) / sh.dur);
    const sx = sh.x0 * T - cam.x + T / 2, sy = sh.y0 * T - cam.y + T / 2, ex = sh.x1 * T - cam.x + T / 2, ey = sh.y1 * T - cam.y + T / 2;
    const ang = Math.atan2(ey - sy, ex - sx), x = sx + (ex - sx) * p, y = sy + (ey - sy) * p - Math.sin(p * Math.PI) * (sh.kind === 'arrow' ? 6 : 2);
    if (p >= 1) {
      if (!sh.done) { sh.done = true; burst(sh.x1, sh.y1, sh.kind === 'hex' ? '#c084fc' : '#d9b382', sh.kind === 'hex' ? 10 : 5, 70, { life: 260, size: 1, glow: sh.kind === 'hex' }); }
      if (now - sh.at > sh.dur + 60) shots.splice(i, 1);
      continue;
    }
    if (sh.kind === 'hex') {
      for (let k = 3; k >= 1; k--) { const q = Math.max(0, p - k * 0.07), tx = sx + (ex - sx) * q, ty = sy + (ey - sy) * q; g.globalAlpha = 0.25 - k * 0.06; g.fillStyle = '#c084fc'; g.beginPath(); g.arc(tx, ty, 4 - k * 0.6, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.shadowColor = '#c084fc'; g.shadowBlur = 10; g.fillStyle = '#e9d5ff'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#7c3aed'; g.beginPath(); g.arc(x + Math.cos(now / 40) * 5, y + Math.sin(now / 40) * 5, 1.5, 0, Math.PI * 2); g.fill();
      continue;
    }
    // the trail: two ghosts of the arrow behind it
    for (let k = 2; k >= 1; k--) { const q = Math.max(0, p - k * 0.06), tx = sx + (ex - sx) * q, ty = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 6; g.globalAlpha = 0.18 - k * 0.05; g.strokeStyle = '#e6d3a3'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx - Math.cos(ang) * 7, ty - Math.sin(ang) * 7); g.lineTo(tx + Math.cos(ang) * 7, ty + Math.sin(ang) * 7); g.stroke(); }
    g.globalAlpha = 1; g.save(); g.translate(x, y); g.rotate(ang);
    g.strokeStyle = '#1b1b2f'; g.lineWidth = 4; g.beginPath(); g.moveTo(-9, 0); g.lineTo(7, 0); g.stroke();   // outline
    g.strokeStyle = '#a0703c'; g.lineWidth = 2; g.beginPath(); g.moveTo(-9, 0); g.lineTo(6, 0); g.stroke();   // shaft
    g.fillStyle = '#e6eef8'; g.beginPath(); g.moveTo(10, 0); g.lineTo(5, -2.5); g.lineTo(5, 2.5); g.closePath(); g.fill();   // head
    g.fillStyle = '#e74c3c'; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-12, -3); g.lineTo(-7, -2.5); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-9, 0); g.lineTo(-12, 3); g.lineTo(-7, 2.5); g.closePath(); g.fill();   // fletching
    g.restore();
  }
}
const floats = [];
function floatText(x, y, text, color) {
  if (!settings.numbers && /^[-+]\d/.test(String(text))) return;
  floats.push({ x, y, text, color, at: performance.now() });
}
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
  for (const p of pets) ease(p);
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
  tianxia: ['#5b6470', '#9ca3af', '#8b929c', '#a8adb6'],
  suryadesh: ['#a16207', '#e2b76b', '#d4a85c', '#ebc47c'],
  severin: ['#4b4035', '#8a7d6a', '#7b6f5d', '#978a76'],
};
function drawCobble(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, q = T / 2;
  const P = PAVING[scene === 'world' ? realmOfTile(c, r) : 'cantons'];
  const town = scene === 'world' ? townContaining(c, r) : null, tier = town ? townTier(town) : 2;
  if (tier === 0 && noise(c, r, 107) < 0.45) {   // worn through to mud
    const n = noise(c, r, 109);
    g.fillStyle = n < 0.5 ? '#6b5236' : '#5e4830'; g.fillRect(X, Y, T, T);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X + 4 + Math.floor(n * 10), Y + 8, 8, 2); g.fillRect(X + 14, Y + 20 - Math.floor(n * 6), 6, 2);
    if (noise(c, r, 113) < 0.18) { g.fillStyle = 'rgba(110,140,170,0.55)'; g.beginPath(); g.ellipse(X + T / 2, Y + T / 2, 11, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(X + 12, Y + 13, 5, 1); }
    return;
  }
  g.fillStyle = P[0]; g.fillRect(X, Y, T, T);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const n = noise(c * 2 + i, r * 2 + j, 3);
    g.fillStyle = tier >= 3 ? ((c + r + i + j) % 2 ? P[3] : P[1]) : n < 0.33 ? P[1] : n < 0.66 ? P[2] : P[3];
    g.fillRect(X + i * q + 2, Y + j * q + 2, q - 4, q - 4);
  }
  if (tier === 0) { g.fillStyle = 'rgba(40,30,20,0.25)'; if (noise(c, r, 117) < 0.5) g.fillRect(X + 2, Y + q + 2, q - 4, q - 4); }   // missing stones
  if (tier >= 3 && (c + r) % 4 === 0) { g.fillStyle = 'rgba(255,216,107,0.35)'; g.fillRect(X + q - 2, Y + q - 2, 4, 4); }   // brass studs
}
function drawGrass(g, c, r, forest = false) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 11);
  // soft meadow tones: value noise sampled per quarter tile and mixed continuously, so patches
  // have no hard edges, with a slower yellowing noise for sun-dried stretches
  const dry = valueNoise(c, r, 63, 15);
  const dark = forest ? [40, 84, 40] : [56, 114, 52], light = forest ? [60, 118, 54] : [78, 150, 68];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = valueNoise(c + i * 0.5 + 0.25, r + j * 0.5 + 0.25, 61, 6);
    const R = Math.round(dark[0] + (light[0] - dark[0]) * v + dry * 14), G = Math.round(dark[1] + (light[1] - dark[1]) * v + dry * 6), B = Math.round(dark[2] + (light[2] - dark[2]) * v - dry * 6);
    g.fillStyle = `rgb(${R},${G},${B})`; g.fillRect(X + i * (T / 2), Y + j * (T / 2), T / 2, T / 2);
  }
  for (let k = 0; k < 6; k++) {
    const bx = X + 2 + Math.floor(noise(c * 7 + k, r, 41) * 27), by = Y + 3 + Math.floor(noise(c, r * 7 + k, 43) * 24);
    g.fillStyle = k % 3 === 0 ? (forest ? '#244a22' : '#33692f') : (forest ? '#3f7d3a' : '#5aa352');
    g.fillRect(bx, by, 1, 3); g.fillRect(bx + 1, by + 1, 1, 2);
  }
  if (n < 0.05 && !forest) { g.fillStyle = '#8b8f86'; g.fillRect(X + 18, Y + 20, 4, 3); g.fillStyle = '#a3a79c'; g.fillRect(X + 18, Y + 20, 3, 1); }
  else if (n > 0.95 && !forest) {   // a low bush
    g.fillStyle = '#2f6a2c'; g.beginPath(); g.ellipse(X + 16, Y + 20, 9, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3f8a3a'; g.beginPath(); g.ellipse(X + 13, Y + 17, 6, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5aa352'; g.fillRect(X + 11, Y + 15, 2, 1); g.fillRect(X + 18, Y + 18, 2, 1);
  } else if (n > 0.9) {   // a taller tuft
    g.fillStyle = forest ? '#4a8a44' : '#63b25a'; g.fillRect(X + 14, Y + 14, 1, 8); g.fillRect(X + 16, Y + 12, 1, 10); g.fillRect(X + 18, Y + 15, 1, 7); g.fillRect(X + 12, Y + 17, 1, 5);
  }
  if (forest && noise(c, r, 45) < 0.12) { g.fillStyle = '#4a8a44'; for (let k = 0; k < 4; k++) { g.fillRect(X + 6 + k * 5, Y + 24 - k * 2, 1, 4 + k); } }   // ferns
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
  // a shelf of sand under the shallows, scalloped, then foam along every edge that meets land
  const wet = (dx, dy) => groundAt(c + dx, r + dy) === GROUND.WATER;
  const landy = (dx, dy) => { const gg = groundAt(c + dx, r + dy); return gg !== GROUND.WATER && gg !== GROUND.DOCK; };
  edgeFringe(g, c, r, X, Y, landy, (k) => k % 2 ? 'rgba(201,181,122,0.55)' : 'rgba(214,196,140,0.55)', 2, 7);
  g.fillStyle = 'rgba(219,234,254,0.7)';
  if (!wet(0, -1)) g.fillRect(X, Y, T, 3);
  if (!wet(0, 1)) g.fillRect(X, Y + T - 3, T, 3);
  if (!wet(-1, 0)) g.fillRect(X, Y, 3, T);
  if (!wet(1, 0)) g.fillRect(X + T - 3, Y, 3, T);
  g.fillStyle = 'rgba(191,219,254,0.3)';
  if (!wet(0, -1)) g.fillRect(X, Y + 3, T, 3);
  if (!wet(-1, 0)) g.fillRect(X + 3, Y, 3, T);
}
function drawWaystone(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(X + T / 2 + 2, Y + T - 4, 12, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6b7684'; g.beginPath(); g.moveTo(X + 8, Y + T - 3); g.lineTo(X + 7, Y + 10); g.quadraticCurveTo(X + 8, Y + 2, X + 16, Y + 2); g.quadraticCurveTo(X + 25, Y + 3, X + 25, Y + 11); g.lineTo(X + 24, Y + T - 3); g.closePath(); g.fill();
  g.fillStyle = '#8a95a3'; g.beginPath(); g.moveTo(X + 9, Y + T - 4); g.lineTo(X + 9, Y + 10); g.quadraticCurveTo(X + 10, Y + 4, X + 16, Y + 4); g.lineTo(X + 18, Y + 4); g.lineTo(X + 18, Y + T - 4); g.closePath(); g.fill();   // the lit face
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(X + 10, Y + 6, 2, 14);
  g.fillStyle = '#7bdfff';   // the runes
  for (const [rx, ry, w2, h2] of [[13, 9, 2, 2], [15, 11, 2, 1], [13, 13, 4, 1], [17, 15, 2, 2], [14, 18, 2, 2], [16, 21, 3, 1], [13, 23, 2, 2]]) g.fillRect(X + rx, Y + ry, w2, h2);
  g.fillStyle = '#3f8a3a'; g.fillRect(X + 6, Y + T - 5, 5, 3); g.fillRect(X + 22, Y + T - 4, 6, 3); g.fillStyle = '#5aa352'; g.fillRect(X + 7, Y + T - 6, 2, 1);   // moss at the foot
}
// the waystone's light breathes, so it is drawn over the cached ground every frame
function drawWaystoneGlows(g, now) {
  for (const t of nearbyTowns(player.x, player.y, 1)) {
    const x = (t.cx + 4) * T - cam.x + T / 2, y = t.cy * T - cam.y + T / 2;
    if (x < -T || y < -T || x > canvas.width + T || y > canvas.height + T) continue;
    const a = 0.22 + 0.1 * Math.sin(now / 600);
    const rg = g.createRadialGradient(x, y, 2, x, y, T * 1.1); rg.addColorStop(0, `rgba(123,223,255,${a})`); rg.addColorStop(1, 'rgba(123,223,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, T * 1.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(200,245,255,${0.5 + 0.4 * Math.sin(now / 300)})`; g.fillRect(x - 3, y - 7, 4, 1); g.fillRect(x + 1, y - 1, 2, 2);   // a rune catching the light
  }
}
function drawSand(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 23);
  g.fillStyle = n < 0.5 ? '#e7d3a1' : '#dfc78f'; g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(0,0,0,0.05)'; for (let k = 0; k < 3; k++) g.fillRect(X, Y + 6 + k * 10 + Math.floor(noise(c, r + k, 24) * 4), T, 1);   // wind ripples
  g.fillStyle = '#cdb272'; if (n < 0.3) g.fillRect(X + 9, Y + 14, 3, 3); else if (n < 0.6) g.fillRect(X + 20, Y + 6, 2, 2);
  if (n > 0.8) { g.fillStyle = '#b89a5c'; g.fillRect(X + 22, Y + 20, 3, 2); g.fillStyle = '#f3e6c4'; g.fillRect(X + 6, Y + 24, 2, 2); }   // pebbles and a shell
  // grass laps over the sand in a scalloped fringe, and rounds off the corners
  const grassy = (dx, dy) => { const gg = groundAt(c + dx, r + dy); return gg === GROUND.GRASS || gg === GROUND.FOREST || gg === GROUND.TREE; };
  edgeFringe(g, c, r, X, Y, grassy, (k) => k % 2 ? '#468b3e' : '#3f8039');
  let wetSide = null; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (groundAt(c + dx, r + dy) === GROUND.WATER) { wetSide = [dx, dy]; break; }
  if (wetSide) { g.fillStyle = 'rgba(120,100,60,0.25)'; const [dx, dy] = wetSide; g.fillRect(dx === 1 ? X + T - 6 : X, dy === 1 ? Y + T - 6 : Y, dx ? 6 : T, dy ? 6 : T); }   // damp sand by the water
}
function drawMountain(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 25), n2 = noise(c, r, 28);
  // how deep into the range this tile sits: the fringe is foothill, the heart is high and snowy
  let ring = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && groundAt(c + dx, r + dy) === GROUND.MOUNTAIN) ring++;
  const snowy = r < ICE_Y, tone = valueNoise(c, r, 77, 5);
  // the ground shows at the fringe so the range has a rounded foot instead of a square edge
  if (ring < 8) { if (snowy) drawSnow(g, c, r); else drawGrass(g, c, r); }
  const rock = `rgb(${Math.round(92 + tone * 30)},${Math.round(96 + tone * 26)},${Math.round(104 + tone * 24)})`, dark = `rgb(${Math.round(60 + tone * 20)},${Math.round(64 + tone * 18)},${Math.round(74 + tone * 16)})`, lit = `rgb(${Math.round(126 + tone * 30)},${Math.round(130 + tone * 26)},${Math.round(140 + tone * 22)})`;
  const up = groundAt(c, r - 1) === GROUND.MOUNTAIN, down = groundAt(c, r + 1) === GROUND.MOUNTAIN, left = groundAt(c - 1, r) === GROUND.MOUNTAIN, right = groundAt(c + 1, r) === GROUND.MOUNTAIN;
  if (ring >= 8) { g.fillStyle = rock; g.fillRect(X, Y, T, T); }
  else {   // a rounded mass of rock, pushed toward its neighbours
    g.fillStyle = rock; g.beginPath();
    g.ellipse(X + T / 2 + (right ? 4 : 0) - (left ? 4 : 0), Y + T / 2 + (down ? 5 : 0) - (up ? 5 : 0), T / 2 + (left && right ? 4 : 1), T / 2 + (up && down ? 4 : 1), 0, 0, Math.PI * 2); g.fill();
    if (up) g.fillRect(X + 2, Y, T - 4, T / 2); if (down) g.fillRect(X + 2, Y + T / 2, T - 4, T / 2); if (left) g.fillRect(X, Y + 2, T / 2, T - 4); if (right) g.fillRect(X + T / 2, Y + 2, T / 2, T - 4);
  }
  g.fillStyle = 'rgba(0,0,0,0.1)'; for (let k = 0; k < 3; k++) g.fillRect(X + 2, Y + 7 + k * 9 + Math.floor(noise(c, r + k, 26) * 3), T - 4, 1);   // strata
  const px = X + T / 2 + Math.floor((n - 0.5) * 10), top = Y + 3 + Math.floor(n2 * 6);
  if (n > 0.42 || ring >= 8) {   // a peak with a lit and a shaded face
    g.fillStyle = dark; g.beginPath(); g.moveTo(X + 1, Y + T - 2); g.lineTo(px, top); g.lineTo(X + T - 1, Y + T - 2); g.closePath(); g.fill();
    g.fillStyle = lit; g.beginPath(); g.moveTo(X + 1, Y + T - 2); g.lineTo(px, top); g.lineTo(px + 1, Y + T - 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px, top + 2, 1, T - top + Y - 5);   // the ridge line
  } else {   // a shoulder of boulders
    g.fillStyle = dark; g.beginPath(); g.ellipse(X + 11, Y + 20, 10, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = lit; g.beginPath(); g.ellipse(X + 9, Y + 18, 7, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark; g.beginPath(); g.ellipse(X + 23, Y + 23, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = lit; g.beginPath(); g.ellipse(X + 22, Y + 21, 5, 3, 0, 0, Math.PI * 2); g.fill();
  }
  if (ring >= 8 || snowy) {   // snow lies on the high ground deep in a range, ragged at its edge
    g.fillStyle = snowy ? '#eef3f8' : '#e5e7eb';
    g.beginPath(); g.ellipse(px, top + 6, 8, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(px - 4 + Math.floor(n * 6), top + 11, 6, 3, 0, 0, Math.PI * 2); g.fill();
    if (ring >= 8 && (snowy || n2 > 0.5)) { g.fillStyle = 'rgba(238,243,248,0.85)'; g.beginPath(); g.ellipse(X + 8 + Math.floor(n * 10), Y + 24, 9, 4, 0, 0, Math.PI * 2); g.fill(); }
  } else if (n2 > 0.7) { g.fillStyle = lit; g.fillRect(X + 6, Y + T - 7, 3, 2); g.fillRect(X + 22, Y + T - 5, 2, 2); }   // scree
}
function drawRoad(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 27);
  g.fillStyle = n < 0.5 ? '#a8865a' : '#9f7e53'; g.fillRect(X, Y, T, T);
  // wheel ruts run the way the road does
  const road = (dx, dy) => groundAt(c + dx, r + dy) === GROUND.ROAD || groundAt(c + dx, r + dy) === GROUND.COBBLE;
  const horiz = road(1, 0) || road(-1, 0), vert = road(0, 1) || road(0, -1);
  g.fillStyle = 'rgba(0,0,0,0.13)';
  if (horiz && !(vert && !horiz)) { g.fillRect(X, Y + 10, T, 2); g.fillRect(X, Y + 21, T, 2); }
  if (vert && !horiz) { g.fillRect(X + 10, Y, 2, T); g.fillRect(X + 21, Y, 2, T); }
  g.fillStyle = '#8c6d45'; if (n < 0.35) g.fillRect(X + 8, Y + 14, 4, 3); else if (n < 0.7) g.fillRect(X + 20, Y + 24, 3, 3);
  if (n > 0.85) { g.fillStyle = '#7d8795'; g.fillRect(X + 3, Y + 4, 3, 3); }   // an edge stone
  const grassAt = (dx, dy) => { const gg = groundAt(c + dx, r + dy); return gg === GROUND.GRASS || gg === GROUND.FOREST; };
  g.fillStyle = 'rgba(70,130,60,0.5)';   // a ragged green edge where the verge meets the road
  if (grassAt(0, -1)) for (let k = 0; k < T; k += 5) if (noise(c * 9 + k, r, 31) < 0.6) g.fillRect(X + k, Y, 3, 2);
  if (grassAt(0, 1)) for (let k = 0; k < T; k += 5) if (noise(c * 9 + k, r, 33) < 0.6) g.fillRect(X + k, Y + T - 2, 3, 2);
  if (grassAt(-1, 0)) for (let k = 0; k < T; k += 5) if (noise(c, r * 9 + k, 35) < 0.6) g.fillRect(X, Y + k, 2, 3);
  if (grassAt(1, 0)) for (let k = 0; k < T; k += 5) if (noise(c, r * 9 + k, 37) < 0.6) g.fillRect(X + T - 2, Y + k, 2, 3);
}
// Fields around the towns that live off the land: crop rows, vines or pasture.
const FIELD_TRADES = { farming: 'crop', wine: 'vine', wool: 'pasture', bees: 'meadow', horses: 'pasture', rice: 'crop', tea: 'vine', cotton: 'meadow', spices: 'meadow' };
function fieldAt(c, r) {
  for (const t of nearbyTowns(c, r, 1)) {
    const kind = FIELD_TRADES[townIdentity(t).tradeId]; if (!kind) continue;
    const dx = c < t.x0 ? t.x0 - c : c >= t.x0 + tw(t) ? c - (t.x0 + tw(t)) + 1 : 0, dy = r < t.y0 ? t.y0 - r : r >= t.y0 + th(t) ? r - (t.y0 + th(t)) + 1 : 0;
    if (!dx && !dy) continue;   // inside the walls
    if (dx > 9 || dy > 7) continue;
    if (Math.abs(c - t.cx) <= 2) continue;   // keep the roads out of town clear
    if (valueNoise(c, r, 77, 5) < 0.42) continue;   // fields in patches, not a solid ring
    return kind;
  }
  return null;
}
function drawField(g, c, r, kind) {
  const X = c * T - off.x, Y = r * T - off.y;
  if (kind === 'crop') {
    g.fillStyle = '#6b4f2a'; g.fillRect(X, Y, T, T);
    for (let k = 0; k < 4; k++) { g.fillStyle = '#5a401f'; g.fillRect(X, Y + 2 + k * 8, T, 2); g.fillStyle = (c + r) % 3 ? '#b7a23a' : '#7fa83a'; for (let x = 1; x < T; x += 4) g.fillRect(X + x, Y + 4 + k * 8, 2, 3); }
  } else if (kind === 'vine') {
    g.fillStyle = '#5f7a3a'; g.fillRect(X, Y, T, T);
    for (let k = 0; k < 3; k++) { const vy = Y + 4 + k * 10; g.fillStyle = '#5b3a1a'; g.fillRect(X, vy + 4, T, 1); for (let x = 2; x < T; x += 8) { g.fillStyle = '#5b3a1a'; g.fillRect(X + x, vy, 1, 8); g.fillStyle = '#2f6a2c'; g.fillRect(X + x - 2, vy + 1, 5, 4); g.fillStyle = '#6b21a8'; if (noise(c + x, r + k, 39) < 0.5) g.fillRect(X + x + 1, vy + 5, 2, 2); } }
  } else if (kind === 'meadow') {
    drawGrass(g, c, r); for (let k = 0; k < 5; k++) { g.fillStyle = ['#ffd86b', '#f4f4f4', '#ff9ecf', '#c084fc'][(k + c) % 4]; g.fillRect(X + 3 + ((k * 7 + c) % 26), Y + 3 + ((k * 11 + r) % 26), 2, 2); }
  } else {   // pasture: cropped grass with a post-and-rail fence on the town side
    drawGrass(g, c, r); g.fillStyle = 'rgba(200,236,150,0.22)'; g.fillRect(X, Y, T, T);   // the same soft meadow, grazed paler
    g.fillStyle = '#4f8a46'; for (let k = 0; k < 4; k++) g.fillRect(X + 3 + ((k * 9 + r) % 26), Y + 5 + ((k * 7 + c) % 24), 2, 1);
    if (noise(c, r, 47) < 0.12) { g.fillStyle = '#f4f4f4'; g.beginPath(); g.ellipse(X + 16, Y + 18, 6, 4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1b1b2f'; g.fillRect(X + 20, Y + 15, 3, 3); g.fillRect(X + 12, Y + 21, 1, 3); g.fillRect(X + 18, Y + 21, 1, 3); }   // a sheep
    if (!fieldAt(c, r - 1)) { g.fillStyle = '#6b4423'; g.fillRect(X, Y + 2, T, 2); g.fillRect(X + 4, Y, 2, 8); g.fillRect(X + 24, Y, 2, 8); }   // the fence
  }
}
function drawSnow(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {   // drifts: soft blue-white patches
    const v = valueNoise(c + i * 0.5 + 0.25, r + j * 0.5 + 0.25, 65, 7);
    g.fillStyle = `rgb(${Math.round(214 + v * 30)},${Math.round(226 + v * 24)},${Math.round(240 + v * 15)})`; g.fillRect(X + i * (T / 2), Y + j * (T / 2), T / 2, T / 2);
  }
  const n = noise(c, r, 13);
  g.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 4; k++) g.fillRect(X + 3 + Math.floor(noise(c * 5 + k, r, 15) * 26), Y + 3 + Math.floor(noise(c, r * 5 + k, 17) * 26), 1, 1);   // a glitter
  if (n < 0.08) { g.fillStyle = '#7f8a96'; g.fillRect(X + 14, Y + 18, 7, 5); g.fillStyle = '#e8f1f8'; g.fillRect(X + 14, Y + 17, 6, 2); }   // a rock under a cap of snow
  else if (n > 0.93) { g.fillStyle = 'rgba(120,150,180,0.35)'; g.fillRect(X + 6, Y + 22, 20, 2); g.fillRect(X + 10, Y + 12, 14, 2); }   // wind-scoured ridges
}
// A scalloped fringe of the neighbouring material along each edge that meets it,
// with a rounded fill in corners where two such edges meet, so tile borders melt.
function edgeFringe(g, c, r, X, Y, meets, colorOf, lo = 3, hi = 8) {
  const top = meets(0, -1), bottom = meets(0, 1), left = meets(-1, 0), right = meets(1, 0);
  for (let k = 0; k < T; k += 4) {
    const h = lo + Math.floor(noise(c * 8 + k, r, 25) * (hi - lo)), v = lo + Math.floor(noise(c, r * 8 + k, 26) * (hi - lo));
    g.fillStyle = colorOf(k / 4);
    if (top) g.fillRect(X + k, Y, 4, h);
    if (bottom) g.fillRect(X + k, Y + T - h, 4, h);
    if (left) g.fillRect(X, Y + k, v, 4);
    if (right) g.fillRect(X + T - v, Y + k, v, 4);
  }
  g.fillStyle = colorOf(0);
  const corner = (cx, cy, a0) => { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, hi + 4, a0, a0 + Math.PI / 2); g.closePath(); g.fill(); };
  if (top && left) corner(X, Y, 0);
  if (top && right) corner(X + T, Y, Math.PI / 2);
  if (bottom && right) corner(X + T, Y + T, Math.PI);
  if (bottom && left) corner(X, Y + T, Math.PI * 1.5);
}
function drawDock(g, c, r) {
  drawWater(g, c, r);
  const X = c * T - off.x, Y = r * T - off.y;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X + 4, Y + 6, T - 6, T - 8);
  g.fillStyle = '#8b5a2b'; g.fillRect(X + 2, Y + 4, T - 4, T - 8);
  g.fillStyle = '#6b4423'; for (let k = 0; k < 5; k++) g.fillRect(X + 2, Y + 4 + k * 5, T - 4, 1);
  g.fillStyle = '#5b3a1a'; g.fillRect(X + 2, Y + 4, 3, T - 8); g.fillRect(X + T - 5, Y + 4, 3, T - 8);
  g.fillStyle = '#3b2a1a'; g.fillRect(X + 1, Y + 2, 3, 6); g.fillRect(X + T - 4, Y + T - 8, 3, 6);   // mooring posts
}
function drawRampart(g, c, r) {
  const X = c * T - off.x, Y = r * T - off.y, n = noise(c, r, 29);
  const town = scene === 'world' ? townContaining(c, r) : null, royal = !!town && town.size === 'grand';
  g.fillStyle = royal ? (n < 0.5 ? '#7c8aa3' : '#70809a') : n < 0.5 ? '#64748b' : '#5b6b7f'; g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X, Y + T / 2 - 1, T, 2); g.fillRect(X + (n < 0.5 ? T / 2 : T / 4), Y, 2, T / 2); g.fillRect(X + (n < 0.5 ? T / 4 : T * 0.7), Y + T / 2, 2, T / 2);
  if (groundAt(c, r - 1) !== GROUND.RAMPART) { g.fillStyle = royal ? '#d6bd62' : '#94a3b8'; for (let i = 0; i < T; i += 8) g.fillRect(X + i, Y, 4, 5); }
  if (royal) { const sec = grandSecret(town, c - town.x0, r - town.y0); if (sec && !sec.open) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X + 13, Y + 4, 1, 9); g.fillRect(X + 14, Y + 12, 1, 7); g.fillRect(X + 16, Y + 18, 1, 8); g.fillStyle = 'rgba(90,140,70,0.6)'; g.fillRect(X + 11, Y + 24, 3, 2); } }
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y + T - 3, T, 3);
}
// ---------- buildings ----------
// Each building is drawn from its realm's style (timber and plaster in the Cantons,
// stone in the Kingdom, logs in the Clans, marble in the League) with special
// touches for the important ones: battlements, banners, columns, awnings, forges.
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return `#${((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')}`;
};
// How prosperous a town looks: Hearth and its neighbours are ramshackle, and towns
// grow finer the further the adventure takes you. Castles and capitals do better.
const TIER_WORDS = ['ramshackle', 'modest', 'thriving', 'prosperous', 'grand'];
function townTier(town) {
  if (!town) return 1;
  if (town.i === 0 && town.j === 0) return 0;
  if (town.size === 'grand') return 4;
  const d = Math.max(Math.abs(town.i), Math.abs(town.j));
  let tier = d <= 1 ? 0 : d === 2 ? 1 : d === 3 ? 2 : 3;
  if (town.capital || town.walled) tier += 1;
  if (town.projects && town.projects.size >= 3) tier += 1;   // a rebuilt town prospers
  return Math.min(4, tier);
}
const STONE_IDS = new Set(['keep', 'throne', 'royal', 'watch', 'herald', 'arena', 'armoury', 'smithy']);
const MARBLE_IDS = new Set(['council', 'townhall', 'exchange']);
const CHIMNEY_IDS = new Set(['inn', 'home', 'cottage', 'herbs', 'smithy', 'apothecary', 'longhouse', 'shamanhut', 'shop', 'prikaz', 'terem']);
const BANNER_IDS = new Set(['throne', 'keep', 'herald', 'arena', 'royal']);
const PARAPET_IDS = new Set(['keep', 'arena', 'watch']);
const SIGN_ICON = { shop: 'gold', market: 'gold', inn: 'bed', herbs: 'potion', apothecary: 'potion', exchange: 'gold', smithy: 'rack', armoury: 'rack', royal: 'rack', watch: 'lamp' };
function houseStyle(h) {
  const town = h.town ? townAt(...h.town.split(',').map(Number)) : null, realm = town ? town.realm || 'cantons' : 'cantons';
  let wall = { cantons: 'timber', aurum: 'stone', kathar: 'log', league: 'marble', tianxia: 'lacquer', suryadesh: 'sandstone', severin: 'log' }[realm];
  const far = FAR_REALMS.includes(realm);
  if (!far && realm !== 'kathar' && STONE_IDS.has(h.id)) wall = 'stone';
  if (!far && realm !== 'kathar' && MARBLE_IDS.has(h.id)) wall = 'marble';
  if (h.id === 'longhouse' || h.id === 'shamanhut') wall = 'log';
  // the Far Shore builds its own way: upturned pagoda eaves, flat terraces with domes, painted planks and onion domes
  const roof = realm === 'tianxia' ? 'pagoda' : realm === 'suryadesh' ? (['durbar', 'kacheri', 'keep', 'watch'].includes(h.id) ? 'dome' : 'flat') : realm === 'severin' ? (['terem', 'prikaz', 'keep'].includes(h.id) ? 'onion' : 'plank')
    : wall === 'log' ? 'thatch' : PARAPET_IDS.has(h.id) && wall === 'stone' ? 'parapet' : MARBLE_IDS.has(h.id) && wall === 'marble' ? 'pediment' : wall === 'stone' ? 'slate' : 'tiles';
  return { realm, wall, roof, accent: REALMS[realm] ? REALMS[realm].color : '#5fe17a' };
}
// Window centres along the front wall, kept clear of the door.
function houseWindows(h) {
  const X = h.x * T, W = h.w * T, doorC = h.doorX * T + T / 2, out = [];
  const step = h.w >= 10 ? 44 : 38;
  for (let wx = X + 22; wx < X + W - 16; wx += step) if (Math.abs(wx - doorC) > 26) out.push(wx);
  return out;
}
function drawHouse(g, h) {
  const X = h.x * T - off.x, Y = h.y * T - off.y, W = h.w * T, H = h.h * T, roofH = Math.floor(H * 0.48);
  const st = houseStyle(h), seed = (h.x * 31 + h.y * 17) >>> 0;
  const tier = townTier(h.town ? townAt(...h.town.split(',').map(Number)) : null), shabby = tier === 0, fine = tier >= 3;
  const wallY = Y + roofH, wallH = H - roofH, dX = h.doorX * T - off.x + 6;
  // shadow cast down and right
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X + 8, Y + 12, W, H);

  // ----- walls -----
  if (st.wall === 'timber') {
    g.fillStyle = '#ead9b5'; g.fillRect(X, wallY, W, wallH);
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < W; i += 7) if (noise(seed + i, 3, 41) < 0.4) g.fillRect(X + i, wallY + 4 + (i * 7) % (wallH - 8), 3, 2);
    g.fillStyle = '#5b3a1a';
    g.fillRect(X, wallY, W, 4); g.fillRect(X, Y + H - 9, W, 4);
    const posts = Math.max(2, Math.round(W / 52));
    for (let k = 0; k <= posts; k++) {
      const px = X + Math.round((W - 5) * k / posts);
      g.fillRect(px, wallY, 5, wallH - 6);
      if (k < posts && k % 2 === 0) {   // a diagonal brace in every other bay
        const nx = X + Math.round((W - 5) * (k + 1) / posts);
        g.save(); g.strokeStyle = '#5b3a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(px + 4, wallY + 4); g.lineTo(Math.min(nx, px + 30), wallY + Math.min(wallH - 10, 26)); g.stroke(); g.restore();
      }
    }
  } else if (st.wall === 'stone') {
    g.fillStyle = '#7e838d'; g.fillRect(X, wallY, W, wallH);
    for (let row = 0, y = wallY; y < Y + H - 5; row++, y += 9) {
      for (let x = X - (row % 2 ? 9 : 0); x < X + W; x += 18) {
        const n = noise(seed + x, y, 47);
        g.fillStyle = n < 0.33 ? '#9aa0aa' : n < 0.66 ? '#8d929c' : '#a5abb5';
        g.fillRect(Math.max(X, x + 1), y + 1, Math.min(16, X + W - x - 1, x + 17 - X), 7);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X, wallY, W, 2);
  } else if (st.wall === 'log') {
    g.fillStyle = '#4a2f17'; g.fillRect(X, wallY, W, wallH);
    for (let y = wallY + 1; y < Y + H - 4; y += 8) {
      g.fillStyle = noise(seed, y, 53) < 0.5 ? '#8b5a2b' : '#7d5026'; g.beginPath(); g.roundRect(X - 3, y, W + 6, 7, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(X, y + 1, W, 1);
      g.fillStyle = '#c69863'; g.beginPath(); g.arc(X - 2, y + 3.5, 3.5, 0, Math.PI * 2); g.arc(X + W + 2, y + 3.5, 3.5, 0, Math.PI * 2); g.fill();
    }
  } else if (st.wall === 'lacquer') {   // whitewashed plaster between red-lacquered posts, with lattice panels
    g.fillStyle = '#f1e4c8'; g.fillRect(X, wallY, W, wallH);
    g.fillStyle = '#a3261c'; g.fillRect(X, wallY, W, 3); g.fillRect(X, Y + H - 8, W, 4);
    const posts = Math.max(2, Math.round(W / 44));
    for (let k = 0; k <= posts; k++) { const px = X + Math.round((W - 6) * k / posts); g.fillStyle = '#a3261c'; g.fillRect(px, wallY, 6, wallH - 4); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px + 1, wallY, 1, wallH - 4); }
    g.fillStyle = 'rgba(120,40,30,0.35)'; for (let x = X + 10; x < X + W - 10; x += 6) g.fillRect(x, wallY + 8, 1, Math.max(0, wallH - 22));
  } else if (st.wall === 'sandstone') {   // warm sandstone blocks with a carved band
    g.fillStyle = '#c99a5b'; g.fillRect(X, wallY, W, wallH);
    for (let row = 0, y = wallY; y < Y + H - 5; row++, y += 9) for (let x = X - (row % 2 ? 9 : 0); x < X + W; x += 18) {
      const n = noise(seed + x, y, 49); g.fillStyle = n < 0.33 ? '#d9ab6a' : n < 0.66 ? '#cfa062' : '#e3b874';
      g.fillRect(Math.max(X, x + 1), y + 1, Math.min(16, X + W - x - 1, x + 17 - X), 7);
    }
    g.fillStyle = '#8c4a1f'; g.fillRect(X, wallY + 3, W, 3); g.fillStyle = '#f5d58a'; for (let x = X + 4; x < X + W - 4; x += 10) g.fillRect(x, wallY + 3, 4, 3);
  } else {   // marble
    g.fillStyle = '#e9e6f0'; g.fillRect(X, wallY, W, wallH);
    g.fillStyle = '#d3cfde'; g.fillRect(X, wallY, W, 5);
    const cols = Math.max(2, Math.round(W / 40));
    for (let k = 0; k <= cols; k++) {
      const cx = X + 3 + Math.round((W - 14) * k / cols);
      if (Math.abs(cx + 4 - (dX + 10)) < 18) continue;
      g.fillStyle = '#f7f5fb'; g.fillRect(cx, wallY + 5, 8, wallH - 10);
      g.fillStyle = '#c4bfd3'; g.fillRect(cx + 6, wallY + 5, 2, wallH - 10);
      g.fillStyle = '#d3cfde'; g.fillRect(cx - 2, wallY + 4, 12, 3); g.fillRect(cx - 2, Y + H - 8, 12, 3);
    }
  }
  if (shabby) {
    // grime, cracks and fallen plaster
    const gg = g.createLinearGradient(0, wallY, 0, Y + H); gg.addColorStop(0, 'rgba(40,30,20,0.08)'); gg.addColorStop(1, 'rgba(40,30,20,0.35)');
    g.fillStyle = gg; g.fillRect(X, wallY, W, wallH);
    for (let k = 0; k < Math.max(2, Math.round(W / 50)); k++) {
      const px = X + 8 + Math.floor(noise(seed, k, 71) * (W - 30)), py = wallY + 6 + Math.floor(noise(seed, k, 73) * Math.max(4, wallH - 22));
      if (st.wall === 'timber' || st.wall === 'marble') { g.fillStyle = '#9b7a55'; g.fillRect(px, py, 14, 9); g.fillStyle = '#6b4c2e'; for (let l = 0; l < 3; l++) g.fillRect(px + 1, py + 2 + l * 3, 12, 1); }
      g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 18, py - 4); g.lineTo(px + 22, py + 4); g.lineTo(px + 19, py + 10); g.stroke();
    }
  }
  // stone footing along the ground
  g.fillStyle = shabby ? '#4b4f57' : '#5f646e'; g.fillRect(X - 2, Y + H - 5, W + 4, 5);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X - 2, Y + H - 5, W + 4, 1);
  if (shabby) { g.fillStyle = '#3f6b3a'; for (let x = X; x < X + W; x += 9) if (noise(seed, x, 79) < 0.45) g.fillRect(x, Y + H - 8, 3, 4); }   // weeds

  // ----- windows -----
  const winY = wallY + Math.max(8, Math.floor((wallH - 22) / 2) - 2);
  for (const wxAbs of houseWindows(h)) {
    const wx = wxAbs - off.x - 7;
    if (st.wall === 'marble') {   // tall arched windows
      g.fillStyle = '#4b4566'; g.beginPath(); g.roundRect(wx - 1, winY - 3, 16, 22, [8, 8, 1, 1]); g.fill();
      g.fillStyle = '#8fb8e6'; g.beginPath(); g.roundRect(wx + 1, winY - 1, 12, 18, [6, 6, 0, 0]); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(wx + 3, winY + 2, 2, 8);
      continue;
    }
    if (PARAPET_IDS.has(h.id)) {   // arrow slits in a fortress wall
      g.fillStyle = '#1b1f2a'; g.fillRect(wx + 5, winY - 2, 4, 18); g.fillRect(wx + 2, winY + 5, 10, 3);
      continue;
    }
    if (shabby) {
      g.fillStyle = '#2b2018'; g.fillRect(wx - 1, winY - 2, 16, 19);
      if (noise(seed, wxAbs, 83) < 0.45) {   // boarded up
        g.fillStyle = '#1b1510'; g.fillRect(wx + 1, winY, 12, 15);
        g.fillStyle = '#7a5a3a'; g.save(); g.translate(wx + 7, winY + 7); g.rotate(-0.5); g.fillRect(-10, -2, 20, 4); g.rotate(1.0); g.fillRect(-10, -2, 20, 4); g.restore();
      } else {
        g.fillStyle = '#6f8794'; g.fillRect(wx + 1, winY, 12, 15);
        g.fillStyle = '#2b2018'; g.fillRect(wx + 6, winY, 2, 15); g.fillRect(wx + 1, winY + 7, 12, 2);
        g.fillStyle = '#1b1510'; g.beginPath(); g.moveTo(wx + 8, winY + 9); g.lineTo(wx + 13, winY + 9); g.lineTo(wx + 13, winY + 15); g.fill();   // a broken pane
      }
      if (st.wall !== 'stone' && noise(seed, wxAbs, 89) < 0.5) {   // one shutter, hanging askew
        g.save(); g.translate(wx + 17, winY - 1); g.rotate(0.18); g.fillStyle = shade(st.accent, -0.6); g.fillRect(0, 0, 5, 16); g.restore();
      }
      continue;
    }
    if (st.wall !== 'stone' && tier >= 2) {   // painted shutters
      g.fillStyle = shade(st.accent, -0.35); g.fillRect(wx - 6, winY - 1, 5, 17); g.fillRect(wx + 15, winY - 1, 5, 17);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 6, winY + 7, 5, 1); g.fillRect(wx + 15, winY + 7, 5, 1);
    }
    g.fillStyle = fine ? '#c79a3a' : '#3b2a1a'; g.fillRect(wx - 1, winY - 2, 16, 19);
    g.fillStyle = '#9fd4ff'; g.fillRect(wx + 1, winY, 12, 15);
    if (fine) { g.fillStyle = 'rgba(255,216,107,0.35)'; g.fillRect(wx + 1, winY, 5, 7); g.fillStyle = 'rgba(192,132,252,0.3)'; g.fillRect(wx + 8, winY + 9, 5, 6); }
    g.fillStyle = fine ? '#8a6a22' : '#3b2a1a'; g.fillRect(wx + 6, winY, 2, 15); g.fillRect(wx + 1, winY + 7, 12, 2);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(wx + 2, winY + 1, 3, 3);
    if (tier >= 2 && (fine || noise(seed, wxAbs, 59) < 0.55)) {   // a flower box under the sill
      g.fillStyle = '#6b4423'; g.fillRect(wx - 2, winY + 17, 18, 4);
      for (let f = 0; f < 5; f++) { g.fillStyle = ['#ff6b9b', '#ffd86b', '#e74c3c', '#c084fc'][(f + seed) % 4]; g.fillRect(wx - 1 + f * 4, winY + 14, 3, 3); }
      g.fillStyle = '#3f7d3a'; g.fillRect(wx - 1, winY + 16, 16, 1);
    }
  }
  if (h.id === 'arena') {   // great arches onto the sand
    for (let k = 0; k < 3; k++) { const ax = X + 10 + k * (W - 20) / 3; if (Math.abs(ax + 10 - (dX + 10)) < 22) continue; g.fillStyle = '#2b2f3a'; g.beginPath(); g.roundRect(ax, wallY + 8, 22, wallH - 14, [11, 11, 0, 0]); g.fill(); g.fillStyle = '#c2a36b'; g.fillRect(ax + 2, Y + H - 9, 18, 3); }
  }
  if (h.id === 'smithy') {   // the forge's glow by the door
    const fx = dX - 30; g.fillStyle = '#2b1a10'; g.fillRect(fx, wallY + 10, 18, 16);
    const fg = g.createRadialGradient(fx + 9, wallY + 22, 1, fx + 9, wallY + 22, 14); fg.addColorStop(0, '#ffd86b'); fg.addColorStop(0.5, '#ff7a1a'); fg.addColorStop(1, 'rgba(120,30,0,0.6)');
    g.fillStyle = fg; g.fillRect(fx + 2, wallY + 12, 14, 12);
  }

  // ----- the door, its step and a lantern -----
  g.fillStyle = st.wall === 'marble' ? '#c4bfd3' : st.wall === 'stone' ? '#5f646e' : '#3b2a1a';
  g.beginPath(); g.roundRect(dX - 3, Y + H - 28, 26, 28, [12, 12, 0, 0]); g.fill();
  g.fillStyle = h.id === 'arena' ? '#2b2f3a' : '#6b4423'; g.beginPath(); g.roundRect(dX, Y + H - 25, 20, 25, [10, 10, 0, 0]); g.fill();
  if (h.id !== 'arena') {
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < 4; k++) g.fillRect(dX + k * 5, Y + H - 23, 1, 23);
    g.fillStyle = '#3b2a1a'; g.fillRect(dX, Y + H - 17, 20, 2); g.fillRect(dX, Y + H - 7, 20, 2);
    g.fillStyle = '#ffd86b'; g.fillRect(dX + 14, Y + H - 13, 3, 3);
  }
  g.fillStyle = shabby ? '#6b7280' : '#9ca3af'; g.fillRect(dX - 4, Y + H, shabby ? 18 : 28, 3);
  const lantern = (lx) => { g.fillStyle = '#1b1b2f'; g.fillRect(lx - 2, Y + H - 26, 6, 2); g.fillRect(lx + 2, Y + H - 26, 2, 4); g.fillStyle = '#ffd86b'; g.fillRect(lx, Y + H - 22, 6, 7); g.fillStyle = '#1b1b2f'; g.fillRect(lx, Y + H - 22, 6, 1); g.fillRect(lx, Y + H - 16, 6, 1); };
  if (!shabby) lantern(dX + 28);
  if (fine) { lantern(dX - 14); g.fillStyle = '#c79a3a'; g.fillRect(dX - 3, Y + H - 28, 26, 2); g.fillRect(dX + 2, Y + H - 14, 2, 2); g.fillRect(dX + 16, Y + H - 14, 2, 2); }

  // ----- awnings and banners -----
  if (h.id === 'shop' || h.id === 'market') {
    const aw = Math.min(W - 12, 76), ax = Math.max(X + 4, Math.min(X + W - aw - 4, dX + 10 - aw / 2)), ay = wallY + 2;
    for (let k = 0; k < aw; k += 10) { g.fillStyle = (k / 10) % 2 ? '#f4f4f4' : shade(st.accent, -0.15); g.fillRect(ax + k, ay, Math.min(10, aw - k), 10); g.beginPath(); g.arc(ax + k + 5, ay + 10, 5, 0, Math.PI); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(ax, ay + 15, aw, 2);
  }
  if (fine && !BANNER_IDS.has(h.id) && st.roof !== 'parapet') {
    const px = X + 6; g.fillStyle = '#5b3a1a'; g.fillRect(px, Y - 14, 2, 20);
    g.fillStyle = st.accent; g.beginPath(); g.moveTo(px + 2, Y - 14); g.lineTo(px + 16, Y - 10); g.lineTo(px + 2, Y - 6); g.fill();
  }
  if (BANNER_IDS.has(h.id)) {
    for (const bx of [X + 10, X + W - 24]) {
      g.fillStyle = '#ffd86b'; g.fillRect(bx - 1, wallY + 2, 16, 3);
      g.fillStyle = st.accent; g.beginPath(); g.moveTo(bx, wallY + 5); g.lineTo(bx + 14, wallY + 5); g.lineTo(bx + 14, wallY + 30); g.lineTo(bx + 7, wallY + 25); g.lineTo(bx, wallY + 30); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(bx + 11, wallY + 5, 3, 22);
      g.fillStyle = '#ffd86b'; g.fillRect(bx + 5, wallY + 12, 4, 4);
    }
  }

  // ----- the roof -----
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X, wallY, W, 5);   // shadow under the eaves
  const ov = 6, base = shade(h.roof || '#7a4a2a', shabby ? -0.3 : tier === 1 ? -0.1 : fine ? 0.05 : 0);
  if (st.roof === 'parapet') {
    g.fillStyle = '#6b707a'; g.fillRect(X - 2, Y + 8, W + 4, roofH - 8);
    g.fillStyle = '#7e838d'; for (let x = X - 2; x < X + W; x += 12) g.fillRect(x, Y, 8, 10);
    g.fillStyle = 'rgba(255,255,255,0.15)'; for (let x = X - 2; x < X + W; x += 12) g.fillRect(x, Y, 8, 2);
    g.fillStyle = '#4b5059'; g.fillRect(X + 6, Y + 14, W - 12, roofH - 22);
    g.fillStyle = shade(base, -0.1); g.fillRect(X + 8, Y + 16, W - 16, roofH - 26);   // the walkway
  } else if (st.roof === 'pagoda') {   // two tiers of glazed tile with eaves that sweep up at the corners
    const tier2 = Y + Math.floor(roofH * 0.45);
    for (const [top, left, right, bottom] of [[tier2, X - 2, X + W + 2, wallY + 2], [Y, X + 10, X + W - 10, tier2 + 2]]) {
      g.fillStyle = base; g.beginPath(); g.moveTo(left - ov - 4, bottom); g.quadraticCurveTo(left + 6, bottom - 2, left + 12, top); g.lineTo(right - 12, top); g.quadraticCurveTo(right - 6, bottom - 2, right + ov + 4, bottom); g.closePath(); g.fill();
      g.save(); g.clip();
      for (let y = top + 3; y < bottom; y += 6) { g.fillStyle = shade(base, -0.22); g.fillRect(left - ov - 4, y + 4, right - left + 2 * ov + 8, 1); g.fillStyle = shade(base, (y / 6) % 2 ? 0.06 : -0.06); for (let x = left - ov - 4; x < right + ov + 4; x += 7) { g.beginPath(); g.arc(x + 3, y + 3, 3.5, 0, Math.PI); g.fill(); } }
      g.restore();
      g.fillStyle = shade(base, -0.4); g.fillRect(left - ov - 4, bottom - 2, right - left + 2 * ov + 8, 2);
      g.fillStyle = '#ffd86b'; g.fillRect(left - ov - 5, bottom - 6, 4, 4); g.fillRect(right + ov + 1, bottom - 6, 4, 4);   // the upturned tips
    }
    g.fillStyle = '#ffd86b'; g.fillRect(X + 10, Y - 1, W - 20, 3); g.beginPath(); g.arc(X + W / 2, Y - 2, 4, 0, Math.PI * 2); g.fill();   // ridge and finial
    if (fine) { g.fillStyle = '#ff5c5c'; for (let x = X + 4; x < X + W - 4; x += 26) { g.fillRect(x, wallY + 2, 6, 9); g.fillStyle = '#ffd86b'; g.fillRect(x + 2, wallY + 11, 2, 3); g.fillStyle = '#ff5c5c'; } }   // paper lanterns under the eaves
  } else if (st.roof === 'flat') {   // a flat terrace behind a parapet, a chhatri at each end
    g.fillStyle = '#b8864b'; g.fillRect(X - 3, Y + roofH - 12, W + 6, 12);
    g.fillStyle = '#d9ab6a'; g.fillRect(X - 3, Y + roofH - 12, W + 6, 3);
    g.fillStyle = shade(base, -0.1); g.fillRect(X + 2, Y + roofH - 9, W - 4, 6);
    for (const cx of [X + 12, X + W - 12]) { g.fillStyle = '#d9ab6a'; g.fillRect(cx - 7, Y + roofH - 22, 14, 10); g.fillStyle = base; g.beginPath(); g.arc(cx, Y + roofH - 22, 8, Math.PI, 0); g.fill(); g.fillStyle = '#ffd86b'; g.fillRect(cx - 1, Y + roofH - 32, 2, 3); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = X + 1; x < X + W - 4; x += 8) g.fillRect(x, Y + roofH - 12, 4, 3);
  } else if (st.roof === 'dome') {   // a great dome on a drum, smaller domes at the corners
    g.fillStyle = '#d9ab6a'; g.fillRect(X - 3, Y + roofH - 10, W + 6, 10);
    for (const cx of [X + 10, X + W - 10]) { g.fillStyle = shade(base, -0.15); g.beginPath(); g.arc(cx, Y + roofH - 10, 9, Math.PI, 0); g.fill(); }
    g.fillStyle = '#e3b874'; g.fillRect(X + W / 2 - 18, Y + roofH - 16, 36, 8);
    const dg = g.createRadialGradient(X + W / 2 - 6, Y + 10, 2, X + W / 2, Y + roofH - 16, 26); dg.addColorStop(0, shade(base, 0.35)); dg.addColorStop(1, shade(base, -0.25));
    g.fillStyle = dg; g.beginPath(); g.ellipse(X + W / 2, Y + roofH - 16, 24, roofH - 10, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#ffd86b'; g.fillRect(X + W / 2 - 1, Y - 2, 2, 8); g.beginPath(); g.arc(X + W / 2, Y - 2, 3, 0, Math.PI * 2); g.fill();
  } else if (st.roof === 'onion') {   // a painted onion dome on a square tower, over a steep plank roof
    g.fillStyle = shade(base, -0.2); g.beginPath(); g.moveTo(X - ov, wallY); g.lineTo(X + W / 2, Y + 6); g.lineTo(X + W + ov, wallY); g.closePath(); g.fill();
    g.fillStyle = shade(base, 0.1); for (let x = X - ov; x < X + W + ov; x += 6) g.fillRect(x, Y + 8 + Math.abs(x - X - W / 2) * (roofH - 8) / (W / 2 + ov), 3, 40);
    g.fillStyle = '#f4f4f4'; g.fillRect(X + W / 2 - 9, Y + 4, 18, roofH - 6);
    const dg = g.createRadialGradient(X + W / 2 - 4, Y - 8, 1, X + W / 2, Y - 4, 16); dg.addColorStop(0, shade(st.accent, 0.4)); dg.addColorStop(1, shade(st.accent, -0.3));
    g.fillStyle = dg; g.beginPath(); g.moveTo(X + W / 2, Y - 20); g.quadraticCurveTo(X + W / 2 + 16, Y - 10, X + W / 2 + 11, Y + 4); g.lineTo(X + W / 2 - 11, Y + 4); g.quadraticCurveTo(X + W / 2 - 16, Y - 10, X + W / 2, Y - 20); g.fill();
    g.fillStyle = '#ffd86b'; g.fillRect(X + W / 2 - 1, Y - 27, 2, 8); g.fillRect(X + W / 2 - 3, Y - 25, 6, 2);
  } else if (st.roof === 'plank') {   // steep painted planks, snow-shedding, with carved bargeboards
    g.fillStyle = base; g.beginPath(); g.moveTo(X - ov, wallY); g.lineTo(X + W / 2, Y); g.lineTo(X + W + ov, wallY); g.closePath(); g.fill();
    g.save(); g.beginPath(); g.moveTo(X - ov, wallY); g.lineTo(X + W / 2, Y); g.lineTo(X + W + ov, wallY); g.closePath(); g.clip();
    for (let x = X - ov; x < X + W + ov; x += 5) { g.fillStyle = noise(x, seed, 79) < 0.5 ? shade(base, 0.1) : shade(base, -0.12); g.fillRect(x, Y, 4, roofH + 4); }
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(X - ov, Y, W + 2 * ov, 0); if (dayPhase() === 'night' || noise(seed, 5, 83) < 0.5) { g.beginPath(); g.moveTo(X - ov, wallY - 3); g.lineTo(X + W / 2, Y + 2); g.lineTo(X + W + ov, wallY - 3); g.lineTo(X + W + ov, wallY); g.lineTo(X - ov, wallY); g.fill(); }   // a lick of snow along the eave
    g.restore();
    g.fillStyle = '#f4f4f4'; g.fillRect(X + W / 2 - 1, Y, 2, roofH); for (const sx of [X - ov, X + W + ov - 3]) for (let y = wallY - 10; y > Y + 4; y -= 6) g.fillRect(sx, y, 3, 3);   // carved white bargeboards
  } else if (st.roof === 'pediment') {
    g.fillStyle = '#d3cfde'; g.fillRect(X - 4, Y + roofH - 10, W + 8, 10);
    g.fillStyle = '#f2f0f7'; g.beginPath(); g.moveTo(X - 4, Y + roofH - 10); g.lineTo(X + W / 2, Y); g.lineTo(X + W + 4, Y + roofH - 10); g.fill();
    g.fillStyle = base; g.beginPath(); g.moveTo(X + 8, Y + roofH - 14); g.lineTo(X + W / 2, Y + 7); g.lineTo(X + W - 8, Y + roofH - 14); g.fill();
    g.fillStyle = '#c4bfd3'; g.fillRect(X - 4, Y + roofH - 3, W + 8, 3);
    g.fillStyle = '#ffd86b'; g.beginPath(); g.arc(X + W / 2, Y + roofH * 0.5, 4, 0, Math.PI * 2); g.fill();
  } else {
    g.save();
    g.beginPath(); g.moveTo(X - ov, wallY); g.lineTo(X + 12, Y + 2); g.lineTo(X + W - 12, Y + 2); g.lineTo(X + W + ov, wallY); g.closePath();
    g.fillStyle = base; g.fill(); g.clip();
    if (st.roof === 'thatch') {
      for (let k = 0; k < (W + 2 * ov) * 1.4; k++) {
        const x = X - ov + ((k * 7919) % (W + 2 * ov)), y = Y + ((k * 104729) % roofH);
        g.fillStyle = noise(k, seed, 61) < 0.5 ? shade(base, 0.18) : shade(base, -0.2); g.fillRect(x, y, 1, 6);
      }
      g.fillStyle = shade(base, -0.3); for (let y = Y + 9; y < wallY; y += 10) g.fillRect(X - ov, y, W + 2 * ov, 1);
    } else if (st.roof === 'slate') {
      for (let row = 0, y = Y + 3; y < wallY; row++, y += 6) for (let x = X - ov - (row % 2 ? 6 : 0); x < X + W + ov; x += 12) {
        g.fillStyle = noise(x, y, 67) < 0.5 ? shade(base, -0.08) : shade(base, 0.06); g.fillRect(x + 1, y, 10, 5);
      }
    } else {   // clay tiles: rows of scallops
      for (let row = 0, y = Y + 4; y < wallY + 4; row++, y += 7) {
        g.fillStyle = shade(base, -0.22); g.fillRect(X - ov, y + 4, W + 2 * ov, 2);
        g.fillStyle = shade(base, row % 2 ? 0.05 : -0.05);
        for (let x = X - ov - (row % 2 ? 4 : 0); x < X + W + ov; x += 8) { g.beginPath(); g.arc(x + 4, y + 3, 4, 0, Math.PI); g.fill(); }
      }
    }
    const lg = g.createLinearGradient(0, Y, 0, wallY); lg.addColorStop(0, 'rgba(255,255,255,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = lg; g.fillRect(X - ov, Y, W + 2 * ov, roofH);
    if (shabby) {
      for (let k = 0; k < Math.max(3, Math.round(W / 30)); k++) {   // moss and missing tiles
        const mx = X + Math.floor(noise(seed, k, 97) * W), my = Y + 4 + Math.floor(noise(seed, k, 101) * (roofH - 10));
        g.fillStyle = 'rgba(80,120,50,0.55)'; g.beginPath(); g.ellipse(mx, my, 9, 4, 0, 0, Math.PI * 2); g.fill();
        if (k % 2 === 0) { g.fillStyle = '#1b1510'; g.fillRect(mx + 10, my - 2, 6, 5); }
      }
    }
    g.restore();
    g.fillStyle = fine ? '#ffd86b' : shade(base, 0.3); g.fillRect(X + 12, Y + 1, W - 24, 3);   // the ridge
    g.fillStyle = fine ? '#c79a3a' : shade(base, -0.35); g.fillRect(X - ov, wallY - 2, W + 2 * ov, 2);   // the eave
    if (h.id === 'throne') { g.fillStyle = '#ffd86b'; for (let x = X + 16; x < X + W - 16; x += 22) { g.beginPath(); g.moveTo(x, Y + 1); g.lineTo(x + 4, Y - 6); g.lineTo(x + 8, Y + 1); g.fill(); } }
    if (h.id === 'longhouse') {   // crossed gable beams at either end
      g.strokeStyle = '#4a2f17'; g.lineWidth = 3;
      for (const ex of [X + 12, X + W - 12]) { g.beginPath(); g.moveTo(ex - 8, Y + 8); g.lineTo(ex + 8, Y - 6); g.moveTo(ex + 8, Y + 8); g.lineTo(ex - 8, Y - 6); g.stroke(); }
    }
  }
  if (CHIMNEY_IDS.has(h.id) && st.roof !== 'parapet') {
    const cx = X + W - 26;
    g.fillStyle = st.wall === 'log' ? '#5f646e' : '#8b2e2e'; g.fillRect(cx, Y - 8, 10, 18);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 7, Y - 8, 3, 18);
    g.fillStyle = '#3b3f48'; g.fillRect(cx - 1, Y - 10, 12, 3);
  }

  // ----- the hanging sign -----
  if (h.sign) {
    g.font = 'bold 10px sans-serif';
    const icon = SIGN_ICON[h.id], tw = g.measureText(h.sign).width, sw = tw + (icon ? 22 : 12), sx = dX + 10 - sw / 2, sy = wallY - 9;
    g.save();
    if (shabby) { g.translate(sx + sw / 2, sy); g.rotate(-0.09); g.translate(-(sx + sw / 2), -sy); }
    g.fillStyle = '#1b1b2f'; g.fillRect(sx + 4, sy - 4, 1, 4); g.fillRect(sx + sw - 5, sy - 4, 1, 4);
    g.fillStyle = fine ? '#c79a3a' : '#6b4423'; g.beginPath(); g.roundRect(sx, sy, sw, 15, 3); g.fill();
    g.fillStyle = '#8b5a2b'; g.beginPath(); g.roundRect(sx + 1, sy + 1, sw - 2, 13, 2); g.fill();
    if (icon) { const img = sprite(icon); g.imageSmoothingEnabled = false; g.drawImage(img, sx + 3, sy + 1, 13, 13); }
    g.fillStyle = shabby ? '#d8c9a8' : '#fff3d6'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(h.sign, sx + (icon ? 18 : 6), sy + 8);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    g.restore();
  }
}
// Chimney smoke drifts up from the houses in view.
function houseSmoke(now) {
  if (scene !== 'world' || Math.random() > 0.25) return;
  for (const h of houses) {
    if (!CHIMNEY_IDS.has(h.id) || Math.abs(h.x - player.x) > 30 || Math.abs(h.y - player.y) > 22 || Math.random() > 0.12) continue;
    burst(h.x + h.w - 26 / T - 0.35, h.y - 0.6, h.id === 'smithy' ? '#6b7280' : '#cbd5e1', 1, 8, { gravity: -18, life: 2200, size: 4, spread: 2 });
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
    g.fillText('Walk into things to use them. The door at the bottom leads out.', bounded.w * T / 2 - off.x, bounded.h * T - off.y + 20, Math.max(120, canvas.width - (isTouch ? 110 : 40)));
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
      else if (gnd === GROUND.DOCK) drawDock(g, c, r);
      else if (gnd === GROUND.SNOW) drawSnow(g, c, r);
      else if (gnd === GROUND.FOREST || gnd === GROUND.TREE) {
        if (r * 1 < ICE_Y) drawSnow(g, c, r); else drawGrass(g, c, r, true);
        if (gnd === GROUND.TREE) {   // every tree a little different: size, lean and which way it faces
          const tn = noise(c, r, 71), pad = tn < 0.25 ? -2 : tn < 0.6 ? 0 : tn < 0.85 ? 1 : 3, lean = (noise(c, r, 73) - 0.5) * 0.22;
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(c * T - off.x + T / 2 + 4 + lean * T, r * T - off.y + T - 4, T * (0.46 - pad * 0.03), 6, 0, 0, Math.PI * 2); g.fill();
          const kind = r < ICE_Y ? 'pinesnow' : noise(c, r, 75) < 0.4 ? 'pine' : 'tree';   // oaks and pines mixed; only pines stand the snow
          drawSprite(g, kind, c + lean, r - (pad < 0 ? 0.06 : 0), 1, pad, tn > 0.5);
        }
      }
      else { const fk = t === TILE.FLOOR && fieldAt(c, r); if (fk) drawField(g, c, r, fk); else { drawGrass(g, c, r); if (t === TILE.FLOOR && noise(c, r, 9) < 0.06) drawSprite(g, 'flower', c, r); } }
      if (t === TILE.EXIT) {
        const X = c * T - off.x, Y = r * T - off.y;
        g.fillStyle = '#374151'; g.fillRect(X - 6, Y - 6, T + 12, T + 12);
        g.fillStyle = '#9ca3af'; g.fillRect(X - 6, Y - 6, T + 12, 4);
        drawSprite(g, 'stairs', c, r);
      }
      if (t === TILE.SITE) { const st = siteAtTile(c, r); if (st) drawSprite(g, st.sprite, c, r, 1, 0); }
      if (t === TILE.SHIP) { drawWater(g, c, r); drawSprite(g, 'ship', c, r, 1, -2); }
      if (t === TILE.WAYSTONE) drawWaystone(g, c, r);
      if (t === TILE.PLACE) { const pl = placeAtTile(c, r); if (pl) drawSprite(g, pl.sprite, c, r, 1, 0); }
      if (t === TILE.MONUMENT) { const tw = townContaining(c, r); if (tw) drawSprite(g, tw.memorial && c === tw.cx - 4 && r === tw.cy + 3 ? 'obelisk' : townIdentity(tw).landmark.sprite, c, r, 1, 0); }
      if (t === TILE.WARCAMP) { const wc = campAtTile(c, r); drawSprite(g, wc && campRazed(wc) ? 'razedcamp' : 'warcamp', c, r, 1, 0); }
      if (t === TILE.PLOT) {
        const tw = townContaining(c, r), b = tw && buildingAt(tw, plotSlot(tw, c, r));
        drawSprite(g, b ? MONUMENT_SPRITES[b.type] || 'statue' : 'plot', c, r, 1, 0);
        if (b) { g.fillStyle = '#ffd86b'; for (let k = 0; k < b.level; k++) g.fillRect(c * T - off.x + 6 + k * 8, r * T - off.y + T - 4, 5, 3); }
      }
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
      if (st.lair && !lairKnown(st.lair)) continue;
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const rt = rating(siteDungeon(st)), sub = st.lair ? `☠ lair · Lv ${rt.rec}+ · ${rt.label}` : `Lv ${rt.rec}+ · ${rt.label}`;
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
      if (player && player.meta && player.meta.story && player.meta.story.phase === 'done') {   // bunting for the mended crown
        const col = REALMS[town.realm || 'cantons'].color;
        for (const [ax, ay, bx] of [[town.cx - 11, town.cy - 6, town.cx + 11], [town.cx - 11, town.cy + 6, town.cx + 11]]) {
          const x0 = ax * T - off.x + T / 2, x1 = bx * T - off.x + T / 2, y0 = ay * T - off.y + 6;
          g.strokeStyle = '#3b2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + 18, x1, y0); g.stroke();
          for (let k = 1; k < 22; k++) { const u = k / 22, x = x0 + (x1 - x0) * u, y = y0 + 18 * 2 * u * (1 - u); g.fillStyle = k % 2 ? col : '#ffd86b'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x, y + 8); g.fill(); }
        }
      }
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
      if (t === TILE.CAPTIVE) drawSprite(g, 'captive', c, r, 1, 3);
      if (t === TILE.TOTEM) drawSprite(g, 'totem', c, r, 1, 1);
      if (t === TILE.ALTAR) drawSprite(g, 'shrine', c, r, 1, 0);
      if (t === TILE.TRIAL) {   // a ring of standing stones round a rune that breathes
        const X = c * T - off.x, Y = r * T - off.y, live = trial && trial.x === c && trial.y === r, pulse = 0.55 + 0.45 * Math.sin(performance.now() / (live ? 120 : 600));
        g.fillStyle = '#4b5563'; for (const [sx, sy] of [[3, 4], [22, 3], [4, 21], [21, 22]]) g.fillRect(X + sx, Y + sy, 7, 7);
        g.fillStyle = '#6b7280'; g.fillRect(X + 10, Y + 10, 12, 12);
        g.fillStyle = live ? `rgba(255,120,80,${pulse})` : `rgba(160,200,255,${pulse * 0.8})`; g.fillRect(X + 13, Y + 12, 6, 2); g.fillRect(X + 15, Y + 12, 2, 8); g.fillRect(X + 13, Y + 18, 6, 2);
      }
      if (t === TILE.LEVER) { const X = c * T - off.x, Y = r * T - off.y; g.fillStyle = '#4b5563'; g.fillRect(X + 10, Y + 18, 12, 8); g.fillStyle = '#9ca3af'; g.fillRect(X + 15, Y + 6, 3, 14); g.fillStyle = '#ef4444'; g.beginPath(); g.arc(X + 16.5, Y + 6, 3, 0, Math.PI * 2); g.fill(); }
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

let hudExtra = 0;   // how much taller the HUD box is than usual (full screen)
function drawHud(g, now) {
  const where = scene === 'house' ? interior.house.name : scene === 'dungeon' && dungeonDef && dungeonDef.delve ? `${dungeonDef.name[0].toUpperCase() + dungeonDef.name.slice(1)} ${floor}/5 · Daily` : inTown() ? `${townContaining(player.x, player.y)?.name ?? 'The wilds'}, ${REALMS[realmOfTile(player.x, player.y)].short} · day ${dayNumber()}, ${dayPhase()}` : `${dungeonDef ? dungeonDef.name : 'Dungeon'} ${floorText()}${dungeonDef ? ` · Lv ${recLevel(dungeonDef)}+` : ''}${floorMod ? ` · ${FLOOR_MODS[floorMod].label}` : ''}${trial ? ` · ${TRIALS[trial.kind].label}: ${trial.turns} turns${trial.need ? `, ${trial.kills}/${trial.need} slain` : ''}` : ''}`;
  const compact = canvas.width < 560;
  const text = compact
    ? `HP ${player.hp}/${player.maxHp}  ATK ${player.atk + weaponAtk()}  DEF ${armorDef()}  Lv ${player.level}  ${player.gold}g`
    : `${where}   HP ${player.hp}/${player.maxHp}   ATK ${player.atk + weaponAtk()}   DEF ${armorDef()}   Lv ${player.level}   Gold ${player.gold}`;
  g.font = compact ? 'bold 11px sans-serif' : 'bold 13px sans-serif';
  // The HUD carries the game's only health bar, with the mana bar under it.
  const big = true;
  const w = Math.max(g.measureText(text).width + 20, compact ? 0 : 360), hudH = 72;
  hudExtra = hudH - 40;
  { const pg = g.createLinearGradient(0, 8, 0, 8 + hudH); pg.addColorStop(0, 'rgba(18,34,52,0.9)'); pg.addColorStop(1, 'rgba(5,10,18,0.9)');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(10, 10, w, hudH, 8); g.fill();   // a soft drop shadow
    g.fillStyle = pg; g.beginPath(); g.roundRect(8, 8, w, hudH, 8); g.fill();
    g.strokeStyle = 'rgba(214,189,98,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(8.5, 8.5, w - 1, hudH - 1, 8); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.roundRect(10.5, 10.5, w - 5, hudH - 5, 6); g.stroke();
    g.fillStyle = '#d6bd62'; for (const [cx, cy] of [[14, 14], [8 + w - 6, 14], [14, 8 + hudH - 6], [8 + w - 6, 8 + hudH - 6]]) g.fillRect(cx - 1, cy - 1, 2, 2); }   // rivets
  g.fillStyle = '#e6eef8'; g.textBaseline = 'top'; g.fillText(text, 18, 14);
  const ratio = Math.max(0, Math.min(1, player.hp / player.maxHp));
  const hpCol = ratio > 0.5 ? '#5fe17a' : ratio > 0.25 ? '#f5c542' : '#ff6b6b';
  if (big) {
    const by = 32, bh = 16, bw = w - 20;
    g.fillStyle = '#06202c'; g.beginPath(); g.roundRect(18, by, bw, bh, 4); g.fill();
    if (ratio > 0) { const bg = g.createLinearGradient(0, by, 0, by + bh); bg.addColorStop(0, shade(hpCol, 0.25)); bg.addColorStop(0.5, hpCol); bg.addColorStop(1, shade(hpCol, -0.35)); g.fillStyle = bg; g.beginPath(); g.roundRect(18, by, Math.max(6, bw * ratio), bh, 4); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(20, by + 2, Math.max(0, bw * ratio - 4), 3);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.roundRect(18.5, by + 0.5, bw - 1, bh - 1, 4); g.stroke();
    g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
    const hpText = `HP ${player.hp} / ${player.maxHp}${player.poison > 0 ? '  (poisoned)' : ''}`;
    g.lineWidth = 3; g.strokeStyle = 'rgba(6,12,20,0.9)'; g.strokeText(hpText, 18 + bw / 2, by + 2);
    g.fillStyle = '#ffffff'; g.fillText(hpText, 18 + bw / 2, by + 2);
    g.textAlign = 'start';
    // mana
    const my = by + bh + 3, mh = 12, mm = maxMana(), mana = Math.max(0, Math.min(mm, player.mana ?? 0)), mr = mm ? mana / mm : 0;
    g.fillStyle = '#06202c'; g.beginPath(); g.roundRect(18, my, bw, mh, 4); g.fill();
    if (mr > 0) { const mc = mana >= abilityCost() ? '#4f7bff' : '#3b4f8f', mg = g.createLinearGradient(0, my, 0, my + mh); mg.addColorStop(0, shade(mc, 0.25)); mg.addColorStop(1, shade(mc, -0.35)); g.fillStyle = mg; g.beginPath(); g.roundRect(18, my, Math.max(6, bw * mr), mh, 4); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.roundRect(18.5, my + 0.5, bw - 1, mh - 1, 4); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(20, my + 2, Math.max(0, bw * mr - 4), 2);
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center';
    const mpText = `MP ${mana} / ${mm}`;
    g.lineWidth = 3; g.strokeStyle = 'rgba(6,12,20,0.9)'; g.strokeText(mpText, 18 + bw / 2, my + 1);
    g.fillStyle = '#ffffff'; g.fillText(mpText, 18 + bw / 2, my + 1); g.textAlign = 'start';
    // experience
    g.fillStyle = '#0b2033'; g.fillRect(18, my + mh + 3, bw, 4);
    g.fillStyle = '#ffd86b'; g.fillRect(18, my + mh + 3, bw * Math.min(1, player.xp / xpToNext(player.level)), 4);
  } else {
    g.fillStyle = '#0b2033'; g.fillRect(18, 40, w - 20, 3);
    g.fillStyle = '#7bdfff'; g.fillRect(18, 40, (w - 20) * Math.min(1, player.xp / xpToNext(player.level)), 3);
    g.fillStyle = '#06202c'; g.fillRect(18, 32, w - 20, 6);
    g.fillStyle = hpCol; g.fillRect(18, 32, (w - 20) * ratio, 6);
  }
  {
    const cls = heroClass();
    const parts = abilityList().map((A, k) => abilityUnlocked(k) ? `${k + 1}: ${A.name} (${abilityCost(k)})` : `${k + 1}: ${A.name} (Lv ${A.level})`);
    if (player.rage > 0) parts.push(`Rage ${player.rage}`);
    if (player.evade > 0) parts.push(`Evade ${player.evade}`);
    if (player.shield > 0) parts.push(`Shield ${player.shield}`);
    if (player.poison > 0) parts.push(`Poisoned ${player.poison}`);
    g.font = '12px sans-serif';
    const at = parts.join('   ');
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, 50 + hudExtra, g.measureText(at).width + 20, 20, 5); g.fill();
    g.fillStyle = player.poison > 0 ? '#9ef0b0' : (player.mana ?? 0) < abilityCost() ? '#a8c0d8' : '#7bdfff'; g.fillText(at, 18, 54 + hudExtra);
  }
  const obj = scene !== 'dungeon' ? storyObjective() : null;
  let qOffset = 0;
  if (obj) {
    g.font = 'bold 12px sans-serif';
    let ot = `★ ${obj.text}`; while (g.measureText(ot).width > canvas.width - 40 && ot.length > 12) ot = ot.slice(0, -4) + '…';
    const oy = (canvas.width < 560 ? 116 : 74) + hudExtra;
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(8, oy, g.measureText(ot).width + 20, 20, 5); g.fill();
    g.fillStyle = '#ffd86b'; g.fillText(ot, 18, oy + 4);
    qOffset = 24;
  }
  const q = player.quests && questsActive()[0];
  if (q) {
    g.font = '12px sans-serif';
    const qt = `Quest: ${q.label}  ${q.have}/${q.need}${questsActive().length > 1 ? `  (+${questsActive().length - 1} more, Q)` : '  (Q)'}`;
    const qy = (canvas.width < 560 ? 116 : 74) + hudExtra + qOffset;
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
    const bx = canvas.width - cw - 8, cy0 = canvas.width < 560 ? 82 + hudExtra : 8;   // its own row, under the ability line, on narrow screens
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
    // long messages wrap to the width of the screen; the newest six lines show
    const lh = 18, pad = 8, bw = canvas.width - 16, maxW = bw - 20;
    const lines = [];
    for (const m of recent) {
      let line = '';
      for (const w of String(m.text).split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push({ m, text: line }); line = w; } else line = t; }
      if (line) lines.push({ m, text: line });
    }
    const shown = lines.slice(isTouch ? -4 : -6), bh = shown.length * lh + pad * 2;   // on touch screens, four lines fit under the buttons
    g.fillStyle = 'rgba(6,12,20,0.78)';
    g.beginPath(); g.roundRect(8, canvas.height - bh - 8, bw, bh, 6); g.fill();
    shown.forEach(({ m, text }, i) => {
      const age = now - m.at;
      g.globalAlpha = age > 6000 ? 1 - (age - 6000) / 3000 : 1;
      g.fillStyle = m.cls === 'good' ? '#9ef0b0' : m.cls === 'bad' ? '#ff9b9b' : '#e6eef8';
      g.fillText(text, 18, canvas.height - bh - 8 + pad + i * lh);
    });
    g.globalAlpha = 1;
  }
  g.textBaseline = 'alphabetic';
}

// Explored tiles around the hero, dungeon only.
const WORLD_MAP_COLORS = ['#448a3f', '#336a30', '#dfc78f', '#1d4ed8', '#6b7280', '#a8865a', '#6b7280', '#2e7d32', '#94a3b8', '#b08860', '#e8f1f8'];
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
// Cloud shadows drifting over the land by day: a few soft blobs fixed to the world
// (so they slide over the ground as the camera moves) and pushed along by the wind.
function drawCloudShadows(g, now, t) {
  const fade = Math.max(0, Math.min(1, (t - 0.08) / 0.04, (0.55 - t) / 0.04));
  if (!fade) return;
  const SX = 2600, SY = 1800, drift = now * 0.011;
  g.save(); g.globalAlpha = 0.2 * fade;
  for (let i = 0; i < 8; i++) {
    const wx = (i * 1733 + 211 + drift * (0.8 + (i % 3) * 0.15)) % SX, wy = (i * 911 + 97 + Math.sin(now / 9000 + i) * 40) % SY;
    const sx = ((wx - cam.x) % SX + SX) % SX - 300, sy = ((wy - cam.y) % SY + SY) % SY - 200;
    if (sx < -400 || sx > canvas.width + 400 || sy < -300 || sy > canvas.height + 300) continue;
    for (const [ox, oy, rx, ry] of [[0, 0, 170, 90], [120, 30, 130, 70], [-110, 20, 120, 60]]) {
      const rg = g.createRadialGradient(sx + ox, sy + oy, 10, sx + ox, sy + oy, rx);
      rg.addColorStop(0, 'rgba(10,20,45,1)'); rg.addColorStop(1, 'rgba(10,20,45,0)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(sx + ox, sy + oy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}
// Two small flocks cross the sky by day, fixed to the world and flapping as they go.
function drawBirds(g, now) {
  const SX = 3000, SY = 2200;
  g.strokeStyle = player.y < ICE_Y ? 'rgba(20,20,30,0.8)' : 'rgba(30,40,60,0.75)'; g.lineWidth = 1.5;
  for (let f = 0; f < 2; f++) {
    const wx = (f * 1500 + now * (0.03 + f * 0.012)) % SX, wy = (f * 1100 + 300 + Math.sin(now / 7000 + f) * 60) % SY;
    const sx = ((wx - cam.x * 0.6) % SX + SX) % SX - 200, sy = ((wy - cam.y * 0.6) % SY + SY) % SY - 100;
    if (sx < -100 || sx > canvas.width + 100 || sy < -60 || sy > canvas.height + 60) continue;
    for (let i = 0; i < 4 + f; i++) {
      const bx = sx - i * 14 - (i % 2) * 6, by = sy + Math.abs(i - 2) * 9, flap = Math.sin(now / 110 + i * 1.3) * 4;
      g.beginPath(); g.moveTo(bx - 6, by + flap); g.quadraticCurveTo(bx - 2, by - 2, bx, by); g.quadraticCurveTo(bx + 2, by - 2, bx + 6, by + flap); g.stroke();
    }
  }
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
    // the town fountain: a round stone basin with a spout in the middle, drawn every frame so the water moves
    const cx = town.cx * T - cam.x, cy = town.cy * T - cam.y, R = T - 2, tier = townTier(town);
    const rim = tier === 0 ? '#7a6f5a' : tier >= 3 ? '#c9c2b4' : '#9ca3af', rimDark = tier === 0 ? '#5a5144' : tier >= 3 ? '#948c7c' : '#6b7280';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 4, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rimDark; ctx.beginPath(); ctx.ellipse(cx, cy + 2, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    const wg = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, R - 5); wg.addColorStop(0, '#7cc4ff'); wg.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(cx, cy, R - 5, (R - 5) * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, R - 5, (R - 5) * 0.8, 0, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 3; i++) {   // ripples spreading from the spout
      const rr = ((now / 1100 + i / 3) % 1) * (R - 5);
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.8, 0, 0, Math.PI * 2); ctx.strokeStyle = `rgba(230,245,255,${0.6 - rr / (R - 5) * 0.6})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = rimDark; ctx.fillRect(cx - 3, cy - 14, 6, 14); ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(cx, cy - 14, 6, 3, 0, 0, Math.PI * 2); ctx.fill();   // the pedestal
    ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = 2;
    for (const dir of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy - 18); ctx.quadraticCurveTo(cx + dir * 9, cy - 24, cx + dir * 12, cy - 8); ctx.stroke(); }   // two arcs of water
    ctx.fillStyle = 'rgba(240,250,255,0.9)';
    for (let i = 0; i < 6; i++) { const ph = (now / 700 + i / 6) % 1, dir = i % 2 ? 1 : -1; ctx.fillRect(Math.round(cx + dir * (3 + ph * 10)), Math.round(cy - 20 + ph * ph * 16 - Math.sin(ph * Math.PI) * 8), 2, 2); }   // falling drops
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - 1, cy - 20, 2, 4);
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
  if (scene !== 'dungeon') for (const n of npcs) if (!n.down && inView(n)) {
    const [ldx, ldy] = lunge(n, now);
    const [lx, ly] = [(n.rx ?? n.x) + ldx / T, (n.ry ?? n.y) + ldy / T]; shadow(lx, n.ry ?? n.y);
    drawSprite(ctx, n.type.sprite, lx, ly - bob(n) - hop(n), 1, 3, n.face === -1, n.flashUntil > now);
    if (n.type.guard && n.hp < n.maxHp) { ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, T - 6, 3); ctx.fillStyle = '#e9c48a'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, (T - 6) * (n.hp / n.maxHp), 3); }
  }
  for (const o of mpHere()) {
    if (!inView(o)) continue;
    if (o.hound && inView(o.hound)) { shadow(o.hound.rx ?? o.hound.x, o.hound.ry ?? o.hound.y); drawSprite(ctx, (o.hound.kind && PET_KINDS[o.hound.kind]) ? PET_KINDS[o.hound.kind].sprite : 'hound', o.hound.rx ?? o.hound.x, (o.hound.ry ?? o.hound.y) - hop(o.hound), 1, 3, o.hound.face === -1); }
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
  for (const p of livePets()) {
    if (!inView(p)) continue;
    const K = petKind(p), [ldx, ldy] = lunge(p, now);
    const lx = (p.rx ?? p.x) + ldx / T, ly = (p.ry ?? p.y) + ldy / T - hop(p);
    shadow(lx, (p.ry ?? p.y));
    drawSprite(ctx, K.sprite, lx, ly - (K.flies ? 0.25 + Math.sin(now / 250) * 0.06 : 0), 1, PET_PAD[K.size], p.face === -1, p.flashUntil > now);
    if (p.hp < p.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, T - 6, 3);
      ctx.fillStyle = '#5fe17a'; ctx.fillRect(lx * T - cam.x + 3, ly * T - cam.y, (T - 6) * (p.hp / p.maxHp), 3);
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
    if (m.tell && m.tell.kind === 'aim') {
      const a = 0.22 + 0.14 * Math.sin(now / 110);
      for (let k = 1; k <= 6; k++) { const x = m.x + m.tell.dx * k, y = m.y + m.tell.dy * k; if (!walkable(getTile(x, y))) break; ctx.fillStyle = `rgba(245,197,66,${a})`; ctx.fillRect(x * T - cam.x + 1, y * T - cam.y + 1, T - 2, T - 2); }
    }
    if (m.guard) { ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('⛨', lx * T - cam.x + T - 14, ly * T - cam.y - 2); }
    if (m.tell && m.tell.kind === 'glare') { ctx.fillStyle = `rgba(255,80,80,${0.6 + 0.4 * Math.sin(now / 90)})`; ctx.font = 'bold 13px sans-serif'; ctx.fillText('◉', lx * T - cam.x + T / 2 - 6, ly * T - cam.y - 2); }
    if (m.reeling > 0) { ctx.fillStyle = '#ffd86b'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('~', lx * T - cam.x + T / 2 - 4, ly * T - cam.y - 2); }
    if (m.bounty) { ctx.fillStyle = '#ef4444'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('☠', lx * T - cam.x + T / 2 - 6, ly * T - cam.y - 4); }
    if (m.mod) { ctx.fillStyle = ELITE_MODS[m.mod].color; ctx.font = 'bold 12px sans-serif'; ctx.fillText('★', lx * T - cam.x + 1, ly * T - cam.y + 10); }
  }
  drawArmies(ctx, now); drawRifts(ctx, now);
  houseSmoke(now);
  if (escort && scene === 'dungeon' && isVisible(escort.x, escort.y)) {
    const ex = escort.rx ?? escort.x, ey = escort.ry ?? escort.y;
    shadow(ex, ey); drawSprite(ctx, 'villager', ex, ey - bob(escort), 1, 3, escort.face === -1);
    ctx.fillStyle = '#300'; ctx.fillRect(ex * T - cam.x + 3, ey * T - cam.y, T - 6, 3); ctx.fillStyle = '#9ef0b0'; ctx.fillRect(ex * T - cam.x + 3, ey * T - cam.y, (T - 6) * (escort.hp / escort.maxHp), 3);
  }
  if (player.meta.ship && !aboard && scene === 'world') drawSprite(ctx, 'ship', player.meta.ship.x, player.meta.ship.y + Math.sin(now / 500) * 0.04, 1, -2);   // moored where it was left
  if (scene === 'world') drawWaystoneGlows(ctx, now);
  {
    const [ldx, ldy] = lunge(player, now);
    const lx = (player.rx ?? player.x) + ldx / T, ly = (player.ry ?? player.y) + ldy / T - bob(player) - hop(player);
    shadow(lx, (player.ry ?? player.y) + ldy / T);
    if (player.shield > 0) { ctx.strokeStyle = `rgba(123,223,255,${0.5 + 0.3 * Math.sin(now / 120)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx * T - cam.x + T / 2, ly * T - cam.y + T / 2, T * 0.62, 0, Math.PI * 2); ctx.stroke(); }
    const mounted = riding();
    if (mounted && player.meta.horse) drawSprite(ctx, 'horse', lx, ly + 0.12, 1, 1, player.face === -1);
    if (aboard) { drawSprite(ctx, 'ship', lx, ly + 0.1 + Math.sin(now / 500) * 0.04, 1, -2, player.face === -1); pets.filter((p) => p.aboard && !p.down).forEach((p, i) => drawSprite(ctx, petKind(p).sprite, lx + (i - 1) * 0.42 * (player.face === -1 ? -1 : 1), ly + 0.02 + Math.sin(now / 500) * 0.04, 1, 9, player.face === -1)); }   // the crew
    drawSprite(ctx, playerSprite(), lx, ly - (mounted && player.meta.horse ? 0.38 : aboard ? 0.3 : 0), 1, 3, player.face === -1, player.flashUntil > now || player.poison > 0 && Math.floor(now / 300) % 3 === 0);
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
    if (player.y < ICE_Y) {   // the north: snow on the wind and a cold light
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 120; i++) { const x = (i * 131 + now * 0.05 * (1 + (i % 3)) + Math.sin(now / 900 + i) * 30) % (canvas.width + 40) - 20, y = (i * 71 + now * (0.04 + (i % 4) * 0.015)) % (canvas.height + 20) - 10; ctx.fillRect(Math.round(x), Math.round(y), i % 5 ? 2 : 3, i % 5 ? 2 : 3); }
      ctx.fillStyle = 'rgba(170,195,235,0.14)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
      for (const n of npcs) if (n.type.guard && !n.down && n.x >= x0 - 3 && n.x <= x1 + 3 && n.y >= y0 - 3 && n.y <= y1 + 3) {
        night.push({ x: (n.rx ?? n.x) * T - cam.x + T / 2, y: (n.ry ?? n.y) * T - cam.y + T / 2, r: T * 3, a: 0.8, glow: 'rgba(255,190,110,0.22)', gr: T * 1.6 });   // the watch carries lanterns
      }
      for (const h of houses) {
        if (h.doorX < x0 - 3 || h.doorX > x1 + 3 || h.doorY < y0 - 3 || h.doorY > y1 + 3) continue;
        night.push({ x: h.doorX * T - cam.x + T / 2, y: h.doorY * T - cam.y + T, r: T * 2.4, a: 0.8, glow: 'rgba(255,180,90,0.2)', gr: T * 1.4 });
        // lamplight in the windows
        const roofH = Math.floor(h.h * T * 0.48), winY = h.y * T + roofH + Math.max(8, Math.floor((h.h * T - roofH - 22) / 2) - 2) + 7;
        for (const wx of houseWindows(h)) night.push({ x: wx - cam.x, y: winY - cam.y, r: T * 0.9, a: 0.9, glow: 'rgba(255,190,90,0.35)', gr: T * 0.5 });
      }
      for (const t of nearbyTowns(player.x, player.y, 1)) if (townBurning(t)) night.push({ x: t.cx * T - cam.x + T / 2, y: t.cy * T - cam.y, r: T * 14, a: 0.9, glow: `rgba(255,120,30,${0.22 + 0.06 * Math.sin(now / 200)})`, gr: T * 8 });
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
      if (t >= 0.08 && t < 0.55 && !isRainy()) { drawCloudShadows(ctx, now, t); drawBirds(ctx, now); }
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
  drawShots(ctx, now);
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
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > Math.min(520, canvas.width - 60)) { lines.push(line); line = w; } else line = t; }
      lines.push(line);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28, bh = lines.length * 18 + 16, bx = canvas.width / 2 - bw / 2, by = 104;
      ctx.globalAlpha = Math.min(1, (toast.until - now) / 600);
      ctx.fillStyle = 'rgba(255,216,107,0.95)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
      ctx.fillStyle = '#1b1b2f'; lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, by + 8 + i * 18));
      ctx.globalAlpha = 1; ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }
  if (mapOpen) { if (scene === 'dungeon') drawDungeonMap(ctx, now); else drawWorldMap(ctx, now); }
  if (questsOpen) drawQuests(ctx);
  if (journalOpen) drawJournal(ctx);
  if (perkChoices) drawPerks(ctx);
}

// ---------- the world map ----------
// A wide view of the surface around the hero, sampled every other tile and
// cached until the hero has moved a fair way. Towns are named, roads drawn.
let mapOpen = false;
const MINI_STEP = 2, MAP_PX = 3;
// The world map zooms out in steps: 1 is the close view, 3 shows every continent.
let MAP_STEP = 2, mapZoom = 1;
const ZOOM_STEPS = [2, 4, 7];
function setMapZoom(z) {
  const nz = Math.max(1, Math.min(ZOOM_STEPS.length, z));
  if (nz === mapZoom) return;
  mapZoom = nz; MAP_STEP = ZOOM_STEPS[nz - 1]; mapCache.ox = null;
  try { localStorage.setItem('dungeon-map-zoom', String(mapZoom)); } catch (e) { /* ignore */ }
  draw();
}
try { const z = Number(localStorage.getItem('dungeon-map-zoom')); if (z >= 1 && z <= ZOOM_STEPS.length) { mapZoom = z; MAP_STEP = ZOOM_STEPS[z - 1]; } } catch (e) { /* ignore */ }
const mapZoomButtons = () => { const c = mapCache.canvas, X = Math.floor((canvas.width - c.width) / 2), Y = 56; return [{ id: 'in', x: X + c.width - 70, y: Y + c.height - 34, w: 28, h: 26 }, { id: 'out', x: X + c.width - 36, y: Y + c.height - 34, w: 28, h: 26 }]; };
const mapCache = { ox: null, oy: null, canvas: document.createElement('canvas') };
// A pin you drop on the world map; the compass points to it until you get there.
let mapPin = null;
try { mapPin = JSON.parse(localStorage.getItem('dungeon-pin') || 'null'); } catch (e) { mapPin = null; }
function savePin() { try { localStorage.setItem('dungeon-pin', JSON.stringify(mapPin)); } catch (e) { /* ignore */ } }
function mapClick(px, py) {
  const c = mapCache.canvas, X = Math.floor((canvas.width - c.width) / 2), Y = 56;
  if (mapCache.ox === null || px < X || py < Y || px > X + c.width || py > Y + c.height) return false;
  const zb = mapZoomButtons().find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
  if (zb) { setMapZoom(mapZoom + (zb.id === 'out' ? 1 : -1)); return true; }
  const wx = Math.round(mapCache.ox + ((px - X) / MAP_PX) * MAP_STEP), wy = Math.round(mapCache.oy + ((py - Y) / MAP_PX) * MAP_STEP);
  if (mapPin && Math.hypot(mapPin.x - wx, mapPin.y - wy) < MAP_STEP * 4) { mapPin = null; log('You take the pin out of your map.'); }
  else { mapPin = { x: wx, y: wy }; log('You pin the map. The compass now points to your pin.', 'good'); sfx.play('quest'); }
  savePin(); draw();
  return true;
}
const MAP_COLORS = ['#3f7d3a', '#2f5f2c', '#dfc78f', '#1d4ed8', '#6b7280', '#a8865a', '#6b7280', '#2e7d32'];

function toggleMap() {
  if (scene === 'house') { log('The map shows the surface. You are indoors.'); return; }
  mapOpen = !mapOpen;
  if (mapOpen && scene === 'dungeon') tip('dmap', 'The dungeon map shows every tile you have seen on this floor: stairs, the way-out door, chests, springs, altars, trial stones and traps you have found. M or Esc closes it.');
  draw();
}
// The dungeon map: everything the hero has seen on this floor, scaled to fit, with
// the things worth going back for picked out, and the way down marked.
const DMAP_COLOURS = { [TILE.WALL]: '#2b3648', [TILE.FLOOR]: '#6b7280', [TILE.EXIT]: '#ffd86b', [TILE.WAYOUT]: '#f5c542', [TILE.CHEST]: '#e0a040', [TILE.SPRING]: '#7bdfff', [TILE.ALTAR]: '#b18cff', [TILE.TRIAL]: '#ff8c5a', [TILE.TOTEM]: '#7ad36b', [TILE.LAVA]: '#e74c3c', [TILE.CRACK]: '#9ca3af', [TILE.DOOR]: '#8b5a2b', [TILE.SHOP]: '#ffd86b', [TILE.CAPTIVE]: '#ff9ecf', [TILE.LEVER]: '#c0c0c0', [TILE.TRAP]: '#ff6b6b' };
const DMAP_LEGEND = [['Stairs down', '#ffd86b'], ['Way out', '#f5c542'], ['Chest', '#e0a040'], ['Spring', '#7bdfff'], ['Altar', '#b18cff'], ['Trial', '#ff8c5a'], ['Trap', '#ff6b6b'], ['Lava', '#e74c3c'], ['Foe', '#ff5c5c'], ['You', '#5fe17a']];
function drawDungeonMap(g, now) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const seenAt = [];
  for (const [k, ch] of chunks) {
    const [cx, cy] = k.split(',').map(Number);
    for (let i = 0; i < ch.seen.length; i++) {
      if (ch.seen[i] !== 1) continue;
      const x = cx * CHUNK + (i % CHUNK), y = cy * CHUNK + Math.floor(i / CHUNK), t = ch.tiles[i];
      if (t === TILE.WALL && !isNearFloor(ch, i)) continue;
      seenAt.push([x, y, t]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  g.fillStyle = 'rgba(6,12,20,0.94)'; g.fillRect(0, 0, canvas.width, canvas.height);
  const title = `${dungeonDef ? dungeonDef.name[0].toUpperCase() + dungeonDef.name.slice(1) : 'Dungeon'} · ${floorText()}`;
  g.fillStyle = '#e6eef8'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText(title, canvas.width / 2, 34);
  if (!seenAt.length) { g.fillStyle = '#9ca3af'; g.font = '14px sans-serif'; g.fillText('You have seen nothing of this floor yet.', canvas.width / 2, canvas.height / 2); g.textAlign = 'left'; return; }
  const top = 52, bottom = canvas.height - 44, side = 24;
  const px = Math.max(2, Math.min(10, Math.floor(Math.min((canvas.width - side * 2) / (x1 - x0 + 1), (bottom - top) / (y1 - y0 + 1)))));
  const W = (x1 - x0 + 1) * px, H = (y1 - y0 + 1) * px, X = Math.floor((canvas.width - W) / 2), Y = top + Math.floor((bottom - top - H) / 2);
  const at = (x, y) => [X + (x - x0) * px, Y + (y - y0) * px];
  for (const [x, y, t] of seenAt) {
    const [sx, sy] = at(x, y);
    const shown = t === TILE.TRAP && !revealedTraps.has(key(x, y)) ? TILE.FLOOR : t;
    g.fillStyle = DMAP_COLOURS[shown] || '#6b7280'; g.fillRect(sx, sy, px, px);
    if (px >= 4 && shown !== TILE.WALL && shown !== TILE.FLOOR) { g.strokeStyle = '#0b1220'; g.lineWidth = 1; g.strokeRect(sx + 0.5, sy + 0.5, px - 1, px - 1); }
  }
  for (const m of monsters) { if (m.hp <= 0 || !isVisible(m.x, m.y)) continue; const [sx, sy] = at(m.x, m.y); g.fillStyle = m.boss ? '#ff2d55' : '#ff5c5c'; g.fillRect(sx, sy, px, px); }
  if (escort) { const [sx, sy] = at(escort.x, escort.y); g.fillStyle = '#ff9ecf'; g.fillRect(sx, sy, px, px); }
  for (const pp of livePets()) { const [sx, sy] = at(pp.x, pp.y); g.fillStyle = '#9ef0b0'; g.fillRect(sx, sy, px, px); }
  { const [sx, sy] = at(player.x, player.y); const pulse = 0.6 + 0.4 * Math.sin(now / 200); g.fillStyle = `rgba(95,225,122,${pulse})`; g.fillRect(sx - 1, sy - 1, px + 2, px + 2); }
  const stairs = seenAt.find(([, , t]) => t === TILE.EXIT), door = seenAt.find(([, , t]) => t === TILE.WAYOUT);
  if (stairs && px >= 3) { const [sx, sy] = at(stairs[0], stairs[1]); g.fillStyle = '#ffd86b'; g.font = 'bold 11px sans-serif'; g.fillText('▼ stairs', sx + px / 2, sy - 3); }
  if (door && px >= 3) { const [sx, sy] = at(door[0], door[1]); g.fillStyle = '#f5c542'; g.font = 'bold 11px sans-serif'; g.fillText('way out', sx + px / 2, sy - 3); }
  // the legend, and the way to close it
  g.font = '11px sans-serif'; g.textAlign = 'left';
  let lx = Math.max(12, Math.floor((canvas.width - DMAP_LEGEND.length * 74) / 2)), ly = canvas.height - 22;
  for (const [label, col] of DMAP_LEGEND) { g.fillStyle = col; g.fillRect(lx, ly - 9, 10, 10); g.fillStyle = '#cfe9ff'; g.fillText(label, lx + 14, ly); lx += 74; }
  g.fillStyle = '#9ca3af'; g.textAlign = 'center'; g.fillText(`${seenAt.filter(([, , t]) => t !== TILE.WALL).length} tiles seen · M or Esc closes the map`, canvas.width / 2, canvas.height - 6); g.textAlign = 'left';
}
// walls only show on the map where they border something seen and open, so the map reads as rooms, not a block
function isNearFloor(ch, i) {
  const x = i % CHUNK, y = Math.floor(i / CHUNK);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= CHUNK || ny >= CHUNK) continue; const j = ny * CHUNK + nx; if (ch.seen[j] === 1 && ch.tiles[j] !== TILE.WALL) return true; }
  return false;
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
      { const ca = continentOf(a.cx, a.cy); if (!b || ca < 0 || ca !== continentOf(b.cx, b.cy)) continue; }   // roads only within a continent, never across the sea
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
    if (st.lair && !lairKnown(st.lair)) continue;
    const [sx, sy] = toPx(st.x, st.y);
    if (MAP_STEP > 2) { g.fillStyle = st.lair ? '#ef4444' : '#c084fc'; g.fillRect(sx - 2, sy - 2, 4, 4); continue; }   // zoomed out: just a dot
    if (st.lair) {
      const L = LAIRS[st.lair], slain = lairState().slain.includes(st.lair);
      g.fillStyle = slain ? '#6b7280' : '#ef4444'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', sx, sy);
      g.fillStyle = '#ffd86b'; g.font = 'bold 9px sans-serif'; g.fillText('♛', sx, sy - 11);
      g.font = 'bold 10px sans-serif'; g.fillStyle = slain ? '#9ca3af' : '#fca5a5'; g.fillText(`${st.name}${slain ? ' (slain)' : ''}`, sx, sy + 13); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = 'bold 11px sans-serif';
      continue;
    }
    g.fillStyle = '#c084fc'; g.fillRect(sx - 4, sy - 4, 8, 8); g.fillStyle = '#1b1b2f'; g.fillRect(sx - 2, sy - 2, 4, 4);
    g.font = '10px sans-serif'; const rt = rating(siteDungeon(st)); g.fillStyle = '#e9d5ff'; g.fillText(st.name, sx, sy - 16); g.fillStyle = rt.color; g.fillText(`Lv ${rt.rec}+ ${rt.label}`, sx, sy - 6); g.font = 'bold 11px sans-serif';
  }
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const t = townAt(i, j);
    if (!t) continue;
    const [x, y] = toPx(t.x0, t.y0), w = (tw(t) / MAP_STEP) * MAP_PX, h = (th(t) / MAP_STEP) * MAP_PX;
    drawMapTown(g, t, x, y, w, h);
  }
  // places you have discovered
  g.font = '9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (const k of player.meta.places) {
    const pl = placeAt(...k.split(',').map(Number));
    if (!pl) continue;
    const [px, py] = toPx(pl.x, pl.y);
    if (px < 0 || py < 0 || px > c.width || py > c.height) continue;
    g.fillStyle = '#9fd4ff'; g.beginPath(); g.arc(px, py, MAP_STEP > 2 ? 2 : 3, 0, Math.PI * 2); g.fill();
    if (MAP_STEP <= 2) { g.fillStyle = '#cfe9ff'; g.fillText(pl.name.replace(/^the /, ''), px, py - 4); }
  }
  // treasure charts
  g.font = 'bold 13px sans-serif'; g.textBaseline = 'middle';
  for (const k of charts()) {
    const [x, y] = k.split(',').map(Number), [px, py] = toPx(x, y);
    if (px < 0 || py < 0 || px > c.width || py > c.height) continue;
    g.fillStyle = 'rgba(6,12,20,0.6)'; g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff6b6b'; g.fillText('✕', px, py + 1);
  }
  g.textBaseline = 'bottom';
  // realm names over their capitals
  g.font = 'bold 13px sans-serif';
  for (const id of (farShoreOpen() ? ALL_REALMS : REALM_ORDER)) {
    const cap = townAt(...REALMS[id].capital); if (!cap) continue;
    const [px, py] = toPx(cap.cx, cap.y0);
    g.fillStyle = 'rgba(6,12,20,0.7)'; const lw = g.measureText(REALMS[id].name).width + 12; g.fillRect(px - lw / 2, py - 46, lw, 18);
    g.fillStyle = REALMS[id].color; g.fillText(REALMS[id].name, px, py - 31);
  }
  g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  mapCache.ox = ox; mapCache.oy = oy;
}
// A town on the world map: a little illustrated settlement in its realm's colours,
// sized by its rank, walled if it is a castle, finer the more prosperous it is.
// A painted pictogram for a settlement on the world map, scaled with the zoom.
function drawSettlementIcon(g, cx, cy, sc, o) {
  const roofs = { cantons: ['#b03a3a', '#7a4a2a', '#2e7d32'], aurum: ['#b91c1c', '#4b5563', '#7c2d12'], kathar: ['#b08840', '#8c6a2c', '#a07a35'], league: ['#5b3a8b', '#4c2f7a', '#6d3b8b'], tianxia: ['#b91c1c', '#166534', '#9a3412'], suryadesh: ['#d97706', '#b45309', '#7c2d12'], severin: ['#1d4ed8', '#15803d', '#b91c1c'] }[o.realm] || ['#b03a3a', '#7a4a2a', '#2e7d32'];
  const wallCol = { league: '#ece9f2', kathar: '#a0703a', tianxia: '#f1e4c8', suryadesh: '#e8c48a', severin: '#8b5a2b' }[o.realm] || '#e3cfa6', stone = '#9ca3af', stoneDark = '#6b7280';
  const S = (v) => v * sc;
  const house = (hx, hy, hw, hh, roof, lit = true) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(hx + S(1.5), hy + S(1.5), hw, hh);
    g.fillStyle = wallCol; g.fillRect(hx, hy, hw, hh);
    g.fillStyle = roof; g.beginPath(); g.moveTo(hx - S(1.5), hy); g.lineTo(hx + hw / 2, hy - hh * 0.75); g.lineTo(hx + hw + S(1.5), hy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(hx - S(1.5), hy); g.lineTo(hx + hw / 2, hy - hh * 0.75); g.lineTo(hx + hw / 2, hy); g.closePath(); g.fill();
    if (lit && hw >= S(6)) { g.fillStyle = o.tier === 0 ? '#5b4a3a' : '#ffd86b'; g.fillRect(hx + hw * 0.3, hy + hh * 0.35, Math.max(1, S(1.6)), Math.max(1, S(1.6))); if (hw >= S(9)) g.fillRect(hx + hw * 0.65, hy + hh * 0.35, Math.max(1, S(1.6)), Math.max(1, S(1.6))); }
    g.strokeStyle = 'rgba(20,16,10,0.55)'; g.lineWidth = Math.max(0.6, S(0.6)); g.strokeRect(hx, hy, hw, hh);
  };
  const tower = (tx, ty, tw, th, roof, cone = true) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(tx + S(1.5), ty + S(1.5), tw, th);
    const lg = g.createLinearGradient(tx, 0, tx + tw, 0); lg.addColorStop(0, '#b4bac4'); lg.addColorStop(1, stoneDark);
    g.fillStyle = lg; g.fillRect(tx, ty, tw, th);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = ty + S(3); yy < ty + th; yy += S(3)) g.fillRect(tx, yy, tw, Math.max(0.5, S(0.5)));
    if (cone) { g.fillStyle = roof; g.beginPath(); g.moveTo(tx - S(1), ty); g.lineTo(tx + tw / 2, ty - th * 0.7); g.lineTo(tx + tw + S(1), ty); g.closePath(); g.fill(); }
    else { g.fillStyle = stone; for (let k = 0; k < 3; k++) g.fillRect(tx + k * tw / 3, ty - S(2), tw / 4.5, S(2)); }
    g.fillStyle = '#1b1b2f'; g.fillRect(tx + tw / 2 - S(0.8), ty + th * 0.3, Math.max(1, S(1.6)), Math.max(1, S(2.5)));
    g.strokeStyle = 'rgba(20,16,10,0.55)'; g.lineWidth = Math.max(0.6, S(0.6)); g.strokeRect(tx, ty, tw, th);
  };
  const flag = (fx, fy, col) => { g.fillStyle = '#3b2a1a'; g.fillRect(fx, fy - S(9), Math.max(1, S(1)), S(9)); g.fillStyle = col; g.beginPath(); g.moveTo(fx + S(1), fy - S(9)); g.lineTo(fx + S(7), fy - S(7)); g.lineTo(fx + S(1), fy - S(5)); g.fill(); };
  const tree = (tx, ty) => { g.fillStyle = '#5b3a1a'; g.fillRect(tx - S(0.8), ty - S(3), Math.max(1, S(1.6)), S(4)); g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(tx, ty - S(5), S(3.5), 0, Math.PI * 2); g.fill(); g.fillStyle = '#4caf50'; g.beginPath(); g.arc(tx - S(1), ty - S(6), S(1.6), 0, Math.PI * 2); g.fill(); };
  // the ground: a soft patch of paving or mud
  g.fillStyle = o.tier === 0 ? 'rgba(107,82,54,0.85)' : o.realm === 'league' ? 'rgba(214,211,224,0.85)' : 'rgba(120,120,110,0.75)';
  const gw = S(o.size === 'village' ? 30 : o.size === 'town' ? 40 : 50), gh = S(o.size === 'village' ? 16 : o.size === 'town' ? 20 : 24);
  g.beginPath(); g.ellipse(cx, cy + S(4), gw / 2, gh / 2, 0, 0, Math.PI * 2); g.fill();
  if (o.walled) {
    const ww = S(o.grand ? 50 : 42), wh = S(o.grand ? 26 : 22), wx = cx - ww / 2, wy = cy - wh / 2 + S(2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx + S(2), wy + S(2), ww, wh);
    g.fillStyle = o.grand ? '#c9a24a' : stone; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = o.grand ? '#a07a35' : stoneDark; g.fillRect(wx + S(3), wy + S(3), ww - S(6), wh - S(6));
    g.fillStyle = o.tier === 0 ? '#6b5236' : '#8f8f86'; g.fillRect(wx + S(4), wy + S(4), ww - S(8), wh - S(8));
    g.fillStyle = o.grand ? '#ffd86b' : '#cbd5e1'; for (let k = 0; k < ww; k += S(4)) g.fillRect(wx + k, wy - S(1.5), S(2), S(1.5));
    for (const [tx, ty] of [[wx - S(2), wy - S(2)], [wx + ww - S(5), wy - S(2)], [wx - S(2), wy + wh - S(7)], [wx + ww - S(5), wy + wh - S(7)]]) tower(tx, ty, S(7), S(9), o.grand ? '#ffd86b' : roofs[1], !o.grand);
    g.fillStyle = '#3b2a1a'; g.beginPath(); g.roundRect(cx - S(2.5), wy + wh - S(5), S(5), S(5), [S(2.5), S(2.5), 0, 0]); g.fill();
    if (o.grand) {
      tower(cx - S(11), cy - S(10), S(8), S(14), '#ffd86b'); tower(cx + S(3), cy - S(10), S(8), S(14), '#ffd86b');
      house(cx - S(7), cy - S(4), S(14), S(9), '#b91c1c'); tower(cx - S(3), cy - S(16), S(6), S(12), '#ffd86b');
      flag(cx + S(12), cy - S(8), '#f5c542'); flag(cx - S(14), cy - S(8), '#f5c542');
    } else {
      house(cx - S(8), cy - S(4), S(16), S(9), roofs[0]); tower(cx - S(3), cy - S(13), S(6), S(10), roofs[1]);
      flag(cx + S(5), cy - S(10), o.color);
    }
  } else if (o.size === 'village') {
    house(cx - S(12), cy - S(2), S(8), S(6), roofs[0]); house(cx + S(2), cy - S(3), S(9), S(7), roofs[1]); house(cx - S(3), cy + S(2), S(7), S(5), roofs[2], o.tier > 0);
    tree(cx + S(13), cy + S(3)); if (o.tier === 0) tree(cx - S(15), cy + S(5));
  } else if (o.size === 'town') {
    house(cx - S(16), cy - S(2), S(9), S(7), roofs[0]); house(cx + S(7), cy - S(3), S(9), S(7), roofs[1]); house(cx - S(5), cy + S(3), S(10), S(6), roofs[2]);
    house(cx + S(5), cy + S(4), S(8), S(5), roofs[0]); house(cx - S(14), cy + S(5), S(7), S(5), roofs[1], o.tier > 0);
    tower(cx - S(3), cy - S(13), S(6), S(12), roofs[1]);   // the bell tower
    tree(cx + S(18), cy + S(6));
  } else {   // a city: dense roofs, a spire and a dome
    for (const [hx, hy, hw, hh, k] of [[-20, -2, 10, 7, 0], [-9, -5, 9, 7, 1], [1, -4, 10, 7, 2], [12, -2, 9, 7, 0], [-16, 5, 9, 6, 1], [-6, 6, 10, 6, 2], [5, 5, 9, 6, 0], [15, 6, 8, 5, 1]]) house(cx + S(hx), cy + S(hy), S(hw), S(hh), roofs[k]);
    g.fillStyle = stone; g.beginPath(); g.arc(cx + S(6), cy - S(7), S(5), Math.PI, 0); g.fill(); g.fillStyle = o.realm === 'league' ? '#c084fc' : roofs[0]; g.beginPath(); g.arc(cx + S(6), cy - S(7), S(4), Math.PI, 0); g.fill();   // the dome
    tower(cx - S(6), cy - S(17), S(6), S(13), o.realm === 'league' ? '#5b3a8b' : roofs[1]);   // the spire
    flag(cx - S(3), cy - S(17), o.color);
  }
  if (o.port) {
    const px = cx + gw / 2 - S(2), py = cy + S(6);
    g.fillStyle = '#8b5a2b'; g.fillRect(px, py, S(10), S(2.5)); g.fillStyle = '#5b3a1a'; g.fillRect(px + S(2), py + S(2.5), S(1), S(2)); g.fillRect(px + S(7), py + S(2.5), S(1), S(2));
    g.fillStyle = '#6b4423'; g.beginPath(); g.moveTo(px + S(9), py + S(5)); g.lineTo(px + S(16), py + S(5)); g.lineTo(px + S(14), py + S(7.5)); g.lineTo(px + S(10.5), py + S(7.5)); g.closePath(); g.fill();
    g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(px + S(12.5), py + S(4.5)); g.lineTo(px + S(12.5), py - S(1)); g.lineTo(px + S(15.5), py + S(3.5)); g.closePath(); g.fill();
  }
}
function drawMapTown(g, t, x, y, w, h) {
  const I = townIdentity(t), realm = t.realm || 'cantons', tier = townTier(t), col = REALMS[realm].color;
  const grand = t.size === 'grand', cx = x + w / 2, cy = y + h / 2;
  const sc = MAP_STEP <= 2 ? 1.15 : MAP_STEP <= 4 ? 0.7 : 0.5;
  drawSettlementIcon(g, cx, cy, sc, { size: grand ? 'city' : t.size === 'castle' ? 'city' : t.size, realm, walled: t.walled, grand, port: !!t.harbour, tier, color: col });
  // the gate
  g.fillStyle = '#5fe17a'; g.fillRect(cx - 1.5, cy + 14 * sc, 3, 3);
  // the name: everything close up; cities, castles, capitals and home when far; capitals only at the widest view
  const big = grand || t.capital || t.size === 'city' || t.walled || t.key === homeTown;
  if (MAP_STEP <= 2 || (MAP_STEP <= 4 && big) || grand || t.capital) {
    const label = (t.harbour ? '⚓ ' : '') + (t.key === homeTown ? t.name + ' (home)' : t.name) + (grand ? ' ♛' : t.capital ? ' ✦' : ''), lw = g.measureText(label).width + 8;
    const ly = cy - (grand ? 26 : t.walled || t.size === 'city' ? 22 : t.size === 'town' ? 18 : 12) * sc - 4;
    g.fillStyle = 'rgba(6,12,20,0.78)'; g.beginPath(); g.roundRect(cx - lw / 2, ly - 13, lw, 14, 3); g.fill();
    g.fillStyle = grand ? '#fbbf24' : t.capital ? col : '#ffd86b'; g.fillText(label, cx, ly);
  }
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
  // warcamps and the armies on the march
  { const cx0 = mapCache.ox + (c.width / MAP_PX) * MAP_STEP / 2, cy0 = mapCache.oy + (c.height / MAP_PX) * MAP_STEP / 2;
    const [ci, cj] = cellOf(cx0, cy0);
    const spanI = Math.ceil((c.width / MAP_PX) * MAP_STEP / TOWN_SPACING / 2) + 1, spanJ = Math.ceil((c.height / MAP_PX) * MAP_STEP / TOWN_SPACING / 2) + 1;
    for (let i = ci - spanI; i <= ci + spanI; i++) for (let j = cj - spanJ; j <= cj + spanJ; j++) {
      const wc = campAt(i, j); if (!wc) continue;
      const qx = X + ((wc.x - mapCache.ox) / MAP_STEP) * MAP_PX, qy = Y + ((wc.y - mapCache.oy) / MAP_STEP) * MAP_PX;
      if (qx < X || qy < Y || qx > X + c.width || qy > Y + c.height) continue;
      const razed = campRazed(wc);
      g.fillStyle = razed ? '#6b7280' : '#dc2626'; g.beginPath(); g.moveTo(qx, qy - 5); g.lineTo(qx + 5, qy + 4); g.lineTo(qx - 5, qy + 4); g.fill();
      if (!razed && MAP_STEP <= 2) { g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fca5a5'; g.fillText(`camp ${wc.strength}`, qx, qy + 13); g.textAlign = 'left'; }
    }
    for (const a of armiesUnlocked() ? war().armies : []) {
      const ax = X + ((a.x - mapCache.ox) / MAP_STEP) * MAP_PX, ay = Y + ((a.y - mapCache.oy) / MAP_STEP) * MAP_PX;
      const tx = X + ((a.tx - mapCache.ox) / MAP_STEP) * MAP_PX, ty = Y + ((a.ty - mapCache.oy) / MAP_STEP) * MAP_PX;
      g.strokeStyle = REALMS[a.realm].color; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#1b1b2f'; g.fillRect(ax - 1, ay - 12, 2, 14);
      g.fillStyle = REALMS[a.realm].color; g.beginPath(); g.moveTo(ax + 1, ay - 12); g.lineTo(ax + 11, ay - 8); g.lineTo(ax + 1, ay - 4); g.fill();
      g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(`${a.mine ? 'yours ' : ''}${a.troops}`, ax, ay + 12); g.textAlign = 'left';
    }
  }
  // bounties you have taken
  for (const q of activeBounties()) {
    const t = townAt(...q.target.split(',').map(Number)); if (!t) continue;
    const b = bountyFor(t), bx = X + ((b.x - mapCache.ox) / MAP_STEP) * MAP_PX, by = Y + ((b.y - mapCache.oy) / MAP_STEP) * MAP_PX;
    if (bx < X || by < Y || bx > X + c.width || by > Y + c.height) continue;
    g.fillStyle = '#ef4444'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', bx, by);
    g.font = 'bold 11px sans-serif'; g.fillStyle = '#ffd1d1'; g.fillText(b.name, bx, by + 14); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
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
  if (player.meta.ship && !aboard) {   // the ship, where it was left
    const sx = X + ((player.meta.ship.x - mapCache.ox) / MAP_STEP) * MAP_PX, sy = Y + ((player.meta.ship.y - mapCache.oy) / MAP_STEP) * MAP_PX;
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('⛵', sx, sy); g.textBaseline = 'alphabetic';
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
  g.fillText(`${here ? here.name : 'The wilds'}  ·  position ${player.x}, ${player.y}  ·  each square is ${MAP_STEP} tiles  ·  + / − or scroll to zoom  ·  click to place or remove a pin  ·  M or Esc closes`, 112, 18);
  // zoom buttons
  for (const bz of mapZoomButtons()) {
    const on = bz.id === 'in' ? mapZoom > 1 : mapZoom < ZOOM_STEPS.length;
    g.fillStyle = 'rgba(6,12,20,0.85)'; g.beginPath(); g.roundRect(bz.x, bz.y, bz.w, bz.h, 5); g.fill();
    g.strokeStyle = on ? '#ffd86b' : '#4b5563'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(bz.x + 0.5, bz.y + 0.5, bz.w - 1, bz.h - 1, 5); g.stroke();
    g.fillStyle = on ? '#ffd86b' : '#6b7280'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(bz.id === 'in' ? '+' : '−', bz.x + bz.w / 2, bz.y + bz.h / 2 + 1);
  }
  g.font = 'bold 11px sans-serif'; g.fillStyle = '#cfe9ff'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(['close', 'far', 'the whole world'][mapZoom - 1], X + c.width - 76, Y + c.height - 21);
  g.textAlign = 'left';
  // legend
  const items = [['#3f7d3a', 'grass'], ['#2e7d32', 'forest'], ['#1d4ed8', 'water'], ['#6b7280', 'mountains / town'], ['#a8865a', 'road'], ['#5fe17a', 'gate'], ['#c084fc', 'cave, crypt or tower (★ danger)'], ['#8b5a2b', '⚓ port: ships sail to other ports']];
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
  { const pp = petAt(x, y); if (pp) return `Your ${petLabel(pp)} — ${pp.hp}/${pp.maxHp} HP, bite ${pp.atk}, level ${pp.level}, ${pp.kills} kills`; }
  if (shipAt(x, y)) return 'Your ship — walk into her to go aboard';
  { const rf = rifts.find((r) => r.x === x && r.y === y); if (rf) return rf.lord ? 'The Rift Lord\'s door — it shuts when he dies' : `A rift to Midgard — it shuts when its horde (${riftHorde(rf).length} left) is dead`; }
  if (charts().includes(key(x, y))) return 'X marks the spot — step here to dig';
  if (t === TILE.SHIP) { const pt = portAtTile(x, y); return pt ? `The ship of ${pt.name} — walk into it, or speak to the harbourmaster, to sail to another port` : 'A boat'; }
  if (scene === 'world' && groundAt(x, y) === GROUND.DOCK) return 'The pier — the harbourmaster at the end sells passage by sea';
  if (t === TILE.WARCAMP) { const wc = campAtTile(x, y); if (wc) return campRazed(wc) ? `${wc.name} — razed` : `${wc.name} — orc warcamp, strength ${wc.strength}. ${armiesUnlocked() ? 'Send a realm\'s army' : `Armies open at level ${ARMY_LEVEL}`}`; }
  if (t === TILE.PLOT) { const tw = townContaining(x, y); if (tw) { const b = buildingAt(tw, plotSlot(tw, x, y)); return b ? `${b.builder}'s ${monumentName(b)}, level ${b.level}${b.upgrader && b.upgrader !== b.builder ? ` (upgraded by ${b.upgrader})` : ''} — ${levelDesc(b.type, b.level)}. Walk into it to use it${monumentUsed(tw, plotSlot(tw, x, y)) ? ' (used recently)' : ''}` : 'Empty building plot — pay an innkeeper here to build a monument for every hero'; } }
  if (t === TILE.MONUMENT) { const tw = townContaining(x, y); if (tw && tw.memorial && x === tw.cx - 4 && y === tw.cy + 3) return `The memorial of the Long Night — raised by ${tw.memorial}. Walk into it to read the names`; if (tw) { const L = townIdentity(tw).landmark; return `${L.name[0].toUpperCase() + L.name.slice(1)} — the pride of ${tw.name}. Walk into it to look closer`; } }
  if (getTile(x, y) === TILE.WAYSTONE) return 'Waystone — walk into it to travel to any town you have visited';
  const n = scene !== 'dungeon' && getNpcAt(x, y);
  if (n && n.type.notable) return `${n.type.name}, ${n.type.role} — walk into them to hear their story`;
  if (n && n.type.guard) return `${n.type.name} — the town watch (${n.hp}/${n.maxHp} HP). Keeps beasts from the gates; walk into them to chat`;
  if (n) return `${n.type.name} — walk into them to ${n.type.action === 'shop' || n.type.action === 'potions' ? 'trade' : n.type.action === 'inn' ? 'rest' : 'chat'}`;
  if (isVisible(x, y)) {
    const m = getMonsterAt(x, y);
    if (m) {
      const per = Math.max(1, player.atk + weaponAtk() + 0.5 - (m.mod === 'armored' ? 2 : 0)) * (!m.awake && !m.boss ? (traitOf(player.weapon) === 'dagger' ? 3 : 2) : 1);
      const hits = Math.max(1, Math.ceil(m.hp / per)), takes = Math.max(1, m.atk - armorDef());
      const threat = takes * 3 >= player.hp ? ' Dangerous for you now.' : '';
      return `${m.boss ? bossTitle(m) + ' (boss)' : m.elite ? `${m.name} (elite: ${ELITE_MODS[m.mod].desc})` : m.type.name} — ${m.hp}/${m.maxHp} HP. Hits you for ${takes}${m.type.ranged ? ' from range' : ''}${m.type.poison ? ' and may poison' : ''}; about ${hits} ${hits === 1 ? 'hit' : 'hits'} to kill${m.tell ? '. ' + TELL_TEXT[m.tell.kind][0].toUpperCase() + TELL_TEXT[m.tell.kind].slice(1) : m.reeling > 0 ? '. Off balance: your next blow is a sneak attack' : ''}${m.awake ? '' : '. Asleep: sneak attack for ' + (player.weapon === 'dagger' ? 'triple' : 'double') + ' damage'}.${threat}`;
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
  if (t === TILE.CAPTIVE) return 'A captive in chains — walk into them to strike the chains off, then lead them to the stairs or the way out';
  if (t === TILE.TOTEM) return `A goblin totem — it keeps calling goblins. Walk into it to smash it (${totems.get(key(x, y)) || 3} blows, one with a warhammer)`;
  if (t === TILE.LEVER) return 'A lever in the wall — pull it to sink every spike trap on this floor';
  if (t === TILE.ALTAR) return 'A dungeon altar — walk into it to make an offering, or drink from its font';
  if (t === TILE.TRIAL) return trial && trial.x === x && trial.y === y ? `${TRIALS[trial.kind].label} is under way: ${trial.turns} turns left` : 'A ring of trial stones — walk into it to take up a trial for a sure reward';
  if (t === TILE.SPRING) return usedSprings.has(key(x, y)) ? 'A dry spring' : 'Healing spring — walk into it for full health, once';
  if (t === TILE.WAYOUT) return 'Way out — walk into it twice to leave the dungeon early, keeping your loot';
  if (t === TILE.SITE && inTown()) { const sl = siteAtTile(x, y); if (sl && sl.lair) return `${sl.name} — a super boss's lair, ${ratingText(siteDungeon(sl))}. ${LAIRS[sl.lair].boss.name[0].toUpperCase() + LAIRS[sl.lair].boss.name.slice(1)} waits below${lairState().slain.includes(sl.lair) ? ' (slain before)' : ''}`; }
  if (t === TILE.SITE && inTown()) { const st0 = siteAtTile(x, y); if (st0 && st0.deep) return story().phase === 'done' ? `The Gate of the Deep — endless floors, a boss every fifth, ${ratingText(siteDungeon(st0))}. Your record: floor ${player.meta.deepest || 0}` : 'A gate of black iron, sealed while the Crown lies broken'; }
  if (t === TILE.SITE && inTown()) { const st = siteAtTile(x, y); if (st) return st.story && !storySiteOpen(st.story) ? (st.story === 'gate' ? `${st.name} — a door of ice in the hill, shut, with a raven on it` : `${st.name} — sealed with old gold`) : `${st.name} — ${st.floors} floors, ${ratingText(siteDungeon(st))}${st.story ? ', a shard lies within' : ''}, step in to explore`; }
  if (t === TILE.PLACE && inTown()) { const pl = placeAtTile(x, y); if (pl) return discovered(pl) ? `${pl.name[0].toUpperCase() + pl.name.slice(1)} — ${PLACE_TYPES[pl.type].label}, walk into it` : 'Something old stands here — walk into it'; }
  if (inTown()) {
    const gnd = groundAt(x, y);
    if (gnd === GROUND.WATER) return seaTile(x, y) ? (aboard ? 'Open sea' : player.meta.ship ? 'The sea — your ship could sail here' : 'The sea — harbourmasters sell ships to sail it, and fish bite along the shore') : 'Water — too deep to cross';
    if (gnd === GROUND.MOUNTAIN) return 'Mountains — no way over';
    if (gnd === GROUND.SNOW) return 'Snow — deep, cold, and quiet';
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
  return !!occupiedBy(x, y) || shipAt(x, y) || [TILE.TRIAL, TILE.DOOR, TILE.SHOP, TILE.FURNITURE, TILE.CHEST, TILE.WAYSTONE, TILE.PLACE, TILE.WAYOUT, TILE.CRACK, TILE.SPRING, TILE.MONUMENT, TILE.PLOT, TILE.WARCAMP, TILE.SHIP, TILE.CAPTIVE, TILE.TOTEM, TILE.LEVER, TILE.ALTAR].includes(t);
}
// The tiles from the hero to a target (not including the hero's own tile), shortest first.
function pathTo(tx, ty, limit = 60) {
  let d = bfs(tx, ty, limit, false, true, aboard);
  if (d.get(key(player.x, player.y)) === undefined) d = bfs(tx, ty, limit, false, false, aboard);   // only through hazards if there is no other way
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
  if (mapOpen && scene === 'world') { const { px, py } = canvasPoint(e.clientX, e.clientY); if (mapClick(px, py)) return; }
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
// The wheel zooms the world map while it is open; elsewhere it scrolls the page as usual.
canvas.addEventListener('wheel', (e) => { if (!mapOpen) return; e.preventDefault(); setMapZoom(mapZoom + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
// Right-click: the hero's ability, aimed at the tile under the pointer.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isTouch || !player || gameOver || perkChoices || shopOpen || journalOpen || mapOpen || questsOpen || storyOpen()) return;
  const wasWalking = walk.active;
  stopWalk();
  if (wasWalking) { draw(); return; }   // the first right-click only stops a walk
  sfx.unlock(); clearInspect();
  const t = tileFromEvent(e);
  useAbility(t, e.shiftKey ? 1 : e.altKey ? 2 : 0);
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
  for (const pp of pets) add(petKind(pp).sprite, `Your ${petLabel(pp)}`, pp.down ? 'resting at the inn' : pp.aboard ? 'aboard your ship' : `level ${pp.level}, bites ${pp.atk}`);
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
    { const gd = npcs.find((n) => n.type.guard); if (gd) add(gd.type.sprite, 'The town watch', 'guards the square and the gate'); }
    add('waystone', 'Waystone', 'fast travel between visited towns');
    add('stairs', 'Gate', 'into the dungeon');
    add('tree', 'Forest, water, mountains', 'impassable; roads join the towns');
    add('cave', 'Caves, crypts, towers', 'short dungeons with a boss and a hoard');
    add('rat', 'Beasts of the wilds', 'roam outside the towns, bolder at night');
  } else { add('stairs', 'Stairs', 'follow the compass'); add('chest', 'Chest', 'gold, sometimes gear'); add('trap', 'Spike trap', 'hidden until found'); }
}

function updateStats() {
  const where = scene === 'house' ? interior.house.name : scene === 'dungeon' && dungeonDef && dungeonDef.delve ? `${dungeonDef.name[0].toUpperCase() + dungeonDef.name.slice(1)} ${floor}/5 · Daily` : inTown() ? (townContaining(player.x, player.y)?.name ?? 'The wilds') : `${dungeonDef ? dungeonDef.name : 'Dungeon'} ${floorText()}`;
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
  perkCursor = 0;
  tip('perk', 'Level up! Pick a perk with the arrow keys and Enter, press 1, 2 or 3, or click one. Perks stay with your hero for good.');
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
  g.fillStyle = '#a8c0d8'; g.font = '13px sans-serif'; g.fillText('Arrow keys and Enter, 1, 2 or 3, or click a card', canvas.width / 2, top - 48);
  const { w, h, gap, x0, y0 } = perkLayout();
  perkChoices.forEach((id, i) => {
    const x = x0 + i * (w + gap);
    const sel = i === perkCursor;
    g.fillStyle = sel ? '#0b2e3a' : '#06202c'; g.beginPath(); g.roundRect(x, y0, w, h, 10); g.fill();
    g.strokeStyle = sel ? '#5fe17a' : '#12384a'; g.lineWidth = sel ? 3 : 2; g.stroke();
    if (sel) { g.fillStyle = '#5fe17a'; g.font = 'bold 15px sans-serif'; g.fillText('▶', x + w - 24, y0 + 16); }
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
    player.maxHp += 4; player.atk += 1; player.hp = player.maxHp; mapCache.ox = null; restoreMana();
    { const A = abilityList().find((a, k) => k > 0 && a.level === player.level); if (A) { log(`New ability: ${A.name} (key ${abilityList().indexOf(A) + 1}): ${A.blurb}.`, 'good'); toast = { text: `New ability: ${A.name}. Press ${abilityList().indexOf(A) + 1}.`, until: performance.now() + 5000 }; } }
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
  dawnbreaker: { name: 'Sundering', desc: 'every blow also strips a tenth of the foe\'s full health, and the blade lights two tiles further' },
};
// One-of-a-kind gear from the lairs borrows the fighting style of a common weapon.
const LEGEND_TRAIT = { fangblade: 'dagger', tidecaller: 'longsword', stormhammer: 'warhammer', staffofages: 'greatsword' };
const traitOf = (id) => { const b = baseOf(id); return LEGEND_TRAIT[b] || b; };
const nameOf = (m) => (m.boss ? m.name : 'the ' + mName(m));
function moveMonster(m, x, y) { monsterIndex.delete(key(m.x, m.y)); m.x = x; m.y = y; monsterIndex.set(key(m.x, m.y), m); monstersDirty = true; }
function playerAttack(m) {
  const w = traitOf(player.weapon), sneak = (!m.awake || m.reeling > 0) && !m.boss, solo = !coopMember();
  m.struck = turn; m.reeling = 0;
  let dmg = Math.max(1, player.atk + weaponAtk() + rnd(2) - (m.mod === 'armored' ? 2 : 0));
  const notes = [];
  if (sneak) { dmg *= w === 'dagger' ? 3 : 2; notes.push('Sneak attack!'); tip('sneak', 'Sleeping monsters take double damage from your first blow, triple with a dagger. Creep up on them.'); }
  else if (w === 'short_sword' && Math.random() < 0.2) { dmg *= 2; notes.push('Critical hit!'); }
  if (w === 'dagger' && Math.random() < 0.2) { const extra = Math.max(1, Math.floor(dmg / 2)); dmg += extra; notes.push('You stab twice!'); }
  const wa = wornAffix('weapon');
  if (wa && wa.id === 'keen' && !sneak && Math.random() < 0.1 * wa.tier) { dmg *= 2; notes.push('A keen blow: double damage!'); }
  // the hammer drives the foe back, or into the wall behind it
  if (w === 'warhammer' && solo && !m.boss && m.hp - dmg > 0) {
    const bx = m.x + Math.sign(m.x - player.x), by = m.y + Math.sign(m.y - player.y);
    const back = m.sea ? seaTile(bx, by) : walkable(getTile(bx, by));
    if (back && !getMonsterAt(bx, by) && !houndAt(bx, by) && !mpPlayerAt(bx, by)) { moveMonster(m, bx, by); notes.push('Knocked back!'); }
    else if (getTile(bx, by) === TILE.WALL && !(scene === 'world' && groundAt(bx, by) === GROUND.WATER)) { dmg += 3; notes.push('Slammed into the wall!'); shakeScreen(3); }
  }
  if (w === 'dawnbreaker') { const sd = Math.ceil(m.maxHp * 0.1); dmg += sd; notes.push('The blade sunders!'); }
  if (m.guard && w !== 'warhammer') { dmg = 1; notes.push('Its shield takes the blow.'); }
  m.hp -= dmg; m.awake = true;
  if (wa && m.hp > 0) {   // the blade's enchantment takes hold
    if (wa.id === 'flaming') { m.burn = { t: 3, d: 1 + wa.tier }; notes.push(`${nameOf(m)} catches fire!`); floatText(m.x, m.y, '🔥', '#ff9f43'); }
    else if (wa.id === 'venom') { m.venom = { t: 4, d: wa.tier }; notes.push(`${nameOf(m)} is poisoned.`); floatText(m.x, m.y, '☠', '#7ad36b'); }
    else if (wa.id === 'frost' && Math.random() < (m.boss ? 0.1 : 0.15 + 0.05 * wa.tier)) { m.stunned = 1; notes.push(`${nameOf(m)} is frozen stiff!`); floatText(m.x, m.y, '❄', '#7bdfff'); }
  }
  if (wa && wa.id === 'vampiric' && player.hp < player.maxHp) { const h = Math.min(player.maxHp - player.hp, Math.max(1, Math.floor(dmg * 0.15 * wa.tier))); player.hp += h; floatText(player.x, player.y, `+${h}`, '#ff6b9b'); }
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
  if (m.trial && trial && m.trial === trial) trial.kills++;
  if (m.mod === 'explosive' || m.type.bomber) {
    const blast = 3 + floor;
    burst(m.x, m.y, '#ff9f43', 36, 180, { glow: true, life: 600, size: 3 }); shakeScreen(5); sfx.play('fire');
    log(`The ${mName(m)} bursts!`, 'bad');
    if (cheb(m, player) <= 1) { player.hp -= blast; floatText(player.x, player.y, `-${blast}`, '#ff6b6b'); }
    for (const pp of livePets()) if (cheb(m, pp) <= 1) petHurt(pp, blast);
  }
  if (m.type.splits && !m.small && !m.boss && !coopMember()) splitSlime(m);
  if (m.sea) {
    if (m.purse) { player.gold += m.purse; floatText(m.x, m.y, `+${m.purse}g`, '#f5c542'); log(`${nameOf(m)[0].toUpperCase() + nameOf(m).slice(1)} goes down. You fish ${m.purse} gold out of the wreckage.`, 'good'); }
    if (m.type.name === 'Pirate sloop') { unlock('seawolf'); const ch = Math.random() < 0.35 ? foundChart('Pinned to the sloop\'s mast,') : ''; if (ch) log(ch.trim(), 'good'); }
    if (m.type.name === 'Kraken') unlock('krakenslayer');
    m.purse = 0;
  }
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
    if (m.boss && dungeonDef && dungeonDef.lair) setTimeout(() => lairSlain(dungeonDef.lair), 60);
    if (m.riftLord) setTimeout(riftLordSlain, 60);
    if (m.boss && dungeonDef && dungeonDef.endless) setTimeout(() => act2Progress('boss', floor), 80);
    if (m.boss) { unlock('boss_slayer'); track('boss_killed', { boss: m.name, floor }); }
    const xp = Math.round(m.type.xp * (wearing('cantonsbadge') ? 1.2 : 1) * (m.small || m.raised ? 0.4 : 1) * (dungeonDef ? dungeonDef.xp : 1) * (m.boss ? 5 : 1) * (m.elite ? 2 : 1) * (scene === 'dungeon' ? (floorMod === 'swarming' ? 1.25 : floorMod === 'cursed' ? 1.5 : 1) : 1));
    if (m.boss) {
      log(dungeonDef && dungeonDef.arena ? `You defeat ${m.name}! The crowd is on its feet.` : m.yields ? `${bossTitle(m)} drops his sword and yields. The seal on the stairs breaks.` : /Halvard/.test(m.name) ? 'Ser Halvard goes down on one knee, then flat. "Go on up," he says through his teeth. "He is expecting you." The stairs are open.' : `You slay ${m.name}! The seal on the stairs breaks.`, 'good');
      const purse = 40 + 30 * (dungeonDef ? dungeonDef.danger : 0) + floor * 10;
      player.gold += purse; floatText(m.x, m.y, `+${purse}g`, '#f5c542');
      sfx.play('win');
    } else log(`You slay the ${mName(m)} (+${xp} XP).`, 'good');
    gainXp(xp);
    questProgress('slay', m.type.name, 1);
    if (m.bounty) {
      questProgress('bounty', m.bounty, 1);
      log(`${m.name} is dead. The watch will want to hear about it.`, 'good');
      if ((player.quests || []).filter((q) => q.kind === 'bounty' && q.done).length >= 3) unlock('hunter');
    }
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
  if (!ranged && player.evade > 0) { player.evade--; log(`You slip aside from ${nameOf(m)}.`, 'good'); floatText(player.x, player.y, 'evade', '#7bdfff'); return; }
  if (!ranged && traitOf(player.weapon) === 'longsword' && Math.random() < 0.2) { log(`You parry ${nameOf(m)}'s blow with your longsword.`, 'good'); floatText(player.x, player.y, 'parry', '#e6eef8'); sfx.play('shield'); return; }
  const aa = wornAffix('armor');
  if (aa && aa.id === 'swift' && Math.random() < 0.08 + 0.04 * aa.tier) { log(`You slip aside from ${nameOf(m)} in your swift ${itemInfo(player.armor).name.toLowerCase()}.`, 'good'); floatText(player.x, player.y, 'dodge', '#7bdfff'); return; }
  const dmg = Math.max(1, m.atk - armorDef() - (player.shield > 0 ? 2 : 0));
  player.hp -= dmg;
  if (aa && aa.id === 'spiked' && !ranged) { const sp = 1 + aa.tier; m.hp -= sp; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${sp}`, '#e6eef8'); if (m.hp <= 0) setTimeout(() => { if (!monsters.includes(m)) return; killMonster(m); if (player.hp <= 0 && !gameOver) { if (perkCount('second_wind') && !player.meta.second_wind) { player.meta.second_wind = true; player.hp = 1; log('Second wind! You refuse to fall.', 'good'); unlock('survivor'); } else die(); updateStats(); } }, 0); }
  if (m.mod === 'vampiric' && m.hp < m.maxHp) { const h = Math.min(dmg, m.maxHp - m.hp); m.hp += h; floatText(m.x, m.y, `+${h}`, '#ff6b9b'); }
  if (dmg >= player.maxHp * 0.25 || m.boss) shakeScreen(m.boss ? 6 : 4);
  burst(player.x, player.y, '#ff5a5a', 8, 110, { life: 380, size: 3 });
  if (isTouch && navigator.vibrate) { try { navigator.vibrate(dmg >= player.maxHp * 0.25 ? 60 : 25); } catch (e) { /* not allowed */ } }
  if (player.hp <= 0 && perkCount('second_wind') && !player.meta.second_wind) {
    player.meta.second_wind = true; player.hp = 1;
    log('Second wind! You refuse to fall.', 'good'); unlock('survivor'); sfx.play('shield');
  }
  if (m.type.thief && !m.loot && player.gold > 0) { const take = Math.min(player.gold, Math.max(5, Math.floor(player.gold * 0.1))); player.gold -= take; m.loot = take; m.purse = (m.purse || 0) + take; m.fleeUntil = turn + 12; log(`The thief snatches ${take} gold from your belt and runs for the dark!`, 'bad'); floatText(player.x, player.y, `-${take}g`, '#f5c542'); tip('thief', 'Thieves grab a tenth of your purse and run. Kill one before it gets away and the gold drops back.'); }
  if (m.type.poison && !player.poison && !wearing('frostheart') && !(aa && aa.id === 'warded') && Math.random() < 0.5) { player.poison = 4; log('You are poisoned! A potion will cure it.', 'bad'); sfx.play('poison'); tip('poison', 'Poison costs 1 HP a turn for four turns. Any potion cures it. Press P to drink one from your bag.'); }
  if (ranged) shoot(m.x, m.y, player.x, player.y, m.type.name === 'Shaman' ? 'hex' : 'arrow');
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
    for (const st of ['burn', 'venom']) { const e = m[st]; if (!e || e.t <= 0 || swiftOnly) continue; e.t--; m.hp -= e.d; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${e.d}`, st === 'burn' ? '#ff9f43' : '#7ad36b'); if (e.t <= 0) m[st] = null; }
    if (m.hp <= 0) { if (coopMember()) coopHit(m, 0, 'hero'); else killMonster(m); continue; }
    if (m.stunned > 0) { if (!swiftOnly) m.stunned--; if (m.tell && !m.boss) { m.tell = null; m.windup = null; m.guard = false; if (isVisible(m.x, m.y)) log(`The stun breaks ${nameOf(m)}'s ${m.type.tell === 'aim' ? 'aim' : m.type.tell === 'guard' ? 'guard' : 'wind-up'}.`, 'good'); } continue; }
    if (m.reeling > 0) { m.reeling--; continue; }
    if (!swiftOnly && m.type.regen && m.hp < m.maxHp && !(m.burn && m.burn.t > 0)) { const h = Math.min(m.type.regen, m.maxHp - m.hp); m.hp += h; if (isVisible(m.x, m.y)) floatText(m.x, m.y, `+${h}`, '#9ef0b0'); }
    if (!swiftOnly && m.type.healer) { let mended = 0; for (const o of monsters) { if (o !== m && o.hp > 0 && o.hp < o.maxHp && cheb(o, m) <= 2) { const h = Math.min(2, o.maxHp - o.hp); o.hp += h; mended++; if (isVisible(o.x, o.y)) floatText(o.x, o.y, `+${h}`, '#9ef0b0'); } } if (mended && isVisible(m.x, m.y) && Math.random() < 0.3) log('The shaman chants, and its pack\'s wounds close.', 'bad'); }
    let hi = 0, hd = Infinity;
    heroes.forEach((h, i) => { const dd = cheb(m, h); if (dd < hd) { hd = dd; hi = i; } });
    if (m.horde && (hd > 6 || !m.awake)) { if (!swiftOnly) hordeStep(m); continue; }   // the hosts of Midgard have a town to burn
    if (hd > SIM_RADIUS) continue;
    const H = heroes[hi];
    if (m.sea) { seaMonsterStep(m, H); continue; }
    { const pv = livePets().find((pp) => dist(m, pp) === 1);
      if (pv && !heroes.some((h) => dist(m, h) === 1)) {
        if (!m.awake && Math.random() < 0.6) m.awake = true;
        if (m.awake && Math.random() < 0.7) { petBitten(pv, m); continue; }
      } }
    const wake = (scene === 'world' ? (dayPhase() === 'night' ? 10 : 6) : 6) - (wearing('wardstone') ? 3 : 0);
    if (!m.awake && dist(m, H) <= wake && (H.me ? isVisible(m.x, m.y) : true) && Math.random() < 0.7) m.awake = true;
    if (m.boss && m.awake && !swiftOnly && bossTurn(m, H, heroes)) continue;
    if (escort && scene === 'dungeon' && dist(m, escort) === 1 && !heroes.some((h) => dist(m, h) === 1) && (m.awake || Math.random() < 0.5)) { m.awake = true; escortHurt(m); if (!escort) continue; continue; }
    if (scene === 'world' && !m.bounty) {
      const gd = npcs.find((n) => n.type.guard && !n.down && dist(m, n) === 1);
      if (gd && !heroes.some((h) => dist(m, h) === 1) && (m.awake || Math.random() < 0.5)) { m.awake = true; guardHurt(gd, m); continue; }
    }
    if (!swiftOnly && !m.boss && m.type.tell && m.awake && tellStep(m, H, heroes)) continue;
    if (m.type.thief && m.loot && m.fleeUntil > turn) {   // away from the hero, and gone for good once far enough
      if (!(m.trial && m.trial === trial && trial.kind === 'blood') && (dist(m, H) > 9 || !isVisible(m.x, m.y) && dist(m, H) > 6)) { log(`The thief vanishes into the dark with your ${m.loot} gold.`, 'bad'); monsters = monsters.filter((x) => x !== m); monsterIndex.delete(key(m.x, m.y)); monstersDirty = true; continue; }
      let best = null, bestD = dist(m, H);
      for (const [dx, dy] of DIRS) { const nx = m.x + dx, ny = m.y + dy; if (walkable(getTile(nx, ny)) && getTile(nx, ny) !== TILE.LAVA && !getMonsterAt(nx, ny) && !houndAt(nx, ny) && !heroAt(nx, ny) && dist({ x: nx, y: ny }, H) > bestD) { bestD = dist({ x: nx, y: ny }, H); best = [nx, ny]; } }
      if (best) { moveMonster(m, best[0], best[1]); continue; }
    }
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
    if ((m.type.ranged && dist(m, H) <= 2) || (m.type.raiser && dist(m, H) <= 3) || (m.type.healer && dist(m, H) <= 3)) {
      // archers back off to shoot again
      for (const [dx, dy] of dirs) {
        const nx = m.x + dx, ny = m.y + dy;
        if (walkable(getTile(nx, ny)) && !getMonsterAt(nx, ny) && !houndAt(nx, ny) && !heroAt(nx, ny) && dist({ x: nx, y: ny }, H) > dist(m, H)) { best = [nx, ny]; break; }
      }
      if (best) { monsterIndex.delete(key(m.x, m.y)); m.x = best[0]; m.y = best[1]; monsterIndex.set(key(m.x, m.y), m); continue; }
    }
    for (const [dx, dy] of dirs) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!walkable(getTile(nx, ny)) || getTile(nx, ny) === TILE.LAVA || getMonsterAt(nx, ny) || heroAt(nx, ny) || houndAt(nx, ny) || (scene === 'world' && getNpcAt(nx, ny))) continue;
      if (scene === 'world' && !m.horde && townContaining(nx, ny)) continue;   // beasts keep out of settlements; hordes do not
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
// Ordinary monsters show their next move a beat early, and each tell has its answer.
// Chop (orcs, trolls): a red tile under you; step off it and the brute is left off
// balance, a sneak attack waiting. Aim (archers): an amber line; leave it, or put
// something else in it. Guard (skeletons): a raised shield that turns blows to a
// scratch, except a warhammer's; hit something else. Glare (basilisks): burning
// eyes; strike it or step closer while they burn and you turn to stone.
const TELL_TEXT = { chop: 'winding up a heavy chop: step off the red tile', aim: 'drawing a bow along the amber line: step out of it', guard: 'shield raised: blows do 1 until it lowers (a warhammer smashes through)', glare: 'eyes burning: do not strike it or step closer this turn' };
function tellStep(m, H, heroes) {
  const kind = m.type.tell, seen = isVisible(m.x, m.y);
  if (m.tell) {
    const t = m.tell; m.tell = null; m.tellCd = 4;
    if (kind === 'chop') {
      m.windup = null;
      const h = heroes.find((h) => h.x === t.x && h.y === t.y);
      burst(t.x, t.y, '#ef4444', 6, 90, { life: 400, size: 3 }); shakeScreen(4);
      if (h) { if (h.me) { const a = m.atk; m.atk = a * 2; monsterAttack(m); m.atk = a; log(`${nameOf(m)}'s chop lands square: double damage.`, 'bad'); } else mpSend({ to: h.id, type: 'attack', payload: { id: m.id, atk: m.atk * 2, ranged: false, type: m.type.name } }); }
      else { m.reeling = 1; if (seen) { log(`${nameOf(m)}'s chop bites stone. It is off balance: your next blow is a sneak attack.`, 'good'); floatText(m.x, m.y, 'off balance', '#ffd86b'); } }
      return true;
    }
    if (kind === 'aim') {
      let hitAt = null;
      for (let k = 1; k <= 6 && !hitAt; k++) {
        const x = m.x + t.dx * k, y = m.y + t.dy * k;
        if (!walkable(getTile(x, y))) { hitAt = { x: x - t.dx, y: y - t.dy, what: 'wall' }; break; }
        const h = heroes.find((h) => h.x === x && h.y === y), pp = livePets().find((p) => p.x === x && p.y === y), o = getMonsterAt(x, y);
        if (h) hitAt = { x, y, what: 'hero', h }; else if (pp) hitAt = { x, y, what: 'pet', pp }; else if (o && o.hp > 0) hitAt = { x, y, what: 'monster', o };
      }
      if (!hitAt) hitAt = { x: m.x + t.dx * 6, y: m.y + t.dy * 6, what: 'air' };
      shoot(m.x, m.y, hitAt.x, hitAt.y, 'arrow');
      if (hitAt.what === 'hero') { if (hitAt.h.me) monsterAttack(m, true); else mpSend({ to: hitAt.h.id, type: 'attack', payload: { id: m.id, atk: m.atk, ranged: true, type: m.type.name } }); }
      else if (hitAt.what === 'pet') petHurt(hitAt.pp, m.atk);
      else if (hitAt.what === 'monster') { const o = hitAt.o; o.hp -= m.atk; o.awake = true; o.flashUntil = performance.now() + 120; floatText(o.x, o.y, `-${m.atk}`, '#ffd86b'); if (seen) log(`${nameOf(m)}'s arrow takes ${nameOf(o)} in the back!`, 'good'); if (o.hp <= 0) killMonster(o); }
      else if (seen) log(`${nameOf(m)}'s arrow clatters off the stone. You were out of its line.`, 'good');
      return true;
    }
    if (kind === 'guard') { m.guard = false; return false; }   // the shield comes down and it fights on
    if (kind === 'glare') {
      const closer = cheb(m, H) < t.d, struck = (m.struck || -1) >= t.turn;
      if (H.me && (closer || struck)) { player.stunned = 1; log(`The basilisk's eyes catch yours as you ${struck ? 'strike' : 'close'}. Your limbs turn to stone!`, 'bad'); floatText(player.x, player.y, 'petrified', '#cbd5e1'); sfx.play('shield'); }
      else if (seen) log('You hold still and look away. The basilisk\'s glare finds nothing.', 'good');
      return true;
    }
    return false;
  }
  m.tellCd = (m.tellCd ?? 1 + rnd(3)) - 1;
  if (m.tellCd > 0) return false;
  if (kind === 'chop' && dist(m, H) === 1) {
    m.tell = { kind, x: H.x, y: H.y }; m.windup = [key(H.x, H.y)];
    if (seen) { log(`${nameOf(m)} winds up a heavy chop. Step off the red tile!`, 'bad'); tip('tell_chop', 'A red tile under you is a chop landing next turn. Step off it and the brute is left off balance: your next blow on it is a sneak attack.'); }
    return true;
  }
  if (kind === 'aim' && (m.x === H.x || m.y === H.y) && cheb(m, H) >= 2 && cheb(m, H) <= 4) {
    const dx = Math.sign(H.x - m.x), dy = Math.sign(H.y - m.y);
    let clear = true; for (let k = 1; k < cheb(m, H); k++) if (!walkable(getTile(m.x + dx * k, m.y + dy * k))) clear = false;
    if (!clear) return false;
    m.tell = { kind, dx, dy };
    if (seen) { log(`${nameOf(m)} draws its bow. Step out of the amber line!`, 'bad'); tip('tell_aim', 'An amber line is an archer taking aim. Step out of it, close in, or put another monster in it and the arrow takes them instead.'); }
    return true;
  }
  if (kind === 'guard' && dist(m, H) === 1) {
    m.tell = { kind }; m.guard = true;
    if (seen) { log(`${nameOf(m)} raises its shield.`, 'bad'); tip('tell_guard', 'A raised shield turns your blows to a scratch for a turn. Hit something else, use an ability, or smash through with a warhammer.'); }
    return true;
  }
  if (kind === 'glare' && cheb(m, H) <= 3 && seen) {
    m.tell = { kind, d: cheb(m, H), turn };
    log(`${nameOf(m)}'s eyes flare. Do not strike it or step closer!`, 'bad'); tip('tell_glare', 'Burning eyes are a basilisk\'s glare. Strike it or step closer while they burn and you turn to stone. Wait, step back, or fight something else.');
    return true;
  }
  return false;
}
function bossTurn(m, H, heroes) {
  if (m.superBoss) { const stage = m.hp <= m.maxHp / 3 ? 2 : m.hp <= m.maxHp * 2 / 3 ? 1 : 0; if (stage > (m.enrageStage || 0)) { m.enrageStage = stage; m.enraged = false; enrageBoss(m); return true; } }
  else if (!m.enraged && m.hp <= m.maxHp / 2) { enrageBoss(m); return true; }
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
    for (const pp of livePets()) if (area.has(key(pp.x, pp.y))) petHurt(pp, m.atk);
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
  if (scene === 'dungeon') rescueCheck();
  escort = null; totems.clear(); trial = null;
  floor++;
  if (!dungeonDef) dungeonDef = townDungeon(townAt(...homeTown.split(',').map(Number)) || townAt(0, 0));
  if (floor > dungeonDef.floors) {
    const def = dungeonDef;
    if (leading && runSpace && mp.on) { mpApi(ACCOUNT.mpUrl + '/sync', { space: runSpace, x: player.x, y: player.y, events: [{ type: 'escape' }] }).catch(() => {}); }
    sfx.play('win');
    track('dungeon_cleared', { dungeon: def.kind === 'site' ? def.site.type : 'town', danger: def.danger, floors: def.floors });
    if (def.kind === 'site') { questProgress('clear', def.site.key, 1); unlock(def.site.type); } else unlock('escapist');
    rqProgress('clearIn', def.kind === 'site' ? realmOfTile(def.site.x, def.site.y) : realmAt(...(def.home || '0,0').split(',').map(Number)));
    if (def.story === 'hollow') setTimeout(hollowKingSlain, 60);
    else if (def.story === 'gate') setTimeout(frostJarlSlain, 60);
    else if (def.story) setTimeout(() => storyShardFound(def.story), 60);
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
      if (def.delve) recordDelve(true);
      returnHome();
      afterSceneChange();
      log(def.delve ? `You wake at the inn with the dream's gold still in your purse. The Delve of ${delveTheme().name} is cleared.` : `You escaped the dungeon with ${player.gold} gold at level ${player.level}! The town square welcomes you back.`, 'good');
    }
    dungeonDef = null;
    saveProgress('win');
    return;
  }
  if (dungeonDef.story === 'stars') {
    dungeonDef.boss = floor === 3 ? { type: 'Knight', name: 'Ser Halvard, Captain of the Grey Cloaks', yields: true } : STORY_SITES.stars.boss;
    dungeonDef.midBossFloor = 3;
  }
  if (dungeonDef.endless) {
    dungeonDef.danger = 5 + Math.floor((floor - 1) / 2);   // each pair of floors is harder than the last
    const guardian = ACT2_STEPS.find((st) => st.boss && st.floor === floor);
    dungeonDef.boss = guardian && act2Active() && ACT2_STEPS[act2().s - 1].floor === floor ? guardian.boss : null;
    setTimeout(() => act2Progress('floor', floor), 80);
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
  if (floorMod) { const fm = FLOOR_MODS[floorMod], good = floorMod === 'treasure'; setTimeout(() => log(`${fm.label}: ${fm.desc}.`, good ? 'good' : 'bad'), 30); }
  if (floor === dungeonDef.floors) tip('boss', 'A boss waits by the stairs on the last floor. Clear the room, use your ability, keep a potion ready.');
  log(floor === 1 ? `You descend into ${/^the /i.test(dungeonDef.name) ? "" : "the "}${dungeonDef.name} (${ratingText(dungeonDef)}). Follow the compass to the stairs. The golden door beside you leads back up if you want out.` : `You descend to floor ${floor}. A golden door here leads back to the surface.`, 'good');
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
  const room = getChunk(0, 0).rooms[0];
  if (!room) return;
  const w = ++ARENA.wave;
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
  if (!dungeonDef || !dungeonDef.arena || scene !== 'dungeon' || gameOver) return;
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
  rescueCheck(); escort = null; totems.clear(); trial = null;
  const def = dungeonDef;
  if (def && def.delve) recordDelve(false);
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
// Leaving melee has a cost: each awake foe you step away from gets a parting blow at
// half strength, unless it is busy with a tell, stunned or off balance. A dagger
// makes a clean break.
function partingBlows(nx, ny) {
  if (traitOf(player.weapon) === 'dagger') return;
  const foes = monsters.filter((m) => m.hp > 0 && m.awake && !m.boss && !m.sea && !m.tell && !(m.stunned > 0) && !(m.reeling > 0) && !m.type.ranged && dist(m, player) === 1 && dist(m, { x: nx, y: ny }) > 1).slice(0, 2);
  if (!foes.length) return;
  tip('parting', 'Stepping away from a foe beside you gives it a parting blow at half strength. A dagger lets you slip away clean; a stunned or off-balance foe cannot follow through.');
  for (const m of foes) { const a = m.atk; m.atk = Math.max(1, Math.ceil(a / 2)); log(`${nameOf(m)[0].toUpperCase() + nameOf(m).slice(1)} catches you as you turn away.`, 'bad'); monsterAttack(m); m.atk = a; }
}
// Petrified: whatever you meant to do, the turn passes instead.
function stoneTurn() {
  if (!(player.stunned > 0)) return false;
  player.stunned--; log('Your limbs are stone. The turn passes.', 'bad'); floatText(player.x, player.y, 'stone', '#cbd5e1'); endTurn(false); return true;
}
function tryMove(dx, dy) {
  if (gameOver || !player || shopOpen || perkChoices || entering || storyOpen() || controlsOpen() || settingsOpen()) return;
  if (stoneTurn()) return;
  const nx = player.x + dx, ny = player.y + dy;
  const t = getTile(nx, ny);
  if (t === TILE.WALL && scene === 'world' && groundAt(nx, ny) === GROUND.WATER) {
    if (dx) player.face = dx;
    const sm = (dx || dy) && getMonsterAt(nx, ny); if (sm) { playerAttack(sm); endTurn(false); return; }
    if (aboard && !dx && !dy) { if (player.meta.rod) fishAt(nx, ny, true); else { log('Deep water all round. With a rod you could fish from the boat.'); draw(); } return; }
    if (aboard && seaTile(nx, ny)) { sailStep(dx, dy); return; }
    if (shipAt(nx, ny)) { boardShip(); return; }
    fishAt(nx, ny); return;
  }
  if (t === TILE.WALL && scene === 'world') { const tn = townContaining(nx, ny); const sec = tn && grandSecret(tn, nx - tn.x0, ny - tn.y0); if (sec && !sec.open) { if (dx) player.face = dx; revealSecret(tn, sec, nx, ny); return; } }
  if (t === TILE.WALL || t === TILE.FOUNTAIN) return;
  const n = scene !== 'dungeon' && getNpcAt(nx, ny);
  if (n) { talk(n); draw(); return; }
  if (t === TILE.FURNITURE) { useFurniture(decor[ny][nx]); draw(); return; }
  if (t === TILE.WAYSTONE) { openShop('travel'); draw(); return; }
  if (t === TILE.CRACK) { hitCrack(nx, ny, traitOf(player.weapon) === 'warhammer' ? 3 : 1); endTurn(false); return; }
  if (t === TILE.SPRING) { drinkSpring(nx, ny); endTurn(false); return; }
  if (t === TILE.CAPTIVE) { freeCaptive(nx, ny); endTurn(false); return; }
  if (t === TILE.TOTEM) { smashTotem(nx, ny); endTurn(false); return; }
  if (t === TILE.LEVER) { pullLever(nx, ny); endTurn(false); return; }
  if (t === TILE.ALTAR) { useAltar(nx, ny); draw(); return; }
  if (t === TILE.TRIAL) { useTrial(nx, ny); draw(); return; }
  if (t === TILE.WAYOUT) {
    if (turn - wayoutWarned <= 5) { wayoutWarned = -99; leaveDungeon(); return; }
    wayoutWarned = turn;
    if (dungeonDef && dungeonDef.arena) { log(`The way out. Walk into it again to leave the arena with your ${ARENA.earned} gold in winnings.`); draw(); return; }
    log(`A door back to the surface. Walk into it again to leave the ${dungeonDef ? dungeonDef.name : 'dungeon'} now: you keep what you carry, but skip ${dungeonDef && dungeonDef.treasure ? 'the hoard at the bottom' : 'the rest of the floors'}.`);
    draw(); return;
  }
  if (t === TILE.PLACE) { usePlace(placeAtTile(nx, ny)); draw(); return; }
  if (t === TILE.PLOT) { const tw = townContaining(nx, ny); if (tw) useMonument(tw, plotSlot(tw, nx, ny)); draw(); return; }
  if (t === TILE.SHIP) { const pt = portAtTile(nx, ny); if (pt) openShop('harbour'); else log('A boat with nobody to sail it.'); draw(); return; }
  if (t === TILE.WARCAMP) { const wc = campAtTile(nx, ny); if (wc) log(campRazed(wc) ? `The burnt-out remains of ${wc.name}. The realm's soldiers did their work.` : `${wc.name[0].toUpperCase() + wc.name.slice(1)}: palisades, drums and far too many orcs (strength ${wc.strength}). No single hero can take it. ${armiesUnlocked() ? 'Recruit an army at a realm\'s seat and send it here.' : `Heroes of level ${ARMY_LEVEL} can raise a realm's army against it.`}`, campRazed(wc) ? '' : 'bad'); draw(); return; }
  if (t === TILE.MONUMENT) { const tw = townContaining(nx, ny); if (tw && tw.memorial && nx === tw.cx - 4 && ny === tw.cy + 3) log(`The memorial of the Long Night: a column of grey stone with the names of the watch who fell at the walls of ${tw.name}, and on the plinth, in letters a hand high, the name of ${tw.memorial}, who paid for it.`); else if (tw) { const L = townIdentity(tw).landmark; log(`${L.name[0].toUpperCase() + L.name.slice(1)}. ${L.lore}`); } draw(); return; }
  const other = mpPlayerAt(nx, ny);
  if (other) { if (scene !== 'dungeon') openPlayerMenu(other); draw(); return; }
  if (t === TILE.DOOR) {
    const house = scene === 'house' ? null : houses.find((h) => h.doorX === nx && h.doorY === ny);
    if (house && house.id === 'arena') { offerArena(house); draw(); return; }
    if (scene === 'house') leaveBuilding(); else enterBuilding(house);
    return;
  }
  if (dx) player.face = dx;
  if (t === TILE.CHEST && scene === 'world') { const tn = townContaining(nx, ny); if (tn && tn.size === 'grand' && nx - tn.x0 === GRAND_TREASURY.x + 2 && ny - tn.y0 === GRAND_TREASURY.y + 2) { openTreasury(nx, ny); endTurn(false); return; } }
  if (t === TILE.CHEST) { openChest(nx, ny); endTurn(false); return; }
  { const sp = petAt(nx, ny); if (sp) { sp.x = player.x; sp.y = player.y; } }
  if (escort && escort.x === nx && escort.y === ny) { escort.x = player.x; escort.y = player.y; }
  const m = getMonsterAt(nx, ny);
  if (m) playerAttack(m);
  else {
    if (aboard) { aboard = false; player.meta.ship = { x: player.x, y: player.y }; log(`You run the ship in close and splash ashore${pets.some((pp) => pp.aboard) ? ', your companions after you' : ''}. She waits here for you.`); for (const pp of pets) pp.aboard = false; placePets(); }
    if ((dx || dy) && scene !== 'house' && !safeZone()) partingBlows(nx, ny);
    player.x = nx; player.y = ny;
    if (t === TILE.TRAP && (dx || dy)) springTrap(nx, ny);
    if (t === TILE.LAVA) {
      const fp = wornAffix('armor'); const burn = Math.max(1, Math.round((3 + floor) * (fp && fp.id === 'fireproof' ? 0.5 : 1)));
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
    if (scene === 'world') { const ck = chartNear(nx, ny); if (ck) digTreasure(ck); }
    if (t === TILE.SHOP) openShop(tradeHere() ? 'trade' : 'shop');
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
      if (site && site.lair && !lairKnown(site.lair)) revealLair(site.lair, 'You stumble on it:');
      if (site && site.story && !storySiteOpen(site.story)) { player.x -= dx; player.y -= dy; log(site.story === 'gate' ? 'A door of blue ice is set into the hillside, taller than a house, and a raven sits on the lintel watching you. It is shut. Whatever opens it has not happened yet.' : site.story === 'hollow' ? 'Three locks bar the door of the Barrow: jade, gold and bone. The three crowns of the Far Shore hold the keys, and they do not give them to strangers.' : `An old seal of gold bars the way into ${site.name.replace(/^The /, 'the ')}. King Aldric will know how to break it.`, 'bad'); draw(); return; }
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
      if (livePets().some((pp) => cheb(pp, player) > 3)) placePets();
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
let scenePage = null, choiceIndex = 0;
// A painted backdrop for each kind of scene: sky, silhouettes and a little light.
function sceneBackdropKey(page) {
  if (page.bg) return page.bg;
  const who = String(page.who || '');
  if (/King Aldric|Prince Edric|Ser Halvard|Crown of Aurum/.test(who)) return 'hall';
  if (/The Deep/.test(who)) return 'deep';
  if (/herald|four realms|Age of the Crown|And you/.test(who)) return 'town';
  if (/Shard of/.test(who)) return 'crypt';
  if (/Grand Arena/.test(who)) return 'arena';
  return scene === 'dungeon' ? 'crypt' : scene === 'house' ? 'hall' : 'road';
}
function drawSceneBackdrop(g, key, w, h) {
  const sky = (a, b) => { const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, a); lg.addColorStop(1, b); g.fillStyle = lg; g.fillRect(0, 0, w, h); };
  const glow = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 1, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const hills = (col, base, amp, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, base - Math.abs(Math.sin(x / 90 + seed)) * amp - Math.sin(x / 23 + seed) * 4); g.lineTo(w, h); g.fill(); };
  const stars = (n) => { g.fillStyle = '#fff'; for (let k = 0; k < n; k++) g.fillRect((k * 173) % w, (k * 97) % (h * 0.6), k % 5 ? 1 : 2, k % 5 ? 1 : 2); };
  const night = dayPhase() === 'night';
  if (key === 'hall') {
    sky('#2a0f0f', '#120606');
    for (let x = 40; x < w; x += 110) { g.fillStyle = '#3b2a1a'; g.fillRect(x, 10, 14, h); g.fillStyle = '#5b4a3a'; g.fillRect(x, 10, 4, h); }   // columns
    g.fillStyle = '#7c2d12'; for (let x = 97; x < w; x += 110) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x + 20, 46); g.fill(); g.fillStyle = '#ffd86b'; g.fillRect(x + 17, 18, 6, 6); g.fillStyle = '#7c2d12'; }   // banners
    glow(w / 2, h * 0.75, 90, 'rgba(255,200,120,0.35)'); g.fillStyle = '#c79a3a'; g.fillRect(w / 2 - 26, h - 26, 52, 26); g.fillStyle = '#8b2e2e'; g.fillRect(w / 2 - 18, h - 20, 36, 20);   // the throne
  } else if (key === 'town') {
    sky(night ? '#0b1a33' : '#79b8ea', night ? '#1b2a44' : '#cfe6f5'); if (night) stars(40);
    hills('#4f8a46', h * 0.72, 18, 1);
    for (let x = 10; x < w; x += 90) { const rh = 30 + (x * 7) % 25; g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(x, h - 40); g.lineTo(x + 30, h - 40 - rh); g.lineTo(x + 60, h - 40); g.fill(); g.fillStyle = '#d9b382'; g.fillRect(x + 6, h - 40, 48, 40); g.fillStyle = night ? '#ffd86b' : '#7bdfff'; g.fillRect(x + 22, h - 30, 8, 8); }
  } else if (key === 'road') {
    sky(night ? '#0b1a33' : '#8ec5ea', night ? '#1b2a44' : '#e9f2f7'); if (night) stars(40); else glow(w * 0.8, 30, 40, 'rgba(255,240,180,0.9)');
    hills('#3f7d3a', h * 0.62, 26, 2); hills('#4f9548', h * 0.78, 16, 5);
    g.fillStyle = '#a8865a'; g.beginPath(); g.moveTo(w / 2 - 6, h * 0.66); g.lineTo(w / 2 + 6, h * 0.66); g.lineTo(w / 2 + 120, h); g.lineTo(w / 2 - 120, h); g.fill();
    for (const [tx, s2] of [[60, 1], [w - 90, 1.2], [w / 2 + 170, 0.8]]) { g.fillStyle = '#2f6a2c'; g.beginPath(); g.arc(tx, h * 0.7, 18 * s2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5b3a1a'; g.fillRect(tx - 3, h * 0.7, 6, 24 * s2); }
  } else if (key === 'crypt') {
    sky('#141222', '#06050c');
    g.fillStyle = '#1f1b33'; for (let x = 0; x < w; x += 70) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 35, 0); g.lineTo(x + 17, 40 + (x * 3) % 30); g.fill(); }   // vaulting
    for (let x = 30; x < w; x += 120) { g.fillStyle = '#2a2640'; g.beginPath(); g.roundRect(x, 30, 40, h, [20, 20, 0, 0]); g.fill(); g.fillStyle = '#0b0a14'; g.beginPath(); g.roundRect(x + 6, 36, 28, h, [14, 14, 0, 0]); g.fill(); }   // arches
    glow(w / 2, h * 0.7, 70, 'rgba(255,200,100,0.35)'); g.fillStyle = '#ffd86b'; g.fillRect(w / 2 - 2, h * 0.7 - 10, 4, 10);   // a candle
  } else if (key === 'deep') {
    sky('#0a0616', '#000'); stars(14);
    for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(150,90,220,${0.15 + k * 0.05})`; g.lineWidth = 2; g.beginPath(); g.moveTo((k * 140) % w, h); for (let y = h; y > 0; y -= 14) g.lineTo((k * 140) % w + Math.sin(y / 18 + k) * 22, y); g.stroke(); }   // veins
    glow(w / 2, h, 120, 'rgba(120,60,200,0.35)');
  } else if (key === 'arena') {
    sky('#79b8ea', '#cfe6f5'); g.fillStyle = '#6b7280'; g.fillRect(0, h * 0.35, w, h * 0.3); g.fillStyle = '#4b5563'; for (let x = 0; x < w; x += 12) g.fillRect(x, h * 0.35 + (x % 24 ? 8 : 0), 10, h * 0.3);
    g.fillStyle = '#c2a36b'; g.fillRect(0, h * 0.65, w, h); for (let k = 0; k < 40; k++) { g.fillStyle = ['#e74c3c', '#f4f4f4', '#ffd86b', '#4a90e2'][k % 4]; g.fillRect((k * 53) % w, h * 0.38 + (k % 3) * 9, 4, 6); }   // the crowd
  } else if (key === 'tower') {
    sky('#0b1a33', '#2a3a66'); stars(60);
    g.fillStyle = '#1b1b2f'; g.fillRect(w / 2 - 30, 20, 60, h); g.beginPath(); g.moveTo(w / 2 - 40, 24); g.lineTo(w / 2, -10); g.lineTo(w / 2 + 40, 24); g.fill(); glow(w / 2, 40, 30, 'rgba(192,132,252,0.8)');
    hills('#1a2a3a', h * 0.8, 20, 3);
  } else if (key === 'wilds') {
    sky(night ? '#0b1a33' : '#8ec5ea', night ? '#1b2a44' : '#e9f2f7'); if (night) stars(40); hills('#3f7d3a', h * 0.6, 30, 4); hills('#4f9548', h * 0.8, 14, 7);
    for (let k = 0; k < 5; k++) { g.fillStyle = '#6b7280'; g.fillRect(w / 2 - 60 + k * 30, h * 0.72 - (k % 2) * 6, 10, 28 + (k % 2) * 6); }   // standing stones
  } else if (key === 'lava') {
    sky('#2a0a05', '#0a0303'); glow(w / 2, h, 160, 'rgba(255,120,30,0.6)'); g.fillStyle = '#ff7a1a'; for (let x = 0; x < w; x += 6) g.fillRect(x, h - 14 + Math.sin(x / 15) * 4, 6, 20); g.fillStyle = '#1b0b05'; for (let x = 20; x < w; x += 90) { g.beginPath(); g.moveTo(x, h - 10); g.lineTo(x + 25, 30 + (x % 40)); g.lineTo(x + 50, h - 10); g.fill(); }
  } else if (key === 'sea') {
    sky(night ? '#0a1430' : '#8fc7ee', night ? '#1b2f5a' : '#dbeeff'); if (night) stars(60);
    glow(w * 0.72, h * 0.3, 70, night ? 'rgba(220,230,255,0.5)' : 'rgba(255,245,200,0.8)');
    g.fillStyle = night ? '#0d2a4a' : '#1f6fa8'; g.fillRect(0, h * 0.55, w, h);
    g.strokeStyle = night ? 'rgba(160,200,240,0.35)' : 'rgba(230,245,255,0.6)'; g.lineWidth = 2;
    for (let r = 0; r < 5; r++) { g.beginPath(); for (let x = 0; x <= w; x += 6) g.lineTo(x, h * (0.6 + r * 0.08) + Math.sin(x / 22 + r) * 3); g.stroke(); }
    g.fillStyle = night ? '#1a2a3a' : '#3b2a1a'; g.fillRect(w * 0.1, h * 0.52, w * 0.18, h * 0.06);   // a far hull
    g.fillStyle = night ? '#c8d8e8' : '#f4f0e6'; g.beginPath(); g.moveTo(w * 0.19, h * 0.52); g.lineTo(w * 0.19, h * 0.3); g.lineTo(w * 0.27, h * 0.5); g.closePath(); g.fill();
  } else if (key === 'grotto') {
    sky('#061a2e', '#02070f'); for (let x = 0; x < w; x += 45) { g.fillStyle = '#0d2a44'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22, 0); g.lineTo(x + 11, 30 + (x * 7) % 40); g.fill(); }
    glow(w / 2, h * 0.9, 110, 'rgba(60,180,255,0.4)'); g.fillStyle = 'rgba(56,189,248,0.5)'; g.fillRect(0, h - 22, w, 22);
  } else {   // map
    drawRealmArt(g, w, h);
  }
  g.fillStyle = 'rgba(6,12,20,0)'; g.fillRect(0, 0, w, h);
  const vg = g.createLinearGradient(0, h - 30, 0, h); vg.addColorStop(0, 'rgba(6,32,44,0)'); vg.addColorStop(1, 'rgba(6,32,44,0.9)'); g.fillStyle = vg; g.fillRect(0, h - 30, w, 30);
}

// The highlighted choice: arrows or W/S move it, Enter takes it; the mouse follows too.
function moveChoice(step) {
  const btns = [...document.querySelectorAll('#story-choices button')];
  if (!btns.length) return;
  for (let k = 0; k < btns.length; k++) { choiceIndex = (choiceIndex + step + btns.length) % btns.length; if (!btns[choiceIndex].disabled) break; }
  btns.forEach((b, i) => b.classList.toggle('selected', i === choiceIndex));
  btns[choiceIndex].focus({ preventScroll: true });
}
function nextScenePage() {
  const page = sceneQueue.shift();
  scenePage = page || null;
  const box = document.getElementById('story-choices');
  if (box) box.innerHTML = '';
  if (!page) { storyEl.hidden = true; const done = sceneDone; sceneDone = null; if (done) done(); draw(); return; }
  storyEl.hidden = false;
  const choices = page.choices || [];
  document.getElementById('story-next').hidden = choices.length > 0;
  choiceIndex = Math.max(0, choices.findIndex((c) => !c.disabled));
  choices.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = i === choiceIndex ? 'selected' : '';
    b.textContent = `${i + 1}. ${c.label}`; b.disabled = !!c.disabled;
    b.addEventListener('click', () => chooseScene(i));
    b.addEventListener('mouseenter', () => { if (!b.disabled) { choiceIndex = i; [...box.children].forEach((x, k) => x.classList.toggle('selected', k === i)); } });
    box?.appendChild(b);
  });
  if (choices.length) setTimeout(() => document.querySelectorAll('#story-choices button')[choiceIndex]?.focus({ preventScroll: true }), 0);
  document.getElementById('story-title').textContent = page.who;
  document.getElementById('story-text').textContent = page.text;
  document.getElementById('story-next').textContent = sceneQueue.length ? 'Continue' : 'Close';
  const bc = document.getElementById('story-bg');
  if (bc) { const bg2 = bc.getContext('2d'); bg2.clearRect(0, 0, bc.width, bc.height); drawSceneBackdrop(bg2, sceneBackdropKey(page), bc.width, bc.height); }
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
const settingsEl = document.getElementById('settings');
const settingsOpen = () => !!settingsEl && !settingsEl.hidden;
function toggleSettings(show = !settingsOpen()) {
  if (!settingsEl) return;
  settingsEl.hidden = !show;
  if (show) {
    stopWalk?.();
    document.getElementById('set-music').value = Math.round(settings.music * 100);
    document.getElementById('set-sfx').value = Math.round(settings.sfx * 100);
    document.getElementById('set-shake').checked = settings.shake;
    document.getElementById('set-numbers').checked = settings.numbers;
  }
}
document.getElementById('camp-btn')?.addEventListener('click', () => { sfx.unlock(); makeCamp(); });
document.getElementById('settings-btn')?.addEventListener('click', () => { sfx.unlock(); toggleSettings(); });
document.getElementById('settings-close')?.addEventListener('click', () => toggleSettings(false));
document.getElementById('set-music')?.addEventListener('input', (e) => { settings.music = e.target.value / 100; music.refresh(); saveSettings(); });
document.getElementById('set-sfx')?.addEventListener('input', (e) => { settings.sfx = e.target.value / 100; sfx.setVolume(settings.sfx); saveSettings(); });
document.getElementById('set-sfx')?.addEventListener('change', () => sfx.play('gold'));
document.getElementById('set-shake')?.addEventListener('change', (e) => { settings.shake = e.target.checked; saveSettings(); });
document.getElementById('set-numbers')?.addEventListener('change', (e) => { settings.numbers = e.target.checked; saveSettings(); });
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
  const bg = { dawn: 'crypt', tides: 'grotto', bones: 'crypt', embers: 'lava', stars: 'tower' }[id];
  showScene([{ who: S.shard, sprite: 'obelisk', text: SHARD_FOUND[id], bg }, { ...SHARD_CLUE[id], bg }], () => { giveRelic(S.relic, S.title); log(`You hold the ${S.shard}. Take it to King Aldric at Castle Aurum.`, 'good'); });
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
  showScene([{ who: pl.name[0].toUpperCase() + pl.name.slice(1), sprite: pl.sprite, text: P.lore, bg: 'wilds' }]);
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
  tianxia: { title: 'The Mandate of Heaven', ruler: 'Empress Liang Wu', sprite: 'king:tianxia', relic: 'jadeseal', gold: 300,
    intro: '"The Veil kept more than ships out," the Empress says, not looking up from her brush. "Since it opened, the beasts in my provinces have champions, and the tribute roads are robbed. Heaven grants its mandate to those who keep order. Keep some for me."',
    steps: [{ kind: 'clearIn', target: 'tianxia', need: 1, label: 'Clear a dungeon in the Celestial Empire' },
            { kind: 'elite', need: 3, label: 'Slay 3 elite monsters (starred), the champions of the beasts' },
            { kind: 'chest', need: 4, label: 'Recover the lost tribute: open 4 treasure chests' }],
    outro: 'The Empress sets down her brush at last. "Order is restored, and I did not have to write a single edict." A clerk brings a small box. "The seal of the Jade Throne. Show it at any waystone or harbour in the world, and they will charge you half. They will not dare charge you more."' },
  suryadesh: { title: 'The Nine Gates', ruler: 'Maharani Devika Suryavansha', sprite: 'elder:suryadesh', relic: 'sunlotus', gold: 280,
    intro: '"The sun rises on nine gates," the Maharani says, "and lately it sets on spiders. The pilgrim roads are strung with webs, and a thing in the old temple below the hill calls itself a god. Clear my roads, honour my shrines, and put the false god to the sword."',
    steps: [{ kind: 'place', target: 'shrine', need: 1, label: 'Make an offering at a wayside shrine' },
            { kind: 'slay', target: 'Spider', need: 8, label: 'Clear the pilgrim roads of spiders (slay 8)' },
            { kind: 'boss', need: 1, label: 'Put a false god to the sword: slay any dungeon boss' }],
    outro: 'Drums, conches and a shower of marigolds. The Maharani fastens a lotus of beaten gold at your throat. "The Sun\'s own flower. While it shines on you, nothing shines through you."' },
  severin: { title: 'The Long Winter', ruler: 'Tsar Fyodor the Patient', sprite: 'king:severin', relic: 'bearcharm', gold: 260,
    intro: '"Winter comes in six weeks," the Tsar says, "and the orcs of the taiga have burned two granaries. I need the raiders broken, the granary filled, and the barrow under the frozen river emptied of whatever is singing in it. I am a patient man. Winter is not."',
    steps: [{ kind: 'slay', target: 'Orc', need: 8, label: 'Break the raiders of the taiga (slay 8 orcs)' },
            { kind: 'gold', need: 400, label: 'Fill the winter granary: gather 400 gold' },
            { kind: 'clearIn', target: 'severin', need: 1, label: 'Clear a dungeon in the Tsardom' }],
    outro: 'The Tsar pours you something clear that burns all the way down. "The granary is full and the river is quiet. Take this." A bear claw on a cord, carved with a running wolf. "The night is long here. This makes it yours."' },
};
const RULER_REALM = Object.fromEntries(Object.entries(REALM_QUESTS).map(([id, q]) => [q.ruler, id]));
const rqState = (id) => { const all = player.meta.rq || (player.meta.rq = {}); return all[id] || (all[id] = { s: 0, n: 0 }); };
function rqProgress(kind, target = null, amount = 1) {
  if (!player || !player.meta) return;
  for (const id of ALL_REALMS) {
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
  const tradeChoice = { label: { court: 'Ask about titles', council: 'Talk about public works', chieftain: 'Talk about the clans', yamen: 'Ask about the examination', durbar: 'Ask about the pilgrimage', terem: 'Ask about the boyar council' }[trade] || 'Do business', run: () => { setTimeout(() => openShop(trade), 0); return null; } };
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
      if (FAR_REALMS.includes(id)) { log(`One of the three keys of the Thousand-Step Barrow is yours: the ${itemInfo(Q.relic).name}.`, 'good'); if (story2().s === 1 && FAR_REALMS.every((r) => rqState(r).s === 5)) unsealBarrow(); }
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
    text: pets.length ? `A grey wolf lies in the ditch with a trap on its leg. Your ${petLabel(pets[0])} whines at it. The wolf does not growl.` : 'A grey wolf lies in the ditch with a trap on its leg. It watches you with yellow eyes, too tired to growl.',
    choices: [
      { label: potionIdx() >= 0 ? 'Free it and pour a potion on the wound' : 'Free it and bind the wound', run: () => {
        const usedPotion = potionIdx() >= 0; if (usedPotion) player.bag.splice(potionIdx(), 1);
        if (!usedPotion && Math.random() < 0.5) { player.hp = Math.max(1, player.hp - 2); return 'You pry the trap open. The wolf bites you, once, hard, and limps into the trees.'; }
        if (pets.length < PET_MAX) { adoptPet('wolf'); return 'You pry the trap open and tend the leg. The wolf licks your hand, and when you set off it follows. You have a companion.'; }
        for (const pp of pets) { pp.maxHp += 3; pp.hp = pp.maxHp; } return 'You pry the trap open. The wolf touches noses with your companions and slips away. They seem prouder, and tougher: +3 max HP each.'; } },
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
      { label: 'Ask for a tale instead', run: () => { const h = lairHint(player.x, player.y); if (h && Math.random() < 0.6) { revealLair(h.id, 'The bard sings of'); return `The bard sings of ${h.text}. "Few who seek it return," the bard adds, "but the ones who do are rich."`; } return ROAD_TALES[rnd(ROAD_TALES.length)]; } },
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
    text: 'Riders in grey cloaks block the road, each wearing a small silver stag. Their captain lifts his visor: a lean man with a scar through one eyebrow. "Ser Halvard, at your service," he says. "Prince Edric sends his regards, and asks you to stop running errands for his brother."',
    choices: [
      { label: 'Fight them', run: () => { const k = MONSTER_TYPES.find((t) => t.name === 'Knight'), a = MONSTER_TYPES.find((t) => t.name === 'Archer');
        spawnFoes(k, 2, 'Stag knight', { purse: 30 + wildDanger() * 10 }); spawnFoes(a, 1, 'Stag archer', { purse: 20 }); shakeScreen(4); sfx.play('boss'); return null; } },
      { label: 'Tell them the King knows everything', disabled: player.level < 6, run: () => 'Halvard studies your face for a long moment, then turns his horse. "Then it is already over," he says, mostly to himself. "We will meet again at the tower, I expect." The riders follow him into the trees.' },
      { label: 'Run for it', run: () => { if (Math.random() < 0.5) return 'You break for the trees and lose them in the undergrowth.'; const dmg = 4 + wildDanger(); player.hp = Math.max(1, player.hp - dmg); return `A crossbow bolt grazes you for ${dmg} before you lose them in the undergrowth.`; } },
    ] }),
  hollowmen: () => ({ who: 'The obedient dead', sprite: 'skeleton', bg: 'crypt',
    text: 'They come up the road in step, a dozen of them, in the rusted lamellar of an army a thousand years disbanded, and not one of them breathes. The Hollow King\'s soldiers, walking again. They have seen you.',
    choices: [{ label: 'Stand and fight', run: () => { const d = wildDanger(); for (let i = 0; i < 3 + rnd(2); i++) spawnFoes(byName('Skeleton')[0], 1, 'Hollow soldier', { purse: 20 + d * 5 }); shakeScreen(5); sfx.play('boss'); return null; } },
      { label: 'Run for the nearest town', run: () => { if (Math.random() < 0.5) return 'They do not run. They do not need to. But you do, and the gate shuts behind you.'; const dmg = Math.min(player.hp - 1, 4 + wildDanger()); player.hp -= dmg; floatText(player.x, player.y, `-${dmg}`, '#ff6b6b'); return `A rusted spear takes you in the back for ${dmg} as you go, but the dead are slow.`; } }] }),
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
  const ids = Object.keys(ENCOUNTERS).filter((id) => id !== lastEncounter && id !== 'agents' && id !== 'hollowmen' && (id !== 'ambush' || night));
  const st = story();
  let id = night && Math.random() < 0.35 ? 'ambush' : ids.filter((x) => x !== 'agents')[rnd(ids.length - 1)] || 'caravan';
  if (st.ch === 3 && st.phase === 'seek' && !st.ambushed) { id = 'agents'; st.ambushed = true; }
  if (continentOf(player.x, player.y) === 4 && story2().s >= 1 && story2().s < 3 && Math.random() < 0.45) id = 'hollowmen';   // the Far Shore's roads belong to the dead
  lastEncounter = id;
  player.meta.encounters = (player.meta.encounters || 0) + 1;
  if (player.meta.encounters >= 10) unlock('wayfarer');
  sfx.play('quest');
  track('encounter', { id });
  showScene([ENCOUNTERS[id]()]);
}

// ---------- fishing and camping ----------
let fishHintShown = false, campedAt = -9999;
function fishAt(x, y, deep = false) {
  if (!player.meta.rod) {
    if (!fishHintShown) { log('Fish dart about in the shallows. With a rod you could catch some; the shops of fishing towns sell them.'); fishHintShown = true; }
    draw(); return;
  }
  if (bagFull()) { log('Your bag is too full to keep a catch.'); draw(); return; }
  if (dx2(x) !== 0) player.face = Math.sign(x - player.x);
  const r = deep ? 0.25 + Math.random() * 0.75 : Math.random();   // the deep water fishes better
  burst(x, y, '#9fd4ff', 8, 50, { gravity: 60, life: 400 });
  if (r < 0.4) log(Math.random() < 0.5 ? 'You cast your line. Nothing bites.' : 'A nibble, but it gets away.');
  else if (r < 0.78) { player.bag.push('fish'); log('You catch a fresh fish!', 'good'); sfx.play('gold'); }
  else if (r < 0.86) log('You reel in an old boot. It is not even your size.');
  else if (r < 0.95) { player.bag.push('fish'); log('A fat fish! It fights all the way in.', 'good'); sfx.play('gold'); }
  else if (r < 0.985) { player.bag.push('goldcarp'); log('A golden carp! Merchants pay well for these.', 'good'); sfx.play('win'); unlock('angler'); }
  else {
    const unknown = nearbyPlaces(player.x, player.y, 2).filter((p) => !discovered(p)).slice(0, 2);
    for (const p of unknown) player.meta.places.push(p.key);
    mapCache.ox = null; bgDirty = true;
    log(unknown.length ? `You fish out a bottle with a map inside. It marks ${unknown.map((p) => p.name).join(' and ')}.` : 'You fish out a bottle with a map inside, of places you already know.', 'good');
  }
  endTurn(false);
}
const dx2 = (x) => x - player.x;
// Make camp in the open wilds: rest to full and cook your catch, at the cost of time.
// At night something may find you.
function makeCamp() {
  if (gameOver || !player || shopOpen || storyOpen() || perkChoices) return;
  if (scene !== 'world' || townContaining(player.x, player.y)) { log(scene === 'world' ? 'You are in town. The inn has better beds.' : 'There is no making camp down here.'); draw(); return; }
  if (monsters.some((m) => cheb(m, player) <= 6)) { log('Not with monsters this close.', 'bad'); draw(); return; }
  if (turn - campedAt < DAY_LENGTH / 2) { log('You rested not long ago. Better to keep moving while it is light.'); draw(); return; }
  campedAt = turn;
  const night = dayPhase() === 'night';
  turn += 120;
  const healed = player.maxHp - player.hp;
  player.hp = player.maxHp; player.poison = 0; restoreMana();
  for (const pp of pets) { pp.down = false; pp.hp = pp.maxHp; }
  const fish = player.bag.filter((id) => id === 'fish').length;
  if (fish) { player.bag = player.bag.map((id) => (id === 'fish' ? 'stew' : id)); }
  burst(player.x, player.y, '#ff9f43', 30, 70, { glow: true, gravity: -60, life: 1000 });
  sfx.play('potion');
  log(`You make camp and rest by the fire${healed ? `, recovering ${healed} HP` : ''}.${fish ? ` You cook ${fish === 1 ? 'your fish' : `${fish} fish`} into hearty stew.` : ''} The hours slip by.`, 'good');
  unlock('camper'); track('camp', { night });
  mapCache.ox = null; bgDirty = true;
  if (night && Math.random() < 0.3) setTimeout(() => { showScene([ENCOUNTERS.ambush()]); }, 200);
  endTurn(false);
}

// ---------- the realms' armies and the orc warcamps ----------
// Orc warcamps dot the wilds, too strong for any one hero. Each realm keeps an army
// at its seat: heroes pay to recruit squads, then send the army marching on a camp.
// Armies walk the map in real time under their realm's banner, fight on arrival,
// and the realms also send their own armies out now and then.
const ARMY = {
  cantons: { label: 'militia', cost: 50, power: 1.0 },
  aurum:   { label: 'knights', cost: 65, power: 1.3 },
  kathar:  { label: 'clan warriors', cost: 45, power: 1.1 },
  league:  { label: 'mercenaries', cost: 55, power: 1.0 },
  tianxia:   { label: 'banner soldiers', cost: 55, power: 1.1 },
  suryadesh: { label: 'elephant lancers', cost: 70, power: 1.4 },
  severin:   { label: 'streltsy', cost: 50, power: 1.15 },
};
// Armies are for heroes of renown: below this level the realms will not follow you,
// raise no armies of their own, and any army already raised waits where it stands.
const ARMY_LEVEL = 50;
const armiesUnlocked = () => !!player && player.level >= ARMY_LEVEL;
const CAMP_NAMES = ['Bonegrinder', 'Redtusk', 'Skullhill', 'Black Banner', 'Gutripper', 'Ashfang', 'Broken Tooth', 'Mudhollow'];
const camps = new Map();
function campAt(i, j) {
  const k = key(i, j);
  if (camps.has(k)) return camps.get(k);
  let camp = null;
  const capital = ALL_REALMS.some((id) => REALMS[id].capital[0] === i && REALMS[id].capital[1] === j);
  if (!(i === 0 && j === 0) && !capital && cellRand(i, j, 600) < 0.2) {
    const town = townAt(i, j), site = siteAt(i, j), place = placeAt(i, j);
    for (let n = 0; n < 6 && !camp; n++) {
      const x = i * TOWN_SPACING + 8 + Math.floor(cellRand(i, j, 601 + n) * 80), y = j * TOWN_SPACING + 6 + Math.floor(cellRand(i, j, 611 + n) * 80);
      if (town && x >= town.x0 - 12 && x < town.x0 + tw(town) + 12 && y >= town.y0 - 12 && y < town.y0 + th(town) + 12) continue;
      if (site && Math.abs(site.x - x) + Math.abs(site.y - y) < 10) continue;
      if (place && Math.abs(place.x - x) + Math.abs(place.y - y) < 6) continue;
      const g = terrainAt(x, y);
      if (g !== GROUND.GRASS && g !== GROUND.FOREST) continue;
      const danger = Math.max(Math.abs(i), Math.abs(j));
      camp = { key: k, i, j, x, y, name: `the ${CAMP_NAMES[Math.floor(cellRand(i, j, 620) * CAMP_NAMES.length)]} warcamp`, strength: 20 + danger * 12 + Math.floor(cellRand(i, j, 621) * 10) };
    }
  }
  camps.set(k, camp);
  return camp;
}
const emptyTroops = () => Object.fromEntries(ALL_REALMS.map((r) => [r, 0]));
const war = () => player.meta.war || (player.meta.war = { troops: emptyTroops(), armies: [], camps: [] });
const campRazed = (c) => war().camps.includes(c.key);
const campAtTile = (x, y) => { const [i0, j0] = cellOf(x, y); for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const c = campAt(i, j); if (c && c.x === x && c.y === y) return c; } return null; };
function campsNear(x, y, reach) {
  const [i0, j0] = cellOf(x, y), out = [];
  for (let i = i0 - reach; i <= i0 + reach; i++) for (let j = j0 - reach; j <= j0 + reach; j++) { const c = campAt(i, j); if (c && !campRazed(c)) out.push(c); }
  return out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}
const armyName = (realm) => `the army of ${REALMS[realm].short.replace(/^the /, 'the ')}`;
function sendArmy(realm, from, camp, troops, mine) {
  war().armies.push({ realm, x: from.x, y: from.y, tx: camp.x, ty: camp.y, target: camp.key, troops, mine: !!mine });
  if (war().armies.length > 12) war().armies.shift();
}
// One step every few hundred milliseconds of real time, wherever the hero is.
let armyClock = 0, aiWarClock = 0;
function armyTick(now) {
  if (!player || !player.meta || gameOver || document.hidden || !armiesUnlocked()) return;
  if (now - armyClock < 320) return;
  armyClock = now;
  const W = war();
  for (const a of W.armies.slice()) {
    if (a.fightUntil) { if (now >= a.fightUntil) resolveBattle(a); continue; }
    const dx = Math.sign(a.tx - a.x), dy = Math.sign(a.ty - a.y);
    if (Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y) <= 1) { startBattle(a, now); continue; }
    // near the hero, keep to land; far away, nobody is watching the fords
    const near = scene === 'world' && cheb(a, player) < 50;
    // only ever step toward the target, so an army never paces back and forth;
    // when both steps are blocked it fords the stream or pushes through the trees
    const primary = Math.abs(a.tx - a.x) >= Math.abs(a.ty - a.y) ? [dx, 0] : [0, dy];
    const secondary = primary[0] ? [0, dy] : [dx, 0];
    let moved = false;
    for (const [sx, sy] of [primary, secondary]) {
      if (!sx && !sy) continue;
      const nx = a.x + sx, ny = a.y + sy;
      if (!near || walkable(getTile(nx, ny)) || getTile(nx, ny) === TILE.WARCAMP) { a.x = nx; a.y = ny; moved = true; break; }
    }
    if (!moved) { a.x += primary[0]; a.y += primary[1]; }
  }
  // now and then a realm near the hero musters an army of its own
  if (scene === 'world' && now - aiWarClock > 75000) {
    aiWarClock = now;
    if (W.armies.filter((a) => !a.mine).length < 2) {
      const town = nearestOtherTown(player.x, player.y) || townContaining(player.x, player.y);
      const target = town && campsNear(town.cx, town.cy, 2).find((c) => !W.armies.some((a) => a.target === c.key));
      if (town && target) {
        const realm = town.realm || realmAt(town.i, town.j);
        sendArmy(realm, { x: town.gate.x, y: town.gate.y + 1 }, target, Math.round(target.strength * 1.3 / ARMY[realm].power), false);
        log(`Drums sound from ${town.name}: ${armyName(realm)} marches on ${target.name}.`, 'good');
      }
    }
  }
}
function startBattle(a, now) {
  a.fightUntil = now + 2200;
  if (scene === 'world' && cheb(a, player) < 30) { shakeScreen(4); sfx.play('boss'); log(`${armyName(a.realm)[0].toUpperCase() + armyName(a.realm).slice(1)} falls on ${campAt(...a.target.split(',').map(Number)).name}!`, 'bad'); }
}
function resolveBattle(a) {
  const W = war(), camp = campAt(...a.target.split(',').map(Number));
  W.armies = W.armies.filter((x) => x !== a);
  if (!camp || campRazed(camp)) { if (a.mine) { W.troops[a.realm] += a.troops; log(`${armyName(a.realm)} finds the camp already razed and marches home.`); } return; }
  const power = a.troops * ARMY[a.realm].power * (0.8 + Math.random() * 0.45);
  const seen = scene === 'world' && cheb(a, player) < 30;
  if (seen) { for (let k = 0; k < 6; k++) burst(camp.x + rnd(3) - 1, camp.y + rnd(3) - 1, k % 2 ? '#ff9f43' : '#e5e7eb', 12, 120, { life: 600, size: 3 }); sfx.play('fire'); }
  if (power >= camp.strength) {
    W.camps.push(camp.key);
    const lost = Math.min(a.troops - 1, Math.round(camp.strength * (0.3 + Math.random() * 0.3) / ARMY[a.realm].power));
    const home = a.troops - lost;
    bgDirty = true; mapCache.ox = null;
    if (a.mine) {
      W.troops[a.realm] += home;
      const gold = Math.round(camp.strength * 3 * goldMult()), xp = camp.strength;
      player.gold += gold; gainXp(xp);
      log(`Victory! ${armyName(a.realm)} razes ${camp.name}, losing ${lost} of ${a.troops}. Your share of the spoils: ${gold} gold and ${xp} XP. ${home} soldiers return to the muster.`, 'good');
      toast = { text: `${camp.name[0].toUpperCase() + camp.name.slice(1)} is razed!`, until: performance.now() + 3500 };
      sfx.play('win'); unlock('general');
      if (W.camps.length >= 5) unlock('warlord');
      track('army_victory', { realm: a.realm, strength: camp.strength });
    } else log(`Word comes: ${armyName(a.realm)} has razed ${camp.name}.`, 'good');
  } else {
    if (a.mine) {
      const back = Math.floor(a.troops * 0.25);
      W.troops[a.realm] += back;
      log(`Defeat. ${camp.name[0].toUpperCase() + camp.name.slice(1)} holds, and ${armyName(a.realm)} is driven off. ${back} soldiers limp home. A bigger army might do it.`, 'bad');
    } else log(`Word comes: ${armyName(a.realm)} was driven back from ${camp.name}.`, 'bad');
  }
  updateStats(); saveProgress('progress');
}
// The muster at each realm's seat: recruit squads and send them out.
function armyRows(realm) {
  if (!armiesUnlocked()) {
    const li = document.createElement('li'); li.className = 'empty stash-head';
    li.textContent = `The marshals of ${REALMS[realm].short} raise armies only for heroes of renown. Reach level ${ARMY_LEVEL} (you are level ${player.level}) to recruit soldiers and send them against the orc warcamps.`;
    return [li];
  }
  const rows = [], A = ARMY[realm], W = war(), troops = W.troops[realm] || 0;
  const head = document.createElement('li'); head.className = 'empty stash-head';
  const marching = W.armies.filter((a) => a.mine && a.realm === realm);
  head.textContent = `The muster of ${REALMS[realm].short}: ${troops} ${A.label} ready${marching.length ? `, ${marching.reduce((n, a) => n + a.troops, 0)} on the march` : ''}`;
  rows.push(head);
  for (const n of [10, 30]) {
    const cost = Math.round(A.cost * n / 10);
    rows.push(shopRow(`Recruit ${n} ${A.label} for the realm's army`, `Recruit ${cost}g`, () => {
      if (player.gold < cost) return;
      player.gold -= cost; W.troops[realm] = (W.troops[realm] || 0) + n; sfx.play('chest');
      log(`${n} ${A.label} take the realm's coin and fall in behind the banner. ${W.troops[realm]} are ready to march.`, 'good');
      updateStats(); renderShop(); draw(); saveProgress('progress');
    }, player.gold < cost));
  }
  const seat = shopTown();
  const origin = seat || townAt(...REALMS[realm].capital);
  for (const camp of campsNear(origin.cx, origin.cy, 3).filter((c) => !W.armies.some((a) => a.target === c.key)).slice(0, 4)) {
    const need = Math.ceil(camp.strength / A.power);
    const dist = Math.round(Math.hypot(camp.x - origin.cx, camp.y - origin.cy));
    rows.push(shopRow(`March on ${camp.name}, ${compassWord(camp.x - origin.cx, camp.y - origin.cy).toLowerCase()} (${dist} paces). Its strength: ${camp.strength}; about ${need} ${A.label} should do it`, `March ${troops}`, () => {
      if (!W.troops[realm]) return;
      sendArmy(realm, { x: origin.gate.x, y: origin.gate.y + 1 }, camp, W.troops[realm], true);
      log(`${armyName(realm)[0].toUpperCase() + armyName(realm).slice(1)} marches out of ${origin.name}, ${W.troops[realm]} strong, bound for ${camp.name}. Watch for their banner on the road and on your map.`, 'good');
      W.troops[realm] = 0; sfx.play('boss'); tip('army', 'Your army marches in real time. Follow it, or carry on; it fights when it arrives. A victory pays you a share of the spoils.');
      closeShop(); updateStats(); draw(); saveProgress('progress');
    }, !troops));
  }
  return rows;
}
function drawArmies(ctx, now) {
  if (scene !== 'world' || !player.meta || !armiesUnlocked()) return;
  for (const a of war().armies) {
    if (Math.abs(a.x - player.x) > 40 || Math.abs(a.y - player.y) > 30) continue;
    const n = Math.max(2, Math.min(7, Math.ceil(a.troops / 10))), col = REALMS[a.realm].color;
    const dir = Math.sign(a.tx - a.x) || 1;
    for (let k = 0; k < n; k++) {
      const ox = ((k % 3) - 1) * 0.55 - (dir > 0 ? Math.floor(k / 3) * 0.6 : -Math.floor(k / 3) * 0.6), oy = ((k % 2) ? 0.35 : -0.25) + Math.sin(now / 160 + k) * 0.05;
      const lx = a.x + ox, ly = a.y + oy + (a.fightUntil ? Math.sin(now / 60 + k) * 0.12 : 0);
      drawSprite(ctx, 'soldier', lx, ly, 1, 4, dir < 0);
    }
    // the banner and its label
    const bx = a.x * T - cam.x + T / 2, by = a.y * T - cam.y - 18;
    ctx.fillStyle = '#5b3a1a'; ctx.fillRect(bx, by, 2, 26);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx + 2, by); ctx.lineTo(bx + 18, by + 5); ctx.lineTo(bx + 2, by + 11); ctx.fill();
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    const label = `${a.mine ? 'Your army: ' : ''}${REALMS[a.realm].short.replace(/^the /, '')} (${a.troops})`;
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(6,12,20,0.7)'; ctx.fillRect(bx - w / 2, by - 18, w, 15);
    ctx.fillStyle = col; ctx.fillText(label, bx, by - 6); ctx.textAlign = 'start';
    if (a.fightUntil && Math.random() < 0.3) burst(a.tx, a.ty, Math.random() < 0.5 ? '#fff3c4' : '#ff9f43', 4, 120, { life: 300, size: 2 });
  }
}

// ---------- the hound ----------
// ---------- pets ----------
// Companions of every size, sold at inns (each realm keeps its own), up to three
// at a time. They follow at heel, bite whatever comes close, grow with kills, limp
// home when badly hurt, get patched up at any inn, and come aboard your ship.
const PET_KINDS = {
  cat:      { name: 'cat',      size: 'small',  hp: 10, atk: 2, cost: 40,  swift: true, sprite: 'cat',      blurb: 'quick, and gets in a second bite' },
  hound:    { name: 'hound',    size: 'medium', hp: 14, atk: 3, cost: 80,  sprite: 'hound',    blurb: 'loyal; follows you and fights' },
  husky:    { name: 'husky',    size: 'medium', hp: 16, atk: 3, cost: 100, sprite: 'husky',    blurb: 'tireless, bred for the snow' },
  mongoose: { name: 'mongoose', size: 'small',  hp: 9,  atk: 3, cost: 90,  swift: true, sprite: 'mongoose', blurb: 'fearless, and fast as a thrown knife' },
  hawk:     { name: 'hawk',     size: 'small',  hp: 8,  atk: 3, cost: 120, swift: true, flies: true, sprite: 'hawk', blurb: 'strikes from above and never trips a trap' },
  wolf:     { name: 'wolf',     size: 'medium', hp: 18, atk: 4, cost: 150, sprite: 'wolf',     blurb: 'hunts at your side' },
  boar:     { name: 'boar',     size: 'medium', hp: 24, atk: 4, cost: 160, sprite: 'boar',     blurb: 'thick-hided and stubborn' },
  bear:     { name: 'bear',     size: 'large',  hp: 40, atk: 6, cost: 400, sprite: 'bear',     blurb: 'a wall of fur and teeth' },
  elephant: { name: 'elephant', size: 'large',  hp: 60, atk: 7, cost: 700, sprite: 'elephant', blurb: 'nothing on the road stands in its way' },
};
const PET_MAX = 3;
const INN_PETS = { cantons: ['hound', 'cat'], aurum: ['hound', 'hawk'], kathar: ['wolf', 'boar', 'bear'], league: ['cat', 'hawk'], tianxia: ['cat', 'hawk'], suryadesh: ['mongoose', 'elephant'], severin: ['husky', 'bear'] };
const PET_PAD = { small: 6, medium: 3, large: -1 };
let pets = [];   // { kind, x, y, rx, ry, hp, maxHp, atk, level, kills, down, aboard, face }
const HOUND_COST = PET_KINDS.hound.cost;
const petKind = (p) => PET_KINDS[p.kind] || PET_KINDS.hound;
const petLabel = (p) => petKind(p).name;
const livePets = () => scene === 'house' ? [] : pets.filter((p) => !p.down && !p.aboard);
const petAt = (x, y) => livePets().find((p) => p.x === x && p.y === y) || null;
const houndAt = (x, y) => !!petAt(x, y);
function makePet(kind) { const K = PET_KINDS[kind]; return { kind, x: player.x, y: player.y, hp: K.hp, maxHp: K.hp, atk: K.atk, level: 1, kills: 0, down: false, face: 1 }; }
function adoptPet(kind) {
  if (pets.length >= PET_MAX || !PET_KINDS[kind]) return null;
  const p = makePet(kind); pets.push(p);
  if (player.relic === 'houndcollar') { p.collar = true; p.maxHp += 6; p.hp = p.maxHp; }
  placePets(); buildLegend();
  if (pets.length >= PET_MAX) unlock('menagerie');
  return p;
}
function petsState() { return pets.map((p) => ({ kind: p.kind, hp: Math.max(0, p.hp), max_hp: p.maxHp, atk: p.atk, level: p.level, kills: p.kills, down: !!p.down })); }
function placePets() {
  if (scene === 'house') return;
  const taken = new Set();
  for (const p of pets) {
    if (p.down || p.aboard) continue;
    let placed = false;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [-2, 0], [2, 0], [0, -2]]) {
      const x = player.x + dx, y = player.y + dy, t = getTile(x, y), k = key(x, y);
      if (!taken.has(k) && walkable(t) && t !== TILE.DOOR && t !== TILE.EXIT && t !== TILE.TRAP && t !== TILE.SITE && !getMonsterAt(x, y) && !getNpcAt(x, y)) { p.x = x; p.y = y; taken.add(k); settle(p); placed = true; break; }
    }
    if (!placed) { p.x = player.x; p.y = player.y; settle(p); }
  }
}
const placeHound = placePets;
function petHurt(p, dmg) {
  p.hp -= dmg; p.flashUntil = performance.now() + 120;
  floatText(p.x, p.y, `-${dmg}`, '#ff9b9b');
  if (p.hp <= 0) {
    p.hp = 0; p.down = true;
    log(`Your ${petLabel(p)} is badly hurt and limps off home. An innkeeper can patch it up.`, 'bad'); sfx.play('hurt');
    burst(p.x, p.y, '#b9976a', 12, 80, { life: 500 });
  }
}
function petBitten(p, m) {
  const dmg = Math.max(1, m.atk - (petKind(p).size === 'large' ? 2 : 1));
  m.lunge = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y), until: performance.now() + 140 };
  petHurt(p, dmg);
}
function petScored(p) {
  p.kills++;
  if (p.kills % 8 === 0) { p.level++; p.maxHp += petKind(p).size === 'large' ? 8 : 4; p.atk += 1; p.hp = p.maxHp; log(`Your ${petLabel(p)} grows stronger (level ${p.level}).`, 'good'); }
  if (p.kills >= 10) unlock('good_dog');
}
// One step for a pet: bite an adjacent foe, chase one near the hero, or follow. Returns true after a bite.
function stepPet(p) {
  const K = petKind(p);
  const foe = monsters.find((m) => dist(m, p) === 1 && (m.awake || dist(m, player) <= 2));
  if (foe) {
    const dmg = Math.max(1, p.atk + (wearing('houndcollar') ? 3 : 0) + rnd(2) - (foe.mod === 'armored' ? 2 : 0));
    foe.hp -= dmg; foe.awake = true; foe.flashUntil = performance.now() + 120;
    p.lunge = { dx: Math.sign(foe.x - p.x), dy: Math.sign(foe.y - p.y), until: performance.now() + 140 };
    if (foe.x !== p.x) p.face = Math.sign(foe.x - p.x);
    floatText(foe.x, foe.y, `-${dmg}`, '#e9c48a');
    if (coopMember()) { coopHit(foe, dmg, 'hound'); return true; }
    if (foe.hp <= 0) { petScored(p); killMonster(foe); }
    return true;
  }
  // a waking foe near the hero: go for it; otherwise stay at heel
  const target = monsters.filter((m) => m.awake && cheb(m, player) <= 4 && isVisible(m.x, m.y)).sort((a, b) => dist(a, p) - dist(b, p))[0];
  const goal = target || player;
  if (!target && cheb(p, player) <= 1) return false;
  const d = bfs(goal.x, goal.y, 16, false, true);
  let best = null, bestD = d.get(key(p.x, p.y)) ?? Infinity;
  for (const [dx, dy] of DIRS) {
    const nx = p.x + dx, ny = p.y + dy, nd = d.get(key(nx, ny));
    if (nd === undefined || nd >= bestD) continue;
    if (getMonsterAt(nx, ny) || (nx === player.x && ny === player.y) || getNpcAt(nx, ny) || petAt(nx, ny) || (!K.flies && getTile(nx, ny) === TILE.TRAP)) continue;
    bestD = nd; best = [nx, ny];
  }
  if (best) { if (best[0] !== p.x) p.face = Math.sign(best[0] - p.x); p.x = best[0]; p.y = best[1]; }
  return false;
}
function stepPets() {
  if (scene === 'house') return;
  let needPlace = false;
  for (const p of pets) {
    if (p.down) continue;
    if (aboard) { p.aboard = true; continue; }             // everyone is on the boat
    if (p.aboard) { p.aboard = false; needPlace = true; continue; }   // back on land
    if (cheb(p, player) > 14) { needPlace = true; continue; }
    const bit = stepPet(p);
    if (!bit && petKind(p).swift) stepPet(p);   // the quick ones get a second move
  }
  if (needPlace) placePets();
}
const stepHound = stepPets;

function endTurn(moved) {
  turn++;
  mp.lastActive = performance.now();
  if (moved && turn % 2 === 0) sfx.play('step');
  if (moved && scene === 'world') { const gnd = groundAt(player.x, player.y); if (gnd === GROUND.ROAD || gnd === GROUND.SAND) burst(player.x, player.y, gnd === GROUND.SAND ? '#e7d3a1' : '#b9976a', 3, 25, { foot: true, gravity: -10, life: 380, size: 2 }); }
  if ((player.mana ?? 0) < maxMana()) player.mana = Math.min(maxMana(), (player.mana ?? 0) + 1);
  if (player.shield > 0 && --player.shield === 0) log('Your shield wall fades.');
  if (player.rage > 0 && --player.rage === 0) log('Your war cry fades.');
  if (player.poison > 0) {
    player.poison--; player.hp -= 1; floatText(player.x, player.y, '-1', '#7ad36b');
    if (player.poison === 0) log('The poison wears off.', 'good');
  }
  if (turn % SAVE_EVERY_TURNS === 0) saveProgress('progress');
  if (scene !== 'dungeon') stepNpcs();
  stepGuards();
  stepHound(); stepEscort(); tickTotems(); tickTrial(); tickRifts();
  // in a shared dungeon the host moves monsters on a steady beat instead of per turn
  if (scene !== 'house' && !coopActive()) {
    stepMonsters();
    if (scene === 'dungeon' && monsters.some((m) => m.mod === 'swift' && m.awake)) stepMonsters(true);
  }
  if (inTown() && (turn % 8 === 0)) refreshTownContext();
  if (wearing('tideheart') && turn % 6 === 0 && player.hp > 0 && player.hp < player.maxHp) { player.hp++; floatText(player.x, player.y, '+1', '#7bdfff'); }
  { const ba = wornAffix('armor'); if (ba && ba.id === 'blessed' && turn % (10 - 2 * ba.tier) === 0 && player.hp > 0 && player.hp < player.maxHp) { player.hp++; floatText(player.x, player.y, '+1', '#ffd86b'); } }
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
  if (scene === 'world' && moved && story2().s === 0 && townContaining(player.x, player.y) && story1Done()) offerStory2();
  if (scene === 'world' && moved && story3().s === 0 && townContaining(player.x, player.y) && story2Done()) offerStory3();
  if (scene === 'world' && moved && story4().s === 0 && townContaining(player.x, player.y) && story3Done()) offerStory4();
  if (scene === 'world' && moved && story5().s === 0 && townContaining(player.x, player.y) && story4Done()) offerStory5();
  if (inTown()) for (const pl of nearbyPlaces(player.x, player.y, 1)) if (!discovered(pl) && cheb(pl, player) <= 3) discoverPlace(pl);
  if (inTown()) for (const st of nearbySites(player.x, player.y, 1)) if (st.lair && !lairKnown(st.lair) && cheb(st, player) <= 4) revealLair(st.lair, 'You stumble on it:');
  if (scene === 'world' && turn % 5 === 0) spawnBounties();
  music.setMood(currentMood());
  if (mapPin && scene === 'world' && cheb(mapPin, player) <= 3) { mapPin = null; savePin(); log('You reach the spot you pinned on your map.', 'good'); }
  if (scene === 'world' && moved && !gameOver && !storyOpen() && !perkChoices && !aboard && !townContaining(player.x, player.y) && !coopActive()
      && !monsters.some((m) => m.awake && cheb(m, player) <= 6)) {
    if (chapterRider()) { draw(); return; }
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
      if (!player.meta.visited.includes(here.key)) { log(I.describe(), 'good'); log(townLore(here)); }
      toast = { text: `${here.name}. ${here.size === 'grand' ? 'The' : 'A'} ${TIER_WORDS[townTier(here)]} ${I.kind} of ${REALMS[I.realm].short}, known for ${I.famous}.`, until: performance.now() + 3500 };
    }
    lastTownKey = here ? here.key : null;
    if (here && !player.meta.visited.includes(here.key)) { player.meta.visited.push(here.key); if (player.meta.visited.length >= 5) unlock('explorer'); }
    if (dayPhase() === 'night') tip('night', 'Night has fallen. Beasts in the wilds notice you from further away, but towns stay safe.');
  }
  draw();
}

function die() {
  if (dungeonDef && dungeonDef.arena && scene === 'dungeon') { leaveArena(true); return; }
  if (scene === 'world' && aboard && !gameOver) { player.hp = 1; washAshore('a sea beast'); updateStats(); draw(); return; }
  if (dungeonDef && dungeonDef.delve && scene === 'dungeon') {   // the dream breaks; the hero only wakes
    recordDelve(false); escort = null; totems.clear(); trial = null; sfx.play('die'); shakeScreen(6, 500);
    floor = TOWN; createWorld(); returnHome(); player.hp = Math.max(1, Math.round(player.maxHp * 0.25)); dungeonDef = null; afterSceneChange();
    log(`You fall in the delve, and wake at the inn with a cry and ${player.hp} HP. It was a dream; the gold and the score are real.`, 'bad');
    updateStats(); saveProgress('progress'); return;
  }
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
      perks: player.perks, achievements: player.achievements, title: player.title, meta: { ...player.meta, pets: petsState() }, weapon_plus: player.weaponPlus, armor_plus: player.armorPlus, kills: player.lifetimeKills };
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
  player.hp = player.maxHp; player.poison = 0; restoreMana();
  for (const pp of pets) if (pp.down) { pp.down = false; pp.hp = pp.maxHp; }
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
      const m = getMonsterAt(x, y);
      if (m) { if (!best || d < best.d) best = { m, d, dx, dy }; break; }
      if (!walkable(getTile(x, y)) && !seaTile(x, y)) break;
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
    const m = getMonsterAt(x, y);
    if (m) return { m, d, dx, dy };
    if (!walkable(getTile(x, y)) && !seaTile(x, y)) return null;
  }
  return null;
}
// Three abilities per class, unlocked at levels 1, 5 and 10. Each run() returns
// false when it could not fire (no target), and nothing is spent.
const ABILITIES = {
  warrior: [
    { name: 'Shield Wall', cost: 18, level: 1, blurb: '2 less damage from every hit for 6 turns', run: () => {
      player.shield = 6; log('You raise your shield wall: 2 less damage from every hit for 6 turns.', 'good');
      burst(player.x, player.y, '#7bdfff', 24, 120, { glow: true, gravity: 0, life: 450 }); sfx.play('shield'); return true; } },
    { name: 'Whirlwind', cost: 10, level: 5, blurb: 'strike every foe beside you in one swing', run: () => {
      const foes = monsters.filter((m) => m.hp > 0 && dist(m, player) === 1);
      if (!foes.length) { log('Nothing beside you to swing at.'); return false; }
      shakeScreen(3); sfx.play('hit'); burst(player.x, player.y, '#fff3c4', 20, 160, { glow: true, life: 300, gravity: 0, size: 2 });
      log(`You spin with your blade out and hit ${foes.length} ${foes.length === 1 ? 'foe' : 'foes'}.`, 'good');
      for (const m of foes) { const dmg = Math.max(1, player.atk + weaponAtk() + rnd(2) - (m.mod === 'armored' ? 2 : 0)); m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg}`, '#ffd86b'); }
      for (const m of foes) { if (coopMember()) coopHit(m, 1, 'hero'); else if (m.hp <= 0) killMonster(m); }
      return true; } },
    { name: 'War Cry', cost: 14, level: 10, blurb: 'stun every foe within 2 tiles for 2 turns and hit 2 harder for 5 turns', run: () => {
      const foes = monsters.filter((m) => m.hp > 0 && cheb(m, player) <= 2);
      player.rage = 5; for (const m of foes) { if (!m.boss) m.stunned = 2; m.awake = true; floatText(m.x, m.y, '✦', '#ffd86b'); }
      shakeScreen(5); sfx.play('boss'); burst(player.x, player.y, '#ff9f43', 30, 140, { glow: true, gravity: -40, life: 600 });
      log(`Your war cry rings off the walls: ${foes.filter((m) => !m.boss).length} foes reel, and your blows will land harder for 5 turns.`, 'good'); return true; } },
  ],
  ranger: [
    { name: 'Arrow', cost: 3, level: 1, blurb: 'shoot the nearest foe in a straight line, up to 6 tiles', run: (aim) => {
      const t = aim ? aimedLine(aim, 6) : lineTarget(6);
      if (!t) { log(aim ? 'No clear shot there. Arrows fly straight up, down, left or right, up to 6 tiles.' : 'No target in a straight line. Arrows fly up, down, left or right.'); return false; }
      const dmg = Math.max(1, player.atk + weaponAtk() + 1 + rnd(2) - (t.m.mod === 'armored' ? 2 : 0));
      if (t.dx) player.face = t.dx;
      t.m.hp -= dmg; t.m.awake = true; t.m.struck = turn; t.m.flashUntil = performance.now() + 120;
      floatText(t.m.x, t.m.y, `-${dmg}`, '#ffd86b');
      shoot(player.x, player.y, t.m.x, t.m.y, 'arrow');
      sfx.play('arrow'); log(`Your arrow hits ${t.m.boss ? t.m.name : 'the ' + t.m.type.name} for ${dmg}.`);
      if (coopMember()) coopHit(t.m, dmg, 'hero'); else if (t.m.hp <= 0) killMonster(t.m);
      return true; } },
    { name: 'Volley', cost: 6, level: 5, blurb: 'loose arrows at the three nearest foes in sight, up to 6 tiles', run: () => {
      const foes = monsters.filter((m) => m.hp > 0 && cheb(m, player) <= 6 && isVisible(m.x, m.y)).sort((a, b) => cheb(a, player) - cheb(b, player)).slice(0, 3);
      if (!foes.length) { log('No foe in sight for a volley.'); return false; }
      sfx.play('arrow'); for (const m of foes) shoot(player.x, player.y, m.x, m.y, 'arrow');
      for (const m of foes) { const dmg = Math.max(1, Math.round((player.atk + weaponAtk() + rnd(2)) * 0.8) - (m.mod === 'armored' ? 2 : 0)); m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg}`, '#ffd86b'); floatText(player.x + Math.sign(m.x - player.x), player.y + Math.sign(m.y - player.y), '➤', '#d9b382'); }
      log(`A volley of arrows: ${foes.length} ${foes.length === 1 ? 'foe' : 'foes'} struck.`, 'good');
      for (const m of foes) { if (coopMember()) coopHit(m, 1, 'hero'); else if (m.hp <= 0) killMonster(m); }
      return true; } },
    { name: 'Evade', cost: 5, level: 10, blurb: 'slip one tile away from the nearest foe and dodge the next 3 blows', run: () => {
      const near = monsters.filter((m) => m.hp > 0).sort((a, b) => cheb(a, player) - cheb(b, player))[0];
      player.evade = 3;
      if (near) {
        const dx = Math.sign(player.x - near.x), dy = Math.sign(player.y - near.y);
        for (const [sx, sy] of [[dx, dy], [dx, 0], [0, dy]]) { if (!sx && !sy) continue; const nx = player.x + sx, ny = player.y + sy; if (walkable(getTile(nx, ny)) && !getMonsterAt(nx, ny) && !houndAt(nx, ny) && !hazard(nx, ny)) { landFromDeck(); player.x = nx; player.y = ny; if (sx) player.face = sx; break; } }
      }
      burst(player.x, player.y, '#7bdfff', 16, 100, { glow: true, gravity: 0, life: 400 }); sfx.play('shield');
      log('You slip aside. The next three blows aimed at you will miss.', 'good'); return true; } },
  ],
  mage: [
    { name: 'Fireball', cost: 8, level: 1, blurb: 'burn every foe within 2 tiles of the nearest one in sight (range 5)', run: (aim) => {
      let target = null, bd = Infinity;
      if (aim) {
        if (cheb(aim, player) > 5 || !isVisible(aim.x, aim.y)) { log('Too far, or out of sight. A fireball reaches 5 tiles.'); return false; }
        if (!monsters.some((m) => cheb(m, aim) <= 2)) { log('Nothing there to burn.'); return false; }
        target = aim;
      }
      else for (const m of monsters) { const d = cheb(m, player); if (d <= 5 && isVisible(m.x, m.y) && d < bd) { bd = d; target = m; } }
      if (!target) { log('No monster in sight to aim at.'); return false; }
      const dmg = 5 + player.level + rnd(3);
      const hit = monsters.filter((m) => cheb(m, target) <= 2);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.random() < 0.5) floatText(target.x + i, target.y + j, '✸', '#ff9f43');
      sfx.play('fire');
      log(`Your fireball bursts over ${hit.length} ${hit.length === 1 ? 'monster' : 'monsters'} for ${dmg} each.`, 'good');
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) burst(target.x + i, target.y + j, Math.random() < 0.5 ? '#ff9f43' : '#ffd86b', 3, 70, { glow: true, gravity: -80, life: 600, size: 3 });
      for (const m of hit) { m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg}`, '#ffd86b'); }
      for (const m of hit) { if (coopMember()) coopHit(m, dmg, 'hero'); else if (m.hp <= 0) killMonster(m); }
      return true; } },
    { name: 'Frost Nova', cost: 10, level: 5, blurb: 'freeze every foe within 2 tiles for 2 turns and chill them', run: () => {
      const foes = monsters.filter((m) => m.hp > 0 && cheb(m, player) <= 2);
      if (!foes.length) { log('Nothing near enough to freeze.'); return false; }
      const dmg = 3 + Math.floor(player.level / 2);
      sfx.play('potion'); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) burst(player.x + i, player.y + j, '#9fd4ff', 3, 60, { glow: true, gravity: -30, life: 700, size: 3 });
      for (const m of foes) { if (!m.boss) m.stunned = 2; m.hp -= dmg; m.awake = true; m.flashUntil = performance.now() + 120; floatText(m.x, m.y, `-${dmg} ❄`, '#9fd4ff'); }
      log(`Frost bursts from your staff: ${foes.length} ${foes.length === 1 ? 'foe is' : 'foes are'} frozen for 2 turns.`, 'good');
      for (const m of foes) { if (coopMember()) coopHit(m, dmg, 'hero'); else if (m.hp <= 0) killMonster(m); }
      return true; } },
    { name: 'Blink', cost: 6, level: 10, blurb: 'step through the air up to 5 tiles the way you face, or to where you click', run: (aim) => {
      let dest = null;
      if (aim && cheb(aim, player) <= 5 && isVisible(aim.x, aim.y) && walkable(getTile(aim.x, aim.y)) && !getMonsterAt(aim.x, aim.y) && !hazard(aim.x, aim.y)) dest = { x: aim.x, y: aim.y };
      if (!dest) { const dx = player.face || 1; for (let d = 1; d <= 5; d++) { const nx = player.x + dx * d; if (!walkable(getTile(nx, player.y))) break; if (getMonsterAt(nx, player.y) || houndAt(nx, player.y) || hazard(nx, player.y)) continue; dest = { x: nx, y: player.y }; } }   // a blink passes over foes and stops only at walls
      if (!dest) { log('No room to blink that way.'); return false; }
      burst(player.x, player.y, '#c084fc', 20, 110, { glow: true, gravity: -60, life: 500 });
      landFromDeck();
      player.x = dest.x; player.y = dest.y; settle(player);
      burst(player.x, player.y, '#c084fc', 20, 110, { glow: true, gravity: -60, life: 500 }); sfx.play('stairs');
      log('You blink across the room in a shimmer of violet.', 'good'); return true; } },
  ],
};
const abilityList = () => ABILITIES[player.cls] || ABILITIES.warrior;
const abilityUnlocked = (slot) => player.level >= abilityList()[slot].level;
function useAbility(aim = null, slot = 0) {
  if (gameOver || !player || shopOpen || scene === 'house' || perkChoices || storyOpen()) return;
  const A = abilityList()[slot]; if (!A) return;
  if (!abilityUnlocked(slot)) { log(`${A.name} comes at level ${A.level}. You are level ${player.level}.`); draw(); return; }
  const cost = abilityCost(slot);
  if ((player.mana ?? 0) < cost) { log(`Not enough mana for ${A.name}: it costs ${cost}, you have ${player.mana ?? 0}. Mana returns a point a turn, or drink a mana potion.`); draw(); return; }
  if (stoneTurn()) return;
  if (!A.run(aim)) { draw(); return; }
  player.mana -= cost;
  endTurn(false);
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
  // the game owns its keys: arrows, Space and the movement letters never scroll the page, whatever is open
  if (!e.ctrlKey && !e.metaKey && !e.altKey && (KEYS[e.key] || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key))) e.preventDefault();
  if (storyOpen()) {
    const choices = scenePage && scenePage.choices;
    if (choices && choices.length) {
      if (['ArrowDown', 'ArrowUp', 's', 'S', 'w', 'W', 'Tab'].includes(e.key)) { e.preventDefault(); moveChoice(['ArrowUp', 'w', 'W'].includes(e.key) || (e.key === 'Tab' && e.shiftKey) ? -1 : 1); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseScene(choiceIndex); return; }
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); chooseScene(Number(e.key) - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); chooseScene(choices.length - 1); }   // the last choice is always the way out
      return;
    }
    if (['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); nextScenePage(); } else if (e.key === 'Escape') { e.preventDefault(); skipScene(); }
    return;
  }
  if (controlsOpen()) { if (['Escape', '?', 'Enter'].includes(e.key)) { e.preventDefault(); toggleControls(false); } return; }
  if (settingsOpen()) { if (['Escape', 'o', 'O'].includes(e.key)) { e.preventDefault(); toggleSettings(false); } return; }
  if (e.key === 'o' || e.key === 'O') { e.preventDefault(); toggleSettings(true); return; }
  if (e.key === '?') { e.preventDefault(); toggleControls(true); return; }
  if (journalOpen) { journalKey(e); return; }
  sfx.unlock();
  if (perkChoices) {   // the perk picker owns the keyboard: numbers, arrows/WASD and Enter
    if (['1', '2', '3'].includes(e.key)) { choosePerk(Number(e.key) - 1); return; }
    const n = perkChoices.length;
    if (['ArrowLeft', 'ArrowUp', 'a', 'A', 'w', 'W'].includes(e.key) || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); perkCursor = (perkCursor + n - 1) % n; draw(); return; }
    if (['ArrowRight', 'ArrowDown', 'd', 'D', 's', 'S', 'Tab'].includes(e.key)) { e.preventDefault(); perkCursor = (perkCursor + 1) % n; draw(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePerk(perkCursor); }
    return;
  }
  if (walk.active && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) stopWalk();   // any key takes back control
  if (e.key === 'Enter' && chatInput) { e.preventDefault(); chatInput.focus(); return; }
  if ((e.key === 'y' || e.key === 'Y') && mp.invites.length) { acceptInvite(); return; }
  if (e.key === 'Escape') { closeShop(); if (mapOpen || questsOpen) { mapOpen = false; questsOpen = false; draw(); } return; }
  if (shopOpen) return;
  if (e.key === 'm' || e.key === 'M') { questsOpen = false; toggleMap(); return; }
  if (mapOpen && ['+', '=', '-', '_'].includes(e.key)) { e.preventDefault(); setMapZoom(mapZoom + (e.key === '-' || e.key === '_' ? 1 : -1)); return; }
  if (e.key === 'q' || e.key === 'Q') { mapOpen = false; questsOpen = !questsOpen; draw(); return; }
  if (e.key === 'c' || e.key === 'C') { makeCamp(); return; }
  if (e.key === 'j' || e.key === 'J') { mapOpen = false; questsOpen = false; journalOpen = true; draw(); return; }
  if (e.key === 'n' || e.key === 'N') { toggleSound(); return; }
  if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); useAbility(null, Number(e.key) - 1); return; }
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
// ---------- touch: tap, hold or swipe ----------
// A tap walks one step toward the spot you touched; holding keeps walking
// toward it (re-aimed from wherever the hero now stands), and stops by itself
// when something wakes up beside you or you start taking damage. A swipe steps
// in that direction, and keeps stepping while the finger is down, steered by
// where it is dragged. Tapping a monster next to you attacks it; tapping one
// further off sizes it up without moving. Round buttons on the right edge cover
// the rest.
let isTouch = false;
const touch = { id: null, sx: 0, sy: 0, ox: 0, oy: 0, timer: null, delay: null, downAt: 0, steps: 0, swipe: false, hp: 0, near: new Set(), target: null };
function sizeUp(m) {
  const per = Math.max(1, Math.floor(player.atk + weaponAtk() + 0.5 - (m.mod === 'armored' ? 2 : 0))), blows = Math.max(1, Math.ceil(m.hp / per));
  const hit = Math.max(1, m.atk - armorDef() - (player.shield > 0 ? 2 : 0));
  const name = m.boss ? m.name : `${ELITE_MODS[m.mod] ? ELITE_MODS[m.mod].label + ' ' : ''}${m.type.name.toLowerCase()}`;
  return `${name[0].toUpperCase() + name.slice(1)}: ${m.hp}/${m.maxHp} HP, hits you for about ${hit}, ${blows} ${blows === 1 ? 'blow' : 'blows'} to kill${m.awake ? '' : ', asleep'}${m.type.ranged ? ', shoots' : ''}${m.tell ? '. ' + TELL_TEXT[m.tell.kind] : m.reeling > 0 ? '. Off balance: sneak attack it' : ''}.`;
}
function touchButtons() {
  if (!isTouch) return [];
  // buttons down the right edge, fitted between the HUD and the message log:
  // one column of five when there is room, otherwise two columns (three and two)
  const top = 110 + hudExtra, logRoom = 96, room = Math.max(100, canvas.height - top - logRoom);
  const want = canvas.width < 560 ? 24 : 28, perCol = 10 * 20 + 16 <= room ? 5 : 4;
  const r = Math.max(16, Math.min(want, Math.floor((room - 4 * (perCol - 1)) / (2 * perCol)))), gap = Math.min(2 * r + 12, Math.floor((room - 2 * r) / Math.max(1, perCol - 1)));
  const at = (i) => ({ x: canvas.width - r - 12 - (i >= perCol ? 2 * r + 10 : 0), y: top + r + gap * (i % perCol) });
  const cls = heroClass();
  const canCamp = scene === 'world' && !townContaining(player.x, player.y) && !monsters.some((m) => cheb(m, player) <= 6);
  return [
    { id: 'ability', label: (player.mana ?? 0) >= abilityCost() ? '✦' : String(abilityCost() - (player.mana ?? 0)), sub: abilityList()[0].name, ...at(0), r, active: (player.mana ?? 0) >= abilityCost() },
    { id: 'potion', label: '♥', sub: 'Potion', ...at(1), r, active: player.bag.some((id) => itemKind(id) === 'consumable' && itemInfo(id).heal) },
    canCamp ? { id: 'camp', label: '▲', sub: 'Camp', ...at(2), r, active: true } : { id: 'wait', label: '⏸', sub: 'Wait', ...at(2), r, active: true },
    { id: 'map', label: scene === 'world' ? 'M' : 'Q', sub: scene === 'world' ? 'Map' : 'Quests', ...at(3), r, active: true },
    { id: 'journal', label: 'J', sub: 'Journal', ...at(4), r, active: true },
    ...[1, 2].filter((k) => abilityUnlocked(k)).map((k, n) => ({ id: `ability${k + 1}`, label: (player.mana ?? 0) >= abilityCost(k) ? `${k + 1}✦` : String(abilityCost(k) - (player.mana ?? 0)), sub: abilityList()[k].name, ...at(5 + n), r, active: (player.mana ?? 0) >= abilityCost(k) })),
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
  // after the first step, holding stops itself when it would be reckless: a deliberate hold on a foe beside you is not reckless
  const deliberate = touch.target && monsters.includes(touch.target) && touch.target.hp > 0 && dist(touch.target, player) === 1;
  if (touch.steps > 0 && !deliberate) {
    if (player.hp < touch.hp) { stopTouchWalk(); log('You stop: something is hurting you.', 'bad'); return; }
    const fresh = monsters.find((m) => m.awake && m.hp > 0 && dist(m, player) <= 2 && !touch.near.has(m) && isVisible(m.x, m.y));
    if (fresh && !safeZone()) { stopTouchWalk(); log(`You stop: ${fresh.boss ? fresh.name : 'a ' + fresh.type.name.toLowerCase()} is close.`, 'bad'); return; }
  }
  touch.hp = player.hp; touch.near = new Set(monsters.filter((m) => dist(m, player) <= 2)); touch.steps++;
  if (touch.swipe) {   // steered by the drag: the dominant axis of finger from where it landed
    const sx = touch.sx - touch.ox, sy = touch.sy - touch.oy;
    if (Math.hypot(sx, sy) < 12) return;
    const [dx, dy] = Math.abs(sx) >= Math.abs(sy) ? [Math.sign(sx), 0] : [0, Math.sign(sy)];
    tryMove(dx, dy); return;
  }
  const { px, py } = canvasPoint(touch.sx, touch.sy);
  const tx = Math.floor((px + cam.x) / T), ty = Math.floor((py + cam.y) / T);
  const dx = tx - player.x, dy = ty - player.y;
  if (!dx && !dy) { if (touch.steps > 1) stopTouchWalk(); return; }
  // walk the shortest path when the spot can be reached, so obstacles are skirted
  if ((walkable(getTile(tx, ty)) || (aboard && seaTile(tx, ty))) && Math.abs(dx) + Math.abs(dy) <= 40) {
    const d = bfs(tx, ty, 48, false, false, aboard), here = d.get(key(player.x, player.y));
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
function stopTouchWalk() { touch.id = null; clearInterval(touch.timer); touch.timer = null; clearTimeout(touch.delay); touch.delay = null; touch.swipe = false; touch.target = null; }
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  isTouch = true;
  e.preventDefault();
  sfx.unlock();
  if (perkChoices) { perkClick(e); return; }
  if (journalOpen) { const { px, py } = canvasPoint(e.clientX, e.clientY); journalClick(px, py); return; }
  if (mapOpen && scene === 'world') { const { px, py } = canvasPoint(e.clientX, e.clientY); if (mapClick(px, py)) return; }
  if (mapOpen || questsOpen) { mapOpen = false; questsOpen = false; draw(); return; }
  if (gameOver) { init(); return; }
  if (shopOpen) return;
  const { px, py } = canvasPoint(e.clientX, e.clientY);
  const btn = touchButtons().find((b) => Math.hypot(px - b.x, py - b.y) <= b.r + 6);
  if (btn) {
    if (btn.id === 'ability') useAbility();
    else if (btn.id === 'ability2') useAbility(null, 1);
    else if (btn.id === 'ability3') useAbility(null, 2);
    else if (btn.id === 'potion') drinkPotion();
    else if (btn.id === 'wait') wait();
    else if (btn.id === 'map') { if (scene === 'house') { questsOpen = true; draw(); } else toggleMap(); }
    else if (btn.id === 'journal') { journalOpen = true; draw(); }
    else if (btn.id === 'camp') makeCamp();
    return;
  }
  stopTouchWalk();
  // a tap on a monster out of reach sizes it up instead of walking at it
  { const tx = Math.floor((px + cam.x) / T), ty = Math.floor((py + cam.y) / T), tm = getMonsterAt(tx, ty);
    if (tm && tm.hp > 0 && dist(tm, player) > 1 && isVisible(tx, ty)) { toast = { text: sizeUp(tm), until: performance.now() + 4000 }; tip('sizeup', 'Tap a monster that is out of reach to size it up. Tap one beside you to strike it.'); draw(); return; }
    const tn = scene !== 'dungeon' && getNpcAt(tx, ty);
    if (tn && dist(tn, player) > 1) { toast = { text: `${tn.type.name}${tn.type.role ? ', ' + tn.type.role : ''}. Walk up and tap to talk.`, until: performance.now() + 3000 }; }
    touch.target = tm || null; }
  touch.id = e.pointerId; touch.sx = touch.ox = e.clientX; touch.sy = touch.oy = e.clientY; touch.downAt = performance.now(); touch.steps = 0; touch.swipe = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  // a short wait tells a tap from the start of a swipe
  touch.delay = setTimeout(() => { touch.delay = null; if (touch.id === null) return; touchStep(); touch.timer = setInterval(touchStep, 190); }, 90);
}, { passive: false });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touch.id) return;
  touch.sx = e.clientX; touch.sy = e.clientY;
  if (!touch.swipe && Math.hypot(e.clientX - touch.ox, e.clientY - touch.oy) >= 24 && performance.now() - touch.downAt < 320) {
    touch.swipe = true; touch.target = null; clearTimeout(touch.delay); touch.delay = null;
    tip('swipe', 'Swipe to step that way. Keep your finger down to keep walking, and drag to steer.');
    touchStep(); if (!touch.timer) touch.timer = setInterval(touchStep, 190);
  }
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, (e) => { if (e.pointerId !== touch.id) return; if (ev === 'pointerup' && touch.delay && !touch.swipe) { clearTimeout(touch.delay); touch.delay = null; touchStep(); } stopTouchWalk(); });
window.addEventListener('pagehide', () => { if (!gameOver) saveProgress('progress', true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !gameOver) saveProgress('progress', true); if (!document.hidden) { mp.lastActive = performance.now(); mpKick(); } });

// ---------- inventory ----------
const invWeapon = document.getElementById('inv-weapon');
const invArmor = document.getElementById('inv-armor');
const invBag = document.getElementById('inv-bag');
function itemLabel(id) {
  const it = itemInfo(id);
  if (!it) return id;
  if (itemKind(id) === 'weapon') return `${it.name}${id === player.weapon && player.weaponPlus ? ' +' + player.weaponPlus : ''}${it.magic ? ', ' + it.magic : ''} (+${it.atk + (id === player.weapon ? player.weaponPlus || 0 : 0)} attack${WEAPON_TRAITS[traitOf(id)] ? ', ' + WEAPON_TRAITS[traitOf(id)].name : ''}${it.floor >= 99 ? ', legendary' : ''})`;
  if (itemKind(id) === 'armor') return `${it.name}${id === player.armor && player.armorPlus ? ' +' + player.armorPlus : ''}${it.magic ? ', ' + it.magic : ''} (${it.def + (id === player.armor ? player.armorPlus || 0 : 0)} defence)`;
  if (ITEMS.relics[id]) return `${it.name} (${it.desc})`;
  if (it.use === 'bomb') return `${it.name} (blasts a 3×3 area)`;
  if (it.use === 'return') return `${it.name} (back to your home town)`;
  if (it.use === 'mana') return `${it.name} (+${it.mana} mana)`;
  if (it.trade && it.desc) return `${it.name} (${it.desc})`;
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
  const hpOf = (r) => (r === 'crown' ? 10 : r === 'deepheart' ? 15 : 0);
  if (hpOf(player.relic)) { player.maxHp -= hpOf(player.relic); player.hp = Math.min(player.hp, player.maxHp); }
  player.relic = id;
  if (hpOf(id)) { player.maxHp += hpOf(id); player.hp += hpOf(id); }
  for (const pp of pets) { pp.maxHp = Math.max(1, pp.maxHp + (id === 'houndcollar' ? 6 : 0) - (pp.collar ? 6 : 0)); pp.collar = id === 'houndcollar'; pp.hp = Math.min(pp.hp, pp.maxHp); }
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
  else if (it.use === 'mana') drinkMana(idx);
  else drinkPotion(idx);
}
function drinkMana(idx) {
  if (gameOver || !player) return;
  if (idx === undefined) idx = player.bag.indexOf('manapotion');
  if (idx < 0) { log('You have no mana potions.'); draw(); return; }
  const it = itemInfo(player.bag[idx]), before = player.mana ?? 0;
  player.bag.splice(idx, 1); restoreMana(it.mana);
  log(`You drink the ${it.name.toLowerCase()} and recover ${player.mana - before} mana.`, 'good');
  sfx.play('potion'); burst(player.x, player.y, '#7b9bff', 14, 50, { glow: true, gravity: -90, life: 800 });
  updateStats(); renderShop(); endTurn(false);
}
function throwBomb(idx) {
  if (gameOver || !player || perkChoices) return;
  if (idx === undefined) idx = player.bag.indexOf('bomb');
  if (idx < 0) { log('You have no bombs.'); draw(); return; }
  if (scene === 'house' || safeZone()) { log('Not here. Bombs are for the dungeon and the wilds.'); draw(); return; }
  if (stoneTurn()) return;
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
  const it = itemInfo(player.bag[idx]), food = !['potion', 'elixir'].includes(player.bag[idx]);
  const healed = Math.min(food ? it.heal : potionHeal(it.heal), player.maxHp - player.hp);
  player.bag.splice(idx, 1);
  if (food) {
    player.hp += healed;
    const notes = [];
    if (it.mana) { const before = player.mana ?? 0; restoreMana(it.mana); if (player.mana > before) notes.push(`${player.mana - before} mana back`); }
    if (it.cure && player.poison > 0) { player.poison = 0; notes.push('the poison is purged'); }
    if (it.buff) { player.meta.blessing = { atk: it.buff.atk || 0, def: it.buff.def || 0, turns: it.buff.turns, name: it.name.toLowerCase() }; notes.push(`${[it.buff.atk ? `+${it.buff.atk} attack` : '', it.buff.def ? `+${it.buff.def} defence` : ''].filter(Boolean).join(' and ')} for ${it.buff.turns} turns`); }
    if (it.light) { player.torch = turn + it.light; notes.push(`you will see further underground for ${it.light} turns`); bgDirty = true; if (scene === 'dungeon') updateVisibility(); }
    if (it.reveal) { const unknown = nearbyPlaces(player.x, player.y, 2).filter((pl) => !discovered(pl)); for (const pl of unknown) player.meta.places.push(pl.key); mapCache.ox = null; notes.push(unknown.length ? `${unknown.length} place${unknown.length === 1 ? '' : 's'} marked on your map` : 'nothing new in sight'); }
    if (it.petheal) { let n = 0; for (const pp of pets) { if (pp.down || pp.hp < pp.maxHp) n++; pp.down = false; pp.hp = pp.maxHp; } notes.push(n ? `${n} pet${n === 1 ? '' : 's'} patched up` : 'your pets were fine already'); }
    const verb = it.verb === 'light' ? 'light' : it.verb === 'use' ? 'use' : /wine|mead|ale|rum|tea|vial|draught/i.test(it.name) ? 'drink' : 'eat';
    log(`You ${verb} the ${it.name.toLowerCase()}${healed ? ` and recover ${healed} HP` : ''}${notes.length ? `: ${notes.join(', ')}` : ''}.`, 'good');
    sfx.play('potion'); updateStats(); renderShop(); endTurn(false); return;
  }
  player.hp += healed;
  if (player.poison > 0) { player.poison = 0; log('The potion purges the poison.', 'good'); }
  log(healed > 0 ? `You drink a potion and heal ${healed} HP.` : 'You drink a potion but were already at full health.', 'good');
  tip('potion_turn', 'Drinking takes the turn: anything beside you gets its blow in while you swallow.');
  updateStats(); renderShop(); endTurn(false);
}
function dropLoot(m) {
  if (Math.random() > (dungeonDef ? dungeonDef.loot : 0.12) || bagFull()) return;
  if (!dungeonDef) return;   // beasts of the wilds carry nothing
  const pool = Object.entries({ ...ITEMS.weapons, ...ITEMS.armor, ...ITEMS.consumables }).filter(([, it]) => it.floor <= floor);
  if (!pool.length) return;
  const [base] = pool[rnd(pool.length)], id = rollAffix(base), it = itemInfo(id);
  player.bag.push(id);
  log(`The ${m.type.name} drops a ${it.name}${it.magic ? ': ' + it.magic : ''}.`, it.magic ? 'good' : 'good');
  if (it.magic) { sfx.play('win'); floatText(player.x, player.y, '✦ magic', '#c084fc'); unlock('enchanted'); }
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
const SERVICE_SHOPS = new Set(['travel', 'player', 'court', 'council', 'chieftain', 'shaman', 'bank', 'hermit', 'harbour', 'yamen', 'durbar', 'terem', 'rebuild']);
const SHOPS = {
  shop: { title: 'Merchant', stock: (id, it) => it.floor <= Math.max(floor, 1) + 1, price: (it) => it.price, greet: 'The merchant greets you. Buy and sell with the buttons, Esc to leave.' },
  potions: { title: "Mara's potions", stock: (id) => id === 'potion' || id === 'manapotion', price: (it) => it.price - 2, greet: 'Mara sets out her potions. She buys gear too, at half price.' },
  smithy: { title: 'The Smithy', stock: (id, it) => ITEMS.weapons[id] && it.floor <= 5, price: (it) => Math.round(it.price * 0.9), greet: 'The smith wipes his hands. Every blade on the wall is for sale, a tenth off.' },
  armoury: { title: 'The Armoury', stock: (id, it) => ITEMS.armor[id] && it.floor <= 5, price: (it) => Math.round(it.price * 0.9), greet: 'Racks of mail and plate. The armourer names fair prices.' },
  apothecary: { title: 'The Apothecary', stock: (id) => id === 'potion' || id === 'elixir', price: (it) => it.price, greet: 'Shelves of bottles. Potions, and elixirs for the desperate.' },
  royal: { title: 'The Royal Armoury', stock: (id, it) => it.floor < 99, price: (it) => it.price, greet: 'The quartermaster unlocks the cabinet. Everything the realm can forge, at the King\'s prices.' },
  trade: { title: 'The trade shop', stock: (id, it) => !!it.trade && it.trade === tradeHere(), price: (it) => it.price, greet: '' },
  inn: { title: 'The inn', stock: () => false, price: (it) => it.price, greet: 'The innkeeper wipes the bar. A bed, or a companion for the road?' },
  travel: { title: 'Waystone', stock: () => false, price: (it) => it.price, greet: 'The runes hum under your hand. Choose a town you have visited.' },
  player: { title: 'Hero', stock: () => false, price: (it) => it.price, greet: '' },
};
SHOPS.apothecary.stock = (id) => id === 'potion' || id === 'elixir' || id === 'scroll' || id === 'manapotion';
let shopKind = 'shop';
const buyPrice = (id) => Math.max(1, Math.round(SHOPS[shopKind].price(itemInfo(id)) * priceMult() * (SERVICE_SHOPS.has(shopKind) ? 1 : localDeal(id))));
Object.assign(SHOPS, {
  court: { title: 'The Court of Aurum', stock: () => false, price: (it) => it.price, greet: 'The herald unrolls a long scroll of titles. Each comes with a seal, a ribbon, and a price.' },
  rebuild: { title: 'The rebuilding', stock: () => false, price: (it) => it.price, greet: 'The leader unrolls a list of what the town needs, and looks at your purse.' },
  yamen: { title: 'The Yamen of the Empire', stock: () => false, price: (it) => it.price, greet: 'Clerks bend over ledgers. A brush is dipped, a seal is pressed, and someone finally looks up at you.' },
  durbar: { title: 'The Durbar Hall', stock: () => false, price: (it) => it.price, greet: 'Incense, marigolds and a floor cool as a river. Petitioners wait in a patient line that parts for you.' },
  terem: { title: 'The Terem of the Tsar', stock: () => false, price: (it) => it.price, greet: 'A stove the size of a house, icons in gold, and a bear asleep by the door. Nobody seems worried about the bear.' },
  council: { title: 'The Council of the Cantons', stock: () => false, price: (it) => it.price, greet: 'The councillor opens the ledger of public works. Every donation is recorded by name.' },
  chieftain: { title: 'The Clan Fire', stock: () => false, price: (it) => it.price, greet: 'The chieftain looks you up and down. "Outsiders may swear the clan oath. Few do. It asks more than gold, but gold first: a gift for the clan hall."' },
  shaman: { title: 'The Spirits', stock: () => false, price: (it) => it.price, greet: 'The shaman throws herbs on the fire. "Which spirit would you walk with?"' },
  bank: { title: 'The Goldspire Exchange', stock: () => false, price: (it) => it.price, greet: 'The banker steeples her fingers. "Deposits are safe from death itself. There is a small fee."' },
  caravan: { title: 'The merchant caravan', stock: (id, it) => (!!ITEMS.consumables[id] && it.floor < 99) || (it.floor >= 3 && it.floor <= 7), price: (it) => Math.round(it.price * 0.95), greet: 'The caravan master throws back a tarp. Goods from every corner of the four realms.' },
  harbour: { title: 'The harbour', stock: () => false, price: (it) => it.price, greet: 'Gulls, tar and rope. The harbourmaster runs a finger down a list of ports.' },
  hermit: { title: "The hermit's maps", stock: () => false, price: (it) => it.price, greet: 'The hermit spreads out a bundle of hand-drawn maps. "Places I have been. Places I would not go again."' },
});
// The master smith knows the tale of the Sundered Blade, and is the one who can reforge it.
function smithTale() {
  if (!player.meta.forged && forgePieces().length >= 3) {
    if (bagFull()) { log('The master smith: "I can reforge Dawnbreaker, but you will need a free hand to carry it. Make room in your bag."', 'bad'); return false; }
    player.meta.forged = true; player.bag.push('dawnbreaker'); sfx.play('quest'); unlock('dawnbreaker');
    showScene([{ who: 'The master smith', sprite: 'merchant', bg: 'town', text: 'The smith lays the hilt, the blade and the stone on the anvil and looks at them for a long time. Then the fires are stoked higher than they have been in a lifetime, and the hammer falls through the night.' },
      { who: 'The master smith', sprite: 'merchant', bg: 'town', text: `At dawn the smith hands you Dawnbreaker, the sword of the First King. ${itemLabel('dawnbreaker')}. "I never thought I would see it. Mind what you do with it."` }]);
    track('forged', {}); updateStats(); saveProgress('progress'); return true;
  }
  if (player.level >= 12 && !lairKnown('hilt')) {
    showScene([{ who: 'The master smith', sprite: 'merchant', bg: 'town', text: 'The smith looks you over. "You have the arm for it. There is a tale we smiths keep: Dawnbreaker, the First King\'s sword, broken into three when he fell and hidden where no usurper would look. The hilt is still at the forge where it was made. The orcs hold it now."' },
      { who: 'The master smith', sprite: 'merchant', bg: 'town', text: '"Bring me the hilt, the blade and the stone, and I will reforge it. There has not been a sword like it since, and there will not be again."' }], () => revealLair('hilt', 'The master smith tells of'));
    return true;
  }
  return false;
}
function openShop(kind = 'shop') {
  if (!shopEl) return;
  tip('shop', 'Buy with the buttons, sell anything at half price. Smithies and armouries also sharpen and reinforce what you wear.');
  if (kind === 'trade' && tradeHere()) { const T2 = TRADE_SHOP[tradeHere()]; SHOPS.trade.title = T2.name; SHOPS.trade.greet = `${T2.npc[0].toUpperCase() + T2.npc.slice(1)}: ${T2.line}`; }
  if (kind === 'trade' && tradeHere() === 'smithing' && smithTale()) return;
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
const riding = () => !!(player && player.meta && (player.meta.horse || wearing('hollowcrown'))) && scene === 'world' && !aboard && !townContaining(player.x, player.y)
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
// A ship of the hero's own, sold by any harbourmaster. It sails the open sea
// two tiles a step, lands on any shore, and waits wherever it was left.
const SHIP_COST = 1500;
const seaTile = (x, y) => scene === 'world' && getTile(x, y) === TILE.WALL && groundAt(x, y) === GROUND.WATER && isSea(x, y);
const shipAt = (x, y) => !aboard && !!(player && player.meta && player.meta.ship) && player.meta.ship.x === x && player.meta.ship.y === y && scene === 'world';
// the open-water tile alongside the pier where a hero's ship can lie
function mooringOf(town) {
  const H = town.harbour; if (!H) return null;
  const perp = H.dx ? [0, 1] : [1, 0];
  // never beside the pier's end: the harbourmaster stands there, and you board from the pier tile alongside
  for (let k = H.len - 1; k >= 2; k--) for (const sg of [1, -1]) {
    const x = H.x + H.dx * k + perp[0] * sg, y = H.y + H.dy * k + perp[1] * sg;
    if (seaTile(x, y)) return { x, y };
  }
  return null;
}
// a ship moored where nobody can step aboard (beside the harbourmaster's tile, from
// before the mooring moved) is brought one tile along the pier
function fixMooring(town) {
  const S = player && player.meta && player.meta.ship; if (!S || aboard || !town || !town.harbour) return;
  const H = town.harbour, end = H.end, perp = H.dx ? [0, 1] : [1, 0];
  const badSpot = Math.abs(S.x - end.x) + Math.abs(S.y - end.y) === 1 && (S.x - end.x) * perp[0] + (S.y - end.y) * perp[1] !== 0;
  const moor = mooringOf(town);
  if (badSpot && moor) { player.meta.ship = moor; log('The harbourmaster has had your ship warped a little way along the pier, out of his doorway.'); }
}
function shipRows(here) {
  if (!here || !here.harbour) return [];
  fixMooring(here);
  const S = player.meta.ship, moor = mooringOf(here);
  if (!S) {
    if (!moor) return [shopRow('The harbourmaster would sell you a ship, but there is no open water to moor one here')];
    if (!farShoreOpen()) return [shopRow('No ship is for sale while the Veil stands. The harbourmasters will not sell a hull to sail under its own canvas until the eastern storm parts, and that is a matter for the next story', 'Not yet', () => {}, true)];
    const cost = townIdentity(here).trade.label === 'shipping' ? Math.round(SHIP_COST * 0.75) : SHIP_COST;
    return [shopRow('A ship of your own: sail the open sea at will, two tiles a step, and land on any shore or island no road reaches', `Buy ${cost}g`, () => {
      if (player.gold < cost) return;
      player.gold -= cost; player.meta.ship = moor; sfx.play('quest');
      log(`The harbourmaster hands you the papers of a trim little cog. She lies at anchor off the pier of ${here.name}: walk into her to go aboard.`, 'good');
      tip('ship', 'At sea the arrow keys sail your ship. Steer onto any shore to land; the ship waits where you left it, and any harbourmaster can fetch it.');
      unlock('shipwright'); track('ship_bought', { cost }); updateStats(); renderShop(); draw(); saveProgress('progress');
    }, player.gold < cost)];
  }
  const far = Math.round(Math.hypot(S.x - here.cx, S.y - here.cy));
  if (far <= 24 || !moor) return [shopRow(far <= 24 ? 'Your ship rides at anchor off the pier. Walk into her to go aboard' : 'Your ship is moored elsewhere, and there is no open water here to bring her to')];
  const fee = 20 + Math.round(far / 20);
  return [shopRow(`Your ship lies ${far} tiles away. The harbourmaster's lads can bring her round to this pier`, `Fetch ${fee}g`, () => {
    if (player.gold < fee) return;
    player.gold -= fee; player.meta.ship = moor; sfx.play('gold');
    log(`A few days of other people's rowing later, your ship lies off the pier of ${here.name}.`, 'good');
    updateStats(); renderShop(); draw(); saveProgress('progress');
  }, player.gold < fee)];
}
// ---------- the open sea: charts, wrecks, pirates ----------
const CHART_COST = 300;
const charts = () => player.meta.charts || (player.meta.charts = []);
// where the n-th chart bought at a port leads: an island if one is in reach, else a lonely shore
function chartSpot(port, n) {
  let shore = null;
  for (let k = 0; k < 400; k++) {
    const a = cellRand(port.i, port.j, 700 + n * 50 + k) * Math.PI * 2, d = 50 + cellRand(port.i, port.j, 720 + n * 50 + k) * 110;
    const x = Math.round(port.cx + Math.cos(a) * d), y = Math.round(port.cy + Math.sin(a) * d);
    if (!isLand(x, y) || charts().includes(key(x, y))) continue;
    const g = terrainAt(x, y); if (g !== GROUND.GRASS && g !== GROUND.SAND && g !== GROUND.FOREST) continue;
    if (nearbyTowns(x, y, 1).some((t) => x >= t.x0 - 4 && x < t.x0 + tw(t) + 4 && y >= t.y0 - 4 && y < t.y0 + th(t) + 4)) continue;
    if (continentOf(x, y) === -1) return { x, y };
    if (!shore && [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([ox, oy]) => isSea(x + ox, y + oy))) shore = { x, y };
  }
  return shore;
}
function chartRows(here) {
  if (!here || !here.harbour) return [];
  const n = charts().length + (player.meta.treasures || 0);
  if (charts().length >= 3) return [shopRow('You already carry three charts. Dig one up before buying more')];
  return [shopRow(`A chart to buried treasure, bought off a sailor: an X on an island or lonely shore within sailing reach${player.meta.ship ? '' : ' (you will want a ship)'}`, `Buy ${CHART_COST}g`, () => {
    if (player.gold < CHART_COST) return;
    const spot = chartSpot(here, n);
    if (!spot) { log('The harbourmaster turns the chart over twice and admits it is a drawing of a goat.'); return; }
    player.gold -= CHART_COST; charts().push(key(spot.x, spot.y)); sfx.play('quest');
    const d = Math.round(Math.hypot(spot.x - here.cx, spot.y - here.cy)), island = continentOf(spot.x, spot.y) === -1;
    log(`The chart shows an X on ${island ? 'an island' : 'a lonely shore'} about ${d} paces ${compassWord(spot.x - here.cx, spot.y - here.cy).toLowerCase()} of ${here.name}. It is marked ✕ on your map; walk onto the spot to dig.`, 'good');
    tip('chart', 'Treasure charts mark a red ✕ on the world map (M). Sail there and step onto the spot. You can carry three at a time.');
    mapCache.ox = null; track('chart_bought', { island }); updateStats(); renderShop(); draw(); saveProgress('progress');
  }, player.gold < CHART_COST)];
}
const chartNear = (x, y) => scene === 'world' ? charts().find((k) => { const [cx, cy] = k.split(',').map(Number); return Math.max(Math.abs(cx - x), Math.abs(cy - y)) <= 1; }) || null : null;
function digTreasure(k) {
  player.meta.charts = charts().filter((c) => c !== k); player.meta.treasures = (player.meta.treasures || 0) + 1;
  const n = player.meta.treasures, danger = wildDanger();
  const gold = Math.round((200 + rnd(200) + danger * 60 + n * 40) * goldMult());
  player.gold += gold; floatText(player.x, player.y, `+${gold}g`, '#f5c542');
  burst(player.x, player.y, '#ffd86b', 30, 120, { glow: true, gravity: 120, life: 800, rise: 140 }); sfx.play('win'); shakeScreen(3);
  log(`X marks the spot. Under a foot of sand your blade rings on iron: a sea-chest with ${gold} gold.`, 'good');
  if (!player.meta.found.includes('stormpearl')) giveRelic('stormpearl');
  else {
    const up = upgradeFor(Math.random() < 0.5 ? 'weapon' : 'armor');
    if (up && !bagFull()) { player.bag.push(up); log(`Wrapped in oilcloth beneath the coin: a ${itemInfo(up).name}.`, 'good'); }
    else if (!bagFull()) { player.bag.push('goldcarp'); log('A golden carp, dried and salted, lies on top. Merchants still pay for it.', 'good'); }
  }
  unlock('treasure'); if (player.gold >= 1000) unlock('rich');
  track('treasure_dug', { n }); mapCache.ox = null; updateStats(); saveProgress('progress');
}
// a fight on deck, settled in one go: your blade against their strength, their blows against your mail
function seaFight(strength, hit) {
  const rounds = Math.ceil(strength / Math.max(1, player.atk + weaponAtk()));
  let taken = 0;
  for (let r = 0; r < rounds; r++) taken += Math.max(0, hit - Math.floor(armorDef() / 2) + rnd(3) - 1);
  const lost = taken >= player.hp;   // beaten: the sea takes you, and gives you back on the nearest shore
  taken = Math.min(taken, player.hp - 1);
  if (taken > 0) { player.hp -= taken; floatText(player.x, player.y, `-${taken}`, '#ff6b6b'); }
  shakeScreen(lost ? 8 : 4, lost ? 700 : 220); sfx.play('hurt');
  return { rounds, taken, lost };
}
// A lost fight at sea: the hero wakes on the nearest shore with a little strength
// left, the ship grounded beside them and the pets scrambling up the beach.
function washAshore(by) {
  let land = null;
  for (let d = 1; d <= 80 && !land; d++) for (let k = -d; k <= d && !land; k++) for (const [x, y] of [[player.x + k, player.y - d], [player.x + k, player.y + d], [player.x - d, player.y + k], [player.x + d, player.y + k]]) {
    if (!land && isLand(x, y) && walkable(getTile(x, y)) && !townContaining(x, y) && !getMonsterAt(x, y)) land = { x, y };
  }
  const from = { x: player.x, y: player.y };
  if (land) {
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: land.x + dx, y: land.y + dy })).find((t) => seaTile(t.x, t.y));
    player.x = land.x; player.y = land.y; player.wx = land.x; player.wy = land.y; settle(player);
    if (player.meta.ship) player.meta.ship = beside || { x: from.x, y: from.y };
  }
  aboard = false; for (const pp of pets) pp.aboard = false; placePets();
  player.hp = Math.max(1, Math.round(player.maxHp * 0.25));
  const near = nearestTownTo(player.x, player.y), far = near ? Math.round(Math.hypot(near.cx - player.x, near.cy - player.y)) : 0;
  refreshTownContext(); afterSceneChange(); mapCache.ox = null; updateCamera(); unlock('castaway'); track('washed_ashore', { by }); saveProgress('progress');
  const where = near ? `${far} tiles ${compassWord(player.x - near.cx, player.y - near.cy).toLowerCase()} of ${near.name}` : 'a nameless beach';
  const shipNote = !player.meta.ship ? '' : land && player.meta.ship.x !== from.x ? ' Your ship lies grounded on the shingle beside you, battered but whole.' : ' Your ship drifts where the fight was; a harbourmaster can fetch her.';
  log(`You are beaten at sea and the water takes you. You wake face down on the shore, ${where}, with ${player.hp} HP and the taste of salt.${shipNote}${pets.length ? ' Your companions crawl up the beach after you.' : ''}`, 'bad');
  return { where, shipNote };
}
let seaCalm = 0;   // sail steps before the sea may stir again
function nearestPort() { let best = null; for (const t of nearbyTowns(player.x, player.y, 3)) if (t.harbour && (!best || Math.hypot(t.cx - player.x, t.cy - player.y) < Math.hypot(best.cx - player.x, best.cy - player.y))) best = t; return best; }
function foundChart(where) {
  const port = nearestPort(); if (!port || charts().length >= 3) return '';
  const spot = chartSpot(port, charts().length + (player.meta.treasures || 0) + 7); if (!spot) return '';
  charts().push(key(spot.x, spot.y)); mapCache.ox = null;
  return ` ${where} you find a chart: an X ${Math.round(Math.hypot(spot.x - player.x, spot.y - player.y))} paces ${compassWord(spot.x - player.x, spot.y - player.y).toLowerCase()} of here, now marked on your map.`;
}
const SEA_EVENTS = {
  pirates: () => {
    const d = wildDanger(), toll = Math.max(20, Math.floor(player.gold * 0.15)), strength = 14 + d * 8, hit = 3 + d;
    const win = () => { const { rounds, taken, lost } = seaFight(strength, hit);
      if (lost) { const cut = Math.floor(player.gold * 0.15); player.gold -= cut; const w = washAshore('pirates'); return `Steel on steel across the gunwales, and then too much steel. They take ${cut} gold from your belt and tip you over the side. Cold, dark, and then shingle under your cheek: you have washed up ${w.where}, with ${player.hp} HP.${w.shipNote}`; }
      const g = 40 + d * 25 + rnd(40); player.gold += g; gainXp(12 + d * 6);
      const up = Math.random() < 0.3 ? upgradeFor(Math.random() < 0.5 ? 'weapon' : 'armor') : null; if (up && !bagFull()) player.bag.push(up);
      return `Steel on steel across the gunwales. ${rounds} hard ${rounds === 1 ? 'exchange' : 'exchanges'}${taken ? ` and ${taken} damage` : ''} later the pirates are over the side. Their strongbox holds ${g} gold${up ? ` and a ${itemInfo(up).name}` : ''}.${Math.random() < 0.3 ? foundChart('In the captain\'s cabin') : ''}`; };
    return { who: 'A pirate sloop', sprite: 'archer', bg: 'sea',
      text: `A black-sailed sloop runs up alongside, grapples ready. "Heave to," calls a woman with a brass-hilted cutlass. "${toll} gold and we part friends. Or we come over and take it."`,
      choices: [
        { label: `Pay the ${toll} gold`, disabled: player.gold < toll, run: () => { player.gold -= toll; return 'You toss the purse across. "Pleasure," she says, and the sloop falls away astern.'; } },
        { label: 'Fight them on the deck', run: win },
        { label: 'Crowd on sail and run', run: () => { if (Math.random() < (wearing('stormpearl') ? 0.85 : 0.5)) return wearing('stormpearl') ? 'The pearl at your throat hums and the wind swings behind you. The sloop is a dot by sunset.' : 'Your little ship is faster than she looks. The sloop gives up the chase by dusk.'; return 'They are faster. Grapples bite your rail and the pirates swarm aboard. ' + win(); } },
      ] };
  },
  serpent: () => {
    const d = wildDanger(), strength = 24 + d * 12, hit = 4 + d;
    return { who: 'A sea serpent', sprite: 'wyrm', bg: 'sea',
      text: 'The water bulges, and a neck as thick as a mast rises dripping beside the ship. Two yellow eyes consider you, and the hull, and which would be the better meal.',
      choices: [
        { label: 'Fight it', run: () => { const { rounds, taken, lost } = seaFight(strength, hit);
          if (lost) { const w = washAshore('serpent'); return `You hack at the neck each time it strikes, and it strikes once more than you can stand. The coils close, the deck goes out from under you, and the sea is very cold. You wake on the shore ${w.where}, with ${player.hp} HP and no idea how.${w.shipNote}`; }
          const g = 80 + d * 40 + rnd(60); player.gold += g; gainXp(30 + d * 12); unlock('serpent'); return `You hack at the neck each time it strikes. After ${rounds} ${rounds === 1 ? 'pass' : 'passes'}${taken ? ` and ${taken} damage` : ''} it sinks, thrashing. A pearl the size of an egg floats up in its wake, worth ${g} gold to the first jeweller you meet.`; } },
        { label: 'Hard about and flee', run: () => { if (wearing('stormpearl')) return 'The serpent recoils from the pearl at your throat as if from a torch, and slides back under.'; if (Math.random() < 0.55) return 'You throw the tiller over. The serpent snaps at your wake, loses interest, and dives.'; const dmg = Math.min(player.hp - 1, hit * 2); player.hp -= dmg; floatText(player.x, player.y, `-${dmg}`, '#ff6b6b'); shakeScreen(5); return `It catches the stern a glancing blow for ${dmg} before you pull clear.`; } },
      ] };
  },
  wreck: () => ({ who: 'A drifting wreck', sprite: 'ship', bg: 'sea',
    text: 'A dismasted hulk wallows in the swell, her name long scoured off. Nothing moves on her deck. The hatch to the hold is still battened down.',
    choices: [
      { label: 'Board her and open the hold', run: () => { const d = wildDanger(); const g = 30 + d * 15 + rnd(50); player.gold += g; let out = `You pry the hatch. ${g} gold in a rotten purse`;
        if (Math.random() < 0.5) { const up = upgradeFor(Math.random() < 0.5 ? 'weapon' : 'armor'); if (up && !bagFull()) { player.bag.push(up); out += `, and a ${itemInfo(up).name} in grease that kept the rust off`; } }
        else if (!bagFull()) { player.bag.push('fish'); out += ', and a barrel of salt fish still good'; }
        if (Math.random() < 0.25) { const dmg = Math.min(player.hp - 1, 2 + d); player.hp -= dmg; floatText(player.x, player.y, `-${dmg}`, '#ff6b6b'); out += `. The rats object, for ${dmg}`; }
        return out + '.' + (Math.random() < 0.35 ? foundChart("Nailed inside the hatch") : ''); } },
      { label: 'Leave her to the sea', run: () => 'You give the hulk a wide berth. Some hatches are battened for a reason.' },
    ] }),
  castaway: () => ({ who: 'A castaway', sprite: 'villager', bg: 'sea',
    text: 'A sunburnt figure waves from a raft of lashed spars, shouting hoarsely. There is a bucket, a torn sail, and a very determined expression.',
    choices: [
      { label: 'Haul them aboard', run: () => { const port = nearestPort(); const g = 25 + wildDanger() * 10; player.gold += g; gainXp(8); const ch = foundChart('"Take this, for your trouble." From inside a shirt'); return `They drink half your water and tell you the whole story twice. ${ch ? ch.trim() : `They press ${g} gold on you, every coin they have.`}${port ? ` You set them ashore at ${port.name} in due course.` : ''}`; } },
      { label: 'Sail on', run: () => 'You tell yourself someone else will come along. The shouting follows you a long way.' },
    ] }),
};
function seaEvent() {
  if (seaCalm > 0) { seaCalm--; return; }
  if (Math.random() > 0.045) return;
  seaCalm = 20;
  const ids = Object.keys(SEA_EVENTS), id = ids[rnd(ids.length)];
  player.meta.encounters = (player.meta.encounters || 0) + 1;
  sfx.play('quest'); track('sea_event', { id });
  showScene([SEA_EVENTS[id]()]);
}
function boardShip() {
  const S = player.meta.ship;
  if (S.x > player.x) player.face = 1; else if (S.x < player.x) player.face = -1;
  player.x = S.x; player.y = S.y; player.wx = S.x; player.wy = S.y; aboard = true;
  for (const pp of pets) if (!pp.down) pp.aboard = true;
  log(`You climb aboard${livePets().length || pets.some((pp) => pp.aboard) ? ' with your companions scrambling after you' : ''} and shake out the sail. The open sea is yours.`, 'good');
  tip('ship', 'At sea the arrow keys sail your ship. Steer onto any shore to land; the ship waits where you left it, and any harbourmaster can fetch it.');
  sfx.play('stairs'); endTurn(true);
}
// A hero who leaves the deck by magic or a sidestep has landed; the ship stays where she lies.
function landFromDeck() {
  if (!aboard) return;
  aboard = false; for (const pp of pets) pp.aboard = false; placePets();
  log('You leave the deck for the shore. The ship waits where she lies.');
}
function sailStep(dx, dy) {
  let nx = player.x + dx, ny = player.y + dy;
  if (!northOpen() && ny < ICE_Y && player.y >= ICE_Y) { log('The sea ahead is pack ice to the horizon, groaning and shifting. Nothing with a hull goes further north than this.', 'bad'); draw(); return; }
  if (!farShoreOpen() && nx > VEIL_X && player.x <= VEIL_X) { log('A wall of black cloud stands across the eastern sea with lightning walking inside it: the Veil. No ship has passed it in a thousand years, and yours turns back of its own accord.', 'bad'); draw(); return; }
  player.x = nx; player.y = ny;
  // a following sea: the second tile comes free on open water
  const x2 = nx + dx, y2 = ny + dy;
  const gated = (x, y) => (!northOpen() && y < ICE_Y) || (!farShoreOpen() && x > VEIL_X);
  if ((dx || dy) && seaTile(x2, y2) && !gated(x2, y2) && !getMonsterAt(x2, y2) && !(walk.active && nx === walk.tx && ny === walk.ty)) {
    player.x = x2; player.y = y2;
    const x3 = x2 + dx, y3 = y2 + dy;   // the Stormcaller Pearl: a third tile
    if (wearing('stormpearl') && seaTile(x3, y3) && !gated(x3, y3) && !getMonsterAt(x3, y3) && !(walk.active && x2 === walk.tx && y2 === walk.ty)) { player.x = x3; player.y = y3; }
  }
  player.wx = player.x; player.wy = player.y; player.meta.ship = { x: player.x, y: player.y };
  endTurn(true);
  if (aboard && !gameOver && !storyOpen() && !shopOpen) seaEvent();
}
function travelCost(town) { const c = 10 + Math.round((Math.abs(town.cx - player.x) + Math.abs(town.cy - player.y)) / 12); let d = realmState().standing >= 250 ? Math.ceil(c / 2) : c; const here = townContaining(player.x, player.y); if (here && here.paved) d = Math.ceil(d * 0.75); return wearing('jadeseal') ? Math.ceil(d / 2) : d; }   // paved roads make for cheaper travel
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
    // pets: the ones you have, then the ones this realm's inns sell
    for (const pp of pets) {
      if (pp.down || pp.hp < pp.maxHp) shopBuy.appendChild(shopRow(pp.down ? `Your ${petLabel(pp)} is back, bandaged and sorry for itself` : `Patch up your ${petLabel(pp)}`, 'Heal, free', () => { pp.hp = pp.maxHp; pp.down = false; log(`The innkeeper patches up your ${petLabel(pp)}.`, 'good'); buildLegend(); renderShop(); draw(); }));
      else shopBuy.appendChild(shopRow(`Your ${petLabel(pp)} is in fine fettle (level ${pp.level}, ${pp.kills} kills)`));
    }
    { const innTown = interior && interior.house && interior.house.town ? townAt(...interior.house.town.split(',').map(Number)) : null;
      const kinds = INN_PETS[innTown ? innTown.realm : 'cantons'] || INN_PETS.cantons;
      for (const kind of kinds) {
        const K = PET_KINDS[kind], full = pets.length >= PET_MAX;
        shopBuy.appendChild(shopRow(`${K.name[0].toUpperCase() + K.name.slice(1)} (${K.size}): ${K.hp} HP, bites for ${K.atk}; ${K.blurb}${full ? ` (you already keep ${PET_MAX})` : ''}`, `Buy ${K.cost}g`, () => {
          if (player.gold < K.cost || pets.length >= PET_MAX) return;
          player.gold -= K.cost; adoptPet(kind);
          log(`A ${K.name} ${K.size === 'large' ? 'lumbers over and leans on you' : K.size === 'small' ? 'darts over and sits at your feet' : 'pads over and sits at your feet'}. It waits outside while you are indoors, and comes aboard when you sail.`, 'good'); sfx.play('quest');
          tip('hound', `Your pets follow you, bite anything that comes close, and grow stronger with kills. You can keep ${PET_MAX}. If one falls, an innkeeper patches it up for free.`);
          updateStats(); buildLegend(); renderShop(); draw();
        }, player.gold < K.cost || full));
      } }
    { const fish = player.bag.filter((id) => id === 'fish').length;
      if (fish) shopBuy.appendChild(shopRow(`Have the cook make your ${fish} fish into hearty stew (+15 HP each)`, `Cook ${fish * 2}g`, () => {
        if (player.gold < fish * 2) return; player.gold -= fish * 2; player.bag = player.bag.map((id) => (id === 'fish' ? 'stew' : id));
        log(`The cook turns your catch into ${fish} bowls of steaming stew.`, 'good'); sfx.play('potion'); updateStats(); renderShop(); draw();
      }, player.gold < fish * 2)); }
    for (const row of delveRows()) shopBuy.appendChild(row);
    for (const row of horseRows()) shopBuy.appendChild(row);
    for (const row of monumentRows()) shopBuy.appendChild(row);
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
  { const st = shopTown(); const trade = st && townIdentity(st).tradeId;
    if ((shopKind === 'shop' || shopKind === 'potions') && (trade === 'fishing' || trade === 'salt') && !player.meta.rod) shopBuy.appendChild(shopRow('Fishing rod: walk into water anywhere in the wilds to fish', 'Buy 30g', () => {
      if (player.gold < 30) return; player.gold -= 30; player.meta.rod = true; sfx.play('chest');
      log('You buy a fishing rod. Walk into any water in the wilds to cast a line.', 'good');
      tip('fish', 'Walk into water to fish. Eat a fish with P, or cook it into stew at an inn or a camp (C).');
      updateStats(); renderShop(); draw(); saveProgress('progress');
    }, player.gold < 30)); }
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
const FAR_SEATS = {
  yamen: { realm: 'tianxia', cost: 600, ach: 'mandarin', offer: 'Sit the imperial examination', blurb: 'The examination halls take anyone with a brush. Pass, and you are a mandarin of the Empire, with a rank, a seal, and a very small hat.', done: 'Three days in a cell with a brush and an inkstone. Your essay on the Deep is read aloud at court. You are a mandarin of the ninth rank.' },
  durbar: { realm: 'suryadesh', cost: 500, ach: 'pilgrim', offer: 'Make the pilgrimage of nine gates', blurb: 'Walk the nine gates of Suryapur with an offering at each, and the temples will know your name from here to the sea.', done: 'Nine gates, nine offerings, nine blessings chanted over you. The priests tie a saffron thread at your wrist. You are a pilgrim of the Sun.' },
  terem: { realm: 'severin', cost: 550, ach: 'boyar', offer: 'Be raised to the boyar council', blurb: 'The Tsar seats useful people at his council. Useful, in Severin, means brave, rich, or good with bears.', done: 'The Tsar hands you a fur hat and a seat at the long table. The other boyars glare. You are a boyar of Severin.' },
};
function serviceRows(kind) {
  const rows0 = serviceRowsInner(kind);
  const realm = { court: 'aurum', council: 'cantons', chieftain: 'kathar', bank: 'league', yamen: 'tianxia', durbar: 'suryadesh', terem: 'severin' }[kind];
  return realm ? rows0.concat(armyRows(realm)) : rows0;
}
function serviceRowsInner(kind) {
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
  } else if (kind === 'rebuild') {
    for (const row of rebuildRows(shopTown())) rows.push(row);
  } else if (FAR_SEATS[kind]) {
    const P = FAR_SEATS[kind], had = (player.achievements || []).includes(P.ach);
    rows.push(shopRow(P.blurb));
    rows.push(shopRow(had ? `✓ ${P.offer}` : `${P.offer}: +250 standing with every realm, and a title`, had ? '' : `${P.cost}g`, () => {
      if (had || !spend(P.cost)) return;
      rs.standing += 250; unlock(P.ach); log(P.done, 'good'); track('realm_spend', { realm: P.realm, what: kind, cost: P.cost }); afterSpend();
    }, had || player.gold < P.cost));
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
    for (const r of serviceRowsInner('shaman')) rows.push(r);
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
  } else if (kind === 'harbour') {
    const here = townContaining(player.x, player.y) || nearestTownTo(player.x, player.y);
    const ports = here ? portsNear(here) : [];
    for (const row of shipRows(here)) rows.push(row);
    for (const row of chartRows(here)) rows.push(row);
    if (northOpen() && here) {   // the passage north through the ice, each way
      const dest = here.thule ? homePort() : thuleTown();
      if (dest && dest.harbour) { const cost = fareTo(here, dest); rows.push(shopRow(here.thule ? `Passage south to ${dest.name}, ${REALMS[dest.realm].short} (home)` : `Passage north through the pack ice to Hrafnvik and the Frozen Gate`, `Sail ${cost}g`, () => sailTo(here, dest), player.gold < cost)); }
    }
    if (farShoreOpen() && here) {   // the passage across the Veil, each way
      const dest = here.cx > VEIL_X ? homePort() : farPort();
      if (dest) { const cost = fareTo(here, dest); rows.push(shopRow(`Passage across the Veil to ${dest.name}, ${REALMS[dest.realm].short}${here.cx > VEIL_X ? ' (home)' : ' (the Far Shore)'}`, `Sail ${cost}g`, () => sailTo(here, dest), player.gold < cost)); }
    }
    if (!ports.length) rows.push(shopRow('No other port on this sea. The ship stays tied up.'));
    for (const t of ports) {
      const I = townIdentity(t), seen = player.meta.visited.includes(t.key), cost = fareTo(here, t);
      rows.push(shopRow(`${t.name}, ${REALMS[I.realm].short} (${I.kind}${seen ? '' : ', never visited'}), ${compassWord(t.cx - here.cx, t.cy - here.cy).toLowerCase()}`, `Sail ${cost}g`, () => sailTo(here, t), player.gold < cost));
    }
  } else if (kind === 'hermit') {
    const lh = lairHint(player.x, player.y);
    if (lh) rows.push(shopRow(`A map to a monster's lair: "${lh.text}". The hermit will not say what lives there`, '120g', () => {
      if (!spend(120)) return; revealLair(lh.id, 'The hermit marks it on your map:'); afterSpend();
    }, player.gold < 120));
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
  const w = itemKind(id) === 'weapon' ? itemInfo(id) : null, a = itemKind(id) === 'armor' ? itemInfo(id) : null;
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
  if (aboard && !seaTile(player.x, player.y)) aboard = false;   // ferries, waystones and gates all leave the ship where it was moored
  if (scene === 'world' && player && !aboard && !walkable(getTile(player.x, player.y)) && !townContaining(player.x, player.y)) {
    log('The land has changed since you were last here: the sea covers where you stood. You wake in your home town.', 'bad');
    returnHome();
  }
  music.setMood(currentMood());
  stopWalk(); hover.path = []; hover.sig = '';
  bubble = null; closeShop(); clearInspect(); floats.length = 0; particles.length = 0; shots.length = 0; mapOpen = false;
  mp.players.clear(); mpKick();
  settle(player); for (const n of npcs) settle(n);
  placeHound();
  updateCamera(); updateVisibility(); buildLegend(); updateStats(); draw();
}
function startRun(saved) {
  player = { x: 1, y: 1, hp: 24, maxHp: 24, atk: 3, level: 1, xp: 0, gold: 0, weapon: null, armor: null, bag: [], quests: [], questsDone: 0, cls: 'warrior', mana: 0, shield: 0, poison: 0,
    perks: [], achievements: [], title: null, meta: { visited: [], second_wind: false, places: [], looted: [], found: [], bestiary: {}, story: null, blessing: null, realm: null }, weaponPlus: 0, armorPlus: 0, lifetimeKills: 0, pendingPerks: 0, relic: null };
  questsOpen = false; mapOpen = false; revealedTraps = new Set(); perkChoices = null; toast = null; aboard = false; rifts = [];
  pets = [];
  { const h = saved && saved.meta && saved.meta.hound; if (h && h.max_hp) pets.push({ kind: 'hound', x: 0, y: 0, hp: h.hp, maxHp: h.max_hp, atk: h.atk, level: h.level, kills: h.kills, down: !!h.down, face: 1 }); }   // heroes from before there were pets
  { const ps = saved && saved.meta && saved.meta.pets; if (Array.isArray(ps)) for (const h of ps.slice(0, PET_MAX)) if (h && PET_KINDS[h.kind] && h.max_hp && !pets.some((q) => q.kind === h.kind && q.level === h.level && q.kills === h.kills)) pets.push({ kind: h.kind, x: 0, y: 0, hp: h.hp, maxHp: h.max_hp, atk: h.atk, level: h.level, kills: h.kills, down: !!h.down, face: 1 }); }
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
        rq: saved.meta?.rq && !Array.isArray(saved.meta.rq) ? saved.meta.rq : {}, horse: !!saved.meta?.horse, forged: !!saved.meta?.forged, trials: Number(saved.meta?.trials) || 0, arena: Number(saved.meta?.arena) || 0, rod: !!saved.meta?.rod,
        story2: saved.meta?.story2 && Number.isInteger(saved.meta.story2.s) ? { s: Math.max(0, Math.min(3, saved.meta.story2.s)) } : null,
        story3: saved.meta?.story3 && Number.isInteger(saved.meta.story3.s) ? { s: Math.max(0, Math.min(2, saved.meta.story3.s)) } : null,
        delve: typeof saved.meta?.delve === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.meta.delve) ? saved.meta.delve : null,
        story5: saved.meta?.story5 && Number.isInteger(saved.meta.story5.s) ? { s: Math.max(0, Math.min(2, saved.meta.story5.s)), n: Math.max(0, Number(saved.meta.story5.n) || 0) } : null,
        story4: saved.meta?.story4 && Number.isInteger(saved.meta.story4.s) ? { s: Math.max(0, Math.min(2, saved.meta.story4.s)), closed: Math.max(0, Number(saved.meta.story4.closed) || 0) } : null,
        secrets: Array.isArray(saved.meta?.secrets) ? saved.meta.secrets.filter((k) => /^-?\d+,-?\d+$/.test(k)).slice(0, 20) : [],
        charts: Array.isArray(saved.meta?.charts) ? saved.meta.charts.filter((k) => /^-?\d+,-?\d+$/.test(k)).slice(0, 3) : [], treasures: Number(saved.meta?.treasures) || 0,
        ship: saved.meta?.ship && Number.isInteger(saved.meta.ship.x) && Number.isInteger(saved.meta.ship.y) ? { x: saved.meta.ship.x, y: saved.meta.ship.y } : null,
        rescued: Number(saved.meta?.rescued) || 0,
        lairs: saved.meta?.lairs && Array.isArray(saved.meta.lairs.known) ? { known: saved.meta.lairs.known.filter((id) => LAIRS[id]), slain: (saved.meta.lairs.slain || []).filter((id) => LAIRS[id]) } : null,
        act2: saved.meta?.act2 && Number.isInteger(saved.meta.act2.s) ? { s: saved.meta.act2.s, n: 0, told: !!saved.meta.act2.told } : null,
        war: saved.meta?.war && saved.meta.war.troops ? { troops: { ...emptyTroops(), ...saved.meta.war.troops }, armies: Array.isArray(saved.meta.war.armies) ? saved.meta.war.armies.map((a) => ({ ...a, fightUntil: undefined })) : [], camps: Array.isArray(saved.meta.war.camps) ? saved.meta.war.camps : [] } : null },
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
  player.mana = maxMana();
  for (const pp of pets) pp.collar = player.relic === 'houndcollar';
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
    else if (saved && player.meta.ship && saved.wx === player.meta.ship.x && saved.wy === player.meta.ship.y && seaTile(saved.wx, saved.wy)) { player.x = saved.wx; player.y = saved.wy; aboard = true; }   // saved at sea, aboard
    else { player.x = t.spawn.x; player.y = t.spawn.y; }
    player.wx = player.x; player.wy = player.y; settle(player); refreshTownContext();
    if (player.meta.ship) for (const tn of nearbyTowns(player.meta.ship.x, player.meta.ship.y, 1)) fixMooring(tn);
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
function loop(now) { pollGamepad(now || performance.now()); armyTick(now || performance.now()); if (!gameOver) draw(); requestAnimationFrame(loop); }
// ---------- the public glossaries ----------
// /world/towns and /world/characters load this script in glossary mode and render
// the generated world as HTML, so the pages always match the game.
function renderGlossary(kind) {
  const root = document.getElementById('glossary'), count = document.getElementById('glossary-count');
  if (!root) return;
  player = { x: 0, y: 0, level: 1, meta: { story: { ch: 0, phase: 'summons' } }, bag: [], quests: [] };   // enough for the generators
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const thumb = (names) => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#0f1724'; g.fillRect(0, 0, 64, 64); const list = [].concat(names).slice(0, 2); list.forEach((n, i) => { const img = sprite(n); const w = list.length === 1 ? 54 : 34; g.drawImage(img, list.length === 1 ? 5 : 2 + i * 28, list.length === 1 ? 5 : 16 + i * 6, w, w); }); return c; };
  const towns = [];
  for (let j = -11; j <= 6; j++) for (let i = -6; i <= 21; i++) { const t = townAt(i, j); if (t) towns.push(t); }
  for (const t of towns) { townIdentity(t); notableNpc(t); }
  const byRealm = (list, keyOf) => ALL_REALMS.map((r) => [r, list.filter((x) => keyOf(x) === r)]).filter(([, l]) => l.length);
  const section = (title, cards) => { const h = document.createElement('h3'); h.className = 'realm'; h.textContent = title; root.appendChild(h); const grid = document.createElement('div'); grid.className = 'cards'; for (const c of cards) grid.appendChild(c); root.appendChild(grid); };
  const card = (sprites, title, sub, body, search) => {
    const el = document.createElement('div'); el.className = 'card'; el.dataset.search = search.toLowerCase(); el.id = slug(title);
    el.appendChild(thumb(sprites));
    const d = document.createElement('div'); d.innerHTML = `<h4>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h4>${body}`; el.appendChild(d);
    return el;
  };
  const townUrl = (t) => `${ACCOUNT.townsUrl}#${slug(t.name)}`;
  let total = 0;
  if (kind === 'towns') {
    for (const [realm, list] of byRealm(towns, (t) => t.realm)) {
      const cards = list.sort((a, b) => a.name.localeCompare(b.name)).map((t) => {
        const I = townIdentity(t), N = t.notable, guards = townNpcs(t).filter((n) => n.type.guard), site = nearbySites(t.cx, t.cy, 1).filter((st) => !st.deep)[0];
        const tags = [`${TIER_WORDS[townTier(t)]}`, I.kind, t.walled ? 'walled' : null, t.capital || t.size === 'grand' ? 'capital' : null].filter(Boolean).map((x) => `<span class="tag">${esc(x)}</span>`).join('');
        const body = `<p>${tags}</p><p>${esc(townLore(t))}</p><p>Known for ${esc(I.famous)}. ${esc(I.landmark.name[0].toUpperCase() + I.landmark.name.slice(1))} stands in the square.${I.trade.deal ? ' ' + esc(DEAL_TEXT[I.trade.deal]) + '.' : ''}${t.tradeShop && TRADE_SHOP[t.tradeShop] ? ' ' + esc(TRADE_SHOP[t.tradeShop].name) + ' by the square sells ' + esc(Object.entries(ITEMS.consumables).concat(Object.entries(ITEMS.weapons), Object.entries(ITEMS.armor)).filter(([, it]) => it.trade === t.tradeShop).map(([, it]) => it.name.toLowerCase()).join(', ')) + '.' : ''}</p>` +
          `<p><b>Leader:</b> ${esc(I.leader)}. <b>Notable:</b> <a class="plain" href="${ACCOUNT.charactersUrl}#${slug(N.name + ' of ' + t.name)}">${esc(N.name)}</a>, ${esc(N.role)}.</p>` +
          (() => { const folk = townNpcs(t).filter((n) => n.type.folk); const hm = t.harbour ? harbourmasterNpc(t) : null; return `<p><b>Townsfolk:</b> ${esc(folk.map((n) => n.type.name).join(', ') || 'none to speak of')}.${hm ? ` <b>Harbour:</b> ${esc(hm.name)}.` : ''}</p>`; })() +
          `<p><b>Watch:</b> ${esc(guards.map((g) => g.type.name).join(', ') || 'none')}.${site ? ` <b>Nearby:</b> ${esc(site.name)}, ${esc(site.floors)} floors.` : ''} <span class="muted small">Position ${t.cx}, ${t.cy}.</span></p>`;
        total++;
        return card([I.landmark.sprite], t.name, `${REALMS[realm].short}`, body, `${t.name} ${REALMS[realm].name} ${I.kind} ${I.famous} ${I.landmark.name} ${I.leader} ${N.name} ${TIER_WORDS[townTier(t)]} ${townNpcs(t).filter((n) => n.type.folk).map((n) => n.type.name).join(' ')}`);
      });
      section(`${REALMS[realm].name} · ${REALMS[realm].gov}`, cards);
    }
  } else {
    const fixed = [
      ['King Aldric', 'King of Aurum', 'king', 'Castle Aurum, the Royal Hall', 'Young for a king and tired. Summons every sword in the realm when the Crown of Aurum shatters, and sends the hero after its five shards. Grants titles for gold, and pardons his brother at the end.'],
      ['Prince Edric', 'the Crownbreaker, pardoned', 'darkknight', "Castle Aurum, the Royal Hall (after the crown is whole)", "The King's exiled elder brother, who broke the crown out of spite and carelessness. He waits atop the Star Tower, yields when beaten, and in Act II sends the hero into the Deep in stages to mend what he woke."],
      ['Speaker Maren', 'Speaker of the Free Cantons', 'elder', "Hearth, the Council Hall", 'Leads the elected council of the Cantons. Takes donations for public works, raises civic standing, and offers the errand Wolves at the Door.'],
      ['Chieftain Ulrek Stonehand', "Chieftain of the Ka'thar Clans", 'guard', 'Kar Thuldun, the Great Longhouse', 'Chosen in battle. Swears outsiders into the clan over bread and salt, and sets the Trial of Three.'],
      ['Banker Vessa Orlov', 'of the Goldspire League', 'merchant', 'any League bank', "Keeps deposits that survive death, sells guild seats, and treats heroes as investments in A Matter of Accounts."],
      ['The clan shaman', 'speaks with the spirits', 'elder', "the Ka'thar longhouses and huts", 'Sells spirit blessings: wolf, bear and stag. Half price to the clan-sworn.'],
      ['The royal herald', "the King's voice", 'guard', "Kingdom towns", 'Grants the titles of Aurum for gold: Squire, Knight, Baron. One of them rides to Hearth with the summons that starts the story.'],
      ['A hooded stranger', 'met on the road', 'necromancer', 'the wilds', 'Sells maps of nearby places and knows more about the crown than they say.'],
      ['Sister Vey, the Hollow Nun', 'keeper of the Shard of Dawn', 'skeleton', 'the Sunken Chapel', 'What is left of the sisters who kept a lamp burning for three hundred years, until one night it went out.'],
      ['Morwen the Drowned', 'keeper of the Shard of Tides', 'spider', 'the Drowned Grotto', 'Nests in the deepest pool, where the water sings.'],
      ['The Barrow King', 'keeper of the Shard of Bones', 'wraith', 'the Barrow of Kings', "Wears the crowns of the dead kings of Aurum on their own throne."],
      ['Gorrak Emberjaw', 'keeper of the Shard of Embers', 'orc', 'the Ember Deeps', "Paid in the queen's own silver to hold the shard for the prince."],
      ['The Warden of the Deep', 'guardian of the lower halls', 'orc', 'the Deep, floor 10', 'Kept the lower halls closed for a thousand years.'],
      ['The Dreaming Maw', 'the mouth of the Deep', 'wraith', 'the Deep, floor 20', 'What the five lights were holding down. It dreams in the shapes of our guilt.'],
      ['Fenwick the merchant', 'shopkeeper', 'merchant', "Hearth, Fenwick's Goods", 'Finest steel this side of the dungeon. Buys and sells gear.'],
      ['Dottie the innkeeper', 'innkeeper', 'innkeeper', 'Hearth, the Sleeping Rat', 'A bed is a bed. Rents rooms, sells pets, and keeps your chest.'],
      ['Captain Orla', 'captain of the watch', 'guard', 'Hearth, the Watch House', 'Posts bounties on named beasts and asks for dungeons cleared.'],
      ['Old Mara', 'herbalist', 'elder', "Hearth, Mara's Cottage", 'Potions, ten gold. Cheaper than Fenwick and twice as fresh.'],
      ['Durn the smith', 'smith', 'guard', 'castle smithies', 'Blades and hammers, a tenth off. Sharpens what you carry.'],
      ['Ysolde the armourer', 'armourer', 'guard', 'castle armouries', 'Armor only, and cheaper than any merchant. Reinforces what you wear.'],
      ['Brother Cael', 'apothecary', 'elder', 'the Apothecary', 'Potions, elixirs and scrolls for the desperate.'],
      ['The Royal Quartermaster', 'keeper of the Royal Armoury', 'guard', 'Castle Aurum', "The finest steel in the realm, at the King's prices."],
      ['The Castellan', 'lord of a castle', 'guard', 'castle keeps', 'Holds the road, hands out site-clearing quests, and musters knights.'],
      ['Bram the mason', 'mason', 'farmer', "city cottages", 'Laid every stone of the plaza. Thinks wizards should live on the ground floor.'],
      ['Hilde', 'householder', 'villager', "town homes", 'Make yourself at home, but mind the chest.'],
      ['The arena master', 'of the Grand Arena', 'guard', 'Castle Aurum, the Grand Arena', 'Waves of foes, gold for every wave, and no charge for being dragged out.'],
    ];
    const cards = fixed.map(([name, role, spr, where, blurb]) => { total++; return card([spr], name, role, `<p><b>Found:</b> ${esc(where)}.</p><p>${esc(blurb)}</p>`, `${name} ${role} ${where} ${blurb}`); });
    section('The story and the realms', cards);
    const later = [
      ...FAR_REALMS.map((r) => { const Q = REALM_QUESTS[r]; return [Q.ruler, `ruler of ${REALMS[r].name}`, Q.sprite, `${townAt(...REALMS[r].capital).name}, the Far Shore (Story 2)`, `Holds one of the three keys to the Thousand-Step Barrow and gives it for ${Q.title}.`]; }),
      ['The Hollow King', 'master of the Thousand-Step Barrow', 'necromancer', 'the Thousand-Step Barrow, its sixth floor (Story 2)', 'A man once, before he gave up breathing as beneath him. Three generals locked him under the mountain a thousand years ago.'],
      ['Thrym, Jarl of the Frost Giants', 'warden of the Frozen Gate', 'troll', 'the Frozen Gate, on the ice of Thule (Story 3)', 'Holds the way to Midgard and the frozen heart that keeps it shut.'],
      ['The Rift Lord', 'herald of the hosts of Midgard', 'wraith', 'the last rift, at a burning town (Story 4)', 'Comes when enough rifts are closed, with a horde at his back and the town he chose already on fire.'],
      ['The town leaders', 'patrons of the rebuilding', 'elder', 'every town square (Story 5)', 'Take sponsorship for walls, buildings, roads and monuments, and name the founders who build the most.'],
      ['The master smith', 'keeper of the tale of Dawnbreaker', 'merchant', 'the trade shop of every smithing town', 'Tells a hero of level 12 the tale of the Sundered Blade, and reforges the sword from its three pieces.'],
      ...FORGE_ORDER.map((id) => { const L = LAIRS[id]; return [L.boss.name[0].toUpperCase() + L.boss.name.slice(1), `warden of ${L.piece}`, MONSTER_TYPES.find((m) => m.name === L.boss.type).sprite, L.title[0].toUpperCase() + L.title.slice(1), L.lore]; }),
      ...LAIR_IDS.map((id) => { const L = LAIRS[id], it = ITEMS.weapons[L.reward] || ITEMS.armor[L.reward]; return [L.boss.name[0].toUpperCase() + L.boss.name.slice(1), `super boss${it ? ', guards ' + it.name : ''}`, MONSTER_TYPES.find((m) => m.name === L.boss.type).sprite, L.title[0].toUpperCase() + L.title.slice(1), L.lore]; }),
    ];
    section('The later stories, the lairs and the blade', later.map(([name, role, spr, where, blurb]) => { total++; return card([spr], name, role, `<p><b>Found:</b> ${esc(where)}.</p><p>${esc(blurb)}</p>`, `${name} ${role} ${where} ${blurb}`); }));
    for (const [realm, list] of byRealm(towns, (t) => t.realm)) {
      const cards = [];
      for (const t of list.sort((a, b) => a.name.localeCompare(b.name))) {
        const I = townIdentity(t), N = t.notable, L = leaderNpc(t);
        total += 2;
        cards.push(card([N.sprite], `${N.name} of ${t.name}`, N.role, `<p><b>Found:</b> the square of <a class="plain" href="${townUrl(t)}">${esc(t.name)}</a>, ${esc(REALMS[realm].short)}.</p><ul class="lines">${N.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`, `${N.name} ${N.role} ${t.name} ${N.lines.join(' ')}`));
        for (const n of townNpcs(t).filter((x) => x.type.folk)) { total++; const F = n.type; cards.push(card([F.sprite], `${F.name} of ${t.name}`, F.role, `<p><b>Found:</b> the square of <a class="plain" href="${townUrl(t)}">${esc(t.name)}</a>.</p><ul class="lines">${F.lines.slice(0, 4).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`, `${F.name} ${F.role} ${t.name} ${F.lines.join(' ')}`)); }
        if (t.harbour) { const H = harbourmasterNpc(t); total++; cards.push(card([H.sprite], `${H.name} of ${t.name}`, 'harbourmaster', `<p><b>Found:</b> the end of the pier at <a class="plain" href="${townUrl(t)}">${esc(t.name)}</a>.</p><p>Sells passage to every port within four regions, treasure charts, and from Story 2 a ship of your own.</p>`, `${H.name} harbourmaster ${t.name}`)); }
        cards.push(card([L.sprite], L.name, `leader of ${t.name}`, `<p><b>Found:</b> the square of <a class="plain" href="${townUrl(t)}">${esc(t.name)}</a>.</p><p>${esc(L.lines[0])}</p><p>${esc(L.lines[1])}</p>`, `${L.name} leader ${t.name} ${I.trade.label}`));
      }
      section(`${REALMS[realm].name} · the towns' people`, cards);
    }
  }
  if (count) count.textContent = `${total} entries.`;
  const search = document.getElementById('glossary-search');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const el of root.querySelectorAll('.card')) { const hit = !q || el.dataset.search.includes(q); el.hidden = !hit; if (hit) shown++; }
    for (const h of root.querySelectorAll('h3.realm')) { const grid = h.nextElementSibling; h.hidden = grid && ![...grid.children].some((c) => !c.hidden); }
    if (count) count.textContent = q ? `${shown} of ${total} entries match.` : `${total} entries.`;
  });
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) { el.scrollIntoView(); el.style.outline = '2px solid #ffd86b'; } }
}
if (ACCOUNT.mode === 'glossary') renderGlossary(ACCOUNT.kind);
else { requestAnimationFrame(loop); init(); }
