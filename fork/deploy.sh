#!/usr/bin/env bash
# Deploy an image of TREK to this server: pull first, back up, switch, check,
# and roll back by itself when TREK does not come up healthy. See RELEASE.md.
#
#   trek-deploy.sh 5.0.0-focus-1a2b3c4       this fork's image (a fixed tag from the build summary)
#   trek-deploy.sh official 5.0.0            TREK's own image of that version (focus mode off)
#
# Settings (environment): TREK_DIR (/root/TREK), IMAGE (ghcr.io/stylemannerch-sys/trek),
# HEALTH_URL (http://127.0.0.1:3000/api/health), KEEP (3 backups), WAIT (60 checks, 3 s apart).
set -euo pipefail

TREK_DIR="${TREK_DIR:-/root/TREK}"
IMAGE="${IMAGE:-ghcr.io/stylemannerch-sys/trek}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
KEEP="${KEEP:-3}"
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

current_image() { awk '/^[[:space:]]*image:/ { sub(/^[[:space:]]*image:[[:space:]]*/, ""); print; exit }' "$COMPOSE"; }

set_image() {
  awk -v img="$1" '!done && /^[[:space:]]*image:/ { sub(/image:.*/, "image: " img); done = 1 } { print }' \
    "$COMPOSE" > "$COMPOSE.new"
  mv "$COMPOSE.new" "$COMPOSE"
}

prune_backups() {
  local all count
  all="$(ls -1d data.bak-* 2>/dev/null | sort || true)"
  count="$(printf '%s\n' "$all" | grep -c . || true)"
  if [ "$count" -gt "$KEEP" ]; then
    printf '%s\n' "$all" | head -n "$((count - KEEP))" | while read -r old; do
      say "removing old backup $old (keeping the newest $KEEP)"
      rm -rf -- "$old" "${COMPOSE}.bak-${old#data.bak-}"
    done
  fi
}

[ $# -ge 1 ] || die "usage: $0 <tag>   or   $0 official <version>"
if [ "$1" = official ]; then
  [ $# -eq 2 ] || die "usage: $0 official <version>"
  new="mauriceboe/trek:$2"
else
  new="$IMAGE:$1"
fi
case "$new" in
  *:latest | *:focus | *:latest-pre) die "use a fixed tag (from the build summary), not a moving one like ${new##*:}" ;;
esac

cd "$TREK_DIR"
[ -f "$COMPOSE" ] || die "no $COMPOSE in $TREK_DIR"
[ -d data ] || die "no data folder in $TREK_DIR"
old="$(current_image)"
[ -n "$old" ] || die "no image: line in $COMPOSE"
[ "$old" != "$new" ] || die "already running $new"

say "pulling $new (TREK keeps running meanwhile)"
docker pull "$new"

stamp="$(date +%Y%m%d-%H%M%S)"
# Two deploys within a second must never share (and so mix) one backup.
n=1
while [ -e "data.bak-$stamp" ] || [ -e "$COMPOSE.bak-$stamp" ]; do stamp="$(date +%Y%m%d-%H%M%S)-$n"; n=$((n + 1)); done
backup="data.bak-$stamp"
say "stopping TREK for a consistent backup"
docker compose stop
cp -a data "$backup"
cp -a "$COMPOSE" "$COMPOSE.bak-$stamp"
printf '%s\tdeploy\t%s\t%s\t%s\n' "$stamp" "$old" "$new" "$backup" >> "$HISTORY"

say "switching $old -> $new"
set_image "$new"
docker compose up -d

say "waiting for TREK to answer healthy"
if healthy; then
  say "OK: TREK runs $new"
  say "backup of the data before this deploy: $TREK_DIR/$backup"
  prune_backups
  exit 0
fi

echo "!! TREK did not come up healthy on $new: rolling back" >&2
docker compose logs --tail 40 >&2 || true
docker compose stop || true
cp -a "$COMPOSE.bak-$stamp" "$COMPOSE"
mv data "data.failed-$stamp"
cp -a "$backup" data
docker compose up -d
printf '%s\tauto-rollback\t%s\t%s\t%s\n' "$(date +%Y%m%d-%H%M%S)" "$new" "$old" "$backup" >> "$HISTORY"
if healthy; then
  echo "!! rolled back to $old with the data from before. The failed attempt is kept in data.failed-$stamp" >&2
else
  echo "!! the rollback is not healthy either: restore the hPanel snapshot (RELEASE.md)" >&2
fi
exit 1
