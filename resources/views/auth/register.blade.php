@extends('layouts.app')
@section('title', 'Create hero — Dungeon Affair')
@section('content')
<div class="panel">
  <h2>Create your hero</h2>
  <p class="muted">Your progress is saved as you play, so you can come back later and continue the run.</p>
  @include('auth._social')
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
