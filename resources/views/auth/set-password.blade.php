@extends('layouts.app')
@section('title', 'Set your password — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>{{ $hasPassword ? 'Set a new password' : 'Choose your password' }}</h2>
  <p class="muted">Your email is confirmed. {{ $hasPassword ? 'Set a new password, or skip this and just play.' : 'Pick a password of at least eight characters; it is how you will log in from now on.' }}</p>
  <form method="post" action="{{ route('password.set') }}" class="form">
    @csrf
    <label>Password <input type="password" name="password" required minlength="8" autofocus autocomplete="new-password"></label>
    @error('password')<p class="error">{{ $message }}</p>@enderror
    <label>Confirm password <input type="password" name="password_confirmation" required autocomplete="new-password"></label>
    <button type="submit" class="primary">Save password</button>
  </form>
  @if ($hasPassword)<p class="muted"><a href="{{ route('game') }}">Skip and play</a></p>@endif
</div>
@endsection
