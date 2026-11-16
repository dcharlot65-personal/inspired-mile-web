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
    # The game's Portuguese is Brazilian (src/i18n/locales/pt.ts): Wikidata's pt-br label first, where there is one.
    order = ['zh-hans', 'zh-cn', 'zh'] if lang == 'zh' else ['pt-br', 'pt'] if lang == 'pt' else [lang]
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
    for a in ent.get('aliases', {}).get('pt-br', []) * (lang == 'pt') + ent.get('aliases', {}).get(lang, []):
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
    # Brazilian Portuguese labels, fetched separately (scripts/language/fetch/names_ptbr.py) so no other language's labels moved.
    ptbr = json.loads(read('docs/language/sources/wikidata-pt-br.json'))['items']
    for e in ents.values():
        b = ptbr.get(e.get('id'), {})
        if b.get('pt-br'):
            e['labels']['pt-br'] = b['pt-br']
        if b.get('aliases'):
            e.setdefault('aliases', {})['pt-br'] = b['aliases']
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


# The meaning rule of the language QA pipeline (scripts/lang/meaning.mjs, branch lang/qa-pipeline): flagged when the
# back-translation's MiniLM cosine to the English is under 0.6 and LaBSE's score of the text against the English is too.
BT_T, BT_TX = 0.6, 0.6


def bt_doubt(r):
    return r['cos'] < BT_T and (r.get('xcos') is None or r['xcos'] < BT_TX)


def text_hash(text):
    import hashlib
    return hashlib.sha256(text.encode('utf8')).hexdigest()[:16]


def current_items(CARDS, prov):
    """The text written for the game, item by item, as scripts/language/check/collect.mjs gathers it for the checks."""
    out = {}
    for lang in LANGS:
        src = read(f'src/lib/cards-i18n/{lang}.ts')
        pack = json.loads(src[src.index('= {') + 2:src.rindex('};') + 1])
        items = {}
        for c in CARDS:
            e = pack['cards'][c['id']]
            if e.get('scene'):
                items[(c['id'], 'scene')] = e['scene']
            if e.get('quoteSource') == 'new':
                items[(c['id'], 'quote')] = e['quote']
            if e.get('nameSource') == 'translated' and c['id'] != 'SM-001':
                items[(c['id'], 'name')] = e['name']
        for h, t in pack['houses'].items():
            if prov['langs'][lang]['houses'].get(h, {}).get('source') == 'translated':
                items[(f'house:{h}', 'house')] = t
        for el, t in pack['elements'].items():
            items[(f'element:{el}', 'element')] = t
        for ty, t in pack['types'].items():
            items[(f'type:{ty}', 'type')] = t
        out[lang] = items
    return out


def triage(items, sp, gr, bt, acc):
    """Per language: every finding on the text as it now reads, each either accepted (with its reason) or open; and the
    items a check has not read as they now read. The same rule as src/lib/cards-i18n/cards-i18n.test.ts."""
    res = {}
    for lang in LANGS:
        cur = items[lang]
        r = res[lang] = {'items': len(cur), 'spell': None, 'grammar': None, 'meaning': None}
        s = (sp or {}).get('languages', {}).get(lang)
        if s and s.get('dictionary', True) is not None and 'flagged' in s:
            words = acc.get('spelling', {}).get(lang, {})
            seen = {}
            for f in s['flagged']:
                if cur.get((f['id'], f['field'])) != f['text']:
                    continue
                for w in f['unknown']:
                    seen.setdefault(w, []).append(f['id'] + ' ' + f['field'])
            ck = s.get('checked', {})
            r['spell'] = {'unknown': sorted(seen), 'accepted': sorted(w for w in seen if w in words), 'open': sorted(w for w in seen if w not in words),
                          'where': seen, 'stale': sorted(w for w in words if w not in seen),
                          'unchecked': sorted(f'{i} {fl}' for (i, fl), t in cur.items() if ck.get(f'{i}|{fl}') != text_hash(t)) if ck else ['(no record of what was read)']}
        g = (gr or {}).get('languages', {}).get(lang)
        if g and g.get('supported', True) and 'flagged' in g:
            al = [a for a in acc.get('grammar', []) if a['lang'] == lang]
            used, found, open_ = set(), [], []
            for f in g['flagged']:
                if cur.get((f['id'], f['field'])) != f['text']:
                    continue
                for m in f['matches']:
                    k = next((n for n, a in enumerate(al) if a['id'] == f['id'] and a['field'] == f['field'] and a['rule'] == m['rule'] and a['found'] == m['found']), None)
                    row = {'id': f['id'], 'field': f['field'], 'rule': m['rule'], 'found': m['found'], 'message': m['message'], 'text': f['text']}
                    if k is None:
                        open_.append(row)
                    else:
                        used.add(k)
                        found.append({**row, 'reason': al[k]['reason']})
            ck = g.get('checked', {})
            r['grammar'] = {'accepted': found, 'open': open_, 'stale': [a for n, a in enumerate(al) if n not in used],
                            'unchecked': sorted(f'{i} {fl}' for (i, fl), t in cur.items() if ck.get(f'{i}|{fl}') != text_hash(t)) if ck else ['(no record of what was read)']}
        b = (bt or {}).get('languages', {}).get(lang)
        if b:
            al = [a for a in acc.get('meaning', []) if a['lang'] == lang]
            used, flagged, open_ = set(), [], []
            rows = {(x['id'], x['field']): x for x in b}
            scored = [x for k, x in rows.items() if cur.get(k) == x['text']]
            for x in scored:
                if not bt_doubt(x):
                    continue
                k = next((n for n, a in enumerate(al) if a['id'] == x['id'] and a['field'] == x['field'] and a['text'] == x['text']), None)
                if k is None:
                    open_.append(x)
                else:
                    used.add(k)
                    flagged.append({**x, 'reason': al[k]['reason']})
            ctl = [x for x in scored if 'control' in x]
            caught = sum(1 for x in ctl if bt_doubt({'cos': x['control'], 'xcos': x.get('xcontrol')}))
            r['meaning'] = {'scored': len(scored), 'backOnly': sum(1 for x in scored if x['cos'] < BT_T), 'accepted': flagged, 'open': open_,
                            'stale': [a for n, a in enumerate(al) if n not in used], 'control': (caught, len(ctl)),
                            'median': (sorted(x['cos'] for x in scored)[len(scored) // 2] if scored else None),
                            'unchecked': sorted(f'{i} {fl}' for (i, fl), t in cur.items() if rows.get((i, fl), {}).get('text') != t)}
    return res


def write_checks(L, CARDS, prov):
    """The findings of scripts/language/check (docs/language/checks/*.json) and how each was dealt with."""
    d = os.path.join(ROOT, 'docs/language/checks')
    load = lambda f: json.load(open(os.path.join(d, f), encoding='utf8')) if os.path.exists(os.path.join(d, f)) else None
    sp, gr, bt, acc, fixes = load('spelling.json'), load('grammar.json'), load('backtranslation.json'), load('accepted.json') or {}, load('fixes.json') or {'fixes': []}
    L.append('## Checks by tools that did not write the text\n')
    if not (sp or gr or bt):
        L.append('Not run. See "What was not done".\n')
        return
    res = triage(current_items(CARDS, prov), sp, gr, bt, acc)
    L.append('Run by `scripts/language/check/run.sh` on a build host; the raw findings are in `docs/language/checks/` (`spelling.json`, '
             '`grammar.json`, `backtranslation.json`). Every finding on the text as it now reads was read, and either the text was changed '
             '(listed under "Changes made because of a finding") or the finding was accepted with a reason (`docs/language/checks/accepted.json`, '
             'shown below). ' + acc.get('readBy', '') + ' A unit test (`src/lib/cards-i18n/checks.test.ts`) fails on a finding that is '
             'neither, on an acceptance that no longer matches a finding, and on any item that a check has not read as it now reads.\n')
    L.append('What the tools cannot show: a spelling dictionary does not know names; LanguageTool has grammar rules for only some of these '
             'languages, and finds only the errors it has rules for; a back-translation can be faithful to a text that is wrong in its own '
             'language, and a loose one can come from a right text. A text with no finding has not thereby been shown to be right.\n')
    L.append(f'Meaning is judged by the rule of the language QA pipeline: an item is flagged when its back-translation scores under {BT_T} '
             f'(MiniLM cosine against the English) and LaBSE scores the text itself under {BT_TX} against the English. The control column is '
             'the share of deliberately mismatched pairs (each item against the English of the next item of the same kind) that the same rule '
             'flags: a measure that cannot tell those apart proves nothing.\n')
    L.append('| Language | Items | Hunspell: unknown words (accepted / open) | LanguageTool: findings (accepted / open) | Back-translation: scored, median cosine | flagged by both signals (accepted / open) | control caught | not re-checked since the text changed |')
    L.append('|---|---|---|---|---|---|---|---|')
    for lang in LANGS:
        r = res[lang]
        s, g, m = r['spell'], r['grammar'], r['meaning']
        sc = f"{len(s['unknown'])} ({len(s['accepted'])} / {len(s['open'])})" if s else 'no dictionary'
        gc = f"{len(g['accepted']) + len(g['open'])} ({len(g['accepted'])} / {len(g['open'])})" if g else 'language not supported'
        if m:
            mc = f"{m['scored']}, {m['median']:.2f}" if m['median'] is not None else f"{m['scored']}"
            fc = f"{len(m['accepted']) + len(m['open'])} ({len(m['accepted'])} / {len(m['open'])})"
            cc = f"{m['control'][0]} of {m['control'][1]}"
        else:
            mc, fc, cc = 'not run', '-', '-'
        un = sorted(set((s or {}).get('unchecked', [])) | set((g or {}).get('unchecked', [])) | set((m or {}).get('unchecked', [])))
        L.append(f"| {lang} | {r['items']} | {sc} | {gc} | {mc} | {fc} | {cc} | {len(un) if un else 0} |")
    L.append('')
    esc = lambda x: str(x).replace('|', '\\|').replace('\n', ' ')
    opens = [(lang, 'spelling', w) for lang in LANGS if res[lang]['spell'] for w in res[lang]['spell']['open']]
    opens += [(lang, 'grammar', f"{o['id']} {o['field']}: {o['rule']} «{o['found']}»") for lang in LANGS if res[lang]['grammar'] for o in res[lang]['grammar']['open']]
    opens += [(lang, 'meaning', f"{o['id']} {o['field']}: {o['text']} → {o['back']}") for lang in LANGS if res[lang]['meaning'] for o in res[lang]['meaning']['open']]
    L.append('### Open findings\n')
    L.append('None.\n' if not opens else '\n'.join(f'- {l} {k}: {esc(t)}' for l, k, t in opens) + '\n')
    # What no tool can settle: the acceptances the reading itself doubted, then the text a reviewer should read first.
    review = [(lang, f"{a['id']} {a['field']}", a['found'] if k == 'grammar' else a['text'], a['reason']) for k in ('grammar', 'meaning')
              for lang in LANGS if res[lang][k] for a in res[lang][k]['accepted'] if re.search(r'for review|doubtful|reviewer', a['reason'])]
    review += [(lang, 'word', w, why) for lang in LANGS for w, why in sorted(acc.get('spelling', {}).get(lang, {}).items()) if re.search(r'for review|doubtful|reviewer', why)]
    L.append('### For a native-speaking reviewer, first\n')
    L.append('No tool certifies tone or verse, and every reading above is one language model\'s. A reviewer should read first: the '
             'scenes and lines written for the game in Thai, Hindi, Arabic and Vietnamese (written in one pass, and the languages where '
             'the back-translations ran lowest), then the translated relic and potion names and the element labels of every language '
             '(one or two words, which back-translation cannot judge), then these, which the reading itself left in doubt:\n')
    seen = set()
    for lang, item, text, why in review:
        if (lang, item, text) in seen:
            continue
        seen.add((lang, item, text))
        L.append(f'- {lang} {item}: {esc(text)} ({esc(why)})')
    L.append('')
    L.append('### Changes made because of a finding\n')
    if fixes['fixes']:
        L.append('| Language | Item | Finding | Before | After |')
        L.append('|---|---|---|---|---|')
        for f in fixes['fixes']:
            L.append(f"| {f['lang']} | {f['id']} {f['field']} | {esc(f['finding'])} | {esc(f['old'])} | {esc(f['new'])} |")
        L.append('')
    if fixes.get('note'):
        L.append(fixes['note'] + '\n')
    L.append('### Accepted: words Hunspell does not know\n')
    for lang in LANGS:
        s = res[lang]['spell']
        if not s or not s['accepted']:
            continue
        reasons = acc['spelling'][lang]
        by = {}
        for w in s['accepted']:
            by.setdefault(reasons[w], []).append(w)
        L.append(f"- **{lang}**: " + '; '.join(f"{', '.join(ws)} ({why})" for why, ws in sorted(by.items(), key=lambda kv: -len(kv[1]))))
    L.append('')
    L.append('### Accepted: LanguageTool findings\n')
    for lang in LANGS:
        g = res[lang]['grammar']
        if not g or not g['accepted']:
            continue
        L.append(f'**{lang}**\n')
        L.append('| Item | Found | Rule | Why it was left |')
        L.append('|---|---|---|---|')
        for a in g['accepted']:
            L.append(f"| {a['id']} {a['field']} | {esc(a['found'])} | {a['rule']} | {esc(a['reason'])} |")
        L.append('')
    if bt:
        L.append('### Accepted: back-translations flagged by both signals\n')
        any_ = False
        for lang in LANGS:
            m = res[lang]['meaning']
            if not m or not m['accepted']:
                continue
            any_ = True
            L.append(f'**{lang}**\n')
            L.append('| Item | Text | Back to English | English | cos / LaBSE | Why it was left |')
            L.append('|---|---|---|---|---|---|')
            for a in m['accepted']:
                L.append(f"| {a['id']} {a['field']} | {esc(a['text'])} | {esc(a['back'])} | {esc(a['english'])} | {a['cos']:.2f} / {a['xcos']:.2f} | {esc(a['reason'])} |")
            L.append('')
        if not any_:
            L.append('None.\n')
    stale = [(lang, k, a) for lang in LANGS for k in ('spell', 'grammar', 'meaning') if res[lang][k] for a in res[lang][k]['stale']]
    if stale:
        L.append('### Acceptances that no longer match a finding (remove them)\n')
        for lang, k, a in stale:
            L.append(f'- {lang} {k}: {esc(a)}')
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
    write_checks(L, CARDS, prov)
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
