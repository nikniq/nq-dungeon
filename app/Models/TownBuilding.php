<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TownBuilding extends Model
{
    protected $fillable = ['town', 'slot', 'type', 'level', 'built_by', 'builder_name', 'upgraded_by_name', 'gold_spent'];

    protected $casts = ['slot' => 'integer', 'level' => 'integer', 'gold_spent' => 'integer'];

    /** The shape the game client reads. */
    public function toClient(): array
    {
        return [
            'town' => $this->town, 'slot' => $this->slot, 'type' => $this->type, 'level' => $this->level,
            'builder' => $this->builder_name, 'upgrader' => $this->upgraded_by_name,
        ];
    }
}
