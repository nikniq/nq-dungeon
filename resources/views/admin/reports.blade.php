@extends('admin.layout', ['title' => 'Reports'])
@section('admin')
  <div class="report-head">
    @include('admin._period')
    <a class="button" href="{{ route('admin.reports.export', ['days' => $days]) }}">Download CSV</a>
  </div>
  <p class="muted">The last {{ $days }} days compared with the {{ $days }} days before.</p>
  @include('admin._kpis', ['kpis' => $kpis])
  <h3>Day by day</h3>
  <table class="ranks">
    <thead><tr><th>Date</th><th>Sign-ups</th><th>Active players</th><th>Daily Delves</th><th>Story posts</th></tr></thead>
    <tbody>
    @foreach ($rows as $date => $r)
      <tr><td>{{ \Carbon\Carbon::parse($date)->format('D j M Y') }}</td><td>{{ $r['signups'] }}</td><td>{{ $r['active'] }}</td><td>{{ $r['delves'] }}</td><td>{{ $r['posts'] }}</td></tr>
    @endforeach
    </tbody>
  </table>
@endsection
