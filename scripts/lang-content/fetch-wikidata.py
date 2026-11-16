"""Fetch the Wikidata item and its labels for every entity in entities.tsv.

Two public APIs, nothing else:
  1. en.wikipedia.org  action=query&prop=pageprops   article title -> Wikidata item id (redirects followed)
  2. www.wikidata.org  action=wbgetentities          item id -> labels, aliases and sitelink titles
Writes wikidata-labels.json beside this file. Requests are batched (50 per call) and spaced,
and a 429 waits for the Retry-After the server names.
Run:  python3 -I scripts/lang-content/fetch-wikidata.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = ['en','es','fr','de','it','pt','pl','ru','ar','hi','zh','ja','ko','vi','th','id']
LABEL_LANGS = LANGS + ['mul','zh-hans','zh-cn','zh-hant','pt-br']
UA = {'User-Agent': 'label-fetch-script/1.0 (build tooling for a static site)'}

def get(url, params):
    full = url + '?' + urllib.parse.urlencode(params)
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(full, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get('Retry-After') or 15) + 2
            print(f'  HTTP {e.code}; waiting {wait}s', file=sys.stderr); time.sleep(wait)
        except Exception as e:
            print(f'  {e}; retrying', file=sys.stderr); time.sleep(10)
    raise SystemExit('gave up: ' + full[:200])

rows = []
for line in open(os.path.join(HERE, 'entities.tsv'), encoding='utf-8'):
    if line.strip() and not line.startswith('#'):
        key, title, names = line.rstrip('\n').split('\t')
        rows.append((key, title, names.split('|')))

qid = {}
titles = [r[1] for r in rows if not re.fullmatch(r'Q\d+', r[1])]
for r in rows:
    if re.fullmatch(r'Q\d+', r[1]): qid[r[1]] = (r[1], '')
for i in range(0, len(titles), 50):
    d = get('https://en.wikipedia.org/w/api.php', dict(action='query', format='json', redirects=1, prop='pageprops', ppprop='wikibase_item', titles='|'.join(titles[i:i+50])))
    chain = {}
    for n in d['query'].get('normalized', []): chain[n['from']] = n['to']
    for n in d['query'].get('redirects', []): chain[n['from']] = n['to']
    final = {p['title']: p.get('pageprops', {}).get('wikibase_item') for p in d['query']['pages'].values()}
    for t in titles[i:i+50]:
        x = t
        for _ in range(4): x = chain.get(x, x)
        qid[t] = (final.get(x), x)
    time.sleep(3)

ids = sorted({q for q, _ in qid.values() if q})
ent = {}
for i in range(0, len(ids), 50):
    d = get('https://www.wikidata.org/w/api.php', dict(action='wbgetentities', format='json', ids='|'.join(ids[i:i+50]), props='labels|aliases|descriptions|sitelinks', languages='|'.join(LABEL_LANGS)))
    ent.update(d['entities'])
    time.sleep(3)

out = {'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'source': 'https://www.wikidata.org (labels, CC0)', 'entities': {}}
missing = []
for key, title, names in rows:
    q, resolved = qid[title]
    if not q:
        missing.append(f'{key}: no item for "{title}"'); continue
    e = ent[q]
    labels = {l: v['value'] for l, v in e.get('labels', {}).items()}
    sitelinks = {s[:-4]: v['title'] for s, v in e.get('sitelinks', {}).items() if s.endswith('wiki') and s[:-4] in LANGS}
    out['entities'][key] = {'id': q, 'enwiki': resolved, 'names': names, 'description': e.get('descriptions', {}).get('en', {}).get('value', ''), 'labels': labels, 'aliases': {l: [a['value'] for a in v] for l, v in e.get('aliases', {}).items()}, 'sitelinks': sitelinks}
json.dump(out, open(os.path.join(HERE, 'wikidata-labels.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
print(len(out['entities']), 'entities;', len(missing), 'missing')
for m in missing: print(' ', m)
