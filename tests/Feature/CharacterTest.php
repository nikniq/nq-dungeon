<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CharacterTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_play_without_an_account(): void
    {
        $this->get('/')->assertOk()->assertSee('Playing as a guest');
    }

    public function test_registration_creates_a_character_and_logs_in(): void
    {
        $this->post('/register', [
            'character' => 'Thorin',
            'email' => 'thorin@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect('/');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('characters', ['name' => 'Thorin', 'floor' => 0, 'level' => 1]);
        $this->get('/')->assertOk()->assertSee('Thorin')->assertDontSee('Playing as a guest');
    }

    public function test_login_with_wrong_password_fails(): void
    {
        $user = User::factory()->create(['password' => 'password123']);

        $this->from('/login')->post('/login', ['email' => $user->email, 'password' => 'nope'])
            ->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_save_api_requires_login(): void
    {
        $this->getJson('/api/character')->assertUnauthorized();
        $this->get('/api/character')->assertRedirect('/login');
    }

    public function test_run_is_saved_per_floor_and_reset_on_death(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);

        $state = ['floor' => 1, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3, 'kills' => 0, 'weapon' => null, 'armor' => null, 'bag' => []];
        $this->actingAs($user)->postJson('/api/character', ['event' => 'progress'] + $state)->assertOk()
            ->assertJson(['floor' => 1, 'runs' => 1]);

        $state = ['floor' => 3, 'level' => 2, 'xp' => 5, 'gold' => 40, 'hp' => 9, 'max_hp' => 24, 'atk' => 4, 'kills' => 6, 'weapon' => 'short_sword', 'armor' => 'leather', 'bag' => ['potion', 'dagger']];
        $this->actingAs($user)->postJson('/api/character', ['event' => 'progress'] + $state)->assertOk()
            ->assertJson(['floor' => 3, 'level' => 2, 'gold' => 40, 'hp' => 9, 'best_floor' => 3, 'kills' => 6, 'runs' => 1, 'weapon' => 'short_sword', 'armor' => 'leather', 'bag' => ['potion', 'dagger']]);

        // Reloading the page resumes from the saved floor.
        $this->actingAs($user)->getJson('/api/character')->assertOk()->assertJson(['floor' => 3, 'name' => 'Ayla']);

        $this->actingAs($user)->postJson('/api/character', ['event' => 'death', 'kills' => 2] + $state)->assertOk()
            ->assertJson(['floor' => 0, 'level' => 1, 'gold' => 0, 'best_floor' => 3, 'best_gold' => 40, 'kills' => 8, 'runs' => 1, 'wins' => 0, 'weapon' => null, 'armor' => null, 'bag' => []]);
    }

    public function test_win_counts_an_escape(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'floor' => 5]);
        $state = ['event' => 'win', 'floor' => 5, 'level' => 6, 'xp' => 1, 'gold' => 300, 'hp' => 30, 'max_hp' => 40, 'atk' => 8, 'kills' => 3, 'weapon' => 'warhammer', 'armor' => 'plate', 'bag' => []];

        $this->actingAs($user)->postJson('/api/character', $state)->assertOk()
            ->assertJson(['wins' => 1, 'floor' => 0, 'best_floor' => 5, 'best_gold' => 300,
                'level' => 6, 'gold' => 300, 'weapon' => 'warhammer', 'armor' => 'plate']);
    }

    public function test_town_state_is_saved_without_starting_a_run(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3, 'kills' => 0, 'weapon' => 'dagger', 'armor' => null, 'bag' => []];

        $this->actingAs($user)->postJson('/api/character', $state)->assertOk()
            ->assertJson(['floor' => 0, 'runs' => 0, 'weapon' => 'dagger']);
    }

    public function test_save_rejects_bad_input(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/character', ['event' => 'cheat', 'floor' => -1])
            ->assertUnprocessable();

        $state = ['event' => 'progress', 'floor' => 1, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3, 'kills' => 0];
        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => 'lightsaber', 'armor' => null, 'bag' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('weapon');
        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => null, 'armor' => null, 'bag' => ['potion', 'excalibur']])
            ->assertUnprocessable()->assertJsonValidationErrors('bag.1');
        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => null, 'armor' => null, 'bag' => array_fill(0, 13, 'potion')])
            ->assertUnprocessable()->assertJsonValidationErrors('bag');
    }

    public function test_character_page_shows_equipment(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'floor' => 2, 'weapon' => 'mace', 'armor' => 'chain', 'bag' => ['potion', 'dagger']]);

        $this->actingAs($user)->get('/character')->assertOk()
            ->assertSee('Mace (+3 attack)')->assertSee('Chain mail (2 defence)')->assertSee('Potion, Dagger');
    }

    public function test_character_page_rename_and_abandon(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'floor' => 2, 'level' => 3]);

        $this->actingAs($user)->get('/character')->assertOk()->assertSee('Ayla')->assertSee('Floor 2,');
        $this->actingAs($user)->post('/character', ['name' => 'Ayla the Bold'])->assertRedirect('/');
        $this->actingAs($user)->post('/character/abandon')->assertRedirect('/');
        $this->assertDatabaseHas('characters', ['name' => 'Ayla the Bold', 'floor' => 0, 'level' => 1]);
    }

    public function test_logout(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post('/logout')->assertRedirect('/');
        $this->assertGuest();
    }
}
