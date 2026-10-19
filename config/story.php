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
        'tagline' => 'The Veil of storms parts, and a continent nobody alive has seen asks for the hero by name.',
        'acts' => [
            ['title' => 'The Veil parts', 'text' => 'For a thousand years a wall of storms, the Veil, has closed the eastern sea. When the crown is mended and the Deep goes quiet, it opens. A ship with sunset sails puts into harbour and an envoy of the Celestial Empire asks for the hero by name. From then on every harbourmaster sells passage across the Veil, and a hero with a ship of their own can sail it.'],
            ['title' => 'Three crowns beyond the sea', 'text' => 'Beyond the Veil lies one wide continent and three realms, each with its own trouble and its own favour to earn. The Celestial Empire of Tianxia, ruled from the Jade Throne by Empress Liang Wu and her scholar-officials, where the beasts have found champions and the tribute roads are robbed. The Rajadom of Suryadesh, nine-gated city of the sun under Maharani Devika Suryavansha, whose pilgrim roads are strung with webs and whose old temple shelters a false god. The Tsardom of Severin, log towns and painted domes under Tsar Fyodor the Patient, with winter six weeks off, the granaries burned and something singing in the barrow under the frozen river. Earn all three favours and the sea road is chartered for good.'],
        ],
        'realms' => ['Celestial Empire of Tianxia (empire)', 'Rajadom of Suryadesh (rajadom)', 'Tsardom of Severin (tsardom)'],
    ],
];
