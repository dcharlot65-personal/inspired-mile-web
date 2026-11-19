#!/usr/bin/env node
/**
 * Writes cards.csv, forms.csv and devices.csv in this folder from the game's own modules.
 *
 * Almost every value in these CSV files is read from src/lib (cards.ts, verse/devices.ts,
 * verse/forms.ts, verse/english.ts, verse/lang.ts, verse/packs/*.ts, story-mode.ts,
 * verse/duel.ts) or derived from those values by the arithmetic named in the column's header
 * note below. A few cells are written in this script and do NOT follow the code on their own:
 * the NOTE and effect wording, the acrostic's lines_en text, and the Forbidden Letter rule's
 * list of English letters. Check them by hand when the English pack or a form changes.
 * Rerun it after any change to the cards, forms or devices:
 *
 *   node docs/dossier/data/generate.mjs              (from the repository root; Node 23.6 or later)
 *   node docs/dossier/data/generate.mjs --examples   (also prints the worked examples of document 05)
 *
 * It needs no npm packages and no build: Node strips the TypeScript types itself, and the hook
 * below lets it resolve the extensionless imports the game's modules use. It reads files only;
 * it starts no server and fetches nothing. Light enough for the dev Mac.
 *
 * Columns marked (derived) are computed here, not stored in the code:
 * - draw_chance_per_card: the card's rarity weight / the sum of the weights / cards of that rarity.
 * - in_starter_deck, online_starter: starterDeck() with nothing owned; the first three characters.
 * - forms.csv "with_sound_data": the same rule as formsFor(), taking rhyme as checkable in every
 *   language, which is what the battle page arranges before a duel starts (it awaits the sound data).
 */
import { registerHooks } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');

// The game's modules import './lang', '../cards' and so on with no extension (Vite resolves them).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\.[cm]?[jt]s$|\.json$/.test(specifier) && context.parentURL) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const lib = (p) => import(pathToFileURL(join(ROOT, 'src/lib', p)).href);

const cardsMod = await lib('cards.ts');
const devicesMod = await lib('verse/devices.ts');
const formsMod = await lib('verse/forms.ts');
const englishMod = await lib('verse/english.ts');
const langMod = await lib('verse/lang.ts');
const textMod = await lib('verse/text.ts');
const packsMod = await lib('verse/packs/index.ts');
const storyMod = await lib('story-mode.ts');
const duelMod = await lib('verse/duel.ts');

const { CARD_CATALOG, RARITY_WEIGHTS, getCardEra } = cardsMod;
const { DEVICES, HOUSE_DEVICE, deviceForHouse, houseWhy, signatureWords, signatureNeeded, CURSES, POTION_CURSE, CURSE_PENALTY, CURSE_PENALTY_CAP, POWER_WORD_BONUS, POWER_WORDS_NEEDED, OPENING_DEVICE } = devicesMod;
const { FORMS, FORM_POINTS, formsFor } = formsMod;
const { en } = englishMod;
const { rulesFor } = langMod;
const { countsSyllables } = textMod;
const { PACK_LANGS } = packsMod;
const { ACTS } = storyMod;
const { starterDeck } = duelMod;

// Every pack is a plain module of data; load each directly (loadPack would also fetch card text).
const packs = {};
for (const l of PACK_LANGS) packs[l] = (await import(pathToFileURL(join(ROOT, `src/lib/verse/packs/${l}.ts`)).href)).default;

// --- CSV helpers ---
const cell = (v) => {
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header, rows) => [header.join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\n') + '\n';

// --- cards.csv ---
const cardsSource = readFileSync(join(ROOT, 'src/lib/cards.ts'), 'utf8').split('\n');
const lineOf = (id) => cardsSource.findIndex((l) => l.includes(`id: '${id}'`)) + 1;
const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
const countByRarity = {};
for (const c of CARD_CATALOG) countByRarity[c.rarity] = (countByRarity[c.rarity] ?? 0) + 1;
const charsInHouse = {};
for (const c of CARD_CATALOG) if (c.type === 'Character') charsInHouse[c.house] = (charsInHouse[c.house] ?? 0) + 1;
const starter = starterDeck([]);
const starterIds = new Set([...starter.characters, ...starter.relics, ...starter.potions]);
const onlineStarter = new Set(CARD_CATALOG.filter((c) => c.type === 'Character').slice(0, 3).map((c) => c.id));
const encountersOf = {};
for (const act of ACTS) for (const e of act.encounters) (encountersOf[e.opponent] ??= []).push(`${e.id} ${e.name} (${e.difficulty})`);

const cardHeader = [
  'id', 'source_line', 'name', 'type', 'house', 'rarity', 'era', 'atk', 'def', 'hp', 'element', 'quote', 'scene', 'image', 'image_exists',
  'icon', 'gradient', 'border', 'rarity_weight', 'draw_chance_per_card', 'in_starter_deck', 'online_starter',
  'device_id', 'device_name', 'device_rule_en', 'device_where_rhyme_unchecked', 'device_when_opening', 'house_why', 'house_characters',
  'signature_words', 'signature_needed', 'relic_power_words_en', 'curse_id', 'curse_name', 'curse_rule_en', 'story_encounters',
  ...PACK_LANGS.filter((l) => l !== 'en').map((l) => `relic_power_words_${l}`),
];
const cardRows = CARD_CATALOG.map((c) => {
  const row = {
    id: c.id, source_line: lineOf(c.id), name: c.name, type: c.type, house: c.house, rarity: c.rarity, era: getCardEra(c),
    atk: c.atk, def: c.def, hp: c.hp, element: c.element, quote: c.quote, scene: c.scene, image: c.image ?? '',
    image_exists: c.image ? existsSync(join(ROOT, 'public', c.image)) : false,
    icon: c.icon, gradient: c.gradient, border: c.border,
    rarity_weight: RARITY_WEIGHTS[c.rarity],
    draw_chance_per_card: (RARITY_WEIGHTS[c.rarity] / totalWeight / countByRarity[c.rarity] * 100).toFixed(2) + '%',
    in_starter_deck: starterIds.has(c.id), online_starter: onlineStarter.has(c.id),
    story_encounters: encountersOf[c.id] ?? [],
  };
  if (c.type === 'Character') {
    const dev = deviceForHouse(c.house, 'en');
    const devZh = deviceForHouse(c.house, 'zh'); // zh without its sound data: rhyme not checkable
    const why = houseWhy(c.house, 'en');
    Object.assign(row, {
      device_id: dev.id, device_name: en(dev.name), device_rule_en: en(dev.brief('en')),
      device_where_rhyme_unchecked: devZh.id === dev.id ? '' : en(devZh.name),
      device_when_opening: dev.id === 'riposte' ? en(DEVICES[OPENING_DEVICE].name) : '',
      house_why: why ? en(why) : '', house_characters: charsInHouse[c.house],
      signature_words: signatureWords(c), signature_needed: signatureNeeded(c),
    });
  } else if (c.type === 'Relic') {
    row.relic_power_words_en = packs.en.relics[c.id] ?? [];
    for (const l of PACK_LANGS) if (l !== 'en') row[`relic_power_words_${l}`] = packs[l].relics[c.id] ?? [];
  } else {
    const k = CURSES[POTION_CURSE[c.id]];
    Object.assign(row, {
      curse_id: k.id, curse_name: en(k.name),
      curse_rule_en: k.id === 'forbidden-letter' ? 'Their verse may not contain the letter the duel draws (en: s, t, r, n, o or i).' : en(englishMod.theirs(k.brief('', 'en'))),
    });
  }
  return row;
});
writeFileSync(join(HERE, 'cards.csv'), csv(cardHeader, cardRows));

// --- forms.csv ---
const withSound = (f, lang) => {
  const b = lang.split('-')[0];
  return (!f.only || f.only.includes(b)) && !f.except?.includes(b) && (!f.needsSyllables || countsSyllables(lang));
};
const formHeader = ['id', 'name_en', 'brief_en', 'lines_en', 'needs_rhyme', 'needs_syllables', 'only_in', 'not_in', 'requirements', 'points_total', 'offered_in_with_sound_data', 'offered_in_without_sound_data', 'written_verses_en', 'spare_verses_en'];
const ctxEn = { lang: 'en', acrostic: 'bard' };
const formRows = FORMS.map((f) => ({
  id: f.id, name_en: en(f.name), brief_en: en(f.brief(ctxEn)),
  lines_en: f.id === 'acrostic' ? 'one per letter of the drawn word' : f.lines(ctxEn),
  needs_rhyme: !!f.needsRhyme, needs_syllables: !!f.needsSyllables, only_in: f.only ?? [], not_in: f.except ?? [],
  requirements: f.requirements.map((r) => `${en(r.label(ctxEn))} (${r.points})`),
  points_total: f.requirements.reduce((a, r) => a + r.points, 0),
  offered_in_with_sound_data: PACK_LANGS.filter((l) => withSound(f, l)),
  offered_in_without_sound_data: PACK_LANGS.filter((l) => formsFor(l).some((x) => x.id === f.id)),
  written_verses_en: f.id === 'acrostic' ? `${Object.values(packs.en.acrosticLines).flat().length} acrostic lines` : (packs.en.written[f.id] ?? []).length,
  spare_verses_en: (packs.en.spare?.[f.id] ?? []).length,
}));
if (formRows.some((r) => r.points_total !== FORM_POINTS)) throw new Error('a form does not total FORM_POINTS');
writeFileSync(join(HERE, 'forms.csv'), csv(formHeader, formRows));

// --- devices.csv: the 13 card devices, the 4 curses, and the relics' power words ---
const housesOf = {};
for (const [house, { device }] of Object.entries(HOUSE_DEVICE)) (housesOf[device] ??= []).push(house);
const devHeader = ['kind', 'id', 'name_en', 'rule_en', 'houses', 'cards', 'effect', 'fallback_where_rhyme_unchecked', 'note', ...PACK_LANGS.map((l) => `threshold_${l}`)];
// Which per-language threshold (verse/lang.ts rulesFor) each check reads, as it reads it in verse/devices.ts.
const unitName = (l, n) => `${n} ${rulesFor(l).unit === 'char' ? (n === 1 ? 'character' : 'characters') : n === 1 ? 'word' : 'words'}`;
const THRESHOLD = {
  riposte: (l) => `${rulesFor(l).riposte} letters`,
  brevity: (l) => unitName(l, rulesFor(l).brevity),
  grandeur: (l) => `${rulesFor(l).grand} letters`,
  alliteration: (l) => `${Math.min(3, rulesFor(l).content)} letters`,
  'internal-rhyme': (l) => `${Math.min(3, rulesFor(l).content)} letters`,
  repetition: (l) => `${rulesFor(l).content} letters`,
  'short-words': (l) => `${rulesFor(l).shortWord} letters`,
  'no-repeats': (l) => `${rulesFor(l).content} letters`,
  'short-lines': (l) => unitName(l, rulesFor(l).shortLine),
};
const thresholds = (id) => Object.fromEntries(PACK_LANGS.map((l) => [`threshold_${l}`, THRESHOLD[id] ? THRESHOLD[id](l) : '']));
const WITHOUT = { 'internal-rhyme': 'repetition', monorhyme: 'ring' };
const NOTE = {
  exclaim: 'Also what a Riposte house is held to in a verse that opens a round (OPENING_DEVICE); in a solo duel only the opponent opens.',
  riposte: 'Cannot land in a verse that opens a round: such a verse is held to The Outcry.',
  invocation: 'Counts the full name of any catalogue character, or its last part when that is not an ordinary word, or the name as the duel language writes it.',
  alliteration: 'Three different words of the line, none a stop word, sharing an initial; threshold = shortest word counted.',
  'internal-rhyme': 'Two words inside one line rhyme; threshold = shortest word counted.',
  repetition: 'One word, not a stop word, three times; threshold = shortest word counted.',
  monorhyme: 'Every line ends on a rhyme of the first line; two lines or more.',
  ring: 'First unit of the first line equals the last unit of the last line, in a verse of more than two units.',
  balance: 'Two lines or more, all the same length.',
  swell: 'Two lines or more; the last strictly the longest.',
};
const devRows = [];
for (const d of Object.values(DEVICES)) {
  const houses = housesOf[d.id] ?? [];
  const cards = CARD_CATALOG.filter((c) => c.type === 'Character' && houses.includes(c.house)).map((c) => c.id);
  devRows.push({
    kind: 'device', id: d.id, name_en: en(d.name), rule_en: en(d.brief('en')), houses, cards,
    effect: '+0.5 to the craft multiplier when it lands; +0.75 when the deck holds 2+ characters of the house',
    fallback_where_rhyme_unchecked: WITHOUT[d.id] ? en(DEVICES[WITHOUT[d.id]].name) : '',
    note: NOTE[d.id] ?? '',
    ...thresholds(d.id),
  });
}
for (const k of Object.values(CURSES)) {
  devRows.push({
    kind: 'curse', id: k.id, name_en: en(k.name),
    rule_en: k.id === 'forbidden-letter' ? 'Their verse may not contain the drawn letter.' : en(englishMod.theirs(k.brief('', 'en'))),
    houses: [], cards: Object.entries(POTION_CURSE).filter(([, v]) => v === k.id).map(([id]) => id),
    effect: `-${CURSE_PENALTY} craft per breach, at most -${CURSE_PENALTY_CAP}; binds the opponent's next verse`,
    ...thresholds(k.id),
    ...(k.id === 'forbidden-letter' ? Object.fromEntries(PACK_LANGS.map((l) => [`threshold_${l}`, `letters ${packs[l].forbidden.join(' ')}`])) : {}),
  });
}
devRows.push({
  kind: 'power-words', id: 'power-words', name_en: 'Power words', rule_en: `Use ${POWER_WORDS_NEEDED} of the relic's five words.`,
  houses: [], cards: CARD_CATALOG.filter((c) => c.type === 'Relic').map((c) => c.id),
  effect: `+${POWER_WORD_BONUS} craft before the multiplier`,
});
writeFileSync(join(HERE, 'devices.csv'), csv(devHeader, devRows));

console.log(`cards.csv ${cardRows.length} rows, forms.csv ${formRows.length} rows, devices.csv ${devRows.length} rows`);

// --- `--examples`: the worked examples of 05-systems-economy-and-balance.md, and the written
// opponent's English craft over every (verse, character) pairing. Prints only; writes nothing.
// It loads the English pronunciation table (src/lib/verse/pron-en.ts, 1.46 MB) into memory.
if (process.argv.includes('--examples')) {
  const { scoreVerse } = duelMod;
  const { getForm } = formsMod;
  const { getCardById } = cardsMod;
  const { loadPronunciation } = await lib('verse/pronounce.ts');
  const { rulesJudge } = await lib('verse/judge.ts');
  const { allusionLexicon } = await lib('verse/referee.ts');
  if (!(await loadPronunciation())) throw new Error('pronunciation table did not load');
  const en0 = packs.en;
  const ctx = { lang: 'en' };
  const brief = (s) => ({
    form: s.form.earned, device: `${s.device.id} ${s.device.met ? 'landed' : 'missed'}${s.device.detail ? ` (${s.device.detail})` : ''}`,
    signature: s.signature.met ? `echoed (${s.signature.detail})` : 'missed', synergy: s.synergy, substance: Number(s.substance.toFixed(2)),
    multiplier: s.multiplier, power: s.powerWords ? `${s.powerWords.used.join(', ')} -> +${s.powerWords.bonus}` : '-', curse: s.curse ? `${s.curse.violations} breaches -> -${s.curse.penalty}` : '-',
    craft: s.craft, voided: s.voided ?? '-',
  });
  const opp = en0.written.couplet[0];
  const couplet = getForm('couplet');
  const A = "Soft light, bright night: I jest beside thy grave of dust,\nThy yonder window breaks, as every candle must.";
  const examples = {
    'A. Romeo, two Montagues in the deck, Yorick\'s Skull played': scoreVerse({ verse: A, form: couplet, ctx, card: getCardById('MO-001'), deckCharacters: ['MO-001', 'MO-002', 'CA-001'], opponentVerse: opp, lent: { relicId: 'RL-001', words: en0.relics['RL-001'] } }),
    'B. The same verse, one Montague, no relic': scoreVerse({ verse: A, form: couplet, ctx, card: getCardById('MO-001'), deckCharacters: ['MO-001', 'SM-001', 'CA-001'], opponentVerse: opp }),
    'C. Padding: device and signature repeated, little else': scoreVerse({ verse: 'Soft light, bright night, soft light, bright night\nSoft light, bright night, soft light, yonder light', form: couplet, ctx, card: getCardById('MO-001'), deckCharacters: ['MO-001', 'MO-002', 'CA-001'], opponentVerse: opp }),
    'D. Juliet under Short Breath (no line over 5 words)': scoreVerse({ verse: 'My candle burns the brighter for thy failing night,\nAnd every word I sing is armour, flame and light.', form: couplet, ctx, card: getCardById('CA-001'), deckCharacters: ['CA-001', 'CA-002', 'SM-001'], opponentVerse: opp, curse: { potionId: 'PT-003', curseId: 'short-lines', param: '' } }),
    'E. Hamlet in a haiku, two Danes in the deck': scoreVerse({ verse: 'Ask the yonder moon\nwhy the window breaks so soft\nwho will hear me now?', form: getForm('haiku'), ctx, card: getCardById('DC-001'), deckCharacters: ['DC-001', 'DC-002', 'SM-001'], opponentVerse: en0.written.haiku[0] }),
    'O. The written opponent\'s couplet, played by Hamlet': scoreVerse({ verse: opp, form: couplet, ctx, card: getCardById('DC-001'), deckCharacters: ['DC-001', 'TP-001', 'OL-001'], trusted: true }),
  };
  console.log('\nOpponent couplet:', JSON.stringify(opp));
  for (const [k, s] of Object.entries(examples)) console.log(k, JSON.stringify(brief(s)));
  console.log('Rule judge, A against the opponent couplet:', JSON.stringify(rulesJudge(A, opp, 'en', allusionLexicon('en'))));
  const all = [];
  const landed = {};
  for (const f of formsFor('en')) {
    if (f.id === 'acrostic') continue;
    for (const v of en0.written[f.id] ?? []) for (const c of CARD_CATALOG.filter((x) => x.type === 'Character')) {
      const s = scoreVerse({ verse: v, form: f, ctx, card: c, deckCharacters: [c.id], trusted: true });
      all.push(s.craft);
      landed[s.device.id] ??= [0, 0];
      landed[s.device.id][0] += s.device.met ? 1 : 0;
      landed[s.device.id][1] += 1;
    }
  }
  all.sort((a, b) => a - b);
  console.log(`Written opponent, English, ${all.length} pairings: min ${all[0]}, median ${all[all.length >> 1]}, mean ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(1)}, max ${all[all.length - 1]}`);
  console.log('Device landed / tried:', Object.entries(landed).map(([k, [m, n]]) => `${k} ${m}/${n}`).join(', '));
}
