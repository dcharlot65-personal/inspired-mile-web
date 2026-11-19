"""aozora.py <lang> <work> <card id> [<card id> ...] -> cache/<lang>/<work>.txt (+ .meta.json), for extract.py.

Reads an Aozora Bunko card page (https://www.aozora.gr.jp/cards/000264/card<id>.html), follows its link to
the XHTML file of the text, and keeps that file's text with the ruby readings removed (the base text only,
as ws.py does for Wikisource) and Aozora's editorial notes (［＃...］) removed. Aozora gives a file no
revision id, so the record pins the file by its URL and the sha256 of the bytes read, as is done for the
Project Gutenberg files.

Licence: the works used are in the public domain (translator Tsubouchi Shōyō died in 1935); Aozora Bunko's
files of public-domain works may be used freely (https://www.aozora.gr.jp/guide/kijyunn.html).
"""
import hashlib, html, json, os, re, sys, time, urllib.request

UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}


def get(u):
    for i in range(5):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
        except Exception:
            time.sleep(3 * (i + 1))
    raise SystemExit('gave up ' + u)


def strip(h):
    h = re.sub(r'(?is)<(script|style).*?</\1>', '', h)
    h = re.sub(r'(?is)<(rt|rp)\b[^>]*>.*?</\1>', '', h)  # ruby readings: keep the base text only
    h = re.sub(r'(?is)<span class="notes">.*?</span>', '', h)  # ［＃...］ editorial notes
    h = re.sub(r'(?i)<img[^>]*class="gaiji"[^>]*alt="([^"]*)"[^>]*>', r'〔\1〕', h)  # a character outside JIS, as Aozora describes it
    h = re.sub(r'(?i)<br\s*/?>', '\n', h)
    h = re.sub(r'(?i)</(p|div|dd|dt|li|tr|h\d|table)>', '\n', h)
    h = re.sub(r'(?s)<[^>]+>', '', h)
    h = html.unescape(h).replace('\xa0', ' ').replace('　', ' ')
    h = re.sub(r'［＃[^］]*］', '', h)
    h = re.sub(r'[ \t]+', ' ', h)
    return re.sub(r'\n\s*\n+', '\n', h).strip()


lang, work = sys.argv[1:3]
metas, parts = [], []
for cid in sys.argv[3:]:
    card_url = f'https://www.aozora.gr.jp/cards/000264/card{cid}.html'
    card = get(card_url).decode('utf-8', 'replace')
    m = re.search(r'href="\./files/(\d+_\d+\.html)"', card)
    if not m:
        raise SystemExit(f'no XHTML file on {card_url}')
    file_url = f'https://www.aozora.gr.jp/cards/000264/files/{m.group(1)}'
    raw = get(file_url)
    enc = 'shift_jis'
    mm = re.search(rb'charset=([\w-]+)', raw[:2000])
    if mm:
        enc = mm.group(1).decode().lower().replace('shift-jis', 'shift_jis')
    text = strip(raw.decode('cp932' if enc in ('shift_jis', 'sjis', 'x-sjis') else enc, 'replace'))
    title = re.search(r'<title>(.*?)</title>', card, re.S).group(1).strip()
    teihon = re.search(r'底本：([^<\n]+)', card)
    metas.append({'site': 'www.aozora.gr.jp', 'title': title, 'url': card_url, 'file': file_url, 'revid': hashlib.sha256(raw).hexdigest(),
                  'chars': len(text), 'fetched': time.strftime('%Y-%m-%d'), 'teihon': teihon.group(1).strip() if teihon else None})
    parts.append(f'\n=====PAGE {title} =====\n' + text)
    time.sleep(1)
os.makedirs(f'cache/{lang}', exist_ok=True)
open(f'cache/{lang}/{work}.txt', 'w', encoding='utf8').write('\n'.join(parts))
json.dump(metas, open(f'cache/{lang}/{work}.meta.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(lang, work, [(m['title'], m['chars'], m['revid'][:12], m['teihon']) for m in metas])
