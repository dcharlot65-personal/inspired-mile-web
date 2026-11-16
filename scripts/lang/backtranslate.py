#!/usr/bin/env python3
"""
Meaning by back-translation, with a model that did not write the text.

Each translated string (as the sentence a player reads) is translated back to
English by MADLAD-400 (Google, Apache-2.0; a dedicated translation model run
locally through CTranslate2), and the result is compared with the English
source: cosine similarity of sentence embeddings (all-MiniLM-L6-v2) and chrF.

  backtranslate.py --strings strings.json --out bt.json [--lang xx,yy]
  backtranslate.py --pairs pairs.json --out out.json      # [{id, lang, text, english}]

Nothing here decides what is wrong. It writes scores; scripts/lang/meaning.mjs
applies the threshold and the reviewed exceptions.

The control: every run also scores each language's strings against the WRONG
English sentence (the next key's). If the scores cannot tell those apart, the
check proves nothing; the summary reports how many mismatched pairs fall under
the threshold.
"""
import argparse, json, os, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--strings')
ap.add_argument('--pairs')
ap.add_argument('--out', required=True)
ap.add_argument('--lang', default='')
ap.add_argument('--model', default=os.environ.get('MADLAD_DIR', ''))
ap.add_argument('--embedder', default=os.environ.get('MINILM_DIR', ''))
ap.add_argument('--threads', type=int, default=int(os.environ.get('BT_THREADS', '6')))
ap.add_argument('--batch', type=int, default=16)
ap.add_argument('--device', default=os.environ.get('BT_DEVICE', 'cpu'))
ap.add_argument('--beam', type=int, default=int(os.environ.get('BT_BEAM', '4')))
args = ap.parse_args()

import ctranslate2
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer
from sacrebleu.metrics import CHRF

tok = AutoTokenizer.from_pretrained(args.model)
COMPUTE = os.environ.get('BT_COMPUTE') or ('int8' if args.device == 'cpu' else 'default')
translator = ctranslate2.Translator(args.model, device=args.device, compute_type=COMPUTE, inter_threads=1, intra_threads=args.threads)
embedder = SentenceTransformer(args.embedder, device='cpu')
chrf = CHRF()


def back(texts, label=''):
    out = []
    t = time.time()
    for i in range(0, len(texts), args.batch):
        chunk = texts[i:i + args.batch]
        src = [tok.convert_ids_to_tokens(tok.encode('<2en> ' + x)) for x in chunk]
        res = translator.translate_batch(src, beam_size=args.beam, max_decoding_length=256, repetition_penalty=1.1)
        for r in res:
            out.append(tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip())
        if (i // args.batch) % 5 == 0:
            print(f'  {label} {len(out)}/{len(texts)} ({time.time() - t:.0f}s)', file=sys.stderr, flush=True)
    return out


def score(bts, ens):
    a = embedder.encode(bts, normalize_embeddings=True, batch_size=64)
    b = embedder.encode(ens, normalize_embeddings=True, batch_size=64)
    cos = (a * b).sum(axis=1)
    return [{'cos': round(float(c), 4), 'chrf': round(chrf.sentence_score(x, [y]).score, 1)} for c, x, y in zip(cos, bts, ens)]


t0 = time.time()
if args.pairs:
    pairs = json.load(open(args.pairs, encoding='utf8'))
    bts = back([p['text'] for p in pairs])
    sc = score(bts, [p['english'] for p in pairs])
    for p, bt, s in zip(pairs, bts, sc):
        p.update(back=bt, **s)
    json.dump(pairs, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'{len(pairs)} pairs in {time.time() - t0:.0f}s', file=sys.stderr)
    sys.exit(0)

data = json.load(open(args.strings, encoding='utf8'))
only = [l for l in args.lang.split(',') if l]
en = data['en']['typical']
keys = list(en.keys())
result = {'model': 'google/madlad400-3b-mt (CTranslate2 int8: Nextcloud-AI/madlad400-3b-mt-ct2-int8)', 'embedder': 'sentence-transformers/all-MiniLM-L6-v2', 'languages': {}}
if os.path.exists(args.out):
    try:
        result = json.load(open(args.out, encoding='utf8'))  # resume
    except Exception:
        pass
result['device'] = f'{args.device} ({COMPUTE})'
result['beam'] = args.beam
for lang in data:
    if lang == 'en' or (only and lang not in only):
        continue
    old = result['languages'].get(lang, {})
    # Resume, string by string: a score is kept only while both the translation and the English
    # it was scored against are exactly what they were. Anything else is translated again.
    todo = [k for k in keys if not (k in old and old[k]['text'] == data[lang]['typical'][k] and old[k]['english'] == en[k])]
    if not todo and set(old) == set(keys):
        continue
    texts = [data[lang]['typical'][k] for k in todo]
    bts = back(texts, lang) if todo else []
    right = score(bts, [en[k] for k in todo]) if todo else []
    # the control: the same back-translations against the next key's English
    nxt = {k: en[keys[(i + 1) % len(keys)]] for i, k in enumerate(keys)}
    wrong = score(bts, [nxt[k] for k in todo]) if todo else []
    fresh = {k: {'text': t, 'english': en[k], 'back': bt, **s, 'controlCos': w['cos']} for k, t, bt, s, w in zip(todo, texts, bts, right, wrong)}
    result['languages'][lang] = {k: fresh.get(k) or old[k] for k in keys}
    json.dump(result, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'{lang}: {len(todo)} of {len(keys)} strings translated, {time.time() - t0:.0f}s elapsed', file=sys.stderr, flush=True)
