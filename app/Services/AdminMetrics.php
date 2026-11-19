<?php

namespace App\Services;

use App\Models\Character;
use App\Models\DailyDelve;
use App\Models\StoryPost;
use App\Models\TownBuilding;
use App\Models\TownProject;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Read-only numbers for the admin pages. Days are grouped in PHP (not SQL date
 * functions) so the same code runs on SQLite and MySQL; the game is small enough
 * that pulling a period's timestamps is cheap.
 */
class AdminMetrics
{
    /** @return list<string> Y-m-d for each of the last $days days, oldest first */
    public function days(int $days, ?CarbonImmutable $end = null): array
    {
        $end = ($end ?? CarbonImmutable::today())->startOfDay();

        return array_map(fn ($i) => $end->subDays($days - 1 - $i)->toDateString(), range(0, $days - 1));
    }

    /** Count rows per day of $column over the last $days days (ending $end), zero-filled. */
    public function perDay(string $model, string $column, int $days, ?CarbonImmutable $end = null, ?callable $scope = null): array
    {
        $keys = $this->days($days, $end);
        $out = array_fill_keys($keys, 0);
        $q = $model::query()->whereBetween($column, [$keys[0].' 00:00:00', end($keys).' 23:59:59']);
        if ($scope) {
            $scope($q);
        }
        foreach ($q->pluck($column) as $at) {
            $d = substr((string) $at, 0, 10);
            if (isset($out[$d])) {
                $out[$d]++;
            }
        }

        return $out;
    }

    /** Distinct players seen per day: a saved hero (characters.updated_at) or a signed-in visit (users.last_seen_at). */
    public function activePerDay(int $days, ?CarbonImmutable $end = null): array
    {
        $keys = $this->days($days, $end);
        $from = $keys[0].' 00:00:00';
        $to = end($keys).' 23:59:59';
        $seen = array_fill_keys($keys, []);
        foreach (Character::whereBetween('updated_at', [$from, $to])->get(['user_id', 'updated_at']) as $c) {
            $seen[$c->updated_at->toDateString()][$c->user_id] = true;
        }
        foreach (User::whereBetween('last_seen_at', [$from, $to])->get(['id', 'last_seen_at']) as $u) {
            $seen[$u->last_seen_at->toDateString()][$u->id] = true;
        }

        return array_map('count', $seen);
    }

    /** Players active within the last $days days. */
    public function activeWithin(int $days): int
    {
        $since = now()->subDays($days);
        $ids = Character::where('updated_at', '>=', $since)->pluck('user_id')
            ->merge(User::where('last_seen_at', '>=', $since)->pluck('id'));

        return $ids->unique()->count();
    }

    /** The headline numbers for a period, and the same numbers for the period before it. */
    public function kpis(int $days): array
    {
        $calc = function (CarbonImmutable $from, CarbonImmutable $to) {
            $range = [$from, $to];
            $chars = Character::whereBetween('updated_at', $range)->pluck('user_id');
            $users = User::whereBetween('last_seen_at', $range)->pluck('id');

            return [
                'Sign-ups' => User::whereBetween('created_at', $range)->count(),
                'Active players' => $chars->merge($users)->unique()->count(),
                'Daily Delve runs' => DailyDelve::whereBetween('created_at', $range)->count(),
                'Story posts' => StoryPost::whereBetween('created_at', $range)->count(),
                'Gold spent building' => (int) TownBuilding::whereBetween('created_at', $range)->sum('gold_spent') + (int) TownProject::whereBetween('created_at', $range)->sum('gold_spent'),
            ];
        };
        $now = CarbonImmutable::now();
        $current = $calc($now->subDays($days), $now);
        $previous = $calc($now->subDays($days * 2), $now->subDays($days));

        return collect($current)->map(fn ($v, $k) => ['value' => $v, 'previous' => $previous[$k], 'change' => $previous[$k] > 0 ? round(($v - $previous[$k]) / $previous[$k] * 100) : null])->all();
    }

    /** Sign-up funnel for accounts created in the last $days days. */
    public function funnel(int $days): array
    {
        $users = User::where('created_at', '>=', now()->subDays($days))->with('character:id,user_id,level,runs,kills,updated_at')->get();
        $total = $users->count();
        $steps = [
            'Signed up' => $total,
            'Email verified' => $users->whereNotNull('email_verified_at')->count(),
            'Played (killed a monster)' => $users->filter(fn ($u) => ($u->character?->kills ?? 0) > 0)->count(),
            'Reached level 5' => $users->filter(fn ($u) => ($u->character?->level ?? 0) >= 5)->count(),
            'Came back after day 1' => $users->filter(fn ($u) => $this->lastSeen($u)?->gt($u->created_at->addDay()))->count(),
        ];

        return collect($steps)->map(fn ($n) => ['count' => $n, 'pct' => $total ? round($n / $total * 100) : 0])->all();
    }

    private function lastSeen(User $u): ?\Carbon\CarbonInterface
    {
        $a = $u->last_seen_at;
        $b = $u->character?->updated_at;

        return $a && $b ? ($a->gt($b) ? $a : $b) : ($a ?? $b);
    }

    /** Count users by a column over the last $days days, biggest first; blank values are labelled. */
    public function breakdown(string $column, int $days, string $blank = '(none)'): Collection
    {
        return User::where('created_at', '>=', now()->subDays($days))->pluck($column)
            ->map(fn ($v) => $v === null || $v === '' ? $blank : $v)
            ->countBy()->sortDesc();
    }

    /** Sign-ups by referring host (from the stored referrer URL). */
    public function referrers(int $days): Collection
    {
        return User::where('created_at', '>=', now()->subDays($days))->pluck('referrer')
            ->map(fn ($r) => $r ? (preg_replace('/^www\./', '', (string) parse_url($r, PHP_URL_HOST)) ?: '(unknown)') : '(direct / none)')
            ->countBy()->sortDesc();
    }

    /** Sign-ups and how far they got, per UTM campaign. */
    public function campaigns(int $days): Collection
    {
        return User::where('created_at', '>=', now()->subDays($days))->whereNotNull('utm_campaign')
            ->with('character:id,user_id,level')->get()
            ->groupBy(fn ($u) => $u->utm_source.' / '.$u->utm_medium.' / '.$u->utm_campaign)
            ->map(fn ($g) => ['signups' => $g->count(), 'verified' => $g->whereNotNull('email_verified_at')->count(), 'level5' => $g->filter(fn ($u) => ($u->character?->level ?? 0) >= 5)->count()])
            ->sortByDesc('signups');
    }

    /** Where heroes stand: class mix, level bands, deepest floors. */
    public function heroMix(): array
    {
        $chars = Character::get(['class', 'level', 'best_floor', 'achievements', 'kills', 'runs']);
        $band = fn ($l) => match (true) { $l < 5 => '1-4', $l < 10 => '5-9', $l < 20 => '10-19', $l < 40 => '20-39', default => '40+' };
        $levels = array_fill_keys(['1-4', '5-9', '10-19', '20-39', '40+'], 0);
        foreach ($chars as $c) {
            $levels[$band((int) $c->level)]++;
        }
        // achievements are a list of ids, e.g. ["elite", "grudge"]
        $ach = $chars->flatMap(fn ($c) => is_array($c->achievements) ? $c->achievements : [])
            ->filter(fn ($a) => is_string($a))->countBy()->sortDesc()->take(10);

        return [
            'classes' => $chars->pluck('class')->map(fn ($c) => $c ?: 'warrior')->countBy()->sortDesc(),
            'levels' => $levels,
            'floors' => $chars->pluck('best_floor')->map(fn ($f) => (int) $f === 0 ? 'never below' : ($f < 5 ? 'floors 1-4' : ($f < 10 ? 'floors 5-9' : 'floor 10+')))->countBy(),
            'achievements' => $ach,
            'kills' => (int) $chars->sum('kills'),
            'runs' => (int) $chars->sum('runs'),
        ];
    }

    /** Biggest spenders on monuments and rebuilding. */
    public function topSponsors(int $limit = 10): Collection
    {
        return TownBuilding::get(['builder_name', 'gold_spent'])->concat(TownProject::get(['builder_name', 'gold_spent']))
            ->groupBy(fn ($r) => $r->builder_name ?: '(unknown)')
            ->map(fn ($g) => (int) $g->sum('gold_spent'))->sortDesc()->take($limit);
    }
}
