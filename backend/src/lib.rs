//! The parts of the API that are pure rules and are tested from outside the server:
//! `tests/verse_parity.rs` holds the verse engine to the TypeScript one; `economy` is every
//! amount, rate and cap of the game's economy (docs/ECONOMY.md).

pub mod economy;
pub mod verse;
