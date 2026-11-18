//! Scoring a verse and resolving a round. A port of the scoring half of
//! `src/lib/verse/duel.ts`, and of the online rules in `src/lib/multiplayer-rules.ts`.
//!
//! A verse scores  craft + judge:
//!   craft = (form points + power-word bonus) × multiplier − curse penalties
//!   judge = this side's share of `JUDGE_POOL`, from comparing the two verses by rule
//!
//! A verse that is empty, too thin to be a verse (`text::substance`) or taken from the
//! verse it answers ([`is_copy`], from `text::copy_of`) is void: it lands nothing and its
//! craft is 0. A copied verse also forfeits the judge.
//!
//! Form points scale with the share of the verse that is words of its language
//! (`FormScore.scale`), and the multiplier's bonuses with what the verse says beyond the
//! words that land its device and signature (`VerseScore.substance`), so tokens laid out in
//! a form's shape, or a chant that is only its device, cannot multiply themselves.
//!
//! Everything here is pure: the same seed, cards and verses always give the same numbers.

use serde::Serialize;

use super::cards::{card_by_id, Card, CHARACTER_NAMES};
use super::devices::{
    check_device, check_power_words, check_signature_words, curse_violations, device_in_play, DeviceContext,
    CURSE_PENALTY, CURSE_PENALTY_CAP, POWER_WORD_BONUS,
};
use super::forms::{forms_for_english, get_form, score_form, Form, FormContext, FormScore, ACROSTIC_WORDS};
use super::judge::{online_judge, rules_judge, JudgeSplit, Verdict, CRITERIA, LEXICON};
use super::text::{clean_verse, clean_verse_with, copy_of, js_round, lines_of, own_content, rhyme_ends, rhymes, words_of, CopyMeasure, LineCarry};
use super::LANG;

pub const ROUNDS: usize = 3;

// What counts as a copy (`isCopy` and its constants in duel.ts, set from measurement in
// review.test.ts and docs/language/RULES-MEASUREMENTS.md).
pub const COPY_THRESHOLD: f64 = 0.7;
pub const COPY_COVERAGE: f64 = 0.85;
pub const COPY_COVERAGE_ALONE: f64 = 0.9;
pub const COPY_MIN_TAKEN: usize = 4;
/// Content words said in any order that a shuffled copy must carry: more than a Riposte's three.
pub const COPY_ANY_ORDER_MIN: f64 = 4.0;
/// Words a line of the other verse needs before the line rule counts it.
pub const COPY_LINE_WORDS: usize = 3;
/// Share of a line's words a line of the verse says in order, when that line keeps its rhyme
/// (it says the line's last word, or ends on a word that rhymes with it), for it to carry that line over.
pub const COPY_LINE_SHARE: f64 = 0.6;
/// Words the other verse needs before the line rule applies at all.
pub const COPY_LINE_SOURCE: usize = 7;
/// Share of a line's words a line of the verse says in order when it carries the line over with
/// its last word changed for one that does not rhyme; counted only for a verse with no line of its
/// own beyond the other's (`COPY_LINE_NEAR`).
pub const COPY_LINE_NEAR: f64 = 0.67;
/// Share of a line's words, in any order, that the line carrying it says, in every line of a verse
/// with no line of its own beyond the other's (`COPY_LINE_ANY`).
pub const COPY_LINE_ANY: f64 = 0.8;
/// Content words of its own, beyond those that land its device and signature, that a verse
/// needs per line its form asks for before its multiplier's bonuses apply in full.
pub const OWN_WORDS_PER_LINE: f64 = 1.5;

/// Does `c` carry the other verse's lines over, each into a line of its own (`carriesLines`)?
/// Every line of `COPY_LINE_WORDS` words or more but one (all of them in a couplet) has
/// `COPY_LINE_SHARE` of its words said in its order by a line of the verse that keeps its rhyme
/// (`rhymed(line, i)` for source line `i`); or, when the verse has no more lines than the source,
/// `COPY_LINE_NEAR` of them whatever the line ends on. Only for a verse of `COPY_LINE_SOURCE`
/// words or more.
pub fn carries_lines_with(c: &CopyMeasure, rhymed: impl Fn(&LineCarry, usize) -> bool) -> bool {
    let words: usize = c.carry.iter().map(|l| l.source).sum();
    let counted: Vec<(usize, &LineCarry)> = c.carry.iter().enumerate().filter(|(_, l)| l.source >= COPY_LINE_WORDS).collect();
    if counted.len() < 2 || words < COPY_LINE_SOURCE {
        return false;
    }
    let need = if counted.len() >= 3 { counted.len() - 1 } else { counted.len() };
    let kept = |l: &LineCarry, i: usize| l.said >= 2 && l.said as f64 >= (COPY_LINE_SHARE * l.source as f64).ceil() && rhymed(l, i);
    if counted.iter().filter(|(i, l)| kept(l, *i)).count() >= need {
        return true;
    }
    // Nothing of its own beyond the other's lines: each line nearly whole, whatever it now ends on.
    if c.verse_lines > c.carry.len() {
        return false;
    }
    if counted
        .iter()
        .filter(|(i, l)| kept(l, *i) || (l.said >= 2 && l.said as f64 >= (COPY_LINE_NEAR * l.source as f64).ceil()))
        .count()
        >= need
    {
        return true;
    }
    // Or every one of them, none left out: COPY_LINE_SHARE of it in order, or COPY_LINE_ANY of it in
    // any order, whatever it now ends on; and one of their content words at least, where they have
    // any (a verse that keeps only the other's little words is its own).
    let each = counted.iter().all(|(_, l)| {
        l.said >= 2 && (l.said as f64 >= (COPY_LINE_SHARE * l.source as f64).ceil() || l.any as f64 >= (COPY_LINE_ANY * l.source as f64).ceil())
    });
    each && (counted.iter().all(|(_, l)| l.content == 0) || counted.iter().any(|(_, l)| l.content_said >= 1))
}

/// `carriesLines(c)`: the line rule with only the measure to go on, a line keeping its rhyme
/// when it says the source line's last word.
pub fn carries_lines(c: &CopyMeasure) -> bool {
    carries_lines_with(c, |l, _| l.end)
}

/// Is `verse` a copy of `answered` (`isCopy`)? Both are cleaned verses.
pub fn is_copy(verse: &str, answered: &str) -> bool {
    if answered.is_empty() {
        return false;
    }
    let c = copy_of(verse, answered, false);
    let theirs = lines_of(answered);
    let mine = lines_of(verse);
    // A line keeps its rhyme when it ends on the source line's word or on one that rhymes with it.
    let rhymed = |l: &LineCarry, i: usize| {
        if l.end {
            return true;
        }
        match (l.line.and_then(|j| mine.get(j)), theirs.get(i)) {
            (Some(m), Some(t)) => {
                let (a, b) = rhyme_ends(t, m);
                rhymes(&a, &b)
            }
            _ => false,
        }
    };
    if carries_lines_with(&c, rhymed) {
        return true;
    }
    // Every word counted, the little ones too: asked only when the content words leave it open.
    let mut all: Option<CopyMeasure> = None;
    let mut all_words = || all.get_or_insert_with(|| copy_of(verse, answered, true)).clone();
    if c.own == 0 {
        let a = all_words();
        if a.taken >= 3 && a.share >= COPY_THRESHOLD {
            return true;
        }
    }
    if js_round(c.any_order * c.source as f64) >= COPY_ANY_ORDER_MIN
        && c.any_order >= COPY_COVERAGE_ALONE
        && all_words().any_order >= COPY_THRESHOLD
    {
        return true;
    }
    let a = all_words();
    if a.source >= COPY_LINE_SOURCE && a.any_order >= COPY_COVERAGE_ALONE {
        return true;
    }
    if c.taken < COPY_MIN_TAKEN {
        return false;
    }
    let spread = c.per_line.iter().filter(|n| **n >= 2).count() >= 2;
    c.share >= COPY_THRESHOLD || c.coverage >= COPY_COVERAGE_ALONE || (spread && c.coverage >= COPY_COVERAGE)
}

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
    /// The verse this one answers: the Riposte is checked against it, and a verse copied
    /// from it is void. `None` for a verse that opens.
    pub opponent_verse: Option<&'a str>,
    /// Curse this verse was written under.
    pub curse: Option<Curse<'a>>,
    /// Power words this side paid for.
    pub lent: Option<&'a [String]>,
    /// The verse was chosen by the game itself (the single-player opponent's): it is not
    /// tested for being a copy. Never set for a player's verse, and never online.
    pub trusted: bool,
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

/// Why a verse earns nothing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Voided {
    /// No words.
    Empty,
    /// Too little to be a verse.
    Thin,
    /// Taken from the verse it answers.
    Copied,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct VerseScore {
    pub form: FormScore,
    pub device: DeviceScore,
    pub signature: bool,
    pub synergy: bool,
    /// 1, plus a half for the device, a half for the signature and a quarter for synergy,
    /// those bonuses scaled by `substance` and rounded to hundredths.
    pub multiplier: f64,
    pub power_words: Option<PowerScore>,
    pub curse: Option<CurseScore>,
    /// How far the multiplier's bonuses apply, from 0 to 1: the verse's own telling words
    /// beyond those that land its device and signature, `OWN_WORDS_PER_LINE` a line the form
    /// asks for (`text::own_content`).
    pub substance: f64,
    pub craft: u32,
    /// Set when the verse earns nothing.
    pub voided: Option<Voided>,
}

pub fn score_verse(input: &ScoreInput) -> VerseScore {
    let verse = clean_verse(input.verse);
    // A curse reads the verse as typed: a word that mixes alphabets is itself the trick.
    let typed = clean_verse_with(input.verse, false);
    let form = score_form(input.form, &verse, &input.ctx);
    let answered = input.opponent_verse.filter(|v| !v.is_empty()).map(clean_verse).unwrap_or_default();

    let voided = if verse.is_empty() || words_of(&verse).is_empty() {
        Some(Voided::Empty)
    } else if form.thin {
        Some(Voided::Thin)
    } else if !input.trusted && is_copy(&verse, &answered) {
        Some(Voided::Copied)
    } else {
        None
    };

    // A Riposte house with nothing to answer is held to its opening device instead.
    let device_id = device_in_play(&input.card.house, !answered.is_empty());
    // A void verse lands nothing: devices and signatures are for verses.
    let device = if voided.is_none() {
        check_device(
            device_id,
            &verse,
            &DeviceContext { opponent_verse: (!answered.is_empty()).then_some(answered.as_str()), names: &CHARACTER_NAMES },
        )
        .expect("every house device exists")
    } else {
        Default::default()
    };
    let signature = if voided.is_none() { check_signature_words(input.card, &verse) } else { None };

    let same_house = input
        .deck_characters
        .iter()
        .filter(|id| card_by_id(id).is_some_and(|c| c.house == input.card.house))
        .count();
    let synergy = device.met && same_house >= 2;
    // A multiplier multiplies what the verse says: its own telling words beyond those that land
    // the device and the signature, OWN_WORDS_PER_LINE a line the form asks for.
    let mut used: Vec<String> = if device.met { device.words.clone() } else { Vec::new() };
    if let Some(words) = &signature {
        used.extend(words.iter().cloned());
    }
    let substance = if voided.is_some() {
        0.0
    } else {
        let lines = input.form.lines(&input.ctx).max(1) as f64;
        1f64.min(own_content(&verse, &used) as f64 / (OWN_WORDS_PER_LINE * lines))
    };
    let bonus = (if device.met { 0.5 } else { 0.0 }) + (if signature.is_some() { 0.5 } else { 0.0 }) + (if synergy { 0.25 } else { 0.0 });
    let multiplier = 1.0 + js_round(bonus * substance * 100.0) / 100.0;

    let power_words = input.lent.map(|words| {
        let p = check_power_words(words, &verse);
        PowerScore { bonus: if p.met && voided.is_none() { POWER_WORD_BONUS } else { 0 }, used: p.used, met: p.met }
    });

    let curse = input.curse.map(|c| {
        let violations = curse_violations(c.curse_id, &typed, c.param).expect("the curse exists");
        CurseScore { id: c.curse_id.to_string(), violations, penalty: CURSE_PENALTY_CAP.min(violations * CURSE_PENALTY) }
    });

    // A void verse earns nothing, whatever the cards say.
    let base = if voided.is_some() { 0 } else { form.earned + power_words.as_ref().map_or(0, |p| p.bonus) };
    // Math.max(0, Math.round(base * multiplier) - penalty).
    let rounded = js_round(f64::from(base) * multiplier) as u32;
    let craft = rounded.saturating_sub(curse.as_ref().map_or(0, |c| c.penalty));
    VerseScore {
        form,
        device: DeviceScore { id: device_id.to_string(), met: device.met },
        signature: signature.is_some(),
        synergy,
        multiplier,
        power_words,
        curse,
        substance,
        craft,
        voided,
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
/// model. The opponent opens, so the player answers the opponent's verse of this round and
/// the opponent answers the player's verse of the round before. The opponent's verse is
/// the game's own and is not tested for copying. World cards are not ported: they are a
/// single-player bonus the server has no part in.
pub fn resolve_round(
    form: &Form,
    ctx: FormContext,
    player: &DuelSide,
    opponent: &DuelSide,
    previous_player_verse: Option<&str>,
) -> RoundResult {
    let player_verse = clean_verse(player.verse);
    let opponent_verse = clean_verse(opponent.verse);
    let judged = rules_judge(player.verse, opponent.verse, ctx.lang, &LEXICON, previous_player_verse);
    let player_score = score_verse(&ScoreInput {
        // As typed, so a curse can see a word that mixes alphabets; score_verse cleans it.
        verse: player.verse,
        form,
        ctx,
        card: player.card,
        deck_characters: player.deck_characters,
        opponent_verse: Some(&opponent_verse),
        curse: player.curse,
        lent: player.lent,
        trusted: false,
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
        trusted: true,
    });
    // A copy forfeits the judge as well as its craft.
    let judge = if player_score.voided == Some(Voided::Copied) { JudgeSplit::forfeit_to(Verdict::Opponent) } else { judged };
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

/// Most cleaning passes `settle_verse` makes (`SETTLE_PASSES`).
pub const SETTLE_PASSES: usize = 8;

/// A verse as online play holds it (`settleVerse`): cleaned again and again until cleaning
/// changes nothing more, at most `SETTLE_PASSES` times.
///
/// `clean_verse`, like the TypeScript `cleanVerse` it ports, is not idempotent: NFKC runs
/// before invisible characters are taken out, so a letter, a zero-width space and a
/// combining accent become one composed letter only on a second pass, and a syllable count
/// can change with it. The page sends and previews the settled text, the room settles
/// whatever arrives, and every cleaning after that is a no-op, so the preview, the server
/// and the page's audit all score the same text.
pub fn settle_verse(text: &str) -> String {
    let mut s = text.to_string();
    for _ in 0..SETTLE_PASSES {
        let next = clean_verse(&s);
        if next == s {
            return s;
        }
        s = next;
    }
    s
}

/// One side of an online round.
#[derive(Debug, Clone, Copy)]
pub struct OnlineSide<'a> {
    pub card: &'a Card,
    /// Every character in this side's deck, for house synergy.
    pub deck: &'a [String],
    pub verse: &'a str,
    /// The other side's verse from the round before: what a riposte and a comeback answer,
    /// and what a copied verse is copied from. `None` in round one.
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
        trusted: false,
    })
}

/// Score both verses of an online round and say who took it (`resolveOnlineRound`).
///
/// Both players wrote at once under the same form, neither seeing the other's verse, so
/// everything that "answers" (the Riposte, the judge's comeback, the test for a copy) is
/// read against the other side's verse of the round before. A copied verse forfeits the
/// judge to the other side. The better total takes the round; level totals go to the
/// judge's preference; level on both is a draw.
pub fn resolve_online_round(plan: &RoundPlan, a: &OnlineSide, b: &OnlineSide) -> OnlineRound {
    let verse_a = clean_verse(a.verse);
    let verse_b = clean_verse(b.verse);
    let score_a = online_craft(plan, &OnlineSide { verse: &verse_a, ..*a });
    let score_b = online_craft(plan, &OnlineSide { verse: &verse_b, ..*b });
    let judged = online_judge(&verse_a, &verse_b, LANG, &LEXICON, a.previous_opponent_verse, b.previous_opponent_verse);
    let copied = (score_a.voided == Some(Voided::Copied), score_b.voided == Some(Voided::Copied));
    let judge = match copied {
        (true, false) => JudgeSplit::forfeit_to(Verdict::Opponent),
        (false, true) => JudgeSplit::forfeit_to(Verdict::Player),
        _ => judged,
    };
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

    const GOOD: &str = "Who dares to stand upon my stage?\nI put the question to thy rage";

    fn deck(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    fn input<'a>(verse: &'a str, card: &'a str, deck: &'a [String]) -> ScoreInput<'a> {
        ScoreInput {
            verse,
            form: get_form("couplet").unwrap(),
            ctx: FormContext { lang: "en", acrostic: None },
            card: card_by_id(card).unwrap(),
            deck_characters: deck,
            opponent_verse: None,
            curse: None,
            lent: None,
            trusted: false,
        }
    }

    fn score(verse: &str, card: &str, deck_ids: &[&str]) -> VerseScore {
        let d = deck(deck_ids);
        score_verse(&input(verse, card, &d))
    }

    #[test]
    fn craft_is_multiplied_when_the_device_and_signature_land() {
        // Hamlet: the question is his house's device, and "question" echoes his line.
        let s = score(GOOD, "DC-001", &["DC-001", "MO-001", "CA-001"]);
        assert_eq!((s.form.earned, s.device.met, s.signature, s.synergy), (20, true, true, false));
        assert_eq!(s.multiplier, 2.0);
        assert_eq!((s.craft, s.voided), (40, None));
        // Two of the Danish Court in the deck: synergy, a further quarter.
        let s = score(GOOD, "DC-001", &["DC-001", "DC-002", "CA-001"]);
        assert_eq!((s.synergy, s.multiplier, s.craft), (true, 2.25, 45));
    }

    #[test]
    fn an_empty_verse_scores_nothing_and_a_penalty_never_goes_below_zero() {
        assert_eq!(score("", "DC-001", &["DC-001"]).voided, Some(Voided::Empty));
        let blank = score("  \n\u{200b}\n?!", "DC-001", &["DC-001"]);
        assert_eq!((blank.craft, blank.voided, blank.device.met), (0, Some(Voided::Empty), false));
        let d = deck(&["DC-001"]);
        let cursed = score_verse(&ScoreInput {
            curse: Some(Curse { curse_id: "forbidden-letter", param: "s" }),
            ..input("Some sister sings softly\nSo she says", "DC-001", &d)
        });
        assert_eq!(cursed.curse.as_ref().map(|c| c.penalty), Some(12));
        assert_eq!(cursed.craft, 0);
    }

    #[test]
    fn tokens_laid_out_like_a_verse_are_not_a_verse() {
        let d = deck(&["DC-001", "MO-001", "CA-001"]);
        // One word three times once swept Anaphora.
        let anaphora = ScoreInput { form: get_form("anaphora").unwrap(), ..input("Never\nNever\nNever", "DC-001", &d) };
        let s = score_verse(&anaphora);
        assert_eq!((s.craft, s.voided, s.form.thin, s.form.earned), (0, Some(Voided::Thin), true, 0));
        // An invisible couplet once scored the full form.
        let s = score("\u{3164}\u{3164}\n\u{3164}", "DC-001", &["DC-001"]);
        assert_eq!((s.craft, s.voided), (0, Some(Voided::Empty)));
        // A question mark alone lands nothing.
        let s = score("?", "DC-001", &["DC-001"]);
        assert_eq!((s.device.met, s.craft), (false, 0));
    }

    #[test]
    fn a_verse_taken_from_the_one_it_answers_is_void() {
        let d = deck(&["VC-001", "MO-001", "CA-001"]);
        let theirs = "I stand upon the midnight stage\nAnd answer all thy empty rage";
        let copy = score_verse(&ScoreInput { opponent_verse: Some(theirs), ..input(theirs, "VC-001", &d) });
        assert_eq!((copy.craft, copy.voided, copy.device.met), (0, Some(Voided::Copied), false));
        // Throwing one word back is the Riposte, not a copy.
        let riposte = "Thy midnight is a candle in the wind\nIt gutters and leaves nothing behind";
        let own = score_verse(&ScoreInput { opponent_verse: Some(theirs), ..input(riposte, "VC-001", &d) });
        assert_eq!((own.voided, own.device.id.as_str(), own.device.met), (None, "riposte", true));
        // With nothing to answer, a Riposte house is held to the outcry.
        let opening = score_verse(&input("Hear me now!\nI open and I bow", "VC-001", &d));
        assert_eq!((opening.device.id.as_str(), opening.device.met), ("exclaim", true));
        // The game's own verse is not tested.
        let trusted = score_verse(&ScoreInput { opponent_verse: Some(theirs), trusted: true, ..input(theirs, "VC-001", &d) });
        assert_eq!(trusted.voided, None);
    }

    #[test]
    fn halves_round_up_as_math_round_does() {
        // 6 × 1.25 = 7.5 → 8; 14 × 1.75 = 24.5 → 25.
        assert_eq!((6 * 5 + 2) / 4, 8);
        assert_eq!((14 * 7 + 2) / 4, 25);
        assert_eq!((20 * 9 + 2) / 4, 45);
    }

    #[test]
    fn the_generator_is_deterministic_and_stays_below_one() {
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

    fn couplet() -> RoundPlan {
        RoundPlan { index: 0, form_id: "couplet".into(), acrostic: None }
    }

    #[test]
    fn an_online_round_is_the_same_from_either_seat() {
        let da = deck(&["DC-001", "MO-001", "CA-001"]);
        let db = deck(&["MO-001", "CA-001", "DC-002"]);
        let a = OnlineSide { card: card_by_id("DC-001").unwrap(), deck: &da, verse: GOOD, previous_opponent_verse: Some("A borrowed light") };
        let b = OnlineSide {
            card: card_by_id("MO-001").unwrap(),
            deck: &db,
            verse: "The night is bright with borrowed light\nAnd I shall win this fight",
            previous_opponent_verse: Some("My stage, my question"),
        };
        let ab = resolve_online_round(&couplet(), &a, &b);
        let ba = resolve_online_round(&couplet(), &b, &a);
        assert_eq!((ab.a.total, ab.b.total), (ba.b.total, ba.a.total));
        assert_eq!((ab.a.score.clone(), ab.b.score.clone()), (ba.b.score, ba.a.score));
        assert_eq!(ab.a.judge + ab.b.judge, super::super::judge::JUDGE_POOL);
        let same = resolve_online_round(&couplet(), &a, &OnlineSide { previous_opponent_verse: a.previous_opponent_verse, ..a });
        assert_eq!(same.winner, RoundWinner::Draw);
    }

    #[test]
    fn pasting_the_opponents_last_verse_back_loses_the_round_online() {
        let da = deck(&["DC-001", "MO-001", "CA-001"]);
        let db = deck(&["MO-002", "CA-002", "DC-002"]);
        let theirs = "The night is bright with borrowed light\nAnd I shall win this fight";
        let paste = OnlineSide { card: card_by_id("DC-001").unwrap(), deck: &da, verse: theirs, previous_opponent_verse: Some(theirs) };
        let honest = OnlineSide {
            card: card_by_id("MO-002").unwrap(),
            deck: &db,
            verse: "A plain new line of mine\nAnother, less than fine",
            previous_opponent_verse: Some(GOOD),
        };
        let r = resolve_online_round(&couplet(), &paste, &honest);
        assert_eq!((r.a.score.voided, r.a.score.craft, r.a.judge, r.a.total), (Some(Voided::Copied), 0, 0, 0));
        assert_eq!((r.b.judge, r.winner), (24, RoundWinner::B));
        assert_eq!(r.criteria, [Verdict::Opponent; 4]);
        // From the other seat the same thing happens to the same player.
        let r = resolve_online_round(&couplet(), &honest, &paste);
        assert_eq!((r.b.total, r.a.judge, r.winner), (0, 24, RoundWinner::A));
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
