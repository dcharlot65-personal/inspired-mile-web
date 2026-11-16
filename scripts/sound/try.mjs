// A quick look at the engine from plain Node, tables loaded:
//   node --import ./scripts/sound/ts-resolve.mjs scripts/sound/try.mjs fr nuit bruit
import { installSound, soundOf } from '../../src/lib/verse/sound/index.ts';
import { rhymes, rhymeEnds } from '../../src/lib/verse/rhyme.ts';
import { syllablesInLine, syllablesInWord } from '../../src/lib/verse/text.ts';

const [lang, ...words] = process.argv.slice(2);
try {
  installSound(lang, (await import(`../../src/lib/verse/sound/data/${lang}.ts`)).default);
} catch {
  // a language with no table
}
for (const w of words) console.log(w, 'syllables:', syllablesInLine(w, lang), 'table:', soundOf(lang, w.toLowerCase()));
for (let i = 0; i + 1 < words.length; i += 2) {
  const [a, b] = rhymeEnds(words[i], words[i + 1], lang);
  console.log(`${a} / ${b}:`, rhymes(a, b, lang));
}
