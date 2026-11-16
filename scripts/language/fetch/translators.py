import json,urllib.parse,time
from search import get
Q=[('enwiki','François-Victor Hugo|Leon Ulrich|August Wilhelm Schlegel'),('ruwiki','Михаловский, Дмитрий Лаврентьевич|Гнедич, Пётр Петрович|Козлов, Павел Алексеевич|Вейнберг, Пётр Исаевич|Сатин, Николай Михайлович|Гербель, Николай Васильевич')]
out={}
for site,titles in Q:
    r=get('https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(dict(action='wbgetentities',sites=site,titles=titles,props='labels|claims|sitelinks',languages='en|ru',sitefilter=site,format='json')))
    for e in r['entities'].values():
        if 'missing' in e: print('MISSING',e.get('title')); continue
        def d(p):
            try: return e['claims'][p][0]['mainsnak']['datavalue']['value']['time'][1:11]
            except Exception: return None
        out[e['id']]={'title':e['sitelinks'][site]['title'],'label':e['labels'].get('en',e['labels'].get('ru',{})).get('value'),'born':d('P569'),'died':d('P570'),'lastrevid':e.get('lastrevid')}
        print(e['id'],out[e['id']])
    time.sleep(2)
json.dump({'fetched':time.strftime('%Y-%m-%d'),'source':'Wikidata wbgetentities, P569 date of birth and P570 date of death','licence':'CC0 1.0','translators':out},open('translators.json','w'),ensure_ascii=False,indent=1)
