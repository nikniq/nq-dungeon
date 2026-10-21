@extends('admin.layout', ['title' => 'Admin overview'])
@section('admin')
  <div class="stats">
    @foreach ($stats as $label => $value)
      <div class="stat"><div class="value">{{ number_format($value) }}</div><div class="label">{{ $label }}</div></div>
    @endforeach
  </div>
  <h3>Recently active heroes</h3>
  <table class="ranks">
    <thead><tr><th>Hero</th><th>User</th><th>Level</th><th>Gold</th><th>Where</th><th>Last seen</th></tr></thead>
    <tbody>
    @foreach ($recent as $h)
      <tr><td><a href="{{ route('heroes.show', $h) }}">{{ $h->name }}</a></td><td>{{ $h->user?->email }}</td><td>{{ $h->level }}</td><td>{{ number_format($h->gold) }}</td><td>{{ $h->floor > 0 ? 'Floor '.$h->floor : 'In town' }}</td><td>{{ $h->updated_at->diffForHumans() }}</td></tr>
    @endforeach
    </tbody>
  </table>
@endsection
