@extends('admin.layout', ['title' => 'Usage'])
@section('admin')
  <div class="stats">
    @foreach ($active as $label => $n)
      <div class="stat"><div class="value">{{ number_format($n) }}</div><div class="label">{{ $label === 'All accounts' ? $label : 'Active '.strtolower($label) }}</div></div>
    @endforeach
    <div class="stat"><div class="value">{{ number_format($mix['kills']) }}</div><div class="label">Monsters slain, all heroes</div></div>
    <div class="stat"><div class="value">{{ number_format($mix['runs']) }}</div><div class="label">Dungeon runs</div></div>
  </div>
  @include('admin._period')
  <h3>Active players per day</h3>
  @include('admin._bars', ['series' => $activePerDay, 'label' => 'Players who saved or visited'])
  <h3>Daily Delve runs per day</h3>
  @include('admin._bars', ['series' => $delves, 'label' => 'Daily Delve runs'])

  <div class="cols">
    <section><h3>Classes</h3>@include('admin._counts', ['counts' => $mix['classes'], 'heading' => 'Class'])</section>
    <section><h3>Levels</h3>@include('admin._counts', ['counts' => $mix['levels'], 'heading' => 'Level'])</section>
    <section><h3>Deepest floor reached</h3>@include('admin._counts', ['counts' => $mix['floors'], 'heading' => 'Best floor'])</section>
    <section><h3>Most earned achievements</h3>@include('admin._counts', ['counts' => $mix['achievements'], 'heading' => 'Achievement', 'empty' => 'None earned yet.'])</section>
  </div>
@endsection
