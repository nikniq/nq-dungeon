# Dungeon Adventure

A small browser-based dungeon game, served by Laravel. The web root is `public_html/`
(point your web server's document root there).

Controls:
- Move / attack: Arrow keys, WASD or HJKL (or the on-screen D-pad)
- Wait a turn: Space or `.`
- Mouse: click to walk, attack or use; right-click uses your class ability, aimed at the clicked tile
- Restart: Click Restart or press `r`

Your hero looks the part. Armour repaints the body: leather, chain, scale, plate
with a helm, or dragonscale. The weapon is drawn in hand, unarmed rangers carry a
bow and mages a staff, and the Crown of Aurum sits on your head. A large portrait
sits beside the inventory, and in multiplayer other heroes see your gear too.

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
worn gear up to +3. New players get one-time tips. Press M for the world map, J for the journal,
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

## Combat

Every weapon has a trait:

| Weapon | Trait |
| --- | --- |
| Dagger | Quick: sneak attacks deal triple damage, and one stab in five strikes twice |
| Short sword | Keen: one hit in five is a critical for double damage |
| Mace | Stunning: one hit in four stuns the target for a turn |
| Longsword | Parrying: parries one melee blow in five |
| Warhammer | Crushing: knocks foes back a tile, or slams them into a wall for +3 |
| Royal greatsword | Cleaving: also hits every other foe beside you for half damage |

Hitting a sleeping monster is a sneak attack for double damage. Bosses wind up heavy
blows that land on the red tiles around them a turn later; at half health they
enrage, hit harder and call two minions. About a third of dungeon floors have a
twist: Dark, Swarming, Treasure or Cursed. Hovering over a monster shows how hard it
hits you and how many blows it will take. Shops mark gear that beats what you wear
and offer Buy & equip. Press ? for the controls screen.

New heroes see a short illustrated history of the world before the King's summons.
It can be skipped with Esc and reread from the Journal's World page.

## Story, realms and treasures

The game is built mainly for one player. **The Shattered Crown** is the main story.
A herald's prologue sends you to King Aldric at Castle Aurum. He sends you after five
crown shards, one at a time, each in a sealed story dungeon with its own theme and a
named boss: the Sunken Chapel, Drowned Grotto, Barrow of Kings, Ember Deeps and Star Tower.
A gold ★ on the HUD, compass and world map always points at the current objective.
Each shard comes with a relic, and the finale grants the Crown of Aurum.

Relics go in a separate slot and have unique effects. They are listed in
`config/items.php` under `relics` and cannot be sold. Dungeon floors have themes:
stone, moss, flooded, bone, lava and arcane. Lava burns, and monsters avoid it.

The land is split by nearest capital into four realms, each with its own government,
town names, paving, roofs and border colours on the world map:

| Realm | Government | Capital | Gold sink |
| --- | --- | --- | --- |
| Free Cantons of Hearth | Democracy | Hearth | Donations at the Council or Town Hall build civic standing: Citizen (half-price waystones), Alderman (10% off), Hero of the Cantons. Shops are 10% cheaper. |
| Kingdom of Aurum | Monarchy | Castle Aurum | Titles from the King or a royal herald: Squire (+5 HP), Knight (+1 DEF), Baron (+1 ATK). |
| Ka'thar Clans | Tribal | Kar Thuldun | Spirit blessings from shamans. The chieftain's blood oath gives +6 HP and halves the shamans' prices. |
| Goldspire League | Oligarchy | Goldspire | The Exchange: a bank whose deposits survive death (5% fee), and a 1000g guild seat for 15% off everywhere. Shops charge 15% more but pay 60% on sales. |

Every dungeon has a recommended level, from its danger and the strongest monster
on its first floor (`recLevel` in `script.js`). Labels, tooltips and the world map
rate it Easy, Fair, Hard, Very hard or Deadly for your level. Entering a Very hard
or Deadly dungeon needs a second step. Every floor also has a golden way-out door
in the arrival room: walk into it twice to leave early, keeping your loot but
skipping the hoard.

Landmarks in the wilds are discovered by walking near them. Standing stones heal you and
reveal another place. Shrines give a blessing. Ruins and battlefields can be searched
once. Hermits tell tales and sell maps. Wells take a coin for a random boon. Press J for
the Journal, which has Story, Places, Treasures and Bestiary pages. Realm progress is kept
in `characters.meta.realm`, and the server validates it.

## Multiplayer

Logged-in heroes see each other live in the open world, inside buildings and in
shared dungeons. Walk into another hero to invite them to a party (up to four) or
wave; press Enter to chat with heroes nearby. Party members who take the same
gate or site entrance share the run: every client digs the same floor from a
seed the server hands out, the hero who has been inside longest runs the
monsters and posts a snapshot, others send their blows to that host and receive
the monsters' attacks, kills go to whoever landed the blow, and stairs move the
whole party. The relay is `MultiplayerController` over HTTP polling (every 0.4s
in a shared dungeon, 0.65s with heroes nearby, 1.5s alone, 4s idle, 15s in a
background tab), so it runs on shared hosting. Turn it off with
`MULTIPLAYER_ENABLED=false` in `.env` (then `php artisan optimize`): the game
becomes single-player only and the relay endpoints return 404.

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
