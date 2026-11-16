"""translators.py: dates of birth and death of every translator used, from Wikidata (P569, P570).
Writes translators.json; copy it to docs/language/sources/translators.json."""
import json,urllib.parse,time,sys,os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from search import get
Q=[('enwiki','François-Victor Hugo|August Wilhelm Schlegel|Leandro Fernández de Moratín|Juan Antonio Pérez Bonalde|Luís I of Portugal|Machado de Assis|Tsubouchi Shōyō|Stéphane Mallarmé|Valery Bryusov|Hedwig Lachmann|Adolf Strodtmann'),
   ('ruwiki','Гумилёв, Николай Степанович|Михаловский, Дмитрий Лаврентьевич|Гнедич, Пётр Петрович|Козлов, Павел Алексеевич|Вейнберг, Пётр Исаевич|Сатин, Николай Михайлович|Гербель, Николай Васильевич'),
   ('itwiki','Carlo Rusconi|Ernesto Ragazzoni'),('eswiki','José Arnaldo Márquez|Marcelino Menéndez Pelayo'),('frwiki','Félix Rabbe'),('plwiki','Leon Ulrich')]
out={}
for site,titles in Q:
    r=get('https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(dict(action='wbgetentities',sites=site,titles=titles,props='labels|claims|sitelinks',languages='en|ru|it|es|fr|pl|pt|ja',sitefilter=site,format='json')))
    for e in r['entities'].values():
        if 'missing' in e: print('MISSING',site,e.get('title')); continue
        def d(p):
            try: return e['claims'][p][0]['mainsnak']['datavalue']['value']['time'][1:11]
            except Exception: return None
        lab=e['labels']
        out[e['id']]={'title':e['sitelinks'][site]['title'],'label':(lab.get('en') or next(iter(lab.values()),{})).get('value'),'born':d('P569'),'died':d('P570'),'lastrevid':e.get('lastrevid')}
        print(e['id'],out[e['id']])
    time.sleep(2)
json.dump({'fetched':time.strftime('%Y-%m-%d'),'source':'Wikidata wbgetentities, P569 date of birth and P570 date of death','licence':'CC0 1.0','translators':out},open('translators.json','w'),ensure_ascii=False,indent=1)
