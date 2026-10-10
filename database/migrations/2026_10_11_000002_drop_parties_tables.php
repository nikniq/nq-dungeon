<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('party_members');
        Schema::dropIfExists('parties');
    }

    public function down(): void
    {
        // Co-op was removed; the original tables live in the 2026_10_11_000000 migration.
    }
};
