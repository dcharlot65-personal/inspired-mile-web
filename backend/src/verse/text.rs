//! Text measurement for verse: lines, words, letters, syllables, rhyme.
//!
//! A port, for English, of `src/lib/verse/text.ts` and of the English rule in
//! `src/lib/verse/rhyme.ts`. The TypeScript measures sixteen languages; the server scores
//! English only, so every function here is the `lang = 'en'` path of its original, and the
//! thresholds are those of `rulesFor('en')` in `lang.ts` ([`rules`]).
//!
//! Where JavaScript and Rust differ, this file follows
//! JavaScript, because the browser's preview and the server's score must be the same number:
//!
//! - JavaScript strings are UTF-16. `cleanVerse` caps a verse at 600 UTF-16 units and
//!   `rhymeKey` measures and slices in UTF-16 units, so lengths here are counted that way
//!   and rhyme keys are `Vec<u16>`.
//! - "White space" means what JavaScript's `\s` and `trim()` mean ([`is_js_space`]), which is
//!   not Rust's `char::is_whitespace` (U+FEFF is a space to JavaScript; U+0085 is not).
//! - Lower-casing is `toLowerCase()`: full Unicode case mapping, which `str::to_lowercase`
//!   also implements (final sigma included).

use std::sync::LazyLock;

use regex::Regex;
use unicode_normalization::UnicodeNormalization;

/// Longest verse the game accepts, in UTF-16 code units.
pub const MAX_VERSE_CHARS: usize = 600;
pub const MAX_VERSE_LINES: usize = 8;

/// Control characters, zero-width characters and direction overrides: none belong in a verse.
fn is_stripped(c: char) -> bool {
    matches!(
        c as u32,
        0x00..=0x08 | 0x0b..=0x1f | 0x7f..=0x9f | 0x200b..=0x200f | 0x2028..=0x202e | 0x2066..=0x2069
    )
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

/// Strip control characters, collapse blank lines and runs of space, cap the length.
pub fn clean_verse(raw: &str) -> String {
    let no_control: String = raw.chars().filter(|c| !is_stripped(*c)).collect();
    let mut lines: Vec<String> = Vec::new();
    // The TypeScript splits on /\r?\n/, but every \r has just been stripped.
    for line in no_control.split('\n') {
        let mut collapsed = String::with_capacity(line.len());
        let mut in_space = false;
        for c in line.chars() {
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

static WORD_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*").expect("word pattern"));
static LETTER_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{L}").expect("letter pattern"));
static MARK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{M}").expect("mark pattern"));
static NON_LETTER_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\p{L}]").expect("letter pattern"));
/// An accent on a Latin or Greek letter: the letter is kept, the accents go.
static ACCENTED_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([\p{Latin}\p{Greek}])[\x{300}-\x{36f}]+").expect("accent pattern"));
static LATIN_WORD_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[\p{Latin}'’\-]+$").expect("latin pattern"));

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
/// or the optional vowel marks of Arabic, and with the spellings people type either way
/// merged (œ and oe, æ and ae, ß and ss, Russian ё and е, the Devanagari nukta).
pub fn fold(word: &str) -> String {
    let decomposed: String = word.nfd().collect();
    let bare = ACCENTED_RE.replace_all(&decomposed, "$1");
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
    let mut buf = [0u8; 4];
    word.nfc().filter(|c| LETTER_RE.is_match(c.encode_utf8(&mut buf))).count()
}

/// A word's length as the "of N letters or more" rules count it: every character but the
/// marks that sit on a letter, an inner apostrophe or hyphen included (`wordSpan`).
pub fn word_span(word: &str) -> usize {
    let mut buf = [0u8; 4];
    word.nfc().filter(|c| !MARK_RE.is_match(c.encode_utf8(&mut buf))).count()
}

/// A line's length in words (`lineLength` for a language that counts in words).
pub fn line_length(line: &str) -> usize {
    words_of(line).len()
}

/// What a line opens with, folded: its first word (`edgeUnit(line, 'en', 'first')`).
pub fn first_unit(line: &str) -> String {
    fold(&first_word(line))
}

/// What a line closes on, folded: its last word (`edgeUnit(line, 'en', 'last')`).
pub fn last_unit(line: &str) -> String {
    fold(&last_word(line))
}

fn is_vowel(b: u8) -> bool {
    b"aeiouy".contains(&b)
}

/// The word is written in the Latin script throughout (apostrophes and hyphens allowed).
fn is_latin(word: &str) -> bool {
    LATIN_WORD_RE.is_match(word)
}

/// Syllables in an English word, or `None` when it is not in a script we can count.
/// `lang` is kept in the signature because the TypeScript takes one; only English is ported.
pub fn syllables_in_word(word: &str, lang: &str) -> Option<u32> {
    debug_assert!(lang.to_lowercase().split('-').next() == Some("en"), "only English is ported");
    if !is_latin(word) {
        // A word with letters of another script cannot be counted; one with no letters has none.
        return if letter_count(word) > 0 { None } else { Some(0) };
    }
    let w: Vec<u8> = fold(word).bytes().filter(u8::is_ascii_lowercase).collect();
    if w.is_empty() {
        return Some(0);
    }
    let mut groups: i32 = 0;
    let mut in_vowel = false;
    for &b in &w {
        let v = is_vowel(b);
        if v && !in_vowel {
            groups += 1;
        }
        in_vowel = v;
    }
    {
        let n = w.len();
        // Silent final e ("stage"), but not "-le" after a consonant ("candle").
        if n > 2 && w.ends_with(b"e") && !w.ends_with(b"le") && !is_vowel(w[n - 2]) {
            groups -= 1;
        }
        if w.ends_with(b"le") && n > 2 && is_vowel(w[n - 3]) {
            groups -= 1;
        }
        // "-es" is silent after most consonants ("leaves") but not after a hiss ("roses").
        let hiss = [&b"ses"[..], b"xes", b"zes", b"ches", b"shes", b"ces", b"ges"].iter().any(|s| w.ends_with(s));
        if n > 3 && w.ends_with(b"es") && !is_vowel(w[n - 3]) && !hiss {
            groups -= 1;
        }
        // "-ed" is silent except after t or d ("wanted").
        if n > 3 && w.ends_with(b"ed") && !(w.ends_with(b"ted") || w.ends_with(b"ded")) && !is_vowel(w[n - 3]) {
            groups -= 1;
        }
    }
    Some(groups.max(1) as u32)
}

pub fn syllables_in_line(line: &str, lang: &str) -> Option<u32> {
    let mut total = 0;
    for w in words_of(line) {
        total += syllables_in_word(&w, lang)?;
    }
    Some(total)
}

/// The spellings `rhymeKey` treats as sounding alike, applied in this order, each once.
static RHYME_SPELLINGS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    [
        (r"ight$", "ite"),
        (r"(ower|our)$", "owr"),
        (r"(are|air|eir|ayer)$", "air"),
        (r"^(th|wh)ere$", "${1}air"),
        (r"(awl|aul|all)$", "awl"),
        (r"(oise|oys)$", "oyz"),
        (r"(ize|ise|ies|eyes|ighs)$", "ize"),
        (r"(ough|ow|oe)$", "o"),
        (r"(ay|eigh)$", "ay"),
        (r"(ck|que)$", "k"),
        (r"ph$", "f"),
        (r"^(me|he|she|we|be|ye)$", "${1}e"),
        (r"(ee|ea|ey|ie)$", "ee"),
        (r"([^aeiou])y$", "${1}ee"),
    ]
    .into_iter()
    .map(|(pattern, with)| (Regex::new(pattern).expect("rhyme pattern"), with))
    .collect()
});

/// The part of a word that carries its rhyme, as UTF-16 units: from the last vowel group
/// to the end for Latin scripts, otherwise the last two units.
pub fn rhyme_key(word: &str) -> Vec<u16> {
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

/// Two different words whose endings match. A word never rhymes with itself.
pub fn rhymes(a: &str, b: &str) -> bool {
    let fa = fold(a);
    let fb = fold(b);
    if fa.is_empty() || fb.is_empty() || fa == fb {
        return false;
    }
    let ka = rhyme_key(&fa);
    let kb = rhyme_key(&fb);
    if ka.len() < 2 || kb.len() < 2 {
        return false;
    }
    if ka == kb {
        return true;
    }
    // "corazón" / "canción": one ending contained in the other still rhymes.
    let (short, long) = if ka.len() <= kb.len() { (&ka, &kb) } else { (&kb, &ka) };
    long.ends_with(short)
}

/// The two words a pair of lines is compared on for rhyme: the last word of each
/// (`rhymeEnds`; the Hindi rule for a repeated closing word is not ported).
pub fn rhyme_ends(line_a: &str, line_b: &str) -> (String, String) {
    (last_word(line_a), last_word(line_b))
}

/// Words that carry meaning: four letters or more.
pub fn content_words(text: &str) -> Vec<String> {
    words_of(text).into_iter().filter(|w| word_span(w) >= rules::CONTENT).collect()
}

/// First letter of a word, folded; empty when folding leaves nothing.
pub fn initial(word: &str) -> String {
    fold(word).chars().next().map(String::from).unwrap_or_default()
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
    fn javascript_space_is_not_rust_whitespace() {
        // U+FEFF is trimmed and collapsed; U+0085 is a control character and is removed.
        assert_eq!(clean_verse("\u{feff}a\u{feff}\u{feff}b\u{feff}"), "a b");
        assert_eq!(clean_verse("a\u{85}b"), "ab");
        assert_eq!(clean_verse("a\tb\u{a0}c\u{3000}d"), "a b c d");
        // A carriage return alone does not end a line: it is stripped.
        assert_eq!(clean_verse("one\rtwo\r\nthree"), "onetwo\nthree");
    }

    #[test]
    fn counts_english_syllables() {
        for (w, n) in [
            ("stage", 1), ("candle", 2), ("fire", 1), ("question", 2), ("banished", 2), ("wanted", 2),
            ("tomorrow", 3), ("beautiful", 3), ("the", 1), ("queen", 1), ("rhythm", 1),
            ("leaves", 1), ("takes", 1), ("roses", 2), ("wishes", 2), ("ages", 2), ("them", 1),
        ] {
            assert_eq!(syllables_in_word(w, "en"), Some(n), "{w}");
        }
        assert_eq!(syllables_in_line("A frog jumps into the pond", "en"), Some(7));
        assert_eq!(syllables_in_line("古池や蛙飛び込む", "en"), None);
    }

    #[test]
    fn finds_rhymes_and_refuses_identical_words() {
        for (a, b) in [("night", "light"), ("stage", "rage"), ("sea", "me"), ("destiny", "free"), ("day", "weigh"),
            ("hour", "flower"), ("there", "care"), ("back", "attack"), ("corazón", "canción")] {
            assert!(rhymes(a, b), "{a} / {b}");
        }
        for (a, b) in [("night", "night"), ("king", "moon"), ("fire", "pyre"), ("stage", "large"), ("Night", "night")] {
            assert!(!rhymes(a, b), "{a} / {b}");
        }
    }

    #[test]
    fn splits_words_in_any_script() {
        assert_eq!(words_of("Thou know'st 'tis common"), ["thou", "know'st", "tis", "common"]);
        assert_eq!(words_of("¿Ser o no ser?"), ["ser", "o", "no", "ser"]);
        assert_eq!(words_of("быть или не быть").len(), 4);
        assert_eq!(fold("Café"), "cafe");
        assert_eq!(words_of("ΟΔΥΣΣΕΥΣ"), ["οδυσσευς"]);
    }
}
