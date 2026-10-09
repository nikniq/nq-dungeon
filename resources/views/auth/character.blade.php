@extends('layouts.app')
@section('title', 'Character — Dungeon Adventure')
@section('content')
<div class="panel">
  <h2>{{ $character->name }}</h2>
  <table class="sheet">
    <tr><th>Hero</th><td>@if ($character->floor > 0) Floor {{ $character->floor }}, @else In town, @endif level {{ $character->level }}, {{ $character->hp }}/{{ $character->max_hp }} HP, attack {{ $character->atk }}, {{ $character->gold }} gold</td></tr>
    <tr><th>Weapon</th><td>{{ $character->weapon ? $items['weapons'][$character->weapon]['name'].' (+'.$items['weapons'][$character->weapon]['atk'].' attack)' : 'Bare hands' }}</td></tr>
    <tr><th>Armor</th><td>{{ $character->armor ? $items['armor'][$character->armor]['name'].' ('.$items['armor'][$character->armor]['def'].' defence)' : 'None' }}</td></tr>
    <tr><th>Bag</th><td>{{ collect($character->bag ?? [])->map(fn ($id) => ($items['weapons'][$id] ?? $items['armor'][$id] ?? $items['consumables'][$id])['name'])->implode(', ') ?: 'Empty' }}</td></tr>
    <tr><th>Runs</th><td>{{ $character->runs }}</td></tr>
    <tr><th>Escapes</th><td>{{ $character->wins }}</td></tr>
    <tr><th>Deepest floor</th><td>{{ $character->best_floor }}</td></tr>
    <tr><th>Most gold</th><td>{{ $character->best_gold }}</td></tr>
    <tr><th>Monsters slain</th><td>{{ $character->kills }}</td></tr>
  </table>
  <form method="post" action="{{ route('character.update') }}" class="form">
    @csrf
    <label>Rename hero <input type="text" name="name" value="{{ old('name', $character->name) }}" required minlength="2" maxlength="24"></label>
    @error('name')<p class="error">{{ $message }}</p>@enderror
    <button type="submit" class="primary">Save name</button>
  </form>
  <form method="post" action="{{ route('character.abandon') }}" class="form" onsubmit="return confirm('Start over? Your hero restarts in town at level 1 with nothing.')">
    @csrf
    <button type="submit">Start over</button>
  </form>
  <p class="muted"><a href="{{ route('game') }}">Back to the dungeon</a></p>
</div>
@endsection
