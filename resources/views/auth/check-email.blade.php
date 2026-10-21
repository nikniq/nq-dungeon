@extends('layouts.app')
@section('title', 'Check your email — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>Check your email</h2>
  @if ($welcome)
    <p>Your hero is made. We have sent a link to <strong>{{ $email }}</strong>: open it to confirm the address, and you will be asked to choose a password.</p>
  @else
    <p>If <strong>{{ $email }}</strong> belongs to a hero here, a sign-in link is on its way. Open it to sign in and set a password.</p>
  @endif
  <p class="muted small">The link works for two days. Nothing in your spam folder? <a href="{{ route('login.link') }}">Ask for another</a>.</p>
</div>
@endsection
