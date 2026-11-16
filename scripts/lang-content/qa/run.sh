#!/bin/bash
# The meaning and spelling checks of the play content, on the build host.
#   bash scripts/lang-content/qa/run.sh pairs            write the pairs and texts into $OUT
#   bash scripts/lang-content/qa/run.sh spell            Hunspell over each language that has a dictionary -> $OUT/spell-<lang>.txt
#   bash scripts/lang-content/qa/run.sh detach-meaning   back-translate every language, detached, under memguard -> $OUT/bt-<lang>.json
#   bash scripts/lang-content/qa/run.sh install-opus     OPUS-MT models into $TASK/opus (this task's own directory), under memguard
#   bash scripts/lang-content/qa/run.sh detach-opus      back-translate every language with OPUS-MT, detached, under memguard -> $OUT/bto-<lang>.json
#   bash scripts/lang-content/qa/run.sh align            does each translated option still mean its own English option? -> $OUT/align.json
#   bash scripts/lang-content/qa/run.sh status
# MADLAD, the embedder, Hunspell and the Python environment are the shared language pipeline's
# installation (LANGQA_HOME), used read-only. The OPUS-MT models are this task's own ($TASK/opus),
# and so are its outputs ($OUT).
set -euo pipefail
LANGQA_HOME=${LANGQA_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
TASK=${TASK:-/Volumes/macos_4TB_external_1/wai-build/im-lang/pages-play}
OUT=${OUT:-$TASK/qa}
OPUS_DIR=${OPUS_DIR:-$TASK/opus}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
case "${1:-}" in
  pairs) rm -f "$OUT"/pairs-*.json; node "$HERE/pairs.mjs" "$OUT" ;;
  stop) touch "$OUT/STOP"; [ -f "$OUT/meaning.pid" ] && pkill -P "$(cat "$OUT/meaning.pid")" 2>/dev/null; kill "$(cat "$OUT/meaning.pid")" 2>/dev/null; sleep 1; rm -f "$OUT/STOP" "$OUT"/*.tmp; echo stopped ;;
  spell)
    ls "$LANGQA_HOME/dict" | tr '\n' ' '; echo
    for f in "$OUT"/text-*.txt; do
      l=$(basename "$f" .txt); l=${l#text-}
      d=$(ls "$LANGQA_HOME/dict/$l".aff "$LANGQA_HOME/dict/$l"-BR.aff 2>/dev/null | head -1 || true)
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
  [ -f $OUT/STOP ] && { echo "== STOP file found"; exit 0; }
  echo "== \$l \$(date)"
  nice -n 10 $LANGQA_HOME/venv/bin/python $OUT/bt.py \$f $OUT/bt-\$l.json.tmp && mv $OUT/bt-\$l.json.tmp $OUT/bt-\$l.json
done
echo "== DONE \$(date)"
SH
    chmod +x "$OUT/meaning.sh"
    if [ -f "$OUT/meaning.pid" ] && kill -0 "$(cat "$OUT/meaning.pid")" 2>/dev/null; then echo "already running: pid $(cat "$OUT/meaning.pid")"; exit 0; fi
    nohup "$MEMGUARD" --max-gb 14 -- "$OUT/meaning.sh" > "$OUT/meaning.log" 2>&1 &
    echo $! > "$OUT/meaning.pid"; echo "started: pid $!" ;;
  install-opus)
    HF_HOME=$TASK/hf-cache nice -n 10 "$MEMGUARD" --max-gb 8 -- "$LANGQA_HOME/venv/bin/python" "$HERE/install-opus.py" "$OPUS_DIR"
    cat "$OPUS_DIR/MODELS.tsv" ;;
  detach-opus)
    # Installs the models first if they are not there yet (in the same detached job, under the same memguard).
    cp "$HERE/bt.py" "$HERE/install-opus.py" "$OUT/"
    cat > "$OUT/opus.sh" <<SH
#!/bin/bash
if [ ! -s $OPUS_DIR/MODELS.tsv ]; then echo "== installing OPUS-MT \$(date)"; HF_HOME=$TASK/hf-cache nice -n 10 $LANGQA_HOME/venv/bin/python $OUT/install-opus.py $OPUS_DIR || exit 1; cat $OPUS_DIR/MODELS.tsv; fi
export BT_ENGINE=opus OPUS_DIR=$OPUS_DIR MINILM_DIR=$LANGQA_HOME/models/all-MiniLM-L6-v2 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false BT_THREADS=4 BT_BEAM=4
for f in $OUT/pairs-*.json; do
  l=\$(basename \$f .json); l=\${l#pairs-}
  [ -s $OUT/bto-\$l.json ] && continue
  [ -f $OUT/STOP ] && { echo "== STOP file found"; exit 0; }
  echo "== \$l \$(date)"
  nice -n 10 $LANGQA_HOME/venv/bin/python $OUT/bt.py \$f $OUT/bto-\$l.json.tmp && mv $OUT/bto-\$l.json.tmp $OUT/bto-\$l.json
done
echo "== DONE \$(date)"
SH
    chmod +x "$OUT/opus.sh"
    if [ -f "$OUT/opus.pid" ] && kill -0 "$(cat "$OUT/opus.pid")" 2>/dev/null; then echo "already running: pid $(cat "$OUT/opus.pid")"; exit 0; fi
    nohup "$MEMGUARD" --max-gb 8 -- "$OUT/opus.sh" > "$OUT/opus.log" 2>&1 &
    echo $! > "$OUT/opus.pid"; echo "started: pid $!" ;;
  align)
    MINILM_DIR=$LANGQA_HOME/models/all-MiniLM-L6-v2 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 nice -n 10 "$MEMGUARD" --max-gb 4 -- "$LANGQA_HOME/venv/bin/python" "$HERE/align.py" "$OUT" "$OUT/align.json" 2>&1 | grep -v Warning | tail -2 ;;
  status)
    for e in meaning opus; do
      p=bt; [ $e = opus ] && p=bto
      echo "$e: $(ls "$OUT" | grep -c "^$p-.*json$" || true) files done; $(tail -1 "$OUT/$e.log" 2>/dev/null | tr -d '\r' | tail -c 120)"
      if [ -f "$OUT/$e.pid" ] && kill -0 "$(cat "$OUT/$e.pid")" 2>/dev/null; then echo "  running"; else echo "  not running"; fi
    done ;;
  *) sed -n 2,13p "$0" ;;
esac
