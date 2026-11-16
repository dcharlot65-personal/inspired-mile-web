import { beforeAll, describe, expect, it } from 'vitest';
import { formsFor } from '../forms';
import { deviceForHouse } from '../devices';
import { PACK_LANGS, loadAllPacks } from '../packs';
import { rhymeChecked, rhymeEnds, rhymes } from '../rhyme';
import { countsSyllables, syllablesByRule, syllablesInLine, syllablesInWord } from '../text';
import { soundReport, type RhymeCorpus, type SoundReport, type SyllableSet } from './digest';
import { hasSound, installSound, loadSound, markSound, parseTable, soundEntries, soundOf, soundReady, soundSize } from './index';
import { japaneseLoaded, japaneseTokens, setJapaneseAnalyser } from './kana';
import { hindiSyllablesByRule, thaiEnd, thaiSyllables } from './lookup';
import { thaiRimeBySpelling } from './th';
import expected from './corpus/expected.json';
import syllableSets from './corpus/syllables.json';

const CORPORA = import.meta.glob('./corpus/*.json', { eager: true, import: 'default' }) as Record<string, RhymeCorpus>;
const corpus = (lang: string): RhymeCorpus | undefined => CORPORA[`./corpus/${lang}.json`];
const sets = syllableSets as unknown as Record<string, SyllableSet>;
const want = expected as unknown as Record<string, SoundReport>;

/** Every language but English, whose table is the CMU dictionary's and is tested where it lives. */
const LANGS = PACK_LANGS.filter((l) => l !== 'en');

/**
 * What each language's rules must reach on its sets: real rhymes heard, non-rhymes refused,
 * dictionary counts matched, each as a fraction. Set a little under what was measured on
 * 2026-11-16 (docs/language/PHONETICS.md has the measured figures and every miss), so that
 * a rule that gets worse fails here, and one that gets better does not.
 */
const FLOORS: Record<string, { heard: number; refused: number; counted: number }> = {
  es: { heard: 0.9, refused: 0.95, counted: 0.9 },
  fr: { heard: 0.95, refused: 0.95, counted: 0.95 },
  de: { heard: 0.9, refused: 0.95, counted: 0.95 },
  it: { heard: 0.9, refused: 0.95, counted: 0.9 },
  pt: { heard: 0.95, refused: 0.95, counted: 0.85 },
  pl: { heard: 0.9, refused: 0.95, counted: 0.95 },
  ru: { heard: 0.95, refused: 0.95, counted: 0.95 },
  ar: { heard: 0.95, refused: 0.95, counted: 0 },
  hi: { heard: 0.8, refused: 0.9, counted: 0.9 },
  zh: { heard: 0.85, refused: 0.85, counted: 0.95 },
  ja: { heard: 0, refused: 0, counted: 0.95 },
  ko: { heard: 0, refused: 0, counted: 0.95 },
  vi: { heard: 0.9, refused: 0.95, counted: 0.95 },
  th: { heard: 0.95, refused: 0.95, counted: 0.95 },
  id: { heard: 0.95, refused: 0.95, counted: 0.9 },
};

/**
 * Sets the brief asks for that could not be had, with the reason. Nothing else may be
 * short: a language not named here must have forty rhyming pairs, twenty non-rhyming
 * pairs and sixty counted words.
 */
const SHORT: Record<string, { rhyme?: string; syllables?: string }> = {
  ja: { rhyme: 'Japanese verse does not rhyme by tradition; no public-domain rhymed poem in a fixed scheme was found to label pairs from' },
  ko: { rhyme: 'Korean verse does not rhyme by tradition; no public-domain rhymed poem in a fixed scheme was found to label pairs from' },
  ar: { syllables: 'unvocalised Arabic does not show its short vowels, so syllables are not counted at all' },
};

beforeAll(async () => {
  await loadAllPacks();
  const ok = await Promise.all(PACK_LANGS.map((l) => loadSound(l)));
  expect(ok.every(Boolean)).toBe(true);
}, 120_000);

describe('sound tables', () => {
  it('parses the generated format back into the words that were written', () => {
    const t = parseTable('0amor\t12\n3re\t13\n0zeta\t01');
    expect([...t]).toEqual([['amor', '12'], ['amore', '13'], ['zeta', '01']]);
    // A line that is not an entry is skipped, not misread.
    expect(parseTable('\n0a\t1\njunk').size).toBe(1);
  });

  it('loads every language that has data, once, and answers at once for those that need none', async () => {
    for (const lang of LANGS) expect([lang, soundReady(lang)]).toEqual([lang, true]);
    for (const lang of ['es', 'it', 'pt', 'fr', 'de', 'ru', 'hi', 'id', 'th', 'zh']) expect([lang, soundSize(lang) > 100]).toEqual([lang, true]);
    for (const lang of ['pl', 'ko', 'vi', 'ar']) expect([lang, hasSound(lang)]).toEqual([lang, false]);
    expect(japaneseLoaded()).toBe(true);
    const before = soundSize('fr');
    expect(await loadSound('fr')).toBe(true);
    expect(soundSize('fr')).toBe(before);
  });

  it('falls back to the spelling rules when a table is not there, and says rhyme is unchecked where spelling cannot carry it', async () => {
    const fr = (await import('./data/fr')).default;
    const zh = (await import('./data/zh')).default;
    try {
      installSound('fr', null);
      expect(soundOf('fr', 'nuit')).toBeUndefined();
      // The spelling rule still hears this one, and still cannot hear a sounded final consonant.
      expect(rhymes('nuit', 'bruit', 'fr')).toBe(true);
      expect(rhymes('fils', 'lys', 'fr')).toBe(false);
      installSound('zh', null);
      expect(rhymeChecked('zh')).toBe(false);
      expect(formsFor('zh').some((f) => f.needsRhyme)).toBe(false);
      expect(deviceForHouse('Montague', 'zh').id).toBe('repetition');
      expect(rhymes('光', '乡', 'zh')).toBe(false);
    } finally {
      installSound('fr', fr);
      installSound('zh', zh);
    }
    expect(rhymes('fils', 'lys', 'fr')).toBe(true);
    expect(rhymeChecked('zh')).toBe(true);
    expect(deviceForHouse('Montague', 'zh').id).toBe('internal-rhyme');
  });
});

describe('rhyme and syllables by sound, against published verse and dictionaries', () => {
  it('has a rhyme set from a recorded poem and a counted set from a dictionary for every language, or says why not', () => {
    for (const lang of LANGS) {
      const c = corpus(lang);
      const s = sets[lang];
      if (SHORT[lang]?.rhyme) expect([lang, c === undefined]).toEqual([lang, true]);
      else {
        expect([lang, 'rhyming pairs', (c?.yes.length ?? 0) >= 40]).toEqual([lang, 'rhyming pairs', true]);
        expect([lang, 'non-rhyming pairs', (c?.no.length ?? 0) >= 20]).toEqual([lang, 'non-rhyming pairs', true]);
        for (const field of ['title', 'author', 'form', 'source', 'fetched', 'licence'] as const) expect([lang, field, !!c!.poem[field]]).toEqual([lang, field, true]);
        expect([lang, /^https:\/\/[a-z]+\.wikisource\.org\//.test(c!.poem.source)]).toEqual([lang, true]);
      }
      if (SHORT[lang]?.syllables) expect([lang, s === undefined]).toEqual([lang, true]);
      else {
        expect([lang, 'counted words', (s?.words.length ?? 0) >= 60]).toEqual([lang, 'counted words', true]);
        expect([lang, !!s!.source]).toEqual([lang, true]);
      }
    }
    // Nothing is excused that is not named above.
    expect(Object.keys(SHORT).sort()).toEqual(['ar', 'ja', 'ko']);
  });

  it('reaches its floor in every language: real rhymes heard, non-rhymes refused, counts matched', () => {
    for (const lang of LANGS) {
      const r = soundReport(lang, corpus(lang), sets[lang]);
      const f = FLOORS[lang];
      if (r.yes) expect([lang, 'heard', r.heard, r.yes, r.heard / r.yes >= f.heard]).toEqual([lang, 'heard', r.heard, r.yes, true]);
      if (r.no) expect([lang, 'refused', r.refused, r.no, r.refused / r.no >= f.refused]).toEqual([lang, 'refused', r.refused, r.no, true]);
      if (r.words) expect([lang, 'counted', r.counted, r.words, r.counted / r.words >= f.counted]).toEqual([lang, 'counted', r.counted, r.words, true]);
    }
  });

  it('every written verse of every pack keeps its form, in every form the language now offers', () => {
    for (const lang of LANGS) {
      const r = soundReport(lang, corpus(lang), sets[lang]);
      expect([lang, r.kept, r.verses]).toEqual([lang, r.verses, r.verses]);
      // Two verses for each form but the acrostic, which is built from lines.
      expect([lang, r.verses]).toEqual([lang, 2 * (formsFor(lang).length - 1)]);
    }
  });

  it('gives the same answers on every run and in every runtime (the recorded digest)', () => {
    for (const lang of LANGS) {
      const first = soundReport(lang, corpus(lang), sets[lang]);
      const second = soundReport(lang, corpus(lang), sets[lang]);
      expect([lang, second]).toEqual([lang, first]);
      // Recorded by scripts/sound/measure.mjs in plain Node; tests/sound.spec.ts asks a browser for the same.
      expect([lang, first]).toEqual([lang, want[lang]]);
    }
  });
});

describe('what each language can now hear', () => {
  it('restores the rhyming forms in Chinese, Japanese and Thai, and the syllable forms in Hindi', () => {
    const ids = (lang: string) => formsFor(lang).map((f) => f.id).sort();
    const rhyming = ['couplet', 'quatrain-aabb', 'quatrain-abab', 'tercet'];
    const structural = ['acrostic', 'anaphora', 'crescendo', 'epistrophe'];
    expect(ids('zh')).toEqual([...rhyming, ...structural, 'haiku', 'heroic-couplet', 'jueju'].sort());
    expect(ids('ja')).toEqual([...rhyming, ...structural, 'haiku', 'heroic-couplet'].sort());
    expect(ids('hi')).toEqual([...rhyming, ...structural, 'haiku', 'heroic-couplet'].sort());
    // Thai: rhyme, but no syllable forms (a fair count needs every word in the table).
    expect(ids('th')).toEqual([...rhyming, ...structural].sort());
    // Arabic: rhyme, but no syllable forms (short vowels are not written).
    expect(ids('ar')).toEqual([...rhyming, ...structural].sort());
    expect(countsSyllables('ar')).toBe(false);
    expect(countsSyllables('th')).toBe(false);
    for (const lang of LANGS) expect([lang, rhymeChecked(lang)]).toEqual([lang, true]);
  });

  it('Russian: rhymes from the stressed vowel, which only the table knows', () => {
    expect(rhymes('розы', 'морозы', 'ru')).toBe(true);
    expect(rhymes('она', 'луна', 'ru')).toBe(true);
    // The end of the word matches, the stress does not: spelling alone let this through.
    expect(rhymes('сцена', 'луна', 'ru')).toBe(false);
    expect(rhymes('искусства', 'чувства', 'ru')).toBe(true);
    const ru = soundOf('ru', 'сцена');
    expect(ru).toBe('2');
  });

  it('Italian, Spanish, Portuguese: the stress a dictionary gives where spelling does not show it', () => {
    expect(rhymes('tavola', 'favola', 'it')).toBe(true);
    expect(rhymes('anima', 'prima', 'it')).toBe(false);
    expect(rhymes('poesia', 'via', 'it')).toBe(true);
    expect(rhymes('storia', 'gloria', 'it')).toBe(true);
    expect(rhymes('storia', 'poesia', 'it')).toBe(false);
    expect(rhymes('trovai', 'abbandonai', 'it')).toBe(true);
    expect(rhymes('corazón', 'canción', 'es')).toBe(true);
    expect(rhymes('coração', 'canção', 'pt')).toBe(true);
  });

  it('French and German: the word as it is said', () => {
    expect(rhymes('fils', 'lys', 'fr')).toBe(true);
    expect(rhymes('ville', 'fille', 'fr')).toBe(false);
    expect(rhymes('temps', 'vent', 'fr')).toBe(true);
    // "-ent" is a nasal vowel in a noun and silent in a verb; the spelling rule could not tell.
    expect(rhymes('parlent', 'moment', 'fr')).toBe(false);
    expect(syllablesInLine('Ils parlent tous', 'fr')).toBe(4);
    expect(syllablesInLine('Ils parlent', 'fr')).toBe(2);
    expect(syllablesInLine('Un moment', 'fr')).toBe(3);
    expect(rhymes('Blick', 'zurück', 'de')).toBe(true);
    expect(rhymes('Nacht', 'Licht', 'de')).toBe(false);
    // A compound the table lacks rhymes, and is counted, on its last element.
    expect(soundOf('de', 'zauberversgedicht')).toBeUndefined();
    expect(rhymes('Zauberversgedicht', 'Gesicht', 'de')).toBe(true);
    expect(syllablesInWord('Zauberversgedicht', 'de')).toBe(5);
    expect(syllablesInWord('Treue', 'de')).toBe(2);
    expect(syllablesByRule('Treue', 'de')).toBe(2);
  });

  it('Chinese: the rhyme group of the last character, read as the word it closes', () => {
    expect(rhymes('光', '乡', 'zh')).toBe(true);
    expect(rhymes('来', '开', 'zh')).toBe(true);
    expect(rhymes('光', '来', 'zh')).toBe(false);
    // The same character twice is not a rhyme.
    expect(rhymes('月光', '日光', 'zh')).toBe(false);
    // 行 is háng in 银行 and xíng in 流行: the word decides.
    expect(rhymes('银行', '太阳', 'zh')).toBe(true);
    expect(rhymes('流行', '太阳', 'zh')).toBe(false);
    expect(rhymes('流行', '流星', 'zh')).toBe(true);
    expect(rhymeEnds('举头望明月', '低头思故乡', 'zh')).toEqual(['头望明月', '头思故乡']);
    // What the two published schemes join: e with ie (中华通韵's 鹅), e with o and uo (十三辙's 梭波).
    expect(rhymes('歌', '夜', 'zh')).toBe(true);
    expect(rhymes('歌', '我', 'zh')).toBe(true);
    expect(rhymes('月', '雪', 'zh')).toBe(true);
    // What neither joins: o and uo with ie and üe. Until 2026-11-16 these passed.
    expect(rhymes('我', '夜', 'zh')).toBe(false);
    expect(rhymes('躲', '灭', 'zh')).toBe(false);
  });

  it('Japanese: reads kanji, counts sounds, rhymes on the last two', () => {
    expect(syllablesInLine('古池や', 'ja')).toBe(5);
    expect(syllablesInLine('蛙飛び込む', 'ja')).toBe(7);
    expect(syllablesInLine('水の音', 'ja')).toBe(5);
    expect(syllablesInLine('ふるいけや', 'ja')).toBe(5);
    // Latin letters and digits have no reading.
    expect(syllablesInLine('ABCの音', 'ja')).toBeNull();
    expect(japaneseTokens('今日は')?.map((t) => [t.kana, t.spoken])).toEqual([['きょう', 'きょー'], ['は', 'わ']]);
    const [a, b] = rhymeEnds('お前の言葉は風に散る花', 'わたしの詩こそ闇を裂く刀', 'ja');
    expect([a, b]).toEqual(['はな', 'かたな']);
    expect(rhymes(a, b, 'ja')).toBe(true);
    expect(rhymes('花', '刀', 'ja')).toBe(true);
    expect(rhymes('花', '月', 'ja')).toBe(false);
    // Lines closing on the same word are compared on the word before it.
    expect(rhymeEnds('それは花だ', 'これは刀だ', 'ja')).toEqual(['はな', 'かたな']);
  });

  it('Japanese without the analyser reads kana only, as before', () => {
    const keep = japaneseTokens('古池や');
    expect(keep).not.toBeNull();
    setJapaneseAnalyser(null);
    markSound('ja', false);
    try {
      expect(syllablesInLine('古池や', 'ja')).toBeNull();
      expect(syllablesInLine('ふるいけや', 'ja')).toBe(5);
      expect(rhymeChecked('ja')).toBe(false);
    } finally {
      // loadSound puts the analyser back: the module that holds it is still loaded.
    }
  });

  it('puts the Japanese analyser back', async () => {
    const { unloadJapanese } = await import('./ja');
    unloadJapanese();
    expect(await loadSound('ja')).toBe(true);
    expect(syllablesInLine('古池や', 'ja')).toBe(5);
    expect(rhymeChecked('ja')).toBe(true);
  });

  it('Thai: the last syllable of the dictionary word a line ends on, or of its spelling', () => {
    expect(rhymes('ใจ', 'ไป', 'th')).toBe(true);
    expect(rhymes('ความรัก', 'หนัก', 'th')).toBe(true);
    // A long vowel does not rhyme with a short one.
    expect(rhymes('วัน', 'นาน', 'th')).toBe(false);
    expect(rhymes('รัก', 'รัก', 'th')).toBe(false);
    expect(thaiEnd('กลอนของเจ้าเบาเหมือนควันไฟ')).toMatchObject({ keys: ['aj'], known: true });
    // The spelling patterns, for an ending the table lacks.
    for (const [text, rime] of [['กัน', 'an'], ['บ้าน', 'aːn'], ['เมีย', 'ia'], ['เรือน', 'ɯan'], ['ใจ', 'aj'], ['เขา', 'aw'], ['คน', 'on'], ['จันทร์', 'an'], ['น้ำ', 'am']] as const) {
      expect([text, thaiRimeBySpelling(text)]).toEqual([text, rime]);
    }
    for (const [text, rime] of [['ทาง', 'aːŋ'], ['ลง', 'oŋ'], ['รัก', 'ak'], ['บาท', 'aːt'], ['ภาพ', 'aːp'], ['ลม', 'om'], ['สาย', 'aːj'], ['ขาว', 'aːw']] as const) {
      expect([text, thaiRimeBySpelling(text)]).toEqual([text, rime]);
    }
    // The patterns against the whole dictionary: they must read the last rime of at least nine words in ten
    // as the dictionary does, vowel length included (measured 2026-11-16: see PHONETICS.md).
    const entries = soundEntries('th');
    const agree = entries.filter(([word, value]) => value.slice(1).split('|').includes(thaiRimeBySpelling(word) ?? '')).length;
    expect([entries.length > 15000, agree / entries.length >= 0.85]).toEqual([true, true]);
    expect(thaiSyllables('ความรัก')).toBe(2);
    // A stretch the table cannot cut into words is not counted, rather than guessed.
    expect(thaiSyllables('ะะะ')).toBeNull();
  });

  it('Hindi: counts the vowels that are said', () => {
    for (const [word, n] of [['रात', 1], ['कमल', 2], ['लड़का', 2], ['समझना', 3], ['आदमी', 2], ['जानवर', 2], ['कविता', 3], ['पंक्ति', 2]] as const) {
      expect([word, hindiSyllablesByRule(word)]).toEqual([word, n]);
    }
    expect(syllablesInLine('तेरी कविता', 'hi')).toBe(5);
    expect(rhymes('दीपक', 'नाटक', 'hi')).toBe(true);
    expect(rhymes('इतरा', 'घबरा', 'hi')).toBe(true);
    expect(rhymes('रात', 'दिन', 'hi')).toBe(false);
  });

  it('Arabic: the rhyme letter, its long vowels, and its vowel where the text shows it', () => {
    expect(rhymes('كتاب', 'باب', 'ar')).toBe(true);
    expect(rhymes('حَنْظَلِ', 'مِحْمَلِي', 'ar')).toBe(true);
    // The same rhyme letter with different written vowels is not a rhyme.
    expect(rhymes('حَنْظَلِ', 'مَنْزِلُ', 'ar')).toBe(false);
    // A long vowel before the rhyme letter must be answered.
    expect(rhymes('قمر', 'نور', 'ar')).toBe(false);
    expect(syllablesInLine('قمر', 'ar')).toBeNull();
  });

  it('Polish, Vietnamese, Korean: by rule, with no table', () => {
    expect(rhymes('chleb', 'sklep', 'pl')).toBe(true);
    expect(rhymes('łono', 'utęsknioną', 'pl')).toBe(true);
    expect(rhymes('noc', 'dzień', 'pl')).toBe(false);
    expect(rhymes('dâu', 'đau', 'vi')).toBe(true);
    expect(rhymes('tàn', 'tán', 'vi')).toBe(false);
    expect(rhymes('an', 'ang', 'vi')).toBe(false);
    expect(rhymes('사랑', '자랑', 'ko')).toBe(true);
  });
});
