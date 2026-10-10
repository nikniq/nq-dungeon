<?php

namespace App\Http\Controllers;

use App\Models\Character;
use Illuminate\Http\Response;

class HomeController extends Controller
{
    public function index(): Response
    {
        $leaders = Character::query()
            ->orderByDesc('wins')->orderByDesc('best_floor')->orderByDesc('best_gold')->orderByDesc('kills')
            ->limit(10)->get();

        return response()
            ->view('home', ['leaders' => $leaders, 'heroCount' => Character::count()])
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}
