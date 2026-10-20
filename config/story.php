<?php

// The game's narrative, as told on the public story page (/world/story). The
// script.js scenes carry the same beats in play; keep the two in step.

return [
    [
        'n' => 1, 'title' => 'The Shattered Crown', 'status' => 'playable from the start',
        'tagline' => 'A broken crown, five lost lights, and a nobody from Hearth who goes looking for them.',
        'acts' => [
            ['title' => 'Act I: The Five Shards', 'text' => 'A thousand years ago Aurel the Founder pulled five lights out of the dark, Dawn, Tides, Bones, Embers and Stars, and forged them into the Crown of Aurum. Five nights before the game begins, the crown cracks in King Aldric\'s own hall and its lights flee back into the dark. The King\'s herald summons any sword-arm who will come. The hero of Hearth answers, and is sent after the shards one by one: the Sunken Chapel, the Drowned Grotto, the Barrow of Kings, the Ember Deeps and the Star Tower, each with a clue at the bottom that points the same way, at the King\'s own brother, Prince Edric. Riders in grey cloaks dog the roads, Ser Halvard bars the Star Tower, and the crown is restored only when the hero chooses what to do about the prince.'],
            ['title' => 'Act II: What Sleeps Below', 'text' => 'With the crown whole, a pardoned Prince Edric brings the hero a worse problem. The lights were taken from something: the Deep, old and patient and dreaming under the world, whose dreams leak upward as every cave and crypt. A gate of black iron opens in the hills between Hearth and Castle Aurum. The hero goes down, floor by floor, past the Warden of the Deep on the tenth floor to the Dreaming Maw on the twentieth, and comes back up the Deepwarden, with the Deep quiet for the first time in an age.'],
        ],
        'realms' => ['Free Cantons of Hearth (democracy)', 'Kingdom of Aurum (monarchy)', "Ka'thar Clans (tribal)", 'Goldspire League (oligarchy)'],
    ],
    [
        'n' => 2, 'title' => 'The Far Shore', 'status' => 'opens when Story 1 is finished',
        'tagline' => 'The Veil of storms was never weather. It was a prison wall, and the hero who mended the crown just knocked it down.',
        'acts' => [
            ['title' => 'The Veil parts', 'text' => 'For a thousand years a wall of storms, the Veil, has closed the eastern sea. When the crown is mended and the Deep goes quiet, it falls, and so do the wards beneath it. A ship with sunset sails puts into harbour and an envoy of the Celestial Empire asks for the hero by name, with a confession: the Veil was raised on purpose. Before there were three crowns on the far continent there was one, and it was hollow. The Hollow King took the breath out of every living thing that would not kneel and ruled a continent of the obedient dead. Three generals broke him, one with a seal, one with a lotus, one with a bear\'s claw, and since they could not kill him they buried him under the Mountain of a Thousand Steps, each with a lock, and raised the Veil so that nobody from over the sea would ever come looking for the keys. Now the Barrow has begun to breathe and the dead walk the roads in step.'],
            ['title' => 'Three keys, three crowns', 'text' => 'The generals\' heirs rule the Far Shore and the keys are their crown treasures. The Celestial Empire of Tianxia, ruled from the Jade Throne by Empress Liang Wu and ten thousand scholar-officials, holds the Seal, and the Empress wants her provinces put in order and the tribute roads cleared of the champions the beasts have found. The Rajadom of Suryadesh, the nine-gated city of the sun under Maharani Devika Suryavansha, holds the Lotus, and the Maharani wants her pilgrim roads cleared of spiders and the false god in the old temple put to the sword. The Tsardom of Severin, log towns and painted domes under Tsar Fyodor the Patient, holds the Bear\'s Claw, and the Tsar wants the raiders of the taiga broken, the winter granary filled and the barrow under the frozen river emptied of whatever is singing in it. Each crown gives its key to the hero who earns it. On the roads between, the Hollow King\'s soldiers march again.'],
            ['title' => 'The Thousand-Step Barrow', 'text' => 'The third key is barely in the hero\'s hand when the Mountain of a Thousand Steps splits along an old seam at the heart of the continent. Six floors of the obedient dead lead down to the Hollow King himself, stronger than anything on either shore. When he comes apart, the breath he stole a thousand years ago goes out of the Barrow in one long sigh, the dead lie down, and Empress, Maharani and Tsar sit at one table for the first time in living memory to hand the hero his crown, with tongs. Friend of Seven Realms.'],
        ],
        'realms' => ['Celestial Empire of Tianxia (empire)', 'Rajadom of Suryadesh (rajadom)', 'Tsardom of Severin (tsardom)'],
    ],
    [
        'n' => 3, 'title' => 'The Frozen Gate', 'status' => 'opens when Story 2 is finished',
        'tagline' => 'A raven from the last village before the ice, and a door in a hill that the sagas say leads to Midgard.',
        'acts' => [
            ['title' => 'A raven from the north', 'text' => 'When the Hollow King is dust, a raven finds the hero at a window with a strip of birch bark tied to its leg: "Hrafnvik. The gate in the hill is open. Giants. Come." Hrafnvik is the last village before the ice, forty souls with a pier and a church with a stove, on an island so far north that the sea freezes to the horizon in winter. Every harbourmaster will take the hero north through the pack ice, and a stout ship can make the crossing alone. Behind the village a door of blue ice taller than a house stands open in the hillside, with a raven on the lintel, and what has come through it so far is draugr, direwolves, and a cold that puts out fires.'],
            ['title' => 'Midgard', 'text' => 'The sagas call the land beyond the door Midgard, the middle earth of the old world, where the roots of the World Tree run through halls of ice and the frost giants wait for a winter that never ends. Thrym, Jarl of the Frost Giants, has waited the longest, and it was his hand on the door. Eight floors of ice lead down through Midgard to his hall. When he falls like a cliff into the sea, the cold goes out of the hall with him, something drips in Midgard for the first time in a thousand years, and the door of blue ice begins, very slowly, to close. Hrafnvik meets the hero on the pier with the church bell going. The raven stays.'],
        ],
        'realms' => ['Hrafnvik, the last village before the ice', 'Midgard, beyond the Frozen Gate'],
    ],
    [
        'n' => 4, 'title' => 'The Long Night', 'status' => 'opens when Story 3 is finished',
        'tagline' => 'Thrym was the lock on every door to Midgard, and the lock is dead.',
        'acts' => [
            ['title' => 'Rifts', 'text' => 'The week after Thrym falls, a farmer outside Hearth sees the air above his field split like cloth. The Frozen Gate was never the only door; Thrym was the lock on all of them. Rifts tear open outside towns in every realm and the hosts of Midgard pour through: draugr in rusted mail, winter wolves, frost trolls, and the rift-wraiths that herd them. They march on the walls, cut down the watch at the gates, and set the roofs burning. A rift stays open while its horde lives; kill them to the last and it folds shut. The hero goes from town to town closing them, and every realm pays for each one.'],
            ['title' => 'The Rift Lord', 'text' => 'Close enough rifts and whatever is opening them has to come through itself. The Rift Lord steps out of a tear in the sky outside a town with his guard around him, vast and wrong, and the last door stands open behind him. When he comes apart, every rift from the ice to the Far Shore folds shut in the same instant, the hosts of Midgard go to dust where they stand, and seven realms argue about who will pay for the roofs. The Long Night is over, and the hero, four stories on, is finally allowed to sleep late.'],
        ],
        'realms' => ['Every realm on both shores', 'Midgard, through the rifts'],
    ],
];
