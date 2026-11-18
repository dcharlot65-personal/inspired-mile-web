// The engine against espeak-ng on common words (src/lib/verse/sound/crosscheck.ts).
//
//   node --import ./scripts/sound/ts-resolve.mjs scripts/sound/crosscheck.mjs [--show N] [--json] [lang ...]
//
// Prints, per language, how often the syllable count and the stressed syllable agree, and with
// --show the first N disagreements of each kind. --json prints the counts as one object (for
// PHONETICS.md). A light script: it loads one table at a time.
import { readFileSync } from 'node:fs';
import { installSound } from '../../src/lib/verse/sound/index.ts';
import { crossCheck } from '../../src/lib/verse/sound/crosscheck.ts';

const args = process.argv.slice(2);
const showAt = args.indexOf('--show');
const show = showAt >= 0 ? Number(args[showAt + 1]) : 0;
const asJson = args.includes('--json');
const langs = args.filter((a, i) => !a.startsWith('--') && (showAt < 0 || i !== showAt + 1));
const data = JSON.parse(readFileSync('src/lib/verse/sound/corpus/espeak.json', 'utf8'));
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
const all = {};
for (const [lang, { words }] of Object.entries(data.langs)) {
  if (langs.length && !langs.includes(lang)) continue;
  try {
    installSound(lang, (await import(`../../src/lib/verse/sound/data/${lang}.ts`)).default);
  } catch {
    // Polish has no table.
  }
  const r = crossCheck(lang, words);
  installSound(lang, null);
  const { syllableMisses, stressMisses, ...counts } = r;
  all[lang] = counts;
  if (asJson) continue;
  console.log(`${lang}: syllables agree ${r.syllablesAgree}/${r.words} (${pct(r.syllablesAgree, r.words)})` + (r.stressCompared + r.stressUnknown ? `, stress agrees ${r.stressAgree}/${r.stressCompared} (${pct(r.stressAgree, r.stressCompared)}), no stress known ${r.stressUnknown}` : ''));
  if (show) {
    console.log('   syllables (word engine espeak):', syllableMisses.slice(0, show).map(([w, a, b]) => `${w} ${a} ${b}`).join(' | '));
    if (stressMisses.length) console.log('   stress (word engine espeak, as from-start:from-end):', stressMisses.slice(0, show).map(([w, a, b]) => `${w} ${a} ${b}`).join(' | '));
  }
}
if (asJson) console.log(JSON.stringify(all, null, 1));
