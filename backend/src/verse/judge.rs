//! The rule-based judge: comparing two verses by measurable features alone. A port of
//! `rulesJudge` in `src/lib/verse/judge.ts`. The model-based judge is not ported and never
//! will be: no language model takes part in multiplayer scoring.

use std::collections::HashSet;
use std::sync::LazyLock;

use serde::Serialize;

use super::cards::CARDS;
use super::text::{
    clean_verse, content_words, fold, last_word, letters, lines_of, rhymes, syllables_in_line, words_of,
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

/// Words that count as literary allusion: names and quotation words from the card
/// catalogue (`allusionLexicon` in referee.ts).
pub static LEXICON: LazyLock<HashSet<String>> = LazyLock::new(|| {
    let mut lexicon = HashSet::new();
    for card in CARDS.iter() {
        for w in words_of(&card.name) {
            if letters(&w) >= 4 {
                lexicon.insert(fold(&w));
            }
        }
        for w in content_words(&card.quote) {
            lexicon.insert(fold(&w));
        }
    }
    lexicon
});

// The arithmetic below is written in the same order as the TypeScript, operation for
// operation: both sides compute in IEEE 754 doubles, so the same order gives the same bits.

fn variety(verse: &str) -> f64 {
    let w: Vec<String> = words_of(verse).iter().map(|w| fold(w)).collect();
    if w.is_empty() {
        return 0.0;
    }
    let distinct = w.iter().collect::<HashSet<_>>().len();
    distinct as f64 / w.len() as f64 + w.len().min(30) as f64 / 60.0
}

fn sound_score(verse: &str, lang: &str) -> f64 {
    let ls = lines_of(verse);
    if ls.len() < 2 {
        return 0.0;
    }
    let mut rhymed = 0u32;
    for i in 0..ls.len() {
        for j in i + 1..ls.len() {
            if rhymes(&last_word(ls[i]), &last_word(ls[j])) {
                rhymed += 1;
            }
        }
    }
    let lens: Vec<f64> = ls
        .iter()
        .map(|l| syllables_in_line(l, lang).map(|n| n as usize).unwrap_or_else(|| words_of(l).len()) as f64)
        .collect();
    let n = lens.len() as f64;
    let mean = lens.iter().fold(0.0, |a, b| a + b) / n;
    let spread = (lens.iter().fold(0.0, |s, len| s + (len - mean) * (len - mean)) / n).sqrt();
    f64::from(rhymed) * 2.0 - spread / mean.max(1.0)
}

fn allusion_score(verse: &str, lexicon: &HashSet<String>) -> f64 {
    content_words(verse).iter().map(|w| fold(w)).filter(|w| lexicon.contains(w)).collect::<HashSet<_>>().len() as f64
}

fn wit_score(verse: &str, other: &str) -> f64 {
    let theirs: HashSet<String> = words_of(other).iter().filter(|w| letters(w) >= 5).map(|w| fold(w)).collect();
    let thrown = words_of(verse).iter().map(|w| fold(w)).filter(|w| theirs.contains(w)).collect::<HashSet<_>>().len();
    let marks = verse.chars().filter(|c| matches!(c, '?' | '!' | '？' | '！')).count();
    (thrown * 2 + marks.min(2)) as f64
}

/// The four criterion scores for each verse, before they are compared. Exposed so the
/// parity test and the audit trail can show why a criterion went the way it did.
pub fn rule_scores(player_verse: &str, opponent_verse: &str, lang: &str, lexicon: &HashSet<String>) -> [(f64, f64); 4] {
    let p = clean_verse(player_verse);
    let o = clean_verse(opponent_verse);
    [
        (variety(&p), variety(&o)),
        (allusion_score(&p, lexicon), allusion_score(&o, lexicon)),
        (sound_score(&p, lang), sound_score(&o, lang)),
        (wit_score(&p, &o), wit_score(&o, &p)),
    ]
}

/// Compare two verses by measurable features alone.
pub fn rules_judge(player_verse: &str, opponent_verse: &str, lang: &str, lexicon: &HashSet<String>) -> JudgeSplit {
    let scores = rule_scores(player_verse, opponent_verse, lang, lexicon);
    let each = JUDGE_POOL / CRITERIA.len() as u32;
    let mut criteria = [Verdict::Split; 4];
    let mut player = 0;
    for (i, (a, b)) in scores.into_iter().enumerate() {
        let verdict = if (a - b).abs() < 1e-9 {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pool_divides_into_whole_points() {
        // Points are integers here; the TypeScript's are too only while this holds.
        assert_eq!(JUDGE_POOL % (CRITERIA.len() as u32 * 2), 0);
    }

    #[test]
    fn judging_is_deterministic_sums_to_the_pool_and_mirrors() {
        let a = "Who dares to stand upon my stage?\nI put the question to thy rage";
        let b = "the sun is up";
        let ab = rules_judge(a, b, "en", &LEXICON);
        assert_eq!(ab, rules_judge(a, b, "en", &LEXICON));
        assert_eq!(ab.player + ab.opponent, JUDGE_POOL);
        assert!(ab.player > ab.opponent);
        let ba = rules_judge(b, a, "en", &LEXICON);
        assert_eq!((ab.player, ab.opponent), (ba.opponent, ba.player));
        let same = rules_judge(a, a, "en", &LEXICON);
        assert_eq!((same.player, same.opponent), (12, 12));
        assert_eq!(same.criteria, [Verdict::Split; 4]);
    }

    #[test]
    fn the_lexicon_holds_names_and_quotation_words() {
        assert!(LEXICON.contains("hamlet"));
        assert!(LEXICON.contains("question"));
        assert!(!LEXICON.contains("the"));
    }
}
