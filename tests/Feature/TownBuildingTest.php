<?php

namespace Tests\Feature;

use App\Models\TownBuilding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TownBuildingTest extends TestCase
{
    use RefreshDatabase;

    private function hero(string $name, int $gold): User
    {
        $u = User::factory()->create();
        $u->character()->create(['name' => $name, 'gold' => $gold]);

        return $u;
    }

    public function test_a_hero_builds_a_monument_and_pays_for_it(): void
    {
        $ayla = $this->hero('Ayla', 500);
        $this->actingAs($ayla)->postJson('/api/buildings', ['town' => '0,0', 'slot' => 1, 'type' => 'fountain', 'gold' => 500])
            ->assertOk()->assertJson(['gold' => 200, 'building' => ['town' => '0,0', 'slot' => 1, 'type' => 'fountain', 'level' => 1, 'builder' => 'Ayla']]);
        $this->assertSame(200, $ayla->character->fresh()->gold);

        // everyone, even a guest, sees it
        $this->getJson('/api/buildings?towns='.urlencode('0,0|1,0'))->assertOk()
            ->assertJsonCount(1, 'buildings')->assertJsonPath('buildings.0.builder', 'Ayla');
    }

    public function test_a_plot_takes_one_building_and_gold_is_checked(): void
    {
        $ayla = $this->hero('Ayla', 1000);
        $bram = $this->hero('Bram', 1000);
        $this->actingAs($ayla)->postJson('/api/buildings', ['town' => '2,-1', 'slot' => 0, 'type' => 'shrine', 'gold' => 1000])->assertOk();
        $this->actingAs($bram)->postJson('/api/buildings', ['town' => '2,-1', 'slot' => 0, 'type' => 'cache', 'gold' => 1000])->assertStatus(409);
        $this->assertSame(1000, $bram->character->fresh()->gold, 'no charge when the plot was taken');
        $this->actingAs($bram)->postJson('/api/buildings', ['town' => '2,-1', 'slot' => 1, 'type' => 'cache', 'gold' => 100])->assertUnprocessable();
        $this->actingAs($bram)->postJson('/api/buildings', ['town' => '2,-1', 'slot' => 7, 'type' => 'cache', 'gold' => 1000])->assertUnprocessable();
        $this->actingAs($bram)->postJson('/api/buildings', ['town' => '2,-1', 'slot' => 1, 'type' => 'castle', 'gold' => 1000])->assertUnprocessable();
        $this->actingAs($bram)->postJson('/api/buildings', ['town' => 'nowhere', 'slot' => 1, 'type' => 'cache', 'gold' => 1000])->assertUnprocessable();
    }

    public function test_any_hero_can_upgrade_up_to_level_three(): void
    {
        $ayla = $this->hero('Ayla', 300);
        $bram = $this->hero('Bram', 5000);
        $this->actingAs($ayla)->postJson('/api/buildings', ['town' => '0,0', 'slot' => 2, 'type' => 'beacon', 'gold' => 300])->assertOk();

        $this->actingAs($bram)->postJson('/api/buildings/upgrade', ['town' => '0,0', 'slot' => 2, 'gold' => 5000])
            ->assertOk()->assertJson(['gold' => 4400, 'building' => ['level' => 2, 'builder' => 'Ayla', 'upgrader' => 'Bram']]);
        $this->actingAs($bram)->postJson('/api/buildings/upgrade', ['town' => '0,0', 'slot' => 2, 'gold' => 4400])
            ->assertOk()->assertJson(['gold' => 3200, 'building' => ['level' => 3]]);
        $this->actingAs($bram)->postJson('/api/buildings/upgrade', ['town' => '0,0', 'slot' => 2, 'gold' => 3200])->assertUnprocessable();
        $this->assertSame(2100, TownBuilding::first()->gold_spent);
        $this->actingAs($bram)->postJson('/api/buildings/upgrade', ['town' => '0,0', 'slot' => 0, 'gold' => 3200])->assertNotFound();
    }

    public function test_guests_cannot_build(): void
    {
        $this->postJson('/api/buildings', ['town' => '0,0', 'slot' => 0, 'type' => 'fountain', 'gold' => 999])->assertUnauthorized();
        $this->assertSame(0, TownBuilding::count());
    }
}
