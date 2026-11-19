<?php

namespace App\Support;

use App\Models\Character;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * The account side of every "Continue with ..." button (Google, NikniQ).
 * Given who the provider says the player is, find or make their account and sign them in:
 *   1. a returning player, matched on the provider's id column;
 *   2. an existing account with the same email, linked only when the provider vouches for the email;
 *   3. otherwise a new account with a starter hero.
 */
class SocialSignIn
{
    /**
     * @param  string  $column  users column holding the provider's id (google_id, nikniq_id)
     * @param  string  $method  analytics label ('google', 'nikniq')
     */
    public static function complete(string $column, string $method, string $label, string $id, ?string $email, bool $verified, ?string $name, ?string $avatar): RedirectResponse
    {
        $email = Str::lower(trim((string) $email));
        if ($id === '') {
            return self::fail("{$label} sign-in did not complete. Please try again.");
        }
        if ($email === '') {
            return self::fail("Your {$label} account did not share an email address.");
        }

        $user = User::where($column, $id)->first();
        $isNew = false;
        if (! $user) {
            $existing = User::whereRaw('lower(email) = ?', [$email])->first();
            if ($existing && ! $verified) {
                return self::fail('An account with that email already exists. Log in with your password.');
            }
            if ($existing) {
                $user = $existing;
                $user->forceFill(array_filter([$column => $id, 'avatar' => $user->avatar ?: $avatar]))->save();
            } else {
                $hero = self::heroName((string) ($name ?: Str::before($email, '@')));
                $user = (new User)->forceFill(['name' => $hero, 'email' => $email, 'password' => null, $column => $id, 'avatar' => $avatar, 'email_verified_at' => $verified ? now() : null, 'signup_method' => $method]);
                $user->save();
                $user->character()->create(['name' => $hero, 'class' => 'warrior']);
                $isNew = true;
            }
        } elseif ($avatar && $user->avatar !== $avatar) {
            $user->forceFill(['avatar' => $avatar])->save();
        }

        Auth::login($user, remember: true);
        request()->session()->regenerate();

        if ($isNew) {
            return redirect()->route('character.edit')->with(['status' => "Welcome, {$user->character->name}! Pick your hero's name and class, then head to Play.", 'ga_event' => 'sign_up', 'ga_params' => ['method' => $method]]);
        }

        return redirect()->intended(route('game'))->with(['ga_event' => 'login', 'ga_params' => ['method' => $method]]);
    }

    public static function fail(string $message): RedirectResponse
    {
        return redirect()->route('login')->withErrors(['email' => $message]);
    }

    /** A safe, unused hero name built from the provider's display name. */
    public static function heroName(string $raw): string
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
