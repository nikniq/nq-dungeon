@extends('layouts.app')
@section('title', 'Dungeon Adventure — a free browser roguelike')
@section('content')
<section class="hero-banner">
  <div class="hero-copy">
    <h2>Five floors down. One way out.</h2>
    <p>A turn-based dungeon crawl you can play in any browser. Gear up at the town square, descend through five
      floors of rats, goblins, skeletons, orcs and wraiths, and climb back out with the gold.</p>
    <div class="cta">
      <a href="{{ route('game') }}" class="primary big">Play now</a>
      @guest
        <a href="{{ route('register') }}" class="secondary big">Create a hero</a>
        <span class="muted">Already have one? <a href="{{ route('login') }}">Log in</a></span>
      @else
        <a href="{{ route('character.edit') }}" class="secondary big">Your profile</a>
      @endguest
    </div>
    <p class="muted small">No download, no account needed to play. Create a hero to save your run and appear on the leaderboard.</p>
  </div>
  <a href="{{ route('game') }}" class="hero-shot">
    <img src="{{ asset('images/preview.png') }}" alt="A dungeon floor with rooms, corridors and monsters" width="800" height="600">
  </a>
</section>

<section class="features">
  <div><h3>Town square</h3><p>Every dive starts in town. Buy weapons and armor from the merchant, rest at the inn, then take the stairs.</p></div>
  <div><h3>Turn-based tactics</h3><p>Monsters sleep until they notice you, then give chase. Every step is a turn, so take your time.</p></div>
  <div><h3>Loot and levels</h3><p>Kill for XP, level up for HP and attack, and equip the gear you find or buy. Sell the rest.</p></div>
  <div><h3>Saved heroes</h3><p>Your run is saved as you play. Come back on any device, pick up on the same floor, and build a record.</p></div>
</section>

<section class="board">
  <div class="board-head">
    <h2>Hall of heroes</h2>
    <a href="{{ route('heroes.index') }}" class="muted">All {{ $heroCount }} {{ \Illuminate\Support\Str::plural('hero', $heroCount) }} →</a>
  </div>
  @if ($leaders->isEmpty())
    <p class="muted">No heroes yet. <a href="{{ route('register') }}">Be the first.</a></p>
  @else
    <table class="ranks">
      <thead><tr><th>#</th><th>Hero</th><th>Escapes</th><th>Deepest</th><th>Most gold</th><th>Kills</th><th>Level</th></tr></thead>
      <tbody>
      @foreach ($leaders as $i => $h)
        <tr>
          <td>{{ $i + 1 }}</td>
          <td><a href="{{ route('heroes.show', $h) }}">{{ $h->name }}</a></td>
          <td>{{ $h->wins }}</td><td>{{ $h->best_floor ?: '—' }}</td><td>{{ $h->best_gold }}</td><td>{{ $h->kills }}</td><td>{{ $h->level }}</td>
        </tr>
      @endforeach
      </tbody>
    </table>
  @endif
</section>

<section class="howto">
  <h2>How to play</h2>
  <ul>
    <li>Move with the arrow keys, WASD or HJKL, or tap the on-screen pad. Space waits a turn.</li>
    <li>Walk into a monster to attack it. Hover or tap anything on the map to see what it is.</li>
    <li>Potions heal, gold buys gear. Armor must be equipped to count. <kbd>P</kbd> drinks a potion from your bag.</li>
    <li>Find the green stairs on each floor. Clear floor five and the town welcomes you back with everything you earned.</li>
    <li>Death sends you back to town as a fresh hero. Your records stay.</li>
  </ul>
</section>
@endsection
