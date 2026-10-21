@extends('admin.layout', ['title' => 'Heroes'])
@section('admin')
  <form method="get" class="search"><input type="search" name="q" value="{{ $q }}" placeholder="Hero name"><button type="submit">Search</button></form>
  <table class="ranks">
    <thead><tr><th>Hero</th><th>User</th><th>Class</th><th>Where</th><th>Level</th><th>Gold</th><th>Last seen</th><th></th></tr></thead>
    <tbody>
    @foreach ($heroes as $h)
      <tr>
        <td><a href="{{ route('heroes.show', $h) }}">{{ $h->name }}</a></td><td>{{ $h->user?->email }}</td><td>{{ ucfirst($h->class) }}</td>
        <td>{{ $h->floor > 0 ? 'Floor '.$h->floor : 'In town' }}</td>
        <td colspan="2">
          <form method="post" action="{{ route('admin.heroes.update', $h) }}" class="inline edit">@csrf
            <input type="hidden" name="name" value="{{ $h->name }}">
            <label>Lv <input type="number" name="level" value="{{ $h->level }}" min="1" max="999" size="4"></label>
            <label>Gold <input type="number" name="gold" value="{{ $h->gold }}" min="0" size="8"></label>
            <button type="submit">Save</button>
          </form>
        </td>
        <td>{{ $h->updated_at->diffForHumans() }}</td>
        <td class="actions"><form method="post" action="{{ route('admin.heroes.reset', $h) }}" class="inline">@csrf<button type="submit" title="Back to town at full health, for a hero stuck on a floor">Rescue</button></form></td>
      </tr>
    @endforeach
    </tbody>
  </table>
  <div class="pager">{{ $heroes->links('pagination::simple-default') }}</div>
@endsection
