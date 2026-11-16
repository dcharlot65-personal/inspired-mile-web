/**
 * Rhyme, decided from spelling alone, one rule per language.
 *
 * There is no pronouncing dictionary here, so every rule is an approximation,
 * and each says below what it can and cannot hear. All of them are tuned the
 * same way as the English one always was: a doubtful rhyme is allowed rather
 * than a real one refused. A word never rhymes with itself.
 *
 * Where spelling cannot carry a fair rule, there is none, and rhymeChecked()
 * says so; the rhyming forms are then not offered in that language:
 *
 * - Chinese: a character does not show its sound, and no reading table ships
 *   with the game.
 * - Japanese: the rule below works on kana, but most line endings are kanji,
 *   and rhyme is not how Japanese verse is made.
 * - Thai: the vowel is written around the consonant and one final sound has
 *   many spellings; a rule short of a full syllable parser refuses real rhymes.
 */
import { baseLang } from './lang';
import { fold, hiragana, wordsOf } from './text';

const LATIN_VOWELS = 'aeiouy';

/** Can rhyme be checked fairly in this language? Decides whether rhyming forms are offered. */
export function rhymeChecked(lang: string): boolean {
  return !/^(zh|ja|th)$/.test(baseLang(lang));
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
    if (/[̀-ͯ]/.test(ch)) {
      const last = out[out.length - 1];
      if (!last) continue;
      if (ch === '̃' && last.ch === 'n') last.ch = 'ñ';
      else if (ch === '̧' && last.ch === 'c') last.ch = 'ç';
      else if (last.vowel && /[̀́̂̃]/.test(ch)) last.stress = true;
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

/**
 * Consonant rhyme for Spanish, Italian and Portuguese: everything from the
 * stressed vowel to the end. The stressed vowel is found from the written
 * accent, or else from each language's spelling rule (Spanish: the last
 * syllable but one when the word ends in a vowel, n or s; otherwise the last).
 *
 * Hears: "vida / herida", "corazón / canción", "amor / dolor", "città / verità".
 * Refuses, correctly: "vida / nada". Cannot hear: assonance, which Spanish verse
 * also accepts; Italian words stressed three syllables from the end ("anima"),
 * which are keyed as if stressed on the second last; and Italian "-ia", which
 * may be one syllable ("storia") or two ("poesia"), so both readings are tried.
 */
function romanceKeys(lang: 'es' | 'it' | 'pt'): (word: string) => string[] | null {
  return (word) => {
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
      // Unaccented "-ia", "-io", "-ua" is stressed on the i or u ("dia", "alegria", "rua").
      const hiatus = /(?<![qg])[iu][aeo]s?$/.exec(text);
      if (hiatus) starts.push(hiatus.index);
      else starts.push(/([aeo]s?|[ae]m|ens)$/.test(text) ? penult : lastN);
    } else {
      starts.push(/[aeiou]$/.test(text) ? penult : lastN);
      const hiatus = /(?<![cgq])[iu][aeo]$/.exec(text);
      if (hiatus) starts.push(hiatus.index);
    }
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
function frenchKeys(word: string): string[] | null {
  const w0 = word.toLowerCase().normalize('NFC').replace(/œ/g, 'oe').replace(/æ/g, 'e').replace(/['’\-]/g, '');
  if (!/^[a-zàâäçéèêëîïôöùûüÿ]+$/.test(w0)) return null;
  const hasVowel = (s: string) => /[aeiouyàâäéèêëîïôöùûüÿ]/.test(s);
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
    let t = plain(st.s);
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

function germanRhyme(a: string, b: string): boolean | null {
  const ka = germanKey(a)?.[0];
  const kb = germanKey(b)?.[0];
  if (ka === undefined || kb === undefined) return null;
  if (ka === kb) return true;
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return short.length >= 2 && long.endsWith(short);
}

// --- Polish ---

/**
 * Polish is stressed on the last syllable but one, so a word ending in a vowel
 * rhymes from the vowel before ("kocha / szlocha"); a word ending in a consonant
 * is keyed from its last vowel, which also lets through the looser rhymes poets
 * use ("miłość / radość"). ó is u, rz is ż, ch is h, and an i before a vowel is
 * only a softening.
 *
 * Cannot hear: the unvoicing of a closing consonant ("chleb / sklep").
 */
function polishKey(word: string): string[] | null {
  let w = word.toLowerCase().normalize('NFC').replace(/['’\-]/g, '');
  if (!/^[a-ząćęłńóśźż]+$/.test(w)) return null;
  const V = 'aąeęiouy';
  w = w.replace(/ó/g, 'u').replace(/rz/g, 'ż').replace(/ch/g, 'h').replace(/i(?=[aąeęouy])/g, '').replace(/ę$/, 'e');
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
function russianKey(word: string): string[] | null {
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
 * Cannot hear: the near-rhymes (vần thông) poets also accept, such as "an / ang".
 */
function vietnameseKey(word: string): string[] | null {
  const nfd = word.toLowerCase().normalize('NFD');
  const level = !/[̣́̃̉]/.test(nfd);
  const bare = nfd.replace(/[̣̀́̃̉]/g, '').normalize('NFC');
  if (!/^[a-zâăêôơưđ]+$/.test(bare)) return null;
  let rime = bare.replace(/^(ngh|ng|gh|gi(?=[aâăeêoôơuư])|kh|nh|ph|qu|th|tr|ch|[bcdđghklmnpqrstvx])/, '');
  rime = rime.replace(/^o(?=[aăe])/, '').replace(/^u(?=[yêâơ])/, '').replace(/^yê/, 'iê');
  if (rime === 'y') rime = 'i';
  if (!rime) return [];
  return [`${rime}|${level ? 'level' : 'sharp'}`];
}

// --- Arabic ---

/**
 * Arabic rhyme is carried by the closing consonant of the line (the rawiyy)
 * and, when one is written, the long vowel beside it. Short vowels are not
 * written, so the rule compares what the script shows: the last letter, with
 * the long vowel before it ("كتاب / باب"), or the letter before a closing long
 * vowel or pronoun ("قلبي / دربي").
 *
 * Cannot hear: unwritten short vowels, so two words on the same last consonant
 * pass whether or not their vowels agree.
 */
function arabicKey(word: string): string[] | null {
  let w = fold(word);
  if (!/^[ء-ي]+$/.test(w)) return null;
  w = w.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  const ls = [...w];
  const last = ls[ls.length - 1];
  const prev = ls[ls.length - 2] ?? '';
  const long = 'اوي';
  if (long.includes(last) || last === 'ه') return [prev + last];
  return [long.includes(prev) ? prev + last : last];
}

// --- Hindi ---

const DEV_SIGNS: Record<string, string> = { 'ा': 'A', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'E', 'ो': 'o', 'ौ': 'O', 'ृ': 'r', 'ॉ': 'o', 'ॅ': 'e' };
const DEV_VOWELS: Record<string, string> = { 'अ': 'a', 'आ': 'A', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'E', 'ओ': 'o', 'औ': 'O', 'ऋ': 'r', 'ऑ': 'o' };

/** A Devanagari word with its vowels written out in Latin letters, the unwritten "a" included. */
function devanagariSounds(word: string): string | null {
  const w = word.normalize('NFC').replace(/[़ँंः]/g, '');
  if (!w || !/^[ऄ-ॣॱ-ॿ]+$/.test(w)) return null;
  const cs = [...w];
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const ch = cs[i];
    if (DEV_VOWELS[ch]) out += DEV_VOWELS[ch];
    else if (/[क-हक़-य़]/.test(ch)) {
      out += ch;
      const next = cs[i + 1];
      if (next && DEV_SIGNS[next]) {
        out += DEV_SIGNS[next];
        i++;
      } else if (next === '्') i++;
      else if (next !== undefined) out += 'a';
    }
  }
  return out;
}

/**
 * Hindi is written as it sounds, so the rule reads the sound: a word ending in
 * a consonant rhymes from its last vowel ("रात / बात"); a word ending in a
 * vowel rhymes from the vowel before ("कहानी / रानी"). Short and long i and u
 * are merged and nasal marks ignored. Lines that close on the same word (the
 * radif of a ghazal: "… है / … है") are compared on the word before it; see
 * rhymeEnds().
 *
 * Cannot hear: the "a" dropped inside a word in speech; it is kept in both
 * words alike, so it rarely changes the answer.
 */
function hindiKey(word: string): string[] | null {
  const s = devanagariSounds(word);
  if (s === null) return null;
  const isV = (c: string) => /[aAiueEoOr]/.test(c);
  const idx: number[] = [];
  for (let i = 0; i < s.length; i++) if (isV(s[i])) idx.push(i);
  if (!idx.length) return [s];
  const endsInVowel = isV(s[s.length - 1]);
  return [s.slice(endsInVowel && idx.length > 1 ? idx[idx.length - 2] : idx[idx.length - 1])];
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

// --- Japanese (kana only; used by devices, not by forms) ---

const KANA_ROWS: Array<[string, string]> = [
  ['a', 'あかさたなはまやらわがざだばぱ'],
  ['i', 'いきしちにひみりぎじぢびぴ'],
  ['u', 'うくすつぬふむゆるぐずづぶぷ'],
  ['e', 'えけせてねへめれげぜでべぺ'],
  ['o', 'おこそとのほもよろをごぞどぼぽ'],
];
const SMALL_KANA: Record<string, string> = { 'ゃ': 'a', 'ぁ': 'a', 'ぃ': 'i', 'ゅ': 'u', 'ぅ': 'u', 'ぇ': 'e', 'ょ': 'o', 'ぉ': 'o' };

/** Japanese words in kana rhyme when the vowels of their last two sounds match. A word with kanji cannot be read. */
function japaneseKey(word: string): string[] | null {
  const w = hiragana(word.normalize('NFC'));
  if (!/^[ぁ-ゖー]+$/.test(w)) return null;
  const vowels: string[] = [];
  for (const ch of w) {
    if (ch === 'っ') continue;
    if (ch === 'ん') vowels.push('n');
    else if (ch === 'ー') vowels.push(vowels[vowels.length - 1] ?? '');
    else if (SMALL_KANA[ch]) vowels[Math.max(0, vowels.length - 1)] = SMALL_KANA[ch];
    else vowels.push(KANA_ROWS.find(([, row]) => row.includes(ch))?.[0] ?? '');
  }
  return vowels.length >= 2 ? [vowels.slice(-2).join('')] : [];
}

const RULES: Record<string, Rule> = {
  es: byKeys(romanceKeys('es')),
  it: byKeys(romanceKeys('it')),
  pt: byKeys(romanceKeys('pt')),
  fr: byKeys(frenchKeys),
  de: germanRhyme,
  pl: byKeys(polishKey),
  ru: byKeys(russianKey),
  id: byKeys(indonesianKey),
  vi: byKeys(vietnameseKey),
  ar: byKeys(arabicKey),
  hi: byKeys(hindiKey),
  ko: koreanRhyme,
  ja: byKeys(japaneseKey),
};

/** Two different words whose endings match, by the rule of the verse's language. */
export function rhymes(a: string, b: string, lang = 'en'): boolean {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb || fa === fb) return false;
  const rule = RULES[baseLang(lang)];
  if (rule) {
    const verdict = rule(a, b);
    if (verdict !== null) return verdict;
  }
  // English, an unlisted language, or a word from another script inside the verse.
  return englishRhyme(fa, fb);
}

/**
 * The two words on which a pair of lines is compared for rhyme. Normally the
 * last word of each. In Hindi, lines that close on the same word or words (the
 * radif) are compared on the word before.
 */
export function rhymeEnds(lineA: string, lineB: string, lang = 'en'): [string, string] {
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
