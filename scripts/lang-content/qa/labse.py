#!/usr/bin/env python3
"""Score each translation against its English source directly, with a bitext embedding model.

  labse.py <dir with pairs-*.json> <out.json>     env: LABSE_DIR

A second meaning signal beside back-translation (bt.py), as the shared pipeline of branch
lang/qa-pipeline uses it (scripts/lang/backtranslate.py --bitext): LaBSE (sentence-transformers/LaBSE,
Apache-2.0) embeds a sentence and its translation close together whatever the two languages, so no
translation model stands between the text and the English. Read from that pipeline's installation on
the build host; nothing is installed by this script. The controls of pairs.mjs (a translation paired with
the wrong English) are scored the same way: qa/report.mjs sets each language's threshold from them.
It writes scores; it decides nothing.
"""
import glob, json, os, sys
from sentence_transformers import SentenceTransformer

src, dst = sys.argv[1], sys.argv[2]
model = SentenceTransformer(os.environ['LABSE_DIR'], device='cpu')
out = []
for f in sorted(glob.glob(os.path.join(src, 'pairs-[0-9]-*.json'))):
    pairs = json.load(open(f, encoding='utf8'))
    if not pairs: continue
    a = model.encode([p['text'] for p in pairs], normalize_embeddings=True, batch_size=64)
    b = model.encode([p['english'] for p in pairs], normalize_embeddings=True, batch_size=64)
    for p, c in zip(pairs, (a * b).sum(axis=1)):
        out.append({'id': p['id'], 'lang': p['lang'], 'text': p['text'], 'english': p['english'], 'labse': round(float(c), 4)})
    print(f'{os.path.basename(f)}: {len(pairs)} scored', file=sys.stderr, flush=True)
json.dump(out, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
