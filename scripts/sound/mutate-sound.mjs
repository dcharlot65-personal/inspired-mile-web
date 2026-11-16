// Proves the sound tests can fail: breaks one thing at a time (a rule, a table, a test set, a
// written verse, the recorded digest), runs the sound tests, and expects them to go red.
// Run it on the build host, in a checkout that can be thrown away (rb's is one):
//
//   node scripts/sound/mutate-sound.mjs
//
// Every file is restored afterwards. Exit status 1 if any mutation went unnoticed.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const V = 'src/lib/verse';
const MUTATIONS = [
  // [file, text to find, replacement, what it breaks]
  [`${V}/sound/corpus/fr.json`, '"yes": [', '"no_": [', 'the French rhyme set (its rhyming pairs gone)'],
  [`${V}/sound/corpus/ru.json`, '"no": [', '"yes": [', 'the Russian rhyme set (non-rhymes relabelled as rhymes)'],
  [`${V}/rhyme.ts`, "const ZH_ALLIED: string[] = ['no', 'dfp', 'bc'];", "const ZH_ALLIED: string[] = ['abcdefghijklmnop'];", 'Chinese: every final rhymes with every other'],
  [`${V}/rhyme.ts`, "if (pa.rawi !== pb.rawi || pa.ridf !== pb.ridf) return false;", 'if (pa.ridf !== pb.ridf) return false;', 'Arabic: the rhyme letter is not compared'],
  [`${V}/rhyme.ts`, 'if (ka && kb) return ka.some((k) => kb.includes(k));\n  return byKeys(russianEndKey)(a, b);', 'return byKeys(russianEndKey)(a, b);', 'Russian: the stress table is not used'],
  [`${V}/sound/th.ts`, "if (c === 'ง') return 'ŋ';", "if (c === 'ง') return 'n';", 'Thai: ng closes a syllable as n'],
  [`${V}/sound/lookup.ts`, "if (last.inherent && !last.nasal && voiced() > 1) last.v = '';", '', 'Hindi: the closing "a" is counted'],
  [`${V}/sound/kana.ts`, "!'ゃゅょぁぃぅぇぉゎ'.includes(ch)) n++;", 'true) n++;', 'Japanese: small kana count as sounds'],
  [`${V}/sound/lookup.ts`, 'return { n: parseInt(v[0], 36), mute, keys: v.slice(mute ? 2 : 1).split(\'|\') };', 'return { n: parseInt(v[0], 36) + 1, mute, keys: v.slice(mute ? 2 : 1).split(\'|\') };', 'French: every word one syllable too long'],
  [`${V}/packs/zh.ts`, '我一开口它就散在天边', '我一开口它就散在天上', 'a Chinese couplet that no longer rhymes'],
  [`${V}/packs/th.ts`, 'ข้าเอ่ยคำเดียวมันก็ลอยไป', 'ข้าเอ่ยคำเดียวมันก็ลอยมา', 'a Thai couplet that no longer rhymes'],
  [`${V}/packs/hi.ts`, 'तेरी कविता\\nसूखे पत्ते की तरह', 'तेरी सारी कविता\\nसूखे पत्ते की तरह', 'a Hindi haiku with seven syllables in its first line'],
  [`${V}/sound/corpus/expected.json`, '"digest": "', '"digest": "0', 'the recorded digests'],
];

let unnoticed = 0;
for (const [file, find, replace, what] of MUTATIONS) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(find)) {
    console.log(`STALE   ${file}: "${find.slice(0, 40)}" is no longer in the file; update this mutation`);
    unnoticed++;
    continue;
  }
  writeFileSync(file, original.replace(find, replace));
  let red = false;
  try {
    execSync('npx vitest run src/lib/verse/sound 2>&1', { encoding: 'utf8' });
  } catch {
    red = true;
  } finally {
    writeFileSync(file, original);
  }
  console.log(`${red ? 'CAUGHT ' : 'MISSED '} ${what}`);
  if (!red) unnoticed++;
}
process.exit(unnoticed ? 1 : 0);
