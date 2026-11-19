<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// where each account came from (first visit's UTM tags and referrer), how it signed up,
// and when it was last seen: the admin's sales, marketing and usage pages read these
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('signup_method', 16)->nullable()->after('is_admin');
            $table->string('utm_source', 100)->nullable()->after('signup_method');
            $table->string('utm_medium', 100)->nullable()->after('utm_source');
            $table->string('utm_campaign', 100)->nullable()->after('utm_medium');
            $table->string('referrer', 255)->nullable()->after('utm_campaign');
            $table->string('landing', 255)->nullable()->after('referrer');
            $table->timestamp('last_seen_at')->nullable()->index()->after('landing');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['last_seen_at']);
            $table->dropColumn(['signup_method', 'utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'landing', 'last_seen_at']);
        });
    }
};
