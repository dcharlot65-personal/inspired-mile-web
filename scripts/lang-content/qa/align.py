#!/usr/bin/env python3
"""Does each translated trivia option still mean the English option at its place?

  align.py <dir with bt-*.json / bto-*.json> <out.json>     env: MINILM_DIR

For every question, the back-translation of each option that was translated (not a name from the
names table) is compared with all four English options of that question. The option is MISPLACED when
its back-translation is closer to another English option than to its own: a translation that changed
the answer's meaning, or two options swapped, shows up here. Names are left out: they are filled from
the names table by place (play-areas.test.ts checks them). It writes; report.mjs reads. It decides nothing.
Embedder: all-MiniLM-L6-v2 (Apache-2.0).
"""
import glob, json, os, re, sys
from sentence_transformers import SentenceTransformer

src, dst = sys.argv[1], sys.argv[2]
emb = SentenceTransformer(os.environ['MINILM_DIR'], device='cpu')
here = os.path.dirname(os.path.abspath(__file__))
# The English options, as pairs.mjs wrote them (every pair carries its English).
english = {}
rows = []
for f in sorted(glob.glob(os.path.join(src, 'bt-[0-9]-*.json')) + glob.glob(os.path.join(src, 'bto-[0-9]-*.json'))):
    engine = 'opus' if os.path.basename(f).startswith('bto-') else 'madlad'
    for r in json.load(open(f, encoding='utf8')):
        m = re.fullmatch(r'(?:alignctl:)?trivia\.(\d+)\.o(\d)', r['id'])
        if not m or 'back' not in r: continue
        rows.append((engine, r['lang'], int(m.group(1)), int(m.group(2)), r['back'], r['english'], r['text'], r['id'].startswith('alignctl:')))
# All four English options of a question are needed, names included: read them from the bank's English area.
bank = json.load(open(os.path.join(src, 'english-options.json'), encoding='utf8'))
out = []
if rows:
    backs = emb.encode([r[4] for r in rows], normalize_embeddings=True, batch_size=64)
    keys = sorted({(n, i) for n, opts in bank.items() for i in range(len(opts))}, key=lambda k: (int(k[0]), k[1]))
    en_vec = dict(zip(keys, emb.encode([bank[n][i] for n, i in keys], normalize_embeddings=True, batch_size=64)))
    for (engine, lang, n, i, back, en, text, control), v in zip(rows, backs):
        sims = [float(v @ en_vec[(str(n), j)]) for j in range(len(bank[str(n)]))]
        best = max(range(len(sims)), key=lambda j: sims[j])
        out.append({'engine': engine, 'lang': lang, 'q': n, 'option': i, 'text': text, 'back': back, 'english': en,
                    'own': round(sims[i], 4), 'best': best, 'bestSim': round(sims[best], 4), 'misplaced': best != i, 'control': control})
json.dump(out, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
real = [o for o in out if not o['control']]; ctl = [o for o in out if o['control']]
print(f'{len(real)} options; {sum(o["misplaced"] for o in real)} closer to another option than to their own; controls caught {sum(o["misplaced"] for o in ctl)}/{len(ctl)}', file=sys.stderr)
