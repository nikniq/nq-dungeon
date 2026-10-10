<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hero names become the public profile URL, so they must be unique.
        // De-duplicate anything that already clashes by suffixing the id.
        $seen = [];
        foreach (DB::table('characters')->orderBy('id')->get(['id', 'name']) as $row) {
            $key = mb_strtolower($row->name);
            if (isset($seen[$key])) {
                DB::table('characters')->where('id', $row->id)->update(['name' => $row->name.'-'.$row->id]);
            }
            $seen[$key] = true;
        }

        Schema::table('characters', function (Blueprint $table) {
            $table->string('bio', 280)->nullable()->after('name');
            $table->unique('name');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->dropColumn('bio');
        });
    }
};
