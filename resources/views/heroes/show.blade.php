@extends('layouts.app')
@section('title', $character->name.' — Dungeon Adventure')
@section('description', $character->bio ?: $character->name.': level '.$character->level.' hero with '.$character->wins.' escapes and a deepest floor of '.$character->best_floor.'.')
@section('content')
<div class="profile">
  <div class="profile-head">
    <div class="avatar" style="background:{{ ['#ffd86b','#7ad36b','#7bdfff','#c084fc','#ff9ecf','#f5c542'][$character->id % 6] }}">{{ mb_strtoupper(mb_substr($character->name, 0, 1)) }}</div>
    <div>
      <h2>{{ $character->name }}</h2>
      <p class="muted">Rank #{{ $rank }} · Level {{ $character->level }} · {{ $character->floor > 0 ? 'Currently on floor '.$character->floor : 'Resting in town' }} · Hero since {{ $character->created_at->format('M Y') }}</p>
      @if ($character->bio)<p class="bio">{{ $character->bio }}</p>@endif
      @auth
        @if (auth()->id() === $character->user_id)<p><a href="{{ route('character.edit') }}">Edit your profile</a></p>@endif
      @endauth
    </div>
  </div>
  <div class="profile-grid">
    <section class="panel">
      <h3>Records</h3>
      <table class="sheet">
        <tr><th>Escapes</th><td>{{ $character->wins }}</td></tr>
        <tr><th>Dungeon runs</th><td>{{ $character->runs }}</td></tr>
        <tr><th>Deepest floor</th><td>{{ $character->best_floor ?: '—' }}</td></tr>
        <tr><th>Most gold carried</th><td>{{ $character->best_gold }}</td></tr>
        <tr><th>Monsters slain</th><td>{{ $character->kills }}</td></tr>
      </table>
    </section>
    <section class="panel">
      <h3>Hero</h3>
      <table class="sheet">
        <tr><th>Level</th><td>{{ $character->level }} ({{ $character->xp }} XP)</td></tr>
        <tr><th>Health</th><td>{{ $character->hp }}/{{ $character->max_hp }}</td></tr>
        <tr><th>Attack</th><td>{{ $character->atk }}@if ($character->weapon) +{{ $items['weapons'][$character->weapon]['atk'] }}@endif</td></tr>
        <tr><th>Gold</th><td>{{ $character->gold }}</td></tr>
        <tr><th>Weapon</th><td>{{ $character->weapon ? $items['weapons'][$character->weapon]['name'] : 'Bare hands' }}</td></tr>
        <tr><th>Armor</th><td>{{ $character->armor ? $items['armor'][$character->armor]['name'].' ('.$items['armor'][$character->armor]['def'].' defence)' : 'None' }}</td></tr>
      </table>
    </section>
  </div>
  <p class="muted"><a href="{{ route('heroes.index') }}">← All heroes</a></p>
</div>
@endsection
