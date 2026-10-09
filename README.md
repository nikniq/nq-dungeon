# Dungeon Adventure

A small browser-based dungeon game, served by Laravel. The web root is `public_html/`
(point your web server's document root there).

Controls:
- Move / attack: Arrow keys, WASD or HJKL (or the on-screen D-pad)
- Wait a turn: Space or `.`
- Restart: Click Restart or press `r`

Clear all 5 floors: find the green exit on each one. Monsters sleep until they
notice you and then chase. Kill them for XP to level up, grab gold and potions.

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
