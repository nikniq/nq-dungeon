<?php

namespace App\Http\Controllers;

use App\Models\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class CharacterController extends Controller
{
    /** The signed-in player's character, created on demand for accounts that predate it. */
    private function current(Request $request): Character
    {
        return $request->user()->character()->firstOrCreate([], ['name' => $request->user()->name]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->current($request));
    }

    /**
     * The game posts its state while a run is in progress and at the end of one.
     * event: 'progress' (periodic, on floor change, on page hide), 'death' or 'win'.
     * floor 0 is the town square: a hero there is between dives.
     */
    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event' => ['required', 'in:progress,death,win'],
            'floor' => ['required', 'integer', 'min:0', 'max:99'],
            'level' => ['required', 'integer', 'min:1', 'max:999'],
            'xp' => ['required', 'integer', 'min:0'],
            'gold' => ['required', 'integer', 'min:0'],
            'hp' => ['required', 'integer', 'min:0', 'max:9999'],
            'max_hp' => ['required', 'integer', 'min:1', 'max:9999'],
            'atk' => ['required', 'integer', 'min:1', 'max:999'],
            'kills' => ['required', 'integer', 'min:0'],
            'weapon' => ['nullable', Rule::in(array_keys(config('items.weapons')))],
            'armor' => ['nullable', Rule::in(array_keys(config('items.armor')))],
            'bag' => ['present', 'array', 'max:'.config('items.bag_size')],
            'bag.*' => [Rule::in(array_merge(
                array_keys(config('items.weapons')),
                array_keys(config('items.armor')),
                array_keys(config('items.consumables')),
            ))],
        ]);

        $c = $this->current($request);
        $c->best_floor = max($c->best_floor, $data['floor']);
        $c->best_gold = max($c->best_gold, $data['gold']);
        $c->kills += $data['kills'];

        if ($data['event'] === 'progress') {
            if ($data['floor'] === 1 && $c->floor === 0) {
                $c->runs++;
            }
            $c->fill(collect($data)->only(['floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk', 'weapon', 'armor', 'bag'])->all());
        } elseif ($data['event'] === 'win') {
            // Back to town with everything earned; only the floor resets.
            if ($c->floor === 0) {
                $c->runs++;
            }
            $c->wins++;
            $c->fill(collect($data)->only(['level', 'xp', 'gold', 'hp', 'max_hp', 'atk', 'weapon', 'armor', 'bag'])->all());
            $c->floor = 0;
        } else {
            if ($c->floor === 0) {
                $c->runs++;
            }
            $c->resetRun();
        }
        $c->save();

        return response()->json($c);
    }

    public function edit(Request $request): View
    {
        return view('auth.character', ['character' => $this->current($request), 'items' => config('items')]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:24']]);
        $this->current($request)->update($data);

        return redirect()->route('game')->with('status', 'Character renamed.');
    }

    public function abandon(Request $request): RedirectResponse
    {
        $c = $this->current($request);
        $c->resetRun();
        $c->save();

        return redirect()->route('game')->with('status', 'Run abandoned. Your hero starts fresh.');
    }
}
