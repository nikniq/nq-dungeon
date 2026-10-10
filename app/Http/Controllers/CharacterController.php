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
            'wx' => ['nullable', 'integer', 'between:-100000,100000'],
            'wy' => ['nullable', 'integer', 'between:-100000,100000'],
            'home' => ['nullable', 'string', 'max:16', 'regex:/^-?\d+,-?\d+$/'],
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
            $c->fill(collect($data)->only(['floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk', 'weapon', 'armor', 'bag', 'wx', 'wy', 'home'])->filter(fn ($v) => $v !== null)->all());
        } elseif ($data['event'] === 'win') {
            // Back to town with everything earned; only the floor resets.
            if ($c->floor === 0) {
                $c->runs++;
            }
            $c->wins++;
            $c->fill(collect($data)->only(['level', 'xp', 'gold', 'hp', 'max_hp', 'atk', 'weapon', 'armor', 'bag', 'wx', 'wy', 'home'])->filter(fn ($v) => $v !== null)->all());
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
        $c = $this->current($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:24', 'regex:/^[\pL\pN][\pL\pN _-]*$/u', fn ($attr, $value, $fail) => Character::nameTaken($value, $c->id) && $fail('That hero name is already taken.')],
            'bio' => ['nullable', 'string', 'max:280'],
        ], [], ['name' => 'hero name']);
        $c->update($data);

        return redirect()->route('character.edit')->with('status', 'Profile saved.');
    }

    public function abandon(Request $request): RedirectResponse
    {
        $c = $this->current($request);
        $c->resetRun();
        $c->save();

        return redirect()->route('character.edit')->with('status', 'Your hero starts fresh in town.');
    }
}
