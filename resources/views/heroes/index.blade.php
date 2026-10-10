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
</div>
@endsection
