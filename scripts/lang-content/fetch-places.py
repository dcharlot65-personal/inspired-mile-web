"""Wikidata labels of the places three King Lear characters are named after (the Earl of Kent, the Earl of
Gloucester, the Duke of Cornwall), for the trivia options that name them by title in a language with no
article on the play. Same API as fetch-wikidata.py; writes wikidata-places.json beside this file.
Run:  python3 -I scripts/lang-content/fetch-places.py
"""
import datetime, json, os, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = ['en','es','fr','de','it','pt','pl','ru','ar','hi','zh','ja','ko','vi','th','id','mul','zh-hans','zh-cn','pt-br']
UA = {'User-Agent': 'label-fetch-script/1.0 (build tooling for a static site)'}
PLACES = {'l.kent': 'Kent', 'l.cornwall': 'Cornwall', 'l.gloucester': 'Gloucester'}
q = urllib.parse.urlencode(dict(action='wbgetentities', format='json', sites='enwiki', titles='|'.join(PLACES.values()), props='labels|aliases|descriptions', languages='|'.join(LANGS)))
with urllib.request.urlopen(urllib.request.Request('https://www.wikidata.org/w/api.php?' + q, headers=UA), timeout=60) as r:
    d = json.load(r)
out = {'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'source': 'https://www.wikidata.org (labels, CC0)', 'entities': {}}
by_title = {e.get('labels', {}).get('en', {}).get('value'): e for e in d['entities'].values()}
for key, title in PLACES.items():
    e = by_title[title]
    out['entities'][key] = {'id': e['id'], 'enwiki': title, 'description': e.get('descriptions', {}).get('en', {}).get('value'),
                            'labels': {k: v['value'] for k, v in e.get('labels', {}).items()},
                            'aliases': {k: [a['value'] for a in v] for k, v in e.get('aliases', {}).items()}}
json.dump(out, open(os.path.join(HERE, 'wikidata-places.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, e in out['entities'].items(): print(k, e['id'], e['description'], {l: e['labels'].get(l) for l in ['es','fr','it','pt','pl','ar','hi','th','zh','ja','ko']})
