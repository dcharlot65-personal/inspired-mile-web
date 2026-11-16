#!/usr/bin/env python3
"""
Meaning by back-translation, with a model that did not write the text.

Each translated string of the page areas (already rendered as the sentence a player reads,
by lang-check.mjs extract) is translated back to English by MADLAD-400 (Google,
Apache-2.0; a dedicated translation model, run locally through CTranslate2), and the result
is compared with the English source by the cosine similarity of sentence embeddings
(all-MiniLM-L6-v2).

  backtranslate.py --pairs strings-pairs.json --out bt.json [--lang ar,hi] [--limit N]

Input: [{id, lang, text, english}]. Output: the same, with `back`, `cos`, and `controlCos`.

Nothing here decides what is wrong. It writes scores; a person reads the low ones
(docs/language/pages-rest.md says which were read and what was changed).

The control: each back-translation is also scored against the WRONG English sentence (the
next string's). If the scores cannot tell right from wrong, the check proves nothing; the
summary printed at the end says how far apart the two are.

This is the simplest equivalent of scripts/lang/backtranslate.py on branch
lang/qa-pipeline, which had not landed in main when this was written. It uses the same
model files and the same Python environment, installed by that branch on the build host
(MADLAD_DIR, MINILM_DIR; scripts/pages-rest/lang-host.sh sets them).
"""
import argparse, json, os, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--pairs', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--lang', default='')
ap.add_argument('--limit', type=int, default=0)
ap.add_argument('--model', default=os.environ.get('MADLAD_DIR', ''))
ap.add_argument('--embedder', default=os.environ.get('MINILM_DIR', ''))
ap.add_argument('--threads', type=int, default=int(os.environ.get('BT_THREADS', '6')))
ap.add_argument('--batch', type=int, default=16)
args = ap.parse_args()

import ctranslate2
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer

tok = AutoTokenizer.from_pretrained(args.model)
translator = ctranslate2.Translator(args.model, device='cpu', compute_type='int8', inter_threads=1, intra_threads=args.threads)
embedder = SentenceTransformer(args.embedder, device='cpu')


def back(texts):
    out = []
    for i in range(0, len(texts), args.batch):
        chunk = texts[i:i + args.batch]
        src = [tok.convert_ids_to_tokens(tok.encode('<2en> ' + t)) for t in chunk]
        res = translator.translate_batch(src, beam_size=4, max_decoding_length=256, repetition_penalty=1.1)
        for r in res:
            out.append(tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip())
    return out


def cosines(a_texts, b_texts):
    a = embedder.encode(a_texts, normalize_embeddings=True, batch_size=64)
    b = embedder.encode(b_texts, normalize_embeddings=True, batch_size=64)
    return [round(float(c), 4) for c in (a * b).sum(axis=1)]


pairs = json.load(open(args.pairs, encoding='utf8'))
only = [l for l in args.lang.split(',') if l]
if only:
    pairs = [p for p in pairs if p['lang'] in only]

# Resume: a language already in the output file is kept as it is.
done = []
if os.path.exists(args.out):
    try:
        done = json.load(open(args.out, encoding='utf8'))
    except Exception:
        done = []
have = {p['lang'] for p in done}

t0 = time.time()
langs = []
for p in pairs:
    if p['lang'] not in langs:
        langs.append(p['lang'])
# --lang also gives the order: the languages least sure of can be read first.
if only:
    langs = [l for l in only if l in langs]
for lang in langs:
    if lang in have:
        continue
    mine = [p for p in pairs if p['lang'] == lang]
    if args.limit:
        mine = mine[:args.limit]
    bts = back([p['text'] for p in mine])
    right = cosines(bts, [p['english'] for p in mine])
    wrong = cosines(bts, [mine[(i + 1) % len(mine)]['english'] for i in range(len(mine))])
    for p, bt, r, w in zip(mine, bts, right, wrong):
        p.update(back=bt, cos=r, controlCos=w)
    done.extend(mine)
    json.dump(done, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    rs = sorted(right)
    ws = sorted(wrong)
    print(f'{lang}: {len(mine)} strings, median cos {rs[len(rs) // 2]:.2f} against the right English, {ws[len(ws) // 2]:.2f} against the wrong one; {time.time() - t0:.0f}s elapsed', file=sys.stderr, flush=True)
