import json,urllib.parse
from search import get
d=json.load(open('wikidata-card-names.json'))['entities']
ws={k:v['id'] for k,v in d.items() if k.startswith('w_')}
LANGS='es fr de it pt pl ru ar hi zh ja ko vi th id en'.split()
r=get('https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(dict(action='wbgetentities',ids='|'.join(ws.values()),props='sitelinks',sitefilter='|'.join(l+'wikisource' for l in LANGS),format='json')))
out={}
for k,q in ws.items():
    sl=r['entities'][q].get('sitelinks',{})
    out[k]={s.replace('wikisource',''):v['title'] for s,v in sl.items()}
    print(k,q,json.dumps(out[k],ensure_ascii=False))
json.dump(out,open('ws-sitelinks.json','w'),ensure_ascii=False,indent=1)
