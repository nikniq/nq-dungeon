@extends('admin.layout', ['title' => 'Structures'])
@section('admin')
  <h3>Rebuilding projects (Story 5)</h3>
  <table class="ranks">
    <thead><tr><th>When</th><th>Town cell</th><th>Project</th><th>Sponsor</th><th>Gold</th><th></th></tr></thead>
    <tbody>
    @forelse ($projects as $p)
      <tr><td>{{ $p->created_at->diffForHumans() }}</td><td>{{ $p->town }}</td><td>{{ config('game.projects')[$p->project]['name'] ?? $p->project }}</td><td>{{ $p->builder_name }}</td><td>{{ number_format($p->gold_spent) }}</td>
        <td class="actions"><form method="post" action="{{ route('admin.projects.destroy', $p) }}" class="inline" onsubmit="return confirm('Remove this structure from the world?')">@csrf @method('DELETE')<button type="submit" class="danger">Remove</button></form></td></tr>
    @empty
      <tr><td colspan="6" class="muted">Nothing sponsored yet.</td></tr>
    @endforelse
    </tbody>
  </table>
  <div class="pager">{{ $projects->links('pagination::simple-default') }}</div>
  <h3>Monuments</h3>
  <table class="ranks">
    <thead><tr><th>When</th><th>Town cell</th><th>Plot</th><th>Type</th><th>Level</th><th>Builder</th><th></th></tr></thead>
    <tbody>
    @forelse ($buildings as $b)
      <tr><td>{{ $b->created_at->diffForHumans() }}</td><td>{{ $b->town }}</td><td>{{ $b->slot }}</td><td>{{ config('game.buildings')[$b->type]['name'] ?? $b->type }}</td><td>{{ $b->level }}</td><td>{{ $b->builder_name }}</td>
        <td class="actions"><form method="post" action="{{ route('admin.buildings.destroy', $b) }}" class="inline" onsubmit="return confirm('Remove this monument?')">@csrf @method('DELETE')<button type="submit" class="danger">Remove</button></form></td></tr>
    @empty
      <tr><td colspan="7" class="muted">No monuments yet.</td></tr>
    @endforelse
    </tbody>
  </table>
  <div class="pager">{{ $buildings->links('pagination::simple-default') }}</div>
@endsection
