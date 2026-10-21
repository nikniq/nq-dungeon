#!/bin/bash
#================================================================
# LOCAL command-line assistant — cx.sh
#
#   ./cx.sh            # interactive menu
#   ./cx.sh 20         # run an option directly
#   ./cx.sh 33 "route:list"   # …with a second parameter
#
# ⚠ Runs on your LOCAL machine only — never copy this to the server.
#   Its counterpart on the server is deploy.sh (pull + migrate + caches).
#
# No settings file needed: the defaults below name the server by its ssh
# alias (`nq`, from ~/.ssh/config, so no host or account lives in the repo)
# and the app by its domain. Override any of them in the environment, e.g.
#   CX_REMOTE=other-alias ./cx.sh 20
# or in an optional vars.sh next to this script (gitignored).
#
# How it is wired: cx.sh never talks to the database itself. Every option
# is a wrapper around `php artisan` run on the server from the app root,
# and database work goes through `php artisan tinker --execute='…'` or the
# app's own commands (db:dump, db:restore, admin:grant), using the app's
# Eloquent models and the DB facade. The connection is therefore whatever
# the app is configured with (the DB_* values in .env on the server, read
# through config/database.php): the same credentials the website uses, no
# separate login and no mysql client.
#================================================================
clear

REMOTE="${CX_REMOTE:-nq}"                                  # ssh alias or user@host
PROJECT="${CX_PROJECT:-dungeon.nikniq.com}"                # site name, in banners and paths
REMOTE_APP="${CX_REMOTE_APP:-www/$PROJECT}"                # app root on the server, relative to ~
APP_URL="${CX_APP_URL:-https://$PROJECT}"                  # what the health check hits
APP_SSH="${CX_SSH:-ssh}"                                   # add flags here once, e.g. "ssh -i key"
APP_SCP="${CX_SCP:-scp}"
LOG_OUTPUT="${CX_LOG_OUTPUT:-./log/remote.out}"
BACKUP_DIR="${CX_BACKUP_DIR:-./backup}"                    # where option 91 downloads archives to
[ -f ./vars.sh ] && source ./vars.sh                      # optional local overrides

# Where are we? In the app root on the server (production .env beside artisan)
# every option runs its command right here; anywhere else it runs over ssh.
if [ -f ./artisan ] && [ -f ./.env ] && grep -q '^APP_ENV=production' ./.env 2>/dev/null; then ON_SERVER=1; else ON_SERVER=0; fi


#---------------------------------------------------------------
# Helpers
#---------------------------------------------------------------
log_history() {
  mkdir -p ./log
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" >> ./log/history.log
}

# Run a command on the server, in the app directory: over ssh from a
# workstation, or right here when cx.sh itself is running on the server.
remote() {
  if [ "$ON_SERVER" = 1 ]; then eval "$*"; else $APP_SSH "$REMOTE" "cd ~/$REMOTE_APP && $*"; fi
}

# Same, with a terminal attached — for anything interactive or long-running.
remote_tty() {
  if [ "$ON_SERVER" = 1 ]; then eval "$*"; else $APP_SSH -t "$REMOTE" "cd ~/$REMOTE_APP && $*"; fi
}

# Copy a file from the server to a local path (a plain copy when already there).
fetch() {
  if [ "$ON_SERVER" = 1 ]; then cp "$1" "$2"; else $APP_SCP "$REMOTE:$1" "$2"; fi
}

need_param() {
  if [ -z "$PARAM2" ]; then
    read -r -p "$1: " PARAM2
  fi
}

banner() {
  echo ===========================================================
  echo "$1"
  echo ===========================================================
}

# Gate for anything that takes the site down or is hard to undo.
confirm() {
  echo "⚠ $1"
  read -r -p "Type 'yes' to continue: " reply
  [ "$reply" = "yes" ] || { echo "Skipped $SELECTION."; exit 0; }
}

echo =============================================================
if [ "$ON_SERVER" = 1 ]; then echo "Hi $USER@$HOSTNAME — on the server, acting on $PROJECT here in $(pwd)"; else echo "Hi $USER@$HOSTNAME — acting on $PROJECT over ssh ($REMOTE)"; fi
echo What do you want to do?
echo -------------------------------------------------------------
echo "ROUTINE — day to day"
echo "20 : DEPLOY: pull + deps + migrate + caches + verify on $PROJECT"
echo "21 : FIRST DEPLOY: clone the repo onto the server and set up .env"
echo "22 : WHAT'S LIVE: compare the server's HEAD with local"
echo "23 : MIGRATIONS: status (what is pending on the server)"
echo "24 : CACHES: refresh config/routes/views"
echo "25 : CACHES: clear everything (when a cached value looks stale)"
echo "26 : COMPOSER: install production dependencies"
echo ----------------------------------------------
echo DIAGNOSE
echo "30 : HEALTH: $APP_URL — page and /up"
echo "31 : LOGS: tail the Laravel log"
echo "32 : LOGS: last errors"
echo "33 : ARTISAN: run a command (e.g. 'route:list')"
echo "34 : CONFIG: key settings on the server (no secrets)"
echo "35 : DISK: what is using space"
echo "36 : PHP: version and loaded extensions"
echo ----------------------------------------------
echo "ADMIN & OPERATIONS — players and the shared world"
echo "40 : ADMIN: grant the admin flag to a user (email)"
echo "41 : ADMIN: revoke the admin flag (email)"
echo "42 : ADMIN: list admins, and open $APP_URL/admin"
echo "43 : PLAYERS: numbers (users, heroes, active, gold, structures, posts)"
echo "44 : PLAYERS: find a hero or user (name or email)"
echo "45 : SAVES: rejected saves in the log (422s: a cap or a bad field)"
echo "46 : HERO: rescue a stuck hero back to town at full health (hero name)"
echo "47 : WORLD: latest sponsored structures, monuments and story posts"
echo "48 : WORLD: remove a sponsored structure by id  [changes the shared world]"
echo ----------------------------------------------
echo MAINTENANCE
echo "70 : ENV: edit .env on the server"
echo "71 : PERMISSIONS: fix storage/ and bootstrap/cache"
echo "72 : MAINTENANCE MODE: on  [site goes down]"
echo "73 : MAINTENANCE MODE: off"
echo "74 : LOGS: truncate the Laravel log  [discards log history]"
echo ----------------------------------------------
echo ACCESS
echo "00 : CONNECT: ssh to $REMOTE"
echo "01 : SSH KEY: copy your public key to the server"
echo "05 : MONITOR: remote top"
echo "91 : BACKUP: download the database (via db:dump) and storage/ to $BACKUP_DIR"
echo "92 : BACKUPS: list what has been downloaded"
echo "qq : Exit [Quit]"
echo Enter [Selection] to continue
echo =============================================================

if [ -n "$1" ]; then
  SELECTION=$1
else
  read -n 2 SELECTION
fi
PARAM2="${2:-}"
echo
echo "Your selection is : $SELECTION."

case "$SELECTION" in

  #-------------------------------------------------------------
  # ROUTINE
  #-------------------------------------------------------------

  "20" )
  banner "DEPLOY: $PROJECT"
  # The server deploys by pulling from git, so anything not pushed is not
  # deployed. Without this check the deploy "succeeds" on the previous commit.
  if [ "$ON_SERVER" = 0 ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠ Uncommitted local changes — these will NOT deploy:"
    git status --short
    echo
  fi
  UNPUSHED=$([ "$ON_SERVER" = 0 ] && git log --oneline @{u}.. 2>/dev/null)
  if [ -n "$UNPUSHED" ]; then
    echo "⚠ Commits not pushed — these will NOT deploy:"
    echo "$UNPUSHED"
    echo
    confirm "Deploy anyway?"
  fi
  [ "$ON_SERVER" = 0 ] && echo "Local HEAD : $(git log --oneline -1)" && echo
  remote_tty "./deploy.sh"
  log_history "Deployed $PROJECT"
  ;;


  "21" )
  banner "FIRST DEPLOY: clone onto $REMOTE:~/$REMOTE_APP"
  [ "$ON_SERVER" = 1 ] && { echo "Already on the server, in a checkout. Use option 20."; exit 0; }
  REPO_URL=$(git remote get-url origin)
  echo "Repo   : $REPO_URL"
  echo "Target : ~/$REMOTE_APP (public_html/ inside it is the document root)"
  confirm "Clone there and create .env from .env.example?"
  $APP_SSH "$REMOTE" "if [ -e ~/$REMOTE_APP/.git ]; then echo 'Already a git checkout — use option 20.'; exit 1; fi
    mkdir -p ~/$(dirname "$REMOTE_APP") && git clone $REPO_URL ~/$REMOTE_APP && cd ~/$REMOTE_APP &&
    cp -n .env.example .env && chmod +x deploy.sh &&
    composer install --no-dev --optimize-autoloader --no-interaction &&
    php artisan key:generate --force &&
    sed -i 's#^APP_ENV=.*#APP_ENV=production#; s#^APP_DEBUG=.*#APP_DEBUG=false#; s#^APP_URL=.*#APP_URL=$APP_URL#' .env &&
    touch database/database.sqlite && php artisan migrate --force && php artisan optimize &&
    echo && echo '✓ cloned. Now point the vhost document root at ~/$REMOTE_APP/public_html and review .env (option 70).'"
  log_history "First deploy of $PROJECT"
  ;;


  "22" )
  banner "WHAT'S LIVE on $PROJECT"
  [ "$ON_SERVER" = 1 ] && { git log --oneline -3 && git status --short; exit 0; }
  echo "--- server ---"
  remote "git log --oneline -3 && git status --short"
  echo
  echo "--- local ---"
  git log --oneline -3
  echo
  LOCAL_HEAD=$(git rev-parse HEAD 2>/dev/null)
  SERVER_HEAD=$(remote "git rev-parse HEAD" 2>/dev/null | tr -d '\r')
  if [ "$LOCAL_HEAD" = "$SERVER_HEAD" ]; then
    echo "✓ server matches local HEAD"
  else
    echo "✗ server is NOT on your local HEAD"
    echo "  local : $LOCAL_HEAD"
    echo "  server: $SERVER_HEAD"
  fi
  ;;


  "23" )
  banner "MIGRATIONS: status on $PROJECT"
  remote "php artisan migrate:status"
  ;;


  "24" )
  banner "CACHES: refresh on $PROJECT"
  remote "php artisan optimize"
  log_history "Refreshed caches on $PROJECT"
  ;;


  "25" )
  banner "CACHES: clear everything on $PROJECT"
  # A stale config cache is why an .env change can appear to be ignored.
  # deploy.sh rebuilds the caches, so run 24 after this.
  remote "php artisan optimize:clear"
  log_history "Cleared all caches on $PROJECT"
  ;;


  "26" )
  banner "COMPOSER: install production dependencies"
  remote_tty "composer install --no-dev --optimize-autoloader --no-interaction"
  log_history "Installed composer dependencies on $PROJECT"
  ;;


  #-------------------------------------------------------------
  # DIAGNOSE
  #-------------------------------------------------------------

  "30" )
  banner "HEALTH: $APP_URL"
  # Checked from here so it exercises DNS, TLS and the web server, not just PHP.
  curl -sS -o /dev/null -w 'status   : %{http_code}\ntotal    : %{time_total}s\nttfb     : %{time_starttransfer}s\nredirect : %{redirect_url}\n' \
    --max-time 25 "$APP_URL" || echo "✗ $APP_URL did not respond"
  echo
  echo "--- /up ---"
  curl -sS -o /dev/null -w 'status   : %{http_code}\n' --max-time 25 "$APP_URL/up" || echo "✗ no response"
  echo
  echo "--- static assets ---"
  for p in /js/script.js /css/style.css /ads.txt; do
    printf '%-16s %s\n' "$p" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$APP_URL$p" || echo '000')"
  done
  ;;


  "31" )
  banner "LOGS: tail on $PROJECT (Ctrl-C to stop)"
  remote_tty "tail -n 40 -f storage/logs/laravel.log"
  ;;


  "32" )
  banner "LOGS: recent errors on $PROJECT"
  remote "grep -E '\\.(ERROR|CRITICAL|EMERGENCY):' storage/logs/laravel.log 2>/dev/null | tail -n 20 | cut -c1-300 || echo 'no log yet'"
  ;;


  "33" )
  banner "ARTISAN on $PROJECT"
  need_param "artisan command (e.g. route:list)"
  remote_tty "php artisan $PARAM2"
  log_history "artisan $PARAM2 on $PROJECT"
  ;;


  "34" )
  banner "CONFIG on $PROJECT"
  # Only non-secret keys. APP_KEY and credentials stay on the server.
  remote "grep -E '^(APP_NAME|APP_ENV|APP_DEBUG|APP_URL|LOG_LEVEL|DB_CONNECTION|SESSION_DRIVER|CACHE_STORE|QUEUE_CONNECTION)=' .env"
  echo
  remote "php artisan about --only=environment,cache,drivers"
  ;;


  "35" )
  banner "DISK on $PROJECT"
  remote "du -sh . vendor storage storage/logs public_html database 2>/dev/null; echo; df -h . | tail -1"
  ;;


  "36" )
  banner "PHP on $PROJECT"
  remote "php -v | head -1; echo; php -m | tr '\\n' ' '; echo"
  ;;


  #-------------------------------------------------------------
  # ADMIN & OPERATIONS
  #-------------------------------------------------------------

  "40" )
  banner "ADMIN: grant the admin flag"
  need_param "email of the user"
  remote "php artisan admin:grant '$PARAM2'"
  log_history "Granted admin to $PARAM2 on $PROJECT"
  ;;


  "41" )
  banner "ADMIN: revoke the admin flag"
  need_param "email of the user"
  confirm "Revoke admin from $PARAM2?"
  remote "php artisan admin:grant '$PARAM2' --revoke"
  log_history "Revoked admin from $PARAM2 on $PROJECT"
  ;;


  "42" )
  banner "ADMIN: who is an admin on $PROJECT"
  remote "php artisan tinker --execute '\App\Models\User::where(\"is_admin\", true)->get([\"id\", \"name\", \"email\"])->each(fn (\$u) => print(\$u->id.\"  \".\$u->name.\"  \".\$u->email.PHP_EOL));'"
  echo
  echo "Admin section: $APP_URL/admin"
  command -v open >/dev/null 2>&1 && open "$APP_URL/admin"
  ;;


  "43" )
  banner "PLAYERS: numbers on $PROJECT"
  remote "php artisan tinker --execute '
    printf(\"users %d (admins %d)\n\", \App\Models\User::count(), \App\Models\User::where(\"is_admin\", true)->count());
    printf(\"heroes %d, active this week %d, highest level %d, gold in circulation %d\n\", \App\Models\Character::count(), \App\Models\Character::where(\"updated_at\", \">=\", now()->subWeek())->count(), (int) \App\Models\Character::max(\"level\"), (int) \App\Models\Character::sum(\"gold\"));
    printf(\"monuments %d, sponsored structures %d, story posts %d\n\", \App\Models\TownBuilding::count(), \App\Models\TownProject::count(), \App\Models\StoryPost::count());
    \App\Models\Character::orderByDesc(\"level\")->limit(5)->get()->each(fn (\$c) => printf(\"  lv %-4d %-20s gold %-8d floor %d\n\", \$c->level, \$c->name, \$c->gold, \$c->floor));'"
  ;;


  "44" )
  banner "PLAYERS: find a hero or user"
  need_param "hero name, user name or email (part of it)"
  remote "php artisan tinker --execute '
    \$q = \"%$PARAM2%\";
    \App\Models\User::with(\"character\")->where(\"name\", \"like\", \$q)->orWhere(\"email\", \"like\", \$q)->orWhereHas(\"character\", fn (\$c) => \$c->where(\"name\", \"like\", \$q))->get()
      ->each(fn (\$u) => printf(\"user %-4d %-18s %-30s admin:%s  hero: %s\n\", \$u->id, \$u->name, \$u->email, \$u->is_admin ? \"yes\" : \"no\", \$u->character ? sprintf(\"%s lv %d gold %d floor %d last %s\", \$u->character->name, \$u->character->level, \$u->character->gold, \$u->character->floor, \$u->character->updated_at) : \"none\"));'"
  ;;


  "45" )
  banner "SAVES: rejected saves on $PROJECT"
  # The save endpoint logs the failing fields when it returns 422 (see save-validation-caps in the notes).
  remote "grep 'character save rejected' storage/logs/laravel.log 2>/dev/null | tail -n 10 | cut -c1-400 || echo 'none logged'"
  ;;


  "46" )
  banner "HERO: rescue a stuck hero"
  need_param "hero name"
  remote "php artisan tinker --execute '\$c = \App\Models\Character::where(\"name\", \"$PARAM2\")->first(); if (!\$c) { echo \"no such hero\n\"; } else { \$c->update([\"floor\" => 0, \"hp\" => \$c->max_hp]); echo \$c->name.\" is back in town at full health\n\"; }'"
  log_history "Rescued hero $PARAM2 on $PROJECT"
  ;;


  "47" )
  banner "WORLD: latest structures, monuments and posts on $PROJECT"
  remote "php artisan tinker --execute '
    echo \"--- sponsored structures ---\n\"; \App\Models\TownProject::latest()->limit(20)->get()->each(fn (\$p) => printf(\"#%-4d %-8s %-10s by %-18s %s\n\", \$p->id, \$p->town, \$p->project, \$p->builder_name, \$p->created_at));
    echo \"--- monuments ---\n\"; \App\Models\TownBuilding::latest()->limit(10)->get()->each(fn (\$b) => printf(\"#%-4d %-8s plot %d %-8s lv %d by %s\n\", \$b->id, \$b->town, \$b->slot, \$b->type, \$b->level, \$b->builder_name));
    echo \"--- story posts ---\n\"; \App\Models\StoryPost::latest()->limit(10)->get()->each(fn (\$s) => printf(\"#%-4d story %d user %d: %s\n\", \$s->id, \$s->story, \$s->user_id, mb_substr(\$s->body, 0, 80)));'"
  ;;


  "48" )
  banner "WORLD: remove a sponsored structure"
  need_param "structure id (from option 47)"
  confirm "Remove structure #$PARAM2 from the shared world? It vanishes for every player."
  remote "php artisan tinker --execute '\$p = \App\Models\TownProject::find($PARAM2); echo \$p ? (\$p->delete() ? \"removed\n\" : \"failed\n\") : \"no such structure\n\";'"
  log_history "Removed structure #$PARAM2 on $PROJECT"
  ;;


  #-------------------------------------------------------------
  # MAINTENANCE
  #-------------------------------------------------------------

  "70" )
  banner "ENV: edit .env on $PROJECT"
  echo "Remember: run option 24 afterwards, or the cached config keeps the old values."
  remote_tty "\${EDITOR:-nano} .env"
  log_history "Edited .env on $PROJECT"
  ;;


  "71" )
  banner "PERMISSIONS: storage/ and bootstrap/cache on $PROJECT"
  remote "chmod -R ug+rwX storage bootstrap/cache && echo done"
  log_history "Fixed permissions on $PROJECT"
  ;;


  "72" )
  banner "MAINTENANCE MODE: on"
  confirm "This takes $APP_URL down for visitors."
  remote "php artisan down --retry=60"
  log_history "Maintenance mode ON for $PROJECT"
  ;;


  "73" )
  banner "MAINTENANCE MODE: off"
  remote "php artisan up"
  log_history "Maintenance mode OFF for $PROJECT"
  ;;


  "74" )
  banner "LOGS: truncate the Laravel log on $PROJECT"
  confirm "This discards the log history on the server."
  remote ": > storage/logs/laravel.log && echo truncated"
  log_history "Truncated Laravel log on $PROJECT"
  ;;


  #-------------------------------------------------------------
  # ACCESS
  #-------------------------------------------------------------

  "00" )
  banner "CONNECT: to $REMOTE"
  [ "$ON_SERVER" = 1 ] && { echo "You are already on the server."; exit 0; }
  $APP_SSH "$REMOTE"
  log_history "Connect to remote"
  ;;


  "01" )
  banner "SSH KEY: copy your public key to $REMOTE"
  [ "$ON_SERVER" = 1 ] && { echo "Run this from your workstation, not the server."; exit 0; }
  PUBKEY=$(ls ~/.ssh/id_*.pub 2>/dev/null | head -1)
  [ -n "$PUBKEY" ] || { echo "No ~/.ssh/id_*.pub found. Run ssh-keygen first."; exit 1; }
  echo "Using $PUBKEY"
  ssh-copy-id -i "$PUBKEY" "$REMOTE"
  log_history "Copied ssh key to remote"
  ;;


  "05" )
  banner "MONITOR: Remote Top"
  if [ "$ON_SERVER" = 1 ]; then top; else $APP_SSH -t "$REMOTE" 'top'; fi
  ;;


  "91" )
  banner "BACKUP: database and storage/ from $PROJECT"
  need_param "Backup description"
  STAMP=$(date '+%Y%m%d-%H%M')
  SLUG=$(echo "$PARAM2" | tr -cs '[:alnum:]' '-' | sed 's/-$//')
  DEST="$BACKUP_DIR/$STAMP-$SLUG"
  mkdir -p "$DEST"
  # The database is dumped by the app itself (db:dump), through whatever
  # connection .env configures, so there is no mysql client or second login.
  remote "php artisan db:dump storage/app/private/db-dump.json.gz && tar czf /tmp/nq-backup.tgz storage/app storage/logs .env 2>/dev/null; rm -f storage/app/private/db-dump.json.gz; echo packed"
  echo "  (restore with: php artisan db:restore <file> on the server, after migrating)"
  fetch /tmp/nq-backup.tgz "$DEST/backup.tgz"
  remote "rm -f /tmp/nq-backup.tgz"
  echo "✓ saved to $DEST/backup.tgz"
  log_history "Backup: $PARAM2 → $DEST"
  ;;


  "92" )
  banner "BACKUPS: downloaded to $BACKUP_DIR"
  ls -lh "$BACKUP_DIR"/*/backup.tgz 2>/dev/null || echo "none yet (option 91 makes one)"
  ;;


  "qq" )
  echo Quit
  exit 0
  ;;


   * )
   echo
   echo "Not a recognized option."
  ;;

esac
