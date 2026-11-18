"""Builds the rhyme test sets in src/lib/verse/sound/corpus/ from published verse.

    python3 -I scripts/sound/corpus.py <folder of fetched texts> [lang ...]

Each set is one public-domain poem in a strict form, fetched from Wikisource
(the fetch tools and the page names are in docs/language/PHONETICS.md). The
form says which lines rhyme, so the labels come from the poem and not from the
engine being tested: "yes" pairs are lines the form rhymes, "no" pairs are
lines the form keeps on different rhymes. Where a form only says which lines
rhyme (couplets), the "no" pairs are neighbouring lines of different couplets,
and the ones listed in DROP below, which share a rhyme by chance, are left out.

The whole lines are kept, not just their last words: the engine finds the
rhyming word itself, as it does in a duel.
"""
import html, json, os, re, sys

SRC = sys.argv[1]
ONLY = sys.argv[2:]
OUT = 'src/lib/verse/sound/corpus'
os.makedirs(OUT, exist_ok=True)


def read(name):
    return open(os.path.join(SRC, name), encoding='utf8').read()


def meta(name):
    url, date = read(name + '.url').split('\n')[:2]
    return url, date


def clean(line):
    s = line
    s = re.sub(r'<ref[^>]*>.*?</ref>|<ref[^>]*/>', '', s)
    for _ in range(3):
        s = re.sub(r'\{\{(?:indent|Zeile|R|§|số|gap|Idt|tab)\|[^{}|]*\|([^{}]*)\}\}', r'\1', s)
        s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace("''", '')
    return re.sub(r'\s+', ' ', s).strip(' \t:*')


def has_letters(s):
    return re.search(r'[^\W\d_]', s) is not None


def verse_lines(text):
    return [l for l in (clean(x) for x in text.split('\n')) if has_letters(l)]


def write(lang, poem, yes, no, drop=()):
    no = [p for i, p in enumerate(no) if i not in drop]
    data = {'lang': lang, 'poem': poem, 'yes': yes, 'no': no}
    json.dump(data, open(f'{OUT}/{lang}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(lang, 'yes', len(yes), 'no', len(no))
    if os.environ.get('SHOW'):
        end = lambda l: re.sub(r'[\W\d_]+$', '', l).split(' ')[-1]
        print('  yes:', ' | '.join(f'{end(a)}/{end(b)}' for a, b in yes[:60]))
        print('  no :', ' | '.join(f'{i}:{end(a)}/{end(b)}' for i, (a, b) in enumerate(no)))


def pairs(lines, idx):
    return [[lines[a], lines[b]] for a, b in idx if a < len(lines) and b < len(lines)]


def stanzas_fixed(lines, size, count, yes_idx, no_idx):
    yes, no = [], []
    for s in range(count):
        st = lines[s * size:(s + 1) * size]
        if len(st) < size:
            break
        yes += pairs(st, yes_idx)
        no += pairs(st, no_idx)
    return yes, no


def couplets(lines, count):
    yes = [[lines[2 * k], lines[2 * k + 1]] for k in range(count) if 2 * k + 1 < len(lines)]
    no = [[lines[2 * k + 1], lines[2 * k + 2]] for k in range(count) if 2 * k + 2 < len(lines)]
    return yes, no


PD = 'public domain (author died more than 100 years ago); text from Wikisource, CC BY-SA 4.0 for the transcription'


def pt():
    url, date = meta('pt')
    t = read('pt.txt')
    t = t[t.index('<poem>'):] if '<poem>' in t else t
    lines = [l for l in verse_lines(t) if not re.fullmatch(r'\d+', l)]
    start = next(i for i, l in enumerate(lines) if l.startswith('As armas e os barões'))
    yes, no = stanzas_fixed(lines[start:], 8, 9, [(0, 2), (2, 4), (1, 3), (3, 5), (6, 7)], [(0, 1), (4, 5), (5, 6)])
    write('pt', {'title': 'Os Lusíadas, Canto I, estâncias 1-9', 'author': 'Luís Vaz de Camões', 'year': 1572, 'form': 'oitava rima ABABABCC', 'source': url, 'fetched': date, 'licence': PD}, yes, no)


def it():
    url, date = meta('it')
    lines = verse_lines(read('it.txt'))
    start = next(i for i, l in enumerate(lines) if l.startswith('Nel mezzo del cammin'))
    lines = lines[start:start + 91]
    yes, no = [[lines[0], lines[2]]], [[lines[0], lines[1]]]
    for k in range(1, len(lines) - 5, 3):
        yes += pairs(lines, [(k, k + 2), (k + 2, k + 4)])
        no += pairs(lines, [(k + 1, k + 2)])
    write('it', {'title': 'Divina Commedia, Inferno, Canto I, vv. 1-91', 'author': 'Dante Alighieri', 'year': 1321, 'form': 'terza rima ABA BCB CDC', 'source': url, 'fetched': date, 'licence': PD}, yes, no)


def ru():
    url, date = meta('ru')
    lines = verse_lines(read('ru.txt'))
    start = next(i for i, l in enumerate(lines) if l.startswith('Три девицы'))
    yes, no = couplets(lines[start:], 48)
    write('ru', {'title': 'Сказка о царе Салтане, первые 96 стихов', 'author': 'А. С. Пушкин', 'year': 1831, 'form': 'paired rhyme AABB', 'source': url, 'fetched': date, 'licence': PD}, yes, no, DROP.get('ru', ()))


def de():
    url, date = meta('de')
    lines = []
    for name in ('de.txt', 'de2.txt', 'de3.txt'):
        for block in re.findall(r'<poem>(.*?)</poem>', read(name), re.S):
            ls = verse_lines(block)
            lines += ls[:len(ls) // 2 * 2]
    yes, no = couplets(lines, 60)
    write('de', {'title': 'Max und Moritz, Erster, Zweiter und Dritter Streich', 'author': 'Wilhelm Busch', 'year': 1865, 'form': 'paired rhyme AABB', 'source': url, 'fetched': date, 'licence': PD}, yes, no, DROP.get('de', ()))


def zh():
    url, date = meta('zh')
    yes, no, poems = [], [], []
    n = len([f for f in os.listdir(os.path.join(SRC, 'zh')) if f.endswith('.txt')])
    for i in range(1, n + 1):
        t = read(f'zh/p{i}.txt')
        m = re.search(r'<poem>(.*?)</poem>', t, re.S)
        title = re.search(r'\|\s*title\s*=\s*(.*)', t)
        author = re.search(r'\|\s*author\s*=\s*(.*)', t)
        if not m or not title or not author:
            continue
        body = re.sub(r'<ref[^>]*>.*?</ref>|<ref[^>]*/>', '', m.group(1), flags=re.S)
        body = re.sub(r'\{\{另\|([^|{}]*)\|[^{}]*\}\}', r'\1', body)
        body = re.sub(r'\{\{[^{}]*\}\}|<[^>]+>', '', body)
        clauses = re.findall(r'[\u3400-\u9fff\U00020000-\U0002ffff]+', body)
        # A quatrain: four lines, all of five characters or all of seven.
        if len(clauses) != 4 or len(set(len(c) for c in clauses)) != 1 or len(clauses[0]) not in (5, 7):
            continue
        name = re.sub(r'\{\{另\|([^|{}]*)\|[^{}]*\}\}', r'\1', title.group(1))
        name = re.sub(r'\{\{[^{}]*\}\}', '', name).strip()
        poems.append({'title': name, 'author': author.group(1).strip(), 'source': read(f'zh/p{i}.url').split('\n')[0]})
        yes.append([clauses[1], clauses[3]])
        no.append([clauses[2], clauses[3]])
    write('zh', {'title': f'唐詩三百首：五言絕句、七言絕句（{len(poems)} 首）', 'author': '孫洙 編；唐代諸家', 'year': 1763, 'form': 'jueju: the second and fourth lines rhyme; the third never does', 'source': url, 'fetched': date, 'licence': PD, 'note': 'The rhymes are those of Tang Chinese. The engine reads modern Mandarin, so a rhyme that sound change has undone is counted here as missed, not excused.', 'poems': poems}, yes, no)


def es():
    url, date = meta('es')
    lines = [l for l in verse_lines(read('es.txt').replace('<br>', '\n'))]
    start = next(i for i, l in enumerate(lines) if l.startswith('Hombres necios'))
    yes, no = stanzas_fixed(lines[start:], 4, 17, [(0, 3), (1, 2)], [(0, 1), (2, 3)])
    url2, _ = meta('es2_r')
    song = rendered_lines('es2_r.txt')
    at = lambda text: next(l for l in song if l.startswith(text))
    # Canción del pirata: octavillas, where lines 2-3 and 6-7 rhyme and line 4 rhymes with line 8.
    for a, b in [('Viento en popa', 'No corta el mar'), ('Mi velero bergantin', 'Del uno al otro confin'), ('Por su bravura', 'En todo mar conocido'),
                 ('En la lona gime', 'Y alza en blando'), ('Olas de plata', 'Y allá á su frente'), ('Cantando alegre', 'Asia á un lado'),
                 ('Hemos hecho', 'A despecho'), ('Del inglés', 'A mis piés'), ('Sus pendones', 'Cien naciones')]:
        yes.append([at(a), re.sub(r'\[$', '', at(b))])
    for a, b in [('Con diez cañones', 'Viento en popa'), ('No corta el mar', 'Mi velero bergantin'), ('La luna en el mar', 'En la lona gime'), ('Y alza en blando', 'Olas de plata')]:
        no.append([at(a), at(b)])
    write('es', {'title': 'Redondillas («Hombres necios que acusáis»); Canción del pirata, tres estrofas', 'author': 'Sor Juana Inés de la Cruz; José de Espronceda', 'year': 1689, 'form': 'redondillas ABBA; octavillas (lines 2-3 and 6-7 rhyme, line 4 with line 8)', 'source': url, 'fetched': date, 'licence': PD, 'poems': [{'title': 'Redondillas', 'author': 'Sor Juana Inés de la Cruz', 'source': url}, {'title': 'Canción del pirata', 'author': 'José de Espronceda', 'source': url2}]}, yes, no)


def hi():
    url, date = meta('hi_k')
    lines = rendered_lines('hi_k.txt') + ['—'] + rendered_lines('hi_k2.txt')
    yes, no, prev2 = [], [], None
    for a, b in zip(lines, lines[1:]):
        if len(yes) >= 48:
            break
        # A sakhi: two lines, the second closed by its number between double bars.
        if re.search(r'॥\s*[०-९]+\s*॥\s*$', b) and re.search(r'[।॥]\s*$', a) and not re.search(r'[—=]', a + b):
            l1 = re.sub(r'[।॥\s]+$', '', a)
            l2 = re.sub(r'॥\s*[०-९]+\s*॥\s*$', '', b).rstrip('।॥ ')
            yes.append([l1, l2])
            if prev2:
                no.append([prev2, l1])
            prev2 = l2
    write('hi', {'title': 'कबीर ग्रंथावली, साखी: (१) गुरुदेव कौ अंग, (२) सुमिरन कौ अंग (first 48 sakhis)', 'author': 'कबीर', 'year': 1500, 'form': 'sakhi (doha): the two lines of each couplet rhyme', 'source': url, 'fetched': date, 'licence': PD, 'note': 'Kabir wrote in the old mixed Hindi of the sants, not today\'s standard Hindi; the script and its rhyme are the same.'}, yes, no, DROP.get('hi', ()))


def idn():
    url, date = meta('id')
    t = read('id.txt')
    lines = []
    for block in re.findall(r'<poem>(.*?)</poem>', t, re.S):
        ls = verse_lines(block)
        lines += ls[:len(ls) // 2 * 2]
    yes, no = couplets(lines, 46)
    write('id', {'title': 'Gurindam Dua Belas', 'author': 'Raja Ali Haji', 'year': 1847, 'form': 'gurindam: rhymed couplets', 'source': url, 'fetched': date, 'licence': PD}, yes, no, DROP.get('id', ()))


def vi():
    url, date = meta('vi')
    t = read('vi.txt')
    t = t[t.index('<poem>'):]
    lines = verse_lines(t)[:120]
    yes, no = [], []
    for k in range(0, len(lines) - 2, 2):
        six, eight, nxt = lines[k], lines[k + 1], lines[k + 2]
        words = re.findall(r'[^\W\d_]+', eight)
        if len(words) != 8 or len(re.findall(r'[^\W\d_]+', six)) != 6:
            continue
        if len(yes) < 60:
            yes.append([eight, nxt])
            yes.append([six, ' '.join(words[:6])])
        no.append([six, eight])
    write('vi', {'title': 'Truyện Kiều, câu 1-120', 'author': 'Nguyễn Du', 'year': 1820, 'form': 'lục bát: the sixth syllable of the eight rhymes with the end of the six before it; the end of the eight with the end of the six after it', 'source': url, 'fetched': date, 'licence': PD}, yes[:60], no[:30])


def th():
    url, date = meta('th')
    wak = []
    for line in read('th.txt').split('\n'):
        m = re.search(r'\{\{กาพย์กลอน/บาท[^|}]*\|([^|}]*)\|([^|}]*)\}\}', line)
        cells = list(m.groups()) if m else (line.split('||')[-2:] if line.startswith('|') and '||' in line else [])
        for w in cells:
            w = re.sub(r'[๏๚ฯ]|&nbsp;', '', w).strip(' |')
            if re.search(r'[ก-ฮ]', w):
                wak.append(w)
    # The poem opens on a "rap" wak; from there the four wak of a stanza run rap, rong, song, sadap.
    yes, no = [], []
    for k in range(0, len(wak) - 4, 4):
        yes += [[wak[k], wak[k + 1]], [wak[k + 2], wak[k + 4]]]
        no += [[wak[k + 1], wak[k + 2]], [wak[k + 3], wak[k + 4]]]
    write('th', {'title': 'นิราศภูเขาทอง (first 60 and 40 pairs)', 'author': 'สุนทรภู่', 'year': 1830, 'form': 'กลอนนิราศ: the end of the second wak rhymes with the end of the third, the end of the fourth with the end of the next second', 'source': url, 'fetched': date, 'licence': PD}, yes[:60], no[:40])


def ar():
    url, date = meta('ar')
    bayts = [l.split('\\\\') for l in read('ar.txt').split('\n') if '\\\\' in l]
    # A vowel mark left standing alone after a space belongs to the word before it.
    fix = lambda x: re.sub(r'\s+([\u064b-\u0652])', r'\1', clean(x))
    bayts = [[fix(a), fix(b)] for a, b in (x[:2] for x in bayts if len(x) >= 2)]
    yes = [[bayts[k][1], bayts[k + 1][1]] for k in range(0, 50) if k + 1 < len(bayts)]
    no = [[b[0], b[1]] for b in bayts[1:41]]
    write('ar', {'title': 'معلقة امرئ القيس', 'author': 'امرؤ القيس', 'year': 540, 'form': 'qasida: every line closes on the same rhyme (lam); the first half of a line does not, after the opening line', 'source': url, 'fetched': date, 'licence': PD}, yes, no, DROP.get('ar', ()))


def rendered_lines(name):
    t = read(name)
    t = re.sub(r'<sup[^>]*>.*?</sup>', '', t, flags=re.S)
    t = re.sub(r'<(br|/p|/div|/dd|/li|/span)[^>]*>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', '', t))
    out = []
    for l in t.split('\n'):
        l = re.sub(r'\s+', ' ', l).strip()
        if not has_letters(l) or len(l) <= 3:
            continue  # a blank, a page number, or the stray letters of a drop capital
        if l.startswith(':') and out:
            out[-1] += ' ' + l.lstrip(': ')  # a line the edition breaks in two
        else:
            out.append(l)
    return out


def fr():
    url, date = meta('fr_r')
    lines = rendered_lines('fr_r.txt')
    start = next(i for i, l in enumerate(lines) if l.startswith('C’est en vain qu’au Parnasse'))
    lines = [re.sub(r'^Em(?=[A-ZÀ-Ý])', '', l) for l in lines[start:]]
    yes, no = couplets(lines, 50)
    write('fr', {'title': 'L’Art poétique, Chant I, vers 1-100', 'author': 'Nicolas Boileau', 'year': 1674, 'form': 'alexandrines in rhymed couplets AABB', 'source': url, 'fetched': date, 'licence': PD}, yes, no, DROP.get('fr', ()))


def pl():
    url, date = meta('pl_r')
    lines = rendered_lines('pl_r.txt')
    start = next(i for i, l in enumerate(lines) if l.startswith('Litwo! Ojczyzno moja'))
    yes, no = couplets(lines[start:], 50)
    write('pl', {'title': 'Pan Tadeusz, Księga pierwsza, w. 1-100', 'author': 'Adam Mickiewicz', 'year': 1834, 'form': 'thirteen-syllable lines in rhymed couplets AABB', 'source': url, 'fetched': date, 'licence': PD}, yes, no, DROP.get('pl', ()))


# "No" pairs that share a rhyme by chance, by their index in the list printed with SHOW=1.
DROP = {'id': (28, 29, 39), 'ar': (17, 19), 'hi': (1, 28)}

JOBS = {'es': es, 'fr': fr, 'pl': pl, 'zh': zh, 'hi': hi, 'pt': pt, 'it': it, 'ru': ru, 'de': de, 'id': idn, 'vi': vi, 'th': th, 'ar': ar}
for name, job in JOBS.items():
    if ONLY and name not in ONLY:
        continue
    try:
        job()
    except Exception as e:  # a text that is not there yet
        print(name, 'FAILED', repr(e)[:120])
