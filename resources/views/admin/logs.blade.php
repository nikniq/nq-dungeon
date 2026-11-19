@extends('admin.layout', ['title' => 'Logs'])
@section('admin')
  <form method="get" class="form inline-form">
    @if (count($files) > 1)
      <label>File <select name="file">@foreach ($files as $f)<option @selected($f === $file)>{{ $f }}</option>@endforeach</select></label>
    @endif
    <label>Level <select name="level"><option value="">Any</option>@foreach ($levels as $l)<option value="{{ $l }}" @selected($l === $level)>{{ ucfirst(strtolower($l)) }}</option>@endforeach</select></label>
    <label>Search <input name="q" value="{{ $q }}" placeholder="save rejected" maxlength="100"></label>
    <button>Filter</button>
  </form>
  @if (! $file)
    <p class="muted">There is no log file yet.</p>
  @else
    <p class="muted small">{{ $file }} ({{ $size }}). Newest first, up to 200 entries from the end of the file.</p>
    @forelse ($entries as $e)
      <details class="log-entry {{ strtolower($e['level']) }}">
        <summary><span class="pill {{ in_array($e['level'], ['ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY']) ? 'fail' : ($e['level'] === 'WARNING' ? 'warn' : 'off') }}">{{ $e['level'] }}</span> <time>{{ $e['at'] }}</time> {{ \Illuminate\Support\Str::limit($e['message'], 220) }}</summary>
        <pre>{{ $e['message'] }}@if ($e['detail'])

{{ $e['detail'] }}@endif</pre>
      </details>
    @empty
      <p class="muted">No entries match.</p>
    @endforelse
  @endif
@endsection
