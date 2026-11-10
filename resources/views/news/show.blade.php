@extends('layouts.app')
@section('title', $article['title'].' — Dungeon Affair news')
@section('description', $article['summary'])
@section('content')
  <p class="muted small"><a href="{{ route('news.index') }}">← All news</a></p>
  <article class="story-part news-article">
    <p class="muted small news-meta"><time datetime="{{ $article['date'] }}">{{ \Illuminate\Support\Carbon::parse($article['date'])->format('j F Y') }}</time> <span class="tag">{{ $article['tag'] }}</span></p>
    <h3>{{ $article['title'] }}</h3>
    <p class="tagline">{{ $article['summary'] }}</p>
    @foreach ($article['sections'] as $section)
      @if ($section['heading']) <h4>{{ $section['heading'] }}</h4> @endif
      @foreach ($section['text'] ?? [] as $para)
        <p>{{ $para }}</p>
      @endforeach
      @if (! empty($section['points']))
        <ul>
          @foreach ($section['points'] as $point)
            <li>{{ $point }}</li>
          @endforeach
        </ul>
      @endif
    @endforeach
    <p><a href="{{ route('game') }}" class="primary button">Play now</a></p>
  </article>
  @if ($others)
    <div class="glossary-head"><h2>More news</h2></div>
    <ul class="news-more">
      @foreach ($others as $other)
        <li><a href="{{ route('news.show', $other['slug']) }}">{{ $other['title'] }}</a> <span class="muted small">{{ \Illuminate\Support\Carbon::parse($other['date'])->format('j F Y') }}</span></li>
      @endforeach
    </ul>
  @endif
@endsection
