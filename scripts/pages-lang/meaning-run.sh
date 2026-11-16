#!/bin/bash
# Back-translation of the page areas, on the build host, with lang/qa-pipeline's own script.
#
#   QA_SRC=<a copy of lang/qa-pipeline's scripts/lang> WORK=<dir> bash meaning-run.sh <pairs.json>
#   BASE=<an earlier run's WORK> QA_SRC=... WORK=<new dir> bash meaning-run.sh <pairs of changed strings>
#
# <pairs.json> comes from `node scripts/pages-lang/pairs.mjs <pairs.json> --min-words 1` (every
# string), or `--changed <earlier bt.json>` (only strings whose text is not the text scored then).
# QA_SRC is that branch's scripts/lang, taken as it stands, for example:
#   git archive lang/qa-pipeline scripts/lang | tar -x -C <dir>    (QA_SRC=<dir>/scripts/lang)
# Each language in the pairs goes through `backtranslate.py --pairs` on its own (MADLAD-400 back to
# English, MiniLM cosine and chrF against the English, LaBSE against the English directly), so a run
# the host stops loses one language, not all of them, and a second start skips the languages done.
# With BASE, each language's rows from the earlier run (its merged/ files when it was itself a
# re-run, otherwise its lang/ files) are kept except those translated again.
# Then bt-control.py adds the control (each string against the wrong English) into $WORK/bt.json.
#
# Every model runs under the host's memguard. Start it detached:
#   nohup bash meaning-run.sh pairs.json > $WORK/run.log 2>&1 &
set -euo pipefail
PAIRS=$1
: "${QA_SRC:?a copy of lang/qa-pipeline scripts/lang}" "${WORK:?a work directory}"
Q=${LANGQA_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
PY=$Q/venv/bin/python
HERE=$(cd "$(dirname "$0")" && pwd)
export MADLAD_DIR=$Q/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$Q/models/all-MiniLM-L6-v2 LABSE_DIR=$Q/models/LaBSE
export HF_HOME=$WORK/cache HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
# The GPU: CTranslate2's MPS backend with the model's default compute type, as lang/qa-pipeline runs it
# (about one string a second on 2026-11-16). The CPU took 17 s a string at the host's load that day.
export BT_DEVICE=${BT_DEVICE:-mps} BT_BEAM=${BT_BEAM:-4} BT_THREADS=${BT_THREADS:-6}
ALL="hi th ar vi zh ja ko pl ru id es fr de it pt"
mkdir -p "$WORK/lang"
# The languages that have pairs, weakest first.
LANGS=${LANGS:-$("$PY" -I -c "import json,sys; have={p['lang'] for p in json.load(open(sys.argv[1]))}; print(' '.join(l for l in sys.argv[2].split() if l in have))" "$PAIRS" "$ALL")}
for l in $LANGS; do
  out=$WORK/lang/bt-$l.json
  if [ -s "$out" ]; then echo "$l: done before"; continue; fi
  "$PY" -I -c "import json,sys; p=[x for x in json.load(open(sys.argv[1])) if x['lang']==sys.argv[2]]; json.dump(p, open(sys.argv[3],'w'), ensure_ascii=False)" "$PAIRS" "$l" "$WORK/lang/pairs-$l.json"
  echo "$l: start $(date +%T)"
  "$MEMGUARD" --max-gb "${BT_MEM_GB:-20}" -- "$PY" -I "$QA_SRC/backtranslate.py" --pairs "$WORK/lang/pairs-$l.json" --out "$out.part"
  mv "$out.part" "$out"
  echo "$l: end $(date +%T)"
done
files=()
if [ -n "${BASE:-}" ]; then
  mkdir -p "$WORK/merged"
  for l in $ALL; do
    "$PY" -I -c "
import json, os, sys
base, new, out = sys.argv[1:4]
rows = json.load(open(base)) if os.path.exists(base) else []
fresh = json.load(open(new)) if os.path.exists(new) else []
again = {r['id'] for r in fresh}
json.dump([r for r in rows if r['id'] not in again] + fresh, open(out, 'w'), ensure_ascii=False)
" "$( [ -s "$BASE/merged/bt-$l.json" ] && echo "$BASE/merged/bt-$l.json" || echo "$BASE/lang/bt-$l.json" )" "$WORK/lang/bt-$l.json" "$WORK/merged/bt-$l.json"
    files+=("$WORK/merged/bt-$l.json")
  done
else
  for l in $LANGS; do files+=("$WORK/lang/bt-$l.json"); done
fi
"$MEMGUARD" --max-gb 8 -- "$PY" -I "$HERE/bt-control.py" --out "$WORK/bt.json" "${files[@]}"
echo "all done $(date +%T)"
