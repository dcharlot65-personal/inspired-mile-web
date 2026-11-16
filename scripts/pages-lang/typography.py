#!/usr/bin/env python3
"""
French and German spacing in the page areas, by rule (no model involved).

  python3 scripts/pages-lang/typography.py [--check]

French (Imprimerie nationale; the rule lang/qa-pipeline applies to the core locale files):
a no-break space (U+00A0) before ':' and inside '« »', a narrow no-break space (U+202F)
before ';', '!' and '?'. German (Duden, Auslassungspunkte): a no-break space before an
ellipsis that stands for words left out or a sentence trailing off.

The spaces are written as \\u00a0 and \\u202f escapes, as in the core files: the characters
themselves cannot be seen in a source file. Only the string literal of each "'key': value,"
line is touched. --check changes nothing and exits 1 if a file would change.
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
NBSP, NNBSP = '\\u00a0', '\\u202f'
LINE = re.compile(r"^(\s*'[^']+':\s*)(['\"])(.*)(\2,\s*)$")


def fr(v: str) -> str:
    sub = lambda pat, rep, text: re.sub(pat, lambda m: rep(m), text)
    # an ordinary space before the mark becomes the right no-break space
    v = sub(r' :(?!//)', lambda m: NBSP + ':', v)
    v = sub(r' ([;!?])', lambda m: NNBSP + m.group(1), v)
    v = v.replace('« ', '«' + NBSP).replace(' »', NBSP + '»')
    # no space at all: add one (not after a digit before ':', a time or a ratio; not in '?!')
    v = sub(r'(?<![\s\d])(?<!\\u00a0)(?<!\\u202f):(?!//)', lambda m: NBSP + ':', v)
    v = sub(r'(?<![\s!?])(?<!\\u00a0)(?<!\\u202f)([;!?])', lambda m: NNBSP + m.group(1), v)
    v = sub(r'«(?!\\u00a0|\\u202f)', lambda m: '«' + NBSP, v)
    v = sub(r'(?<!\\u00a0)(?<!\\u202f)»', lambda m: NBSP + '»', v)
    return v


def de(v: str) -> str:
    v = v.replace(' …', NBSP + '…')
    return re.sub(r'(?<!\s)(?<!\\u00a0)(?<!\\u202f)…', lambda m: NBSP + '…', v)


def run(check: bool) -> int:
    changed = 0
    for lang, fix in (('fr', fr), ('de', de)):
        for path in sorted(glob.glob(os.path.join(ROOT, 'src/i18n/pages/*', f'{lang}.ts'))):
            lines = open(path, encoding='utf8').read().split('\n')
            out = []
            for line in lines:
                m = LINE.match(line)
                if m and not re.match(r"\s*'(variants\.(city|region)\.|card-terms\.work\.)", line):
                    line = m.group(1) + m.group(2) + fix(m.group(3)) + m.group(4)
                out.append(line)
            new = '\n'.join(out)
            if new != '\n'.join(lines):
                changed += 1
                print(('would change ' if check else 'changed ') + os.path.relpath(path, ROOT))
                if not check:
                    open(path, 'w', encoding='utf8').write(new)
    return 1 if (check and changed) else 0


if __name__ == '__main__':
    sys.exit(run('--check' in sys.argv))
