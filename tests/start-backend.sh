#!/bin/bash
# Start what the end-to-end tests need behind the dev server, and stop it again on exit:
#
#   1. a throwaway Postgres cluster (fresh on every run, TCP on 127.0.0.1 only),
#   2. the real API with DEV_EMAIL_LOG=1  -> sign-in codes land in $WORK/api.log,
#   3. the real API with email sign-in off -> the "no Resend key yet" state.
#
# Playwright runs this as a web server (playwright.config.ts) and stops it with SIGTERM.
# Needs initdb, pg_ctl, createdb, curl and cargo on PATH. It fails loudly if any is missing:
# there is no fallback that fakes the database.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ORIGIN="${E2E_WEB_ORIGIN:-http://localhost:4399}"
WEB_NOEMAIL_ORIGIN="${E2E_WEB_NOEMAIL_ORIGIN:-http://localhost:4398}"
API_PORT="${E2E_API_PORT:-38490}"
API_NOEMAIL_PORT="${E2E_API_NOEMAIL_PORT:-38491}"
PG_PORT="${E2E_PG_PORT:-54329}"
WORK="$ROOT/${E2E_WORK_DIR:-.e2e}"
PGDATA="$WORK/pg"
DB_USER=im_e2e
DB_NAME=inspired_mile_e2e

say() { echo "[start-backend] $*" >&2; }
die() { say "FATAL: $*"; exit 1; }

# Homebrew keeps versioned Postgres out of PATH; look there too.
for dir in /opt/homebrew/opt/postgresql@18/bin /opt/homebrew/opt/postgresql/bin /usr/local/opt/postgresql@18/bin; do
  if [ -x "$dir/initdb" ]; then PATH="$dir:$PATH"; fi
done
for tool in initdb pg_ctl createdb curl cargo; do
  command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not on PATH. The auth tests need a real Postgres and the real API."
done

API_PID=""
API_NOEMAIL_PID=""
cleanup() {
  trap - EXIT INT TERM
  for pid in "$API_PID" "$API_NOEMAIL_PID"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      # Reap it here, quietly, so the shell does not print a "Terminated" job notice.
      wait "$pid" 2>/dev/null || true
    fi
  done
  if [ -f "$PGDATA/postmaster.pid" ]; then
    pg_ctl -D "$PGDATA" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  say "stopped"
}
trap cleanup EXIT
trap 'exit 143' INT TERM

# A previous run that was killed hard may have left its Postgres up.
if [ -f "$PGDATA/postmaster.pid" ]; then
  say "stopping a Postgres left over from an earlier run"
  pg_ctl -D "$PGDATA" -m immediate -w stop >/dev/null 2>&1 || true
fi
rm -rf "$WORK"
mkdir -p "$WORK"

say "building the API (cargo build --release)"
BIN="$(cd "$ROOT/backend" && cargo build --release --message-format=json 2>"$WORK/cargo-build.log" \
  | sed -n 's/.*"executable":"\([^"]*inspired-mile-api\)".*/\1/p' | tail -1)"
if [ -z "$BIN" ] || [ ! -x "$BIN" ]; then
  tail -40 "$WORK/cargo-build.log" >&2 || true
  die "the API did not build (see $WORK/cargo-build.log)"
fi
say "API binary: $BIN"

say "starting Postgres on 127.0.0.1:$PG_PORT"
initdb -D "$PGDATA" -U "$DB_USER" --auth=trust -E UTF8 --no-sync >"$WORK/initdb.log" 2>&1 \
  || { cat "$WORK/initdb.log" >&2; die "initdb failed"; }
# No unix socket: its path would be too long under some checkout directories.
pg_ctl -D "$PGDATA" -l "$WORK/postgres.log" -w \
  -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c fsync=off -c max_connections=60" \
  start >"$WORK/pg_ctl.log" 2>&1 || { cat "$WORK/pg_ctl.log" "$WORK/postgres.log" >&2; die "Postgres did not start"; }
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$DB_USER" "$DB_NAME" || die "createdb failed"

wait_healthy() {
  local port="$1" pid="$2" name="$3"
  for _ in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:$port/api/v1/health" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$pid" 2>/dev/null; then
      tail -30 "$WORK/$name.log" >&2 || true
      die "the API ($name) exited during start-up"
    fi
    sleep 0.5
  done
  die "the API ($name) did not answer on port $port"
}

start_api() {
  # $1 port, $2 log name, $3 DEV_EMAIL_LOG value. Migrations are read from ./migrations.
  (
    cd "$ROOT/backend"
    exec env -u RESEND_API_KEY \
      DATABASE_URL="postgres://$DB_USER@127.0.0.1:$PG_PORT/$DB_NAME" \
      JWT_SECRET="e2e-secret-not-for-production" \
      PORT="$1" \
      CORS_ORIGIN="$WEB_ORIGIN" \
      WEBAUTHN_RP_ID="localhost" \
      WEBAUTHN_ORIGIN="$WEB_ORIGIN,$WEB_NOEMAIL_ORIGIN" \
      DEV_EMAIL_LOG="$3" \
      RATE_LIMIT_PER_MINUTE="100000" \
      DB_MAX_CONNECTIONS="10" \
      RUST_LOG="${E2E_RUST_LOG:-warn}" \
      NO_COLOR=1 \
      "$BIN" >"$WORK/$2.log" 2>&1
  ) &
}

# The first API runs the migrations; the second starts once they are done.
start_api "$API_PORT" api 1
API_PID=$!
wait_healthy "$API_PORT" "$API_PID" api
say "API with DEV_EMAIL_LOG on :$API_PORT (codes in $WORK/api.log)"

start_api "$API_NOEMAIL_PORT" api-noemail 0
API_NOEMAIL_PID=$!
wait_healthy "$API_NOEMAIL_PORT" "$API_NOEMAIL_PID" api-noemail
say "API with email off on :$API_NOEMAIL_PORT"

# Stay up until Playwright stops us, or until an API dies (which should fail the run).
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$API_NOEMAIL_PID" 2>/dev/null; do
  sleep 1
done
die "an API process exited (see $WORK/api.log and $WORK/api-noemail.log)"
