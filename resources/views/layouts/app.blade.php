<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <meta name="description" content="@yield('description', 'Dungeon Adventure: a free browser roguelike. Gear up in town, descend five floors, and escape with the gold.')">
  <title>@yield('title', 'Dungeon Adventure')</title>
  <link rel="stylesheet" href="{{ asset('css/style.css') }}?v={{ filemtime(public_path('css/style.css')) }}">
  @php($gaId = config('services.google_analytics.measurement_id'))
  @if ($gaId && preg_match('/^G-[A-Z0-9]{4,16}$/', $gaId))
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ $gaId }}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', @json($gaId));
      @if (session('ga_event'))
        gtag('event', @json(session('ga_event')), @json(session('ga_params', (object) [])));
      @endif
    </script>
  @endif
</head>
<body class="@yield('body-class')">
  <div class="container">
    <header class="top">
      <h1><a href="{{ route('home') }}" class="plain">Dungeon Adventure</a></h1>
      <nav class="account">
        <a href="{{ route('game') }}">Play</a>
        <a href="{{ route('heroes.index') }}">Heroes</a>
        <a href="{{ route('world.story') }}">Story</a>
        <a href="{{ route('world.towns') }}">World</a>
        @auth
          <a href="{{ route('heroes.show', auth()->user()->character ?? auth()->user()->name) }}" class="who">{{ auth()->user()->character?->name ?? auth()->user()->name }}</a>
          <a href="{{ route('character.edit') }}">Profile</a>
          <form method="post" action="{{ route('logout') }}" class="inline">@csrf<button type="submit">Log out</button></form>
        @else
          <a href="{{ route('login') }}">Log in</a>
          <a href="{{ route('register') }}" class="primary">Create hero</a>
        @endauth
      </nav>
    </header>
    @if (session('status'))
      <p class="flash">{{ session('status') }}</p>
    @endif
    @yield('content')
    <footer class="foot muted small">
      <a href="{{ route('home') }}">About</a> · <a href="{{ route('heroes.index') }}">Heroes</a> · <a href="{{ route('world.story') }}">Story</a> · <a href="{{ route('world.towns') }}">Towns</a> · <a href="{{ route('world.characters') }}">Characters</a> · <a href="{{ route('game') }}">Play</a>
    </footer>
  </div>
  @yield('scripts')
</body>
</html>
