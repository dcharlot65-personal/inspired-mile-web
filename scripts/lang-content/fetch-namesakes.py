"""Wikidata labels of a NAME, for a decoy trivia option that is a person no source writes in a language: the
item of the given name itself, whose labels and aliases say how the language writes that name. Used only where
the person's own item has nothing in the language (h.cornelia in Japanese: Caesar's wife Cornelia, Q235423,
has no Japanese label; the female given name Cornelia, Q1119228, has コーネリア and the alias コルネリア, the
Latin reading, as in 小オクタウィア beside it). Same API as fetch-wikidata.py; writes namesakes.json beside
this file, with each item's revision. lib.mjs sourcesOf reads it.
Run:  python3 -I scripts/lang-content/fetch-namesakes.py
"""
import datetime, json, os, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = ['en','es','fr','de','it','pt','pl','ru','ar','hi','zh','ja','ko','vi','th','id','mul','zh-hans','zh-cn','pt-br']
UA = {'User-Agent': 'label-fetch-script/1.0 (build tooling for a static site)'}
# entity key -> the Wikidata item of the name it bears, and what that item is (its English description must say so)
NAMESAKES = {'h.cornelia': ('Q1119228', 'female given name')}
q = urllib.parse.urlencode(dict(action='wbgetentities', format='json', ids='|'.join(i for i, _ in NAMESAKES.values()), props='info|labels|aliases|descriptions', languages='|'.join(LANGS)))
with urllib.request.urlopen(urllib.request.Request('https://www.wikidata.org/w/api.php?' + q, headers=UA), timeout=60) as r:
    d = json.load(r)
out = {'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'source': 'https://www.wikidata.org (labels, CC0)', 'entities': {}}
for key, (qid, what) in NAMESAKES.items():
    e = d['entities'][qid]
    desc = e.get('descriptions', {}).get('en', {}).get('value')
    if desc != what: raise SystemExit(f'{qid} is described as {desc!r}, not {what!r}')
    out['entities'][key] = {'id': qid, 'description': desc, 'lastrevid': e['lastrevid'], 'modified': e['modified'],
                            'labels': {k: v['value'] for k, v in e.get('labels', {}).items()},
                            'aliases': {k: [a['value'] for a in v] for k, v in e.get('aliases', {}).items()}}
json.dump(out, open(os.path.join(HERE, 'namesakes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, e in out['entities'].items(): print(k, e['id'], e['description'], e['lastrevid'], {l: (e['labels'].get(l), e['aliases'].get(l)) for l in ['ja','ar','ko','hi','th']})
