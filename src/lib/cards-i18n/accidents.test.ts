// The signature and the invocation must not land by accident: on a pronoun, a particle, a piece of a word, a
// toneless prefix or a title. These are the verses an independent check found landing (2026-11-16), and the rate
// at which verses that were not written for any card land on a character card, in every language.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { DEVICES, checkSignature, invocationNames } from '../verse/devices';
import { scoreVerse } from '../verse/duel';
import { getForm } from '../verse/forms';
import { capitalOnlyNames, localCharacterNames, localSignatureWords, RECITE_LETTERS, saidLocalName, saysWord, wordKey } from '../verse/echo';
import { getPack, loadAllPacks, PACK_LANGS } from '../verse/packs';
import { installSound, loadSound } from '../verse/sound';
import { wordsOf } from '../verse/text';
import { CARD_TEXT_LANGS, getCardText, loadAllCardText, localEchoText, localQuote } from './index';

// As duel.ts builds it (CHARACTER_NAMES): the full names, and the last part of each where it is a name.
const NAMES = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));
const CHARACTERS = CARD_CATALOG.filter((c) => c.type === 'Character');
/** wordfreq's 40,000 commonest words of each language (the Thai National Corpus for Thai) that come near a name (fetch/wordfreq_near_names.py). */
const NEAR_WF = JSON.parse(readFileSync('docs/language/sources/wordfreq-near-names.json', 'utf8')) as { words: Record<string, string[]> };

beforeAll(async () => {
  await loadAllPacks();
  await loadAllCardText();
  // The Thai invocation reads the words beside a name against the pronunciation table, as a Thai duel loads it.
  await loadSound('th');
});

const sig = (id: string, verse: string, lang: string) => checkSignature(getCardById(id)!, verse, lang);
const landed = (verse: string, lang: string) =>
  CARD_CATALOG.map((c) => [c.id, checkSignature(c, verse, lang)] as const).filter(([, r]) => r.met).map(([id, r]) => `${id}:${r.detail}`);
const inv = (verse: string, lang: string) => DEVICES.invocation.check(verse, { lang, names: NAMES });

/** Verses written for forms, not for cards: the written opponent's verses and the acrostic lines of a language. */
function neutral(lang: string): string[] {
  const p = getPack(lang);
  return [...Object.values(p.written).flat(), ...Object.values(p.acrosticLines).flat()];
}

/** How often a neutral verse lands the signature on a character card, and the invocation at all. */
function rates(lang: string) {
  const verses = neutral(lang);
  let sigHits = 0;
  let invHits = 0;
  const words: Record<string, number> = {};
  const names: Record<string, number> = {};
  for (const v of verses) {
    const r = inv(v, lang);
    if (r.met) { invHits++; names[r.detail] = (names[r.detail] ?? 0) + 1; }
    for (const c of CHARACTERS) {
      const s = checkSignature(c, v, lang);
      if (s.met) { sigHits++; words[s.detail] = (words[s.detail] ?? 0) + 1; }
    }
  }
  return { lang, verses: verses.length, sig: sigHits / (verses.length * CHARACTERS.length), inv: invHits / verses.length, words, names };
}

describe('controls: a real echo and a real name still land', () => {
  it('in English, and in each language below', () => {
    // A line with three or more telling words needs two of them (devices.ts signatureNeeded), in every language.
    expect(sig('CA-001', 'my rose has no name tonight', 'en').met).toBe(true);
    expect(sig('CA-001', 'a rose would bloom upon the stage tonight', 'en').code).toBe('hint-two');
    expect(landed('You lost, and I won tonight', 'en')).toEqual([]);
    expect(sig('MO-002', 'โรคร้ายจงตามไปถึงตระกูล', 'th').met).toBe(true); // โรค and ตระกูล, words of the line
    expect(sig('MO-002', 'โรคร้ายจงตามไป', 'th').code).toBe('hint-two');
    expect(sig('DC-004', 'Trái tim ta, hoàng tử, không vỡ', 'vi').met).toBe(true); // trái tim, hoàng tử
    expect(sig('MO-003', '평화를 원하느냐, 칼을 내려라', 'ko').met).toBe(true); // 평화를, 칼을
    expect(sig('MO-003', '平和はいらない、和睦などない', 'ja').met).toBe(true); // 和睦, the line's one telling word
    expect(sig('MO-003', '和平不属于你，收起刀吧', 'zh').met).toBe(true); // 和平, 收起
    expect(sig('MO-003', '和平不属于你', 'zh').code).toBe('hint-two');
    expect(inv('Marc Antoine parle', 'fr').met).toBe(true);
    expect(inv('Antoine parle', 'fr').met).toBe(true);
    // «próspero» is also "prosperous": the name counts written with a capital inside a sentence (round 3, second check).
    expect(inv('Y Próspero alza las manos', 'es').met).toBe(true);
    expect(inv('Próspero alza las manos', 'es').met).toBe(false);
    expect(inv('Персефона спит', 'ru').met).toBe(true);
    expect(inv('Зову Персефону', 'ru').met).toBe(true);
    expect(inv('Lãnh chúa Montague đã đến', 'vi').met).toBe(true);
    expect(inv('Montague đã đến', 'vi').met).toBe(true);
  });
});

describe('verses that echo no line and name nobody land nothing', () => {
  it('th "You have lost, tonight the stage is mine": เจ้า ("you") is a pronoun', () => {
    expect(landed('เจ้าแพ้แล้ว คืนนี้เวทีเป็นของข้า', 'th')).toEqual([]);
  });
  it('vi "O people, tonight the stage is mine": ngủ is not the start of người; tones tell words apart', () => {
    // Before: DC-004 and PT-004 on "ngu" (ngủ, "sleep", without its tone), PT-008 on "san", GC-001, GC-003 and LD-004 on
    // "đem" (đêm and đem, "bring", folded together). Until the two-word rule, đêm ("night", which this verse says in
    // đêm nay, "tonight") landed Byron's and Poe's lines; each of those has more than two telling words, so one is not enough.
    expect(landed('Người ơi, đêm nay sân khấu là của ta', 'vi')).toEqual([]);
    expect(sig('GC-001', 'Người ơi, đêm nay sân khấu là của ta', 'vi').code).toBe('hint-two');
    expect(saysWord('ngủ', 'Người ơi', 'vi')).toBe(false);
    expect(saysWord('đem', 'đêm nay', 'vi')).toBe(false);
    expect(saysWord('đêm', 'đêm nay', 'vi')).toBe(true);
    // One spelling, two places for the tone mark.
    expect(wordKey('hoà', 'vi')).toBe(wordKey('hòa', 'vi'));
    expect(wordKey('ngủ', 'vi')).not.toBe(wordKey('ngu', 'vi'));
  });
  it('ko "I am the master of the stage tonight": 나는 is "I" with its particle', () => {
    // Before: eleven cards on 나는. Then 주인이다, "is the master", which Zeus's line also says (넓은 하늘의 주인이다,
    // "master of the wide heavens"): a real echo, but one word of five, and the line needs two.
    expect(landed('나는 오늘 밤 무대의 주인이다', 'ko')).toEqual([]);
    expect(sig('OL-001', '나는 오늘 밤 무대의 주인이다', 'ko').code).toBe('hint-two');
    expect(sig('OL-001', '나는 넓은 무대의 주인이다', 'ko').met).toBe(true);
  });
  it('ja "You lost. I won.": あなた and した are not telling words', () => {
    expect(landed('あなたは負けました。私が勝ちました。', 'ja')).toEqual([]);
  });
  it('zh "Your verse is too weak": 你的 is "your"', () => {
    expect(landed('你的诗太弱了', 'zh')).toEqual([]);
  });
  it('fr and it: an elided article or pronoun is not part of the word (c’est is "est"; l’amour is "amour")', () => {
    const fr = CARD_CATALOG.flatMap((c) => localSignatureWords(c, 'fr'));
    expect(fr.filter((w) => /['’]/.test(w) && /^(l|m|t|qu|n|s|j|d|c)['’]/i.test(w))).toEqual([]);
    expect(landed('C’est la nuit, j’ai froid', 'fr').filter((h) => /:(c’est|j’ai|est|ai)$/i.test(h))).toEqual([]);
    expect(sig('DC-001', 'Ma question, c’est la nuit', 'fr').met).toBe(true);
    expect(inv('Où est la dague d’Hamlet', 'fr').met).toBe(true);
  });
  it('no invocation from a word that only begins like a name, or a title, or a common word that is also an alias', () => {
    expect(inv('Mọi thứ đều lạnh', 'vi').met).toBe(false);
    expect(inv('Một phút hạnh phúc', 'vi').met).toBe(false);
    expect(inv('Je marche dans la nuit', 'fr').met).toBe(false);
    expect(inv('La prosperidad del alba', 'es').met).toBe(false);
    expect(inv('Кора старого дуба', 'ru').met).toBe(false);
    expect(inv('Старый граф спит', 'ru').met).toBe(false);
    expect(inv('I march into the night', 'en').met).toBe(false);
    // The English names count in every language, but a Vietnamese word with a tone is not one: màn is not "Man" (which,
    // since the integration, counts only inside "Sonnet Man" anyway).
    expect(inv('Bức màn khép lại', 'vi').met).toBe(false);
    expect(inv('Hamlet ơi', 'vi').met).toBe(true);
  });
});

describe('no telling word is a function word', () => {
  it('in any language, by the stop list and Wiktionary’s function words', () => {
    for (const lang of PACK_LANGS) {
      if (lang === 'en') continue;
      const stop = new Set(getCardText(lang)!.stop.map((w) => wordKey(w, lang)));
      for (const c of CARD_CATALOG) for (const w of localSignatureWords(c, lang)) expect([lang, c.id, w, stop.has(wordKey(w, lang))]).toEqual([lang, c.id, w, false]);
    }
  });
  it('the words the check found are on the lists now', () => {
    const stop = (lang: string) => new Set(getCardText(lang)!.stop.map((w) => wordKey(w, lang)));
    for (const [lang, w] of [['th', 'เจ้า'], ['ko', '나는'], ['ko', '저는'], ['ja', 'あなた'], ['ko', '그대']] as const) {
      expect([lang, w, stop(lang).has(wordKey(w, lang))]).toEqual([lang, w, true]);
    }
    // Korean: a pronoun with its particle; Chinese: a word made only of stop characters; Japanese: no kanji or katakana.
    // A particle only follows the kind of syllable it can follow: 나이 ("age") is not the pronoun 나 with the subject
    // particle 이 (after 나 that particle is 가), and 오필리아 is not 오필리 with the vocative 아 (which follows a consonant).
    expect(saysWord('나이', '나이를 먹는다', 'ko')).toBe(true);
    expect(saysWord('오필리아', '오필리아를 부른다', 'ko')).toBe(true);
    expect(saysWord('오필리아', '오필리를 부른다', 'ko')).toBe(false);
    expect(saysWord('햄릿', '햄릿을 부른다', 'ko')).toBe(true);
    expect(saysWord('햄릿', '햄릿를 부른다', 'ko')).toBe(false); // 를 follows only a vowel
    const ko = CARD_CATALOG.flatMap((c) => localSignatureWords(c, 'ko'));
    expect(ko.filter((w) => /^(나|너|저|우리|그대|당신|그녀)(는|은|를|을|가|이|의|에게)$/.test(w))).toEqual([]);
    const ja = CARD_CATALOG.flatMap((c) => localSignatureWords(c, 'ja'));
    expect(ja.filter((w) => !/[\p{Script=Han}\p{Script=Katakana}]/u.test(w))).toEqual([]);
    const zh = CARD_CATALOG.flatMap((c) => localSignatureWords(c, 'zh'));
    expect(zh.filter((w) => ['你的', '我的', '他的', '我们', '你们'].includes(w))).toEqual([]);
  });
});

describe('the rate of accidental landings', () => {
  // Measured on the Studio, 2026-11-17, with the two-word rule: English lands the signature on a given character card
  // for 0.18% of neutral verses, and the invocation for none; every other language 0.33% or less (Vietnamese 0.27%,
  // 6.0% before its words of several syllables were read whole), and the invocation for none. Before the 2026-11-16
  // fixes: vi 12.5%, th 10.4%, ko 4.7%, ja 3.9% for the signature, and vi 31% for the invocation.
  it('is no worse than twice English, or 1%, in any language', { timeout: 120000 }, () => {
    const en = rates('en');
    const rows = PACK_LANGS.map((l) => rates(l));
    console.log('ACCIDENT-RATES ' + JSON.stringify(rows.map((r) => ({ lang: r.lang, verses: r.verses, sig: +r.sig.toFixed(4), inv: +r.inv.toFixed(3) }))));
    console.log('ACCIDENT-DETAIL ' + JSON.stringify(Object.fromEntries(rows.map((r) => [r.lang, {
      words: Object.entries(r.words).sort((a, b) => b[1] - a[1]).slice(0, 15), names: r.names,
    }]))));
    for (const r of rows) {
      expect([r.lang, 'signature', r.sig <= Math.max(2 * en.sig, 0.01)]).toEqual([r.lang, 'signature', true]);
      expect([r.lang, 'invocation', r.inv <= Math.max(2 * en.inv, 0.02)]).toEqual([r.lang, 'invocation', true]);
    }
  });
});

/** Letters with their marks, as RECITE_LETTERS counts them (a Thai vowel sign or tone mark counts). */
const marked = (t: string) => [...t.normalize('NFC').replace(/[^\p{L}\p{M}]/gu, '')].length;

describe('an echo in Chinese or Japanese is not taken for a quotation', () => {
  it('the check’s verse: 薔薇の花は is an echo, not Tsubouchi’s line', () => {
    // Tsubouchi's line has four telling words (薔薇, 他の, 同じ, 善い), so two are needed.
    expect(sig('CA-001', 'だれが私の舞台に立つのか？\n薔薇の花は同じ夜に眠る', 'ja').code).toBe('echoed');
    expect(sig('CA-001', '薔薇が同じ夜に眠る', 'ja').code).toBe('echoed');
    expect(sig('CA-001', 'だれが私の舞台に立つのか？\n薔薇の花は夜に眠る', 'ja').code).toBe('hint-two');
    expect(sig('CA-001', localQuote(getCardById('CA-001')!, 'ja')!, 'ja').code).toBe('quoted');
  });
  it('four of the segmenter’s words that are only a few letters are not a recital; a run of the line as long as four English words is', () => {
    let short = 0;
    for (const lang of ['zh', 'ja', 'th'] as const) {
      for (const c of CHARACTERS) {
        const line = localEchoText(c, lang);
        if (!line) continue;
        const w = wordsOf(line, lang);
        for (let i = 0; i + 4 <= w.length; i++) {
          const run = w.slice(i, i + 4).join('');
          if (marked(run) >= RECITE_LETTERS[lang] || marked(run) >= marked(line)) continue;
          short++;
          expect([lang, c.id, run, checkSignature(c, run, lang).code]).not.toEqual([lang, c.id, run, 'quoted']);
          break;
        }
        const letters = [...line.replace(/[^\p{L}\p{M}]/gu, '')];
        if (letters.length > RECITE_LETTERS[lang]) {
          const run = letters.slice(0, RECITE_LETTERS[lang] + 2).join('');
          const r = checkSignature(c, run, lang);
          // A run with too few telling words in it is told what to echo ('hint', 'hint-two'), and a card with none has none ('none').
          if (!['hint', 'hint-two', 'none'].includes(r.code ?? '')) expect([lang, c.id, run, r.code]).toEqual([lang, c.id, run, 'quoted']);
        }
      }
    }
    // The check counted 84 such lines in Chinese and Japanese; there must be some, or this proves nothing.
    expect(short).toBeGreaterThan(40);
  });
  it('RECITE_LETTERS is four English words’ worth of each language’s lines, measured again here', () => {
    const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    for (const lang of ['zh', 'ja', 'th'] as const) {
      const ratios = CARD_CATALOG.filter((c) => localQuote(c, lang)).map((c) => [...(localEchoText(c, lang) ?? '').normalize('NFC').replace(/[^\p{L}\p{M}]/gu, '')].length / wordsOf(c.quote, 'en').length);
      expect([lang, Math.round(4 * median(ratios))]).toEqual([lang, RECITE_LETTERS[lang]]);
    }
  });
});

describe('a line of two or three words recited whole is a quotation', () => {
  it('in every language', () => {
    let n = 0;
    for (const lang of PACK_LANGS) {
      if (lang === 'en' || ['zh', 'ja', 'th'].includes(lang)) continue;
      for (const c of CARD_CATALOG) {
        const q = localQuote(c, lang);
        if (!q || !localSignatureWords(c, lang).length) continue;
        const k = wordsOf(q, lang).length;
        if (k < 2 || k > 3) continue;
        n++;
        expect([lang, c.id, q, checkSignature(c, q, lang).code]).toEqual([lang, c.id, q, 'quoted']);
      }
    }
    // The check found these: es, pt, ar and id RL-007, de PT-007, ru RL-001.
    expect(n).toBeGreaterThanOrEqual(5);
  });
});

describe('names', () => {
  it('a title or a common word in a longer name is not a name by itself; the full name and the name are', () => {
    expect(localCharacterNames('vi')).not.toContain('Phu');
    expect(localCharacterNames('vi')).not.toContain('Lãnh');
    expect(localCharacterNames('vi')).toContain('Capulet');
    expect(localCharacterNames('vi')).toContain('Phu nhân Capulet');
    expect(localCharacterNames('ru')).not.toContain('граф');
    expect(localCharacterNames('ru')).not.toContain('Кора');
    expect(localCharacterNames('ru')).toContain('Парис');
    expect(localCharacterNames('fr')).not.toContain('Marc');
    expect(localCharacterNames('fr')).toContain('Antoine');
    // The product name counts whole, not as "The", "Sonnet" and "Man".
    expect(localCharacterNames('es')).not.toContain('Man');
  });
  it('the Hunspell verdicts cover every word the invocation could count by itself (run.sh names after a name changes)', async () => {
    const { readFileSync } = await import('node:fs');
    const checked = JSON.parse(readFileSync('docs/language/checks/name-words.json', 'utf8')).languages as Record<string, { checked: string[] }>;
    const SPLIT = /[\s・·‧]+/u;
    const clean = (s: string) => s.replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, '');
    for (const lang of PACK_LANGS) {
      if (lang === 'en') continue;
      const pack = getCardText(lang)!;
      const have = new Set(checked[lang]?.checked ?? []);
      for (const c of CHARACTERS) {
        const e = pack.cards[c.id];
        if (!e.name || e.nameSource === 'missing' || e.nameSource === 'kept') continue;
        const parts = clean(e.name.replace(/,.*$/u, '')).split(SPLIT).map(clean).filter(Boolean);
        // A name of one word too: it may also be an ordinary word (Spanish «Bruto»), which needs Hunspell's verdict as well as Wiktionary's.
        for (const w of [...parts, ...(e.aliases ?? []).map(clean)]) {
          if (w && !SPLIT.test(w)) expect([lang, c.id, w, have.has(w)]).toEqual([lang, c.id, w, true]);
        }
      }
    }
  });
});

describe('the German signature shows a noun as the line writes it', () => {
  it('Rose, not rose', () => {
    const words = CARD_CATALOG.flatMap((c) => localSignatureWords(c, 'de'));
    expect(words.some((w) => /^\p{Lu}/u.test(w))).toBe(true);
    const juliet = localSignatureWords(getCardById('CA-001')!, 'de');
    expect(juliet.filter((w) => w.toLowerCase() === 'rose')).toEqual(juliet.filter((w) => w.toLowerCase() === 'rose').map(() => 'Rose'));
  });
});

// The second check (2026-11-17) found names landing through Snowball stems that words naming nobody share.
describe('a name is not invoked by a word that only shares its stem', () => {
  it('German «wartest» is not the Nurse, Arabic Rome and the Romans are not Romeo nor «بلى» Blake, a Russian stamp or jellyfish is no one', () => {
    const cases = [
      ['Ich warte auf den Morgen', 'de'], ['Am Ende stehst du da und wartest auf die Niederlage', 'de'],
      ['أحببت روما أكثر', 'ar'], ['أيها الرومان', 'ar'], ['بلى، سأبقى', 'ar'],
      ['Я наклеил марку на конверт', 'ru'], ['Я видел медузу в море', 'ru'],
    ] as const;
    for (const [v, l] of cases) expect([l, v, inv(v, l).met]).toEqual([l, v, false]);
    // German's own verses: the 2.3% the record put down to the Nurse's name was «wartest».
    expect(Object.keys(rates('de').names)).not.toContain('Wärterin');
  });
  it('a declined name still invokes, and so does the name however it is written', () => {
    // «Марка» and Polish «Marka» are also forms of "a stamp", "a brand" (марка, marka), so Hunspell dropped them: Mark
    // Antony is invoked there by his last name, as in English.
    const cases = [
      ['Ich rufe Romeo', 'de', 'Romeo'], ['Romeos Ring glänzt', 'de', 'Romeo'], ['Hamlets Frage', 'de', 'Hamlet'], ['Julias Brief', 'de', 'Julia'],
      ['أنا وروميو', 'ar', 'روميو'], ['Я вижу Марка Антония', 'ru', 'Антоний'], ['Зову Джульетту', 'ru', 'Джульетта'],
      ['Я видел Медузу', 'ru', 'Медуза'], ['А Медуза спит', 'ru', 'Медуза'], ['Я видел Афину-Палладу', 'ru', 'Афина-Паллада'], ['Вот Марк Антоний', 'ru', 'Марк Антоний'],
      ['Kocham Julię', 'pl', 'Julia'], ['Widzę Marka Antoniusza', 'pl', 'Antoniusz'], ['Widzę Antoniusza', 'pl', 'Antoniusz'],
      ['O Hamlecie śnię', 'pl', 'Hamlet'], ['Pieśń Blake\'a', 'pl', 'Blake'], ['Zeusowi chwała', 'pl', 'Zeus'],
    ] as const;
    for (const [v, l, name] of cases) expect([l, v, inv(v, l).detail]).toEqual([l, v, name]);
  });
});

// The third check (2026-11-17) found the case-ending rule above still letting common words in: every name took every
// noun ending. A name now takes only the forms its paradigm has, less those Hunspell knows as ordinary words
// (pack.forms, docs/language/checks/name-forms.json).
describe('no ordinary word invokes a character, however it declines', () => {
  /** A Rome-house card, whose device is the Invocation, on the couplet form: what the duel itself scores. */
  const device = (verse: string, lang: string) =>
    scoreVerse({ verse, form: getForm('couplet'), ctx: { lang }, card: getCardById('RM-001')!, deckCharacters: ['RM-001', 'RM-002', 'RM-003'] }).device;
  it('the third check’s verses: child, banks, Athens, bubble, bark, imaginations and Bangkok name nobody', () => {
    const cases = [
      ['ru', 'Дитя моё, усни под шум дождя\nЛуна плывёт над тихою рекой'], // Дит (Dis) + я
      ['ru', 'Банки закрыты, город спит\nИ ветер в окна мне стучит'], // Банко does not decline in Russian
      ['ru', 'В Афинах ночь темна и холодна\nИ над морем светит мне луна'], // Athens; a name has no plural forms
      ['pl', 'W Atenach noc jest ciemna i zła\nA nad morzem świeci gwiazda ma'],
      ['pl', 'Banku nie ma, miasto śpi\nWiatr do okna puka mi'], // of a bank (Hunspell), not of Banquo
      ['pl', 'Bańka pękła, miasto śpi\nWiatr do okna puka mi'], // a bubble: ń is not n
      ['pl', 'Kora drzewa, miasto śpi\nWiatr do okna puka mi'], // bark; Kore does not decline
      ['ar', 'تسكنني الأخيلة في الليل\nوالقمر يضيء الطريق'], // "imaginations", not Achilles
      ['ar', 'سافرت إلى بانكوك\nوالقمر يضيء الطريق'], // Bangkok, not Banquo
    ] as const;
    for (const [l, v] of cases) {
      const d = device(v, l);
      expect([l, v, d.id, d.met]).toEqual([l, v, 'invocation', false]);
    }
    // And the names themselves still land it.
    for (const [l, v] of [['ru', 'Брут, ты предал всё, что знал\nИ нож в руке твоей дрожал'], ['ru', 'Я вижу Марка Антония\nИ нож в руке твоей дрожал'],
      ['pl', 'Widzę Marka Antoniusza\nWiatr do okna puka mi'], ['ar', 'أنا وروميو\nوالقمر يضيء الطريق']] as const) {
      expect([l, v, device(v, l).met]).toEqual([l, v, true]);
    }
  });

  const NEAR = JSON.parse(readFileSync('docs/language/sources/opensubtitles-near-names.json', 'utf8')) as { words: Record<string, string[]> };
  const capital = (w: string) => w.charAt(0).toLocaleUpperCase() + w.slice(1);
  /** Every word of the subtitle lists near a name (scripts/language/fetch/near_names.py), as written and with a capital, that invokes. */
  const scan = () => {
    const hits: { lang: string; word: string; name: string }[] = [];
    for (const [lang, words] of Object.entries(NEAR.words)) {
      for (const w of words) for (const s of new Set([w, capital(w)])) {
        const r = inv(s, lang);
        if (r.met) hits.push({ lang, word: s, name: r.detail });
      }
    }
    return hits;
  };
  let hits: ReturnType<typeof scan> = [];
  beforeAll(() => {
    hits = scan();
  }, 600_000);

  it('the 50,000 commonest words in film subtitles: only a name, or a form listed for it, invokes', () => {
    // A name or a listed form, in any case; the English names count in every language as English writes them.
    const nameWord = (lang: string, word: string, name: string) => {
      const k = wordKey(word, lang).replace(/[.]$/u, '');
      const words = (name.match(/[\p{L}\p{M}'’\-]+/gu) ?? []).map((w) => wordKey(w, lang));
      const forms = Object.entries(getCardText(lang)?.forms ?? {}).filter(([w]) => words.includes(wordKey(w, lang))).flatMap(([, fs]) => fs.map((f) => wordKey(f, lang)));
      return words.includes(k) || forms.includes(k) || words.includes(k.replace(/-.*$/u, '')) || (lang === 'ko' && words.some((w) => k.startsWith(w)));
    };
    const strays = hits.filter((h) => !nameWord(h.lang, h.word, h.name)).map((h) => `${h.lang} ${h.word} -> ${h.name}`);
    expect(strays).toEqual([]);
    expect(hits.length).toBeGreaterThan(500); // the scan reads the names it should
  });

  it('the declined forms that occur in subtitles are forms of the name (read one by one); two are also other names', () => {
    const declined = hits.filter((h) => ['ru', 'pl', 'de', 'ar'].includes(h.lang) && wordKey(h.word, h.lang) !== wordKey(h.name.split(/\s+/).pop()!, h.lang));
    expect(declined.map((h) => `${h.lang} ${h.word}`).sort()).toEqual([
      'ar لباريس', // "to Paris"
      // Gone since the second check of round 3: the forms of a name that is also an ordinary word (Blake, «blake»; Meduza,
      // a jellyfish; Polish «romeo»; Пак, pack ice; Медуза), which open a line here: de Blakes, pl Meduzy, pl Romea, ru Медузы, ru Пака.
      'de Julias', 'de Mirandas',
      'pl Ateny', // also Athens (Hunspell: a proper noun), kept as English keeps Paris
      'pl Hamleta', 'pl Julie', /* Julię typed without its ogonek */ 'pl Julii', 'pl Julio', 'pl Julię', 'pl Mirandy', 'pl Mirando', 'pl Mirandę',
      'pl Zeusa',
      'ru Аида', // also Aida (not in Hunspell's dictionary), the genitive of Аид
      'ru Антония', 'ru Афины', /* also Athens, as Polish Ateny */ 'ru Байрона', 'ru Блейка', 'ru Гамлета', 'ru Джульетте', 'ru Джульетту', 'ru Джульетты',
      'ru Зевса', 'ru Клавдия', /* also the name Klavdiya (Hunspell) */ 'ru Миранды', 'ru Миранду', 'ru Оливией', 'ru Оливии', 'ru Оливию',
    ].sort());
  });

  it('every word of every name has its forms on record (run.sh forms after a name changes)', () => {
    const rec = JSON.parse(readFileSync('docs/language/checks/name-forms.json', 'utf8')).languages as Record<string, Record<string, unknown>>;
    for (const lang of ['ru', 'pl', 'de', 'ar']) {
      const pack = getCardText(lang)!;
      for (const c of CHARACTERS) {
        const e = pack.cards[c.id];
        if (!e.name || e.nameSource === 'missing' || e.nameSource === 'kept') continue;
        for (const t of [e.name.replace(/,.*$/u, ''), ...(e.aliases ?? [])]) {
          for (const w of t.match(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu) ?? []) expect([lang, c.id, w, w in rec[lang]]).toEqual([lang, c.id, w, true]);
        }
      }
      // Every form in the card text is one the record kept.
      for (const [w, fs] of Object.entries(pack.forms ?? {})) expect([lang, w, fs]).toEqual([lang, w, (rec[lang][w] as { forms: string[] }).forms]);
    }
  });
});

describe('given names, titles and accents count as English counts them', () => {
  it('Thai «แมรี» (Mary) alone is not Mary Shelley; Portuguese «põe» is not Poe; French «prince» is no one', () => {
    expect(localCharacterNames('th')).not.toContain('แมรี');
    expect(localCharacterNames('th')).toContain('เชลลีย์');
    expect(inv('แมรีเดินไป', 'th').met).toBe(false);
    expect(inv('แมรี เชลลีย์ เขียน', 'th').detail).toBe('แมรี เชลลีย์');
    expect(inv('Ele põe a mesa', 'pt').met).toBe(false);
    expect(inv('Poe escreve', 'pt').met).toBe(true);
    expect(inv('Le prince arrive', 'fr').met).toBe(false);
    // Korean puts a title after the name: Lady Macbeth (맥베스 부인) is called by 맥베스. Poe's 포 is also a word (a cannon),
    // so it counts only in the full name, and Allan alone is no one, as in English.
    expect(inv('맥베스가 왔다', 'ko').met).toBe(true);
    expect(inv('에드거 앨런 포', 'ko').met).toBe(true);
    expect(inv('앨런이 왔다', 'ko').met).toBe(false);
  });
  it('an English word of the line is said as English writes it: Vietnamese «rosé» is not "rose"', () => {
    // Juliet's Vietnamese line has five telling words, so two are needed; tên ("name") is one, and "rose" may be the other.
    expect(sig('CA-001', 'tên rose', 'vi').met).toBe(true);
    expect(sig('CA-001', 'tên rosé', 'vi').code).toBe('hint-two');
  });
});

describe('a verse word with an accent the name lacks is another word', () => {
  it('Spanish «París» is the city; Count Paris is «Paris» in Spanish, and still lands; typed without accents a name still counts', () => {
    // The concern of the second check of round 3: nothing held this rule. The Spanish card text names him «Conde Paris»
    // (Wikidata), and Spanish writes the Trojan and Shakespeare's Paris without the accent, the city with it.
    expect(inv('Me voy a París esta noche', 'es').met).toBe(false);
    expect(inv('El conde Paris llega', 'es').detail).toBe('Paris');
    expect(saidLocalName('Y Prospero alza las manos', 'es')?.name).toBe('Próspero'); // «Próspero» typed without its accent
    expect(saidLocalName('Je vois Ophelie', 'fr')?.name).toBe('Ophélie');
  });
});

describe('a Japanese run of katakana is one word', () => {
  it('Yorick and Horatio are not cut into リック and ショー ("a show")', () => {
    const words = localSignatureWords(getCardById('RL-001')!, 'ja');
    expect(words).toContain('ヨリック');
    expect(words).toContain('ホレイショー');
    expect(words).not.toContain('リック');
    expect(words).not.toContain('ショー');
    expect(sig('RL-001', '今夜のショーは素晴らしい', 'ja').met).toBe(false);
    expect(sig('RL-001', '哀れなヨリック', 'ja').met).toBe(true);
  });
});

describe('aliases are names of the character', () => {
  it('no alias with punctuation in it, two scripts, Latin letters in another script, or, unspaced, the name with more added', () => {
    const LATIN = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'vi', 'id'];
    let n = 0;
    for (const l of PACK_LANGS) {
      if (l === 'en') continue;
      for (const c of CHARACTERS) {
        const e = getCardText(l)!.cards[c.id];
        for (const a of e.aliases ?? []) {
          n++;
          expect([l, c.id, a, /^[\p{L}\p{M}]+(?:[-‐][\p{L}\p{M}]+)*$/u.test(a)]).toEqual([l, c.id, a, true]);
          expect([l, c.id, a, /\p{Script=Latin}/u.test(a) && !LATIN.includes(l)]).toEqual([l, c.id, a, false]);
          expect([l, c.id, a, /\p{Script=Latin}/u.test(a) && /\p{Script=Greek}/u.test(a)]).toEqual([l, c.id, a, false]);
          if (['zh', 'ja', 'th'].includes(l) && e.name) expect([l, c.id, a, a !== e.name && a.includes(e.name)]).toEqual([l, c.id, a, false]);
        }
      }
    }
    expect(n).toBeGreaterThan(200);
    const all = (l: string) => CHARACTERS.flatMap((c) => getCardText(l)!.cards[c.id].aliases ?? []);
    for (const [l, a] of [['de', 'Abadonna'], ['de', 'Uthuce'], ['zh', '哈里斯'], ['zh', '科學怪人之母：瑪麗雪萊'], ['ja', 'ゼウス神像'], ['ja', 'ブルトゥス家'], ['it', 'Aφροδίτη']] as const) {
      expect([l, a, all(l).includes(a)]).toEqual([l, a, false]);
    }
    // A longer spelling in a spaced script is a variant of the name, and stays.
    expect(all('ru')).toContain('Ахиллес');
    // Byron's Thai and Vietnamese labels add his peerage ("6th Baron Byron"); the card has his name.
    expect(getCardText('th')!.cards['GC-001'].name).toBe('จอร์จ กอร์ดอน ไบรอน');
    expect(getCardText('vi')!.cards['GC-001'].name).toBe('George Gordon Byron');
    expect(localCharacterNames('th').some((x) => x.includes('บารอน'))).toBe(false);
  });
});

describe('names that Wikidata gave wrong or in English', () => {
  it('the Nurse is «La Nourrice» (Hugo) and 奶妈; the Friar «Frère Laurence» (Hugo) and «Bruder Lorenzo» (Schlegel)', () => {
    expect(getCardText('fr')!.cards['VC-003']).toMatchObject({ name: 'La Nourrice', nameSource: 'published' });
    expect(getCardText('fr')!.cards['VC-002']).toMatchObject({ name: 'Frère Laurence', nameSource: 'published' });
    expect(getCardText('de')!.cards['VC-002']).toMatchObject({ name: 'Bruder Lorenzo', nameSource: 'published' });
    expect(getCardText('zh')!.cards['VC-003']).toMatchObject({ name: '奶妈', nameSource: 'wikidata' });
    expect(getCardText('es')!.cards['VC-004'].name).toBe('Conde Paris');
    expect(getCardText('ru')!.cards['DC-004'].name).toBe('Горацио');
    expect(getCardText('pl')!.cards['SC-003'].name).toBe('Banko');
    expect(getCardText('it')!.cards['OL-006'].name).toBe('Ulisse');
    // No card in a language written in Latin letters is named with an English role or title.
    for (const l of ['es', 'fr', 'de', 'it', 'pt', 'pl', 'vi', 'id']) {
      for (const c of CHARACTERS) {
        const name = getCardText(l)!.cards[c.id].name ?? '';
        expect([l, c.id, name, /\b(Friar|Nurse|Prince|King)\b/.test(name)]).toEqual([l, c.id, name, false]);
      }
    }
    expect(inv('Frère Laurence prie', 'fr').detail).toBe('Frère Laurence');
    expect(inv('La Nourrice arrive', 'fr').detail).toBe('La Nourrice');
    expect(inv('Lorenzo betet', 'de').detail).toBe('Lorenzo');
    expect(inv('奶妈来了', 'zh').detail).toBe('奶妈');
  });
});

describe('the rule judge reads a Vietnamese word with its tone', () => {
  it('a telling word with a tone is in the allusion lexicon only with its tone; the share of the pack’s words it takes is near English’s', async () => {
    const { allusionLexicon } = await import('../verse/referee');
    const { fold } = await import('../verse/text');
    const vi = allusionLexicon('vi');
    const en = allusionLexicon('en');
    let toned = 0;
    // A toneless spelling may be a word of its own in another line (tình "love", tinh "essence"): those are left aside.
    const own = new Set(CARD_CATALOG.flatMap((c) => localSignatureWords(c, 'vi')).map((w) => wordKey(w, 'vi')));
    for (const n of localCharacterNames('vi')) own.add(wordKey(n, 'vi'));
    for (const c of CARD_CATALOG) {
      for (const w of localSignatureWords(c, 'vi')) {
        // A word of several syllables is not one the judge, which reads word by word, can meet.
        if (/\s/.test(w)) continue;
        expect([c.id, w, vi.has(wordKey(w, 'vi'))]).toEqual([c.id, w, true]);
        if (wordKey(w, 'vi') !== fold(w) && !en.has(fold(w)) && !own.has(fold(w))) {
          toned++;
          expect([c.id, w, vi.has(fold(w))]).toEqual([c.id, w, false]);
        }
      }
    }
    expect(toned).toBeGreaterThan(50);
    const share = (l: string) => {
      const lex = allusionLexicon(l);
      let n = 0;
      let hit = 0;
      for (const v of neutral(l)) for (const w of wordsOf(v, l)) { n++; if (lex.has(wordKey(w, l))) hit++; }
      return hit / n;
    };
    const rows = ['en', 'vi', 'fr', 'ko', 'th'].map((l) => [l, +share(l).toFixed(3)]);
    console.log('ALLUSION-SHARE ' + JSON.stringify(rows));
    // The second check measured 35.4% for Vietnamese before, against 19.2% for English (its own count).
    expect(share('vi')).toBeLessThan(0.2);
  });
});

describe('what the player is shown', () => {
  it('the Arabic hint lists its words with the Arabic comma, Japanese with 、', () => {
    const ar = sig('DC-001', 'القمر هادئ', 'ar');
    expect(ar.code).toBe('hint');
    expect(ar.detail).toContain('، ');
    expect(ar.detail).not.toContain(', ');
    const ja = sig('DC-001', '月は静かに沈む', 'ja');
    expect(ja.detail).toContain('、');
  });
  it('the words that landed it come back for the multiplier, folded as the verse says them', () => {
    expect(sig('CA-001', 'Die Rose duftet im Dunkeln', 'de')).toMatchObject({ met: true, words: ['rose', 'duftet'] });
    expect(inv('Kocham Julię', 'pl').words).toEqual(['julie']);
  });
});

// The third check (2026-11-17): Ophelia's line landed on two fragments, Korean 있어요 ("there is") with 위한 or
// 것이지요, and Thai โรส and แมรี, the two pieces ICU cuts โรสแมรี ("rosemary") into.
describe('Korean and Thai lines are read by analysers made for them', () => {
  it('Korean: an auxiliary, a bound noun or the verb "to be" is not a telling word (Kiwi); a unit after a number is', () => {
    const ko = localSignatureWords(getCardById('DC-002')!, 'ko');
    expect(ko).not.toContain('있어요');
    expect(ko).not.toContain('것이지요');
    expect(ko).toEqual(expect.arrayContaining(['로즈메리가', '기억을']));
    expect(sig('DC-002', '나를 위한 노래가 여기 있어요', 'ko').met).toBe(false);
    expect(sig('DC-002', '밤은 깊어요\n당신은 여기 있어요, 그런 것이지요', 'ko').met).toBe(false);
    expect(sig('DC-002', '로즈메리를 들고 기억을 되새긴다', 'ko').met).toBe(true);
    // 한 바퀴 is "one round": 바퀴 after a number is a unit, and a word of Puck's line; 적, in 순탄한 적이 없었다 ("never
    // did run smooth"), is a bound noun of grammar.
    expect(localSignatureWords(getCardById('PT-003')!, 'ko')).toContain('바퀴');
    expect(localSignatureWords(getCardById('PT-001')!, 'ko')).not.toContain('적이');
  });
  it('Thai: โรสแมรี is one word, not "rose" and "Mary" (PyThaiNLP newmm)', () => {
    const th = localSignatureWords(getCardById('DC-002')!, 'th');
    expect(th).toContain('โรสแมรี');
    expect(th).not.toContain('โรส');
    expect(th).not.toContain('แมรี');
    expect(sig('DC-002', 'แมรีกับโรสเดินไปตลาด', 'th').met).toBe(false);
    expect(sig('DC-002', 'แมรีเดินไปตลาด', 'th').met).toBe(false);
    expect(sig('DC-002', 'กลิ่นโรสแมรีปลุกความทรงจำ', 'th').met).toBe(true);
  });
});

describe('a Vietnamese word of several syllables is one telling word', () => {
  it('«vấn đề» ("problem") is not said by «vấn an» ("to ask after"): the second check’s probe', () => {
    expect(localSignatureWords(getCardById('DC-001')!, 'vi')).toEqual(['Tồn tại', 'vấn đề']);
    expect(sig('DC-001', 'Tôi hỏi vấn an người xưa', 'vi').met).toBe(false);
    expect(sig('DC-001', 'Vấn đề của ta là đêm nay', 'vi').met).toBe(true);
    // Its syllables must come in a row, and the matched syllables come back for the multiplier.
    expect(sig('DC-001', 'Đề nghị một vấn an', 'vi').met).toBe(false);
    expect(sig('DC-001', 'Vấn đề của ta là đêm nay', 'vi').words).toEqual(['van', 'đe']);
    // The words are Wiktionary's nouns, verbs and adjectives (docs/language/sources/wiktionary-vi-compounds.json).
    const compounds = getCardText('vi')!.compounds ?? [];
    expect(compounds.length).toBeGreaterThan(80);
    for (const w of ['vấn đề', 'tồn tại', 'trái tim', 'hoa hồng', 'hoàng tử']) expect(compounds).toContain(w);
    expect(localSignatureWords(getCardById('DC-004')!, 'vi')).toContain('trái tim');
  });
});

// The second check of round 3 (2026-11-17, at a52bece2) found two classes still landing the invocation: a name read out
// of a piece of another word in Chinese, Japanese and Thai, and a name that is also an ordinary word counting by itself,
// which English never allows ("Bottom", devices.ts ORDINARY_NAME_PARTS).
describe('a name is not read out of a piece of another word (Chinese, Japanese, Thai)', () => {
  const localName = (verse: string, lang: string) => saidLocalName(verse, lang)?.name;
  it('the check’s verses: positive, polar bear, Polaroid, protocol, podium, the Bodhi tree, a mall, San Antonio, Antonio', () => {
    for (const [l, v] of [
      ['th', 'คิดโพสิทีฟเข้าไว้ คืนนี้เวทีเป็นของข้า'], ['th', 'หมีโพลาร์เดินบนน้ำแข็งยามค่ำ'], ['th', 'ฉันถ่ายรูปด้วยกล้องโพลารอยด์'],
      ['th', 'เครือข่ายใช้โพรโทคอลใหม่'], ['th', 'เขายืนบนโพเดียมอย่างภูมิใจ'], ['th', 'นั่งสมาธิใต้ต้นโพ'],
      ['ja', 'ららぽーとで買い物'], ['zh', '我在圣安东尼奥过夜'], ['zh', '安东尼奥是威尼斯商人'],
    ] as const) expect([l, v, inv(v, l).met]).toEqual([l, v, false]);
  });
  it('more of the class: Aegis, Blackburn, Assus, Poland, sports, a name in hiragana', () => {
    for (const [l, v] of [
      ['zh', '宙斯盾战斗系统很强'], // Aegis (CC-CEDICT), not Zeus
      ['zh', '他住在布莱克本'], // Blackburn (CC-CEDICT), not Blake
      ['zh', '安东尼斯来了'], // jieba (ns), not Antony
      ['th', 'เมืองอัสซุสโบราณ'], // Assus (PyThaiNLP), not Zeus
      ['ja', 'ポーランドへ行く'], // a whole katakana run is one word: Poland, not Poe
      ['ja', 'スポーツが好き'],
      ['ja', 'ろみおが来た'], // a name written in katakana is said in katakana
    ] as const) expect([l, v, localName(v, l)]).toEqual([l, v, undefined]);
  });
  it('the names themselves still land, alone and among other words', () => {
    for (const [l, v, n] of [
      ['zh', '安东尼说话', '安东尼'], ['zh', '马克·安东尼说话', '马克·安东尼'], ['zh', '比宙斯更强', '宙斯'], ['zh', '我爱罗密欧与朱丽叶', '罗密欧'],
      ['ja', 'ポーの詩を読む', 'ポー'], ['ja', 'ロミオとジュリエット', 'ロミオ'], ['ja', 'マクベス夫人が来た', 'マクベス'],
      ['th', 'เอดการ์ แอลลัน โพ เขียนกลอน', 'เอดการ์ แอลลัน โพ'], ['th', 'ซุสโกรธมาก', 'ซุส'],
    ] as const) expect([l, v, localName(v, l)]).toEqual([l, v, n]);
  });

  // Words of the lists that are the character after all (a name in a phrase, read one by one).
  const HELD_AND_NAMED: Record<string, string[]> = { zh: [], ja: [], th: [] };
  it('the 40,000 commonest words of each (wordfreq, the Thai National Corpus): none says a name it only holds', () => {
    const strays: string[] = [];
    let read = 0;
    for (const lang of ['zh', 'ja', 'th']) {
      const names = new Set(localCharacterNames(lang).map((n) => wordKey(n, lang)));
      for (const w of NEAR_WF.words[lang]) {
        read++;
        const n = localName(w, lang);
        if (n && !names.has(wordKey(w, lang)) && !HELD_AND_NAMED[lang].includes(w)) strays.push(`${lang} ${w} -> ${n}`);
      }
    }
    expect(strays).toEqual([]);
    expect(read).toBeGreaterThan(600);
  });
});

// The third check of round 3 (2026-11-18, at 6cf502ab) found Chinese and Thai names still read out of longer foreign names:
// ICU cuts a name it does not know into single characters (Chinese) or pieces (Thai), and a name of the game is one such run
// (哈德斯 in 哈德斯菲尔德, Huddersfield). The rules: Chinese, a name with another piece of a foreign name beside it, spelled
// in Xinhua's transliteration characters, is a piece too (echo.ts carriesOn); Thai, the letters beside a name must be words
// the invocation knows (thNameAt).
describe('a name inside a longer foreign name is a piece of it (Chinese, Thai)', () => {
  const localName = (verse: string, lang: string) => saidLocalName(verse, lang)?.name;
  it('the third check’s verses: Aegis, Huddersfield, Deepak, Hyde Park, Antonia, Blackpool, Apollonius, Yan Jici, Perseus, San Antonio, Paracelsus', () => {
    for (const [l, v] of [
      ['zh', '宙斯盾舰在海上巡航'], ['zh', '美国的宙斯盾舰驶入港口'], ['zh', '严济慈是物理学家'], // words no rule tells: Wikipedia's titles
      ['zh', '哈德斯菲尔德下着雨'], ['zh', '迪帕克在台上唱歌'], ['zh', '我们在海德帕克散步'], ['zh', '安东尼娅是我的妹妹'],
      ['zh', '他在布莱克浦度假'], ['zh', '罗德岛的阿波罗尼奥斯写了史诗'],
      ['th', 'เพอร์เซอุสขี่ม้าบินข้ามทะเล'], ['th', 'กลุ่มดาวเปอร์เซอุสสว่างคืนนี้'], ['th', 'ฉันบินไปซานแอนโทนีโอเมื่อวาน'],
      ['th', 'พาราเซลซุสเป็นแพทย์'],
    ] as const) expect([l, v, inv(v, l).met]).toEqual([l, v, false]);
  });
  it('more of the class, names the check did not try: Paxton, Antonioni, Blackwood, Apollonia, Tuxedo Park, Arceus, Hippasus, Clausius, Theseus', () => {
    for (const [l, v] of [
      ['zh', '帕克斯顿是个小镇'], ['zh', '安东尼奥尼拍了很多电影'], ['zh', '布莱克伍德写了恐怖小说'], ['zh', '阿波罗尼亚是一座古城'],
      ['zh', '我们去塔克西多帕克'], ['zh', '格罗斯波因特帕克在湖边'], ['zh', '蒙特罗斯帕克下雪了'], ['zh', '卡尔弗顿帕克很安静'],
      ['zh', '阿尔宙斯是神奇宝贝'], ['zh', '拜伦斯的老板'],
      ['th', 'ฮิปปาซุสเป็นนักคณิตศาสตร์'], ['th', 'อาร์เซอุสเป็นโปเกมอน'], ['th', 'รูด็อล์ฟ เคลาซีอุส'], ['th', 'วีนีซีอุสยิงประตู'],
      ['th', 'ทีซีอุสฆ่ามิโนทอร์'], ['th', 'อัสซูสเป็นเมืองโบราณ'],
    ] as const) expect([l, v, localName(v, l)]).toEqual([l, v, undefined]);
  });
  it('a name beside a common word, a function word or a word it was joined to still lands', () => {
    for (const [l, v, n] of [
      ['zh', '哈姆雷特当然知道', '哈姆雷特'], ['zh', '拉朱丽叶的手', '朱丽叶'], ['zh', '莫枯修了', '莫枯修'], ['zh', '赫瑞修了', '赫瑞修'],
      ['zh', '我爱朱丽叶', '朱丽叶'], ['zh', '天神宙斯', '宙斯'], ['zh', '梦里朱丽叶在哭', '朱丽叶'], ['zh', '马克安东尼来了', '马克·安东尼'],
      ['th', 'คืนนี้ข้าเรียกซุสมา', 'ซุส'], ['th', 'ฉันกับสมชายเห็นซุส', 'ซุส'], ['th', 'โรเมโอรักจูเลียต', 'จูเลียต'],
    ] as const) expect([l, v, localName(v, l)]).toEqual([l, v, n]);
  });
  it('every name lands in neutral sentences, with a word joined straight to it', () => {
    const frames: Record<string, string[]> = {
      zh: ['我看见{N}了', '{N}说', '比{N}更强', '{N}来了', '{N}了', '哦，{N}！'],
      th: ['คืนนี้ข้าเรียก{N}มา', 'ฉันเห็น{N}แล้ว', '{N}โกรธมาก', 'ข้าคิดถึง{N}'],
    };
    const miss: string[] = [];
    for (const [lang, fs] of Object.entries(frames)) {
      for (const f of fs) for (const n of localCharacterNames(lang)) if (!inv(f.replace('{N}', n), lang).met) miss.push(`${lang} ${f.replace('{N}', n)}`);
    }
    expect(miss).toEqual([]);
  });
  it('a word that holds a name and names something else is on the list from its source; one that names the character is not', () => {
    const held = (l: string, n: string) => getCardText(l)!.containing?.[n] ?? [];
    for (const [l, n, w] of [['zh', '宙斯', '宙斯盾'], ['zh', '济慈', '严济慈'], ['zh', '帕克', '帕克城'], ['th', 'เซอุส', 'เพอร์เซอุส'], ['th', 'ซุส', 'พาราเซลซุส']] as const) {
      expect([l, n, w, held(l, n).includes(w)]).toEqual([l, n, w, true]);
    }
    // «宙斯神像» is the Statue of Zeus (Wikidata), «宙斯之子» a phrase ("son of Zeus"): both name him.
    for (const [l, n, w] of [['zh', '宙斯', '宙斯神像'], ['zh', '宙斯', '宙斯之子']] as const) expect([l, n, w, held(l, n).includes(w)]).toEqual([l, n, w, false]);
    expect(localName('宙斯神像很高', 'zh')).toBe('宙斯');
  });
  it('the Chinese lists are what their sources say (fetch/transliteration.py)', () => {
    const t = getCardText('zh')!.transliteration!;
    for (const c of '迪娅菲斯尔帕尼浦') expect([c, t.chars.includes(c), t.bound.includes(c)]).toEqual([c, true, true]);
    for (const c of '多特拉比') expect([c, t.chars.includes(c), t.bound.includes(c)]).toEqual([c, true, false]);
    for (const w of ['当然', '东西', '谢谢', '高兴']) expect([w, t.native.includes(w)]).toEqual([w, true]);
    for (const w of ['帕克', '罗斯', '尼亚', '日本']) expect([w, t.native.includes(w)]).toEqual([w, false]);
  });
  it('without the Thai pronunciation table fewer Thai names count, and none of the pieces', async () => {
    installSound('th', null);
    try {
      expect(inv('ซุส', 'th').met).toBe(true);
      expect(inv('ฉันเห็นซุสแล้ว', 'th').met).toBe(true); // เห็น and แล้ว are on the stop list
      for (const v of ['เพอร์เซอุสขี่ม้าบินข้ามทะเล', 'พาราเซลซุสเป็นแพทย์', 'ฮิปปาซุสเป็นนักคณิตศาสตร์']) expect([v, inv(v, 'th').met]).toEqual([v, false]);
    } finally {
      await loadSound('th');
    }
    expect(inv('คืนนี้ข้าเรียกซุสมา', 'th').met).toBe(true);
  });
});

// The third check also found the Nurse counting where English would not: German «Eine Wärterin» ("a nurse") and Russian
// «наша кормилица» ("our breadwinner"). English counts "the nurse", never "a nurse" or "nurse" (devices.ts).
describe('a role counts as English counts "the nurse"', () => {
  const localName = (verse: string, lang: string) => saidLocalName(verse, lang)?.name;
  it('German after a definite article; Russian with a capital inside a sentence; never a word of a longer role name', () => {
    for (const [l, v, n] of [
      ['de', 'Die Wärterin schloss die Tür', 'Wärterin'], ['de', 'Ich sah der Wärterin nach', 'Wärterin'],
      ['ru', 'и Кормилица держит ребёнка', 'Кормилица'], ['fr', 'La Nourrice arrive', 'La Nourrice'], ['zh', '奶妈来了', '奶妈'],
      ['de', 'Eine Wärterin schloss die Tür', undefined], ['de', 'Wärterin, komm', undefined], ['ru', 'Корова — наша кормилица', undefined],
      ['ru', 'Кормилица держит ребёнка', undefined], ['fr', 'et Nourrice dit', undefined], ['es', 'y Nodriza dijo', undefined],
    ] as const) expect([l, v, localName(v, l)]).toEqual([l, v, n]);
  });
  it('the German definite articles are Wiktionary’s', () => {
    expect([...(getCardText('de')!.definite ?? [])].sort()).toEqual(['das', 'dem', 'den', 'der', 'des', 'die']);
    expect(getCardText('fr')!.definite).toBeUndefined();
  });
});

// The third check's other concerns: an English name that is an ordinary word of the duel's language (Italian, Spanish and
// Portuguese «medusa», a jellyfish; French «viola»; German «Puck»), and aliases that are another god's name (Vietnamese
// «Jupiter» for Zeus; Russian «Плутон», «Меркурий»; «Орк», an orc, for Hades).
describe('another language’s ordinary words and other gods’ names do not invoke', () => {
  it('an English name that is an ordinary word of the duel’s language counts as that language’s own name does', () => {
    for (const [l, v, met] of [
      ['it', 'Una medusa mi ha punto', false], ['es', 'Vi una medusa en la playa', false], ['pt', 'Vi uma medusa na praia', false],
      ['it', 'Ho comprato due rossetti', false], ['fr', 'Il la viola cette nuit', false], ['de', 'Der Puck flog ins Tor', false],
      ['es', 'y Medusa miró', true], ['it', 'e Medusa guardò', true], ['fr', 'et Viola chante', true], ['de', 'Puk lacht im Wald', true],
      ['en', 'a medusa in the sea', true], ['en', 'the puck flew', true],
    ] as const) expect([l, v, inv(v, l).met]).toEqual([l, v, met]);
  });
  it('no alias is the name of the Roman god Wikidata says is this Greek one, nor Orcus', () => {
    for (const [l, v] of [
      ['vi', 'Jupiter là hành tinh lớn nhất'], ['vi', 'Venus sáng nhất'], ['ru', 'Плутон — карликовая планета'], ['ru', 'Меркурий ближе всех к Солнцу'],
      ['ru', 'Злой орк вышел из леса'], ['ru', 'Орка плывёт в холодном море'], ['pl', 'Pluton jest daleko'], ['ko', '플루톤이 왔다'],
    ] as const) expect([l, v, inv(v, l).met]).toEqual([l, v, false]);
    for (const [l, v] of [['ru', 'и Аид молчит'], ['ru', 'и Гермес бежит'], ['vi', 'Zeus giận dữ'], ['ru', 'Я видел Афину-Палладу'], ['ru', 'и Паллада смотрит']] as const) {
      expect([l, v, inv(v, l).met]).toEqual([l, v, true]);
    }
    const aliases = (l: string, id: string) => getCardText(l)!.cards[id].aliases ?? [];
    expect(aliases('ru', 'UW-001')).not.toContain('Плутон');
    expect(aliases('ru', 'UW-001')).not.toContain('Орк');
    expect(aliases('vi', 'OL-001')).not.toContain('Jupiter');
    // Apollo is the Roman god's name too, and English counts it.
    expect(localCharacterNames('ru')).toContain('Аполлон');
  });
});

describe('a name that is also an ordinary word counts as English counts "Bottom"', () => {
  const localName = (verse: string, lang: string) => saidLocalName(verse, lang)?.name;
  it('the check’s verses: Bottom, a note, a pack, a break, gross, a bench, banks name nobody', () => {
    for (const [l, v] of [
      ['fr', 'Bottom tisse la nuit'], ['it', 'Bottom tesse la notte'], ['es', 'Bottom teje la noche'], ['id', 'Bottom menenun malam'],
      ['de', 'Zettel webt die Nacht'], ['de', 'Ich schrieb einen Zettel'], ['ja', 'ボトムが夜を織る'], ['ja', 'パック旅行に行こう'],
      ['ja', 'パックで顔を洗う'], ['ja', 'ブレイクの時間だ'], ['es', 'Bruto es el sueldo antes de impuestos'], ['pt', 'Bruto é o salário antes dos impostos'],
      ['it', 'Il banco del mercato'], ['it', 'Il peso bruto'], ['hi', 'बैंको में पैसा जमा है'],
    ] as const) expect([l, v, inv(v, l).met]).toEqual([l, v, false]);
  });
  it('more of the class: Pucks on ice, sherry, a Russian pack of ice, a jellyfish, a sentence that opens on the word', () => {
    for (const [l, v] of [
      ['de', 'Pucks fliegen über das Eis'], ['de', 'Des Pucks Weg ist kurz'], ['ja', 'シェリーを飲む'], ['ru', 'Пак льда на реке'],
      // (Spanish «Medusa» opening a line still lands, by the English name, as English counts "medusa".)
      ['pl', 'Meduza w morzu'], ['th', 'โพ'], ['hi', 'बैंको'],
      ['es', 'Es tarde. Bruto es el sueldo'], ['es', '¡Bruto!'], ['it', '«Banco» c’è scritto'], ['ru', 'Ночь. Пак льда плывёт'],
      ['ar', 'اخيل كل ليلة'], // "I imagine every night": أخيل with its hamza typed as a bare alif (fold() drops the hamza)
    ] as const) expect([l, v, inv(v, l).met]).toEqual([l, v, false]);
  });
  it('such a name lands with a capital inside a sentence, where the language writes its ordinary words small; a longer name lands anywhere', () => {
    for (const [l, v, n] of [
      ['es', 'Y Bruto alzó el puñal', 'Bruto'], ['pt', 'e Bruto ergueu o punhal', 'Bruto'], ['it', 'e Banco cadde nel bosco', 'Banco'],
      ['ru', 'и Пак смеётся в лесу', 'Пак'], ['es', 'Oh, Medusa, tu mirada', 'Medusa'],
      ['ja', 'メアリー・シェリーが書く', 'メアリー・シェリー'], ['ja', 'ウィリアム・ブレイクの詩', 'ウィリアム・ブレイク'],
    ] as const) expect([l, v, localName(v, l)]).toEqual([l, v, n]);
    // Bottom is called on only in a phrase in English, and so everywhere: the English phrase counts in any language.
    expect(inv('Nick Bottom tisse la nuit', 'fr').detail).toBe('Nick Bottom');
    expect(inv('Bottom the weaver', 'de').met).toBe(true);
    // A role with its article in English ("The Nurse") counts by its local name, as English counts "the nurse".
    for (const [l, v, n] of [['zh', '奶妈抱着孩子', '奶妈'], ['ru', 'и Кормилица держит ребёнка', 'Кормилица'], ['de', 'Die Wärterin hält das Kind', 'Wärterin']] as const) {
      expect([l, v, localName(v, l)]).toEqual([l, v, n]);
    }
  });
  it('the card text lists the ordinary words the check found, from Wiktionary (and Hunspell where the script has capitals)', () => {
    const has = (l: string, w: string) => (getCardText(l)!.ordinary ?? []).includes(w);
    for (const [l, w] of [['es', 'bruto'], ['pt', 'bruto'], ['it', 'bruto'], ['it', 'banco'], ['de', 'Zettel'], ['de', 'Puck'], ['ja', 'パック'],
      ['ja', 'ブレイク'], ['ja', 'シェリー'], ['ja', 'ボトム'], ['hi', 'बैंको'], ['th', 'โพ'], ['ru', 'пак']] as const) expect([l, w, has(l, w)]).toEqual([l, w, true]);
    // Both sources must agree where there are two: Polish Hunspell accepts «hamlet» in small letters, Wiktionary does not list it.
    expect(has('pl', 'hamlet')).toBe(false);
    expect(localName('Hamlet patrzy w noc', 'pl')).toBe('Hamlet');
  });
  it('in every language, no listed ordinary word counts by itself written small, or opening a line or a sentence', () => {
    let checked = 0;
    for (const lang of CARD_TEXT_LANGS) {
      const ordinary = new Set((getCardText(lang)!.ordinary ?? []).map((w) => wordKey(w, lang)));
      const capital = new Set(capitalOnlyNames(lang));
      // The Nurse's local names are that role, which English counts as "the nurse" (an ordinary phrase) whole.
      const roles = new Set(CHARACTERS.filter((c) => /^The\s/.test(c.name) && getCardText(lang)!.cards[c.id].nameSource !== 'kept')
        .flatMap((c) => [getCardText(lang)!.cards[c.id].name, ...(getCardText(lang)!.cards[c.id].aliases ?? [])]).filter(Boolean));
      for (const name of localCharacterNames(lang)) {
        if (/[\s・·‧]/u.test(name) || !ordinary.has(wordKey(name, lang)) || roles.has(name)) continue;
        checked++;
        const small = name.toLocaleLowerCase(lang);
        const unspaced = ['zh', 'ja', 'th'].includes(lang);
        const sep = unspaced ? '' : ' ';
        for (const v of [name, `${name}${sep}`, `x${sep}${small}`, `${sep}. ${name}`].filter((x) => !unspaced || !x.includes('.'))) {
          expect([lang, v, localName(v, lang) === name]).toEqual([lang, v, false]);
        }
        // Only a name the language writes with a capital where its ordinary word is small lands inside a sentence.
        const smallListed = (getCardText(lang)!.ordinary ?? []).some((o) => wordKey(o, lang) === wordKey(name, lang) && o === o.toLowerCase() && o !== o.toUpperCase());
        expect([lang, name, capital.has(name)]).toEqual([lang, name, /^\p{Lu}/u.test(name) && smallListed]);
        if (capital.has(name)) expect([lang, name, !!localName(`x, ${name}`, lang)]).toEqual([lang, name, true]);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
  it('the 40,000 commonest words of each spaced language (wordfreq), opening a line, written small or not: only a name that is no ordinary word, or its form', () => {
    const strays: string[] = [];
    let read = 0;
    for (const lang of CARD_TEXT_LANGS.filter((l) => !['zh', 'ja', 'th'].includes(l))) {
      const ordinary = new Set((getCardText(lang)!.ordinary ?? []).map((w) => wordKey(w, lang)));
      const forms = getCardText(lang)!.forms ?? {};
      const formOf = new Map(Object.entries(forms).flatMap(([w, fs]) => fs.map((f) => [wordKey(f, lang), wordKey(w, lang)] as const)));
      for (const w of NEAR_WF.words[lang]) {
        for (const v of new Set([w, w.charAt(0).toLocaleUpperCase(lang) + w.slice(1)])) {
          read++;
          const n = saidLocalName(v, lang);
          if (!n) continue;
          const k = wordKey(v, lang);
          const base = formOf.get(k) ?? k;
          const nameWords = (n.name.match(/[\p{L}\p{M}'’\-]+/gu) ?? []).map((x) => wordKey(x, lang));
          const isName = nameWords.includes(base) || nameWords.includes(k) || (lang === 'ko' && nameWords.some((x) => k.startsWith(x)));
          if (!isName || ordinary.has(base)) strays.push(`${lang} ${v} -> ${n.name}`);
        }
      }
    }
    expect(strays).toEqual([]);
    expect(read).toBeGreaterThan(2500);
  });
});
