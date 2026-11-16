"""Chinese labels and article titles on Wikidata are often in Traditional characters. The game's
Chinese is Simplified. This converts them with MediaWiki's own converter (the one zh.wikipedia.org
serves its readers with: action=parse, variant=zh-cn), one request for all of them, and stores the
result in wikidata-labels.json as labels["zh-hans"] with labels["zh-hans:from"] = "converted".
Run after fetch-wikidata.py:  python3 -I scripts/lang-content/zh-simplify.py
"""
import json, os, re, html, time, urllib.parse, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, 'wikidata-labels.json')
d = json.load(open(P, encoding='utf-8'))
todo = []
for key, e in d['entities'].items():
    L = e['labels']
    if 'zh-hans' in L or 'zh-cn' in L: continue
    src = L.get('zh') or L.get('zh-hant') or re.sub(r'\s*[(（][^)）]*[)）]\s*$', '', e['sitelinks'].get('zh', ''))
    if src: todo.append((key, src))
text = '\n'.join(f'* <span id="x{i}">{html.escape(s)}</span>' for i, (_, s) in enumerate(todo))
body = urllib.parse.urlencode(dict(action='parse', format='json', contentmodel='wikitext', variant='zh-cn', prop='text', disablelimitreport=1, text=text)).encode()
for attempt in range(6):
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request('https://zh.wikipedia.org/w/api.php', data=body, headers={'User-Agent': 'label-fetch-script/1.0 (build tooling for a static site)'}), timeout=60))
        break
    except urllib.error.HTTPError as err:
        time.sleep(int(err.headers.get('Retry-After') or 20) + 2)
out = r['parse']['text']['*']
n = 0
for i, (key, src) in enumerate(todo):
    m = re.search(rf'<span id="x{i}">(.*?)</span>', out)
    if not m: raise SystemExit(f'no conversion came back for {key}')
    conv = html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))
    d['entities'][key]['labels']['zh-hans'] = conv
    d['entities'][key]['labels']['zh-hans:from'] = 'converted from "%s" by zh.wikipedia.org (variant=zh-cn)' % src
    n += conv != src
json.dump(d, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
print(len(todo), 'converted;', n, 'changed')
