@extends('layouts.app')
@section('title', 'Email me a link — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>Email me a sign-in link</h2>
  <p class="muted">For a forgotten password, or an email you never confirmed. The link signs you in and lets you set a new password.</p>
  <form method="post" action="{{ route('login.link') }}" class="form">
    @csrf
    <label>Email <input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email"></label>
    @error('email')<p class="error">{{ $message }}</p>@enderror
    <button type="submit" class="primary">Send the link</button>
  </form>
  <p class="muted"><a href="{{ route('login') }}">Back to log in</a></p>
</div>
@endsection
