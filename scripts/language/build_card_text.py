#!/usr/bin/env python3
"""Build the per-language card text (src/lib/cards-i18n/<lang>.ts) and its record
(docs/language/NAMES-AND-QUOTATIONS.md, docs/language/card-text.provenance.json).

Inputs, all in the repository:
  src/lib/cards.ts                             the English cards (ids, names, quotations)
  docs/language/sources/wikidata-names.json    labels fetched from Wikidata (fetch_names.py)
  docs/language/sources/quotes-<lang>.json     lines copied from published translations (extract.py)
  docs/language/sources/stopwords-iso.json     stop words (stopwords-iso, MIT)
  scripts/language/published.json              who translated each published text, and its copyright status
  scripts/language/translated/<lang>.txt       what was translated for the game (no published source)
  src/i18n/locales/<lang>.ts                   rarity names, so a rarity is called one thing everywhere

Nothing here writes a translation: it only assembles, and labels each entry with where it came from.
Needs two Python packages: regex and opencc-python-reimplemented (Apache-2.0; OpenCC conversion tables).
Run from the repository root:  python3 scripts/language/build_card_text.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LANGS = 'es fr de it pt pl ru ar hi zh ja ko vi th id'.split()
LATIN = set('es fr de it pt pl vi id'.split())
SRC = os.path.join(ROOT, 'docs/language/sources')

# Card -> Wikidata entity key (see fetch_names.py). Cards not listed are the game's own inventions.
ENTITY = {
    'MO-001': 'romeo', 'CA-001': 'juliet', 'DC-001': 'hamlet', 'DC-002': 'ophelia', 'MO-002': 'mercutio', 'FA-001': 'puck',
    'FA-002': 'titania', 'VC-001': 'escalus', 'VC-002': 'friar', 'VC-003': 'nurse', 'TP-001': 'prospero', 'TP-002': 'ariel',
    'TP-003': 'caliban', 'MO-003': 'benvolio', 'CA-002': 'tybalt', 'DC-003': 'claudius', 'FA-003': 'oberon', 'SC-001': 'macbeth',
    'SC-002': 'ladymacbeth', 'SC-003': 'banquo', 'IL-001': 'viola', 'IL-002': 'malvolio', 'IL-003': 'olivia', 'RM-001': 'brutus',
    'RM-002': 'cassius', 'RM-003': 'antony', 'DC-004': 'horatio', 'FA-004': 'bottom', 'VC-004': 'paris', 'TP-004': 'miranda',
    'LD-001': 'wordsworth', 'LD-002': 'coleridge', 'LD-003': 'keats', 'GC-001': 'byron', 'GC-002': 'maryshelley', 'GC-003': 'poe',
    'GC-004': 'blake', 'GC-005': 'shelley', 'LD-004': 'browning', 'LD-005': 'rossetti', 'OL-001': 'zeus', 'OL-002': 'athena',
    'OL-003': 'apollo', 'OL-004': 'aphrodite', 'OL-005': 'hermes', 'UW-001': 'hades', 'UW-002': 'persephone', 'OL-006': 'odysseus',
    'UW-003': 'medusa', 'OL-007': 'achilles',
}
# The card shows one word of a longer sourced name: (index of the word, words in the English label).
TOKEN = {'brutus': (2, 3), 'cassius': (1, 3), 'bottom': (1, 2)}
# A character whose own item has no label in a language takes it from the title of the play: (work key, part).
FROM_WORK = {'romeo': ('w_rj', 0), 'juliet': ('w_rj', 1), 'hamlet': ('w_hamlet', None), 'macbeth': ('w_macbeth', None)}
AND = {'th': 'และ', 'vi': ' và ', 'id': ' dan ', 'hi': ' और ', 'ko': '와 ', 'ja': 'と', 'zh': '与', 'ar': ' و'}
# Houses that are a real place or work: the label comes from Wikidata.
HOUSE_ENTITY = {'The Tempest': 'w_tempest', 'Illyria': 'illyria', 'Rome': 'rome', 'Lake District': 'lakedistrict'}
OWN_NAMES = ['SM-001', 'MO-004', 'CA-003'] + [f'RL-00{i}' for i in range(1, 10)] + [f'PT-00{i}' for i in range(1, 10)]
HOUSES_T = ['Montague', 'Capulet', 'Danish Court', 'Forest of Arden', 'Verona Court', 'Scottish Court', 'Legendary', 'Relic', 'Potion',
            'Gothic Circle', 'Olympus', 'Underworld']
ELEMENTS = ('Fire|Passion|Grace|Shadow|Water|Wind|Trickster|Nature|Death|Arcane|Enchantment|Dark|Justice|Earth|Loyalty|Storm|Air|Beast|'
            'Peace|Poison|Moonlight|Illusion|Mischief|Ambition|Darkness|Prophecy|Disguise|Vanity|Honor|Envy|Rhetoric|Authority|Comedy|Duty|'
            'Innocence|Devotion|Wisdom|Power|Knowledge|Compassion|Transformation|Alchemy|Ocean|Vision|Beauty|Rebellion|Creation|Revolution|'
            'Sorrow|Thunder|Light|Love|Speed|Rebirth|Cunning|Petrification|Glory').split('|')
# Words that stopwords-iso lists but that carry a card's line: without them "To be, or not to be" has no telling word.
# They are taken off the stop list for that language; the list is otherwise used as published.
NOT_STOP = {'pt': ['questão'], 'ru': ['вопрос']}
TYPES = ['Character', 'Relic', 'Potion']
RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
# Where each English line comes from.
CITE = {
    'SM-001': ('sonnet18', 'Shakespeare, Sonnet 18, line 1'), 'MO-001': ('rj', 'Romeo and Juliet 2.2'), 'CA-001': ('rj', 'Romeo and Juliet 2.2'),
    'DC-001': ('hamlet', 'Hamlet 3.1'), 'DC-002': ('hamlet', 'Hamlet 4.5'), 'MO-002': ('rj', 'Romeo and Juliet 3.1'),
    'FA-001': ('mnd', "A Midsummer Night's Dream 3.2"), 'FA-002': ('mnd', "A Midsummer Night's Dream 4.1"), 'RL-001': ('hamlet', 'Hamlet 5.1'),
    'RL-002': ('tempest', 'The Tempest, Epilogue'), 'PT-001': ('mnd', "A Midsummer Night's Dream 1.1"), 'PT-002': ('macbeth', 'Macbeth 4.1'),
    'VC-001': ('rj', 'Romeo and Juliet 1.1'), 'VC-002': ('rj', 'Romeo and Juliet 2.6'), 'VC-003': ('rj', 'Romeo and Juliet 2.5'),
    'TP-001': ('tempest', 'The Tempest 4.1'), 'TP-002': ('tempest', 'The Tempest 1.2'), 'TP-003': ('tempest', 'The Tempest 1.2'),
    'MO-003': ('rj', 'Romeo and Juliet 1.1'), 'CA-002': ('rj', 'Romeo and Juliet 1.1'), 'DC-003': ('hamlet', 'Hamlet 3.3'),
    'FA-003': ('mnd', "A Midsummer Night's Dream 2.1"), 'RL-003': ('macbeth', 'Macbeth 2.1'), 'PT-003': ('mnd', "A Midsummer Night's Dream 2.1"),
    'SC-001': ('macbeth', 'Macbeth 1.7'), 'SC-002': ('macbeth', 'Macbeth 1.5'), 'SC-003': ('macbeth', 'Macbeth 1.3'),
    'IL-001': ('tn', 'Twelfth Night 3.1'), 'IL-002': ('tn', 'Twelfth Night 2.5'), 'IL-003': ('tn', 'Twelfth Night 3.1'),
    'RM-001': ('jc', 'Julius Caesar 3.2'), 'RM-002': ('jc', 'Julius Caesar 1.2'), 'RM-003': ('jc', 'Julius Caesar 3.2'),
    'MO-004': ('rj', 'Romeo and Juliet 1.1'), 'CA-003': ('rj', 'Romeo and Juliet 1.3'), 'DC-004': ('hamlet', 'Hamlet 5.2'),
    'FA-004': ('mnd', "A Midsummer Night's Dream 4.1"), 'VC-004': ('rj', 'Romeo and Juliet 3.4'), 'TP-004': ('tempest', 'The Tempest 5.1'),
    'RL-004': ('rj', 'Romeo and Juliet 2.2'), 'RL-005': ('mov', 'The Merchant of Venice 2.7'), 'RL-006': ('h4p2', 'Henry IV, Part 2 3.1'),
    'RL-007': ('tempest', 'The Tempest 5.1'), 'RL-008': ('lear', 'King Lear 4.4'), 'RL-009': ('mnd', "A Midsummer Night's Dream 3.1"),
    'PT-004': ('othello', 'Othello 3.3'), 'PT-005': ('mnd', "A Midsummer Night's Dream 2.1"), 'PT-006': ('hamlet', 'Hamlet 1.5'),
    'PT-007': ('macbeth', 'Macbeth 4.1'), 'PT-008': ('tempest', 'The Tempest 1.2'), 'PT-009': ('rj', 'Romeo and Juliet 5.1'),
    'LD-001': (None, 'Wordsworth, "I Wandered Lonely as a Cloud", lines 1-2'), 'LD-002': (None, 'Coleridge, The Rime of the Ancient Mariner, Part II'),
    'LD-003': (None, 'Keats, Endymion, Book I, lines 1-2'), 'GC-001': (None, 'Byron, "She Walks in Beauty", lines 1-2'),
    'GC-002': (None, 'Mary Shelley, Frankenstein, chapter 20'), 'GC-003': (None, 'Poe, "The Raven", line 1'),
    'GC-004': (None, 'Blake, "Auguries of Innocence", lines 1-2'), 'GC-005': (None, 'P. B. Shelley, "Ode to the West Wind", last line'),
    'LD-004': (None, 'E. B. Browning, Sonnets from the Portuguese 43, line 1'), 'LD-005': (None, 'C. Rossetti, "Remember", lines 1-2'),
    'OL-001': (None, "the game's own line (Zeus's Homeric epithet, cloud-gatherer)"), 'OL-002': (None, "the game's own line (after Hegel's owl of Minerva)"),
    'OL-003': (None, "the game's own line"), 'OL-004': (None, "the game's own line"), 'OL-005': (None, "the game's own line"),
    'UW-001': (None, "the game's own line"), 'UW-002': (None, "the game's own line"), 'OL-006': (None, "the game's own paraphrase of Odyssey 1.1"),
    'UW-003': (None, "the game's own line"), 'OL-007': (None, "the game's own paraphrase of Iliad 9.410-416"),
}


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf8') as f:
        return f.read()


def cards():
    s = read('src/lib/cards.ts')
    rx = re.compile(r"id: '([A-Z]+-\d+)', name: (\"[^\"]*\"|'(?:[^'\\]|\\.)*'), house: '([^']*)', type: '(\w+)',.*?quote: (\"[^\"]*\"|'(?:[^'\\]|\\.)*'),", re.S)
    out = []
    for m in rx.finditer(s):
        un = lambda q: q[1:-1].replace("\\'", "'")
        out.append({'id': m.group(1), 'name': un(m.group(2)), 'house': m.group(3), 'type': m.group(4), 'quote': un(m.group(5))})
    return out


def translated(lang):
    sec, out = None, {'names': [], 'houses': [], 'elements': [], 'types': [], 'quotes': {}, 'scenes': {}}
    for line in read(f'scripts/language/translated/{lang}.txt').split('\n'):
        if not line.strip():
            continue
        m = re.fullmatch(r'\[(\w+)\]', line.strip())
        if m:
            sec = m.group(1)
        elif sec == 'names':
            out['names'].append(line.strip())
        elif sec in ('houses', 'elements', 'types'):
            out[sec] += [x.strip() for x in line.split('|')]
        elif sec in ('quotes', 'scenes'):
            cid, text = line.split('\t', 1)
            out[sec][cid.strip()] = text.strip()
    assert len(out['names']) == len(OWN_NAMES), (lang, 'names', len(out['names']))
    assert len(out['houses']) == len(HOUSES_T), (lang, 'houses', len(out['houses']))
    assert len(out['elements']) == len(ELEMENTS), (lang, 'elements', len(out['elements']))
    assert len(out['types']) == 3, (lang, 'types')
    return out


def strip_paren(s):
    return re.sub(r'\s*[（(][^）)]*[）)]\s*$', '', s).strip()


SCRIPT = {'zh': r'\p{Han}', 'ja': r'[\p{Han}\p{Hiragana}\p{Katakana}]', 'ko': r'\p{Hangul}', 'ru': r'\p{Cyrillic}', 'ar': r'\p{Arabic}',
          'hi': r'\p{Devanagari}', 'th': r'\p{Thai}'}
_t2s = None


def in_script(text, lang):
    """A label must be written in the language's own script: Wikidata holds a few that are not."""
    import regex
    return lang not in SCRIPT or bool(regex.search(SCRIPT[lang], text))


def simplified(text):
    """Chinese labels are often Traditional; the game's Chinese is Simplified. OpenCC t2s converts by table."""
    global _t2s
    if _t2s is None:
        from opencc import OpenCC
        _t2s = OpenCC('t2s')
    return _t2s.convert(text)


_jp = None


def shinjitai(text):
    """Japanese old character forms (kyujitai) to the forms players type (shinjitai), by OpenCC's JPVariants table
    (docs/language/sources/opencc-JPVariants.txt, the table OpenCC's t2jp conversion uses). Character for character;
    kana spelling is left as printed."""
    global _jp
    if _jp is None:
        _jp = {}
        for line in read('docs/language/sources/opencc-JPVariants.txt').split('\n'):
            if '\t' in line:
                a, b = line.split('\t', 1)
                _jp[a] = b.split(' ')[0]
    return ''.join(_jp.get(ch, ch) for ch in text)


def label(ent, lang):
    text, src, detail = _label(ent, lang)
    if text and lang == 'zh':
        conv = simplified(text)
        if conv != text:
            return conv, src, detail + f'; "{text}" converted to Simplified with OpenCC t2s'
    return text, src, detail


def _label(ent, lang):
    """(text, source, detail) for an entity in a language, or (None, 'missing', why)."""
    if not ent or ent.get('missing'):
        return None, 'missing', 'no Wikidata item'
    labs, q = ent['labels'], ent['id']
    order = ['zh-hans', 'zh-cn', 'zh'] if lang == 'zh' else [lang]
    for code in order:
        if code in labs and in_script(labs[code], lang):
            return strip_paren(labs[code]), 'wikidata', f'{q} label ({code})'
    if lang in LATIN and 'mul' in labs:
        return strip_paren(labs['mul']), 'wikidata', f'{q} label (mul, the default for every language)'
    if lang in ent.get('sitelinks', {}) and in_script(ent['sitelinks'][lang], lang):
        return strip_paren(ent['sitelinks'][lang]), 'wikipedia', f'{lang}.wikipedia.org article title ({q})'
    return None, 'missing', f'{q} has no label in {lang} and no {lang}.wikipedia.org article'


SPLIT = re.compile(r'[\s・·‧]+')


def name_for(key, lang, ents):
    text, src, detail = label(ents.get(key), lang)
    if text and key in TOKEN:
        idx, n = TOKEN[key]
        parts = [p for p in SPLIT.split(text) if p]
        if len(parts) == n:
            return parts[idx], 'derived', f'word {idx + 1} of {n} of "{text}" ({detail})'
    if not text and key in FROM_WORK:
        wkey, part = FROM_WORK[key]
        wtext, wsrc, wdetail = label(ents.get(wkey), lang)
        if wtext:
            if part is None:
                return wtext, 'derived', f'the title of the play ({wdetail})'
            conj = AND.get(lang)
            if conj and wtext.count(conj) == 1:
                return wtext.split(conj)[part].strip(), 'derived', f'part {part + 1} of the title "{wtext}" ({wdetail})'
    return text, src, detail


def aliases(key, lang, ents, name):
    ent = ents.get(key) or {}
    out = []
    for a in ent.get('aliases', {}).get(lang, []):
        a = strip_paren(a)
        if a and a != name and not SPLIT.search(a) and a not in out:
            out.append(a)
    return out[:4]


def clean_quote(t):
    t = re.sub(r'^[—–\-\s]+', '', t)
    t = re.sub(r'[\s—–]+$', '', t)
    return t


def rarity_names(lang):
    s = read(f'src/i18n/locales/{lang}.ts')
    out = {}
    for r in RARITIES:
        m = re.search(r"'rarity\.%s':\s*(\"[^\"]*\"|'(?:[^'\\]|\\.)*')" % r.lower(), s)
        if m:
            out[r] = m.group(1)[1:-1].replace("\\'", "'")
    return out


def main():
    ents = json.loads(read('docs/language/sources/wikidata-names.json'))['entities']
    stop = json.loads(read('docs/language/sources/stopwords-iso.json'))['words']
    published = json.loads(read('scripts/language/published.json'))
    CARDS = cards()
    assert len(CARDS) == 71, len(CARDS)
    prov = {'langs': {}}
    for lang in LANGS:
        tr = translated(lang)
        qpath = os.path.join(SRC, f'quotes-{lang}.json')
        pub = json.load(open(qpath, encoding='utf8')) if os.path.exists(qpath) else {}
        pack = {'lang': lang, 'cards': {}, 'houses': {}, 'elements': dict(zip(ELEMENTS, tr['elements'])), 'rarities': rarity_names(lang),
                'types': dict(zip(TYPES, tr['types'])), 'stop': sorted(set(w for w in stop.get(lang, []) if re.search(r'[^\W\d_]', w) and w not in NOT_STOP.get(lang, [])))}
        p = prov['langs'][lang] = {'cards': {}, 'houses': {}}
        for h, t in zip(HOUSES_T, tr['houses']):
            pack['houses'][h] = t
            p['houses'][h] = {'text': t, 'source': 'translated'}
        for h, key in HOUSE_ENTITY.items():
            text, src, detail = label(ents.get(key), lang)
            if text:
                pack['houses'][h] = text
            p['houses'][h] = {'text': text, 'source': src, 'detail': detail}
        own = dict(zip(OWN_NAMES, tr['names']))
        for c in CARDS:
            cid = c['id']
            entry, rec = {}, {}
            if cid in own:
                entry['name'], entry['nameSource'] = own[cid], 'translated'
                rec['name'] = {'text': own[cid], 'source': 'translated',
                               'detail': 'the product name, kept as it is' if cid == 'SM-001' else "the game's own name, translated for the game"}
            else:
                key = ENTITY[cid]
                text, src, detail = name_for(key, lang, ents)
                entry['nameSource'] = src
                if text:
                    entry['name'] = text
                    al = aliases(key, lang, ents, text)
                    if al and c['type'] == 'Character':
                        entry['aliases'] = al
                rec['name'] = {'text': text, 'source': src, 'detail': detail}
            work, cite = CITE[cid]
            if cid in pub:
                q = pub[cid]
                meta = published[lang][q['work']]
                entry['quote'], entry['quoteSource'] = clean_quote(q['text']), 'published'
                rec['quote'] = {'text': entry['quote'], 'source': 'published', 'cite': cite, 'translator': meta['translator'], 'edition': meta['edition'],
                                'status': meta['status'], 'url': q['url'], 'page': q['page'], 'revid': q['revid']}
                if q.get('file'):
                    rec['quote']['file'] = q['file']  # the mirror file read, pinned by its sha256 (revid)
                if lang == 'ja':
                    # The published line keeps its old character forms on the card; the signature also reads it in the forms players type.
                    modern = shinjitai(entry['quote'])
                    if modern != entry['quote']:
                        entry['echo'] = rec['quote']['echo'] = modern
            elif cid in tr['quotes']:
                entry['quote'], entry['quoteSource'] = tr['quotes'][cid], 'new'
                rec['quote'] = {'text': entry['quote'], 'source': 'new', 'cite': cite}
            else:
                entry['quoteSource'] = 'missing'
                rec['quote'] = {'text': None, 'source': 'missing', 'cite': cite}
            if cid in tr['scenes']:
                entry['scene'] = tr['scenes'][cid]
            rec['scene'] = 'translated' if cid in tr['scenes'] else 'missing'
            pack['cards'][cid] = entry
            p['cards'][cid] = rec
        body = json.dumps(pack, ensure_ascii=False, indent=1)
        ts = ("// GENERATED by scripts/language/build_card_text.py. Do not edit: change the sources and run it again.\n"
              "// Where every name and line comes from: docs/language/NAMES-AND-QUOTATIONS.md\n"
              "import type { CardTextPack } from './index';\n\nconst pack: CardTextPack = " + body + ";\n\nexport default pack;\n")
        with open(os.path.join(ROOT, f'src/lib/cards-i18n/{lang}.ts'), 'w', encoding='utf8') as f:
            f.write(ts)
    with open(os.path.join(ROOT, 'docs/language/card-text.provenance.json'), 'w', encoding='utf8') as f:
        json.dump(prov, f, ensure_ascii=False, indent=1)
    write_doc(CARDS, ents, prov, published)
    for lang in LANGS:
        cs = prov['langs'][lang]['cards'].values()
        n = lambda k, v: sum(1 for c in cs if c[k]['source'] == v)
        print(lang, 'names: wikidata', n('name', 'wikidata'), 'wikipedia', n('name', 'wikipedia'), 'derived', n('name', 'derived'), 'translated',
              n('name', 'translated'), 'missing', n('name', 'missing'), '| quotes: published', n('quote', 'published'), 'new', n('quote', 'new'),
              'missing', n('quote', 'missing'), '| scenes', sum(1 for c in cs if c['scene'] == 'translated'))


BT_FLAG = 0.5  # back-translations scoring below this cosine against their English source are listed for review


def write_checks(L):
    """The findings of scripts/language/check (docs/language/checks/*.json), if they have been run."""
    d = os.path.join(ROOT, 'docs/language/checks')
    load = lambda f: json.load(open(os.path.join(d, f), encoding='utf8')) if os.path.exists(os.path.join(d, f)) else None
    sp, gr, bt = load('spelling.json'), load('grammar.json'), load('backtranslation.json')
    L.append('## Checks by tools that did not write the text\n')
    if not (sp or gr or bt):
        L.append('Not run. See "What was not done".\n')
        return
    L.append('Run by `scripts/language/check/run.sh` on the build host; the raw findings are in `docs/language/checks/`. '
             'A finding is a question for a reviewer, not a verdict, and an item with no finding has not thereby been shown to be right: '
             'a spelling dictionary does not know names, LanguageTool covers only some languages and some errors, and a back-translation '
             'can be faithful to a wrong text. Nothing here was reviewed by a native speaker.\n')
    L.append('| Language | Items | Hunspell: items with an unknown word | LanguageTool: items with a finding | Back-translation: median cosine (control) | below ' + str(BT_FLAG) + ' |')
    L.append('|---|---|---|---|---|---|')
    import statistics
    for lang in LANGS:
        s = (sp or {}).get('languages', {}).get(lang)
        g = (gr or {}).get('languages', {}).get(lang)
        b = (bt or {}).get('languages', {}).get(lang)
        n = (s or g or {}).get('items', len(b) if b else 0)
        scell = f"{len(s['flagged'])}" if s else 'no dictionary'
        gcell = f"{len(g['flagged'])}" if g else 'not supported'
        if b:
            bcell = f"{statistics.median(r['cos'] for r in b):.2f} ({statistics.median(r['control'] for r in b):.2f})"
            low = sum(1 for r in b if r['cos'] < BT_FLAG)
        else:
            bcell, low = 'not run', '-'
        L.append(f'| {lang} | {n} | {scell} | {gcell} | {bcell} | {low} |')
    L.append('')
    esc = lambda s: str(s).replace('|', '\\|').replace('\n', ' ')
    if sp:
        L.append('### Words Hunspell does not know\n')
        L.append('Proper nouns of places and people in the scenes are expected here; a misspelling is not.\n')
        for lang in LANGS:
            s = sp['languages'].get(lang)
            if not s or not s['flagged']:
                continue
            words = sorted(set(w for f in s['flagged'] for w in f['unknown']))
            L.append(f"- **{lang}** ({len(words)}): " + ', '.join(words))
        L.append('')
    if gr:
        L.append('### LanguageTool findings\n')
        for lang in LANGS:
            g = gr['languages'].get(lang)
            if not g or not g['flagged']:
                continue
            L.append(f'**{lang}**\n')
            L.append('| Item | Found | Rule | Message |')
            L.append('|---|---|---|---|')
            for f in g['flagged']:
                for m in f['matches']:
                    L.append(f"| {f['id']} {f['field']} | {esc(m['found'])} | {m['rule']} | {esc(m['message'])} |")
            L.append('')
    if bt:
        L.append(f'### Back-translations below {BT_FLAG}\n')
        for lang in LANGS:
            b = bt['languages'].get(lang)
            if not b:
                continue
            low = [r for r in b if r['cos'] < BT_FLAG]
            if not low:
                continue
            L.append(f'**{lang}**\n')
            L.append('| Item | Text | Back to English | English source | cosine |')
            L.append('|---|---|---|---|---|')
            for r in sorted(low, key=lambda r: r['cos']):
                L.append(f"| {r['id']} {r['field']} | {esc(r['text'])} | {esc(r['back'])} | {esc(r['english'])} | {r['cos']:.2f} |")
            L.append('')


def write_doc(CARDS, ents, prov, published):
    L = []
    head = read('scripts/language/NAMES-AND-QUOTATIONS.head.md')
    L.append(head.rstrip() + '\n')
    L.append('## Summary by language\n')
    L.append('| Language | Names from Wikidata | from a Wikipedia title | derived by rule | translated (own inventions) | missing | Lines from a published translation | new, unsourced | Scenes translated |')
    L.append('|---|---|---|---|---|---|---|---|---|')
    for lang in LANGS:
        cs = list(prov['langs'][lang]['cards'].values())
        n = lambda k, v: sum(1 for c in cs if c[k]['source'] == v)
        L.append(f"| {lang} | {n('name','wikidata')} | {n('name','wikipedia')} | {n('name','derived')} | {n('name','translated')} | {n('name','missing')} | {n('quote','published')} | {n('quote','new')} | {sum(1 for c in cs if c['scene']=='translated')} |")
    L.append('\n## Published translations used\n')
    L.append('| Language | Work | Translator | Edition | Copyright status |')
    L.append('|---|---|---|---|---|')
    for lang in LANGS:
        for work, meta in published.get(lang, {}).items():
            used = sum(1 for c in prov['langs'][lang]['cards'].values() if c['quote']['source'] == 'published' and c['quote'].get('translator') == meta['translator'] and c['quote'].get('edition') == meta['edition'])
            if used:
                L.append(f"| {lang} | {work} | {meta['translator']} | {meta['edition']} | {meta['status']} |")
    L.append('\n## Missing names (the English name is shown and accepted)\n')
    for lang in LANGS:
        miss = [f"{c['id']} {c['name']}" for c in CARDS if prov['langs'][lang]['cards'][c['id']]['name']['source'] == 'missing']
        L.append(f"- **{lang}** ({len(miss)}): " + ('; '.join(miss) if miss else 'none'))
    L.append('\n## Lines translated for the game, not sourced\n')
    for lang in LANGS:
        new = [c['id'] for c in CARDS if prov['langs'][lang]['cards'][c['id']]['quote']['source'] == 'new']
        miss = [c['id'] for c in CARDS if prov['langs'][lang]['cards'][c['id']]['quote']['source'] == 'missing']
        L.append(f"- **{lang}** new ({len(new)}): " + (', '.join(new) if new else 'none') + (f". Not translated ({len(miss)}): {', '.join(miss)}" if miss else ''))
    L.append('\n## Names translated for the game, not sourced\n')
    L.append('In every language: ' + ', '.join(OWN_NAMES) + ' (SM-001 is the product name and is kept as it is), the house labels ' + ', '.join(HOUSES_T) +
             ', all element labels and the three card types. Rarity names are the ones already in src/i18n/locales. Scene descriptions are translated wherever present.\n')
    write_checks(L)
    L.append('## Wikidata items\n')
    L.append('| Key | Item | English label | Used for |')
    L.append('|---|---|---|---|')
    used = {v: k for k, v in ENTITY.items()}
    for key, e in ents.items():
        if e.get('missing'):
            continue
        L.append(f"| {key} | [{e['id']}](https://www.wikidata.org/wiki/{e['id']}) | {e['labels'].get('en', e['labels'].get('mul', ''))} | {used.get(key, 'house label' if key in HOUSE_ENTITY.values() else 'reference')} |")
    L.append('\n## Card by card\n')
    for c in CARDS:
        cid = c['id']
        L.append(f"### {cid} {c['name']}\n")
        L.append(f"English line: \"{c['quote']}\" ({CITE[cid][1]})\n")
        L.append('| Language | Name | Name source | Line | Line source |')
        L.append('|---|---|---|---|---|')
        for lang in LANGS:
            r = prov['langs'][lang]['cards'][cid]
            nm, q = r['name'], r['quote']
            nsrc = f"{nm['source']}: {nm['detail']}"
            if q['source'] == 'published':
                qsrc = f"published: {q['translator']}, {q['edition']}; {q['status']}; [source]({q['url']})"
            elif q['source'] == 'new':
                qsrc = 'NEW, unsourced: translated for the game, not reviewed'
            else:
                qsrc = 'missing'
            esc = lambda s: (s or '(none)').replace('|', '\\|')
            L.append(f"| {lang} | {esc(nm['text'])} | {esc(nsrc)} | {esc(q['text'])} | {esc(qsrc)} |")
        L.append('')
    with open(os.path.join(ROOT, 'docs/language/NAMES-AND-QUOTATIONS.md'), 'w', encoding='utf8') as f:
        f.write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
