<?php

namespace App\Http\Controllers;

use App\Models\DailyDelve;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Daily Delve: the game generates the same dungeon for every hero from the
 * date; this records one scored attempt per hero per day and serves the board.
 */
class DelveController extends Controller
{
    private function row(DailyDelve $d, int $rank): array
    {
        return ['rank' => $rank, 'name' => $d->character?->name ?? '—', 'score' => $d->score, 'floor' => $d->floor, 'kills' => $d->kills, 'gold' => $d->gold, 'cleared' => $d->cleared];
    }

    public function today(Request $request): JsonResponse
    {
        $day = now()->toDateString();
        $board = DailyDelve::board($day)->values()->map(fn ($d, $i) => $this->row($d, $i + 1));
        $hero = $request->user()?->character;
        $mine = $hero ? DailyDelve::where('character_id', $hero->id)->whereDate('day', $day)->first() : null;
        $rank = $mine ? DailyDelve::whereDate('day', $day)->where('score', '>', $mine->score)->count() + 1 : null;
        $yesterday = DailyDelve::board(now()->subDay()->toDateString(), 1)->first();

        return response()->json(['day' => $day, 'board' => $board, 'entries' => DailyDelve::whereDate('day', $day)->count(),
            'mine' => $mine ? $this->row($mine, $rank) : null, 'yesterday' => $yesterday ? $this->row($yesterday, 1) : null]);
    }

    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'floor' => ['required', 'integer', 'min:1', 'max:5'], 'kills' => ['required', 'integer', 'min:0', 'max:2000'],
            'gold' => ['required', 'integer', 'min:0', 'max:1000000'], 'cleared' => ['required', 'boolean'],
        ]);
        $hero = $request->user()->character;
        abort_unless($hero, 422, 'Create a hero first.');
        $day = now()->toDateString();
        if (DailyDelve::where('character_id', $hero->id)->whereDate('day', $day)->exists()) {
            return response()->json(['message' => 'One delve a day. Yours is already on the board.'], 409);
        }
        $delve = DailyDelve::create($data + ['character_id' => $hero->id, 'day' => $day, 'score' => DailyDelve::score($data['floor'], $data['kills'], $data['gold'], $data['cleared'])]);
        $rank = DailyDelve::whereDate('day', $day)->where('score', '>', $delve->score)->count() + 1;

        return response()->json(['mine' => $this->row($delve, $rank), 'entries' => DailyDelve::whereDate('day', $day)->count()]);
    }
}
