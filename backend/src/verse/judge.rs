//! The rule-based judge: comparing two verses by measurable features alone. A port of
//! `rulesJudge` in `src/lib/verse/judge.ts`. The model-based judge is not ported and never
//! will be: no language model takes part in multiplayer scoring.

use std::collections::HashSet;
use std::sync::LazyLock;

use serde::Serialize;

use super::cards::{CARDS, CHARACTER_NAMES};
use super::devices::{signature_words, POINTED_END};
use super::text::{
    clean_verse, fold, is_stop_word, letter_count, line_length, lines_of, rhyme_ends, rhymes, rules, substance,
    syllables_in_line, word_parts, word_span, words_of, STOP_WORDS,
};

/// Points the judge shares between the two verses each round.
pub const JUDGE_POOL: u32 = 24;

pub const CRITERIA: [&str; 4] = ["wordplay", "allusion", "flow", "wit"];

/// Who took a criterion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Player,
    Opponent,
    Split,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JudgeSplit {
    /// Points out of `JUDGE_POOL` for the player and for the opponent.
    pub player: u32,
    pub opponent: u32,
    /// One verdict per criterion, in the order of `CRITERIA`.
    pub criteria: [Verdict; 4],
}

impl JudgeSplit {
    /// The split when one verse is a copy: every criterion goes to the other side.
    pub fn forfeit_to(to: Verdict) -> Self {
        Self {
            player: if to == Verdict::Player { JUDGE_POOL } else { 0 },
            opponent: if to == Verdict::Opponent { JUDGE_POOL } else { 0 },
            criteria: [to; 4],
        }
    }
}

/// Words that count as literary allusion (`allusionLexicon` in referee.ts): the names a
/// character is called by, and the telling words of every card's line.
pub static LEXICON: LazyLock<HashSet<String>> = LazyLock::new(|| {
    let mut lexicon = HashSet::new();
    for name in CHARACTER_NAMES.iter() {
        if !name.contains(' ') && letter_count(name) >= 4 {
            lexicon.insert(fold(name));
        }
    }
    for card in CARDS.iter() {
        for w in signature_words(card) {
            if letter_count(&w) >= 4 && !STOP_WORDS.contains(w.as_str()) {
                lexicon.insert(w);
            }
        }
    }
    lexicon
});

// Each criterion is a measurement a verse cannot raise without doing the thing measured.
// Filler words, bare punctuation and one-word verses earn nothing.
//
// The arithmetic below is written in the same order as the TypeScript, operation for
// operation: both sides compute in IEEE 754 doubles, so the same order gives the same bits.

/// Wordplay: how many different words that carry meaning, for the verse's length.
fn variety(verse: &str) -> f64 {
    let all: Vec<String> = word_parts(verse).iter().map(|w| fold(w)).collect();
    if all.is_empty() {
        return 0.0;
    }
    let telling = all.iter().filter(|w| letter_count(w) > 0 && !is_stop_word(w)).collect::<HashSet<_>>().len();
    telling as f64 / all.len() as f64 + telling.min(30) as f64 / 60.0
}

/// Below anything a verse of two lines or more can score: one line has no flow to judge.
const NO_FLOW: f64 = -10.0;

/// Flow: rhymes between line ends, and lines of even length.
fn sound_score(verse: &str, lang: &str) -> f64 {
    let ls = lines_of(verse);
    if ls.len() < 2 {
        return NO_FLOW;
    }
    let mut rhymed = 0u32;
    for i in 0..ls.len() {
        for j in i + 1..ls.len() {
            let (a, b) = rhyme_ends(ls[i], ls[j]);
            if rhymes(&a, &b) {
                rhymed += 1;
            }
        }
    }
    let lens: Vec<f64> = ls
        .iter()
        .map(|l| syllables_in_line(l, lang).map(|n| n as usize).unwrap_or_else(|| line_length(l)) as f64)
        .collect();
    let n = lens.len() as f64;
    let mean = lens.iter().fold(0.0, |a, b| a + b) / n;
    let spread = (lens.iter().fold(0.0, |s, len| s + (len - mean) * (len - mean)) / n).sqrt();
    (NO_FLOW + 1.0).max(f64::from(rhymed) * 2.0 - spread / mean.max(1.0))
}

/// Allusion: names and telling words from the plays. The verse is read for them as written.
fn allusion_score(verse: &str, lexicon: &HashSet<String>) -> f64 {
    words_of(verse).iter().map(|w| fold(w)).filter(|w| lexicon.contains(w)).collect::<HashSet<_>>().len() as f64
}

/// Most words thrown back that count: past this it is repetition, not wit.
const MAX_THROWN: usize = 3;

/// Wit: a comeback. Telling words, long enough, taken from the verse being answered
/// (`answered`: nothing for a verse that opens). A line that ends in a question or an
/// outcry breaks a tie and no more.
fn wit_score(verse: &str, answered: Option<&str>) -> f64 {
    let theirs: HashSet<String> = words_of(answered.unwrap_or(""))
        .iter()
        .filter(|w| word_span(w) >= rules::RIPOSTE && !is_stop_word(w))
        .map(|w| fold(w))
        .collect();
    let thrown = words_of(verse).iter().map(|w| fold(w)).filter(|w| theirs.contains(w)).collect::<HashSet<_>>().len();
    let pointed = lines_of(verse).iter().filter(|l| POINTED_END.is_match(l) && line_length(l) >= 2).count();
    thrown.min(MAX_THROWN) as f64 + pointed.min(2) as f64 * 0.1
}

/// Turn the four pairs of scores into a split. Text too thin to be a verse
/// (`text::substance`) loses every criterion to a real one.
fn decide(scores: [(f64, f64); 4], real: (bool, bool)) -> JudgeSplit {
    let each = JUDGE_POOL / CRITERIA.len() as u32;
    let mut criteria = [Verdict::Split; 4];
    let mut player = 0;
    for (i, (a, b)) in scores.into_iter().enumerate() {
        let verdict = if real.0 != real.1 {
            if real.0 { Verdict::Player } else { Verdict::Opponent }
        } else if (a - b).abs() < 1e-9 {
            Verdict::Split
        } else if a > b {
            Verdict::Player
        } else {
            Verdict::Opponent
        };
        criteria[i] = verdict;
        player += match verdict {
            Verdict::Player => each,
            Verdict::Split => each / 2,
            Verdict::Opponent => 0,
        };
    }
    JudgeSplit { player, opponent: JUDGE_POOL - player, criteria }
}

/// The four criterion scores for each verse, before they are compared. `answered_by_player`
/// and `answered_by_opponent` are the verses each side's comeback is read against.
fn scores(p: &str, o: &str, lang: &str, lexicon: &HashSet<String>, answered: (Option<&str>, Option<&str>)) -> [(f64, f64); 4] {
    [
        (variety(p), variety(o)),
        (allusion_score(p, lexicon), allusion_score(o, lexicon)),
        (sound_score(p, lang), sound_score(o, lang)),
        (wit_score(p, answered.0), wit_score(o, answered.1)),
    ]
}

/// A previous verse as the judge reads it: cleaned, and nothing if there is none.
fn earlier(verse: Option<&str>) -> Option<String> {
    verse.filter(|v| !v.is_empty()).map(clean_verse)
}

/// Compare two verses by measurable features alone (`rulesJudge`), as the single-player
/// duel does: the player answers the opponent's verse of this round; the opponent answers
/// `previous_player_verse`, the player's verse of the round before.
pub fn rules_judge(
    player_verse: &str,
    opponent_verse: &str,
    lang: &str,
    lexicon: &HashSet<String>,
    previous_player_verse: Option<&str>,
) -> JudgeSplit {
    let p = clean_verse(player_verse);
    let o = clean_verse(opponent_verse);
    let before = earlier(previous_player_verse);
    decide(scores(&p, &o, lang, lexicon, (Some(&o), before.as_deref())), (substance(&p).ok, substance(&o).ok))
}

/// The same comparison for an online round, where both verses are written at once and
/// neither side has seen the other's: each side's comeback is read against the other
/// side's verse of the round before (`onlineJudge` in multiplayer-rules.ts).
pub fn online_judge(
    verse_a: &str,
    verse_b: &str,
    lang: &str,
    lexicon: &HashSet<String>,
    previous_b: Option<&str>,
    previous_a: Option<&str>,
) -> JudgeSplit {
    let a = clean_verse(verse_a);
    let b = clean_verse(verse_b);
    let (before_b, before_a) = (earlier(previous_b), earlier(previous_a));
    decide(scores(&a, &b, lang, lexicon, (before_b.as_deref(), before_a.as_deref())), (substance(&a).ok, substance(&b).ok))
}

#[cfg(test)]
mod tests {
    use super::*;

    const GOOD: &str = "Who dares to stand upon my stage?\nI put the question to thy rage";

    #[test]
    fn the_pool_divides_into_whole_points() {
        // Points are integers here; the TypeScript's are too only while this holds.
        assert_eq!(JUDGE_POOL % (CRITERIA.len() as u32 * 2), 0);
    }

    #[test]
    fn judging_is_deterministic_and_sums_to_the_pool() {
        let b = "The sun is up above the hills\nThe day is here and I am glad";
        let ab = rules_judge(GOOD, b, "en", &LEXICON, None);
        assert_eq!(ab, rules_judge(GOOD, b, "en", &LEXICON, None));
        assert_eq!(ab.player + ab.opponent, JUDGE_POOL);
        assert!(ab.player > ab.opponent);
        let same = online_judge(GOOD, GOOD, "en", &LEXICON, None, None);
        assert_eq!((same.player, same.opponent), (12, 12));
        assert_eq!(same.criteria, [Verdict::Split; 4]);
    }

    #[test]
    fn an_online_round_is_judged_the_same_from_either_seat() {
        let b = "Thy stage is but a candle in the wind!\nI snuff it out";
        for (prev_b, prev_a) in [(None, None), (Some("A candle now"), Some("My stage, my question")), (Some(GOOD), None)] {
            let ab = online_judge(GOOD, b, "en", &LEXICON, prev_b, prev_a);
            let ba = online_judge(b, GOOD, "en", &LEXICON, prev_a, prev_b);
            assert_eq!((ab.player, ab.opponent), (ba.opponent, ba.player));
        }
    }

    #[test]
    fn something_too_thin_to_be_a_verse_loses_every_criterion_to_a_real_one() {
        for thin in ["?", "word", "Never\nNever\nNever", ""] {
            let j = rules_judge(thin, GOOD, "en", &LEXICON, None);
            assert_eq!((j.player, j.criteria), (0, [Verdict::Opponent; 4]), "{thin:?}");
        }
        // Two thin texts are judged on what little they have; neither is handed the round.
        let j = rules_judge("?", "!", "en", &LEXICON, None);
        assert_eq!(j.player + j.opponent, JUDGE_POOL);
    }

    #[test]
    fn wit_is_a_word_thrown_back_and_punctuation_only_breaks_a_tie() {
        assert_eq!(wit_score("Thy candle gutters", Some("My candle burns")), 1.0);
        assert_eq!(wit_score("Thy candle gutters", None), 0.0);
        assert_eq!(wit_score("What is this?\nWhat now!\nAgain, why?", None), 0.2);
        assert_eq!(wit_score("?\n!", None), 0.0);
        // Little words thrown back are not wit.
        assert_eq!(wit_score("There where it was", Some("Where there is nothing")), 0.0);
    }

    #[test]
    fn the_lexicon_holds_names_and_telling_words() {
        for word in ["hamlet", "question", "macbeth", "antony"] {
            assert!(LEXICON.contains(word), "{word}");
        }
        for word in ["the", "that", "with", "have", "king", "nurse", "sonnet"] {
            assert!(!LEXICON.contains(word), "{word}");
        }
    }
}
