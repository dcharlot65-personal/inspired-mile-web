#!/usr/bin/env python3
"""
Read a back-translation result (backtranslate.py --out): how far each back-translation is from
its English, against the control (the same back-translation scored against another string's
English). A check whose right and wrong pairs score alike proves nothing, so the control comes
first.

  python3 -I scripts/pages-lang/bt-report.py bt.json [--below 0.75]

It decides nothing. The lowest scores are listed to be read, with the string, its English and
what the model made of it.
"""
import json, statistics, sys

args = sys.argv[1:]
below = float(args[args.index('--below') + 1]) if '--below' in args else 0.75
rows = json.load(open(args[0], encoding='utf8'))
rows = [r for r in rows if 'cos' in r]
right = [r['cos'] for r in rows]
wrong = [r['controlCos'] for r in rows]
print(f'{len(rows)} pairs scored')
print(f'against its own English: median {statistics.median(right):.3f}, lowest {min(right):.3f}')
print(f'against another string:  median {statistics.median(wrong):.3f}, highest {max(wrong):.3f}')
beaten = sum(1 for r in rows if r['cos'] <= r['controlCos'])
print(f'pairs whose own English does not score above the control: {beaten}')
by = {}
for r in rows:
    by.setdefault(r['lang'], []).append(r['cos'])
print('per language, median (lowest):', ', '.join(f"{l} {statistics.median(v):.2f} ({min(v):.2f})" for l, v in sorted(by.items())))
low = sorted((r for r in rows if r['cos'] < below or r['cos'] <= r['controlCos']), key=lambda r: r['cos'])
print(f'\n{len(low)} to read (score below {below}, or not above the control):')
for r in low:
    print(f"\n{r['lang']} {r['id']}  {r['cos']:.3f} (control {r['controlCos']:.3f})\n  text:    {r['text']}\n  English: {r['english']}\n  back:    {r['back']}")
