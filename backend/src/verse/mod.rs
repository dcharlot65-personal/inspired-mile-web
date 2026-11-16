//! The verse duel's rules, in Rust: the scoring the multiplayer server is the authority for.
//!
//! This is a port, for English, of the TypeScript engine in `src/lib/verse/`: cleaning a
//! verse, words, syllables and rhyme by sound (the pronunciation table), the forms, the
//! devices, the signature echo, curses, power words, the floor a verse must clear and the
//! test for a copied one, `scoreVerse`, the rule-based judge and round resolution. No
//! language model and no randomness take part: the same verses always get the same numbers.
//!
//! The port is held to the TypeScript by golden vectors. `src/lib/multiplayer-golden.test.ts`
//! writes what the TypeScript answers for a few thousand cases into `backend/tests/golden/`,
//! and `backend/tests/verse_parity.rs` requires this module to answer the same. If the two
//! disagree, find out which is wrong and fix it; do not loosen the comparison.
//!
//! What is deliberately not ported: the human-readable `detail` and `label` strings (the
//! browser writes those from its own copy of the rules, in the player's language), the
//! model-based judge, the written opponent, and single-player match set-up (`createDuel`,
//! `opponentDeck`, ink).

pub mod cards;
pub mod devices;
pub mod duel;
pub mod forms;
pub mod judge;
pub mod pronounce;
pub mod text;

pub use cards::{card_by_id, Card, CARDS};
pub use duel::{
    online_deck_problem, online_match_winner, online_plan, resolve_online_round, score_verse, settle_verse, MatchWinner,
    OnlineRound, OnlineSide, RoundPlan, RoundWinner, ScoreInput, VerseScore, Voided, ONLINE_DECK_MAX, ONLINE_DECK_MIN,
    ROUNDS, SETTLE_PASSES,
};
pub use text::{clean_verse, MAX_VERSE_CHARS, MAX_VERSE_LINES};

/// The one language the server scores in. The TypeScript engine takes a language; every
/// function here that takes one is called with this.
pub const LANG: &str = "en";
