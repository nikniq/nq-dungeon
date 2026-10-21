<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dump every application table through the app's own database connection,
 * as gzipped JSON ({table: [rows]}). No mysql client, no second set of
 * credentials: whatever config/database.php points at is what gets dumped.
 * db:restore reads the same file back.
 */
class DbDump extends Command
{
    protected $signature = 'db:dump {path=storage/app/private/db-dump.json.gz : where to write the dump}';
    protected $description = "Dump the application's tables to gzipped JSON through the app's own connection";

    /** Tables that hold no game data worth keeping. */
    public const SKIP = ['migrations', 'cache', 'cache_locks', 'sessions', 'jobs', 'job_batches', 'failed_jobs', 'password_reset_tokens'];

    public function handle(): int
    {
        $path = base_path($this->argument('path'));
        $tables = array_values(array_diff(Schema::getTableListing(schemaQualified: false), self::SKIP));
        $dump = ['dumped_at' => now()->toIso8601String(), 'connection' => config('database.default'), 'tables' => []];
        foreach ($tables as $table) {
            $dump['tables'][$table] = DB::table($table)->orderBy(Schema::hasColumn($table, 'id') ? 'id' : DB::raw('1'))->get()->map(fn ($r) => (array) $r)->all();
        }
        @mkdir(dirname($path), 0775, true);
        file_put_contents($path, gzencode(json_encode($dump, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 6));
        $rows = array_sum(array_map('count', $dump['tables']));
        $this->info(sprintf('Dumped %d tables, %d rows, to %s (%s)', count($tables), $rows, $this->argument('path'), $this->size(filesize($path))));

        return self::SUCCESS;
    }

    private function size(int $bytes): string
    {
        return $bytes > 1048576 ? round($bytes / 1048576, 1).' MB' : round($bytes / 1024).' KB';
    }
}
