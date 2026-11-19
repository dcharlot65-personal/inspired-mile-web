/**
 * The English text the voice measurement reads (scripts/voice/measure.mjs), and the unit tests
 * hold to Kokoro's vocabulary (src/lib/voice/g2p-en.test.ts).
 *
 *   verse     every verse the written opponent plays in English (pack.written and pack.spare)
 *   acrostic  every line the written opponent builds an acrostic from (pack.acrosticLines)
 *   quote     every English card quotation (CARD_CATALOG[].quote)
 *   model     up to 60 English verses the models wrote in the stored evaluation runs
 *             (docs/language/model-eval/cells/{grand,standard,lite}.en.write.json, drafts after the tidy-up)
 *   word      the 200 slang words, old stage words and names of slang-and-names.txt, each in
 *             the carrier sentence "I say <word> again."
 *
 * The interface itself says nothing aloud: the battle page speaks only the opponent's verse
 * (battle.astro say(s.opponentVerse)), and no other page imports the voice.
 *
 * Needs `node --import ./scripts/sound/ts-resolve.mjs` (it imports the game's TypeScript).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function slangAndNames() {
  return readFileSync(join(ROOT, 'scripts/voice/slang-and-names.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

export async function corpus() {
  const pack = (await import(join(ROOT, 'src/lib/verse/packs/en.ts'))).default;
  const { CARD_CATALOG } = await import(join(ROOT, 'src/lib/cards.ts'));
  const items = [];
  const add = (category, text) => items.push({ id: `${category}-${items.filter((i) => i.category === category).length + 1}`, category, text });
  for (const set of [pack.written, pack.spare ?? {}]) for (const verses of Object.values(set)) for (const v of verses) add('verse', v);
  for (const lines of Object.values(pack.acrosticLines)) for (const l of lines) add('acrostic', l);
  for (const q of [...new Set(CARD_CATALOG.map((c) => c.quote).filter(Boolean))]) add('quote', q);
  const model = new Set();
  for (const tier of ['grand', 'standard', 'lite']) {
    const file = join(ROOT, `docs/language/model-eval/cells/${tier}.en.write.json`);
    if (!existsSync(file)) continue;
    for (const play of JSON.parse(readFileSync(file, 'utf8')).plays ?? []) {
      for (const d of play.drafts ?? []) {
        const t = (d.tidy ?? '').trim();
        if (t && t.split(/\s+/).length >= 4) model.add(t);
      }
    }
  }
  for (const t of [...model].slice(0, 60)) add('model', t);
  for (const w of slangAndNames()) items.push({ id: `word-${w}`, category: 'word', text: `I say ${w} again.`, target: w });
  return items;
}
