@extends('admin.layout', ['title' => 'Sales'])
@section('admin')
  <p class="muted">The game is free, so "sales" here is conversion: visitors becoming players who stay, and players spending their gold back into the world.</p>
  @include('admin._period')
  @include('admin._kpis', ['kpis' => $kpis])

  <h3>Sign-ups per day</h3>
  @include('admin._bars', ['series' => $signups, 'label' => 'Sign-ups'])

  <h3>Conversion funnel <span class="muted small">accounts created in the last {{ $days }} days</span></h3>
  <table class="ranks funnel">
    <thead><tr><th>Step</th><th>Players</th><th>Of sign-ups</th></tr></thead>
    <tbody>
    @foreach ($funnel as $step => $f)
      <tr><td>{{ $step }}</td><td>{{ number_format($f['count']) }}</td><td class="share"><span style="--w: {{ $f['pct'] }}%"></span>{{ $f['pct'] }}%</td></tr>
    @endforeach
    </tbody>
  </table>

  <div class="cols">
    <section>
      <h3>How they signed up</h3>
      @include('admin._counts', ['counts' => $methods, 'heading' => 'Method', 'empty' => 'No sign-ups in this period.'])
    </section>
    <section>
      <h3>Top spenders on the world <span class="muted small">gold into monuments and rebuilding, all time</span></h3>
      @include('admin._counts', ['counts' => $sponsors, 'heading' => 'Hero', 'empty' => 'Nobody has built anything yet.'])
    </section>
  </div>
@endsection
