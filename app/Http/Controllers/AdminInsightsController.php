<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AdminMetrics;
use App\Services\HealthChecks;
use App\Services\LogReader;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The admin's read-only insight pages: sales (sign-up conversion and the gold
 * economy), marketing (where players come from), usage, reports with CSV export,
 * health checks and the application log. Nothing here writes game data.
 */
class AdminInsightsController extends Controller
{
    private const PERIODS = [7, 30, 90];

    public function __construct(private AdminMetrics $metrics) {}

    private function period(Request $request): int
    {
        $days = (int) $request->query('days', 30);

        return in_array($days, self::PERIODS, true) ? $days : 30;
    }

    public function sales(Request $request): View
    {
        $days = $this->period($request);

        return view('admin.sales', [
            'days' => $days, 'periods' => self::PERIODS,
            'signups' => $this->metrics->perDay(User::class, 'created_at', $days),
            'funnel' => $this->metrics->funnel($days),
            'methods' => $this->metrics->breakdown('signup_method', $days, '(before tracking)'),
            'sponsors' => $this->metrics->topSponsors(),
            'kpis' => $this->metrics->kpis($days),
        ]);
    }

    public function marketing(Request $request): View
    {
        $days = $this->period($request);

        return view('admin.marketing', [
            'days' => $days, 'periods' => self::PERIODS,
            'sources' => $this->metrics->breakdown('utm_source', $days),
            'mediums' => $this->metrics->breakdown('utm_medium', $days),
            'referrers' => $this->metrics->referrers($days),
            'landings' => $this->metrics->breakdown('landing', $days, '(unknown)'),
            'campaigns' => $this->metrics->campaigns($days),
            'gaId' => config('services.google_analytics.measurement_id'),
            'link' => $this->campaignLink($request),
        ]);
    }

    /** The UTM link builder: echoes a tagged URL to share. */
    private function campaignLink(Request $request): ?string
    {
        $source = trim((string) $request->query('source', ''));
        if ($source === '') {
            return null;
        }
        $page = '/'.ltrim((string) $request->query('page', '/'), '/');

        return url($page).'?'.http_build_query(array_filter([
            'utm_source' => $source,
            'utm_medium' => trim((string) $request->query('medium', '')),
            'utm_campaign' => trim((string) $request->query('campaign', '')),
        ]));
    }

    public function usage(Request $request): View
    {
        $days = $this->period($request);

        return view('admin.usage', [
            'days' => $days, 'periods' => self::PERIODS,
            'active' => ['Today' => $this->metrics->activeWithin(1), 'Last 7 days' => $this->metrics->activeWithin(7), 'Last 30 days' => $this->metrics->activeWithin(30), 'All accounts' => User::count()],
            'activePerDay' => $this->metrics->activePerDay($days),
            'delves' => $this->metrics->perDay(\App\Models\DailyDelve::class, 'created_at', $days),
            'mix' => $this->metrics->heroMix(),
        ]);
    }

    public function reports(Request $request): View
    {
        $days = $this->period($request);

        return view('admin.reports', ['days' => $days, 'periods' => self::PERIODS, 'kpis' => $this->metrics->kpis($days), 'rows' => $this->dailyRows($days)]);
    }

    public function export(Request $request): StreamedResponse
    {
        $days = $this->period($request);
        $rows = $this->dailyRows($days);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['date', 'signups', 'active_players', 'daily_delves', 'story_posts']);
            foreach ($rows as $date => $r) {
                fputcsv($out, [$date, $r['signups'], $r['active'], $r['delves'], $r['posts']]);
            }
            fclose($out);
        }, "dungeon-daily-{$days}d-".now()->toDateString().'.csv', ['Content-Type' => 'text/csv']);
    }

    /** @return array<string, array{signups:int, active:int, delves:int, posts:int}> newest first */
    private function dailyRows(int $days): array
    {
        $signups = $this->metrics->perDay(User::class, 'created_at', $days);
        $active = $this->metrics->activePerDay($days);
        $delves = $this->metrics->perDay(\App\Models\DailyDelve::class, 'created_at', $days);
        $posts = $this->metrics->perDay(\App\Models\StoryPost::class, 'created_at', $days);
        $rows = [];
        foreach (array_reverse(array_keys($signups)) as $d) {
            $rows[$d] = ['signups' => $signups[$d], 'active' => $active[$d], 'delves' => $delves[$d], 'posts' => $posts[$d]];
        }

        return $rows;
    }

    public function health(Request $request, HealthChecks $checks): View
    {
        $results = $checks->all();
        if ($request->boolean('live')) {
            $results = array_merge($results, $checks->live());
        }

        return view('admin.health', ['checks' => $results, 'live' => $request->boolean('live')]);
    }

    public function logs(Request $request, LogReader $reader): View
    {
        $files = $reader->files();
        $names = array_map('basename', $files);
        $chosen = in_array($request->query('file'), $names, true) ? $files[array_search($request->query('file'), $names, true)] : ($files[0] ?? null);
        $level = in_array(strtoupper((string) $request->query('level')), LogReader::LEVELS, true) ? strtoupper($request->query('level')) : null;
        $q = mb_substr(trim((string) $request->query('q', '')), 0, 100);

        return view('admin.logs', [
            'files' => $names, 'file' => $chosen ? basename($chosen) : null, 'size' => $chosen ? HealthChecks::bytes(filesize($chosen)) : null,
            'levels' => LogReader::LEVELS, 'level' => $level, 'q' => $q,
            'entries' => $reader->entries($chosen, $level, $q),
        ]);
    }
}
