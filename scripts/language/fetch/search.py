import json,sys,urllib.request,urllib.parse,time,urllib.error
UA={'User-Agent':'LangDataFetch/1.0 (generic research client)'}
def get(u):
    for i in range(8):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
        except urllib.error.HTTPError as e:
            if e.code in (429,503):
                time.sleep(float(e.headers.get('Retry-After') or 5)*(1+i)); continue
            raise
    raise SystemExit('gave up '+u)
def search(q):
    u='https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(dict(action='wbsearchentities',search=q,language='en',limit=7,format='json'))
    return get(u)['search']
if __name__=='__main__':
  for q in sys.argv[1:]:
    print('##',q)
    for r in search(q):
        print('  ',r['id'],'|',r.get('label'),'|',r.get('description'))
    time.sleep(1.2)
