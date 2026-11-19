{{-- a daily column chart from [Y-m-d => count]; a table follows for screen readers --}}
@php($max = max(1, max($series ?: [0])))
<figure class="bars" aria-hidden="true">
  @foreach ($series as $day => $n)
    <div class="bar" style="--h: {{ round($n / $max * 100) }}%" title="{{ \Carbon\Carbon::parse($day)->format('D j M') }}: {{ number_format($n) }}"><span></span></div>
  @endforeach
</figure>
<p class="bars-legend muted small"><span>{{ \Carbon\Carbon::parse(array_key_first($series))->format('j M') }}</span><span>{{ $label }} · total {{ number_format(array_sum($series)) }} · peak {{ number_format(max($series ?: [0])) }}</span><span>{{ \Carbon\Carbon::parse(array_key_last($series))->format('j M') }}</span></p>
<table class="visually-hidden"><caption>{{ $label }} per day</caption>@foreach ($series as $day => $n)<tr><th>{{ $day }}</th><td>{{ $n }}</td></tr>@endforeach</table>
