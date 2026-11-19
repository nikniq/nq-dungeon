@extends('admin.layout', ['title' => 'Health'])
@section('admin')
  @php($worst = collect($checks)->pluck('status')->contains('fail') ? 'fail' : (collect($checks)->pluck('status')->contains('warn') ? 'warn' : 'ok'))
  <p class="health-summary {{ $worst }}">{{ ['ok' => 'All checks pass.', 'warn' => 'Running, with warnings below.', 'fail' => 'Something needs fixing: see the failed checks.'][$worst] }}</p>
  <table class="ranks health">
    <thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead>
    <tbody>
    @foreach ($checks as $c)
      <tr class="{{ $c['status'] }}"><td><span class="pill {{ $c['status'] }}">{{ ['ok' => 'OK', 'warn' => 'Warning', 'fail' => 'Failed', 'off' => 'Off'][$c['status']] }}</span></td><td>{{ $c['name'] }}</td><td>{{ $c['detail'] }}</td></tr>
    @endforeach
    </tbody>
  </table>
  <p>
    @if ($live)
      <a class="button" href="{{ route('admin.health', ['live' => 1]) }}">Run live checks again</a>
    @else
      <a class="button" href="{{ route('admin.health', ['live' => 1]) }}">Run live checks</a>
      <span class="muted small">Tests the Google and NikniQ sign-in credentials by calling them (a few seconds).</span>
    @endif
  </p>
  <p class="muted small">Uptime monitors can poll <code>{{ url('/up') }}</code>, which answers 200 while the app boots.</p>
@endsection
