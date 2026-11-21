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
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function slangAndNames() {
  return readFileSync(join(ROOT, 'scripts/voice/slang-and-names.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

/**
 * The words of slang-and-names.txt that the voice's own sources name, so they are not fully held
 * out from it. docs/voice/G2P-MEASUREMENT.md gives the word measure with and without them.
 *
 *   named      named in the voice's code, tests or notes, most as the examples its rules were
 *              written for (finna, skrrt, bussin, varlet, coxcomb, Haruki, Okonkwo, Adebayo,
 *              Mwangi); "mid" and "extra" only as ordinary words there, counted all the same.
 *   additions  in the game's own pronunciation additions (scripts/pronunciation-extra.txt, written
 *              for the verse rules on 2026-11-16, before the voice work, and unchanged by it), which
 *              the voice's table includes, so it reads them from the table.
 *
 * src/lib/voice/held-out.test.ts holds this to the sources (voiceSources): it fails when a source
 * names a word of the list that is not here, or when a word here is no longer named.
 */
export const HELD_OUT_SEEN = {
  named: ['finna', 'skrrt', 'bussin', 'varlet', 'coxcomb', 'Okonkwo', 'Adebayo', 'Haruki', 'Mwangi', 'mid', 'extra'],
  additions: ["'tis", 'forsooth', 'prithee', 'methinks', 'wherefore', 'alack', 'anon', 'hither', 'thither', "o'er", 'Mercutio', 'Benvolio', 'Malvolio', 'Prospero', 'Caliban', 'Titania', 'Oberon', 'Rosalind', 'Shylock'],
};

/** The files the voice is made of and described in (not its generated tables, not this list's own two files). */
export function voiceSources() {
  const dir = (d, keep) => readdirSync(join(ROOT, d)).filter(keep).map((f) => `${d}/${f}`);
  return [
    ...dir('src/lib/voice', (f) => f.endsWith('.ts') && !['lexicon-en.ts', 'nrl-rules.ts', 'kokoro-vocab.ts', 'emoji-en.ts'].includes(f)),
    ...dir('scripts/voice', (f) => !['slang-and-names.txt', 'corpus.mjs'].includes(f)),
    'src/lib/thespian-voice.ts', 'src/lib/thespian-voice.test.ts', 'tests/voice.spec.ts', 'scripts/build-voice-lexicon.mjs', 'scripts/build-nrl-rules.mjs', 'scripts/build-voice-emoji.mjs',
    'scripts/check-no-espeak.mjs', 'scripts/pronunciation-extra.txt', 'astro.config.mjs', 'CLAUDE.md',
  ].filter((f) => existsSync(join(ROOT, f)));
}

/** Each word of slang-and-names.txt that a voice source names (as a whole word, any case), with the files. */
export function heldOutNamedInSources() {
  const found = new Map();
  const texts = voiceSources().map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]);
  for (const w of slangAndNames()) {
    const core = w.replace(/'+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${core}(?![\\p{L}\\p{N}_])`, 'iu');
    const files = texts.filter(([, t]) => re.test(t)).map(([f]) => f);
    if (files.length) found.set(w, files);
  }
  return found;
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
