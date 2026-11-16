#!/bin/bash
# The tool-backed language checks of the page areas, on the build host:
#
#   ~/kani-logs/remote/rb . -- 'bash scripts/pages-rest/lang-host.sh <step>'
#
#   selftest     prove Hunspell and LanguageTool flag a known-bad input in each language
#   spell        Hunspell over every string                      -> $OUT/spell.json
#   grammar      LanguageTool over every string                  -> $OUT/grammar.json
#   bt-start     translate every string back to English (MADLAD-400), detached (BT_DEVICE=mps: minutes, not hours)
#   bt-status    is it running, and the tail of its log          -> $OUT/bt.json when done
#   bitext       add LaBSE's score of each translation against its English to $OUT/bt.json
#   bt-pairs F O back-translate and score only the strings in F ([{id, lang, text, english}]) -> O
#
# The tools are the ones branch lang/qa-pipeline installed on the host
# ($LANGQA_HOME: Hunspell with its dictionaries, LanguageTool, MADLAD-400, a Python
# environment). This script only reads them. What it writes goes under
# im-lang/pages-rest. LanguageTool is started on a port of its own, bound to 127.0.0.1,
# under memguard, and stopped by its own pid when the step ends.
set -euo pipefail
export PATH=/opt/homebrew/opt/openjdk/bin:/opt/homebrew/bin:$PATH
LANGQA_HOME=${LANGQA_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
MINE=${MINE:-/Volumes/macos_4TB_external_1/wai-build/im-lang/pages-rest}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
export OUT=$MINE/lang
export HSPELL=$LANGQA_HOME/hunspell/bin/hspell DICT_DIR=$LANGQA_HOME/dict
export MADLAD_DIR=$LANGQA_HOME/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$LANGQA_HOME/models/all-MiniLM-L6-v2 LABSE_DIR=$LANGQA_HOME/models/LaBSE
export HF_HOME=$MINE/cache/hf TMPDIR=$MINE/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
LT_PORT=${LT_PORT:-46340}
mkdir -p "$OUT" "$MINE/logs" "$TMPDIR" "$HF_HOME"
cd "$(dirname "$0")/../.."
STEP=${1:-}

PIDS=()
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" 2>/dev/null || true; }
cleanup() { for p in "${PIDS[@]:-}"; do if [ -n "$p" ]; then kill_tree "$p"; fi; done; }
trap cleanup EXIT

start_languagetool() {
  if lsof -nP -iTCP:"$LT_PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "lang-host.sh: port $LT_PORT is taken; set LT_PORT" >&2; exit 2; fi
  local dir; dir=$(ls -d "$LANGQA_HOME"/LanguageTool-*/ | tail -1)
  nice -n 10 "$MEMGUARD" --max-gb 8 -- java -Xmx4g -cp "$dir/languagetool-server.jar" org.languagetool.server.HTTPServer --port "$LT_PORT" >"$MINE/logs/languagetool-server.log" 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 180); do curl -fsS -o /dev/null "http://127.0.0.1:$LT_PORT/v2/languages" 2>/dev/null && break; sleep 1; done
  curl -fsS -o /dev/null "http://127.0.0.1:$LT_PORT/v2/languages" || { echo "LanguageTool did not start" >&2; tail -20 "$MINE/logs/languagetool-server.log" >&2; exit 1; }
  export LT_URL=http://127.0.0.1:$LT_PORT
}

case "$STEP" in
  selftest) start_languagetool; node scripts/pages-rest/lang-check.mjs selftest 2>&1 | tee "$MINE/logs/selftest.log" ;;
  spell)
    node scripts/pages-rest/lang-check.mjs extract "$OUT/strings.json"
    node scripts/pages-rest/lang-check.mjs spell "$OUT/strings.json" "$OUT/spell.json"
    node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const [l,v] of Object.entries(d.languages))console.log(l, v.checked?`${v.words} words, ${Object.keys(v.rejected).length} rejected`:`not checked: ${v.why}`)' "$OUT/spell.json" ;;
  grammar)
    start_languagetool
    node scripts/pages-rest/lang-check.mjs extract "$OUT/strings.json"
    node scripts/pages-rest/lang-check.mjs grammar "$OUT/strings.json" "$OUT/grammar.json" ;;
  bt-start)
    if pgrep -f "scripts/pages-rest/backtranslate.py --pairs pairs.json" >/dev/null; then echo "already running"; exit 0; fi
    node scripts/pages-rest/lang-check.mjs extract "$OUT/strings.json"
    # A copy, so the job does not change under the next rb run in this checkout.
    rm -rf "$MINE/work"; mkdir -p "$MINE/work/scripts/pages-rest"
    cp scripts/pages-rest/backtranslate.py "$MINE/work/scripts/pages-rest/"
    cp "$OUT/strings-pairs.json" "$MINE/work/pairs.json"
    trap - EXIT
    # Every descriptor of the detached job goes to the log or /dev/null: a job that holds the
    # ssh session's output keeps rb waiting until it ends (seen 2026-11-16).
    (cd "$MINE/work" && exec nohup nice -n 15 "$MEMGUARD" --max-gb 14 -- "$LANGQA_HOME/venv/bin/python" scripts/pages-rest/backtranslate.py --pairs pairs.json --out "$OUT/bt.json" ${BT_ARGS:-} >"$MINE/logs/bt.log" 2>&1 </dev/null) >/dev/null 2>&1 </dev/null &
    echo "started; log $MINE/logs/bt.log, result $OUT/bt.json" ;;
  bitext)
    "$MEMGUARD" --max-gb 8 -- "$LANGQA_HOME/venv/bin/python" scripts/pages-rest/bitext.py --bt "$OUT/bt.json" ;;
  bt-pairs)
    # A few strings (after a fix), in the foreground: the full set is bt-start's job.
    "$MEMGUARD" --max-gb 14 -- "$LANGQA_HOME/venv/bin/python" scripts/pages-rest/backtranslate.py --pairs "$2" --out "$3" ${BT_ARGS:-}
    "$MEMGUARD" --max-gb 8 -- "$LANGQA_HOME/venv/bin/python" scripts/pages-rest/bitext.py --bt "$3" ;;
  bt-status)
    pgrep -fl "scripts/pages-rest/backtranslate.py --pairs pairs.json" || echo "not running"
    tail -20 "$MINE/logs/bt.log" 2>/dev/null || true
    ls -la "$OUT" ;;
  *) sed -n 2,14p "$0"; exit 2 ;;
esac
