#!/bin/bash
# Compare what a database has applied with a migrations folder, the way the API does at start-up,
# BEFORE a new binary and folder are put in place.
#
#   scripts/check-migrations.sh <migrations-folder> <psql connection arguments...>
#   e.g. on prod:  scripts/check-migrations.sh ~/new-release/migrations -d inspired_mile
#
# sqlx (0.9, `Migrator::new`, no ignored characters) records each applied migration's SHA-384 of
# the file's text in `_sqlx_migrations.checksum`, and refuses to start when a file it applied has
# changed since (VersionMismatch), when an applied version has no file (VersionMissing), or when
# one failed half-way (Dirty). An API that refuses to start is an outage, so this says beforehand.
#
# Prints one line per version, and exits 1 if the API would refuse to start, 0 otherwise.
# Bash 3.2 (macOS's /bin/bash): no associative arrays.
set -euo pipefail

if [ $# -lt 1 ] || [ ! -d "$1" ]; then
  echo "usage: $0 <migrations-folder> <psql connection arguments...>" >&2
  exit 2
fi
dir=$1
shift
PSQL=${PSQL:-psql}
for candidate in /opt/homebrew/opt/postgresql@18/bin/psql /opt/homebrew/bin/psql /usr/local/bin/psql; do
  if [ "$PSQL" = psql ] && ! command -v psql >/dev/null 2>&1 && [ -x "$candidate" ]; then PSQL=$candidate; fi
done

# "<version> <sha384> <file>" for each file, the version as sqlx reads it (the number before the
# first underscore, leading zeros dropped).
files=$(
  for f in "$dir"/*.sql; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    number=${name%%_*}
    if ! [[ $number =~ ^[0-9]+$ ]]; then echo "not a migration file name: $name" >&2; exit 2; fi
    echo "$((10#$number)) $(shasum -a 384 "$f" | cut -d' ' -f1) $name"
  done
)
applied=$("$PSQL" "$@" -At -F ' ' -v ON_ERROR_STOP=1 \
  -c "SELECT version, encode(checksum, 'hex'), success FROM _sqlx_migrations ORDER BY version")

FILES=$files awk '
  BEGIN {
    n = split(ENVIRON["FILES"], lines, "\n")
    for (i = 1; i <= n; i++) {
      if (lines[i] == "") continue
      split(lines[i], f, " ")
      sum[f[1]] = f[2]; name[f[1]] = f[3]
    }
    bad = 0
  }
  NF == 0 { next }
  {
    v = $1; seen[v] = 1
    if ($3 != "t") { print "FAILED HALF-WAY  " v "  (the API refuses to start: Dirty)"; bad = 1 }
    else if (!(v in sum)) { print "NO FILE          " v "  (applied, but not in the folder: VersionMissing)"; bad = 1 }
    else if (sum[v] != $2) { print "CHANGED          " v "  " name[v] "  (applied with another text: VersionMismatch)"; bad = 1 }
    else print "same             " v "  " name[v]
  }
  END {
    for (v in sum) if (!(v in seen)) print "to be applied    " v "  " name[v]
    if (bad) print "The API would refuse to start with this folder."
    else print "The API would start: every applied migration has its file, unchanged."
    exit bad
  }
' <<<"$applied"
