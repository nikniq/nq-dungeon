<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Story 5: the rebuilding. Structures heroes sponsor in towns (walls,
     * buildings, memorials, paved roads). Everyone sees them; the sponsor's
     * name is carved on them, and the heroes page ranks the builders.
     */
    public function up(): void
    {
        Schema::create('town_projects', function (Blueprint $table) {
            $table->id();
            $table->string('town', 24);        // lattice cell, "i,j"
            $table->string('project', 24);     // a key of config('game.projects')
            $table->foreignId('built_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('builder_name', 40);
            $table->unsignedInteger('gold_spent')->default(0);
            $table->timestamps();
            $table->unique(['town', 'project']);
            $table->index('built_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('town_projects');
    }
};
