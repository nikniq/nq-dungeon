# Dungeon Adventure

A small browser-based dungeon game, served by Laravel. The web root is `public_html/`
(point your web server's document root there).

Controls:
- Move / attack: Arrow keys, WASD or HJKL (or the on-screen D-pad)
- Wait a turn: Space or `.`
- Restart: Click Restart or press `r`

You start in the town square: a merchant, an inn that heals, and the dungeon
entrance. Clear all 5 floors to return to town with your level, gold and gear.
Death sends you back to town as a fresh hero.

In the dungeon: find the green exit on each floor. Monsters sleep until they
notice you and then chase. Kill them for XP to level up, grab gold and potions.
Each floor has a merchant (`$`) who buys and sells weapons, armor and potions;
the item catalog lives in `config/items.php`. Hover or tap anything on the map
to see what it is. Create a hero to save runs and gear between visits.

## Setup

Requires PHP 8.2 or newer (Laravel 12). Sessions and cache use the file driver, so no database is needed.

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
# open http://localhost:8000
```

Game assets live in `public_html/js/script.js` and `public_html/css/style.css`;
the page is `resources/views/game.blade.php`, routed at `/` in `routes/web.php`.
# nq-dungeon
