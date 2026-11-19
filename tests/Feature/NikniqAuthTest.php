<?php

namespace Tests\Feature;

use App\Models\User;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Psr7\Request as PsrRequest;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Mockery;
use Tests\TestCase;

class NikniqAuthTest extends TestCase
{
    use RefreshDatabase;

    private function enable(?string $secret = null): void
    {
        config(['services.nikniq' => ['url' => 'https://portal.test', 'client_id' => 'nq_dungeon', 'client_secret' => $secret, 'redirect' => '/auth/callback']]);
    }

    /** Start a sign-in and return the state the portal would echo back. */
    private function start(): string
    {
        $res = $this->get('/auth/nikniq/redirect')->assertRedirect();
        parse_str(parse_url($res->headers->get('Location'), PHP_URL_QUERY), $q);

        return $q['state'];
    }

    private function fakePortal(string $sub, string $email, string $name, bool $verified = true, int $status = 200): void
    {
        Http::fake([
            'portal.test/api/sso/token' => $status === 200
                ? Http::response(['token_type' => 'Bearer', 'access_token' => 'tok-1', 'player' => ['id' => (int) $sub, 'name' => $name, 'email' => $email, 'avatar' => null]])
                : Http::response(['error' => 'invalid_client', 'error_description' => 'Client authentication failed.'], $status),
            'portal.test/api/oauth/userinfo' => Http::response(['sub' => $sub, 'name' => $name, 'email' => $email, 'email_verified' => $verified]),
        ]);
    }

    public function test_hidden_and_404_when_not_configured(): void
    {
        config(['services.nikniq.client_id' => null]);
        $this->get('/login')->assertOk()->assertDontSee('Continue with NikniQ');
        $this->get('/auth/nikniq/redirect')->assertNotFound();
        $this->get('/auth/callback?code=x&state=y')->assertNotFound();
    }

    public function test_button_shows_and_redirects_to_the_portal_with_pkce(): void
    {
        $this->enable();
        $this->get('/login')->assertOk()->assertSee('Continue with NikniQ');
        $this->get('/register')->assertOk()->assertSee('Continue with NikniQ');

        $location = $this->get('/auth/nikniq/redirect?provider=google')->headers->get('Location');
        $this->assertStringStartsWith('https://portal.test/sso/authorize?', $location);
        parse_str(parse_url($location, PHP_URL_QUERY), $q);
        $this->assertSame('nq_dungeon', $q['client_id']);
        $this->assertSame(url('/auth/callback'), $q['redirect_uri']);
        $this->assertSame('S256', $q['code_challenge_method']);
        $this->assertSame('openid profile email', $q['scope']);
        $this->assertSame('google', $q['provider']);
        $verifier = session('nikniq_oauth.verifier');
        $this->assertSame(rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='), $q['code_challenge']);
    }

    public function test_new_portal_player_gets_an_account_and_a_hero(): void
    {
        $this->enable('shh');
        $this->fakePortal('42', 'Mira@Example.com', 'Mira Vale');
        $state = $this->start();

        $this->get("/auth/callback?code=abc&state={$state}")->assertRedirect('/character');
        $this->assertAuthenticated();
        $user = User::where('email', 'mira@example.com')->first();
        $this->assertSame('42', $user->nikniq_id);
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseHas('characters', ['user_id' => $user->id, 'name' => 'Mira Vale']);

        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/api/sso/token')
            && $r['code'] === 'abc' && $r['client_secret'] === 'shh' && $r['redirect_uri'] === url('/auth/callback') && strlen($r['code_verifier']) === 64);
    }

    public function test_verified_email_links_an_existing_account_and_returning_players_log_straight_in(): void
    {
        $this->enable();
        $user = User::factory()->create(['email' => 'mira@example.com']);
        $this->fakePortal('42', 'mira@example.com', 'Mira');

        $this->get('/auth/callback?code=abc&state='.$this->start())->assertRedirect('/play');
        $this->assertAuthenticatedAs($user);
        $this->assertSame('42', $user->fresh()->nikniq_id);

        auth()->logout();
        $this->get('/auth/callback?code=def&state='.$this->start())->assertRedirect('/play');
        $this->assertAuthenticatedAs($user);
        $this->assertSame(1, User::count());
    }

    public function test_unverified_email_does_not_take_over_an_existing_account(): void
    {
        $this->enable();
        User::factory()->create(['email' => 'mira@example.com']);
        $this->fakePortal('42', 'mira@example.com', 'Mira', verified: false);

        $this->get('/auth/callback?code=abc&state='.$this->start())->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_a_forged_or_stale_state_is_refused_without_calling_the_portal(): void
    {
        $this->enable();
        Http::fake();
        $this->start();

        $this->get('/auth/callback?code=abc&state=forged')->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->assertGuest();
        Http::assertNothingSent();
    }

    public function test_a_rejected_token_exchange_and_a_cancel_return_to_login(): void
    {
        $this->enable();
        $this->fakePortal('42', 'mira@example.com', 'Mira', status: 401);
        $this->get('/auth/callback?code=abc&state='.$this->start())->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->get('/auth/callback?error=access_denied&state='.$this->start())->assertRedirect('/login');
        $this->assertStringContainsString('cancelled', session('errors')->first('email'));
    }

    public function test_google_retries_once_on_a_lost_session_then_gives_up(): void
    {
        config(['services.google.client_id' => 'id', 'services.google.client_secret' => 'secret']);
        $driver = Mockery::mock();
        $driver->shouldReceive('user')->andThrow(new InvalidStateException);
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);

        $this->get('/auth/google/callback')->assertRedirect('/auth/google/redirect');
        $this->get('/auth/google/callback')->assertRedirect('/login')->assertSessionHasErrors('email');
    }

    public function test_google_with_a_bad_secret_logs_a_configuration_error(): void
    {
        config(['services.google.client_id' => 'id', 'services.google.client_secret' => 'wrong']);
        $driver = Mockery::mock();
        $driver->shouldReceive('user')->andThrow(new ClientException('401', new PsrRequest('POST', 'https://oauth2.googleapis.com/token'),
            new PsrResponse(401, [], json_encode(['error' => 'invalid_client', 'error_description' => 'The provided client secret is invalid.']))));
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);
        Log::shouldReceive('error')->once()->withArgs(fn ($m) => str_contains($m, 'invalid_client') && str_contains($m, 'GOOGLE_CLIENT_SECRET'));

        $this->get('/auth/google/callback')->assertRedirect('/login')->assertSessionHasErrors('email');
    }
}
