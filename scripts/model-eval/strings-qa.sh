#!/bin/bash
# Check the interface strings the model evaluation added (scripts/model-eval/strings-qa.mjs says
# which, with which tools). On the build host:
#   ~/kani-logs/remote/rb <checkout> -- 'bash scripts/model-eval/strings-qa.sh'
# Uses the language tools the lang/qa-pipeline branch installed, read-only; writes only to
# $QA_OUT and to docs/language/model-eval/strings-qa.json. Its LanguageTool server listens on
# 127.0.0.1:$LT_PORT and is stopped by its pid when this ends.
set -euo pipefail
export PATH=/opt/homebrew/opt/openjdk/bin:/opt/homebrew/bin:$PATH
TOOLS=${TOOLS:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
QA_OUT=${QA_OUT:-/Volumes/macos_4TB_external_1/wai-build/im-lang/model-eval/strings-qa}
MEMGUARD=/Volumes/macos_4TB_external_1/wai-build/bin/memguard
LT_PORT=${LT_PORT:-18791}
mkdir -p "$QA_OUT/tmp"
export HSPELL=$TOOLS/hunspell/bin/hspell DICT_DIR=$TOOLS/dict LT_URL=http://127.0.0.1:$LT_PORT
export MADLAD_DIR=$TOOLS/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$TOOLS/models/all-MiniLM-L6-v2
export HF_HOME=$QA_OUT/hf TMPDIR=$QA_OUT/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false

if lsof -nP -iTCP:"$LT_PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $LT_PORT is taken; set LT_PORT" >&2; exit 2; fi
"$MEMGUARD" --max-gb 8 -- java -Xmx3g -cp "$TOOLS/LanguageTool-6.6/languagetool-server.jar" org.languagetool.server.HTTPServer --port "$LT_PORT" >"$QA_OUT/languagetool.log" 2>&1 &
LT_PID=$!
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" 2>/dev/null || true; }
trap 'kill_tree $LT_PID' EXIT
for _ in $(seq 1 240); do curl -fsS -o /dev/null "$LT_URL/v2/languages" 2>/dev/null && break; sleep 1; done

node scripts/model-eval/strings-qa.mjs prepare "$QA_OUT"
node scripts/model-eval/strings-qa.mjs check "$QA_OUT"
"$MEMGUARD" --max-gb 14 -- "$TOOLS/venv/bin/python" -I scripts/model-eval/backtranslate.py --pairs "$QA_OUT/pairs.json" --out "$QA_OUT/bt.json"
node scripts/model-eval/strings-qa.mjs report "$QA_OUT"
