"""Fetch a Wikisource page as plain text, for quoting published translations.

  python3 -I wikisource.py search <lang> <words...>          find page titles
  python3 -I wikisource.py subpages <lang> <title prefix>    list a work's subpages
  python3 -I wikisource.py get <lang> <title> [...]          fetch pages into the cache; print their size and revision
  python3 -I wikisource.py grep <lang> <title> <regex>       print the lines of a cached page that match
  python3 -I wikisource.py take <source id> <lang> <title> <regex>
        append the ONE line that matches to challenges/evidence/<source id>.txt, with the page's
        revision id and URL. A challenge may only quote a line that is in an evidence file
        (verify-challenges.mjs checks it), so no quotation can come from anywhere but a fetched page.

Text is the rendered page (action=parse), tags stripped, one line per verse line or paragraph.
The cache is outside the repository (pass WS_CACHE, default ~/.cache/im-wikisource).
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get('WS_CACHE') or os.path.expanduser('~/.cache/im-wikisource')
UA = {'User-Agent': 'quote-fetch-script/1.0 (build tooling for a static site)'}

def api(lang, **params):
    url = f'https://{lang}.wikisource.org/w/api.php?' + urllib.parse.urlencode(dict(format='json', **params))
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get('Retry-After') or 20) + 3
            print(f'  HTTP {e.code}; waiting {wait}s', file=sys.stderr); time.sleep(wait)
        except Exception as e:
            print(f'  {e}; retrying', file=sys.stderr); time.sleep(8)
    raise SystemExit('gave up: ' + url[:160])

def path(lang, title):
    return os.path.join(CACHE, lang, re.sub(r'[^\w.-]+', '_', title) + '.json')

def to_text(h):
    h = re.sub(r'<(style|script)\b.*?</\1>', '', h, flags=re.S)
    h = re.sub(r'<span class="[^"]*(pagenum|ws-pagenum|pr-page|PageNumber|page-number|numeroriga|mw-editsection)[^"]*".*?</span>', '', h, flags=re.S)
    h = re.sub(r'<sup\b.*?</sup>', '', h, flags=re.S)
    h = re.sub(r'<(br|/p|/div|/li|/dd|/dt|/h\d|/tr|/blockquote)\b[^>]*>', '\n', h)
    h = html.unescape(re.sub(r'<[^>]+>', '', h))
    lines = [re.sub(r'[ \t   ]+', ' ', l).strip() for l in h.split('\n')]
    return [l for l in lines if l]

def page(lang, **params):
    """index.php: on 2026-11-16 the API answered this address with 429 for minutes on end, ordinary pages did not."""
    url = f'https://{lang}.wikisource.org/w/index.php?' + urllib.parse.urlencode(params)
    for attempt in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code == 404: raise SystemExit(f'{lang}: no such page: {params.get("title")}')
            wait = int(e.headers.get('Retry-After') or 20) + 3
            print(f'  HTTP {e.code}; waiting {wait}s', file=sys.stderr); time.sleep(wait)
    raise SystemExit('gave up: ' + url[:160])

# Chinese Wikisource keeps Zhu Shenghao's text in Traditional characters; the game writes Simplified, and the
# page is read as zh.wikisource itself serves it in Simplified (MediaWiki's converter, variant=zh-hans: the page view
# converts, action=render does not).
VARIANT = {'zh': 'zh-hans'}

def get(lang, title):
    p = path(lang, title)
    if os.path.exists(p): return json.load(open(p, encoding='utf-8'))
    h = page(lang, title=title, action='history', limit=1)
    rev = re.search(r'"wgCurRevisionId":(\d+)', h)
    name = re.search(r'"wgPageName":"((?:[^"\\]|\\.)*)"', h)
    if not rev or rev.group(1) == '0': raise SystemExit(f'{lang}: no such page: {title}')
    real = json.loads('"' + name.group(1) + '"').replace('_', ' ') if name else title
    time.sleep(2)
    raw = page(lang, title=real, action='raw', oldid=rev.group(1))
    m = re.match(r'\s*#[^\[\n]{2,30}\[\[([^\]|#]+)', raw)
    if m and len(raw) < 300: time.sleep(2); return get(lang, m.group(1).strip())
    time.sleep(2)
    if lang in VARIANT:
        h = page(lang, title=real, oldid=rev.group(1), variant=VARIANT[lang])
        body = h.split('id="mw-content-text"', 1)[-1].split('id="catlinks"', 1)[0]
        body = body.split('>', 1)[-1]
    else:
        body = page(lang, title=real, oldid=rev.group(1), action='render')
    rec = {'lang': lang, 'title': real, 'revid': int(rev.group(1)), 'fetched': time.strftime('%Y-%m-%d'), 'lines': to_text(body)}
    if lang in VARIANT: rec['variant'] = VARIANT[lang]
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(rec, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    time.sleep(2)
    return rec

cmd = sys.argv[1]
if cmd == 'search':
    lang, q = sys.argv[2], ' '.join(sys.argv[3:])
    for r in api(lang, action='query', list='search', srsearch=q, srlimit=25, srnamespace='0')['query']['search']: print(r['title'], '|', r['size'])
elif cmd == 'subpages':
    lang, prefix = sys.argv[2], sys.argv[3]
    d = api(lang, action='query', list='allpages', apprefix=prefix, aplimit=200, apnamespace=0)
    print('\n'.join(p['title'] for p in d['query']['allpages']))
elif cmd == 'get':
    lang = sys.argv[2]
    for t in sys.argv[3:]:
        r = get(lang, t); print(f"{r['title']}: {len(r['lines'])} lines, rev {r['revid']}")
elif cmd == 'grep':
    lang, title, rx = sys.argv[2:5]
    r = get(lang, title); L = r['lines']
    for i, l in enumerate(L):
        if re.search(rx, l, re.I): print(f'{i}: ' + ' ⏎ '.join(L[max(0, i-1):i+2])[:420])
elif cmd == 'take':
    sid, lang, title, rx = sys.argv[2:6]
    r = get(lang, title)
    hits = [l for l in r['lines'] if re.search(rx, l, re.I)]
    if len(hits) != 1: raise SystemExit(f'{len(hits)} lines match; narrow the pattern:\n' + '\n'.join(hits[:6]))
    os.makedirs(os.path.join(HERE, 'challenges', 'evidence'), exist_ok=True)
    out = os.path.join(HERE, 'challenges', 'evidence', sid + '.txt')
    url = f'https://{lang}.wikisource.org/w/index.php?title={urllib.parse.quote(r["title"].replace(" ", "_"))}&oldid={r["revid"]}' + (f'&variant={r["variant"]}' if r.get('variant') else '')
    entry = f'{url}\t{r["fetched"]}\t{hits[0]}\n'
    have = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
    if entry not in have: open(out, 'a', encoding='utf-8').write(entry)
    print(hits[0])
