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

The world is four continents on an open sea, one per realm and centred on its
capital (`CONTINENTS`, elliptical with a ragged noise coast), joined by narrow land
bridges (`BRIDGES`: the Cantons to each neighbour, and the Clans to the League)
that each carry a king's road between capitals, with small islands beyond. The
Deep gate sits on the Cantons–Kingdom bridge; story sites are anchored to land.
Towns, dungeons, places and camps only generate on land, and roads never cross
the sea. Any town near the sea is a port with a pier, a moored ship and a
harbourmaster who sells passage to every other port within four regions, even
ones not yet visited (`harbourOf`, `sailTo`). Harbourmasters also sell a ship
of the hero's own (`SHIP_COST`, a quarter off in shipping towns): walk into it
at its mooring beside the pier to go aboard, sail the open sea two tiles a
step with the arrow keys or a click, and steer onto any shore or island to
land. The ship waits where it was left (`meta.ship`, shown on the map) and any
harbourmaster can fetch it for a small fee. A hero saved at sea wakes aboard;
one whose saved spot on land is now sea wakes in their home town.

The sea has its own encounters (`SEA_EVENTS`): a pirate sloop to pay, fight or
outrun, a sea serpent, a drifting wreck to loot and a castaway to rescue, each
settled in a scene with the hero's attack and armour deciding the toll
(`seaFight`). Harbourmasters also sell treasure charts (`CHART_COST`, three at
a time) that put a red ✕ on an island or lonely shore within sailing reach
(`chartSpot`, kept in `meta.charts`); stepping onto the spot digs up a sea-chest
of gold, the Stormcaller Pearl relic the first time (three tiles a step at sea,
serpents shy away) and gear after that (`meta.treasures` counts them). Pirates,
wrecks and castaways sometimes hand over a chart too. Waiting at sea with a rod
fishes the deep water, where the catch is better. A fight lost at sea does not
kill: the hero washes up on the nearest shore with a quarter of their health
(`washAshore`), the ship grounded beside them, the pets ashore, pirates having
taken a cut of the gold, and a message saying what happened.

You start in Hearth on an endless seeded overworld (`WORLD_SEED` in `script.js`).
Settlements sit roughly every 96 tiles (some cells are empty), placed on the best
land nearby and joined by roads: villages, towns, cities, walled castles, and one
grand castle, Castle Aurum, where King Aldric holds court and the Royal Armoury
sells the realm's best gear. Cities and some towns have a specialist shop: smithy,
armoury or apothecary. Out in the country stand caves, crypts, warrens and towers,
short themed dungeons with their own monsters, a danger rating that grows with
distance from Hearth, and a hoard at the bottom. Choose a class. Each has three abilities on keys 1, 2 and 3, the second from
level 5 and the third from level 10 (`ABILITIES`): Warrior has Shield Wall,
Whirlwind (hit every adjacent foe) and War Cry (stun all within 2 tiles, +2 attack
for 5 turns); Ranger has Arrow, Volley (the three nearest foes in sight) and Evade
(slip a tile away and dodge the next three blows); Mage has Fireball, Frost Nova
(freeze all within 2 tiles) and Blink (teleport up to 5 tiles). Right-click aims
the first, Shift+right-click the second, Alt+right-click the third. Abilities cost mana (blue bar under health), which grows with level, refills a point a turn, and comes back at inns, camps, springs and from mana potions. Chests hold gold, spike traps hide in
corridors, spiders poison (potions cure), archers shoot from range, bats flit.
Falling in battle costs half your gold and your potions, never level or gear.
Pets: every inn sells companions and each realm keeps its own (`INN_PETS`):
hounds and cats in the Cantons, hounds and hawks in Aurum, wolves, boars and
bears among the Clans, cats and hawks in the League and the Empire, mongooses
and elephants in Suryadesh, huskies and bears in Severin. They come in three
sizes (`PET_KINDS`); a hero keeps up to three (`PET_MAX`). Pets follow at heel,
bite whatever comes close (the small quick ones get a second move, hawks fly
over traps), grow with kills, limp home when badly hurt and are patched up free
at any inn. When the hero boards a ship they scramble aboard and ride on deck,
and land again when the ship touches shore. They are saved in `meta.pets`
(a legacy `meta.hound` is converted on load).

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

From the second floor down, rooms may hold floor events (`placeFloorEvents`): a
chained captive who follows you once freed and pays a reward if led alive to the
stairs or the way-out door (monsters go for them too); a goblin totem that calls a
goblin every six turns until smashed; a lever that sinks every trap on the floor;
and a dungeon altar with an offering, a drink from the font, or nothing.

Some rooms from the second floor down hold a ring of trial stones (`TILE.TRIAL`,
`TRIALS`): walk in and take up the Trial of the Swarm (stand twelve turns while a
monster arrives every other turn) or the Trial of Blood (five at once, all dead
within twenty turns). The location line counts the turns down. Pass and the stones
pay gold, XP and a sure magic item; fail, or stray more than twelve tiles, and they
go dark. Trials passed count toward the Proven and Unbroken titles
(`meta.trials`).

Deeper dungeons hold slimes that split in two, necromancers that keep their
distance and raise skeletons, and mimics posing as chests from floor 2. About
three chunks in ten hide a secret vault behind a cracked wall: three blows break
it (one with a warhammer or a bomb), and the noise wakes nearby monsters. Some
rooms have a healing spring that restores full health once.

Walking the wilds brings roadside encounters with choices: a merchant caravan
with rare stock, bandits demanding a toll, a wounded knight, a gambler, a
wayside altar, an injured wolf that may join you, a hooded stranger, a bard and
an abandoned camp, plus ambushes at night. Number keys or the arrow keys and Enter pick a choice; Esc takes
the last one, which is always the way out.

Any inn rents a room for good (250 gold). It opens a storage chest of 20 items
at every inn, kept in `characters.meta.stash` and safe when you fall.

Between shards, a rider finds the hero on the road with news, a hint and a gift
(`CHAPTER_RIDERS`); townsfolk trade rumours that change with the story
(`storyRumour`); Ser Halvard, captain of Edric's grey cloaks, leads the road
ambush, holds the third floor of the Star Tower and later stands in the King's
hall; and once the crown is whole every square hangs bunting. Story scenes have
painted backdrops (`drawSceneBackdrop`: hall, town, road, crypt, grotto, lava,
tower, wilds, deep, arena, map). The overworld has crop rows, vineyards, meadows
and pastures around the towns that live off the land (`fieldAt`), wheel-rutted
roads with green verges, crags with snow on the high peaks, and bushes and tufts
in the grass.

Six super-boss lairs (`LAIRS`) lie hidden in the far corners of the world: the
Spider Queen's Hollow, the Wyrm's Roost, the Drowned King's Hall, Old Grumm's
Bridge, the Lich's Observatory and the Direwolf's Den. They stay off the map
until a bard's tale, a hermit's map (120 gold), a prophet in a square, or your own
feet within four tiles reveal them. Each is a two-floor dungeon rated Deadly until
level 17 to 29, with a super boss on the second floor that has nine or ten times
a boss's health and enrages twice, calling minions each time. The first kill drops
a one-of-a-kind legendary (Fangblade, Wyrmscale plate, Tidecaller, Trollhide
coat, Staff of Ages, Stormhammer), each borrowing a common weapon's trait.
Progress is kept in `meta.lairs`.

Act II, What Sleeps Below, follows the crown: the pardoned Prince Edric sits in
the King's hall and sends the hero into the Deep in stages (floors 5, 10, 15, 20),
with the Warden of the Deep on floor 10 and the Dreaming Maw on floor 20 as named
guardians, reports back to Edric between stages, and an ending that grants the
Heart of the Deep (+3 attack, +3 defence, +15 HP, +2 sight) and the title
Deepwarden. Progress lives in `meta.act2`.

The Deep is the endgame. Once the Crown is restored, the Gate of the Deep
between Hearth and Castle Aurum opens on endless floors up to 99. Danger rises
every two floors and a boss guards every fifth. The record is saved as
`meta.deepest` and shown on the hero's public profile.

Each realm's leader has a three-step questline with a unique treasure at the end:

| Leader | Questline | Reward |
| --- | --- | --- |
| Speaker Maren (Hearth) | Wolves at the Door | Badge of the Free Cantons: +20% XP |
| King Aldric | The King's Justice | Royal Signet: potions heal double |
| Chieftain Ulrek (Kar Thuldun) | The Trial of Three | Bloodfury Torc: +3 attack at half health |
| Banker Vessa Orlov (League towns) | A Matter of Accounts | Vessa's Ledger: +25% gold, 70% when selling |

Progress is kept in `meta.rq` and shown in the quest log (Q).

The inns of cities and castles sell a horse (400 gold): in the open wilds each
step covers two tiles, and you dismount in towns, underground or when monsters
close in. Clicking the world map drops a pin that the compass follows until you
reach it.

Castle Aurum's Grand Arena runs waves of foes on an open floor with four pillars.
Each wave pays more gold, every fifth brings a named champion, and you can leave by
the golden door between waves. Falling there costs nothing. The best wave is saved
as `meta.arena`; wave 10 earns Champion of Aurum.

Every town also has a history read from its own name, syllable by syllable
(`NAME_LORE`), and one notable local in the square (`NOTABLES`: an old soldier,
a widow with a lamp in the window, the child who saw the lights fall, a deserter
in a grey cloak and more) whose three-line story weaves in the town's name,
trade, landmark, nearest dungeon and the main story. The Journal's Towns page
keeps the history of every town visited.

Every town has its own identity, read from its cell of the world: a trade chosen
from the land around it (fishing, quarrying, timber, wine, horse-breeding and so on,
some with local price breaks), a landmark in its square, and a named local leader
who talks about the town and points to nearby dungeons and places. Arriving shows
a description, and towns near each other never share a name.

Watch captains and castellans post a bounty for each town: a named beast prowling
the wilds nearby, marked with a skull on the map and in the world. Fishing towns
sell rods (30 gold); walking into water with one casts a line for fish, the odd
golden carp, or a bottle with a map. Inns cook fish into stew. Pressing C in the
open wilds makes camp: full health and any fish cooked, at the cost of a long rest,
and at night something may find you.

Heroes can build for each other. Every town square has three plots; at any inn a
signed-in hero pays 300 gold to build a monument there (Hero's Fountain, Shrine of
Valour, Adventurers' Cache or Signal Beacon), and any hero can pay 600 and then
1200 to upgrade it to levels 2 and 3. Monuments are stored on the server
(`town_buildings`, `TownBuildingController`), carry their builder's name, and can
be used by every hero once every 20 minutes. The server checks and deducts the gold.

The game has generative background music made with WebAudio, with a mood for towns,
night, the wilds, dungeons, the Deep and the arena. O opens Settings: music and
effects volume, screen shake, and floating numbers, kept in localStorage. The
Journal's Guide page suggests next steps based on where the hero is and what
they have.

Orc warcamps dot the wilds, too strong for one hero. Armies open at level 50 (`ARMY_LEVEL` in `script.js`). From then, at a realm's seat (the King
or a royal herald, a council or town hall, the clan longhouse, a League bank)
heroes recruit soldiers for that realm's army, each realm with its own cost and
strength, and send it to march on a camp. Armies walk the map in real time under
their realm's banner, shown on the world map with a dashed route, and fight on
arrival. Victory razes the camp for good and pays the hero a share of the spoils.
The realms also send armies of their own from towns near the hero. State is kept
in `meta.war`.

Buildings are drawn in their realm's style: timber-framed plaster in the Cantons,
stone in the Kingdom, logs and thatch in the Clans, marble in the League. Keeps,
watch houses and the arena have battlements, halls and banks have classical fronts,
shops have awnings, smithies a forge glow, and chimneys smoke. Windows glow at night.
Grass and pasture are value noise sampled per quarter tile and mixed continuously
(`drawGrass`), so meadows have soft patches and sun-dried stretches rather than
blocks; forest trees vary in size, lean and facing; and by day the shadows of a
few clouds drift over the land, fixed to the world and pushed by the wind
(`drawCloudShadows`), with small flocks of birds crossing the sky (`drawBirds`).
Coastlines melt rather than step: grass laps over sand and a sandy shelf runs
under the shallows in scalloped fringes with rounded corners (`edgeFringe`). The
town fountain is a round stone basin with a spout, ripples and falling drops,
and the waystone a carved standing stone whose runes breathe with light
(`drawWaystone`, `drawWaystoneGlows`). The HUD is a bevelled panel with a gold rim
and glossy bars. Mountain ranges have a rounded foot of boulders, peaks with lit
and shaded faces, and snow deep inside a range or in the north (`drawMountain`);
forests mix oaks with pines, and in the north only snow-laden pines stand.

Castle Aurum is half again the size of any other town (`GRAND_W`×`GRAND_H`, via
`tw()`/`th()`), with two rings of wall: an outer bailey of market, cottages and
shops, and an inner ring round the throne hall, royal apartments, arena and
smithy. Its ramparts are gold-trimmed. Three secret stones (`GRAND_SECRETS`)
open when the hero walks into them: a walled-up treasury in the outer wall with
a chest of royal gold and old gear, and the Queen's postern, a hidden door in
each ring on the east side that leads straight out into the fields. Secret
stones show a hairline crack and a tuft of moss; the castle's lore hints at them.
Found secrets are kept in `meta.secrets`.

Every town keeps a watch that patrols the square and the gate and sallies out
after anything near the walls: a scruffy militiaman in ramshackle towns, guards
in realm colours in thriving ones, knights in castles and at Castle Aurum (see
`guardPlan`). Guards fight beasts that follow you to the gates, fall and return
later if overwhelmed, carry lanterns at night, give directions and quests, and
never hunt bounty beasts for you.

New heroes see a short illustrated history of the world before the King's summons.
It can be skipped with Esc and reread from the Journal's World page.

## Story, realms and treasures

The game is built mainly for one player. **The Shattered Crown** is the main story.
A herald's prologue sends you to King Aldric at Castle Aurum. He sends you after five
crown shards, one at a time, each in a sealed story dungeon with its own theme and a
named boss: the Sunken Chapel, Drowned Grotto, Barrow of Kings, Ember Deeps and Star Tower.
A gold ★ on the HUD, compass and world map always points at the current objective.
Each shard comes with a relic and a clue: a torn letter signed "E.", a stag
signet, a carving, a purse of royal silver. They point to Prince Edric, the King's
exiled elder brother, who broke the crown. His agents ambush you on the road to
the Ember Deeps, and he waits atop the Star Tower. Beaten, he yields, and the finale
reunites the brothers before the crown is restored.

Relics go in a separate slot and have unique effects. They are listed in
`config/items.php` under `relics` and cannot be sold. Dungeon floors have themes:
stone, moss, flooded, bone, lava and arcane. Lava burns, and monsters avoid it.

The land is split by nearest capital into four realms, each with its own government,
town names, paving, roofs and border colours on the world map:

| Realm | Government | Capital | Gold sink |
| --- | --- | --- | --- |
| Free Cantons of Hearth | Democracy | Hearth | Donations at the Council or Town Hall build civic standing: Citizen (half-price waystones), Alderman (10% off), Hero of the Cantons. Shops are 10% cheaper. |
| Kingdom of Aurum | Monarchy | Castle Aurum | Titles from the King or a royal herald: Squire (+5 HP), Knight (+1 DEF), Baron (+1 ATK). |
| Ka'thar Clans | Tribal | Kar Thuldun | Spirit blessings from shamans. The chieftain's clan oath, sworn over bread and salt, gives +6 HP and halves the shamans' prices. |
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

## The stories and the Far Shore

The narrative is told in stories (`STORIES` in `script.js`, `config/story.php`
for the public page). Story 1, The Shattered Crown, is Act I (the five shards)
and Act II (What Sleeps Below). Story 2, The Far Shore, opens once Story 1 is
finished (`story1Done`): the next time the hero stands in a town an envoy
arrives (`STORY2_INTRO`), `meta.story2.s` becomes 1, every harbourmaster sells
passage across the Veil (`farPort`/`homePort`), and a hero's own ship may cross
it. Before that the Veil, a storm wall at `VEIL_X`, turns ships back.

Beyond it lies one wide continent (the fifth entry of `CONTINENTS`, with its
own radii) shared by three far realms (`FAR_REALMS`; `ALL_REALMS` is all seven):
the Celestial Empire of Tianxia (Empress Liang Wu, Jinling), the Rajadom of
Suryadesh (Maharani Devika Suryavansha, Suryapur) and the Tsardom of Severin
(Tsar Fyodor the Patient, Vysokograd). Each has its own town names and name
lore, statues, landmarks, leader and notable names, trades (rice, tea,
porcelain, spices, cotton, furs), paving, roof colours, guard titles, names and
colours, army (banner soldiers, elephant lancers, streltsy), seat buildings
with a ruler and a deputy (yamen/magistracy, durbar/kacheri, terem/prikaz),
a realm perk at the seat (the imperial examination, the pilgrimage of nine
gates, the boyar council: +250 standing and a title) and a questline
(`REALM_QUESTS`) ending in a relic: the Seal of the Jade Throne (travel and
passage at half price), the Lotus of the Sun (+2 defence by day) and the Bear
Charm of Severin (+3 attack by night). Buildings are drawn in each culture's
style: lacquered posts and upturned pagoda eaves with lanterns, sandstone with
flat terraces, chhatris and domes, log walls with painted plank roofs and onion
domes. The far realms' people are their own: folk, leaders, notables, harbourmasters
and rulers wear realm-coloured clothes and a straw hat, turban or fur hat
(`FAR_DRESS` recolours the base sprites into `villager:tianxia` and so on), and
have their own lines (`FAR_FOLK`, `FAR_NOTABLES`). Story 2 has its own plot: the
Veil was raised by three generals to wall in the Hollow King, who stole the
breath of a continent; the three realm relics are the keys to his prison. Earning
all three (`unsealBarrow`) opens the Thousand-Step Barrow, a six-floor story site
at the continent's heart (`STORY_SITES.hollow`) with the Hollow King as a
super-boss. On the Far Shore's roads his soldiers march (`ENCOUNTERS.hollowmen`).
Slaying him ends Story 2 (`hollowKingSlain`: 2000 gold, the Crown of the Hollow
King, Friend of Seven Realms). The journal, objectives, quest log and map labels
follow the story; the far realms stay off them until the Veil parts.

Story 3, The Frozen Gate, opens once Story 2 is done (`story2Done`): a raven
brings the story (`STORY3_INTRO`), `meta.story3.s` becomes 1, harbourmasters
sell passage north through the pack ice (which turns ships back until then,
`ICE_Y`) to Hrafnvik, a lone Severin-style village on a small icy continent far
to the north (`THULE`, the sixth entry of `CONTINENTS`; the only town the ice
allows). North of `ICE_Y` the land is snow (`GROUND.SNOW`, `drawSnow`) under
falling snow and a cold light. Behind the village the Frozen Gate
(`STORY_SITES.gate`, a fixed site with its own `frost` theme and pool of
draugr, direwolves, trolls and wraiths) leads eight floors down through Midgard,
the middle earth of the old sagas, to Thrym, Jarl of the Frost Giants, a
super-boss. Slaying him ends the story (`frostJarlSlain`: 3000 gold, the
Frostheart relic with +4 defence and poison immunity, Giantsbane).

Story 4, The Long Night, opens once Story 3 is done (`story3Done`): rifts to
Midgard tear open outside towns near the hero (`openRift`, every `RIFT_EVERY`
turns, two at a time) and hordes of draugr, winter wolves, frost trolls and rift
wraiths come through, marching on the town (`hordeStep`), cutting down the watch
at the walls and setting the roofs burning (`townBurning`: flames, smoke and a
glow at night, drawn by `drawRifts`). A rift folds shut when its horde is dead
(`tickRifts`, paying the hero), and after `RIFTS_TO_CLOSE` closures the Rift
Lord steps through his own rift as a super-boss; slaying him ends the story
(`riftLordSlain`: 4000 gold, the Riftheart, every horde turned to dust).
`meta.story4` keeps the stage and the tally.

Story 5, The Rebuilding, opens once Story 4 is done (`story4Done`). It has no
boss: talking to any town leader opens the rebuilding list (`rebuildRows`,
`config/game.php` `projects`): town walls, a watch house, smithy, market hall,
apothecary, armoury, a memorial of the Long Night and paved roads. Sponsoring
one posts to `/api/projects` (`TownProjectController`, `town_projects` table;
the gold comes off the saved hero), and the structure is shared with every hero
and applied to the generated town (`applyProjects`): the wall ring appears, a
new house is placed in a free slot, the memorial stands in the square with the
sponsor's name, roads for sixty tiles around are paved in stone, and a town with
three works prospers a tier. Ten sponsored structures make a Founder
(`founderNamed`: the Founder's Seal). The heroes page ranks the builders
(`TownProject::builders`), which is this story's leaderboard.

Every town keeps a trade shop of its own kind, by the trade it is known for
(`TRADE_SHOP`, 23 kinds: fishmonger, vintner, master smith, spice bazaar, fur
trader and so on), built into the town beside its square (`addTradeShop`,
`TRADE_SLOT`). Each sells the specialities of that trade, items carrying a
`trade` in `config/items.php` that no merchant stocks: foods and drinks that
heal and restore mana, buffs (`buff`), cures, a torch that widens sight
underground, a spyglass that marks places on the map, a balm that heals pets,
cheap firepots, and a few unique cloaks, a pick and a steel axe. The town's
profile names its shop and wares; the item catalogue lists them.

A public item catalogue at `/world/items` lists every weapon, armour,
consumable and relic from `config/items.php` with its price, effect and where it
comes from (`config/catalog.php` holds the fighting styles, legendary
provenance and the other things a hero can acquire; keep it in step with
`WEAPON_TRAITS` and `LAIRS` in `script.js`).

The public story page at `/world/story` (`StoryController`, `config/story.php`)
tells both stories and carries a discussion thread under each that signed-in
heroes can post to (`story_posts`, 600 characters, throttled).

## The Sundered Blade

Dawnbreaker (+16 attack, the Sundering style: every blow also strips a tenth of
the foe's full health, and it lights two tiles further) is the one weapon above
the legendaries, and it is never dropped or sold. It is reforged from three
pieces won across the three continents, each from a warden in a forge site that
reuses the lair machinery (`LAIRS` entries with `forge`): the Hilt of Dawn at
the Forge of the First King in the old realms, the Blade of Dawn in the Glass
Pagoda on the Far Shore (Story 2), and the Sunstone Pommel under the Cairn of
the Sun on the ice of Thule (Story 3). Any master smith (the trade shop of a
smithing town) tells the tale to a hero of level 12 or more and marks the first
site; each warden's death marks the next; the smith reforges the sword once all
three are won (`smithTale`, `player.meta.forged`, the Dawnbringer title). The
journal and the hints track the pieces, and the catalogue page lists the sword.

## Monsters with tricks

Beyond the brutes, five monsters fight differently (`MONSTER_TYPES` flags):
the **Thief** (floor 2+) grabs a tenth of your gold on a hit and runs for the
dark, vanishing for good if it gets far enough; kill it first and the gold
drops back. The **Shaman** (3+) keeps its distance, spits hexes and mends every
wound within two tiles of it each turn. The **Bomber** (3+) goes off when it
dies, whoever killed it, hurting everything beside it. The **Basilisk** (5+)
has a bite that can turn you to stone for a turn (`player.stunned`). The **Cave
troll** (6+) regenerates two points a turn unless it is burning. They join the
site pools (thieves and bombers in caves and warrens, shamans in warrens,
basilisks in crypts) and the town dungeons by floor, with bestiary entries.

## Magic items

Weapons and armour dropped underground (and from chests) may come enchanted:
one affix and a tier I to III, carried in the item id as `base~affix~tier`
(`rollAffix`, `parseItem`, `itemInfo`, `config/items.php` `affixes`). Weapons:
Flaming (burns for a few turns), Venomous (poisons), Frost (may freeze a turn),
Vampiric (heals part of the damage dealt), Keen (critical blows), Heavy (+2).
Armour: Sturdy (+1), Warded (no poison), Swift (dodges), Blessed (slow regen),
Spiked (hurts attackers), Fireproof (half lava damage). Each tier adds a point
to the main stat. Burning and poisoned monsters tick before they act. The
server validates the parts (`Character::validItem`), the pages name them
(`Character::describeItem`), the multiplayer look sends the base item, and the
catalogue lists the affixes. Legendaries and trade-shop gear never roll one.

## The Daily Delve

Every inn offers the Daily Delve: a five-floor dungeon generated from the date
(`delveDef`, seeded through `floorSeed`), so every hero gets the same one, with
a theme and monster pool that rotate by day (`DELVE_THEMES`) and danger scaled
to the hero's level. One try a day: it is a dream, so falling in it only wakes
the hero at the inn with a quarter of their health, keeping the gold. Leaving,
clearing or falling scores it (`recordDelve`: a hundred a floor, five a kill,
every coin, 250 for clearing) and posts it to `/api/delve` (`DelveController`,
`daily_delves`, one row per hero per day, the server recomputes the score). The
heroes page shows today's board and yesterday's champion; the inn shows the
top three. `meta.delve` remembers the day's attempt.

## Operating it: deploy.sh and cx.sh

`deploy.sh` runs on the server (pull, dependencies, migrate, caches, verify).
`cx.sh` is its local counterpart: a menu of routine, diagnostic, admin and
maintenance options, each a wrapper around `php artisan` run over ssh in the
app root. cx.sh never talks to the database itself: database work goes through
`php artisan tinker --execute='…'` or the app's own commands (`db:dump`,
`db:restore`, `admin:grant`), using the app's Eloquent models and the DB
facade, so the connection is whatever `.env` on the server configures (MySQL
in production), with the credentials the website already uses and no mysql
client. It needs no settings file: the server is named by its ssh alias and
the app by its domain, overridable in the environment.

## Admin section

`/admin` (users with the `is_admin` flag; grant it with `php artisan admin:grant
you@example.com`, revoke with `--revoke`) shows an overview of users, heroes,
gold, monuments, projects and posts, and pages to search users (make or revoke
admins, delete a user and their hero), fix heroes (name, level, gold, or rescue
a hero stuck on a floor back to town), moderate story posts, and remove
sponsored structures or monuments from the shared world. The nav shows one item
for the signed-in hero (their name, which opens their profile) and, for admins,
an Admin link.

## Public glossaries

`/world/towns` and `/world/characters` are public pages that load `script.js` in
glossary mode (`window.DUNGEON.mode = 'glossary'`) and render the generated world
as HTML: every town within six regions of Hearth with its realm, tier, trade,
history, landmark, leader, watch and notable local; and every character, from the
fixed cast to each town's leader and notable with their lines. They are linked
from the site navigation and footer, searchable, and cross-linked by anchor.

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

## Accounts: email links and passwords

Signing up asks for a hero name, class and email only. A signed link (two
days, `AuthController::linkFor`, the `verify` route) goes to the address
(`App\Mail\LoginLink`); opening it proves the email, signs the owner in and
takes them to `/password` to choose a password, which is how they log in from
then on. An address that was never confirmed cannot log in: a new link is sent
instead. "Email me a sign-in link" (`/login/link`) serves both forgotten
passwords and unconfirmed emails, and answers the same whether or not the
address is known. Google sign-ins arrive verified. Accounts that predate this
were marked verified by a migration. Mail goes through the mailer in `.env`
(`sendmail` on the production host).

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
