<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>@yield('title', 'Dungeon Adventure')</title>
  <link rel="stylesheet" href="{{ asset('css/style.css') }}?v={{ filemtime(public_path('css/style.css')) }}">
</head>
<body>
  <div class="container">
    <header class="top">
      <h1><a href="{{ route('game') }}" class="plain">Dungeon Adventure</a></h1>
      <nav class="account">
        @auth
          <span class="who">{{ auth()->user()->character?->name ?? auth()->user()->name }}</span>
          <a href="{{ route('character.edit') }}">Character</a>
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
  </div>
  @yield('scripts')
</body>
</html>
