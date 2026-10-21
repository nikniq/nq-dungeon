@extends('admin.layout', ['title' => 'Story posts'])
@section('admin')
  <p class="muted small">Everything posted under the public <a href="{{ route('world.story') }}">story</a>. Remove anything that should not be there.</p>
  <table class="ranks">
    <thead><tr><th>When</th><th>Story</th><th>By</th><th>Post</th><th></th></tr></thead>
    <tbody>
    @forelse ($posts as $p)
      <tr><td>{{ $p->created_at->diffForHumans() }}</td><td>{{ $p->story }}</td><td>{{ $p->user?->character?->name ?? $p->user?->name ?? '—' }}</td><td>{{ $p->body }}</td>
        <td class="actions"><form method="post" action="{{ route('admin.posts.destroy', $p) }}" class="inline" onsubmit="return confirm('Remove this post?')">@csrf @method('DELETE')<button type="submit" class="danger">Remove</button></form></td></tr>
    @empty
      <tr><td colspan="5" class="muted">No posts yet.</td></tr>
    @endforelse
    </tbody>
  </table>
  <div class="pager">{{ $posts->links('pagination::simple-default') }}</div>
@endsection
