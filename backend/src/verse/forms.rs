//! Verse forms: what a verse must do in a round, checked by code. A port of
//! `src/lib/verse/forms.ts`.

use std::sync::LazyLock;

use serde::Serialize;

use super::text::{first_word, initial, last_word, lines_of, rhymes, syllables_in_line, words_of};

pub const FORM_POINTS: u32 = 20;

/// What a requirement asks of the lines.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Rule {
    /// Exactly this many lines.
    Lines(usize),
    /// As many lines as the acrostic word has letters.
    AcrosticLines,
    /// The last words of two lines rhyme (indexes from zero).
    RhymePair(usize, usize),
    /// A line has `target` syllables, give or take `tolerance`.
    Syllables { index: usize, target: i64, tolerance: i64 },
    /// Every line opens with the same word.
    SameOpening,
    /// The first letters of the lines spell the acrostic word.
    Spells,
    /// Each line has more words than the one before.
    Growing,
}

#[derive(Debug, Clone)]
pub struct Requirement {
    pub id: String,
    pub points: u32,
    rule: Rule,
}

#[derive(Debug, Clone)]
pub struct Form {
    pub id: &'static str,
    /// Needs syllable counting, so only offered where syllables can be counted.
    pub needs_syllables: bool,
    pub requirements: Vec<Requirement>,
}

fn lines(n: usize, points: u32) -> Requirement {
    Requirement { id: "lines".into(), points, rule: Rule::Lines(n) }
}

fn rhyme_pair(a: usize, b: usize, points: u32) -> Requirement {
    Requirement { id: format!("rhyme-{}-{}", a + 1, b + 1), points, rule: Rule::RhymePair(a, b) }
}

fn syllables(index: usize, target: i64, tolerance: i64, points: u32) -> Requirement {
    Requirement { id: format!("syllables-{}", index + 1), points, rule: Rule::Syllables { index, target, tolerance } }
}

fn named(id: &str, points: u32, rule: Rule) -> Requirement {
    Requirement { id: id.into(), points, rule }
}

/// Every form, in the order of `FORMS` in forms.ts. The order matters: a match's forms
/// are drawn by shuffling this list.
pub static FORMS: LazyLock<Vec<Form>> = LazyLock::new(|| {
    vec![
        Form { id: "couplet", needs_syllables: false, requirements: vec![lines(2, 6), rhyme_pair(0, 1, 14)] },
        Form {
            id: "quatrain-aabb",
            needs_syllables: false,
            requirements: vec![lines(4, 6), rhyme_pair(0, 1, 7), rhyme_pair(2, 3, 7)],
        },
        Form {
            id: "quatrain-abab",
            needs_syllables: false,
            requirements: vec![lines(4, 6), rhyme_pair(0, 2, 7), rhyme_pair(1, 3, 7)],
        },
        Form { id: "tercet", needs_syllables: false, requirements: vec![lines(3, 6), rhyme_pair(0, 2, 14)] },
        Form {
            id: "anaphora",
            needs_syllables: false,
            requirements: vec![lines(3, 6), named("same-opening", 14, Rule::SameOpening)],
        },
        Form {
            id: "acrostic",
            needs_syllables: false,
            requirements: vec![named("lines", 6, Rule::AcrosticLines), named("spells", 14, Rule::Spells)],
        },
        Form {
            id: "crescendo",
            needs_syllables: false,
            requirements: vec![lines(3, 6), named("growing", 14, Rule::Growing)],
        },
        Form {
            id: "haiku",
            needs_syllables: true,
            requirements: vec![lines(3, 5), syllables(0, 5, 0, 5), syllables(1, 7, 0, 5), syllables(2, 5, 0, 5)],
        },
        Form {
            id: "heroic-couplet",
            needs_syllables: true,
            requirements: vec![lines(2, 4), rhyme_pair(0, 1, 8), syllables(0, 10, 1, 4), syllables(1, 10, 1, 4)],
        },
    ]
});

/// Words an acrostic can be asked to spell (`ACROSTIC_WORDS.en`).
pub const ACROSTIC_WORDS: [&str; 8] = ["bard", "moon", "king", "rose", "fate", "wit", "play", "star"];

pub fn get_form(id: &str) -> Option<&'static Form> {
    FORMS.iter().find(|f| f.id == id)
}

/// Forms that can be played in English: all of them, since English syllables can be counted.
pub fn forms_for_english() -> Vec<&'static Form> {
    FORMS.iter().collect()
}

/// What a form's requirements are checked against.
#[derive(Debug, Clone, Copy)]
pub struct FormContext<'a> {
    pub lang: &'a str,
    /// Word an acrostic must spell, when the form needs one.
    pub acrostic: Option<&'a str>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CheckResult {
    pub id: String,
    pub points: u32,
    pub earned: u32,
    pub met: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FormScore {
    pub form_id: String,
    pub checks: Vec<CheckResult>,
    pub earned: u32,
    /// Every requirement met.
    pub kept: bool,
}

fn check(rule: &Rule, lines: &[&str], ctx: &FormContext) -> bool {
    let acrostic = ctx.acrostic.unwrap_or("");
    match rule {
        Rule::Lines(n) => lines.len() == *n,
        Rule::AcrosticLines => lines.len() == acrostic.chars().count(),
        Rule::RhymePair(a, b) => {
            lines.len() > *a.max(b) && rhymes(&last_word(lines[*a]), &last_word(lines[*b]))
        }
        Rule::Syllables { index, target, tolerance } => {
            if lines.len() <= *index {
                return false;
            }
            match syllables_in_line(lines[*index], ctx.lang) {
                Some(n) => (i64::from(n) - target).abs() <= *tolerance,
                None => false,
            }
        }
        Rule::SameOpening => {
            let firsts: Vec<String> = lines.iter().map(|l| first_word(l)).collect();
            lines.len() >= 2 && firsts.iter().all(|w| !w.is_empty() && *w == firsts[0])
        }
        Rule::Spells => {
            // initial() of a single character: its first letter once folded.
            let want: String = acrostic.chars().map(|c| initial(&c.to_string())).collect();
            let got: String = lines.iter().map(|l| initial(&first_word(l))).collect();
            !want.is_empty() && got == want
        }
        Rule::Growing => {
            let counts: Vec<usize> = lines.iter().map(|l| words_of(l).len()).collect();
            counts.len() >= 2 && counts.windows(2).all(|w| w[1] > w[0])
        }
    }
}

pub fn score_form(form: &Form, verse: &str, ctx: &FormContext) -> FormScore {
    let lines = lines_of(verse);
    let checks: Vec<CheckResult> = form
        .requirements
        .iter()
        .map(|r| {
            let met = !lines.is_empty() && check(&r.rule, &lines, ctx);
            CheckResult { id: r.id.clone(), points: r.points, earned: if met { r.points } else { 0 }, met }
        })
        .collect();
    let earned = checks.iter().map(|c| c.earned).sum();
    let kept = checks.iter().all(|c| c.met);
    FormScore { form_id: form.id.to_string(), checks, earned, kept }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EN: FormContext = FormContext { lang: "en", acrostic: None };

    fn form(id: &str) -> &'static Form {
        get_form(id).expect("form exists")
    }

    #[test]
    fn every_form_is_worth_the_same_full_score() {
        for f in FORMS.iter() {
            assert_eq!(f.requirements.iter().map(|r| r.points).sum::<u32>(), FORM_POINTS, "{}", f.id);
        }
    }

    #[test]
    fn a_kept_couplet_scores_in_full_and_a_broken_one_in_part() {
        let f = form("couplet");
        let kept = score_form(f, "I stand upon the midnight stage\nAnd answer all thy empty rage", &EN);
        assert_eq!((kept.earned, kept.kept), (20, true));
        let broken = score_form(f, "I stand upon the midnight stage\nAnd answer thee with silence", &EN);
        assert_eq!((broken.earned, broken.kept), (6, false));
        assert_eq!(score_form(f, "One line only", &EN).earned, 0);
        assert_eq!(score_form(f, "", &EN).earned, 0);
    }

    #[test]
    fn rhyme_schemes_are_checked_by_position() {
        let abab = "The moon is bright\nUpon the sea\nIt fills the night\nAnd calls to me";
        assert!(score_form(form("quatrain-abab"), abab, &EN).kept);
        assert!(!score_form(form("quatrain-aabb"), abab, &EN).kept);
    }

    #[test]
    fn an_acrostic_is_checked_against_its_word() {
        let ctx = FormContext { lang: "en", acrostic: Some("bard") };
        let good = "Bold I come\nAnd bold I speak\nRhymes like drums\nDown they beat";
        assert!(score_form(form("acrostic"), good, &ctx).kept);
        assert!(!score_form(form("acrostic"), &good.replace("Rhymes", "Songs"), &ctx).kept);
    }

    #[test]
    fn haiku_anaphora_and_crescendo() {
        assert!(score_form(form("haiku"), "An old silent pond\nA frog jumps into the pond\nSplash silence again", &EN).kept);
        assert!(score_form(form("anaphora"), "Never fear\nNever yield\nNever kneel", &EN).kept);
        assert!(score_form(form("crescendo"), "I rise\nI rise again\nI rise again and louder", &EN).kept);
        assert!(!score_form(form("crescendo"), "I rise again and louder\nI rise\nI rise again", &EN).kept);
    }
}
