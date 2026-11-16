#!/bin/bash
# The tool-backed language checks, on the build host.
#
#   ~/kani-logs/remote/rb . -- 'bash scripts/lang/run.sh <step> [args]'
#
#   selftest      prove LanguageTool and Hunspell flag a known-bad sentence in each language
#   grammar       LanguageTool + Hunspell over every string            -> $OUT/grammar.json
#   meaning       back-translate with MADLAD-400 and score             -> $OUT/bt.json
#   review        second opinion from a local model (llama.cpp)        -> $OUT/review.json
#   pairs FILE    back-translate candidate corrections (FILE: [{id, lang, text, english}])
#   detach STEP   run a long step in the background from a copy of this checkout, so rb is free;
#                 log in $LANGQA_HOME/logs/STEP.log, result in $OUT
#   status        what is running, and the tail of each log
#
# The tools live in $LANGQA_HOME (scripts/lang/host-setup.sh installs them). Every heavy
# process runs under memguard; servers started here listen on 127.0.0.1 only, on ports of
# their own, and are stopped by pid when the step ends. Nothing else on the host is touched.
set -euo pipefail
export PATH=/opt/homebrew/opt/openjdk/bin:/opt/homebrew/bin:$PATH
export LANGQA_HOME=${LANGQA_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
export OUT=${OUT:-$LANGQA_HOME/out}
export HUNSPELL=$LANGQA_HOME/hunspell/bin/hunspell DICT_DIR=$LANGQA_HOME/dict
export MADLAD_DIR=$LANGQA_HOME/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$LANGQA_HOME/models/all-MiniLM-L6-v2
export HF_HOME=$LANGQA_HOME/cache/hf TMPDIR=$LANGQA_HOME/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
LT_PORT=${LT_PORT:-18731}
LLAMA_PORT=${LLAMA_PORT:-18732}
GGUF=${GGUF:-$LANGQA_HOME/models/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q4_K_M.gguf}
mkdir -p "$OUT" "$LANGQA_HOME/logs" "$TMPDIR"
HERE=$(cd "$(dirname "$0")/../.." && pwd)
cd "$HERE"
STEP=${1:-}; shift || true

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

wait_http() {  # wait_http <url> <seconds> <log>
  for _ in $(seq 1 "$2"); do curl -fsS -o /dev/null "$1" 2>/dev/null && return 0; sleep 1; done
  echo "run.sh: $1 did not answer in $2 s" >&2; tail -20 "$3" >&2 || true; return 1
}

start_languagetool() {
  if lsof -nP -iTCP:"$LT_PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "run.sh: port $LT_PORT is taken; set LT_PORT" >&2; exit 2; fi
  local dir; dir=$(ls -d "$LANGQA_HOME"/LanguageTool-*/ | tail -1)
  nice -n 10 "$MEMGUARD" --max-gb 8 -- java -Xmx4g -cp "$dir/languagetool-server.jar" org.languagetool.server.HTTPServer --port "$LT_PORT" >"$LANGQA_HOME/logs/languagetool-server.log" 2>&1 &
  PIDS+=($!)
  wait_http "http://127.0.0.1:$LT_PORT/v2/languages" 180 "$LANGQA_HOME/logs/languagetool-server.log"
  export LT_URL=http://127.0.0.1:$LT_PORT
}

start_llama() {
  if lsof -nP -iTCP:"$LLAMA_PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "run.sh: port $LLAMA_PORT is taken; set LLAMA_PORT" >&2; exit 2; fi
  nice -n 10 "$MEMGUARD" --max-gb 32 -- llama-server -m "$GGUF" --host 127.0.0.1 --port "$LLAMA_PORT" -c 16384 -np 2 -ngl 99 --temp 0 --no-webui --jinja >"$LANGQA_HOME/logs/llama-server.log" 2>&1 &
  PIDS+=($!)
  wait_http "http://127.0.0.1:$LLAMA_PORT/health" 900 "$LANGQA_HOME/logs/llama-server.log"
  export LLAMA_URL=http://127.0.0.1:$LLAMA_PORT
}

case "$STEP" in
  selftest) start_languagetool; node scripts/lang/grammar.mjs --selftest "$@" ;;
  grammar) start_languagetool; node scripts/lang/grammar.mjs --out "$OUT/grammar.json" "$@" ;;
  meaning)
    node scripts/lang/extract.mjs --samples "$OUT/strings.json"
    nice -n 10 "$MEMGUARD" --max-gb 14 -- "$LANGQA_HOME/venv/bin/python" scripts/lang/backtranslate.py --strings "$OUT/strings.json" --out "$OUT/bt.json" "$@" ;;
  pairs)
    nice -n 10 "$MEMGUARD" --max-gb 14 -- "$LANGQA_HOME/venv/bin/python" scripts/lang/backtranslate.py --pairs "$1" --out "${2:-$OUT/pairs-out.json}" ;;
  review) start_llama; node scripts/lang/review.mjs --out "$OUT/review.json" "$@" ;;
  detach)
    WHAT=${1:?detach needs a step}; shift
    WORK=$LANGQA_HOME/work/$WHAT
    rm -rf "$WORK"; mkdir -p "$WORK"
    # A copy, so the job does not change under the next rb run in this checkout.
    tar -cf - --exclude node_modules --exclude .git --exclude dist --exclude .e2e --exclude backend/target --exclude .langqa scripts/lang src docs/language | tar -xf - -C "$WORK"
    trap - EXIT
    (cd "$WORK" && nohup bash scripts/lang/run.sh "$WHAT" "$@" >"$LANGQA_HOME/logs/$WHAT.log" 2>&1 &)
    echo "started $WHAT in $WORK; log $LANGQA_HOME/logs/$WHAT.log" ;;
  status)
    pgrep -fl "scripts/lang/run.sh|languagetool-server|backtranslate.py|$GGUF" || echo "nothing of ours is running"
    for f in "$LANGQA_HOME"/logs/{grammar,meaning,review}.log; do [ -f "$f" ] && { echo "== $f"; tail -5 "$f"; }; done; ls -la "$OUT" ;;
  *) sed -n 2,18p "$0"; exit 2 ;;
esac
