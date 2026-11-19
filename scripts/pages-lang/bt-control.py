#!/usr/bin/env python3
"""
The control for a back-translation run: the same scores against the WRONG English.

  bt-control.py --out bt.json bt-es.json bt-fr.json ...

Each input is the output of lang/qa-pipeline's `scripts/lang/backtranslate.py --pairs`
(fields: id, lang, text, english, back, cos, chrf, xcos). That script's --pairs mode scores each
string against its own English only. This adds, per language, the score of each string against
the NEXT string's English, with the same two models:

  controlCos  MiniLM cosine of the back-translation and the wrong English
  xcontrol    LaBSE cosine of the translation and the wrong English

If the wrong pairs score like the right ones, the check proves nothing; scripts/pages-lang/
meaning.mjs reports how many wrong pairs its threshold would flag.

Models: MINILM_DIR (sentence-transformers/all-MiniLM-L6-v2) and LABSE_DIR
(sentence-transformers/LaBSE), the copies lang/qa-pipeline installed on the build host. CPU only;
a few thousand short strings take about a minute.
"""
import argparse, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('inputs', nargs='+')
ap.add_argument('--embedder', default=os.environ.get('MINILM_DIR', ''))
ap.add_argument('--bitext', default=os.environ.get('LABSE_DIR', ''))
args = ap.parse_args()

from sentence_transformers import SentenceTransformer

mini = SentenceTransformer(args.embedder, device='cpu')
labse = SentenceTransformer(args.bitext, device='cpu')


def cos(model, a, b):
    ea = model.encode(a, normalize_embeddings=True, batch_size=64)
    eb = model.encode(b, normalize_embeddings=True, batch_size=64)
    return [round(float(x), 4) for x in (ea * eb).sum(axis=1)]


rows = []
for path in args.inputs:
    part = json.load(open(path, encoding='utf8'))
    missing = [p['id'] for p in part if 'back' not in p or 'xcos' not in p]
    if missing:
        sys.exit(f'{path}: {len(missing)} pairs without a back-translation or a LaBSE score (first: {missing[0]})')
    rows.extend(part)

by_lang = {}
for r in rows:
    by_lang.setdefault(r['lang'], []).append(r)
for lang, part in by_lang.items():
    # The wrong English: the next pair's, within the language, skipping a pair whose English is the same text.
    # A language with no other English to pair with (a probe of one or two strings) gets no control.
    wrong = []
    for i, r in enumerate(part):
        j = (i + 1) % len(part)
        while part[j]['english'] == r['english'] and j != i:
            j = (j + 1) % len(part)
        wrong.append(None if part[j]['english'] == r['english'] else part[j]['english'])
    have = [k for k, w in enumerate(wrong) if w is not None]
    cs = cos(mini, [part[k]['back'] for k in have], [wrong[k] for k in have]) if have else []
    xs = cos(labse, [part[k]['text'] for k in have], [wrong[k] for k in have]) if have else []
    for r in part:
        r['controlCos'] = None
        r['xcontrol'] = None
    for k, c, x in zip(have, cs, xs):
        part[k]['controlCos'] = c
        part[k]['xcontrol'] = x
    print(f'{lang}: {len(part)} pairs', file=sys.stderr)

json.dump(rows, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'{args.out}: {len(rows)} pairs in {len(by_lang)} languages', file=sys.stderr)
