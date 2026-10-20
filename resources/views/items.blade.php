@extends('layouts.app')
@section('title', 'Items — Dungeon Adventure')
@section('description', 'Every item in Dungeon Adventure and how to get it: weapons and their fighting styles, armour, consumables, legendary gear from the lairs, and the relics of the stories.')
@section('body-class', 'wide')
@section('content')
  <div class="glossary-head">
    <h2>Items of the realms</h2>
    <p class="muted">Everything a hero can carry, and where it comes from, drawn from the game's own item list. See also the <a href="{{ route('world.story') }}">story</a>, <a href="{{ route('world.towns') }}">towns</a> and <a href="{{ route('world.characters') }}">characters</a>.</p>
  </div>
  @php
    $w = config('items.weapons'); $a = config('items.armor'); $c = config('items.consumables'); $r = config('items.relics'); $n = config('catalog');
    $shop = fn ($it) => isset($it['trade']) ? ($n['tradeshops'][$it['trade']] ?? 'the trade shop').' of '.$it['trade'].' towns' : ($it['floor'] >= 99 ? null : 'merchants from floor '.$it['floor']);
  @endphp
  <section class="catalog">
    <h3>How things are found</h3>
    <ul class="notes">
      @foreach ($n['where'] as $k => $text)<li>{{ $text }}</li>@endforeach
    </ul>

    <h3>Weapons</h3>
    <table class="items">
      <thead><tr><th>Weapon</th><th>Attack</th><th>Price</th><th>Style</th><th>Where</th></tr></thead>
      <tbody>
      @foreach ($w as $id => $it)
        @php $leg = $n['legendary'][$id] ?? null; $style = $leg['style'] ?? $id; $t = $n['traits'][$style] ?? null; @endphp
        <tr class="{{ $leg ? 'legendary' : '' }}">
          <td><strong>{{ $it['name'] }}</strong>{{ $leg ? ' ★' : '' }}</td>
          <td>+{{ $it['atk'] }}</td>
          <td>{{ $it['price'] }} g</td>
          <td>@if ($t)<em>{{ $t[0] }}</em>: {{ $t[1] }}@endif</td>
          <td>{{ $leg ? 'Legendary: dropped by '.$leg['from'] : $shop($it) }}</td>
        </tr>
      @endforeach
      </tbody>
    </table>

    <h3>Armour</h3>
    <table class="items">
      <thead><tr><th>Armour</th><th>Defence</th><th>Price</th><th>Where</th></tr></thead>
      <tbody>
      @foreach ($a as $id => $it)
        @php $leg = $n['legendary'][$id] ?? null; @endphp
        <tr class="{{ $leg ? 'legendary' : '' }}"><td><strong>{{ $it['name'] }}</strong>{{ $leg ? ' ★' : '' }}</td><td>+{{ $it['def'] }}</td><td>{{ $it['price'] }} g</td><td>{{ $leg ? 'Legendary: dropped by '.$leg['from'] : $shop($it) }}</td></tr>
      @endforeach
      </tbody>
    </table>

    <h3>Consumables</h3>
    <table class="items">
      <thead><tr><th>Item</th><th>Effect</th><th>Price</th><th>Where</th></tr></thead>
      <tbody>
      @foreach ($c as $id => $it)
        <tr><td><strong>{{ $it['name'] }}</strong></td><td>{{ $n['consumables'][$id] ?? (isset($it['desc']) ? ucfirst($it['desc']).'.' : '') }}{{ !empty($it['heal']) ? ' Heals '.$it['heal'].' HP.' : '' }}</td><td>{{ $it['price'] }} g</td><td>{{ $shop($it) ?? 'caught, cooked or found; never stocked' }}</td></tr>
      @endforeach
      </tbody>
    </table>

    <h3>Relics</h3>
    <p class="muted small">{{ count($r) }} relics, one of a kind each. Wear one at a time.</p>
    <table class="items">
      <thead><tr><th>Relic</th><th>Effect</th><th>Found</th></tr></thead>
      <tbody>
      @foreach ($r as $id => $it)
        <tr><td><strong>{{ $it['name'] }}</strong></td><td>{{ $it['desc'] }}</td><td>{{ ucfirst($it['found']) }}</td></tr>
      @endforeach
      </tbody>
    </table>

    <h3>Other things a hero can acquire</h3>
    <table class="items">
      <thead><tr><th>What</th><th>Where and cost</th><th>What it does</th></tr></thead>
      <tbody>
      @foreach ($n['other'] as [$what, $where, $does])
        <tr><td><strong>{{ $what }}</strong></td><td>{{ $where }}</td><td>{{ $does }}</td></tr>
      @endforeach
      </tbody>
    </table>
  </section>
@endsection
