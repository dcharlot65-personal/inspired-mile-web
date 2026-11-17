//! The rule-based judge: comparing two verses by measurable features alone. A port of
//! `rulesJudge` in `src/lib/verse/judge.ts`. The model-based judge is not ported and never
//! will be: no language model takes part in multiplayer scoring.

use std::collections::HashSet;
use std::sync::LazyLock;

use serde::Serialize;

use super::cards::{CARDS, CHARACTER_NAMES};
use super::devices::signature_words;
use super::text::{
    clean_verse, first_unit, fold, is_content_word, is_stop_word, letter_count, line_length, lines_of, rhyme_ends, rhymes, rules, substance,
    syllables_in_line, telling_words, word_span, words_of, STOP_WORDS,
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
            // A signature phrase (Viola's "not what") is not a word.
            if !w.contains(' ') && letter_count(&w) >= 4 && !STOP_WORDS.contains(w.as_str()) {
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

/// Most different telling words wordplay counts: past this a verse is long, not varied.
const MAX_VARIETY: usize = 30;

/// Wordplay: how many different telling words (`text::telling_words`), in the first `lines`
/// lines of the verse: the two verses are compared over as many lines as both have, so a line
/// added past the other verse's length adds nothing (`variety`). Only how many: a share of the
/// verse's words rewarded stuffing, and words strung with nothing between them won it outright.
fn variety(verse: &str, lines: usize) -> f64 {
    let first: Vec<&str> = lines_of(verse).into_iter().take(lines).collect();
    telling_words(&first.join("\n")).len().min(MAX_VARIETY) as f64
}

/// Below anything a verse of two lines or more can score: one line has no flow to judge.
const NO_FLOW: f64 = -10.0;

/// Flow: rhymes between line ends; lines that open on the line before's first word, a word that
/// carries meaning (anaphora); three lines or more, each longer than the one before (momentum);
/// and lines of even length (`soundScore`).
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
    // Anaphora: a line that opens on the line before's first word, a word that carries meaning.
    let opening = (1..ls.len())
        .filter(|&i| {
            let first = first_unit(ls[i]);
            !first.is_empty() && first == first_unit(ls[i - 1]) && is_content_word(&first)
        })
        .count();
    let lens: Vec<f64> = ls
        .iter()
        .map(|l| syllables_in_line(l, lang).map(|n| n as usize).unwrap_or_else(|| line_length(l)) as f64)
        .collect();
    let growing = if lens.len() >= 3 && lens.windows(2).all(|w| w[1] > w[0]) { 1.0 } else { 0.0 };
    let n = lens.len() as f64;
    let mean = lens.iter().fold(0.0, |a, b| a + b) / n;
    let spread = (lens.iter().fold(0.0, |s, len| s + (len - mean) * (len - mean)) / n).sqrt();
    (NO_FLOW + 1.0).max(f64::from(rhymed) * 2.0 + opening as f64 + growing - spread / mean.max(1.0))
}

/// Allusion: names and telling words from the plays. The verse is read for them as written.
fn allusion_score(verse: &str, lexicon: &HashSet<String>) -> f64 {
    words_of(verse).iter().map(|w| fold(w)).filter(|w| lexicon.contains(w)).collect::<HashSet<_>>().len() as f64
}

/// Most words thrown back that count: past this it is repetition, not wit.
const MAX_THROWN: usize = 3;

/// Wit: a comeback. Telling words, long enough, taken from the verse being answered.
/// Punctuation counts for nothing: an "!" at the end of a line decided wit whenever no words
/// were thrown, which is every first round.
fn wit_score(verse: &str, answered: &str) -> f64 {
    let theirs: HashSet<String> =
        words_of(answered).iter().filter(|w| word_span(w) >= rules::RIPOSTE && !is_stop_word(w)).map(|w| fold(w)).collect();
    let thrown = words_of(verse).iter().map(|w| fold(w)).filter(|w| theirs.contains(w)).collect::<HashSet<_>>().len();
    thrown.min(MAX_THROWN) as f64
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

/// The four criterion scores for each verse, before they are compared. `answered` is the
/// pair of verses each side's comeback is read against, when both sides answered one; with
/// none, wit is level (a split): neither side could do the thing it measures.
fn scores(p: &str, o: &str, lang: &str, lexicon: &HashSet<String>, answered: Option<(&str, &str)>) -> [(f64, f64); 4] {
    // Line for line: a verse is not richer for running past the other's length.
    let shared = lines_of(p).len().min(lines_of(o).len());
    [
        (variety(p, shared), variety(o, shared)),
        (allusion_score(p, lexicon), allusion_score(o, lexicon)),
        (sound_score(p, lang), sound_score(o, lang)),
        match answered {
            Some((by_p, by_o)) => (wit_score(p, by_p), wit_score(o, by_o)),
            None => (0.0, 0.0),
        },
    ]
}

/// Compare two verses by measurable features alone (`rulesJudge`), as the single-player
/// duel does. The player answers the opponent's verse of this round; `previous_player_verse`
/// is given when the opponent's verse answers the player's verse of the round before (a
/// model wrote it to), and only then are the comebacks of both compared. An empty previous
/// verse is still one that was given (`!== undefined`).
pub fn rules_judge(
    player_verse: &str,
    opponent_verse: &str,
    lang: &str,
    lexicon: &HashSet<String>,
    previous_player_verse: Option<&str>,
) -> JudgeSplit {
    let p = clean_verse(player_verse);
    let o = clean_verse(opponent_verse);
    let before = previous_player_verse.map(clean_verse);
    let answered = before.as_deref().map(|b| (o.as_str(), b));
    decide(scores(&p, &o, lang, lexicon, answered), (substance(&p).ok, substance(&o).ok))
}

/// The same comparison for an online round, where both verses are written at once and
/// neither side has seen the other's: each side's comeback is read against the other
/// side's verse of the round before (`onlineJudge` in multiplayer-rules.ts). Comebacks are
/// compared only when both sides had a verse to answer (from the second round on, unless
/// one side's verse of the round before was empty); otherwise wit is a split.
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
    let before = match (previous_b.filter(|v| !v.is_empty()), previous_a.filter(|v| !v.is_empty())) {
        (Some(pb), Some(pa)) => Some((clean_verse(pb), clean_verse(pa))),
        _ => None,
    };
    let answered = before.as_ref().map(|(pb, pa)| (pb.as_str(), pa.as_str()));
    decide(scores(&a, &b, lang, lexicon, answered), (substance(&a).ok, substance(&b).ok))
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
    fn wit_is_a_word_thrown_back_and_punctuation_counts_for_nothing() {
        assert_eq!(wit_score("Thy candle gutters", "My candle burns"), 1.0);
        assert_eq!(wit_score("Thy candle gutters", ""), 0.0);
        assert_eq!(wit_score("What is this?\nWhat now!\nAgain, why?", ""), 0.0);
        // Little words thrown back are not wit.
        assert_eq!(wit_score("There where it was", "Where there is nothing"), 0.0);
        // With nothing answered on either side, wit is a split, however pointed a verse is.
        let pointed = "What is this tower?\nWho dares the night!";
        let plain = "The tower stands tonight\nThe night is long and bright";
        assert_eq!(rules_judge(pointed, plain, "en", &LEXICON, None).criteria[3], Verdict::Split);
        assert_eq!(online_judge(pointed, plain, "en", &LEXICON, Some("A candle"), None).criteria[3], Verdict::Split);
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
