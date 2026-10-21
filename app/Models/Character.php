<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    /** base id, affix and tier of an item id such as longsword~flaming~2 (null if malformed). */
    public static function itemParts(mixed $id): ?array
    {
        if (! is_string($id)) {
            return null;
        }
        $p = explode('~', $id);
        if (count($p) === 1) {
            return [$p[0], null, 0];
        }
        if (count($p) !== 3 || ! ctype_digit($p[2]) || (int) $p[2] < 1 || (int) $p[2] > 3) {
            return null;
        }

        return [$p[0], $p[1], (int) $p[2]];
    }

    /** Whether an item id is real: a catalogue entry of one of the given kinds, with a valid affix if it has one. */
    public static function validItem(mixed $id, array $kinds): bool
    {
        $p = self::itemParts($id);
        if (! $p) {
            return false;
        }
        [$base, $affix] = $p;
        foreach ($kinds as $kind) {
            if (isset(config("items.$kind")[$base])) {
                if ($affix === null) {
                    return true;
                }
                $slot = $kind === 'weapons' ? 'weapon' : ($kind === 'armor' ? 'armor' : null);

                return $slot !== null && config("items.$kind")[$base]['floor'] < 99 && isset(config("items.affixes.$slot")[$affix]);
            }
        }

        return false;
    }

    /** Name and stats of an item id, affix and tier included, for the pages. */
    public static function describeItem(mixed $id): ?array
    {
        $p = self::itemParts($id);
        if (! $p) {
            return null;
        }
        [$base, $affix, $tier] = $p;
        foreach (['weapons', 'armor', 'consumables', 'relics'] as $kind) {
            if (isset(config("items.$kind")[$base])) {
                $it = config("items.$kind")[$base] + ['kind' => $kind];
                if ($affix) {
                    $slot = $kind === 'weapons' ? 'weapon' : 'armor';
                    $a = config("items.affixes.$slot")[$affix] ?? ['name' => ucfirst($affix)];
                    $it['name'] = $a['name'].' '.lcfirst($it['name']).($tier > 1 ? ' '.['', '', 'II', 'III'][$tier] : '');
                    if ($kind === 'weapons') { $it['atk'] += $tier + ($affix === 'heavy' ? 2 : 0); }
                    if ($kind === 'armor') { $it['def'] += $tier + ($affix === 'sturdy' ? 1 : 0); }
                }

                return $it;
            }
        }

        return null;
    }

    protected $fillable = [
        'name', 'bio', 'class', 'floor', 'level', 'xp', 'gold', 'hp', 'max_hp', 'atk',
        'weapon', 'armor', 'relic', 'weapon_plus', 'armor_plus', 'bag', 'quests', 'quests_done', 'perks', 'achievements', 'meta', 'title', 'wx', 'wy', 'home', 'runs', 'wins', 'best_floor', 'best_gold', 'kills',
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
