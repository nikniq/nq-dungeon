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
# Requires a vars.sh next to it defining REMOTE, PROJECT, APP_SSH, etc.
# See vars.sh.example. vars.sh is gitignored because it holds host and
# account details.
#================================================================
clear

if [ ! -f ./vars.sh ]; then
  echo "vars.sh not found next to cx.sh — copy vars.sh.example to vars.sh and fill it in."
  exit 1
fi
source ./vars.sh

REMOTE_APP="${REMOTE_APP:-www/$PROJECT}"
APP_URL="${APP_URL:-https://$PROJECT}"
LOG_OUTPUT="${LOG_OUTPUT:-./log/remote.out}"
BACKUP_DIR="${BACKUP_DIR:-./backup}"

# This script drives the server from outside. Run on the server it would
# try to ssh to itself.
if [ "$(hostname -s 2>/dev/null)" = "${REMOTE_HOST%%.*}" ]; then
  echo "⚠ This looks like $REMOTE_HOST — cx.sh is the LOCAL script. Use deploy.sh here."
  exit 1
fi

#---------------------------------------------------------------
# Helpers
#---------------------------------------------------------------
log_history() {
  mkdir -p ./log
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" >> ./log/history.log
}

# Run a command on the server, in the app directory.
remote() {
  $APP_SSH "$REMOTE" "cd ~/$REMOTE_APP && $*"
}

# Same, with a terminal attached — for anything interactive or long-running.
remote_tty() {
  $APP_SSH -t "$REMOTE" "cd ~/$REMOTE_APP && $*"
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
echo "Hi $USER@$HOSTNAME — acting on $PROJECT ($REMOTE)"
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
echo "91 : BACKUP: download database and storage/ to $BACKUP_DIR"
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
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠ Uncommitted local changes — these will NOT deploy:"
    git status --short
    echo
  fi
  UNPUSHED=$(git log --oneline @{u}.. 2>/dev/null)
  if [ -n "$UNPUSHED" ]; then
    echo "⚠ Commits not pushed — these will NOT deploy:"
    echo "$UNPUSHED"
    echo
    confirm "Deploy anyway?"
  fi
  echo "Local HEAD : $(git log --oneline -1)"
  echo
  remote_tty "./deploy.sh"
  log_history "Deployed $PROJECT"
  ;;


  "21" )
  banner "FIRST DEPLOY: clone onto $REMOTE:~/$REMOTE_APP"
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
  $APP_SSH "$REMOTE"
  log_history "Connect to remote"
  ;;


  "01" )
  banner "SSH KEY: copy your public key to $REMOTE"
  PUBKEY=$(ls ~/.ssh/id_*.pub 2>/dev/null | head -1)
  [ -n "$PUBKEY" ] || { echo "No ~/.ssh/id_*.pub found. Run ssh-keygen first."; exit 1; }
  echo "Using $PUBKEY"
  ssh-copy-id -i "$PUBKEY" -p "${REMOTE_PORT:-22}" "$REMOTE"
  log_history "Copied ssh key to remote"
  ;;


  "05" )
  banner "MONITOR: Remote Top"
  $APP_SSH -t "$REMOTE" 'top'
  ;;


  "91" )
  banner "BACKUP: database and storage/ from $PROJECT"
  need_param "Backup description"
  STAMP=$(date '+%Y%m%d-%H%M')
  SLUG=$(echo "$PARAM2" | tr -cs '[:alnum:]' '-' | sed 's/-$//')
  DEST="$BACKUP_DIR/$STAMP-$SLUG"
  mkdir -p "$DEST"
  # SQLite is a single file; for anything else dump through artisan's DB config.
  remote "tar czf /tmp/nq-backup.tgz database/*.sqlite storage/app storage/logs .env 2>/dev/null; echo packed"
  $APP_SCP "$REMOTE:/tmp/nq-backup.tgz" "$DEST/backup.tgz"
  remote "rm -f /tmp/nq-backup.tgz"
  echo "✓ saved to $DEST/backup.tgz"
  log_history "Backup: $PARAM2 → $DEST"
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
