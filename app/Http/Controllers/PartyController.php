<?php

namespace App\Http\Controllers;

use App\Game\Dungeon;
use App\Models\Character;
use App\Models\Party;
use App\Models\PartyMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Co-op parties. The server owns the shared floor: every move is resolved
 * here, monsters act on a timer that any request can advance, and clients
 * poll for snapshots. Transport is plain HTTP so it runs on any host.
 */
class PartyController extends Controller
{
    private const ACTION_GAP_MS = 110;

    private function hero(Request $request): Character
    {
        return $request->user()->character()->firstOrCreate([], ['name' => $request->user()->name]);
    }

    private function membership(Request $request): ?PartyMember
    {
        return PartyMember::with('party.members.user.character')->where('user_id', $request->user()->id)->first();
    }

    private function summary(Party $party, int $userId): array
    {
        return [
            'code' => $party->code,
            'floor' => $party->floor,
            'leader' => $party->leader_id === $userId,
            'members' => $party->members->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->user->character?->name ?? $m->user->name,
                'level' => $m->user->character?->level ?? 1,
                'in_dungeon' => $m->in_dungeon,
                'online' => $m->last_seen_at && $m->last_seen_at->gt(now()->subSeconds(20)),
            ])->values(),
        ];
    }

    // ---------- membership ----------

    public function show(Request $request): JsonResponse
    {
        $m = $this->membership($request);

        return response()->json(['party' => $m ? $this->summary($m->party, $request->user()->id) : null, 'in_dungeon' => $m?->in_dungeon ?? false]);
    }

    public function create(Request $request): JsonResponse
    {
        if ($this->membership($request)) {
            return response()->json(['message' => 'You are already in a party. Leave it first.'], 422);
        }
        $party = Party::create(['code' => Party::freshCode(), 'leader_id' => $request->user()->id]);
        $party->members()->create(['user_id' => $request->user()->id, 'last_seen_at' => now()]);

        return response()->json(['party' => $this->summary($party->fresh('members.user.character'), $request->user()->id)]);
    }

    public function join(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'size:6']]);
        if ($this->membership($request)) {
            return response()->json(['message' => 'You are already in a party. Leave it first.'], 422);
        }
        $party = Party::where('code', strtoupper($data['code']))->first();
        if (! $party) {
            return response()->json(['message' => 'No party has that code.'], 404);
        }
        if ($party->members()->count() >= 4) {
            return response()->json(['message' => 'That party is full (4 heroes).'], 422);
        }
        $party->members()->create(['user_id' => $request->user()->id, 'last_seen_at' => now()]);

        return response()->json(['party' => $this->summary($party->fresh('members.user.character'), $request->user()->id)]);
    }

    public function leave(Request $request): JsonResponse
    {
        $m = $this->membership($request);
        if ($m) {
            $party = $m->party;
            $m->delete();
            $remaining = $party->members()->get();
            if ($remaining->isEmpty()) {
                $party->delete();
            } elseif ($party->leader_id === $request->user()->id) {
                $party->update(['leader_id' => $remaining->first()->user_id]);
            }
            if ($m->in_dungeon) {
                $hero = $this->hero($request);
                $hero->floor = 0;
                $hero->save();
            }
        }

        return response()->json(['party' => null]);
    }

    // ---------- the shared floor ----------

    /** Step through the gate: join the party's current floor, starting one if the party is in town. */
    public function enter(Request $request): JsonResponse
    {
        $m = $this->membership($request);
        if (! $m) {
            return response()->json(['message' => 'You are not in a party.'], 422);
        }

        return DB::transaction(function () use ($request, $m) {
            $party = Party::lockForUpdate()->find($m->party_id);
            if ($party->floor === 0 || ! $party->state) {
                $party->floor = 1;
                $party->state = Dungeon::newFloor(1)->s;
            }
            $d = new Dungeon($party->state, $party->floor);
            [$sx, $sy] = $d->spawn();
            $m->fill(['in_dungeon' => true, 'x' => $sx, 'y' => $sy, 'last_seen_at' => now()])->save();
            $hero = $this->hero($request);
            if ($hero->floor === 0) {
                $hero->runs++;
            }
            $hero->floor = $party->floor;
            $hero->save();
            $d->log("{$hero->name} enters floor {$party->floor}.", 'good');
            $party->state = $d->s;
            $party->seq = $d->s['seq'];
            $party->save();

            return response()->json($this->fullState($request, $party, $m, $d, [], 0));
        });
    }

    public function state(Request $request): JsonResponse
    {
        $m = $this->membership($request);
        if (! $m || ! $m->in_dungeon) {
            return response()->json(['message' => 'Not on a shared floor.'], 409);
        }
        $want = array_filter(explode('|', (string) $request->query('chunks', '')));
        $since = (int) $request->query('since', 0);

        return DB::transaction(function () use ($request, $m, $want, $since) {
            $party = Party::lockForUpdate()->find($m->party_id);
            $d = new Dungeon($party->state, $party->floor);
            $m->last_seen_at = now();
            $m->save();
            $events = $this->maybeTick($party, $d);
            $party->state = $d->s;
            $party->seq = $d->s['seq'];
            $party->save();

            return response()->json($this->fullState($request, $party, $m->fresh(), $d, $want, $since, $events));
        });
    }

    public function act(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['move', 'wait', 'buy', 'sell', 'equip', 'drink'])],
            'dx' => ['nullable', 'integer', 'between:-1,1'],
            'dy' => ['nullable', 'integer', 'between:-1,1'],
            'item' => ['nullable', 'string', 'max:32'],
            'where' => ['nullable'],
            'since' => ['nullable', 'integer'],
            'chunks' => ['nullable', 'string'],
        ]);
        $m = $this->membership($request);
        if (! $m || ! $m->in_dungeon) {
            return response()->json(['message' => 'Not on a shared floor.'], 409);
        }

        return DB::transaction(function () use ($request, $m, $data) {
            $party = Party::lockForUpdate()->find($m->party_id);
            $d = new Dungeon($party->state, $party->floor);
            $hero = $this->hero($request);
            $nowMs = (int) (microtime(true) * 1000);
            $flags = [];
            if ($nowMs - $m->last_action_ms >= self::ACTION_GAP_MS) {
                $m->last_action_ms = $nowMs;
                if (in_array($data['type'], ['move', 'wait'], true)) {
                    $pos = ['x' => $m->x, 'y' => $m->y];
                    $others = $party->members->where('in_dungeon', true)->where('id', '!=', $m->id)->map(fn ($o) => [$o->x, $o->y])->values()->all();
                    $flags = $d->act($data, $hero, $pos, $m->id, $others);
                    $m->x = $pos['x'];
                    $m->y = $pos['y'];
                } else {
                    $flags = $this->shopAction($data, $hero, $d, $m);
                }
            }
            $m->last_seen_at = now();
            $m->save();
            $hero->save();
            $events = $this->maybeTick($party, $d);
            if (in_array('stairs', $flags, true)) {
                $events[] = $this->descend($party, $d);
            }
            $party->state = $d->s;
            $party->seq = $d->s['seq'];
            $party->save();
            $m = $m->fresh();
            $want = array_filter(explode('|', (string) ($data['chunks'] ?? '')));

            return response()->json($this->fullState($request, $party, $m, $d, $want, (int) ($data['since'] ?? 0), $events, $flags));
        });
    }

    // ---------- helpers ----------

    private function shopAction(array $data, Character $hero, Dungeon $d, PartyMember $m): array
    {
        $items = config('items');
        $all = $items['weapons'] + $items['armor'] + $items['consumables'];
        $bag = $hero->bag ?? [];
        $id = $data['item'] ?? null;
        $onShop = $d->tile($m->x, $m->y) === Dungeon::SHOP;
        if ($data['type'] === 'buy') {
            $deepest = max($d->floor, 1) + 1;
            if (! $onShop || ! isset($all[$id]) || $all[$id]['floor'] > $deepest) {
                return [];
            }
            if ($hero->gold < $all[$id]['price'] || count($bag) >= $items['bag_size']) {
                return [];
            }
            $hero->gold -= $all[$id]['price'];
            $bag[] = $id;
            $hero->bag = $bag;
            $d->log("You buy a {$all[$id]['name']} for {$all[$id]['price']} gold.", 'good', $m->id);
        } elseif ($data['type'] === 'sell') {
            if (! $onShop) {
                return [];
            }
            $where = $data['where'] ?? null;
            if ($where === 'weapon' && $hero->weapon) {
                $id = $hero->weapon;
                $hero->weapon = null;
            } elseif ($where === 'armor' && $hero->armor) {
                $id = $hero->armor;
                $hero->armor = null;
            } elseif (is_numeric($where) && isset($bag[(int) $where])) {
                $id = $bag[(int) $where];
                array_splice($bag, (int) $where, 1);
                $hero->bag = $bag;
            } else {
                return [];
            }
            $price = intdiv($all[$id]['price'], 2);
            $hero->gold += $price;
            $d->log("You sell the {$all[$id]['name']} for $price gold.", 'good', $m->id);
        } elseif ($data['type'] === 'equip') {
            $idx = (int) ($data['where'] ?? -1);
            if (! isset($bag[$idx])) {
                return [];
            }
            $id = $bag[$idx];
            $slot = isset($items['weapons'][$id]) ? 'weapon' : (isset($items['armor'][$id]) ? 'armor' : null);
            if (! $slot) {
                return [];
            }
            array_splice($bag, $idx, 1);
            if ($hero->$slot) {
                $bag[] = $hero->$slot;
            }
            $hero->$slot = $id;
            $hero->bag = $bag;
            $d->log("You equip the {$all[$id]['name']}.", 'good', $m->id);
        } elseif ($data['type'] === 'drink') {
            $idx = array_search('potion', $bag, true);
            if ($idx === false) {
                $d->log('You have no potions in your bag.', '', $m->id);

                return [];
            }
            array_splice($bag, $idx, 1);
            $hero->bag = $bag;
            $healed = min(5, $hero->max_hp - $hero->hp);
            $hero->hp += $healed;
            $d->log($healed > 0 ? "You drink a potion and heal $healed HP." : 'You drink a potion but were already at full health.', 'good', $m->id);
        }
        $d->bump();

        return [];
    }

    /** Advance monsters if the tick is due; returns death events for members who fell. */
    private function maybeTick(Party $party, Dungeon $d): array
    {
        if (! $d->tickDue()) {
            return [];
        }
        $members = [];
        $heroes = [];
        foreach ($party->members->where('in_dungeon', true) as $pm) {
            $hero = $pm->user->character;
            if (! $hero) {
                continue;
            }
            $heroes[$pm->id] = [$pm, $hero];
            $members[$pm->id] = ['x' => $pm->x, 'y' => $pm->y, 'hero' => $hero];
        }
        $dead = $d->tick($members);
        $events = [];
        foreach ($heroes as $id => [$pm, $hero]) {
            if (in_array($id, $dead, true)) {
                $d->log("{$hero->name} has fallen on floor {$party->floor}.", 'bad');
                $hero->best_floor = max($hero->best_floor, $party->floor);
                $hero->best_gold = max($hero->best_gold, $hero->gold);
                $hero->resetRun();
                $pm->in_dungeon = false;
                $pm->save();
                $events[] = ['type' => 'death', 'member' => $id];
            }
            $hero->save();
        }

        return $events;
    }

    /** Someone stepped on the stairs: the whole party moves down, or out if that was the last floor. */
    private function descend(Party $party, Dungeon $d): array
    {
        $next = $party->floor + 1;
        $members = $party->members->where('in_dungeon', true);
        if ($next > Dungeon::FINAL_FLOOR) {
            foreach ($members as $pm) {
                $hero = $pm->user->character;
                $hero->wins++;
                $hero->best_floor = max($hero->best_floor, $party->floor);
                $hero->best_gold = max($hero->best_gold, $hero->gold);
                $hero->floor = 0;
                $hero->save();
                $pm->in_dungeon = false;
                $pm->save();
            }
            $party->floor = 0;
            $fresh = Dungeon::newFloor(1);
            $fresh->log('The party escaped the dungeon! Everyone is back in town.', 'good');
            $d->s = $fresh->s;
            $d->s['seq'] = $party->seq + 1;
            $party->floor = 0;

            return ['type' => 'win'];
        }
        $fresh = Dungeon::newFloor($next);
        $fresh->s['seq'] = $d->s['seq'] + 1;
        $fresh->log("The party descends to floor $next.", 'good');
        [$sx, $sy] = $fresh->spawn();
        foreach ($members as $pm) {
            $pm->x = $sx;
            $pm->y = $sy;
            $pm->save();
            $hero = $pm->user->character;
            $hero->floor = $next;
            $hero->best_floor = max($hero->best_floor, $next);
            $hero->save();
        }
        $party->floor = $next;
        $d->s = $fresh->s;
        $d->floor = $next;

        return ['type' => 'floor', 'floor' => $next];
    }

    private function fullState(Request $request, Party $party, PartyMember $m, Dungeon $d, array $want, int $since, array $events = [], array $flags = []): array
    {
        $hero = $this->hero($request)->fresh();
        $members = $party->members()->with('user.character')->get();
        $snap = $party->floor > 0 ? $d->snapshot($m->x, $m->y, 36, $want, $since, $m->id) : ['seq' => $party->seq, 'floor' => 0, 'monsters' => [], 'potions' => [], 'golds' => [], 'shops' => [], 'chunks' => [], 'log' => $d->logSince($since, $m->id), 'hits' => [], 'exit' => null];
        $snap['me'] = [
            'id' => $m->id, 'x' => $m->x, 'y' => $m->y, 'in_dungeon' => $m->in_dungeon,
            'hp' => $hero->hp, 'max_hp' => $hero->max_hp, 'atk' => $hero->atk, 'level' => $hero->level, 'xp' => $hero->xp, 'gold' => $hero->gold,
            'weapon' => $hero->weapon, 'armor' => $hero->armor, 'bag' => $hero->bag ?? [], 'name' => $hero->name,
        ];
        $snap['members'] = $members->where('in_dungeon', true)->where('id', '!=', $m->id)->map(fn ($o) => [
            'id' => $o->id, 'name' => $o->user->character?->name ?? $o->user->name, 'x' => $o->x, 'y' => $o->y,
            'hp' => $o->user->character?->hp ?? 0, 'max_hp' => $o->user->character?->max_hp ?? 1, 'level' => $o->user->character?->level ?? 1,
        ])->values();
        $snap['party'] = $this->summary($party->setRelation('members', $members), $request->user()->id);
        $snap['events'] = $events;
        $snap['flags'] = $flags;

        return $snap;
    }
}
