/**
 * Mechanical checks on translated strings: things a rule can decide without
 * knowing the language. Pure functions, used by the unit tests
 * (src/i18n/quality.test.ts) and by scripts/lang/check.mjs.
 *
 * Every function returns a list of problems: { lang, key, rule, detail }.
 * A convention of a language (Thai has no full stop) is written here, as code.
 * An exception for one string lives in docs/language/allow/mechanical.json, with
 * its reason.
 */

/** The script each language is written in, as a Unicode property test. */
export const SCRIPT = {
  ru: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
  hi: /\p{Script=Devanagari}/u,
  zh: /\p{Script=Han}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  th: /\p{Script=Thai}/u,
};

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}';

/** Strip placeholders and plural syntax, leaving the words a player reads (all branches, joined by a line break). */
export function visibleText(template, parseMessage) {
  const out = [];
  const walk = (parts, acc) => {
    let texts = [acc];
    for (const p of parts) {
      if (p.type === 'text') texts = texts.map((t) => t + p.value);
      else if (p.type === 'arg' || p.type === 'pound') texts = texts.map((t) => t + '\uFFFC');
      else {
        const next = [];
        for (const t of texts) for (const o of Object.values(p.options)) next.push(...walk(o, t));
        texts = next;
      }
    }
    return texts;
  };
  out.push(...walk(parseMessage(template), ''));
  return out;
}

/**
 * Checks on one language's strings.
 *   strings: { key: template }      english: { key: template }
 *   cldr:    docs/language/sources/cldr.json's entry for the language
 *   helpers: { parseMessage, argumentNames, pluralBlocks }
 */
export function checkLanguage(lang, strings, english, cldr, helpers, opts = {}) {
  const { parseMessage, argumentNames, pluralBlocks } = helpers;
  const problems = [];
  const bad = (key, rule, detail) => problems.push({ lang, key, rule, detail });
  const quotations = opts.quotations ?? {};
  const extraQuotes = opts.extraQuotes?.[lang] ?? [];
  const categories = cldr.pluralCategories;

  for (const key of Object.keys(english)) if (!(key in strings)) bad(key, 'missing-key', 'not in this locale');
  for (const [key, value] of Object.entries(strings)) {
    if (!(key in english)) {
      bad(key, 'extra-key', 'not in English');
      continue;
    }
    if (typeof value !== 'string' || value.trim() === '') {
      bad(key, 'empty', 'no text');
      continue;
    }
    if (key in quotations) {
      if (value !== quotations[key]) bad(key, 'quotation-changed', 'a quotation must be the source text');
      continue;
    }

    // --- structure ---
    let names;
    try {
      names = argumentNames(value);
    } catch (err) {
      bad(key, 'syntax', err.message);
      continue;
    }
    const enNames = argumentNames(english[key]);
    if (names.join(',') !== enNames.join(',')) bad(key, 'placeholders', `has {${names}} but English has {${enNames}}`);

    // --- plural forms: exactly the categories CLDR gives the language ---
    const blocks = pluralBlocks(value);
    const enCounted = new Set(pluralBlocks(english[key]).map((b) => b.name));
    const counted = new Set(blocks.map((b) => b.name));
    if (categories.length > 1) for (const name of enCounted) if (!counted.has(name)) bad(key, 'plural-missing', `{${name}} is a count in English; this language has the forms ${categories.join(', ')} and gives none`);
    for (const b of blocks) {
      const cats = b.selectors.filter((s) => s[0] !== '=');
      const missing = categories.filter((c) => !cats.includes(c));
      const extra = cats.filter((c) => !categories.includes(c));
      if (missing.length) bad(key, 'plural-category-missing', `{${b.name}} lacks ${missing.join(', ')}`);
      if (extra.length) bad(key, 'plural-category-unknown', `{${b.name}} has ${extra.join(', ')}, which this language does not use`);
    }

    const texts = visibleText(value, parseMessage);
    const enTexts = visibleText(english[key], parseMessage);
    const whole = texts.join('\n');

    // --- white space ---
    if (/ {2,}/.test(value)) bad(key, 'double-space', 'two spaces in a row');
    if (/[\t\r\n]/.test(value)) bad(key, 'control-space', 'a tab or a line break');
    const lead = (s) => /^\s/.test(s);
    const trail = (s) => /\s$/.test(s);
    // A piece of a sentence that is joined to a link (" and ", "By signing in, you agree to our ") carries
    // its own spaces. English says where they are needed. Two things may differ, and no more: a language
    // written without spaces between words (zh, ja, th) may drop them, and where the English piece is bare
    // punctuation (".") a language that ends the sentence with words (" kami.") brings its own leading space.
    const spaced = !['zh', 'ja', 'th'].includes(lang);
    const enBare = !/[\p{L}\p{N}]/u.test(english[key]);
    if (lead(value) !== lead(english[key]) && !(lead(value) ? enBare : !spaced)) bad(key, 'edge-space', 'leading space differs from English');
    if (trail(value) !== trail(english[key]) && !(trail(value) ? false : !spaced)) bad(key, 'edge-space', 'trailing space differs from English');

    // --- Unicode hygiene ---
    if (value.normalize('NFC') !== value) bad(key, 'not-nfc', 'not in Unicode normal form C');
    for (const ch of value) {
      const cp = ch.codePointAt(0);
      if (cp === 0xfffd) bad(key, 'replacement-char', 'U+FFFD');
      // Bidirectional controls: a string must read right from its own letters.
      if ((cp >= 0x200e && cp <= 0x200f) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x061c) bad(key, 'bidi-control', `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
      if (cp === 0x200b || cp === 0xfeff || cp === 0x00ad || cp === 0x2060) bad(key, 'invisible-char', `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
      // Joiners belong to Indic and Arabic-script shaping only.
      if ((cp === 0x200c || cp === 0x200d) && lang !== 'hi') bad(key, 'invisible-char', `U+${cp.toString(16).toUpperCase()}`);
      if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) bad(key, 'control-char', `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
    }
    // A word that mixes Latin with Cyrillic or Greek letters is a look-alike typo.
    for (const w of whole.split(/[^\p{L}]+/u)) {
      if (/\p{Script=Latin}/u.test(w) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(w)) bad(key, 'mixed-script-word', w);
    }

    // --- the language's own script is there ---
    if (SCRIPT[lang] && !SCRIPT[lang].test(whole) && /\p{L}{2,}/u.test(whole.replace(/\uFFFC/g, ''))) bad(key, 'no-native-script', 'no letter of the language’s script');

    // --- punctuation ---
    if (/([,;:!?،؛؟。、，；：！？])\1/u.test(whole)) bad(key, 'doubled-punctuation', whole.match(/([,;:!?،؛؟。、，；：！？])\1/u)[0]);
    if (/\.\.(?!\.)/.test(whole.replace(/\.{3}/g, ''))) bad(key, 'doubled-punctuation', '..');
    if (lang !== 'fr' && /[^\s\uFFFC] [,.;:!?](?:\s|$)/u.test(whole)) bad(key, 'space-before-punctuation', whole.match(/\S [,.;:!?]/)?.[0] ?? '');
    if (/[(\[] | [)\]]/.test(whole)) bad(key, 'space-inside-brackets', '');
    // One ellipsis character, not three full stops.
    if (/\.\.\./.test(whole)) bad(key, 'ascii-ellipsis', 'three full stops; the ellipsis is one character (…)');
    const count = (s, c) => s.split(c).length - 1;
    for (const [a, b] of [['(', ')'], ['[', ']'], ['（', '）'], ['「', '」'], ['『', '』'], ['«', '»']]) {
      if (texts.some((t) => count(t, a) !== count(t, b))) bad(key, 'unbalanced', `${a}${b}`);
    }

    // --- quotation marks: the language's own (CLDR), never the typewriter's ---
    if (whole.includes('"')) bad(key, 'straight-quote', 'use the language’s quotation marks');
    const allowed = new Set([...cldr.quotes, ...cldr.altQuotes, ...extraQuotes]);
    for (const ch of whole) {
      if ('“”„‟«»‹›「」『』‚'.includes(ch) && !allowed.has(ch)) bad(key, 'foreign-quote', `${ch} is not a ${lang} quotation mark (${[...allowed].join(' ')})`);
    }
    // ‘ and ’ are also apostrophes, so only the opening one is telling.
    if (whole.includes('‘') && !allowed.has('‘')) bad(key, 'foreign-quote', '‘');

    // --- conventions of particular languages ---
    if (lang === 'fr') {
      // French sets a no-break space before ; : ! ? and inside « ». An ordinary space lets the mark fall alone onto the next line.
      for (const t of texts) {
        for (const m of t.matchAll(/(.)([;:!?»])/gu)) {
          const before = m[1];
          if (m[2] === ':' && /\d/.test(before)) continue; // a time or a ratio
          if (before === '\u00a0' || before === '\u202f') continue;
          if (m[2] !== '»' && (before === '!' || before === '?')) continue; // ?! and !!
          if (m[2] === ':' && /^:\/\//.test(t.slice(m.index + 1))) continue;
          bad(key, 'fr-nbsp', `"${before}${m[2]}" needs a no-break space before ${m[2]}`);
        }
        for (const m of t.matchAll(/«(.)/gu)) if (m[1] !== '\u00a0' && m[1] !== '\u202f') bad(key, 'fr-nbsp', 'a no-break space is needed after «');
      }
    }
    if (lang === 'de') {
      // German sets a space before an ellipsis that stands for words left out (Duden, Auslassungspunkte); no-break, so the dots stay with their word.
      for (const t of texts) if (/[^\s\u00a0\u202f]…/u.test(t)) bad(key, 'de-ellipsis-space', 'a no-break space is needed before …');
    }
    if (lang === 'es') {
      // Spanish opens a question and an exclamation: ¿…? ¡…!
      for (const t of texts) {
        if (count(t, '?') !== count(t, '¿')) bad(key, 'es-inverted', '¿ and ? do not pair');
        if (count(t, '!') !== count(t, '¡')) bad(key, 'es-inverted', '¡ and ! do not pair');
      }
    } else if (/[¿¡]/.test(whole)) bad(key, 'es-inverted', '¿ or ¡ outside Spanish');
    if (lang === 'zh' || lang === 'ja') {
      // Chinese and Japanese text takes full-width punctuation.
      const m = whole.match(new RegExp(`[${CJK}][,;:!?]|[,;:!?][${CJK}]|[${CJK}]\\.(?:\\s|$)|[${CJK}]\\(|\\)[${CJK}]`, 'u'));
      if (m) bad(key, 'cjk-halfwidth', `"${m[0]}" is half-width punctuation in ${lang} text`);
      if (new RegExp(`[${CJK}] [${CJK}]`, 'u').test(whole)) bad(key, 'cjk-space', 'a space between two characters');
    } else if (/[，。；：！？、（）「」『』]/u.test(whole) && lang !== 'ko') bad(key, 'fullwidth-punctuation', 'full-width punctuation outside Chinese and Japanese');
    if (lang === 'ar') {
      const m = whole.match(/\p{Script=Arabic}\s?[,;?]|[,;?]\s?\p{Script=Arabic}/u);
      if (m) bad(key, 'ar-punctuation', `"${m[0]}": Arabic writes ، ؛ ؟`);
      // Tatweel is decoration, except where it carries a one-letter particle onto a name it cannot join (بـ Gemma).
      if (/ـ/.test(whole.replace(/(^|\s)[بلكوف]ـ(?= ?[\uFFFC\p{Script=Latin}])/gu, '$1'))) bad(key, 'ar-tatweel', 'tatweel (kashida) in text');
    } else if (/[،؛؟]/.test(whole)) bad(key, 'ar-punctuation', 'Arabic punctuation outside Arabic');
    if (lang === 'hi') {
      if (/\p{Script=Devanagari}\.(?:\s|$)/u.test(whole)) bad(key, 'hi-danda', 'a Hindi sentence ends with the danda (।), not a full stop');
    } else if (/[।॥]/.test(whole)) bad(key, 'hi-danda', 'danda outside Hindi');
    if (lang === 'th') {
      if (/\p{Script=Thai}\.(?:\s|$)/u.test(whole)) bad(key, 'th-full-stop', 'Thai does not end a sentence with a full stop');
    }
    if (lang === 'el' && whole.includes('?')) bad(key, 'el-question', 'Greek asks with ;');

    // --- how a string ends follows English: a sentence, a label, a pause ---
    const endClass = (s) => {
      const t = s.replace(/\s+$/u, '').replace(/[”’»」』"'“)）]+$/u, '');
      if (t.endsWith('\uFFFC')) return 'value'; // ends on a filled-in value: nothing to compare
      if (/(…|\.\.\.)$/.test(t)) return 'ellipsis';
      if (/[?？؟]$/.test(t)) return 'question';
      if (/[!！]$/.test(t)) return 'exclamation';
      if (/[:：]$/.test(t)) return 'colon';
      if (/[.。।]$/.test(t)) return 'stop';
      return 'none';
    };
    const want = endClass(enTexts[0]);
    for (const t of texts) {
      const got = endClass(t);
      if (got === want || got === 'value' || want === 'value') continue;
      // Thai ends a sentence with a space, not a full stop, and asks with a particle (ไหม), not a mark.
      if (lang === 'th' && (want === 'stop' || want === 'question') && got === 'none') continue;
      bad(key, 'ending', `ends as "${got}" where English ends as "${want}"`);
      break;
    }
  }
  return problems;
}

/** Keys whose text is the same as English, apart from the ones a language is allowed to share. */
export function untranslated(lang, strings, english, quotations = {}) {
  if (lang === 'en') return [];
  // A string with no word in it ("{name}: {brief}", ".") has nothing to translate.
  const hasWords = (s) => /\p{L}{2,}/u.test(s.replace(/\{[^{}]*\}/g, ''));
  return Object.keys(english).filter((k) => !(k in quotations) && strings[k] === english[k] && hasWords(english[k]));
}

/** Apply an allowlist: [{ lang, key, rule, reason }], where lang may be '*'. Returns { open, used, unused }. */
export function applyAllowlist(problems, allow) {
  const used = new Set();
  const open = problems.filter((p) => {
    const i = allow.findIndex((a) => (a.lang === '*' || a.lang === p.lang) && a.key === p.key && a.rule === p.rule);
    if (i < 0) return true;
    used.add(i);
    return false;
  });
  return { open, used: [...used].map((i) => allow[i]), unused: allow.filter((_, i) => !used.has(i)) };
}
