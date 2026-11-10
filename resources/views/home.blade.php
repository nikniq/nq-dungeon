@extends('layouts.app')
@section('title', 'Dungeon Affair — a free browser roguelike')
@section('body-class', 'landing')
@section('head')
  <meta property="og:title" content="Dungeon Affair — a free browser roguelike">
  <meta property="og:description" content="Towns, castles, ports and the open sea above; under every town a dungeon that only ends when you do. Turn-based, free, no download.">
  <meta property="og:image" content="{{ asset('images/home/og.png') }}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
@endsection
@section('content')
<section class="splash">
  <div class="splash-copy">
    <p class="eyebrow">Free · turn-based · plays in your browser</p>
    <h2>Go down for the gold.<br>Come back a legend.</h2>
    <p class="lead">A roguelike with a whole kingdom on top of it. Walk the roads between market towns, climb castles,
      sail from the ports, and take the green gate at the bottom of any square down into the dark. Monsters sleep until
      they hear you. Every step is a turn, so the next move is always yours.</p>
    <div class="cta">
      <a href="{{ route('game') }}" class="primary big">Play free now</a>
      @guest
        <a href="{{ route('register') }}" class="secondary big">Create a hero</a>
      @else
        <a href="{{ route('character.edit') }}" class="secondary big">Your hero</a>
      @endguest
    </div>
    <p class="muted small fine">No download, no sign-up to play. Keyboard, mouse or touch. A hero saves your run so you can carry on from any device.</p>
    <ul class="facts">
      <li><b>3</b> classes</li>
      <li><b>7</b> realms</li>
      <li><b>27</b> kinds of monster</li>
      <li><b>24</b> arms and armours</li>
      <li><b>∞</b> floors</li>
    </ul>
  </div>
  <a href="{{ route('game') }}" class="splash-art" aria-label="Play Dungeon Affair">
    <video class="shot main" autoplay muted loop playsinline preload="metadata" poster="{{ asset('images/home/play-poster.jpg') }}" width="668" height="494" aria-label="Fourteen seconds of play: a warrior fights a goblin and a skeleton, picks up gold, levels up and opens a chest that bites">
      <source src="{{ asset('images/home/play.mp4') }}" type="video/mp4">
      <source src="{{ asset('images/home/play.webm') }}" type="video/webm">
      <img src="{{ asset('images/home/dungeon.webp') }}" alt="A torchlit dungeon room: the hero faces a goblin and a skeleton among piles of gold" width="700" height="400">
    </video>
    <span class="live">Real play, not a trailer</span>
    <img class="shot inset" src="{{ asset('images/home/port.webp') }}" alt="A port town by the sea, with a pier and a signposted dungeon on the shore" width="788" height="591">
    <img class="peek" src="{{ asset('images/home/goblin.png') }}" alt="" width="144" height="144">
  </a>
</section>

<section class="bestiary" aria-labelledby="bestiary-h">
  <div class="section-head">
    <h2 id="bestiary-h">What waits below</h2>
    <p class="muted">Rats on the first floor. Then it gets worse.</p>
  </div>
  <ul class="strip">
    @foreach ([['rat', 'Rat'], ['goblin', 'Goblin'], ['spider', 'Spider'], ['bat', 'Bat'], ['skeleton', 'Skeleton'], ['archer', 'Archer'], ['orc', 'Orc'], ['slime', 'Slime'], ['wraith', 'Wraith'], ['mimic', 'Mimic'], ['necromancer', 'Necromancer'], ['zombie', 'Zombie'], ['troll', 'Troll'], ['ent', 'Ent'], ['darkknight', 'Dark knight'], ['basilisk', 'Basilisk'], ['giant', 'Hill giant'], ['wyrm', 'Wyrm'], ['dragon', 'Dragon'], ['kraken', 'Kraken']] as [$file, $name])
      <li><img src="{{ asset('images/home/' . $file . '.png') }}" alt="" width="144" height="144" loading="lazy"><span>{{ $name }}</span></li>
    @endforeach
  </ul>
</section>

<section class="classes-pick" aria-labelledby="classes-h">
  <div class="section-head">
    <h2 id="classes-h">Choose your hero</h2>
    <p class="muted">Three ways down. Each learns new tricks at levels 5, 10, 15, 20 and 30, and picks a perk every level.</p>
  </div>
  <div class="class-cards">
    <article>
      <img src="{{ asset('images/home/hero-warrior.png') }}" alt="The warrior in chain mail with a sword" width="224" height="224" loading="lazy">
      <h3>Warrior</h3>
      <p class="stat">24 HP · 3 attack</p>
      <p>Stands in the doorway and holds it. Shield Wall from the start, then Whirlwind to hit everything beside you and a War Cry that stuns the room.</p>
      <a class="play-as" href="{{ route('game') }}?class=warrior">Play as the warrior →</a>
    </article>
    <article>
      <img src="{{ asset('images/home/hero-ranger.png') }}" alt="The ranger in leather with a bow" width="224" height="224" loading="lazy">
      <h3>Ranger</h3>
      <p class="stat">18 HP · 3 attack</p>
      <p>Shoots first. Arrow from the start, Volley for the three nearest foes, Evade to slip away, and an eye that spots traps two tiles out.</p>
      <a class="play-as" href="{{ route('game') }}?class=ranger">Play as the ranger →</a>
    </article>
    <article>
      <img src="{{ asset('images/home/hero-mage.png') }}" alt="The mage in a purple robe with a staff" width="224" height="224" loading="lazy">
      <h3>Mage</h3>
      <p class="stat">16 HP · 2 attack · most mana</p>
      <p>Fragile and furious. Fireball from the start, Frost Nova to freeze the pack, then Blink out of the corner they thought they had you in.</p>
      <a class="play-as" href="{{ route('game') }}?class=mage">Play as the mage →</a>
    </article>
  </div>
</section>

<section class="run" aria-labelledby="run-h">
  <div class="section-head">
    <h2 id="run-h">How a run goes</h2>
  </div>
  <ol class="steps">
    <li>
      <img src="{{ asset('images/home/town.webp') }}" alt="The square of Hearth: a fountain, market stalls, townsfolk and shops" width="788" height="591" loading="lazy">
      <h3><span>1</span>Wake in Hearth</h3>
      <p>Buy a potion, talk to the people, read the notice board. The green gate at the bottom of the square leads down.</p>
    </li>
    <li>
      <img src="{{ asset('images/home/deep.webp') }}" alt="A deeper floor: a wraith and skeletons in a brown-stone hall" width="788" height="591" loading="lazy">
      <h3><span>2</span>Follow the compass down</h3>
      <p>Floors fork, flood, burn and curse. Sneak past sleepers or take them in their sleep, loot the chests, find the stairs. Five floors and a boss under Hearth, and caves, crypts, warrens and towers across the land after that.</p>
    </li>
    <li>
      <img src="{{ asset('images/home/castle.webp') }}" alt="The great square of Castle Aurum, paved in gold stone" width="788" height="591" loading="lazy">
      <h3><span>3</span>Come back richer</h3>
      <p>Sell the loot, buy better steel, take the road to the next town or the King's castle. Death costs you gold and potions, never your level or your gear.</p>
    </li>
  </ol>
</section>

<section class="beyond" aria-labelledby="beyond-h">
  <div class="section-head">
    <h2 id="beyond-h">And beyond the stairs</h2>
    <p class="muted">The dungeon is where it starts. The world is why you stay.</p>
  </div>
  <div class="gallery">
    <figure>
      <img src="{{ asset('images/home/port.webp') }}" alt="A port with a pier and ship, and two signposted dungeons on the shore" width="788" height="591" loading="lazy">
      <figcaption><b>An open world.</b> Four realms and an endless map of towns, castles, caves, crypts and towers, each with a danger rating. Buy passage at a port, or a ship of your own, and follow treasure charts to islands.</figcaption>
    </figure>
    <figure>
      <img src="{{ asset('images/home/story.webp') }}" alt="A story scene: King Aldric tells of the Age of the Crown" width="840" height="420" loading="lazy">
      <figcaption><b>A story to uncover.</b> Kings, councils, chieftains and merchant houses, a broken crown, and a far shore behind a veil of storms. Told by the people you meet, at your pace.</figcaption>
    </figure>
    <figure>
      <img src="{{ asset('images/home/night.webp') }}" alt="Hearth at night, lamps lit around the square" width="788" height="591" loading="lazy">
      <figcaption><b>A living land.</b> Day turns to night and the lamps come on, pets follow at heel, and you can fell forests, lay roads and bridge rivers to shape the country yourself.</figcaption>
    </figure>
    <figure class="facts-card">
      <ul>
        <li><img src="{{ asset('images/home/chest.png') }}" alt="" width="144" height="144" loading="lazy"> Every weapon has a trait: daggers triple a sneak attack, maces stun, warhammers knock foes into walls, the greatsword cleaves.</li>
        <li><img src="{{ asset('images/home/potion.png') }}" alt="" width="144" height="144" loading="lazy"> Potions, mana, perks and a skill tree: every level is a choice.</li>
        <li><img src="{{ asset('images/home/gold.png') }}" alt="" width="144" height="144" loading="lazy"> A daily delve the same for everyone, and a hall of heroes to climb.</li>
        <li><img src="{{ asset('images/home/stairs.png') }}" alt="" width="144" height="144" loading="lazy"> <span>Auto-explore on <kbd>Z</kbd> when you want to move fast, turn-by-turn when you do not.</span></li>
      </ul>
    </figure>
  </div>
</section>

<section class="board" aria-labelledby="heroes-h">
  <div class="board-head">
    <h2 id="heroes-h">Hall of heroes</h2>
    <a href="{{ route('heroes.index') }}" class="muted">All {{ $heroCount }} {{ \Illuminate\Support\Str::plural('hero', $heroCount) }} →</a>
  </div>
  @if ($leaders->isEmpty())
    <p class="muted">No heroes yet. <a href="{{ route('register') }}">Be the first.</a></p>
  @else
    <table class="ranks">
      <thead><tr><th>#</th><th>Hero</th><th>Escapes</th><th>Deepest</th><th>Most gold</th><th>Kills</th><th>Level</th></tr></thead>
      <tbody>
      @foreach ($leaders as $i => $h)
        <tr>
          <td>{{ $i + 1 }}</td>
          <td><a href="{{ route('heroes.show', $h) }}">{{ $h->name }}</a>@if ($h->title) <span class="muted small">{{ $h->title }}</span>@endif</td>
          <td>{{ $h->wins }}</td><td>{{ $h->best_floor ?: '—' }}</td><td>{{ $h->best_gold }}</td><td>{{ $h->kills }}</td><td>{{ $h->level }}</td>
        </tr>
      @endforeach
      </tbody>
    </table>
  @endif
</section>

<section class="news-home">
  <div class="board-head">
    <h2>Latest news</h2>
    <a href="{{ route('news.index') }}" class="muted">All news →</a>
  </div>
  <div class="features">
    @foreach (array_slice(config('news.articles'), 0, 3) as $article)
      <div><h3><a href="{{ route('news.show', $article['slug']) }}" class="plain">{{ $article['title'] }}</a></h3><p>{{ $article['summary'] }}</p><p class="muted small">{{ \Illuminate\Support\Carbon::parse($article['date'])->format('j F Y') }} · <a href="{{ route('news.show', $article['slug']) }}">Read →</a></p></div>
    @endforeach
  </div>
</section>

<section class="howto">
  <h2>Controls</h2>
  <ul>
    <li>Move with the arrow keys, WASD or HJKL, or tap the on-screen pad. Space waits a turn. Click a tile to walk there.</li>
    <li>Walk into a monster to attack it. Right-click to aim your class ability. Hover or tap anything to see what it is.</li>
    <li><kbd>P</kbd> drinks a potion, <kbd>Z</kbd> explores the floor for you, <kbd>M</kbd> opens the map. Armour counts only once it is worn.</li>
    <li>Townsfolk only talk when you walk into them. To strike one, hold <kbd>Ctrl</kbd> and press a direction (or <kbd>X</kbd>, then a direction); on a phone, tap <strong>✊ Strike</strong> beside them. The town's watch will come for you until you leave.</li>
    <li>Find the stairs on each floor. Clear floor five and the town welcomes you back with everything you carried out.</li>
  </ul>
</section>

<section class="faq" aria-labelledby="faq-h">
  <div class="section-head"><h2 id="faq-h">Before you go down</h2></div>
  <div class="faq-grid">
    <details open><summary>Is it really free?</summary><p>Yes. No price, no adverts, nothing to buy with real money. It is a hobby project that grew.</p></details>
    <details open><summary>Do I need an account?</summary><p>No. Press play and you are in Hearth as a guest. Create a hero, with an email or Google, when you want the run saved and your name in the hall of heroes.</p></details>
    <details open><summary>Does it work on a phone?</summary><p>Yes. Tap a tile to walk there, tap a monster to hit it, and use the on-screen buttons for abilities, the map and auto-explore.</p></details>
    <details open><summary>What do I lose when I die?</summary><p>Half the gold you carry and your potions. Never your level, your gear or your place in the story.</p></details>
    <details open><summary>How long is it?</summary><p>The first dungeon is an evening. The four realms, two stories, the sea and the far shore are a good many more, and the dungeons go as deep as you dare.</p></details>
    <details open><summary>Is it still being made?</summary><p>Yes, most days. The <a href="{{ route('news.index') }}">news</a> says what changed.</p></details>
  </div>
</section>

<section class="last-call">
  <div>
    <h2>The gate is at the bottom of the square.</h2>
    <p>Ten seconds from here to your first goblin.</p>
    <a href="{{ route('game') }}" class="primary big">Play free now</a>
  </div>
</section>
<a href="{{ route('game') }}" class="sticky-play primary" id="sticky-play" hidden>Play free now</a>
@endsection
@section('scripts')
<script>
  // on a phone the play button follows once the first one has scrolled away
  (() => {
    const bar = document.getElementById('sticky-play'), first = document.querySelector('.splash .cta'), last = document.querySelector('.last-call');
    const v = document.querySelector('.splash video'); if (v && matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; }
    if (!bar || !first || !('IntersectionObserver' in window)) return;
    const seen = new Set();
    const io = new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); bar.hidden = seen.size > 0; });
    io.observe(first); io.observe(last);
  })();
</script>
@endsection
