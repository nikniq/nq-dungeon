{{-- a breakdown table from a [label => count] collection, with share bars --}}
@php($sum = max(1, collect($counts)->sum()))
@if (collect($counts)->isEmpty())
  <p class="muted">{{ $empty ?? 'Nothing yet.' }}</p>
@else
  <table class="ranks counts">
    <thead><tr><th>{{ $heading }}</th><th>Count</th><th>Share</th></tr></thead>
    <tbody>
    @foreach (collect($counts)->take($limit ?? 15) as $label => $n)
      <tr><td>{{ $label }}</td><td>{{ number_format($n) }}</td><td class="share"><span style="--w: {{ round($n / $sum * 100) }}%"></span>{{ round($n / $sum * 100) }}%</td></tr>
    @endforeach
    </tbody>
  </table>
@endif
