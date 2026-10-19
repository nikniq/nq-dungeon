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
            'class' => ['nullable', Rule::in(Character::CLASSES)],
            'weapon' => ['nullable', Rule::in(array_keys(config('items.weapons')))],
            'armor' => ['nullable', Rule::in(array_keys(config('items.armor')))],
            'bag' => ['present', 'array', 'max:'.(config('items.bag_size') + 4)],   // +4 for the Packrat perk
            'quests' => ['nullable', 'array', 'max:12'],
            'quests.*.id' => ['required', 'string', 'max:60'],
            'quests.*.kind' => ['required', Rule::in(['clear', 'slay', 'boss', 'bounty'])],
            'quests.*.label' => ['required', 'string', 'max:120'],
            'quests.*.need' => ['required', 'integer', 'min:1', 'max:999'],
            'quests.*.have' => ['required', 'integer', 'min:0', 'max:999'],
            'quests.*.done' => ['required', 'boolean'],
            'quests.*.target' => ['nullable', 'string', 'max:60'],
            'quests.*.giver' => ['nullable', 'string', 'max:60'],
            'quests.*.reward' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'quests_done' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'perks' => ['nullable', 'array', 'max:60'],
            'perks.*' => ['string', 'max:24', 'regex:/^[a-z_]+$/'],
            'achievements' => ['nullable', 'array', 'max:60'],
            'achievements.*' => ['string', 'max:24', 'regex:/^[a-z_0-9]+$/'],
            'meta' => ['nullable', 'array', 'max:30'],
            'meta.visited' => ['nullable', 'array', 'max:80'],
            'meta.visited.*' => ['string', 'max:16', 'regex:/^-?\d+,-?\d+$/'],
            'meta.second_wind' => ['nullable', 'boolean'],
            // story and exploration progress
            'meta.story' => ['nullable', 'array'],
            'meta.story.ch' => ['required_with:meta.story', 'integer', 'min:0', 'max:5'],
            'meta.story.phase' => ['required_with:meta.story', Rule::in(['summons', 'seek', 'return', 'done'])],
            'meta.story.riders' => ['nullable', 'integer', 'min:0', 'max:5'],
            'meta.story.ambushed' => ['nullable', 'boolean'],
            'meta.rescued' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'meta.lairs' => ['nullable', 'array:known,slain'],
            'meta.lairs.known' => ['nullable', 'array', 'max:12'],
            'meta.lairs.known.*' => ['string', 'max:20'],
            'meta.lairs.slain' => ['nullable', 'array', 'max:12'],
            'meta.lairs.slain.*' => ['string', 'max:20'],
            'meta.act2' => ['nullable', 'array'],
            'meta.act2.s' => ['required_with:meta.act2', 'integer', 'min:0', 'max:6'],
            'meta.act2.n' => ['nullable', 'integer', 'min:0', 'max:100'],
            'meta.act2.told' => ['nullable', 'boolean'],
            'meta.places' => ['nullable', 'array', 'max:400'],
            'meta.places.*' => ['string', 'max:24', 'regex:/^-?\d+,-?\d+$/'],
            'meta.looted' => ['nullable', 'array', 'max:400'],
            'meta.looted.*' => ['string', 'max:24', 'regex:/^-?\d+,-?\d+$/'],
            'meta.found' => ['nullable', 'array', 'max:20'],
            'meta.found.*' => [Rule::in(array_keys(config('items.relics')))],
            'meta.bestiary' => ['nullable', 'array', 'max:40'],
            'meta.bestiary.*' => ['integer', 'min:0', 'max:1000000'],
            'meta.blessing' => ['nullable', 'array'],
            'meta.blessing.turns' => ['required_with:meta.blessing', 'integer', 'min:0', 'max:5000'],
            'meta.blessing.atk' => ['required_with:meta.blessing', 'integer', 'min:0', 'max:10'],
            'meta.blessing.def' => ['nullable', 'integer', 'min:0', 'max:10'],
            'meta.blessing.name' => ['nullable', 'string', 'max:40'],
            'meta.encounters' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'meta.room' => ['nullable', 'boolean'],
            'meta.stash' => ['nullable', 'array', 'max:20'],
            'meta.stash.*' => [Rule::in(array_merge(array_keys(config('items.weapons')), array_keys(config('items.armor')), array_keys(config('items.consumables')), array_keys(config('items.relics'))))],
            'meta.deepest' => ['nullable', 'integer', 'min:0', 'max:99'],
            'meta.horse' => ['nullable', 'boolean'],
            'meta.rod' => ['nullable', 'boolean'],
            'meta.war' => ['nullable', 'array'],
            'meta.war.troops' => ['nullable', 'array:cantons,aurum,kathar,league'],
            'meta.war.troops.*' => ['integer', 'min:0', 'max:100000'],
            'meta.war.armies' => ['nullable', 'array', 'max:12'],
            'meta.war.armies.*.realm' => ['required', Rule::in(['cantons', 'aurum', 'kathar', 'league'])],
            'meta.war.armies.*.x' => ['required', 'integer', 'between:-1000000,1000000'],
            'meta.war.armies.*.y' => ['required', 'integer', 'between:-1000000,1000000'],
            'meta.war.armies.*.tx' => ['required', 'integer', 'between:-1000000,1000000'],
            'meta.war.armies.*.ty' => ['required', 'integer', 'between:-1000000,1000000'],
            'meta.war.armies.*.troops' => ['required', 'integer', 'min:0', 'max:100000'],
            'meta.war.armies.*.target' => ['required', 'string', 'max:24', 'regex:/^-?\d+,-?\d+$/'],
            'meta.war.armies.*.mine' => ['required', 'boolean'],
            'meta.war.camps' => ['nullable', 'array', 'max:500'],
            'meta.war.camps.*' => ['string', 'max:24', 'regex:/^-?\d+,-?\d+$/'],
            'meta.arena' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'meta.rq' => ['nullable', 'array:cantons,aurum,kathar,league'],
            'meta.rq.*.s' => ['required', 'integer', 'min:0', 'max:5'],
            'meta.rq.*.n' => ['required', 'integer', 'min:0', 'max:1000000'],
            'meta.realm' => ['nullable', 'array'],
            'meta.realm.rank' => ['required_with:meta.realm', 'integer', 'min:0', 'max:3'],
            'meta.realm.standing' => ['required_with:meta.realm', 'integer', 'min:0', 'max:100000000'],
            'meta.realm.oath' => ['required_with:meta.realm', 'boolean'],
            'meta.realm.guild' => ['required_with:meta.realm', 'boolean'],
            'meta.realm.bank' => ['required_with:meta.realm', 'integer', 'min:0', 'max:100000000'],
            'meta.hound' => ['nullable', 'array'],
            'meta.hound.hp' => ['required_with:meta.hound', 'integer', 'min:0', 'max:999'],
            'meta.hound.max_hp' => ['required_with:meta.hound', 'integer', 'min:1', 'max:999'],
            'meta.hound.atk' => ['required_with:meta.hound', 'integer', 'min:1', 'max:99'],
            'meta.hound.level' => ['required_with:meta.hound', 'integer', 'min:1', 'max:99'],
            'meta.hound.kills' => ['required_with:meta.hound', 'integer', 'min:0', 'max:100000'],
            'meta.hound.down' => ['required_with:meta.hound', 'boolean'],
            'title' => ['nullable', 'string', 'max:40'],
            'weapon_plus' => ['nullable', 'integer', 'min:0', 'max:3'],
            'armor_plus' => ['nullable', 'integer', 'min:0', 'max:3'],
            'wx' => ['nullable', 'integer', 'between:-100000,100000'],
            'wy' => ['nullable', 'integer', 'between:-100000,100000'],
            'home' => ['nullable', 'string', 'max:16', 'regex:/^-?\d+,-?\d+$/'],
            'bag.*' => [Rule::in(array_merge(
                array_keys(config('items.weapons')),
                array_keys(config('items.armor')),
                array_keys(config('items.consumables')),
                array_keys(config('items.relics')),
            ))],
            'relic' => ['nullable', Rule::in(array_keys(config('items.relics')))],
        ]);

        $c = $this->current($request);
        $c->best_floor = max($c->best_floor, $data['floor']);
        $c->best_gold = max($c->best_gold, $data['gold']);
        $c->kills += $data['kills'];

        if ($data['event'] === 'progress') {
            if ($data['floor'] === 1 && $c->floor === 0) {
                $c->runs++;
            }
            $c->fill(collect($data)->only(['floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk', 'weapon', 'armor', 'relic', 'weapon_plus', 'armor_plus', 'bag', 'quests', 'quests_done', 'perks', 'achievements', 'meta', 'title', 'wx', 'wy', 'home', 'class'])->filter(fn ($v, $k) => $v !== null || in_array($k, ['weapon', 'armor', 'relic'], true))->all());
        } elseif ($data['event'] === 'win') {
            // Back to town with everything earned; only the floor resets.
            if ($c->floor === 0) {
                $c->runs++;
            }
            $c->wins++;
            $c->fill(collect($data)->only(['level', 'xp', 'gold', 'hp', 'max_hp', 'atk', 'weapon', 'armor', 'relic', 'weapon_plus', 'armor_plus', 'bag', 'quests', 'quests_done', 'perks', 'achievements', 'meta', 'title', 'wx', 'wy', 'home', 'class'])->filter(fn ($v, $k) => $v !== null || in_array($k, ['weapon', 'armor', 'relic'], true))->all());
            $c->floor = 0;
        } else {
            if ($c->floor === 0) {
                $c->runs++;
            }
            // death: the client sends the stats as they were at the moment of falling
            $c->fill(collect($data)->only(['level', 'xp', 'gold', 'max_hp', 'atk', 'weapon', 'armor', 'relic', 'weapon_plus', 'armor_plus', 'bag', 'perks', 'achievements', 'meta', 'title', 'wx', 'wy', 'home', 'class'])->filter(fn ($v, $k) => $v !== null || in_array($k, ['weapon', 'armor', 'relic'], true))->all());
            $c->fallInBattle();
            if (isset($data['quests_done'])) {
                $c->quests_done = $data['quests_done'];
            }
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
            'class' => ['required', Rule::in(Character::CLASSES)],
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
