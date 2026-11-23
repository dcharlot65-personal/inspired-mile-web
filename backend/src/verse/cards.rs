//! The card catalogue, as far as scoring needs it: id, name, type, house and quotation.
//!
//! `backend/data/cards.json` is generated from `src/lib/cards.ts` (the single source of
//! truth) by `scripts/gen-verse-golden.sh`; a vitest test fails when it is out of date.

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct Card {
    pub id: String,
    pub name: String,
    /// "Character", "Relic" or "Potion".
    #[serde(rename = "type")]
    pub kind: String,
    pub house: String,
    pub quote: String,
    /// "Common" to "Legendary": what the server's packs draw by (`crate::economy`). Scoring
    /// never reads it.
    #[serde(default)]
    pub rarity: String,
}

impl Card {
    pub fn is_character(&self) -> bool {
        self.kind == "Character"
    }
}

const CARDS_JSON: &str = include_str!("../../data/cards.json");

pub static CARDS: LazyLock<Vec<Card>> =
    LazyLock::new(|| serde_json::from_str(CARDS_JSON).expect("backend/data/cards.json is valid card data"));

static BY_ID: LazyLock<HashMap<&'static str, &'static Card>> =
    LazyLock::new(|| CARDS.iter().map(|c| (c.id.as_str(), c)).collect());

pub fn card_by_id(id: &str) -> Option<&'static Card> {
    BY_ID.get(id).copied()
}

/// The characters every account may field online without holding them: the first
/// `ROUNDS` characters of the catalogue, which is what a new player's starter deck holds
/// (`starterDeck([])` in duel.ts; `ONLINE_STARTER` in multiplayer-rules.ts).
pub fn starter_characters() -> Vec<String> {
    CARDS.iter().filter(|c| c.is_character()).take(super::duel::ROUNDS).map(|c| c.id.clone()).collect()
}

/// What the server needs of the English language pack (`src/lib/verse/packs/en.ts`) beyond
/// the words written into the rules: the letters its texts are written in, which a curse
/// reads a look-alike letter as (`nativeLetters('en')` in text.ts). Generated with
/// `cards.json` by `scripts/gen-verse-golden.sh`; a vitest test fails when it is out of date.
#[derive(Debug, Deserialize)]
struct EnglishPack {
    letters: Vec<char>,
}

const ENGLISH_JSON: &str = include_str!("../../data/english.json");

static ENGLISH: LazyLock<EnglishPack> =
    LazyLock::new(|| serde_json::from_str(ENGLISH_JSON).expect("backend/data/english.json is valid pack data"));

/// The letters of the English pack's texts, folded.
pub fn english_letters() -> &'static [char] {
    &ENGLISH.letters
}

/// Names that count as an invocation (`CHARACTER_NAMES` in duel.ts): each character's
/// full name, and its last part alone when that is a name and not an ordinary word.
pub static CHARACTER_NAMES: LazyLock<Vec<String>> = LazyLock::new(|| {
    super::devices::invocation_names(CARDS.iter().filter(|c| c.is_character()).map(|c| c.name.as_str()))
});

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_catalogue_loads_and_ids_are_unique() {
        assert!(CARDS.len() >= 50);
        assert_eq!(BY_ID.len(), CARDS.len());
        let hamlet = card_by_id("DC-001").expect("Hamlet is in the catalogue");
        assert_eq!(hamlet.name, "Hamlet");
        assert!(hamlet.is_character());
        assert!(card_by_id("nope").is_none());
    }

    #[test]
    fn a_character_is_called_on_by_name_not_by_an_ordinary_word() {
        for name in ["Hamlet", "Sonnet Man", "The Nurse", "Antony", "Mark Antony", "Macbeth", "Lady Macbeth", "Nick Bottom"] {
            assert!(CHARACTER_NAMES.iter().any(|n| n == name), "{name}");
        }
        for word in ["The", "Man", "Sonnet", "Nurse", "Bottom", "King", "Lady", "Mark", "Lord"] {
            assert!(!CHARACTER_NAMES.iter().any(|n| n == word), "{word}");
        }
    }
}
