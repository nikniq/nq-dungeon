// Records the looping gameplay clip on the front page: public_html/images/home/play.webm (+ play.mp4 via ffmpeg).
//
//   php artisan serve --port=8899 &
//   node tools/capture-clip.mjs
//   cd public_html/images/home
//   ffmpeg -y -i play.webm -an -c:v libx264 -pix_fmt yuv420p -crf 27 -preset slow -movflags +faststart play.mp4
//   ffmpeg -y -ss 1.2 -i play.webm -frames:v 1 -q:v 4 play-poster.jpg
//
// A warrior on a seeded floor of the Hearth dungeon plays in real time: auto-explore
// walks, and whenever it stops for a foe the script fights like a player would.
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/terence/repo/as-website1-laravel/node_modules/playwright/index.mjs');
const OUT = new URL('../public_html/images/home/', import.meta.url).pathname, BASE = process.env.BASE || 'http://127.0.0.1:8899';
const SEED = +(process.env.SEED || 8), FLOOR = +(process.env.FLOOR || 2), SECONDS = +(process.env.SECONDS || 14);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 700, height: 640 } });
const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
await pg.goto(`${BASE}/play?class=warrior`); await pg.waitForTimeout(1500);
try { await pg.waitForFunction(() => !!player, null, { timeout: 8000 }); } catch { await pg.evaluate(() => startRun(null)); }
await pg.waitForTimeout(2300);
await pg.evaluate(([seed, fl]) => {
  for (let i = 0; i < 6 && storyOpen(); i++) skipScene(); tip = () => {}; toast = null; settings.autoPerks = true; partySpawnClock = performance.now() + 1e9;
  const t = townAt(0, 0); player.maxHp = 60; player.hp = 60; player.level = 4; player.atk = 6;
  dungeonDef = { ...townDungeon(t), seed }; floor = fl; enterDungeon('t:' + t.key); for (let k = 0; k < 6 && storyOpen(); k++) skipScene();
}, [SEED, FLOOR]);
await pg.waitForTimeout(800);
const data = await pg.evaluate(async (seconds) => {
  const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 900000 }), chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data); rec.start();
  const end = performance.now() + seconds * 1000, nap = (ms) => new Promise((r) => setTimeout(r, ms));
  while (performance.now() < end) {
    for (let k = 0; k < 4 && storyOpen(); k++) skipScene();
    const foe = monsters.filter((m) => isVisible(m.x, m.y)).sort((a, c) => cheb(a, player) - cheb(c, player))[0];
    if (foe) {
      explore.on = false; if (explore.timer) clearTimeout(explore.timer);
      // one step down the shortest way to the foe; the last step is the blow
      const d = bfs(foe.x, foe.y, 40), here = d.get(key(player.x, player.y)) ?? 99;
      const [dx, dy] = DIRS.filter(([dx, dy]) => (d.get(key(player.x + dx, player.y + dy)) ?? 99) < here)[0] || [Math.sign(foe.x - player.x), 0];
      tryMove(dx, dy); await nap(210);
    } else { if (!explore.on) startExplore(false); await nap(150); }
  }
  rec.stop(); await new Promise((r) => { rec.onstop = r; });
  const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer(); let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
  return { b64: btoa(s), size: [canvas.width, canvas.height], kills: player.lifetimeKills, gold: player.gold, hp: player.hp };
}, SECONDS);
fs.writeFileSync(OUT + 'play.webm', Buffer.from(data.b64, 'base64'));
console.log(JSON.stringify({ bytes: fs.statSync(OUT + 'play.webm').size, size: data.size, kills: data.kills, gold: data.gold, hp: data.hp, errors }));
await b.close();
