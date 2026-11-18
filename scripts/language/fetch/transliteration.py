"""Which Chinese characters spell foreign names, for the invocation's rule that a name inside a longer foreign name is
not that name.

    TRANSLIT_CACHE=<a json file outside the repository> python3 -I scripts/language/fetch/transliteration.py <download dir with cedict.txt.gz and dict.txt.big>
    (from the repository root; needs wordfreq 3.1.1, regex and opencc-python-reimplemented 0.1.7 installed; the cache only spares the API on a rerun)

Chinese writes a foreign name in characters chosen for their sound, from a fixed set: Xinhua's tables (《世界人名翻译大辞典》,
《英语姓名译名手册》), which Chinese Wikipedia reproduces language by language as Wikipedia:外語譯音表. A name of the game is
written so too (宙斯, 帕克, 安东尼), and inside a longer foreign name it is only a piece of that name: 哈德斯菲尔德
(Huddersfield) holds 哈德斯 (Hades), 迪帕克 (Deepak) holds 帕克 (Puck), 安东尼娅 (Antonia) holds 安东尼 (Antony). ICU's
segmenter does not know most such names and cuts them into single characters, so whole segmenter words do not settle it
(the third check of round 3, 2026-11-18). This lists what src/lib/verse/echo.ts needs to see where a foreign name goes on:
  chars   every character of the tables' cells, in the characters the tables print and in Simplified (OpenCC t2s);
  bound   those of them that are not a word by themselves: jieba's dict.txt.big gives the character, alone, a tag that is a
          piece of a name or a bound morpheme (nr nrt nrfg ns nt nz j x g zg ng vg ag tg dg rg mg k h), or does not list it
          (迪, 娅, 菲, 斯, 尔, 帕, 尼, 浦);
  native  the language's common words written only in such characters, which end a foreign name rather than carry it on
          (当然, 高兴, 东西, 那里, 谢谢): words of wordfreq 3.1.1's Chinese list of two characters or more, Zipf 3 or more
          (once in a million words; van Heuven et al. 2014 put low-frequency words below it), that CC-CEDICT lists with a
          sense of a common word, one whose English gloss begins with a small letter ("thing", "to thank"), and not only as
          a proper noun ("Japan", "Parker (name)", "London"); with the Traditional spelling CC-CEDICT gives each. wordfreq
          alone cannot tell them: it counts what jieba cuts a text into, pieces of names included (尼亚, 斯坦, 帕克).
Pages not taken: the tables for Thai, Lao, Burmese, Khmer and Mongolian, which write those languages' syllables with
everyday characters (他, 天, 七), and 與後續部分連寫, which is about joining names, not a table of syllables.

Writes docs/language/sources/zh-transliteration.json; build_card_text.py puts its three lists in the Chinese pack
(pack.transliteration).

Licences: the tables are Wikipedia text (CC BY-SA 4.0), of which only the characters are kept; jieba's dictionary is MIT;
CC-CEDICT is CC BY-SA 4.0 (only the selected words are kept, without glosses);
wordfreq's data is CC BY-SA 4.0 (only the selected words are kept, without frequencies); opencc-python-reimplemented (OpenCC's tables) is Apache-2.0.
"""
import datetime, hashlib, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request

import regex

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
API = 'https://zh.wikipedia.org/w/api.php'
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
PREFIX = '外語譯音表'
EXCLUDED = {
    '泰語': 'writes Thai syllables with everyday characters (他, 天, 七)',
    '老撾語': 'writes Lao syllables with everyday characters',
    '緬甸語': 'writes Burmese syllables with everyday characters (山)',
    '高棉語': 'writes Khmer syllables with everyday characters',
    '蒙古語': 'writes Mongolian syllables with everyday characters',
    '與後續部分連寫': 'about joining a name to what follows it, not a table of syllables',
}
JIEBA_COMMIT = '67fa2e36e72f69d9134b8a1037b83fbb070b9775'
CEDICT_SHA256 = 'd7fbcfb99159d27db22787f515fd5548356607f8d9d381cb5c90917e3e7e0547'  # the export containing_words.py records
JIEBA_SHA256 = 'b16011275c42955ccd81fc1adecc93a59dbb7926af69d93fc95d4943d40f6aad'
NOT_A_WORD = {'nr', 'nrt', 'nrfg', 'ns', 'nt', 'nz', 'j', 'x', 'g', 'zg', 'ng', 'vg', 'ag', 'tg', 'dg', 'rg', 'mg', 'k', 'h'}
WORDFREQ = '3.1.1'
ZIPF = 3.0
CACHE = os.environ.get('TRANSLIT_CACHE')


def api(params):
    params = {**params, 'format': 'json', 'formatversion': '2'}
    for attempt in range(10):
        try:
            req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as ex:
            wait = max(int(ex.headers.get('Retry-After') or 0), 30 * (attempt + 1))
            print('retry', attempt, ex, file=sys.stderr)
            time.sleep(wait)
        except Exception as ex:  # noqa: BLE001
            print('retry', attempt, ex, file=sys.stderr)
            time.sleep(30 * (attempt + 1))
    raise SystemExit('zh.wikipedia did not answer')


def pages():
    """title -> {revid, timestamp, text} of every table page (namespace 4, '外語譯音表/<language>')."""
    if CACHE and os.path.exists(CACHE):
        return json.load(open(CACHE, encoding='utf8'))
    titles, cont = [], {}
    while True:
        r = api({'action': 'query', 'list': 'allpages', 'apnamespace': '4', 'apprefix': PREFIX, 'aplimit': '500',
                 'apfilterredir': 'nonredirects', **cont})
        titles += [p['title'] for p in r['query']['allpages']]
        if 'continue' not in r:
            break
        cont = r['continue']
    titles = [t for t in titles if t.count('/') == 1]
    out = {}
    for i in range(0, len(titles), 20):
        r = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content|ids|timestamp', 'rvslots': 'main',
                 'titles': '|'.join(titles[i:i + 20])})
        for p in r['query']['pages']:
            rv = p['revisions'][0]
            out[p['title']] = {'revid': rv['revid'], 'timestamp': rv['timestamp'], 'text': rv['slots']['main']['content']}
        time.sleep(2)
    if CACHE:
        json.dump(out, open(CACHE, 'w', encoding='utf8'), ensure_ascii=False)
    return out


def cell_chars(text):
    """The Han characters of a page's table cells that hold a transliteration: a cell of one to four characters and
    nothing else (headers, captions and notes left out; {{换行夹注|…}} and {{no2|…}} read for their text)."""
    out, depth = set(), 0
    for line in text.split('\n'):
        s = line.strip()
        if s.startswith('{|'):
            depth += 1
            continue
        if s.startswith('|}'):
            depth = max(0, depth - 1)
            continue
        if not depth or not s.startswith('|') or s.startswith('|+') or s.startswith('|-'):
            continue
        t = re.sub(r'\{\{\s*(?:efn|efn-lr|refn|IPA|lang|rh|abbr)[^{}]*\}\}', '', s)
        for _ in range(4):
            t = re.sub(r'\{\{\s*(?:换行夹注|no2|nowrap|Nowrap|小|small)\|([^{}]*)\}\}', r' \1 ', t)
            t = re.sub(r'\{\{[^{}]*\}\}', '', t)
        t = re.sub(r'<ref[^>]*>.*?</ref>|<ref[^>]*/>', '', t)
        t = re.sub(r'<[^>]+>', ' ', t)
        t = re.sub(r'\b(?:rowspan|colspan|style|class|align)="[^"]*"', '', t)
        for cell in re.split(r'\|\||^\|', t):
            cell = cell.strip()
            han = regex.findall(r'\p{Script=Han}', cell)
            rest = regex.sub(r'[\p{Script=Han}\s/()（）、,，·\[\]]', '', cell)
            if han and len(han) <= 4 and not rest:
                out.update(han)
    return out


def common_words(path):
    """CC-CEDICT's words that have a sense of a common word (a gloss that begins with a small letter, after any label in
    brackets), in both spellings, and the export's header."""
    import gzip
    meta, out = {}, set()
    with gzip.open(path, 'rt', encoding='utf8') as f:
        for line in f:
            if line.startswith('#!'):
                k, _, v = line[2:].strip().partition('=')
                meta[k.strip()] = v.strip()
                continue
            m = re.match(r'(\S+) (\S+) \[[^\]]*\] /(.*)/\s*$', line)
            if not m:
                continue
            for d in m.group(3).split('/'):
                d = re.sub(r'^(?:\([^)]*\)\s*)+', '', d.strip())
                if d and d[0].islower() and not d.startswith(('variant of', 'old variant of', 'see ', 'used in ', 'surname ')):
                    out.update({m.group(1), m.group(2)})
                    break
    return meta, out


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    import importlib.metadata
    import wordfreq
    from opencc import OpenCC
    if importlib.metadata.version('wordfreq') != WORDFREQ:
        raise SystemExit(f'pinned to wordfreq {WORDFREQ}')
    jpath = os.path.join(sys.argv[1], 'dict.txt.big')
    if sha256(jpath) != JIEBA_SHA256:
        raise SystemExit(f'{jpath} is not jieba {JIEBA_COMMIT} dict.txt.big; refusing it')
    cpath = os.path.join(sys.argv[1], 'cedict.txt.gz')
    if sha256(cpath) != CEDICT_SHA256:
        raise SystemExit(f'{cpath} is not the CC-CEDICT export containing_words.py recorded; refusing it')
    cmeta, common = common_words(cpath)
    t2s = OpenCC('t2s')
    ps = pages()
    tables, chars = [], set()
    for title in sorted(ps):
        lang = title.split('/')[-1]
        got = cell_chars(ps[title]['text'])
        row = {'title': title, 'revid': ps[title]['revid'], 'timestamp': ps[title]['timestamp'], 'characters': len(got)}
        if lang in EXCLUDED:
            row['notTaken'] = EXCLUDED[lang]
        else:
            chars |= got
        tables.append(row)
    chars |= {t2s.convert(c) for c in chars}
    tags = {}
    with open(jpath, encoding='utf8') as f:
        for line in f:
            p = line.split()
            if len(p) >= 3:
                tags[p[0]] = p[2]
    tag = lambda c: tags.get(c, tags.get(t2s.convert(c)))
    bound = {c for c in chars if tag(c) is None or tag(c) in NOT_A_WORD}
    freq = wordfreq.get_frequency_dict('zh')
    spellings = {}
    import gzip
    with gzip.open(cpath, 'rt', encoding='utf8') as f:
        for line in f:
            m = re.match(r'(\S+) (\S+) ', line)
            if m and not line.startswith('#'):
                spellings.setdefault(m.group(2), set()).add(m.group(1))
    native = set()
    for w, fr in freq.items():
        if len(w) >= 2 and all(c in chars for c in w) and math.log10(fr) + 9 >= ZIPF and w in common:
            native.add(w)
            native.update(t for t in spellings.get(w, ()) if t in common)
    out = {
        'built': 'scripts/language/fetch/transliteration.py',
        'fetched': datetime.date.today().isoformat(),
        'sources': {
            'tables': {'what': 'Chinese Wikipedia, Wikipedia:外語譯音表/<language> (Xinhua\'s transliteration tables)',
                       'api': API, 'licence': 'CC BY-SA 4.0; only the characters are kept', 'pages': tables},
            'jieba': {'url': f'https://raw.githubusercontent.com/fxsjy/jieba/{JIEBA_COMMIT}/extra_dict/dict.txt.big',
                      'sha256': JIEBA_SHA256, 'licence': 'MIT', 'notAWord': sorted(NOT_A_WORD)},
            'cedict': {'url': 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', 'date': cmeta.get('date'),
                       'entries': cmeta.get('entries'), 'sha256': sha256(cpath), 'licence': 'CC BY-SA 4.0',
                       'common': 'a definition that begins with a small letter, after labels in brackets; not "variant of", "see",'
                                 ' "used in" or "surname"'},
            'wordfreq': {'version': WORDFREQ, 'list': 'zh, best', 'zipf': ZIPF, 'licence': 'CC BY-SA 4.0 (data)'},
            'opencc': {'package': 'opencc-python-reimplemented', 'version': importlib.metadata.version('opencc-python-reimplemented'), 'configs': ['t2s'], 'licence': 'Apache-2.0'},
        },
        'chars': ''.join(sorted(chars)),
        'bound': ''.join(sorted(bound)),
        'native': sorted(native),
    }
    print(len(chars), 'characters,', len(bound), 'not words by themselves,', len(native), 'common words', file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/zh-transliteration.json'), 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
