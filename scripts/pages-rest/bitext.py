#!/usr/bin/env python3
"""
A second signal for the meaning check: LaBSE's similarity of each translation to its English,
with no back-translation in between.

  bitext.py --bt bt.json [--out bt.json]

Reads the output of backtranslate.py ([{id, lang, text, english, back, cos, ...}]) and adds,
to every row that lacks it:

  xcos      LaBSE (sentence-transformers/LaBSE, Apache-2.0; a bitext model trained on
            translation pairs) cosine of the translated string against the English one;
  controlX  the same against the WRONG English (the next string's in that language), so a
            run can show the score tells right from wrong.

Why: MADLAD-400 often copies a one-word label through untranslated, or turns a short label
into a word that is right but different ("Still in" -> "In the competition"), and the
back-translation's score then says little. Branch lang/qa-pipeline (scripts/lang/
backtranslate.py, meaning.mjs) flags a string only when both scores are under 0.6; this
branch's summarise.mjs uses the same rule. Nothing here decides what is wrong.

The model files are the ones branch lang/qa-pipeline installed on the build host
(LABSE_DIR; scripts/pages-rest/lang-host.sh sets it).
"""
import argparse, json, os, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--bt', required=True)
ap.add_argument('--out', default='')
ap.add_argument('--model', default=os.environ.get('LABSE_DIR', ''))
# The CPU managed about 2 CPU-minutes in 15 minutes on the loaded build host (load 150 on 32
# cores, 2026-11-16) and had not finished; the GPU (mps) is the default where there is one.
ap.add_argument('--device', default=os.environ.get('BITEXT_DEVICE', ''))
args = ap.parse_args()
if not args.model:
    sys.exit('bitext.py: set LABSE_DIR or pass --model')

import torch
from sentence_transformers import SentenceTransformer

device = args.device or ('mps' if torch.backends.mps.is_available() else 'cpu')
model = SentenceTransformer(args.model, device=device)
print(f'LaBSE on {device}', file=sys.stderr, flush=True)
rows = json.load(open(args.bt, encoding='utf8'))


def cos(a_texts, b_texts):
    a = model.encode(a_texts, normalize_embeddings=True, batch_size=64)
    b = model.encode(b_texts, normalize_embeddings=True, batch_size=64)
    return [round(float(c), 4) for c in (a * b).sum(axis=1)]


t0 = time.time()
langs = []
for r in rows:
    if r['lang'] not in langs:
        langs.append(r['lang'])
for lang in langs:
    mine = [r for r in rows if r['lang'] == lang]
    todo = [r for r in mine if 'xcos' not in r]
    if not todo:
        continue
    right = cos([r['text'] for r in mine], [r['english'] for r in mine])
    wrong = cos([r['text'] for r in mine], [mine[(i + 1) % len(mine)]['english'] for i in range(len(mine))])
    for r, x, w in zip(mine, right, wrong):
        r['xcos'] = x
        r['controlX'] = w
    rs, ws = sorted(right), sorted(wrong)
    print(f'{lang}: {len(mine)} strings, median LaBSE {rs[len(rs) // 2]:.2f} against the right English, {ws[len(ws) // 2]:.2f} against the wrong one; {time.time() - t0:.0f}s', file=sys.stderr, flush=True)
    # After each language, so a run that is stopped keeps what it did (a row with xcos is skipped next time).
    json.dump(rows, open(args.out or args.bt, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
