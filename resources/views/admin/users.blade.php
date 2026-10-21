@extends('admin.layout', ['title' => 'Users'])
@section('admin')
  <form method="get" class="search"><input type="search" name="q" value="{{ $q }}" placeholder="Name or email"><button type="submit">Search</button></form>
  <table class="ranks">
    <thead><tr><th>User</th><th>Email</th><th>Hero</th><th>Posts</th><th>Joined</th><th>Admin</th><th></th></tr></thead>
    <tbody>
    @foreach ($users as $u)
      <tr>
        <td>{{ $u->name }}</td><td>{{ $u->email }}</td>
        <td>@if ($u->character)<a href="{{ route('heroes.show', $u->character) }}">{{ $u->character->name }}</a> (lv {{ $u->character->level }})@else —@endif</td>
        <td>{{ $u->story_posts_count }}</td><td>{{ $u->created_at->toDateString() }}</td>
        <td>{{ $u->is_admin ? 'yes' : '' }}</td>
        <td class="actions">
          @if ($u->id !== auth()->id())
            <form method="post" action="{{ route('admin.users.toggle', $u) }}" class="inline">@csrf<button type="submit">{{ $u->is_admin ? 'Revoke admin' : 'Make admin' }}</button></form>
            <form method="post" action="{{ route('admin.users.destroy', $u) }}" class="inline" onsubmit="return confirm('Delete {{ $u->email }} and their hero? This cannot be undone.')">@csrf @method('DELETE')<button type="submit" class="danger">Delete</button></form>
          @else <span class="muted small">you</span>@endif
        </td>
      </tr>
    @endforeach
    </tbody>
  </table>
  <div class="pager">{{ $users->links('pagination::simple-default') }}</div>
@endsection
