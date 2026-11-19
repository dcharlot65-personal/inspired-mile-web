"""German's definite articles, by English Wiktionary.

    python3 -I scripts/language/fetch/definite_articles.py      (from the repository root; no packages needed)

English counts the Nurse as "the nurse", with its article, and never "nurse" or "a nurse" (src/lib/verse/devices.ts). A
character whose English name is a role with its article counts the same way in a language with a definite article where
its local name is an ordinary noun that the language writes with a capital anyway (German «Wärterin»): only after "the"
(echo.ts localNames). Only German needs it (see HEADING). The third check of round 3 (2026-11-18) found «Eine Wärterin schloss die Tür» invoking the Nurse.

For each article Wiktionary lists for the language (docs/language/sources/wiktionary-closed-class.json, its 'standard'
headwords), this reads the word's page under the language's heading: an Article whose definition is "the", or an
inflection of such an article (German «die» of «der»), is definite; "a, an" and its inflections are not. Every page read
is pinned by its revision id.

Writes docs/language/sources/wiktionary-definite-articles.json; build_card_text.py puts the definite articles in the pack
(pack.definite). Licence: Wiktionary text is CC BY-SA 4.0 (and GFDL); only titles, revision ids and verdicts are kept.
"""
import datetime, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
API = 'https://en.wiktionary.org/w/api.php'
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
# German only: the one language whose role name is a bare noun written with a capital anyway. Spanish names the Nurse
# «Nodriza de Julieta», French «La Nourrice» (with its article), and Italian and Portuguese have no name for her. Read for
# Spanish, French and Portuguese, this rule also took «de», «une», «les» or «el», whose pages carry other senses.
HEADING = {'de': 'German'}


def get(titles):
    q = {'action': 'query', 'prop': 'revisions', 'rvprop': 'content|ids', 'rvslots': 'main', 'titles': '|'.join(titles),
         'format': 'json', 'formatversion': '2'}
    for attempt in range(10):
        try:
            req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as ex:
            print('retry', attempt, ex, file=sys.stderr)
            time.sleep(max(int(ex.headers.get('Retry-After') or 0), 30 * (attempt + 1)))
    raise SystemExit('Wiktionary did not answer')


def article_defs(text, heading):
    parts = re.split(r'^==([^=].*?)==\s*$', text, flags=re.M)
    body = next((parts[i + 1] for i in range(1, len(parts), 2) if parts[i].strip() == heading), '')
    out, pos = [], None
    for line in body.split('\n'):
        m = re.match(r'^={3,5}\s*([^=]+?)\s*={3,5}\s*$', line)
        if m:
            pos = m.group(1).strip()
        elif pos == 'Article' and re.match(r'^#(?![:*#])', line):
            out.append(line[1:].strip())
    return out


def main():
    closed = json.load(open(os.path.join(ROOT, 'docs/language/sources/wiktionary-closed-class.json'), encoding='utf8'))['languages']
    result = {'source': 'English Wiktionary (en.wiktionary.org), MediaWiki API, the current revision of each page',
              'fetched': datetime.date.today().isoformat(),
              'licence': 'CC BY-SA 4.0 (and GFDL); only titles, revision ids and verdicts are kept',
              'rule': 'an Article defined as "the", or an inflection of one; not "a, an" or its inflections',
              'languages': {}}
    for lang, heading in HEADING.items():
        words = [w for w in closed[lang]['article']['standard'] if re.fullmatch(r"[^\W\d_]+", w)]
        rows = {}
        for i in range(0, len(words), 40):
            r = get(words[i:i + 40])
            for p in r.get('query', {}).get('pages', []):
                if p.get('missing'):
                    continue
                rv = p['revisions'][0]
                rows[p['title']] = {'revid': rv['revid'], 'defs': article_defs(rv['slots']['main']['content'], heading)}
            time.sleep(2)
        the = {w for w, r in rows.items() if any(re.search(r'\[\[the\]\]|\bthe\b', d) and not re.search(r'\[\[an?\]\]', d) for d in r['defs'])}
        for w, r in rows.items():
            for d in r['defs']:
                m = re.search(r'\{\{\s*inflection of\|' + lang + r'\|([^|}]+)', d)
                if m and m.group(1) in the and not re.search(r'\[\[an?\]\]', d):
                    the.add(w)
        result['languages'][lang] = {'read': {w: {'revid': r['revid'], 'definite': w in the} for w, r in sorted(rows.items())},
                                     'definite': sorted(the)}
        print(lang, sorted(the), file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/wiktionary-definite-articles.json'), 'w', encoding='utf8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
