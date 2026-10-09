@extends('layouts.app')
@section('content')
    @guest
      <p class="flash muted">Playing as a guest. <a href="{{ route('register') }}">Create a hero</a> or <a href="{{ route('login') }}">log in</a> to save your hero and continue runs later.</p>
    @endguest
    <div class="hud">
      <div id="stats">Floor 1 | HP 20/20</div>
      <div class="hp-track"><div id="hpbar" class="hp-fill"></div></div>
    </div>
    <div class="stage">
      <canvas id="game" width="800" height="600"></canvas>
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
    </div>
    <p class="help">
      Move with arrow keys, WASD or HJKL. Space or <kbd>.</kbd> waits a turn, <kbd>R</kbd> restarts.
      Walk into monsters to attack. Collect gold and potions, reach the green exit, and clear all 5 floors.
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
    };
  </script>
  <script src="{{ asset('js/script.js') }}?v={{ filemtime(public_path('js/script.js')) }}"></script>
@endsection
