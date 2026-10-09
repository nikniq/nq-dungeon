#!/usr/bin/env bash
#
# Production deploy. Run ON the server, from the app root:
#
#   ./deploy.sh              # pull + install deps if changed + migrate + caches
#   ./deploy.sh --no-pull    # same, but skip git pull (e.g. after a manual checkout)
#
# The web root is public_html/ (see bootstrap/app.php), so point the
# vhost's document root there. This script never touches .env or storage/.
#
# Its local counterpart is cx.sh, which runs this over ssh.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "✗ No .env in $(pwd). Copy .env.example, fill it in, run 'php artisan key:generate', then retry."
    exit 1
fi

if [ "${1:-}" != "--no-pull" ]; then
    echo "→ git pull"
    LOCK_BEFORE=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
    git pull --ff-only
    LOCK_AFTER=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
else
    LOCK_BEFORE=none
    LOCK_AFTER=changed
fi

# Install dependencies when the lockfile moved, or when vendor/ is missing
# entirely (first deploy). A pull that adds a package without this step
# deploys code that needs a library the server does not have.
if [ "$LOCK_BEFORE" != "$LOCK_AFTER" ] || [ ! -d vendor ]; then
    if command -v composer >/dev/null 2>&1; then
        echo "→ composer install"
        composer install --no-dev --optimize-autoloader --no-interaction
    else
        echo "⚠ composer.lock changed but composer is not on PATH."
        echo "  Install dependencies manually before trusting this deploy."
    fi
fi

echo "→ migrate"
php artisan migrate --force

echo "→ storage link"
php artisan storage:link --force >/dev/null 2>&1 || true

echo "→ cache config/routes/views"
php artisan optimize

echo "→ verify"
APP_URL=$(grep -E '^APP_URL=' .env | cut -d= -f2- | tr -d '"\r')
if [ -n "$APP_URL" ]; then
    FAILED=0
    for path in /up /; do
        STATUS=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$APP_URL$path" || echo "000")
        if [ "$STATUS" = "200" ]; then
            echo "  ✓ $APP_URL$path → 200"
        else
            echo "  ✗ $APP_URL$path → $STATUS"
            FAILED=1
        fi
    done
    if [ "$FAILED" = "1" ]; then
        echo
        echo "--- last errors in storage/logs/laravel.log ---"
        grep -E '\.(ERROR|CRITICAL|EMERGENCY):' storage/logs/laravel.log 2>/dev/null | tail -n 3 | cut -c1-400 || echo "(no log yet)"
        exit 1
    fi
fi

echo "✓ deployed $(git log --oneline -1)"
