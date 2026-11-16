#!/bin/bash
# The meaning and spelling checks of the play content, on the build host.
#   bash scripts/lang-content/qa/run.sh pairs            write the pairs and texts into $OUT
#   bash scripts/lang-content/qa/run.sh spell            Hunspell over each language that has a dictionary -> $OUT/spell-<lang>.txt
#   bash scripts/lang-content/qa/run.sh detach-meaning   back-translate every language, detached, under memguard -> $OUT/bt-<lang>.json
#   bash scripts/lang-content/qa/run.sh status
# Tools and models are the shared language pipeline's installation (LANGQA_HOME); this script
# installs nothing. Its own files go to $OUT, a directory of this task's own.
set -euo pipefail
LANGQA_HOME=${LANGQA_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
OUT=${OUT:-/Volumes/macos_4TB_external_1/wai-build/im-lang/pages-play/qa}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
case "${1:-}" in
  pairs) node "$HERE/pairs.mjs" "$OUT" ;;
  spell)
    ls "$LANGQA_HOME/dict" | tr '\n' ' '; echo
    for f in "$OUT"/text-*.txt; do
      l=$(basename "$f" .txt); l=${l#text-}
      d=$(ls "$LANGQA_HOME/dict/$l".aff "$LANGQA_HOME/dict/${l}_"*.aff 2>/dev/null | head -1 || true)
      [ -n "$d" ] || { echo "$l: no dictionary"; continue; }
      "$LANGQA_HOME/hunspell/bin/hunspell" -i utf-8 -l -d "${d%.aff}" < "$f" | sort | uniq -c | sort -rn > "$OUT/spell-$l.txt" || true
      echo "$l: $(wc -l < "$OUT/spell-$l.txt") unknown words (${d##*/})"
    done ;;
  detach-meaning)
    cp "$HERE/bt.py" "$OUT/bt.py"
    cat > "$OUT/meaning.sh" <<SH
#!/bin/bash
export MADLAD_DIR=$LANGQA_HOME/models/madlad400-3b-mt-ct2-int8 MINILM_DIR=$LANGQA_HOME/models/all-MiniLM-L6-v2 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false BT_THREADS=6
for f in $OUT/pairs-*.json; do
  l=\$(basename \$f .json); l=\${l#pairs-}
  [ -s $OUT/bt-\$l.json ] && continue
  echo "== \$l \$(date)"
  nice -n 10 $LANGQA_HOME/venv/bin/python $OUT/bt.py \$f $OUT/bt-\$l.json.tmp && mv $OUT/bt-\$l.json.tmp $OUT/bt-\$l.json
done
echo "== DONE \$(date)"
SH
    chmod +x "$OUT/meaning.sh"
    if [ -f "$OUT/meaning.pid" ] && kill -0 "$(cat "$OUT/meaning.pid")" 2>/dev/null; then echo "already running: pid $(cat "$OUT/meaning.pid")"; exit 0; fi
    nohup "$MEMGUARD" --max-gb 14 -- "$OUT/meaning.sh" > "$OUT/meaning.log" 2>&1 &
    echo $! > "$OUT/meaning.pid"; echo "started: pid $!" ;;
  status)
    ls "$OUT" | grep -c '^bt-.*json$' || true; tail -3 "$OUT/meaning.log" 2>/dev/null || true
    if [ -f "$OUT/meaning.pid" ] && kill -0 "$(cat "$OUT/meaning.pid")" 2>/dev/null; then echo running; else echo "not running"; fi ;;
  *) sed -n 2,8p "$0" ;;
esac
