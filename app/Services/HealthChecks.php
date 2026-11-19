<?php

namespace App\Services;

use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\NikniqAuthController;
use App\Models\Character;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Checks for the admin health page. Each returns ['name', 'status' => ok|warn|fail|off, 'detail'].
 * The cheap ones run on every view; live() calls Google and the NikniQ portal and runs only on request.
 */
class HealthChecks
{
    public function __construct(private LogReader $logs) {}

    public function all(): array
    {
        return [
            $this->guard('Database', function () {
                $t = microtime(true);
                DB::select('select 1');
                $ms = round((microtime(true) - $t) * 1000, 1);

                return [$ms > 200 ? 'warn' : 'ok', DB::connection()->getDriverName()." answered in {$ms} ms"];
            }),
            $this->guard('Migrations', function () {
                $migrator = app('migrator');
                if (! $migrator->repositoryExists()) {
                    return ['fail', 'The migrations table is missing'];
                }
                $ran = $migrator->getRepository()->getRan();
                $pending = array_diff(array_keys($migrator->getMigrationFiles(database_path('migrations'))), $ran);

                return $pending ? ['fail', count($pending).' pending: '.implode(', ', array_slice($pending, 0, 3)).'. Run php artisan migrate'] : ['ok', count($ran).' applied, none pending'];
            }),
            $this->guard('Cache', function () {
                $key = 'health:'.bin2hex(random_bytes(4));
                Cache::put($key, 'ok', 10);
                $ok = Cache::pull($key) === 'ok';

                return [$ok ? 'ok' : 'fail', config('cache.default').($ok ? ' store reads back what it writes' : ' store did not read back')];
            }),
            $this->guard('Storage', function () {
                $bad = array_filter([storage_path('logs'), storage_path('framework/sessions'), storage_path('framework/cache'), base_path('bootstrap/cache')], fn ($p) => ! is_writable($p));

                return $bad ? ['fail', 'Not writable: '.implode(', ', array_map(fn ($p) => str_replace(base_path().'/', '', $p), $bad))] : ['ok', 'logs, sessions, cache and bootstrap/cache are writable'];
            }),
            $this->guard('Disk space', function () {
                $free = @disk_free_space(base_path());
                $total = @disk_total_space(base_path());
                if (! $free || ! $total) {
                    return ['warn', 'The host does not report disk space'];
                }
                $pct = round($free / $total * 100);

                return [$pct < 5 ? 'fail' : ($pct < 15 ? 'warn' : 'ok'), self::bytes($free).' free of '.self::bytes($total)." ({$pct}%)"];
            }),
            $this->guard('PHP', fn () => [version_compare(PHP_VERSION, '8.2.0', '>=') ? 'ok' : 'fail', 'PHP '.PHP_VERSION.', memory limit '.ini_get('memory_limit')]),
            $this->guard('App settings', function () {
                $problems = array_filter([
                    blank(config('app.key')) ? 'APP_KEY is not set' : null,
                    app()->isProduction() && config('app.debug') ? 'APP_DEBUG is on in production (shows stack traces to players)' : null,
                    app()->isProduction() && ! str_starts_with((string) config('app.url'), 'https://') ? 'APP_URL is not https' : null,
                ]);

                return $problems ? ['fail', implode('; ', $problems)] : ['ok', app()->environment().', debug '.(config('app.debug') ? 'on' : 'off').', '.config('app.url')];
            }),
            $this->guard('Mail', function () {
                $mailer = (string) config('mail.default');

                return in_array($mailer, ['log', 'array'], true)
                    ? [app()->isProduction() ? 'fail' : 'warn', "MAIL_MAILER is {$mailer}: sign-up and login-link emails are not sent"]
                    : ['ok', "Sending with {$mailer} from ".config('mail.from.address')];
            }),
            $this->guard('Google sign-in', fn () => GoogleAuthController::enabled() ? ['ok', 'Configured. Use "Run live checks" to test the secret with Google'] : ['off', 'Not configured (button hidden)']),
            $this->guard('NikniQ sign-in', fn () => NikniqAuthController::enabled() ? ['ok', 'Configured for '.config('services.nikniq.url').'. Use "Run live checks" to test it'] : ['off', 'Not configured (button hidden): set NIKNIQ_CLIENT_ID']),
            $this->guard('Errors in the log', function () {
                $n = $this->logs->countSince(['ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'], now()->subDay());

                return [$n > 20 ? 'fail' : ($n > 0 ? 'warn' : 'ok'), $n ? "{$n} in the last 24 hours (see Logs)" : 'None in the last 24 hours'];
            }),
            $this->guard('Saves', function () {
                $last = Character::max('updated_at');

                return $last ? ['ok', 'Last hero saved '.\Carbon\Carbon::parse($last)->diffForHumans()] : ['warn', 'No hero has saved yet'];
            }),
            $this->guard('Deployed version', function () {
                $head = @file_get_contents(base_path('.git/HEAD'));
                if (! $head) {
                    return ['warn', 'No git checkout found'];
                }
                $ref = trim(str_replace('ref: ', '', $head));
                $sha = str_starts_with($head, 'ref:') ? trim((string) @file_get_contents(base_path('.git/'.$ref))) : trim($head);
                if ($sha === '' && is_readable(base_path('.git/packed-refs')) && preg_match('/^([0-9a-f]{40}) '.preg_quote($ref, '/').'$/m', (string) file_get_contents(base_path('.git/packed-refs')), $m)) {
                    $sha = $m[1];
                }

                return ['ok', basename($ref).' at '.($sha ? substr($sha, 0, 7) : 'unknown')];
            }),
        ];
    }

    /** Calls out to Google and the portal with a deliberately fake code: invalid_grant means the client is accepted. */
    public function live(): array
    {
        $probe = function (string $name, bool $enabled, string $url, array $form) {
            if (! $enabled) {
                return ['name' => $name, 'status' => 'off', 'detail' => 'Not configured'];
            }

            return $this->guard($name, function () use ($url, $form) {
                $res = Http::asForm()->acceptJson()->timeout(8)->post($url, $form + ['grant_type' => 'authorization_code', 'code' => 'health-check-not-a-real-code']);
                $error = (string) $res->json('error');

                return match ($error) {
                    'invalid_grant' => ['ok', 'Credentials accepted (the fake test code was refused, as expected)'],
                    'invalid_client', 'unauthorized_client' => ['fail', "Rejected: {$error} (".$res->json('error_description').'). The client ID or secret is wrong'],
                    default => ['warn', 'Unexpected answer: HTTP '.$res->status().($error ? " {$error}" : '')],
                };
            });
        };

        return [
            $probe('Google credentials (live)', GoogleAuthController::enabled(), 'https://oauth2.googleapis.com/token', [
                'client_id' => config('services.google.client_id'), 'client_secret' => config('services.google.client_secret'),
                'redirect_uri' => url((string) config('services.google.redirect')),
            ]),
            $probe('NikniQ portal (live)', NikniqAuthController::enabled(), rtrim((string) config('services.nikniq.url'), '/').'/api/sso/token', array_filter([
                'client_id' => config('services.nikniq.client_id'), 'client_secret' => config('services.nikniq.client_secret'),
                'redirect_uri' => url((string) config('services.nikniq.redirect')), 'code_verifier' => str_repeat('a', 64),
            ])),
        ];
    }

    private function guard(string $name, callable $check): array
    {
        try {
            [$status, $detail] = $check();
        } catch (Throwable $e) {
            [$status, $detail] = ['fail', class_basename($e).': '.mb_substr($e->getMessage(), 0, 200)];
        }

        return ['name' => $name, 'status' => $status, 'detail' => $detail];
    }

    public static function bytes(float|int $b): string
    {
        foreach (['B', 'KB', 'MB', 'GB', 'TB'] as $unit) {
            if ($b < 1024) {
                return round($b, 1).' '.$unit;
            }
            $b /= 1024;
        }

        return round($b, 1).' PB';
    }
}
