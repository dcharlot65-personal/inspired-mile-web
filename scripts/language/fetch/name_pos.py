"""Which words of the characters' names are also ordinary words of their language, by English Wiktionary.

    NAME_POS_CACHE=<a json file outside the repository> python3 -I scripts/language/fetch/name_pos.py
    (from the repository root; reads the generated card text; the cache only spares the API on a rerun)

The invocation (src/lib/verse/echo.ts) counts a character's name, and some single words of it, by themselves. English
never counts a name by itself that is an ordinary word ("Bottom", "Nurse": devices.ts ORDINARY_NAME_PARTS). The second
check of round 3 (2026-11-17) found the same case in the other languages, where nothing held it: Spanish and Italian
«Bruto» ("gross", "brute"), Italian «Banco» ("bench"), German «Zettel» ("note"), Japanese パック ("pack") and ブレイク
("break"), Hindi बैंको ("banks", typed without the nasal mark), Thai โพ (the Bodhi tree).

For every word that could count by itself (each word of a character's name and of its aliases, and a whole name), this
reads English Wiktionary's page for it under the language's own heading:
  - where the script has capitals, the page of the word written small (the page "Bruto" is the name, the page "bruto"
    the adjective; a given name is sometimes filed under Noun, as Russian «Антоний» is, so the capitalised page is not
    read); German writes its nouns with a capital, so there the capitalised page is read for a Noun (Zettel, "note") and
    the small one for any other word (blake, a form of blaken);
  - Arabic, Hindi, Chinese, Japanese, Korean and Thai have no capitals: the page as written. A simplified Chinese page
    that only points to the traditional one ({{zh-see}}) is read through that one.
A word is ORDINARY when, under a part of speech that is not a name (Noun, Verb, Adjective, Adverb, ...; not Proper
noun, Romanization, Letter, Han character, ...), one definition is a word of its own or a form of one (an inflection,
a verb form). A definition whose only gloss is the character's English name (German «Brutus», filed under Noun as
"Brutus"), or that only gives another spelling (alt form), does not make it one. Every page read is pinned by its
revision id, with the verdict on each definition.

Writes docs/language/sources/wiktionary-name-pos.json. build_card_text.py puts the ordinary words in each pack
(pack.ordinary), with Hunspell's verdicts in the languages written with capitals (docs/language/checks/name-words.json).

Licence: Wiktionary text is CC BY-SA 4.0 (and GFDL); only titles, revision ids, headings and verdicts are kept.
"""
import datetime, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

import regex  # the \p{L} classes the engine reads words with

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
LANGS = 'es fr de it pt pl ru ar hi zh ja ko vi th id'.split()
HEADING = {'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'pl': 'Polish', 'ru': 'Russian',
           'ar': 'Arabic', 'hi': 'Hindi', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'vi': 'Vietnamese', 'th': 'Thai',
           'id': 'Indonesian'}
CASED = set('es fr de it pt pl ru vi id'.split())
# Parts of speech of an ordinary word. Anything else Wiktionary heads a section with (Proper noun, Romanization, Letter,
# Han character, Kanji, Syllable, Suffix, Prefix, Abbreviation, ...) does not make a word one.
ORDINARY_POS = {'Noun', 'Verb', 'Adjective', 'Adverb', 'Interjection', 'Pronoun', 'Particle', 'Conjunction', 'Preposition',
                'Postposition', 'Determiner', 'Numeral', 'Article', 'Phrase', 'Proverb', 'Counter', 'Classifier', 'Participle',
                'Contraction', 'Idiom', 'Adnominal', 'Prepositional phrase'}
API = 'https://en.wiktionary.org/w/api.php'
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
SPLIT = re.compile(r'[\s・·‧]+')
CACHE = os.environ.get('NAME_POS_CACHE')


def pack(lang):
    s = open(os.path.join(ROOT, f'src/lib/cards-i18n/{lang}.ts'), encoding='utf8').read()
    return json.loads(s[s.index('= {') + 2:s.rindex('};') + 1])


def clean(t):
    """As echo.ts localCharacterNames cleans a name: no leading non-letters, no trailing ones but marks."""
    return regex.sub(r'^[^\p{L}]+|[^\p{L}\p{M}]+$', '', t)


def english_names():
    """Card id -> the English card name (src/lib/cards.ts, read as build_card_text.py reads it)."""
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from build_card_text import cards  # noqa: E402
    return {c['id']: c['name'] for c in cards()}


def units(p, en):
    """Each whole name, each word of it, and each alias, as the card text writes them (characters only), with the English
    names of the cards it names."""
    out = {}
    for cid, e in p['cards'].items():
        if cid[:2] in ('RL', 'PT') or not e.get('name') or e['nameSource'] in ('missing', 'kept'):
            continue
        for t in [re.sub(r',.*$', '', e['name'])] + e.get('aliases', []):
            t = clean(t.strip())
            if not t:
                continue
            for u in [t] + [w for w in (clean(x) for x in SPLIT.split(t)) if w]:
                out.setdefault(u, set()).add(en[cid])
    return out


def get(titles):
    q = {'action': 'query', 'prop': 'revisions', 'rvprop': 'content|ids', 'rvslots': 'main', 'titles': '|'.join(titles),
         'format': 'json', 'formatversion': '2', 'redirects': '1'}
    for attempt in range(8):
        try:
            req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=90))
        except Exception as ex:  # noqa: BLE001
            print('retry', attempt, ex, file=sys.stderr)
            time.sleep(10 * (attempt + 1))
    raise SystemExit('Wiktionary did not answer')


def fetch_pages(titles):
    """title -> {'title', 'revid', 'text'} for the pages that exist (redirects followed), keyed by the title asked."""
    cache = json.load(open(CACHE, encoding='utf8')) if CACHE and os.path.exists(CACHE) else {}
    out = {t: cache[t] for t in titles if cache.get(t)}
    todo = sorted(set(titles) - set(cache))
    for i in range(0, len(todo), 50):
        chunk = todo[i:i + 50]
        q = get(chunk).get('query', {})
        back = {}
        for n in q.get('normalized', []):
            back.setdefault(n['to'], []).append(n['from'])
        for r in q.get('redirects', []):
            for f in back.get(r['from'], [r['from']]):
                back.setdefault(r['to'], []).append(f)
        for pg in q.get('pages', []):
            if pg.get('missing') or 'revisions' not in pg:
                continue
            rev = pg['revisions'][0]
            rec = {'title': pg['title'], 'revid': rev['revid'], 'text': rev['slots']['main']['content']}
            for asked in set(back.get(pg['title'], []) + [pg['title']]):
                if asked in chunk:
                    out[asked] = rec
        for t in chunk:
            cache[t] = out.get(t)
        time.sleep(1)
    if CACHE:
        json.dump(cache, open(CACHE, 'w', encoding='utf8'), ensure_ascii=False)
    return out


def language_body(text, heading):
    parts = re.split(r'^==([^=].*?)==\s*$', text, flags=re.M)
    for i in range(1, len(parts), 2):
        if parts[i].strip() == heading:
            return parts[i + 1]
    return None


def headings(body):
    return [h.strip() for h in re.findall(r'^={3,4}\s*([^=]+?)\s*={3,4}\s*$', body, flags=re.M)]


def senses(body):
    """(part of speech, definition line) for each definition of a language's section."""
    out, pos = [], None
    for line in body.split('\n'):
        m = re.match(r'^={3,4}\s*([^=]+?)\s*={3,4}\s*$', line)
        if m:
            pos = m.group(1).strip()
        elif re.match(r'^#(?![:*#])', line) and pos:
            out.append((pos, line[1:].strip()))
        elif pos and FORM_LINE.match(line):
            # A form template that writes its own definitions (Arabic {{ar-verb form|...}}).
            out.append((pos, line.strip()))
    return out


FORM_LINE = re.compile(r'^\{\{\s*[\w-]*(?:verb|noun|adj) form\s*\|')


# A definition that is a form of another word (an inflection, a verb form) is a word of the language; one that only
# gives another spelling of something (alt form) says nothing of its own.
FORM_OF = re.compile(r'\{\{\s*(?:inflection of|infl of|[\w-]*verb form(?: of)?|[\w-]*noun form(?: of)?|[\w-]*adj form(?: of)?|'
                     r'plural of|feminine (?:singular |plural )?of|masculine plural of|form of|participle of|past participle of|'
                     r'present participle of|gerund of|comparative of|superlative of|diminutive of|augmentative of)\s*\|', re.I)
ALT_OF = re.compile(r'\{\{\s*(?:alt form|alt sp|alt-form|altform|alternative form of|alternative spelling of|alt|obsolete spelling of|'
                    r'archaic spelling of|misspelling of|abbreviation of|abbr of|romanization of|short for|clipping of)\s*\|', re.I)
DROP = re.compile(r'\{\{\s*(?:lb|lbl|tlb|label|q|qual|qualifier|i|gl|gloss|sense|s|C|cln|topics|top|tcx|defdate|ux|uxi|syn|ant|cog|'
                  r'rfdef|rfclarify)\|[^{}]*\}\}', re.I)
LINK_T = re.compile(r'\{\{\s*(?:l|m|w|ll|taxfmt|taxlink|vern)\|(?:[a-z-]+\|)?([^|{}]+)(?:\|[^{}]*)?\}\}')


def gloss(defn):
    """A definition reduced to its words: labels and qualifiers dropped, links and {{l}} to their text."""
    t = DROP.sub('', defn)
    t = LINK_T.sub(r'\1', t)
    t = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', t)
    t = re.sub(r'\{\{[^{}]*\}\}', '', t)
    t = re.sub(r"'{2,}|<[^>]+>", '', t)
    return re.sub(r'\s+', ' ', t).strip(' .;:,()')


def sense_verdict(defn, english):
    """'form' (a form of another word), 'alt' (only another spelling), 'name' (its only gloss is the character's English
    name, capitalised as English writes it), 'word' (a sense of its own), or None (nothing to read)."""
    if FORM_OF.search(defn):
        return 'form'
    if ALT_OF.search(defn):
        return 'alt'
    g = gloss(defn)
    if not g:
        return None
    # The name as English writes it, with its capital: "Brutus" is the name, "puck" (ice hockey) a word.
    words = {w for n in english for w in re.findall(r"[\w']+", n)} | set(english)
    pieces = [x.strip() for x in re.split(r'[,;/]| or ', g) if x.strip()]
    return 'name' if pieces and all(x in words for x in pieces) else 'word'


def asked_titles(lang, w):
    """The pages read for a word (see the header)."""
    w = unicodedata.normalize('NFC', w)
    if lang == 'de':
        return [w] + ([w.lower()] if w.lower() != w else [])
    if lang in CASED:
        return [w.lower()]
    return [w]


def verdict(lang, w, read):
    """The word as the language writes it as an ordinary word, or None (see the header)."""
    for r in read:
        ok = [v for pos, v in r.get('senses') or [] if pos in ORDINARY_POS and v in ('word', 'form')
              and not (lang == 'de' and r['asked'] == w and pos != 'Noun')]
        if ok:
            return r['asked']
    return None


def main():
    en = english_names()
    want = {lang: units(pack(lang), en) for lang in LANGS}
    asked = {lang: {w: asked_titles(lang, w) for w in sorted(ws)} for lang, ws in want.items()}
    pages = fetch_pages([t for lang in LANGS for ts in asked[lang].values() for t in ts])
    # Simplified Chinese pages that only point to the traditional spelling.
    see = {}
    for t, rec in pages.items():
        body = language_body(rec['text'], 'Chinese')
        m = re.search(r'\{\{zh-see\|([^|}]+)', body or '')
        if m and not [h for h in headings(body) if h in ORDINARY_POS or h == 'Proper noun']:
            see[t] = m.group(1).strip()
    pages.update(fetch_pages(list(set(see.values()) - set(pages))))
    result = {'source': 'English Wiktionary (en.wiktionary.org), MediaWiki API, the current revision of each page',
              'fetched': datetime.date.today().isoformat(),
              'licence': 'CC BY-SA 4.0 (and GFDL); only titles, revision ids, headings and verdicts are kept',
              'ordinaryPartsOfSpeech': sorted(ORDINARY_POS),
              'read': 'es fr it pt pl ru vi id: the page of the word written small; de: as written (for a Noun) and written small '
                      '(any part of speech); ar hi zh ja ko th: as written; a simplified Chinese page that only points to the '
                      'traditional one, through it',
              'senses': 'each definition under the language: form (a form of another word), alt (only another spelling), name (its '
                        'only gloss is the English name of the character), word (a sense of its own); a word is ordinary by a form or '
                        'a word under an ordinary part of speech',
              'languages': {}}
    for lang in LANGS:
        rows = {}
        for w, ts in asked[lang].items():
            read = []
            for t in ts:
                rec = pages.get(t)
                if not rec:
                    read.append({'asked': t, 'page': None})
                    continue
                r = {'asked': t, 'title': rec['title'], 'revid': rec['revid']}
                src = rec
                if lang == 'zh' and t in see and see[t] in pages:
                    src = pages[see[t]]
                    r.update({'via': see[t], 'viaRevid': src['revid']})
                body = language_body(src['text'], HEADING[lang])
                r['pos'] = sorted(set(headings(body))) if body is not None else None
                r['senses'] = [[p, sense_verdict(d, want[lang][w])] for p, d in senses(body)] if body is not None else []
                read.append(r)
            rows[w] = {'pages': read, 'ordinary': verdict(lang, w, read)}
        result['languages'][lang] = rows
        hits = [f"{w}={r['ordinary']}" if r['ordinary'] != w else w for w, r in rows.items() if r['ordinary']]
        print(lang, len(rows), 'words,', len(hits), 'ordinary:', ' '.join(hits), file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/wiktionary-name-pos.json'), 'w', encoding='utf8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
