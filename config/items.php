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
    ],
    'armor' => [
        'leather' => ['name' => 'Leather armor', 'def' => 1, 'price' => 20, 'floor' => 1],
        'chain' => ['name' => 'Chain mail', 'def' => 2, 'price' => 65, 'floor' => 2],
        'scale' => ['name' => 'Scale mail', 'def' => 3, 'price' => 130, 'floor' => 3],
        'plate' => ['name' => 'Plate armor', 'def' => 4, 'price' => 240, 'floor' => 4],
    ],
    'consumables' => [
        'potion' => ['name' => 'Potion', 'heal' => 5, 'price' => 12, 'floor' => 1],
    ],
    'bag_size' => 12,
];
