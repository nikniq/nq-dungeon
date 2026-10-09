@extends('layouts.app')
@section('title', 'Log in — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>Log in</h2>
  <p class="muted">Pick up your hero where you left off.</p>
  <form method="post" action="{{ route('login') }}" class="form">
    @csrf
    <label>Email <input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email"></label>
    <label>Password <input type="password" name="password" required autocomplete="current-password"></label>
    @error('email')<p class="error">{{ $message }}</p>@enderror
    <button type="submit" class="primary">Log in</button>
  </form>
  <p class="muted">No hero yet? <a href="{{ route('register') }}">Create one</a>.</p>
</div>
@endsection
