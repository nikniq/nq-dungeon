@extends('layouts.app')
@section('title', 'Play — Dungeon Adventure')
@section('content')
    @guest
      <p class="flash muted">Playing as a guest. <a href="{{ route('register') }}">Create a hero</a> or <a href="{{ route('login') }}">log in</a> to save your hero and continue runs later.</p>
    @endguest
    <div class="hud">
      <div id="stats">Floor 1 | HP 20/20</div>
      <div class="hp-track"><div id="hpbar" class="hp-fill"></div></div>
    </div>
    <div class="stage">
      <canvas id="game" width="960" height="640"></canvas>
      <div id="tip" class="tip" role="status"></div>
      <div id="shop" class="overlay shop" hidden>
        <div class="shop-inner">
          <div class="shop-head"><h2>Merchant</h2><span id="shop-gold" class="gold"></span><button type="button" id="shop-close">Close</button></div>
          <div class="shop-cols">
            <section><h3>Buy</h3><ul id="shop-buy" class="itemlist"></ul></section>
            <section><h3>Sell</h3><ul id="shop-sell" class="itemlist"></ul></section>
          </div>
          <p class="muted small">The merchant pays half price for anything you sell. Press Esc to leave.</p>
        </div>
      </div>
      <div id="overlay" class="overlay">
        <h2 id="overlay-title"></h2>
        <p id="overlay-text"></p>
        <p class="hint">Click or press R to restart</p>
      </div>
    </div>
    <div class="bottom">
      <ul id="log" class="log"></ul>
      <div class="dpad" aria-label="Movement controls">
        <button type="button" data-move="0,-1" aria-label="Up">&#9650;</button>
        <button type="button" data-move="-1,0" aria-label="Left">&#9664;</button>
        <button type="button" data-move="0,0" aria-label="Wait">&middot;</button>
        <button type="button" data-move="1,0" aria-label="Right">&#9654;</button>
        <button type="button" data-move="0,1" aria-label="Down">&#9660;</button>
      </div>
      <button type="button" id="worldmap" class="fs">Map (M)</button>
      <button type="button" id="fullscreen" class="fs">Fullscreen</button>
    </div>
    <div class="inventory" id="inventory">
      <div class="equip"><span class="muted">Weapon</span> <b id="inv-weapon">Bare hands</b></div>
      <div class="equip"><span class="muted">Armor</span> <b id="inv-armor">None</b></div>
      <div class="bag"><span class="muted">Bag</span> <ul id="inv-bag" class="itemlist compact"></ul></div>
    </div>
    <details class="legend-box" open>
      <summary>What's on screen</summary>
      <ul id="legend" class="legend"></ul>
      <p class="muted small">Hover over or tap anything on the map to see what it is.</p>
    </details>
    <p class="help">
      Move with arrow keys, WASD or HJKL. Space or <kbd>.</kbd> waits a turn, <kbd>R</kbd> restarts.
      You start in Hearth. Step onto a house door to go inside, take the gate at the bottom into the dungeon, or follow a road across the wilds to another town; each has its own shops and people.
      Walk into monsters to attack. Collect gold and potions, find the exit on each floor, and clear all 5 to return to town. <kbd>P</kbd> drinks a potion from your bag.
      <button id="restart" type="button">Restart</button>
    </p>
@endsection
@section('scripts')
  <script>
    window.DUNGEON = {
      user: @json(auth()->check()),
      saveUrl: @json(route('character.save')),
      loadUrl: @json(route('character.show')),
      csrf: @json(csrf_token()),
      items: @json(config('items')),
    };
  </script>
  <script src="{{ asset('js/script.js') }}?v={{ filemtime(public_path('js/script.js')) }}"></script>
@endsection
