<?php

namespace App\Http\Controllers;

use App\Support\SocialSignIn;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * "Continue with NikniQ": sign in with the player's nikniq.com games-portal account.
 * The portal is a standard OAuth 2.0 / OpenID Connect server; this game is a client
 * registered there (admin → games → dungeon). Authorization code flow with PKCE,
 * plus the client secret when the portal gave us one (confidential client).
 */
class NikniqAuthController extends Controller
{
    public static function enabled(): bool
    {
        return filled(config('services.nikniq.client_id')) && filled(config('services.nikniq.url'));
    }

    private function base(): string
    {
        return rtrim((string) config('services.nikniq.url'), '/');
    }

    private function redirectUri(): string
    {
        $uri = (string) config('services.nikniq.redirect');

        return str_starts_with($uri, 'http') ? $uri : url($uri);
    }

    public function redirect(Request $request): RedirectResponse
    {
        abort_unless(self::enabled(), 404);

        $state = Str::random(40);
        $verifier = Str::random(64);
        $request->session()->put('nikniq_oauth', ['state' => $state, 'verifier' => $verifier]);

        $query = [
            'response_type' => 'code',
            'client_id' => config('services.nikniq.client_id'),
            'redirect_uri' => $this->redirectUri(),
            'scope' => 'openid profile email',
            'state' => $state,
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ];
        if ($request->query('provider') === 'google') {
            $query['provider'] = 'google';   // the portal sends guests straight on to Google
        }

        return redirect()->away($this->base().'/sso/authorize?'.http_build_query($query));
    }

    public function callback(Request $request): RedirectResponse
    {
        abort_unless(self::enabled(), 404);

        $saved = $request->session()->pull('nikniq_oauth');
        if ($request->filled('error')) {
            return SocialSignIn::fail($request->query('error') === 'access_denied' ? 'NikniQ sign-in was cancelled.' : 'NikniQ sign-in did not complete. Please try again.');
        }
        if (! is_array($saved) || ! is_string($request->query('state')) || ! hash_equals($saved['state'], $request->query('state'))) {
            return SocialSignIn::fail('NikniQ sign-in timed out. Please try again.');
        }
        if (! is_string($request->query('code')) || $request->query('code') === '') {
            return SocialSignIn::fail('NikniQ sign-in did not complete. Please try again.');
        }

        try {
            $token = Http::asForm()->acceptJson()->timeout(10)->post($this->base().'/api/sso/token', array_filter([
                'grant_type' => 'authorization_code',
                'code' => $request->query('code'),
                'redirect_uri' => $this->redirectUri(),
                'client_id' => config('services.nikniq.client_id'),
                'client_secret' => config('services.nikniq.client_secret'),
                'code_verifier' => $saved['verifier'],
            ]));
            if (! $token->successful() || ! is_string($token->json('access_token'))) {
                Log::error('NikniQ sign-in: token exchange failed: '.$token->status().' '.($token->json('error') ?? '').' ('.($token->json('error_description') ?? '').'). Check NIKNIQ_CLIENT_ID / NIKNIQ_CLIENT_SECRET and the redirect URI registered on the portal.');

                return SocialSignIn::fail('NikniQ sign-in is not available right now. Please log in another way.');
            }

            // the OpenID userinfo carries email_verified, which the token's player block does not
            $info = Http::withToken($token->json('access_token'))->acceptJson()->timeout(10)->get($this->base().'/api/oauth/userinfo');
            $claims = $info->successful() ? (array) $info->json() : [];
        } catch (Throwable $e) {
            report($e);

            return SocialSignIn::fail('NikniQ sign-in did not complete. Please try again.');
        }

        $player = (array) $token->json('player', []);

        return SocialSignIn::complete(
            'nikniq_id', 'nikniq', 'NikniQ',
            (string) ($claims['sub'] ?? $player['id'] ?? ''),
            $claims['email'] ?? $player['email'] ?? null,
            (bool) ($claims['email_verified'] ?? false),
            $claims['name'] ?? $player['name'] ?? null,
            $claims['picture'] ?? $player['avatar'] ?? null,
        );
    }
}
