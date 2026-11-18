// Proves the page-area tests can fail: breaks one thing at a time in a page area, a data file or
// the provenance record, runs the page unit tests, and expects them to go red. Run it on the
// build host, in a checkout that can be thrown away (rb's is one):
//
//   node scripts/mutate-pages.mjs
//
// Every file is restored afterwards. Exit status 1 if any mutation went unnoticed.
import { execSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const MUTATIONS = [
  // [file, text to find, replacement, what a red run must mention]
  ['src/i18n/pages/home/de.ts', "'home.cta.collection':", "'home.cta.collectionx':", 'home/de: missing home.cta.collection'],
  ['src/i18n/pages/home/ja.ts', "'home.houses.cards': 'カード：{n}'", "'home.houses.cards': 'カード：{m}'", 'home/ja: home.houses.cards has {m}'],
  ['src/i18n/pages/home/ja.ts', '<b>命を得る場所</b>', '命を得る場所', 'home/ja: home.hero.title has marks'],
  ['src/i18n/pages/about/ar.ts', "'about.vision.title': '", "'about.vision.title': '', 'about.unused': '", 'about/ar'],
  ['src/i18n/pages/collection/th.ts', "'collection.deck.save': '", "'collection.deck.save': ' ", 'collection/th: collection.deck.save starts or ends with a space'],
  // A sourced name changed by hand, without the record.
  ['src/i18n/pages/variants/hi.ts', "'variants.city.CAI': 'कायरो',", "'variants.city.CAI': 'काहिरा',", 'variants.city.CAI'],
  // A card's element with no word for it.
  ['src/i18n/pages/card-terms/en.ts', "  'card-terms.element.wisdom': 'Wisdom',\n", '', 'card-terms.element.wisdom'],
  // An achievement whose number no longer matches what it checks.
  ['src/lib/achievements.ts', 'check: (s) => s.battleWins >= 25,', 'check: (s) => s.battleWins >= 26,', 'master-thespian'],
  // A language file put back into English.
  ['src/i18n/pages/profile/pl.ts', null, 'COPY:src/i18n/pages/profile/en.ts', 'pl'],
  // An area that names a key outside itself.
  ['src/i18n/pages/rules/en.ts', "'rules.landIt':", "'nav.home':", 'nav.home'],
  // German quotation marks swapped for French ones: no longer what CLDR records.
  ['src/i18n/pages/runtime.ts', "de: ['„', '“']", "de: ['«', '»']", 'quotation marks'],
  // A language's file of an area gone (the area list itself is open to other branches' areas).
  ['src/i18n/pages/home/vi.ts', null, 'DELETE', 'home/vi'],
  // Lists of words as Intl's measurement lists, which run Chinese and Japanese words together.
  ['src/i18n/pages/runtime.ts', "{ style: 'long', type: 'conjunction' }", "{ style: 'narrow', type: 'unit' }", 'zh'],
  // Signed numbers left to the bidirectional algorithm on a right-to-left page (50+ for +50).
  ['src/i18n/pages/runtime.ts', 'return isRtl(l) ? s.replace(', 'return false ? s.replace(', 'right-to-left page'],
  ['src/i18n/pages/rules-text.ts', 'words: list(words),', "words: new Intl.ListFormat(lang, { style: 'narrow', type: 'unit' }).format(words),", 'zh'],
  // The record no longer saying what it changed in a sourced label (the vi capital, as it stood).
  ['docs/language/pages-core/sourced-names.json', 'label \\"lục địa Á-Âu\\", first letter capitalised, as the CLDR 46.0.0 vi region names beside it are (Châu Á, Châu Âu)"', 'label"', 'variants.region.eurasia vi'],
  // A fetched source that no longer agrees with the record (Spanish Tokio).
  ['docs/language/pages-core/cldr-exemplar-cities.json', '"name": "Tokio"', '"name": "Tokyo"', 'variants.city.TKY es'],
];

let unnoticed = 0;
for (const [file, find, replace, mention] of MUTATIONS) {
  const original = readFileSync(file, 'utf8');
  let mutated;
  if (replace === 'DELETE') mutated = null;
  else if (replace.startsWith('COPY:')) mutated = readFileSync(replace.slice(5), 'utf8');
  else if (!original.includes(find)) {
    console.log(`STALE   ${file}: "${find}" is no longer in the file; update this mutation`);
    unnoticed++;
    continue;
  } else mutated = original.replace(find, replace);
  if (mutated === null) unlinkSync(file);
  else writeFileSync(file, mutated);
  let out = '';
  let red = false;
  try {
    out = execSync('npx vitest run src/i18n/pages.test.ts 2>&1', { encoding: 'utf8' });
  } catch (err) {
    red = true;
    out = String(err.stdout ?? '');
  } finally {
    writeFileSync(file, original);
  }
  const named = out.includes(mention);
  console.log(`${red && named ? 'CAUGHT ' : red ? 'RED?   ' : 'MISSED '} ${file}: ${String(find ?? 'whole file').slice(0, 34)} -> ${replace.slice(0, 34)}${red && !named ? ` (red, but "${mention}" not in the output)` : ''}`);
  if (!red || !named) unnoticed++;
}
// And a clean run after all of it: the restores worked.
try {
  execSync('npx vitest run src/i18n/pages.test.ts 2>&1', { encoding: 'utf8' });
  console.log('CLEAN   the tests pass again with every file restored');
} catch {
  console.log('BROKEN  the tests fail after the files were restored');
  unnoticed++;
}
process.exit(unnoticed ? 1 : 0);
