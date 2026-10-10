<?php

namespace App\Game;

/** Deterministic 32-bit xorshift, so a floor seed always digs the same chunk. */
final class Rng
{
    private int $s;

    public function __construct(int $seed)
    {
        $this->s = ($seed & 0xFFFFFFFF) ?: 0x9E3779B9;
    }

    public function next(): float
    {
        $x = $this->s;
        $x ^= ($x << 13) & 0xFFFFFFFF;
        $x ^= $x >> 17;
        $x ^= ($x << 5) & 0xFFFFFFFF;
        $this->s = $x & 0xFFFFFFFF;

        return $this->s / 4294967296;
    }

    public function int(int $n): int
    {
        return $n <= 0 ? 0 : (int) floor($this->next() * $n);
    }

    public function chance(float $p): bool
    {
        return $this->next() < $p;
    }
}
