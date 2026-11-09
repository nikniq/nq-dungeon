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
    // the sheet that opens when a row is clicked: figures the table has no room for
    $gear = function (string $kind, string $id, array $it, array $all) use ($n, $shop) {
        $stat = $kind === 'weapon' ? 'atk' : 'def'; $word = $kind === 'weapon' ? 'Attack' : 'Defence';
        $leg = $n['legendary'][$id] ?? null; $t = $kind === 'weapon' ? ($n['traits'][$leg['style'] ?? $id] ?? null) : null;
        $ranked = collect($all)->sortBy($stat)->values(); $rank = $ranked->filter(fn ($o) => $o[$stat] <= $it[$stat])->count();
        $next = collect($all)->filter(fn ($o) => $o[$stat] > $it[$stat] && $o['floor'] < 99)->sortBy($stat)->first();
        $stats = [[$word, '+'.$it[$stat]], ['Price', $leg ? 'never sold' : $it['price'].' gold'], ['Sells for', intdiv($it['price'], 2).' gold'], ];
        if (! $leg) $stats[] = ['Gold per point', (string) round($it['price'] / max(1, $it[$stat])).' gold'];
        $stats[] = ['Rank', $rank.' of '.count($all).' by '.strtolower($word)];
        if ($it['floor'] < 99) $stats[] = ['First stocked', 'floor '.$it['floor']];
        $notes = [];
        if ($t) $notes[] = 'Fighting style, '.$t[0].': '.$t[1];
        $notes[] = $leg ? 'Legendary, one of a kind: '.($kind === 'weapon' && $id === 'dawnbreaker' ? 'made by ' : 'dropped by ').$leg['from'].'.' : 'Where: '.$shop($it).'.';
        if ($next && ! $leg) $notes[] = 'The next step up in the shops is the '.$next['name'].' (+'.$next[$stat].') for '.$next['price'].' gold.';
        $notes[] = 'Found underground it may carry a magic affix; a smith or armourer can improve it by +1 at a time.';
        $links = isset($it['trade']) ? [['Towns known for '.$it['trade'], route('world.towns').'?q='.urlencode($it['trade'])]] : [];
        return ['title' => $it['name'], 'sub' => ($leg ? 'Legendary ' : '').($kind === 'weapon' ? 'weapon' : 'armour'), 'stats' => $stats, 'notes' => $notes, 'links' => $links, 'hash' => $kind.'-'.$id];
    };
    $use = function (string $id, array $it) use ($n, $shop) {
        $stats = [['Price', $it['price'].' gold'], ['Sells for', intdiv($it['price'], 2).' gold']];
        if (! empty($it['heal'])) { $stats[] = ['Heals', $it['heal'].' HP']; $stats[] = ['Gold per HP', (string) round($it['price'] / $it['heal'], 1)]; }
        if (! empty($it['mana'])) $stats[] = ['Restores', $it['mana'].' mana'];
        if ($it['floor'] < 99 && ! isset($it['trade'])) $stats[] = ['First stocked', 'floor '.$it['floor']];
        $notes = array_values(array_filter([$n['consumables'][$id] ?? (isset($it['desc']) ? ucfirst($it['desc']).'.' : null), 'Where: '.($shop($it) ?? 'caught, cooked or found; never stocked').'.', 'Takes one of the '.config('items.bag_size').' places in the bag.']));
        $links = isset($it['trade']) ? [['Towns known for '.$it['trade'], route('world.towns').'?q='.urlencode($it['trade'])]] : [];
        return ['title' => $it['name'], 'sub' => 'consumable', 'stats' => $stats, 'notes' => $notes, 'links' => $links, 'hash' => 'item-'.$id];
    };
  @endphp
  <p class="muted small pick-hint">Click any weapon, armour, consumable or relic for its figures.</p>
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
        <tr class="pick {{ $leg ? 'legendary' : '' }}" id="weapon-{{ $id }}" tabindex="0" role="button" data-detail="{{ json_encode($gear('weapon', $id, $it, $w)) }}">
          <td><strong>{{ $it['name'] }}</strong>{{ $leg ? ' ★' : '' }}</td>
          <td>+{{ $it['atk'] }}</td>
          <td>{{ $it['price'] }} g</td>
          <td>@if ($t)<em>{{ $t[0] }}</em>: {{ $t[1] }}@endif</td>
          <td>{{ $leg ? 'Legendary: dropped by '.$leg['from'] : $shop($it) }}</td>
        </tr>
      @endforeach
      </tbody>
    </table>

    <h3>Magic affixes</h3>
    <p class="muted small">Weapons and armour dropped underground may carry an affix and a tier (I to III, each tier a point more). They are never sold.</p>
    <table class="items">
      <thead><tr><th>Affix</th><th>On</th><th>Effect</th></tr></thead>
      <tbody>
      @foreach (config('items.affixes') as $slot => $list)
        @foreach ($list as $id => $af)
          <tr><td><strong>{{ $af['name'] }}</strong></td><td>{{ $slot === 'weapon' ? 'weapons' : 'armour' }}</td><td>{{ ucfirst($af['desc']) }}.</td></tr>
        @endforeach
      @endforeach
      </tbody>
    </table>

    <h3>Armour</h3>
    <table class="items">
      <thead><tr><th>Armour</th><th>Defence</th><th>Price</th><th>Where</th></tr></thead>
      <tbody>
      @foreach ($a as $id => $it)
        @php $leg = $n['legendary'][$id] ?? null; @endphp
        <tr class="pick {{ $leg ? 'legendary' : '' }}" id="armour-{{ $id }}" tabindex="0" role="button" data-detail="{{ json_encode($gear('armour', $id, $it, $a)) }}"><td><strong>{{ $it['name'] }}</strong>{{ $leg ? ' ★' : '' }}</td><td>+{{ $it['def'] }}</td><td>{{ $it['price'] }} g</td><td>{{ $leg ? 'Legendary: dropped by '.$leg['from'] : $shop($it) }}</td></tr>
      @endforeach
      </tbody>
    </table>

    <h3>Consumables</h3>
    <table class="items">
      <thead><tr><th>Item</th><th>Effect</th><th>Price</th><th>Where</th></tr></thead>
      <tbody>
      @foreach ($c as $id => $it)
        <tr class="pick" id="item-{{ $id }}" tabindex="0" role="button" data-detail="{{ json_encode($use($id, $it)) }}"><td><strong>{{ $it['name'] }}</strong></td><td>{{ $n['consumables'][$id] ?? (isset($it['desc']) ? ucfirst($it['desc']).'.' : '') }}{{ !empty($it['heal']) ? ' Heals '.$it['heal'].' HP.' : '' }}</td><td>{{ $it['price'] }} g</td><td>{{ $shop($it) ?? 'caught, cooked or found; never stocked' }}</td></tr>
      @endforeach
      </tbody>
    </table>

    <h3>Relics</h3>
    <p class="muted small">{{ count($r) }} relics, one of a kind each. Wear one at a time.</p>
    <table class="items">
      <thead><tr><th>Relic</th><th>Effect</th><th>Found</th></tr></thead>
      <tbody>
      @foreach ($r as $id => $it)
        <tr class="pick" id="relic-{{ $id }}" tabindex="0" role="button" data-detail="{{ json_encode(['title' => $it['name'], 'sub' => 'relic, one of a kind', 'stats' => [['Worn', 'one relic at a time'], ['Sold', 'never']], 'notes' => ['Effect: '.$it['desc'], 'Found: '.ucfirst($it['found']).'.'], 'links' => [['The story it belongs to', route('world.story')]], 'hash' => 'relic-'.$id]) }}"><td><strong>{{ $it['name'] }}</strong></td><td>{{ $it['desc'] }}</td><td>{{ ucfirst($it['found']) }}</td></tr>
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
  @include('partials.detail')
@endsection
@section('scripts')
<script>
  (() => {
    const open = (tr) => { try { window.showDetail(JSON.parse(tr.dataset.detail)); } catch (e) { /* the table still says it */ } };
    for (const tr of document.querySelectorAll('tr.pick')) {
      tr.addEventListener('click', () => open(tr));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(tr); } });
    }
    const at = location.hash && document.getElementById(location.hash.slice(1)); if (at && at.dataset.detail) { at.scrollIntoView({ block: 'center' }); open(at); }
  })();
</script>
@endsection
