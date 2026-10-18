<?php

namespace App\Http\Controllers;

use App\Models\TownBuilding;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Monuments in town squares. Any hero can see them; signed-in heroes pay gold
 * at an inn to build one on an empty plot or to upgrade one that stands.
 * The gold comes off the hero's saved gold here, so it cannot be skipped.
 */
class TownBuildingController extends Controller
{
    private const TOWN = 'regex:/^-?\d{1,4},-?\d{1,4}$/';

    public function index(Request $request): JsonResponse
    {
        $towns = collect(explode('|', (string) $request->query('towns', '')))
            ->filter(fn ($t) => preg_match('/^-?\d{1,4},-?\d{1,4}$/', $t))
            ->take(12)->values();

        $buildings = $towns->isEmpty() ? collect() : TownBuilding::whereIn('town', $towns)->get();

        return response()->json(['buildings' => $buildings->map->toClient()->values()]);
    }

    public function build(Request $request): JsonResponse
    {
        $data = $request->validate([
            'town' => ['required', 'string', self::TOWN],
            'slot' => ['required', 'integer', 'min:0', 'max:'.(config('game.building_slots') - 1)],
            'type' => ['required', Rule::in(array_keys(config('game.buildings')))],
            'gold' => ['required', 'integer', 'min:0'],
        ]);
        $cost = config('game.building_costs')[0];
        $hero = $request->user()->character;
        abort_unless($hero, 422, 'Create a hero first.');
        if ($data['gold'] < $cost) {
            return response()->json(['message' => 'Not enough gold.'], 422);
        }

        try {
            $building = TownBuilding::create([
                'town' => $data['town'], 'slot' => $data['slot'], 'type' => $data['type'], 'level' => 1,
                'built_by' => $request->user()->id, 'builder_name' => $hero->name, 'gold_spent' => $cost,
            ]);
        } catch (QueryException) {
            // someone else built on this plot first
            return response()->json(['message' => 'That plot was just built on.'], 409);
        }

        $hero->update(['gold' => $data['gold'] - $cost]);

        return response()->json(['building' => $building->toClient(), 'gold' => $hero->gold]);
    }

    public function upgrade(Request $request): JsonResponse
    {
        $data = $request->validate([
            'town' => ['required', 'string', self::TOWN],
            'slot' => ['required', 'integer', 'min:0', 'max:'.(config('game.building_slots') - 1)],
            'gold' => ['required', 'integer', 'min:0'],
        ]);
        $hero = $request->user()->character;
        abort_unless($hero, 422, 'Create a hero first.');
        $building = TownBuilding::where('town', $data['town'])->where('slot', $data['slot'])->firstOrFail();
        $costs = config('game.building_costs');
        if ($building->level >= count($costs)) {
            return response()->json(['message' => 'It is already as grand as it gets.'], 422);
        }
        $cost = $costs[$building->level];
        if ($data['gold'] < $cost) {
            return response()->json(['message' => 'Not enough gold.'], 422);
        }

        $building->increment('level', 1, ['upgraded_by_name' => $hero->name, 'gold_spent' => $building->gold_spent + $cost]);
        $hero->update(['gold' => $data['gold'] - $cost]);

        return response()->json(['building' => $building->fresh()->toClient(), 'gold' => $hero->gold]);
    }
}
