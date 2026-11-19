"""Words of Chinese and Thai that hold a character's name inside them, for the invocation.

    WIKI_ITEMS_CACHE=<a json file outside the repository> \
    python3 -I scripts/language/fetch/containing_words.py <download dir with cedict.txt.gz, dict.txt.big, zhwiki-titles.gz, thwiki-titles.gz>
    (from the repository root; needs pythainlp 5.1.2 and regex; the cache only spares the API on a rerun)

Chinese and Thai are written without spaces, and the engine reads their words with ICU's segmenter
(Intl.Segmenter). ICU cuts a word its dictionary lacks into pieces, and a piece can be a name: Chinese 安东尼奥
("Antonio") came back as 安东尼 (Mark Antony) and 奥; Thai โพสิทีฟ ("positive") as โพ (Poe) and สิทีฟ (the second check
of round 3, 2026-11-17). So for each name the card text has, this lists the dictionary words that hold it with more
around it, and echo.ts refuses the name where the verse writes one of them around it.

Sources, each pinned:
  zh  CC-CEDICT (MDBG export; CC BY-SA 4.0): every entry, simplified or traditional, that holds the name. Its English
      gloss decides: an entry whose gloss names the character as English writes its name («罗密欧与朱丽叶», "Romeo and
      Juliet") is the character; any other («圣安东尼奥», "San Antonio") is another word.
      jieba's dict.txt.big (MIT; fxsjy/jieba at the commit below): the entries tagged as a foreign person's name (nrt),
      a place (ns), an organisation (nt) or another proper noun (nz) that CC-CEDICT lacks («安东尼奥», nrt). Its
      entries tagged nr (a Chinese person's name) are not taken: many are the name with a word before it («从宙斯»,
      "from Zeus"; «比宙斯», "than Zeus"), which is the name.
  th  PyThaiNLP's words_th.txt (CC0), pythainlp 5.1.2: every word that holds the name.
  zh, th  The titles of Chinese and Thai Wikipedia's articles (the dumps' all-titles-in-ns0 lists of 2026-11-01, pinned
      below), cut at every character that is not a letter, for the names that count by themselves (wiki_units): each
      piece that holds one with more letters around it, unless what touches the name there is a function word (宙斯之子,
      "son of Zeus", is the name and a phrase). The article's Wikidata item decides, as CC-CEDICT's gloss does: an item
      whose English label or alias names the character as English writes its name («宙斯神像», "Statue of Zeus") is the
      character; any other («宙斯盾», "Aegis"; «严济慈», "Yan Jici"; «塔克西多帕克», "Tuxedo Park") is another word. A title
      with no Wikidata item is not judged and not taken. These are the words no rule can tell (宙斯盾 is 宙斯 and 盾,
      "shield"); the third check of round 3 (2026-11-18) found them in these lists.
SAME below lists, with the reason, the words read by hand as the character after all.

Writes docs/language/sources/name-containing-words.json; build_card_text.py puts the other words in the Chinese and Thai
packs (pack.containing). Japanese needs none: a name in katakana counts only as a whole run of katakana (echo.ts).
"""
import gzip, hashlib, json, os, re, sys

import regex

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from name_pos import english_names, pack, units  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
JIEBA_COMMIT = '67fa2e36e72f69d9134b8a1037b83fbb070b9775'
JIEBA_SHA256 = 'b16011275c42955ccd81fc1adecc93a59dbb7926af69d93fc95d4943d40f6aad'
JIEBA_TAGS = {'nrt', 'ns', 'nt', 'nz'}
PYTHAINLP = '5.1.2'
WIKI = {
    'zh': {'file': 'zhwiki-titles.gz', 'url': 'https://dumps.wikimedia.org/zhwiki/latest/zhwiki-latest-all-titles-in-ns0.gz',
           'lastModified': '2026-11-02T00:55:33Z', 'sha256': '08d47489a13658fc4bd4fcb9be7264c863554e19df13a7357b3a8a3b297c5b0c'},
    'th': {'file': 'thwiki-titles.gz', 'url': 'https://dumps.wikimedia.org/thwiki/latest/thwiki-latest-all-titles-in-ns0.gz',
           'lastModified': '2026-11-02T05:23:31Z', 'sha256': '681938e9328c52c24b72761dc387a8f4ccd0a8abaab4a0ca1d7e0b200ae77dd2'},
}
ITEMS_CACHE = os.environ.get('WIKI_ITEMS_CACHE')
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
# Words read by hand as the character after all (the source has no gloss, or its gloss misspells the name).
SAME = {
    'zh': {
        '安东尼与克莉奥佩特拉': "Shakespeare's Antony and Cleopatra (CC-CEDICT spells it 'Anthony')",
        '安東尼與克莉奧佩特拉': "Shakespeare's Antony and Cleopatra (CC-CEDICT spells it 'Anthony')",
        '哈姆雷特式': 'Hamlet-like (jieba, nrt): about Hamlet',
        '阿波罗号': 'the Apollo spacecraft (jieba, nz), named for Apollo, as English "Apollo" counts in it',
        '阿波羅號': 'the Apollo spacecraft (jieba, nz), named for Apollo, as English "Apollo" counts in it',
    },
    'th': {},
}
# Letters a name needs to count by itself (echo.ts localCharacterNames, `min`); shorter units never stand alone.
MIN = 2


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def cedict(path):
    meta, out = {}, []
    with gzip.open(path, 'rt', encoding='utf8') as f:
        for line in f:
            if line.startswith('#!'):
                k, _, v = line[2:].strip().partition('=')
                meta[k.strip()] = v.strip()
                continue
            if line.startswith('#'):
                continue
            m = re.match(r'(\S+) (\S+) \[([^\]]*)\] /(.*)/\s*$', line)
            if m:
                out.append((m.group(1), m.group(2), m.group(4)))
    return meta, out


def names_the_character(gloss, english):
    """Does an English gloss name the character as English writes its name (a word of it, with its capital)?"""
    words = {w for n in english for w in re.findall(r"[A-Za-z']+", n) if len(w) > 2 and w not in ('The', 'Lord', 'Lady', 'King', 'Prince', 'Friar')}
    return any(re.search(r'\b' + re.escape(w) + r'\b', gloss) for w in words)


def letters(t):
    return len(regex.findall(r'\p{L}', t))


def wiki_units(p, en):
    """The names that count by themselves, as echo.ts localNames takes them: each full name, its last word where the
    English card has a longer name (each word where it has one), and each alias; not a word the card text lists as common
    or ordinary, nor one of fewer than MIN letters. By the letters it is compared by, with the English names it stands for."""
    from name_pos import SPLIT, clean
    skip = set(p.get('common', [])) | set(p.get('ordinary', []))
    out = {}
    for cid, e in p['cards'].items():
        if cid[:2] in ('RL', 'PT') or not e.get('name') or e['nameSource'] in ('missing', 'kept'):
            continue
        full = clean(re.sub(r',.*$', '', e['name']).strip())
        parts = [w for w in (clean(x) for x in SPLIT.split(full)) if w]
        for u in [full] + (parts if len(en[cid].split()) == 1 else parts[-1:]) + [clean(a) for a in e.get('aliases', [])]:
            if u and u not in skip and letters(u) >= MIN:
                out.setdefault(u, set()).add(en[cid])
    return out


def api(host, params):
    import time, urllib.error, urllib.parse, urllib.request
    params = {**params, 'format': 'json', 'formatversion': '2'}
    for attempt in range(12):
        try:
            req = urllib.request.Request(f'https://{host}/w/api.php?' + urllib.parse.urlencode(params), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as ex:
            print('retry', attempt, ex, file=sys.stderr)
            time.sleep(max(int(ex.headers.get('Retry-After') or 0), 60 * (attempt + 1)))
    raise SystemExit(f'{host} did not answer')


def wiki_items(lang, titles):
    """title -> {'item', 'en', 'aliases'}: the Wikidata item of the article (redirects followed) and its English label and
    aliases, from the cache where it has the title."""
    import time
    cache = json.load(open(ITEMS_CACHE, encoding='utf8')) if ITEMS_CACHE and os.path.exists(ITEMS_CACHE) else {}
    have = cache.setdefault(lang, {})
    todo = sorted(set(titles) - set(have))
    for i in range(0, len(todo), 50):
        q = api(f'{lang}.wikipedia.org', {'action': 'query', 'prop': 'pageprops', 'ppprop': 'wikibase_item', 'titles': '|'.join(todo[i:i + 50]),
                                          'redirects': '1'}).get('query', {})
        back = {n['to']: n['from'] for n in q.get('normalized', [])}
        red = {}
        for r in q.get('redirects', []):
            red.setdefault(r['to'], []).append(back.get(r['from'], r['from']))
        for pg in q.get('pages', []):
            for t in [back.get(pg['title'], pg['title'])] + red.get(pg['title'], []):
                have[t] = {'page': pg['title'], 'item': pg.get('pageprops', {}).get('wikibase_item')}
        time.sleep(4)
    ids = sorted({v['item'] for t, v in have.items() if t in titles and v.get('item') and 'en' not in v})
    for i in range(0, len(ids), 50):
        es = api('www.wikidata.org', {'action': 'wbgetentities', 'ids': '|'.join(ids[i:i + 50]), 'props': 'labels|aliases',
                                      'languages': 'en'}).get('entities', {})
        for v in have.values():
            e = es.get(v.get('item') or '')
            if e is not None:
                v['en'] = e.get('labels', {}).get('en', {}).get('value')
                v['aliases'] = [a['value'] for a in e.get('aliases', {}).get('en', [])]
        time.sleep(4)
    if ITEMS_CACHE:
        json.dump(cache, open(ITEMS_CACHE, 'w', encoding='utf8'), ensure_ascii=False)
    return {t: have.get(t, {}) for t in titles}


def wiki_rows(lang, dl, p, en):
    """Wikipedia's article titles, cut into their pieces, that hold a name that counts by itself (see the header)."""
    import gzip
    w = WIKI[lang]
    path = os.path.join(dl, w['file'])
    if sha256(path) != w['sha256']:
        raise SystemExit(f'{path} is not the {lang} title list of 2026-11-01 (sha256 {w["sha256"]}); refusing it')
    units = wiki_units(p, en)
    keys = {regex.sub(r'[^\p{L}\p{M}]', '', u): (u, names) for u, names in units.items()}
    stop = set(p['stop'])
    function = (lambda t, end: t and (t[-1] if end else t[0]) in stop) if lang == 'zh' else \
        (lambda t, end: any((t.endswith(s) if end else t.startswith(s)) for s in stop if len(s) >= 2))
    found = []
    with gzip.open(path, 'rt', encoding='utf8') as f:
        for line in f:
            title = line.rstrip('\n').replace('_', ' ')
            if not any(k in title for k in keys):
                continue
            for piece in (x for x in regex.split(r'[^\p{L}\p{M}]+', title) if x):
                for k, (u, names) in keys.items():
                    o = piece.find(k)
                    while o >= 0 and piece != k:
                        if not (function(piece[:o], True) or function(piece[o + len(k):], False)):
                            found.append((u, names, piece, title))
                        o = piece.find(k, o + 1)
    items = wiki_items(lang, sorted({t for *_, t in found}))
    rows = {}
    for u, names, piece, title in found:
        it = items.get(title) or {}
        if not it.get('item') or (u, piece) in rows:
            continue
        label = ' / '.join(x for x in [it.get('en')] + it.get('aliases', []) if x)
        rows[(u, piece)] = {'word': piece, 'source': f'{lang}wiki title', 'title': title, 'item': it['item'], 'label': label[:160],
                            'same': piece in SAME[lang] or names_the_character(label, names)}
    return rows, {'name': f'{lang}.wikipedia article titles', **{k: v for k, v in w.items() if k != 'file'},
                  'licence': 'CC BY-SA 4.0 (titles); Wikidata labels CC0', 'items': 'Wikidata item and English label by the MediaWiki API'}


def main():
    dl = sys.argv[1]
    en = english_names()
    out = {'built': 'scripts/language/fetch/containing_words.py', 'languages': {}, 'sources': {}}
    # Chinese
    cpath = os.path.join(dl, 'cedict.txt.gz')
    meta, entries = cedict(cpath)
    jpath = os.path.join(dl, 'dict.txt.big')
    if sha256(jpath) != JIEBA_SHA256:
        raise SystemExit(f'{jpath} is not jieba {JIEBA_COMMIT} dict.txt.big (sha256 {JIEBA_SHA256}); refusing it')
    jieba = []
    with open(jpath, encoding='utf8') as f:
        for line in f:
            p = line.split()
            if len(p) >= 3 and p[2] in JIEBA_TAGS:
                jieba.append((p[0], p[2]))
    out['sources']['zh'] = [
        {'name': 'CC-CEDICT', 'url': 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', 'date': meta.get('date'),
         'entries': meta.get('entries'), 'sha256': sha256(cpath), 'licence': 'CC BY-SA 4.0'},
        {'name': 'jieba dict.txt.big', 'url': f'https://raw.githubusercontent.com/fxsjy/jieba/{JIEBA_COMMIT}/extra_dict/dict.txt.big',
         'sha256': JIEBA_SHA256, 'licence': 'MIT', 'tags': sorted(JIEBA_TAGS)}]
    zh = {}
    known = {w for t, s, _ in entries for w in (t, s)}
    for u, names in sorted(units(pack('zh'), en).items()):
        if letters(u) < MIN:
            continue
        rows = {}
        for t, s, g in entries:
            for w in {t, s}:
                if u in w and w != u and w not in rows:
                    same = w in SAME['zh'] or names_the_character(g, names)
                    rows[w] = {'word': w, 'source': 'CC-CEDICT', 'gloss': g[:160], 'same': same,
                               **({'why': SAME['zh'][w]} if w in SAME['zh'] else {})}
        for w, tag in jieba:
            if u in w and w != u and w not in rows and w not in known:
                same = w in SAME['zh']
                rows[w] = {'word': w, 'source': f'jieba ({tag})', 'same': same, **({'why': SAME['zh'][w]} if same else {})}
        if rows:
            zh[u] = sorted(rows.values(), key=lambda r: r['word'])
    wrows, wsrc = wiki_rows('zh', dl, pack('zh'), en)
    out['sources']['zh'].append(wsrc)
    for (u, piece), r in sorted(wrows.items()):
        have = {x['word'] for x in zh.get(u, [])}
        if piece not in have:
            zh[u] = sorted(zh.get(u, []) + [r], key=lambda x: x['word'])
    out['languages']['zh'] = zh
    # Thai
    import pythainlp
    from pythainlp.corpus import thai_words
    if pythainlp.__version__ != PYTHAINLP:
        raise SystemExit(f'pythainlp {pythainlp.__version__}; this list is pinned to {PYTHAINLP}')
    tpath = os.path.join(os.path.dirname(pythainlp.__file__), 'corpus', 'words_th.txt')
    out['sources']['th'] = [{'name': 'PyThaiNLP words_th.txt', 'version': PYTHAINLP, 'sha256': sha256(tpath), 'licence': 'CC0 1.0'}]
    tw = sorted(thai_words())
    th = {}
    for u in sorted(units(pack('th'), en)):
        if letters(u) < MIN:
            continue
        rows = [{'word': w, 'source': 'PyThaiNLP', 'same': w in SAME['th'], **({'why': SAME['th'][w]} if w in SAME['th'] else {})}
                for w in tw if u in w and w != u]
        if rows:
            th[u] = rows
    wrows, wsrc = wiki_rows('th', dl, pack('th'), en)
    out['sources']['th'].append(wsrc)
    for (u, piece), r in sorted(wrows.items()):
        have = {x['word'] for x in th.get(u, [])}
        if piece not in have:
            th[u] = sorted(th.get(u, []) + [r], key=lambda x: x['word'])
    out['languages']['th'] = th
    for lang in ('zh', 'th'):
        n = sum(1 for rs in out['languages'][lang].values() for r in rs if not r['same'])
        print(lang, len(out['languages'][lang]), 'names held in longer words;', n, 'other words', file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/name-containing-words.json'), 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
