<?php

use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

// The game is a static page: no login, no forms, no state on the server.
// It runs without the session stack so it cannot 500 when the host's .env
// points sessions at a database that has not been migrated.
Route::get('/', fn () => response()
    ->view('game')
    ->header('Cache-Control', 'no-cache, no-store, must-revalidate'))
    ->withoutMiddleware([
        EncryptCookies::class,
        AddQueuedCookiesToResponse::class,
        StartSession::class,
        ShareErrorsFromSession::class,
        ValidateCsrfToken::class,
    ])
    ->name('game');
