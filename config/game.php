<?php

// Switches for optional game features. Change them in .env, then run
// `php artisan optimize` on the server so the cached config picks them up.

return [
    // Realm ids the game script knows, for validating saved quest and army state.
    'realms' => ['cantons', 'aurum', 'kathar', 'league', 'tianxia', 'suryadesh', 'severin'],
    // Story 5, the rebuilding: structures a hero can sponsor in any town. The
    // world effects (walls, a new building, a memorial, paved roads) are in script.js.
    'projects' => [
        'walls' => ['name' => 'Town walls', 'cost' => 1200, 'desc' => 'a ring of stone with towers and gates, for a town that has none'],
        'watch' => ['name' => 'A watch house', 'cost' => 450, 'desc' => 'a barracks for the town watch'],
        'smithy' => ['name' => 'A smithy', 'cost' => 500, 'desc' => 'a forge to sharpen and reinforce gear'],
        'market' => ['name' => 'A market hall', 'cost' => 600, 'desc' => 'a covered market with more to buy'],
        'apothecary' => ['name' => 'An apothecary', 'cost' => 450, 'desc' => 'potions and remedies'],
        'armoury' => ['name' => 'An armoury', 'cost' => 550, 'desc' => 'armour, and a place to mend it'],
        'memorial' => ['name' => 'A memorial of the Long Night', 'cost' => 500, 'desc' => 'a monument in the square to those who fell, with your name on the plinth'],
        'road' => ['name' => 'Paved roads', 'cost' => 350, 'desc' => 'the roads out of town paved in stone, and cheaper travel from its waystone'],
    ],
    // Pet kinds the game script knows, for validating saved companions.
    'pets' => ['cat', 'hound', 'husky', 'mongoose', 'hawk', 'wolf', 'boar', 'bear', 'elephant'],

    // Live multiplayer: seeing other heroes, chat, parties and shared dungeons.
    // When off, the game is single-player only and the relay endpoints return 404.
    'multiplayer' => (bool) env('MULTIPLAYER_ENABLED', true),

    // Monuments heroes build in town squares for everyone to use. Each town has
    // `building_slots` plots; level 1 costs building_costs[0], upgrading to level
    // 2 costs [1], to level 3 costs [2]. Effects are implemented in script.js.
    'building_slots' => 3,
    'building_costs' => [300, 600, 1200],
    'buildings' => [
        'fountain' => ['name' => "Hero's Fountain", 'levels' => ['heals 30% of your health', 'heals 60% of your health', 'heals you fully and cures poison']],
        'shrine' => ['name' => 'Shrine of Valour', 'levels' => ['+1 attack for 300 turns', '+2 attack for 400 turns', '+2 attack and +1 defence for 500 turns']],
        'cache' => ['name' => "Adventurers' Cache", 'levels' => ['a free potion', 'a free potion and a bomb', 'a free elixir and a bomb']],
        'beacon' => ['name' => 'Signal Beacon', 'levels' => ['marks the places around this town on your map', 'marks places two regions out', 'marks places three regions out']],
    ],
];
