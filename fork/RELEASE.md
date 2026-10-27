# Fork release process (focus mode)

This fork is TREK plus focus mode. Nothing here changes upstream TREK; the
fork's commits are re-applied on every upstream release.

| What | Where |
|---|---|
| Code | `custom` branch of `stylemannerch-sys/TREK` (default branch) |
| Image | `ghcr.io/stylemannerch-sys/trek:<version>-focus-<tree>` (public) |
| Build | GitHub Actions → *Custom image* (nightly 04:17 UTC, or by hand) |
| Server | Hostinger VPS, TREK in `/root/TREK`, Caddy in front (`/etc/caddy/Caddyfile`) |
| Scripts on the server | `/root/trek-deploy.sh`, `/root/trek-rollback.sh` (copies of `fork/*.sh`) |

## How updates arrive

1. TREK publishes a release.
2. The nightly build puts the fork's commits on it, runs the focus tests and
   pushes an image. Its run summary names the **fixed tag** to deploy,
   e.g. `5.1.0-focus-1a2b3c4`. That tag never changes; deploy only fixed tags.
3. If the commits no longer apply or a test fails, the run fails, GitHub
   emails you, and no image is made. The server is untouched.
4. Nothing deploys by itself. The server changes only when you run the
   deploy script.

## Release checklist

1. **Test locally** with the new version (see *Local test* below).
2. **Major TREK version** (e.g. 5 → 6)? Take an hPanel snapshot first
   (VPS → Snapshots & Backups → Create snapshot; it replaces the old one).
3. **Deploy** in the hPanel browser terminal:

   ```sh
   /root/trek-deploy.sh 5.1.0-focus-1a2b3c4
   ```

   It pulls the image while TREK still runs, stops TREK, backs up `data` and
   `docker-compose.yml`, switches the tag, starts TREK and waits until it
   answers healthy. **If it does not, it rolls back by itself** (image and
   data) and keeps the failed attempt in `data.failed-<time>`.
4. **Check** https://fantastic4.tech: log in, open a trip, try Map | Focus.

## Rollback

| Situation | Command | Data |
|---|---|---|
| New build misbehaves, same TREK version | `/root/trek-rollback.sh --keep-data` | kept |
| Focus mode itself is the problem | `/root/trek-deploy.sh official <version>` (same version, TREK's own image) | kept |
| A TREK upgrade broke something | `/root/trek-rollback.sh` (asks first) | back to just before the deploy; later changes lost |
| Server broken beyond that | hPanel → Snapshots & Backups → Restore | back to the snapshot |

Every step is logged in `/root/TREK/.deploy-history`. The newest 3 data
backups are kept (`/root/TREK/data.bak-*`); `data.failed-*` and
`data.before-rollback-*` stay until you delete them.

## When the build fails because the commits no longer apply

```sh
git fetch upstream --tags
git checkout custom
git rebase vX.Y.Z          # fix the conflicts, then: git rebase --continue
cd client && npx vitest run src/pages/tripPlanner/focus src/pages/TripPlannerPage
git push --force-with-lease origin custom
```

Then run *Custom image* by hand (Actions → Custom image → Run workflow).

## Local test (this Mac)

```sh
cd ~/GitHub/TREK && git checkout custom && git pull
npm ci --ignore-scripts && npm run build --workspace=shared
(cd server && NODE_OPTIONS=--max-old-space-size=4096 npm run build)
(cd server && PORT=3001 node --require tsconfig-paths/register dist/index.js) &
(cd client && npx vite --host 127.0.0.1)
```

Open http://127.0.0.1:5173. Needs Node 22+.

## Installing or updating the scripts on the server

```sh
for s in deploy rollback; do
  curl -fsSL "https://raw.githubusercontent.com/stylemannerch-sys/TREK/custom/fork/$s.sh" -o "/root/trek-$s.sh"
  chmod +x "/root/trek-$s.sh"
done
```

## Leaving the fork

Switch back to TREK's own image of the same version, which keeps your data:
`/root/trek-deploy.sh official <version>`. If TREK adopts focus mode
upstream, that is all it takes.
