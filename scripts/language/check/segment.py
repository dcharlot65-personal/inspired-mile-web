#!/usr/bin/env python3
"""Read the Korean and Thai lines with analysers made for those languages, for the signature's telling words.

  segment.py OUT        (from the repository root, with a Python that has kiwipiepy and pythainlp)

The engine reads words with Intl.Segmenter (ICU), and that left two kinds of fragment among a line's telling words,
which the third check (2026-11-17) found landing the signature in pairs:
  - Korean: ICU splits at spaces, so a word is an eojeol, and 있어요 ("there is", the verb 있다 with its ending) or
    것이지요 ("it is the thing", a bound noun with the copula) counted as words of the line. Kiwi (kiwipiepy, a Korean
    morphological analyser) gives each eojeol's first morpheme and its part of speech (Sejong tag set). An eojeol is
    a function word when that morpheme is a pronoun (NP), an auxiliary predicate (VX: 않은, 볼까요, 주세요), the copula
    (VCP, VCN), a determiner or numeral determiner (MM: 그, 모든, 두) or a conjunctive adverb (MAJ: 그러나); or a bound
    noun (NNB: 것, 적) that does not follow a number, where it is a unit (다섯 길, "five fathoms"; 사십 분, "forty
    minutes"); or a verb or adjective whose dictionary form (the morpheme and 다) is on the language's stop list (있다,
    in 있어요). An interjection is not one: 만세 is "hail", 가만 Romeo's "soft".
  - Thai: ICU cut โรสแมรี ("rosemary") into โรส ("rose") and แมรี ("Mary"). PyThaiNLP's newmm tokenizer, with its own
    dictionary and the game's Thai names added (so ยอริก and โฮราชิโอ stay whole), gives the line's words.

Writes OUT (docs/language/checks/line-segments.json): per card, each Korean eojeol with its first morpheme, tag and
verdict, and each Thai line's words. build_card_text.py adds the Korean function words to the stop list and the
Thai words of more than one ICU piece to `compounds`, which echo.ts reads as one word (as it reads Vietnamese ones).
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
KO_FUNCTION_TAGS = {'NP', 'VX', 'VCP', 'VCN', 'MM', 'MAJ'}
KO_NUMBER_TAGS = {'NR', 'SN', 'MM'}


def pack(lang):
    s = open(os.path.join(ROOT, f'src/lib/cards-i18n/{lang}.ts'), encoding='utf8').read()
    return json.loads(s[s.index('= {') + 2:s.rindex('};') + 1])


def korean(p, kiwi):
    stop = set(p['stop'])
    out = {}
    for cid, e in sorted(p['cards'].items()):
        line = e.get('echo') or e.get('quote')
        if not line:
            continue
        toks = kiwi.tokenize(line)
        rows = []
        prev = None
        for m in re.finditer(r'\S+', line):
            word = re.sub(r'^[^\w]+|[^\w]+$', '', m.group(0))
            first = next((t for t in toks if m.start() <= t.start < m.end() and not t.tag.startswith('S')), None)
            if not word or first is None:
                prev = None
                continue
            after_number = prev is not None and prev.tag in KO_NUMBER_TAGS
            fn = (first.tag in KO_FUNCTION_TAGS or (first.tag == 'NNB' and not after_number)
                  or (first.tag in ('VV', 'VA') and first.form + '다' in stop))
            rows.append({'word': word, 'head': first.form, 'tag': first.tag, 'function': fn})
            prev = first
        out[cid] = rows
    return out


def thai(p):
    from pythainlp.tokenize import word_tokenize
    from pythainlp.corpus.common import thai_words
    from pythainlp.util import dict_trie
    names = set()
    for e in p['cards'].values():
        for t in [e.get('name')] + e.get('aliases', []):
            if t:
                names.update(w for w in re.split(r'\s+', t) if w)
    trie = dict_trie(set(thai_words()) | names)
    out = {}
    for cid, e in sorted(p['cards'].items()):
        line = e.get('quote')
        if line:
            out[cid] = [w for w in word_tokenize(line, custom_dict=trie, engine='newmm', keep_whitespace=False) if re.search(r'[ก-ฮ]', w)]
    return out


def main():
    import kiwipiepy, pythainlp
    from kiwipiepy import Kiwi
    res = {'tools': {'kiwipiepy': kiwipiepy.__version__, 'pythainlp': pythainlp.__version__, 'thai engine': 'newmm, PyThaiNLP\'s '
                     'thai_words() dictionary and the Thai card names'},
           'koFunctionTags': sorted(KO_FUNCTION_TAGS), 'koNumberTags': sorted(KO_NUMBER_TAGS), 'ko': korean(pack('ko'), Kiwi()), 'th': thai(pack('th'))}
    with open(sys.argv[1], 'w', encoding='utf8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    fn = sorted({r['word'] for rows in res['ko'].values() for r in rows if r['function']})
    print(f'ko: {len(fn)} function words in the lines: {" ".join(fn)}')
    print(f'th: {sum(len(v) for v in res["th"].values())} words in {len(res["th"])} lines')


if __name__ == '__main__':
    main()
