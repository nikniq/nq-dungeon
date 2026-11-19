<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\DailyDelve;
use App\Models\TownBuilding;
use App\Models\User;
use App\Services\LogReader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AdminInsightsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $admin->character()->create(['name' => 'Boss', 'class' => 'mage', 'level' => 12, 'kills' => 40, 'achievements' => ['elite', 'grudge']]);

        return $admin;
    }

    public function test_every_insight_page_renders_for_admins_and_is_closed_to_players(): void
    {
        $admin = $this->admin();
        $player = User::factory()->create();
        $player->character()->create(['name' => 'Pip', 'class' => 'ranger', 'kills' => 3]);
        DailyDelve::create(['character_id' => $player->character->id, 'day' => now()->toDateString(), 'score' => 10, 'floor' => 2, 'kills' => 3, 'gold' => 5, 'cleared' => false]);
        TownBuilding::create(['town' => '1,1', 'slot' => 0, 'type' => 'statue', 'level' => 1, 'built_by' => $admin->character->id, 'builder_name' => 'Boss', 'gold_spent' => 500]);

        foreach (['sales' => 'Conversion funnel', 'marketing' => 'Campaign link builder', 'usage' => 'Active players per day', 'reports' => 'Day by day', 'health' => 'Database', 'logs' => 'Level'] as $page => $text) {
            $this->actingAs($admin)->get("/admin/{$page}")->assertOk()->assertSee($text);
            $this->actingAs($player)->get("/admin/{$page}")->assertForbidden();
        }
        $this->actingAs($admin)->get('/admin/sales?days=7')->assertOk()->assertSee('Boss');
        $this->actingAs($admin)->get('/admin/usage')->assertSee('ranger')->assertSee('elite');
    }

    public function test_a_guests_first_visit_is_recorded_on_the_account_they_create(): void
    {
        $this->withHeader('Referer', 'https://www.reddit.com/r/roguelikes/comments/x')
            ->get('/?utm_source=Reddit&utm_medium=social&utm_campaign=nemesis')->assertOk();
        // later pages must not overwrite the first touch
        $this->get('/news?utm_source=other')->assertOk();

        $this->post('/register', ['character' => 'Wren', 'email' => 'wren@example.com', 'class' => 'warrior']);
        $user = User::where('email', 'wren@example.com')->firstOrFail();
        $this->assertSame('reddit', $user->utm_source);
        $this->assertSame('social', $user->utm_medium);
        $this->assertSame('nemesis', $user->utm_campaign);
        $this->assertSame('https://www.reddit.com/r/roguelikes/comments/x', $user->referrer);
        $this->assertSame('/', $user->landing);
        $this->assertSame('password', $user->signup_method);

        $admin = $this->admin();
        $this->actingAs($admin)->get('/admin/marketing')->assertSee('reddit.com')->assertSee('reddit / social / nemesis');
    }

    public function test_signed_in_visits_update_last_seen_at_most_every_five_minutes(): void
    {
        $user = User::factory()->create(['last_seen_at' => now()->subHour()]);
        $this->actingAs($user)->get('/news')->assertOk();
        $seen = $user->fresh()->last_seen_at;
        $this->assertTrue($seen->gt(now()->subMinute()));

        $this->travel(2)->minutes();
        $this->actingAs($user)->get('/news');
        $this->assertEquals($seen->timestamp, $user->fresh()->last_seen_at->timestamp);
    }

    public function test_the_report_exports_a_csv_and_reject_unknown_periods(): void
    {
        $admin = $this->admin();
        $res = $this->actingAs($admin)->get('/admin/reports/export?days=7')->assertOk();
        $lines = array_filter(explode("\n", $res->streamedContent()));
        $this->assertSame('date,signups,active_players,daily_delves,story_posts', $lines[0]);
        $this->assertCount(8, $lines);
        $this->assertStringStartsWith(now()->toDateString().',1,', $lines[1]);   // the admin signed up today

        $this->actingAs($admin)->get('/admin/reports?days=9999')->assertOk()->assertSee('The last 30 days');
    }

    public function test_the_campaign_link_builder_tags_the_url(): void
    {
        $this->actingAs($this->admin())->get('/admin/marketing?source=discord&medium=chat&campaign=launch&page=/play')
            ->assertSee(url('/play').'?utm_source=discord&amp;utm_medium=chat&amp;utm_campaign=launch', false);
    }

    public function test_live_health_checks_tell_a_bad_google_secret_from_a_good_one(): void
    {
        config(['services.google.client_id' => 'id', 'services.google.client_secret' => 'secret', 'services.nikniq.client_id' => 'nq', 'services.nikniq.url' => 'https://portal.test']);
        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['error' => 'invalid_client', 'error_description' => 'The provided client secret is invalid.'], 401),
            'portal.test/*' => Http::response(['error' => 'invalid_grant'], 400),
        ]);
        $admin = $this->admin();
        $this->actingAs($admin)->get('/admin/health')->assertOk()->assertDontSee('(live)');
        Http::assertNothingSent();

        $this->actingAs($admin)->get('/admin/health?live=1')->assertOk()
            ->assertSee('The provided client secret is invalid')
            ->assertSee('Credentials accepted');
    }

    public function test_the_log_reader_parses_filters_and_reads_only_the_tail(): void
    {
        $dir = storage_path('framework/testing/logs-'.uniqid());
        @mkdir($dir, 0777, true);
        $file = $dir.'/laravel.log';
        file_put_contents($file, implode("\n", [
            '[2026-11-20 09:00:00] production.INFO: hero saved',
            '[2026-11-20 09:01:00] production.ERROR: save rejected {"user":3}',
            '#0 /app/Http/Controllers/CharacterController.php(12)',
            '[2026-11-20 09:02:00] production.WARNING: slow query',
        ])."\n");

        $reader = new LogReader;
        $all = $reader->entries($file);
        $this->assertSame(['WARNING', 'ERROR', 'INFO'], array_column($all, 'level'));
        $this->assertStringContainsString('CharacterController', $all[1]['detail']);
        $this->assertSame(['save rejected {"user":3}'], array_column($reader->entries($file, 'error'), 'message'));
        $this->assertCount(1, $reader->entries($file, null, 'slow'));

        // a reader limited to the last bytes still parses whole entries
        $tail = (new LogReader(60))->entries($file);
        $this->assertSame(['WARNING'], array_column($tail, 'level'));
        @unlink($file);
        @rmdir($dir);
    }
}
