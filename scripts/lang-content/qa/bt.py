#!/usr/bin/env python3
"""Back-translate (translation -> English) with a translation model and score against the English source.

The simplest equivalent of scripts/lang/backtranslate.py of the shared language pipeline (branch
lang/qa-pipeline, not yet in main when this was written): the same model and the same two scores,
read from that pipeline's installation on the build host. Nothing is installed by this script.

  bt.py <pairs.json> <out.json>     env: MINILM_DIR, BT_THREADS (default 6), BT_BEAM (default 1), and
      BT_ENGINE=madlad (default): MADLAD_DIR    google/madlad400-3b-mt (Apache-2.0), CTranslate2 int8
      BT_ENGINE=opus:             OPUS_DIR      Helsinki-NLP OPUS-MT <lang>-en, CTranslate2 int8 (install-opus.py)
Embedder: all-MiniLM-L6-v2 (Apache-2.0). Name the output bt-*.json for MADLAD and bto-*.json for OPUS-MT:
results are reused only from files of the same engine.
It writes scores; qa/report.mjs applies the thresholds. It decides nothing.
Greedy decoding (BT_BEAM=1) by default: on a build host at 5x its cores in load, beam 4 needed about
3 s a string, ten hours for the whole content. Each row records the beam it was decoded with.
"""
import json, os, sys, time
import ctranslate2
from transformers import AutoTokenizer
from sentence_transformers import SentenceTransformer
from sacrebleu.metrics import CHRF
import glob
src, dst = sys.argv[1], sys.argv[2]
pairs = json.load(open(src, encoding='utf8'))
# A string whose text and English are what an earlier run (any bt-*.json beside dst) saw keeps that
# run's result: after an edit only the edited strings are translated again.
prev = {}
ENGINE = os.environ.get('BT_ENGINE', 'madlad')
for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(dst)), os.path.basename(dst).split('-')[0] + '-*.json')):
    for r in json.load(open(f, encoding='utf8')):
        if 'back' in r: prev[(r['lang'], r['id'], r['text'], r['english'])] = r
done = {i: prev[k] for i, p in enumerate(pairs) if (k := (p['lang'], p['id'], p['text'], p['english'])) in prev}
todo = [p for i, p in enumerate(pairs) if i not in done]
print(f'{len(done)} of {len(pairs)} unchanged since an earlier run; translating {len(todo)}', file=sys.stderr, flush=True)
everything, pairs = pairs, todo
if ENGINE == 'opus':
    lang = everything[0]['lang'] if everything else 'xx'
    model = os.path.join(os.environ['OPUS_DIR'], lang)
    tok = AutoTokenizer.from_pretrained(os.path.join(model, 'tok'))
    PREFIX = ''
else:
    model = os.environ['MADLAD_DIR']
    tok = AutoTokenizer.from_pretrained(model)
    PREFIX = '<2en> '
tr = ctranslate2.Translator(model, device='cpu', compute_type='int8', inter_threads=1, intra_threads=int(os.environ.get('BT_THREADS', '6')))
emb = SentenceTransformer(os.environ['MINILM_DIR'], device='cpu')
chrf = CHRF()
back, t = [], time.time()
B = 16
BEAM = int(os.environ.get('BT_BEAM', '1'))
order = sorted(range(len(pairs)), key=lambda i: len(pairs[i]['text']))  # similar lengths together: faster batches
texts = [pairs[i]['text'] for i in order]
for i in range(0, len(texts), B):
    chunk = [tok.convert_ids_to_tokens(tok.encode(PREFIX + x)) for x in texts[i:i + B]]
    for r in tr.translate_batch(chunk, beam_size=BEAM, max_decoding_length=256, repetition_penalty=1.1):
        back.append(tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip())
    if (i // B) % 10 == 0: print(f'  {len(back)}/{len(texts)} ({time.time() - t:.0f}s)', file=sys.stderr, flush=True)
bt = [None] * len(pairs)
for pos, i in enumerate(order): bt[i] = back[pos]
if pairs:
    a = emb.encode(bt, normalize_embeddings=True, batch_size=64)
    b = emb.encode([p['english'] for p in pairs], normalize_embeddings=True, batch_size=64)
    for p, x, c in zip(pairs, bt, (a * b).sum(axis=1)):
        p.update(back=x, cos=round(float(c), 4), chrf=round(chrf.sentence_score(x, [p['english']]).score, 1), beam=BEAM, engine=ENGINE)
for i, r in done.items(): everything[i].update(back=r['back'], cos=r['cos'], chrf=r['chrf'], beam=r.get('beam', 4), engine=r.get('engine', 'madlad'))
json.dump(everything, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print(f'{len(pairs)} translated, {len(done)} reused, in {time.time() - t:.0f}s', file=sys.stderr)
