//! Online play: rooms, the quick-match queue, the content filter and the WebSocket.
//!
//! Every score in an online match is worked out on the server by the rules in
//! `inspired_mile_api::verse` (see `game_room.rs`). No language model is called from here
//! or from anywhere else in the API.

pub mod content_filter;
pub mod game_room;
pub mod handlers;
pub mod matchmaking;

pub use game_room::RoomManager;
pub use handlers::router;
pub use matchmaking::MatchmakingQueue;
