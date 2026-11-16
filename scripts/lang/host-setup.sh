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
fetch Nextcloud-AI/madlad400-3b-mt-ct2-int8 "${MADLAD_REV:-main}" madlad400-3b-mt-ct2-int8
fetch sentence-transformers/all-MiniLM-L6-v2 "${MINILM_REV:-main}" all-MiniLM-L6-v2
if [ "${SKIP_REVIEWER:-0}" != 1 ]; then
  fetch unsloth/gemma-4-31B-it-GGUF "${GEMMA_REV:-main}" gemma-4-31B-it-GGUF gemma-4-31B-it-Q4_K_M.gguf
fi
du -sh models/* 2>/dev/null
echo "setup complete: $HOME_DIR"
