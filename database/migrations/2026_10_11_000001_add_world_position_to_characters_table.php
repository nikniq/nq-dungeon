<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->integer('wx')->default(20)->after('floor');   // overworld position
            $table->integer('wy')->default(21)->after('wx');
            $table->string('home', 16)->default('0,0')->after('wy'); // lattice key of the last town visited
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['wx', 'wy', 'home']);
        });
    }
};
