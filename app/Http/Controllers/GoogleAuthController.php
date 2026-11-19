<?php

namespace App\Http\Controllers;

use App\Support\SocialSignIn;
use GuzzleHttp\Exception\ClientException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Throwable;

class GoogleAuthController extends Controller
{
    public static function enabled(): bool
    {
        return filled(config('services.google.client_id')) && filled(config('services.google.client_secret'));
    }

    public function redirect(): RedirectResponse
    {
        abort_unless(self::enabled(), 404);

        return Socialite::driver('google')->scopes(['openid', 'profile', 'email'])->redirect();
    }

    public function callback(): RedirectResponse
    {
        abort_unless(self::enabled(), 404);

        if (request()->filled('error')) {
            // the player pressed Cancel on Google's screen, or Google refused the request
            return SocialSignIn::fail(request('error') === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google sign-in did not complete. Please try again.');
        }

        try {
            $google = Socialite::driver('google')->user();
        } catch (InvalidStateException $e) {
            // the session that started the sign-in is gone (expired, another tab, back button): start again once
            if (! session()->pull('google_retried')) {
                session()->put('google_retried', true);

                return redirect()->route('google.redirect');
            }
            report($e);

            return SocialSignIn::fail('Google sign-in timed out. Please try again.');
        } catch (ClientException $e) {
            // a 4xx from Google's token endpoint is our configuration, not the player: say so in the log
            $body = json_decode((string) $e->getResponse()->getBody(), true);
            Log::error('Google sign-in is misconfigured: '.($body['error'] ?? 'unknown').' ('.($body['error_description'] ?? $e->getMessage()).'). Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, then php artisan config:clear.');

            return SocialSignIn::fail('Google sign-in is not available right now. Please log in another way.');
        } catch (Throwable $e) {
            report($e);

            return SocialSignIn::fail('Google sign-in did not complete. Please try again.');
        }
        session()->forget('google_retried');

        $verified = (bool) ($google->user['email_verified'] ?? $google->user['verified_email'] ?? false);

        return SocialSignIn::complete('google_id', 'google', 'Google', (string) $google->getId(), $google->getEmail(), $verified, $google->getName(), $google->getAvatar());
    }
}
