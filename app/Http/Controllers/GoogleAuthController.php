<?php

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
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

        try {
            $google = Socialite::driver('google')->user();
        } catch (Throwable $e) {
            report($e);

            return redirect()->route('login')->withErrors(['email' => 'Google sign-in did not complete. Please try again.']);
        }

        $email = Str::lower((string) $google->getEmail());
        $verified = (bool) ($google->user['email_verified'] ?? $google->user['verified_email'] ?? false);
        if ($email === '') {
            return redirect()->route('login')->withErrors(['email' => 'Your Google account did not share an email address.']);
        }

        // 1. a returning Google user; 2. an existing account with the same verified email; 3. a new hero
        $user = User::where('google_id', $google->getId())->first();
        $isNew = false;
        if (! $user) {
            $existing = User::whereRaw('lower(email) = ?', [$email])->first();
            if ($existing && ! $verified) {
                return redirect()->route('login')->withErrors(['email' => 'An account with that email already exists. Log in with your password.']);
            }
            if ($existing) {
                $user = $existing;
                $user->forceFill(['google_id' => $google->getId(), 'avatar' => $google->getAvatar()])->save();
            } else {
                $name = $this->heroName((string) ($google->getName() ?: Str::before($email, '@')));
                $user = User::create(['name' => $name, 'email' => $email, 'password' => null]);
                $user->forceFill(['google_id' => $google->getId(), 'avatar' => $google->getAvatar(), 'email_verified_at' => $verified ? now() : null])->save();
                $user->character()->create(['name' => $name, 'class' => 'warrior']);
                $isNew = true;
            }
        } elseif ($google->getAvatar() && $user->avatar !== $google->getAvatar()) {
            $user->forceFill(['avatar' => $google->getAvatar()])->save();
        }

        Auth::login($user, remember: true);
        request()->session()->regenerate();

        if ($isNew) {
            return redirect()->route('character.edit')->with(['status' => "Welcome, {$user->character->name}! Pick your hero's name and class, then head to Play.", 'ga_event' => 'sign_up', 'ga_params' => ['method' => 'google']]);
        }

        return redirect()->intended(route('game'))->with(['ga_event' => 'login', 'ga_params' => ['method' => 'google']]);
    }

    /** A safe, unused hero name built from the Google display name. */
    private function heroName(string $raw): string
    {
        $base = trim(preg_replace('/[^\pL\pN _-]+/u', '', Str::ascii($raw)) ?? '');
        $base = trim(preg_replace('/\s+/', ' ', $base) ?? '');
        if (mb_strlen($base) < 2 || ! preg_match('/^[\pL\pN]/u', $base)) {
            $base = 'Hero';
        }
        $base = mb_substr($base, 0, 20);
        $name = $base;
        for ($n = 2; Character::nameTaken($name); $n++) {
            $name = mb_substr($base, 0, 20).' '.$n;
        }

        return $name;
    }
}
