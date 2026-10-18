<?php

// Switches for optional game features. Change them in .env, then run
// `php artisan optimize` on the server so the cached config picks them up.

return [
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
