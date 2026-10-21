<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\DelveController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CharacterController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\HeroController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MultiplayerController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\TownBuildingController;
use App\Http\Controllers\TownProjectController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::get('/play', fn () => response()
    ->view('game')
    ->header('Cache-Control', 'no-cache, no-store, must-revalidate'))
    ->name('game');

// monuments in town squares: anyone can look, signed-in heroes build
Route::get('/api/buildings', [TownBuildingController::class, 'index'])->name('buildings.index');
Route::get('/api/projects', [TownProjectController::class, 'index'])->name('projects.index');
Route::get('/api/delve', [DelveController::class, 'today'])->name('delve.today');
// public glossaries, drawn in the browser from the game's own world generator
Route::get('/world/towns', fn () => view('glossary', ['kind' => 'towns']))->name('world.towns');
Route::get('/world/characters', fn () => view('glossary', ['kind' => 'characters']))->name('world.characters');
Route::get('/world/story', [StoryController::class, 'index'])->name('world.story');
Route::get('/world/items', fn () => view('items'))->name('world.items');
Route::post('/world/story', [StoryController::class, 'post'])->middleware(['auth', 'throttle:10,1'])->name('world.story.post');
Route::get('/heroes', [HeroController::class, 'index'])->name('heroes.index');
Route::get('/heroes/{character}', [HeroController::class, 'show'])->name('heroes.show');

Route::middleware('guest')->group(function () {
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register']);
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/login/link', [AuthController::class, 'showLinkRequest'])->name('login.link');
    Route::middleware('throttle:5,1')->post('/login/link', [AuthController::class, 'requestLink']);
    Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('google.redirect');
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('google.callback');
});

// the link from the email: signed, two days, proves the address and signs its owner in
Route::get('/verify/{user}/{hash}', [AuthController::class, 'verify'])->middleware('signed')->name('verify');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/password', [AuthController::class, 'showSetPassword'])->name('password.set');
    Route::post('/password', [AuthController::class, 'setPassword']);
    Route::get('/character', [CharacterController::class, 'edit'])->name('character.edit');
    Route::post('/character', [CharacterController::class, 'update'])->name('character.update');
    Route::post('/character/abandon', [CharacterController::class, 'abandon'])->name('character.abandon');
    Route::get('/api/character', [CharacterController::class, 'show'])->name('character.show');
    Route::post('/api/character', [CharacterController::class, 'save'])->name('character.save');
    Route::middleware('throttle:30,1')->post('/api/buildings', [TownBuildingController::class, 'build'])->name('buildings.build');
    Route::middleware('throttle:30,1')->post('/api/buildings/upgrade', [TownBuildingController::class, 'upgrade'])->name('buildings.upgrade');
    Route::middleware('throttle:30,1')->post('/api/projects', [TownProjectController::class, 'sponsor'])->name('projects.sponsor');
    Route::middleware('throttle:30,1')->post('/api/delve', [DelveController::class, 'submit'])->name('delve.submit');
    // multiplayer relay
    Route::middleware('throttle:400,1')->post('/api/mp/sync', [MultiplayerController::class, 'sync'])->name('mp.sync');
    Route::post('/api/mp/invite', [MultiplayerController::class, 'invite'])->name('mp.invite');
    Route::post('/api/mp/accept', [MultiplayerController::class, 'accept'])->name('mp.accept');
    Route::post('/api/mp/leave', [MultiplayerController::class, 'leave'])->name('mp.leave');
    Route::post('/api/mp/enter', [MultiplayerController::class, 'enter'])->name('mp.enter');
    Route::post('/api/mp/floor', [MultiplayerController::class, 'floor'])->name('mp.floor');
});

// the admin section: users, heroes, posts and structures, for users with the admin flag
Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [AdminController::class, 'index'])->name('index');
    Route::get('/users', [AdminController::class, 'users'])->name('users');
    Route::post('/users/{user}/admin', [AdminController::class, 'toggleAdmin'])->name('users.toggle');
    Route::delete('/users/{user}', [AdminController::class, 'destroyUser'])->name('users.destroy');
    Route::get('/heroes', [AdminController::class, 'heroes'])->name('heroes');
    Route::post('/heroes/{character}', [AdminController::class, 'updateHero'])->name('heroes.update');
    Route::post('/heroes/{character}/reset', [AdminController::class, 'resetHero'])->name('heroes.reset');
    Route::get('/posts', [AdminController::class, 'posts'])->name('posts');
    Route::delete('/posts/{post}', [AdminController::class, 'destroyPost'])->name('posts.destroy');
    Route::get('/structures', [AdminController::class, 'structures'])->name('structures');
    Route::delete('/projects/{project}', [AdminController::class, 'destroyProject'])->name('projects.destroy');
    Route::delete('/buildings/{building}', [AdminController::class, 'destroyBuilding'])->name('buildings.destroy');
});
