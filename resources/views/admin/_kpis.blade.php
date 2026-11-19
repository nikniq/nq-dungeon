<div class="stats">
  @foreach ($kpis as $label => $k)
    <div class="stat">
      <div class="value">{{ number_format($k['value']) }}</div>
      <div class="label">{{ $label }}</div>
      <div class="delta {{ $k['change'] === null ? '' : ($k['change'] >= 0 ? 'up' : 'down') }}">
        @if ($k['change'] === null) {{ $k['previous'] ? '' : 'new' }} vs {{ number_format($k['previous']) }} before
        @else {{ $k['change'] >= 0 ? '▲' : '▼' }} {{ abs($k['change']) }}% vs {{ number_format($k['previous']) }} before
        @endif
      </div>
    </div>
  @endforeach
</div>
