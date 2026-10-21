@extends('layouts.app')
@section('title', $title.' — Admin — Dungeon Adventure')
@section('body-class', 'wide')
@section('content')
<div class="admin">
  <nav class="admin-nav">
    <a href="{{ route('admin.index') }}" class="{{ request()->routeIs('admin.index') ? 'on' : '' }}">Overview</a>
    <a href="{{ route('admin.users') }}" class="{{ request()->routeIs('admin.users') ? 'on' : '' }}">Users</a>
    <a href="{{ route('admin.heroes') }}" class="{{ request()->routeIs('admin.heroes') ? 'on' : '' }}">Heroes</a>
    <a href="{{ route('admin.posts') }}" class="{{ request()->routeIs('admin.posts') ? 'on' : '' }}">Story posts</a>
    <a href="{{ route('admin.structures') }}" class="{{ request()->routeIs('admin.structures') ? 'on' : '' }}">Structures</a>
  </nav>
  <h2>{{ $title }}</h2>
  @yield('admin')
</div>
@endsection
