@extends('layouts.app')
@section('title', 'Create hero — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>Create your hero</h2>
  <p class="muted">Your progress is saved as you play, so you can come back later and continue the run.</p>
  @if (\App\Http\Controllers\GoogleAuthController::enabled())
    <a href="{{ route('google.redirect') }}" class="google-btn">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      Continue with Google
    </a>
    <p class="divider muted small"><span>or</span></p>
  @endif
  <form method="post" action="{{ route('register') }}" class="form">
    @csrf
    <label>Hero name <input type="text" name="character" value="{{ old('character') }}" required autofocus minlength="2" maxlength="24" placeholder="Letters, numbers, spaces, - or _"></label>
    <p class="muted small">Your hero name is public and becomes your profile address.</p>
    @error('character')<p class="error">{{ $message }}</p>@enderror
    <fieldset class="classes">
      <legend>Class</legend>
      @foreach (['warrior' => ['Warrior', 'Sturdy and strong. Shield Wall blunts every blow for a few turns.'], 'ranger' => ['Ranger', 'Quick and sharp-eyed. Shoots arrows at anything in line of sight.'], 'mage' => ['Mage', 'Frail but fierce. Fireball scorches every monster near its target.']] as $id => [$label, $blurb])
        <label class="class-opt"><input type="radio" name="class" value="{{ $id }}" {{ old('class', 'warrior') === $id ? 'checked' : '' }}> <b>{{ $label }}</b> <span class="muted">{{ $blurb }}</span></label>
      @endforeach
    </fieldset>
    @error('class')<p class="error">{{ $message }}</p>@enderror
    <label>Email <input type="email" name="email" value="{{ old('email') }}" required autocomplete="email"></label>
    <p class="muted small">We will email you a link. Open it to confirm the address, and then choose your password.</p>
    @error('email')<p class="error">{{ $message }}</p>@enderror
    <button type="submit" class="primary">Create hero and email me a link</button>
  </form>
  <p class="muted">Already have one? <a href="{{ route('login') }}">Log in</a>, or <a href="{{ route('login.link') }}">email me a sign-in link</a>.</p>
</div>
@endsection
