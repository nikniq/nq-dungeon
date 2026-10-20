<?php

// The single item catalog. The game page injects this into the browser, and
// the save endpoint validates equipment against it, so both sides agree.
// 'floor' is the first floor the merchant stocks the item on.

return [
    'weapons' => [
        'dagger' => ['name' => 'Dagger', 'atk' => 1, 'price' => 15, 'floor' => 1],
        'short_sword' => ['name' => 'Short sword', 'atk' => 2, 'price' => 40, 'floor' => 1],
        'mace' => ['name' => 'Mace', 'atk' => 3, 'price' => 85, 'floor' => 2],
        'longsword' => ['name' => 'Longsword', 'atk' => 4, 'price' => 150, 'floor' => 3],
        'warhammer' => ['name' => 'Warhammer', 'atk' => 6, 'price' => 280, 'floor' => 4],
        'greatsword' => ['name' => 'Royal greatsword', 'atk' => 9, 'price' => 650, 'floor' => 7],
        // legendary: one of a kind, dropped by the super bosses in their lairs (never stocked)
        'fangblade' => ['name' => 'Fangblade', 'atk' => 10, 'price' => 1500, 'floor' => 99],
        'tidecaller' => ['name' => 'Tidecaller', 'atk' => 11, 'price' => 1800, 'floor' => 99],
        'stormhammer' => ['name' => 'Stormhammer', 'atk' => 13, 'price' => 2000, 'floor' => 99],
        'staffofages' => ['name' => 'Staff of Ages', 'atk' => 10, 'price' => 1800, 'floor' => 99],
    ],
    'armor' => [
        'leather' => ['name' => 'Leather armor', 'def' => 1, 'price' => 20, 'floor' => 1],
        'chain' => ['name' => 'Chain mail', 'def' => 2, 'price' => 65, 'floor' => 2],
        'scale' => ['name' => 'Scale mail', 'def' => 3, 'price' => 130, 'floor' => 3],
        'plate' => ['name' => 'Plate armor', 'def' => 4, 'price' => 240, 'floor' => 4],
        'dragonscale' => ['name' => 'Dragonscale mail', 'def' => 6, 'price' => 800, 'floor' => 7],
        'trollhide' => ['name' => 'Trollhide coat', 'def' => 8, 'price' => 1600, 'floor' => 99],
        'wyrmscale' => ['name' => 'Wyrmscale plate', 'def' => 10, 'price' => 2400, 'floor' => 99],
    ],
    'consumables' => [
        'potion' => ['name' => 'Potion', 'heal' => 5, 'price' => 12, 'floor' => 1],
        'elixir' => ['name' => 'Elixir', 'heal' => 25, 'price' => 45, 'floor' => 7],
        'bomb' => ['name' => 'Bomb', 'use' => 'bomb', 'price' => 25, 'floor' => 1],
        'scroll' => ['name' => 'Scroll of return', 'use' => 'return', 'price' => 30, 'floor' => 1],
        'manapotion' => ['name' => 'Mana potion', 'use' => 'mana', 'mana' => 20, 'price' => 15, 'floor' => 1],
        // caught and cooked, never stocked by merchants (floor 99)
        'fish' => ['name' => 'Fresh fish', 'heal' => 4, 'price' => 8, 'floor' => 99],
        'stew' => ['name' => 'Fish stew', 'heal' => 15, 'price' => 24, 'floor' => 99],
        'goldcarp' => ['name' => 'Golden carp', 'heal' => 4, 'price' => 80, 'floor' => 99],
    ],
    // Unique treasures: never sold in shops or dropped at random. Each is found in
    // one particular place and has its own effect (implemented in script.js).
    'relics' => [
        'sunstone' => ['name' => 'Sunstone Amulet', 'desc' => 'Your light reaches three tiles further and nearby traps show themselves.', 'found' => 'the Sunken Chapel', 'price' => 400, 'floor' => 99],
        'tideheart' => ['name' => 'Tideheart Pearl', 'desc' => 'You heal 1 HP every six turns.', 'found' => 'the Drowned Grotto', 'price' => 400, 'floor' => 99],
        'bonecharm' => ['name' => 'Charm of the Barrow King', 'desc' => '+2 defence.', 'found' => 'the Barrow of Kings', 'price' => 400, 'floor' => 99],
        'emberbrand' => ['name' => 'Emberbrand Ring', 'desc' => 'Your blows burn for 2 extra damage.', 'found' => 'the Ember Deeps', 'price' => 400, 'floor' => 99],
        'starring' => ['name' => 'Ring of Falling Stars', 'desc' => 'Your class ability recharges twice as fast.', 'found' => 'the Star Tower', 'price' => 400, 'floor' => 99],
        'luckycoin' => ['name' => "Gambler's Coin", 'desc' => '+40% gold from the floor and from chests.', 'found' => "a hermit's hut", 'price' => 250, 'floor' => 99],
        'houndcollar' => ['name' => 'Gilded Collar', 'desc' => 'Your hound bites 3 harder and has 6 more HP.', 'found' => 'an old ruin', 'price' => 250, 'floor' => 99],
        'wardstone' => ['name' => 'Wardstone', 'desc' => 'Monsters notice you only from up close.', 'found' => 'an old battlefield', 'price' => 250, 'floor' => 99],
        'cantonsbadge' => ['name' => 'Badge of the Free Cantons', 'desc' => '+20% XP from every kill.', 'found' => "Speaker Maren's errand", 'price' => 300, 'floor' => 99],
        'royalsignet' => ['name' => 'Royal Signet', 'desc' => 'Potions heal twice as much.', 'found' => "the King's justice", 'price' => 300, 'floor' => 99],
        'bloodtorc' => ['name' => 'Bloodfury Torc', 'desc' => '+3 attack while you are at half health or less.', 'found' => 'the Trial of Three', 'price' => 300, 'floor' => 99],
        'ledger' => ['name' => "Vessa's Ledger", 'desc' => '+25% gold, and merchants pay 70% when you sell.', 'found' => 'a Goldspire banker', 'price' => 300, 'floor' => 99],
        'deepheart' => ['name' => 'Heart of the Deep', 'desc' => '+3 attack, +3 defence, +15 max HP, and you see two tiles further in the dark.', 'found' => 'the bottom of the Dreaming Maw', 'price' => 1500, 'floor' => 99],
        'stormpearl' => ['name' => 'Stormcaller Pearl', 'desc' => 'Your ship sails three tiles a step, and sea beasts shy from it.', 'found' => 'a buried sea-chest', 'price' => 350, 'floor' => 99],
        'jadeseal' => ['name' => 'Seal of the Jade Throne', 'desc' => 'Waystone travel and sea passage cost half.', 'found' => "the Empress's favour", 'price' => 350, 'floor' => 99],
        'sunlotus' => ['name' => 'Lotus of the Sun', 'desc' => '+2 defence while the sun is up.', 'found' => "the Maharani's gift", 'price' => 350, 'floor' => 99],
        'bearcharm' => ['name' => 'Bear Charm of Severin', 'desc' => '+3 attack by night.', 'found' => "the Tsar's thanks", 'price' => 350, 'floor' => 99],
        'hollowcrown' => ['name' => 'Crown of the Hollow King', 'desc' => '+3 attack, +3 defence, and the stolen winds carry you two tiles a step in the wilds.', 'found' => 'the bottom of the Thousand-Step Barrow', 'price' => 1200, 'floor' => 99],
        'frostheart' => ['name' => 'Frostheart', 'desc' => '+4 defence, and no poison can touch you.', 'found' => 'the hall of Thrym, beyond the Frozen Gate', 'price' => 1200, 'floor' => 99],
        'crown' => ['name' => 'Crown of Aurum', 'desc' => '+2 attack, +2 defence and +10 max HP. The King\'s own gift.', 'found' => 'the end of the story', 'price' => 1000, 'floor' => 99],
    ],
    'bag_size' => 12,
];
