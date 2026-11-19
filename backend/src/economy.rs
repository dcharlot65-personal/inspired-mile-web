//! The game's economy as rules: every amount, rate and cap, read from `backend/data/economy.json`
//! (the pages import the same file: `src/lib/economy-rules.ts`), and the decisions that need no
//! database. docs/ECONOMY.md says why each number is what it is.
//!
//! The principle the owner chose on 2026-11-19: the server decides every amount, and a client
//! that names one is refused. Solo play happens in the browser where the server cannot see it,
//! so what it earns is a fixed amount per source with a daily cap; rankings come only from
//! matches the server judged; cards come only from the server.
//!
//! Nothing here touches the database. The API's handlers apply these rules inside one
//! transaction per decision, with the account locked (`ledger.rs` in the API).

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

use crate::verse::cards::{card_by_id, starter_characters, Card, CARDS};

/// A fixed amount, paid at most `per_day` times per account per UTC day.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct Rate {
    pub amount: i32,
    pub per_day: i64,
}

#[derive(Debug, Deserialize)]
pub struct Solo {
    pub credits: HashMap<String, Rate>,
    pub xp: HashMap<String, Rate>,
}

#[derive(Debug, Deserialize)]
pub struct Online {
    pub win_credits: i32,
    pub win_credits_per_day: i64,
    pub win_credits_per_opponent_per_day: i64,
    pub xp_win: i32,
    pub xp_other: i32,
    pub xp_matches_per_day: i64,
    /// Matches between the same two accounts that pay XP in a UTC day.
    pub xp_matches_per_opponent_per_day: i64,
}

#[derive(Debug, Deserialize)]
pub struct Tier {
    pub tier: String,
    pub cards: usize,
    /// One card of this rarity is drawn first; the rest are ordinary draws.
    pub guaranteed: Option<String>,
    pub price: i32,
}

#[derive(Debug, Deserialize)]
pub struct Packs {
    pub weights: HashMap<String, u32>,
    pub tiers: Vec<Tier>,
    pub starter_pack_cards: usize,
    pub daily_pack_cards: usize,
    pub daily_pack_every_hours: i64,
}

#[derive(Debug, Deserialize)]
pub struct Import {
    /// Hours after an account is made in which it may import: the import is its first sign-in's,
    /// not something a long-standing account can do when it likes.
    pub window_hours: i64,
    pub max_cards: usize,
    pub max_by_rarity: HashMap<String, usize>,
    /// Whether a card that came over in the import may be listed in the market. False: it stays
    /// with the account that imported it, so a forged collection taken into many accounts cannot
    /// be gathered into one (docs/ECONOMY.md).
    pub sellable: bool,
}

#[derive(Debug, Deserialize)]
pub struct Tournaments {
    /// Hours a match has to be played once both its players are known (a round robin's round r:
    /// r times this, from the draw). Then the scheduler decides it (`tournaments::progress`).
    pub match_hours: i32,
}

#[derive(Debug, Deserialize)]
pub struct Market {
    pub price_min: i32,
    pub price_max: i32,
}

#[derive(Debug, Deserialize)]
pub struct Referral {
    pub referrer_credits: i32,
    pub rewards_per_day: i64,
}

#[derive(Debug, Deserialize)]
pub struct Founding {
    pub credits: i32,
    /// A UTC date (YYYY-MM-DD): an account made before it is a founding player. In the file, not
    /// the environment, so no setting on a server can hand every new account the credits.
    pub created_before: String,
}

impl Founding {
    /// Whether an account made at this moment is a founding player.
    pub fn applies_to(&self, created: chrono::DateTime<chrono::Utc>) -> bool {
        chrono::NaiveDate::parse_from_str(&self.created_before, "%Y-%m-%d").is_ok_and(|before| created.date_naive() < before)
    }
}

/// What an account achievement counts. Each is something the server holds itself.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Metric {
    /// Online matches won (a match, not a round).
    OnlineWins,
    /// Online matches finished.
    OnlineMatches,
    /// Rounds played in finished online matches.
    OnlineRounds,
    /// The best total of one round in an online match.
    BestRound,
    /// Different cards the account holds on the server, the starter characters included.
    UniqueCards,
    /// Packs the server opened for the account (free ones, bought ones, season rewards).
    PacksOpened,
}

#[derive(Debug, Deserialize)]
pub struct AccountAchievement {
    pub id: String,
    pub metric: Metric,
    pub goal: i64,
}

#[derive(Debug, Deserialize)]
pub struct Rules {
    pub solo: Solo,
    pub online: Online,
    pub packs: Packs,
    pub import: Import,
    pub market: Market,
    pub teen_daily_spend: i32,
    pub referral: Referral,
    pub founding: Founding,
    pub tournaments: Tournaments,
    pub account_achievements: Vec<AccountAchievement>,
}

const ECONOMY_JSON: &str = include_str!("../data/economy.json");

pub static RULES: LazyLock<Rules> =
    LazyLock::new(|| serde_json::from_str(ECONOMY_JSON).expect("backend/data/economy.json is valid economy data"));

/// Rarities from the commonest up, the order the draw walks the weights in (as `drawRandomCard`
/// in src/lib/cards.ts does).
pub const RARITIES: [&str; 5] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

fn rarity_rank(rarity: &str) -> usize {
    RARITIES.iter().position(|r| *r == rarity).unwrap_or(0)
}

/// The fixed credits a solo source pays, if it is one.
pub fn solo_credits(source: &str) -> Option<Rate> {
    RULES.solo.credits.get(source).copied()
}

/// The fixed XP a solo source pays, if it is one.
pub fn solo_xp(source: &str) -> Option<Rate> {
    RULES.solo.xp.get(source).copied()
}

pub fn tier(name: &str) -> Option<&'static Tier> {
    RULES.packs.tiers.iter().find(|t| t.tier == name)
}

/// A card id as the catalogue has it. Every card id the API stores passes this first, so no
/// id longer than `owned_cards.card_id` (16) reaches the database.
pub fn catalogue_card(id: &str) -> Option<&'static Card> {
    if id.is_empty() || id.len() > 16 {
        return None;
    }
    card_by_id(id)
}

/// Whether a teen account that has spent `spent_today` may spend `amount` more today.
pub fn teen_allows(spent_today: i64, amount: i32) -> bool {
    spent_today + i64::from(amount) <= i64::from(RULES.teen_daily_spend)
}

fn of_rarity(rarity: &str, roll: &mut impl FnMut(u32) -> u32) -> &'static Card {
    let pool: Vec<&'static Card> = CARDS.iter().filter(|c| c.rarity == rarity).collect();
    if pool.is_empty() {
        return &CARDS[0];
    }
    pool[roll(pool.len() as u32) as usize % pool.len()]
}

/// One card: a rarity by the weights, then a card of that rarity, each equally likely. `roll(n)`
/// is a uniform draw from `0..n`: the server passes its own randomness (never the client's), the
/// tests a fixed sequence.
pub fn draw_card(roll: &mut impl FnMut(u32) -> u32) -> &'static Card {
    let weight = |r: &str| RULES.packs.weights.get(r).copied().unwrap_or(0);
    let total: u32 = RARITIES.iter().map(|r| weight(r)).sum();
    let mut pick = roll(total.max(1));
    let mut rarity = RARITIES[0];
    for r in RARITIES {
        if pick < weight(r) {
            rarity = r;
            break;
        }
        pick -= weight(r);
    }
    of_rarity(rarity, roll)
}

/// A pack of a tier: its guaranteed card first, then ordinary draws.
pub fn draw_pack(tier: &Tier, roll: &mut impl FnMut(u32) -> u32) -> Vec<&'static Card> {
    let mut cards = Vec::with_capacity(tier.cards);
    if let Some(rarity) = &tier.guaranteed {
        cards.push(of_rarity(rarity, roll));
    }
    while cards.len() < tier.cards {
        cards.push(draw_card(roll));
    }
    cards
}

/// `count` ordinary draws (the free starter and daily packs).
pub fn draw_free(count: usize, roll: &mut impl FnMut(u32) -> u32) -> Vec<&'static Card> {
    (0..count).map(|_| draw_card(roll)).collect()
}

/// What a one-time import of a device's collection takes.
#[derive(Debug, PartialEq, Eq)]
pub struct ImportChoice {
    /// Card ids to grant, one copy each.
    pub take: Vec<String>,
    /// Different cards asked for and not taken: over a cap, not in the catalogue, or a
    /// starter character (every account holds those already).
    pub left_out: usize,
}

/// Which of a device's cards an account takes on its one import: one copy of each different
/// card, the rarest first, at most `import.max_cards` in all and at most `max_by_rarity` of a
/// rarity. A device's collection is whatever its browser storage says, so this is the most any
/// forged collection can bring (docs/ECONOMY.md, "The one-time import").
pub fn choose_import(asked: &[String]) -> ImportChoice {
    let starter = starter_characters();
    let mut seen = std::collections::HashSet::new();
    let distinct: Vec<&String> = asked.iter().filter(|id| seen.insert(id.as_str())).collect();
    let mut known: Vec<&'static Card> = distinct
        .iter()
        .filter_map(|id| catalogue_card(id))
        .filter(|c| !starter.contains(&c.id))
        .collect();
    let index = |c: &Card| CARDS.iter().position(|k| k.id == c.id).unwrap_or(usize::MAX);
    known.sort_by(|a, b| rarity_rank(&b.rarity).cmp(&rarity_rank(&a.rarity)).then(index(a).cmp(&index(b))));
    let mut per_rarity: HashMap<&str, usize> = HashMap::new();
    let mut take = Vec::new();
    for card in known {
        if take.len() >= RULES.import.max_cards {
            break;
        }
        let cap = RULES.import.max_by_rarity.get(card.rarity.as_str()).copied().unwrap_or(usize::MAX);
        let had = per_rarity.entry(card.rarity.as_str()).or_insert(0);
        if *had >= cap {
            continue;
        }
        *had += 1;
        take.push(card.id.clone());
    }
    ImportChoice { left_out: distinct.len() - take.len(), take }
}

/// What the server knows of an account, for its achievements.
#[derive(Debug, Default, Clone, Copy)]
pub struct Metrics {
    pub online_wins: i64,
    pub online_matches: i64,
    pub online_rounds: i64,
    pub best_round: i64,
    pub unique_cards: i64,
    pub packs_opened: i64,
}

impl Metrics {
    fn get(&self, metric: Metric) -> i64 {
        match metric {
            Metric::OnlineWins => self.online_wins,
            Metric::OnlineMatches => self.online_matches,
            Metric::OnlineRounds => self.online_rounds,
            Metric::BestRound => self.best_round,
            Metric::UniqueCards => self.unique_cards,
            Metric::PacksOpened => self.packs_opened,
        }
    }
}

/// The account achievements these numbers reach. Achievements the server cannot see (trivia,
/// quote challenges, solo duels) are not among them: they stay on the device.
pub fn reached(metrics: &Metrics) -> Vec<&'static str> {
    RULES
        .account_achievements
        .iter()
        .filter(|a| metrics.get(a.metric) >= a.goal)
        .map(|a| a.id.as_str())
        .collect()
}

/// Whether an online win pays credits: the winner has been paid for fewer than
/// `win_credits_per_day` wins today, and for fewer than `win_credits_per_opponent_per_day` of
/// them against this opponent (two accounts trading wins between them earn little).
pub fn online_win_pays(paid_today: i64, paid_against_opponent_today: i64) -> bool {
    paid_today < RULES.online.win_credits_per_day && paid_against_opponent_today < RULES.online.win_credits_per_opponent_per_day
}

/// Whether an online match pays XP to its players, given how many matches the same two accounts
/// have finished today before it: fewer than `xp_matches_per_opponent_per_day`. (Each player's own
/// daily count, `xp_matches_per_day`, is kept by the ledger.)
pub fn online_xp_pays(matches_together_today: i64) -> bool {
    matches_together_today < RULES.online.xp_matches_per_opponent_per_day
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A roll that answers each draw from a list, in turn.
    fn rolls(values: &[u32]) -> impl FnMut(u32) -> u32 + '_ {
        let mut i = 0;
        move |n| {
            let v = values[i % values.len()] % n;
            i += 1;
            v
        }
    }

    #[test]
    fn the_rules_load_and_every_solo_source_pays_a_fixed_capped_amount() {
        let sources: Vec<&str> = {
            let mut s: Vec<&str> = RULES.solo.credits.keys().map(String::as_str).collect();
            s.sort();
            s
        };
        assert_eq!(sources, ["challenge", "daily", "solo_win", "trivia"]);
        for (name, rate) in RULES.solo.credits.iter().chain(RULES.solo.xp.iter()) {
            assert!(rate.amount > 0 && rate.per_day > 0, "{name}: {rate:?}");
        }
        assert_eq!(RULES.solo.xp.len(), RULES.solo.credits.len());
        assert!(solo_credits("anything_else").is_none());
        assert!(solo_xp("battle").is_none(), "the old XP source names are not sources");
    }

    #[test]
    fn every_card_has_a_rarity_the_draw_knows() {
        for card in CARDS.iter() {
            assert!(RARITIES.contains(&card.rarity.as_str()), "{} has rarity {:?}", card.id, card.rarity);
        }
        for r in RARITIES {
            assert!(RULES.packs.weights.get(r).copied().unwrap_or(0) > 0, "{r} has no weight");
            assert!(CARDS.iter().any(|c| c.rarity == r), "no card is {r}");
        }
    }

    #[test]
    fn a_draw_picks_the_rarity_by_its_weight() {
        // Weights 50/30/15/4/1 over 100: each roll value lands in exactly one band.
        let total: u32 = RULES.packs.weights.values().sum();
        let mut counts: HashMap<String, u32> = HashMap::new();
        for v in 0..total {
            let values = [v, 0];
            let mut seq = rolls(&values);
            *counts.entry(draw_card(&mut seq).rarity.clone()).or_default() += 1;
        }
        for r in RARITIES {
            assert_eq!(counts.get(r).copied().unwrap_or(0), RULES.packs.weights[r], "{r}");
        }
    }

    #[test]
    fn a_tier_pack_holds_its_guaranteed_card_and_its_count() {
        for tier in &RULES.packs.tiers {
            // Every other roll lands on Common: only the guarantee can lift the pack.
            let cards = draw_pack(tier, &mut rolls(&[0]));
            assert_eq!(cards.len(), tier.cards, "{}", tier.tier);
            if let Some(g) = &tier.guaranteed {
                assert_eq!(&cards[0].rarity, g, "{}", tier.tier);
                assert!(cards[1..].iter().all(|c| c.rarity == "Common"));
            } else {
                assert!(cards.iter().all(|c| c.rarity == "Common"));
            }
        }
        assert!(tier("standard").is_some() && tier("gold").is_none());
    }

    #[test]
    fn an_import_takes_at_most_its_caps_the_rarest_first_and_no_starter() {
        let every: Vec<String> = CARDS.iter().map(|c| c.id.clone()).collect();
        let mut asked = every.clone();
        asked.extend(every.iter().cloned()); // duplicates count once
        asked.push("XX-999".into()); // not a card
        asked.push("A-VERY-LONG-CARD-ID-INDEED".into());
        let choice = choose_import(&asked);
        assert_eq!(choice.take.len(), RULES.import.max_cards);
        let rarity_of = |id: &String| card_by_id(id).unwrap().rarity.clone();
        for (r, cap) in &RULES.import.max_by_rarity {
            let n = choice.take.iter().filter(|id| &rarity_of(id) == r).count();
            assert_eq!(n, *cap, "{r}: the cap is filled when the device offers that many");
        }
        let starter = starter_characters();
        assert!(choice.take.iter().all(|id| !starter.contains(id)));
        assert_eq!(choice.left_out, every.len() + 2 - choice.take.len());
        // Rarest first: the order of the take never goes up a rarity.
        let ranks: Vec<usize> = choice.take.iter().map(|id| rarity_rank(&rarity_of(id))).collect();
        assert!(ranks.windows(2).all(|w| w[0] >= w[1]), "{ranks:?}");

        // A small honest collection comes over whole.
        let few: Vec<String> = ["DC-001", "MO-002", "DC-001"].iter().map(|s| s.to_string()).collect();
        let choice = choose_import(&few);
        assert_eq!(choice.take.len(), 2);
        assert_eq!(choice.left_out, 0);
    }

    #[test]
    fn a_card_id_too_long_for_the_table_is_no_card() {
        assert!(catalogue_card("DC-001").is_some());
        assert!(catalogue_card("").is_none());
        assert!(catalogue_card("ABCDEFGHIJKLMNOPQ").is_none());
        assert!(catalogue_card("DC-001 ").is_none());
    }

    #[test]
    fn account_achievements_are_the_servers_own_and_reached_at_their_goals() {
        assert!(reached(&Metrics::default()).is_empty());
        for a in &RULES.account_achievements {
            let mut m = Metrics::default();
            let set = |m: &mut Metrics, v: i64| match a.metric {
                Metric::OnlineWins => m.online_wins = v,
                Metric::OnlineMatches => m.online_matches = v,
                Metric::OnlineRounds => m.online_rounds = v,
                Metric::BestRound => m.best_round = v,
                Metric::UniqueCards => m.unique_cards = v,
                Metric::PacksOpened => m.packs_opened = v,
            };
            set(&mut m, a.goal - 1);
            assert!(!reached(&m).contains(&a.id.as_str()), "{} below its goal", a.id);
            set(&mut m, a.goal);
            assert!(reached(&m).contains(&a.id.as_str()), "{} at its goal", a.id);
        }
        // Nothing a server cannot see is an account achievement.
        for device_only in ["scholar-novice", "quotable", "scholar", "challenge-master", "trivia-starter"] {
            assert!(!RULES.account_achievements.iter().any(|a| a.id == device_only), "{device_only}");
        }
    }

    #[test]
    fn a_founding_player_is_one_made_before_the_files_date() {
        use chrono::TimeZone;
        let before = chrono::NaiveDate::parse_from_str(&RULES.founding.created_before, "%Y-%m-%d").expect("a date");
        let midnight = chrono::Utc.from_utc_datetime(&before.and_hms_opt(0, 0, 0).unwrap());
        assert!(RULES.founding.applies_to(midnight - chrono::Duration::seconds(1)));
        assert!(!RULES.founding.applies_to(midnight));
        assert!(!RULES.founding.applies_to(chrono::Utc::now()), "nobody made today is a founding player");
    }

    #[test]
    fn online_xp_pays_for_a_few_matches_a_day_between_the_same_two() {
        assert!(online_xp_pays(0));
        assert!(online_xp_pays(RULES.online.xp_matches_per_opponent_per_day - 1));
        assert!(!online_xp_pays(RULES.online.xp_matches_per_opponent_per_day));
        assert!(RULES.online.xp_matches_per_opponent_per_day < RULES.online.xp_matches_per_day);
    }

    #[test]
    fn online_wins_pay_within_both_caps() {
        assert!(online_win_pays(0, 0));
        assert!(!online_win_pays(RULES.online.win_credits_per_day, 0));
        assert!(!online_win_pays(0, RULES.online.win_credits_per_opponent_per_day));
        assert!(teen_allows(0, RULES.teen_daily_spend));
        assert!(!teen_allows(1, RULES.teen_daily_spend));
    }
}
