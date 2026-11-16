#!/bin/bash
# Install the language QA tools on the build host. Idempotent: run it again and
# it only fetches what is missing.
#
#   ~/kani-logs/remote/rb . -- 'bash scripts/lang/host-setup.sh'
#
# Everything lands under $LANGQA_HOME (default: this project's own directory on
# the build host's external volume). Nothing is installed system-wide; Java,
# llama.cpp and uv are Homebrew formulas the host already has.
#
# What it fetches, and from where, is recorded in docs/language/PROVENANCE.md.
set -euo pipefail
export PATH=/opt/homebrew/opt/openjdk/bin:/opt/homebrew/bin:$PATH
SRC_DIR=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=${LANGQA_HOME:-/Volumes/macos_4TB_external_1/wai-build/im-lang/qa-pipeline}
MEMGUARD=${MEMGUARD:-/Volumes/macos_4TB_external_1/wai-build/bin/memguard}
mkdir -p "$HOME_DIR"/{dl,dict,models,cache,tmp,logs}
# Caches and temporary files stay on the external volume: the host's internal disk is full.
export HF_HOME="$HOME_DIR/cache/hf" UV_CACHE_DIR="$HOME_DIR/cache/uv" PIP_CACHE_DIR="$HOME_DIR/cache/pip" TMPDIR="$HOME_DIR/tmp"
export HF_HUB_DISABLE_TELEMETRY=1
cd "$HOME_DIR"

step() { printf '\n== %s\n' "$*"; }

# --- LanguageTool (LGPL-2.1), the standalone server ---
LT_VERSION=${LT_VERSION:-stable}
if ! ls "$HOME_DIR"/LanguageTool-*/languagetool-server.jar >/dev/null 2>&1; then
  step "LanguageTool $LT_VERSION"
  curl -fL --retry 3 -o dl/LanguageTool.zip "https://languagetool.org/download/LanguageTool-$LT_VERSION.zip"
  shasum -a 256 dl/LanguageTool.zip | tee dl/LanguageTool.zip.sha256
  unzip -q -o dl/LanguageTool.zip -d "$HOME_DIR"
fi
ls -d "$HOME_DIR"/LanguageTool-*/ | tee logs/languagetool.version

# --- Hunspell (LGPL/GPL/MPL tri-licence), built from the release tarball into our own prefix ---
HUNSPELL_VERSION=1.7.2
if [ ! -x "$HOME_DIR/hunspell/bin/hunspell" ]; then
  step "Hunspell $HUNSPELL_VERSION"
  curl -fL --retry 3 -o dl/hunspell.tar.gz "https://github.com/hunspell/hunspell/releases/download/v$HUNSPELL_VERSION/hunspell-$HUNSPELL_VERSION.tar.gz"
  shasum -a 256 dl/hunspell.tar.gz | tee dl/hunspell.tar.gz.sha256
  rm -rf tmp/hunspell-build && mkdir -p tmp/hunspell-build
  tar -xzf dl/hunspell.tar.gz -C tmp/hunspell-build --strip-components 1
  (cd tmp/hunspell-build && ./configure --prefix="$HOME_DIR/hunspell" --disable-nls >configure.log 2>&1 && nice -n 10 make -j4 >make.log 2>&1 && make install >install.log 2>&1) \
    || { echo "hunspell build failed; see $HOME_DIR/tmp/hunspell-build/*.log" >&2; exit 1; }
fi
"$HOME_DIR/hunspell/bin/hunspell" --version | head -1
# hspell: whole-word queries to the same library (scripts/lang/hspell.cpp says why).
if [ -f "$SRC_DIR/hspell.cpp" ] && { [ ! -x "$HOME_DIR/hunspell/bin/hspell" ] || [ "$SRC_DIR/hspell.cpp" -nt "$HOME_DIR/hunspell/bin/hspell" ]; }; then
  step "hspell"
  clang++ -std=c++17 -O1 -I"$HOME_DIR/hunspell/include" "$SRC_DIR/hspell.cpp" "$HOME_DIR"/hunspell/lib/libhunspell-1.7.a -liconv -o "$HOME_DIR/hunspell/bin/hspell"
fi

# --- Hunspell dictionaries, from LibreOffice's dictionaries repository at a pinned commit ---
# <our code> <path of the .aff without extension in the repository>
DICT_COMMIT=${DICT_COMMIT:-c0865a85eb67dc377f2cf8e8fe2c4fa9e53f0dcb}
if [ ! -f dict/COMMIT ]; then
  step "resolve LibreOffice/dictionaries commit"
  curl -fsSL "https://api.github.com/repos/LibreOffice/dictionaries/commits/$DICT_COMMIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])" > dict/COMMIT
fi
SHA=$(cat dict/COMMIT)
echo "dictionaries at $SHA"
while read -r code path; do
  [ -n "$code" ] || continue
  if [ ! -s "dict/$code.aff" ] || [ ! -s "dict/$code.dic" ]; then
    step "dictionary $code ($path)"
    curl -fL --retry 3 -sS -o "dict/$code.aff" "https://raw.githubusercontent.com/LibreOffice/dictionaries/$SHA/$path.aff"
    curl -fL --retry 3 -sS -o "dict/$code.dic" "https://raw.githubusercontent.com/LibreOffice/dictionaries/$SHA/$path.dic"
  fi
done <<'DICTS'
en en/en_US
es es/es_ES
fr fr_FR/dictionaries/fr
de de/de_DE_frami
it it_IT/it_IT
pt-BR pt_BR/pt_BR
pt-PT pt_PT/pt_PT
pl pl_PL/pl_PL
ru ru_RU/ru_RU
ar ar/ar
hi hi_IN/hi_IN
ko ko_KR/ko_KR
vi vi/vi_VN
th th_TH/th_TH
id id/id_ID
DICTS
# The licence or README of each dictionary, kept beside it for the provenance record.
while read -r code file; do
  [ -n "$code" ] || continue
  [ -s "dict/README-$code.txt" ] || curl -fL --retry 3 -sS -o "dict/README-$code.txt" "https://raw.githubusercontent.com/LibreOffice/dictionaries/$SHA/$file"
done <<'READMES'
en en/README_en_US.txt
es es/README_hunspell_es.txt
fr fr_FR/package-description.txt
de de/README_de_DE_frami.txt
it it_IT/README_it_IT.txt
pt-BR pt_BR/README_pt_BR.txt
pt-PT pt_PT/README_pt_PT.txt
pl pl_PL/README_pl_PL.txt
ru ru_RU/README_ru_RU.txt
ar ar/README_ar.txt
hi hi_IN/README_hi_IN.txt
ko ko_KR/README_ko_KR.txt
vi vi/LICENSES-en.txt
th th_TH/README_th_TH.txt
id id/README-dict.adoc
READMES
ls -la dict | head -60

# --- Python environment for the translation model and the similarity score ---
if [ ! -x venv/bin/python ]; then
  step "python venv"
  uv venv --python 3.12 venv
fi
if ! venv/bin/python -c 'import ctranslate2, sentencepiece, sentence_transformers, huggingface_hub' 2>/dev/null; then
  step "python packages"
  uv pip install --python venv/bin/python 'ctranslate2>=4' sentencepiece 'transformers>=4.40' sentence-transformers huggingface_hub sacrebleu
fi
venv/bin/python - <<'PY'
import ctranslate2, sentencepiece, transformers, sentence_transformers, huggingface_hub, sacrebleu
for m in (ctranslate2, sentencepiece, transformers, sentence_transformers, huggingface_hub, sacrebleu):
    print(m.__name__, m.__version__)
PY

# --- Models (all Apache-2.0), at pinned revisions ---
fetch() {  # fetch <repo> <revision> <dir> [file ...]
  local repo=$1 rev=$2 dir=$3; shift 3
  if [ -f "models/$dir/.complete" ]; then echo "have $repo@$rev"; return; fi
  step "model $repo@$rev"
  "$MEMGUARD" --max-gb 6 -- venv/bin/python - "$repo" "$rev" "models/$dir" "$@" <<'PY'
import sys
from huggingface_hub import snapshot_download
repo, rev, dest, *files = sys.argv[1:]
snapshot_download(repo, revision=rev, local_dir=dest, allow_patterns=files or None)
PY
  touch "models/$dir/.complete"
}
fetch Nextcloud-AI/madlad400-3b-mt-ct2-int8 "${MADLAD_REV:-aa32bbdeba7880eff2096ec044cb155a340a9400}" madlad400-3b-mt-ct2-int8
fetch sentence-transformers/all-MiniLM-L6-v2 "${MINILM_REV:-1110a243fdf4706b3f48f1d95db1a4f5529b4d41}" all-MiniLM-L6-v2 config.json 'model.safetensors' 'tokenizer*' 'vocab.txt' 'special_tokens_map.json' 'modules.json' 'sentence_bert_config.json' 'config_sentence_transformers.json' '1_Pooling/*' README.md
# LaBSE: a dedicated bitext model; scores a translation against its English directly (a second signal
# beside back-translation, which copies short labels through untranslated).
fetch sentence-transformers/LaBSE "${LABSE_REV:-836121a0533e5664b21c7aacc5d22951f2b8b25b}" LaBSE config.json model.safetensors 'tokenizer*' vocab.txt special_tokens_map.json modules.json sentence_bert_config.json config_sentence_transformers.json '1_Pooling/*' '2_Dense/config.json' '2_Dense/model.safetensors' README.md
# The reviewer: Google's own 4-bit (QAT) GGUF of Gemma 4 26B-A4B, a mixture of experts with about
# 4B parameters active per token. The dense 31B (unsloth/gemma-4-31B-it-GGUF, Q4_K_M, fetched
# first) generated 4 tokens/s on the shared GPU: about ten hours for the fifteen languages.
# curl, not the hub client (which held 6 GB of memory fetching a file this size), and resumable.
if [ "${SKIP_REVIEWER:-0}" != 1 ]; then
  REVIEWER_REPO=${REVIEWER_REPO:-google/gemma-4-26B-A4B-it-qat-q4_0-gguf}
  REVIEWER_REV=${REVIEWER_REV:-d1c082be9cf3c8a514acf63b8761f4b41935842e}
  REVIEWER_FILE=${REVIEWER_FILE:-gemma-4-26B_q4_0-it.gguf}
  REVIEWER_SHA256=${REVIEWER_SHA256:-3eca3b8f6d7baf218a7dd6bba5fb59a56ee25fe2d567b6f5f589b4f697eca51d}
  D=models/$(basename "$REVIEWER_REPO")
  mkdir -p "$D"
  if [ ! -f "$D/.verified" ]; then
    step "model $REVIEWER_REPO@$REVIEWER_REV ($REVIEWER_FILE)"
    curl -fL --retry 5 -C - -sS -o "$D/$REVIEWER_FILE" "https://huggingface.co/$REVIEWER_REPO/resolve/$REVIEWER_REV/$REVIEWER_FILE"
    echo "$REVIEWER_SHA256  $D/$REVIEWER_FILE" | shasum -a 256 -c - && touch "$D/.verified"
  fi
fi
du -sh models/* 2>/dev/null
echo "setup complete: $HOME_DIR"
