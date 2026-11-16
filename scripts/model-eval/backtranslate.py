#!/usr/bin/env python3
"""
Back-translate sentences to English with MADLAD-400 and score them against the English.

  backtranslate.py --pairs pairs.json --out bt.json      # pairs: [{id, lang, text, english}]

The method of scripts/lang/backtranslate.py on the lang/qa-pipeline branch (its --pairs mode),
kept here so scripts/model-eval/strings-qa.sh does not depend on another branch's files:
MADLAD-400 3B (Google, Apache-2.0) through CTranslate2, "<2en>" prefix, beam 4; cosine of
all-MiniLM-L6-v2 embeddings and chrF against the English.
"""
import argparse, json, os

ap = argparse.ArgumentParser()
ap.add_argument('--pairs', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--model', default=os.environ.get('MADLAD_DIR', ''))
ap.add_argument('--embedder', default=os.environ.get('MINILM_DIR', ''))
ap.add_argument('--threads', type=int, default=int(os.environ.get('BT_THREADS', '4')))
args = ap.parse_args()

import ctranslate2
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer
from sacrebleu.metrics import CHRF

tok = AutoTokenizer.from_pretrained(args.model)
translator = ctranslate2.Translator(args.model, device='cpu', compute_type='int8', inter_threads=1, intra_threads=args.threads)
embedder = SentenceTransformer(args.embedder, device='cpu')
chrf = CHRF()

pairs = json.load(open(args.pairs, encoding='utf8'))
src = [tok.convert_ids_to_tokens(tok.encode('<2en> ' + p['text'])) for p in pairs]
res = translator.translate_batch(src, beam_size=4, max_decoding_length=256, repetition_penalty=1.1, max_batch_size=8)
backs = [tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip() for r in res]
a = embedder.encode(backs, normalize_embeddings=True)
b = embedder.encode([p['english'] for p in pairs], normalize_embeddings=True)
for p, back, x, y in zip(pairs, backs, a, b):
    p.update(back=back, cos=round(float((x * y).sum()), 4), chrf=round(chrf.sentence_score(back, [p['english']]).score, 1))
json.dump(pairs, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'{len(pairs)} pairs back-translated')
