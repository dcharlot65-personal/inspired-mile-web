// Proves the verse tests can fail: breaks one thing at a time in a language pack or a locale,
// runs the unit tests, and expects them to go red. Run it on the build host, in a checkout that
// can be thrown away (rb's is one):
//
//   node scripts/mutate-packs.mjs
//
// Every file is restored afterwards. Exit status 1 if any mutation went unnoticed.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MUTATIONS = [
  // [file, text to find, replacement, what a red run must mention]
  ['src/lib/verse/packs/es.ts', 'te hace ceniza', 'te hace carbón', 'es couplet'],
  ['src/lib/verse/packs/fr.ts', 'Juste un peu de vent', 'Juste un petit peu de vent', 'fr haiku'],
  ['src/lib/verse/packs/de.ts', 'Dein Vers ist noch kleiner', 'Dein Vers', 'de crescendo'],
  ['src/lib/verse/packs/ko.ts', '바람에 진다', '바람에 떨어진다', 'ko haiku'],
  ['src/lib/verse/packs/th.ts', 'แล้วก็เสีย เวที', 'แล้วก็เสีย เวลา', 'th epistrophe'],
  ['src/lib/verse/packs/hi.ts', 'कब से खड़ा है तू', 'अब से खड़ा है तू', 'hi acrostic'],
  ['src/lib/verse/packs/ja.ts', 'かぜにちる', '風にちる', 'ja haiku'],
  ['src/lib/verse/packs/zh.ts', '照尔无处躲', '照尔无处可躲', 'zh jueju'],
  ['src/lib/verse/packs/vi.ts', 'muôn vàn khói bay', 'muôn nơi khói bay', 'vi luc-bat'],
  ['src/lib/verse/packs/ar.ts', 'وأنت بلا مقام', 'وأنت بلا مكان', 'ar couplet'],
  ['src/lib/verse/packs/ru.ts', "'пучина'],\n    'RL-003'", "],\n    'RL-003'", 'ru'],
  ['src/lib/verse/packs/pl.ts', "acrostic: ['noc', ", "acrostic: ['noc', 'żyć', ", 'pl acrostic'],
  ['src/i18n/locales/es.ts', "'battle.begin':", "'battle.beginx':", 'es'],
  ['src/i18n/locales/ja.ts', '{n}', '{m}', 'ja'],
  ['src/i18n/locales/ar.ts', "'nav.home': '", "'nav.home': '', 'nav.unused': '", 'ar'],
];

let unnoticed = 0;
for (const [file, find, replace, mention] of MUTATIONS) {
  if (!existsSync(file)) {
    console.log(`SKIP    ${file} (not there)`);
    continue;
  }
  const original = readFileSync(file, 'utf8');
  if (!original.includes(find)) {
    console.log(`STALE   ${file}: "${find}" is no longer in the file; update this mutation`);
    unnoticed++;
    continue;
  }
  writeFileSync(file, original.replace(find, replace));
  let out = '';
  let red = false;
  try {
    out = execSync('npx vitest run 2>&1', { encoding: 'utf8' });
  } catch (err) {
    red = true;
    out = String(err.stdout ?? '');
  } finally {
    writeFileSync(file, original);
  }
  const named = out.includes(mention);
  console.log(`${red && named ? 'CAUGHT ' : red ? 'RED?   ' : 'MISSED '} ${file}: ${find.slice(0, 30)} -> ${replace.slice(0, 30)}${red && !named ? ` (red, but "${mention}" not in the output)` : ''}`);
  if (!red) unnoticed++;
}
process.exit(unnoticed ? 1 : 0);
