<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The relay for multiplayer. Clients post where they are and what they did;
 * the server answers with who else is in the same space and what they said
 * or did. All game rules stay in the browser: in a shared dungeon the hero
 * who has been there longest runs the monsters and posts a snapshot that the
 * others follow. Works over plain HTTP polling, so it runs on shared hosting.
 */
class MultiplayerController extends Controller
{
    public const MAX_PARTY = 4;
    private const ONLINE_MS = 8000;
    private const EVENT_TTL_MS = 120000;
    private const WORLD_RANGE_X = 90;
    private const WORLD_RANGE_Y = 60;
    private const EVENT_TYPES = ['chat', 'wave', 'hit', 'killed', 'attack', 'stairs', 'floor', 'escape'];

    private static function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    private function partyOf(int $userId): ?object
    {
        return DB::table('mp_party_members')->join('mp_parties', 'mp_parties.id', '=', 'mp_party_members.party_id')
            ->where('mp_party_members.user_id', $userId)->select('mp_parties.*')->first();
    }

    private function partySummary(?object $party, int $now): ?array
    {
        if (! $party) {
            return null;
        }
        $members = DB::table('mp_party_members as pm')
            ->join('users as u', 'u.id', '=', 'pm.user_id')
            ->leftJoin('characters as c', 'c.user_id', '=', 'pm.user_id')
            ->leftJoin('mp_presence as p', 'p.user_id', '=', 'pm.user_id')
            ->where('pm.party_id', $party->id)->orderBy('pm.id')
            ->get(['pm.user_id', 'u.name as uname', 'c.name as cname', 'c.level', 'c.class', 'p.space', 'p.data', 'p.updated_ms']);

        return [
            'id' => $party->id,
            'leader' => $party->leader_id,
            'members' => $members->map(fn ($m) => [
                'id' => $m->user_id,
                'name' => $m->cname ?? $m->uname,
                'level' => $m->level ?? 1,
                'cls' => $m->class ?? 'warrior',
                'online' => $m->updated_ms && $m->updated_ms >= $now - self::ONLINE_MS,
                'space' => $m->space,
                'where' => $m->data ? (json_decode($m->data, true)['where'] ?? null) : null,
            ])->values(),
        ];
    }

    private function sendEvent(?string $space, int $from, ?int $to, string $type, array $payload, int $now): void
    {
        DB::table('mp_events')->insert([
            'space' => $space, 'from_user' => $from, 'to_user' => $to, 'type' => $type,
            'payload' => json_encode($payload), 'created_ms' => $now,
        ]);
    }

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'space' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9:,_\-]+$/'],
            'x' => ['required', 'integer', 'between:-1000000,1000000'],
            'y' => ['required', 'integer', 'between:-1000000,1000000'],
            'me' => ['nullable', 'array'],
            'state' => ['nullable', 'array'],
            'events' => ['nullable', 'array', 'max:40'],
            'events.*.type' => ['required', Rule::in(self::EVENT_TYPES)],
            'events.*.to' => ['nullable', 'integer'],
            'events.*.payload' => ['nullable', 'array'],
            'since' => ['nullable', 'integer', 'min:0'],
        ]);
        $user = $request->user();
        $hero = $user->character;
        $now = self::nowMs();

        // Only a whitelist of display fields is stored; the name always comes from the server.
        $me = collect($data['me'] ?? [])->only(['face', 'hp', 'maxHp', 'level', 'cls', 'def', 'shield', 'floor', 'scene', 'where', 'hound', 'title', 'moving'])->all();
        $me['name'] = $hero?->name ?? $user->name;
        $me['level'] = $hero?->level ?? ($me['level'] ?? 1);
        $state = isset($data['state']) ? json_encode($data['state']) : null;
        if ($state !== null && strlen($state) > 120000) {
            $state = null;
        }

        $prev = DB::table('mp_presence')->where('user_id', $user->id)->first();
        $entered = ($prev && $prev->space === $data['space']) ? $prev->entered_ms : $now;
        DB::table('mp_presence')->updateOrInsert(['user_id' => $user->id], [
            'space' => $data['space'], 'x' => $data['x'], 'y' => $data['y'], 'data' => json_encode($me),
            'state' => $state, 'entered_ms' => $entered, 'updated_ms' => $now,
        ]);

        foreach (array_slice($data['events'] ?? [], 0, 40) as $ev) {
            $payload = $ev['payload'] ?? [];
            if ($ev['type'] === 'chat') {
                $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string) ($payload['text'] ?? ''))) ?? '');
                if ($text === '') {
                    continue;
                }
                $payload = ['text' => mb_substr($text, 0, 140)];
            }
            $payload['name'] = $me['name'];
            $this->sendEvent($data['space'], $user->id, $ev['to'] ?? null, $ev['type'], $payload, $now);
        }

        $others = DB::table('mp_presence')->where('space', $data['space'])->where('user_id', '!=', $user->id)
            ->where('updated_ms', '>=', $now - self::ONLINE_MS);
        if ($data['space'] === 'world') {
            $others->whereBetween('x', [$data['x'] - self::WORLD_RANGE_X, $data['x'] + self::WORLD_RANGE_X])
                ->whereBetween('y', [$data['y'] - self::WORLD_RANGE_Y, $data['y'] + self::WORLD_RANGE_Y]);
        }
        $shared = str_starts_with($data['space'], 'dng:');
        $players = $others->orderBy('entered_ms')->limit(40)->get()->map(fn ($p) => [
            'id' => $p->user_id, 'x' => $p->x, 'y' => $p->y, 'data' => json_decode($p->data ?? '{}', true),
            'entered' => $p->entered_ms, 'age' => $now - $p->updated_ms,
            'state' => $shared && $p->state ? json_decode($p->state, true) : null,
        ])->values();

        // No cursor yet means a fresh page: start from now rather than replaying old chatter.
        $since = array_key_exists('since', $data) && $data['since'] !== null ? (int) $data['since'] : null;
        $cursor = (int) DB::table('mp_events')->max('id');
        $events = [];
        if ($since !== null) {
            $events = DB::table('mp_events')->where('id', '>', $since)->where('from_user', '!=', $user->id)
                ->where('created_ms', '>=', $now - self::EVENT_TTL_MS)
                ->where(function ($q) use ($user, $data) {
                    $q->where('to_user', $user->id)->orWhere(fn ($w) => $w->whereNull('to_user')->where('space', $data['space']));
                })
                ->orderBy('id')->limit(300)->get()
                ->map(fn ($e) => ['id' => $e->id, 'from' => $e->from_user, 'type' => $e->type, 'payload' => json_decode($e->payload ?? '{}', true)])->values();
        }

        if (random_int(1, 50) === 1) {
            DB::table('mp_events')->where('created_ms', '<', $now - self::EVENT_TTL_MS)->delete();
            DB::table('mp_presence')->where('updated_ms', '<', $now - 600000)->delete();
        }

        return response()->json([
            'now' => $now, 'cursor' => $cursor, 'me' => $user->id, 'entered' => $entered,
            'players' => $players, 'events' => $events, 'party' => $this->partySummary($this->partyOf($user->id), $now),
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $me = $request->user();
        $now = self::nowMs();
        if ($data['user_id'] === $me->id) {
            return response()->json(['message' => 'You cannot invite yourself.'], 422);
        }
        $target = DB::table('mp_presence')->where('user_id', $data['user_id'])->where('updated_ms', '>=', $now - self::ONLINE_MS)->first();
        if (! $target) {
            return response()->json(['message' => 'That hero is no longer nearby.'], 404);
        }
        $party = $this->partyOf($me->id);
        if ($party) {
            if (DB::table('mp_party_members')->where('party_id', $party->id)->count() >= self::MAX_PARTY) {
                return response()->json(['message' => 'Your party is full.'], 422);
            }
            if (DB::table('mp_party_members')->where('party_id', $party->id)->where('user_id', $data['user_id'])->exists()) {
                return response()->json(['message' => 'They are already in your party.'], 422);
            }
        }
        $this->sendEvent(null, $me->id, $data['user_id'], 'invite', ['name' => $me->character?->name ?? $me->name], $now);

        return response()->json(['ok' => true]);
    }

    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate(['from' => ['required', 'integer']]);
        $me = $request->user();
        $now = self::nowMs();
        $invited = DB::table('mp_events')->where('type', 'invite')->where('from_user', $data['from'])->where('to_user', $me->id)
            ->where('created_ms', '>=', $now - self::EVENT_TTL_MS)->exists();
        if (! $invited) {
            return response()->json(['message' => 'That invitation has expired.'], 404);
        }
        if ($this->partyOf($me->id)) {
            $this->leaveParty($me->id, $now);
        }

        return DB::transaction(function () use ($data, $me, $now) {
            $party = $this->partyOf($data['from']);
            if (! $party) {
                $id = DB::table('mp_parties')->insertGetId(['leader_id' => $data['from'], 'created_at' => now(), 'updated_at' => now()]);
                DB::table('mp_party_members')->insert(['party_id' => $id, 'user_id' => $data['from'], 'created_at' => now(), 'updated_at' => now()]);
                $party = DB::table('mp_parties')->find($id);
            }
            if (DB::table('mp_party_members')->where('party_id', $party->id)->count() >= self::MAX_PARTY) {
                return response()->json(['message' => 'That party is full.'], 422);
            }
            DB::table('mp_party_members')->insert(['party_id' => $party->id, 'user_id' => $me->id, 'created_at' => now(), 'updated_at' => now()]);
            $this->notifyParty($party->id, $me->id, ($me->character?->name ?? $me->name).' joined the party.', $now);

            return response()->json(['party' => $this->partySummary($party, $now)]);
        });
    }

    public function leave(Request $request): JsonResponse
    {
        $this->leaveParty($request->user()->id, self::nowMs());

        return response()->json(['party' => null]);
    }

    private function leaveParty(int $userId, int $now): void
    {
        $party = $this->partyOf($userId);
        if (! $party) {
            return;
        }
        DB::table('mp_party_members')->where('user_id', $userId)->delete();
        $left = DB::table('mp_party_members')->where('party_id', $party->id)->orderBy('id')->pluck('user_id');
        if ($left->count() <= 1) {
            DB::table('mp_parties')->where('id', $party->id)->delete();   // a party of one is no party
            foreach ($left as $uid) {
                $this->sendEvent(null, $userId, $uid, 'party', ['text' => 'Your party has disbanded.'], $now);
            }

            return;
        }
        if ((int) $party->leader_id === $userId) {
            DB::table('mp_parties')->where('id', $party->id)->update(['leader_id' => $left->first()]);
        }
        $name = DB::table('characters')->where('user_id', $userId)->value('name');
        $this->notifyParty($party->id, $userId, "{$name} left the party.", $now);
    }

    private function notifyParty(int $partyId, int $from, string $text, int $now): void
    {
        foreach (DB::table('mp_party_members')->where('party_id', $partyId)->pluck('user_id') as $uid) {
            if ($uid !== $from) {
                $this->sendEvent(null, $from, $uid, 'party', ['text' => $text], $now);
            }
        }
    }

    /** Going down a gate or into a site: solo heroes get a private space; parties share one run. */
    public function enter(Request $request): JsonResponse
    {
        $data = $request->validate(['dungeon' => ['required', 'string', 'max:40', 'regex:/^[ts]:-?\d+,-?\d+$/']]);
        $me = $request->user();
        $now = self::nowMs();
        $party = $this->partyOf($me->id);
        if (! $party) {
            return response()->json(['space' => 'solo:'.$me->id, 'seed' => random_int(1, 0x7FFFFFFF), 'floor' => 1, 'shared' => false]);
        }

        return DB::transaction(function () use ($party, $data, $now) {
            $party = DB::table('mp_parties')->lockForUpdate()->find($party->id);
            $space = "dng:{$party->id}:{$party->run}";
            $someoneInside = $party->dungeon === $data['dungeon'] && DB::table('mp_presence')->where('space', $space)
                ->where('updated_ms', '>=', $now - self::ONLINE_MS)->exists();
            if (! $someoneInside) {
                DB::table('mp_parties')->where('id', $party->id)->update([
                    'dungeon' => $data['dungeon'], 'run' => $party->run + 1, 'seed' => random_int(1, 0x7FFFFFFF), 'floor' => 1, 'active_ms' => $now,
                ]);
                $party = DB::table('mp_parties')->find($party->id);
                $space = "dng:{$party->id}:{$party->run}";
            }

            return response()->json(['space' => $space, 'seed' => (int) $party->seed, 'floor' => (int) $party->floor, 'shared' => true, 'dungeon' => $party->dungeon]);
        });
    }

    /** The hero running a shared dungeon records each new floor, so late arrivals land on it. */
    public function floor(Request $request): JsonResponse
    {
        $data = $request->validate(['space' => ['required', 'string', 'max:80'], 'floor' => ['required', 'integer', 'min:0', 'max:99']]);
        $party = $this->partyOf($request->user()->id);
        if ($party && $data['space'] === "dng:{$party->id}:{$party->run}") {
            DB::table('mp_parties')->where('id', $party->id)->update(['floor' => $data['floor'], 'active_ms' => self::nowMs()]);
        }

        return response()->json(['ok' => true]);
    }
}
