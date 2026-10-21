<?php

namespace App\Http\Controllers;

use App\Mail\LoginLink;
use App\Models\Character;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showRegister(): View
    {
        return view('auth.register');
    }

    /**
     * Signing up asks for an email, not a password: a signed link goes to the
     * address, and only once it has been opened can its owner set a password.
     */
    public function register(Request $request): View
    {
        $data = $request->validate([
            'character' => ['required', 'string', 'min:2', 'max:24', 'regex:/^[\pL\pN][\pL\pN _-]*$/u',
                fn ($attr, $value, $fail) => Character::nameTaken($value) && $fail('That hero name is already taken.')],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'class' => ['required', Rule::in(Character::CLASSES)],
        ], [], ['character' => 'hero name']);

        $user = User::create(['name' => $data['character'], 'email' => $data['email'], 'password' => null]);
        $user->character()->create(['name' => $data['character'], 'class' => $data['class']]);
        $this->sendLink($user, welcome: true);

        return view('auth.check-email', ['email' => $user->email, 'welcome' => true]);
    }

    /** A signed, two-day link that proves the address and logs its owner in. */
    public static function linkFor(User $user): string
    {
        return URL::temporarySignedRoute('verify', now()->addDays(2), ['user' => $user->id, 'hash' => sha1($user->email)]);
    }

    private function sendLink(User $user, bool $welcome): void
    {
        Mail::to($user->email)->send(new LoginLink($user, self::linkFor($user), $welcome));
    }

    /** The link from the email: the address is proven, the owner is signed in and sent to set a password. */
    public function verify(Request $request, User $user, string $hash): RedirectResponse
    {
        abort_unless(hash_equals(sha1($user->email), $hash), 403);
        $first = ! $user->email_verified_at;
        if ($first) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        Auth::login($user, remember: true);
        $request->session()->regenerate();
        $request->session()->put('password.fresh', true);
        if ($first) {
            $request->session()->put('password.welcome', $user->character?->class ?? 'warrior');
        }

        return redirect()->route('password.set')->with('status', $first ? 'Email confirmed. Choose a password for your hero.' : 'Signed in by email link. Set a new password if you need one, or just play.');
    }

    public function showSetPassword(Request $request): View
    {
        return view('auth.set-password', ['fresh' => $request->session()->get('password.fresh', false), 'hasPassword' => (bool) $request->user()->password]);
    }

    public function setPassword(Request $request): RedirectResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'min:8', 'confirmed']]);
        $request->user()->forceFill(['password' => $data['password']])->save();
        $request->session()->forget('password.fresh');
        $welcome = $request->session()->pull('password.welcome');

        return redirect()->route('game')->with($welcome
            ? ['status' => 'Password set. Welcome to the realms.', 'ga_event' => 'sign_up', 'ga_params' => ['method' => 'email', 'hero_class' => $welcome]]
            : ['status' => 'Password set.']);
    }

    /** "Email me a link": for a forgotten password, or an email never confirmed. */
    public function showLinkRequest(): View
    {
        return view('auth.link-request');
    }

    public function requestLink(Request $request): View
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $user = User::whereRaw('lower(email) = ?', [strtolower($data['email'])])->first();
        if ($user) {
            $this->sendLink($user, welcome: ! $user->email_verified_at);
        }

        // the same page whether or not the address is known, so it leaks nothing
        return view('auth.check-email', ['email' => $data['email'], 'welcome' => false]);
    }

    public function showLogin(): View
    {
        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, remember: true)) {
            throw ValidationException::withMessages(['email' => 'Those details do not match any account.']);
        }
        if (! $request->user()->email_verified_at) {   // nobody plays on an unconfirmed address: a fresh link goes out instead
            $user = $request->user();
            Auth::logout();
            $this->sendLink($user, welcome: true);
            throw ValidationException::withMessages(['email' => 'That email has not been confirmed yet. We have just sent you a new link; open it to confirm and set your password.']);
        }
        $request->session()->regenerate();

        return redirect()->intended(route('game'))->with(['ga_event' => 'login', 'ga_params' => ['method' => 'email']]);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}
