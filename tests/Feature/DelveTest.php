<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DelveTest extends TestCase
{
    use RefreshDatabase;

    public function test_one_scored_delve_a_day_and_a_public_board(): void
    {
        $this->getJson('/api/delve')->assertOk()->assertJson(['board' => [], 'entries' => 0, 'mine' => null]);
        $this->postJson('/api/delve', ['floor' => 3, 'kills' => 10, 'gold' => 50, 'cleared' => false])->assertUnauthorized();

        $a = User::factory()->create(); $a->character()->create(['name' => 'Ayla', 'class' => 'ranger']);
        $b = User::factory()->create(); $b->character()->create(['name' => 'Bram', 'class' => 'warrior']);
        $this->actingAs($a)->postJson('/api/delve', ['floor' => 3, 'kills' => 10, 'gold' => 50, 'cleared' => false])->assertOk()
            ->assertJson(['mine' => ['rank' => 1, 'score' => 400, 'name' => 'Ayla'], 'entries' => 1]);
        $this->actingAs($b)->postJson('/api/delve', ['floor' => 5, 'kills' => 20, 'gold' => 120, 'cleared' => true])->assertOk()
            ->assertJson(['mine' => ['rank' => 1, 'score' => 970]]);
        $this->actingAs($a)->postJson('/api/delve', ['floor' => 5, 'kills' => 0, 'gold' => 0, 'cleared' => false])->assertStatus(409);
        $this->actingAs($a)->postJson('/api/delve', ['floor' => 9, 'kills' => 0, 'gold' => 0, 'cleared' => false])->assertUnprocessable();

        $this->actingAs($a)->getJson('/api/delve')->assertOk()->assertJson(['entries' => 2, 'mine' => ['rank' => 2, 'score' => 400]])->assertJsonPath('board.0.name', 'Bram');
        $this->get('/heroes')->assertOk()->assertSee("Today's Delve", false)->assertSeeInOrder(['Bram', 'Ayla']);
        $this->get('/play')->assertOk()->assertSee('delveUrl', false);
    }
}
