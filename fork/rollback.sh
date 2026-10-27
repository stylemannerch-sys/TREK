#!/usr/bin/env bash
# Undo the last deploy made with trek-deploy.sh. See RELEASE.md.
#
#   trek-rollback.sh --keep-data   only the image goes back; the data stays as it is now.
#                                  Safe while both images are the same TREK version
#                                  (e.g. 5.0.0-focus-… back to 5.0.0-focus-… or official 5.0.0).
#   trek-rollback.sh               image AND data go back to just before that deploy.
#                                  Needed after a TREK version upgrade; whatever was changed
#                                  in TREK since that deploy is lost (asked first, -y skips).
set -euo pipefail

TREK_DIR="${TREK_DIR:-/root/TREK}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
WAIT="${WAIT:-60}"
COMPOSE=docker-compose.yml
HISTORY=.deploy-history

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "==> $*"; }

healthy() {
  local i
  for ((i = 0; i < WAIT; i++)); do
    if curl -fsS -m 3 "$HEALTH_URL" 2>/dev/null | grep -q '"ok"'; then return 0; fi
    sleep "${SLEEP:-3}"
  done
  return 1
}

keep_data=false
yes=false
for arg in "$@"; do
  case "$arg" in
    --keep-data) keep_data=true ;;
    -y | --yes) yes=true ;;
    *) die "usage: $0 [--keep-data] [-y]" ;;
  esac
done

cd "$TREK_DIR"
[ -f "$HISTORY" ] || die "no deploy recorded in $TREK_DIR/$HISTORY"
last="$(grep -v '^[[:space:]]*$' "$HISTORY" | tail -n 1)"
case "$(printf '%s' "$last" | cut -f2)" in
  deploy) ;;
  *) die "the last deploy was already undone ($(printf '%s' "$last" | cut -f2)); nothing to roll back" ;;
esac
IFS=$'\t' read -r stamp _ old new backup <<< "$last"
[ -f "$COMPOSE.bak-$stamp" ] || die "the compose backup $COMPOSE.bak-$stamp is gone"

say "last deploy ($stamp): $old -> $new"
if [ "$keep_data" = false ]; then
  [ -d "$backup" ] || die "the data backup $backup is gone; use --keep-data or the hPanel snapshot"
  echo "This puts back the data from $stamp. Everything changed in TREK since then is lost."
  if [ "$yes" = false ]; then
    read -r -p "Type yes to go on: " answer
    [ "$answer" = yes ] || die "nothing changed"
  fi
fi

now="$(date +%Y%m%d-%H%M%S)"
n=1
while [ -e "data.before-rollback-$now" ] || [ -e "$COMPOSE.before-rollback-$now" ]; do now="$(date +%Y%m%d-%H%M%S)-$n"; n=$((n + 1)); done
docker compose stop
cp -a "$COMPOSE" "$COMPOSE.before-rollback-$now"
cp -a "$COMPOSE.bak-$stamp" "$COMPOSE"
if [ "$keep_data" = false ]; then
  mv data "data.before-rollback-$now"
  cp -a "$backup" data
  say "the data as it was before this rollback is kept in data.before-rollback-$now"
fi
docker compose up -d
printf '%s\trollback\t%s\t%s\t%s\n' "$now" "$new" "$old" "$([ "$keep_data" = true ] && echo kept-data || echo "$backup")" >> "$HISTORY"

if healthy; then
  say "OK: TREK runs $old again"
else
  die "TREK is not healthy after the rollback: restore the hPanel snapshot (RELEASE.md)"
fi
