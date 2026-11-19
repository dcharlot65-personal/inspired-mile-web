#!/usr/bin/env python3
"""Download the OPUS-MT models (Helsinki-NLP, one Marian model per language into English) and convert
each to CTranslate2 int8, for the back-translation of the play content.

  install-opus.py <dir>        -> <dir>/<lang>/ (CTranslate2 model + tokenizer files), <dir>/MODELS.tsv

Why these: a dedicated translation model of about 77 million parameters per language, a fortieth of
MADLAD-400 3B, so the whole content can be back-translated on a build host whose cores are all taken.
Each model's licence is read from its own model card and written to MODELS.tsv with the revision.
Network: huggingface.co only. Writes only under <dir>.
"""
import os, re, sys, shutil, json
from huggingface_hub import snapshot_download, HfApi
import ctranslate2

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
# Portuguese has no model of its own into English; the Romance one names Portuguese among its sources.
MODELS = {'es': 'opus-mt-es-en', 'fr': 'opus-mt-fr-en', 'de': 'opus-mt-de-en', 'it': 'opus-mt-it-en', 'pt': 'opus-mt-ROMANCE-en',
          'pl': 'opus-mt-pl-en', 'ru': 'opus-mt-ru-en', 'ar': 'opus-mt-ar-en', 'hi': 'opus-mt-hi-en', 'zh': 'opus-mt-zh-en',
          'ja': 'opus-mt-ja-en', 'ko': 'opus-mt-ko-en', 'vi': 'opus-mt-vi-en', 'th': 'opus-mt-th-en', 'id': 'opus-mt-id-en'}
api = HfApi()
rows = []
for lang, name in MODELS.items():
    repo = f'Helsinki-NLP/{name}'
    dst = os.path.join(out, lang)
    try:
        info = api.model_info(repo)
        raw = os.path.join(out, '_download', name)
        snapshot_download(repo, local_dir=raw, revision=info.sha,
                          allow_patterns=['*.json', '*.spm', 'vocab*', 'README.md', 'pytorch_model.bin', 'model.safetensors', '*.txt'])
        card = open(os.path.join(raw, 'README.md'), encoding='utf-8').read() if os.path.exists(os.path.join(raw, 'README.md')) else ''
        lic = (re.search(r'^license:\s*(\S+)', card, re.M) or [None, getattr(info.card_data, 'license', None) if info.card_data else None])[1]
        if not os.path.exists(os.path.join(dst, 'model.bin')):
            ctranslate2.converters.TransformersConverter(raw).convert(dst, quantization='int8', force=True)
            # The tokenizer, with the original config.json it is read by, beside the converted model (whose own config.json differs).
            os.makedirs(os.path.join(dst, 'tok'), exist_ok=True)
            for f in os.listdir(raw):
                if not f.endswith(('.bin', '.safetensors')) and os.path.isfile(os.path.join(raw, f)):
                    shutil.copy(os.path.join(raw, f), os.path.join(dst, 'tok', f))
        rows.append([lang, repo, info.sha, str(lic)])
        print(lang, repo, info.sha[:10], lic, flush=True)
    except Exception as e:
        rows.append([lang, repo, '-', f'FAILED: {e}'])
        print(lang, repo, 'FAILED', e, flush=True)
open(os.path.join(out, 'MODELS.tsv'), 'w').write('lang\tmodel\trevision\tlicence (model card)\n' + '\n'.join('\t'.join(r) for r in rows) + '\n')
