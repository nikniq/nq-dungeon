<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Discussion under the public story page: one short post per row.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('story_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('story')->default(1);
            $table->string('body', 600);
            $table->timestamps();
            $table->index(['story', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('story_posts');
    }
};
