"""extract.py <lang> <specfile> : spec lines 'ID|work|regex[|n]'. Spaces in the regex match any whitespace.
The matched span is copied from the cached source text; nothing is typed by hand. Writes out/<lang>.json."""
import sys,re,json,os
lang,spec=sys.argv[1:3]
res=json.load(open(f'out/{lang}.json')) if os.path.exists(f'out/{lang}.json') else {}
texts={}
def load(work):
    if work not in texts:
        t=open(f'cache/{lang}/{work}.txt',encoding='utf8').read()
        t=re.sub(r'\[\d+\]|\s?\(\d+\)','',t.replace('\ufeff','').replace('\u200c',''))  # footnote markers, zero-width marks
        t=re.sub(r'\[p\. \d+ modifica\]','',t)  # it.wikisource page-number marks
        texts[work]=(t,json.load(open(f'cache/{lang}/{work}.meta.json')))
    return texts[work]
for line in open(spec,encoding='utf8'):
    line=line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    p=line.split('|',2); cid,work,rx=p[0],p[1],p[2]
    n=0; prose=False
    if rx.endswith('||prose'): prose=True; rx=rx[:-len('||prose')]  # hard-wrapped prose: a line end is a space, not a verse break
    m2=re.search(r'\|\|(\d+)$',rx)
    if m2: n=int(m2.group(1)); rx=rx[:m2.start()]
    t,meta=load(work)
    try: ms=list(re.finditer(rx.replace(' ',r'\s+'),t,re.S))
    except re.error as e: print(cid,'BADRE',e); continue
    if not ms: print(f'{cid} NONE'); continue
    m=ms[min(n,len(ms)-1)]
    pg=None
    for h in re.finditer(r'=====PAGE (.*?) =====',t[:m.start()]): pg=h.group(1)
    mm=next((x for x in meta if x['title']==pg),meta[0])
    txt=re.sub(r'\s*\n\s*',' ' if prose else ' / ',m.group(0).strip()); txt=re.sub(r'[ \t]+',' ',txt)
    if mm.get('site')=='www.gutenberg.org': txt=txt.replace('--','—')  # Project Gutenberg's plain-text sign for a dash
    res[cid]={'text':txt,'work':work,'page':mm['title'],'url':mm['url'],'revid':mm['revid'],'offset':m.start(),'matches':len(ms),'regex':rx+('||prose' if prose else '')}
    if mm.get('file'): res[cid]['file']=mm['file']
    pre=t[max(0,m.start()-50):m.start()].replace('\n','⏎'); post=t[m.end():m.end()+40].replace('\n','⏎')
    print(f'{cid} [{len(ms)}] …{pre}【{txt}】{post}…')
os.makedirs('out',exist_ok=True)
json.dump(res,open(f'out/{lang}.json','w'),ensure_ascii=False,indent=1)
