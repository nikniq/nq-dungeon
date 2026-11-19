@extends('admin.layout', ['title' => 'Marketing'])
@section('admin')
  <p class="muted">Where new accounts came from, taken from the first page they ever opened (UTM tags and the referring site). Accounts made before tracking started show as "(none)".</p>
  @include('admin._period')

  <div class="cols">
    <section><h3>Source <span class="muted small">utm_source</span></h3>@include('admin._counts', ['counts' => $sources, 'heading' => 'Source'])</section>
    <section><h3>Medium <span class="muted small">utm_medium</span></h3>@include('admin._counts', ['counts' => $mediums, 'heading' => 'Medium'])</section>
    <section><h3>Referring sites</h3>@include('admin._counts', ['counts' => $referrers, 'heading' => 'Site'])</section>
    <section><h3>Landing pages</h3>@include('admin._counts', ['counts' => $landings, 'heading' => 'Page'])</section>
  </div>

  <h3>Campaigns</h3>
  @if ($campaigns->isEmpty())
    <p class="muted">No tagged campaigns in this period. Build a link below and share it.</p>
  @else
    <table class="ranks">
      <thead><tr><th>Source / medium / campaign</th><th>Sign-ups</th><th>Verified</th><th>Reached level 5</th></tr></thead>
      <tbody>
      @foreach ($campaigns as $name => $c)
        <tr><td>{{ $name }}</td><td>{{ number_format($c['signups']) }}</td><td>{{ number_format($c['verified']) }}</td><td>{{ number_format($c['level5']) }}</td></tr>
      @endforeach
      </tbody>
    </table>
  @endif

  <h3>Campaign link builder</h3>
  <form method="get" class="form inline-form">
    <input type="hidden" name="days" value="{{ $days }}">
    <label>Source <input name="source" value="{{ request('source') }}" placeholder="reddit" required maxlength="100"></label>
    <label>Medium <input name="medium" value="{{ request('medium') }}" placeholder="social" maxlength="100"></label>
    <label>Campaign <input name="campaign" value="{{ request('campaign') }}" placeholder="nemesis-launch" maxlength="100"></label>
    <label>Page <input name="page" value="{{ request('page', '/') }}" maxlength="100"></label>
    <button>Build link</button>
  </form>
  @if ($link)
    <p><code class="copy">{{ $link }}</code></p>
  @endif

  <h3>Google Analytics</h3>
  <p class="muted">{{ $gaId ? "Tag {$gaId} is on every page, with sign_up, login and in-game events. Traffic numbers live in Google Analytics." : 'GOOGLE_ANALYTICS_ID is not set, so no page-view tracking is loaded.' }}</p>
@endsection
