#!/usr/bin/env python3
"""Back-translate (translation -> English) with MADLAD-400 and score against the English source.

The simplest equivalent of scripts/lang/backtranslate.py of the shared language pipeline (branch
lang/qa-pipeline, not yet in main when this was written): the same model and the same two scores,
read from that pipeline's installation on the build host. Nothing is installed by this script.

  bt.py <pairs.json> <out.json>     env: MADLAD_DIR, MINILM_DIR, BT_THREADS (default 6)

Model: google/madlad400-3b-mt (Apache-2.0), CTranslate2 int8. Embedder: all-MiniLM-L6-v2 (Apache-2.0).
It writes scores; qa/report.mjs applies the thresholds. It decides nothing.
"""
import json, os, sys, time
import ctranslate2
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer
from sacrebleu.metrics import CHRF
src, dst = sys.argv[1], sys.argv[2]
pairs = json.load(open(src, encoding='utf8'))
model = os.environ['MADLAD_DIR']
tok = AutoTokenizer.from_pretrained(model)
tr = ctranslate2.Translator(model, device='cpu', compute_type='int8', inter_threads=1, intra_threads=int(os.environ.get('BT_THREADS', '6')))
emb = SentenceTransformer(os.environ['MINILM_DIR'], device='cpu')
chrf = CHRF()
back, t = [], time.time()
B = 16
order = sorted(range(len(pairs)), key=lambda i: len(pairs[i]['text']))  # similar lengths together: faster batches
texts = [pairs[i]['text'] for i in order]
for i in range(0, len(texts), B):
    chunk = [tok.convert_ids_to_tokens(tok.encode('<2en> ' + x)) for x in texts[i:i + B]]
    for r in tr.translate_batch(chunk, beam_size=4, max_decoding_length=256, repetition_penalty=1.1):
        back.append(tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip())
    if (i // B) % 10 == 0: print(f'  {len(back)}/{len(texts)} ({time.time() - t:.0f}s)', file=sys.stderr, flush=True)
bt = [None] * len(pairs)
for pos, i in enumerate(order): bt[i] = back[pos]
a = emb.encode(bt, normalize_embeddings=True, batch_size=64)
b = emb.encode([p['english'] for p in pairs], normalize_embeddings=True, batch_size=64)
for p, x, c in zip(pairs, bt, (a * b).sum(axis=1)):
    p.update(back=x, cos=round(float(c), 4), chrf=round(chrf.sentence_score(x, [p['english']]).score, 1))
json.dump(pairs, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print(f'{len(pairs)} pairs in {time.time() - t:.0f}s', file=sys.stderr)
