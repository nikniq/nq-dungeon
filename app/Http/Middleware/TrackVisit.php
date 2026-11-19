<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Two cheap bits of bookkeeping for the admin reports:
 *  - a guest's first visit remembers its UTM tags, outside referrer and landing page in the
 *    session, so the account they later create records where they came from (first touch);
 *  - a signed-in player's last_seen_at is bumped, at most once every five minutes.
 */
class TrackVisit
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('GET') && $request->hasSession()) {
            if ($user = $request->user()) {
                if (! $user->last_seen_at || $user->last_seen_at->lt(now()->subMinutes(5))) {
                    $user->forceFill(['last_seen_at' => now()])->saveQuietly();
                }
            } elseif (! $request->session()->has('attribution') && ! $request->expectsJson()) {
                $request->session()->put('attribution', self::from($request));
            }
        }

        return $next($request);
    }

    /** @return array<string, string|null> */
    public static function from(Request $request): array
    {
        $tag = fn (string $k) => is_string($request->query($k)) && $request->query($k) !== '' ? mb_substr(strtolower(trim($request->query($k))), 0, 100) : null;
        $ref = (string) $request->headers->get('referer', '');
        $host = parse_url($ref, PHP_URL_HOST);
        // a referrer from our own site is navigation, not a source
        $outside = $host && strcasecmp($host, $request->getHost()) !== 0 ? mb_substr($ref, 0, 255) : null;

        return [
            'utm_source' => $tag('utm_source'), 'utm_medium' => $tag('utm_medium'), 'utm_campaign' => $tag('utm_campaign'),
            'referrer' => $outside, 'landing' => mb_substr('/'.ltrim($request->path(), '/'), 0, 255),
        ];
    }
}
