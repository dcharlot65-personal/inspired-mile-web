"""Fetch an Aozora Bunko text (aozora.gr.jp: public-domain Japanese texts) as plain lines, for quoting.

  python3 -I aozora.py get <file url>                          fetch into the cache; print size and hash
  python3 -I aozora.py grep <file url> <regex>                 print the lines that match
  python3 -I aozora.py take <source id> <file url> <regex>
        append the ONE line that matches to challenges/evidence/<source id>.txt, with the file's URL and the
        SHA-256 of the exact bytes read (Aozora has no revision ids; the hash says which text was quoted).

The file is the card's XHTML in Shift_JIS. Ruby readings (<rt>, <rp>) are dropped and the base text kept;
one line per <br />. Nothing is converted: the text keeps the old orthography the edition has, and its
ideographic spaces (U+3000); only ASCII white space is collapsed, and the indent at a line's start dropped.
Cache outside the repository (AOZORA_CACHE, default ~/.cache/im-aozora).
"""
import hashlib, html, json, os, re, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get('AOZORA_CACHE') or os.path.expanduser('~/.cache/im-aozora')
UA = {'User-Agent': 'quote-fetch-script/1.0 (build tooling for a static site)'}

def get(url):
    if not url.startswith('https://www.aozora.gr.jp/cards/'): raise SystemExit('not an Aozora Bunko file: ' + url)
    # .v2: lines keep U+3000 IDEOGRAPHIC SPACE (the first version collapsed it with the ASCII spaces, so a
    # quotation was not the source character for character).
    p = os.path.join(CACHE, re.sub(r'[^\w.-]+', '_', url) + '.v2.json')
    if os.path.exists(p): return json.load(open(p, encoding='utf-8'))
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        raw = r.read()
    h = raw.decode('cp932')
    body = h.split('<div class="main_text">', 1)[-1].split('<div class="bibliographical_information">', 1)[0]
    body = re.sub(r'<rt>.*?</rt>|<rp>.*?</rp>', '', body, flags=re.S)
    body = re.sub(r'<br\s*/?>', '\n', body)
    # Only ASCII white space is layout here; U+3000 between sentences is the text's own.
    lines = [re.sub(r'[ \t\r\n\f\v]+', ' ', html.unescape(re.sub(r'<[^>]+>', '', l))).strip(' \t\r\n\f\v\u3000') for l in body.split('\n')]
    rec = {'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'fetched': time.strftime('%Y-%m-%d'), 'lines': [l for l in lines if l]}
    os.makedirs(CACHE, exist_ok=True)
    json.dump(rec, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    return rec

cmd = sys.argv[1]
if cmd == 'get':
    r = get(sys.argv[2]); print(f"{len(r['lines'])} lines, sha256 {r['sha256'][:16]}…")
elif cmd == 'grep':
    r = get(sys.argv[2]); L = r['lines']
    for i, l in enumerate(L):
        if re.search(sys.argv[3], l): print(f'{i}: ' + ' ⏎ '.join(L[max(0, i - 1):i + 2])[:300])
elif cmd == 'take':
    sid, url, rx = sys.argv[2:5]
    r = get(url)
    hits = [l for l in r['lines'] if re.search(rx, l)]
    if len(hits) != 1: raise SystemExit(f'{len(hits)} lines match; narrow the pattern:\n' + '\n'.join(hits[:6]))
    out = os.path.join(HERE, 'challenges', 'evidence', sid + '.txt')
    entry = f"{url}#sha256={r['sha256']}\t{r['fetched']}\t{hits[0]}\n"
    have = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
    if entry not in have: open(out, 'a', encoding='utf-8').write(entry)
    print(hits[0])
