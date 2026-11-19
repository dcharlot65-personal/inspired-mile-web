"""Fetch the closed-class words (function words) of each card-text language from Wiktionary, as Wiktextract
extracts them (kaikki.org).

    python3 -I scripts/language/fetch/closed_class.py <empty download dir>     (from the repository root)

Writes docs/language/sources/wiktionary-closed-class.json: for every language, the headwords English
Wiktionary gives as a pronoun, particle, conjunction, preposition, postposition, determiner or article
(kaikki.org's per-part-of-speech files, which Wiktextract builds from the English Wiktionary dump). These are
function words by definition, so none of them is a telling word of a quotation. stopwords-iso lacks many of
them in some languages (Thai เจ้า "you", Korean 그대 "you", Japanese あなた): build_card_text.py adds them to
that language's stop list. Korean particles (josa) also tell the signature and the invocation which endings a
Korean word may carry.

The Wiktionary API itself answered 429 (rate limited) on 2026-11-16, which is why the extracted files are used.
Licence: Wiktionary text is CC BY-SA 4.0 (and GFDL); Wiktextract is MIT. Only headwords are kept here.
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
LANGS = {'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'pl': 'Polish', 'ru': 'Russian',
         'ar': 'Arabic', 'hi': 'Hindi', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'vi': 'Vietnamese', 'th': 'Thai',
         'id': 'Indonesian'}
POS = {'pron': 'pronoun', 'particle': 'particle', 'conj': 'conjunction', 'prep': 'preposition', 'postp': 'postposition',
       'det': 'determiner', 'article': 'article'}
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
# Which senses make a headword a function word of the language. 'words' keeps a headword when at least one of its senses
# in the class is not one of these: a variant spelling of another word (alt-of: French "fous" for "vous"), a heading with
# no definition (no-gloss: Hindi पुस्तक "book" filed as a conjunction), a misspelling, slang or Internet usage, or usage
# of one region only (Vietnamese "hè", a Central particle, is also "summer"). Archaic, literary, humorous, historical
# and dialectal senses are kept: the published translations use them (Thai ข้า and เจ้า, Japanese お前, Vietnamese nàng).
REGIONS = {'regional', 'Central', 'Southern', 'Northern', 'South', 'North', 'Southwestern', 'Eastern', 'Vietnam', 'Gyeongsang',
           'Jeolla', 'Hamgyong', 'Yukjin', 'Russia', 'Gangwon', 'Chungcheong', 'Pyongan', 'Hwanghae'}
NOT_THE_LANGUAGE = {'alt-of', 'no-gloss', 'misspelling', 'Internet', 'slang', 'proscribed', 'pronunciation-spelling', 'nonstandard',
                    'US', 'in business names', 'Japan'} | REGIONS
# 'standard' is stricter, for the Korean particles only (which endings a Korean noun may carry; dialect, slang and old
# forms such as -스 or -쓰 would cut real words short).
NOT_STANDARD = NOT_THE_LANGUAGE | {'dialectal', 'humorous', 'slur', 'ethnic', 'childish', 'obsolete', 'archaic'}
REGION_GLOSS = re.compile(r'\b(dialect|Gyeongsang|Jeolla|Hamgyong|Yukjin|Gangwon|Chungcheong|Pyongan|Hwanghae|Jeju)\b')


def has_sense(entry, excluded):
    for sense in entry.get('senses', []):
        tags = set(sense.get('tags', [])) | set(sense.get('raw_tags', []))
        gloss = ' '.join(sense.get('glosses', []))
        if not tags & excluded and not REGION_GLOSS.search(gloss):
            return True
    return False


BASE = 'https://kaikki.org/dictionary'


def fetch(url, path):
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r, open(path, 'wb') as f:
                f.write(r.read())
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            if e.code in (429, 503):
                time.sleep(10 * (1 + i))
                continue
            raise
    raise SystemExit('gave up ' + url)


ALLOMORPH = re.compile(r'post-vowel (and post-ㄹ \(l\) )?allomorph(?:ic)? form of -(\S+)|synonym of -(\S+) \([^)]*\) used after (?:words ending (?:with|in) )?(?:a )?vowels?', re.I)


def ko_allomorphs(raw):
    """Korean particles that have one form after a vowel and another after a consonant, as Wiktionary's glosses say
    ("-를: post-vowel allomorphic form of -을"; "-로: post-vowel and post-ㄹ (l) allomorphic form of -으로"; "-가:
    synonym of -이 ... used after vowels"). A noun ending in a vowel takes the first, one ending in a consonant the
    second, so 아이 ("child") is not 아 + the particle 이."""
    out = {}
    for line in raw.decode('utf8').splitlines():
        if not line.strip():
            continue
        e = json.loads(line)
        for sense in e.get('senses', []):
            tags = set(sense.get('tags', [])) | set(sense.get('raw_tags', []))
            m = ALLOMORPH.search(' '.join(sense.get('glosses', [])))
            if m and not tags & NOT_STANDARD:
                vowel, cons = e['word'].lstrip('-'), (m.group(2) or m.group(3)).lstrip('-')
                out[(vowel, cons)] = {'after_vowel': vowel, 'after_consonant': cons, 'after_l': bool(m.group(1))}
    return [out[k] for k in sorted(out)]


def main():
    dl = sys.argv[1]
    os.makedirs(dl, exist_ok=True)
    index = urllib.request.urlopen(urllib.request.Request(BASE + '/index.html', headers=UA), timeout=60).read().decode('utf8')
    m = re.search(r'extracted on (\d{4}-\d{2}-\d{2}) from the enwiktionary dump dated (\d{4}-\d{2}-\d{2})', re.sub(r'<[^>]+>', '', index))
    commit = re.search(r'wiktextract/commit/([0-9a-f]{40})', index)
    data = {'source': 'English Wiktionary, headwords by part of speech, as extracted by Wiktextract (kaikki.org)',
            'url': BASE + '/<Language>/pos-<pos>/kaikki.org-dictionary-<Language>-by-pos-<pos>.jsonl',
            'extracted': m.group(1) if m else None, 'dump': m.group(2) if m else None,
            'wiktextract_commit': commit.group(1) if commit else None,
            'licence': 'Wiktionary: CC BY-SA 4.0 and GFDL; Wiktextract: MIT. Only headwords are kept.',
            'fetched': time.strftime('%Y-%m-%d'), 'pos': POS, 'languages': {}}
    for code, name in LANGS.items():
        out = {}
        for pos in POS:
            fname = f'kaikki.org-dictionary-{name}-by-pos-{pos}.jsonl'
            url = f'{BASE}/{urllib.parse.quote(name)}/pos-{pos}/{fname}'
            path = os.path.join(dl, fname)
            if not os.path.exists(path) and not fetch(url, path):
                out[pos] = {'file': None, 'words': []}
                print(code, pos, 'none', flush=True)
                continue
            raw = open(path, 'rb').read()
            words, std, left = set(), set(), set()
            for line in raw.decode('utf8').splitlines():
                if line.strip():
                    e = json.loads(line)
                    if e.get('lang_code') in (None, code) or name == 'Chinese':
                        (words if has_sense(e, NOT_THE_LANGUAGE) else left).add(e['word'])
                        if has_sense(e, NOT_STANDARD):
                            std.add(e['word'])
            out[pos] = {'file': fname, 'sha256': hashlib.sha256(raw).hexdigest(), 'words': sorted(words), 'standard': sorted(std),
                        'left out': sorted(left - words)}
            if code == 'ko' and pos == 'particle':
                out[pos]['allomorphs'] = ko_allomorphs(raw)
            print(code, pos, len(words), flush=True)
            time.sleep(1)
        data['languages'][code] = out
    path = os.path.join(ROOT, 'docs/language/sources/wiktionary-closed-class.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', path, data['extracted'], data['dump'], data['wiktextract_commit'])


if __name__ == '__main__':
    main()
