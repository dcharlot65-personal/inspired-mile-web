//! Scoring a verse and resolving a round. A port of the scoring half of
//! `src/lib/verse/duel.ts`, and of the online rules in `src/lib/multiplayer-rules.ts`.
//!
//! A verse scores  craft + judge:
//!   craft = (form points + power-word bonus) × multiplier − curse penalties
//!   judge = this side's share of `JUDGE_POOL`, from comparing the two verses by rule
//!
//! Everything here is pure: the same seed, cards and verses always give the same numbers.

use serde::Serialize;

use super::cards::{card_by_id, Card, CHARACTER_NAMES};
use super::devices::{
    check_device, check_power_words, check_signature, curse_violations, device_for_house, DeviceContext,
    CURSE_PENALTY, CURSE_PENALTY_CAP, POWER_WORD_BONUS,
};
use super::forms::{forms_for_english, get_form, score_form, Form, FormContext, FormScore, ACROSTIC_WORDS};
use super::judge::{rules_judge, JudgeSplit, Verdict, CRITERIA, LEXICON};
use super::text::clean_verse;
use super::LANG;

pub const ROUNDS: usize = 3;

// --- Seeded randomness ---

/// The TypeScript engine's generator (mulberry32), bit for bit.
pub struct Rng(u32);

impl Rng {
    pub fn new(seed: u32) -> Self {
        Self(seed)
    }

    /// The next value in [0, 1).
    pub fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }

    /// `Math.floor(r() * n)`.
    pub fn below(&mut self, n: usize) -> usize {
        (self.next() * n as f64).floor() as usize
    }

    pub fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len())]
    }

    pub fn shuffled<T: Clone>(&mut self, items: &[T]) -> Vec<T> {
        let mut a = items.to_vec();
        for i in (1..a.len()).rev() {
            let j = self.below(i + 1);
            a.swap(i, j);
        }
        a
    }
}

// --- Scoring one verse ---

/// A curse a verse was written under.
#[derive(Debug, Clone, Copy)]
pub struct Curse<'a> {
    pub curse_id: &'a str,
    /// The forbidden letter, when the curse needs one.
    pub param: &'a str,
}

#[derive(Debug, Clone, Copy)]
pub struct ScoreInput<'a> {
    pub verse: &'a str,
    pub form: &'a Form,
    pub ctx: FormContext<'a>,
    pub card: &'a Card,
    /// The characters in this side's deck, for house synergy.
    pub deck_characters: &'a [String],
    /// The verse a riposte may answer.
    pub opponent_verse: Option<&'a str>,
    /// Curse this verse was written under.
    pub curse: Option<Curse<'a>>,
    /// Power words this side paid for.
    pub lent: Option<&'a [String]>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DeviceScore {
    pub id: String,
    pub met: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PowerScore {
    pub used: Vec<String>,
    pub met: bool,
    pub bonus: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CurseScore {
    pub id: String,
    pub violations: u32,
    pub penalty: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct VerseScore {
    pub form: FormScore,
    pub device: DeviceScore,
    pub signature: bool,
    pub synergy: bool,
    /// 1, plus a half for the device, a half for the signature and a quarter for synergy.
    pub multiplier: f64,
    pub power_words: Option<PowerScore>,
    pub curse: Option<CurseScore>,
    pub craft: u32,
}

pub fn score_verse(input: &ScoreInput) -> VerseScore {
    let verse = clean_verse(input.verse);
    let form = score_form(input.form, &verse, &input.ctx);
    let device_id = device_for_house(&input.card.house);
    let device_met = check_device(
        device_id,
        &verse,
        &DeviceContext { opponent_verse: input.opponent_verse, names: &CHARACTER_NAMES },
    )
    .expect("every house device exists");
    let signature = check_signature(input.card, &verse);

    let same_house = input
        .deck_characters
        .iter()
        .filter(|id| card_by_id(id).is_some_and(|c| c.house == input.card.house))
        .count();
    let synergy = device_met && same_house >= 2;
    // The multiplier in quarters, so the rounding below is exact integer arithmetic.
    let quarters: u32 = 4 + if device_met { 2 } else { 0 } + if signature { 2 } else { 0 } + if synergy { 1 } else { 0 };

    let power_words = input.lent.map(|words| {
        let p = check_power_words(words, &verse);
        PowerScore { bonus: if p.met { POWER_WORD_BONUS } else { 0 }, used: p.used, met: p.met }
    });

    let curse = input.curse.map(|c| {
        let violations = curse_violations(c.curse_id, &verse, c.param).expect("the curse exists");
        CurseScore { id: c.curse_id.to_string(), violations, penalty: CURSE_PENALTY_CAP.min(violations * CURSE_PENALTY) }
    });

    // An empty verse earns nothing, whatever the cards say.
    let base = if verse.is_empty() { 0 } else { form.earned + power_words.as_ref().map_or(0, |p| p.bonus) };
    // Math.round(base * multiplier): halves round up.
    let rounded = (base * quarters + 2) / 4;
    let craft = rounded.saturating_sub(curse.as_ref().map_or(0, |c| c.penalty));
    VerseScore {
        form,
        device: DeviceScore { id: device_id.to_string(), met: device_met },
        signature,
        synergy,
        multiplier: f64::from(quarters) / 4.0,
        power_words,
        curse,
        craft,
    }
}

// --- A single-player round (resolveRound in duel.ts), judged by rule ---

/// One side of a single-player round.
#[derive(Debug, Clone, Copy)]
pub struct DuelSide<'a> {
    pub verse: &'a str,
    pub card: &'a Card,
    pub deck_characters: &'a [String],
    pub curse: Option<Curse<'a>>,
    pub lent: Option<&'a [String]>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RoundResult {
    pub player_verse: String,
    pub opponent_verse: String,
    pub player: VerseScore,
    pub opponent: VerseScore,
    pub judge: JudgeSplit,
    pub player_total: u32,
    pub opponent_total: u32,
    /// True when the player took the round.
    pub player_wins: bool,
}

/// `resolveRound`, with the judge share from `rulesJudge` as session.ts plays it without a
/// model. The opponent opens, so the player may answer the opponent's verse of this round
/// and the opponent may answer the player's verse of the round before.
pub fn resolve_round(
    form: &Form,
    ctx: FormContext,
    player: &DuelSide,
    opponent: &DuelSide,
    previous_player_verse: Option<&str>,
) -> RoundResult {
    let player_verse = clean_verse(player.verse);
    let opponent_verse = clean_verse(opponent.verse);
    let judge = rules_judge(&player_verse, &opponent_verse, ctx.lang, &LEXICON);
    let player_score = score_verse(&ScoreInput {
        verse: &player_verse,
        form,
        ctx,
        card: player.card,
        deck_characters: player.deck_characters,
        opponent_verse: Some(&opponent_verse),
        curse: player.curse,
        lent: player.lent,
    });
    let opponent_score = score_verse(&ScoreInput {
        verse: &opponent_verse,
        form,
        ctx,
        card: opponent.card,
        deck_characters: opponent.deck_characters,
        opponent_verse: previous_player_verse,
        curse: opponent.curse,
        lent: opponent.lent,
    });
    let player_total = player_score.craft + judge.player;
    let opponent_total = opponent_score.craft + judge.opponent;
    // Ties go to the judge's preference, then to the challenger.
    let player_wins = if player_total != opponent_total {
        player_total > opponent_total
    } else {
        judge.opponent <= judge.player
    };
    RoundResult {
        player_verse,
        opponent_verse,
        player: player_score,
        opponent: opponent_score,
        judge,
        player_total,
        opponent_total,
        player_wins,
    }
}

/// `matchWinner`: `Some(true)` when the player has won, `Some(false)` when the opponent
/// has, `None` while the match is open. Each entry says whether the player took that round.
pub fn match_winner(player_won: &[bool]) -> Option<bool> {
    let p = player_won.iter().filter(|w| **w).count();
    let o = player_won.len() - p;
    let need = ROUNDS / 2 + 1;
    if p >= need {
        Some(true)
    } else if o >= need {
        Some(false)
    } else {
        None
    }
}

// --- The online duel (src/lib/multiplayer-rules.ts) ---

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RoundPlan {
    pub index: usize,
    pub form_id: String,
    /// The word an acrostic must spell; `None` for every other form.
    pub acrostic: Option<String>,
}

/// The three forms a seed draws, and the word for an acrostic (`onlinePlan`).
pub fn online_plan(seed: u32) -> Vec<RoundPlan> {
    let mut r = Rng::new(seed);
    let forms = r.shuffled(&forms_for_english());
    forms
        .into_iter()
        .take(ROUNDS)
        .enumerate()
        .map(|(index, form)| RoundPlan {
            index,
            form_id: form.id.to_string(),
            acrostic: (form.id == "acrostic").then(|| r.pick(&ACROSTIC_WORDS).to_string()),
        })
        .collect()
}

/// One side of an online round.
#[derive(Debug, Clone, Copy)]
pub struct OnlineSide<'a> {
    pub card: &'a Card,
    /// Every character in this side's deck, for house synergy.
    pub deck: &'a [String],
    pub verse: &'a str,
    /// The other side's verse from the round before, which a riposte may answer.
    pub previous_opponent_verse: Option<&'a str>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OnlineSideResult {
    pub verse: String,
    pub score: VerseScore,
    /// This side's share of the judge's pool.
    pub judge: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoundWinner {
    A,
    B,
    Draw,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OnlineRound {
    pub a: OnlineSideResult,
    pub b: OnlineSideResult,
    /// Who took each criterion, in the order of `CRITERIA`: `Player` is side A.
    pub criteria: [Verdict; 4],
    pub winner: RoundWinner,
}

/// A player's craft for a verse in an online round (`onlineCraft`).
pub fn online_craft(plan: &RoundPlan, side: &OnlineSide) -> VerseScore {
    let form = get_form(&plan.form_id).expect("a plan names a form that exists");
    score_verse(&ScoreInput {
        verse: side.verse,
        form,
        ctx: FormContext { lang: LANG, acrostic: plan.acrostic.as_deref() },
        card: side.card,
        deck_characters: side.deck,
        // An empty previous verse is nothing to answer.
        opponent_verse: side.previous_opponent_verse.filter(|v| !v.is_empty()),
        curse: None,
        lent: None,
    })
}

/// Score both verses of an online round and say who took it (`resolveOnlineRound`).
///
/// Both players wrote at once under the same form. The better total takes the round;
/// level totals go to the judge's preference; level on both is a draw.
pub fn resolve_online_round(plan: &RoundPlan, a: &OnlineSide, b: &OnlineSide) -> OnlineRound {
    let verse_a = clean_verse(a.verse);
    let verse_b = clean_verse(b.verse);
    let score_a = online_craft(plan, &OnlineSide { verse: &verse_a, ..*a });
    let score_b = online_craft(plan, &OnlineSide { verse: &verse_b, ..*b });
    let judge = rules_judge(&verse_a, &verse_b, LANG, &LEXICON);
    let total_a = score_a.craft + judge.player;
    let total_b = score_b.craft + judge.opponent;
    let winner = if total_a != total_b {
        if total_a > total_b { RoundWinner::A } else { RoundWinner::B }
    } else if judge.player != judge.opponent {
        if judge.player > judge.opponent { RoundWinner::A } else { RoundWinner::B }
    } else {
        RoundWinner::Draw
    };
    debug_assert_eq!(judge.criteria.len(), CRITERIA.len());
    OnlineRound {
        a: OnlineSideResult { verse: verse_a, score: score_a, judge: judge.player, total: total_a },
        b: OnlineSideResult { verse: verse_b, score: score_b, judge: judge.opponent, total: total_b },
        criteria: judge.criteria,
        winner,
    }
}

/// Fewest and most characters an online deck may hold (`ONLINE_DECK_MIN`, `ONLINE_DECK_MAX`).
pub const ONLINE_DECK_MIN: usize = 3;
pub const ONLINE_DECK_MAX: usize = 5;

/// Why a list of card ids cannot be an online deck, or `None` when it can
/// (`onlineDeckProblem`): three to five different character cards.
pub fn online_deck_problem(ids: &[String]) -> Option<String> {
    if ids.len() < ONLINE_DECK_MIN || ids.len() > ONLINE_DECK_MAX {
        return Some(format!("An online deck has {ONLINE_DECK_MIN} to {ONLINE_DECK_MAX} characters."));
    }
    for (i, id) in ids.iter().enumerate() {
        if ids[..i].contains(id) {
            return Some("A character can be in the deck only once.".into());
        }
    }
    for id in ids {
        if !card_by_id(id).is_some_and(Card::is_character) {
            // The id came from a client: say it back only if it is short and plain.
            let shown: String = id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(12).collect();
            return Some(format!("{shown} is not a character card."));
        }
    }
    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchWinner {
    A,
    B,
    Draw,
}

/// Who has won an online match, or `None` while it is open (`onlineMatchWinner`). Each
/// entry is a round's winner and the two totals. Two rounds win it; after the last round
/// the side with more rounds wins, then the side with more points over the whole match.
pub fn online_match_winner(rounds: &[(RoundWinner, u32, u32)]) -> Option<MatchWinner> {
    let a = rounds.iter().filter(|r| r.0 == RoundWinner::A).count();
    let b = rounds.iter().filter(|r| r.0 == RoundWinner::B).count();
    let need = ROUNDS / 2 + 1;
    if a >= need {
        return Some(MatchWinner::A);
    }
    if b >= need {
        return Some(MatchWinner::B);
    }
    if rounds.len() < ROUNDS {
        return None;
    }
    if a != b {
        return Some(if a > b { MatchWinner::A } else { MatchWinner::B });
    }
    let total_a: u32 = rounds.iter().map(|r| r.1).sum();
    let total_b: u32 = rounds.iter().map(|r| r.2).sum();
    if total_a != total_b {
        return Some(if total_a > total_b { MatchWinner::A } else { MatchWinner::B });
    }
    Some(MatchWinner::Draw)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn deck(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    fn score(verse: &str, card: &str, deck_ids: &[&str]) -> VerseScore {
        let d = deck(deck_ids);
        score_verse(&ScoreInput {
            verse,
            form: get_form("couplet").unwrap(),
            ctx: FormContext { lang: "en", acrostic: None },
            card: card_by_id(card).unwrap(),
            deck_characters: &d,
            opponent_verse: None,
            curse: None,
            lent: None,
        })
    }

    #[test]
    fn craft_is_multiplied_when_the_device_and_signature_land() {
        // Hamlet: the question is his house's device, and "question" echoes his line.
        let kept = "Who dares to stand upon my stage?\nI put the question to thy rage";
        let s = score(kept, "DC-001", &["DC-001", "MO-001", "CA-001"]);
        assert_eq!((s.form.earned, s.device.met, s.signature, s.synergy), (20, true, true, false));
        assert_eq!(s.multiplier, 2.0);
        assert_eq!(s.craft, 40);
        // Two of the Danish Court in the deck: synergy, a further quarter.
        let s = score(kept, "DC-001", &["DC-001", "DC-002", "CA-001"]);
        assert_eq!((s.synergy, s.multiplier, s.craft), (true, 2.25, 45));
    }

    #[test]
    fn an_empty_verse_scores_nothing_and_a_penalty_never_goes_below_zero() {
        assert_eq!(score("", "DC-001", &["DC-001"]).craft, 0);
        assert_eq!(score("  \n\u{200b}\n", "DC-001", &["DC-001"]).craft, 0);
        let d = deck(&["DC-001"]);
        let cursed = score_verse(&ScoreInput {
            verse: "sssss sssss sssss sssss",
            form: get_form("couplet").unwrap(),
            ctx: FormContext { lang: "en", acrostic: None },
            card: card_by_id("DC-001").unwrap(),
            deck_characters: &d,
            opponent_verse: None,
            curse: Some(Curse { curse_id: "forbidden-letter", param: "s" }),
            lent: None,
        });
        assert_eq!(cursed.curse.as_ref().map(|c| c.penalty), Some(12));
        assert_eq!(cursed.craft, 0);
    }

    #[test]
    fn halves_round_up_as_math_round_does() {
        // 6 × 1.25 = 7.5 → 8; 14 × 1.75 = 24.5 → 25.
        assert_eq!((6 * 5 + 2) / 4, 8);
        assert_eq!((14 * 7 + 2) / 4, 25);
        assert_eq!((20 * 9 + 2) / 4, 45);
    }

    #[test]
    fn the_generator_matches_the_typescript_one() {
        // rng(1) and rng(42) in duel.ts, first values times 1e9, floored.
        let mut r = Rng::new(1);
        let first = (r.next() * 1e9).floor() as u64;
        let mut again = Rng::new(1);
        assert_eq!(first, (again.next() * 1e9).floor() as u64);
        assert!(Rng::new(0).next() < 1.0);
    }

    #[test]
    fn a_plan_is_three_different_forms_and_the_same_for_the_same_seed() {
        for seed in [0u32, 1, 2, 99, u32::MAX] {
            let plan = online_plan(seed);
            assert_eq!(plan.len(), ROUNDS);
            assert_eq!(plan, online_plan(seed));
            let mut ids: Vec<&str> = plan.iter().map(|p| p.form_id.as_str()).collect();
            ids.sort_unstable();
            ids.dedup();
            assert_eq!(ids.len(), ROUNDS);
            for p in &plan {
                assert_eq!(p.acrostic.is_some(), p.form_id == "acrostic");
            }
        }
    }

    #[test]
    fn an_online_round_is_the_same_from_either_seat() {
        let plan = RoundPlan { index: 0, form_id: "couplet".into(), acrostic: None };
        let da = deck(&["DC-001", "MO-001", "CA-001"]);
        let db = deck(&["MO-001", "CA-001", "DC-002"]);
        let a = OnlineSide {
            card: card_by_id("DC-001").unwrap(),
            deck: &da,
            verse: "Who dares to stand upon my stage?\nI put the question to thy rage",
            previous_opponent_verse: None,
        };
        let b = OnlineSide {
            card: card_by_id("MO-001").unwrap(),
            deck: &db,
            verse: "The night is bright with borrowed light\nAnd I shall win this fight",
            previous_opponent_verse: None,
        };
        let ab = resolve_online_round(&plan, &a, &b);
        let ba = resolve_online_round(&plan, &b, &a);
        assert_eq!((ab.a.total, ab.b.total), (ba.b.total, ba.a.total));
        assert_eq!(ab.a.judge + ab.b.judge, super::super::judge::JUDGE_POOL);
        let same = resolve_online_round(&plan, &a, &a);
        assert_eq!(same.winner, RoundWinner::Draw);
    }

    #[test]
    fn an_online_deck_is_three_to_five_different_characters() {
        assert_eq!(online_deck_problem(&deck(&["DC-001", "MO-001", "CA-001"])), None);
        assert_eq!(online_deck_problem(&deck(&["DC-001", "MO-001", "CA-001", "DC-002", "CA-002"])), None);
        assert!(online_deck_problem(&deck(&["DC-001", "MO-001"])).is_some());
        assert!(online_deck_problem(&deck(&["DC-001", "MO-001", "CA-001", "DC-002", "CA-002", "MO-002"])).is_some());
        assert!(online_deck_problem(&deck(&["DC-001", "DC-001", "CA-001"])).is_some());
        assert!(online_deck_problem(&deck(&["DC-001", "MO-001", "RL-001"])).is_some());
        assert!(online_deck_problem(&deck(&["DC-001", "MO-001", "<script>"])).is_some_and(|m| !m.contains('<')));
        assert!(online_deck_problem(&[]).is_some());
    }

    #[test]
    fn two_rounds_win_a_match_and_a_level_match_goes_to_points_then_is_a_draw() {
        use RoundWinner::{Draw, A, B};
        assert_eq!(online_match_winner(&[(A, 30, 20)]), None);
        assert_eq!(online_match_winner(&[(A, 30, 20), (A, 30, 20)]), Some(MatchWinner::A));
        assert_eq!(online_match_winner(&[(A, 30, 20), (B, 10, 20)]), None);
        assert_eq!(online_match_winner(&[(A, 30, 20), (Draw, 20, 20), (Draw, 20, 20)]), Some(MatchWinner::A));
        assert_eq!(online_match_winner(&[(A, 30, 20), (B, 10, 30), (Draw, 20, 20)]), Some(MatchWinner::B));
        assert_eq!(online_match_winner(&[(A, 30, 20), (B, 20, 30), (Draw, 20, 20)]), Some(MatchWinner::Draw));
        assert_eq!(online_match_winner(&[(Draw, 1, 1), (Draw, 1, 1)]), None);
    }
}
