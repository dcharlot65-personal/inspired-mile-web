// The words of the play content in one language, one per line, for Hunspell asked about whole words
// (the shared pipeline's hspell: the hunspell command cuts Thai and Devanagari words apart at their vowel
// signs, which is why an earlier run here called those dictionaries unusable).
//   node scripts/lang-content/qa/words.mjs <lang> [planted word]  > words.txt
// Words are cut with Intl.Segmenter (ICU's dictionary for Thai, which writes no spaces). Left out: words in
// Latin letters (Shakespeare's lines and names no source gives in the script), numbers, {placeholders}.
// A planted word, if given, is added once: a spelling run that does not reject it proves nothing.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent("export async function resolve(s, c, n) { if (/^\\.\\.?\\//.test(s) && !/\\.\\w+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} } return n(s, c); }"));
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';
const [lang, planted] = process.argv.slice(2);
const words = new Map();
const seg = new Intl.Segmenter(lang, { granularity: 'word' });
for (const area of ['playground', 'story', 'trivia', 'challenges']) {
  const m = (await import(join(ROOT, 'src/i18n/pages', area, `${lang}.ts`))).default;
  for (const [key, v] of Object.entries(m)) {
    if (key === 'challenges.ids') continue;
    const text = v.replace(/[\u2066-\u2069]/gu, '').replace(/\{\w+\}/g, ' ');
    for (const s of seg.segment(text)) {
      if (!s.isWordLike || /\p{Script=Latin}|\p{N}/u.test(s.segment)) continue;
      if (!words.has(s.segment)) words.set(s.segment, key);
    }
  }
}
if (planted) words.set(planted, 'planted');
for (const [w, key] of words) console.log(`${w}\t${key}`);
