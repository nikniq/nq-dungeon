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
distance from Hearth, and a hoard at the bottom. Choose a class: Warrior (Shield Wall), Ranger (Arrow, spots traps) or Mage
(Fireball); press 1 for the ability. Chests hold gold, spike traps hide in
corridors, spiders poison (potions cure), archers shoot from range, bats flit.
Falling in battle costs half your gold and your potions, never level or gear.
Hire a hound at any inn: it follows, bites, levels up and is patched up free at
inns. Every town has a waystone for paid fast travel to towns you have visited.
Bombs (B) blast a 3×3 area; a scroll of return (T) whisks you home. Elite
monsters (starred: armored, swift, vampiric, explosive) hit harder and pay more.
Gamepads work. Every level up offers a choice of three perks. Achievements grant titles shown
on profiles and the leaderboard. Smithies and armouries sharpen and reinforce
worn gear up to +3. New players get one-time tips. Press M for the world map,
Q for the quest log (with achievements and perks), N to toggle sound. Captains,
castellans and the King hand out site-clearing quests; townsfolk ask for monster
tallies. A boss seals the stairs on the last floor of every dungeon. Beasts roam
the wilds and grow bolder at night (a day is 480 turns). Your position, home town
and quests are saved; a dive returns you where you went in. Clear all 5 floors to return to town with your level, gold and gear.
Death sends you back to town as a fresh hero.

In the dungeon: each floor is endless, generated chunk by chunk as you explore,
and the camera keeps you centred. Follow the compass in the corner to the stairs. Monsters sleep until they
notice you and then chase. Kill them for XP to level up, grab gold and potions.
Each floor has a merchant (`$`) who buys and sells weapons, armor and potions;
the item catalog lives in `config/items.php`. Hover or tap anything on the map
to see what it is. Create a hero to save runs and gear between visits.

## Sign in with Google

Optional. Create an OAuth client (Web application) in the Google Cloud console
with the authorised redirect URI `https://<your-domain>/auth/google/callback`,
then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` in
`.env` and run `php artisan optimize`. The button stays hidden until both the ID
and secret are set. New Google users get a hero automatically; an existing
account is linked only when Google reports the email as verified.

## Analytics

Set `GOOGLE_ANALYTICS_ID` (a GA4 measurement ID like `G-XXXXXXXXXX`) in `.env` to
load the Google tag on every page; leave it blank for no tracking. Besides page
views it sends `sign_up`, `login`, `select_class`, `dungeon_enter`,
`floor_reached`, `dungeon_cleared`, `boss_killed`, `level_up`, `hero_died`,
`quest_complete`, `unlock_achievement` and `waystone_travel`, each tagged with
the hero's class and level.

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
