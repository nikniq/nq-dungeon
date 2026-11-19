{{-- period picker: keeps the other query parameters --}}
<nav class="period" aria-label="Period">
  @foreach ($periods as $p)
    <a href="{{ request()->fullUrlWithQuery(['days' => $p]) }}" class="{{ $days === $p ? 'on' : '' }}">{{ $p }} days</a>
  @endforeach
</nav>
