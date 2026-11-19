#!/usr/bin/env python3
"""Check the card text that was written for the game, with tools that did not write it.

  check.py spell   ITEMS OUT      Hunspell, with LibreOffice's dictionaries, word by word
  check.py grammar ITEMS OUT      LanguageTool (a local server at $LT_URL), item by item
  check.py meaning ITEMS OUT      MADLAD-400 translates each item back to English (lang/qa-pipeline's
                                  backtranslate.py); MiniLM cosine, chrF and LaBSE against the English
  check.py names   ITEMS OUT      Hunspell: which words of a character's longer name (and which one-word aliases)
                                  are ordinary words of the language, so that they do not count as a name alone
  check.py forms   ITEMS OUT      the forms a name takes in Russian, Polish, German and Arabic (declension.py), each put to
                                  Hunspell (hstem.cpp): one the dictionary knows as an ordinary word is not a name
  check.py selftest               each check is fed a known-bad input and must flag it

ITEMS is the output of collect.mjs. Nothing here changes any text: it writes findings, and a person
(or the engineer) decides what to change. Environment: HSPELL, DICT_DIR, LT_URL, MADLAD_DIR, MINILM_DIR, LABSE_DIR,
BT_SCRIPT (lang/qa-pipeline's backtranslate.py, which does the translating and scoring), TMPDIR.
"""
import hashlib, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

HUNSPELL_DICT = {'es': 'es', 'fr': 'fr', 'de': 'de', 'it': 'it', 'pt': 'pt-BR', 'pl': 'pl', 'ru': 'ru', 'ar': 'ar', 'hi': 'hi',
                 'ko': 'ko', 'vi': 'vi', 'th': 'th', 'id': 'id'}  # no Hunspell dictionary for zh or ja
LT_LANG = {'es': 'es', 'fr': 'fr', 'de': 'de-DE', 'it': 'it', 'pt': 'pt-BR', 'pl': 'pl-PL', 'ru': 'ru-RU', 'ar': 'ar', 'zh': 'zh-CN'}
LATIN = set('es fr de it pt pl vi id'.split())


def text_hash(text):
    """What a check records of each item it read, so a test can tell an item checked as it now reads from one changed since."""
    return hashlib.sha256(text.encode('utf8')).hexdigest()[:16]


def checked(items):
    return {f"{i['id']}|{i['field']}": text_hash(i['text']) for i in items}


def latin_word(w):
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z'’-]*", w))


def hunspell_unknown(lang, words):
    """The words Hunspell does not accept, for one language."""
    # hspell (hspell.cpp) puts each word to the Hunspell library whole, in the dictionary's encoding. The hunspell
    # command itself splits its input by its own rules, which cut Devanagari and Thai words into fragments: run with
    # it, 230 of 243 Hindi "unknown words" were fragments, not words of the text.
    d = os.path.join(os.environ['DICT_DIR'], HUNSPELL_DICT[lang])
    r = subprocess.run([os.environ['HSPELL'], d + '.aff', d + '.dic'], input='\n'.join(words) + '\n', capture_output=True, text=True, check=True)
    return set(x for x in r.stdout.split('\n') if x)


def thai_unknown(items, names, bad):
    """Thai has no spaces, and ICU (Intl.Segmenter) cuts a word it does not know into pieces: a transliterated
    name comes out as several. A rejected piece counts only if no join with the pieces touching it (up to three)
    is a word Hunspell knows, and it is not part of a card name in Thai (the rule of lang/qa-pipeline)."""
    full = [n for n in names if n]
    joins = set()
    for i in items:
        w = i['words']
        for k in range(len(w)):
            for a in range(max(0, k - 2), k + 1):
                for b in range(k + 1, min(len(w), k + 3) + 1):
                    if b - a > 1:
                        joins.add(''.join(w[a:b]))
    ok_joins = joins - hunspell_unknown('th', sorted(joins))
    out = {}
    for i in items:
        w = i['words']
        for k, piece in enumerate(w):
            if piece not in bad:
                continue
            spans = [''.join(w[a:b]) for a in range(max(0, k - 2), k + 1) for b in range(k + 1, min(len(w), k + 3) + 1) if b - a > 1]
            if any(j in ok_joins for j in spans) or any(piece in n for n in full):
                continue
            out.setdefault(i['id'] + '|' + i['field'], set()).add(piece)
    return out


def elided_unknown(lang, bad):
    """An elided word comes to Hunspell whole and with the typographic apostrophe ("dell’alba", "un’isola"); the Italian
    dictionary holds these forms with the straight one ("dell'alba") and rejects the others. A word with ’ is accepted
    when the same word with ' is."""
    alt = {w: w.replace('’', "'") for w in bad if '’' in w}
    if not alt:
        return bad
    rejected = hunspell_unknown(lang, sorted(set(alt.values())))
    return {w for w in bad if w not in alt or alt[w] in rejected}


def spell(items_path, out_path):
    data = json.load(open(items_path, encoding='utf8'))
    out = {'tool': 'Hunspell 1.7.2 library, whole-word queries (hspell.cpp), LibreOffice dictionaries at commit c0865a85', 'languages': {}}
    for lang in HUNSPELL_DICT:
        items = [i for i in data['items'] if i['lang'] == lang]
        names = set(data['names'][lang])
        # Proper nouns kept in Latin letters inside another script (the rule for names with no source) are not this language's words.
        cand = sorted(set(w for i in items for w in i['words'] if w.lower() not in names and not (lang not in LATIN and latin_word(w)) and not re.search(r'\d', w)))
        bad = hunspell_unknown(lang, cand)
        if lang in LATIN:
            bad = elided_unknown(lang, bad)
        thai = thai_unknown(items, data.get('nameStrings', {}).get(lang, []), bad) if lang == 'th' else None
        flagged = []
        for i in items:
            unk = sorted(thai.get(i['id'] + '|' + i['field'], ())) if thai is not None else sorted(set(w for w in i['words'] if w in bad))
            if unk:
                flagged.append({'id': i['id'], 'field': i['field'], 'unknown': unk, 'text': i['text']})
        counted = len(set(w for f in flagged for w in f['unknown']))
        out['languages'][lang] = {'items': len(items), 'words checked': len(cand), 'unknown words': counted, 'flagged': flagged, 'checked': checked(items)}
        print(f'spell {lang}: {len(items)} items, {len(cand)} distinct words, {counted} unknown', file=sys.stderr)
    for lang in sorted(set(i['lang'] for i in data['items']) - set(HUNSPELL_DICT)):
        out['languages'][lang] = {'items': sum(1 for i in data['items'] if i['lang'] == lang), 'dictionary': None}  # not checked: no dictionary
    json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


def lt_check(lang, text):
    body = urllib.parse.urlencode({'language': LT_LANG[lang], 'text': text}).encode()
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(os.environ['LT_URL'] + '/v2/check', data=body), timeout=120) as r:
                return json.load(r)['matches']
        except Exception:
            time.sleep(2 * (attempt + 1))
    raise SystemExit('LanguageTool did not answer')


def grammar(items_path, out_path):
    data = json.load(open(items_path, encoding='utf8'))
    out = {'tool': 'LanguageTool 6.6, local server, default rules', 'languages': {}}
    for lang in LT_LANG:
        items = [i for i in data['items'] if i['lang'] == lang]
        flagged = []
        for i in items:
            ms = lt_check(lang, i['text'])
            if ms:
                flagged.append({'id': i['id'], 'field': i['field'], 'text': i['text'],
                                'matches': [{'rule': m['rule']['id'], 'category': m['rule'].get('category', {}).get('id'), 'message': m['message'],
                                             'found': i['text'][m['offset']:m['offset'] + m['length']], 'suggestions': [r['value'] for r in m.get('replacements', [])[:3]]} for m in ms]})
        out['languages'][lang] = {'items': len(items), 'flagged': flagged, 'checked': checked(items)}
        print(f'grammar {lang}: {len(items)} items, {len(flagged)} with a finding', file=sys.stderr)
    for lang in sorted(set(i['lang'] for i in data['items']) - set(LT_LANG)):
        out['languages'][lang] = {'items': sum(1 for i in data['items'] if i['lang'] == lang), 'supported': False}  # LanguageTool has no such language
    json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


# The meaning rule of the language QA pipeline (scripts/lang/meaning.mjs): an item is flagged when the
# back-translation's MiniLM cosine to the English is under 0.6 AND LaBSE's similarity of the text itself to
# the English is under 0.6. Back-translation alone flags short labels by the dozen (the model copies a name
# through untranslated); LaBSE alone cannot see a wrong word in a long sentence.
BT_T = 0.6
BT_TX = 0.6


def doubt(cos, xcos):
    return cos < BT_T and (xcos is None or xcos < BT_TX)


def run_pairs(pairs, tmp_name):
    """lang/qa-pipeline's backtranslate.py --pairs: back-translation (MADLAD-400), MiniLM cosine, chrF, LaBSE xcos."""
    src = os.path.join(os.environ['TMPDIR'], tmp_name + '.in.json')
    dst = os.path.join(os.environ['TMPDIR'], tmp_name + '.out.json')
    json.dump(pairs, open(src, 'w', encoding='utf8'), ensure_ascii=False)
    subprocess.run([sys.executable, os.environ['BT_SCRIPT'], '--pairs', src, '--out', dst, '--model', os.environ['MADLAD_DIR'],
                    '--embedder', os.environ['MINILM_DIR'], '--bitext', os.environ['LABSE_DIR']], check=True)
    return json.load(open(dst, encoding='utf8'))


class Control:
    """The proof the measure can tell right from wrong: each item scored against the English of the next item
    of the same field in the same language, by the same two models and the same rule."""
    def __init__(self):
        from sentence_transformers import SentenceTransformer
        self.mini = SentenceTransformer(os.environ['MINILM_DIR'], device='cpu')
        self.labse = SentenceTransformer(os.environ['LABSE_DIR'], device='cpu')

    @staticmethod
    def _cos(model, a, b):
        x = model.encode(a, normalize_embeddings=True, batch_size=64)
        y = model.encode(b, normalize_embeddings=True, batch_size=64)
        return [round(float(v), 4) for v in (x * y).sum(axis=1)]

    def score(self, backs, texts, wrong):
        return self._cos(self.mini, backs, wrong), self._cos(self.labse, texts, wrong)


def meaning(items_path, out_path):
    data = json.load(open(items_path, encoding='utf8'))
    out = {'tool': 'lang/qa-pipeline scripts/lang/backtranslate.py --pairs: MADLAD-400 3B (google/madlad400-3b-mt, CTranslate2 int8) '
                   'back to English, all-MiniLM-L6-v2 cosine and chrF against the English source; LaBSE similarity of the text to the English',
           'rule': f'flagged when cos < {BT_T} and LaBSE < {BT_TX}',
           'control': 'each item is also scored against the English of the next item of the same field in the same language; '
                      'a check that cannot tell those apart proves nothing',
           'languages': {}}
    if os.path.exists(out_path):
        old = json.load(open(out_path, encoding='utf8'))
        if all('xcos' in r for rows in old.get('languages', {}).values() for r in rows):
            out['languages'] = old['languages']  # resume: an item is translated again only if its text or its English changed
    only = [l for l in os.environ.get('BT_LANGS', '').split(',') if l]
    langs = [l for l in sorted(set(i['lang'] for i in data['items'])) if not only or l in only]
    t0 = time.time()
    ctl = None
    for lang in langs:
        items = [i for i in data['items'] if i['lang'] == lang]
        prev = {(r['id'], r['field']): r for r in out['languages'].get(lang, [])}
        todo = [i for i in items if not ((i['id'], i['field']) in prev and prev[(i['id'], i['field'])]['text'] == i['text']
                                         and prev[(i['id'], i['field'])]['english'] == i['english'])]
        fresh = {}
        if todo:
            res = run_pairs([{'id': f"{i['id']}|{i['field']}", 'lang': lang, 'text': i['text'], 'english': i['english']} for i in todo], f'bt-{lang}')
            for i, r in zip(todo, res):
                fresh[(i['id'], i['field'])] = {'id': i['id'], 'field': i['field'], 'text': i['text'], 'english': i['english'],
                                                'back': r['back'], 'cos': r['cos'], 'chrf': r['chrf'], 'xcos': r.get('xcos')}
        rows = [fresh.get((i['id'], i['field'])) or prev[(i['id'], i['field'])] for i in items]
        # The control, for every row (cheap: no translation): the next item of the same field.
        by_field = {}
        for k, i in enumerate(items):
            by_field.setdefault(i['field'], []).append(k)
        wrong = [None] * len(items)
        for ks in by_field.values():
            for n, k in enumerate(ks):
                wrong[k] = items[ks[(n + 1) % len(ks)]]['english'] if len(ks) > 1 else None
        need = [k for k, r in enumerate(rows) if wrong[k] is not None and (r.get('controlEnglish') != wrong[k] or 'control' not in r)]
        if need:
            ctl = ctl or Control()
            c, x = ctl.score([rows[k]['back'] for k in need], [rows[k]['text'] for k in need], [wrong[k] for k in need])
            for k, cv, xv in zip(need, c, x):
                rows[k]['control'], rows[k]['xcontrol'], rows[k]['controlEnglish'] = cv, xv, wrong[k]
        out['languages'][lang] = rows
        json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        print(f'meaning {lang}: {len(rows)} items, {len(todo)} translated now, {sum(doubt(r["cos"], r["xcos"]) for r in rows)} flagged, '
              f'{time.time() - t0:.0f}s', file=sys.stderr, flush=True)


CASED = set('es fr it pt pl ru vi id'.split())  # scripts with letter case, where a dictionary writes its proper names capitalised


def accepted_name_words(lang, words):
    """The words Hunspell accepts. Where the script has letter case the word is asked in lower case, so a name the
    dictionary holds (capitalised) is not taken for an ordinary word. German writes its nouns with a capital (Graf,
    König), and Arabic, Hindi, Korean and Thai have no case: there the word is asked as the name writes it."""
    asked = {w: (w.lower() if lang in CASED else w) for w in words}
    bad = hunspell_unknown(lang, sorted(set(asked.values())))
    return sorted(w for w, a in asked.items() if a not in bad)


def names(items_path, out_path):
    data = json.load(open(items_path, encoding='utf8'))
    out = {'tool': 'Hunspell 1.7.2 library, whole-word queries (hspell.cpp), LibreOffice dictionaries at commit c0865a85',
           'asked': 'in lower case for es fr it pt pl ru vi id; as written for de ar hi ko th; zh and ja have no dictionary',
           'use': 'build_card_text.py decides from these verdicts which words of a longer name count as a name by themselves',
           'languages': {}}
    for lang, words in sorted(data['nameWords'].items()):
        if lang not in HUNSPELL_DICT:
            out['languages'][lang] = {'checked': words, 'accepted': [], 'dictionary': None}
            continue
        acc = accepted_name_words(lang, words)
        out['languages'][lang] = {'checked': words, 'accepted': acc}
        print(f'names {lang}: {len(words)} words, {len(acc)} accepted: {" ".join(acc)}', file=sys.stderr)
    json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


def hunspell_stems(lang, words):
    """For each word: does Hunspell accept it, and which dictionary entries is it a form of (hstem.cpp)."""
    d = os.path.join(os.environ['DICT_DIR'], HUNSPELL_DICT[lang])
    r = subprocess.run([os.environ['HSTEM'], d + '.aff', d + '.dic'], input='\n'.join(words) + '\n', capture_output=True, text=True, check=True)
    out = {}
    for line in r.stdout.split('\n'):
        if line:
            w, ok, st = line.split('\t')
            out[w] = (ok == '1', [s for s in st.split('|') if s])
    return out


DECLINING = ('ru', 'pl', 'de', 'ar')
# The adjective a Polish dictionary makes of a name (Achilles, achillesowy: ścięgno Achillesa, the Achilles tendon), whose
# plural masculine-personal form is spelt as the name's dative (Achillesowi): an entry of the name's own, not another word.
NAME_ADJECTIVE = {'pl': ('owy',)}


def _low(a):
    return a.lower().replace('ё', 'е')


def judge_forms(lang, word, candidates, st, own=()):
    """Which candidate forms of a name word stand. A form is dropped when Hunspell knows it as an ordinary word: in
    Russian and Polish, where a dictionary writes its proper nouns with a capital, when it accepts the form in lower case
    (Банки, "banks"; Kora, "bark"), unless every entry it is a form of is the name itself; in German and Arabic, when it
    accepts the form as a form of anything but the name. An entry made from the name (Polish «achillesowy», the
    adjective of Achilles) is the name's; in Arabic so is any entry Hunspell gives for the name alone (`own`), because
    its dictionary parses an unknown name too (روميو as رومي and و), and the prefix then adds nothing. A form that is
    also another proper noun (Russian «Афины», Athens and Athena's genitive) is kept and listed as a homograph."""
    kept, dropped, homographs, confirmed = [], [], [], []
    mine = {_low(word)} | {_low(s) for s in own} | {_low(word) + a for a in NAME_ADJECTIVE.get(lang, ())}
    other = lambda s: _low(s) not in mine
    for f in candidates:
        ok, stems = st.get(f, (False, []))
        others = [s for s in stems if other(s)]
        if lang in ('ru', 'pl'):
            low_ok, low_stems = st.get(f.lower(), (False, []))
            low_others = [s for s in low_stems if other(s)]
            if low_ok and (low_others or not low_stems):
                dropped.append({'form': f, 'stems': sorted(set(low_stems + stems)), 'why': 'an ordinary word (accepted in lower case)'})
                continue
        elif ok and others:
            dropped.append({'form': f, 'stems': sorted(set(stems)), 'why': 'a form of another word'})
            continue
        kept.append(f)
        if ok and others:
            homographs.append({'form': f, 'stems': sorted(set(stems))})
        elif ok:
            confirmed.append(f)
    return {'forms': kept, 'dictionaryConfirms': confirmed, 'homographs': homographs, 'dropped': dropped}


def forms(items_path, out_path):
    import declension
    data = json.load(open(items_path, encoding='utf8'))
    out = {'tool': 'Hunspell 1.7.2 library, stem() and spell() (hstem.cpp), LibreOffice dictionaries at commit c0865a85',
           'paradigms': 'scripts/language/check/declension.py (singular, by the word\'s ending; written by hand, not fetched)',
           'rule': judge_forms.__doc__.split('\n')[0] + ' ' + ' '.join(l.strip() for l in judge_forms.__doc__.split('\n')[1:]),
           'use': 'build_card_text.py writes the forms that stand into the card text (pack.forms); src/lib/verse/echo.ts counts a '
                  'verse word as a name when it is the name or one of them',
           'languages': {}}
    for lang in DECLINING:
        toks = data['nameTokens'][lang]
        made = {t['word']: declension.forms(lang, t['word'], t['english']) for t in toks}
        asked = {f for fs in made.values() for f in fs} | set(made)
        if lang in ('ru', 'pl'):
            asked |= {f.lower() for f in asked}
        st = hunspell_stems(lang, sorted(asked))
        own = lambda w: st.get(w, (False, []))[1] if lang == 'ar' else []
        rec = {w: judge_forms(lang, w, fs, st, own(w)) for w, fs in sorted(made.items())}
        out['languages'][lang] = rec
        n = sum(len(v['forms']) for v in rec.values())
        d = [x['form'] for v in rec.values() for x in v['dropped']]
        print(f'forms {lang}: {len(toks)} words, {n} forms kept, {len(d)} dropped: {" ".join(d)}', file=sys.stderr)
    json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


def selftest():
    """Each check must flag a known-bad input; a check that cannot fail is not a check."""
    ok = True
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import declension
    d_ok = declension.selftest()
    print('declension paradigms', 'ok' if d_ok else 'WRONG'); ok &= d_ok
    if os.environ.get('HSTEM') and os.path.exists(os.environ['HSTEM']):
        # A Banquo that declined would be "banks"; a Juliet that declines is still Juliet.
        # «Марка» is also "a stamp" (марка), a word that begins with the name: still another word.
        cands = ['Банки', 'Банку', 'Марка', 'Джульетты', 'Джульетту']
        st = hunspell_stems('ru', cands + [c.lower() for c in cands])
        got = (judge_forms('ru', 'Банко', cands[:2], st)['dropped'] + judge_forms('ru', 'Марк', cands[2:3], st)['dropped']
               + judge_forms('ru', 'Джульетта', cands[3:], st)['dropped'])
        print('forms ru drops', [x['form'] for x in got]); ok &= [x['form'] for x in got] == ['Банки', 'Банку', 'Марка']
        # The adjective of a name is the name's own (Achillesowi); bark is not Persephone's.
        cands = ['Kora', 'Kory', 'Julię', 'Achillesowi']
        st = hunspell_stems('pl', cands + [c.lower() for c in cands])
        got = (judge_forms('pl', 'Kore', cands[:2], st)['dropped'] + judge_forms('pl', 'Julia', cands[2:3], st)['dropped']
               + judge_forms('pl', 'Achilles', cands[3:], st)['dropped'])
        print('forms pl drops', [x['form'] for x in got]); ok &= [x['form'] for x in got] == ['Kora', 'Kory']
        # Arabic: «كبو» ("stumbling") is a word; the prefix on Romeo adds nothing to what the dictionary makes of the name.
        cands = ['كبو', 'وروميو']
        st = hunspell_stems('ar', cands + ['بو', 'روميو'])
        got = judge_forms('ar', 'بو', cands[:1], st, st['بو'][1])['dropped'] + judge_forms('ar', 'روميو', cands[1:], st, st['روميو'][1])['dropped']
        print('forms ar drops', [x['form'] for x in got]); ok &= [x['form'] for x in got] == ['كبو']
    bad = hunspell_unknown('fr', ['château', 'chatteau', 'lumière', 'lumiaire'])
    print('spell fr flags', sorted(bad)); ok &= bad == {'chatteau', 'lumiaire'}
    bad = elided_unknown('it', hunspell_unknown('it', ['dell’alba', 'dell’allba', 'un’isola']))
    print('spell it (elisions) flags', sorted(bad)); ok &= bad == {'dell’allba'}
    bad = hunspell_unknown('ru', ['замок', 'заммок'])
    print('spell ru flags', sorted(bad)); ok &= bad == {'заммок'}
    bad = hunspell_unknown('th', ['ปราสาท', 'ปราสาาท'])
    print('spell th flags', sorted(bad)); ok &= bad == {'ปราสาาท'}
    # In a sentence: the misspelt word is still found after the joins are tried; the name's pieces are not counted.
    # Name words: a title is an ordinary word, a name is not.
    got = accepted_name_words('ru', ['граф', 'Персефона']) + accepted_name_words('vi', ['Phu', 'Capulet']) + accepted_name_words('de', ['Graf', 'Xyzzyburg'])
    print('names: ordinary words', got); ok &= got == ['граф', 'Phu', 'Graf']
    items = [{'id': 'x', 'field': 'scene', 'words': ['ปราสาาท', 'ของ', 'แฮม', 'เล็ต']}]
    got = thai_unknown(items, ['แฮมเล็ต'], hunspell_unknown('th', items[0]['words']))
    print('spell th in a sentence flags', got); ok &= got == {'x|scene': {'ปราสาาท'}}
    if os.environ.get('LT_URL'):
        ms = lt_check('fr', 'Les chat mange la souris.')
        print('grammar fr flags', [m['rule']['id'] for m in ms]); ok &= bool(ms)
        # ("Der Katze schläft." was tried first and not flagged: "der Katze" is a correct dative or genitive.)
        ms = lt_check('de', 'Er kauft einen schönen Auto.')
        print('grammar de flags (gender)', [m['rule']['id'] for m in ms]); ok &= bool(ms)
        ms = lt_check('es', 'La casa es es muy grande.')
        print('grammar es flags (repeated word)', [m['rule']['id'] for m in ms]); ok &= bool(ms)
        ms = lt_check('fr', 'Le chat mange la souris.')
        print('grammar fr clean sentence', [m['rule']['id'] for m in ms]); ok &= not ms
    if os.environ.get('MADLAD_DIR') and os.environ.get('BT_SCRIPT'):
        # A faithful French line and the same line put against an unrelated English one: the rule must pass
        # the first and flag the second.
        r = run_pairs([{'id': 'good', 'lang': 'fr', 'text': 'Le château sort de l’ombre.', 'english': 'The castle emerges from shadow.'},
                       {'id': 'swapped', 'lang': 'fr', 'text': 'Le château sort de l’ombre.', 'english': 'A golden chariot races across the dawn sky.'},
                       {'id': 'wrong word', 'lang': 'de', 'text': 'Ein Hund schläft unter dem Tisch.', 'english': 'A rose blooms in the moonlit garden.'}], 'selftest')
        for x in r:
            print('meaning', x['id'], repr(x['back']), 'cos', x['cos'], 'LaBSE', x.get('xcos'), 'flagged', doubt(x['cos'], x.get('xcos')))
        ok &= not doubt(r[0]['cos'], r[0].get('xcos')) and doubt(r[1]['cos'], r[1].get('xcos')) and doubt(r[2]['cos'], r[2].get('xcos'))
    print('SELFTEST', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    cmd = sys.argv[1]
    {'spell': lambda: spell(*sys.argv[2:4]), 'grammar': lambda: grammar(*sys.argv[2:4]), 'meaning': lambda: meaning(*sys.argv[2:4]),
     'names': lambda: names(*sys.argv[2:4]), 'forms': lambda: forms(*sys.argv[2:4]), 'selftest': selftest}[cmd]()
