"""names_ptbr.py: the Brazilian Portuguese labels (pt-br) and aliases of the items in wikidata-names.json.

The game's Portuguese is Brazilian (the interface, src/i18n/locales/pt.ts), while Wikidata's `pt` label is
often the European form ("Marco António"). This fetches only `pt-br`, for the same items, so that no other
language's labels move with it. Writes wikidata-pt-br.json; copy it to docs/language/sources/.
Run from the directory that holds wikidata-names.json:  python3 names_ptbr.py
"""
import json, os, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from search import get

ents = json.load(open('wikidata-names.json', encoding='utf8'))['entities']
ids = sorted({e['id'] for e in ents.values() if e.get('id')})
out = {}
for i in range(0, len(ids), 50):
    r = get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(dict(action='wbgetentities', ids='|'.join(ids[i:i + 50]), props='labels|aliases|info', languages='pt-br|pt', format='json')))
    for q, e in r['entities'].items():
        lab = e.get('labels', {})
        out[q] = {'lastrevid': e.get('lastrevid'), 'pt-br': lab.get('pt-br', {}).get('value'), 'pt': lab.get('pt', {}).get('value'),
                  'aliases': [a['value'] for a in e.get('aliases', {}).get('pt-br', [])]}
    time.sleep(2)
json.dump({'fetched': time.strftime('%Y-%m-%d'), 'api': 'https://www.wikidata.org/w/api.php?action=wbgetentities (languages=pt-br|pt)', 'licence': 'CC0 1.0',
           'items': out}, open('wikidata-pt-br.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, e in ents.items():
    if e.get('id') and out.get(e['id'], {}).get('pt-br'):
        o = out[e['id']]
        print(k, e['id'], '| pt:', o['pt'], '| pt-br:', o['pt-br'], '' if o['pt'] == o['pt-br'] else '  <- differs')
