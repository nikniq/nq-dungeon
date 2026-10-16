<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MultiplayerTest extends TestCase
{
    use RefreshDatabase;

    private function hero(string $name): User
    {
        $u = User::factory()->create();
        $u->character()->create(['name' => $name, 'class' => 'ranger', 'level' => 3]);

        return $u;
    }

    private function sync(User $u, array $body): array
    {
        return $this->actingAs($u)->postJson('/api/mp/sync', $body + ['x' => 0, 'y' => 0, 'space' => 'world'])->assertOk()->json();
    }

    public function test_guests_are_turned_away(): void
    {
        $this->postJson('/api/mp/sync', ['space' => 'world', 'x' => 0, 'y' => 0])->assertUnauthorized();
    }

    public function test_heroes_see_each_other_in_the_same_space_and_range(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $c = $this->hero('Cass');
        $this->sync($a, ['x' => 10, 'y' => 10, 'me' => ['name' => 'Spoofed', 'cls' => 'ranger', 'hp' => 9, 'secret' => 'x']]);
        $this->sync($c, ['x' => 500, 'y' => 10]);   // far away in the world
        $r = $this->sync($b, ['x' => 12, 'y' => 11]);
        $this->assertCount(1, $r['players']);
        $this->assertSame('Ayla', $r['players'][0]['data']['name'], 'the server sets the name');
        $this->assertArrayNotHasKey('secret', $r['players'][0]['data']);
        $this->assertSame(9, $r['players'][0]['data']['hp']);

        // a different space sees nobody
        $r = $this->sync($b, ['space' => 'house:0,0:inn', 'x' => 3, 'y' => 3]);
        $this->assertCount(0, $r['players']);
    }

    public function test_chat_reaches_the_space_once_and_is_cleaned(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $cursor = $this->sync($b, [])['cursor'];
        $this->sync($a, ['events' => [['type' => 'chat', 'payload' => ['text' => "  <b>hello</b>   there\n".str_repeat('x', 300)]]]]);
        $r = $this->sync($b, ['since' => $cursor]);
        $this->assertCount(1, $r['events']);
        $this->assertSame('chat', $r['events'][0]['type']);
        $this->assertSame('Ayla', $r['events'][0]['payload']['name']);
        $this->assertStringStartsWith('hello there x', $r['events'][0]['payload']['text']);
        $this->assertSame(140, mb_strlen($r['events'][0]['payload']['text']));
        $this->assertCount(0, $this->sync($b, ['since' => $r['cursor']])['events'], 'not delivered twice');
        // the sender never gets their own event back, and a first sync replays nothing
        $this->assertCount(0, $this->sync($a, ['since' => $cursor])['events']);
        $this->assertCount(0, $this->sync($b, [])['events'], 'a first sync with no cursor replays nothing');
    }

    public function test_directed_events_only_reach_their_target(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $c = $this->hero('Cass');
        $cursor = $this->sync($b, [])['cursor'];
        $this->sync($c, []);
        $this->sync($a, ['events' => [['type' => 'attack', 'to' => $b->id, 'payload' => ['atk' => 4]]]]);
        $this->assertSame('attack', $this->sync($b, ['since' => $cursor])['events'][0]['type']);
        $this->assertCount(0, $this->sync($c, ['since' => $cursor])['events']);
    }

    public function test_invite_accept_party_and_leave(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $this->sync($a, []);
        $cursor = $this->sync($b, [])['cursor'];
        $this->actingAs($b)->postJson('/api/mp/accept', ['from' => $a->id])->assertNotFound();   // no invite yet

        $this->actingAs($a)->postJson('/api/mp/invite', ['user_id' => $a->id])->assertStatus(422);
        $this->actingAs($a)->postJson('/api/mp/invite', ['user_id' => $b->id])->assertOk();
        $ev = $this->sync($b, ['since' => $cursor])['events'];
        $this->assertSame('invite', $ev[0]['type']);
        $this->assertSame($a->id, $ev[0]['from']);

        $party = $this->actingAs($b)->postJson('/api/mp/accept', ['from' => $a->id])->assertOk()->json('party');
        $this->assertSame($a->id, $party['leader']);
        $this->assertCount(2, $party['members']);
        $this->assertSame(2, count($this->sync($a, [])['party']['members']));

        $this->actingAs($a)->postJson('/api/mp/leave')->assertOk();
        $this->assertNull($this->sync($b, [])['party'], 'a party of one disbands');
        $this->assertDatabaseCount('mp_parties', 0);
    }

    public function test_party_members_share_a_dungeon_run(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $solo = $this->hero('Solo');
        $this->sync($a, []);
        $this->sync($b, []);
        $this->actingAs($a)->postJson('/api/mp/invite', ['user_id' => $b->id]);
        $this->actingAs($b)->postJson('/api/mp/accept', ['from' => $a->id]);

        $soloRun = $this->actingAs($solo)->postJson('/api/mp/enter', ['dungeon' => 't:0,0'])->assertOk()->json();
        $this->assertSame('solo:'.$solo->id, $soloRun['space']);
        $this->assertFalse($soloRun['shared']);

        $first = $this->actingAs($a)->postJson('/api/mp/enter', ['dungeon' => 't:0,0'])->assertOk()->json();
        $this->assertTrue($first['shared']);
        $this->assertSame(1, $first['floor']);
        $this->sync($a, ['space' => $first['space']]);   // Ayla is inside
        $this->actingAs($a)->postJson('/api/mp/floor', ['space' => $first['space'], 'floor' => 3])->assertOk();

        $second = $this->actingAs($b)->postJson('/api/mp/enter', ['dungeon' => 't:0,0'])->assertOk()->json();
        $this->assertSame($first['space'], $second['space'], 'same run');
        $this->assertSame($first['seed'], $second['seed']);
        $this->assertSame(3, $second['floor'], 'arrives on the floor the party is on');

        // a different dungeon, or an empty one, starts a fresh run
        $third = $this->actingAs($b)->postJson('/api/mp/enter', ['dungeon' => 's:1,0'])->assertOk()->json();
        $this->assertNotSame($first['space'], $third['space']);
        $this->assertSame(1, $third['floor']);
        $this->actingAs($a)->postJson('/api/mp/enter', ['dungeon' => 'nonsense'])->assertStatus(422);
    }

    public function test_dungeon_players_carry_the_hosts_snapshot(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $this->sync($a, ['space' => 'dng:1:1', 'state' => ['floor' => 2, 'mobs' => [['0,0#1', 5, 6, 3, 5, 1, 1]], 'dead' => ['0,0#2']]]);
        $r = $this->sync($b, ['space' => 'dng:1:1']);
        $this->assertSame(2, $r['players'][0]['state']['floor']);
        $this->assertSame('0,0#2', $r['players'][0]['state']['dead'][0]);
        // snapshots are never sent in the open world
        $this->sync($a, ['space' => 'world', 'state' => ['floor' => 9]]);
        $this->assertNull($this->sync($b, ['space' => 'world'])['players'][0]['state']);
        $this->assertGreaterThan(0, DB::table('mp_presence')->count());
    }
}
