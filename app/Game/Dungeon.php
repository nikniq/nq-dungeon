<?php

namespace App\Game;

/**
 * The authoritative co-op dungeon. One instance is the whole floor a party
 * shares: chunks dug on demand from the floor seed, monsters, items and the
 * stairs. It is stored as JSON on the party row and reloaded per request.
 *
 * Tiles are kept as a 1024-character string per chunk ('0' wall, '1' floor,
 * '2' stairs, '3' merchant) so the state stays JSON-friendly and small.
 */
class Dungeon
{
    public const CHUNK = 32;
    public const WALL = '0';
    public const FLOOR = '1';
    public const EXIT = '2';
    public const SHOP = '3';
    public const SIM_RADIUS = 28;
    public const TICK_MS = 600;
    public const FINAL_FLOOR = 5;

    public const MONSTERS = [
        ['name' => 'Rat',      'hp' => 3,  'atk' => 1, 'xp' => 2,  'minFloor' => 1],
        ['name' => 'Goblin',   'hp' => 5,  'atk' => 2, 'xp' => 4,  'minFloor' => 1],
        ['name' => 'Skeleton', 'hp' => 8,  'atk' => 3, 'xp' => 7,  'minFloor' => 2],
        ['name' => 'Orc',      'hp' => 12, 'atk' => 4, 'xp' => 12, 'minFloor' => 3],
        ['name' => 'Wraith',   'hp' => 10, 'atk' => 5, 'xp' => 16, 'minFloor' => 4],
    ];

    private const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    public array $s;

    public function __construct(?array $state, public int $floor)
    {
        $this->s = $state ?? [];
    }

    // ---------- floor lifecycle ----------

    public static function newFloor(int $floor): self
    {
        $d = new self(null, $floor);
        $d->s = [
            'seed' => random_int(1, 0x7FFFFFFF),
            'chunks' => [],
            'monsters' => [],
            'potions' => [],
            'golds' => [],
            'shops' => [],
            'nextId' => 1,
            'lastTick' => (int) (microtime(true) * 1000),
            'log' => [],
            'seq' => 0,
        ];
        $spawn = $d->chunk(0, 0);
        $d->s['spawn'] = [$spawn['rooms'][0]['cx'], $spawn['rooms'][0]['cy']];
        // the stairs: a few chunks away, in that chunk's first room
        $angle = mt_rand(0, 628) / 100;
        $far = 2 + mt_rand(0, 1);
        $ex = (int) round(cos($angle) * $far) ?: 2;
        $ey = (int) round(sin($angle) * $far);
        $target = $d->chunk($ex, $ey);
        $d->s['exit'] = [$ex * self::CHUNK + $target['rooms'][0]['cx'], $ey * self::CHUNK + $target['rooms'][0]['cy']];
        $d->setTile($d->s['exit'][0], $d->s['exit'][1], self::EXIT);
        $d->s['monsters'] = array_values(array_filter($d->s['monsters'], fn ($m) => ! ($m['x'] === $d->s['exit'][0] && $m['y'] === $d->s['exit'][1])));

        return $d;
    }

    public function spawn(): array
    {
        return $this->s['spawn'];
    }

    // ---------- tiles ----------

    public function chunk(int $cx, int $cy): array
    {
        $k = "$cx,$cy";
        if (! isset($this->s['chunks'][$k])) {
            $this->s['chunks'][$k] = $this->generateChunk($cx, $cy);
            $this->populateChunk($cx, $cy);
        }

        return $this->s['chunks'][$k];
    }

    public function tile(int $x, int $y): string
    {
        $cx = intdiv($x - (($x % self::CHUNK + self::CHUNK) % self::CHUNK), self::CHUNK);
        $cy = intdiv($y - (($y % self::CHUNK + self::CHUNK) % self::CHUNK), self::CHUNK);
        $ch = $this->chunk($cx, $cy);

        return $ch['tiles'][($y - $cy * self::CHUNK) * self::CHUNK + ($x - $cx * self::CHUNK)];
    }

    public function setTile(int $x, int $y, string $t): void
    {
        $cx = intdiv($x - (($x % self::CHUNK + self::CHUNK) % self::CHUNK), self::CHUNK);
        $cy = intdiv($y - (($y % self::CHUNK + self::CHUNK) % self::CHUNK), self::CHUNK);
        $this->chunk($cx, $cy);
        $this->s['chunks']["$cx,$cy"]['tiles'][($y - $cy * self::CHUNK) * self::CHUNK + ($x - $cx * self::CHUNK)] = $t;
    }

    public function walkable(int $x, int $y): bool
    {
        return $this->tile($x, $y) !== self::WALL;
    }

    private function generateChunk(int $cx, int $cy): array
    {
        $rng = new Rng(crc32($this->s['seed'].':'.$cx.':'.$cy));
        $n = self::CHUNK;
        $tiles = str_repeat(self::WALL, $n * $n);
        $carve = function (int $x, int $y) use (&$tiles, $n) {
            if ($x >= 0 && $y >= 0 && $x < $n && $y < $n) {
                $tiles[$y * $n + $x] = self::FLOOR;
            }
        };
        $rooms = [];
        $want = 3 + $rng->int(3);
        for ($attempt = 0; $attempt < 30 && count($rooms) < $want; $attempt++) {
            $w = 4 + $rng->int(6);
            $h = 3 + $rng->int(5);
            $x = 2 + $rng->int($n - $w - 4);
            $y = 2 + $rng->int($n - $h - 4);
            $clash = false;
            foreach ($rooms as $o) {
                if ($x < $o['x'] + $o['w'] + 1 && $x + $w + 1 > $o['x'] && $y < $o['y'] + $o['h'] + 1 && $y + $h + 1 > $o['y']) {
                    $clash = true;
                    break;
                }
            }
            if ($clash) {
                continue;
            }
            for ($yy = $y; $yy < $y + $h; $yy++) {
                for ($xx = $x; $xx < $x + $w; $xx++) {
                    $carve($xx, $yy);
                }
            }
            $rooms[] = ['x' => $x, 'y' => $y, 'w' => $w, 'h' => $h, 'cx' => $x + intdiv($w, 2), 'cy' => $y + intdiv($h, 2)];
        }
        $link = function (int $ax, int $ay, int $bx, int $by) use ($carve, $rng) {
            $x = $ax;
            $y = $ay;
            $horizontalFirst = $rng->chance(0.5);
            $digX = function () use (&$x, $y, $bx, $carve) { while ($x !== $bx) { $x += $bx <=> $x; $carve($x, $y); } };
            $digY = function () use ($x, &$y, $by, $carve) { while ($y !== $by) { $y += $by <=> $y; $carve($x, $y); } };
            if ($horizontalFirst) {
                while ($x !== $bx) { $x += $bx <=> $x; $carve($x, $y); }
                while ($y !== $by) { $y += $by <=> $y; $carve($x, $y); }
            } else {
                while ($y !== $by) { $y += $by <=> $y; $carve($x, $y); }
                while ($x !== $bx) { $x += $bx <=> $x; $carve($x, $y); }
            }
        };
        for ($i = 1; $i < count($rooms); $i++) {
            $link($rooms[$i - 1]['cx'], $rooms[$i - 1]['cy'], $rooms[$i]['cx'], $rooms[$i]['cy']);
        }
        $hub = $rooms[0];
        $mid = intdiv($n, 2);
        foreach ([[$mid, 0], [$mid, $n - 1], [0, $mid], [$n - 1, $mid]] as [$ex, $ey]) {
            $carve($ex, $ey);
            $link($ex, $ey, $hub['cx'], $hub['cy']);
        }

        return ['tiles' => $tiles, 'rooms' => $rooms];
    }

    private function populateChunk(int $cx, int $cy): void
    {
        $rng = new Rng(crc32($this->s['seed'].':pop:'.$cx.':'.$cy));
        $n = self::CHUNK;
        $ox = $cx * $n;
        $oy = $cy * $n;
        $ch = $this->s['chunks']["$cx,$cy"];
        $cells = [];
        for ($y = 0; $y < $n; $y++) {
            for ($x = 0; $x < $n; $x++) {
                if ($ch['tiles'][$y * $n + $x] === self::FLOOR) {
                    $cells[] = [$ox + $x, $oy + $y];
                }
            }
        }
        $spawnChunk = $cx === 0 && $cy === 0;
        $pool = array_values(array_filter(self::MONSTERS, fn ($t) => $t['minFloor'] <= $this->floor));
        $take = function () use (&$cells, $rng) {
            return array_splice($cells, $rng->int(count($cells)), 1)[0];
        };
        $mCount = (int) min(count($cells) / 10, 6 + $this->floor * 2 + $rng->int(4));
        for ($i = 0; $i < $mCount && $cells; $i++) {
            [$x, $y] = $take();
            if ($spawnChunk && abs($x - ($ox + $n / 2)) + abs($y - ($oy + $n / 2)) < 7) {
                continue;
            }
            $t = $rng->int(count($pool));
            $hp = $pool[$t]['hp'] + intdiv($this->floor, 2);
            $this->s['monsters'][] = ['id' => $this->s['nextId']++, 'x' => $x, 'y' => $y, 't' => $this->typeIndex($pool[$t]), 'hp' => $hp, 'maxHp' => $hp, 'awake' => false];
        }
        for ($i = 0; $i < 2 + $rng->int(3) && $cells; $i++) {
            $this->s['potions'][] = $take();
        }
        for ($i = 0; $i < 5 + $this->floor + $rng->int(4) && $cells; $i++) {
            [$x, $y] = $take();
            $this->s['golds'][] = [$x, $y, 5 + $rng->int(10) + $this->floor * 2];
        }
        if (($spawnChunk || $rng->chance(0.2)) && $ch['rooms']) {
            $room = $ch['rooms'][$spawnChunk ? 0 : $rng->int(count($ch['rooms']))];
            $sx = $ox + $room['x'] + $rng->int($room['w']);
            $sy = $oy + $room['y'] + $rng->int($room['h']);
            if (! ($spawnChunk && $sx === $ox + $room['cx'] && $sy === $oy + $room['cy'])) {
                $this->s['chunks']["$cx,$cy"]['tiles'][($sy - $oy) * $n + ($sx - $ox)] = self::SHOP;
                $this->s['shops'][] = [$sx, $sy];
            }
        }
    }

    private function typeIndex(array $type): int
    {
        foreach (self::MONSTERS as $i => $t) {
            if ($t['name'] === $type['name']) {
                return $i;
            }
        }

        return 0;
    }

    // ---------- queries ----------

    public function monsterAt(int $x, int $y): ?int
    {
        foreach ($this->s['monsters'] as $i => $m) {
            if ($m['x'] === $x && $m['y'] === $y) {
                return $i;
            }
        }

        return null;
    }

    private function bfs(int $sx, int $sy, int $limit): array
    {
        $d = ["$sx,$sy" => 0];
        $q = [[$sx, $sy]];
        while ($q) {
            [$cx, $cy] = array_shift($q);
            $dd = $d["$cx,$cy"];
            if ($dd >= $limit) {
                continue;
            }
            foreach (self::DIRS as [$dx, $dy]) {
                $nx = $cx + $dx;
                $ny = $cy + $dy;
                $k = "$nx,$ny";
                if (isset($d[$k]) || ! $this->walkable($nx, $ny)) {
                    continue;
                }
                $d[$k] = $dd + 1;
                $q[] = [$nx, $ny];
            }
        }

        return $d;
    }

    // ---------- events ----------

    public function log(string $text, string $cls = '', ?int $to = null): void
    {
        $this->s['seq']++;
        $this->s['log'][] = ['seq' => $this->s['seq'], 'text' => $text, 'cls' => $cls, 'to' => $to];
        if (count($this->s['log']) > 60) {
            array_splice($this->s['log'], 0, count($this->s['log']) - 60);
        }
    }

    public function bump(): void
    {
        $this->s['seq']++;
    }

    public function logSince(int $since, int $memberId): array
    {
        return array_values(array_filter($this->s['log'], fn ($l) => $l['seq'] > $since && ($l['to'] === null || $l['to'] === $memberId)));
    }

    // ---------- a player's turn ----------

    /**
     * Resolve one action for a member. $hero is the Character row (stats are
     * read and written on it); $pos is ['x','y'] and is updated in place.
     * Returns a list of flags for the client, e.g. ['shop'], ['stairs'], ['dead'].
     */
    public function act(array $action, \App\Models\Character $hero, array &$pos, int $memberId, array $otherPositions): array
    {
        $flags = [];
        $type = $action['type'] ?? 'wait';
        if ($type === 'move') {
            $dx = max(-1, min(1, (int) ($action['dx'] ?? 0)));
            $dy = max(-1, min(1, (int) ($action['dy'] ?? 0)));
            if ($dx !== 0 && $dy !== 0) {
                $dy = 0;
            }
            $nx = $pos['x'] + $dx;
            $ny = $pos['y'] + $dy;
            if (($dx || $dy) && $this->walkable($nx, $ny)) {
                $mi = $this->monsterAt($nx, $ny);
                if ($mi !== null) {
                    $this->playerAttack($mi, $hero, $memberId);
                } elseif (! in_array([$nx, $ny], $otherPositions, true)) {
                    $pos['x'] = $nx;
                    $pos['y'] = $ny;
                    $this->pickups($hero, $nx, $ny, $memberId);
                    $t = $this->tile($nx, $ny);
                    if ($t === self::SHOP) {
                        $flags[] = 'shop';
                    }
                    if ($t === self::EXIT) {
                        $flags[] = 'stairs';
                    }
                }
            }
        }
        $this->bump();

        return $flags;
    }

    private function pickups(\App\Models\Character $hero, int $x, int $y, int $memberId): void
    {
        foreach ($this->s['potions'] as $i => $p) {
            if ($p[0] === $x && $p[1] === $y) {
                $healed = min(5, $hero->max_hp - $hero->hp);
                $hero->hp += $healed;
                array_splice($this->s['potions'], $i, 1);
                $this->log($healed > 0 ? "You drink a potion and heal $healed HP." : 'You drink a potion but were already at full health.', 'good', $memberId);
                break;
            }
        }
        foreach ($this->s['golds'] as $i => $g) {
            if ($g[0] === $x && $g[1] === $y) {
                $hero->gold += $g[2];
                array_splice($this->s['golds'], $i, 1);
                $this->log("You pick up {$g[2]} gold.", 'good', $memberId);
                break;
            }
        }
    }

    private function playerAttack(int $mi, \App\Models\Character $hero, int $memberId): void
    {
        $m = &$this->s['monsters'][$mi];
        $type = self::MONSTERS[$m['t']];
        $weapon = $hero->weapon ? (config('items.weapons')[$hero->weapon]['atk'] ?? 0) : 0;
        $dmg = $hero->atk + $weapon + mt_rand(0, 1);
        $m['hp'] -= $dmg;
        $m['awake'] = true;
        $this->s['hits'][] = ['x' => $m['x'], 'y' => $m['y'], 'dmg' => $dmg, 'seq' => $this->s['seq'] + 1, 'who' => 'player'];
        if ($m['hp'] <= 0) {
            $this->log("{$hero->name} slays the {$type['name']}.", 'good');
            unset($m);
            array_splice($this->s['monsters'], $mi, 1);
            $hero->kills++;
            $this->gainXp($hero, $type['xp'], $memberId);
            $this->dropLoot($hero, $type['name'], $memberId);
        } else {
            $this->log("You hit the {$type['name']} for $dmg.", '', $memberId);
        }
    }

    private function gainXp(\App\Models\Character $hero, int $n, int $memberId): void
    {
        $hero->xp += $n;
        while ($hero->xp >= 10 + ($hero->level - 1) * 8) {
            $hero->xp -= 10 + ($hero->level - 1) * 8;
            $hero->level++;
            $hero->max_hp += 4;
            $hero->atk += 1;
            $hero->hp = $hero->max_hp;
            $this->log("Level up! You are now level {$hero->level}.", 'good', $memberId);
        }
    }

    private function dropLoot(\App\Models\Character $hero, string $monster, int $memberId): void
    {
        $bag = $hero->bag ?? [];
        if (mt_rand(1, 100) > 12 || count($bag) >= config('items.bag_size')) {
            return;
        }
        $pool = [];
        foreach (['weapons', 'armor', 'consumables'] as $group) {
            foreach (config("items.$group") as $id => $it) {
                if ($it['floor'] <= $this->floor) {
                    $pool[$id] = $it['name'];
                }
            }
        }
        if (! $pool) {
            return;
        }
        $id = array_rand($pool);
        $bag[] = $id;
        $hero->bag = $bag;
        $this->log("The $monster drops a {$pool[$id]}.", 'good', $memberId);
    }

    // ---------- the world's turn ----------

    /** Monsters near any member act once. $members: [memberId => ['x','y','hero' => Character]]. Returns ids of members who died. */
    public function tick(array $members): array
    {
        $this->s['lastTick'] = (int) (microtime(true) * 1000);
        if (! $members) {
            return [];
        }
        $fields = [];
        foreach ($members as $id => $m) {
            $fields[$id] = $this->bfs($m['x'], $m['y'], self::SIM_RADIUS);
        }
        $dead = [];
        foreach ($this->s['monsters'] as &$mon) {
            // nearest member by walking distance
            $bestId = null;
            $bestD = PHP_INT_MAX;
            foreach ($fields as $id => $d) {
                $dd = $d["{$mon['x']},{$mon['y']}"] ?? null;
                if ($dd !== null && $dd < $bestD) {
                    $bestD = $dd;
                    $bestId = $id;
                }
            }
            if ($bestId === null) {
                continue;
            }
            $target = $members[$bestId];
            $manhattan = abs($mon['x'] - $target['x']) + abs($mon['y'] - $target['y']);
            if (! $mon['awake'] && $manhattan <= 6 && mt_rand(1, 100) <= 70) {
                $mon['awake'] = true;
            }
            if ($manhattan === 1) {
                $hero = $target['hero'];
                $armor = $hero->armor ? (config('items.armor')[$hero->armor]['def'] ?? 0) : 0;
                $dmg = max(1, self::MONSTERS[$mon['t']]['atk'] - $armor);
                $hero->hp -= $dmg;
                $this->s['hits'][] = ['x' => $target['x'], 'y' => $target['y'], 'dmg' => $dmg, 'seq' => $this->s['seq'] + 1, 'who' => 'monster'];
                $this->log(self::MONSTERS[$mon['t']]['name']." hits you for $dmg.", 'bad', $bestId);
                if ($hero->hp <= 0 && ! in_array($bestId, $dead, true)) {
                    $dead[] = $bestId;
                }
                continue;
            }
            if (! $mon['awake']) {
                continue;
            }
            $d = $fields[$bestId];
            $best = null;
            $dirs = self::DIRS;
            shuffle($dirs);
            foreach ($dirs as [$dx, $dy]) {
                $nx = $mon['x'] + $dx;
                $ny = $mon['y'] + $dy;
                if (! $this->walkable($nx, $ny) || $this->monsterAt($nx, $ny) !== null) {
                    continue;
                }
                $occupied = false;
                foreach ($members as $mm) {
                    if ($mm['x'] === $nx && $mm['y'] === $ny) {
                        $occupied = true;
                    }
                }
                if ($occupied) {
                    continue;
                }
                $nd = $d["$nx,$ny"] ?? null;
                if ($nd !== null && $nd < $bestD) {
                    $bestD = $nd;
                    $best = [$nx, $ny];
                }
            }
            if ($best) {
                $mon['x'] = $best[0];
                $mon['y'] = $best[1];
            }
        }
        unset($mon);
        if (isset($this->s['hits']) && count($this->s['hits']) > 40) {
            array_splice($this->s['hits'], 0, count($this->s['hits']) - 40);
        }
        $this->bump();

        return $dead;
    }

    public function tickDue(): bool
    {
        return (int) (microtime(true) * 1000) - $this->s['lastTick'] >= self::TICK_MS;
    }

    // ---------- snapshots for the client ----------

    public function snapshot(int $x, int $y, int $radius, array $wantChunks, int $since, int $memberId): array
    {
        $near = fn ($px, $py) => abs($px - $x) <= $radius && abs($py - $y) <= $radius;
        $chunks = [];
        foreach ($wantChunks as $k) {
            if (preg_match('/^-?\d+,-?\d+$/', $k)) {
                [$cx, $cy] = array_map('intval', explode(',', $k));
                if (abs($cx * self::CHUNK - $x) <= 160 && abs($cy * self::CHUNK - $y) <= 160) {
                    $chunks[$k] = $this->chunk($cx, $cy)['tiles'];
                }
            }
        }

        return [
            'seq' => $this->s['seq'],
            'floor' => $this->floor,
            'exit' => $this->s['exit'],
            'monsters' => array_values(array_map(
                fn ($m) => [$m['id'], $m['x'], $m['y'], $m['t'], $m['hp'], $m['maxHp'], $m['awake'] ? 1 : 0],
                array_filter($this->s['monsters'], fn ($m) => $near($m['x'], $m['y']))
            )),
            'potions' => array_values(array_filter($this->s['potions'], fn ($p) => $near($p[0], $p[1]))),
            'golds' => array_values(array_filter($this->s['golds'], fn ($g) => $near($g[0], $g[1]))),
            'shops' => array_values(array_filter($this->s['shops'], fn ($s) => $near($s[0], $s[1]))),
            'chunks' => $chunks,
            'log' => $this->logSince($since, $memberId),
            'hits' => array_values(array_filter($this->s['hits'] ?? [], fn ($h) => $h['seq'] > $since && $near($h['x'], $h['y']))),
        ];
    }
}
