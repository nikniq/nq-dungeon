<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Party extends Model
{
    protected $fillable = ['code', 'leader_id', 'floor', 'state', 'seq'];

    protected $casts = ['state' => 'array'];

    public function members(): HasMany
    {
        return $this->hasMany(PartyMember::class);
    }

    public static function freshCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (static::where('code', $code)->exists());

        return $code;
    }
}
