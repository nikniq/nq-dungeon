<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Load a db:dump file back through the app's own connection: each table in
 * the dump is emptied and refilled. Run the migrations first so the tables
 * exist. Destructive, so it asks unless --force is given.
 */
class DbRestore extends Command
{
    protected $signature = 'db:restore {path : a file written by db:dump} {--force : do not ask}';
    protected $description = "Restore the application's tables from a db:dump file";

    public function handle(): int
    {
        $path = base_path($this->argument('path'));
        if (! is_file($path)) {
            $this->error("No such file: {$this->argument('path')}");

            return self::FAILURE;
        }
        $dump = json_decode(gzdecode(file_get_contents($path)), true);
        if (! is_array($dump) || ! isset($dump['tables'])) {
            $this->error('That is not a db:dump file.');

            return self::FAILURE;
        }
        $this->line(sprintf('Dump from %s (%s): %d tables, %d rows', $dump['dumped_at'] ?? '?', $dump['connection'] ?? '?', count($dump['tables']), array_sum(array_map('count', $dump['tables']))));
        if (! $this->option('force') && ! $this->confirm('Empty and refill these tables on '.config('database.default').'?')) {
            return self::FAILURE;
        }
        $tables = array_filter(array_keys($dump['tables']), function ($table) {
            if (Schema::hasTable($table)) { return true; }
            $this->warn("skipping $table: no such table");

            return false;
        });
        // parents before children (users, then heroes, then everything that points at them), emptied in
        // reverse and refilled in order, so the restore holds up even where foreign keys stay enforced
        $order = array_values(array_unique(array_merge(array_intersect(['users', 'characters'], $tables), $tables)));
        Schema::disableForeignKeyConstraints();
        try {
            DB::transaction(function () use ($dump, $order) {
                foreach (array_reverse($order) as $table) { DB::table($table)->delete(); }
                foreach ($order as $table) {
                    foreach (array_chunk($dump['tables'][$table], 200) as $chunk) { DB::table($table)->insert($chunk); }
                }
            });
        } finally {
            Schema::enableForeignKeyConstraints();
        }
        $this->info('Restored.');

        return self::SUCCESS;
    }
}
