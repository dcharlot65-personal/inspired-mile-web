#!/usr/bin/env python3
"""Check the card text that was written for the game, with tools that did not write it.

  check.py spell   ITEMS OUT      Hunspell, with LibreOffice's dictionaries, word by word
  check.py grammar ITEMS OUT      LanguageTool (a local server at $LT_URL), item by item
  check.py meaning ITEMS OUT      MADLAD-400 translates each item back to English; the result is
                                  scored against the English source (MiniLM cosine and chrF)
  check.py selftest               each check is fed a known-bad input and must flag it

ITEMS is the output of collect.mjs. Nothing here changes any text: it writes findings, and a person
(or the engineer) decides what to change. Environment: HUNSPELL, DICT_DIR, LT_URL, MADLAD_DIR, MINILM_DIR.
"""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request

HUNSPELL_DICT = {'es': 'es', 'fr': 'fr', 'de': 'de', 'it': 'it', 'pt': 'pt-BR', 'pl': 'pl', 'ru': 'ru', 'ar': 'ar', 'hi': 'hi',
                 'ko': 'ko', 'vi': 'vi', 'th': 'th', 'id': 'id'}  # no Hunspell dictionary for zh or ja
LT_LANG = {'es': 'es', 'fr': 'fr', 'de': 'de-DE', 'it': 'it', 'pt': 'pt-BR', 'pl': 'pl-PL', 'ru': 'ru-RU', 'ar': 'ar', 'zh': 'zh-CN'}
LATIN = set('es fr de it pt pl vi id'.split())


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


def spell(items_path, out_path):
    data = json.load(open(items_path, encoding='utf8'))
    out = {'tool': 'Hunspell 1.7.2 library, whole-word queries (hspell.cpp), LibreOffice dictionaries at commit c0865a85', 'languages': {}}
    for lang in HUNSPELL_DICT:
        items = [i for i in data['items'] if i['lang'] == lang]
        names = set(data['names'][lang])
        # Proper nouns kept in Latin letters inside another script (the rule for names with no source) are not this language's words.
        cand = sorted(set(w for i in items for w in i['words'] if w.lower() not in names and not (lang not in LATIN and latin_word(w)) and not re.search(r'\d', w)))
        bad = hunspell_unknown(lang, cand)
        flagged = []
        for i in items:
            unk = sorted(set(w for w in i['words'] if w in bad))
            if unk:
                flagged.append({'id': i['id'], 'field': i['field'], 'unknown': unk, 'text': i['text']})
        out['languages'][lang] = {'items': len(items), 'words checked': len(cand), 'unknown words': len(bad), 'flagged': flagged}
        print(f'spell {lang}: {len(items)} items, {len(cand)} distinct words, {len(bad)} unknown', file=sys.stderr)
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
        out['languages'][lang] = {'items': len(items), 'flagged': flagged}
        print(f'grammar {lang}: {len(items)} items, {len(flagged)} with a finding', file=sys.stderr)
    json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


class BackTranslator:
    def __init__(self):
        import ctranslate2
        from transformers import AutoTokenizer
        from sentence_transformers import SentenceTransformer
        from sacrebleu.metrics import CHRF
        self.tok = AutoTokenizer.from_pretrained(os.environ['MADLAD_DIR'])
        self.tr = ctranslate2.Translator(os.environ['MADLAD_DIR'], device='cpu', compute_type='int8', inter_threads=1, intra_threads=int(os.environ.get('BT_THREADS', '6')))
        self.emb = SentenceTransformer(os.environ['MINILM_DIR'], device='cpu')
        self.chrf = CHRF()

    def back(self, texts):
        out = []
        for k in range(0, len(texts), 16):
            src = [self.tok.convert_ids_to_tokens(self.tok.encode('<2en> ' + t)) for t in texts[k:k + 16]]
            for r in self.tr.translate_batch(src, beam_size=int(os.environ.get('BT_BEAM', '3')), max_decoding_length=256, repetition_penalty=1.1):
                out.append(self.tok.decode(self.tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True).strip())
        return out

    def cos(self, a, b):
        x = self.emb.encode(a, normalize_embeddings=True, batch_size=64)
        y = self.emb.encode(b, normalize_embeddings=True, batch_size=64)
        return [round(float(v), 4) for v in (x * y).sum(axis=1)]


def meaning(items_path, out_path):
    data = json.load(open(items_path, encoding='utf8'))
    bt = BackTranslator()
    out = {'tool': 'MADLAD-400 3B (google/madlad400-3b-mt, CTranslate2 int8) back to English; all-MiniLM-L6-v2 cosine and chrF against the English source',
           'control': 'each back-translation is also scored against the English of the next item of the same kind; a check that cannot tell those apart proves nothing',
           'languages': {}}
    if os.path.exists(out_path):
        out = json.load(open(out_path, encoding='utf8'))  # resume
    t0 = time.time()
    # BT_LANGS and BT_FIELDS narrow the run: on a loaded host MADLAD 3B on the CPU takes about 13 s an item.
    langs = [l for l in os.environ.get('BT_LANGS', '').split(',') if l] or sorted(set(i['lang'] for i in data['items']))
    fields = [f for f in os.environ.get('BT_FIELDS', '').split(',') if f] or ['scene', 'quote', 'name']
    out['scope'] = {'languages': langs, 'fields': fields, 'beam': int(os.environ.get('BT_BEAM', '3'))}
    for lang in langs:
        if lang in out['languages']:
            continue
        items = [i for i in data['items'] if i['lang'] == lang and i['field'] in fields]
        backs = bt.back([i['text'] for i in items])
        right = bt.cos(backs, [i['english'] for i in items])
        nxt = [items[(k + 1) % len(items)]['english'] for k in range(len(items))]
        wrong = bt.cos(backs, nxt)
        rows = []
        for i, b, c, w in zip(items, backs, right, wrong):
            rows.append({'id': i['id'], 'field': i['field'], 'text': i['text'], 'english': i['english'], 'back': b, 'cos': c, 'control': w,
                         'chrf': round(bt.chrf.sentence_score(b, [i['english']]).score, 1)})
        out['languages'][lang] = rows
        json.dump(out, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        print(f'meaning {lang}: {len(rows)} items, {time.time() - t0:.0f}s', file=sys.stderr, flush=True)


def selftest():
    """Each check must flag a known-bad input; a check that cannot fail is not a check."""
    ok = True
    bad = hunspell_unknown('fr', ['château', 'chatteau', 'lumière', 'lumiaire'])
    print('spell fr flags', sorted(bad)); ok &= bad == {'chatteau', 'lumiaire'}
    bad = hunspell_unknown('ru', ['замок', 'заммок'])
    print('spell ru flags', sorted(bad)); ok &= bad == {'заммок'}
    bad = hunspell_unknown('th', ['ปราสาท', 'ปราสาาท'])
    print('spell th flags', sorted(bad)); ok &= bad == {'ปราสาาท'}
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
    if os.environ.get('MADLAD_DIR'):
        bt = BackTranslator()
        b = bt.back(['Le château sort de l’ombre.'])
        good, wrong = bt.cos(b, ['The castle emerges from shadow.']), bt.cos(b, ['A golden chariot races across the dawn sky.'])
        print('meaning', b, good, wrong); ok &= good[0] > 0.7 and wrong[0] < 0.3
    print('SELFTEST', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    cmd = sys.argv[1]
    {'spell': lambda: spell(*sys.argv[2:4]), 'grammar': lambda: grammar(*sys.argv[2:4]), 'meaning': lambda: meaning(*sys.argv[2:4]), 'selftest': selftest}[cmd]()
