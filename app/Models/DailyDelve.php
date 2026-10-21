<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

class DailyDelve extends Model
{
    protected $fillable = ['character_id', 'day', 'score', 'floor', 'kills', 'gold', 'cleared'];
    protected $casts = ['day' => 'date', 'score' => 'integer', 'floor' => 'integer', 'kills' => 'integer', 'gold' => 'integer', 'cleared' => 'boolean'];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    /** The score the game awards: a hundred a floor, five a kill, every coin. */
    public static function score(int $floor, int $kills, int $gold, bool $cleared): int
    {
        return $floor * 100 + $kills * 5 + $gold + ($cleared ? 250 : 0);
    }

    /** A day's board, best first. */
    public static function board(string $day, int $limit = 10): Collection
    {
        return static::with('character')->whereDate('day', $day)->orderByDesc('score')->orderBy('created_at')->limit($limit)->get();
    }
}
