@extends('layouts.app')
@section('title', 'Play — Dungeon Adventure')
@section('body-class', 'wide')
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
      <div id="classpick" class="overlay shop" hidden>
        <div class="shop-inner">
          <div class="shop-head"><h2>Choose your class</h2></div>
          <ul class="itemlist classlist">
            <li><b>Warrior</b> <span class="muted">24 HP, attack 3. Shield Wall: 2 less damage from every hit for 6 turns.</span> <button type="button" data-class="warrior">Warrior</button></li>
            <li><b>Ranger</b> <span class="muted">18 HP, attack 3. Arrow: shoot the nearest monster in a straight line, up to 6 tiles. Spots traps.</span> <button type="button" data-class="ranger">Ranger</button></li>
            <li><b>Mage</b> <span class="muted">16 HP, attack 2. Fireball: burn every monster within 2 tiles of the nearest one in sight.</span> <button type="button" data-class="mage">Mage</button></li>
          </ul>
          <p class="muted small">Press 1 to use your ability. Create a hero to keep your class, level and gear.</p>
        </div>
      </div>
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
      <button type="button" id="ability" class="fs primary">Ability (1)</button>
      <button type="button" id="worldmap" class="fs">Map (M)</button>
      <button type="button" id="quests" class="fs">Quests (Q)</button>
      <button type="button" id="sound" class="fs">Sound on</button>
      <button type="button" id="fullscreen" class="fs">Fullscreen</button>
    </div>
    @auth
    <form id="chat" class="chat" autocomplete="off">
      <input id="chat-input" maxlength="140" placeholder="Press Enter to talk to heroes nearby" aria-label="Chat message">
      <button type="submit">Say</button>
    </form>
    <div class="party" id="party"></div>
    @else
    <p class="flash muted">Other heroes are out there. <a href="{{ route('register') }}">Create a hero</a> or <a href="{{ route('login') }}">log in</a> to see them, chat, and form a party.</p>
    @endauth
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
      <b>Keys:</b> arrows, WASD or HJKL move; walking into a monster attacks. Space or <kbd>.</kbd> waits, <kbd>1</kbd> uses your class ability, <kbd>P</kbd> drinks a potion, <kbd>B</kbd> throws a bomb, <kbd>T</kbd> reads a scroll of return, <kbd>M</kbd> world map, <kbd>Q</kbd> quests, <kbd>N</kbd> sound, <kbd>F</kbd> fullscreen, <kbd>R</kbd> restarts.
      <b>Touch:</b> tap or hold anywhere on the map to walk that way; the round buttons on the right use your ability, drink a potion, wait, or open the map. Gamepads work too.
      <b>World:</b> you start in Hearth. Step onto doors to go inside, talk to people for quests, hire a hound at an inn, travel by waystone, and take a town gate or a countryside cave, crypt, warren or tower into a dungeon. A boss seals the stairs on the last floor.
      @auth<b>Together:</b> walk into another hero to invite them to a party or wave, press <kbd>Enter</kbd> to chat, and take the same gate to share a dungeon. @endauth
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
      mpUrl: @json(url('/api/mp')),
    };
  </script>
  <script src="{{ asset('js/script.js') }}?v={{ filemtime(public_path('js/script.js')) }}"></script>
@endsection
