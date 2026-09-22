#!/usr/bin/env bash
#
# One command to run the whole app against a local copy of the real course catalog.
#
#   ./scripts/local-catalog/start.sh
#
# Starts, in this one terminal:
#   - an in-memory MongoDB replica set seeded with the full CMU catalog  (:27018)
#   - this repo's backend, pointed at it                                  (:3000)
#   - the frontend, pointed at that backend                               (:3010)
#
# Why this exists: the course catalog lives only in ScottyLabs' production database, so
# `NEXT_PUBLIC_BACKEND_URL` normally points at their public API - which runs *their*
# deployed backend and therefore ignores any query parameter this repo adds. To exercise
# backend changes (e.g. the classTimes filter) you need our backend over real data.
#
# Profiles also live in this local database, so it starts empty: sign in and re-enter a
# busy time to exercise the availability badge. Your real profile in Atlas is untouched.
#
# Ctrl+C stops everything.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE="${CATALOG_CACHE:-$HOME/.cache/cmucourses-local-catalog}"
MONGO_PORT="${MONGO_PORT:-27018}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
CATALOG_API="https://course.apis.scottylabs.org/courses/search?schedules=true&page="

log() { printf '\033[36m[local-catalog]\033[0m %s\n' "$*"; }

# --- 1. one-time bootstrap: mongodb-memory-server + a cached copy of the catalog ----------
mkdir -p "$CACHE"
if [ ! -d "$CACHE/node_modules/mongodb-memory-server" ]; then
  log "first run: installing mongodb-memory-server into $CACHE"
  ( cd "$CACHE" && [ -f package.json ] || echo '{"name":"cmucourses-local-catalog","private":true}' > package.json )
  ( cd "$CACHE" && bun add mongodb-memory-server mongodb >/dev/null )
fi

if [ ! -d "$CACHE/catalog" ] || [ -z "$(ls -A "$CACHE/catalog" 2>/dev/null)" ]; then
  log "first run: downloading the course catalog (about 840 pages, a few minutes)"
  mkdir -p "$CACHE/catalog"
  CATALOG_DIR="$CACHE/catalog" CATALOG_API="$CATALOG_API" python3 - <<'PY'
import json, os, urllib.request, concurrent.futures as cf
OUT, BASE = os.environ["CATALOG_DIR"], os.environ["CATALOG_API"]
def fetch(p):
    path = f"{OUT}/p{p:04d}.json"
    if os.path.exists(path) and os.path.getsize(path) > 500: return "cached"
    req = urllib.request.Request(BASE + str(p), headers={"User-Agent": "Mozilla/5.0"})
    for _ in range(3):
        try:
            data = urllib.request.urlopen(req, timeout=45).read()
            json.loads(data); open(path, "wb").write(data); return "ok"
        except Exception as e: err = e
    raise SystemExit(f"failed to download page {p}: {err}")
req = urllib.request.Request(BASE + "1", headers={"User-Agent": "Mozilla/5.0"})
pages = json.loads(urllib.request.urlopen(req, timeout=45).read())["totalPages"]
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    list(ex.map(fetch, range(1, pages + 1)))
print(f"  downloaded {pages} pages")
PY
fi

# --- 2. clean shutdown of everything we start --------------------------------------------
PIDS=()
cleanup() {
  log "shutting down"
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  # mongod is a grandchild and does not die with its parent
  lsof -nP -iTCP:"$MONGO_PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | sort -u \
    | while read -r pid; do kill -9 "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for port in "$MONGO_PORT" "$BACKEND_PORT" 3010; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    log "port $port is already in use - stop whatever is on it first"; exit 1
  fi
done

# --- 3. mongo + catalog -------------------------------------------------------------------
log "starting MongoDB and loading the catalog (first load takes ~30s)"
# Run the seeder from the cache dir: that is where mongodb-memory-server is installed, and
# ESM resolves bare-specifier imports (mongodb-memory-server) by walking up from the script's
# own location. seed.mjs also imports ../catalog/load.mjs by relative path, so both files are
# copied preserving that same relative layout - copying seed.mjs alone would leave that import
# pointing outside the cache dir entirely.
mkdir -p "$CACHE/scripts/catalog" "$CACHE/scripts/local-catalog"
cp "$REPO/scripts/catalog/load.mjs" "$CACHE/scripts/catalog/load.mjs"
cp "$REPO/scripts/local-catalog/seed.mjs" "$CACHE/scripts/local-catalog/seed.mjs"
CATALOG_CACHE="$CACHE" MONGO_PORT="$MONGO_PORT" \
  bun "$CACHE/scripts/local-catalog/seed.mjs" 2>&1 | sed 's/^/  /' &
PIDS+=($!)

for _ in $(seq 1 90); do
  sleep 2
  if lsof -nP -iTCP:"$MONGO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then break; fi
done
sleep 12   # let the seed finish inserting before the backend connects

# --- 4. backend + frontend ----------------------------------------------------------------
MONGO_URI="mongodb://127.0.0.1:$MONGO_PORT/cmucourses?replicaSet=testset"
log "starting backend on :$BACKEND_PORT and frontend on :3010"
cd "$REPO"

MONGODB_URI="$MONGO_URI" PORT="$BACKEND_PORT" \
  bunx nx run @cmucourses/backend:dev 2>&1 | sed 's/^/  [backend]  /' &
PIDS+=($!)

NEXT_PUBLIC_BACKEND_URL="http://localhost:$BACKEND_PORT" \
NEXT_PUBLIC_PROFILE_BACKEND_URL="http://localhost:$BACKEND_PORT" \
  bunx nx run @cmucourses/frontend:dev 2>&1 | sed 's/^/  [frontend] /' &
PIDS+=($!)

log "open http://localhost:3010   (Ctrl+C stops everything)"
wait
