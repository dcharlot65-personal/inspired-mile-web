/**
 * Rhyme, one rule per language, decided by sound.
 *
 * Where the spelling shows the sound, the rule reads the spelling (Spanish,
 * Polish, Korean, Vietnamese, Indonesian, Hindi, Arabic). Where it does not,
 * the rule looks the sound up in that language's table (./sound): where the
 * stress falls (Russian, Italian, Portuguese), how the word is said (French,
 * German), how a character is read (Chinese), where the last syllable is
 * (Thai), or reads the line with a dictionary (Japanese). A word a table does
 * not have falls back to the spelling rule, and each rule says below what it
 * can and cannot hear. All of them are tuned the same way: a doubtful rhyme is
 * allowed rather than a real one refused. A word never rhymes with itself.
 *
 * Chinese, Japanese and Thai cannot be rhymed from spelling at all, so their
 * rhyming forms are offered only once their sound data is loaded
 * (rhymeChecked). docs/language/PHONETICS.md has the sources and the measured
 * accuracy of every rule.
 */
import { baseLang } from './lang';
import { soundReady } from './sound';
import { japaneseTokens, moraeOfKana } from './sound/kana';
import { chineseReadings, frenchSound, germanSound, hindiAksharas, russianStress, tailOverride, thaiEnd } from './sound/lookup';
import { fold, hiragana, wordsOf } from './text';

const LATIN_VOWELS = 'aeiouy';

/** Can rhyme be checked fairly in this language? Decides whether rhyming forms are offered. */
export function rhymeChecked(lang: string): boolean {
  const b = baseLang(lang);
  return !/^(zh|ja|th)$/.test(b) || soundReady(b);
}

// --- English, and the fallback for any Latin-script word ---

/**
 * The part of an English word that carries its rhyme: from the last vowel group
 * to the end. For other scripts, the last two characters.
 */
export function rhymeKey(word: string): string {
  const w = fold(word).replace(/[^\p{L}]/gu, '');
  if (w.length < 2) return w;
  if (!/^[a-z]+$/.test(w)) return w.slice(-2);
  // Spellings that sound alike at the end of a word. English spelling is a poor
  // guide to sound, so this is rough and tuned to be generous: a doubtful rhyme
  // is allowed rather than refused.
  const e = w
    .replace(/ight$/, 'ite')
    .replace(/(ower|our)$/, 'owr')
    .replace(/(are|air|eir|ayer)$/, 'air')
    .replace(/^(th|wh)ere$/, '$1air')
    .replace(/(awl|aul|all)$/, 'awl')
    .replace(/(oise|oys)$/, 'oyz')
    .replace(/(ize|ise|ies|eyes|ighs)$/, 'ize')
    .replace(/(ough|ow|oe)$/, 'o')
    .replace(/(ay|eigh)$/, 'ay')
    .replace(/(ck|que)$/, 'k')
    .replace(/ph$/, 'f')
    .replace(/^(me|he|she|we|be|ye)$/, '$1e')
    .replace(/(ee|ea|ey|ie)$/, 'ee')
    .replace(/([^aeiou])y$/, '$1ee');
  // Skip a silent final e so "stage" keys on "age", not on "e".
  const end = e.length > 2 && e.endsWith('e') && !LATIN_VOWELS.includes(e[e.length - 2]) ? e.length - 1 : e.length;
  let i = end - 1;
  while (i >= 0 && !LATIN_VOWELS.includes(e[i])) i--;
  while (i > 0 && LATIN_VOWELS.includes(e[i - 1])) i--;
  if (i < 0) return e.slice(-2);
  return e.slice(i);
}

function englishRhyme(a: string, b: string): boolean {
  const ka = rhymeKey(a);
  const kb = rhymeKey(b);
  if (ka.length < 2 || kb.length < 2) return false;
  if (ka === kb) return true;
  // "corazón" / "canción": one ending contained in the other still rhymes.
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return long.endsWith(short);
}

/** A language rule answers yes or no, or null when a word is not in its script. */
type Rule = (a: string, b: string) => boolean | null;

/** Rhyme on equal keys. Several keys per word means "any reading of the spelling". */
function byKeys(keys: (word: string) => string[] | null): Rule {
  return (a, b) => {
    const ka = keys(a);
    const kb = keys(b);
    if (!ka || !kb) return null;
    return ka.some((k) => k.length > 0 && kb.includes(k));
  };
}

// --- Spanish, Italian, Portuguese ---

interface Letter {
  ch: string;
  vowel: boolean;
  /** Carries a written stress mark. */
  stress: boolean;
}

function romanceLetters(word: string): Letter[] | null {
  const nfd = word.toLowerCase().normalize('NFD');
  const out: Letter[] = [];
  for (const ch of nfd) {
    if (/[\u0300-\u036f]/.test(ch)) {
      const last = out[out.length - 1];
      if (!last) continue;
      if (ch === '\u0303' && last.ch === 'n') last.ch = 'ñ';
      else if (ch === '\u0327' && last.ch === 'c') last.ch = 'ç';
      else if (last.vowel && /[\u0300\u0301\u0302\u0303]/.test(ch)) last.stress = true;
      continue;
    }
    if (!/[a-z]/.test(ch)) {
      if (/['’\-]/.test(ch)) continue;
      return null;
    }
    out.push({ ch, vowel: 'aeiou'.includes(ch), stress: false });
  }
  // A closing y is a vowel ("rey", "hoy").
  const last = out[out.length - 1];
  if (last?.ch === 'y') {
    last.ch = 'i';
    last.vowel = true;
  }
  // The u of "que", "gue" is only a spelling.
  for (let i = 1; i + 1 < out.length; i++) {
    if (out[i].ch === 'u' && !out[i].stress && ((out[i - 1].ch === 'q' && out[i + 1].vowel) || (out[i - 1].ch === 'g' && 'ei'.includes(out[i + 1].ch)))) {
      out[i].vowel = false;
    }
  }
  return out.length ? out : null;
}

/** Index of the main vowel of each syllable, in order. */
function nuclei(ls: Letter[]): number[] {
  const out: number[] = [];
  let open = false;
  let strong = false;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (!l.vowel) {
      open = false;
      continue;
    }
    const isStrong = 'aeo'.includes(l.ch) || l.stress;
    if (!open || (isStrong && strong)) {
      out.push(i);
      strong = isStrong;
    } else if (isStrong) {
      out[out.length - 1] = i;
      strong = true;
    } else if (!strong) {
      // Two weak vowels: the second carries ("ciu-dad", "cui-da").
      out[out.length - 1] = i;
    }
    open = true;
  }
  return out;
}

/** A Spanish, Italian or Portuguese word as the rules below read it (accents off, "y" closing a word as "i"); null if not in the script. */
export function romanceText(word: string): string | null {
  const ls = romanceLetters(word);
  return ls ? ls.map((l) => l.ch).join('') : null;
}

/**
 * Where the spelling puts the stressed vowel: indexes into romanceText(word).
 * From the written accent, or else from each language's spelling rule (Spanish:
 * the last syllable but one when the word ends in a vowel, n or s; otherwise
 * the last). Italian "-ia" may be one syllable ("storia") or two ("poesia"),
 * and Italian does not write the stress of "anima", so Italian gets a second
 * guess here and its real answer from the table.
 */
export function romanceStressByRule(word: string, lang: 'es' | 'it' | 'pt'): number[] | null {
  const ls = romanceLetters(word);
  if (!ls) return null;
  const nuc = nuclei(ls);
  if (!nuc.length) return [];
  const text = ls.map((l) => l.ch).join('');
  const marked = ls.map((l, i) => (l.stress ? i : -1)).filter((i) => i >= 0);
  const starts: number[] = [];
  const lastN = nuc[nuc.length - 1];
  const penult = nuc.length > 1 ? nuc[nuc.length - 2] : lastN;
  if (marked.length) starts.push(marked[marked.length - 1]);
  else if (lang === 'es') starts.push(/[aeiouns]$/.test(text) ? penult : lastN);
  else if (lang === 'pt') {
    // Unaccented "-ia", "-io", "-ua" after a consonant is stressed on the i or u ("dia", "alegria",
    // "rua"); after a vowel the i or u closes that vowel's syllable ("meio", "odeio", "praia").
    const hiatus = /(?<![qgaeiou])[iu][aeo]s?$/.exec(text);
    if (hiatus) starts.push(hiatus.index);
    else starts.push(/([aeo]s?|[ae]m|ens)$/.test(text) ? penult : lastN);
  } else {
    starts.push(/[aeiou]$/.test(text) ? penult : lastN);
    const hiatus = /(?<![cgq])[iu][aeo]$/.exec(text);
    if (hiatus) starts.push(hiatus.index);
  }
  return starts;
}

/**
 * Consonant rhyme for Spanish, Italian and Portuguese: everything from the
 * stressed vowel to the end. The stressed vowel is the one a dictionary gives
 * (./sound: the table holds the words whose stress the spelling rule gets
 * wrong, which in Italian is every word stressed three syllables from the end),
 * else the one the spelling rule finds.
 *
 * Hears: "vida / herida", "corazón / canción", "amor / dolor", "città / verità",
 * and with the table "tavola / favola", and that "anima / prima" is none. Refuses,
 * correctly: "vida / nada". Cannot hear: assonance, which Spanish verse also
 * accepts; open against closed e and o, which Italian and Portuguese rhyme
 * freely anyway.
 */
/**
 * The stressed vowel of a Spanish, Italian or Portuguese word, as indexes into
 * romanceText(word) (more than one where the spelling allows more than one
 * reading): the table's where it has the word, else the spelling rule's.
 */
function romanceStress(word: string, lang: 'es' | 'it' | 'pt'): { word: string; text: string; starts: number[] } | null {
  // An elided word in front is not part of the rhyming word ("v'intrai", "l'erta").
  const after = word.split(/['’]/).pop() ?? '';
  if ([...after].length >= 2) word = after;
  const text = romanceText(word);
  if (text === null) return null;
  const known = tailOverride(lang, word);
  const starts = known !== null && known <= text.length ? [text.length - known] : romanceStressByRule(word, lang);
  if (!starts) return null;
  // Italian words closing on a falling diphthong are stressed on it ("trovai", "assai", "lui", "poi").
  const falling = lang === 'it' && known === null ? /[aeou]i$/.exec(text) : null;
  if (falling && !starts.includes(falling.index)) starts.push(falling.index);
  return { word, text, starts };
}

/**
 * Which syllable of a word the rules stress, counted from the start and from
 * the end (1 is the first, or the last): Spanish, Italian and Portuguese by
 * romanceStress, Russian by its table. Both, because two readings of a word
 * can stress the same vowel and still divide it differently on one side of
 * it: "sto-ria" and "sto-ri-a" agree from the start, "tra-du-zio-ne" and
 * "tra-du-zi-o-ne" from the end. More than one answer where the rule allows
 * more than one reading; null for another language, a word the rule cannot
 * read, or a Russian word the table lacks. For measuring the rules against
 * other tools (./sound/crosscheck); rhyme itself is read from the stressed
 * vowel on, by the functions below.
 */
export function stressedSyllable(word: string, lang: string): Array<{ fromStart: number; fromEnd: number }> | null {
  const b = baseLang(lang);
  if (b === 'ru') {
    const w = word.toLowerCase().normalize('NFC');
    const vowels = (w.match(/[аеёиоуыэюя]/g) ?? []).length;
    const k = /^[а-яё]+$/.test(w) ? russianStress(w) : null;
    return k ? k.map((x) => ({ fromStart: vowels - x + 1, fromEnd: x })) : null;
  }
  if (b !== 'es' && b !== 'it' && b !== 'pt') return null;
  const r = romanceStress(word, b);
  const ls = r ? romanceLetters(r.word) : null;
  if (!r || !ls) return null;
  const nuc = nuclei(ls);
  // A stressed vowel the syllable rule joins to a following strong one is a syllable of its own ("po-e-sí-a").
  const apart = (s: number) => !nuc.includes(s) && 'aeo'.includes(ls.slice(s + 1).find((l) => l.vowel)?.ch ?? '');
  const out = r.starts.map((s) => ({ fromStart: nuc.filter((i) => i < s).length + 1, fromEnd: nuc.filter((i) => i >= s).length + (apart(s) ? 1 : 0) }));
  return out.filter((x, i) => out.findIndex((y) => y.fromStart === x.fromStart && y.fromEnd === x.fromEnd) === i);
}

function romanceKeys(lang: 'es' | 'it' | 'pt'): (word: string) => string[] | null {
  return (word) => {
    const r = romanceStress(word, lang);
    if (!r) return null;
    const { text, starts } = r;
    return starts.map((s) => {
      let tail = text.slice(s).replace(/h/g, '');
      if (lang === 'es') tail = tail.replace(/v/g, 'b').replace(/z/g, 's').replace(/c(?=[ei])/g, 's').replace(/ll/g, 'y');
      if (lang === 'pt') tail = tail.replace(/ss|ç|z$/g, 's').replace(/c(?=[ei])/g, 's');
      return tail;
    });
  };
}

// --- French ---

/**
 * French: the last sounded vowel and what follows it, read from the spelling.
 * A mute e and the silent final consonants are dropped ("nuit" = "nui"), nasal
 * vowels and the common vowel spellings are merged ("eau" = "au" = "o"), and a
 * closing "-er" is tried both as "é" ("chanter") and as "èr" ("mer").
 *
 * Hears: "nuit / bruit", "amour / toujours", "été / chanter", "temps / vent",
 * "scène / reine", "voix / roi". Too generous by design: é and è are one vowel,
 * "-ent" is tried both as a nasal ("moment") and as a silent verb ending.
 * Cannot hear: sounded final consonants in short words ("fils", "sens"), which
 * are dropped like the silent ones.
 */
function frenchSpelledKeys(word: string): string[] | null {
  const w0 = word.toLowerCase().normalize('NFC').replace(/œ/g, 'oe').replace(/æ/g, 'e').replace(/['’\-]/g, '');
  if (!/^[a-zàâäçéèêëîïôöùûüÿ]+$/.test(w0)) return null;
  // A, E, O stand for the nasal vowels once they have been read.
  const hasVowel = (s: string) => /[aeiouyàâäéèêëîïôöùûüÿAEO]/.test(s);
  const plain = (s: string) => fold(s).replace(/ç/g, 's');
  const starts: Array<{ s: string; mute: boolean }> = [];

  const er = /..er$/.test(w0);
  let s = w0.replace(/ées?$/, 'é').replace(/és$/, 'é').replace(/(aient|ait|ais|ai)$/, 'é').replace(/(ez|ed)$/, 'é');
  if (/ent$/.test(s) && hasVowel(s.slice(0, -3))) starts.push({ s: s.slice(0, -3), mute: true });
  const dropped = s.replace(/([^é])es?$/, '$1');
  if (dropped !== s && hasVowel(dropped)) starts.push({ s: dropped, mute: true });
  else {
    starts.push({ s, mute: false });
    if (er) starts.push({ s: s.slice(0, -2) + 'é', mute: false });
  }

  const keys = new Set<string>();
  for (const st of starts) {
    // A vowel with n or m before another consonant is nasal wherever it stands ("silence", "jambe", "monde").
    let t = plain(st.s)
      .replace(/(ain|ein|in|im|un|um)(?=[bcdfgjklpqrstvxz])/g, 'E')
      .replace(/(an|am|en|em)(?=[bcdfgjklpqrstvxz])/g, 'A')
      .replace(/(on|om)(?=[bcdfgjklpqrstvxz])/g, 'O');
    if (!st.mute) {
      // Silent closing consonants, then the nasal vowels they leave at the end.
      const cut = t.replace(/[stdxzp]+$/, '').replace(/(?<=n)[cg]$/, '');
      if (hasVowel(cut)) t = cut;
      t = t
        .replace(/[iy]en$/, 'iE')
        .replace(/(ain|ein|aim|in|im|yn|ym|un|um)$/, 'E')
        .replace(/(an|am|en|em)$/, 'A')
        .replace(/(on|om)$/, 'O');
    }
    t = t
      .replace(/eau|au/g, 'o')
      .replace(/ai|ei/g, 'e')
      .replace(/oeu/g, 'eu')
      .replace(/ph/g, 'f')
      .replace(/qu/g, 'k')
      .replace(/y/g, 'i')
      .replace(/([bcdfgklmnprstvz])\1/g, '$1');
    const m = /(ou|eu|oi|[aeiouAEO])[^aeiouAEO]*$/.exec(t);
    keys.add(m ? m[0] : t.slice(-2));
  }
  return [...keys];
}

/**
 * French by sound: two words the table has rhyme when the last vowel of each
 * and the consonants after it are the same sounds ("fils / lys", "sens /
 * encens", which the spelling rule drops; "temps / vent"; not "ville / fille").
 * Otherwise the spelling rule above decides for both.
 */
function frenchRhyme(a: string, b: string): boolean | null {
  const sa = frenchSound(a);
  const sb = frenchSound(b);
  if (sa && sb) return sa.keys.some((k) => sb.keys.some((j) => nearKey('fr', k) === nearKey('fr', j)));
  return byKeys(frenchSpelledKeys)(a, b);
}

// --- German ---

/**
 * German: from the last vowel to the end, or from the vowel before it when the
 * word closes on an unstressed "-e", "-en", "-er", "-el" ("Leben / geben").
 * Long-vowel spellings are merged ("Meer / sehr"), ä counts as e, eu and äu as
 * one sound, and a closing d, b, g is hardened as it is spoken ("Hund / bunt").
 *
 * Cannot hear: vowel length ("Bett / Gebet" pass), or stress in words that end
 * in a stressed "-el", "-en" ("Hotel"); those are caught by letting a shorter
 * ending match the end of a longer one.
 */
function germanKey(word: string): string[] | null {
  let w = word.toLowerCase().normalize('NFC').replace(/['’\-]/g, '');
  if (!/^[a-zäöüß]+$/.test(w)) return null;
  const V = 'aeiouöü';
  w = w
    .replace(/ß/g, 'ss')
    .replace(/äu|eu/g, 'oi')
    .replace(/ä/g, 'e')
    .replace(/ai/g, 'ei')
    .replace(/ie/g, 'i')
    .replace(/y/g, 'ü')
    .replace(/([aeiouöü])h(?![aeiouöü])/g, '$1')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/oo/g, 'o')
    .replace(/ck/g, 'k')
    .replace(/tz/g, 'z')
    .replace(/dt/g, 't')
    .replace(/ph/g, 'f')
    .replace(/([bcdfgklmnprstz])\1/g, '$1')
    .replace(/d$/, 't')
    .replace(/b$/, 'p')
    .replace(/(?<!n)g$/, 'k');
  let i = w.length - 1;
  while (i >= 0 && !V.includes(w[i])) i--;
  while (i > 0 && V.includes(w[i - 1])) i--;
  if (i < 0) return [w.slice(-2)];
  if (/^e(n|r|l|m|s|rn|ln|ns)?$/.test(w.slice(i))) {
    let j = i - 1;
    while (j >= 0 && !V.includes(w[j])) j--;
    while (j > 0 && V.includes(w[j - 1])) j--;
    if (j >= 0) i = j;
  }
  return [w.slice(i)];
}

/**
 * German by sound: two words the table has (or whose last element it has:
 * a compound rhymes on its last element) rhyme when they are the same from the
 * last stressed vowel on. Otherwise the spelling rule decides for both.
 */
function germanRhyme(a: string, b: string): boolean | null {
  const sa = germanSound(a);
  const sb = germanSound(b);
  if (sa && sb) return sa.keys.some((k) => sb.keys.some((j) => nearKey('de', k) === nearKey('de', j)));
  return germanSpelledRhyme(a, b);
}

function germanSpelledRhyme(a: string, b: string): boolean | null {
  const ka = germanKey(a)?.[0];
  const kb = germanKey(b)?.[0];
  if (ka === undefined || kb === undefined) return null;
  if (ka === kb) return true;
  // The impure rhyme of rounded with unrounded vowels ("Müh / Vieh"), as nearKey allows for words in the table.
  const flat = (k: string) => k.replace(/ü/g, 'i').replace(/ö/g, 'e').replace(/oi/g, 'ei');
  if (flat(ka) === flat(kb)) return true;
  // A shorter ending inside a longer one ("Hotel / Fell"), but not one that starts inside a vowel
  // pair: "reicht" is "eicht", which does not end in the "icht" of "Licht".
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return short.length >= 2 && long.endsWith(short) && !'aeiouöü'.includes(long[long.length - short.length - 1] ?? '');
}

// --- Polish ---

/**
 * Polish is stressed on the last syllable but one, so a word ending in a vowel
 * rhymes from the vowel before ("kocha / szlocha"); a word ending in a consonant
 * is keyed from its last vowel, which also lets through the looser rhymes poets
 * use ("miłość / radość"). ó is u, rz is ż, ch is h, and an i before a vowel is
 * only a softening.
 *
 * Hears the unvoicing of a closing consonant ("chleb / sklep"). Too generous by
 * design: i and y, and soft and hard sibilants, are one sound here.
 */
function polishKey(word: string): string[] | null {
  let w = word.toLowerCase().normalize('NFC').replace(/['’\-]/g, '');
  if (!/^[a-ząćęłńóśźż]+$/.test(w)) return null;
  const V = 'aąeęiou';
  w = w.replace(/ó/g, 'u').replace(/rz/g, 'ż').replace(/ch/g, 'h').replace(/i(?=[aąeęouy])/g, '').replace(/ę$/, 'e').replace(/ą$/, 'o');
  // As spoken: a closing voiced consonant, or one before a voiceless consonant, is unvoiced ("chleb / sklep", "nóżki").
  const unvoice: Record<string, string> = { b: 'p', d: 't', g: 'k', w: 'f', z: 's', ż: 'S', ź: 'ś' };
  w = w.replace(/sz/g, 'S').replace(/cz/g, 'C').replace(/[bdgwzżź](?=$|[ptkfsSśCcćh])/g, (c) => unvoice[c]);
  // What Polish verse rhymes freely: i with y, and the soft consonants with their hard partners ("mieście / nareszcie").
  w = w.replace(/y/g, 'i').replace(/ś/g, 'S').replace(/ć/g, 'C').replace(/ź/g, 'ż').replace(/ń/g, 'n');
  const idx: number[] = [];
  for (let i = 0; i < w.length; i++) if (V.includes(w[i])) idx.push(i);
  if (!idx.length) return [w];
  const endsInVowel = V.includes(w[w.length - 1]);
  const from = endsInVowel && idx.length > 1 ? idx[idx.length - 2] : idx[idx.length - 1];
  return [w.slice(from)];
}

// --- Russian ---

/**
 * Russian stress is free and unwritten, so the rule keys on the end of the
 * word: a word closing on a consonant rhymes from its last vowel ("любовь /
 * кровь"); a word closing on a hard vowel needs the consonant before it too
 * ("она / луна", but not "она / вода"), which is what Russian verse asks of an
 * open rhyme; a word closing on я, ю, е, и rhymes on that letter ("меня / тебя").
 * Closing consonants are unvoiced as spoken, я/ю/ё count as а/у/о, ь is dropped.
 *
 * Cannot hear: where the stress falls, so "сцена / луна" passes.
 */
function russianEndKey(word: string): string[] | null {
  let w = word.toLowerCase().normalize('NFC').replace(/['’\-]/g, '');
  if (!/^[а-яё]+$/.test(w)) return null;
  const soft = /[яюеиё]$/.test(w);
  w = w
    .replace(/ть?ся$/, 'ца')
    .replace(/([ое])го$/, '$1во')
    .replace(/[ьъ]/g, '')
    .replace(/ё/g, 'о')
    .replace(/я/g, 'а')
    .replace(/ю/g, 'у')
    .replace(/э/g, 'е');
  const unvoice: Record<string, string> = { б: 'п', в: 'ф', г: 'к', д: 'т', ж: 'ш', з: 'с' };
  w = w.replace(/[бвгджз]$/, (c) => unvoice[c]);
  const V = 'аеиоуы';
  const last = w[w.length - 1];
  if (V.includes(last)) return [soft ? `ʲ${last}` : w.slice(-2)];
  let i = w.length - 1;
  while (i >= 0 && !V.includes(w[i])) i--;
  return [i < 0 ? w : w.slice(i)];
}

const RU_STRESSED: Record<string, string> = { а: 'a', я: 'a', о: 'o', ё: 'o', у: 'u', ю: 'u', э: 'e', е: 'e', ы: 'i', и: 'i' };
const RU_UNSTRESSED: Record<string, string> = { а: 'ə', о: 'ə', я: 'ə', е: 'ɪ', и: 'ɪ', ы: 'ɪ', э: 'ɪ', у: 'u', ю: 'u', ё: 'o' };
const RU_UNVOICE: Record<string, string> = { б: 'п', в: 'ф', г: 'к', д: 'т', ж: 'ш', з: 'с' };

/**
 * Russian with the stress known (./sound: a table of stress from Wiktionary;
 * ё and one-vowel words need none): the rhyme runs from the stressed vowel to
 * the end, as Russian verse defines it. Unstressed vowels after it are heard
 * as they are said (а and о alike, е and и alike), closing consonants are
 * unvoiced, the soft sign is not compared. A word stressed on its closing
 * vowel also needs the consonant before it ("она / луна", not "она / вода"),
 * except after a soft consonant ("меня / тебя").
 */
function russianStressKeys(word: string): string[] | null {
  const w = word.toLowerCase().normalize('NFC').replace(/['’\-]/g, '');
  if (!/^[а-яё]+$/.test(w)) return null;
  const stress = russianStress(w);
  if (!stress || !stress.length) return null;
  const at: number[] = [];
  for (let i = 0; i < w.length; i++) if ('аеёиоуыэюя'.includes(w[i])) at.push(i);
  return stress.map((k) => {
    const i = at[at.length - k];
    const v = RU_STRESSED[w[i]];
    let rest = w
      .slice(i + 1)
      .replace(/ть?ся$/, 'ца')
      .replace(/^го$/, 'во')
      .replace(/[ьъ]/g, '')
      // Consonants written but not said: "чувства" is "чуства", "поздно" is "позно", "солнце" is "сонце".
      .replace(/вств/g, 'ств')
      .replace(/стн/g, 'сн')
      .replace(/здн/g, 'зн')
      .replace(/лнц/g, 'нц')
      .replace(/рдц/g, 'рц')
      .replace(/[бвгджз]$/, (c) => RU_UNVOICE[c])
      .replace(/([бвгджзклмнпрстфхцчшщ])\1/g, '$1');
    rest = [...rest].map((c) => RU_UNSTRESSED[c] ?? c).join('');
    if (rest) return `${v}${rest}`;
    if ('яюеёи'.includes(w[i])) return `ʲ${v}`;
    const before = w.slice(0, i).replace(/[ьъ]/g, '');
    return `${before.slice(-1)}${v}`;
  });
}

function russianRhyme(a: string, b: string): boolean | null {
  const ka = russianStressKeys(a);
  const kb = russianStressKeys(b);
  if (ka && kb) return ka.some((k) => kb.includes(k));
  return byKeys(russianEndKey)(a, b);
}

// --- Indonesian ---

/**
 * Indonesian end rhyme (rima akhir) as pantun uses it: the last vowel and any
 * consonants after it ("malam / dalam", "hati / mati", "bintang / datang").
 * Generous for words that end in a vowel: only that vowel is compared.
 */
function indonesianKey(word: string): string[] | null {
  const w = fold(word).replace(/['’\-]/g, '');
  if (!/^[a-z]+$/.test(w)) return null;
  const m = /(ai|au|oi|[aiueo])[^aiueo]*$/.exec(w);
  return [m ? m[0] : w.slice(-2)];
}

// --- Vietnamese ---

/**
 * Vietnamese: each written word is a syllable. Two rhyme when what follows the
 * opening consonant is the same (vần) and their tones are of the same class:
 * level (no mark, or huyền) or sharp (the other four). A glide before the vowel
 * is ignored ("hoa / xa").
 *
 * Near-rhymes (vần thông) pass when the closing sound is the same and the vowels
 * are of one family (front, central or back), which is how Truyện Kiều rhymes;
 * a different closing sound ("an / ang") does not.
 */
function vietnameseKey(word: string): string[] | null {
  const nfd = word.toLowerCase().normalize('NFD');
  const level = !/[\u0301\u0303\u0309\u0323]/.test(nfd);
  const bare = nfd.replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '').normalize('NFC');
  if (!/^[a-zâăêôơưđ]+$/.test(bare)) return null;
  let rime = bare.replace(/^(ngh|ng|gh|gi(?=[aâăeêoôơuư])|kh|nh|ph|qu|th|tr|ch|[bcdđghklmnpqrstvx])/, '');
  rime = rime.replace(/^o(?=[aăe])/, '').replace(/^u(?=[yêâơ])/, '').replace(/^yê/, 'iê');
  if (rime === 'y') rime = 'i';
  if (!rime) return [];
  const tone = level ? 'level' : 'sharp';
  const keys = [`${rime}|${tone}`];
  // The near-rhyme (vần thông) that lục bát lives on: the same closing sound and tone class, and
  // vowels of one family ("dâu / đau", "phong / hồng", "vàng / vương", "xanh / minh").
  const m = /^(.*?)(ng|nh|ch|[mnptc]|[iyou])?$/.exec(rime);
  if (m && m[1]) {
    const coda = !m[2] ? '' : 'iy'.includes(m[2]) ? 'j' : 'ou'.includes(m[2]) ? 'w' : m[2];
    const nucleus = m[1];
    // "anh" and "ach" are front vowels in speech, whatever the letter.
    const family = /^(i|y|ê|e|iê|yê|ia)$/.test(nucleus) || (nucleus === 'a' && (coda === 'nh' || coda === 'ch')) ? 'F' : /^(u|ô|o|uô|ua|oo)$/.test(nucleus) ? 'B' : /^(ư|ơ|â|a|ă|ươ|ưa)$/.test(nucleus) ? 'C' : nucleus;
    keys.push(`~${family}${coda}|${tone}`);
  }
  return keys;
}

// --- Arabic ---

/**
 * Arabic rhyme as the classical science of rhyme (علم القافية) defines it, read
 * from what is written. The rhyme letter (الرويّ) is the last consonant of the
 * line. A long vowel or a closing "h" written after it is its link (الوصل), and
 * a long vowel written before it is its support (الردف). Two words rhyme when
 * the rhyme letter and the support agree, and the vowel on the rhyme letter
 * agrees wherever both show it: a written long vowel, or a vowel mark in
 * vocalised text ("حَنْظَلِ / مِحْمَلِي": lam with i both; "كتاب / باب"; "قلبي / دربي").
 *
 * This is the whole of the classical rule for the consonant and its long
 * vowels, and it needs no dictionary. What unvocalised text does not show is
 * the short vowel on the rhyme letter: two unvocalised words on the same rhyme
 * letter pass whatever that vowel is. A wāw or yā' of support may answer each
 * other, as the tradition allows.
 */
function arabicRhymeParts(word: string): { rawi: string; ridf: string; vowel: string } | null {
  const w = word.normalize('NFC').replace(/\u0640/g, '');
  if (!/^[\u0621-\u064a\u064b-\u065f\u0670\u0671]+$/.test(w)) return null;
  // Letters with the marks written on each.
  const ls: Array<{ ch: string; marks: string }> = [];
  for (const ch of w) {
    if (/[\u064b-\u065f\u0670]/.test(ch)) {
      if (ls.length) ls[ls.length - 1].marks += ch;
    } else ls.push({ ch: ch.replace(/[آٱ]/, 'ا').replace('ى', 'ا').replace('ة', 'ه').replace(/[أإؤئ]/, 'ء'), marks: '' });
  }
  if (!ls.length) return null;
  const mark = (m: string) => (/[\u064e\u064b]/.test(m) ? 'a' : /[\u064f\u064c]/.test(m) ? 'u' : /[\u0650\u064d]/.test(m) ? 'i' : /\u0652/.test(m) ? '0' : '');
  let r = ls.length - 1;
  let vowel = mark(ls[r].marks);
  const last = ls[r];
  const isLong = (l: { ch: string; marks: string }) => 'اوي'.includes(l.ch) && !/[\u064e-\u0651]/.test(l.marks);
  if (r > 0 && isLong(last)) {
    vowel = last.ch === 'ا' ? 'a' : last.ch === 'و' ? 'u' : 'i';
    r--;
  } else if (r > 0 && last.ch === 'ه') {
    vowel = 'h';
    r--;
  }
  const before = r > 0 ? ls[r - 1] : null;
  const ridf = before && isLong(before) ? (before.ch === 'ا' ? 'a' : 'y') : '';
  return { rawi: ls[r].ch, ridf, vowel };
}

function arabicRhyme(a: string, b: string): boolean | null {
  const pa = arabicRhymeParts(a);
  const pb = arabicRhymeParts(b);
  if (!pa || !pb) return null;
  if (pa.rawi !== pb.rawi || pa.ridf !== pb.ridf) return false;
  return !pa.vowel || !pb.vowel || pa.vowel === pb.vowel;
}

// --- Hindi ---

/**
 * Hindi is written as it sounds, so the rule reads the sound: the consonants
 * and vowels of the word with the unwritten "a" left out where it is not said
 * (hindiAksharas in ./sound/lookup). A word ending in a consonant rhymes from
 * its last vowel ("रात / बात"); a word ending in a vowel rhymes from the vowel
 * before ("कहानी / रानी"), or on its closing consonant and vowel. Short and long i and u are merged and nasal marks
 * ignored. Lines that close on the same word (the radif of a ghazal:
 * "… है / … है") are compared on the word before it; see rhymeEnds().
 */
function hindiKey(word: string): string[] | null {
  const aks = hindiAksharas(word);
  if (aks === null) return null;
  // Merged, as Hindi verse has always rhymed them: a breathed consonant with its plain partner
  // ("मूठि / फूटि"), the retroflex n with n ("कान / बाण"), and the three s sounds ("महेस / उपदेश").
  const plain: Record<string, string> = { 'ख': 'क', 'घ': 'ग', 'छ': 'च', 'झ': 'ज', 'ठ': 'ट', 'ढ': 'ड', 'थ': 'त', 'ध': 'द', 'फ': 'प', 'भ': 'ब', 'ण': 'न', 'श': 'स', 'ष': 'स' };
  const s = aks.map((a) => (plain[a.c] ?? a.c) + a.v).join('').replace(/I/g, 'i').replace(/U/g, 'u');
  const isV = (c: string) => /[aAiueEoOr]/.test(c);
  const idx: number[] = [];
  for (let i = 0; i < s.length; i++) if (isV(s[i])) idx.push(i);
  if (!idx.length) return [s];
  const endsInVowel = isV(s[s.length - 1]);
  if (!endsInVowel || idx.length < 2) return [s.slice(idx[idx.length - 1])];
  // The fuller rhyme from the vowel before, and the plainer one of the closing consonant and vowel
  // ("इतरा / घबरा": -raa), which Hindi verse also takes.
  const keys = [s.slice(idx[idx.length - 2])];
  const closing = [...s].slice(-2).join('');
  if (!isV(closing[0])) keys.push(`=${closing}`);
  return keys;
}

// --- Korean ---

const KO_VOWEL_CLASS: Record<number, number> = { 1: 5, 3: 7, 10: 11, 15: 11 };
// Closing consonants as spoken: seven sounds for twenty-seven spellings.
const KO_CODA = [0, 1, 1, 1, 2, 2, 2, 3, 4, 1, 5, 4, 4, 4, 6, 4, 5, 6, 6, 3, 3, 7, 3, 3, 1, 3, 6, 3];

/**
 * Korean: the vowel and closing consonant of the last syllable block must
 * match, whatever consonant opens it ("사랑 / 자랑", "밤 / 삼"). For longer words
 * the vowel of the block before must match as well, or the last block must be
 * identical ("하늘 / 오늘"), which is how Korean lyrics rhyme.
 *
 * Generous by design: two verbs with the same ending ("간다 / 온다") pass.
 */
function koreanRhyme(a: string, b: string): boolean | null {
  const parts = (word: string) => {
    const blocks = [...word.normalize('NFC')].filter((c) => /\p{L}/u.test(c));
    if (!blocks.length || !blocks.every((c) => /[가-힣]/.test(c))) return null;
    const rime = (c: string) => {
      const n = c.charCodeAt(0) - 0xac00;
      const v = Math.floor((n % 588) / 28);
      return { v: KO_VOWEL_CLASS[v] ?? v, coda: KO_CODA[n % 28] };
    };
    const last = blocks[blocks.length - 1];
    return { last, rime: rime(last), before: blocks.length > 1 ? rime(blocks[blocks.length - 2]).v : null };
  };
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return null;
  if (pa.rime.v !== pb.rime.v || pa.rime.coda !== pb.rime.coda) return false;
  return pa.before === null || pb.before === null || pa.last === pb.last || pa.before === pb.before;
}

// --- Japanese ---

const KANA_ROWS: Array<[string, string]> = [
  ['a', 'あかさたなはまやらわがざだばぱ'],
  ['i', 'いきしちにひみりぎじぢびぴ'],
  ['u', 'うくすつぬふむゆるぐずづぶぷゔ'],
  ['e', 'えけせてねへめれげぜでべぺ'],
  ['o', 'おこそとのほもよろをごぞどぼぽ'],
];
const SMALL_KANA: Record<string, string> = { 'ゃ': 'a', 'ぁ': 'a', 'ぃ': 'i', 'ゅ': 'u', 'ぅ': 'u', 'ぇ': 'e', 'ょ': 'o', 'ぉ': 'o' };

/** The vowel of each sound (mora) of a kana string; "n" for ん, the vowel before for a long mark, nothing for っ. */
function kanaVowels(kana: string): string[] {
  const vowels: string[] = [];
  for (const ch of hiragana(kana)) {
    if (ch === 'っ') continue;
    if (ch === 'ん') vowels.push('n');
    else if (ch === 'ー') vowels.push(vowels[vowels.length - 1] ?? '');
    else if (SMALL_KANA[ch]) vowels[Math.max(0, vowels.length - 1)] = SMALL_KANA[ch];
    else vowels.push(KANA_ROWS.find(([, row]) => row.includes(ch))?.[0] ?? '');
  }
  return vowels;
}

/**
 * Japanese rhyme as its lyric writers make it (脚韻, and the "vowel matching"
 * of rap): the vowels of the last two sounds agree ("こころ / ところ", "世界 /
 * 未来"). Kana is read as written; a word with kanji is read by the analyser
 * (./sound/ja) and cannot be read without it. The long vowel of a spoken
 * reading counts as the vowel it lengthens ("きょう" is o-o).
 */
function japaneseKey(word: string): string[] | null {
  const direct = hiragana(word.normalize('NFKC')).replace(/[^\p{L}ー]/gu, '');
  let spoken = direct;
  if (!/^[ぁ-ゖー]+$/.test(direct)) {
    const toks = japaneseTokens(word);
    if (!toks || !toks.length) return null;
    spoken = toks.map((t) => t.spoken).join('');
  }
  const vowels = kanaVowels(spoken);
  return vowels.length >= 2 ? [vowels.slice(-2).join('')] : [];
}

/** What two Japanese lines are compared on: the reading of each line's last word, after any words both lines close on. */
function japaneseEnds(lineA: string, lineB: string): [string, string] | null {
  const a = japaneseTokens(lineA);
  const b = japaneseTokens(lineB);
  if (!a || !b || !a.length || !b.length) return null;
  let ia = a.length - 1;
  let ib = b.length - 1;
  // Lines that close on the same particle or verb ending ("… だ / … だ") are compared on what comes before it.
  while (ia > 0 && ib > 0 && a.length - ia <= 3 && a[ia].surface === b[ib].surface) {
    ia--;
    ib--;
  }
  const tail = (toks: typeof a, i: number) => {
    let s = toks[i].spoken;
    for (let j = i - 1; j >= 0 && moraeOfKana(s) < 2; j--) s = toks[j].spoken + s;
    return s;
  };
  return [tail(a, ia), tail(b, ib)];
}

// --- Chinese ---

/**
 * Rhyme groups that verse lets rhyme with each other, beyond a group with
 * itself. The groups are the sixteen of 中华通韵 (GF 0022-2019), lettered a to
 * p in its order as the Ministry of Education's 2018 call for poems printed
 * them, with its third group (鹅: e, ie, üe) split so that e alone is q.
 *
 * Allied: what one of the two published schemes of modern Mandarin rhyme joins.
 * 中华通韵 rhymes e with ie and üe (q, c). The thirteen-rut scheme of spoken
 * verse (十三辙) rhymes e with o and uo (梭波: q, b), i with ü and er (衣七: d,
 * f, p), and eng and ing with ong and iong (中东: n, o). Neither rhymes o or uo
 * with ie or üe ("我 / 夜", "躲 / 灭"), so b and c are not allied.
 */
const ZH_ALLIED: string[] = ['no', 'dfp', 'bq', 'cq'];

/**
 * Chinese: two lines rhyme when their last characters have finals of the same
 * rhyme group, whatever the tone ("光 / 乡", "来 / 开"). A character with more
 * than one reading is read as the word it closes (a table from CC-CEDICT);
 * alone, any of its standard readings may make the rhyme. The same character
 * twice is not a rhyme. Readings are modern Mandarin: a Tang poem that rhymed
 * in its own day may not rhyme now, and is not treated as if it did.
 */
function chineseRhyme(a: string, b: string): boolean | null {
  const ra = chineseReadings(a);
  const rb = chineseReadings(b);
  if (!ra || !rb) return null;
  const last = (t: string) => [...t].filter((c) => /\p{Script=Han}/u.test(c)).pop();
  if (last(a) === last(b)) return false;
  return ra.some(([ga]) => rb.some(([gb]) => ga === gb || ZH_ALLIED.some((s) => s.includes(ga) && s.includes(gb))));
}

// --- Thai ---

/**
 * Thai rhyme (สัมผัสสระ): the vowel and the closing sound of the last syllable
 * agree; the tone need not ("ใจ / ไป", "กัน / วัน", "รัก / หนัก"). The last
 * syllable is that of the longest dictionary word the text ends on, or is read
 * from the spelling when the table has no such word (./sound/th). The same
 * word twice is not a rhyme.
 */
function thaiRhyme(a: string, b: string): boolean | null {
  const ea = thaiEnd(a);
  const eb = thaiEnd(b);
  if (!ea || !eb) return null;
  if (ea.word === eb.word) return false;
  return ea.keys.some((k) => eb.keys.some((j) => nearKey('th', k) === nearKey('th', j)));
}

// --- Tolerance ---

/**
 * A rhyme key with the differences its verse tradition lets pass taken out.
 * Each is set from the published verse in src/lib/verse/sound/corpus (see
 * PHONETICS.md for the count of real rhymes each one admits):
 *
 * - French: "â" and "a" are one vowel, as are "un" and "in" in today's French.
 * - German: vowel length is not compared, and rounded front vowels rhyme with
 *   their unrounded partners (ü with i, ö with e, eu with ei): the "impure"
 *   rhyme German poets have always used ("Blick / zurück", "Freude / Weide").
 * - Thai: vowel length is not compared before a closing sound.
 */
export function nearKey(lang: string, key: string): string {
  if (lang === 'fr') return key.replace(/ɑ/g, 'a').replace(/œ̃/g, 'ɛ̃');
  if (lang === 'de') return key.replace(/ː/g, '').replace(/ɔ[ʏɪ]/g, 'aɪ').replace(/[yʏ]/g, 'i').replace(/[øœ]/g, 'e').replace(/ɪ/g, 'i').replace(/ʊ/g, 'u').replace(/ɛ/g, 'e').replace(/ɔ/g, 'o');
  return key;
}

const RULES: Record<string, Rule> = {
  es: byKeys(romanceKeys('es')),
  it: byKeys(romanceKeys('it')),
  pt: byKeys(romanceKeys('pt')),
  fr: frenchRhyme,
  de: germanRhyme,
  pl: byKeys(polishKey),
  ru: russianRhyme,
  id: byKeys(indonesianKey),
  vi: byKeys(vietnameseKey),
  ar: arabicRhyme,
  hi: byKeys(hindiKey),
  ko: koreanRhyme,
  ja: byKeys(japaneseKey),
  zh: chineseRhyme,
  th: thaiRhyme,
};

/** Two different words whose endings match, by the rule of the verse's language. */
export function rhymes(a: string, b: string, lang = 'en'): boolean {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb) return false;
  // Folding drops Vietnamese tones, and two Vietnamese words that differ only in tone are different words.
  const same = baseLang(lang) === 'vi' ? a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase() : fa === fb;
  if (same) return false;
  const rule = RULES[baseLang(lang)];
  if (rule) {
    const verdict = rule(a, b);
    if (verdict !== null) return verdict;
    // Chinese, Japanese, Thai: a word that cannot be read does not rhyme; the Latin rule below is not for them.
    if (/^(zh|ja|th)$/.test(baseLang(lang)) && !/^[\p{Script=Latin}'’\-]+$/u.test(fa + fb)) return false;
  }
  // English, an unlisted language, or a word from another script inside the verse.
  return englishRhyme(fa, fb);
}

/**
 * The two words on which a pair of lines is compared for rhyme. Normally the
 * last word of each. In Hindi, lines that close on the same word or words (the
 * radif) are compared on the word before. Where words are written without
 * spaces the platform's word segmenter is not asked: Chinese is compared on
 * the last characters of each line (up to four, so that a word can settle the
 * reading of its last character), Thai on the dictionary word each line ends
 * on, Japanese on the reading of each line's last word.
 */
export function rhymeEnds(lineA: string, lineB: string, lang = 'en'): [string, string] {
  const base = baseLang(lang);
  if (base === 'zh') {
    const tail = (l: string) => [...l].filter((c) => /\p{Script=Han}/u.test(c)).slice(-4).join('');
    return [tail(lineA), tail(lineB)];
  }
  if (base === 'th') return [thaiEnd(lineA)?.word ?? '', thaiEnd(lineB)?.word ?? ''];
  if (base === 'ja') {
    const ends = japaneseEnds(lineA, lineB);
    if (ends) return ends;
  }
  const a = wordsOf(lineA, lang);
  const b = wordsOf(lineB, lang);
  let ia = a.length - 1;
  let ib = b.length - 1;
  if (baseLang(lang) === 'hi') {
    while (ia > 0 && ib > 0 && a.length - ia <= 3 && fold(a[ia]) === fold(b[ib])) {
      ia--;
      ib--;
    }
  }
  return [a[ia] ?? '', b[ib] ?? ''];
}
