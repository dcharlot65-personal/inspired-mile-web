#!/usr/bin/env node
/**
 * Fetch OpenCC's traditional-to-simplified character table, pinned to a commit.
 *
 *   node scripts/lang/fetch-opencc.mjs     writes docs/language/sources/opencc-ts.json
 *
 * English Wiktionary writes Mandarin translations in traditional characters (骷髏, 墳墓); the game
 * writes simplified Chinese (骷髅, 坟墓). The dictionary check (lib/words.mjs) compares the two
 * after mapping each character through this table, so that 坟墓 is found under "grave". OpenCC is the
 * conversion table that open-source Chinese software uses; Apache License 2.0.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COMMIT = 'fae2a0a911c30764e669a7d8b0591cd8e852934a';
const url = `https://raw.githubusercontent.com/BYVoid/OpenCC/${COMMIT}/data/dictionary/TSCharacters.txt`;
const r = await fetch(url);
if (!r.ok) throw new Error(`${r.status} ${url}`);
const map = {};
for (const line of (await r.text()).split('\n')) {
  // The file opens with comment lines ("# Format: key<TAB>value(s)"), which are not characters.
  if (line.startsWith('#')) continue;
  const [trad, simp] = line.split('\t');
  if (trad && simp) map[trad] = simp.split(' ')[0];
}
const out = fileURLToPath(new URL('../../docs/language/sources/opencc-ts.json', import.meta.url));
writeFileSync(out, JSON.stringify({ source: url, commit: COMMIT, licence: 'Apache License 2.0 (OpenCC)', fetched: new Date().toISOString().slice(0, 10), note: 'Traditional character -> its first simplified form, from TSCharacters.txt.', map }, null, 0) + '\n');
console.log(`${out}: ${Object.keys(map).length} characters`);
