#!/usr/bin/env python3
"""Build the per-language card text (src/lib/cards-i18n/<lang>.ts) and its record
(docs/language/NAMES-AND-QUOTATIONS.md, docs/language/card-text.provenance.json).

Inputs, all in the repository:
  src/lib/cards.ts                             the English cards (ids, names, quotations)
  docs/language/sources/wikidata-names.json    labels fetched from Wikidata (fetch_names.py)
  docs/language/sources/quotes-<lang>.json     lines copied from published translations (extract.py)
  docs/language/sources/stopwords-iso.json     stop words (stopwords-iso, MIT)
  docs/language/sources/wiktionary-closed-class.json   function words by part of speech (Wiktionary via kaikki.org;
                                               scripts/language/fetch/closed_class.py), added to the stop words
  docs/language/sources/published-names.json   a character's name as a published translation this branch quotes prints it,
                                               where Wikidata's label is wrong or English (Hugo's «La Nourrice»)
  docs/language/sources/wiktionary-vi-compounds.json   Vietnamese nouns, verbs and adjectives of two to four syllables
                                               in the game's lines (Wiktionary via kaikki.org; fetch/vi_compounds.py)
  docs/language/checks/name-words.json         which words of a longer character name are ordinary words (Hunspell;
                                               run.sh names), so they do not count as a name by themselves
  docs/language/checks/line-segments.json      the Korean lines' function words (Kiwi) and the Thai lines' words (PyThaiNLP
                                               newmm), check/segment.py
  docs/language/checks/name-forms.json         the forms a name takes in a Russian, Polish, German or Arabic sentence that
                                               the invocation accepts (check/declension.py, put to Hunspell; run.sh forms)
  docs/language/sources/wiktionary-name-pos.json   which name words are also ordinary words of the language, by English
                                               Wiktionary's parts of speech (fetch/name_pos.py)
  docs/language/sources/name-containing-words.json  Chinese and Thai dictionary words that hold a name with more around it
                                               (CC-CEDICT, jieba, PyThaiNLP; fetch/containing_words.py)
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


# A sourced label spelled as another word of the language, where that language's Wikipedia writes the name otherwise:
# (entity key, language) -> (name, the source file in docs/language/sources/, why).
SPELLING = {
    ('prospero', 'pt'): ('Próspero', 'ptwiki-a-tempestade.json',
                         'pt.wikipedia.org "A Tempestade", revision 72539005, writes Próspero (17 times, Prospero once); Wikidata\'s pt '
                         'and pt-br label "Prospero" is the verb prospero, "I prosper" (LanguageTool LP_PARONYMS)'),
}


# Where Wikidata's label in a language is wrong or is the English one, and a published translation this branch quotes
# prints the character's name: (entity key, language) -> (card id in docs/language/sources/published-names.json, why).
FROM_TRANSLATION = {
    ('nurse', 'fr'): ('VC-003', 'Wikidata\'s fr label «Infirmière» is a hospital nurse; the character is Juliet\'s wet-nurse, «la Nourrice» in Hugo'),
    ('friar', 'fr'): ('VC-002', 'Wikidata has no fr label'),
    ('friar', 'de'): ('VC-002', 'Wikidata\'s de label is the English «Friar Laurence»'),
}
# Where a language's label is wrong and one of the item's aliases in that language is the character's name:
# (entity key, language) -> (the alias as Wikidata writes it, why).
FROM_ALIAS = {
    ('nurse', 'zh'): ('奶媽', 'the zh label 護士 is a hospital nurse; the character is Juliet\'s wet-nurse (奶媽, 奶妈 in Simplified), '
                              'as the Chinese scene for this card calls her'),
    ('paris', 'es'): ('Conde Paris', 'the label\'s «París» is the city, stressed on its last syllable; the character is stressed on the '
                                    'first, as Menéndez Pelayo\'s translation prints him («conde Páris», es.wikisource revision 1642362), '
                                    'which today\'s spelling writes Paris (a word stressed on its next-to-last syllable and ending in -s takes no accent)'),
}
# Where a language's label is not the character's usual name there and that language's Wikipedia titles the character's
# article otherwise: (entity key, language) -> why. The title is taken without its parenthesis.
TITLE_FIRST = {
    ('horatio', 'ru'): 'the label «Гораций» is the Russian name of the Roman poet Horace; ru.wikipedia titles the character «Горацио (персонаж)», '
                       'which is also the item\'s ru alias and the name this game\'s Russian lines use',
    ('banquo', 'pl'): 'the label is the English spelling; pl.wikipedia titles the article «Banko», which is also the item\'s pl alias',
    ('odysseus', 'it'): 'it.wikipedia titles the article «Ulisse», the name Italian has used for him since Dante; the label is «Odisseo»',
}
# Published lines found and not used, with why: (language, card id) -> why.
NOT_PUBLISHED = {
    ('ru', 'LD-002'): ('Gumilyov\'s translation (1919). He was executed in 1921 and rehabilitated in 1992, and Russian law counts the term of a '
                       'repressed and rehabilitated author from the year after rehabilitation (Civil Code art. 1281 p. 5), which would run to '
                       '2062. Whether that rule reaches a work whose term had run out before 1993 is a question of how art. 6 of the law that '
                       'put part IV of the Code into force is read, and two readings of it in this project disagreed. Neither is a lawyer\'s. '
                       'Until one is, the game\'s Russian line for this card is its own, marked new.'),
}
# A label that adds to the name what no other language's label does, cut by rule: (entity key, language) -> (words kept, why).
CUT = {
    ('byron', 'vi'): (3, 'the label\'s personal name, before the comma; the rest («Nam tước Byron thứ 6») is the peerage, "6th Baron Byron"'),
    ('byron', 'th'): (3, 'the label\'s personal name, its first three words; the rest («บารอนไบรอนที่ 6») is the peerage, "6th Baron Byron"'),
}
_pub_names = None


def published_name(cid, lang):
    global _pub_names
    if _pub_names is None:
        _pub_names = json.loads(read('docs/language/sources/published-names.json'))['names']
    return _pub_names[lang][cid]


def name_for(key, lang, ents):
    if (key, lang) in SPELLING:
        text, src_file, why = SPELLING[(key, lang)]
        assert os.path.exists(os.path.join(SRC, src_file)), src_file
        return text, 'wikipedia', f'{why} ({ents[key]["id"]})'
    if (key, lang) in FROM_TRANSLATION:
        cid, why = FROM_TRANSLATION[(key, lang)]
        r = published_name(cid, lang)
        return r['name'], 'published', (f'{r["translator"]}\'s translation prints «{r["printed"]}» ({r["count"]} times; {r["rule"]}), '
                                         f'{r["page"]}, revision {r["revid"]}; {why} ({ents[key]["id"]})')
    if (key, lang) in FROM_ALIAS:
        alias, why = FROM_ALIAS[(key, lang)]
        ent = ents[key]
        assert alias in ent.get('aliases', {}).get(lang, []), (key, lang, alias)
        text = simplified(alias) if lang == 'zh' else alias
        conv = f'; converted to Simplified with OpenCC t2s' if text != alias else ''
        return text, 'wikidata', f'{ent["id"]} alias ({lang}) «{alias}»{conv}; {why}'
    if (key, lang) in TITLE_FIRST:
        ent = ents[key]
        title = strip_paren(ent['sitelinks'][lang])
        return title, 'wikipedia', f'{lang}.wikipedia.org article title «{ent["sitelinks"][lang]}» ({ent["id"]}); {TITLE_FIRST[(key, lang)]}'
    text, src, detail = label(ents.get(key), lang)
    if text and (key, lang) in CUT:
        n, why = CUT[(key, lang)]
        kept = ' '.join([p for p in SPLIT.split(re.sub(r',.*$', '', text)) if p][:n])
        return kept, 'derived', f'{why} ({detail}: "{text}")'
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


# Aliases Wikidata gives that are not names of the character, which no rule below catches: (language, alias) -> why.
NOT_ALIAS = {
    ('de', 'Abadonna'): 'the fallen angel of Klopstock\'s Messias (Abaddon), not a name of Apollo',
    ('de', 'Uthuce'): 'the Etruscan name of Odysseus, not a German one',
    ('zh', '哈里斯'): '"Harris"; no Chinese source gives it for Hades',
    # Found by the second check (2026-11-17). The counts are articles ru.wikipedia's or de.wikipedia's search finds the
    # spelling in, quoted ("…"), on 2026-11-17.
    ('ru', 'Афродиты'): 'the genitive of «Афродита», not another name of her',
    ('ru', 'Ахилесс'): 'a misspelling: 2 ru.wikipedia articles, against 572 for «Ахиллес» and 19 for «Ахилес»',
    ('ru', 'Дит'): 'Dis (Dis Pater), the Roman god of the dead whom Rome identified with Hades, not a name of Hades himself '
                   '(Плутон, from the Greek Πλούτων, is one); three letters, and Russian «Дитя» ("child") begins with it',
    ('de', 'Archill'): 'a misspelling: 3 de.wikipedia articles, against 416 for «Achill»',
    ('de', 'Archilles'): 'a misspelling: 17 de.wikipedia articles, against 416 for «Achill»; German writes Achilleus or Achilles',
}
LETTERS_ONLY = r'[\p{L}\p{M}]+(?:[\-‐][\p{L}\p{M}]+)*'


def alias_rejected(a, lang, name, kept):
    """Why an alias is not taken, or None. The rules: an alias is letters only (no '：', '，' or '.', which mark a
    description: 科學怪人之母：瑪麗雪萊, 济慈，J.); it is written in one script, the language's own (not Latin mixed with
    Greek, as it Aφροδίτη; not Latin in a language with another script, where the English name counts anyway); and it is
    not, in a script written without spaces, the name or another alias with more added (ゼウス神像, "statue of Zeus";
    ブルトゥス家, "the Brutus family"; アテナ女神, "the goddess Athena"), which names something else or adds a title. In a
    spaced script a title or another word comes with a space, and such an alias is not taken anyway; a longer spelling
    there is a variant of the name (German Apoll, Apollo; Russian Ахилл, Ахиллес)."""
    import regex
    if (lang, a) in NOT_ALIAS:
        return NOT_ALIAS[(lang, a)]
    if not regex.fullmatch(LETTERS_ONLY, a):
        return 'not letters only'
    scripts = {sc for sc in ('Latin', 'Greek', 'Cyrillic', 'Arabic', 'Devanagari', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Thai')
               if regex.search(r'\p{Script=%s}' % sc, a)}
    if lang == 'ja':
        scripts -= {'Han', 'Hiragana'} if 'Katakana' in scripts else set()
    if len(scripts) > 1:
        return 'mixes scripts'
    if lang in SCRIPT and 'Latin' in scripts:
        return 'Latin letters in a language written in another script'
    base = [n for n in SPLIT.split(name) if n] + [name] + kept
    if lang in ('zh', 'ja', 'th') and any(b != a and len(b) >= 2 and b in a for b in base):
        return 'the name or another alias with more added'
    return None


def aliases(key, lang, ents, name, rejected=None):
    ent = ents.get(key) or {}
    out = []
    for a in ent.get('aliases', {}).get('pt-br', []) * (lang == 'pt') + ent.get('aliases', {}).get(lang, []):
        a = strip_paren(a)
        if not a or a == name or SPLIT.search(a) or a in out:
            continue
        why = alias_rejected(a, lang, name, out)
        if why:
            if rejected is not None:
                rejected.append({'alias': a, 'why': why})
            continue
        out.append(a)
    return out[:4]


ONE_WORD = r"\p{L}[\p{L}\p{M}'’\-]*"


def stop_words(lang, iso, closed):
    """stopwords-iso's list for the language, and every single-word headword Wiktionary gives as one of its function
    words (closed_class.py): both are used as published, except the words in NOT_STOP. Chinese headwords are also
    added in Simplified characters, which the game's Chinese uses."""
    import regex
    words = set(w for w in iso.get(lang, []) if re.search(r'[^\W\d_]', w))
    for pos in closed[lang].values():
        for w in pos['words']:
            if regex.fullmatch(ONE_WORD, w):
                words.add(w)
                if lang == 'zh':
                    words.add(simplified(w))
    return sorted(words - set(NOT_STOP.get(lang, [])))


def ko_particles(closed):
    """Korean particles (josa) in standard use, as Wiktionary lists them (headwords written "-가"), Hangul syllables only."""
    return sorted(set(w.lstrip('-') for w in closed['ko']['particle']['standard'] if re.fullmatch(r'-?[\uac00-\ud7a3]+', w)))


CASED = set('es fr it pt pl ru vi id'.split())  # as in check/check.py: where Hunspell was asked in lower case


def _bare(w):
    import unicodedata
    return ''.join(ch for ch in unicodedata.normalize('NFD', w) if not unicodedata.combining(ch)).lower()


def common_name_words(lang, CARDS, pack, name_words):
    """Words of a character's longer name, and one-word aliases, that are ordinary words of the language and so do not
    count as an invocation by themselves (src/lib/verse/echo.ts): Russian «граф», Vietnamese «Phu nhân», Russian «Кора»
    (bark) for Persephone. Decided from Hunspell's verdicts (docs/language/checks/name-words.json, run.sh names):
      - where the script has case, Hunspell was asked in lower case, so its verdict stands;
      - in German, and in Arabic, Hindi and Thai, which have no case, Hunspell also knows many names (Hamlet, कीट्स
        Keats): there a word Hunspell knows is taken for a title only before the last word of the name, where these
        languages put titles (Prinz Hamlet, الأمير هاملت), so a surname still counts by itself; Korean puts the title
        after the name (맥베스 부인), so there any word Hunspell knows is taken for one;
      - a word that is also a word of an English character name (Romeo, Lady, William) counts as it does in English."""
    import regex
    verdict = name_words.get(lang, {})
    acc = set(verdict.get('accepted', []))
    if not acc:
        return []
    english = {_bare(w) for c in CARDS if c['type'] == 'Character' for w in re.sub(r'^The ', '', c['name']).split()}
    clean = lambda t: regex.sub(r'^[^\p{L}]+|[^\p{L}\p{M}]+$', '', t)
    out = set()
    for c in CARDS:
        e = pack['cards'][c['id']]
        if c['type'] != 'Character' or not e.get('name') or e['nameSource'] in ('missing', 'kept'):
            continue
        parts = [w for w in (clean(x) for x in regex.split(r'[\s・·‧]+', clean(re.sub(r',.*$', '', e['name'])))) if w]
        if len(parts) > 1:
            for i, w in enumerate(parts):
                if w in acc and _bare(w) not in english and (lang in CASED or lang == 'ko' or i < len(parts) - 1):
                    out.add(w)
        for a in e.get('aliases', []):
            a = clean(a)
            if a in acc and _bare(a) not in english:
                out.add(a)
    return sorted(out)


def ordinary_name_words(lang, CARDS, pack, name_words, name_pos):
    """Words of a character's name, or whole names and aliases, that are also ordinary words of the language, as the
    language writes the ordinary word (src/lib/verse/echo.ts reads the case of what is listed):
      - where the script has capitals and Hunspell can say so (es fr it pt pl ru vi id): English Wiktionary lists the word
        written small as an ordinary word (fetch/name_pos.py) AND Hunspell accepts it written small (run.sh names). Both
        sources must agree: Polish Hunspell alone accepts «hamlet» and «zeus», Wiktionary alone has rare words such as
        Italian «achille». Listed small: «bruto», «banco», «пак»;
      - German, where Hunspell knows names as well as words: Wiktionary, a Noun under the word as written (listed with its
        capital: «Zettel», «Puck») or any ordinary word written small («blake»);
      - Arabic, Hindi, Chinese, Japanese, Korean and Thai (no capitals): Wiktionary («パック», «बैंको», «โพ»).
    echo.ts: a name listed small counts by itself only written with a capital inside a sentence; one listed with a
    capital (a German noun), or in a script without capitals, never by itself."""
    import regex
    pos = name_pos.get(lang, {})
    acc = set(name_words.get(lang, {}).get('accepted', []))
    out = set()
    for w, row in pos.items():
        o = row.get('ordinary')
        if not o:
            continue
        if lang in CASED and w not in acc:
            continue
        out.add(o)
    # Only what this pack's names hold.
    have = set()
    for c in CARDS:
        e = pack['cards'][c['id']]
        if c['type'] != 'Character' or not e.get('name') or e['nameSource'] in ('missing', 'kept'):
            continue
        for t in [re.sub(r',.*$', '', e['name'])] + e.get('aliases', []):
            t = regex.sub(r'^[^\p{L}]+|[^\p{L}\p{M}]+$', '', t.strip())
            have.add(t.lower())
            have.update(x.lower() for x in regex.split(r'[\s・·‧]+', t) if x)
    return sorted(w for w in out if w.lower() in have)


def containing_words(lang, record):
    """Chinese and Thai: for each name, the dictionary words that hold it with more around it and are not the character
    (fetch/containing_words.py), where echo.ts refuses the name."""
    rows = record.get('languages', {}).get(lang, {})
    out = {u: sorted({r['word'] for r in rs if not r['same']}) for u, rs in rows.items()}
    return {u: ws for u, ws in sorted(out.items()) if ws}


def name_tokens(CARDS, pack):
    """Every word of every character's name and alias in this pack, as check/collect.mjs gives them to check.py forms."""
    import regex
    out = set()
    for c in CARDS:
        e = pack['cards'][c['id']]
        if c['type'] != 'Character' or not e.get('name') or e['nameSource'] in ('missing', 'kept'):
            continue
        for t in [re.sub(r',.*$', '', e['name'])] + e.get('aliases', []):
            out.update(regex.findall(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*", t))
    return out


def ko_particle_forms(closed):
    """Which Korean particles follow a vowel and which a consonant (를 / 을; 로 also after ㄹ), from Wiktionary's glosses
    (closed_class.py, ko_allomorphs). Hangul syllables only."""
    syl = lambda w: bool(re.fullmatch(r'[\uac00-\ud7a3]+', w))
    pairs = [p for p in closed['ko']['particle']['allomorphs'] if syl(p['after_vowel']) and syl(p['after_consonant'])]
    return {'afterVowel': sorted(set(p['after_vowel'] for p in pairs)),
            'afterConsonant': sorted(set(p['after_consonant'] for p in pairs)),
            'alsoAfterL': sorted(set(p['after_vowel'] for p in pairs if p['after_l']))}


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
    closed = json.loads(read('docs/language/sources/wiktionary-closed-class.json'))['languages']
    nw_path = os.path.join(ROOT, 'docs/language/checks/name-words.json')
    name_words = json.load(open(nw_path, encoding='utf8'))['languages'] if os.path.exists(nw_path) else {}
    nf_path = os.path.join(ROOT, 'docs/language/checks/name-forms.json')
    name_forms = json.load(open(nf_path, encoding='utf8'))['languages'] if os.path.exists(nf_path) else {}
    name_pos = json.loads(read('docs/language/sources/wiktionary-name-pos.json'))['languages']
    containing = json.loads(read('docs/language/sources/name-containing-words.json'))
    sg_path = os.path.join(ROOT, 'docs/language/checks/line-segments.json')
    segments = json.load(open(sg_path, encoding='utf8')) if os.path.exists(sg_path) else None
    published = json.loads(read('scripts/language/published.json'))
    CARDS = cards()
    assert len(CARDS) == 71, len(CARDS)
    prov = {'langs': {}}
    for lang in LANGS:
        tr = translated(lang)
        qpath = os.path.join(SRC, f'quotes-{lang}.json')
        pub = json.load(open(qpath, encoding='utf8')) if os.path.exists(qpath) else {}
        pack = {'lang': lang, 'cards': {}, 'houses': {}, 'elements': dict(zip(ELEMENTS, tr['elements'])), 'rarities': rarity_names(lang),
                'types': dict(zip(TYPES, tr['types'])), 'stop': stop_words(lang, stop, closed)}
        if lang == 'ko':
            pack['particles'] = ko_particles(closed)
            pack['particleForms'] = ko_particle_forms(closed)
        if lang == 'ko' and segments:
            # Eojeols of the lines whose first morpheme Kiwi tags as a function word (check/segment.py): 있어요, 것이지요.
            pack['stop'] = sorted(set(pack['stop']) | {r['word'] for rows in segments['ko'].values() for r in rows if r['function']})
        if lang == 'th' and segments:
            # The lines' words as PyThaiNLP's newmm reads them (check/segment.py), which echo.ts reads whole where ICU cuts
            # them into pieces: โรสแมรี, not โรส ("rose") and แมรี ("Mary").
            pack['compounds'] = sorted({w for words in segments['th'].values() for w in words if len(w) > 1})
        if lang == 'vi':
            # Words of more than one syllable, which the signature reads whole (src/lib/verse/echo.ts lineWords). One that is
            # also a function word (Wiktionary files «người ta», "one, people", as a pronoun too) stays whole, so «người» is
            # not taken by itself, and goes on the stop list.
            pack['compounds'] = [c['word'] for c in json.loads(read('docs/language/sources/wiktionary-vi-compounds.json'))['compounds']]
            function = set(w for p in closed['vi'].values() for w in p['words']) | set(stop.get('vi', []))
            pack['stop'] = sorted(set(pack['stop']) | {c for c in pack['compounds'] if c in function})
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
            if cid == 'SM-001':
                # The product name is the same in every language: neither sourced nor translated.
                entry['name'], entry['nameSource'] = own[cid], 'kept'
                rec['name'] = {'text': own[cid], 'source': 'kept', 'detail': 'the product name, the same in every language'}
            elif cid in own:
                entry['name'], entry['nameSource'] = own[cid], 'translated'
                rec['name'] = {'text': own[cid], 'source': 'translated', 'detail': "the game's own name, translated for the game"}
            else:
                key = ENTITY[cid]
                text, src, detail = name_for(key, lang, ents)
                entry['nameSource'] = src
                if text:
                    entry['name'] = text
                    rejected = []
                    al = aliases(key, lang, ents, text, rejected)
                    if al and c['type'] == 'Character':
                        entry['aliases'] = al
                rec['name'] = {'text': text, 'source': src, 'detail': detail}
                if text and rejected and c['type'] == 'Character':
                    rec['name']['aliasesNotTaken'] = rejected
            work, cite = CITE[cid]
            if cid in pub and (lang, cid) in NOT_PUBLISHED:
                rec['publishedNotUsed'] = {'url': pub[cid]['url'], 'work': pub[cid]['work'], 'why': NOT_PUBLISHED[(lang, cid)]}
            if cid in pub and (lang, cid) not in NOT_PUBLISHED:
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
        common = common_name_words(lang, CARDS, pack, name_words)
        if common:
            pack['common'] = common
        ordinary = ordinary_name_words(lang, CARDS, pack, name_words, name_pos)
        if ordinary:
            pack['ordinary'] = ordinary
        held = containing_words(lang, containing)
        if held:
            pack['containing'] = held
        if lang in name_forms:
            # The forms a name takes in a sentence that the invocation accepts (check.py forms): made by declension.py's
            # paradigms, without the ones Hunspell knows as ordinary words. Only for the words of this pack's names.
            words = name_tokens(CARDS, pack)
            pack['forms'] = {w: v['forms'] for w, v in name_forms[lang].items() if v['forms'] and w in words}
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
        print(lang, 'names: wikidata', n('name', 'wikidata'), 'wikipedia', n('name', 'wikipedia'), 'published', n('name', 'published'), 'derived', n('name', 'derived'), 'translated',
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
    L.append('| Language | Names from Wikidata | from a Wikipedia title | from a published translation | derived by rule | translated (own inventions) | missing | Lines from a published translation | new, unsourced | Scenes translated |')
    L.append('|---|---|---|---|---|---|---|---|---|---|')
    for lang in LANGS:
        cs = list(prov['langs'][lang]['cards'].values())
        n = lambda k, v: sum(1 for c in cs if c[k]['source'] == v)
        L.append(f"| {lang} | {n('name','wikidata')} | {n('name','wikipedia')} | {n('name','published')} | {n('name','derived')} | {n('name','translated')} | {n('name','missing')} | {n('quote','published')} | {n('quote','new')} | {sum(1 for c in cs if c['scene']=='translated')} |")
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
    L.append('\n## Published lines found and not used\n')
    for lang in LANGS:
        for c in CARDS:
            nu = prov['langs'][lang]['cards'][c['id']].get('publishedNotUsed')
            if nu:
                L.append(f"- **{lang}** {c['id']}: [{nu['url']}]({nu['url']}). {nu['why']}")
    L.append('\n## Wikidata aliases not taken as names\n')
    L.append('An alias counts for the invocation (src/lib/verse/echo.ts). These were left out, by the rules of `alias_rejected` in '
             '`scripts/language/build_card_text.py` or, where named, by hand:\n')
    for lang in LANGS:
        rows = [f"{c['id']} «{a['alias']}» ({a['why']})" for c in CARDS for a in prov['langs'][lang]['cards'][c['id']]['name'].get('aliasesNotTaken', [])]
        if rows:
            L.append(f"- **{lang}**: " + '; '.join(rows))
    L.append('\n## Lines translated for the game, not sourced\n')
    for lang in LANGS:
        new = [c['id'] for c in CARDS if prov['langs'][lang]['cards'][c['id']]['quote']['source'] == 'new']
        miss = [c['id'] for c in CARDS if prov['langs'][lang]['cards'][c['id']]['quote']['source'] == 'missing']
        L.append(f"- **{lang}** new ({len(new)}): " + (', '.join(new) if new else 'none') + (f". Not translated ({len(miss)}): {', '.join(miss)}" if miss else ''))
    L.append('\n## Names translated for the game, not sourced\n')
    L.append('In every language: ' + ', '.join(OWN_NAMES[1:]) + ', the house labels ' + ', '.join(HOUSES_T) +
             ', all element labels and the three card types. Rarity names are the ones already in src/i18n/locales. Scene descriptions are translated wherever present. '
             'SM-001, "The Sonnet Man", is the product name: it is the same in every language and recorded as kept, neither sourced nor translated.\n')
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
