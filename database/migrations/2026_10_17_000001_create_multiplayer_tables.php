<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Where each online hero is, what they look like, and (for whoever runs a
        // shared dungeon) the monster snapshot the rest of the party follows.
        Schema::create('mp_presence', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('space', 80)->index();
            $table->integer('x')->default(0);
            $table->integer('y')->default(0);
            $table->json('data')->nullable();
            $table->longText('state')->nullable();
            $table->unsignedBigInteger('entered_ms')->default(0);
            $table->unsignedBigInteger('updated_ms')->default(0)->index();
        });

        // Chat, combat and party messages, kept for a couple of minutes.
        Schema::create('mp_events', function (Blueprint $table) {
            $table->id();
            $table->string('space', 80)->nullable()->index();
            $table->unsignedBigInteger('from_user');
            $table->unsignedBigInteger('to_user')->nullable()->index();
            $table->string('type', 16);
            $table->json('payload')->nullable();
            $table->unsignedBigInteger('created_ms')->index();
        });

        Schema::create('mp_parties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('leader_id')->constrained('users')->cascadeOnDelete();
            $table->string('dungeon', 40)->nullable();       // t:i,j or s:i,j of the shared dungeon
            $table->unsignedInteger('run')->default(0);       // bumps each fresh descent
            $table->unsignedInteger('seed')->nullable();
            $table->unsignedSmallInteger('floor')->default(0);
            $table->unsignedBigInteger('active_ms')->default(0);
            $table->timestamps();
        });

        Schema::create('mp_party_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained('mp_parties')->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mp_party_members');
        Schema::dropIfExists('mp_parties');
        Schema::dropIfExists('mp_events');
        Schema::dropIfExists('mp_presence');
    }
};
