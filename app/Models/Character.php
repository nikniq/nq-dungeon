<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'name', 'floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk',
        'runs', 'wins', 'best_floor', 'best_gold', 'kills',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Reset the in-progress run to a fresh level-1 hero, keeping lifetime records. */
    public function resetRun(): void
    {
        $this->fill(['floor' => 0, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3]);
    }
}
