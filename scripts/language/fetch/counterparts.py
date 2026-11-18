"""The Roman gods Wikidata says are the same as the game's Greek ones, with their names in each language.

    python3 -I scripts/language/fetch/counterparts.py      (from the repository root; no packages needed)

A Wikidata item's aliases sometimes hold the name of another god that Rome identified with this one: Vietnamese
«Jupiter» for Zeus, «Venus» for Aphrodite, Russian «Меркурий» for Hermes and «Плутон» for Hades. English counts Zeus by
"Zeus" and never by "Jupiter" (devices.ts), and «Jupiter là hành tinh lớn nhất» ("Jupiter is the largest planet") named
Zeus in a Vietnamese duel (the third check of round 3, 2026-11-18). For each item of docs/language/sources/
wikidata-card-names.json, this reads its "said to be the same as" statements (P460), keeps the targets that are a Roman
deity (P31 Q11688446), and records their labels in the game's languages; build_card_text.py (alias_rejected) takes no
alias that is such a god's label in that language, unless English names the god as it names the character (Apollo).

Writes docs/language/sources/wikidata-roman-counterparts.json. Wikidata is CC0.
"""
import datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
API = 'https://www.wikidata.org/w/api.php'
UA = {'User-Agent': 'LangDataFetch/1.0 (generic research client)'}
LANGS = 'en es fr de it pt pt-br pl ru ar hi zh zh-hans ja ko vi th id'.split()
ROMAN_DEITY = 'Q11688446'


def get(params):
    params = {**params, 'format': 'json'}
    for attempt in range(10):
        try:
            req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as ex:
            print('retry', attempt, ex, file=sys.stderr)
            time.sleep(max(int(ex.headers.get('Retry-After') or 0), 30 * (attempt + 1)))
    raise SystemExit('Wikidata did not answer')


def entities(ids, props):
    out = {}
    for i in range(0, len(ids), 50):
        out.update(get({'action': 'wbgetentities', 'ids': '|'.join(ids[i:i + 50]), 'props': props, 'languages': '|'.join(LANGS)})['entities'])
        time.sleep(1)
    return out


def targets(e, prop):
    return [c['mainsnak'].get('datavalue', {}).get('value', {}).get('id') for c in e.get('claims', {}).get(prop, [])]


def main():
    rec = json.load(open(os.path.join(ROOT, 'docs/language/sources/wikidata-card-names.json'), encoding='utf8'))['entities']
    keys = {k: v['id'] for k, v in rec.items() if v.get('id')}
    items = entities(sorted(set(keys.values())), 'claims')
    same = {q: [t for t in targets(e, 'P460') if t] for q, e in items.items()}
    cands = entities(sorted({t for ts in same.values() for t in ts}), 'claims|labels')
    out = {'source': 'Wikidata (wbgetentities): P460 "said to be the same as", P31 "instance of" Q11688446 "Roman deity"',
           'fetched': datetime.date.today().isoformat(), 'licence': 'CC0 1.0', 'characters': {}}
    for key, q in sorted(keys.items()):
        roman = []
        for t in same.get(q, []):
            e = cands.get(t, {})
            if ROMAN_DEITY not in targets(e, 'P31'):
                continue
            roman.append({'id': t, 'lastrevid': e.get('lastrevid'), 'labels': {l: v['value'] for l, v in sorted(e.get('labels', {}).items())}})
        if roman:
            out['characters'][key] = {'id': q, 'lastrevid': items[q].get('lastrevid'), 'roman': roman}
            print(key, [r['labels'].get('en') for r in roman], file=sys.stderr)
    with open(os.path.join(ROOT, 'docs/language/sources/wikidata-roman-counterparts.json'), 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
