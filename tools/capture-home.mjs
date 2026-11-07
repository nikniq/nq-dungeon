// Regenerates the landing page art in public_html/images/home from the game itself.
//
//   php artisan serve --port=8899 &
//   PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node tools/capture-home.mjs
//
// Scenes are drawn by the live game with the HUD switched off and saved as WebP;
// sprites and class portraits are rendered from the game's own pixel data as PNG.
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/terence/repo/as-website1-laravel/node_modules/playwright/index.mjs');
const OUT = new URL('../public_html/images/home/', import.meta.url).pathname, BASE = process.env.BASE || 'http://127.0.0.1:8899';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 820, height: 760 } });
const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
await pg.goto(`${BASE}/play`); await pg.waitForTimeout(1500);
try { await pg.waitForFunction(() => !!player, null, { timeout: 8000 }); } catch { await pg.evaluate(() => startRun(null)); }
await pg.evaluate(() => chooseClass('warrior')); await pg.waitForTimeout(2300);
const write = (name, data) => fs.writeFileSync(OUT + name, Buffer.from(data.split(',')[1], 'base64'));
// the opening story scene, with the HUD, as a new player sees it
{
  const clip = await pg.evaluate(() => { const r = document.querySelector('.story-box').getBoundingClientRect(), s = stageEl.getBoundingClientRect(), pad = 40, x = Math.max(s.left, r.left - pad), y = Math.max(s.top, r.top - 14); return { x, y, width: Math.min(s.right, r.right + pad) - x, height: Math.min(s.bottom, r.bottom + pad) - y }; });
  const png = await pg.screenshot({ clip });
  write('story.webp', await pg.evaluate(async (src) => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/webp', 0.88); }, 'data:image/png;base64,' + png.toString('base64')));
}
await pg.evaluate(() => { for (let i = 0; i < 6 && storyOpen(); i++) skipScene(); tip = () => {}; toast = null; settings.autoPerks = true; partySpawnClock = performance.now() + 1e9; drawHud = () => {}; });
const scene = async (name, crop, q = 0.86, type = 'webp') => write(`${name}.${type}`, await pg.evaluate(([crop, q, type]) => {
  draw(); const [x, y, w, h] = crop || [0, 0, canvas.width, canvas.height];
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return c.toDataURL(`image/${type}`, q);
}, [crop, q, type]));
const settle = async () => { await pg.evaluate(() => { updateCamera(); bgDirty = true; }); await pg.waitForTimeout(600); };
// a dungeon room with a fight on: explore a seeded floor until two monsters are close and one is awake
const dungeon = async (seed, fl) => {
  await pg.evaluate(([seed, fl]) => {
    const t = townAt(0, 0); player.gold = 5000; turn = 20; travelTo(t); for (let k = 0; k < 6 && storyOpen(); k++) skipScene();
    player.maxHp = 400; player.hp = 400; player.level = 6;
    dungeonDef = { ...townDungeon(t), seed }; floor = fl; enterDungeon('t:' + t.key); for (let k = 0; k < 6 && storyOpen(); k++) skipScene();
    const near = () => monsters.filter((m) => isVisible(m.x, m.y) && Math.abs(m.x - player.x) + Math.abs(m.y - player.y) <= 5);
    for (let k = 0; k < 500; k++) { if (!explore.on) startExplore(false); exploreTick(); const v = near(); if (v.length >= 2 && v.some((m) => m.awake)) break; }
    explore.on = false; if (explore.timer) clearTimeout(explore.timer);
  }, [seed, fl]); await settle();
};
await dungeon(8, 2); await scene('dungeon', [30, 96, 700, 400], 0.9); await pg.evaluate(() => leaveDungeon());
await dungeon(23, 4); await scene('deep'); await pg.evaluate(() => leaveDungeon());
// towns: Hearth by day and night, Castle Aurum, and the port of Quilfield seen from the pier
const town = async (i, j, t0) => { await pg.evaluate(([i, j, t0]) => { const t = townAt(i, j); player.gold = 5000; travelTo(t); turn = t0; for (let k = 0; k < 6 && storyOpen(); k++) skipScene(); if (t.harbour) { player.x = t.harbour.x - t.harbour.dx * 2; player.y = t.harbour.y - t.harbour.dy * 2; player.wx = player.x; player.wy = player.y; refreshTownContext(); afterSceneChange(); } }, [i, j, t0]); await settle(); };
await town(0, 0, 20); await scene('town');
await town(0, 0, 260); await scene('night', null, 0.8);
await town(3, -1, 20); await scene('castle');
await town(1, 0, 20); await scene('port'); await scene('og', [0, 80, 788, 414], 1, 'png');
// sprites at 8x, and the three classes as the inventory draws their portraits
const sprites = await pg.evaluate(() => {
  const out = {};
  for (const name of ['rat', 'goblin', 'spider', 'bat', 'skeleton', 'archer', 'orc', 'slime', 'wraith', 'mimic', 'necromancer', 'troll', 'darkknight', 'basilisk', 'wyrm', 'kraken', 'chest', 'gold', 'potion', 'stairs', 'ship', 'king']) {
    const img = sprite(name), c = document.createElement('canvas'); c.width = c.height = img.width * 8; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height); out[name] = c.toDataURL('image/png');
  }
  const pc = document.getElementById('hero-portrait'), w0 = pc.width, keep = { cls: player.cls, weapon: player.weapon, armor: player.armor };
  pc.width = pc.height = 224;
  for (const [cls, weapon, armor] of [['warrior', 'longsword', 'chain'], ['ranger', 'bow', 'leather'], ['mage', 'staff', 'robe']]) {
    player.cls = cls; player.weapon = ITEMS.weapons[weapon] ? weapon : null; player.armor = ITEMS.armor[armor] ? armor : null;
    drawHeroPortrait(); out['hero-' + cls] = pc.toDataURL('image/png');
  }
  Object.assign(player, keep); pc.width = pc.height = w0; drawHeroPortrait();
  return out;
});
for (const [name, data] of Object.entries(sprites)) write(`${name}.png`, data);
console.log(`wrote ${fs.readdirSync(OUT).length} files to ${OUT}`, errors.length ? errors : '');
await b.close();
