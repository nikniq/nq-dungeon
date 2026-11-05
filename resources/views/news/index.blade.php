@extends('layouts.app')
@section('title', 'News — Dungeon Adventure')
@section('description', 'Development news for Dungeon Adventure: what is new in the game and how to use it.')
@section('content')
  <div class="glossary-head">
    <h2>News</h2>
    <p class="muted">What has changed in the game lately, and how to make use of it.</p>
  </div>
  @foreach ($articles as $article)
    <section class="story-part news-item">
      <p class="muted small news-meta"><time datetime="{{ $article['date'] }}">{{ \Illuminate\Support\Carbon::parse($article['date'])->format('j F Y') }}</time> <span class="tag">{{ $article['tag'] }}</span></p>
      <h3><a href="{{ route('news.show', $article['slug']) }}" class="plain">{{ $article['title'] }}</a></h3>
      <p>{{ $article['summary'] }}</p>
      <p><a href="{{ route('news.show', $article['slug']) }}">Read the article →</a></p>
    </section>
  @endforeach
@endsection
