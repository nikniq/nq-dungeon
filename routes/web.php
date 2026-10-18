<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CharacterController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\HeroController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MultiplayerController;
use App\Http\Controllers\TownBuildingController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::get('/play', fn () => response()
    ->view('game')
    ->header('Cache-Control', 'no-cache, no-store, must-revalidate'))
    ->name('game');

// monuments in town squares: anyone can look, signed-in heroes build
Route::get('/api/buildings', [TownBuildingController::class, 'index'])->name('buildings.index');
Route::get('/heroes', [HeroController::class, 'index'])->name('heroes.index');
Route::get('/heroes/{character}', [HeroController::class, 'show'])->name('heroes.show');

Route::middleware('guest')->group(function () {
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register']);
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('google.redirect');
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('google.callback');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/character', [CharacterController::class, 'edit'])->name('character.edit');
    Route::post('/character', [CharacterController::class, 'update'])->name('character.update');
    Route::post('/character/abandon', [CharacterController::class, 'abandon'])->name('character.abandon');
    Route::get('/api/character', [CharacterController::class, 'show'])->name('character.show');
    Route::post('/api/character', [CharacterController::class, 'save'])->name('character.save');
    Route::middleware('throttle:30,1')->post('/api/buildings', [TownBuildingController::class, 'build'])->name('buildings.build');
    Route::middleware('throttle:30,1')->post('/api/buildings/upgrade', [TownBuildingController::class, 'upgrade'])->name('buildings.upgrade');
    // multiplayer relay
    Route::middleware('throttle:400,1')->post('/api/mp/sync', [MultiplayerController::class, 'sync'])->name('mp.sync');
    Route::post('/api/mp/invite', [MultiplayerController::class, 'invite'])->name('mp.invite');
    Route::post('/api/mp/accept', [MultiplayerController::class, 'accept'])->name('mp.accept');
    Route::post('/api/mp/leave', [MultiplayerController::class, 'leave'])->name('mp.leave');
    Route::post('/api/mp/enter', [MultiplayerController::class, 'enter'])->name('mp.enter');
    Route::post('/api/mp/floor', [MultiplayerController::class, 'floor'])->name('mp.floor');
});
