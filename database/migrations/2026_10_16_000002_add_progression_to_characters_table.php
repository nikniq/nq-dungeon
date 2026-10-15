<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->json('perks')->nullable()->after('quests');
            $table->json('achievements')->nullable()->after('perks');
            $table->json('meta')->nullable()->after('achievements');      // small client bookkeeping: visited towns, flags
            $table->string('title', 40)->nullable()->after('class');
            $table->unsignedTinyInteger('weapon_plus')->default(0)->after('armor');
            $table->unsignedTinyInteger('armor_plus')->default(0)->after('weapon_plus');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['perks', 'achievements', 'meta', 'title', 'weapon_plus', 'armor_plus']);
        });
    }
};
