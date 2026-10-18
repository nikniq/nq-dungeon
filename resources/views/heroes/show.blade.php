@extends('layouts.app')
@section('title', $character->name.' — Dungeon Adventure')
@section('description', $character->bio ?: $character->name.': level '.$character->level.' hero with '.$character->wins.' escapes and a deepest floor of '.$character->best_floor.'.')
@section('content')
<div class="profile">
  <div class="profile-head">
    @if ($character->user?->avatar)
      <img class="avatar" src="{{ $character->user->avatar }}" alt="" referrerpolicy="no-referrer" width="64" height="64">
    @else
      <div class="avatar" style="background:{{ ['#ffd86b','#7ad36b','#7bdfff','#c084fc','#ff9ecf','#f5c542'][$character->id % 6] }}">{{ mb_strtoupper(mb_substr($character->name, 0, 1)) }}</div>
    @endif
    <div>
      <h2>{{ $character->name }}@if ($character->title) <span class="title">{{ $character->title }}</span>@endif</h2>
      <p class="muted">Rank #{{ $rank }} · Level {{ $character->level }} {{ $character->class }} · {{ $character->floor > 0 ? 'Currently on floor '.$character->floor : 'Resting in town' }} · Hero since {{ $character->created_at->format('M Y') }}</p>
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
        @if (($character->meta['deepest'] ?? 0) > 0)
        <tr><th>Deepest in the Deep</th><td>Floor {{ $character->meta['deepest'] }}</td></tr>
        @endif
        <tr><th>Most gold carried</th><td>{{ $character->best_gold }}</td></tr>
        <tr><th>Monsters slain</th><td>{{ $character->kills }}</td></tr>
        <tr><th>Quests completed</th><td>{{ $character->quests_done }}</td></tr>
        <tr><th>Achievements</th><td>{{ count($character->achievements ?? []) }}</td></tr>
      </table>
    </section>
    <section class="panel">
      <h3>Hero</h3>
      <table class="sheet">
        <tr><th>Class</th><td>{{ ucfirst($character->class) }}</td></tr>
        <tr><th>Level</th><td>{{ $character->level }} ({{ $character->xp }} XP)</td></tr>
        <tr><th>Health</th><td>{{ $character->hp }}/{{ $character->max_hp }}</td></tr>
        <tr><th>Attack</th><td>{{ $character->atk }}@if ($character->weapon) +{{ $items['weapons'][$character->weapon]['atk'] }}@endif</td></tr>
        <tr><th>Gold</th><td>{{ $character->gold }}</td></tr>
        <tr><th>Weapon</th><td>{{ $character->weapon ? $items['weapons'][$character->weapon]['name'].($character->weapon_plus ? ' +'.$character->weapon_plus : '') : 'Bare hands' }}</td></tr>
        <tr><th>Armor</th><td>{{ $character->armor ? $items['armor'][$character->armor]['name'].($character->armor_plus ? ' +'.$character->armor_plus : '').' ('.($items['armor'][$character->armor]['def'] + $character->armor_plus).' defence)' : 'None' }}</td></tr>
        <tr><th>Perks</th><td>{{ collect($character->perks ?? [])->map(fn ($p) => ucfirst(str_replace('_', ' ', $p)))->countBy()->map(fn ($n, $p) => $n > 1 ? "$p ×$n" : $p)->values()->implode(', ') ?: 'None yet' }}</td></tr>
      </table>
    </section>
  </div>
  <p class="muted"><a href="{{ route('heroes.index') }}">← All heroes</a></p>
</div>
@endsection
