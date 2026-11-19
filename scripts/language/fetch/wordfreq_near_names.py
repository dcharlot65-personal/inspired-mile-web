"""Common words that come near a character's name, in all fifteen languages, for the tests that no ordinary word and
no piece of a word invokes one.

    python3 -I scripts/language/fetch/wordfreq_near_names.py      (from the repository root; needs wordfreq 3.1.1 and
                                                                 pythainlp 5.1.2 installed, which carry their data)

Writes docs/language/sources/wordfreq-near-names.json: from the 40,000 most frequent words of each language in wordfreq
3.1.1 (its 'best' list; Thai, which wordfreq lacks, from the Thai National Corpus frequency list that PyThaiNLP 5.1.2
ships), every word that
  - in a spaced language, is a word of a character's name or alias, or begins with one (a declined form), or in Arabic
    holds one (a prefix);
  - in Chinese, Japanese and Thai, holds a name or alias of two letters or more, or is held by one: the words a
    segmenter may cut a name out of. Japanese is also read with its katakana as hiragana (ららぽーと holds ポー so read).
src/lib/cards-i18n/accidents.test.ts reads every one as a verse.

These lists are not what the card text is built from: the ordinary words come from Wiktionary and Hunspell
(fetch/name_pos.py), and the words that hold a name from CC-CEDICT, jieba and PyThaiNLP's word list
(fetch/containing_words.py). The second check of round 3 (2026-11-17) scanned these same lists and found what they now
hold against: Spanish «bruto», Italian «banco», German «Zettel», Japanese パック and ららぽーと, Hindi बैंको, Thai
โพสิทีฟ, Chinese 安东尼奥.

Licences: wordfreq's data is CC BY-SA 4.0 (its code Apache-2.0); the TNC list in PyThaiNLP is CC0. Only the selected
words are kept, without their frequencies. Each data file is pinned by its sha256; a different file is refused.
"""
import hashlib, json, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from name_pos import english_names, pack, units  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
LANGS = 'es fr de it pt pl ru ar hi zh ja ko vi th id'.split()
TOP = 40000
WORDFREQ = '3.1.1'
PYTHAINLP = '5.1.2'


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def fold(w):
    """Near enough to the engine's fold() to choose candidates: case, Latin accents, Arabic vowel marks."""
    w = unicodedata.normalize('NFD', w)
    w = re.sub('[\u0300-\u036f\u0640\u064b-\u065f\u0670]', '', w)
    return unicodedata.normalize('NFC', w).lower().replace('ё', 'е')


def hira(w):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in w)


def main():
    import importlib.metadata
    import pythainlp
    import wordfreq
    if importlib.metadata.version('wordfreq') != WORDFREQ or pythainlp.__version__ != PYTHAINLP:
        raise SystemExit(f'pinned to wordfreq {WORDFREQ} and pythainlp {PYTHAINLP}')
    data = os.path.join(os.path.dirname(wordfreq.__file__), 'data')
    tnc = os.path.join(os.path.dirname(pythainlp.__file__), 'corpus', 'tnc_freq.txt')
    en = english_names()
    out = {'built': 'scripts/language/fetch/wordfreq_near_names.py', 'top': TOP,
           'sources': {'wordfreq': {'version': WORDFREQ, 'list': 'best', 'licence': 'data CC BY-SA 4.0, code Apache-2.0', 'files': {}},
                       'tnc': {'name': 'Thai National Corpus word frequencies (PyThaiNLP tnc_freq.txt)', 'version': PYTHAINLP,
                               'sha256': sha256(tnc), 'licence': 'CC0 1.0'}},
           'words': {}}
    for lang in LANGS:
        if lang == 'th':
            rows = [l.split('\t') for l in open(tnc, encoding='utf8').read().split('\n') if '\t' in l]
            top = [w for w, _ in sorted(rows, key=lambda r: -int(r[1]))[:TOP]]
        else:
            for size in ('large', 'small'):
                f = os.path.join(data, f'{size}_{lang}.msgpack.gz')
                if os.path.exists(f):
                    out['sources']['wordfreq']['files'][lang] = {'file': os.path.basename(f), 'sha256': sha256(f)}
                    break
            top = wordfreq.top_n_list(lang, TOP, wordlist='best')
        us = units(pack(lang), en)
        if lang in ('zh', 'ja', 'th'):
            names = {u for u in us if len(re.findall(r'\w', u)) >= 2}
            keys = names | ({hira(u) for u in names} if lang == 'ja' else set())
            sel = [w for w in top if any(k in (hira(w) if lang == 'ja' else w) or (len(w) >= 2 and w in k) for k in keys)]
        else:
            words = {fold(x) for u in us for x in re.findall(r"[^\W\d_](?:[^\W\d_]|[\u0300-\u036f\u0900-\u097f\u064b-\u065f])*", u) if len(x) >= 3}
            sel = [w for w in top if any(fold(w).startswith(k) or (lang == 'ar' and k in fold(w)) for k in words)]
        out['words'][lang] = sel
        print(lang, len(top), 'words,', len(sel), 'near a name', file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/wordfreq-near-names.json'), 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
