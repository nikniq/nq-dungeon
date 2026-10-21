<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The Daily Delve: one scored attempt per hero per day at the day's seeded dungeon. */
    public function up(): void
    {
        Schema::create('daily_delves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->unsignedInteger('score');
            $table->unsignedTinyInteger('floor');
            $table->unsignedInteger('kills');
            $table->unsignedInteger('gold');
            $table->boolean('cleared')->default(false);
            $table->timestamps();
            $table->unique(['character_id', 'day']);
            $table->index(['day', 'score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_delves');
    }
};
