<?php

// Switches for optional game features. Change them in .env, then run
// `php artisan optimize` on the server so the cached config picks them up.

return [
    // Live multiplayer: seeing other heroes, chat, parties and shared dungeons.
    // When off, the game is single-player only and the relay endpoints return 404.
    'multiplayer' => (bool) env('MULTIPLAYER_ENABLED', true),
];
