//! Text measurement for verse: cleaning, lines, words, letters, syllables, rhyme, the
//! floor every verse must clear, the measure of a copied verse, and words as a curse
//! reads them.
//!
//! A port, for English, of `src/lib/verse/text.ts` and of the English rule in
//! `src/lib/verse/rhyme.ts`. The TypeScript measures sixteen languages; the server scores
//! English only, so every function here is the `lang = 'en'` path of its original, and the
//! thresholds are those of `rulesFor('en')` in `lang.ts` ([`rules`]).
//!
//! English is measured by sound where it can be: the pronunciation table
//! ([`super::pronounce`]) gives a word its syllable counts and rhyme keys and says whether it
//! is a word at all (the lexicon), and the spelling rules here are the fallback for a word
//! the table lacks. Which letters are drawn alike is Unicode's data (UTS #39 confusables),
//! read from the same generated file the browser imports, `src/lib/verse/confusables.ts`.
//!
//! Where JavaScript and Rust differ, this file follows JavaScript, because the browser's
//! preview and the server's score must be the same number:
//!
//! - JavaScript strings are UTF-16. `cleanVerse` caps a verse at 600 UTF-16 units, the
//!   spelled rhyme key measures and slices in UTF-16 units, and so does the English stem of
//!   the copy measure, so lengths here are counted that way and rhyme keys are `Vec<u16>`.
//! - "White space" means what JavaScript's `\s` and `trim()` mean ([`is_js_space`]), which is
//!   not Rust's `char::is_whitespace`.
//! - Lower-casing is `toLowerCase()`: full Unicode case mapping, which `str::to_lowercase`
//!   also implements (final sigma included).
//! - `Math.round` rounds a half up, towards +∞ ([`js_round`]), and every ratio is computed in
//!   IEEE 754 doubles in the same order of operations as the TypeScript.
//!
//! One thing cannot be made the same by code: the Unicode tables. Normalisation and the
//! character classes come from this binary's crates and from the browser's engine, and a
//! character assigned in a newer Unicode version than one side knows may be read
//! differently. The golden vectors hold the two together for everything in their corpus.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use regex::{Captures, Regex};
use unicode_normalization::UnicodeNormalization;

use super::pronounce::{pronounce, sound_rhyme};

/// Longest verse the game accepts, in UTF-16 code units.
pub const MAX_VERSE_CHARS: usize = 600;
pub const MAX_VERSE_LINES: usize = 8;

/// What "a long word" or "a short line" means in English (`rulesFor('en')` in lang.ts).
pub mod rules {
    /// Letters that make a word strong enough to count for repetition and echoes.
    pub const CONTENT: usize = 4;
    /// Letters a word needs before throwing it back counts as a riposte.
    pub const RIPOSTE: usize = 5;
    /// Letters that make a word grand.
    pub const GRAND: usize = 9;
    /// Longest word the Tongue-Tied curse allows, in letters.
    pub const SHORT_WORD: usize = 6;
    /// Longest line Brevity allows, in words.
    pub const BREVITY: usize = 6;
    /// Longest line the Short Breath curse allows, in words.
    pub const SHORT_LINE: usize = 5;
}

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).unwrap_or_else(|e| panic!("pattern {pattern:?}: {e}"))
}

static LETTER_RE: LazyLock<Regex> = LazyLock::new(|| re(r"\p{L}"));
static MARK_RE: LazyLock<Regex> = LazyLock::new(|| re(r"\p{M}"));
static NON_LETTER_RE: LazyLock<Regex> = LazyLock::new(|| re(r"[^\p{L}]"));
static LATIN_RE: LazyLock<Regex> = LazyLock::new(|| re(r"\p{Latin}"));
static CYRILLIC_RE: LazyLock<Regex> = LazyLock::new(|| re(r"\p{Cyrillic}"));
static GREEK_RE: LazyLock<Regex> = LazyLock::new(|| re(r"\p{Greek}"));

fn is_class(class: &Regex, c: char) -> bool {
    let mut buf = [0u8; 4];
    class.is_match(c.encode_utf8(&mut buf))
}

fn is_letter(c: char) -> bool {
    is_class(&LETTER_RE, c)
}

fn has_letter(text: &str) -> bool {
    LETTER_RE.is_match(text)
}

/// Characters this binary's Unicode tables do not assign (`\p{Cn}`): assigned in a newer
/// Unicode version than the server knows (the browser's engine may know it), or not at all.
static UNASSIGNED: LazyLock<Regex> = LazyLock::new(|| re(r"\p{Cn}"));

/// The first character of `text` that this binary's Unicode tables do not assign, if any.
///
/// The rules read letters, marks, scripts and normal forms from Unicode's tables, and the
/// browser's tables can be newer than the server's (a character added in Unicode 17 is a
/// letter of the Latin script to Node 26 and unassigned to this build). The server could
/// not score such a verse the way the page previews it, so it refuses it instead
/// (`game_room` `submit`), and the golden vectors leave such characters out of the
/// comparison only because the server never scores them.
pub fn unknown_character(text: &str) -> Option<char> {
    UNASSIGNED.find(text).and_then(|m| m.as_str().chars().next())
}

/// Length in UTF-16 code units: JavaScript's `.length`.
fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// JavaScript's `Math.round`: the nearest integer, a half rounded up (towards +∞).
/// `(x + 0.5).floor()` is not the same: it rounds 0.49999999999999994 to 1.
pub fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 { f + 1.0 } else { f }
}

/// `toLowerCase()` of one character, as a string (it can be longer: "İ" is "i̇").
fn lower_char(c: char) -> String {
    c.to_lowercase().collect()
}

// --- Cleaning ---
//
// A verse is normalised once, here, before anything measures it, so that what the rules
// read is what a person sees:
//   1. every kind of line break becomes "\n";
//   2. compatibility forms become the plain character (NFKC), except in Thai and Lao;
//   3. characters that draw nothing but are not white space become a space;
//   4. characters that draw nothing at all are removed: controls, format characters,
//      private-use code points and the other default-ignorables;
//   5. combining marks with no letter under them are removed, and a pile of them is cut short;
//   6. inside a word that mixes alphabets, a letter of another alphabet that is drawn like
//      one of the word's own is read as that letter (UTS #39 confusables).
// Cleaning is repeated until it changes nothing (`cleanVerse`), so a clean verse is left as it is.

/// `BLANKS`: tab, the Hangul fillers, the Braille blank and every space separator.
static BLANKS: LazyLock<Regex> = LazyLock::new(|| re(r"[\t\x{115f}\x{1160}\x{3164}\x{ffa0}\x{2800}\p{Zs}]"));
/// `INVISIBLE`. JavaScript's class also names lone surrogates, which a Rust string cannot hold.
static INVISIBLE: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{Cc}\p{Cf}\p{Co}\p{Default_Ignorable_Code_Point}]"));
static ORPHAN_MARKS: LazyLock<Regex> = LazyLock::new(|| re(r"(^|[^\p{L}\p{N}\p{M}])\p{M}+"));
/// Most combining marks one letter may carry (`MAX_MARKS`) is four.
static MARK_PILE: LazyLock<Regex> = LazyLock::new(|| re(r"(\p{M}{4})\p{M}+"));
static WORD_RUN: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{L}\p{M}]+"));

// --- Letters drawn alike (UTS #39) ---

/// The generated module of confusable letters, as text: the browser imports the same file.
const CONFUSABLES_SOURCE: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/verse/confusables.ts"));

/// The data of `confusables.ts`: a letter and its Latin prototype, one after the other, in the
/// string the module exports by default. The string holds no quote and no backslash (the
/// generator writes letters only), so its text is the string itself.
fn confusable_pairs() -> &'static str {
    const OPEN: &str = "export default \"";
    let start = CONFUSABLES_SOURCE.find(OPEN).expect("confusables.ts exports a string") + OPEN.len();
    let end = start + CONFUSABLES_SOURCE[start..].find('"').expect("confusables.ts closes its string");
    let data = &CONFUSABLES_SOURCE[start..end];
    assert!(!data.contains('\\'), "confusables.ts holds an escape the server would read as text");
    data
}

/// Each letter of the confusables and the Latin letter Unicode gives as its prototype (`PROTOTYPE`).
static PROTOTYPE: LazyLock<HashMap<char, char>> = LazyLock::new(|| {
    let cs: Vec<char> = confusable_pairs().chars().collect();
    let mut map = HashMap::new();
    let mut i = 0;
    while i + 1 < cs.len() {
        map.insert(cs[i], cs[i + 1]);
        i += 2;
    }
    map
});

/// The letters of the confusables, in the order of the file (`PROTOTYPE.keys()`): the order
/// in which `BY_PROTOTYPE` meets their scripts.
static PROTOTYPE_ORDER: LazyLock<Vec<char>> = LazyLock::new(|| {
    let cs: Vec<char> = confusable_pairs().chars().collect();
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    let mut i = 0;
    while i + 1 < cs.len() {
        if seen.insert(cs[i]) {
            out.push(cs[i]);
        }
        i += 2;
    }
    out
});

/// The prototype of a letter: what Unicode says it is drawn like (itself, for most letters).
pub fn prototype_of(letter: char) -> char {
    PROTOTYPE.get(&letter).copied().unwrap_or(letter)
}

/// Scripts a letter can be in, for telling a word that mixes alphabets (`SCRIPTS`). The rest are "Other".
const SCRIPTS: [&str; 48] = [
    "Latin", "Cyrillic", "Greek", "Armenian", "Coptic", "Georgian", "Cherokee", "Hebrew", "Arabic", "Lisu",
    "Canadian_Aboriginal", "Tifinagh", "Vai", "Ethiopic", "Han", "Hiragana", "Katakana", "Hangul", "Bopomofo", "Thai",
    "Lao", "Devanagari", "Bengali", "Gurmukhi", "Gujarati", "Oriya", "Tamil", "Telugu", "Kannada", "Malayalam",
    "Sinhala", "Myanmar", "Khmer", "Tibetan", "Mongolian", "Syriac", "Thaana", "Nko", "Osage", "Adlam", "Deseret",
    "Glagolitic", "Gothic", "Runic", "Ogham", "Old_Italic", "Javanese", "Yi",
];

static SCRIPT_RES: LazyLock<Vec<(&'static str, Regex)>> =
    LazyLock::new(|| SCRIPTS.iter().map(|name| (*name, re(&format!(r"^\p{{Script={name}}}$")))).collect());

thread_local! {
    static SCRIPT_CACHE: RefCell<HashMap<char, &'static str>> = RefCell::new(HashMap::new());
}

/// The script of one character: a name from `SCRIPTS`, "Mark" for a combining mark, "Other"
/// for anything else (`scriptOf`).
pub fn script_of(ch: char) -> &'static str {
    if let Some(s) = SCRIPT_CACHE.with(|c| c.borrow().get(&ch).copied()) {
        return s;
    }
    let s = if is_class(&MARK_RE, ch) {
        "Mark"
    } else {
        let mut buf = [0u8; 4];
        let text = ch.encode_utf8(&mut buf);
        SCRIPT_RES.iter().find(|(_, r)| r.is_match(text)).map(|(name, _)| *name).unwrap_or("Other")
    };
    SCRIPT_CACHE.with(|c| c.borrow_mut().insert(ch, s));
    s
}

/// Letters by prototype and script (`BY_PROTOTYPE`): which letter of a given alphabet is drawn
/// like a given one. The scripts of each prototype are kept in the order they were met, as a
/// JavaScript `Map` keeps them; each list is sorted by code point, the plainest first.
type ByScript = Vec<(&'static str, Vec<char>)>;

static BY_PROTOTYPE: LazyLock<HashMap<char, ByScript>> = LazyLock::new(|| {
    let mut map: HashMap<char, ByScript> = HashMap::new();
    let mut add = |letter: char| {
        let by_script = map.entry(prototype_of(letter)).or_default();
        let script = script_of(letter);
        match by_script.iter_mut().find(|(s, _)| *s == script) {
            Some((_, list)) => {
                if !list.contains(&letter) {
                    list.push(letter);
                }
            }
            None => by_script.push((script, vec![letter])),
        }
    };
    for c in (b'A'..=b'Z').chain(b'a'..=b'z') {
        add(char::from(c));
    }
    for letter in PROTOTYPE_ORDER.iter() {
        add(*letter);
    }
    for by_script in map.values_mut() {
        for (_, list) in by_script.iter_mut() {
            list.sort_unstable();
        }
    }
    map
});

/// The letter of `script` that is drawn like `letter`, in the same case where there is a
/// choice; or `None` (`twinIn`).
fn twin_in(letter: char, script: &str) -> Option<char> {
    let list = BY_PROTOTYPE.get(&prototype_of(letter))?.iter().find(|(s, _)| *s == script).map(|(_, l)| l)?;
    if list.is_empty() {
        return None;
    }
    let upper = lower_char(letter) != letter.to_string();
    list.iter().copied().find(|l| (lower_char(*l) != l.to_string()) == upper).or(Some(list[0]))
}

/// In a word that mixes alphabets, read the strays as letters of the word's own alphabet
/// (`unmixScripts`). Which alphabet that is, is told by the letters that could not be strays:
/// those with no look-alike in the other alphabets present. Where those do not settle it, the
/// alphabet most of the word's letters are in; and Latin if that is even. A stray with no
/// look-alike in the word's alphabet is left as it is.
fn unmix_scripts(line: &str) -> String {
    WORD_RUN
        .replace_all(line, |caps: &Captures| {
            let word = &caps[0];
            let letters: Vec<char> = word.chars().collect();
            let scripts: Vec<&'static str> = letters.iter().map(|c| script_of(*c)).collect();
            let mut present: Vec<&'static str> = Vec::new();
            for s in &scripts {
                if *s != "Mark" && *s != "Other" && !present.contains(s) {
                    present.push(s);
                }
            }
            if present.len() < 2 {
                return word.to_string();
            }
            let mut main = present[0];
            let mut best: (i64, i64, i64) = (-1, -1, -1);
            for s in &present {
                let mine: Vec<char> = letters.iter().zip(&scripts).filter(|(_, t)| *t == s).map(|(c, _)| *c).collect();
                let own = mine.iter().filter(|ch| present.iter().all(|t| t == s || twin_in(**ch, t).is_none())).count();
                let score = (own as i64, mine.len() as i64, i64::from(*s == "Latin"));
                // Compared element by element, as the TypeScript does.
                if score > best {
                    main = s;
                    best = score;
                }
            }
            letters
                .iter()
                .zip(&scripts)
                .map(|(ch, s)| if *s == main || *s == "Mark" || *s == "Other" { *ch } else { twin_in(*ch, main).unwrap_or(*ch) })
                .collect()
        })
        .into_owned()
}

/// JavaScript's `\s`: WhiteSpace plus LineTerminator.
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0b}' | '\u{0c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}'
            | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'
    )
}

/// JavaScript's `String.prototype.trim`.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

/// NFKC over every run that is not Thai or Lao (`.replace(NOT_THAI_LAO, run => run.normalize('NFKC'))`).
fn nfkc_outside_thai_lao(text: &str) -> String {
    let thai_or_lao = |c: char| ('\u{0e00}'..='\u{0eff}').contains(&c);
    let mut out = String::with_capacity(text.len());
    let mut run = String::new();
    for c in text.chars() {
        if thai_or_lao(c) {
            out.extend(run.nfkc());
            run.clear();
            out.push(c);
        } else {
            run.push(c);
        }
    }
    out.extend(run.nfkc());
    out
}

/// Step 1: every kind of line break becomes "\n" (`/\r\n?|[\u000b\u000c\u0085  ]/g`).
fn line_breaks(raw: &str) -> String {
    let mut broken = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                broken.push('\n');
            }
            '\u{0b}' | '\u{0c}' | '\u{85}' | '\u{2028}' | '\u{2029}' => broken.push('\n'),
            _ => broken.push(c),
        }
    }
    broken
}

/// `.replace(/\s+/g, ' ')`.
fn collapse_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_space = false;
    for c in text.chars() {
        if is_js_space(c) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    out
}

/// One pass of cleaning (`cleanOnce`).
fn clean_once(raw: &str, unmix: bool) -> String {
    let formed = nfkc_outside_thai_lao(&line_breaks(raw));
    let spaced = BLANKS.replace_all(&formed, " ");
    let mut lines: Vec<String> = Vec::new();
    for line in spaced.split('\n') {
        let visible = INVISIBLE.replace_all(line, "");
        let rooted = ORPHAN_MARKS.replace_all(&visible, "${1}");
        let mut l = MARK_PILE.replace_all(&rooted, "${1}").into_owned();
        if unmix {
            l = unmix_scripts(&l);
        }
        // Removing a character can bring a letter and its mark together; compose them as NFKC would.
        let composed = collapse_spaces(&nfkc_outside_thai_lao(&l));
        let trimmed = js_trim(&composed);
        if !trimmed.is_empty() {
            lines.push(trimmed.to_string());
            if lines.len() == MAX_VERSE_LINES {
                break;
            }
        }
    }
    let out = lines.join("\n");
    if utf16_len(&out) <= MAX_VERSE_CHARS {
        return out;
    }
    // Cut between characters, never inside a surrogate pair.
    let mut kept = String::with_capacity(out.len());
    let mut units = 0;
    for c in out.chars() {
        if units + c.len_utf16() > MAX_VERSE_CHARS {
            break;
        }
        units += c.len_utf16();
        kept.push(c);
    }
    kept
}

/// Normalise a verse (see above), collapse blank lines and runs of space, cap the length,
/// and pass again until nothing changes (`cleanVerse`).
pub fn clean_verse(raw: &str) -> String {
    clean_verse_with(raw, true)
}

/// `cleanVerse(raw, { unmix })`. With `unmix` false the letters of other alphabets are left as
/// typed: that is how a curse reads a verse ([`words_as_read`]), since a word that mixes
/// alphabets is itself the trick.
pub fn clean_verse_with(raw: &str, unmix: bool) -> String {
    let mut v = clean_once(raw, unmix);
    for _ in 0..4 {
        let again = clean_once(&v, unmix);
        if again == v {
            break;
        }
        v = again;
    }
    v
}

pub fn lines_of(verse: &str) -> Vec<&str> {
    verse.split('\n').map(js_trim).filter(|l| !l.is_empty()).collect()
}

// --- Words and letters ---

static WORD_RE: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*"));
/// An accent on a Latin or Greek letter: the letter is kept, the accents go.
static ACCENTED_RE: LazyLock<Regex> = LazyLock::new(|| re(r"([\p{Latin}\p{Greek}])[\x{300}-\x{36f}]+"));
static LATIN_WORD_RE: LazyLock<Regex> = LazyLock::new(|| re(r"^[\p{Latin}'’\-]+$"));

/// Lower-cased words of a line or verse. Apostrophes and hyphens stay inside a word.
pub fn words_of(text: &str) -> Vec<String> {
    WORD_RE.find_iter(text).map(|m| m.as_str().to_lowercase()).collect()
}

pub fn last_word(line: &str) -> String {
    words_of(line).pop().unwrap_or_default()
}

pub fn first_word(line: &str) -> String {
    words_of(line).into_iter().next().unwrap_or_default()
}

/// Fold a word for comparison: lower case, without the accents of Latin and Greek letters
/// or the optional vowel marks of Arabic, with the spellings people type either way merged
/// (œ and oe, æ and ae, ß and ss, Russian ё and е, the Devanagari nukta), and with every
/// kind of apostrophe made the plain one.
pub fn fold(word: &str) -> String {
    let decomposed: String = word.nfd().collect();
    let bare = ACCENTED_RE.replace_all(&decomposed, "${1}");
    let lowered = bare
        .chars()
        .filter(|c| !matches!(*c as u32, 0x640 | 0x64b..=0x65f | 0x670 | 0x93c))
        .nfc()
        .collect::<String>()
        .to_lowercase();
    let mut out = String::with_capacity(lowered.len());
    for c in lowered.chars() {
        match c {
            'ё' => out.push('е'),
            'œ' => out.push_str("oe"),
            'æ' => out.push_str("ae"),
            'ß' => out.push_str("ss"),
            '\u{2019}' | '\u{2018}' | '\u{2bc}' => out.push('\''),
            _ => out.push(c),
        }
    }
    out
}

/// Katakana to hiragana, so the two kana spellings of a sound compare equal (`hiragana`).
/// Only the acrostic reads through it in English, and only if a verse holds katakana.
pub fn hiragana(text: &str) -> String {
    text.chars()
        .map(|c| if ('ァ'..='ヶ').contains(&c) { char::from_u32(c as u32 - 0x60).unwrap_or(c) } else { c })
        .collect()
}

/// Letters in a word: marks, apostrophes and hyphens are not letters (`letterCount`).
pub fn letter_count(word: &str) -> usize {
    word.nfc().filter(|c| is_letter(*c)).count()
}

/// A word's length as the "of N letters or more" rules count it: every character but the
/// marks that sit on a letter, an inner apostrophe or hyphen included (`wordSpan`).
pub fn word_span(word: &str) -> usize {
    word.nfc().filter(|c| !is_class(&MARK_RE, *c)).count()
}

/// Words for the rules that count them: a hyphenated chain ("one-two-three") is as many
/// words as it has parts (`wordParts`).
pub fn word_parts(text: &str) -> Vec<String> {
    words_of(text)
        .iter()
        .flat_map(|w| w.split('-').filter(|part| has_letter(part)).map(String::from).collect::<Vec<_>>())
        .collect()
}

/// A line's length in words (`lineLength` for a language that counts in words).
pub fn line_length(line: &str) -> usize {
    word_parts(line).len()
}

/// What a line opens with, folded: its first word (`edgeUnit(line, 'en', 'first')`).
pub fn first_unit(line: &str) -> String {
    fold(&first_word(line))
}

/// What a line closes on, folded: its last word (`edgeUnit(line, 'en', 'last')`).
pub fn last_unit(line: &str) -> String {
    fold(&last_word(line))
}

/// Words that carry meaning: four letters or more.
pub fn content_words(text: &str) -> Vec<String> {
    words_of(text).into_iter().filter(|w| word_span(w) >= rules::CONTENT).collect()
}

/// First letter of a word, folded; empty when folding leaves nothing.
pub fn initial(word: &str) -> String {
    fold(word).chars().next().map(String::from).unwrap_or_default()
}

// --- Syllables ---

fn is_vowel(b: u8) -> bool {
    b"aeiouy".contains(&b)
}

fn is_aeiou(b: u8) -> bool {
    b"aeiou".contains(&b)
}

/// The word is written in the Latin script throughout (apostrophes and hyphens allowed).
fn is_latin(word: &str) -> bool {
    LATIN_WORD_RE.is_match(word)
}

fn vowel_groups(w: &[u8]) -> i32 {
    let mut groups = 0;
    let mut in_vowel = false;
    for &b in w {
        let v = is_vowel(b);
        if v && !in_vowel {
            groups += 1;
        }
        in_vowel = v;
    }
    groups
}

static BOTH_SOUNDED: LazyLock<Regex> = LazyLock::new(|| re(r"i[ao]|eo|iet|oe[mt]|[yei]ing|uou"));
static SOFT_ENDING: LazyLock<Regex> = LazyLock::new(|| re(r"[^aeiou](?:ion|ious|ial|ian)s?$"));
static SOFTENED: LazyLock<Regex> = LazyLock::new(|| re(r"[cst]i[ao]|[^aeiou]gi[ao]"));
static HISS_ES: LazyLock<Regex> = LazyLock::new(|| re(r"(s|x|z|ch|sh|c|g)es$"));
static CONSONANT_LES: LazyLock<Regex> = LazyLock::new(|| re(r"[^aeiouy]les$"));

/// English syllables by spelling (`englishSyllables`): the fallback for a word the
/// pronunciation table does not have. `w` is the word's letters a to z, nothing else.
fn english_syllables(w: &str) -> u32 {
    let b = w.as_bytes();
    // A "y" between two vowels starts a syllable ("playing", "beyond"); elsewhere it is a vowel.
    // /([aeiou])y(?=[aeiou])/g with '$1j': each match takes the vowel and the y.
    let mut s: Vec<u8> = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if is_aeiou(b[i]) && b.get(i + 1) == Some(&b'y') && b.get(i + 2).is_some_and(|c| is_aeiou(*c)) {
            s.push(b[i]);
            s.push(b'j');
            i += 2;
        } else {
            s.push(b[i]);
            i += 1;
        }
    }
    let s_text = std::str::from_utf8(&s).expect("ASCII");
    let mut groups = vowel_groups(&s);
    // Two vowels that are both sounded: "li-on", "Rome-o", "qui-et", "po-em", "cry-ing".
    groups += BOTH_SOUNDED.find_iter(s_text).count() as i32;
    // ...but not in "-tion", "-cious", "-cial", "-gion": there the i only softens the consonant.
    if SOFT_ENDING.is_match(s_text) && SOFTENED.is_match(s_text) {
        groups -= 1;
    }
    let n = b.len();
    // Silent final e ("stage"), but not "-le" after a consonant ("candle").
    if n > 2 && b.ends_with(b"e") && !b.ends_with(b"le") && !is_vowel(b[n - 2]) {
        groups -= 1;
    }
    if b.ends_with(b"le") && n > 2 && is_vowel(b[n - 3]) {
        groups -= 1;
    }
    // "-es" is silent after most consonants ("leaves") but not after a hiss ("roses") nor
    // after a consonant and l ("tables").
    if n > 3 && b.ends_with(b"es") && !is_vowel(b[n - 3]) && !HISS_ES.is_match(w) && !CONSONANT_LES.is_match(w) {
        groups -= 1;
    }
    // "-ed" is silent except after t or d ("wanted").
    if n > 3 && b.ends_with(b"ed") && !(b.ends_with(b"ted") || b.ends_with(b"ded")) && !is_vowel(b[n - 3]) {
        groups -= 1;
    }
    groups.max(1) as u32
}

/// A word's letters a to z after folding: what the spelling rules read.
fn ascii_letters(word: &str) -> String {
    fold(word).chars().filter(char::is_ascii_lowercase).collect()
}

fn hyphen_parts(word: &str) -> Vec<&str> {
    word.split('-').filter(|part| has_letter(part)).collect()
}

/// Every count an English word can have (`englishCounts`): from the table, else the sum of
/// a hyphenated word's parts, else by spelling.
fn english_counts(word: &str, w: &str) -> Vec<u32> {
    if let Some(known) = pronounce(word) {
        return known.counts.clone();
    }
    let parts = hyphen_parts(word);
    if parts.len() > 1 {
        return vec![parts.iter().map(|part| english_counts(part, &ascii_letters(part))[0]).sum()];
    }
    vec![english_syllables(w)]
}

/// Is this English word (or every part of a hyphenated one) in the pronunciation table?
fn english_known(word: &str) -> bool {
    if pronounce(word).is_some() {
        return true;
    }
    let parts = hyphen_parts(word);
    parts.len() > 1 && parts.iter().all(|part| pronounce(part).is_some())
}

/// Syllables in an English word (its commonest pronunciation), or `None` when it is not in
/// a script we can count. `lang` is kept in the signature because the TypeScript takes
/// one; only English is ported.
pub fn syllables_in_word(word: &str, lang: &str) -> Option<u32> {
    debug_assert!(lang.to_lowercase().split('-').next() == Some("en"), "only English is ported");
    if !is_latin(word) {
        // A word with letters of another script cannot be counted; one with no letters has none.
        return if letter_count(word) > 0 { None } else { Some(0) };
    }
    let w = ascii_letters(word);
    if w.is_empty() {
        return Some(0);
    }
    Some(english_counts(word, &w)[0])
}

/// Every syllable count a word can have, the commonest first (`syllableCounts`).
pub fn syllable_counts(word: &str, lang: &str) -> Option<Vec<u32>> {
    let n = syllables_in_word(word, lang)?;
    if !is_latin(word) {
        return Some(vec![n]);
    }
    let w = ascii_letters(word);
    Some(if w.is_empty() { vec![n] } else { english_counts(word, &w) })
}

pub fn syllables_in_line(line: &str, lang: &str) -> Option<u32> {
    let mut total = 0;
    for w in words_of(line) {
        total += syllables_in_word(&w, lang)?;
    }
    Some(total)
}

/// The range of syllables a line can be read with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SyllableSpan {
    pub min: u32,
    pub max: u32,
    /// Words counted by spelling because the pronunciation table does not have them.
    pub guessed: u32,
}

/// The range of syllables a line can be read with, or `None` when it cannot be counted
/// (`syllableSpan`).
pub fn syllable_span(line: &str, lang: &str) -> Option<SyllableSpan> {
    syllables_in_line(line, lang)?;
    let mut span = SyllableSpan { min: 0, max: 0, guessed: 0 };
    for w in words_of(line) {
        let counts = syllable_counts(&w, lang).unwrap_or_else(|| vec![0]);
        span.min += counts.iter().copied().min().unwrap_or(0);
        span.max += counts.iter().copied().max().unwrap_or(0);
        if is_latin(&w) && !english_known(&w) {
            span.guessed += 1;
        }
    }
    Some(span)
}

// --- Rhyme ---

/// The spellings the spelled key treats as sounding alike, applied in this order, each once.
static RHYME_SPELLINGS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    [
        (r"^(d|t|wh|y)o$", "${1}oo"),
        (r"^you$", "yoo"),
        (r"eigh$", "ay"),
        (r"ight$", "ite"),
        (r"igh$", "y"),
        (r"(ower|our)$", "owr"),
        (r"(are|air|eir|ayer)$", "air"),
        (r"^(th|wh)ere$", "${1}air"),
        (r"(awl|aul|all)$", "awl"),
        (r"(oise|oys)$", "oyz"),
        (r"(ize|ise|ies|eyes|ighs)$", "ize"),
        (r"yme$", "ime"),
        (r"(ough|ow|oe)$", "o"),
        (r"^(th|gr|pr|ob|conv|surv)ey$", "${1}ay"),
        (r"(ue|ew|oo)$", "oo"),
        (r"(ck|que)$", "k"),
        (r"ph$", "f"),
        (r"^(me|he|she|we|be|ye)$", "${1}e"),
        (r"^([^aeiou]+)(y|ie|ye)$", "${1}eye"),
        (r"(ee|ea|ey|ie)$", "ee"),
        (r"([^aeiou])y$", "${1}ee"),
    ]
    .into_iter()
    .map(|(pattern, with)| (re(pattern), with))
    .collect()
});

/// The part of a word that carries its rhyme, by spelling (`spelledKey`), as UTF-16 units:
/// from the last vowel group to the end for a word in a to z, otherwise the last two units.
fn spelled_key(word: &str) -> Vec<u16> {
    let folded = fold(word);
    let w = NON_LETTER_RE.replace_all(&folded, "");
    let units: Vec<u16> = w.encode_utf16().collect();
    if units.len() < 2 {
        return units;
    }
    if !w.bytes().all(|b| b.is_ascii_lowercase()) {
        return units[units.len() - 2..].to_vec();
    }
    let mut e = w.into_owned();
    for (pattern, with) in RHYME_SPELLINGS.iter() {
        // String.replace with a pattern that is not global: the first match only.
        if let std::borrow::Cow::Owned(changed) = pattern.replace(&e, *with) {
            e = changed;
        }
    }
    let e = e.as_bytes();
    // Skip a silent final e so "stage" keys on "age", not on "e".
    let end = if e.len() > 2 && e.ends_with(b"e") && !is_vowel(e[e.len() - 2]) { e.len() - 1 } else { e.len() };
    let mut i = end as isize - 1;
    while i >= 0 && !is_vowel(e[i as usize]) {
        i -= 1;
    }
    while i > 0 && is_vowel(e[i as usize - 1]) {
        i -= 1;
    }
    let tail = if i < 0 { &e[e.len().saturating_sub(2)..] } else { &e[i as usize..] };
    tail.iter().map(|b| u16::from(*b)).collect()
}

/// The part of a word that carries its rhyme, as UTF-16 units (`rhymeKey`). For a word in
/// the pronunciation table: "/" and its sounds from the last stressed vowel on (its first
/// pronunciation). Otherwise by spelling.
pub fn rhyme_key(word: &str) -> Vec<u16> {
    match pronounce(word) {
        Some(known) => format!("/{}", known.keys[0]).encode_utf16().collect(),
        None => spelled_key(word),
    }
}

/// Rhyme by spelling (`englishRhyme`), on folded words.
fn spelled_rhyme(a: &str, b: &str) -> bool {
    let ka = spelled_key(a);
    let kb = spelled_key(b);
    if ka.is_empty() || kb.is_empty() {
        return false;
    }
    // "go" / "so": a one-letter ending rhymes with itself, but is too little to be found inside another.
    if ka == kb {
        return true;
    }
    if ka.len() < 2 || kb.len() < 2 {
        return false;
    }
    // "corazón" / "canción": one ending contained in the other still rhymes.
    let (short, long) = if ka.len() <= kb.len() { (&ka, &kb) } else { (&kb, &ka) };
    long.ends_with(short)
}

/// Two different words that rhyme: by sound when the table has both, by spelling otherwise.
/// A word never rhymes with itself.
pub fn rhymes(a: &str, b: &str) -> bool {
    let fa = fold(a);
    let fb = fold(b);
    if fa.is_empty() || fb.is_empty() || fa == fb {
        return false;
    }
    match sound_rhyme(a, b) {
        Some(heard) => heard,
        None => spelled_rhyme(&fa, &fb),
    }
}

/// The two words a pair of lines is compared on for rhyme: the last word of each
/// (`rhymeEnds`; the Hindi rule for a repeated closing word is not ported).
pub fn rhyme_ends(line_a: &str, line_b: &str) -> (String, String) {
    (last_word(line_a), last_word(line_b))
}

// --- What a verse is made of ---

/// English words that carry grammar rather than meaning (`STOP_WORDS`). Generated from text.ts.
const STOP_WORD_LIST: &str = "a an the and or but nor so yet for of to in on at by with from into upon onto over under up down out off as is am are was were be been being have has had having do does did done will would shall should can could may might must not no none this that these those there here where when what which who whom whose why how i me my mine we us our ours you your yours he him his she her hers it its they them their theirs thou thee thy thine ye all any both each every few more most much many some such only own same than then too very just also even ever again once if because while though although about above after before against between through during until unless cannot hath doth art dost hast wilt shalt lord what's that's there's it's i'm i'll don't can't won't tis twas come comes came go goes went get gets got make makes made take takes took like look looks thing things";

pub static STOP_WORDS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| STOP_WORD_LIST.split(' ').collect());

/// Is this one of the little words of the language (`isStopWord`)?
pub fn is_stop_word(word: &str) -> bool {
    STOP_WORDS.contains(fold(word).as_str())
}

/// The units a verse is compared by: its words, folded (`unitsOf` for English).
fn units_of(line: &str) -> Vec<String> {
    word_parts(line).iter().map(|w| fold(w)).collect()
}

/// A single letter of an alphabet standing as a word: "a", "I", "O", but also the "w",
/// "i", "t" of a fake acrostic (`loneLetter`).
fn lone_letter(unit: &str) -> bool {
    letter_count(unit) == 1
        && unit.chars().next().is_some_and(|c| is_class(&LATIN_RE, c) || is_class(&CYRILLIC_RE, c) || is_class(&GREEK_RE, c))
}

// --- Is it a word? ---
//
// The substance floor and the rule judge count words, not strings, so they ask the English
// lexicon: the pronunciation table less what a dictionary of words does not list (its names,
// abbreviations and fragments, marked from SCOWL when the table is built). A word the table
// lacks counts toward the floor inside a phrase (`PHRASE_SPAN`). Names from the cards and the
// game's own words (the acrostic and power words) always count.

/// Letters a string of the English table needs to count as a word when SCOWL does not list
/// it (`UNLISTED_SPAN`).
pub const UNLISTED_SPAN: usize = 4;

/// Letters a word the lexicon lacks needs to count toward the substance floor inside a phrase
/// (a line that holds one of the little words) (`PHRASE_SPAN`). It must also be spelled as
/// English spells (`spelled_as_english`).
pub const PHRASE_SPAN: usize = 4;

/// Is this string spelled as English spells: every run of three of its letters, its start and
/// end marked, found in a word the table lists (`spelledAsEnglish`)?
fn spelled_as_english(word: &str) -> bool {
    let letters: String = fold(word).chars().filter(|c| c.is_ascii_lowercase() || *c == '\'').collect();
    let s: Vec<char> = format!("^{letters}$").chars().collect();
    if s.len() < 3 {
        return false;
    }
    (0..s.len() - 2).all(|i| super::pronounce::listed_trigram(&s[i..i + 3].iter().collect::<String>()))
}

/// Letters an English word needs to tell inside a phrase (`SHORT_TELLING`).
pub const SHORT_TELLING: usize = 3;

/// Words that count whatever the lexicon says (`gameWords('en')`): the parts of every card's
/// name, and the English acrostic and power words.
static GAME_WORDS: LazyLock<HashSet<String>> = LazyLock::new(|| {
    let mut words: HashSet<String> = HashSet::new();
    for card in super::cards::CARDS.iter() {
        for part in word_parts(&card.name) {
            words.insert(fold(&part));
        }
    }
    let power = super::devices::RELIC_WORDS.iter().flat_map(|(_, ws)| ws.iter().copied());
    for w in super::forms::ACROSTIC_WORDS.iter().copied().chain(power) {
        for part in word_parts(w) {
            words.insert(fold(&part));
        }
    }
    words
});

/// Is this a word of the language, as far as the lexicon can say (`lexiconHas(word, 'en')`)?
/// The server always has the table, so the answer is never "unknown". A hyphenated word is a
/// word when each part is.
pub fn lexicon_has(word: &str) -> bool {
    let w = fold(word);
    if GAME_WORDS.contains(&w) {
        return true;
    }
    let parts: Vec<&str> = w.split('-').filter(|part| has_letter(part)).collect();
    if parts.len() > 1 {
        return parts.iter().all(|part| lexicon_has(part));
    }
    // An abbreviation the dictionary only spells out is not a word, nor a short string a
    // dictionary of words does not list; longer strings the table has are words (names).
    match pronounce(&w) {
        Some(p) => !p.spelled && (!p.unlisted || word_span(&w) >= UNLISTED_SPAN),
        None => false,
    }
}

/// For each unit of a line, whether it is a word of the language (`knownUnits(line, 'en')`).
fn known_units(line: &str) -> Vec<bool> {
    let units: Vec<String> = units_of(line).into_iter().filter(|u| letter_count(u) > 0).collect();
    let phrase = units.iter().any(|u| is_stop_word(u));
    units
        .iter()
        .map(|u| {
            let has = lexicon_has(u);
            if !has && phrase && word_span(u) >= PHRASE_SPAN && spelled_as_english(u) { true } else { has }
        })
        .collect()
}

/// A word that carries meaning (`isContentWord(word, 'en')`): not a letter alone, not one of
/// the little words.
pub fn is_content_word(word: &str) -> bool {
    if !has_letter(word) {
        return false;
    }
    if letter_count(word) < 2 {
        return false;
    }
    !STOP_WORDS.contains(fold(word).as_str())
}

/// A word that tells (`isTellingWord(word, 'en', inPhrase)`): it carries meaning, the lexicon
/// has it, and it is four letters or more, or `SHORT_TELLING` inside a phrase.
pub fn is_telling_word(word: &str, in_phrase: bool) -> bool {
    if !is_content_word(word) || !lexicon_has(word) {
        return false;
    }
    let span = word_span(word);
    span >= rules::CONTENT || (in_phrase && span >= SHORT_TELLING)
}

/// The different telling words of a text, folded (`tellingWords(text, 'en')`), in the order
/// they first appear.
pub fn telling_words(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for line in lines_of(text) {
        let ws = word_parts(line);
        let phrase = ws.iter().any(|w| is_stop_word(w));
        for w in &ws {
            if is_telling_word(w, phrase) {
                let f = fold(w);
                if seen.insert(f.clone()) {
                    out.push(f);
                }
            }
        }
    }
    out
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Substance {
    pub ok: bool,
    /// Different words found that are words of the language, and how many the verse needs.
    pub distinct: usize,
    pub needed: usize,
    /// Share of the verse's words that are words of its language.
    pub known: f64,
    /// Different telling words: what the verse says, as against how it is laid out.
    pub telling: usize,
}

/// Fewest different words anything that calls itself a verse can have.
pub const MIN_DISTINCT_WORDS: usize = 3;
/// Below this share of real words a verse is tokens, not verse, and is void.
pub const MIN_KNOWN_SHARE: f64 = 0.6;
/// At and above this share of real words a verse keeps its full form points.
pub const FULL_KNOWN_SHARE: f64 = 0.7;
/// Different telling words a verse needs per line before it keeps its full form points.
pub const TELLING_PER_LINE: f64 = 0.5;

/// Is this a verse, or tokens arranged to satisfy a checker (`substance`)? Counting only
/// words of the language: every line holds at least one; the verse has at least as many
/// different words as it has lines, and never fewer than three (lone letters count as one
/// word between them); more than half of its lines are different lines; and at least
/// `MIN_KNOWN_SHARE` of what it is made of are words.
pub fn substance(verse: &str) -> Substance {
    let ls = lines_of(verse);
    let per_line: Vec<Vec<String>> =
        ls.iter().map(|l| units_of(l).into_iter().filter(|u| letter_count(u) > 0).collect()).collect();
    let flags: Vec<Vec<bool>> = ls.iter().map(|l| known_units(l)).collect();
    debug_assert!(per_line.iter().zip(&flags).all(|(u, f)| u.len() == f.len()));
    let mut words: HashSet<&str> = HashSet::new();
    let mut any_lone = false;
    let mut real = 0usize;
    let mut all = 0usize;
    for (units, f) in per_line.iter().zip(&flags) {
        for (unit, known) in units.iter().zip(f) {
            all += 1;
            if !known {
                continue;
            }
            real += 1;
            if lone_letter(unit) {
                any_lone = true;
            } else {
                words.insert(unit.as_str());
            }
        }
    }
    let distinct = words.len() + usize::from(any_lone);
    let needed = ls.len().max(MIN_DISTINCT_WORDS);
    let different_lines = per_line.iter().map(|units| units.join(" ")).collect::<HashSet<String>>().len();
    let known = if all > 0 { real as f64 / all as f64 } else { 0.0 };
    let ok = !ls.is_empty()
        && flags.iter().all(|f| f.iter().any(|k| *k))
        && distinct >= needed
        && different_lines * 2 > ls.len()
        && known >= MIN_KNOWN_SHARE;
    Substance { ok, distinct, needed, known, telling: telling_words(verse).len() }
}

/// Distinct telling words of the verse that are not among `used` (`ownContent`): what the
/// verse says beyond the words that land its device and signature.
pub fn own_content(verse: &str, used: &[String]) -> usize {
    let mut taken: HashSet<String> = HashSet::new();
    for u in used {
        let f = fold(u);
        for part in f.split(' ') {
            taken.insert(part.to_string());
        }
        taken.insert(f);
    }
    telling_words(verse).iter().filter(|w| !taken.contains(*w)).count()
}

// --- Copying ---

/// The words of a line, in order, for the copy measure (`copyWords` for English): its content
/// words (or, with `all`, every word), folded.
fn copy_words(line: &str, all: bool) -> Vec<String> {
    word_parts(line).into_iter().filter(|w| has_letter(w) && (all || is_content_word(w))).map(|w| fold(&w)).collect()
}

/// English endings a copy can change without making a word its own (`englishStem`). Lengths
/// are UTF-16 units, as JavaScript counts them.
fn english_stem(w: &str) -> String {
    let mut s = w.strip_suffix("'s").unwrap_or(w).to_string();
    let len = |s: &str| utf16_len(s);
    let drop = |s: &str, n: usize| -> String {
        // Only ever an ASCII ending: n bytes are n characters.
        s[..s.len() - n].to_string()
    };
    for _ in 0..3 {
        let before = s.clone();
        let n = len(&s);
        if n > 5 && s.ends_with("ies") {
            s = format!("{}y", drop(&s, 3));
        } else if n > 5 && (s.ends_with("eth") || s.ends_with("est")) {
            s = drop(&s, 3);
        } else if n > 5 && s.ends_with("ing") {
            s = drop(&s, 3);
        } else if n > 4 && s.ends_with("ed") {
            s = drop(&s, 2);
        } else if n > 4 && ["sses", "xes", "zes", "ches", "shes"].iter().any(|e| s.ends_with(e)) {
            s = drop(&s, 2);
        } else if n > 3 && s.ends_with('s') && {
            // /[^su]s$/: the character before the s is neither s nor u (in UTF-16 units, so
            // the low half of an astral letter counts as "neither").
            let mut cs = s.chars().rev();
            cs.next();
            cs.next().is_some_and(|c| c != 's' && c != 'u')
        } {
            s = drop(&s, 1);
        }
        if s == before {
            break;
        }
    }
    // /([^aeiouls])\1$/ in UTF-16 units: the last two characters the same, and not a vowel, l
    // or s. Two units at the end of a string that ends in an astral letter are its two halves,
    // which are never the same, so only a doubled letter of the basic plane counts.
    let cs: Vec<char> = s.chars().collect();
    if cs.len() >= 2 {
        let (a, b) = (cs[cs.len() - 2], cs[cs.len() - 1]);
        if a == b && b.len_utf16() == 1 && !"aeiouls".contains(b) {
            s.pop();
        }
    }
    if len(&s) > 3 { s.strip_suffix('e').map(String::from).unwrap_or(s) } else { s }
}

thread_local! {
    static STEMS: RefCell<HashMap<String, String>> = RefCell::new(HashMap::new());
}

/// Do two folded words of a copy measure count as the same word (`sameWordFor('en')`)? The
/// same spelling, or the same stem.
fn same_word(a: &str, b: &str) -> bool {
    if a == b {
        return true;
    }
    let stem = |w: &str| {
        STEMS.with(|cache| {
            if let Some(s) = cache.borrow().get(w) {
                return s.clone();
            }
            let s = english_stem(w);
            let mut c = cache.borrow_mut();
            if c.len() > 50_000 {
                c.clear();
            }
            c.insert(w.to_string(), s.clone());
            s
        })
    };
    stem(a) == stem(b)
}

/// What `takenInOrder` returns: which items of `a` it takes, and which items of `b` they are.
struct Taken {
    taken: Vec<bool>,
    at: Vec<usize>,
}

/// The longest common subsequence of `a` in `b0`, where two neighbours of `a` swapped still
/// match both (`takenInOrder`). Items of `b0` already `used` are not available.
fn taken_in_order(a: &[String], b0: &[String], used: &[bool]) -> Taken {
    let at0: Vec<usize> = (0..b0.len()).filter(|j| !used[*j]).collect();
    let b: Vec<&String> = at0.iter().map(|j| &b0[*j]).collect();
    let (n, m) = (a.len(), b.len());
    let e: Vec<Vec<bool>> = a.iter().map(|x| b.iter().map(|y| same_word(x, y)).collect()).collect();
    let swap = |i: usize, j: usize| i > 1 && j > 1 && e[i - 1][j - 2] && e[i - 2][j - 1] && a[i - 1] != a[i - 2];
    let mut l = vec![vec![0usize; m + 1]; n + 1];
    for i in 1..=n {
        for j in 1..=m {
            let mut v = l[i - 1][j].max(l[i][j - 1]);
            if e[i - 1][j - 1] {
                v = v.max(l[i - 1][j - 1] + 1);
            }
            if swap(i, j) {
                v = v.max(l[i - 2][j - 2] + 2);
            }
            l[i][j] = v;
        }
    }
    let mut taken = vec![false; n];
    let mut at = Vec::new();
    let (mut i, mut j) = (n, m);
    while i > 0 && j > 0 {
        if e[i - 1][j - 1] && l[i][j] == l[i - 1][j - 1] + 1 {
            taken[i - 1] = true;
            at.push(at0[j - 1]);
            i -= 1;
            j -= 1;
        } else if swap(i, j) && l[i][j] == l[i - 2][j - 2] + 2 {
            taken[i - 1] = true;
            taken[i - 2] = true;
            at.push(at0[j - 1]);
            at.push(at0[j - 2]);
            i -= 2;
            j -= 2;
        } else if l[i - 1][j] >= l[i][j - 1] {
            i -= 1;
        } else {
            j -= 1;
        }
    }
    Taken { taken, at }
}

/// One line of the source against the line of the verse that says most of it (`CopyMeasure.carry`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LineCarry {
    /// The source line's words.
    pub source: usize,
    /// How many of them that verse line says in order.
    pub said: usize,
    /// That verse line's words.
    pub verse: usize,
    /// It says the source line's last word.
    pub end: bool,
    /// Which line of the verse it is (an index into `lines_of(verse)`); `None` when no line
    /// says any of it (`line: -1`).
    pub line: Option<usize>,
}

/// How much of a verse is taken from another (`CopyMeasure`).
#[derive(Debug, Clone, PartialEq)]
pub struct CopyMeasure {
    pub taken: usize,
    pub own: usize,
    pub share: f64,
    pub source: usize,
    pub coverage: f64,
    pub any_order: f64,
    pub lines: Vec<f64>,
    pub per_line: Vec<usize>,
    pub ends: usize,
    pub carry: Vec<LineCarry>,
    /// Lines of the verse (`lines_of`).
    pub verse_lines: usize,
}

/// `lineCarry`: every line of `source`, all its words, matched one to one with the lines of
/// `verse` that say most of each in order, the largest first and, among equals, the earlier
/// lines first.
fn line_carry(verse: &str, source: &str) -> Vec<LineCarry> {
    let theirs: Vec<Vec<String>> = lines_of(source).iter().map(|l| copy_words(l, true)).collect();
    let mine: Vec<(usize, Vec<String>)> =
        lines_of(verse).iter().enumerate().map(|(at, l)| (at, copy_words(l, true))).filter(|(_, ws)| !ws.is_empty()).collect();
    let mut pairs: Vec<(usize, usize, usize)> = Vec::new();
    for (i, s) in theirs.iter().enumerate() {
        for (j, (_, v)) in mine.iter().enumerate() {
            let said = taken_in_order(v, s, &vec![false; s.len()]).at.len();
            if said > 0 {
                pairs.push((said, i, j));
            }
        }
    }
    pairs.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)).then(x.2.cmp(&y.2)));
    let mut out: Vec<LineCarry> = theirs.iter().map(|s| LineCarry { source: s.len(), said: 0, verse: 0, end: false, line: None }).collect();
    let mut taken: HashSet<usize> = HashSet::new();
    for (said, i, j) in pairs {
        if out[i].said > 0 || taken.contains(&j) {
            continue;
        }
        let last = theirs[i].last().expect("a line that says something has a last word");
        let (at, ws) = &mine[j];
        out[i] = LineCarry { source: theirs[i].len(), said, verse: ws.len(), end: ws.iter().any(|w| same_word(w, last)), line: Some(*at) };
        taken.insert(j);
    }
    out
}

/// How much of `verse` is taken from `source`, seen from both sides (`copyOf(verse, source,
/// 'en', { all })`). With `all` every word counts, the little ones too.
pub fn copy_of(verse: &str, source: &str, all: bool) -> CopyMeasure {
    let mine: Vec<Vec<String>> = lines_of(verse).iter().map(|l| copy_words(l, all)).filter(|ws| !ws.is_empty()).collect();
    let theirs: Vec<String> = lines_of(source).iter().flat_map(|l| copy_words(l, all)).collect();
    let carry = line_carry(verse, source);
    let verse_lines = lines_of(verse).len();
    if mine.is_empty() || theirs.is_empty() {
        return CopyMeasure {
            taken: 0,
            own: 0,
            share: 0.0,
            source: theirs.len(),
            coverage: 0.0,
            any_order: 0.0,
            lines: Vec::new(),
            per_line: Vec::new(),
            ends: 0,
            carry,
            verse_lines,
        };
    }
    let in_source = |w: &str| theirs.iter().any(|t| same_word(w, t));
    // Each word of the source is taken once.
    let mut used = vec![false; theirs.len()];
    let mut taken = 0usize;
    let mut own: HashSet<&str> = HashSet::new();
    let mut per_line = Vec::new();
    for line in &mine {
        let t = taken_in_order(line, &theirs, &used);
        for j in &t.at {
            used[*j] = true;
        }
        per_line.push(t.at.len());
        for (k, w) in line.iter().enumerate() {
            if t.taken[k] {
                taken += 1;
            } else if !in_source(w) {
                own.insert(w.as_str());
            }
        }
    }
    // In any order: each word of the source is matched by one word of the verse at most.
    let mut said = 0usize;
    let mut free = vec![true; theirs.len()];
    for w in mine.iter().flatten() {
        if let Some(j) = (0..theirs.len()).find(|k| free[*k] && same_word(w, &theirs[*k])) {
            free[j] = false;
            said += 1;
        }
    }
    // Line by line: how much of each line of the source one line of the verse says.
    let said1 = |src: &[String], line: &[String]| -> f64 {
        let mut open = vec![true; line.len()];
        let mut n = 0usize;
        for w in src {
            if let Some(k) = (0..line.len()).find(|i| open[*i] && same_word(&line[*i], w)) {
                open[k] = false;
                n += 1;
            }
        }
        n as f64 / src.len() as f64
    };
    let source_lines: Vec<Vec<String>> = lines_of(source).iter().map(|l| copy_words(l, all)).collect();
    let lines: Vec<f64> = source_lines
        .iter()
        .filter(|ws| ws.len() >= 2)
        .map(|ws| mine.iter().map(|line| said1(ws, line)).fold(f64::NEG_INFINITY, f64::max))
        .collect();
    // Line ends: the last word of each line, against the source's line in the same place.
    let line_end = |l: &str| copy_words(l, true).pop();
    let their_ends: Vec<Option<String>> = lines_of(source).iter().map(|l| line_end(l)).collect();
    let mut ends = 0usize;
    for (i, l) in lines_of(verse).iter().enumerate() {
        // `w && e && eq(w, e)`: an empty word (one that folds to nothing) is no end.
        if let (Some(w), Some(Some(e))) = (line_end(l), their_ends.get(i)) {
            if !w.is_empty() && !e.is_empty() && same_word(&w, e) {
                ends += 1;
            }
        }
    }
    let own_n = own.len();
    CopyMeasure {
        taken,
        own: own_n,
        share: if taken + own_n > 0 { taken as f64 / (taken + own_n) as f64 } else { 0.0 },
        source: theirs.len(),
        coverage: taken as f64 / theirs.len() as f64,
        any_order: said as f64 / theirs.len() as f64,
        lines,
        per_line,
        ends,
        carry,
        verse_lines,
    }
}

/// `copyOf(verse, source).share` (`similarity`): how much of `verse` is taken from `source`.
pub fn similarity(verse: &str, source: &str) -> f64 {
    copy_of(verse, source, false).share
}

// --- Words as a curse reads them ---

/// Digits and signs that stand in for a Latin letter inside a word (`STAND_INS`).
fn stand_in(c: char) -> Option<char> {
    Some(match c {
        '0' => 'o',
        '1' => 'l',
        '3' => 'e',
        '4' => 'a',
        '5' => 's',
        '7' => 't',
        '8' => 'b',
        '$' => 's',
        '@' => 'a',
        '€' => 'e',
        '£' => 'l',
        '!' => 'i',
        '|' => 'l',
        '+' => 't',
        _ => return None,
    })
}

static DISGUISED_RE: LazyLock<Regex> =
    LazyLock::new(|| re(r"[\p{L}\p{M}\p{N}$@€£|+]+(?:['\x{2019}\-!][\p{L}\p{M}\p{N}$@€£|+]+)*"));
/// A number with a short ending of letters: "2nd", "6pm", "1990s", "3D" (`NUMBER_THEN_LETTERS`).
static NUMBER_THEN_LETTERS: LazyLock<Regex> = LazyLock::new(|| re(r"^\p{N}+(?:[.,:]\p{N}+)*['\x{2019}\-]?\p{L}{1,3}$"));
/// Letters, then a number: "ke-2", "No.5" (`LETTERS_THEN_NUMBER`).
static LETTERS_THEN_NUMBER: LazyLock<Regex> = LazyLock::new(|| re(r"^\p{L}{1,3}['\x{2019}\-]\p{N}+$"));
static LEADING_DIGITS: LazyLock<Regex> = LazyLock::new(|| re(r"^\p{N}+"));
static COUNTED_AS_LETTER: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{L}\p{N}$@€£|+!]"));
static KEPT_AS_READ: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{L}\p{M}'\-?]"));

/// Is this token an honest number, not a word with digits standing in for its letters
/// (`honestNumber`)? One digit that reads as a letter and so spells a word of four letters
/// or more the lexicon knows ("1ove") is a disguise.
fn honest_number(token: &str) -> bool {
    if LETTERS_THEN_NUMBER.is_match(token) {
        return true;
    }
    if !NUMBER_THEN_LETTERS.is_match(token) {
        return false;
    }
    let digits = LEADING_DIGITS.find(token).expect("the token starts with digits").as_str();
    let mut ds = digits.chars();
    let only = match (ds.next(), ds.next()) {
        (Some(d), None) if d.len_utf16() == 1 => stand_in(d),
        _ => None,
    };
    let Some(letter) = only else { return true };
    let rest = &token[digits.len()..];
    let rest = rest.strip_prefix(['\'', '’', '-']).unwrap_or(rest);
    let read = format!("{letter}{rest}");
    !(letter_count(&read) >= 4 && lexicon_has(&read))
}

/// The letters of the English pack, folded (`nativeLetters('en')`), from the generated
/// `backend/data/english.json` (written from `src/lib/verse/packs/en.ts`).
static NATIVE_LETTERS: LazyLock<HashSet<char>> = LazyLock::new(|| super::cards::english_letters().iter().copied().collect());

/// A folded letter as it reads in the English alphabet (`readLetter`): itself, or the letter
/// of the alphabet it is drawn like (UTS #39).
fn read_letter(ch: char) -> String {
    let native = &*NATIVE_LETTERS;
    if native.contains(&ch) {
        return ch.to_string();
    }
    let proto = prototype_of(ch);
    let lower = lower_char(proto);
    if native.contains(&proto) {
        return proto.to_string();
    }
    let mut lower_chars = lower.chars();
    let lower_one = match (lower_chars.next(), lower_chars.next()) {
        (Some(c), None) => Some(c),
        _ => None,
    };
    if let Some(l) = lower_one {
        if native.contains(&l) {
            return l.to_string();
        }
    }
    let by_lower = lower_one.and_then(|l| BY_PROTOTYPE.get(&l));
    for by_script in [BY_PROTOTYPE.get(&proto), by_lower].into_iter().flatten() {
        for (_, list) in by_script {
            if let Some(l) = list.iter().find(|l| native.contains(l)) {
                return l.to_string();
            }
        }
    }
    ch.to_string()
}

/// Does a word mix alphabets (`mixesScripts(word, 'en')`)?
fn mixes_scripts(word: &str) -> bool {
    let scripts: HashSet<&'static str> = word.chars().filter(|c| is_letter(*c)).map(script_of).collect();
    scripts.len() > 1
}

/// A word, folded, each letter read in the English alphabet, and "?" after it when it mixes
/// alphabets (`read` in `wordsAsRead`).
fn read_word(w: &str) -> String {
    let mut out: String = fold(w).chars().map(|c| if is_letter(c) { read_letter(c) } else { c.to_string() }).collect();
    if mixes_scripts(w) {
        out.push('?');
    }
    out
}

/// Words as a curse reads them (`wordsAsRead(text, 'en')`): `text` is the verse as typed
/// ([`clean_verse_with`] without unmixing). Each word folded and read in the English alphabet;
/// a word that mixes alphabets gets a "?"; a digit or sign written in place of a letter is read
/// as the letter it stands for, and one that stands for nothing, or one inside a word not in
/// Latin letters, is "?"; an honest number keeps its digits.
pub fn words_as_read(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for token in DISGUISED_RE.find_iter(text).map(|m| m.as_str()) {
        if !has_letter(token) {
            continue;
        }
        if honest_number(token) {
            out.push(read_word(token));
            continue;
        }
        let seen: Vec<char> = read_word(token).chars().collect();
        let latin = seen.iter().all(|c| !is_letter(*c) || is_class(&LATIN_RE, *c));
        out.push(
            seen.iter()
                .map(|c| {
                    if is_class(&KEPT_AS_READ, *c) {
                        *c
                    } else if latin {
                        stand_in(*c).unwrap_or('?')
                    } else {
                        '?'
                    }
                })
                .collect(),
        );
    }
    out
}

/// The length of each word as a curse reads it (`wordLengthsAsRead`): its letters, and any
/// digit or sign written inside it in place of one. An honest number is as long as its letters.
pub fn word_lengths_as_read(text: &str) -> Vec<usize> {
    DISGUISED_RE
        .find_iter(text)
        .map(|m| m.as_str())
        .filter(|token| has_letter(token))
        .map(|token| {
            if honest_number(token) {
                letter_count(token)
            } else {
                token.nfc().filter(|c| is_class(&COUNTED_AS_LETTER, *c)).count()
            }
        })
        .collect()
}

/// A letter as a curse compares it: folded and read in the English alphabet (`letterAsRead`).
pub fn letter_as_read(letter: &str) -> String {
    fold(letter).chars().map(|c| if is_letter(c) { read_letter(c) } else { c.to_string() }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_and_caps_a_verse() {
        let v = clean_verse(&format!("a\u{200b}\u{202e} b\n\n\n  c  \r\n{}", "x\n".repeat(20)));
        assert_eq!(v.split('\n').next(), Some("a b"));
        assert_eq!(v.split('\n').count(), MAX_VERSE_LINES);
        assert_eq!(clean_verse(&"z".repeat(5000)).encode_utf16().count(), MAX_VERSE_CHARS);
    }

    #[test]
    fn the_cap_counts_utf16_units_and_never_splits_a_character() {
        // 599 units, then a character of two units: it does not fit, and is not cut in half.
        let v = clean_verse(&format!("{}😀 after", "a".repeat(599)));
        assert_eq!(v.encode_utf16().count(), 599);
        assert!(!v.contains('\u{fffd}'));
        let whole = clean_verse(&format!("{}😀 after", "a".repeat(598)));
        assert!(whole.ends_with('😀'));
    }

    #[test]
    fn cleaning_a_clean_verse_changes_nothing() {
        for raw in ["Step upe\u{200b}\u{301}, poor player", "a\u{200b}\u{301}b", &format!("{} b", "a".repeat(599))] {
            let once = clean_verse(raw);
            assert_eq!(clean_verse(&once), once, "{raw:?}");
        }
    }

    #[test]
    fn every_line_break_breaks_and_nothing_invisible_survives() {
        assert_eq!(clean_verse("one\rtwo\r\nthree\u{2028}four\u{0b}five\u{85}six"), "one\ntwo\nthree\nfour\nfive\nsix");
        // Zero-width and direction marks, a byte-order mark, a soft hyphen, a control: gone.
        assert_eq!(clean_verse("a\u{200b}b\u{202e}c\u{feff}d\u{ad}e\u{0}f"), "abcdef");
        // A tab, a no-break space, an ideographic space and a Hangul filler are spaces.
        assert_eq!(clean_verse("a\tb\u{a0}c\u{3000}d\u{3164}e"), "a b c d e");
        // An invisible couplet is no verse at all.
        assert_eq!(clean_verse("\u{3164}\u{3164}\n\u{200b}\u{2800}"), "");
    }

    #[test]
    fn compatibility_forms_marks_and_look_alikes_are_read_as_a_person_reads_them() {
        assert_eq!(clean_verse("ｆｕｌｌ ﬁre"), "full fire");
        // Marks with no letter under them go; a pile on one letter is cut to four.
        assert_eq!(clean_verse("\u{301}\u{301} a"), "a");
        assert_eq!(clean_verse("e\u{301}\u{302}\u{303}\u{304}\u{305}\u{306}").chars().count(), 5);
        // "rose" with a Cyrillic о is the word "rose"; typed, it is left as it was.
        assert_eq!(clean_verse("r\u{43e}se"), "rose");
        assert_eq!(clean_verse_with("r\u{43e}se", false), "r\u{43e}se");
        // A Cyrillic word with one Latin letter in it stays Cyrillic.
        assert_eq!(clean_verse("м\u{6f}л\u{6f}к\u{6f}"), "молоко");
        // Thai is left as typed.
        assert_eq!(clean_verse("น้ำ"), "น้ำ");
    }

    #[test]
    fn the_confusables_are_unicodes_and_complete() {
        // 586 letters in the generated file (its header says so).
        assert_eq!(PROTOTYPE.len(), 586);
        assert_eq!(prototype_of('\u{43e}'), 'o');
        assert_eq!(prototype_of('ø'), 'o');
        assert_eq!(prototype_of('q'), 'q');
        assert_eq!(script_of('a'), "Latin");
        assert_eq!(script_of('\u{43e}'), "Cyrillic");
        assert_eq!(script_of('\u{301}'), "Mark");
        assert_eq!(script_of('😀'), "Other");
    }

    #[test]
    fn counts_english_syllables_by_sound_and_by_spelling() {
        for (w, n) in [
            ("stage", 1), ("candle", 2), ("question", 2), ("banished", 2), ("wanted", 2), ("tomorrow", 3),
            ("beautiful", 3), ("queen", 1), ("poem", 2), ("naked", 2), ("hamlet", 2), ("ophelia", 3), ("every", 3),
        ] {
            assert_eq!(syllables_in_word(w, "en"), Some(n), "{w}");
        }
        // A word said two ways has both counts, the commonest first.
        assert_eq!(syllable_counts("fire", "en"), Some(vec![2, 1]));
        // Words the table lacks are counted by spelling.
        for (w, n) in [("zorblat", 2), ("quixing", 2), ("blorptions", 2)] {
            assert!(pronounce(w).is_none(), "{w} is in the table; pick another");
            assert_eq!(syllables_in_word(w, "en"), Some(n), "{w}");
        }
        assert_eq!(syllables_in_line("A frog jumps into the pond", "en"), Some(7));
        assert_eq!(syllables_in_line("古池や蛙飛び込む", "en"), None);
        let span = syllable_span("The fire of the zorblat", "en").unwrap();
        assert_eq!((span.max - span.min, span.guessed), (1, 1));
    }

    #[test]
    fn finds_rhymes_and_refuses_identical_words() {
        for (a, b) in [("night", "light"), ("stage", "rage"), ("sea", "me"), ("destiny", "free"), ("day", "weigh"),
            ("hour", "flower"), ("there", "care"), ("back", "attack"), ("corazón", "canción"), ("go", "so"),
            ("know", "show"), ("sky", "high"), ("day", "they"), ("time", "rhyme"), ("you", "true"), ("fire", "pyre")] {
            assert!(rhymes(a, b), "{a} / {b}");
        }
        for (a, b) in [("night", "night"), ("king", "moon"), ("stage", "large"), ("Night", "night")] {
            assert!(!rhymes(a, b), "{a} / {b}");
        }
    }

    #[test]
    fn splits_words_in_any_script() {
        assert_eq!(words_of("Thou know'st 'tis common"), ["thou", "know'st", "tis", "common"]);
        assert_eq!(words_of("¿Ser o no ser?"), ["ser", "o", "no", "ser"]);
        assert_eq!(words_of("быть или не быть").len(), 4);
        assert_eq!(fold("Café"), "cafe");
        assert_eq!(fold("o’er"), "o'er");
        assert_eq!(words_of("ΟΔΥΣΣΕΥΣ"), ["οδυσσευς"]);
        assert_eq!(word_parts("one-two-three o'er"), ["one", "two", "three", "o'er"]);
    }

    #[test]
    fn a_verse_needs_substance() {
        for thin in ["Never\nNever\nNever", "a\na a\na a a", "w\ni\nt", "word", "?!\n...", "ab cd ga\nef gh ha"] {
            assert!(!substance(thin).ok, "{thin:?}");
        }
        for real in ["Never fear\nNever yield\nNever kneel", "I\nI rise\nI rise again", "Bold\nAnd\nRhymes\nDown"] {
            assert!(substance(real).ok, "{real:?}");
        }
        // The lexicon: a name of the cards counts, an abbreviation the dictionary only spells does not.
        assert!(lexicon_has("Hamlet") && lexicon_has("night") && !lexicon_has("zorblat"));
        assert!(is_telling_word("night", false) && !is_telling_word("the", true) && is_telling_word("cat", true) && !is_telling_word("cat", false));
    }

    #[test]
    fn a_copy_is_measured_from_both_sides_and_line_by_line() {
        let theirs = "Who dares to stand upon my stage?\nI put the question to thy rage";
        assert_eq!(similarity(theirs, theirs), 1.0);
        let moved = copy_of("I put the question to thy rage\nWho dares to stand upon my stage?", theirs, false);
        assert_eq!(moved.coverage, 1.0);
        assert!(moved.carry.iter().all(|c| c.end));
        let answer = copy_of("Thy question is a candle in the wind\nI throw thy question back", theirs, false);
        assert!(answer.share < 0.7 && answer.coverage < 0.85);
        assert_eq!(similarity("", theirs), 0.0);
        assert_eq!(english_stem("limpings"), "limp");
        assert_eq!(english_stem("hoped"), "hop");
        assert!(same_word("hears", "hear"));
    }

    #[test]
    fn a_curse_reads_a_word_as_a_person_does() {
        assert_eq!(words_as_read("r0se ro$e rose"), ["rose", "rose", "rose"]);
        // Typed with a Cyrillic letter, the word mixes alphabets: taken at its worst.
        assert_eq!(words_as_read("r\u{43e}se"), ["rose?"]);
        assert_eq!(words_as_read("ca9e"), ["ca?e"]);
        // An honest number is a number.
        assert_eq!(words_as_read("the 2nd act"), ["the", "2nd", "act"]);
        assert_eq!(word_lengths_as_read("w0nd3rful it's 1990s"), [9, 3, 1]);
        assert_eq!(letter_as_read("\u{41e}"), "o");
    }

    #[test]
    fn a_character_the_server_cannot_read_is_named() {
        assert_eq!(unknown_character("plain words, café, 古池, 😀"), None);
        // Unassigned in every version, and a noncharacter.
        assert_eq!(unknown_character("a\u{0378}b"), Some('\u{0378}'));
        assert_eq!(unknown_character("a\u{FFFF}"), Some('\u{FFFF}'));
    }

    #[test]
    fn math_round_rounds_a_half_up_and_nothing_else() {
        assert_eq!(js_round(0.49999999999999994), 0.0);
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(7.4999), 7.0);
        assert_eq!(js_round(-2.5), -2.0);
    }
}
