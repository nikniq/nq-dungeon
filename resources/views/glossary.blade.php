@extends('layouts.app')
@section('title', ($kind === 'towns' ? 'Towns of the realms' : 'Characters of the realms').' — Dungeon Adventure')
@section('description', $kind === 'towns' ? 'Every town of the four realms of Dungeon Adventure: its realm, trade, history, landmark, leader, watch and notable locals.' : 'The people of Dungeon Adventure: kings, councillors, chieftains, merchants, story figures, and the leader and notable local of every town.')
@section('body-class', 'wide')
@section('content')
  <div class="glossary-head">
    <h2>{{ $kind === 'towns' ? 'Towns of the realms' : 'Characters of the realms' }}</h2>
    <p class="muted">
      @if ($kind === 'towns')
        Every settlement the world generates, as the game itself describes it: realm, trade, history, landmark, leader, watch and the notable local in its square.
        See also the <a href="{{ route('world.characters') }}">characters</a>.
      @else
        The fixed cast of the story and the realms, then the leader and notable local of every town.
        See also the <a href="{{ route('world.towns') }}">towns</a>.
      @endif
    </p>
    <label class="search">Search <input type="search" id="glossary-search" placeholder="{{ $kind === 'towns' ? 'a town, realm, trade or landmark' : 'a name, role or town' }}" autocomplete="off"></label>
    <p class="muted small" id="glossary-count">Building the world…</p>
  </div>
  <noscript><p class="flash">This page is drawn from the game's own world generator and needs JavaScript.</p></noscript>
  <div id="glossary" class="glossary"></div>
  {{-- the game script expects a stage and a death overlay; here they stay hidden --}}
  <div class="stage" hidden><canvas id="game" width="32" height="32"></canvas></div>
  <div id="overlay" hidden></div><button type="button" id="restart" hidden></button>
@endsection
@section('scripts')
  <script>
    window.DUNGEON = {
      mode: 'glossary', kind: @json($kind), user: false,
      items: @json(config('items')),
      buildings: @json(['slots' => config('game.building_slots'), 'costs' => config('game.building_costs'), 'types' => config('game.buildings')]),
      townsUrl: @json(route('world.towns')), charactersUrl: @json(route('world.characters')),
    };
  </script>
  <script src="{{ asset('js/script.js') }}?v={{ filemtime(public_path('js/script.js')) }}"></script>
@endsection
