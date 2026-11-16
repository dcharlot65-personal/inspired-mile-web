#!/bin/bash
# Tool checks of the card text written for the game, on a build host.
#
#   ~/kani-logs/remote/rb . -- 'bash scripts/language/check/run.sh [setup|selftest|spell|grammar|meaning|all|detach <step>|status]'
#
# The tools live in $CHECK_HOME, this task's own directory on the host: LanguageTool 6.6, Hunspell
# 1.7.2 with LibreOffice's dictionaries, MADLAD-400 3B (CTranslate2 int8), all-MiniLM-L6-v2 and LaBSE,
# and a Python environment with ctranslate2 and sentence-transformers. What they are and where they
# came from: docs/language/NAMES-AND-QUOTATIONS.md, "Sources and licences". Every heavy process runs
# under the host's memguard; the LanguageTool server listens on 127.0.0.1 on a port of its own and is
# stopped by its pid when the step ends. Nothing outside $CHECK_HOME is written on the host.
#
# The back-translation itself is the language QA pipeline's (branch lang/qa-pipeline,
# scripts/lang/backtranslate.py, its --pairs mode), so card text and interface strings are judged by
# the same model and the same rule. Until that branch is in main, a copy of the file is kept in
# $CHECK_HOME/qa-pipeline/ and must have the sha256 below: a different file is refused, not used.
set -euo pipefail
if [ -d /Volumes/macos_4TB_external_1/wai-build ]; then ROOT_DEFAULT=/Volumes/macos_4TB_external_1/wai-build; else ROOT_DEFAULT=$HOME/wai-build; fi
CHECK_HOME=${CHECK_HOME:-$ROOT_DEFAULT/im-lang/names-quotes}
MEMGUARD=${MEMGUARD:-$ROOT_DEFAULT/bin/memguard}
for j in /opt/homebrew/opt/openjdk/bin /usr/local/opt/openjdk/bin; do [ -x "$j/java" ] && export PATH=$j:$PATH; done
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
export HSPELL=$CHECK_HOME/hunspell/bin/hspell DICT_DIR=$CHECK_HOME/dict
export MADLAD_DIR=$CHECK_HOME/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$CHECK_HOME/models/all-MiniLM-L6-v2 LABSE_DIR=$CHECK_HOME/models/LaBSE
export HF_HOME=$CHECK_HOME/cache/hf TMPDIR=$CHECK_HOME/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
export PY=$CHECK_HOME/venv/bin/python
# torch and ctranslate2 each bring their own copy of Intel's OpenMP runtime (libiomp5) on an Intel Mac; with both
# loaded, the process hung in an OpenMP barrier while LaBSE's weights loaded (iMac Pro, 2026-11-16). One OpenMP
# thread for torch avoids it; ctranslate2 keeps its own threads (BT_THREADS).
export OMP_NUM_THREADS=${OMP_NUM_THREADS:-1} BT_THREADS=${BT_THREADS:-12}
BT_SCRIPT_SHA256=1a3ca221e10c9fd13d50d7bff1dfc1335ad8ddfb6979238bd642c8114010c79a   # lang/qa-pipeline d51089b, blob c5797969
LT_PORT=${LT_PORT:-18841}
cd "$(dirname "$0")/../../.."
OUT=${CHECK_OUT:-docs/language/checks}
mkdir -p "$OUT" "$TMPDIR" "$CHECK_HOME/logs"
STEP=${1:-all}

if [ -f scripts/lang/backtranslate.py ]; then export BT_SCRIPT=${BT_SCRIPT:-$PWD/scripts/lang/backtranslate.py}; else export BT_SCRIPT=${BT_SCRIPT:-$CHECK_HOME/qa-pipeline/backtranslate.py}; fi
bt_script_ok() {
  [ -f "$BT_SCRIPT" ] || { echo "run.sh: no $BT_SCRIPT; put lang/qa-pipeline's scripts/lang/backtranslate.py there (git show lang/qa-pipeline:scripts/lang/backtranslate.py)" >&2; exit 2; }
  if [ "$BT_SCRIPT" = "$CHECK_HOME/qa-pipeline/backtranslate.py" ] && [ "$(shasum -a 256 "$BT_SCRIPT" | cut -d' ' -f1)" != "$BT_SCRIPT_SHA256" ]; then
    echo "run.sh: $BT_SCRIPT is not the pinned copy (sha256 $BT_SCRIPT_SHA256); refusing to use it" >&2; exit 2
  fi
}

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
# hspell (whole-word Hunspell queries) is built here, against this host's own Hunspell build.
build_hspell() {
  if [ ! -x "$HSPELL" ] || [ scripts/language/check/hspell.cpp -nt "$HSPELL" ]; then
    clang++ -std=c++17 -O1 -I"$CHECK_HOME/hunspell/include" scripts/language/check/hspell.cpp "$CHECK_HOME"/hunspell/lib/libhunspell-1.7.a -liconv -o "$HSPELL"
  fi
}

case "$STEP" in
  setup) build_hspell; bt_script_ok; "$PY" -c 'import ctranslate2, sentence_transformers, sacrebleu, sentencepiece; print("python ok", ctranslate2.__version__, sentence_transformers.__version__)'; java -version 2>&1 | head -1; exit 0 ;;
  status) ls -la "$CHECK_HOME/logs"; for p in "$CHECK_HOME"/logs/*.pid; do [ -f "$p" ] && { kill -0 "$(cat "$p")" 2>/dev/null && echo "$p: running" || echo "$p: not running"; }; done; tail -n 5 "$CHECK_HOME"/logs/*.log 2>/dev/null; exit 0 ;;
esac
node scripts/language/check/collect.mjs "$TMPDIR/card-items.json"
case "$STEP" in
  selftest) build_hspell; bt_script_ok; start_lt; "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py selftest ;;
  spell) build_hspell; "$PY" scripts/language/check/check.py spell "$TMPDIR/card-items.json" "$OUT/spelling.json" ;;
  grammar) start_lt; "$PY" scripts/language/check/check.py grammar "$TMPDIR/card-items.json" "$OUT/grammar.json" ;;
  meaning) bt_script_ok; "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py meaning "$TMPDIR/card-items.json" "$OUT/backtranslation.json" ;;
  all)
    build_hspell; bt_script_ok; start_lt
    "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py selftest
    "$PY" scripts/language/check/check.py spell "$TMPDIR/card-items.json" "$OUT/spelling.json"
    "$PY" scripts/language/check/check.py grammar "$TMPDIR/card-items.json" "$OUT/grammar.json"
    "$MEMGUARD" --max-gb 14 -- "$PY" scripts/language/check/check.py meaning "$TMPDIR/card-items.json" "$OUT/backtranslation.json" ;;
  detach)
    # A long step from a copy of the files it reads, so the next rb run in this checkout cannot change them under it.
    # Results go to $CHECK_HOME/work/<step>/docs/language/checks; the previous result there is kept, so the step resumes.
    WHAT=${2:?detach needs a step}
    WORK=$CHECK_HOME/work/$WHAT
    PIDF=$CHECK_HOME/logs/$WHAT.pid
    if [ -s "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then echo "run.sh: $WHAT is already running (pid $(cat "$PIDF"))" >&2; exit 3; fi
    mkdir -p "$WORK"
    rm -rf "$WORK/scripts" "$WORK/src" "$WORK/package.json"
    tar -cf - --exclude docs/language/checks scripts/language/check src/lib src/i18n docs/language package.json | tar -xf - -C "$WORK"
    [ -d "$WORK/docs/language/checks" ] || { mkdir -p "$WORK/docs/language/checks"; cp "$OUT"/*.json "$WORK/docs/language/checks/" 2>/dev/null || true; }
    trap - EXIT
    # stdin from /dev/null: a job that keeps the ssh session's stdin holds rb's connection open until it ends.
    (cd "$WORK" && nohup bash scripts/language/check/run.sh "$WHAT" </dev/null >"$CHECK_HOME/logs/$WHAT.log" 2>&1 & echo $! > "$PIDF")
    echo "started $WHAT in $WORK (pid $(cat "$PIDF")); log $CHECK_HOME/logs/$WHAT.log; results in $WORK/docs/language/checks" ;;
  *) sed -n 2,16p "$0"; exit 2 ;;
esac
