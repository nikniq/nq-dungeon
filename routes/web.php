<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()
    ->view('game')
    ->header('Cache-Control', 'no-cache, no-store, must-revalidate'))
    ->name('game');
