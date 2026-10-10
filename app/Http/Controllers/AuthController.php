<?php

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showRegister(): View
    {
        return view('auth.register');
    }

    public function register(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'character' => ['required', 'string', 'min:2', 'max:24', 'regex:/^[\pL\pN][\pL\pN _-]*$/u',
                fn ($attr, $value, $fail) => Character::nameTaken($value) && $fail('That hero name is already taken.')],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [], ['character' => 'hero name']);

        $user = User::create([
            'name' => $data['character'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);
        $user->character()->create(['name' => $data['character']]);

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()->route('game');
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
        $request->session()->regenerate();

        return redirect()->intended(route('game'));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}
