//! Text measurement for verse: cleaning, lines, words, letters, syllables, rhyme, and the
//! floor every verse must clear.
//!
//! A port, for English, of `src/lib/verse/text.ts` and of the English rule in
//! `src/lib/verse/rhyme.ts`. The TypeScript measures sixteen languages; the server scores
//! English only, so every function here is the `lang = 'en'` path of its original, and the
//! thresholds are those of `rulesFor('en')` in `lang.ts` ([`rules`]).
//!
//! English is measured by sound where it can be: the pronunciation table
//! ([`super::pronounce`]) gives a word its syllable counts and rhyme keys, and the spelling
//! rules here are the fallback for a word the table lacks.
//!
//! Where JavaScript and Rust differ, this file follows JavaScript, because the browser's
//! preview and the server's score must be the same number:
//!
//! - JavaScript strings are UTF-16. `cleanVerse` caps a verse at 600 UTF-16 units and the
//!   spelled rhyme key measures and slices in UTF-16 units, so lengths here are counted that
//!   way and rhyme keys are `Vec<u16>`.
//! - "White space" means what JavaScript's `\s` and `trim()` mean ([`is_js_space`]), which is
//!   not Rust's `char::is_whitespace`.
//! - Lower-casing is `toLowerCase()`: full Unicode case mapping, which `str::to_lowercase`
//!   also implements (final sigma included).
//!
//! One thing cannot be made the same by code: the Unicode tables. Normalisation and the
//! character classes come from this binary's crates and from the browser's engine, and a
//! character assigned in a newer Unicode version than one side knows may be read
//! differently. The golden vectors hold the two together for everything in their corpus.

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
//      one of the word's own is read as that letter.

/// `BLANKS`: tab, the Hangul fillers, the Braille blank and every space separator.
static BLANKS: LazyLock<Regex> = LazyLock::new(|| re(r"[\t\x{115f}\x{1160}\x{3164}\x{ffa0}\x{2800}\p{Zs}]"));
/// `INVISIBLE`. JavaScript's class also names lone surrogates, which a Rust string cannot hold.
static INVISIBLE: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{Cc}\p{Cf}\p{Co}\p{Default_Ignorable_Code_Point}]"));
static ORPHAN_MARKS: LazyLock<Regex> = LazyLock::new(|| re(r"(^|[^\p{L}\p{N}\p{M}])\p{M}+"));
/// Most combining marks one letter may carry (`MAX_MARKS`) is four.
static MARK_PILE: LazyLock<Regex> = LazyLock::new(|| re(r"(\p{M}{4})\p{M}+"));
static WORD_RUN: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{L}\p{M}]+"));

/// Cyrillic and Greek letters that are drawn like a Latin letter, with the Latin letter
/// they look like (`TO_LATIN`). Generated from text.ts, in its order.
const TO_LATIN: [(char, char); 51] = [
    ('\u{0430}', 'a'), ('\u{0435}', 'e'), ('\u{043e}', 'o'), ('\u{0440}', 'p'), ('\u{0441}', 'c'), ('\u{0445}', 'x'),
    ('\u{0443}', 'y'), ('\u{0456}', 'i'), ('\u{0458}', 'j'), ('\u{0455}', 's'), ('\u{0501}', 'd'), ('\u{04bb}', 'h'),
    ('\u{04cf}', 'l'), ('\u{051b}', 'q'), ('\u{051d}', 'w'), ('\u{0410}', 'A'), ('\u{0412}', 'B'), ('\u{0415}', 'E'),
    ('\u{041a}', 'K'), ('\u{041c}', 'M'), ('\u{041d}', 'H'), ('\u{041e}', 'O'), ('\u{0420}', 'P'), ('\u{0421}', 'C'),
    ('\u{0422}', 'T'), ('\u{0425}', 'X'), ('\u{0423}', 'Y'), ('\u{0405}', 'S'), ('\u{0406}', 'I'), ('\u{0408}', 'J'),
    ('\u{03b1}', 'a'), ('\u{03bf}', 'o'), ('\u{03bd}', 'v'), ('\u{03c1}', 'p'), ('\u{03b9}', 'i'), ('\u{03ba}', 'k'),
    ('\u{03c5}', 'u'), ('\u{0391}', 'A'), ('\u{0392}', 'B'), ('\u{0395}', 'E'), ('\u{0396}', 'Z'), ('\u{0397}', 'H'),
    ('\u{0399}', 'I'), ('\u{039a}', 'K'), ('\u{039c}', 'M'), ('\u{039d}', 'N'), ('\u{039f}', 'O'), ('\u{03a1}', 'P'),
    ('\u{03a4}', 'T'), ('\u{03a5}', 'Y'), ('\u{03a7}', 'X'),
];

static TO_LATIN_MAP: LazyLock<HashMap<char, char>> = LazyLock::new(|| TO_LATIN.iter().copied().collect());

/// The same pairs the other way, Cyrillic only: the first Cyrillic letter listed for each
/// Latin one (`TO_CYRILLIC`).
static TO_CYRILLIC_MAP: LazyLock<HashMap<char, char>> = LazyLock::new(|| {
    let mut map = HashMap::new();
    for (from, to) in TO_LATIN {
        if is_class(&CYRILLIC_RE, from) {
            map.entry(to).or_insert(from);
        }
    }
    map
});

/// A word as its look-alike letters read in Latin (`latinised`).
fn latinised(word: &str) -> String {
    word.chars().map(|c| TO_LATIN_MAP.get(&c).copied().unwrap_or(c)).collect()
}

/// In a word that mixes alphabets, read the strays as letters of the word's own alphabet
/// (`unmixScripts`).
fn unmix_scripts(line: &str) -> String {
    WORD_RUN
        .replace_all(line, |caps: &Captures| {
            let word = &caps[0];
            let letters: Vec<char> = word.chars().collect();
            let of = |class: &Regex| letters.iter().copied().filter(|c| is_class(class, *c)).collect::<Vec<char>>();
            let (latin, cyrillic, greek) = (of(&LATIN_RE), of(&CYRILLIC_RE), of(&GREEK_RE));
            let alphabets = [&latin, &cyrillic, &greek].iter().filter(|a| !a.is_empty()).count();
            if alphabets < 2 {
                return word.to_string();
            }
            let own_latin = latin.iter().filter(|c| !TO_CYRILLIC_MAP.contains_key(c)).count();
            let own_cyrillic = cyrillic.iter().filter(|c| !TO_LATIN_MAP.contains_key(c)).count();
            let to_cyrillic =
                if own_cyrillic != own_latin { own_cyrillic > own_latin } else { cyrillic.len() > latin.len() };
            if to_cyrillic && cyrillic.len() >= greek.len() {
                return letters
                    .iter()
                    .map(|c| {
                        let as_latin = TO_LATIN_MAP.get(c).copied().unwrap_or(*c);
                        TO_CYRILLIC_MAP.get(&as_latin).copied().unwrap_or(*c)
                    })
                    .collect();
            }
            if latin.len() >= greek.len() || cyrillic.is_empty() {
                return if latin.is_empty() { word.to_string() } else { latinised(word) };
            }
            word.to_string()
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

/// The first `max` UTF-16 units of a string (`s.slice(0, max)`).
///
/// JavaScript can cut an astral character in two and keep the first half. A Rust string
/// cannot hold that half, so it is written as U+FFFD, which is what JavaScript's
/// `toWellFormed()` makes of it. Neither is a letter, a space or a mark the rules read.
fn slice_utf16(s: &str, max: usize) -> String {
    let mut out = String::with_capacity(s.len().min(max * 3));
    let mut units = 0;
    for c in s.chars() {
        let n = c.len_utf16();
        if units + n > max {
            if units < max {
                out.push('\u{fffd}');
            }
            break;
        }
        out.push(c);
        units += n;
    }
    out
}

/// Steps 1 and 2: line breaks, then NFKC over every run that is not Thai or Lao.
fn breaks_and_forms(raw: &str) -> String {
    // /\r\n?|[\u000b\u000c\u0085  ]/g
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
    let thai_or_lao = |c: char| ('\u{0e00}'..='\u{0eff}').contains(&c);
    let mut out = String::with_capacity(broken.len());
    let mut run = String::new();
    for c in broken.chars() {
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

/// Normalise a verse (see above), collapse blank lines and runs of space, cap the length.
pub fn clean_verse(raw: &str) -> String {
    let formed = breaks_and_forms(raw);
    let spaced = BLANKS.replace_all(&formed, " ");
    let mut lines: Vec<String> = Vec::new();
    for line in spaced.split('\n') {
        let visible = INVISIBLE.replace_all(line, "");
        let rooted = ORPHAN_MARKS.replace_all(&visible, "${1}");
        let trimmed_marks = MARK_PILE.replace_all(&rooted, "${1}");
        let unmixed = unmix_scripts(&trimmed_marks);
        let mut collapsed = String::with_capacity(unmixed.len());
        let mut in_space = false;
        for c in unmixed.chars() {
            if is_js_space(c) {
                if !in_space {
                    collapsed.push(' ');
                }
                in_space = true;
            } else {
                collapsed.push(c);
                in_space = false;
            }
        }
        let trimmed = js_trim(&collapsed);
        if !trimmed.is_empty() {
            lines.push(trimmed.to_string());
            if lines.len() == MAX_VERSE_LINES {
                break;
            }
        }
    }
    slice_utf16(&lines.join("\n"), MAX_VERSE_CHARS)
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Substance {
    pub ok: bool,
    /// Different words found, and how many the verse needs.
    pub distinct: usize,
    pub needed: usize,
}

/// Fewest different words anything that calls itself a verse can have.
pub const MIN_DISTINCT_WORDS: usize = 3;

/// Is this a verse, or tokens arranged to satisfy a checker (`substance`)? Every line holds
/// at least one word, and the verse has at least as many different words as it has lines,
/// and never fewer than three. Lone letters count as one word between them. More than half
/// of its lines are different lines: a line said again (the same words, whatever the case
/// and punctuation) counts once, so a refrain may return but one line said over and over
/// is one line.
pub fn substance(verse: &str) -> Substance {
    let ls = lines_of(verse);
    let per_line: Vec<Vec<String>> =
        ls.iter().map(|l| units_of(l).into_iter().filter(|u| letter_count(u) > 0).collect()).collect();
    let mut words: HashSet<&str> = HashSet::new();
    let mut any_lone = false;
    for unit in per_line.iter().flatten() {
        if lone_letter(unit) {
            any_lone = true;
        } else {
            words.insert(unit.as_str());
        }
    }
    let distinct = words.len() + usize::from(any_lone);
    let needed = ls.len().max(MIN_DISTINCT_WORDS);
    let different_lines = per_line.iter().map(|units| units.join(" ")).collect::<HashSet<String>>().len();
    let ok = !ls.is_empty()
        && per_line.iter().all(|units| !units.is_empty())
        && distinct >= needed
        && different_lines * 2 > ls.len();
    Substance { ok, distinct, needed }
}

/// How much of `verse` is taken from `source`, from 0 (nothing) to 1 (all of it)
/// (`similarity`): the share of the verse's word pairs that also run together in the
/// source; a whole line of three words or more repeated from the source counts as 1.
pub fn similarity(verse: &str, source: &str) -> f64 {
    let seq = |text: &str| -> Vec<Vec<String>> {
        lines_of(text).iter().map(|l| units_of(l)).filter(|u| !u.is_empty()).collect()
    };
    let mine = seq(verse);
    let theirs = seq(source);
    if mine.is_empty() || theirs.is_empty() {
        return 0.0;
    }
    let their_lines: HashSet<String> = theirs.iter().map(|u| u.join(" ")).collect();
    if mine.iter().any(|u| u.len() >= 3 && their_lines.contains(&u.join(" "))) {
        return 1.0;
    }
    let pairs = |ls: &[Vec<String>]| -> Vec<String> {
        ls.iter().flat_map(|u| u.windows(2).map(|p| format!("{} {}", p[0], p[1])).collect::<Vec<_>>()).collect()
    };
    let my_pairs = pairs(&mine);
    if my_pairs.is_empty() {
        // One-word lines have no pairs; fall back to the words themselves.
        let their_words: HashSet<&String> = theirs.iter().flatten().collect();
        let my_words: Vec<&String> = mine.iter().flatten().collect();
        return my_words.iter().filter(|w| their_words.contains(**w)).count() as f64 / my_words.len() as f64;
    }
    let their_pairs: HashSet<String> = pairs(&theirs).into_iter().collect();
    my_pairs.iter().filter(|p| their_pairs.contains(*p)).count() as f64 / my_pairs.len() as f64
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
static COUNTED_AS_LETTER: LazyLock<Regex> = LazyLock::new(|| re(r"[\p{L}\p{N}$@€£|+!]"));

/// Words as a curse reads them (`wordsAsRead`): folded, look-alike letters read as Latin,
/// and a digit or sign written in place of a letter read as the letter it stands for. A
/// stand-in that stands for nothing, or one inside a word not in Latin letters, is "?".
pub fn words_as_read(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for token in DISGUISED_RE.find_iter(text).map(|m| m.as_str()) {
        if !has_letter(token) {
            continue;
        }
        let seen: Vec<char> = latinised(&fold(token)).chars().collect();
        let latin = seen.iter().all(|c| !is_letter(*c) || is_class(&LATIN_RE, *c));
        out.push(
            seen.iter()
                .map(|c| {
                    if is_letter(*c) || is_class(&MARK_RE, *c) || *c == '\'' || *c == '-' {
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
/// digit or sign written inside it in place of one.
pub fn word_lengths_as_read(text: &str) -> Vec<usize> {
    DISGUISED_RE
        .find_iter(text)
        .map(|m| m.as_str())
        .filter(|token| has_letter(token))
        .map(|token| token.nfc().filter(|c| is_class(&COUNTED_AS_LETTER, *c)).count())
        .collect()
}

/// A letter as a curse compares it: folded and read as Latin where it has a Latin look-alike.
pub fn letter_as_read(letter: &str) -> String {
    latinised(&fold(letter))
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
        // 599 units, then a character of two units: JavaScript keeps half of it.
        let v = clean_verse(&format!("{}😀 after", "a".repeat(599)));
        assert_eq!(v.encode_utf16().count(), 600);
        assert!(v.ends_with('\u{fffd}'));
        let whole = clean_verse(&format!("{}😀 after", "a".repeat(598)));
        assert!(whole.ends_with('😀'));
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
        // "rose" with a Cyrillic о is the word "rose".
        assert_eq!(clean_verse("r\u{43e}se"), "rose");
        // A Cyrillic word with one Latin letter in it stays Cyrillic.
        assert_eq!(clean_verse("м\u{6f}л\u{6f}к\u{6f}"), "молоко");
        // Thai is left as typed.
        assert_eq!(clean_verse("น้ำ"), "น้ำ");
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
        for thin in ["Never\nNever\nNever", "a\na a\na a a", "w\ni\nt", "word", "?!\n..."] {
            assert!(!substance(thin).ok, "{thin:?}");
        }
        for real in ["Never fear\nNever yield\nNever kneel", "I\nI rise\nI rise again", "Bold\nAnd\nRhymes\nDown"] {
            assert!(substance(real).ok, "{real:?}");
        }
    }

    #[test]
    fn a_copy_is_measured_by_its_word_pairs() {
        let theirs = "Who dares to stand upon my stage?\nI put the question to thy rage";
        assert_eq!(similarity(theirs, theirs), 1.0);
        assert_eq!(similarity("I put the question to thy rage\nWho dares to stand upon my stage?", theirs), 1.0);
        assert!(similarity("Who dares to stand upon my page?\nI put a question to thy rage", theirs) >= 0.5);
        assert!(similarity("Thy question is a candle in the wind\nI throw thy question back", theirs) < 0.5);
        assert_eq!(similarity("", theirs), 0.0);
    }

    #[test]
    fn a_curse_reads_a_word_as_a_person_does() {
        assert_eq!(words_as_read("r0se ro$e R\u{43e}se"), ["rose", "rose", "rose"]);
        assert_eq!(words_as_read("ca9e"), ["ca?e"]);
        assert_eq!(word_lengths_as_read("w0nd3rful it's"), [9, 3]);
        assert_eq!(letter_as_read("\u{41e}"), "o");
    }
}
