#!/bin/bash
# Tool checks of the card text written for the game, on the build host.
#
#   ~/kani-logs/remote/rb . -- 'bash scripts/language/check/run.sh [selftest|spell|grammar|meaning|all]'
#
# The tools live in $CHECK_HOME (this task's own directory on the build host's external volume):
# LanguageTool 6.6, Hunspell 1.7.2 with LibreOffice's dictionaries, MADLAD-400 3B (CTranslate2 int8)
# and all-MiniLM-L6-v2, and a Python environment with ctranslate2 and sentence-transformers. What they
# are and where they came from: docs/language/NAMES-AND-QUOTATIONS.md, "Checks". Every heavy process
# runs under memguard; the LanguageTool server listens on 127.0.0.1 on a port of its own and is stopped
# by its pid when the step ends.
set -euo pipefail
export PATH=/opt/homebrew/opt/openjdk/bin:/opt/homebrew/bin:$PATH
CHECK_HOME=${CHECK_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/names-quotes}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
export HSPELL=$CHECK_HOME/hunspell/bin/hspell DICT_DIR=$CHECK_HOME/dict
export MADLAD_DIR=$CHECK_HOME/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$CHECK_HOME/models/all-MiniLM-L6-v2
export HF_HOME=$CHECK_HOME/cache/hf TMPDIR=$CHECK_HOME/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
PY=$CHECK_HOME/venv/bin/python
LT_PORT=${LT_PORT:-18841}
cd "$(dirname "$0")/../../.."
OUT=docs/language/checks
mkdir -p "$OUT" "$TMPDIR" "$CHECK_HOME/logs"
STEP=${1:-all}

LT_PID=
cleanup() { if [ -n "$LT_PID" ]; then for c in $(pgrep -P "$LT_PID" 2>/dev/null); do kill "$c" 2>/dev/null || true; done; kill "$LT_PID" 2>/dev/null || true; fi; }
trap cleanup EXIT
start_lt() {
  if lsof -nP -iTCP:"$LT_PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "run.sh: port $LT_PORT is taken; set LT_PORT" >&2; exit 2; fi
  nice -n 10 "$MEMGUARD" --max-gb 8 -- java -Xmx4g -cp "$CHECK_HOME/LanguageTool-6.6/languagetool-server.jar" org.languagetool.server.HTTPServer --port "$LT_PORT" \
    >"$CHECK_HOME/logs/languagetool.log" 2>&1 &
  LT_PID=$!
  for _ in $(seq 1 240); do curl -fsS -o /dev/null "http://127.0.0.1:$LT_PORT/v2/languages" 2>/dev/null && break; sleep 1; done
  export LT_URL=http://127.0.0.1:$LT_PORT
}

node scripts/language/check/collect.mjs "$TMPDIR/card-items.json"
case "$STEP" in
  selftest) start_lt; "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py selftest ;;
  spell) "$PY" scripts/language/check/check.py spell "$TMPDIR/card-items.json" "$OUT/spelling.json" ;;
  grammar) start_lt; "$PY" scripts/language/check/check.py grammar "$TMPDIR/card-items.json" "$OUT/grammar.json" ;;
  meaning) nice -n 10 "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py meaning "$TMPDIR/card-items.json" "$OUT/backtranslation.json" ;;
  all)
    start_lt
    "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py selftest
    "$PY" scripts/language/check/check.py spell "$TMPDIR/card-items.json" "$OUT/spelling.json"
    "$PY" scripts/language/check/check.py grammar "$TMPDIR/card-items.json" "$OUT/grammar.json"
    nice -n 10 "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py meaning "$TMPDIR/card-items.json" "$OUT/backtranslation.json" ;;
  detach)
    # A long step from a copy of the files it reads, so the next rb run in this checkout cannot change them under it.
    WHAT=${2:?detach needs a step}
    WORK=$CHECK_HOME/work/$WHAT
    rm -rf "$WORK"; mkdir -p "$WORK"
    tar -cf - scripts/language/check src/lib docs/language | tar -xf - -C "$WORK"
    trap - EXIT
    (cd "$WORK" && nohup bash scripts/language/check/run.sh "$WHAT" >"$CHECK_HOME/logs/$WHAT.log" 2>&1 &)
    echo "started $WHAT in $WORK; log $CHECK_HOME/logs/$WHAT.log; results in $WORK/docs/language/checks" ;;
  *) sed -n 2,12p "$0"; exit 2 ;;
esac
