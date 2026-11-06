<?php

// Development news for the public site, newest first. Each article has a slug for
// its address, a date, a one-line summary for the list, and a body of sections: a
// heading, paragraphs, and optionally a list of points.
return [
    'articles' => [
        [
            'slug' => 'shape-the-land',
            'title' => 'Shape the land: fell trees, lay roads, build bridges',
            'date' => '2026-11-06',
            'tag' => 'New feature',
            'summary' => 'The country outside the towns is no longer fixed. Press G and you can cut a way through a forest, lay a road to your favourite dungeon, or bridge the river that was in the way.',
            'sections' => [
                ['heading' => null, 'text' => [
                    'Until now the world was something you walked across. The forest between you and a cave stayed a forest, and the river stayed in the way. From today you can change it. The work is called Groundwork, and whatever you do stays done: it is saved with your hero and is there when you come back.',
                ]],
                ['heading' => 'How it works', 'text' => [
                    'Step outside a town and press G, or use the Groundwork button under the game. A list of jobs opens. Pick one and your steps do that work until you press G again. There is no cursor to aim and no building screen: you work by walking.',
                ], 'points' => [
                    'Fell trees. Walk into a tree. Two blows bring it down and you keep a log of wood.',
                    'Quarry rock. Walk into a mountainside. Three blows break a way in and give you two blocks of stone.',
                    'Beat a track. Just walk. Every step over grass, sand, snow or forest floor leaves a dirt road behind you, and it costs nothing.',
                    'Pave in stone. Just walk. Every step lays paving, for one stone a tile, or three gold a tile when you have no stone.',
                    'Plant trees. Walk toward open grass. One wood plants one tree.',
                    'Bridge water. Walk into water. Two wood lays a span of planks you can cross.',
                    'Put it back. Walk into anything you have changed and it returns to what it was.',
                ]],
                ['heading' => 'What it is good for', 'text' => [
                    'Roads are now safer than open country. On any road or paving outside a town, the beasts of the wilds notice you two tiles later than they would on grass, so a track from your home town to a dungeon you visit often is worth the walk it takes to lay. A felled line through a forest or a bridge over a river can cut a long detour to a few steps. If you click a far spot with Beat a track switched on, your hero lays the road all the way there.',
                ]],
                ['heading' => 'The limits', 'text' => [
                    'A few rules keep the world recognisable.',
                ], 'points' => [
                    'Towns cannot be changed. The trees on a town green belong to the town.',
                    'A bridge needs natural shore within three tiles. Rivers, lakes and narrow straits can be crossed. The open sea cannot, so ships still matter.',
                    'Each hero can keep 1,500 works. At the limit, put some back to make room.',
                    'Your works are your own. Other heroes do not see them in their world.',
                ]],
                ['heading' => 'Where to look', 'text' => [
                    'A felled tree leaves a stump and broken rock leaves rubble. Your roads and bridges are drawn on the world map (M), and hovering over any tile you have changed says what you did there. The first thing you change earns the title Groundbreaker. A hundred works standing at once earns Roadbuilder.',
                ]],
            ],
        ],
        [
            'slug' => 'castles-you-can-climb',
            'title' => 'Castles you can climb',
            'date' => '2026-11-06',
            'tag' => 'New places',
            'summary' => 'A castle used to be a town with a wall round it. Now the keep has floors, the four corner towers open, and there is something living in the cellar.',
            'sections' => [
                ['heading' => null, 'text' => [
                    'Until this week a castle was a town with a wall round it. You walked in, bought a sword, and walked out. That has changed. Every castle now has a keep with several floors and four towers you can go up, and each of them holds something worth the stairs.',
                ]],
                ['heading' => 'The keep', 'text' => [
                    'The keep is entered through the Great Hall, where the Castellan still sits. Stairs in the corners lead up and down. Walk into a stair to take it.',
                ], 'points' => [
                    'Above the hall is the Solar, the Castellan\'s own chamber, with his strongbox and a guest bed.',
                    'Above that are the Battlements, open to the sky. A spyglass on the parapet marks the places of interest in the country around the castle on your map.',
                    'Below the hall is the undercroft. Something has bred down there, and it has a king.',
                ]],
                ['heading' => 'The undercroft', 'text' => [
                    'The Castellan asks you to clear the undercroft the first time you speak to him. It is a single floor of vaulted cellars full of rats, spiders, bats and slimes, with Old Gnawbone waiting in the cistern at the far end. Kill everything and the Castellan unlocks his strongbox for you. The guest bed in the Solar is yours from then on: a free rest whenever you pass that castle.',
                ]],
                ['heading' => 'The four towers', 'text' => [
                    'The corner towers of the wall each have a door facing the bailey and three round floors.',
                ], 'points' => [
                    'The Watchtower. The sergeant-at-arms drills you for a fee: +2 attack for 300 turns. The watchman at the top tells you where the nearest orc camp and dungeon are.',
                    'The Astrologer\'s Tower. At the top, the astrologer reads your stars for +2 defence for 400 turns, or points you at a lair nobody has found yet.',
                    'The Gaol Tower. A road thief in the cells will tell you where he buried his takings, for a price. The spot is marked with a red ✕ on your map.',
                    'The Old Tower. Nobody has been up it in years. Go and see why.',
                ]],
                ['heading' => 'Good to know', 'text' => [
                    'You carry one blessing at a time, so the drill and the star reading replace each other: pick attack or defence before you go down a dungeon. Castle Aurum has its own version of all this, with the Royal Library and the royal battlements above the throne room.',
                ]],
            ],
        ],
        [
            'slug' => 'town-life-and-how-to-ruin-it',
            'title' => 'Town life, and how to ruin it',
            'date' => '2026-11-06',
            'tag' => 'Towns',
            'summary' => 'Squares now have market stalls, a paved ring round the fountain and pigeons. You can also start a fight in one, and the watch will finish it.',
            'sections' => [
                ['heading' => null, 'text' => [
                    'Two changes to towns went out together. One makes them nicer to look at. The other lets you behave very badly in them.',
                ]],
                ['heading' => 'A better-looking square', 'points' => [
                    'A market row of striped stalls stands along the north edge of each square: one in a village, up to four in a town and six in a city. Walk into a stall and the stallholder shouts what is on offer.',
                    'The fountain sits in a ring of dressed stone, and the square has a kerb where the paving meets the grass.',
                    'Stepping stones run from every door to the square.',
                    'Barrels, crates, woodpiles, anvils and flower boxes stand against the houses they belong to, so you can tell a smithy from an inn at a glance.',
                    'Pigeons peck about the square and fly off when you get close.',
                ], 'text' => []],
                ['heading' => 'Breaking the peace', 'text' => [
                    'Walking into a townsperson still only talks to them. To hit one you have to mean it: hold Ctrl and press an arrow key, or press X and then a direction.',
                    'Townsfolk are a good deal tougher than they look, and they have opinions about being hit. Expect surprise, then shouting for the watch, then pleading, and a last word as they go down. They are knocked out, not killed.',
                ]],
                ['heading' => 'What it costs you', 'points' => [
                    'The first blow raises the alarm. That town\'s watch comes for you and hits harder than you might expect.',
                    'Everyone else in the square runs, and every door is bolted against you.',
                    'If the watch beats you, you are not dead. You wake in the stocks with a third of your health and a fine taken from your purse.',
                    'Leave the town and it is over. By the time you come back everyone is on their feet again.',
                ], 'text' => []],
                ['heading' => 'Limits', 'text' => [
                    'It only works out in the square, not inside buildings, and your hero will not raise a hand to a child.',
                ]],
            ],
        ],
        [
            'slug' => 'giants-below',
            'title' => 'Giants below, and ground that fights back',
            'date' => '2026-11-05',
            'tag' => 'Dungeons',
            'summary' => 'Bosses are now two and three tiles tall, colossi stomp, every kind of dungeon has a rule of its own underfoot, and levelling up no longer has to stop the game.',
            'sections' => [
                ['heading' => null, 'text' => [
                    'A run of changes to the dungeons, and one to the level-up screen that several players asked for.',
                ]],
                ['heading' => 'Bigger bosses', 'points' => [
                    'Every boss is drawn two tiles tall, and the super bosses three. They fade when you stand behind them.',
                    'Colossi are new. One holds the last floor of an ordinary dungeon about four times in ten once the dungeon is dangerous or your hero is level 8, and one waits on every tenth floor of the Deep.',
                    'Giants alternate a fist with a stomp. The stomp lands two paces out and misses whoever is standing at their feet, so get close and stay close.',
                    'A colossus pays three times a boss\'s gold and the title "the Giant-feller".',
                ], 'text' => []],
                ['heading' => 'Every dungeon has its own ground', 'text' => [
                    'The rule applies to monsters as much as to you, so it is something to use, not only something to avoid.',
                ], 'points' => [
                    'Mossy caves muffle your steps: sleepers wake at three tiles instead of six.',
                    'In flooded halls, a blow lands a quarter harder on anyone standing in a pool.',
                    'In bone crypts, some kills leave bones that get up again in four turns unless you walk over them first.',
                    'On black ice a monster loses its turn and is open to a sneak attack. If you slip, the next blow on you lands half as hard again.',
                    'In arcane halls, a glowing rune gives 4 mana, once.',
                ]],
                ['heading' => 'Upgrades without the interruption', 'text' => [
                    'Choosing a perk at every level used to stop the game until you picked. If you would sooner keep exploring, open Settings (O) and tick "Choose my perk at each level up", or press 0 on the perk screen. The best of the three perks for your class is taken and written in the log. A second box does the same for skill points.',
                ]],
                ['heading' => 'Also this week', 'text' => [
                    'Story 2 was rewritten around the Grey Envoy and a choice before the last fight. Some staircases now fork, with a different floor below each. And you can walk into an orc war camp and clear it yourself.',
                ]],
            ],
        ],
    ],
];
