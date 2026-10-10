<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartyMember extends Model
{
    protected $fillable = ['party_id', 'user_id', 'in_dungeon', 'x', 'y', 'last_action_ms', 'last_seen_at'];

    protected $casts = ['in_dungeon' => 'boolean', 'last_seen_at' => 'datetime'];

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
