<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'name', 'bio', 'class', 'floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk',
        'weapon', 'armor', 'weapon_plus', 'armor_plus', 'bag', 'quests', 'quests_done', 'perks', 'achievements', 'meta', 'title', 'wx', 'wy', 'home', 'runs', 'wins', 'best_floor', 'best_gold', 'kills',
    ];

    protected $casts = ['bag' => 'array', 'quests' => 'array', 'perks' => 'array', 'achievements' => 'array', 'meta' => 'array'];

    protected $attributes = ['bag' => '[]', 'quests' => '[]', 'perks' => '[]', 'achievements' => '[]', 'meta' => '{}'];

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

    public const CLASSES = ['warrior', 'ranger', 'mage'];

    /** Reset the in-progress run to a fresh level-1 hero, keeping lifetime records. */
    public function resetRun(): void
    {
        $this->fill([
            'floor' => 0, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3,
            'weapon' => null, 'armor' => null, 'bag' => [], 'weapon_plus' => 0, 'armor_plus' => 0, 'perks' => [],
        ]);
    }

    /**
     * Death is a setback, not the end: the hero wakes in town with full health,
     * keeps level and gear, loses half their gold and every potion.
     */
    public function fallInBattle(): void
    {
        $this->floor = 0;
        $this->hp = $this->max_hp;
        $this->gold = intdiv($this->gold, 2);
        $this->bag = array_values(array_filter($this->bag ?? [], fn ($id) => $id !== 'potion' && $id !== 'elixir'));
        $this->quests = [];
    }
}
