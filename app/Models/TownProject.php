<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TownProject extends Model
{
    protected $fillable = ['town', 'project', 'built_by', 'builder_name', 'gold_spent'];
    protected $casts = ['gold_spent' => 'integer'];

    /** The shape the game client reads. */
    public function toClient(): array
    {
        return ['town' => $this->town, 'project' => $this->project, 'builder' => $this->builder_name, 'by' => $this->built_by];
    }

    /** The heroes who have sponsored the most structures, for the leaderboard. */
    public static function builders(int $limit = 10)
    {
        return static::query()->selectRaw('built_by, builder_name, count(*) as structures, sum(gold_spent) as gold')
            ->whereNotNull('built_by')->groupBy('built_by', 'builder_name')
            ->orderByDesc('structures')->orderByDesc('gold')->orderBy('builder_name')->limit($limit)->get();
    }
}
