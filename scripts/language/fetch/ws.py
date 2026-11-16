import json,sys,urllib.request,urllib.parse,time,urllib.error,re,html,os,hashlib
UA={'User-Agent':'LangDataFetch/1.0 (generic research client)'}
def get(u,raw=False):
    for i in range(6):
        try:
            b=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
            return b if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            if e.code in (429,503):
                time.sleep(min(60,float(e.headers.get('Retry-After') or 5)*(1+i))); continue
            raise
    raise SystemExit('gave up '+u)
def api(site,**kw):
    kw['format']='json'
    return get(f'https://{site}/w/api.php?'+urllib.parse.urlencode(kw))
def search(site,q,n=12,ns='0'):
    r=api(site,action='query',list='search',srsearch=q,srlimit=n,srnamespace=ns)
    return [(x['title'],x['size']) for x in r['query']['search']]
def strip(h):
    h=re.sub(r'(?is)<(script|style).*?</\1>','',h)
    h=re.sub(r'(?i)<br\s*/?>','\n',h)
    h=re.sub(r'(?i)</(p|div|dd|dt|li|tr|h\d|table)>','\n',h)
    h=re.sub(r'(?s)<[^>]+>','',h)
    h=html.unescape(h).replace('\xa0',' ')
    h=re.sub(r'[ \t]+',' ',h)
    return re.sub(r'\n\s*\n+','\n',h).strip()
def page(site,title,out):
    r=api(site,action='parse',page=title,prop='text|revid',redirects=1)
    if 'error' in r: print('ERR',site,title,r['error']['info']); return None
    t=strip(r['parse']['text']['*'])
    os.makedirs(os.path.dirname(out),exist_ok=True)
    open(out,'w',encoding='utf8').write(t)
    meta=dict(site=site,title=r['parse']['title'],revid=r['parse']['revid'],chars=len(t),sha256=hashlib.sha256(t.encode()).hexdigest(),fetched=time.strftime('%Y-%m-%d'),url=f'https://{site}/wiki/'+urllib.parse.quote(r['parse']['title'].replace(' ','_'))+f"?oldid={r['parse']['revid']}")
    json.dump(meta,open(out+'.meta.json','w'),ensure_ascii=False)
    return meta
if __name__=='__main__':
    site=sys.argv[1]
    for q in sys.argv[2:]:
        print('##',q)
        for t,s in search(site,q): print('   ',t,s)
        time.sleep(0.5)
