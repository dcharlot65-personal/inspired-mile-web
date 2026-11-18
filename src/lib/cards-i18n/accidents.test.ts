// The signature and the invocation must not land by accident: on a pronoun, a particle, a piece of a word, a
// toneless prefix or a title. These are the verses an independent check found landing (2026-11-16), and the rate
// at which verses that were not written for any card land on a character card, in every language.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { DEVICES, checkSignature, invocationNames } from '../verse/devices';
import { scoreVerse } from '../verse/duel';
import { getForm } from '../verse/forms';
import { localCharacterNames, localSignatureWords, RECITE_LETTERS, saysWord, wordKey } from '../verse/echo';
import { getPack, loadAllPacks, PACK_LANGS } from '../verse/packs';
import { wordsOf } from '../verse/text';
import { getCardText, loadAllCardText, localEchoText, localQuote } from './index';

// As duel.ts builds it (CHARACTER_NAMES): the full names, and the last part of each where it is a name.
const NAMES = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));
const CHARACTERS = CARD_CATALOG.filter((c) => c.type === 'Character');

beforeAll(async () => {
  await loadAllPacks();
  await loadAllCardText();
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
    expect(inv('Próspero alza las manos', 'es').met).toBe(true);
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
        for (const w of [...(parts.length > 1 ? parts : []), ...(e.aliases ?? []).map(clean)]) {
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
      ['Я видел Медузу', 'ru', 'Медуза'], ['Медуза спит', 'ru', 'Медуза'], ['Вот Марк Антоний', 'ru', 'Марк Антоний'],
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
      'de Blakes', 'de Julias', 'de Mirandas',
      'pl Ateny', // also Athens (Hunspell: a proper noun), kept as English keeps Paris
      'pl Hamleta', 'pl Julie', /* Julię typed without its ogonek */ 'pl Julii', 'pl Julio', 'pl Julię', 'pl Meduzy', 'pl Mirandy', 'pl Mirando', 'pl Mirandę',
      'pl Romea', 'pl Zeusa',
      'ru Аида', // also Aida (not in Hunspell's dictionary), the genitive of Аид
      'ru Антония', 'ru Афины', /* also Athens, as Polish Ateny */ 'ru Байрона', 'ru Блейка', 'ru Гамлета', 'ru Джульетте', 'ru Джульетту', 'ru Джульетты',
      'ru Зевса', 'ru Клавдия', /* also the name Klavdiya (Hunspell) */ 'ru Медузы', 'ru Миранды', 'ru Миранду', 'ru Оливией', 'ru Оливии', 'ru Оливию', 'ru Пака',
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
