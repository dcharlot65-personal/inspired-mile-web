//! Devices, the signature echo, curses and power words: what the cards do. A port of
//! `src/lib/verse/devices.ts`. All of it is checked by code, so the same verse always
//! scores the same.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;

use super::cards::Card;
use super::text::{
    bare_letters, content_words, first_word, fold, initial, last_word, letters, lines_of, rhymes, words_of,
};

/// What a device check may look at besides the verse.
#[derive(Debug, Clone, Copy, Default)]
pub struct DeviceContext<'a> {
    /// The opponent's most recent verse, for the riposte.
    pub opponent_verse: Option<&'a str>,
    /// Names that count as an invocation.
    pub names: &'a [String],
}

/// Every device id, in the order of `DEVICES` in devices.ts.
pub const DEVICE_IDS: [&str; 13] = [
    "question", "exclaim", "alliteration", "repetition", "internal-rhyme", "riposte", "brevity", "swell", "balance",
    "ring", "invocation", "grandeur", "monorhyme",
];

// JavaScript's \s, spelled out: Rust's \s is a different set (see text::is_js_space).
const JS_SPACE: &str = r"[\t\n\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]";

static QUESTION_END: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r#"[?？؟]{JS_SPACE}*["'”’)]*$"#)).expect("question pattern"));
static EXCLAIM_END: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r#"[!！]{JS_SPACE}*["'”’)]*$"#)).expect("exclaim pattern"));

fn word_counts(verse: &str) -> Vec<usize> {
    lines_of(verse).iter().map(|l| words_of(l).len()).collect()
}

/// Whether a verse lands a device. `None` for a device id that does not exist.
pub fn check_device(id: &str, verse: &str, ctx: &DeviceContext) -> Option<bool> {
    let met = match id {
        "question" => lines_of(verse).iter().any(|l| QUESTION_END.is_match(l)),
        "exclaim" => lines_of(verse).iter().any(|l| EXCLAIM_END.is_match(l)),
        "alliteration" => lines_of(verse).iter().any(|line| {
            let mut counts: HashMap<String, usize> = HashMap::new();
            for w in words_of(line) {
                if letters(&w) < 3 {
                    continue;
                }
                *counts.entry(initial(&w)).or_default() += 1;
            }
            counts.values().any(|n| *n >= 3)
        }),
        "repetition" => {
            let mut counts: HashMap<String, usize> = HashMap::new();
            for w in content_words(verse) {
                *counts.entry(fold(&w)).or_default() += 1;
            }
            counts.values().any(|n| *n >= 3)
        }
        "internal-rhyme" => lines_of(verse).iter().any(|line| {
            let ws: Vec<String> = words_of(line).into_iter().filter(|w| letters(w) >= 3).collect();
            (0..ws.len()).any(|i| (i + 1..ws.len()).any(|j| rhymes(&ws[i], &ws[j])))
        }),
        "riposte" => match ctx.opponent_verse {
            // An empty opponent verse is no verse to answer, as in JavaScript.
            None | Some("") => false,
            Some(theirs) => {
                let theirs: HashSet<String> =
                    words_of(theirs).iter().filter(|w| letters(w) >= 5).map(|w| fold(w)).collect();
                // `!!hit`: a word that folds to nothing is not a hit even if it is "found".
                words_of(verse).iter().map(|w| fold(w)).find(|w| theirs.contains(w)).is_some_and(|w| !w.is_empty())
            }
        },
        "brevity" => {
            let counts = word_counts(verse);
            let longest = counts.iter().copied().max().unwrap_or(0);
            !counts.is_empty() && longest <= 6 && longest > 0
        }
        "swell" => {
            let counts = word_counts(verse);
            match counts.split_last() {
                Some((last, rest)) if !rest.is_empty() => rest.iter().all(|c| c < last),
                _ => false,
            }
        }
        "balance" => {
            let counts = word_counts(verse);
            counts.len() >= 2 && counts.iter().all(|c| *c == counts[0] && *c > 0)
        }
        "ring" => {
            let ls = lines_of(verse);
            match (ls.first(), ls.last()) {
                (Some(first), Some(last)) => {
                    let a = fold(&first_word(first));
                    let b = fold(&last_word(last));
                    !a.is_empty() && a == b && words_of(verse).len() > 2
                }
                _ => false,
            }
        }
        "invocation" => {
            let said: HashSet<String> = words_of(verse).iter().map(|w| fold(w)).collect();
            // `!!hit`: an empty name is never a hit.
            ctx.names.iter().find(|n| said.contains(&fold(n))).is_some_and(|n| !n.is_empty())
        }
        "grandeur" => {
            let big: HashSet<String> = words_of(verse).into_iter().filter(|w| bare_letters(w) >= 9).collect();
            big.len() >= 2
        }
        "monorhyme" => {
            let ends: Vec<String> = lines_of(verse).iter().map(|l| last_word(l)).collect();
            ends.len() >= 2 && ends.iter().skip(1).all(|w| rhymes(&ends[0], w))
        }
        _ => return None,
    };
    Some(met)
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

// --- Signature: echo the card's famous line without quoting it ---

/// Words too common to count as an echo of a quotation.
const COMMON: &str = "that this with from have what when where which thou thee thy your their there these those shall will would should could been were upon into then than them they more most some such very much come here hath doth lord";

static COMMON_WORDS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| COMMON.split(' ').collect());

pub fn signature_words(card: &Card) -> Vec<String> {
    let mut seen = HashSet::new();
    content_words(&card.quote)
        .iter()
        .map(|w| fold(w))
        .filter(|w| !COMMON_WORDS.contains(w.as_str()))
        .filter(|w| seen.insert(w.clone()))
        .collect()
}

/// The signature lands when the verse uses a telling word from the card's line but does
/// not simply recite it: four words running from the quote is a quotation.
pub fn check_signature(card: &Card, verse: &str) -> bool {
    let sig = signature_words(card);
    if sig.is_empty() {
        return false;
    }
    let said: Vec<String> = words_of(verse).iter().map(|w| fold(w)).collect();
    if !sig.iter().any(|w| said.contains(w)) {
        return false;
    }
    let quote: Vec<String> = words_of(&card.quote).iter().map(|w| fold(w)).collect();
    // The TypeScript looks for the run in the joined text, so it can begin or end inside a word.
    let spoken = said.join(" ");
    !quote.windows(4).any(|run| spoken.contains(&run.join(" ")))
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
            let letter = fold(param);
            words_of(verse).iter().filter(|w| fold(w).contains(&letter)).count()
        }
        "short-words" => words_of(verse).iter().filter(|w| bare_letters(w) > 6).count(),
        "no-repeats" => {
            let mut seen = HashSet::new();
            content_words(verse).iter().map(|w| fold(w)).filter(|w| !seen.insert(w.clone())).count()
        }
        "short-lines" => lines_of(verse).iter().filter(|l| words_of(l).len() > 5).count(),
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

pub fn check_power_words(words: &[String], verse: &str) -> PowerWords {
    let said: HashSet<String> = words_of(verse).iter().map(|w| fold(w)).collect();
    let used: Vec<String> = words.iter().filter(|w| said.contains(&fold(w))).cloned().collect();
    let met = used.len() >= POWER_WORDS_NEEDED;
    PowerWords { used, met }
}

#[cfg(test)]
mod tests {
    use super::super::cards::{card_by_id, CHARACTER_NAMES};
    use super::*;

    fn lands(id: &str, verse: &str) -> bool {
        check_device(id, verse, &DeviceContext { opponent_verse: None, names: &CHARACTER_NAMES }).expect("device exists")
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
    fn a_riposte_needs_a_long_word_of_the_opponents() {
        let ctx = |theirs| DeviceContext { opponent_verse: theirs, names: &[] };
        assert_eq!(check_device("riposte", "Thy candle is out", &ctx(Some("My candle burns"))), Some(true));
        assert_eq!(check_device("riposte", "Thy lamp is out", &ctx(Some("My candle burns"))), Some(false));
        assert_eq!(check_device("riposte", "Thy candle is out", &ctx(None)), Some(false));
        assert_eq!(check_device("riposte", "Thy candle is out", &ctx(Some(""))), Some(false));
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
        assert!(check_signature(hamlet, "I put the question to thy rage"));
        assert!(!check_signature(hamlet, "To be, or not to be, that is the question"));
        assert!(!check_signature(hamlet, "Nothing of his line here"));
    }

    #[test]
    fn curses_count_their_violations() {
        assert_eq!(curse_violations("forbidden-letter", "The sun sets slow", "s"), Some(3));
        assert_eq!(curse_violations("short-words", "A magnificent morning", ""), Some(2));
        assert_eq!(curse_violations("no-repeats", "night after night after night", ""), Some(3));
        assert_eq!(curse_violations("short-lines", "one two three four five six\none two", ""), Some(1));
        assert_eq!(curse_violations("nope", "x", ""), None);
    }
}
