@extends('layouts.app')
@section('title', 'Heroes — Dungeon Adventure')
@section('content')
<div class="board">
  <div class="board-head">
    <h2>Heroes</h2>
    <form method="get" class="search"><input type="search" name="q" value="{{ $q }}" placeholder="Find a hero"><button type="submit">Search</button></form>
  </div>
  @if ($heroes->isEmpty())
    <p class="muted">No heroes match.</p>
  @else
    <table class="ranks">
      <thead><tr><th>Hero</th><th>Status</th><th>Escapes</th><th>Deepest</th><th>Most gold</th><th>Kills</th><th>Level</th></tr></thead>
      <tbody>
      @foreach ($heroes as $h)
        <tr>
          <td><a href="{{ route('heroes.show', $h) }}">{{ $h->name }}</a></td>
          <td class="muted">{{ $h->floor > 0 ? 'Floor '.$h->floor : 'In town' }}</td>
          <td>{{ $h->wins }}</td><td>{{ $h->best_floor ?: '—' }}</td><td>{{ $h->best_gold }}</td><td>{{ $h->kills }}</td><td>{{ $h->level }}</td>
        </tr>
      @endforeach
      </tbody>
    </table>
    <div class="pager">{{ $heroes->links('pagination::simple-default') }}</div>
  @endif
  <h3 class="board-sub">Today's Delve</h3>
  <p class="muted small">One seeded dungeon a day, the same for every hero, one try each, from any inn. A hundred points a floor, five a kill, every coin, and a bonus for clearing it.@if ($yesterday) Yesterday's champion: <strong>{{ $yesterday->character?->name }}</strong> with {{ number_format($yesterday->score) }}.@endif</p>
  @if ($delves->isEmpty())
    <p class="muted small">Nobody has delved yet today.</p>
  @else
    <table class="ranks">
      <thead><tr><th>#</th><th>Hero</th><th>Score</th><th>Floor</th><th>Kills</th><th>Gold</th></tr></thead>
      <tbody>
      @foreach ($delves as $i => $d)
        <tr><td>{{ $i + 1 }}</td><td><a href="{{ route('heroes.show', $d->character) }}">{{ $d->character?->name }}</a></td><td>{{ number_format($d->score) }}</td><td>{{ $d->floor }}{{ $d->cleared ? ' ✓' : '' }}</td><td>{{ $d->kills }}</td><td>{{ number_format($d->gold) }}</td></tr>
      @endforeach
      </tbody>
    </table>
  @endif
  @if ($builders->isNotEmpty())
    <h3 class="board-sub">Builders of the realms</h3>
    <p class="muted small">Story 5, the rebuilding: the heroes who have sponsored the most walls, halls, memorials and roads, with their names carved on them.</p>
    <table class="ranks">
      <thead><tr><th>#</th><th>Hero</th><th>Structures</th><th>Gold given</th></tr></thead>
      <tbody>
      @foreach ($builders as $i => $b)
        <tr><td>{{ $i + 1 }}</td><td>{{ $b->builder_name }}</td><td>{{ $b->structures }}</td><td>{{ number_format($b->gold) }}</td></tr>
      @endforeach
      </tbody>
    </table>
  @endif
</div>
@endsection
