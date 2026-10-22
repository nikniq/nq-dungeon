<?php

// Notes for the public item catalogue (/world/items). The items themselves come
// from config/items.php; this adds what the game script knows about them: weapon
// fighting styles (WEAPON_TRAITS in script.js), where the one-of-a-kind gear
// drops (LAIRS), what consumables do, and the other things a hero can acquire.

return [
    'traits' => [
        'dagger' => ['Quick', 'sneak attacks deal triple damage, and one stab in five strikes twice'],
        'short_sword' => ['Keen', 'one hit in five is a critical for double damage'],
        'mace' => ['Stunning', 'one hit in four stuns the target for a turn'],
        'dawnbreaker' => ['Sundering', 'every blow also strips a tenth of the foe\'s full health, and the blade lights two tiles further'],
        'longsword' => ['Parrying', 'parries one melee blow in five'],
        'warhammer' => ['Crushing', 'knocks foes back a tile, or slams them into a wall for +3; breaks cracked walls and totems in one blow'],
        'greatsword' => ['Cleaving', 'also hits every other foe beside you for half damage'],
    ],
    // legendary gear borrows a common weapon's style and drops from one super boss
    'legendary' => [
        'fangblade' => ['style' => 'dagger', 'from' => "Mother Venom, the Spider Queen, in the Spider Queen's Hollow"],
        'tidecaller' => ['style' => 'longsword', 'from' => "the Drowned King, in the Drowned King's Hall"],
        'stormhammer' => ['style' => 'warhammer', 'from' => "the Direwolf matriarch, in the Direwolf's Den"],
        'staffofages' => ['style' => 'greatsword', 'from' => "the Lich, in the Lich's Observatory"],
        'dawnbreaker' => ['style' => 'dawnbreaker', 'from' => 'any master smith, who reforges it once the Hilt of Dawn (the Forge of the First King), the Blade of Dawn (the Glass Pagoda, on the Far Shore) and the Sunstone Pommel (the Cairn of the Sun, on the ice of Thule) are won from their wardens'],
        'trollhide' => ['from' => "Old Grumm, under Old Grumm's Bridge"],
        'wyrmscale' => ['from' => "Scald, the Old Wyrm, in the Wyrm's Roost"],
    ],
    // the trade shops: one in every town, by the town's trade
    'tradeshops' => [
        'fishing' => 'The Fishmonger', 'salt' => 'The Salt House', 'mining' => "The Miners' Store", 'quarrying' => "The Mason's Yard", 'timber' => 'The Woodyard', 'hunting' => "The Hunters' Lodge",
        'farming' => 'The Granary', 'wine' => "The Vintner's", 'wool' => 'The Woolmonger', 'bees' => 'The Honey House', 'pottery' => "The Potter's Kiln", 'brewing' => 'The Brewery', 'horses' => 'The Saddlery',
        'shipping' => "The Chandler's", 'smithing' => 'The Master Smith', 'glass' => 'The Glassworks', 'silk' => 'The Silk House', 'rice' => 'The Rice Store', 'tea' => 'The Tea House', 'porcelain' => 'The Porcelain Works',
        'spices' => 'The Spice Bazaar', 'cotton' => "The Dyers' Hall", 'furs' => 'The Fur Trader',
    ],
    'consumables' => [
        'potion' => 'Drink (P) to heal; cures poison. Twice as strong with the Royal Signet.',
        'elixir' => 'A strong potion for the deep floors.',
        'bomb' => 'Throw (B) to blast a 3x3 area, hurting everything in it and knocking it back.',
        'scroll' => 'Read (T) to be whisked back to your home town from anywhere.',
        'manapotion' => 'Restores mana for your class abilities.',
        'fish' => 'Caught with a rod in any water. Eat for a little health, sell, or have an inn cook it.',
        'stew' => 'Fresh fish cooked at an inn for a couple of coins each: a proper meal.',
        'goldcarp' => 'A rare catch (also dug from sea-chests). Merchants pay well for it.',
    ],
    'where' => [
        'tradeshops' => 'Every town also keeps a trade shop of its own kind, by the trade the town is known for: a fishmonger, a vintner, a master smith, a spice bazaar and so on. Each sells specialities found nowhere else; the town profiles on the towns page say which shop a town has.',
        'shops' => 'Merchants in every town square stock weapons, armour and consumables from the floor shown onward; specialist shops in cities and the merchant caravan on the roads carry more. Smithies and armouries sharpen and reinforce worn gear up to +3.',
        'drops' => 'Monsters drop gear and consumables as they fall, more deeply underground and from elites and bosses; treasure chests, vaults behind cracked walls, ruins and battlefields hold more.',
        'relics' => 'Relics are one of a kind. Each is found in a particular place, given by a ruler for a questline, or buried where a treasure chart points. Wear one at a time from the inventory; the rest wait in your bag or inn chest.',
        'legendary' => 'Legendary gear drops only from the six super bosses in their hidden lairs, which bards, hermits and prophets can point you to.',
        'dawnbreaker' => 'Dawnbreaker, the sword of the First King, is the one weapon above the legendaries. Any master smith (the trade shop of a smithing town) tells the tale to a hero of level 12 or more, marks the first warden on the map, and reforges the sword when all three pieces are won.',
    ],
    'other' => [
        ['A horse', '400 gold at the inns of cities and castles (a quarter off in horse-breeding towns)', 'two tiles a step in the open wilds'],
        ['A ship', '1500 gold from any harbourmaster (a quarter off in shipping ports), once Story 2 has begun and the Veil has parted', 'sail the open sea two tiles a step, land on any shore, and your pets ride on deck'],
        ['A treasure chart', '300 gold from any harbourmaster, or from pirates, wrecks and castaways', 'marks a sea-chest on an island: gold, the Stormcaller Pearl the first time, gear after'],
        ['Pets', 'at inns, each realm its own: cats, hounds, hawks, huskies, mongooses, wolves, boars, bears and elephants, 40 to 700 gold', 'up to three follow, fight, grow with kills and come aboard your ship'],
        ['A room at the inn', '150 gold, once', 'a storage chest at every inn in the world'],
        ['Titles, oaths and ranks', 'at a realm\'s seat: knighthoods in Aurum, the clan oath, the merchant guild, public works, the imperial examination, the pilgrimage of nine gates, the boyar council', 'standing with the realms, cheaper travel, and a title to wear'],
        ['Soldiers', 'at a realm\'s seat from level 50', 'an army to send against the orc warcamps'],
        ['Monuments', 'built for everyone with gold at an innkeeper, in the plots of any town square', 'fountains, shrines, caches and beacons that every hero can use'],
    ],
];
