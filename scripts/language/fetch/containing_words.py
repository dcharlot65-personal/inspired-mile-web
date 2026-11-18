"""Words of Chinese and Thai that hold a character's name inside them, for the invocation.

    python3 -I scripts/language/fetch/containing_words.py <download dir with cedict.txt.gz and dict.txt.big>
    (from the repository root; needs pythainlp 5.1.2 and regex)

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
    out['languages']['th'] = th
    for lang in ('zh', 'th'):
        n = sum(1 for rs in out['languages'][lang].values() for r in rs if not r['same'])
        print(lang, len(out['languages'][lang]), 'names held in longer words;', n, 'other words', file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/name-containing-words.json'), 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
