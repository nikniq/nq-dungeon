@extends('layouts.app')
@section('title', 'The story — Dungeon Adventure')
@section('description', 'The story of Dungeon Adventure in two parts: The Shattered Crown and The Far Shore, with a discussion thread under each.')
@section('content')
  <div class="glossary-head">
    <h2>The story so far</h2>
    <p class="muted">Dungeon Adventure is told in stories. Story 1 is where every hero begins; Story 2 opens when it is finished. Read, then say what you think under each. See also the <a href="{{ route('world.towns') }}">towns</a> and <a href="{{ route('world.characters') }}">characters</a>.</p>
  </div>
  @foreach ($stories as $story)
    <section class="story-part" id="story-{{ $story['n'] }}">
      <h3>Story {{ $story['n'] }}: {{ $story['title'] }} <span class="tag">{{ $story['status'] }}</span></h3>
      <p class="tagline">{{ $story['tagline'] }}</p>
      @foreach ($story['acts'] as $act)
        <h4>{{ $act['title'] }}</h4>
        <p>{{ $act['text'] }}</p>
      @endforeach
      <p class="muted small">Realms: {{ implode(' · ', $story['realms']) }}</p>
      <div class="discussion">
        <h4>Discussion</h4>
        @forelse ($posts->get($story['n'], collect()) as $post)
          <div class="post">
            <div class="meta"><strong>{{ $post->user->character?->name ?? $post->user->name }}</strong> <span class="muted small">{{ $post->created_at->diffForHumans() }}</span></div>
            <p>{{ $post->body }}</p>
          </div>
        @empty
          <p class="muted small">Nobody has said anything about this story yet.</p>
        @endforelse
        @auth
          <form method="post" action="{{ route('world.story.post') }}" class="post-form">
            @csrf
            <input type="hidden" name="story" value="{{ $story['n'] }}">
            <textarea name="body" rows="3" maxlength="600" required placeholder="What did you make of it? No spoilers for the other story, please.">{{ old('story') == $story['n'] ? old('body') : '' }}</textarea>
            @error('body') <p class="error">{{ $message }}</p> @enderror
            <button type="submit" class="primary">Post</button>
          </form>
        @else
          <p class="muted small"><a href="{{ route('login') }}">Log in</a> or <a href="{{ route('register') }}">create a hero</a> to join the discussion.</p>
        @endauth
      </div>
    </section>
  @endforeach
@endsection
