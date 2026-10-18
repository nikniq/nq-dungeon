<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Monuments heroes pay to build in town squares. Everyone sees and uses them.
     */
    public function up(): void
    {
        Schema::create('town_buildings', function (Blueprint $table) {
            $table->id();
            $table->string('town', 24);                  // lattice cell, "i,j"
            $table->unsignedTinyInteger('slot');         // which plot in the square
            $table->string('type', 24);
            $table->unsignedTinyInteger('level')->default(1);
            $table->foreignId('built_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('builder_name', 40);
            $table->string('upgraded_by_name', 40)->nullable();
            $table->unsignedInteger('gold_spent')->default(0);
            $table->timestamps();
            $table->unique(['town', 'slot']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('town_buildings');
    }
};
