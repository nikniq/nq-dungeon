<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CharacterTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_high_level_hero_with_a_perk_every_level_can_still_save(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'class' => 'warrior']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 73, 'xp' => 5, 'gold' => 10, 'hp' => 300, 'max_hp' => 300, 'atk' => 120, 'kills' => 0, 'bag' => [], 'perks' => array_fill(0, 72, 'brawn'), 'achievements' => array_fill(0, 70, 'first_blood')];
        $this->actingAs($user)->postJson('/api/character', $state)->assertOk()->assertJson(['level' => 73]);
        $this->assertCount(72, $user->character->fresh()->perks);
    }

    public function test_the_profile_page_names_relics_in_the_bag(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'class' => 'ranger', 'relic' => 'crown', 'bag' => ['sunstone', 'potion', 'fangblade']]);
        $this->actingAs($user)->get('/character')->assertOk()->assertSee('Crown of Aurum')->assertSee('Sunstone Amulet')->assertSee('Fangblade');
    }

    public function test_guest_can_play_without_an_account(): void
    {
        $this->get('/play')->assertOk()->assertSee('Playing as a guest');
    }

    public function test_registration_creates_a_character_and_logs_in(): void
    {
        $this->post('/register', [
            'character' => 'Thorin',
            'email' => 'thorin@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'class' => 'ranger',
        ])->assertRedirect('/play');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('characters', ['name' => 'Thorin', 'floor' => 0, 'level' => 1, 'class' => 'ranger']);
        $this->get('/play')->assertOk()->assertSee('Thorin')->assertDontSee('Playing as a guest');
    }

    public function test_hero_names_must_be_unique_and_safe(): void
    {
        User::factory()->create()->character()->create(['name' => 'Thorin']);

        $this->from('/register')->post('/register', [
            'character' => 'thorin', 'email' => 'x@example.com', 'password' => 'password123', 'password_confirmation' => 'password123', 'class' => 'mage',
        ])->assertRedirect('/register')->assertSessionHasErrors('character');
        $this->from('/register')->post('/register', [
            'character' => '<script>', 'email' => 'y@example.com', 'password' => 'password123', 'password_confirmation' => 'password123', 'class' => 'mage',
        ])->assertRedirect('/register')->assertSessionHasErrors('character');
        $this->assertGuest();
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

        // death keeps level and gear, halves gold, drops potions and active quests
        $this->actingAs($user)->postJson('/api/character', ['event' => 'death', 'kills' => 2] + $state)->assertOk()
            ->assertJson(['floor' => 0, 'level' => 2, 'gold' => 20, 'hp' => 24, 'best_floor' => 3, 'best_gold' => 40, 'kills' => 8, 'runs' => 1, 'wins' => 0, 'weapon' => 'short_sword', 'armor' => 'leather', 'bag' => ['dagger']]);
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
        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => null, 'armor' => null, 'bag' => array_fill(0, 17, 'potion')])
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
        $this->actingAs($user)->post('/character', ['name' => 'Ayla the Bold', 'bio' => 'Fears no goblin.', 'class' => 'mage'])->assertRedirect('/character');
        $this->actingAs($user)->post('/character/abandon')->assertRedirect('/character');
        $this->assertDatabaseHas('characters', ['name' => 'Ayla the Bold', 'bio' => 'Fears no goblin.', 'class' => 'mage', 'floor' => 0, 'level' => 1]);
    }

    public function test_logout(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post('/logout')->assertRedirect('/');
        $this->assertGuest();
    }

    public function test_landing_page_shows_leaderboard(): void
    {
        $this->get('/')->assertOk()->assertSee('Play now')->assertSee('No heroes yet');

        $a = User::factory()->create(); $a->character()->create(['name' => 'Ayla', 'wins' => 2, 'best_floor' => 5]);
        $b = User::factory()->create(); $b->character()->create(['name' => 'Bram', 'wins' => 0, 'best_floor' => 3]);

        $this->get('/')->assertOk()->assertSeeInOrder(['Ayla', 'Bram'])->assertSee('All 2 heroes');
    }

    public function test_public_profile_and_directory(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'bio' => 'Fears no goblin.', 'floor' => 2, 'wins' => 1, 'weapon' => 'mace', 'armor' => 'chain']);
        User::factory()->create()->character()->create(['name' => 'Bram']);

        $this->get('/heroes/Ayla')->assertOk()
            ->assertSee('Fears no goblin.')->assertSee('Rank #1')->assertSee('Currently on floor 2')->assertSee('Mace')->assertSee('Chain mail')
            ->assertDontSee('Edit your profile');
        $this->get('/heroes/Bram')->assertOk()->assertSee('Rank #2')->assertSee('Resting in town');
        $this->get('/heroes/Nobody')->assertNotFound();
        $this->get('/heroes')->assertOk()->assertSeeInOrder(['Ayla', 'Bram']);
        $this->get('/heroes?q=bra')->assertOk()->assertSee('Bram')->assertDontSee('Ayla');

        $this->actingAs($user)->get('/heroes/Ayla')->assertOk()->assertSee('Edit your profile');
    }

    public function test_login_redirects_to_intended_page(): void
    {
        $user = User::factory()->create(['password' => 'password123']);
        $this->get('/character')->assertRedirect('/login');
        $this->post('/login', ['email' => $user->email, 'password' => 'password123'])->assertRedirect('/character');
    }

    public function test_emptying_an_equipment_slot_is_saved(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla', 'weapon' => 'mace', 'armor' => 'chain', 'relic' => 'sunstone']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 1, 'xp' => 0, 'gold' => 0, 'hp' => 20, 'max_hp' => 20, 'atk' => 3, 'kills' => 0, 'bag' => []];

        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => null, 'armor' => null, 'relic' => null])->assertOk()
            ->assertJson(['weapon' => null, 'armor' => null, 'relic' => null]);
        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => null, 'armor' => null, 'relic' => 'not-a-relic'])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['weapon' => null, 'armor' => null, 'relic' => 'crown', 'meta' => ['story' => ['ch' => 2, 'phase' => 'seek'], 'found' => ['sunstone'], 'places' => ['1,2'], 'bestiary' => ['Rat' => 4]]])->assertOk()
            ->assertJson(['relic' => 'crown', 'meta' => ['story' => ['ch' => 2, 'phase' => 'seek'], 'found' => ['sunstone']]]);
    }

    public function test_realm_standing_and_bank_survive_a_fall(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $realm = ['rank' => 2, 'standing' => 1200, 'oath' => true, 'guild' => false, 'bank' => 900];
        $state = ['floor' => 3, 'level' => 4, 'xp' => 0, 'gold' => 400, 'hp' => 0, 'max_hp' => 30, 'atk' => 3, 'kills' => 0, 'bag' => []];

        $this->actingAs($user)->postJson('/api/character', $state + ['event' => 'death', 'meta' => ['realm' => $realm, 'blessing' => ['atk' => 0, 'def' => 3, 'turns' => 200, 'name' => 'bear spirit']]])->assertOk()
            ->assertJson(['gold' => 200, 'meta' => ['realm' => $realm]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['event' => 'progress', 'meta' => ['realm' => ['rank' => 9] + $realm]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['event' => 'progress', 'meta' => ['realm' => ['bank' => -5] + $realm]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['event' => 'progress', 'meta' => ['encounters' => 12]])->assertOk()->assertJson(['meta' => ['encounters' => 12]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['event' => 'progress', 'meta' => ['encounters' => -1]])->assertUnprocessable();
    }

    public function test_the_inn_chest_and_deep_record_are_saved_and_checked(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 9, 'xp' => 0, 'gold' => 10, 'hp' => 40, 'max_hp' => 40, 'atk' => 5, 'kills' => 0, 'bag' => []];
        $this->get('/heroes/Ayla')->assertOk()->assertDontSee('Deepest in the Deep');

        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['room' => true, 'stash' => ['longsword', 'crown', 'potion'], 'deepest' => 12]])->assertOk()
            ->assertJson(['meta' => ['room' => true, 'stash' => ['longsword', 'crown', 'potion'], 'deepest' => 12]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['stash' => ['excalibur']]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['stash' => array_fill(0, 21, 'potion')]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['deepest' => 500]])->assertUnprocessable();
        $this->get('/heroes/Ayla')->assertOk()->assertSee('Deepest in the Deep')->assertSee('Floor 12');
    }

    public function test_realm_questline_progress_is_saved_and_checked(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 9, 'xp' => 0, 'gold' => 10, 'hp' => 40, 'max_hp' => 40, 'atk' => 5, 'kills' => 0, 'bag' => []];
        $rq = ['cantons' => ['s' => 5, 'n' => 0], 'league' => ['s' => 1, 'n' => 120]];

        $this->actingAs($user)->postJson('/api/character', $state + ['relic' => 'ledger', 'meta' => ['rq' => $rq, 'found' => ['cantonsbadge', 'ledger']]])->assertOk()
            ->assertJson(['relic' => 'ledger', 'meta' => ['rq' => $rq]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['rq' => ['atlantis' => ['s' => 1, 'n' => 0]]]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['rq' => ['aurum' => ['s' => 9, 'n' => 0]]]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['horse' => true, 'arena' => 12]])->assertOk()->assertJson(['meta' => ['horse' => true, 'arena' => 12]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['arena' => -3]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['ship' => ['x' => 140, 'y' => -62]]])->assertOk()->assertJson(['meta' => ['ship' => ['x' => 140, 'y' => -62]]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['ship' => ['x' => 'far']]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['charts' => ['140,-62', '-3,9'], 'treasures' => 2, 'found' => ['stormpearl']]])->assertOk()->assertJson(['meta' => ['charts' => ['140,-62', '-3,9'], 'treasures' => 2]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['charts' => ['a,b']]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['secrets' => ['295,-96']]])->assertOk()->assertJson(['meta' => ['secrets' => ['295,-96']]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['story2' => ['s' => 3], 'rq' => ['tianxia' => ['s' => 2, 'n' => 1]], 'found' => ['jadeseal']]])->assertOk()->assertJson(['meta' => ['story2' => ['s' => 3], 'rq' => ['tianxia' => ['s' => 2, 'n' => 1]]]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['story2' => ['s' => 7]]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['story3' => ['s' => 2], 'found' => ['frostheart']]])->assertOk()->assertJson(['meta' => ['story3' => ['s' => 2]]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['story3' => ['s' => 5]]])->assertUnprocessable();
    }

    public function test_bounties_fish_and_the_rod_are_saved(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 3, 'xp' => 0, 'gold' => 10, 'hp' => 30, 'max_hp' => 30, 'atk' => 4, 'kills' => 0];
        $bounty = ['id' => 'bounty:0,0', 'kind' => 'bounty', 'label' => 'Hunt Old Gnasher', 'target' => '0,0', 'need' => 1, 'have' => 0, 'done' => false, 'giver' => 'Captain Orla', 'reward' => 80];

        $this->actingAs($user)->postJson('/api/character', $state + ['bag' => ['fish', 'stew', 'goldcarp'], 'quests' => [$bounty], 'meta' => ['rod' => true]])->assertOk()
            ->assertJson(['bag' => ['fish', 'stew', 'goldcarp'], 'quests' => [['kind' => 'bounty']], 'meta' => ['rod' => true]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['bag' => [], 'quests' => [['kind' => 'heist'] + $bounty]])->assertUnprocessable();
    }

    public function test_armies_and_razed_camps_are_saved_and_checked(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 3, 'xp' => 0, 'gold' => 10, 'hp' => 30, 'max_hp' => 30, 'atk' => 4, 'kills' => 0, 'bag' => []];
        $war = ['troops' => ['cantons' => 30, 'aurum' => 0, 'kathar' => 0, 'league' => 10],
            'armies' => [['realm' => 'aurum', 'x' => 10, 'y' => 20, 'tx' => 140, 'ty' => -30, 'troops' => 40, 'target' => '1,0', 'mine' => true]],
            'camps' => ['1,0', '-2,-2']];

        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['war' => $war]])->assertOk()->assertJson(['meta' => ['war' => $war]]);
        $bad = $war; $bad['armies'][0]['realm'] = 'orcs';
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['war' => $bad]])->assertUnprocessable();
        $bad = $war; $bad['troops']['atlantis'] = 5;
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['war' => $bad]])->assertUnprocessable();
    }

    public function test_act_two_progress_is_saved_and_checked(): void
    {
        $user = User::factory()->create();
        $user->character()->create(['name' => 'Ayla']);
        $state = ['event' => 'progress', 'floor' => 0, 'level' => 30, 'xp' => 0, 'gold' => 10, 'hp' => 100, 'max_hp' => 100, 'atk' => 9, 'kills' => 0, 'bag' => []];

        $this->actingAs($user)->postJson('/api/character', $state + ['relic' => 'deepheart', 'meta' => ['act2' => ['s' => 3, 'n' => 0, 'told' => true], 'found' => ['deepheart']]])->assertOk()
            ->assertJson(['relic' => 'deepheart', 'meta' => ['act2' => ['s' => 3, 'told' => true]]]);
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['act2' => ['s' => 9]]])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/character', $state + ['meta' => ['act2' => ['told' => true]]])->assertUnprocessable();
    }
}
