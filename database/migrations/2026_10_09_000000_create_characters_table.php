<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name', 24);
            // Current run. floor 0 means no run in progress.
            $table->unsignedSmallInteger('floor')->default(0);
            $table->unsignedSmallInteger('level')->default(1);
            $table->unsignedInteger('xp')->default(0);
            $table->unsignedInteger('gold')->default(0);
            $table->unsignedSmallInteger('hp')->default(20);
            $table->unsignedSmallInteger('max_hp')->default(20);
            $table->unsignedSmallInteger('atk')->default(3);
            // Lifetime records.
            $table->unsignedInteger('runs')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedSmallInteger('best_floor')->default(0);
            $table->unsignedInteger('best_gold')->default(0);
            $table->unsignedInteger('kills')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
