"""Words of real use that come near a character's name, for the test that no ordinary word invokes one.

    python3 -I scripts/language/fetch/near_names.py <empty download dir>     (from the repository root)

Writes docs/language/sources/opensubtitles-near-names.json: for each spaced language with a list, every word of the
50,000 most frequent words in film and television subtitles (Hermit Dave's FrequencyWords, built from OpenSubtitles
2018) that begins as a word of a character's name or alias does, or (Arabic, where words take prefixes) holds it.
src/lib/cards-i18n/accidents.test.ts says each of them, as written and with a capital (Russian and Polish verse start
each line with one), and only the names themselves and their listed forms may invoke anyone.

The second check (2026-11-17) found the accidents this test now holds against by scanning these lists: Russian «Банки»
and «Дитя», Polish «Kora» and «Bańka», Arabic «بانكوك». The lists are pinned to one commit and their sha256; a
different file is refused. Licence: FrequencyWords' content is CC BY-SA 4.0 (its code MIT); only the selected words are
kept here, without their counts.
"""
import hashlib, json, os, re, sys, unicodedata, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
COMMIT = '525f9b560de45753a5ea01069454e72e9aa541c6'
URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/{commit}/content/2018/{lang}/{lang}_50k.txt'
SHA256 = {
    'ar': 'bbe98b4b92902b392bdefa2e555a108fdb42a5dd79d261674be5ab666229e19f',
    'de': 'd9e50546fd7e8b6fe6542a2b33c51d1331092b2a3916ec09f80d97856068705b',
    'es': 'dcff3ad4316192f4dc4ff7d26e637c6ff314ef1ca0f3f720c5649018a71056c0',
    'fr': 'f81f7c570b6433764da99aa30f4dfb08d81c5926301377b709af23a13b1f9596',
    'id': 'f2eea0da9735b7040efbfa813f5f875ec931de5a0ec70a6f28213ea60a87bb38',
    'it': 'bb96cdcb56d28342c1e909db6b2525448b7767136b7e86a2ccc649a1be66fc19',
    'ko': '8d00401b6728c8d6feeaa5455583c1a33408dd020aae4aa55609b25004d1d99d',
    'pl': '50bf8d30d1ed4f5cedceb3e40e74d793ec6bec0f16d9f3dd0a2c9e313402e10f',
    'pt': 'f97704382f97273ff59488b1885e7ac90d20f81fd92e5fbad3e3ce43633f495c',
    'ru': '6095f507cc167488ec66ada5a85ac50433503a08ad24a07c6eabdf54352c4e7f',
    'vi': '3f5b112e4324136c2ba82d3151038607e3dd1dfa0911c226929d7544cc11adf3',
}
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
WORD = re.compile(r"[^\W\d_](?:[^\W\d_]|[̀-ًͯ-ٰٟ])*", re.U)


def fold(w):
    """Near enough to the engine's fold() to choose candidates: case, Latin accents, Arabic vowel marks and hamza seats."""
    w = unicodedata.normalize('NFD', w)
    w = re.sub(r'[̀-ͯـً-ٰٟ]', '', w)
    return unicodedata.normalize('NFC', w).lower().replace('ё', 'е')


def pack(lang):
    s = open(os.path.join(ROOT, f'src/lib/cards-i18n/{lang}.ts'), encoding='utf8').read()
    return json.loads(s[s.index('= {') + 2:s.rindex('};') + 1])


def name_words(lang, p, ents):
    """The words of every character's name and alias in the card text, and of every label and alias Wikidata gives the
    characters' items in the language, taken or not (so a rejected alias, such as Russian «Дит», still brings its
    neighbours in: put back, the test would see «Дитя»)."""
    texts = []
    for cid, e in p['cards'].items():
        if e.get('name') and e['nameSource'] not in ('missing', 'kept') and cid[:2] not in ('RL', 'PT'):
            texts += [e['name'].split(',')[0]] + e.get('aliases', [])
    for e in ents.values():
        texts += [t for t in [e['labels'].get(lang)] if t] + e.get('aliases', {}).get(lang, [])
    return {fold(w) for t in texts for w in WORD.findall(t) if len(w) >= 3}


def main():
    dl = sys.argv[1]
    os.makedirs(dl, exist_ok=True)
    ents = json.load(open(os.path.join(ROOT, 'docs/language/sources/wikidata-card-names.json'), encoding='utf8'))['entities']
    out = {'source': 'Hermit Dave, FrequencyWords, content/2018/<lang>/<lang>_50k.txt (from OpenSubtitles 2018, opus.nlpl.eu)',
           'commit': COMMIT, 'licence': 'CC BY-SA 4.0 (content); only the selected words are kept, without counts',
           'sha256': SHA256,
           'rule': 'a word whose letters (case, accents and Arabic marks folded) begin with the first max(3, n - 2) letters of '
                   'a word of n letters of a character\'s name or alias in the card text, or of a label or alias Wikidata gives the '
                   'characters\' items in that language; in Arabic also a word that holds one',
           'words': {}}
    for lang, sha in SHA256.items():
        path = os.path.join(dl, f'{lang}_50k.txt')
        if not os.path.exists(path):
            with urllib.request.urlopen(urllib.request.Request(URL.format(commit=COMMIT, lang=lang), headers=UA), timeout=60) as r:
                open(path, 'wb').write(r.read())
        data = open(path, 'rb').read()
        got = hashlib.sha256(data).hexdigest()
        if got != sha:
            sys.exit(f'{lang}: sha256 {got} is not the pinned {sha}; refusing a different file')
        words = [l.split(' ')[0] for l in data.decode('utf8').split('\n') if l.strip()]
        names = name_words(lang, pack(lang), ents)
        starts = {n[:max(3, len(n) - 2)] for n in names}
        near = [w for w in words if any(fold(w).startswith(s) for s in starts) or (lang == 'ar' and any(n in fold(w) for n in names))]
        out['words'][lang] = near
        print(lang, len(names), 'name words,', len(near), 'near them')
    with open(os.path.join(ROOT, 'docs/language/sources/opensubtitles-near-names.json'), 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()
