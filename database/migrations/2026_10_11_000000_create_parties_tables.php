<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->string('code', 8)->unique();
            $table->foreignId('leader_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedSmallInteger('floor')->default(0);   // 0 = the party is in town
            $table->longText('state')->nullable();              // the shared floor: chunks, monsters, items
            $table->unsignedBigInteger('seq')->default(0);      // bumps on every change, for polling
            $table->timestamps();
        });

        Schema::create('party_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete(); // one party per player
            $table->boolean('in_dungeon')->default(false);
            $table->integer('x')->default(0);
            $table->integer('y')->default(0);
            $table->unsignedBigInteger('last_action_ms')->default(0);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_members');
        Schema::dropIfExists('parties');
    }
};
