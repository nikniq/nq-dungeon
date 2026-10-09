@extends('layouts.app')
@section('title', 'Create hero — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>Create your hero</h2>
  <p class="muted">Your progress is saved as you play, so you can come back later and continue the run.</p>
  <form method="post" action="{{ route('register') }}" class="form">
    @csrf
    <label>Hero name <input type="text" name="character" value="{{ old('character') }}" required autofocus minlength="2" maxlength="24"></label>
    @error('character')<p class="error">{{ $message }}</p>@enderror
    <label>Email <input type="email" name="email" value="{{ old('email') }}" required autocomplete="email"></label>
    @error('email')<p class="error">{{ $message }}</p>@enderror
    <label>Password <input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
    @error('password')<p class="error">{{ $message }}</p>@enderror
    <label>Confirm password <input type="password" name="password_confirmation" required autocomplete="new-password"></label>
    <button type="submit" class="primary">Create hero</button>
  </form>
  <p class="muted">Already have one? <a href="{{ route('login') }}">Log in</a>.</p>
</div>
@endsection
