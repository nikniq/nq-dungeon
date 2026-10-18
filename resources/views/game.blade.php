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
      <div id="settings" class="overlay controls-help" hidden>
        <div class="controls-box settings-box" role="dialog" aria-label="Settings">
          <h2>Settings</h2>
          <label class="setting">Music <input type="range" id="set-music" min="0" max="100" step="5"></label>
          <label class="setting">Sound effects <input type="range" id="set-sfx" min="0" max="100" step="5"></label>
          <label class="setting check"><input type="checkbox" id="set-shake"> Screen shake</label>
          <label class="setting check"><input type="checkbox" id="set-numbers"> Floating damage and healing numbers</label>
          <p class="muted small">N mutes everything. Settings are kept in this browser.</p>
          <button type="button" id="settings-close" class="primary">Done</button>
        </div>
      </div>
      <div id="controls-help" class="overlay controls-help" hidden>
        <div class="controls-box" role="dialog" aria-label="Controls">
          <h2>Controls</h2>
          <div class="controls-cols">
            <div>
              <h3>Keyboard</h3>
              <ul>
                <li><kbd>↑ ↓ ← →</kbd> <kbd>WASD</kbd> <kbd>HJKL</kbd> move; walk into a monster to attack</li>
                <li><kbd>Space</kbd> or <kbd>.</kbd> wait a turn</li>
                <li><kbd>1</kbd> class ability · <kbd>P</kbd> potion · <kbd>B</kbd> bomb · <kbd>T</kbd> scroll of return</li>
                <li><kbd>M</kbd> world map · <kbd>Q</kbd> quests · <kbd>J</kbd> journal · <kbd>N</kbd> sound · <kbd>C</kbd> make camp in the wilds</li>
                <li><kbd>Esc</kbd> closes menus and skips story scenes · <kbd>?</kbd> this screen · <kbd>O</kbd> settings</li>
                <li>Not sure what to do? The Journal's Guide page (<kbd>J</kbd>, then <kbd>6</kbd>) has ideas</li>
              </ul>
            </div>
            <div>
              <h3>Mouse and touch</h3>
              <ul>
                <li>Click a spot to walk there, a monster to fight it, people and doors to use them</li>
                <li>Right-click to use your ability, aimed where you click</li>
                <li>Hover or tap anything to see what it is, and how hard a monster will be</li>
                <li>On phones, tap or hold to walk; the round buttons use your ability, a potion, wait or the map</li>
              </ul>
            </div>
            <div>
              <h3>Tips</h3>
              <ul>
                <li>Hit sleeping monsters first: sneak attacks deal double damage, triple with a dagger</li>
                <li>Every weapon has a trait. Compare them in the shop: ▲ is better than what you wear</li>
                <li>Bosses wind up heavy blows on the red tiles. Step out of them</li>
                <li>Every dungeon floor has a golden door back to the surface</li>
                <li>Walk into water with a fishing rod to fish; eat with <kbd>P</kbd>, or cook stew at an inn or camp</li>
                <li>Watch captains post bounties on named beasts, marked with a skull on your map</li>
                <li>Pay an innkeeper to build a monument on a plot in the square, or upgrade one: every hero can use them</li>
                <li>Recruit soldiers at a realm's seat and send its army to raze an orc warcamp; armies march across the map in real time</li>
              </ul>
            </div>
          </div>
          <button type="button" id="controls-close" class="primary">Got it</button>
        </div>
      </div>
      <div id="story" class="overlay story" hidden>
        <div class="story-box">
          <canvas id="story-portrait" width="96" height="96" aria-hidden="true"></canvas>
          <div class="story-body">
            <h2 id="story-title"></h2>
            <p id="story-text"></p>
            <div id="story-choices" class="story-choices"></div>
            <button type="button" id="story-next" class="primary">Continue</button>
            <button type="button" id="story-skip" class="link-btn" hidden>Skip</button>
          </div>
        </div>
      </div>
      <div id="classpick" class="overlay shop" hidden>
        <div class="shop-inner">
          <div class="shop-head"><h2>Choose your class</h2></div>
          <ul class="itemlist classlist">
            <li><b>Warrior</b> <span class="muted">24 HP, attack 3. Shield Wall: 2 less damage from every hit for 6 turns.</span> <button type="button" data-class="warrior">Warrior</button></li>
            <li><b>Ranger</b> <span class="muted">18 HP, attack 3. Arrow: shoot the nearest monster in a straight line, up to 6 tiles. Spots traps.</span> <button type="button" data-class="ranger">Ranger</button></li>
            <li><b>Mage</b> <span class="muted">16 HP, attack 2. Fireball: burn every monster within 2 tiles of the nearest one in sight.</span> <button type="button" data-class="mage">Mage</button></li>
          </ul>
          <p class="muted small">Press 1 or right-click to use your ability. Create a hero to keep your class, level and gear.</p>
        </div>
      </div>
      <div id="shop" class="overlay shop" hidden>
        <div class="shop-inner">
          <div class="shop-head"><h2>Merchant</h2><span id="shop-gold" class="gold"></span><button type="button" id="shop-close">Close</button></div>
          <div class="shop-cols">
            <section><h3>Buy</h3><ul id="shop-buy" class="itemlist"></ul></section>
            <section><h3>Sell</h3><ul id="shop-sell" class="itemlist"></ul></section>
          </div>
          <p class="muted small" id="shop-note">The merchant pays half price for anything you sell. Press Esc to leave.</p>
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
      <button type="button" id="journal" class="fs">Journal (J)</button>
      <button type="button" id="controls" class="fs">Controls (?)</button>
      <button type="button" id="settings-btn" class="fs">Settings (O)</button>
      <button type="button" id="sound" class="fs">Sound on</button>
      <button type="button" id="fullscreen" class="fs">Fullscreen</button>
    </div>
    @if (config('game.multiplayer'))
    @auth
    <form id="chat" class="chat" autocomplete="off">
      <input id="chat-input" maxlength="140" placeholder="Press Enter to talk to heroes nearby" aria-label="Chat message">
      <button type="submit">Say</button>
    </form>
    <div class="party" id="party"></div>
    @else
    <p class="flash muted">Other heroes are out there. <a href="{{ route('register') }}">Create a hero</a> or <a href="{{ route('login') }}">log in</a> to see them, chat, and form a party.</p>
    @endauth
    @endif
    <div class="inventory" id="inventory">
      <canvas id="hero-portrait" class="hero-portrait" width="112" height="112" aria-label="Your hero in their gear"></canvas>
      <div class="gear">
        <div class="equip"><span class="muted">Weapon</span> <b id="inv-weapon">Bare hands</b></div>
        <div class="equip"><span class="muted">Armor</span> <b id="inv-armor">None</b></div>
        <div class="equip"><span class="muted">Relic</span> <b id="inv-relic">None</b></div>
      </div>
      <div class="bag"><span class="muted">Bag</span> <ul id="inv-bag" class="itemlist compact"></ul></div>
    </div>
    <details class="legend-box" open>
      <summary>What's on screen</summary>
      <ul id="legend" class="legend"></ul>
      <p class="muted small">Hover over or tap anything on the map to see what it is.</p>
    </details>
    <p class="help">
      <b>Keys:</b> arrows, WASD or HJKL move; walking into a monster attacks. Space or <kbd>.</kbd> waits, <kbd>1</kbd> uses your class ability, <kbd>P</kbd> drinks a potion, <kbd>B</kbd> throws a bomb, <kbd>T</kbd> reads a scroll of return, <kbd>M</kbd> world map, <kbd>Q</kbd> quests, <kbd>J</kbd> journal, <kbd>N</kbd> sound, <kbd>F</kbd> fullscreen, <kbd>R</kbd> restarts.
      <b>Mouse:</b> right-click uses your ability, aimed where you click (a Ranger's arrow flies along that row or column, a Mage's fireball bursts there); click a spot to walk there, click a monster to attack it until it falls, click people, doors, shops, chests or waystones to use them, and hold and drag to steer. Hover to see the path; right-click or any key stops.
      <b>Touch:</b> tap or hold anywhere on the map to walk that way; the round buttons on the right use your ability, drink a potion, wait, or open the map. Gamepads work too.
      <b>Dungeons:</b> every dungeon shows a recommended level and how hard it is for you (Easy, Fair, Hard, Very hard, Deadly). Every floor has a golden door by the entrance: walk into it twice to leave early and keep your loot.
      <b>Story:</b> King Aldric needs the five shards of the Crown of Aurum. Follow the gold ★ on your compass and map. Along the way, discover standing stones, shrines, ruins, hermits, battlefields and wells, and collect the realm's unique treasures.
      <b>World:</b> you start in Hearth. Step onto doors to go inside, talk to people for quests, hire a hound at an inn, travel by waystone, and take a town gate or a countryside cave, crypt, warren or tower into a dungeon. A boss seals the stairs on the last floor.
      @if (config('game.multiplayer'))
        @auth
          <b>Together:</b> walk into another hero to invite them to a party or wave, press <kbd>Enter</kbd> to chat, and take the same gate to share a dungeon.
        @endauth
      @endif
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
      multiplayer: @json((bool) config('game.multiplayer')),
      buildingsUrl: @json(route('buildings.index')),
      buildings: @json(['slots' => config('game.building_slots'), 'costs' => config('game.building_costs'), 'types' => config('game.buildings')]),
    };
  </script>
  <script src="{{ asset('js/script.js') }}?v={{ filemtime(public_path('js/script.js')) }}"></script>
@endsection
