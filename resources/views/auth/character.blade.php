@extends('layouts.app')
@section('title', 'Your profile — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>{{ $character->name }}</h2>
  <p class="muted">Your public profile is at <a href="{{ route('heroes.show', $character) }}">{{ route('heroes.show', $character) }}</a>.</p>
  <table class="sheet">
    <tr><th>Hero</th><td>{{ ucfirst($character->class) }}. @if ($character->floor > 0) Floor {{ $character->floor }}, @else In town, @endif level {{ $character->level }}, {{ $character->hp }}/{{ $character->max_hp }} HP, attack {{ $character->atk }}, {{ $character->gold }} gold</td></tr>
    <tr><th>Weapon</th><td>{{ $character->weapon && ($w = \App\Models\Character::describeItem($character->weapon)) ? $w['name'].' (+'.$w['atk'].' attack)' : 'Bare hands' }}</td></tr>
    <tr><th>Armor</th><td>{{ $character->armor && ($ar = \App\Models\Character::describeItem($character->armor)) ? $ar['name'].' ('.$ar['def'].' defence)' : 'None' }}</td></tr>
    <tr><th>Relic</th><td>{{ $character->relic ? ($items['relics'][$character->relic]['name'] ?? $character->relic) : 'None' }}</td></tr>
    <tr><th>Bag</th><td>{{ collect($character->bag ?? [])->map(fn ($id) => (\App\Models\Character::describeItem($id) ?? ['name' => $id])['name'])->implode(', ') ?: 'Empty' }}</td></tr>
    <tr><th>Runs</th><td>{{ $character->runs }}</td></tr>
    <tr><th>Escapes</th><td>{{ $character->wins }}</td></tr>
    <tr><th>Deepest floor</th><td>{{ $character->best_floor }}</td></tr>
    <tr><th>Most gold</th><td>{{ $character->best_gold }}</td></tr>
    <tr><th>Monsters slain</th><td>{{ $character->kills }}</td></tr>
  </table>
  <form method="post" action="{{ route('character.update') }}" class="form">
    @csrf
    <label>Hero name <input type="text" name="name" value="{{ old('name', $character->name) }}" required minlength="2" maxlength="24"></label>
    @error('name')<p class="error">{{ $message }}</p>@enderror
    <label>Bio <textarea name="bio" rows="3" maxlength="280" placeholder="A line or two about your hero">{{ old('bio', $character->bio) }}</textarea></label>
    <label>Class
      <select name="class">
        @foreach (['warrior' => 'Warrior — Shield Wall', 'ranger' => 'Ranger — Arrow', 'mage' => 'Mage — Fireball'] as $id => $label)
          <option value="{{ $id }}" {{ old('class', $character->class) === $id ? 'selected' : '' }}>{{ $label }}</option>
        @endforeach
      </select>
    </label>
    @error('bio')<p class="error">{{ $message }}</p>@enderror
    <button type="submit" class="primary">Save profile</button>
  </form>
  <form method="post" action="{{ route('character.abandon') }}" class="form" onsubmit="return confirm('Start over? Your hero restarts in town at level 1 with nothing.')">
    @csrf
    <button type="submit">Start over</button>
  </form>
  <p class="muted"><a href="{{ route('game') }}">Back to the dungeon</a></p>
</div>
@endsection
