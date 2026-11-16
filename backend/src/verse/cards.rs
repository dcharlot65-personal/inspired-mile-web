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

/// Names that count as an invocation: each word of each character's name, without a
/// leading "The " (`CHARACTER_NAMES` in duel.ts).
pub static CHARACTER_NAMES: LazyLock<Vec<String>> = LazyLock::new(|| {
    CARDS
        .iter()
        .filter(|c| c.is_character())
        .flat_map(|c| js_split_space(c.name.strip_prefix("The ").unwrap_or(&c.name)))
        .collect()
});

/// JavaScript's `s.split(/\s+/)`: unlike `split_whitespace`, leading or trailing space
/// leaves an empty first or last piece.
fn js_split_space(s: &str) -> Vec<String> {
    let mut out = vec![String::new()];
    let mut in_space = false;
    for c in s.chars() {
        if super::text::is_js_space(c) {
            in_space = true;
        } else {
            if in_space {
                out.push(String::new());
                in_space = false;
            }
            out.last_mut().expect("never empty").push(c);
        }
    }
    if in_space {
        out.push(String::new());
    }
    out
}

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
    fn names_split_as_javascript_splits_them() {
        assert_eq!(js_split_space("Sonnet Man"), ["Sonnet", "Man"]);
        assert_eq!(js_split_space(" a  b "), ["", "a", "b", ""]);
        assert!(CHARACTER_NAMES.iter().any(|n| n == "Sonnet"));
        assert!(!CHARACTER_NAMES.iter().any(|n| n == "The"));
    }
}
