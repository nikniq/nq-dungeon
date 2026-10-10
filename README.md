# Dungeon Adventure

A small browser-based dungeon game, served by Laravel. The web root is `public_html/`
(point your web server's document root there).

Controls:
- Move / attack: Arrow keys, WASD or HJKL (or the on-screen D-pad)
- Wait a turn: Space or `.`
- Restart: Click Restart or press `r`

You start in Hearth on an endless seeded overworld (`WORLD_SEED` in `script.js`).
Settlements sit roughly every 96 tiles (some cells are empty), placed on the best
land nearby and joined by roads: villages, towns, cities, walled castles, and one
grand castle, Castle Aurum, where King Aldric holds court and the Royal Armoury
sells the realm's best gear. Cities and some towns have a specialist shop: smithy,
armoury or apothecary. Out in the country stand caves, crypts, warrens and towers,
short themed dungeons with their own monsters, a danger rating that grows with
distance from Hearth, and a hoard at the bottom. Press M for the world map. Your
position and home town are saved; a dive returns you where you went in. Clear all 5 floors to return to town with your level, gold and gear.
Death sends you back to town as a fresh hero.

In the dungeon: each floor is endless, generated chunk by chunk as you explore,
and the camera keeps you centred. Follow the compass in the corner to the stairs. Monsters sleep until they
notice you and then chase. Kill them for XP to level up, grab gold and potions.
Each floor has a merchant (`$`) who buys and sells weapons, armor and potions;
the item catalog lives in `config/items.php`. Hover or tap anything on the map
to see what it is. Create a hero to save runs and gear between visits.

## Co-op

Logged-in players can form a party of up to four (create a code, friends join with
it). When anyone in a party takes the gate, the party shares one server-run floor:
every move is resolved in `app/Game/Dungeon.php`, monsters act on a 600ms tick,
and clients poll `/api/party/state` every 350ms. Stairs move everyone down together;
clearing floor five sends the whole party home. The HTTP polling transport can be
swapped for Pusher or Reverb later without touching the rules.

## Setup

Requires PHP 8.2 or newer (Laravel 12). Sessions and cache use the file driver, so no database is needed.

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
# open http://localhost:8000
```

Pages: `/` landing page with leaderboard, `/play` the game, `/heroes` directory,
`/heroes/{name}` public profile, `/character` your own profile editor.

Game assets live in `public_html/js/script.js` and `public_html/css/style.css`;
the game page is `resources/views/game.blade.php`, routed at `/play` in `routes/web.php`.
# nq-dungeon
