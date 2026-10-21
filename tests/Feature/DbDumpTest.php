<?php

namespace Tests\Feature;

use App\Models\StoryPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DbDumpTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_dump_round_trips_through_the_apps_own_connection(): void
    {
        $user = User::factory()->create(['name' => 'Keeper']);
        $user->character()->create(['name' => 'Ayla', 'class' => 'ranger', 'gold' => 123, 'bag' => ['potion']]);
        StoryPost::create(['user_id' => $user->id, 'story' => 2, 'body' => 'Loved the bear']);
        $path = 'storage/app/private/test-dump.json.gz';

        $this->artisan('db:dump', ['path' => $path])->assertSuccessful();
        $dump = json_decode(gzdecode(file_get_contents(base_path($path))), true);
        $this->assertSame('Ayla', $dump['tables']['characters'][0]['name']);
        $this->assertArrayNotHasKey('migrations', $dump['tables']);

        StoryPost::query()->delete();
        $user->character->update(['gold' => 0]);
        $this->artisan('db:restore', ['path' => $path, '--force' => true])->assertSuccessful();
        $this->assertSame(123, $user->character->fresh()->gold);
        $this->assertSame('Loved the bear', StoryPost::first()->body);
        $this->artisan('db:restore', ['path' => 'storage/app/private/nope.json.gz', '--force' => true])->assertFailed();
        @unlink(base_path($path));
    }
}
