//! Devices, the signature echo, curses and power words: what the cards do. A port of
//! `src/lib/verse/devices.ts`. All of it is checked by code, so the same verse always
//! scores the same.

use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

use super::cards::Card;
use super::text::{
    content_words, first_unit, fold, initial, is_stop_word, last_unit, last_word, letter_as_read, letter_count,
    line_length, lines_of, rhymes, rules, word_lengths_as_read, word_parts, word_span, words_as_read, words_of,
    STOP_WORDS,
};

/// What a device check may look at besides the verse.
#[derive(Debug, Clone, Copy, Default)]
pub struct DeviceContext<'a> {
    /// The verse this one answers, for the riposte.
    pub opponent_verse: Option<&'a str>,
    /// Names that count as an invocation: a single word, or a phrase whose words must run together.
    pub names: &'a [String],
}

/// Whether a verse lands a device, and the verse's words that landed it, folded (`DeviceResult`
/// without its `detail`): the repeated word, the rhyming pair, the name. What the verse says
/// beyond them is what a multiplier multiplies. Empty for a device of shape (a question, a
/// line length).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DeviceResult {
    pub met: bool,
    pub words: Vec<String>,
}

impl DeviceResult {
    fn shape(met: bool) -> Self {
        Self { met, words: Vec::new() }
    }
}

/// Every device id, in the order of `DEVICES` in devices.ts.
pub const DEVICE_IDS: [&str; 13] = [
    "question", "exclaim", "alliteration", "repetition", "internal-rhyme", "riposte", "brevity", "swell", "balance",
    "ring", "invocation", "grandeur", "monorhyme",
];

// JavaScript's \s, spelled out: Rust's \s is a different set (see text::is_js_space).
const JS_SPACE: &str = r"[\t\n\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]";

/// A line ending in one of `marks`, closing quotation marks and brackets allowed after it.
fn ending(marks: &str) -> Regex {
    Regex::new(&format!(r#"[{marks}]{JS_SPACE}*["'”’)»」』]*$"#)).expect("line-ending pattern")
}

static QUESTION_END: LazyLock<Regex> = LazyLock::new(|| ending("?？؟"));
static EXCLAIM_END: LazyLock<Regex> = LazyLock::new(|| ending("!！"));
static HAS_LETTER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{L}").expect("letter pattern"));

/// A line ending in the mark that has a word in it (`lineEnding`): punctuation alone asks
/// nothing and cries nothing.
fn line_ends(verse: &str, end: &Regex) -> bool {
    lines_of(verse).iter().any(|l| end.is_match(l) && HAS_LETTER.is_match(l))
}

fn line_lengths(verse: &str) -> Vec<usize> {
    lines_of(verse).iter().map(|l| line_length(l)).collect()
}

/// Distinct items in the order they first appear, as a JavaScript `Set` keeps them.
fn distinct_in_order(items: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = HashSet::new();
    items.into_iter().filter(|w| seen.insert(w.clone())).collect()
}

/// Counts in the order each key first appears, as a JavaScript `Map` keeps them.
fn counts_in_order(keys: impl IntoIterator<Item = String>) -> Vec<(String, usize)> {
    let mut out: Vec<(String, usize)> = Vec::new();
    for k in keys {
        match out.iter_mut().find(|(have, _)| *have == k) {
            Some((_, n)) => *n += 1,
            None => out.push((k, 1)),
        }
    }
    out
}

/// Whether a verse lands a device, and with which words. `None` for a device id that does
/// not exist.
pub fn check_device(id: &str, verse: &str, ctx: &DeviceContext) -> Option<DeviceResult> {
    let min = rules::CONTENT.min(3);
    let result = match id {
        "question" => DeviceResult::shape(line_ends(verse, &QUESTION_END)),
        "exclaim" => DeviceResult::shape(line_ends(verse, &EXCLAIM_END)),
        "alliteration" => {
            let mut found = DeviceResult::default();
            for line in lines_of(verse) {
                // Three different words, and not the little ones.
                let distinct = distinct_in_order(words_of(line).iter().map(|w| fold(w)));
                let keep = |w: &String| word_span(w) >= min && !is_stop_word(w);
                let counts = counts_in_order(distinct.iter().filter(|w| keep(w)).map(|w| initial(w)));
                if let Some((k, _)) = counts.into_iter().find(|(_, n)| *n >= 3) {
                    let words = distinct.iter().filter(|w| keep(w) && initial(w) == k).cloned().collect();
                    found = DeviceResult { met: true, words };
                    break;
                }
            }
            found
        }
        "repetition" => {
            let counts = counts_in_order(content_words(verse).into_iter().filter(|w| !is_stop_word(w)).map(|w| fold(&w)));
            match counts.into_iter().find(|(_, n)| *n >= 3) {
                Some((w, _)) => DeviceResult { met: true, words: vec![w] },
                None => DeviceResult::default(),
            }
        }
        "internal-rhyme" => {
            let mut found = DeviceResult::default();
            'lines: for line in lines_of(verse) {
                let ws: Vec<String> =
                    words_of(line).into_iter().filter(|w| word_span(w) >= min && !is_stop_word(w)).collect();
                for i in 0..ws.len() {
                    for j in i + 1..ws.len() {
                        if rhymes(&ws[i], &ws[j]) {
                            found = DeviceResult { met: true, words: vec![fold(&ws[i]), fold(&ws[j])] };
                            break 'lines;
                        }
                    }
                }
            }
            found
        }
        "riposte" => match ctx.opponent_verse {
            // An empty opponent verse is no verse to answer, as in JavaScript.
            None | Some("") => DeviceResult::default(),
            Some(theirs) => {
                let theirs: HashSet<String> = words_of(theirs)
                    .iter()
                    .filter(|w| word_span(w) >= rules::RIPOSTE && !is_stop_word(w))
                    .map(|w| fold(w))
                    .collect();
                // `!!hit`: a word that folds to nothing is not a hit even if it is "found".
                match words_of(verse).iter().map(|w| fold(w)).find(|w| theirs.contains(w)) {
                    Some(hit) if !hit.is_empty() => DeviceResult { met: true, words: vec![hit] },
                    _ => DeviceResult::default(),
                }
            }
        },
        "brevity" => {
            let counts = line_lengths(verse);
            let longest = counts.iter().copied().max().unwrap_or(0);
            DeviceResult::shape(!counts.is_empty() && longest <= rules::BREVITY && longest > 0)
        }
        "swell" => {
            let counts = line_lengths(verse);
            DeviceResult::shape(match counts.split_last() {
                Some((last, rest)) if !rest.is_empty() => rest.iter().all(|c| c < last),
                _ => false,
            })
        }
        "balance" => {
            let counts = line_lengths(verse);
            DeviceResult::shape(counts.len() >= 2 && counts.iter().all(|c| *c == counts[0] && *c > 0))
        }
        "ring" => {
            let ls = lines_of(verse);
            match (ls.first(), ls.last()) {
                (Some(first), Some(last)) => {
                    let a = first_unit(first);
                    let b = last_unit(last);
                    // The TypeScript counts the verse's words with its line breaks read as spaces;
                    // a word never runs across a line break, so the count is the same.
                    let met = !a.is_empty() && a == b && line_length(verse) > 2;
                    // The opening word, whether or not the ring closed on it.
                    DeviceResult { met, words: if a.is_empty() { Vec::new() } else { vec![a] } }
                }
                _ => DeviceResult::default(),
            }
        }
        "invocation" => {
            // Words run together with single spaces, so a phrase ("sonnet man") is found only as a phrase.
            let spaced = |text: &str| format!(" {} ", words_of(text).iter().map(|w| fold(w)).collect::<Vec<_>>().join(" "));
            let said = spaced(verse);
            // `!!hit`: an empty name is never a hit.
            match ctx.names.iter().find(|n| said.contains(&spaced(n))) {
                Some(hit) if !hit.is_empty() => {
                    DeviceResult { met: true, words: words_of(hit).iter().map(|w| fold(w)).collect() }
                }
                _ => DeviceResult::default(),
            }
        }
        "grandeur" => {
            // Each part of a hyphenated chain is its own word.
            let big = distinct_in_order(
                word_parts(verse).iter().filter(|w| letter_count(w) >= rules::GRAND).map(|w| fold(w)),
            );
            DeviceResult { met: big.len() >= 2, words: big.into_iter().take(2).collect() }
        }
        "monorhyme" => {
            let ends: Vec<String> = lines_of(verse).iter().map(|l| last_word(l)).collect();
            let met = ends.len() >= 2 && ends.iter().skip(1).all(|w| rhymes(&ends[0], w));
            DeviceResult { met, words: if met { ends.iter().map(|w| fold(w)).collect() } else { Vec::new() } }
        }
        _ => return None,
    };
    Some(result)
}

/// Which device each house fights with (`HOUSE_DEVICE`).
pub const HOUSE_DEVICE: [(&str, &str); 14] = [
    ("Danish Court", "question"),
    ("Capulet", "exclaim"),
    ("Montague", "internal-rhyme"),
    ("Forest of Arden", "alliteration"),
    ("Verona Court", "riposte"),
    ("The Tempest", "swell"),
    ("Scottish Court", "repetition"),
    ("Illyria", "brevity"),
    ("Rome", "invocation"),
    ("Legendary", "monorhyme"),
    ("Lake District", "balance"),
    ("Gothic Circle", "ring"),
    ("Olympus", "grandeur"),
    ("Underworld", "riposte"),
];

/// The device a house fights with; a house without one fights with the question.
pub fn device_for_house(house: &str) -> &'static str {
    HOUSE_DEVICE.iter().find(|(h, _)| *h == house).map(|(_, d)| *d).unwrap_or("question")
}

/// What a Riposte house fights with when there is no verse yet to answer (`OPENING_DEVICE`).
pub const OPENING_DEVICE: &str = "exclaim";

/// The device a house fights with in a given verse (`deviceInPlay`). The Riposte turns the
/// other side's words back, so a verse with nothing to answer is held to the outcry instead.
pub fn device_in_play(house: &str, answering: bool) -> &'static str {
    let device = device_for_house(house);
    if device == "riposte" && !answering { OPENING_DEVICE } else { device }
}

/// Parts of a character's name that are ordinary words: said alone they name nobody.
const ORDINARY_NAME_PARTS: [&str; 5] = ["the", "man", "sonnet", "nurse", "bottom"];
/// How a character whose whole name is an ordinary word is called on (`NAME_PHRASES`).
const NAME_PHRASES: [(&str, [&str; 3]); 1] = [("Bottom", ["Nick Bottom", "Bully Bottom", "Bottom the weaver"])];

/// What counts as calling on a character (`invocationNames`): the full name, or its last
/// part alone when that is a name and not an ordinary word.
pub fn invocation_names<'a>(character_names: impl IntoIterator<Item = &'a str>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut add = |name: String| {
        if !out.contains(&name) {
            out.push(name);
        }
    };
    for name in character_names {
        let parts: Vec<&str> = name.split(super::text::is_js_space).filter(|p| !p.is_empty()).collect();
        let Some(last) = parts.last() else { continue };
        if !ORDINARY_NAME_PARTS.contains(&last.to_lowercase().as_str()) {
            add(last.to_string());
        }
        // "The Nurse" keeps its article; "The Sonnet Man" may drop it.
        if parts.len() > 2 {
            let joined = parts.join(" ");
            add(joined.strip_prefix("The ").unwrap_or(&joined).to_string());
        } else if parts.len() > 1 {
            add(name.to_string());
        }
        for (whole, phrases) in NAME_PHRASES {
            if whole == name {
                for phrase in phrases {
                    add(phrase.to_string());
                }
            }
        }
    }
    out
}

// --- Signature: echo the card's famous line without quoting it ---

/// A word as the signature compares it: folded, without a possessive ending (`stem`).
fn stem(word: &str) -> String {
    let folded = fold(word);
    folded.strip_suffix("'s").map(String::from).unwrap_or(folded)
}

fn quote_words(card: &Card) -> Vec<String> {
    word_parts(&card.quote).iter().map(|w| stem(w)).collect()
}

fn telling_words(card: &Card) -> Vec<String> {
    distinct_in_order(quote_words(card).into_iter().filter(|w| letter_count(w) >= 4 && !STOP_WORDS.contains(w.as_str())))
}

/// The words of a card's line that a verse can echo (`signatureWords`): those of four
/// letters or more that are not everyday grammar. A line with none of those (Viola's "I am
/// not what I am.") is all little words, and no single one of them is an echo: a verse echoes
/// it by its longest two words said together, in the line's order, as one phrase ("not
/// what"). A signature is never one stop word.
pub fn signature_words(card: &Card) -> Vec<String> {
    let telling = telling_words(card);
    if !telling.is_empty() {
        return telling;
    }
    let quote = quote_words(card);
    let mut best: i64 = -1;
    let mut at: Option<usize> = None;
    for i in 0..quote.len().saturating_sub(1) {
        let n = (letter_count(&quote[i]) + letter_count(&quote[i + 1])) as i64;
        if quote[i] != quote[i + 1] && n > best {
            best = n;
            at = Some(i);
        }
    }
    match at {
        Some(i) => vec![format!("{} {}", quote[i], quote[i + 1])],
        None => Vec::new(),
    }
}

/// How many signature words a verse must use (`signatureNeeded`): two of a line's three
/// telling words or more, else one (a phrase counts as one).
pub fn signature_needed(card: &Card) -> usize {
    let sig = signature_words(card);
    if sig.len() >= 3 { 2 } else { sig.len().min(1) }
}

/// The signature lands when the verse uses enough telling words from the card's line but
/// does not simply recite it: four words running from the quote is a quotation. A phrase is
/// echoed when its words are said together, in its order, within a line. Returns the words
/// that landed it (each word of an echoed phrase), or `None` when it does not land.
pub fn check_signature_words(card: &Card, verse: &str) -> Option<Vec<String>> {
    let sig = signature_words(card);
    if sig.is_empty() {
        return None;
    }
    let spoken: Vec<String> = word_parts(verse).iter().map(|w| stem(w)).collect();
    let said: HashSet<String> = words_of(verse).iter().map(|w| stem(w)).chain(spoken.iter().cloned()).collect();
    let lines: Vec<String> =
        lines_of(verse).iter().map(|l| format!(" {} ", word_parts(l).iter().map(|w| stem(w)).collect::<Vec<_>>().join(" "))).collect();
    let echoed: Vec<&String> = sig
        .iter()
        .filter(|w| if w.contains(' ') { lines.iter().any(|l| l.contains(&format!(" {w} "))) } else { said.contains(*w) })
        .collect();
    if echoed.len() < signature_needed(card) {
        return None;
    }
    // A quotation is four of the quote's words in a row, compared word by word.
    let quote = quote_words(card);
    if quote.windows(4).any(|run| spoken.windows(4).any(|said| said == run)) {
        return None;
    }
    Some(echoed.iter().flat_map(|w| w.split(' ').map(String::from)).collect())
}

/// Whether the signature lands (`checkSignature(...).met`).
pub fn check_signature(card: &Card, verse: &str) -> bool {
    check_signature_words(card, verse).is_some()
}

// --- Curses (potions) ---

/// Every curse id, in the order of `CURSES` in devices.ts.
pub const CURSE_IDS: [&str; 4] = ["forbidden-letter", "short-words", "no-repeats", "short-lines"];

/// Craft lost per time a curse is broken, and the most one curse can cost.
pub const CURSE_PENALTY: u32 = 4;
pub const CURSE_PENALTY_CAP: u32 = 12;

/// Number of times a verse breaks a curse. `None` for a curse id that does not exist.
pub fn curse_violations(id: &str, verse: &str, param: &str) -> Option<u32> {
    let n = match id {
        "forbidden-letter" => {
            // Read as a person reads it: a look-alike letter or a digit standing in for the
            // letter counts, and a stand-in that cannot be read ("?") is taken for the worst.
            let letter = letter_as_read(param);
            words_as_read(verse).iter().filter(|w| w.contains(&letter) || w.contains('?')).count()
        }
        // A digit or sign standing in for a letter is a letter here.
        "short-words" => word_lengths_as_read(verse).into_iter().filter(|n| *n > rules::SHORT_WORD).count(),
        "no-repeats" => {
            // Each part of a hyphenated chain is a word of its own here.
            let mut seen = HashSet::new();
            let mut n = 0;
            for word in words_as_read(verse) {
                for part in word.split('-') {
                    if word_span(part) < rules::CONTENT {
                        continue;
                    }
                    if !seen.insert(part.to_string()) {
                        n += 1;
                    }
                }
            }
            n
        }
        "short-lines" => lines_of(verse).iter().filter(|l| line_length(l) > rules::SHORT_LINE).count(),
        _ => return None,
    };
    Some(n as u32)
}

/// Letters a Forbidden Letter curse can name (`FORBIDDEN_LETTERS.en`).
pub const FORBIDDEN_LETTERS: [&str; 6] = ["s", "t", "r", "n", "o", "i"];

/// Which curse each potion card casts (`POTION_CURSE`).
pub const POTION_CURSE: [(&str, &str); 9] = [
    ("PT-001", "no-repeats"),
    ("PT-002", "forbidden-letter"),
    ("PT-003", "short-lines"),
    ("PT-004", "short-words"),
    ("PT-005", "no-repeats"),
    ("PT-006", "forbidden-letter"),
    ("PT-007", "short-lines"),
    ("PT-008", "short-words"),
    ("PT-009", "forbidden-letter"),
];

// --- Power words (relics) ---

/// Craft earned for working in at least `POWER_WORDS_NEEDED` of a relic's words.
pub const POWER_WORD_BONUS: u32 = 6;
pub const POWER_WORDS_NEEDED: usize = 2;

/// Each relic's words (`RELIC_WORDS.en`).
pub const RELIC_WORDS: [(&str, [&str; 5]); 9] = [
    ("RL-001", ["skull", "jest", "grave", "laugh", "dust"]),
    ("RL-002", ["storm", "spell", "staff", "island", "drown"]),
    ("RL-003", ["dagger", "blood", "sleep", "vision", "hand"]),
    ("RL-004", ["ring", "vow", "night", "banished", "kiss"]),
    ("RL-005", ["gold", "choice", "mercy", "lead", "casket"]),
    ("RL-006", ["crown", "throne", "ambition", "witch", "king"]),
    ("RL-007", ["book", "tempest", "magic", "page", "drown"]),
    ("RL-008", ["tears", "truth", "daughter", "nothing", "heart"]),
    ("RL-009", ["mask", "dream", "fool", "play", "moon"]),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PowerWords {
    pub used: Vec<String>,
    pub met: bool,
}

/// Is a power word in the verse (`usesWord` for English)? English asks for the word itself;
/// a power phrase of several words must appear as written.
fn uses_word(power: &str, said: &[String]) -> bool {
    let want: Vec<String> = words_of(power).iter().map(|w| fold(w)).collect();
    match want.as_slice() {
        [] => false,
        [one] => said.contains(one),
        many => format!(" {} ", said.join(" ")).contains(&format!(" {} ", many.join(" "))),
    }
}

pub fn check_power_words(words: &[String], verse: &str) -> PowerWords {
    let said: Vec<String> = words_of(verse).iter().map(|w| fold(w)).collect();
    let used: Vec<String> = words.iter().filter(|w| uses_word(w, &said)).cloned().collect();
    let met = used.len() >= POWER_WORDS_NEEDED;
    PowerWords { used, met }
}

#[cfg(test)]
mod tests {
    use super::super::cards::{card_by_id, CHARACTER_NAMES};
    use super::*;

    fn lands(id: &str, verse: &str) -> bool {
        check_device(id, verse, &DeviceContext { opponent_verse: None, names: &CHARACTER_NAMES }).expect("device exists").met
    }

    fn words(id: &str, verse: &str) -> Vec<String> {
        check_device(id, verse, &DeviceContext { opponent_verse: None, names: &CHARACTER_NAMES }).expect("device exists").words
    }

    #[test]
    fn each_device_fires_on_a_verse_that_uses_it_and_stays_silent_otherwise() {
        let plain = "the sun is up above the quiet hills\nthe day is here";
        for (id, verse) in [
            ("question", "Is this a dagger which I see?"),
            ("exclaim", "O for a muse of fire!"),
            ("alliteration", "With blade, with bloody blameful blade"),
            ("repetition", "Tomorrow and tomorrow and tomorrow"),
            ("internal-rhyme", "The night is bright with borrowed light"),
            ("brevity", "Brief is best\nSay no more"),
            ("swell", "I rise\nI rise again and louder than before"),
            ("balance", "One two three\nFour five six"),
            ("ring", "Night falls on the tower\nAnd the tower falls into night"),
            ("grandeur", "Incarnadine the multitudinous seas"),
            ("monorhyme", "I take the stage\nI turn the page\nI feed my rage"),
            ("invocation", "Hear me, Hamlet"),
        ] {
            assert!(lands(id, verse), "{id} should land");
            assert!(!lands(id, plain), "{id} should not land on a plain verse");
        }
        assert_eq!(check_device("no-such-device", plain, &DeviceContext::default()), None);
    }

    #[test]
    fn a_device_names_the_words_that_landed_it() {
        assert_eq!(words("repetition", "Tomorrow and tomorrow and tomorrow"), ["tomorrow"]);
        assert_eq!(words("alliteration", "With blade, with bloody blameful blade"), ["blade", "bloody", "blameful"]);
        assert_eq!(words("internal-rhyme", "The night is bright with borrowed light"), ["night", "bright"]);
        assert_eq!(words("monorhyme", "I take the stage\nI turn the page\nI feed my rage"), ["stage", "page", "rage"]);
        assert_eq!(words("invocation", "Hear me, Mark Antony"), ["antony"]);
        assert_eq!(words("grandeur", "Incarnadine the multitudinous seas"), ["incarnadine", "multitudinous"]);
        assert!(words("question", "Is this a dagger which I see?").is_empty());
    }

    #[test]
    fn devices_are_not_landed_by_accident() {
        // Three "the"s alliterate nothing; punctuation alone asks nothing.
        assert!(!lands("alliteration", "The king and the queen and the fool"));
        assert!(!lands("question", "?"));
        assert!(!lands("exclaim", "!!!"));
        // A chain of hyphens is not a grand word, and the little words are not a drumbeat.
        assert!(!lands("grandeur", "o-o-o-o-o-o-o-o-o a-a-a-a-a-a-a-a-a"));
        assert!(!lands("repetition", "With this and with that and with those"));
        // An ordinary word that is part of a name calls on nobody; the name does.
        assert!(!lands("invocation", "A man and a king walk in"));
        assert!(!lands("invocation", "A nurse of my sorrow"));
        assert!(lands("invocation", "Come, the Nurse, and speak"));
        assert!(lands("invocation", "Hear me, Sonnet Man"));
        assert!(lands("invocation", "Mark Antony, lend me your ears"));
        assert!(lands("invocation", "O Antony"));
    }

    #[test]
    fn a_riposte_needs_a_long_word_of_the_opponents() {
        let ctx = |theirs| DeviceContext { opponent_verse: theirs, names: &[] };
        let met = |verse: &str, theirs| check_device("riposte", verse, &ctx(theirs)).map(|r| r.met);
        assert_eq!(met("Thy candle is out", Some("My candle burns")), Some(true));
        assert_eq!(check_device("riposte", "Thy candle is out", &ctx(Some("My candle burns"))).unwrap().words, ["candle"]);
        assert_eq!(met("Thy lamp is out", Some("My candle burns")), Some(false));
        assert_eq!(met("Thy candle is out", None), Some(false));
        assert_eq!(met("Thy candle is out", Some("")), Some(false));
        // A little word thrown back is no riposte.
        assert_eq!(met("Where there is nothing", Some("There where it was")), Some(false));
    }

    #[test]
    fn a_riposte_house_opens_with_an_outcry() {
        assert_eq!(device_in_play("Verona Court", true), "riposte");
        assert_eq!(device_in_play("Verona Court", false), "exclaim");
        assert_eq!(device_in_play("Underworld", false), "exclaim");
        assert_eq!(device_in_play("Danish Court", false), "question");
    }

    #[test]
    fn every_house_in_the_catalogue_has_a_device_that_exists() {
        for card in super::super::cards::CARDS.iter().filter(|c| c.is_character()) {
            assert!(HOUSE_DEVICE.iter().any(|(h, _)| *h == card.house), "{} has no device", card.house);
        }
        for (_, device) in HOUSE_DEVICE {
            assert!(DEVICE_IDS.contains(&device));
        }
    }

    #[test]
    fn a_signature_is_an_echo_not_a_quotation() {
        let hamlet = card_by_id("DC-001").expect("Hamlet");
        assert_eq!(signature_words(hamlet), ["question"]);
        assert!(check_signature(hamlet, "I put the question to thy rage"));
        assert!(check_signature(hamlet, "The question’s edge is mine"));
        assert!(!check_signature(hamlet, "To be, or not to be, that is the question"));
        assert!(!check_signature(hamlet, "Nothing of his line here"));
        // "maybe or not today" does not contain "be or not to".
        assert!(check_signature(hamlet, "Maybe or not today, that is my question"));
        // Viola's line ("I am not what I am") has no telling word: its longest two words, said
        // together in its order, are the echo.
        let viola = card_by_id("IL-001").expect("Viola");
        assert_eq!(signature_words(viola), ["not what"]);
        assert_eq!(signature_needed(viola), 1);
        assert!(!check_signature(viola, "What a day"));
        assert!(!check_signature(viola, "What thou seest is not the whole of me"));
        assert_eq!(check_signature_words(viola, "It is not what it seems"), Some(vec!["not".to_string(), "what".to_string()]));
    }

    #[test]
    fn curses_count_their_violations() {
        assert_eq!(curse_violations("forbidden-letter", "The sun sets slow", "s"), Some(3));
        // A Cyrillic or digit stand-in for the letter does not dodge the curse.
        assert_eq!(curse_violations("forbidden-letter", "The \u{455}un 5ets slow", "s"), Some(3));
        assert_eq!(curse_violations("short-words", "A magnificent morning", ""), Some(2));
        assert_eq!(curse_violations("short-words", "w0nd3rful", ""), Some(1));
        assert_eq!(curse_violations("no-repeats", "night after night after night", ""), Some(3));
        assert_eq!(curse_violations("no-repeats", "never-never", ""), Some(1));
        assert_eq!(curse_violations("short-lines", "one two three four five six\none two", ""), Some(1));
        assert_eq!(curse_violations("nope", "x", ""), None);
    }
}
