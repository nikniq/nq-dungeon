<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoryPost extends Model
{
    protected $fillable = ['user_id', 'story', 'body'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
