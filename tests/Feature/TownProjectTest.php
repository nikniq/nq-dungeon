<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TownProjectTest extends TestCase
{
    use RefreshDatabase;

    public function test_projects_are_public_shared_and_ranked(): void
    {
        $this->getJson('/api/projects?towns=0,0')->assertOk()->assertJson(['projects' => [], 'mine' => 0]);
        $this->postJson('/api/projects', ['town' => '0,0', 'project' => 'walls', 'gold' => 5000])->assertUnauthorized();

        $a = User::factory()->create(); $a->character()->create(['name' => 'Ayla', 'class' => 'warrior', 'gold' => 5000]);
        $b = User::factory()->create(); $b->character()->create(['name' => 'Bram', 'class' => 'ranger', 'gold' => 5000]);
        $this->actingAs($a)->postJson('/api/projects', ['town' => '0,0', 'project' => 'walls', 'gold' => 5000])->assertOk()
            ->assertJson(['project' => ['town' => '0,0', 'project' => 'walls', 'builder' => 'Ayla'], 'gold' => 3800, 'mine' => 1]);
        $this->assertSame(3800, $a->character->fresh()->gold);
        $this->actingAs($b)->postJson('/api/projects', ['town' => '0,0', 'project' => 'walls', 'gold' => 5000])->assertStatus(409);
        $this->actingAs($b)->postJson('/api/projects', ['town' => '0,0', 'project' => 'road', 'gold' => 100])->assertStatus(422);
        $this->actingAs($b)->postJson('/api/projects', ['town' => '0,0', 'project' => 'palace', 'gold' => 5000])->assertUnprocessable();
        $this->actingAs($a)->postJson('/api/projects', ['town' => '1,0', 'project' => 'road', 'gold' => 3800])->assertOk()->assertJson(['mine' => 2]);
        $this->actingAs($b)->postJson('/api/projects', ['town' => '0,0', 'project' => 'memorial', 'gold' => 5000])->assertOk();

        $this->getJson('/api/projects?towns=0,0|1,0')->assertOk()->assertJsonCount(3, 'projects');
        $this->actingAs($b)->getJson('/api/projects?towns=0,0')->assertOk()->assertJson(['mine' => 1]);
        $this->get('/heroes')->assertOk()->assertSee('Builders of the realms')->assertSeeInOrder(['Ayla', 'Bram']);
        $this->get('/play')->assertOk()->assertSee('projectsUrl', false);
    }
}
