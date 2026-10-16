<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function enable(): void
    {
        config(['services.google.client_id' => 'test-id', 'services.google.client_secret' => 'test-secret', 'services.google.redirect' => 'http://localhost/auth/google/callback']);
    }

    private function fakeGoogle(string $id, string $email, string $name, bool $verified = true): void
    {
        $user = (new SocialiteUser)->setRaw(['sub' => $id, 'email' => $email, 'email_verified' => $verified, 'name' => $name])
            ->map(['id' => $id, 'email' => $email, 'name' => $name, 'avatar' => 'https://example.com/a.png']);
        $driver = Mockery::mock();
        $driver->shouldReceive('user')->andReturn($user);
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);
    }

    public function test_hidden_and_404_when_not_configured(): void
    {
        config(['services.google.client_id' => null, 'services.google.client_secret' => null]);
        $this->get('/login')->assertOk()->assertDontSee('Continue with Google');
        $this->get('/auth/google/redirect')->assertNotFound();
    }

    public function test_button_shows_and_redirects_to_google_when_configured(): void
    {
        $this->enable();
        $this->get('/login')->assertOk()->assertSee('Continue with Google');
        $this->get('/register')->assertOk()->assertSee('Continue with Google');
        $res = $this->get('/auth/google/redirect')->assertRedirect();
        $this->assertStringStartsWith('https://accounts.google.com/', $res->headers->get('Location'));
    }

    public function test_new_google_user_gets_an_account_and_a_hero(): void
    {
        $this->enable();
        $this->fakeGoogle('g-1', 'Ayla@Example.com', 'Ayla Stone');

        $this->get('/auth/google/callback')->assertRedirect('/character');
        $this->assertAuthenticated();
        $user = User::where('email', 'ayla@example.com')->first();
        $this->assertSame('g-1', $user->google_id);
        $this->assertNull($user->password);
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseHas('characters', ['user_id' => $user->id, 'name' => 'Ayla Stone', 'class' => 'warrior']);
    }

    public function test_hero_name_is_made_safe_and_unique(): void
    {
        $this->enable();
        User::factory()->create()->character()->create(['name' => 'Ayla Stone']);
        $this->fakeGoogle('g-2', 'other@example.com', 'Ayla <Stone>!');

        $this->get('/auth/google/callback');
        $this->assertDatabaseHas('characters', ['name' => 'Ayla Stone 2']);
    }

    public function test_existing_account_with_verified_email_is_linked(): void
    {
        $this->enable();
        $existing = User::factory()->create(['email' => 'thorin@example.com', 'password' => 'password123']);
        $existing->character()->create(['name' => 'Thorin']);
        $this->fakeGoogle('g-3', 'thorin@example.com', 'Thorin O');

        $this->get('/auth/google/callback')->assertRedirect('/play');
        $this->assertAuthenticatedAs($existing);
        $this->assertSame('g-3', $existing->fresh()->google_id);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('characters', 1);
    }

    public function test_unverified_email_does_not_take_over_an_existing_account(): void
    {
        $this->enable();
        User::factory()->create(['email' => 'thorin@example.com']);
        $this->fakeGoogle('g-4', 'thorin@example.com', 'Imposter', verified: false);

        $this->get('/auth/google/callback')->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_returning_google_user_logs_straight_in(): void
    {
        $this->enable();
        $this->fakeGoogle('g-5', 'pip@example.com', 'Pip');
        $this->get('/auth/google/callback');
        $this->post('/logout');

        $this->get('/auth/google/callback')->assertRedirect('/play');
        $this->assertAuthenticated();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_a_failed_handshake_returns_to_login(): void
    {
        $this->enable();
        $driver = Mockery::mock();
        $driver->shouldReceive('user')->andThrow(new \Laravel\Socialite\Two\InvalidStateException);
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);

        $this->get('/auth/google/callback')->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_google_only_account_cannot_log_in_with_a_blank_password(): void
    {
        $this->enable();
        $this->fakeGoogle('g-6', 'nopass@example.com', 'Nopass');
        $this->get('/auth/google/callback');
        $this->post('/logout');

        $this->from('/login')->post('/login', ['email' => 'nopass@example.com', 'password' => 'anything'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }
}
