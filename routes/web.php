<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CharacterController;
use App\Http\Controllers\HeroController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::get('/play', fn () => response()
    ->view('game')
    ->header('Cache-Control', 'no-cache, no-store, must-revalidate'))
    ->name('game');

Route::get('/heroes', [HeroController::class, 'index'])->name('heroes.index');
Route::get('/heroes/{character}', [HeroController::class, 'show'])->name('heroes.show');

Route::middleware('guest')->group(function () {
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register']);
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/character', [CharacterController::class, 'edit'])->name('character.edit');
    Route::post('/character', [CharacterController::class, 'update'])->name('character.update');
    Route::post('/character/abandon', [CharacterController::class, 'abandon'])->name('character.abandon');
    Route::get('/api/character', [CharacterController::class, 'show'])->name('character.show');
    Route::post('/api/character', [CharacterController::class, 'save'])->name('character.save');
});
