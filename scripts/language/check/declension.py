"""The forms a character's name takes in a sentence, in the languages where names change: Russian, Polish, German, Arabic.

src/lib/verse/echo.ts counts a verse word as a name only when it is the name, or one of the forms listed for it here
(after check.py forms has put each to Hunspell and dropped the ones that are ordinary words). Before, a name was matched
by its stem plus any case ending, and common words came in: Russian «Банки» ("banks") for «Банко», «Дитя» ("child") for
«Дит», Polish «Kora» ("bark") for «Kore», Arabic «بانكوك» (Bangkok) for «بانكو» (second check, 2026-11-17).

Each function gives the SINGULAR forms of one word, in the cases that word's declension has, by the word's ending. These
are the standard school paradigms, written out here by hand; no file was fetched for them, and a form they miss is a
miss, never an accident (an irregular stem such as Polish «Apollina» for Apollo is not made). A name keeps its capital.

  Russian: a name in -о, -е, -и, -у, -ю, -э or -ы does not decline (Ромео, Банко, Меркуцио, Монтекки). Otherwise:
           -а: -ы (-и after г к х ж ш ч щ), -е, -у, -ой, -ою (-ей, -ею after ж ш ч щ ц, unstressed);
           -я: -и, -е, -ю, -ей, -ею; -ия: -ии, -ию, -ией, -иею;
           -ий: -ия, -ию, -ием, -ии; -й: -я, -ю, -ем, -е;
           -ь: -я, -ю, -ем, -е (masculine) and -и, -ью (feminine), both;
           a consonant: -а, -у, -е, -ом (and -ем after ж ш ч щ ц).
  Polish:  a consonant, or a foreign masculine name in -o (Banko, Prospero, Merkucjo, Romeo): -a, -owi, -em (-iem after k
           and g), and the locative: -e with the consonant softened (t: -cie, d: -dzie, r: -rze, n: -nie, s: -sie, z: -zie,
           ł: -le, m: -mie, w: -wie, p: -pie, b: -bie, f: -fie; st: -ście, sł: -śle, zd: -ździe), else -u. The e of -ek and
           -ec drops (Marek, Marka). An English name in a silent -e takes the endings after an apostrophe (Blake'a).
           -a: -y (-i after k, g, l, j), -ę, -ą, -o, and the dative and locative softened as above (k: -ce, g: -dze,
           ch: -sze), or -y/-i where nothing softens; -ia: -ii, -ię, -ią, -io; -ja: -i, -ję, -ją, -jo.
           -y (a Polish name such as Horacy): -ego, -emu, -ym. Any other ending, and an English name in -y or a vowel, does
           not decline (Kore, Mary, Monteki).
  German:  the genitive -s, except after s, ß, x and z (Brutus' is the name and an apostrophe, which the engine drops).
  Arabic:  a name does not change; what attaches to it is the conjunctions و and ف and the prepositions ب, ك and ل,
           as Snowball's Arabic stemmer strips them from a noun (its prefix steps 2 and 3b; ل, which it strips only as
           لل, is added here), and a conjunction before a preposition (وبروميو). ل before the article is written لل.
"""

RU_VEL, RU_SIB = 'гкх', 'жшчщ'


def ru_forms(w):
    lw = w.lower().replace('ё', 'е')
    if len(lw) < 3 or lw[-1] in 'оеэиыую':
        return []
    last, pre = lw[-1], lw[-2]
    if lw.endswith('ия'):
        b = w[:-1]
        return [b + 'и', b + 'ю', b + 'ей', b + 'ею']
    if last == 'я':
        b = w[:-1]
        return [b + 'и', b + 'е', b + 'ю', b + 'ей', b + 'ею']
    if last == 'а':
        b = w[:-1]
        out = [b + ('и' if pre in RU_VEL + RU_SIB else 'ы'), b + 'е', b + 'у', b + 'ой', b + 'ою']
        if pre in RU_SIB + 'ц':
            out += [b + 'ей', b + 'ею']
        return out
    if lw.endswith('ий'):
        b = w[:-1]
        return [b + 'я', b + 'ю', b + 'ем', b + 'и']
    if last == 'й':
        b = w[:-1]
        return [b + 'я', b + 'ю', b + 'ем', b + 'е']
    if last == 'ь':
        b = w[:-1]
        return [b + 'я', b + 'ю', b + 'ем', b + 'е', b + 'и', b + 'ью']
    if not last.isalpha():
        return []
    out = [w + 'а', w + 'у', w + 'е', w + 'ом']
    if last in RU_SIB + 'ц':
        out.append(w + 'ем')
    return out


# Polish: the consonant (or pair) a locative -e softens, and what it becomes.
PL_SOFT = [('st', 'ście'), ('sł', 'śle'), ('zd', 'ździe'), ('t', 'cie'), ('d', 'dzie'), ('r', 'rze'), ('n', 'nie'), ('s', 'sie'),
           ('z', 'zie'), ('ł', 'le'), ('m', 'mie'), ('w', 'wie'), ('p', 'pie'), ('b', 'bie'), ('f', 'fie')]
# Feminine -a nouns also soften k, g and ch in the dative and locative (Kinga, Kindze).
PL_SOFT_FEM = [('k', 'ce'), ('g', 'dze'), ('ch', 'sze')] + PL_SOFT


PL_VOWELS = 'aeiouyąęó'
# Consonants a following e or i does not soften further (they are soft already, or a digraph ending in z).
PL_HARD_TO_SOFTEN = ('rz', 'cz', 'sz', 'dz', 'dż', 'dź')


def _soft(base, table):
    lb = base.lower()
    if lb.endswith(PL_HARD_TO_SOFTEN) or lb[-1] in 'żźćśńjlc' + PL_VOWELS:
        return None
    for tail, rep in table:
        if lb.endswith(tail):
            return base[:len(base) - len(tail)] + rep
    return None


def pl_forms(w, english=False):
    """`english`: the word is also a word of the card's English name (Blake, Mary, Romeo)."""
    lw = w.lower()
    if len(lw) < 3:
        return []
    last = lw[-1]
    if english and last == 'e' and lw[-2] not in PL_VOWELS:
        # Blake, George, Coleridge: the e is not said, and Polish writes the endings after an apostrophe.
        return [w + "'a", w + "'owi", w + "'em", w + "'u"]
    if last == 'a':
        if lw.endswith('ia') and lw[-3] not in PL_VOWELS:
            b = w[:-1]
            return [b + 'i', b + 'ę', b + 'ą', b + 'o']
        if lw.endswith('ja'):
            b = w[:-1]
            return [w[:-2] + 'i', b + 'ę', b + 'ą', b + 'o']
        b = w[:-1]
        lb = b.lower()
        if lb[-1] in PL_VOWELS:
            return []
        gen = b + ('i' if lb[-1] in 'kglj' else 'y')
        dat = _soft(b, PL_SOFT_FEM) or gen
        return sorted({gen, dat, b + 'ę', b + 'ą', b + 'o'})
    if last == 'y' and not english:
        # Horacy: a Polish name in -y declines as an adjective does.
        b = w[:-1]
        return [b + 'ego', b + 'emu', b + 'ym']
    if last == 'o':
        base = w[:-1]  # a foreign masculine name in -o: Banko, Prospero, Merkucjo, Romeo, Benvolio
    elif last in PL_VOWELS:
        return []
    else:
        base = w
        if len(lw) > 3 and lw.endswith(('ek', 'ec')):
            base = w[:-2] + w[-1]  # Marek, Marka
    lb = base.lower()
    ins = 'iem' if lb[-1] in 'kg' else 'em'
    loc = None if lb[-1] in 'kg' or lb.endswith('ch') else _soft(base, PL_SOFT)
    return sorted({base + 'a', base + 'owi', base + ins, loc or base + 'u'})


def de_forms(w):
    if len(w) < 3 or w[-1].lower() in 'sßxz':
        return []
    return [w + 's']


AR_CONJ = ['و', 'ف']
AR_PREP = ['ب', 'ك', 'ل']


def ar_forms(w):
    if len(w) < 2:
        return []
    def prep(p):
        return 'لل' + w[2:] if p == 'ل' and w.startswith('ال') else p + w
    out = [c + w for c in AR_CONJ] + [prep(p) for p in AR_PREP]
    out += [c + prep(p) for c in AR_CONJ for p in AR_PREP]
    return out


def forms(lang, word, english=False):
    if lang == 'ru':
        return ru_forms(word)
    if lang == 'pl':
        return pl_forms(word, english)
    if lang == 'de':
        return de_forms(word)
    if lang == 'ar':
        return ar_forms(word)
    return []


def selftest():
    """The paradigms on names whose forms are known, and on the words of the second check's accidents."""
    cases = [
        ('ru', 'Джульетта', False, ['Джульетты', 'Джульетте', 'Джульетту', 'Джульеттой', 'Джульеттою']),
        ('ru', 'Офелия', False, ['Офелии', 'Офелию', 'Офелией', 'Офелиею']),
        ('ru', 'Гамлет', False, ['Гамлета', 'Гамлету', 'Гамлете', 'Гамлетом']),
        ('ru', 'Клавдий', False, ['Клавдия', 'Клавдию', 'Клавдием', 'Клавдии']),
        ('ru', 'Одиссей', False, ['Одиссея', 'Одиссею', 'Одиссеем', 'Одиссее']),
        ('ru', 'Кормилица', False, ['Кормилицы', 'Кормилице', 'Кормилицу', 'Кормилицой', 'Кормилицою', 'Кормилицей', 'Кормилицею']),
        ('ru', 'Пак', False, ['Пака', 'Паку', 'Паке', 'Паком']),
        ('ru', 'Банко', False, []), ('ru', 'Ромео', False, []), ('ru', 'Монтекки', False, []),
        ('pl', 'Julia', False, ['Julii', 'Julię', 'Julią', 'Julio']),
        ('pl', 'Hamlet', False, ['Hamleta', 'Hamlecie', 'Hamletem', 'Hamletowi']),
        ('pl', 'Marek', False, ['Marka', 'Markiem', 'Markowi', 'Marku']),
        ('pl', 'Miranda', False, ['Mirandy', 'Mirandzie', 'Mirandę', 'Mirandą', 'Mirando']),
        ('pl', 'Meduza', False, ['Meduzy', 'Meduzie', 'Meduzę', 'Meduzą', 'Meduzo']),
        ('pl', 'Banko', False, ['Banka', 'Bankiem', 'Bankowi', 'Banku']),
        ('pl', 'Horacy', False, ['Horacego', 'Horacemu', 'Horacym']),
        ('pl', 'Blake', True, ["Blake'a", "Blake'owi", "Blake'em", "Blake'u"]),
        ('pl', 'Kore', False, []), ('pl', 'Mary', True, []),
        ('de', 'Romeo', False, ['Romeos']), ('de', 'Brutus', False, []),
        ('ar', 'روميو', False, ['وروميو', 'فروميو', 'بروميو', 'كروميو', 'لروميو', 'وبروميو', 'وكروميو', 'ولروميو', 'فبروميو', 'فكروميو', 'فلروميو']),
    ]
    ok = True
    for lang, w, en, want in cases:
        got = forms(lang, w, en)
        if sorted(got) != sorted(want):
            print('declension', lang, w, 'got', got, 'want', want)
            ok = False
    # The second check's accidents are not forms of the names they landed on.
    for lang, w, bad in [('ru', 'Дит', 'Дитя'), ('ru', 'Банко', 'Банки'), ('ru', 'Афина', 'Афинах'), ('pl', 'Banko', 'Banki'),
                         ('pl', 'Atena', 'Atenach'), ('pl', 'Kore', 'Kora'), ('ar', 'أخيل', 'الأخيلة'), ('ar', 'بانكو', 'بانكوك'),
                         ('ar', 'هادس', 'هادسون'), ('ar', 'هاملت', 'هاملتن')]:
        if bad in forms(lang, w):
            print('declension', lang, w, 'makes', bad)
            ok = False
    return ok


if __name__ == '__main__':
    import sys
    sys.exit(0 if selftest() else 1)
