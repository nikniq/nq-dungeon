<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * Reads the tail of the Laravel log (storage/logs/laravel*.log, newest file first)
 * and splits it into entries: "[2026-11-20 10:00:00] production.ERROR: message ...".
 * Only the last $maxBytes are read, so a huge log never slows the admin down.
 */
class LogReader
{
    public const LEVELS = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG'];

    public function __construct(private int $maxBytes = 1_000_000) {}

    /** @return list<string> log files, newest first */
    public function files(): array
    {
        $files = glob(storage_path('logs/*.log')) ?: [];
        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));

        return $files;
    }

    /** @return list<array{at: string, env: string, level: string, message: string, detail: string}> newest first */
    public function entries(?string $file = null, ?string $level = null, string $search = '', int $limit = 200): array
    {
        $file ??= $this->files()[0] ?? null;
        if (! $file || ! is_readable($file)) {
            return [];
        }
        $size = filesize($file);
        $fh = fopen($file, 'rb');
        if ($size > $this->maxBytes) {
            fseek($fh, $size - $this->maxBytes);
            fgets($fh);   // drop the partial first line
        }
        $text = (string) stream_get_contents($fh);
        fclose($fh);

        $parts = preg_split('/^(?=\[\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/m', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $out = [];
        foreach (array_reverse($parts) as $raw) {
            if (! preg_match('/^\[([^\]]+)\] (\w+)\.(\w+): (.*)$/s', $raw, $m)) {
                continue;
            }
            [$first, $rest] = array_pad(explode("\n", rtrim($m[4]), 2), 2, '');
            $entry = ['at' => $m[1], 'env' => $m[2], 'level' => strtoupper($m[3]), 'message' => mb_substr($first, 0, 1000), 'detail' => mb_substr($rest, 0, 8000)];
            if ($level && $entry['level'] !== strtoupper($level)) {
                continue;
            }
            if ($search !== '' && stripos($raw, $search) === false) {
                continue;
            }
            $out[] = $entry;
            if (count($out) >= $limit) {
                break;
            }
        }

        return $out;
    }

    /** How many entries at these levels since a time, in the newest log file. */
    public function countSince(array $levels, Carbon $since): int
    {
        $n = 0;
        foreach ($this->entries(limit: 5000) as $e) {
            try {
                if (Carbon::parse($e['at'])->lt($since)) {
                    break;
                }
            } catch (\Throwable) {
                continue;
            }
            if (in_array($e['level'], $levels, true)) {
                $n++;
            }
        }

        return $n;
    }
}
