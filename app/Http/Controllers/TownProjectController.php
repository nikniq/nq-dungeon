<?php

namespace App\Http\Controllers;

use App\Models\TownProject;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Story 5, the rebuilding: structures heroes sponsor in towns. Any hero sees
 * them; signed-in heroes pay a town's leader to sponsor one. The gold comes
 * off the hero's saved gold here, so it cannot be skipped.
 */
class TownProjectController extends Controller
{
    private const TOWN = 'regex:/^-?\d{1,4},-?\d{1,4}$/';

    public function index(Request $request): JsonResponse
    {
        $towns = collect(explode('|', (string) $request->query('towns', '')))
            ->filter(fn ($t) => preg_match('/^-?\d{1,4},-?\d{1,4}$/', $t))
            ->take(12)->values();
        $projects = $towns->isEmpty() ? collect() : TownProject::whereIn('town', $towns)->orderBy('id')->get();
        $mine = $request->user() ? TownProject::where('built_by', $request->user()->id)->count() : 0;

        return response()->json(['projects' => $projects->map->toClient()->values(), 'mine' => $mine]);
    }

    public function sponsor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'town' => ['required', 'string', self::TOWN],
            'project' => ['required', Rule::in(array_keys(config('game.projects')))],
            'gold' => ['required', 'integer', 'min:0'],
        ]);
        $cost = config('game.projects')[$data['project']]['cost'];
        $hero = $request->user()->character;
        abort_unless($hero, 422, 'Create a hero first.');
        if ($data['gold'] < $cost) {
            return response()->json(['message' => 'Not enough gold.'], 422);
        }

        try {
            $project = TownProject::create(['town' => $data['town'], 'project' => $data['project'], 'built_by' => $request->user()->id, 'builder_name' => $hero->name, 'gold_spent' => $cost]);
        } catch (QueryException) {
            return response()->json(['message' => 'Another hero has just sponsored that.'], 409);
        }
        $hero->update(['gold' => $data['gold'] - $cost]);

        return response()->json(['project' => $project->toClient(), 'gold' => $hero->gold, 'mine' => TownProject::where('built_by', $request->user()->id)->count()]);
    }
}
