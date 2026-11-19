"""Vietnamese words of more than one syllable, for the signature, from English Wiktionary as Wiktextract extracts it
(kaikki.org).

    python3 -I scripts/language/fetch/vi_compounds.py <empty download dir>     (from the repository root)

Vietnamese is written a syllable at a time: «vấn đề» ("problem") is two written words and one word, and its first
syllable alone is the start of other words («vấn an», "to ask after someone"). So the signature must read a line's
compounds whole. This keeps the nouns, verbs and adjectives English Wiktionary lists with two to four syllables that
occur in the game's Vietnamese lines (scripts/language/translated/vi.txt; there is no published Vietnamese line), and
writes docs/language/sources/wiktionary-vi-compounds.json with each file's sha256. A headword is kept only when one
of its senses is the standard language (the same filter as closed_class.py: not only a variant spelling, a heading
with no definition, a misspelling, slang, or one region's usage).

Licence: Wiktionary text is CC BY-SA 4.0 (and GFDL); Wiktextract is MIT. Only headwords are kept here.
"""
import hashlib, json, os, re, sys, unicodedata, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from closed_class import BASE, NOT_THE_LANGUAGE, fetch, has_sense  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
POS = ['noun', 'verb', 'adj']
TONES = '\u0300\u0301\u0303\u0309\u0323'  # grave, acute, tilde, hook above, dot below


def key(word):
    """A Vietnamese syllable as echo.ts wordKey compares it: lower case, the tone taken off its letter and put at the
    end, so either placement of the mark is one spelling (hoà, hòa)."""
    d = unicodedata.normalize('NFD', word.lower())
    return unicodedata.normalize('NFC', ''.join(c for c in d if c not in TONES)) + ''.join(c for c in d if c in TONES)


def syllables(text):
    return [key(w) for w in re.findall(r"[^\W\d_]+", unicodedata.normalize('NFC', text))]


def lines():
    out, sec = {}, None
    with open(os.path.join(ROOT, 'scripts/language/translated/vi.txt'), encoding='utf8') as f:
        for line in f:
            m = re.fullmatch(r'\[(\w+)\]', line.strip())
            if m:
                sec = m.group(1)
            elif sec == 'quotes' and '\t' in line:
                cid, text = line.rstrip('\n').split('\t', 1)
                out[cid] = text
    return out


def main():
    dl = sys.argv[1]
    os.makedirs(dl, exist_ok=True)
    grams = {}
    for cid, text in lines().items():
        s = syllables(text)
        for n in (2, 3, 4):
            for i in range(len(s) - n + 1):
                grams.setdefault(' '.join(s[i:i + n]), set()).add(cid)
    found, files = {}, {}
    for pos in POS:
        fname = f'kaikki.org-dictionary-Vietnamese-by-pos-{pos}.jsonl'
        url = f'{BASE}/Vietnamese/pos-{pos}/{fname}'
        path = os.path.join(dl, fname)
        if not os.path.exists(path) and not fetch(url, path):
            raise SystemExit('no file ' + url)
        raw = open(path, 'rb').read()
        files[pos] = {'file': fname, 'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        for line in raw.decode('utf8').splitlines():
            if not line.strip():
                continue
            e = json.loads(line)
            w = e.get('word', '')
            k = ' '.join(syllables(w))
            if k.count(' ') < 1 or k not in grams or not has_sense(e, NOT_THE_LANGUAGE):
                continue
            rec = found.setdefault(k, {'word': unicodedata.normalize('NFC', w), 'pos': [], 'cards': sorted(grams[k])})
            if pos not in rec['pos']:
                rec['pos'].append(pos)
    data = {
        'source': 'English Wiktionary via Wiktextract (kaikki.org per-part-of-speech files), Vietnamese nouns, verbs and adjectives',
        'licence': 'Wiktionary CC BY-SA 4.0 and GFDL (headwords only); Wiktextract MIT',
        'fetched': __import__('datetime').date.today().isoformat(),
        'files': files,
        'compounds': [found[k] for k in sorted(found)],
    }
    with open(os.path.join(ROOT, 'docs/language/sources/wiktionary-vi-compounds.json'), 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(len(found), 'compounds in the game\'s Vietnamese lines')


if __name__ == '__main__':
    main()
