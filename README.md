# Dungeon Adventure

A small browser-based dungeon game, served by Laravel. The web root is `public_html/`
(point your web server's document root there).

Controls:
- Move / attack: Arrow keys, WASD or HJKL (or the on-screen D-pad)
- Wait a turn: Space or `.`
- Mouse: click to walk, attack or use; right-click uses your class ability, aimed at the clicked tile
- Explore a dungeon floor by yourself: `z`; walk to stairs already found: `>`
- Groundwork (cut trees, quarry, lay roads, plant, bridge): `g`, and `g` again to stop
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
ones not yet visited (`harbourOf`, `sailTo`). Once Story 2 has begun and the
Veil has parted (`farShoreOpen`), harbourmasters also sell a ship of the hero's
own (`SHIP_COST`, a quarter off in shipping towns): walk into it
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

Ordinary monsters show their next move a beat early (`tellStep`, `TELL_TEXT`,
`tell` flags in `MONSTER_TYPES`), and each tell has its answer. Orcs, trolls and
cave trolls wind up a **chop**: a red tile under you lands double damage next
turn, but step off it and the brute is left off balance, so your next blow on it
is a sneak attack. Archers draw an **aim**: an amber line out to six tiles;
leave it, close in, or let another monster stand in it and the arrow takes them
instead. Skeletons raise a **guard**: a raised shield turns your blows to a
scratch for a turn, except a warhammer's. Basilisks **glare**: strike one or
step closer while its eyes burn and you turn to stone; wait or step back and
nothing happens. A stun breaks any tell. Hover text and the phone's size-up
name the current tell.

The dungeon bites both ways (`monsterHazard`): a walking monster that steps on a
spike trap takes its damage and spends it, one hammered or driven into lava burns
for four in ten of its health, and a bomber's blast hurts the monsters beside it.
Bats and wraiths fly over. Revealed traps no longer wall monsters out of a
corridor; they walk them and pay.

Leaving melee has a cost (`partingBlows`): each awake foe you step away from
gets a parting blow at half strength, unless it is busy with a tell, stunned or
off balance; a dagger makes a clean break. Potions and mana potions take the
turn.

Monsters keep pace with the hero (`scaleMonster`, `placeLevel`). A dungeon is
meant for its recommended level plus two a floor, the wilds for two levels a
region out from Hearth. A hero above that meets monsters with 8% more health and
+1 attack per three levels of the gap (at most four times the health and +12
attack), worth 5% more XP a level. Nothing is scaled down.

Each class has six abilities on keys 1 to 6, unlocking at levels 1, 5, 10, 15,
20 and 30: the Warrior adds Charge, Rally and Earthshaker; the Ranger Snare, Venom
Arrow and Rain of Arrows; the Mage Chain Lightning, Arcane Ward and Meteor.

The skill tree (`SKILL_TREE`, K or the Skills button, `meta.skills`) gives a point
every level from 2. Three branches of four nodes, each needing the one above:
Might (attack, brutal doubles, executioner, bloodlust), Guard (toughness, plating,
recovery, last stand) and Arcana (focus, spellpower, efficiency, channelling).
A reset costs 25 gold a point spent.

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

On a phone (`touch`, `touchStep`, `sizeUp`): a tap walks one step toward the
spot, holding keeps walking and stops by itself when a foe wakes beside you or
you start taking damage (unless you are deliberately holding on a foe next to
you); a swipe steps that way and keeps stepping while the finger is down,
steered by the drag; tapping a monster beside you strikes it, tapping one out
of reach shows its health, its hit and the blows it will take; tapping a
townsperson out of reach names them. A short delay after touch-down tells a
tap from a swipe. The viewport covers notched screens.

Press M underground for the dungeon map (`drawDungeonMap`): every tile seen on
this floor, scaled to fit, with the stairs down, the way-out door, chests,
springs, altars, trial stones, found traps, lava, visible foes, your pets and
you picked out in colour, and a legend. M or Esc closes it; the mobile map
button opens it too.

Most floors fork (`exit2`, `stairsAt`, `dungeonDef.nextMod`): three in four have a
second staircase on the far side of the start, and hovering over (or tapping)
either shows the twist waiting below it, a quiet floor or a Dark, Swarming,
Treasure or Cursed one. The two always differ. Not on the last floor, in the
Deep, or in a shared party run.

Every kind of dungeon has a rule underfoot (`GROUND_RULES`, `groundStep`,
`monsterGround`), and it holds for monsters as much as for the hero. Mossy caves
muffle steps: sleepers wake at three tiles rather than six. In flooded halls a
blow lands a quarter harder on anyone standing in a pool (`waterAt`). Bone
crypts have restless dead (`leaveBones`, `tickRestless`): three kills in ten
leave a twitching pile that rises as a skeleton in four turns unless the hero
walks onto it. In halls of ice, whoever steps on black ice slips (`iceAt`): a
monster loses its turn and is open to a sneak attack, and the next blow on a
hero who slipped lands half again as hard; bosses and flyers keep their feet.
Arcane halls have live runes (`runeAt`) that give 4 mana once. Ember deeps keep
their lava. The patches are read off the same noise that draws them, the rule
is logged on the way down, and hover text names each patch.

Bosses are big. Every boss is drawn two tiles tall and super bosses three,
feet on their own tile, fading when the hero stands behind them. Colossi
(`COLOSSI`, `colossusFor`) are giants that hold the last floor of an ordinary
dungeon four times in ten, once the dungeon has any danger or the hero is level
8, and every tenth floor of the Deep: one for each kind of stone (stone, tide,
bone, magma, glacier, rune), with five times a monster's health rather than
four. Giants, colossi and super bosses alike, alternate the fist (the tiles
beside them) with a stomp whose shockwave lands on the ring two paces out and
spares whoever stands at their feet. A colossus pays three times a boss's purse
and the title Giant-feller. Every monster kind now has a boss name; the last
floor under Hearth used to raise a nameless basilisk that broke the drawing.

A playtest by script (an honest level-one hero of each class, exploring and
fighting by rule for six thousand turns) led to five changes. A spike trap the
hero springs is now spent, as one a monster springs already was (`springTrap`):
before, a trap in a corridor hurt on every crossing and sealed the corridor to
the auto-explorer, which then claimed there was nothing more to find. The
explorer no longer treats monsters it cannot see as obstacles, and when the only
way on is barred it says by what: a trap or lava, or a sleeper
(`exploreScan(throughPotions, through)`). Nothing stands within four tiles of
the foot of the stairs on arrival. War parties leave heroes below level four
alone (`PARTY_LEVEL`) and muster every 75 seconds, not 45. And the screen shown
on falling says what killed the hero, what was kept and lost, and one piece of
advice about that killer (`lastHurt`, `DEATH_TIPS`).

A second playtest by script sent heroes down all five floors under Hearth, and
found that most never got there. The auto-explorer could pace between two tiles
for ever when a sleeping monster was in sight from one of them and hidden from
the next (introduced by the change above): it now remembers sleepers it has seen
(`explore.known`), and stops rather than pace (`explore.trail`). It also never
made headway: loot within thirty steps always came first and the pull toward
the stairs was too weak to turn it round, so on a floor with no edge it followed
gold away from the stairs for thousands of turns. Ground and loot are now
weighed alike, by steps there plus twice the distance left to the nearer stairs,
with loot worth twelve steps of detour (`EXPLORE_LEAN`, `EXPLORE_DETOUR`): over
ten seeded floors the stairs come into view in a median of 360 turns, from
1,330. A sleeper across a much shorter way on is reported once, and Z again
takes the long way round (`EXPLORE_ROUND`). An unhurt hero steps over a potion
on the floor instead of wasting it. A goblin totem calls eight goblins and falls
apart (`TOTEM_GOBLINS`); it used to call them without end, each worth XP. And a
monster is worth less XP the further the hero has outgrown the place
(`outgrown`): full up to two levels over, a tenth less a level after, never
under a quarter. It used to be worth 5% more a level, so the safest floor paid
best and scripted heroes left the starter dungeon at level 22 to 51; they now
leave at 18 to 28, all twelve of twelve, in about 1,000 to 3,400 turns.

The land can be changed (`WORKS`, `groundWorkStep`, `terraPut`). G, or the
Groundwork button, opens a list of jobs in the open country; pick one and the
hero's steps do that work until G is pressed again. Fell trees: walk into a
tree, two blows, one wood. Quarry rock: walk into a mountainside, three blows,
two stone, and the way is open. Beat a track: every step over grass, sand, snow
or forest floor leaves a dirt road, free. Pave in stone: every step lays paving,
one stone a tile or three gold when there is none (`PAVE_GOLD`). Plant trees:
one wood each. Bridge water: two wood a span, never more than three tiles from
the natural shore, so rivers and lakes can be crossed and the open sea cannot.
Put it back: walk into any work to undo it. Nothing can be changed inside a
town. Works are kept per hero as `x,y,code` strings in `meta.terra` (g cleared,
r track, c paving, t tree, b bridge; at most `TERRA_MAX`, 1500), with
`meta.wood` and `meta.stone`, and are laid over the world as its chunks are
made (`terraChunk`); a change that only restores what was there removes its
entry. Cleared ground shows a stump or rubble, the world map shows laid roads
and bridges, and hover text names each work. Roads now matter a little: on any
road or paving outside a town, the beasts of the wilds notice the hero two
tiles later. The first work earns the title Groundbreaker, a hundred standing
works Roadbuilder.

Story 1 has more to it between the fights. Entering the dungeon of the current
shard for the first time opens a scene at its door (`SHARD_ARRIVAL`,
`shardArrival`, counted in `meta.story.told`). Each shard, when lifted, shows a
vision of the night the crown broke (`SHARD_VISION`): five pieces of one night,
the last of which looks back at the hero. The six guardians speak once when they
first see the hero and once when the fight turns (`BOSS_LINES`, `bossVoice`).
After each of the first four shards the King asks what the hero thinks
(`KING_ASKS`, `kingAsks`): one answer speaks for Prince Edric, one against him,
one keeps out of it and is paid a little for honesty. At the top of the Star
Tower the hero may ask Edric what happened or bind his hands in silence
(`edricYields`). The tallies (`meta.story.mercy`, `meta.story.justice`,
`meta.story.heard`) pick one of three epilogue pages when the crown is mended
(`crownEpilogue`): Edric's signet and the title Peacemaker, the King's thanks
and the title King's Counsel, or a quiet word and a smaller purse.

The world map (M) is drawn like a chart (`renderWorldMap`, `MAP_INK`). Terrain
is painted a sample to a pixel into an image and scaled up: the sea shades from
shallows to deep water with a few strokes of swell, the coast is inked, mountains
are lit from the north-west with snow at the heart of a range, each realm tints
its own land and the line where two meet is dotted on land only. Roads have a
dark casing and trails to dungeons are dotted. Each kind of dungeon has its own
glyph, coloured by how hard it is for the hero (`drawMapGlyph`), and warcamps are
tents. Names are placed last, most important first, and a name that would cover
another or an icon tries the other three sides before it is left off
(`mapLabel`, `placeMapLabels`), so labels no longer run into each other. The
chart has a border, a compass rose, a scale bar and a legend made of the marks
themselves, and hovering over a town, dungeon, warcamp, war party, army or known
place shows a card with what it is and how far away (`mapFeatureAt`).

Orc warcamps send out war parties (`warParties`, `musterParty`, `partyTick`).
About every 75 seconds outdoors, for a hero of level four or more, the nearest standing camp within two regions
that has no party out sends three to seven orcs under a named captain to raid
the nearest town; horns are logged and the party shows on the map under a torn
flag with its road ahead. It marches in real time, a pace every 0.9 seconds,
and only while the hero is outdoors. Walking into it sizes it up, and walking
into it again attacks (`challengeParty`, `engageParty`): it breaks ranks into a
band of real monsters (`deployBand`, `bands`, `bandLoss`) scaled like any others.
Kill the band and the town is spared: gold, XP, standing, the title Raidbreaker
and a count in `meta.war.routed` (Roadwarden at five). A party that reaches its
town with the hero within thirty tiles falls on the gate in the open, where the
watch fights it too; with the hero further off the raid is settled in a line of
news. Parties are not saved. A realm's army can be fallen on as well, but only
on purpose: Ctrl with a direction, X then a direction, or the Strike button on
a phone (`attackArmy`). Three to eight soldiers wheel out to deal with the
hero, the army is lost, standing drops by 150 and the pay chest is the prize.

Underground the hero can explore alone (`startExplore`, `exploreScan`, Z, the
Explore button, or the round button on a phone). Each step is one sweep over the
ground already seen: gold, a chest or a potion that is needed within thirty
steps comes first, then the nearest ground nobody has looked at, leaning toward
the stairs. Potions are left where they lie while health is full, and known
traps, lava, the merchant's tile and the stairs are walked round. The hero stops
when a foe comes into sight, when hurt, and on first sight of the stairs, a
spring, an altar, a captive, a totem, a lever, trial stones, a cracked wall or a
merchant (`exploreNews`). `>` walks to stairs already found. Any key, click or
tap takes control back. Not during a trial, and not above ground.

The page under the game gives the message log a row of its own (it had been
squeezed to a sliver by the buttons), the buttons sit two to a row on a phone,
Make camp shows only in the wilds and Explore only underground, the legend no
longer lists monsters "from floor 99", and a first descent shows the basic
dungeon tip before the one about forked stairs. On a phone, a Strike button
takes the place of Wait beside a townsperson: tap it, then tap or swipe toward
them (`tryMove` honours `assaultArmed` for every kind of input). Guards' beats
are snapped to open ground (`guardBeat`), so castle guards no longer aim for
points under a house.

Towns have paving worth looking at (`pavingTile`, `pavingWear`, `plazaDetail`).
Cobbles and setts are laid in a running bond, flagstones as bevelled slabs, each
drawn once per realm and style into a cached tile. A poor town's square wears
through stone by stone in soft patches of mud with puddles and weeds, never on
the ways through it or round the fountain. Every square has lighter ways along
both axes and a darker border course. Lamp posts with a lantern and a pennant in
the realm's colour stand at the corners (`townLamps`, `drawLampPost`), eight in a
city, and light the square at night. Town and city squares have four stone
planters with a young tree (`planterAt`, solid), flower beds lie along the kerb
(`bedAt`), and open towns have shade trees on their greens (`townTrees`, solid,
never touching a house, a path, a road or each other).

Upgrades can be chosen for the player so that levelling never stops the game
(Settings, O: `settings.autoPerks`, `settings.autoSkills`, kept in the browser).
With perks on auto, three are still drawn at random and the best for the hero's
class is taken (`AUTO_PERKS`, `autoPerkIndex`); the perk picker itself has an
"Always choose for me" button (key 0). With skills on auto, points are spent down
the class's two main branches, two to the first for each one to the second
(`autoSkillPick`). Every choice is written in the log.

The public site has a news section (`/news`, `/news/{slug}`): development
articles kept newest first in `config/news.php`, each a slug, a date, a summary
and sections of paragraphs and points. The three newest show on the home page.
To publish one, add an entry at the top of that file.

The peace of a town can be broken. Ctrl with a direction (or X, then a
direction) strikes whoever stands there in a town square (`assault`,
`strikeNpc`); a plain step still only talks. Townsfolk are sturdy (50 health
plus 8 a hero level, more for leaders) and answer every blow (`OUCH`): surprise
first, then shouting for the watch, pleading when nearly down, and a last word
as they drop, out cold, with a few coins. The first blow raises the alarm
(`wanted`, `raiseAlarm`): that town's watch grows tougher and hunts the hero
(`guardHunt`), the rest of the square runs and shouts, and every door is bolted.
Losing to the watch is an arrest, not a death (`arrest`): the stocks, a fine and
a third of your health. Leaving the town ends it (`tickWanted`, `calmTown`) and
everyone is back on their feet. Anyone drawn as a child cannot be struck, and
nothing of this works indoors.

Towns are dressed as well as planned. A market row of stalls stands along the
north edge of each square (`STALL_SPOTS`, `townStalls`, `drawStall`): one in a
village, up to four in a town and six in a city, each with a striped awning, a
stallholder and goods of one kind. Stalls are solid like the fountain, and
walking into one makes the stallholder cry their wares. The fountain sits in a
ring of dressed stone laid in wedges and the square has a kerb where the paving
meets the grass (`plazaDetail`). Stepping stones run from every door to the
square or the road (`townPaths`), barrels, crates, woodpiles, anvils and flower
boxes stand against the side of the house they belong to (`HOUSE_PROPS`), and
pigeons peck about the square and fly off when the hero comes close
(`drawPigeons`).

Castles are more than towns with walls. A building with `floors` in `BUILDINGS`
is entered on its ground floor and climbed by stairs (`TILE.UP`, `TILE.DOWN`,
`useStairs`; `interior.level` says which floor). The keep has a Great Hall, the
Castellan's Solar above it and open battlements on top, where a spyglass marks
every place for two cells around on the map. Below the hall is the undercroft
(`cellarDungeon`, `cellarChunk`): one fixed floor of vaulted cellars full of
vermin with a rat king in the old cistern. Clearing it opens the Castellan's
strongbox in the solar and makes the guest bed beside it a free rest. The four
corner towers of the wall are houses two tiles square (`addTowers`, `drawTower`),
three round floors each: the Watchtower (a sergeant who drills you for +2 attack,
a watchman who reports the nearest orc camp and dungeon), the Astrologer's Tower
(+2 defence, or a pointer to an unfound lair), the Gaol Tower (a prisoner who
sells the spot where he buried his takings, as a treasure chart) and the Old
Tower (a forgotten chest in the garret). Castle Aurum's Royal Hall has a library
and battlements above the throne room, and its towers stand on the inner ring.
What has been taken or cleared is kept in `meta.looted` under the tile of the
building it belongs to.

Some rooms from the second floor down hold a ring of trial stones (`TILE.TRIAL`,
`TRIALS`): walk in and take up the Trial of the Swarm (stand twelve turns while a
monster arrives every other turn) or the Trial of Blood (five at once, all dead
within twenty turns). The location line counts the turns down. Pass and the stones
pay gold, XP and a sure magic item; fail, or stray more than twelve tiles, and they
go dark. Trials passed count toward the Proven and Unbroken titles
(`meta.trials`).

Arrows are drawn in flight (`shots`, `shoot`, `drawShots`): the archer's shot, the
Ranger's Arrow and Volley, a shaft with a steel head and red fletching turned to its
line with a fading trail and a puff where it lands; a shaman's hex flies as a glowing
violet orb with sparks.

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

Walk into an orc war camp to assault it yourself (`enterCamp`, `campChunk`): a
palisade ring with one gate, rows of tents with loot by their flaps, a bonfire
at the heart, a totem, and the warchief's tent at the back. Its orcs, goblins,
archers, shamans and bombers mostly sleep; clear every one and the camp is
razed, for six gold and two XP per point of its strength. Armies can still raze
camps as before.

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

The hero always knows which story they are in (`storyNow`, `storyLabel`): the
gold objective line reads "★ Story 2 · The Far Shore — …", the journal's Story
page opens on "Story 2 of 5", the act and its progress, a ladder of the five
stories (told, now, and "???" for those not yet opened) and one paragraph of the
tale so far (`STORY_RECAP`), with Story 1's finished steps folded away once it is
told. A chapter card shows whenever the story or act changes (`announceStory`),
and a returning hero is told where they stand on waking. None of it is saved:
it is all read from the story state already in `meta`.

The six stories share one thread, the doors. Story 3's opening says why the
gate opened (the breath the Hollow King held went north); runestones on each
landing of Midgard give Thrym's own account (`GATE_RUNES`, `gateFloor`): he shut
the door himself, stood in the way of what is behind it, and sent the raven
asking for help. In Story 4 the one who opens speaks through each rift as it
folds (`RIFT_WORDS`), counting, and names what Thrym was before the sagas: the
Doorward. The finales pay it off.

The objective line and its gold star never go blank between stories: after the
crown, it points to Prince Edric for Act II; when Act II ends, Story 2 begins at
once (and any town brings it on if missed); during Story 2 it points to the
harbour for the Veil, each Far Shore ruler's quest step in turn, then the
Barrow, which unseals as soon as all three keys are held.

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
King, Friend of Seven Realms). The tale has a spine of its own (`meta.story2`:
`met`, `mem`, `gift`). The Grey Envoy who brings the story meets the hero on the
first quay of the Far Shore (`STORY2_LANDFALL`, `story2Beat`) and says what the
courts will not: each key holds a piece of the King. The night a key is won it
shows which (`KEY_MEMORIES`, `keyMemory`): the Seal his name, the Lotus his
breath, the Claw his sleep, with his voice asking for it back and the Envoy
saying a little more each time (`ENVOY_AFTER`). His soldiers on the road speak
for him once a key is held. In the Barrow each landing carries a line of his own
account (`BARROW_STEPS`, `barrowFloor`), and at the bottom he asks for one piece
back before the fight (`HOLLOW_GIFTS`, `applyHollowGift`): his name (he raises
no dead), his breath (three tenths less health), his sleep (three tenths weaker
blows) or nothing (he fights whole and the purse is 1000 gold larger). The
finale (`story2Finale`) changes with the gift and says who the Envoy was. The journal, objectives, quest log and map labels
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

Story 6, The Rim of the World, opens once Story 5 is told (`story5Done`,
`offerStory6`). The world has a wall of ice across its top and its bottom
(`RIM_Y`, `RIM_W`: eight tiles thick at y = ±1245, `rimAt`, `GROUND.ICE`,
`drawIce`), standing in the ice-sea beyond the last towns; the row of lattice
cells it runs through holds no towns, sites or places (`RIM_J`). Four frost
giants hold it from islets at its foot (`RIM_HEARTS`, land anchors; two on each
wall, 320 tiles east and west of Hearth's meridian). They stand on their islets
whenever the hero sails within sight (`spawnRimGiants`, not saved) and are marked
on the map with a snowflake. Each one slain is a heart broken (`heartBroken`,
`HEART_WORDS`: the giants' last words, which finish the Doorward thread), paid
from the Founder's purse; when all four are dead the wall breaches seven tiles
wide due north and due south of Hearth (`RIM_BREACH`, `rimBreached`; the chunks
there are forgotten and regenerated). Sailing out past the wall ends the story
(`tickRim`, `rimEscaped`); the breaches stay open and the sea beyond is ordinary
procedural world. State is `meta.story6` (`s`, `slain`).

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

## Enemies on the water

The open sea has beasts in plain sight (`MONSTER_TYPES` with `sea`, spawned
per chunk on open water away from coasts and harbours): pirate sloops with a
strongbox and sometimes a chart, sea serpents, and krakens in the far deeps.
They wake when a ship comes within seven tiles, close over water only
(`seaMonsterStep`), strike from alongside and lose interest fourteen tiles
out. Sail into one to fight it from the deck, or strike it from the shore;
gold from a kill at sea goes straight to the purse. A hero beaten on deck
washes ashore instead of dying. Sea-wolf and Kraken-killer titles.

## The townsfolk

Every town has people of its own (`townFolk`, `FOLK_ROLES`, `FOLK_NAMES`):
a name from its realm's pool, a trade (sixteen in the old realms, six each in
Tianxia, Suryadesh and Severin), three things to say about their own town (its
landmark, trade, leader, nearest site and guard captain), a habit and a piece
of advice. The same town always has the same people, seeded by its cell, and
no two in a square share a name or a trade. Each wears clothes in their own
colour (`folkSprite` swaps the sprite's dominant clothing colour). Hearth keeps
its four old hands and each Far Shore town one voice of its culture alongside
them.

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

## The front page

`/` sells the game to someone who has never seen it: a headline and a free-play
button above the fold, a strip of the monsters, the three classes with their
portraits, a run in three steps, a gallery of the world, then the hall of heroes,
the news and a last call to play. Every picture is the game's own art:
`tools/capture-home.mjs` drives a local copy in Playwright, switches the HUD off,
walks to Hearth, Castle Aurum, the port of Quilfield and a seeded dungeon fight,
and writes the scenes as WebP and the sprites and class portraits as PNG into
`public_html/images/home/` (about 680 KB in all, `og.png` for link previews).
Run it again after a change to the art.

The picture above the fold is a fourteen-second clip of real play, muted and
looping (`play.mp4`, `play.webm`, poster `play-poster.jpg`), recorded from the
game canvas by `tools/capture-clip.mjs`; visitors who ask for reduced motion get
it paused with controls. Each class card links to `/play?class=warrior|ranger|mage`,
which a guest's fresh hero takes instead of the class picker. Below the gallery
sit six short questions (free, account, phone, death, length, upkeep), and on a
phone a play button follows once the first one has scrolled away.

## Public glossaries

`/world/towns` and `/world/characters` are public pages that load `script.js` in
glossary mode (`window.DUNGEON.mode = 'glossary'`) and render the generated world
as HTML: every town within six regions of Hearth with its realm, tier, trade,
history, landmark, leader, watch and notable local; and every character, from the
fixed cast to each town's leader and notable with their lines. They are linked
from the site navigation and footer, searchable, and cross-linked by anchor.

Everything on the public pages can be clicked for its figures. A shared sheet
(`resources/views/partials/detail.blade.php`, `window.showDetail`) opens as a
dialog, closes on Esc or a click outside, and puts the entry in the address
(`/world/items#weapon-longsword`, `/world/towns#hearth`) so it can be linked.
On the item catalogue every weapon, armour, consumable and relic row opens one:
price and sale value, gold per point, rank, first floor stocked, fighting style,
the next step up in the shops, and a link to the towns of its trade
(`/world/towns?q=wool` fills the search). On the towns page a card opens the
town's realm and ruler, size, walls, trade, port, distance and waystone fare
from Hearth, buildings, people, its dungeon's level, what its trade shop sells
(linked back to the catalogue), the dungeons nearby with floors and level, and
the next towns by road, each of which opens in turn (`townDetail`). Characters
open the same way.

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
