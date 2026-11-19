"""Check a name against a language's Wikipedia article, for names Wikidata has no label for.

  python3 -I wikipedia.py get <lang> <title> [...]               fetch articles (wikitext) into the cache
  python3 -I wikipedia.py find <lang> <title> <text>             print where <text> occurs in a cached article
  python3 -I wikipedia.py take <key> <lang> <title> <name> [<English name>]
  python3 -I wikipedia.py take-title <key> <lang> <title> <name>
        the same, for a name read in the article's own title ("किंग लीयर" names Lear): the words recorded
        are the title. Then run `node evidence.mjs audit`: a line is only true if it was read in the
        play's own article, beside the character (evidence.mjs says how that is checked).
        if <name> occurs in the article, append one line to names-evidence.tsv: the entity key, the
        language, the name, the permanent URL of the article revision it was read in, the date, and
        the words around it (with the English name beside it, if the article glosses it so). Nothing
        else writes that file; lib.mjs accepts a hand-chosen name (picks.tsv) only when a label, an
        alias, a Wikipedia title or a line of that file has it.

Text is the page's wikitext, as the API gives it. Cache outside the repository (WP_CACHE, default
~/.cache/im-wikipedia). Requests are spaced, and a 429 waits for the Retry-After the server names.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get('WP_CACHE') or os.path.expanduser('~/.cache/im-wikipedia')
UA = {'User-Agent': 'name-check-script/1.0 (build tooling for a static site)'}
EVIDENCE = os.path.join(HERE, 'names-evidence.tsv')

def api(lang, **params):
    url = f'https://{lang}.wikipedia.org/w/api.php?' + urllib.parse.urlencode(dict(format='json', **params))
    for attempt in range(12):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get('Retry-After') or 30) + 5
            print(f'  HTTP {e.code}; waiting {wait}s', file=sys.stderr); time.sleep(wait)
        except Exception as e:
            print(f'  {e}; retrying', file=sys.stderr); time.sleep(15)
    raise SystemExit('gave up: ' + url[:160])

def path(lang, title):
    return os.path.join(CACHE, lang, re.sub(r'[^\w.-]+', '_', title) + '.json')

def page(lang, **params):
    """index.php, not api.php: on 2026-11-16 the API answered this address with 429 for minutes on end
    (other jobs share it), while ordinary page requests went through."""
    url = f'https://{lang}.wikipedia.org/w/index.php?' + urllib.parse.urlencode(params)
    for attempt in range(12):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code == 404: raise SystemExit(f'{lang}: no such page: {params.get("title")}')
            wait = int(e.headers.get('Retry-After') or 30) + 5
            print(f'  HTTP {e.code}; waiting {wait}s', file=sys.stderr); time.sleep(wait)
        except Exception as e:
            print(f'  {e}; retrying', file=sys.stderr); time.sleep(15)
    raise SystemExit('gave up: ' + url[:160])

def get(lang, title):
    p = path(lang, title)
    if os.path.exists(p): return json.load(open(p, encoding='utf-8'))
    # The current revision's id and the page's own title (after a redirect), then the text of exactly that revision.
    h = page(lang, title=title, action='history', limit=1)
    rev = re.search(r'"wgCurRevisionId":(\d+)', h)
    name = re.search(r'"wgPageName":"((?:[^"\\]|\\.)*)"', h)
    if not rev or rev.group(1) == '0': raise SystemExit(f'{lang}: no such page: {title}')
    real = json.loads('"' + name.group(1) + '"').replace('_', ' ') if name else title
    time.sleep(2)
    text = page(lang, title=real, action='raw', oldid=rev.group(1))
    # A redirect ("#REDIRECT", "#넘겨주기", "#転送", "#перенаправление", …) is a page of one link: follow it.
    m = re.match(r'\s*#[^\[\n]{2,30}\[\[([^\]|#]+)', text)
    if m and len(text) < 300:
        time.sleep(2)
        return get(lang, m.group(1).strip())
    rec = {'lang': lang, 'title': real, 'revid': int(rev.group(1)), 'fetched': time.strftime('%Y-%m-%d'), 'text': text}
    if lang == 'zh':
        # zh.wikipedia keeps much of its wikitext in Traditional characters and converts what it serves; the
        # game writes Simplified. Search the page as MediaWiki itself serves it in Simplified (variant=zh-cn).
        time.sleep(2)
        h = page(lang, title=real, oldid=rev.group(1), variant='zh-cn')
        body = h.split('id="mw-content-text"', 1)[-1].split('id="catlinks"', 1)[0]
        body = re.sub(r'<(style|script)\b.*?</\1>', '', body, flags=re.S)
        rec['wikitext'] = text
        rec['text'] = html.unescape(re.sub(r'<[^>]+>', ' ', body))
        rec['variant'] = 'zh-cn'
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(rec, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    time.sleep(3)
    return rec

def pattern(name, lang):
    """The name as a word of its language: not the middle of a longer word. Korean particles and Arabic
    prefixes attach to a name, so there only the side they do not attach to is held; Chinese and Thai
    write no spaces, so there the name is looked for as it is."""
    n = re.escape(name)
    if lang == 'ja': return r'(?<![ァ-ヺー・])' + n + r'(?![ァ-ヺー])'
    if lang == 'ko': return r'(?<![가-힣])' + n
    if lang == 'ar': return n + r'(?![\u0621-\u064A])'
    if lang in ('zh', 'th'): return n
    return r'(?<!\w)' + n + r'(?!\w)'

def around(text, at, n, width=60):
    return re.sub(r'\s+', ' ', text[max(0, at - width):at + n + width]).strip()

cmd = sys.argv[1]
if cmd == 'get':
    lang = sys.argv[2]
    for t in sys.argv[3:]:
        r = get(lang, t); print(f"{r['title']}: {len(r['text'])} chars, rev {r['revid']}")
elif cmd == 'find':
    lang, title, needle = sys.argv[2:5]
    r = get(lang, title)
    for m in list(re.finditer(re.escape(needle), r['text']))[:8]: print('  …' + around(r['text'], m.start(), len(needle)) + '…')
elif cmd == 'verify':
    # verify <key> <lang> <name> [<English name>]: look in every cached article of the language; take the
    # one that glosses the name with the English, else the one that mentions it most. Exit 1 if none has it.
    key, lang, name = sys.argv[2:5]
    english = sys.argv[5] if len(sys.argv) > 5 else ''
    # Proves nothing: a number, two letters, or the English name itself in a language with another script.
    if re.fullmatch(r'[\d\s.,]+|.{1,2}', name) or (lang in ('ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'th') and re.fullmatch(r"[A-Za-z .'-]+", name)):
        print(f'NOT FOUND {key} {lang} "{name}" (not a name this check can confirm)'); sys.exit(1)
    best = None
    d = os.path.join(CACHE, lang)
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        r = json.load(open(os.path.join(d, f), encoding='utf-8'))
        hits = [m.start() for m in re.finditer(pattern(name, lang), r['text'])]
        if not hits: continue
        glossed = any(english and english in r['text'][max(0, h - 40):h + len(name) + 40] for h in hits)
        score = (glossed, len(hits))
        if not best or score > best[0]: best = (score, r['title'])
    if not best: print(f'NOT FOUND {key} {lang} "{name}"'); sys.exit(1)
    sys.argv[1:] = ['take', key, lang, best[1], name] + ([english] if english else [])
    cmd = 'take'
if cmd == 'gloss':
    # gloss <key> <lang> <English name>: the name an article writes with the English name in brackets beside
    # it ("愛麗兒（Ariel）", "Пигва (Peter Quince)"): the source, not a translator, supplies the name.
    key, lang, english = sys.argv[2:5]
    letters = {'zh': '\u4e00-\u9fff·・', 'ja': '\u30a0-\u30ff\u4e00-\u9fff・', 'ko': '\uac00-\ud7a3 ', 'ru': 'А-Яа-яЁё\\- ', 'ar': '\u0621-\u064a\u064b-\u0652 ', 'hi': '\u0900-\u097f ', 'th': '\u0e00-\u0e7f'}[lang]
    rx = re.compile(r"([" + letters + r"]{2,30}?)\s?[(（]\s*(?:'')?\[*" + re.escape(english) + r"\]*(?:'')?\s*[)）]")
    found = {}
    d = os.path.join(CACHE, lang)
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        r = json.load(open(os.path.join(d, f), encoding='utf-8'))
        for m in rx.finditer(r['text']):
            name = m.group(1).strip(' ・·')
            found.setdefault(name, []).append(r['title'])
    if not found: print(f'NOT FOUND {key} {lang} "{english}" (no article glosses it)'); sys.exit(1)
    name = max(found, key=lambda n: len(found[n]))
    print(f'GLOSS {key} {lang} {english} -> {name}  (all: ' + '; '.join(f'{n} x{len(t)}' for n, t in found.items()) + ')', file=sys.stderr)
    sys.argv[1:] = ['take', key, lang, found[name][0], name, english]
    cmd = 'take'
if cmd == 'take-title':
    key, lang, title, name = sys.argv[2:6]
    r = get(lang, title)
    if not re.search(pattern(name, lang), r['title']): raise SystemExit(f'NOT FOUND: "{name}" is not in the title "{r["title"]}"')
    url = f'https://{lang}.wikipedia.org/w/index.php?title={urllib.parse.quote(r["title"].replace(" ", "_"))}&oldid={r["revid"]}'
    line = '\t'.join([key, lang, name, url, r['fetched'], "the article's title", r['title']]) + '\n'
    have = open(EVIDENCE, encoding='utf-8').read()
    if f'{key}\t{lang}\t{name}\t' not in have: open(EVIDENCE, 'w', encoding='utf-8').write(have + line)
    print(line.strip()); sys.exit(0)
if cmd == 'take':
    key, lang, title, name = sys.argv[2:6]
    english = sys.argv[6] if len(sys.argv) > 6 else ''
    r = get(lang, title)
    hits = [m.start() for m in re.finditer(pattern(name, lang), r['text'])]
    if not hits: raise SystemExit(f'NOT FOUND: "{name}" is not in {lang}.wikipedia "{r["title"]}" (rev {r["revid"]})')
    # Prefer an occurrence that has the English name beside it (a cast list's gloss).
    glossed = [h for h in hits if english and english in r['text'][max(0, h - 40):h + len(name) + 40]]
    at = (glossed or hits)[0]
    url = f'https://{lang}.wikipedia.org/w/index.php?title={urllib.parse.quote(r["title"].replace(" ", "_"))}&oldid={r["revid"]}'
    line = '\t'.join([key, lang, name, url, r['fetched'], 'glossed' if glossed else f'{len(hits)} mentions', around(r['text'], at, len(name)).replace('\t', ' ')]) + '\n'
    have = open(EVIDENCE, encoding='utf-8').read() if os.path.exists(EVIDENCE) else '# key\tlang\tname\tarticle revision\tfetched\thow\twords around it (wikitext)\n'
    if f'{key}\t{lang}\t{name}\t' not in have: open(EVIDENCE, 'w', encoding='utf-8').write(have + line)
    print(line.strip()[:300])
