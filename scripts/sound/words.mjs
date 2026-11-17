// Per-word syllable counts of a line, table against rule:
//   node --import ./scripts/sound/ts-resolve.mjs scripts/sound/words.mjs de "Dein Vers ist nur ein Schatten"
import { installSound, soundOf } from '../../src/lib/verse/sound/index.ts';
import { syllablesByRule, syllablesInWord, wordsOf } from '../../src/lib/verse/text.ts';
import { thaiEnd } from '../../src/lib/verse/sound/lookup.ts';

const [lang, ...lines] = process.argv.slice(2);
installSound(lang, (await import(`../../src/lib/verse/sound/data/${lang}.ts`)).default);
for (const line of lines) {
  if (lang === 'th') console.log(JSON.stringify(thaiEnd(line)));
  else console.log(wordsOf(line, lang).map((w) => `${w}=${syllablesInWord(w, lang)}(rule ${syllablesByRule(w, lang)}, table ${soundOf(lang, w)})`).join(' '));
}
