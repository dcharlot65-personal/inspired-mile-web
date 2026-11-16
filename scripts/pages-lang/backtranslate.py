#!/usr/bin/env python3
"""
Back-translation of the page areas with a model that did not write them.

  backtranslate.py --pairs pairs.json --out out.json   # pairs: [{id, lang, text, english}]

Each string is translated back to English by MADLAD-400 (Google, Apache-2.0), run locally
through CTranslate2, and compared with the English source by sentence-embedding cosine
(all-MiniLM-L6-v2). The control: each back-translation is also scored against the NEXT
pair's English; if right and wrong pairs score alike, the check proves nothing.

This is the simplest equivalent of scripts/lang/backtranslate.py on branch lang/qa-pipeline,
written because that pipeline had not landed in main when the pages were translated. It uses
the models that pipeline installed on the build host (MADLAD_DIR, MINILM_DIR) and writes the
same fields. When the pipeline is in main, use it and delete this.

It writes scores; it decides nothing. A low score is a string to read, not an error.
A result file that already holds a pair (same id, lang and text) keeps its score, so an
interrupted run can be continued.
"""
import argparse, json, os, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--pairs', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--model', default=os.environ.get('MADLAD_DIR', ''))
ap.add_argument('--embedder', default=os.environ.get('MINILM_DIR', ''))
ap.add_argument('--threads', type=int, default=int(os.environ.get('BT_THREADS', '6')))
ap.add_argument('--batch', type=int, default=int(os.environ.get('BT_BATCH', '16')))
# 'cpu', or 'mps' (Apple's GPU; CTranslate2 calls its MPS backend experimental). On the shared build
# host the CPU is often saturated and the GPU idle: 16 strings took 795 s on the CPU at load 200.
ap.add_argument('--device', default=os.environ.get('BT_DEVICE', 'cpu'))
ap.add_argument('--compute', default=os.environ.get('BT_COMPUTE', ''))
ap.add_argument('--beam', type=int, default=int(os.environ.get('BT_BEAM', '4')))
ap.add_argument('--limit', type=int, default=int(os.environ.get('BT_LIMIT', '0')), help='translate only the first N pairs (a timing probe)')
args = ap.parse_args()

import ctranslate2
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer

tok = AutoTokenizer.from_pretrained(args.model)
compute = args.compute or ('int8' if args.device == 'cpu' else 'auto')
translator = ctranslate2.Translator(args.model, device=args.device, compute_type=compute, inter_threads=1, intra_threads=args.threads)
print(f'device {args.device}, compute {compute}, beam {args.beam}, batch {args.batch}', file=sys.stderr, flush=True)
embedder = SentenceTransformer(args.embedder, device='cpu')

pairs = json.load(open(args.pairs, encoding='utf8'))
if args.limit:
    pairs = pairs[:args.limit]
done = {}
if os.path.exists(args.out):
    try:
        for p in json.load(open(args.out, encoding='utf8')):
            if 'back' in p:
                done[(p['id'], p['lang'], p['text'])] = p
    except Exception:
        pass


def cos(a_texts, b_texts):
    a = embedder.encode(a_texts, normalize_embeddings=True, batch_size=64)
    b = embedder.encode(b_texts, normalize_embeddings=True, batch_size=64)
    return [round(float(x), 4) for x in (a * b).sum(axis=1)]


t0 = time.time()
out = []
todo = [p for p in pairs if (p['id'], p['lang'], p['text']) not in done]
print(f'{len(pairs)} pairs, {len(todo)} to translate', file=sys.stderr, flush=True)
fresh = {}
for i in range(0, len(todo), args.batch):
    chunk = todo[i:i + args.batch]
    src = [tok.convert_ids_to_tokens(tok.encode('<2en> ' + p['text'])) for p in chunk]
    res = translator.translate_batch(src, beam_size=args.beam, max_decoding_length=256, repetition_penalty=1.1)
    for p, r in zip(chunk, res):
        fresh[(p['id'], p['lang'], p['text'])] = tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip()
    if (i // args.batch) % 10 == 0:
        print(f'{i + len(chunk)}/{len(todo)} in {time.time() - t0:.0f}s', file=sys.stderr, flush=True)
        # keep what is done, so a run stopped by the host is not lost
        part = [dict(p, back=fresh[(p['id'], p['lang'], p['text'])]) for p in todo if (p['id'], p['lang'], p['text']) in fresh] + list(done.values())
        json.dump(part, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)

for p in pairs:
    k = (p['id'], p['lang'], p['text'])
    out.append(dict(p, back=done[k]['back'] if k in done else fresh[k]))
backs = [p['back'] for p in out]
right = cos(backs, [p['english'] for p in out])
wrong = cos(backs, [out[(i + 1) % len(out)]['english'] for i in range(len(out))])
for p, r, w in zip(out, right, wrong):
    p.update(cos=r, controlCos=w)
json.dump(out, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'{len(out)} pairs scored in {time.time() - t0:.0f}s', file=sys.stderr)
