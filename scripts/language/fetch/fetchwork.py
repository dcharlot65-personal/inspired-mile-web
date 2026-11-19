"""fetchwork.py <site> <lang> <work> <title> [more titles...]  -> cache/<lang>/<work>.txt (+ .meta.json).
Each title is fetched with its subpages (prefix title/) and concatenated in title order."""
import sys,json,os,time
from ws import api,page
site,lang,work=sys.argv[1:4]
metas=[];txt=[]
for title in sys.argv[4:]:
    subs=[]
    cont={}
    while True:
        r=api(site,action='query',list='allpages',apprefix=title+'/',aplimit='500',**cont)
        subs+=[p['title'] for p in r['query']['allpages']]
        if 'continue' in r: cont={'apcontinue':r['continue']['apcontinue']}
        else: break
    for i,t in enumerate([title]+subs):
        out=f'cache/{lang}/parts/{work}-{len(metas):03d}.txt'
        m=page(site,t,out)
        if m:
            metas.append(m); txt.append(f'\n=====PAGE {m["title"]} =====\n'+open(out,encoding='utf8').read())
        time.sleep(0.3)
os.makedirs(f'cache/{lang}',exist_ok=True)
open(f'cache/{lang}/{work}.txt','w',encoding='utf8').write('\n'.join(txt))
json.dump(metas,open(f'cache/{lang}/{work}.meta.json','w'),ensure_ascii=False,indent=1)
print(lang,work,len(metas),'pages',sum(m['chars'] for m in metas),'chars',[ (m['title'],m['chars']) for m in metas][:6])
