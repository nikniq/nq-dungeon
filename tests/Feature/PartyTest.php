<?php

namespace Tests\Feature;

use App\Game\Dungeon;
use App\Models\Party;
use App\Models\PartyMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PartyTest extends TestCase
{
    use RefreshDatabase;

    private function hero(string $name): User
    {
        $u = User::factory()->create();
        $u->character()->create(['name' => $name]);

        return $u;
    }

    public function test_engine_digs_a_connected_floor_with_reachable_stairs(): void
    {
        $d = Dungeon::newFloor(1);
        [$sx, $sy] = $d->spawn();
        $this->assertSame(Dungeon::FLOOR, $d->tile($sx, $sy));
        [$ex, $ey] = $d->s['exit'];
        $this->assertSame(Dungeon::EXIT, $d->tile($ex, $ey));
        // breadth-first walk from spawn must reach the stairs
        $seen = ["$sx,$sy" => true];
        $q = [[$sx, $sy]];
        $found = false;
        while ($q && ! $found) {
            [$x, $y] = array_shift($q);
            foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
                $nx = $x + $dx;
                $ny = $y + $dy;
                if (isset($seen["$nx,$ny"]) || ! $d->walkable($nx, $ny)) {
                    continue;
                }
                if ($nx === $ex && $ny === $ey) {
                    $found = true;
                    break;
                }
                $seen["$nx,$ny"] = true;
                $q[] = [$nx, $ny];
            }
        }
        $this->assertTrue($found, 'stairs are reachable from spawn');
        $this->assertNotEmpty($d->s['monsters']);
        // chunks are deterministic for a seed
        $again = new Dungeon(['seed' => $d->s['seed'], 'chunks' => [], 'monsters' => [], 'potions' => [], 'golds' => [], 'shops' => [], 'nextId' => 1, 'log' => [], 'seq' => 0, 'lastTick' => 0], 1);
        $this->assertSame($d->chunk(1, 1)['tiles'], $again->chunk(1, 1)['tiles']);
    }

    public function test_create_join_and_leave(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');

        $code = $this->actingAs($a)->postJson('/api/party')->assertOk()->json('party.code');
        $this->assertSame(6, strlen($code));
        $this->actingAs($a)->postJson('/api/party')->assertStatus(422);

        $this->actingAs($b)->postJson('/api/party/join', ['code' => 'NOPE00'])->assertNotFound();
        $this->actingAs($b)->postJson('/api/party/join', ['code' => strtolower($code)])->assertOk()
            ->assertJsonCount(2, 'party.members')->assertJsonPath('party.leader', false);

        $this->actingAs($b)->getJson('/api/party')->assertOk()->assertJsonPath('party.code', $code);

        $this->actingAs($a)->postJson('/api/party/leave')->assertOk();
        $this->assertSame($b->id, Party::where('code', $code)->first()->leader_id, 'leadership passes on');
        $this->actingAs($b)->postJson('/api/party/leave')->assertOk();
        $this->assertDatabaseCount('parties', 0);
    }

    public function test_entering_moving_and_polling_the_shared_floor(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $code = $this->actingAs($a)->postJson('/api/party')->json('party.code');
        $this->actingAs($b)->postJson('/api/party/join', ['code' => $code]);

        $this->actingAs($b)->getJson('/api/party/state')->assertStatus(409);

        $first = $this->actingAs($a)->postJson('/api/party/enter')->assertOk()
            ->assertJsonPath('floor', 1)->assertJsonPath('me.in_dungeon', true)->assertJsonPath('me.name', 'Ayla')->json();
        $this->assertDatabaseHas('characters', ['name' => 'Ayla', 'floor' => 1, 'runs' => 1]);

        $second = $this->actingAs($b)->postJson('/api/party/enter')->assertOk()->json();
        $this->assertSame([$first['me']['x'], $first['me']['y']], [$second['me']['x'], $second['me']['y']], 'both spawn together');
        $this->assertCount(1, $second['members']);
        $this->assertSame('Ayla', $second['members'][0]['name']);

        // chunks come back when asked for
        $state = $this->actingAs($a)->getJson('/api/party/state?chunks=0,0|1,0&since=0')->assertOk()->json();
        $this->assertSame(1024, strlen($state['chunks']['0,0']));
        $this->assertSame(1024, strlen($state['chunks']['1,0']));

        // walk somewhere open: find a free neighbour of spawn
        $party = Party::first();
        $d = new Dungeon($party->state, 1);
        $moved = false;
        foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
            if ($d->walkable($first['me']['x'] + $dx, $first['me']['y'] + $dy) && $d->monsterAt($first['me']['x'] + $dx, $first['me']['y'] + $dy) === null) {
                $res = $this->actingAs($a)->postJson('/api/party/act', ['type' => 'move', 'dx' => $dx, 'dy' => $dy, 'since' => 0])->assertOk()->json();
                $this->assertSame([$first['me']['x'] + $dx, $first['me']['y'] + $dy], [$res['me']['x'], $res['me']['y']]);
                $moved = true;
                break;
            }
        }
        $this->assertTrue($moved);
        // walking into a wall is refused quietly
        $wall = null;
        $me = $this->actingAs($a)->getJson('/api/party/state')->json('me');
        foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
            if (! $d->walkable($me['x'] + $dx, $me['y'] + $dy)) { $wall = [$dx, $dy]; break; }
        }
        if ($wall) {
            usleep(130000);
            $res = $this->actingAs($a)->postJson('/api/party/act', ['type' => 'move', 'dx' => $wall[0], 'dy' => $wall[1]])->assertOk()->json();
            $this->assertSame([$me['x'], $me['y']], [$res['me']['x'], $res['me']['y']]);
        }
        // the other member sees the move
        $view = $this->actingAs($b)->getJson('/api/party/state')->json();
        $this->assertSame($me['x'], $view['members'][0]['x']);
    }

    public function test_stairs_take_the_whole_party_down_and_out(): void
    {
        $a = $this->hero('Ayla');
        $b = $this->hero('Bram');
        $code = $this->actingAs($a)->postJson('/api/party')->json('party.code');
        $this->actingAs($b)->postJson('/api/party/join', ['code' => $code]);
        $this->actingAs($a)->postJson('/api/party/enter');
        $this->actingAs($b)->postJson('/api/party/enter');

        for ($f = 1; $f <= 5; $f++) {
            // teleport Ayla next to the stairs, then step on them
            $party = Party::first();
            [$ex, $ey] = $party->state['exit'];
            $d = new Dungeon($party->state, $party->floor);
            $d->setTile($ex, $ey - 1, Dungeon::FLOOR);
            $d->s['monsters'] = array_values(array_filter($d->s['monsters'], fn ($m) => abs($m['x'] - $ex) + abs($m['y'] - $ey) > 2));
            $party->state = $d->s;
            $party->save();
            PartyMember::where('user_id', $a->id)->update(['x' => $ex, 'y' => $ey - 1, 'last_action_ms' => 0]);
            $res = $this->actingAs($a)->postJson('/api/party/act', ['type' => 'move', 'dx' => 0, 'dy' => 1])->assertOk()->json();
            if ($f < 5) {
                $this->assertSame($f + 1, $res['floor']);
                $this->assertSame('floor', $res['events'][0]['type']);
                $this->assertDatabaseHas('characters', ['name' => 'Bram', 'floor' => $f + 1]);
                $bram = $this->actingAs($b)->getJson('/api/party/state')->json('me');
                $this->assertSame([$res['me']['x'], $res['me']['y']], [$bram['x'], $bram['y']], 'Bram arrives with Ayla');
            } else {
                $this->assertSame('win', $res['events'][0]['type']);
                $this->assertDatabaseHas('characters', ['name' => 'Bram', 'floor' => 0, 'wins' => 1, 'best_floor' => 5]);
                $this->assertDatabaseHas('characters', ['name' => 'Ayla', 'floor' => 0, 'wins' => 1]);
                $this->assertSame(0, Party::first()->floor);
            }
        }
    }

    public function test_shop_actions_are_resolved_on_the_server(): void
    {
        $a = $this->hero('Ayla');
        $this->actingAs($a)->postJson('/api/party');
        $this->actingAs($a)->postJson('/api/party/enter');
        $party = Party::first();
        $d = new Dungeon($party->state, 1);
        [$sx, $sy] = $d->spawn();
        $d->setTile($sx, $sy, Dungeon::SHOP);   // a merchant right at spawn for the test
        $party->state = $d->s;
        $party->save();
        $a->character->update(['gold' => 100]);

        $this->actingAs($a)->postJson('/api/party/act', ['type' => 'buy', 'item' => 'short_sword'])->assertOk()
            ->assertJsonPath('me.gold', 60)->assertJsonPath('me.bag', ['short_sword']);
        usleep(130000);
        $this->actingAs($a)->postJson('/api/party/act', ['type' => 'equip', 'where' => 0])->assertOk()
            ->assertJsonPath('me.weapon', 'short_sword')->assertJsonPath('me.bag', []);
        usleep(130000);
        $this->actingAs($a)->postJson('/api/party/act', ['type' => 'sell', 'where' => 'weapon'])->assertOk()
            ->assertJsonPath('me.weapon', null)->assertJsonPath('me.gold', 80);
        usleep(130000);
        $this->actingAs($a)->postJson('/api/party/act', ['type' => 'buy', 'item' => 'warhammer'])->assertOk()
            ->assertJsonPath('me.gold', 80); // not stocked this deep
        // off the merchant tile nothing sells
        PartyMember::where('user_id', $a->id)->update(['x' => $sx + 40, 'y' => $sy, 'last_action_ms' => 0]);
        $this->actingAs($a)->postJson('/api/party/act', ['type' => 'buy', 'item' => 'potion'])->assertOk()->assertJsonPath('me.gold', 80);
    }

    public function test_monsters_tick_and_can_kill_a_hero(): void
    {
        $a = $this->hero('Ayla');
        $this->actingAs($a)->postJson('/api/party');
        $state = $this->actingAs($a)->postJson('/api/party/enter')->json();
        $party = Party::first();
        $d = new Dungeon($party->state, 1);
        // put an awake orc next to Ayla with her at 1 HP, and make the tick due
        $d->s['monsters'][0] = ['id' => 999, 'x' => $state['me']['x'] + 1, 'y' => $state['me']['y'], 't' => 3, 'hp' => 12, 'maxHp' => 12, 'awake' => true];
        $d->setTile($state['me']['x'] + 1, $state['me']['y'], Dungeon::FLOOR);
        $d->s['lastTick'] = 0;
        $party->state = $d->s;
        $party->save();
        $a->character->update(['hp' => 1, 'level' => 4, 'gold' => 55]);

        $res = $this->actingAs($a)->getJson('/api/party/state')->assertOk()->json();
        $this->assertSame('death', $res['events'][0]['type']);
        $this->assertDatabaseHas('characters', ['name' => 'Ayla', 'floor' => 0, 'level' => 1, 'gold' => 0, 'best_floor' => 1, 'best_gold' => 55]);
        $this->assertFalse($res['me']['in_dungeon']);
    }
}
