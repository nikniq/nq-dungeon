<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'name', 'bio', 'floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk',
        'weapon', 'armor', 'bag', 'wx', 'wy', 'home', 'runs', 'wins', 'best_floor', 'best_gold', 'kills',
    ];

    protected $casts = ['bag' => 'array'];

    protected $attributes = ['bag' => '[]'];

    /** True when another hero already uses this name, ignoring case. */
    public static function nameTaken(string $name, ?int $exceptId = null): bool
    {
        return static::query()
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists();
    }

    /** Profiles are looked up by hero name. */
    public function getRouteKeyName(): string
    {
        return 'name';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Reset the in-progress run to a fresh level-1 hero, keeping lifetime records. */
    public function resetRun(): void
    {
        $this->fill([
            'floor' => 0, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3,
            'weapon' => null, 'armor' => null, 'bag' => [],
        ]);
    }
}
