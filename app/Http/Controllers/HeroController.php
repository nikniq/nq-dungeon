<?php

namespace App\Http\Controllers;

use App\Models\Character;
use Illuminate\Http\Request;
use Illuminate\View\View;

class HeroController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $heroes = Character::query()
            ->when($q !== '', fn ($query) => $query->where('name', 'like', '%'.$q.'%'))
            ->orderByDesc('wins')->orderByDesc('best_floor')->orderByDesc('best_gold')->orderBy('name')
            ->paginate(20)->withQueryString();

        return view('heroes.index', ['heroes' => $heroes, 'q' => $q]);
    }

    public function show(Character $character): View
    {
        $rank = Character::query()
            ->where(function ($q) use ($character) {
                $q->where('wins', '>', $character->wins)
                    ->orWhere(fn ($w) => $w->where('wins', $character->wins)->where('best_floor', '>', $character->best_floor))
                    ->orWhere(fn ($w) => $w->where('wins', $character->wins)->where('best_floor', $character->best_floor)->where('best_gold', '>', $character->best_gold));
            })->count() + 1;

        return view('heroes.show', ['character' => $character, 'rank' => $rank, 'items' => config('items')]);
    }
}
