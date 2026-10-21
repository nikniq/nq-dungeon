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
        // sold only by the trade shops of their towns
        'quarrypick' => ['name' => "Quarryman's pick", 'atk' => 3, 'price' => 70, 'floor' => 99, 'trade' => 'quarrying'],
        'steelaxe' => ['name' => 'Steel axe', 'atk' => 5, 'price' => 200, 'floor' => 99, 'trade' => 'smithing'],
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
        // cloaks of the trade shops
        'hunterscloak' => ['name' => "Hunter's cloak", 'def' => 2, 'price' => 80, 'floor' => 99, 'trade' => 'hunting'],
        'woolcloak' => ['name' => 'Grey wool cloak', 'def' => 1, 'price' => 35, 'floor' => 99, 'trade' => 'wool'],
        'silkcloak' => ['name' => 'Silk cloak', 'def' => 2, 'price' => 160, 'floor' => 99, 'trade' => 'silk'],
        'furcloak' => ['name' => 'Sable fur cloak', 'def' => 3, 'price' => 150, 'floor' => 99, 'trade' => 'furs'],
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
        // the specialities of the trade shops: each sold only in towns of that trade (floor 99: never stocked elsewhere)
        'smokedeel' => ['name' => 'Smoked eel', 'heal' => 10, 'cure' => true, 'price' => 18, 'floor' => 99, 'trade' => 'fishing', 'desc' => 'heals and purges poison'],
        'saltedham' => ['name' => 'Salted ham', 'heal' => 12, 'price' => 20, 'floor' => 99, 'trade' => 'salt', 'desc' => 'a solid meal'],
        'ironrations' => ['name' => 'Iron rations', 'heal' => 8, 'buff' => ['def' => 1, 'turns' => 200], 'price' => 22, 'floor' => 99, 'trade' => 'mining', 'desc' => 'heals and hardens you: +1 defence for 200 turns'],
        'whetstone' => ['name' => 'Whetstone', 'heal' => 0, 'verb' => 'use', 'buff' => ['atk' => 2, 'turns' => 200], 'price' => 30, 'floor' => 99, 'trade' => 'quarrying', 'desc' => '+2 attack for 200 turns'],
        'torch' => ['name' => 'Pitch torch', 'heal' => 0, 'verb' => 'light', 'light' => 400, 'price' => 20, 'floor' => 99, 'trade' => 'timber', 'desc' => 'you see two tiles further underground for 400 turns'],
        'venisonpie' => ['name' => 'Venison pie', 'heal' => 14, 'price' => 24, 'floor' => 99, 'trade' => 'hunting', 'desc' => 'a hunter\'s meal'],
        'harvestloaf' => ['name' => 'Harvest loaf', 'heal' => 9, 'mana' => 10, 'price' => 16, 'floor' => 99, 'trade' => 'farming', 'desc' => 'heals and restores a little mana'],
        'redwine' => ['name' => 'Red wine', 'heal' => 4, 'buff' => ['atk' => 1, 'def' => 1, 'turns' => 150], 'price' => 28, 'floor' => 99, 'trade' => 'wine', 'desc' => 'courage in a bottle: +1 attack and defence for 150 turns'],
        'honeymead' => ['name' => 'Honey mead', 'heal' => 8, 'mana' => 15, 'price' => 24, 'floor' => 99, 'trade' => 'bees', 'desc' => 'heals and restores mana'],
        'firepot' => ['name' => 'Firepot', 'use' => 'bomb', 'price' => 18, 'floor' => 99, 'trade' => 'pottery', 'desc' => 'a clay bomb: blasts a 3x3 area, cheaper than the merchants\' kind'],
        'darkale' => ['name' => 'Dark ale', 'heal' => 3, 'buff' => ['atk' => 3, 'turns' => 80], 'price' => 26, 'floor' => 99, 'trade' => 'brewing', 'desc' => 'a fighting fury: +3 attack for 80 turns'],
        'horsebalm' => ['name' => 'Horse balm', 'heal' => 0, 'verb' => 'use', 'petheal' => true, 'price' => 35, 'floor' => 99, 'trade' => 'horses', 'desc' => 'patches up every pet you keep, wherever you are'],
        'rum' => ['name' => 'Sailors\' rum', 'heal' => 6, 'buff' => ['atk' => 1, 'turns' => 120], 'price' => 22, 'floor' => 99, 'trade' => 'shipping', 'desc' => 'heals, and +1 attack for 120 turns'],
        'spyglass' => ['name' => 'Spyglass', 'heal' => 0, 'verb' => 'use', 'reveal' => true, 'price' => 60, 'floor' => 99, 'trade' => 'glass', 'desc' => 'marks the places within two regions on your map'],
        'ricewine' => ['name' => 'Rice wine', 'heal' => 7, 'mana' => 10, 'price' => 20, 'floor' => 99, 'trade' => 'rice', 'desc' => 'heals and restores a little mana'],
        'jasminetea' => ['name' => 'Jasmine tea', 'heal' => 2, 'mana' => 25, 'cure' => true, 'price' => 26, 'floor' => 99, 'trade' => 'tea', 'desc' => 'restores mana and purges poison'],
        'porcelainvial' => ['name' => 'Porcelain vial', 'heal' => 30, 'price' => 55, 'floor' => 99, 'trade' => 'porcelain', 'desc' => 'a strong draught in fine china'],
        'curry' => ['name' => 'Fire curry', 'heal' => 16, 'buff' => ['atk' => 1, 'turns' => 120], 'price' => 30, 'floor' => 99, 'trade' => 'spices', 'desc' => 'heals, and +1 attack for 120 turns'],
        'bandage' => ['name' => 'Cotton bandage', 'heal' => 12, 'cure' => true, 'price' => 20, 'floor' => 99, 'trade' => 'cotton', 'desc' => 'heals and purges poison'],
        'bearfat' => ['name' => 'Bear fat', 'heal' => 10, 'buff' => ['def' => 2, 'turns' => 150], 'price' => 32, 'floor' => 99, 'trade' => 'furs', 'desc' => 'heals and keeps the cold out: +2 defence for 150 turns'],
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
        'riftheart' => ['name' => 'Riftheart', 'desc' => '+2 attack and +2 defence; a shard of the door between worlds.', 'found' => 'the Rift Lord', 'price' => 1500, 'floor' => 99],
        'founderseal' => ['name' => "Founder's Seal", 'desc' => '+15% gold from the floor and from chests, and +1 defence. The realms remember who rebuilt them.', 'found' => 'the rebuilding of the realms', 'price' => 900, 'floor' => 99],
        'crown' => ['name' => 'Crown of Aurum', 'desc' => '+2 attack, +2 defence and +10 max HP. The King\'s own gift.', 'found' => 'the end of the story', 'price' => 1000, 'floor' => 99],
    ],
    // Magic items: a dropped weapon or armour may carry one affix and a tier (I to III),
    // written into its id as base~affix~tier. Effects are in script.js; the server
    // validates the parts (Character::validItem) and the pages name them.
    'affixes' => [
        'weapon' => [
            'flaming' => ['name' => 'Flaming', 'desc' => 'sets what it hits burning for a few turns'],
            'venom' => ['name' => 'Venomous', 'desc' => 'poisons what it hits'],
            'frost' => ['name' => 'Frost', 'desc' => 'may freeze the foe for a turn'],
            'vampiric' => ['name' => 'Vampiric', 'desc' => 'heals you for part of the damage you deal'],
            'keen' => ['name' => 'Keen', 'desc' => 'strikes critical blows for double damage'],
            'heavy' => ['name' => 'Heavy', 'desc' => '+2 attack on top of its tier'],
        ],
        'armor' => [
            'sturdy' => ['name' => 'Sturdy', 'desc' => '+1 defence on top of its tier'],
            'warded' => ['name' => 'Warded', 'desc' => 'no poison can touch you'],
            'swift' => ['name' => 'Swift', 'desc' => 'you dodge some blows outright'],
            'blessed' => ['name' => 'Blessed', 'desc' => 'you heal a point every few turns'],
            'spiked' => ['name' => 'Spiked', 'desc' => 'whatever strikes you is hurt in return'],
            'fireproof' => ['name' => 'Fireproof', 'desc' => 'lava burns you half as much'],
        ],
    ],
    'bag_size' => 12,
];
