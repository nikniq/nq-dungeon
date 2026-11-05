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
            ['title' => 'The Veil parts', 'text' => 'For a thousand years a wall of storms, the Veil, has closed the eastern sea. When the crown is mended and the Deep goes quiet, it falls, and so do the wards beneath it. A ship with sunset sails puts into harbour and a woman in grey silk asks for the hero by name. She does not take the harbourmaster\'s wine, and the harbour dogs are quiet around her. The Veil, she says, was raised on purpose. Before there were three crowns on the far continent there was one, and it was hollow. It began as a mercy: a grey winter took half his people, and the King would not let them go. He took the last breath from the dying and kept them walking, and then from anyone who objected, and ruled a continent of the obedient dead. Three of his own broke him, his chancellor with a seal, his physician with a lotus, his huntsman with a bear\'s claw. They could not kill him, so they buried him under the Mountain of a Thousand Steps and raised the Veil so that no fool from over the sea would come looking for the keys. Each of the three courts believes the Grey Envoy serves one of the other two. She finds that useful.'],
            ['title' => 'Three keys, three crowns', 'text' => 'The Envoy is waiting on the first quay of the Far Shore, though no ship passed the hero\'s on the crossing, with the thing the courts have spent a thousand years forgetting: the keys are not locks. The generals took the King apart, and each key holds a piece of him. The Celestial Empire of Tianxia, ruled from the Jade Throne by Empress Liang Wu, holds the Seal, and wants its provinces put in order. The Rajadom of Suryadesh, the nine-gated city of the sun under Maharani Devika Suryavansha, holds the Lotus, and wants its pilgrim roads cleared and a false god put to the sword. The Tsardom of Severin, log towns and painted domes under Tsar Fyodor the Patient, holds the Claw, and wants its raiders broken before winter. The night each key is won it shows what it holds: the Seal his name, pressed into the jade so that no order of his would bind the living; the Lotus his breath, the one he kept for himself, taken while he slept; the Claw his sleep, laid on him by the huntsman who carried him down and froze at his door. And each night a polite voice from under the mountain asks the hero to bring it down. His soldiers on the road begin to ask after someone else, too: the small one in grey.'],
            ['title' => 'The Thousand-Step Barrow', 'text' => 'With the third key the Envoy confesses: the keys do not hold the door shut, they open it. The locks were rotting, and better one man in one room now than an army in a year. The Mountain of a Thousand Steps splits along an old seam. Six floors of the obedient dead lead down, with the King\'s own account cut into the wall of every landing, and at the bottom he sits in the only chair in a hall the size of a cathedral and asks, politely, for one piece back before the fight: his name, his breath, his sleep, or nothing. Each changes how he fights and how he falls. When he does, he asks whether she is with him, the small one, and the breath he stole goes out of the Barrow in one long sigh. The Envoy is on the top step in the sun with her shoes off. She was six, the winter it started; she was the first one he kept. Empress, Maharani and Tsar sit at one table for the first time in living memory, with a fourth place laid that nobody sits in, and hand the hero the Hollow King\'s crown with tongs. Friend of Seven Realms.'],
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
    [
        'n' => 5, 'title' => 'The Rebuilding', 'status' => 'opens when Story 4 is finished',
        'tagline' => 'The hordes are dust. The roofs are not. Someone has to pay for the stone.',
        'acts' => [
            ['title' => 'The reckoning', 'text' => 'When the last rift shuts, seven realms count the cost: gates broken, watch houses burned, roads churned to mud, and a watch buried in every town. The treasuries are empty from the war. Every town leader keeps a list of what the town needs, and every hero who comes through the gate with gold in their purse is asked the same question. The leaders of every town, in every realm, will take a hero\'s gold for walls where there were none, a watch house, a smithy, a market hall, an apothecary, an armoury, a memorial to the fallen in the square, and paved roads out of town. What is built stands for every hero who passes, with the sponsor\'s name carved on it.'],
            ['title' => 'The builders', 'text' => 'This story has no boss. Its heroes are the ones who build: the heroes page keeps a ranking of who has sponsored the most structures across the realms. A hero who raises ten is named a Founder, given the Founder\'s Seal, and remembered, which in the realms is the only reward that lasts.'],
        ],
        'realms' => ['Every town on both shores'],
    ],
];
