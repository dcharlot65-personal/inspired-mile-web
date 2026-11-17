//! A room: two seats and one best-of-three duel of verses, decided by the server.
//!
//! The server picks the seed, and the seed draws the three forms. Each round both players
//! write under the same form, each choosing one character from their deck (each character
//! once per match), and submit. When both verses are in, or the round's time is up, the
//! server scores both with the rules in `inspired_mile_api::verse` and sends each player
//! the whole breakdown. No language model and no randomness take part in a score, and
//! nothing a client sends is ever read as a score.
//!
//! `GameRoom` is a plain state machine: every method is synchronous, takes what happened,
//! changes the room and queues events for the two players. What needs a clock (a round
//! running out, a disconnected player's grace) comes back as an [`Effect`] for the caller
//! to arm with [`run_effects`]. That keeps the rules of the room testable without sockets.
//!
//! Not in this first version: relics, potions and ink. Decks are character cards only: the
//! starter characters, and the characters the account holds (checked against the server's
//! record of its cards in `handlers.rs` before a deck reaches a room).
//!
//! Online duels are English only: the room scores with the server's port of the English
//! rules, and a client that asks for another language is refused (`handlers.rs`).

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

use inspired_mile_api::verse::judge::Verdict;
use inspired_mile_api::verse::text::unknown_character;
use inspired_mile_api::verse::{
    card_by_id, online_deck_problem, online_match_winner, online_plan, resolve_online_round, settle_verse, MatchWinner,
    OnlineSide, RoundPlan, RoundWinner, VerseScore, LANG, MAX_VERSE_CHARS, MAX_VERSE_LINES, ONLINE_DECK_MAX,
    ONLINE_DECK_MIN,
};

use super::content_filter;

/// Longest verse text a client may send, in bytes. A cleaned verse is at most
/// `MAX_VERSE_CHARS` UTF-16 units, which is never more than 1800 bytes of UTF-8; the page
/// sends the settled (cleaned) verse, so anything longer than this did not come from the page.
pub const MAX_VERSE_BYTES: usize = 2000;
/// Events that may wait for one player's connection before it is dropped as too slow.
pub const EVENT_BUFFER: usize = 32;
/// Rooms the server will hold at once.
pub const MAX_ROOMS: usize = 500;
/// Rooms one account may hold a seat in at once, finished ones aside: a match and a room
/// waiting for a friend, with one to spare. Two accounts that queue against each other again
/// and again cannot fill the server.
pub const MAX_ROOMS_PER_USER: usize = 3;
/// Rooms opened from one network at once (an IPv4 address, or an IPv6 /64: one connection
/// owns a whole /64), finished ones aside. A family or a classroom behind one address shares
/// this, so it is not tight; it bounds what many accounts on one network can hold.
pub const MAX_ROOMS_PER_ADDRESS: usize = 12;
/// How long a room that has not started may stand with nobody connected to it.
const UNVISITED_ROOM: Duration = Duration::from_secs(300);

/// How long things may take.
#[derive(Clone, Copy, Debug)]
pub struct Timing {
    /// Time to write and submit a verse. A player who has not submitted by then has
    /// submitted nothing.
    pub round: Duration,
    /// Time a disconnected player has to come back before the match goes to the other.
    pub reconnect: Duration,
    /// Time a quick-match player waits for the opponent they were paired with to arrive,
    /// before the room is closed and they are told to look again.
    pub arrival: Duration,
}

impl Default for Timing {
    fn default() -> Self {
        Self { round: Duration::from_secs(180), reconnect: Duration::from_secs(45), arrival: Duration::from_secs(60) }
    }
}

/// Room lifecycle states.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RoomState {
    Waiting,
    InProgress,
    Completed,
}

/// One side or the other, as the player receiving the event sees it.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    You,
    Opponent,
    Draw,
    Split,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EndReason {
    /// One side took more rounds.
    Rounds,
    /// Rounds were level; decided on points over the whole match (which may also be level).
    Points,
    Forfeit,
    /// A player left and did not come back in time.
    Disconnect,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
pub struct Pair {
    pub you: u32,
    pub opponent: u32,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct PlayerView {
    pub username: String,
    pub deck: Vec<String>,
    /// Characters already played this match.
    pub used: Vec<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct SideView {
    pub char_id: String,
    /// The verse as scored: cleaned and capped.
    pub verse: String,
    /// True when no verse arrived in time and the round was scored without one.
    pub timed_out: bool,
    pub score: VerseScore,
    /// This side's share of the judge's pool.
    pub judge: u32,
    pub total: u32,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct CriteriaView {
    pub wordplay: Side,
    pub allusion: Side,
    pub flow: Side,
    pub wit: Side,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct RoundView {
    pub round: usize,
    pub form_id: String,
    pub acrostic: Option<String>,
    pub you: SideView,
    pub opponent: SideView,
    pub criteria: CriteriaView,
    pub winner: Side,
    /// Rounds taken so far, this one included.
    pub rounds_won: Pair,
    /// Points over the match so far, this round included.
    pub totals: Pair,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Limits {
    pub max_verse_chars: usize,
    pub max_verse_lines: usize,
    pub deck_min: usize,
    pub deck_max: usize,
    pub round_seconds: u64,
}

/// Server → client events. Each is written for the player it is sent to: "you" is them.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerEvent {
    RoomJoined {
        room_id: Uuid,
        state: RoomState,
        /// The other player's name, once there is one.
        opponent: Option<String>,
    },
    /// The whole match as it stands. Sent when the match starts and again to a player who
    /// reconnects, so a page can rebuild itself from this one event.
    MatchStart {
        room_id: Uuid,
        /// 0 or 1. Seat 0 is side "a" of the rules, for a page that recomputes a round.
        seat: usize,
        seed: u32,
        lang: &'static str,
        rounds: Vec<RoundPlan>,
        you: PlayerView,
        opponent: PlayerView,
        limits: Limits,
        /// Rounds already decided, oldest first.
        results: Vec<RoundView>,
    },
    RoundStart {
        round: usize,
        form_id: String,
        acrostic: Option<String>,
        seconds_left: u64,
        /// Whether this player's verse for the round is already in.
        submitted: bool,
        opponent_submitted: bool,
    },
    VerseAccepted {
        round: usize,
    },
    OpponentSubmitted {
        round: usize,
    },
    RoundResult(RoundView),
    MatchComplete {
        winner: Side,
        reason: EndReason,
        rounds_won: Pair,
        totals: Pair,
    },
    OpponentDisconnected {
        grace_seconds: u64,
    },
    OpponentReconnected,
    Error {
        code: &'static str,
        message: String,
    },
}

/// Client → server events. There is no field here, or anywhere, for a score.
#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientEvent {
    JoinRoom {
        room_id: Uuid,
        #[serde(default)]
        deck: Vec<String>,
        /// The duel's language. Online duels are English only (`LANG`); a page that does not
        /// say is taken to mean English.
        #[serde(default = "english")]
        lang: String,
    },
    SubmitVerse {
        round: usize,
        char_id: String,
        text: String,
    },
    Forfeit,
}

fn english() -> String {
    LANG.to_string()
}

/// Why the room refused something. Nothing changes in the room when it does.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RoomError {
    NotFound,
    Full,
    ServerFull,
    BadDeck(String),
    NotInRoom,
    NotPlaying,
    WrongRound,
    AlreadySubmitted,
    VerseTooLong,
    EmptyVerse,
    NotInDeck,
    CharacterUsed,
    Filtered(String),
    /// The verse holds a character newer than the server's Unicode tables (`unknown_character`).
    UnknownCharacter(char),
    /// The account already holds seats in `MAX_ROOMS_PER_USER` rooms.
    TooManyRooms,
    /// Its network already holds `MAX_ROOMS_PER_ADDRESS` rooms.
    TooManyFromAddress,
}

impl RoomError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound => "room_not_found",
            Self::Full => "room_full",
            Self::ServerFull => "server_full",
            Self::BadDeck(_) => "bad_deck",
            Self::NotInRoom => "not_in_room",
            Self::NotPlaying => "not_playing",
            Self::WrongRound => "wrong_round",
            Self::AlreadySubmitted => "already_submitted",
            Self::VerseTooLong => "verse_too_long",
            Self::EmptyVerse => "empty_verse",
            Self::NotInDeck => "not_in_deck",
            Self::CharacterUsed => "character_used",
            Self::Filtered(_) => "content_rejected",
            Self::UnknownCharacter(_) => "unknown_character",
            Self::TooManyRooms => "too_many_rooms",
            Self::TooManyFromAddress => "too_many_rooms_here",
        }
    }

    pub fn message(&self) -> String {
        match self {
            Self::NotFound => "That room does not exist or has closed.".into(),
            Self::Full => "That room already has two players.".into(),
            Self::ServerFull => "The server is full. Try again in a few minutes.".into(),
            Self::BadDeck(why) => why.clone(),
            Self::NotInRoom => "You are not in that room.".into(),
            Self::NotPlaying => "No round is being played.".into(),
            Self::WrongRound => "That round is not the one being played.".into(),
            Self::AlreadySubmitted => "Your verse for this round is already in.".into(),
            Self::VerseTooLong => "That verse is too long.".into(),
            Self::EmptyVerse => "A verse needs at least one word.".into(),
            Self::NotInDeck => "That character is not in your deck.".into(),
            Self::CharacterUsed => "Each character can take the stage once per match.".into(),
            Self::Filtered(why) => why.clone(),
            Self::UnknownCharacter(c) => format!(
                "Your verse holds a character the game cannot read yet (U+{:04X}). Take it out and send the verse again.",
                u32::from(*c)
            ),
            Self::TooManyRooms => {
                "You already have duels open. Finish one, or leave the room you opened, before you start another.".into()
            }
            Self::TooManyFromAddress => "Too many duels are open from your network right now. Try again in a few minutes.".into(),
        }
    }

    pub fn event(&self) -> ServerEvent {
        ServerEvent::Error { code: self.code(), message: self.message() }
    }
}

/// Something the room needs done later. See [`run_effects`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Effect {
    /// When the round's time is up, call `expire_round(round)`.
    RoundTimer { round: usize },
    /// When the grace is over, call `abandon(user_id, conn)`.
    GraceTimer { user_id: Uuid, conn: u64 },
    /// When a paired opponent has had time to arrive, call `arrival_expired()`.
    ArrivalTimer,
}

struct Seat {
    user_id: Uuid,
    username: String,
    /// Held for this user from the start (the creator of a private room, both players of a
    /// queue match). A seat that is not reserved is given up if its player leaves before
    /// the match starts.
    reserved: bool,
    /// Empty until the player has joined with a deck.
    deck: Vec<String>,
    used: Vec<String>,
    /// The player's connection, if they have one. Dropping it closes that connection.
    tx: Option<mpsc::Sender<ServerEvent>>,
    /// Which connection `tx` is: a late goodbye from an older one must not count.
    conn: u64,
}

impl Seat {
    fn joined(&self) -> bool {
        !self.deck.is_empty()
    }
}

struct Pending {
    char_id: String,
    verse: String,
}

struct StoredSide {
    char_id: String,
    verse: String,
    timed_out: bool,
    score: VerseScore,
    judge: u32,
    total: u32,
}

struct StoredRound {
    sides: [StoredSide; 2],
    /// In the order of the rules' `CRITERIA`; `Player` is seat 0.
    criteria: [Verdict; 4],
    winner: RoundWinner,
}

pub struct GameRoom {
    id: Uuid,
    state: RoomState,
    seats: Vec<Seat>,
    seed: u32,
    plan: Vec<RoundPlan>,
    round: usize,
    pending: [Option<Pending>; 2],
    results: Vec<StoredRound>,
    ended: Option<(MatchWinner, EndReason)>,
    timing: Timing,
    created_at: Instant,
    round_started_at: Instant,
    completed_at: Option<Instant>,
    next_conn: u64,
    /// The networks the room was opened from (`address_key`), for `MAX_ROOMS_PER_ADDRESS`.
    origins: Vec<String>,
    /// Both seats were held from the start (a quick match): the first to arrive waits
    /// `Timing::arrival` for the other.
    paired: bool,
    arrival_armed: bool,
    /// Closed before it began: the paired opponent never came.
    closed: bool,
}

impl GameRoom {
    /// A room with these seats held. `seed` decides the three forms.
    pub fn new(id: Uuid, seed: u32, reserved: &[(Uuid, String)], timing: Timing) -> Self {
        let seats = reserved
            .iter()
            .take(2)
            .map(|(user_id, username)| Seat {
                user_id: *user_id,
                username: username.clone(),
                reserved: true,
                deck: Vec::new(),
                used: Vec::new(),
                tx: None,
                conn: 0,
            })
            .collect();
        let now = Instant::now();
        Self {
            id,
            state: RoomState::Waiting,
            seats,
            seed,
            plan: online_plan(seed),
            round: 0,
            pending: [None, None],
            results: Vec::new(),
            ended: None,
            timing,
            created_at: now,
            round_started_at: now,
            completed_at: None,
            next_conn: 1,
            origins: Vec::new(),
            paired: reserved.len() >= 2,
            arrival_armed: false,
            closed: false,
        }
    }

    /// Whether the room still counts against its players' and network's limits.
    fn live(&self) -> bool {
        self.state != RoomState::Completed
    }

    pub fn state(&self) -> RoomState {
        self.state
    }

    pub fn player_count(&self) -> usize {
        self.seats.len()
    }

    pub fn has_player(&self, user_id: Uuid) -> bool {
        self.seat_of(user_id).is_some()
    }

    /// Whether a player who has no seat yet could take one.
    pub fn has_open_seat(&self) -> bool {
        self.state == RoomState::Waiting && self.seats.len() < 2
    }

    fn seat_of(&self, user_id: Uuid) -> Option<usize> {
        self.seats.iter().position(|s| s.user_id == user_id)
    }

    fn send(&mut self, seat: usize, event: ServerEvent) {
        let Some(s) = self.seats.get_mut(seat) else { return };
        if let Some(tx) = &s.tx {
            if tx.try_send(event).is_err() {
                // Gone, or too slow to keep up: drop the connection. Its handler sees the
                // channel close, closes the socket and reports the disconnect.
                s.tx = None;
            }
        }
    }

    fn limits(&self) -> Limits {
        Limits {
            max_verse_chars: MAX_VERSE_CHARS,
            max_verse_lines: MAX_VERSE_LINES,
            deck_min: ONLINE_DECK_MIN,
            deck_max: ONLINE_DECK_MAX,
            round_seconds: self.timing.round.as_secs(),
        }
    }

    fn seconds_left(&self) -> u64 {
        self.timing.round.saturating_sub(self.round_started_at.elapsed()).as_secs()
    }

    fn player_view(&self, seat: usize) -> PlayerView {
        let s = &self.seats[seat];
        PlayerView { username: s.username.clone(), deck: s.deck.clone(), used: s.used.clone() }
    }

    /// Rounds taken and points scored over the first `upto` rounds, for seat 0 and seat 1.
    fn tally(&self, upto: usize) -> ([u32; 2], [u32; 2]) {
        let mut won = [0, 0];
        let mut points = [0, 0];
        for r in self.results.iter().take(upto) {
            match r.winner {
                RoundWinner::A => won[0] += 1,
                RoundWinner::B => won[1] += 1,
                RoundWinner::Draw => {}
            }
            points[0] += r.sides[0].total;
            points[1] += r.sides[1].total;
        }
        (won, points)
    }

    fn round_view(&self, index: usize, seat: usize) -> RoundView {
        let r = &self.results[index];
        let other = 1 - seat;
        let side = |s: &StoredSide| SideView {
            char_id: s.char_id.clone(),
            verse: s.verse.clone(),
            timed_out: s.timed_out,
            score: s.score.clone(),
            judge: s.judge,
            total: s.total,
        };
        let took = |v: Verdict| match v {
            Verdict::Split => Side::Split,
            Verdict::Player => if seat == 0 { Side::You } else { Side::Opponent },
            Verdict::Opponent => if seat == 1 { Side::You } else { Side::Opponent },
        };
        let (won, points) = self.tally(index + 1);
        RoundView {
            round: index,
            form_id: self.plan[index].form_id.clone(),
            acrostic: self.plan[index].acrostic.clone(),
            you: side(&r.sides[seat]),
            opponent: side(&r.sides[other]),
            criteria: CriteriaView {
                wordplay: took(r.criteria[0]),
                allusion: took(r.criteria[1]),
                flow: took(r.criteria[2]),
                wit: took(r.criteria[3]),
            },
            winner: match r.winner {
                RoundWinner::Draw => Side::Draw,
                RoundWinner::A => if seat == 0 { Side::You } else { Side::Opponent },
                RoundWinner::B => if seat == 1 { Side::You } else { Side::Opponent },
            },
            rounds_won: Pair { you: won[seat], opponent: won[other] },
            totals: Pair { you: points[seat], opponent: points[other] },
        }
    }

    fn match_start_event(&self, seat: usize) -> ServerEvent {
        ServerEvent::MatchStart {
            room_id: self.id,
            seat,
            seed: self.seed,
            lang: LANG,
            rounds: self.plan.clone(),
            you: self.player_view(seat),
            opponent: self.player_view(1 - seat),
            limits: self.limits(),
            results: (0..self.results.len()).map(|i| self.round_view(i, seat)).collect(),
        }
    }

    fn round_start_event(&self, seat: usize) -> ServerEvent {
        let plan = &self.plan[self.round];
        ServerEvent::RoundStart {
            round: self.round,
            form_id: plan.form_id.clone(),
            acrostic: plan.acrostic.clone(),
            seconds_left: self.seconds_left(),
            submitted: self.pending[seat].is_some(),
            opponent_submitted: self.pending[1 - seat].is_some(),
        }
    }

    fn match_complete_event(&self, seat: usize) -> Option<ServerEvent> {
        let (winner, reason) = self.ended?;
        let other = 1 - seat;
        let (won, points) = self.tally(self.results.len());
        Some(ServerEvent::MatchComplete {
            winner: match winner {
                MatchWinner::Draw => Side::Draw,
                MatchWinner::A => if seat == 0 { Side::You } else { Side::Opponent },
                MatchWinner::B => if seat == 1 { Side::You } else { Side::Opponent },
            },
            reason,
            rounds_won: Pair { you: won[seat], opponent: won[other] },
            totals: Pair { you: points[seat], opponent: points[other] },
        })
    }

    /// A player's connection joins the room, for the first time or again.
    ///
    /// Returns the connection's number (to hand back to [`disconnect`](Self::disconnect))
    /// and what to arm. `deck` matters only before the match starts; a player who rejoins
    /// a match in progress keeps the deck they started with.
    pub fn join(
        &mut self,
        user_id: Uuid,
        username: &str,
        deck: &[String],
        tx: mpsc::Sender<ServerEvent>,
    ) -> Result<(u64, Vec<Effect>), RoomError> {
        if self.closed {
            return Err(RoomError::NotFound);
        }
        let seat = match self.seat_of(user_id) {
            Some(seat) => seat,
            None if self.has_open_seat() => self.seats.len(),
            None => return Err(RoomError::Full),
        };
        if self.state == RoomState::Waiting {
            if let Some(problem) = online_deck_problem(deck) {
                return Err(RoomError::BadDeck(problem));
            }
            if seat == self.seats.len() {
                self.seats.push(Seat {
                    user_id,
                    username: username.to_string(),
                    reserved: false,
                    deck: Vec::new(),
                    used: Vec::new(),
                    tx: None,
                    conn: 0,
                });
            }
            self.seats[seat].deck = deck.to_vec();
        }
        let was_connected = self.seats[seat].tx.is_some();
        let conn = self.next_conn;
        self.next_conn += 1;
        // Replacing `tx` drops the older connection's channel, which closes that connection.
        self.seats[seat].tx = Some(tx);
        self.seats[seat].conn = conn;

        let opponent = self.seats.get(1 - seat).map(|s| s.username.clone());
        self.send(seat, ServerEvent::RoomJoined { room_id: self.id, state: self.state, opponent });

        let mut effects = Vec::new();
        match self.state {
            RoomState::Waiting => {
                if self.seats.len() == 2 && self.seats.iter().all(Seat::joined) {
                    self.state = RoomState::InProgress;
                    self.round = 0;
                    self.round_started_at = Instant::now();
                    for s in 0..2 {
                        self.send(s, self.match_start_event(s));
                        self.send(s, self.round_start_event(s));
                    }
                    effects.push(Effect::RoundTimer { round: 0 });
                    // A player who joined and then lost their connection before the other
                    // arrived is on the clock like any other disconnected player.
                    for s in 0..2 {
                        if self.seats[s].tx.is_none() {
                            let grace_seconds = self.timing.reconnect.as_secs();
                            self.send(1 - s, ServerEvent::OpponentDisconnected { grace_seconds });
                            effects.push(Effect::GraceTimer { user_id: self.seats[s].user_id, conn: self.seats[s].conn });
                        }
                    }
                } else if self.paired && !self.arrival_armed {
                    // A quick match: the first to arrive waits a bounded time for the other.
                    self.arrival_armed = true;
                    effects.push(Effect::ArrivalTimer);
                }
            }
            RoomState::InProgress => {
                self.send(seat, self.match_start_event(seat));
                self.send(seat, self.round_start_event(seat));
                if !was_connected {
                    self.send(1 - seat, ServerEvent::OpponentReconnected);
                }
            }
            RoomState::Completed => {
                self.send(seat, self.match_start_event(seat));
                if let Some(done) = self.match_complete_event(seat) {
                    self.send(seat, done);
                }
            }
        }
        Ok((conn, effects))
    }

    /// A player submits their verse for a round. `text` is settled here (cleaned until
    /// cleaning changes nothing, and capped: `settle_verse`); the score is worked out from it
    /// and from nothing else the client said.
    pub fn submit(&mut self, user_id: Uuid, round: usize, char_id: &str, text: &str) -> Result<Vec<Effect>, RoomError> {
        let seat = self.seat_of(user_id).ok_or(RoomError::NotInRoom)?;
        if self.state != RoomState::InProgress {
            return Err(RoomError::NotPlaying);
        }
        if round != self.round {
            return Err(RoomError::WrongRound);
        }
        if self.pending[seat].is_some() {
            return Err(RoomError::AlreadySubmitted);
        }
        if text.len() > MAX_VERSE_BYTES {
            return Err(RoomError::VerseTooLong);
        }
        // A character newer than the server's Unicode tables would not be read the way the
        // page previewed it: refuse the verse rather than score it differently.
        if let Some(c) = unknown_character(text) {
            return Err(RoomError::UnknownCharacter(c));
        }
        if !self.seats[seat].deck.iter().any(|id| id == char_id) {
            return Err(RoomError::NotInDeck);
        }
        if self.seats[seat].used.iter().any(|id| id == char_id) {
            return Err(RoomError::CharacterUsed);
        }
        let verse = settle_verse(text);
        if verse.is_empty() {
            return Err(RoomError::EmptyVerse);
        }
        // The cleaned verse is what the opponent will read; the raw text is checked too, so
        // that nothing stripped by cleaning can have hidden a word from the filter's view.
        for candidate in [verse.as_str(), text] {
            let checked = content_filter::check_content(candidate);
            if !checked.allowed {
                return Err(RoomError::Filtered(
                    checked.reason.unwrap_or_else(|| "Content rejected by moderation filter.".into()),
                ));
            }
        }
        self.pending[seat] = Some(Pending { char_id: char_id.to_string(), verse });
        self.send(seat, ServerEvent::VerseAccepted { round });
        self.send(1 - seat, ServerEvent::OpponentSubmitted { round });
        if self.pending.iter().all(Option::is_some) {
            return Ok(self.resolve());
        }
        Ok(Vec::new())
    }

    /// The opponent of a quick match has had their time to arrive. If the match has not begun,
    /// the room closes: whoever is waiting is told so, and their connection is let go.
    pub fn arrival_expired(&mut self) {
        if self.state != RoomState::Waiting || self.closed {
            return;
        }
        let event = ServerEvent::Error {
            code: "opponent_absent",
            message: "Your opponent did not arrive. Look for another match.".into(),
        };
        for seat in 0..self.seats.len() {
            self.send(seat, event.clone());
            self.seats[seat].tx = None;
        }
        self.closed = true;
        self.state = RoomState::Completed;
        self.completed_at = Some(Instant::now());
    }

    /// The round's time is up. A late timer for a round already decided does nothing.
    pub fn expire_round(&mut self, round: usize) -> Vec<Effect> {
        if self.state != RoomState::InProgress || round != self.round {
            return Vec::new();
        }
        self.resolve()
    }

    /// Score the round with whatever is in, tell both players, and move on.
    fn resolve(&mut self) -> Vec<Effect> {
        let mut sides: Vec<(String, String, bool)> = Vec::with_capacity(2);
        for seat in 0..2 {
            match self.pending[seat].take() {
                Some(p) => sides.push((p.char_id, p.verse, false)),
                None => {
                    // Nothing arrived in time: the first character not yet played takes the
                    // stage and says nothing. A deck has at least as many characters as
                    // there are rounds, so there is always one.
                    let s = &self.seats[seat];
                    let char_id = s.deck.iter().find(|id| !s.used.contains(id)).cloned().unwrap_or_default();
                    sides.push((char_id, String::new(), true));
                }
            }
        }
        let previous = self.results.last().map(|r| [r.sides[0].verse.clone(), r.sides[1].verse.clone()]);
        let outcome = {
            let card = |id: &str| card_by_id(id).expect("a deck holds only cards that exist");
            let a = OnlineSide {
                card: card(&sides[0].0),
                deck: &self.seats[0].deck,
                verse: &sides[0].1,
                previous_opponent_verse: previous.as_ref().map(|p| p[1].as_str()),
            };
            let b = OnlineSide {
                card: card(&sides[1].0),
                deck: &self.seats[1].deck,
                verse: &sides[1].1,
                previous_opponent_verse: previous.as_ref().map(|p| p[0].as_str()),
            };
            resolve_online_round(&self.plan[self.round], &a, &b)
        };
        let mut scored = [outcome.a, outcome.b].into_iter();
        let stored: Vec<StoredSide> = sides
            .into_iter()
            .map(|(char_id, _, timed_out)| {
                let r = scored.next().expect("two sides");
                StoredSide { char_id, verse: r.verse, timed_out, score: r.score, judge: r.judge, total: r.total }
            })
            .collect();
        let [a, b]: [StoredSide; 2] = stored.try_into().ok().expect("two sides");
        self.seats[0].used.push(a.char_id.clone());
        self.seats[1].used.push(b.char_id.clone());
        self.results.push(StoredRound { sides: [a, b], criteria: outcome.criteria, winner: outcome.winner });

        let index = self.results.len() - 1;
        for seat in 0..2 {
            self.send(seat, ServerEvent::RoundResult(self.round_view(index, seat)));
        }

        let outcomes: Vec<(RoundWinner, u32, u32)> =
            self.results.iter().map(|r| (r.winner, r.sides[0].total, r.sides[1].total)).collect();
        match online_match_winner(&outcomes) {
            Some(winner) => {
                let (won, _) = self.tally(self.results.len());
                self.finish(winner, if won[0] != won[1] { EndReason::Rounds } else { EndReason::Points });
                Vec::new()
            }
            None => {
                self.round += 1;
                self.round_started_at = Instant::now();
                for seat in 0..2 {
                    self.send(seat, self.round_start_event(seat));
                }
                vec![Effect::RoundTimer { round: self.round }]
            }
        }
    }

    fn finish(&mut self, winner: MatchWinner, reason: EndReason) {
        self.state = RoomState::Completed;
        self.ended = Some((winner, reason));
        self.completed_at = Some(Instant::now());
        for seat in 0..self.seats.len().min(2) {
            if let Some(done) = self.match_complete_event(seat) {
                self.send(seat, done);
            }
        }
    }

    fn other_wins(seat: usize) -> MatchWinner {
        if seat == 0 { MatchWinner::B } else { MatchWinner::A }
    }

    /// A player gives up the match. Before the match starts it only gives up the seat.
    pub fn forfeit(&mut self, user_id: Uuid) {
        let Some(seat) = self.seat_of(user_id) else { return };
        match self.state {
            RoomState::InProgress => self.finish(Self::other_wins(seat), EndReason::Forfeit),
            RoomState::Waiting => self.leave_waiting(seat),
            RoomState::Completed => {}
        }
    }

    fn leave_waiting(&mut self, seat: usize) {
        self.seats[seat].tx = None;
        self.seats[seat].deck.clear();
        if !self.seats[seat].reserved {
            self.seats.remove(seat);
        }
    }

    /// A connection has closed. `conn` is the number `join` gave it: if the player has
    /// since joined again on another connection, this goodbye is ignored.
    pub fn disconnect(&mut self, user_id: Uuid, conn: u64) -> Vec<Effect> {
        let Some(seat) = self.seat_of(user_id) else { return Vec::new() };
        if self.seats[seat].conn != conn {
            return Vec::new();
        }
        self.seats[seat].tx = None;
        match self.state {
            RoomState::Waiting => {
                // The match cannot start without them: they must join again.
                self.leave_waiting(seat);
                Vec::new()
            }
            RoomState::InProgress => {
                let grace_seconds = self.timing.reconnect.as_secs();
                self.send(1 - seat, ServerEvent::OpponentDisconnected { grace_seconds });
                vec![Effect::GraceTimer { user_id, conn }]
            }
            RoomState::Completed => Vec::new(),
        }
    }

    /// The grace of a disconnected player is over. If they are still away, on the same
    /// broken connection, the match goes to the other player.
    pub fn abandon(&mut self, user_id: Uuid, conn: u64) {
        let Some(seat) = self.seat_of(user_id) else { return };
        if self.state == RoomState::InProgress && self.seats[seat].conn == conn && self.seats[seat].tx.is_none() {
            self.finish(Self::other_wins(seat), EndReason::Disconnect);
        }
    }

    fn is_stale(&self, max_age: Duration, linger: Duration) -> bool {
        match self.completed_at {
            // A finished room stays a little while, so a player who reconnects just after
            // the end still gets the result.
            Some(done) => done.elapsed() > linger,
            None => {
                let nobody_here = self.seats.iter().all(|s| s.tx.is_none());
                self.created_at.elapsed() > max_age
                    // A waiting room nobody holds a seat in, or one that was made (a queue
                    // match, an invitation) and that nobody has come to for a while.
                    || (self.state == RoomState::Waiting
                        && (self.seats.is_empty() || (nobody_here && self.created_at.elapsed() > UNVISITED_ROOM)))
            }
        }
    }
}

/// The network a client address belongs to, for the per-network room limit: an IPv4 address
/// itself, or the /64 of an IPv6 address (one connection is given a whole /64, so a limit per
/// IPv6 address would be no limit). An address that does not parse is its own key.
pub fn address_key(ip: &str) -> String {
    match ip.parse::<std::net::IpAddr>() {
        Ok(std::net::IpAddr::V4(v4)) => v4.to_string(),
        Ok(std::net::IpAddr::V6(v6)) => match v6.to_ipv4_mapped() {
            Some(v4) => v4.to_string(),
            None => {
                let s = v6.segments();
                format!("{:x}:{:x}:{:x}:{:x}::/64", s[0], s[1], s[2], s[3])
            }
        },
        Err(_) => ip.to_string(),
    }
}

/// Arm what a room asked for. Each timer holds the room only through its `Arc`, and does
/// nothing if the room has moved on by the time it fires.
pub fn run_effects(room: &Arc<Mutex<GameRoom>>, effects: Vec<Effect>) {
    for effect in effects {
        let room = room.clone();
        tokio::spawn(async move {
            let timing = room.lock().await.timing;
            match effect {
                Effect::RoundTimer { round } => {
                    tokio::time::sleep(timing.round).await;
                    let next = room.lock().await.expire_round(round);
                    run_effects(&room, next);
                }
                Effect::GraceTimer { user_id, conn } => {
                    tokio::time::sleep(timing.reconnect).await;
                    room.lock().await.abandon(user_id, conn);
                }
                Effect::ArrivalTimer => {
                    tokio::time::sleep(timing.arrival).await;
                    room.lock().await.arrival_expired();
                }
            }
        });
    }
}

/// Registry of active game rooms.
pub struct RoomManager {
    rooms: Mutex<HashMap<Uuid, Arc<Mutex<GameRoom>>>>,
    timing: Timing,
}

impl RoomManager {
    pub fn new() -> Self {
        Self::with_timing(Timing::default())
    }

    pub fn with_timing(timing: Timing) -> Self {
        Self { rooms: Mutex::new(HashMap::new()), timing }
    }

    /// A new room with seats held for these players (one for a private room, two for a
    /// queue match), opened from these networks (`address_key` of each player's address).
    /// The server draws the seed. Refused when the server, a player or a network already
    /// holds as many rooms as it may.
    pub async fn create_room(&self, reserved: &[(Uuid, String)], origins: &[String]) -> Result<Uuid, RoomError> {
        let mut rooms = self.rooms.lock().await;
        if rooms.len() >= MAX_ROOMS {
            return Err(RoomError::ServerFull);
        }
        let (mut per_user, mut per_origin) = (vec![0usize; reserved.len()], vec![0usize; origins.len()]);
        for room in rooms.values() {
            // A room busy right now is counted as live: it is being played.
            let Ok(room) = room.try_lock() else {
                continue;
            };
            if !room.live() {
                continue;
            }
            for (i, (user, _)) in reserved.iter().enumerate() {
                per_user[i] += usize::from(room.has_player(*user));
            }
            for (i, origin) in origins.iter().enumerate() {
                per_origin[i] += usize::from(room.origins.contains(origin));
            }
        }
        if per_user.iter().any(|n| *n >= MAX_ROOMS_PER_USER) {
            return Err(RoomError::TooManyRooms);
        }
        if per_origin.iter().any(|n| *n >= MAX_ROOMS_PER_ADDRESS) {
            return Err(RoomError::TooManyFromAddress);
        }
        let id = Uuid::new_v4();
        let mut room = GameRoom::new(id, rand::random::<u32>(), reserved, self.timing);
        room.origins = origins.to_vec();
        room.origins.dedup();
        rooms.insert(id, Arc::new(Mutex::new(room)));
        Ok(id)
    }

    /// Whether this player, from this network, may have another room opened for them.
    pub async fn room_limit(&self, user_id: Uuid, origin: &str) -> Result<(), RoomError> {
        let rooms = self.rooms.lock().await;
        if rooms.len() >= MAX_ROOMS {
            return Err(RoomError::ServerFull);
        }
        let (mut mine, mut here) = (0, 0);
        for room in rooms.values() {
            let Ok(room) = room.try_lock() else { continue };
            if room.live() {
                mine += usize::from(room.has_player(user_id));
                here += usize::from(room.origins.iter().any(|o| o == origin));
            }
        }
        if mine >= MAX_ROOMS_PER_USER {
            return Err(RoomError::TooManyRooms);
        }
        if here >= MAX_ROOMS_PER_ADDRESS {
            return Err(RoomError::TooManyFromAddress);
        }
        Ok(())
    }

    pub async fn get_room(&self, id: Uuid) -> Option<Arc<Mutex<GameRoom>>> {
        self.rooms.lock().await.get(&id).cloned()
    }

    pub async fn remove_room(&self, id: Uuid) {
        self.rooms.lock().await.remove(&id);
    }

    /// The rooms a player has a seat in.
    pub async fn rooms_of(&self, user_id: Uuid) -> Vec<(Uuid, RoomState, usize)> {
        let rooms: Vec<(Uuid, Arc<Mutex<GameRoom>>)> =
            self.rooms.lock().await.iter().map(|(id, room)| (*id, room.clone())).collect();
        let mut mine = Vec::new();
        for (id, room) in rooms {
            let room = room.lock().await;
            if room.has_player(user_id) {
                mine.push((id, room.state(), room.player_count()));
            }
        }
        mine
    }

    /// Close the waiting rooms a player opened and nobody else has joined, so that opening
    /// room after room cannot fill the server.
    pub async fn close_waiting_rooms_of(&self, user_id: Uuid) {
        let mut rooms = self.rooms.lock().await;
        let mut closing = Vec::new();
        for (id, room) in rooms.iter() {
            if let Ok(room) = room.try_lock() {
                if room.state() == RoomState::Waiting && room.player_count() == 1 && room.has_player(user_id) {
                    closing.push(*id);
                }
            }
        }
        for id in closing {
            rooms.remove(&id);
        }
    }

    pub async fn cleanup_stale_rooms(&self, max_age: Duration) {
        let mut rooms = self.rooms.lock().await;
        let stale_ids: Vec<Uuid> = rooms
            .iter()
            .filter_map(|(id, room_arc)| match room_arc.try_lock() {
                Ok(room) => room.is_stale(max_age, Duration::from_secs(120)).then_some(*id),
                Err(_) => None, // locked = active, skip
            })
            .collect();

        let count = stale_ids.len();
        for id in stale_ids {
            rooms.remove(&id);
        }
        if count > 0 {
            tracing::info!(removed = count, "Cleaned up stale game rooms");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use inspired_mile_api::verse::duel::online_craft;
    use inspired_mile_api::verse::{clean_verse, ROUNDS};

    const DECK_A: [&str; 3] = ["DC-001", "MO-001", "CA-001"];
    const DECK_B: [&str; 3] = ["MO-002", "CA-002", "DC-002"];
    const GOOD: &str = "Who dares to stand upon my stage?\nI put the question to thy rage";
    const PLAIN: &str = "The sun is up above the hills\nThe day is here";

    fn deck(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    struct Table {
        room: GameRoom,
        a: Uuid,
        b: Uuid,
        rx_a: mpsc::Receiver<ServerEvent>,
        rx_b: mpsc::Receiver<ServerEvent>,
        conn_a: u64,
        conn_b: u64,
    }

    fn drain(rx: &mut mpsc::Receiver<ServerEvent>) -> Vec<ServerEvent> {
        let mut out = Vec::new();
        while let Ok(e) = rx.try_recv() {
            out.push(e);
        }
        out
    }

    /// Two players seated and the match started; the opening events are drained.
    fn table(seed: u32) -> Table {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let mut room = GameRoom::new(Uuid::new_v4(), seed, &[(a, "ann".into())], Timing::default());
        let (tx_a, mut rx_a) = mpsc::channel(EVENT_BUFFER);
        let (tx_b, mut rx_b) = mpsc::channel(EVENT_BUFFER);
        let (conn_a, fx) = room.join(a, "ann", &deck(&DECK_A), tx_a).unwrap();
        assert!(fx.is_empty());
        assert_eq!(room.state(), RoomState::Waiting);
        let (conn_b, fx) = room.join(b, "bob", &deck(&DECK_B), tx_b).unwrap();
        assert_eq!(fx, vec![Effect::RoundTimer { round: 0 }]);
        assert_eq!(room.state(), RoomState::InProgress);
        let opening = drain(&mut rx_a);
        assert!(matches!(opening[0], ServerEvent::RoomJoined { state: RoomState::Waiting, opponent: None, .. }));
        assert!(matches!(opening[1], ServerEvent::MatchStart { seat: 0, .. }));
        assert!(matches!(opening[2], ServerEvent::RoundStart { round: 0, submitted: false, .. }));
        let opening = drain(&mut rx_b);
        assert!(matches!(&opening[0], ServerEvent::RoomJoined { opponent: Some(name), .. } if name == "ann"));
        assert!(matches!(opening[1], ServerEvent::MatchStart { seat: 1, .. }));
        Table { room, a, b, rx_a, rx_b, conn_a, conn_b }
    }

    fn result_of(events: &[ServerEvent]) -> &RoundView {
        events
            .iter()
            .find_map(|e| if let ServerEvent::RoundResult(r) = e { Some(r) } else { None })
            .expect("a round result was sent")
    }

    #[test]
    fn the_plan_comes_from_the_seed_and_both_players_get_the_same_one() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let mut room = GameRoom::new(Uuid::new_v4(), 77, &[], Timing::default());
        let (tx_a, mut rx_a) = mpsc::channel(EVENT_BUFFER);
        let (tx_b, mut rx_b) = mpsc::channel(EVENT_BUFFER);
        room.join(a, "ann", &deck(&DECK_A), tx_a).unwrap();
        room.join(b, "bob", &deck(&DECK_B), tx_b).unwrap();
        let plan_of = |events: Vec<ServerEvent>| {
            events
                .into_iter()
                .find_map(|e| match e {
                    ServerEvent::MatchStart { seed, rounds, you, opponent, .. } => Some((seed, rounds, you, opponent)),
                    _ => None,
                })
                .expect("match_start")
        };
        let (seed_a, rounds_a, you_a, opp_a) = plan_of(drain(&mut rx_a));
        let (seed_b, rounds_b, you_b, opp_b) = plan_of(drain(&mut rx_b));
        assert_eq!((seed_a, seed_b), (77, 77));
        assert_eq!(rounds_a, online_plan(77));
        assert_eq!(rounds_a, rounds_b);
        assert_eq!(rounds_a.len(), ROUNDS);
        assert_eq!((you_a.clone(), opp_a.clone()), (opp_b, you_b));
        assert_eq!(you_a.deck, deck(&DECK_A));
    }

    #[test]
    fn a_round_is_scored_by_the_rules_and_each_player_sees_it_from_their_side() {
        let mut t = table(1);
        assert_eq!(t.room.submit(t.a, 0, "DC-001", GOOD), Ok(vec![]));
        assert_eq!(drain(&mut t.rx_a), vec![ServerEvent::VerseAccepted { round: 0 }]);
        assert_eq!(drain(&mut t.rx_b), vec![ServerEvent::OpponentSubmitted { round: 0 }]);
        let fx = t.room.submit(t.b, 0, "MO-002", PLAIN).unwrap();
        assert_eq!(fx, vec![Effect::RoundTimer { round: 1 }]);

        let (ea, eb) = (drain(&mut t.rx_a), drain(&mut t.rx_b));
        let (ra, rb) = (result_of(&ea), result_of(&eb));
        // The same numbers, mirrored.
        assert_eq!(ra.you, rb.opponent);
        assert_eq!(ra.opponent, rb.you);
        assert_eq!(ra.rounds_won, Pair { you: rb.rounds_won.opponent, opponent: rb.rounds_won.you });
        assert_eq!(ra.you.verse, GOOD);
        assert_eq!(ra.you.total, ra.you.score.craft + ra.you.judge);
        assert_eq!(ra.you.judge + ra.opponent.judge, 24);

        // And exactly what the rules give for these verses, cards and decks.
        let plan = &online_plan(1)[0];
        let (da, db) = (deck(&DECK_A), deck(&DECK_B));
        let want = resolve_online_round(
            plan,
            &OnlineSide { card: card_by_id("DC-001").unwrap(), deck: &da, verse: GOOD, previous_opponent_verse: None },
            &OnlineSide { card: card_by_id("MO-002").unwrap(), deck: &db, verse: PLAIN, previous_opponent_verse: None },
        );
        assert_eq!((ra.you.score.clone(), ra.you.judge, ra.you.total), (want.a.score, want.a.judge, want.a.total));
        assert_eq!((rb.you.score.clone(), rb.you.judge, rb.you.total), (want.b.score, want.b.judge, want.b.total));
        match want.winner {
            RoundWinner::A => assert_eq!((ra.winner, rb.winner), (Side::You, Side::Opponent)),
            RoundWinner::B => assert_eq!((ra.winner, rb.winner), (Side::Opponent, Side::You)),
            RoundWinner::Draw => assert_eq!((ra.winner, rb.winner), (Side::Draw, Side::Draw)),
        }
        assert!(ea.iter().any(|e| matches!(e, ServerEvent::RoundStart { round: 1, .. })));
    }

    #[test]
    fn the_same_verses_always_get_the_same_scores() {
        let play = || {
            let mut t = table(9);
            t.room.submit(t.a, 0, "DC-001", GOOD).unwrap();
            t.room.submit(t.b, 0, "MO-002", PLAIN).unwrap();
            result_of(&drain(&mut t.rx_a)).clone()
        };
        let first = play();
        for _ in 0..20 {
            assert_eq!(play(), first);
        }
    }

    #[test]
    fn a_score_sent_by_a_client_is_not_read() {
        // The wire format has no score field, and extra fields change nothing.
        let honest: ClientEvent =
            serde_json::from_str(r#"{"type":"submit_verse","round":0,"char_id":"DC-001","text":"One line only"}"#).unwrap();
        let cheat: ClientEvent = serde_json::from_str(
            r#"{"type":"submit_verse","round":0,"char_id":"DC-001","text":"One line only",
                "score":999,"craft":999,"total":999,"judge":24,"winner":"you","player_wins":true}"#,
        )
        .unwrap();
        let play = |event: ClientEvent| {
            let mut t = table(3);
            let ClientEvent::SubmitVerse { round, char_id, text } = event else { panic!("a submission") };
            t.room.submit(t.a, round, &char_id, &text).unwrap();
            t.room.submit(t.b, 0, "MO-002", GOOD).unwrap();
            result_of(&drain(&mut t.rx_a)).clone()
        };
        let (h, c) = (play(honest), play(cheat));
        assert_eq!(h, c);
        assert!(c.you.total < 100);
    }

    #[test]
    fn submitting_twice_or_out_of_turn_is_refused_and_changes_nothing() {
        let mut t = table(1);
        assert_eq!(t.room.submit(t.a, 1, "DC-001", GOOD), Err(RoomError::WrongRound));
        assert_eq!(t.room.submit(t.a, 0, "DC-001", GOOD), Ok(vec![]));
        assert_eq!(t.room.submit(t.a, 0, "MO-001", PLAIN), Err(RoomError::AlreadySubmitted));
        assert_eq!(t.room.submit(Uuid::new_v4(), 0, "DC-001", GOOD), Err(RoomError::NotInRoom));
        drain(&mut t.rx_b);
        t.room.submit(t.b, 0, "MO-002", PLAIN).unwrap();
        // The first submission is the one that was scored.
        let events = drain(&mut t.rx_a);
        assert_eq!(result_of(&events).you.verse, GOOD);
        assert_eq!(result_of(&events).you.char_id, "DC-001");
        // The round has moved on: the old round is refused, and so is the spent character.
        assert_eq!(t.room.submit(t.a, 0, "MO-001", GOOD), Err(RoomError::WrongRound));
        assert_eq!(t.room.submit(t.a, 1, "DC-001", GOOD), Err(RoomError::CharacterUsed));
        assert_eq!(t.room.submit(t.a, 1, "MO-002", GOOD), Err(RoomError::NotInDeck));
        assert_eq!(t.room.submit(t.a, 1, "nope", GOOD), Err(RoomError::NotInDeck));
        assert_eq!(t.room.submit(t.a, 1, "MO-001", GOOD), Ok(vec![]));
    }

    #[test]
    fn verses_are_bounded_cleaned_and_filtered() {
        let mut t = table(1);
        assert_eq!(t.room.submit(t.a, 0, "DC-001", &"a".repeat(MAX_VERSE_BYTES + 1)), Err(RoomError::VerseTooLong));
        assert_eq!(t.room.submit(t.a, 0, "DC-001", ""), Err(RoomError::EmptyVerse));
        assert_eq!(t.room.submit(t.a, 0, "DC-001", " \n\u{200b}\n\t"), Err(RoomError::EmptyVerse));
        assert!(matches!(t.room.submit(t.a, 0, "DC-001", "What the fuck is this"), Err(RoomError::Filtered(_))));
        // A zero-width character inside the word is stripped by cleaning; the filter sees the result.
        assert!(matches!(t.room.submit(t.a, 0, "DC-001", "What the fu\u{200b}ck is this"), Err(RoomError::Filtered(_))));
        // None of those counted as a submission.
        assert!(drain(&mut t.rx_b).is_empty());
        // A verse at the size limit is accepted and capped by the rules.
        let long = format!("{}\nsecond line", "x".repeat(MAX_VERSE_BYTES - 20));
        assert!(long.len() <= MAX_VERSE_BYTES);
        t.room.submit(t.a, 0, "DC-001", &long).unwrap();
        t.room.submit(t.b, 0, "MO-002", "Hidden\u{202e} marks\u{0000} go\r\n\n\nsecond   line").unwrap();
        let events = drain(&mut t.rx_b);
        let r = result_of(&events);
        assert_eq!(r.you.verse, "Hidden marks go\nsecond line");
        assert_eq!(r.opponent.verse.encode_utf16().count(), MAX_VERSE_CHARS);
    }

    #[test]
    fn a_pasted_verse_is_settled_before_it_is_scored_so_the_preview_is_the_score() {
        // A letter, a zero-width space and a combining accent: one cleaning leaves the accent
        // apart and a second composes it (a syllable count can change with it). The room keeps the
        // settled text, which no later cleaning changes, and scores exactly that: the craft
        // the page previewed for the same settled text. Sent raw and sent settled alike.
        let pasted = "Step upe\u{200b}\u{301}, poor player, strut thy little hour\nThen watch thy verses wither like a flower";
        let settled = settle_verse(pasted);
        assert_eq!(clean_verse(&settled), settled);
        for sent in [pasted.to_string(), settled.clone()] {
            let mut t = table(1);
            t.room.submit(t.a, 0, "DC-001", &sent).unwrap();
            t.room.submit(t.b, 0, "MO-002", PLAIN).unwrap();
            let events = drain(&mut t.rx_a);
            let r = result_of(&events);
            assert_eq!(r.you.verse, settled);
            let da = deck(&DECK_A);
            let preview = online_craft(
                &online_plan(1)[0],
                &OnlineSide { card: card_by_id("DC-001").unwrap(), deck: &da, verse: &settled, previous_opponent_verse: None },
            );
            assert_eq!(r.you.score, preview);
        }
    }

    #[test]
    fn a_full_match_is_best_of_three_and_ends_when_two_rounds_are_won() {
        let mut t = table(1);
        let (mut a_chars, mut b_chars) = (DECK_A.iter(), DECK_B.iter());
        let mut rounds = 0;
        let mut last = Vec::new();
        while t.room.state() == RoomState::InProgress {
            // Seat 0 always writes a verse with words; seat 1 writes a single full stop.
            t.room.submit(t.a, rounds, a_chars.next().unwrap(), GOOD).unwrap();
            t.room.submit(t.b, rounds, b_chars.next().unwrap(), ".").unwrap();
            rounds += 1;
            last = drain(&mut t.rx_a);
            drain(&mut t.rx_b);
            assert!(rounds <= ROUNDS);
        }
        assert_eq!(rounds, 2, "two rounds won ends a best of three");
        assert!(last.iter().any(|e| matches!(
            e,
            ServerEvent::MatchComplete { winner: Side::You, reason: EndReason::Rounds, rounds_won: Pair { you: 2, opponent: 0 }, .. }
        )));
        assert_eq!(t.room.submit(t.a, 2, "CA-001", GOOD), Err(RoomError::NotPlaying));
    }

    #[test]
    fn a_round_that_runs_out_is_scored_with_what_is_in() {
        let mut t = table(1);
        t.room.submit(t.a, 0, "MO-001", GOOD).unwrap();
        // A timer for another round does nothing.
        assert!(t.room.expire_round(1).is_empty());
        assert_eq!(t.room.expire_round(0), vec![Effect::RoundTimer { round: 1 }]);
        let events = drain(&mut t.rx_b);
        let r = result_of(&events);
        assert!(r.you.timed_out && !r.opponent.timed_out);
        assert_eq!((r.you.verse.as_str(), r.you.score.craft), ("", 0));
        // The first unplayed character took the stage, and is spent.
        assert_eq!(r.you.char_id, "MO-002");
        assert_eq!(t.room.submit(t.b, 1, "MO-002", GOOD), Err(RoomError::CharacterUsed));
        // The same timer firing again is for a round already decided.
        assert!(t.room.expire_round(0).is_empty());
        // Nobody writes for the rest of the match: it still ends.
        let mut fx = t.room.expire_round(1);
        if !fx.is_empty() {
            fx = t.room.expire_round(2);
        }
        assert!(fx.is_empty());
        assert_eq!(t.room.state(), RoomState::Completed);
        assert!(drain(&mut t.rx_a).iter().any(|e| matches!(e, ServerEvent::MatchComplete { winner: Side::You, .. })));
    }

    #[test]
    fn a_player_who_disconnects_can_come_back_and_gets_the_match_as_it_stands() {
        let mut t = table(1);
        t.room.submit(t.a, 0, "DC-001", GOOD).unwrap();
        t.room.submit(t.b, 0, "MO-002", PLAIN).unwrap();
        t.room.submit(t.b, 1, "CA-002", PLAIN).unwrap();
        drain(&mut t.rx_a);
        drain(&mut t.rx_b);

        let fx = t.room.disconnect(t.a, t.conn_a);
        assert_eq!(fx, vec![Effect::GraceTimer { user_id: t.a, conn: t.conn_a }]);
        assert!(matches!(drain(&mut t.rx_b)[0], ServerEvent::OpponentDisconnected { .. }));
        // The old connection's channel is closed.
        assert!(t.rx_a.try_recv().is_err());

        let (tx, mut rx) = mpsc::channel(EVENT_BUFFER);
        let (conn, fx) = t.room.join(t.a, "ann", &[], tx).unwrap();
        assert!(fx.is_empty());
        assert_ne!(conn, t.conn_a);
        let events = drain(&mut rx);
        match &events[1] {
            ServerEvent::MatchStart { seat, you, results, .. } => {
                assert_eq!(*seat, 0);
                assert_eq!(you.used, vec!["DC-001".to_string()]);
                assert_eq!(results.len(), 1);
                assert_eq!(results[0].you.verse, GOOD);
            }
            other => panic!("expected the match, got {other:?}"),
        }
        assert!(matches!(events[2], ServerEvent::RoundStart { round: 1, submitted: false, opponent_submitted: true, .. }));
        assert_eq!(drain(&mut t.rx_b), vec![ServerEvent::OpponentReconnected]);

        // The grace timer of the old connection fires late: nothing happens.
        t.room.abandon(t.a, t.conn_a);
        assert_eq!(t.room.state(), RoomState::InProgress);
        // And the match goes on.
        t.room.submit(t.a, 1, "MO-001", GOOD).unwrap();
        assert!(drain(&mut rx).iter().any(|e| matches!(e, ServerEvent::RoundResult(_))));
    }

    #[test]
    fn a_player_who_stays_away_loses_the_match() {
        let mut t = table(1);
        t.room.disconnect(t.b, t.conn_b);
        drain(&mut t.rx_a);
        t.room.abandon(t.b, t.conn_b);
        assert_eq!(t.room.state(), RoomState::Completed);
        assert!(matches!(
            drain(&mut t.rx_a)[0],
            ServerEvent::MatchComplete { winner: Side::You, reason: EndReason::Disconnect, .. }
        ));
        // A goodbye from a connection that is not the current one is ignored.
        let mut t = table(1);
        assert!(t.room.disconnect(t.a, t.conn_a + 100).is_empty());
        assert!(drain(&mut t.rx_b).is_empty());
    }

    #[test]
    fn a_second_connection_replaces_the_first() {
        let mut t = table(1);
        let (tx, mut rx) = mpsc::channel(EVENT_BUFFER);
        let (conn, _) = t.room.join(t.a, "ann", &[], tx).unwrap();
        // The first connection's channel is closed, and its goodbye is ignored.
        drain(&mut t.rx_a);
        assert!(matches!(t.rx_a.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
        assert!(t.room.disconnect(t.a, t.conn_a).is_empty());
        assert!(drain(&mut t.rx_b).is_empty(), "the opponent is not told of a hand-over");
        t.room.submit(t.a, 0, "DC-001", GOOD).unwrap();
        assert!(drain(&mut rx).contains(&ServerEvent::VerseAccepted { round: 0 }));
        assert_ne!(conn, t.conn_a);
    }

    #[test]
    fn forfeit_gives_the_match_to_the_other_player() {
        let mut t = table(1);
        t.room.forfeit(t.a);
        assert!(matches!(
            drain(&mut t.rx_b)[0],
            ServerEvent::MatchComplete { winner: Side::You, reason: EndReason::Forfeit, .. }
        ));
        assert!(matches!(drain(&mut t.rx_a)[0], ServerEvent::MatchComplete { winner: Side::Opponent, .. }));
        // Forfeiting again, or after the end, changes nothing.
        t.room.forfeit(t.b);
        assert!(drain(&mut t.rx_a).is_empty());
    }

    #[test]
    fn seats_are_held_decks_are_checked_and_a_third_player_is_refused() {
        let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let ch = || mpsc::channel(EVENT_BUFFER);
        // A queue match: both seats held, so nobody else can sit.
        let mut room = GameRoom::new(Uuid::new_v4(), 5, &[(a, "ann".into()), (b, "bob".into())], Timing::default());
        assert_eq!(room.join(c, "cy", &deck(&DECK_A), ch().0).unwrap_err(), RoomError::Full);
        assert!(matches!(room.join(a, "ann", &deck(&["DC-001"]), ch().0), Err(RoomError::BadDeck(_))));
        assert!(matches!(room.join(a, "ann", &deck(&["DC-001", "DC-001", "MO-001"]), ch().0), Err(RoomError::BadDeck(_))));
        assert!(matches!(room.join(a, "ann", &deck(&["DC-001", "RL-001", "MO-001"]), ch().0), Err(RoomError::BadDeck(_))));
        let (tx, _rx_a) = ch();
        room.join(a, "ann", &deck(&DECK_A), tx).unwrap();
        // The same player joining twice does not start a match against themselves.
        let (tx, _rx_a2) = ch();
        room.join(a, "ann", &deck(&DECK_A), tx).unwrap();
        assert_eq!(room.state(), RoomState::Waiting);

        // A private room: one seat held, one open; a player who leaves before the start gives it back.
        let mut room = GameRoom::new(Uuid::new_v4(), 5, &[(a, "ann".into())], Timing::default());
        let (tx, _rx_c) = ch();
        let (conn_c, _) = room.join(c, "cy", &deck(&DECK_B), tx).unwrap();
        assert_eq!(room.join(b, "bob", &deck(&DECK_B), ch().0).unwrap_err(), RoomError::Full);
        assert!(room.disconnect(c, conn_c).is_empty());
        assert_eq!(room.player_count(), 1);
        let (tx, _rx_b) = ch();
        room.join(b, "bob", &deck(&DECK_B), tx).unwrap();
        assert_eq!(room.state(), RoomState::Waiting, "the creator has not joined yet");
        let (tx, _rx_a) = ch();
        let (_, fx) = room.join(a, "ann", &deck(&DECK_A), tx).unwrap();
        assert_eq!((room.state(), fx.len()), (RoomState::InProgress, 1));
        assert_eq!(room.join(c, "cy", &deck(&DECK_A), ch().0).unwrap_err(), RoomError::Full);
    }

    #[test]
    fn a_connection_that_cannot_keep_up_is_dropped_not_waited_for() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let mut room = GameRoom::new(Uuid::new_v4(), 1, &[], Timing::default());
        let (tx_a, _rx_a) = mpsc::channel(EVENT_BUFFER);
        // Room for one event only, and nobody reading.
        let (tx_b, mut rx_b) = mpsc::channel(1);
        room.join(a, "ann", &deck(&DECK_A), tx_a).unwrap();
        room.join(b, "bob", &deck(&DECK_B), tx_b).unwrap();
        assert!(rx_b.try_recv().is_ok());
        assert!(matches!(rx_b.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
        // The match is not held up by it.
        room.submit(a, 0, "DC-001", GOOD).unwrap();
    }

    #[tokio::test(start_paused = true)]
    async fn timers_end_a_round_and_then_an_abandoned_match() {
        let timing = Timing { round: Duration::from_secs(60), reconnect: Duration::from_secs(20), arrival: Duration::from_secs(30) };
        let manager = RoomManager::with_timing(timing);
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let id = manager.create_room(&[(a, "ann".into()), (b, "bob".into())], &[]).await.unwrap();
        let room = manager.get_room(id).await.unwrap();
        let (tx_a, mut rx_a) = mpsc::channel(EVENT_BUFFER);
        let (tx_b, _rx_b) = mpsc::channel(EVENT_BUFFER);
        room.lock().await.join(a, "ann", &deck(&DECK_A), tx_a).unwrap();
        let (conn_b, fx) = room.lock().await.join(b, "bob", &deck(&DECK_B), tx_b).unwrap();
        run_effects(&room, fx);
        room.lock().await.submit(a, 0, "DC-001", GOOD).unwrap();

        tokio::time::sleep(Duration::from_secs(59)).await;
        assert!(!drain(&mut rx_a).iter().any(|e| matches!(e, ServerEvent::RoundResult(_))));
        tokio::time::sleep(Duration::from_secs(2)).await;
        let events = drain(&mut rx_a);
        assert!(result_of(&events).opponent.timed_out);
        assert!(events.iter().any(|e| matches!(e, ServerEvent::RoundStart { round: 1, .. })));

        // Bob's connection goes; he does not come back.
        let fx = room.lock().await.disconnect(b, conn_b);
        run_effects(&room, fx);
        tokio::time::sleep(Duration::from_secs(19)).await;
        assert_eq!(room.lock().await.state(), RoomState::InProgress);
        tokio::time::sleep(Duration::from_secs(2)).await;
        assert_eq!(room.lock().await.state(), RoomState::Completed);
        assert!(drain(&mut rx_a)
            .iter()
            .any(|e| matches!(e, ServerEvent::MatchComplete { winner: Side::You, reason: EndReason::Disconnect, .. })));
    }

    #[tokio::test]
    async fn the_server_holds_a_bounded_number_of_rooms_and_one_waiting_room_per_player() {
        let manager = RoomManager::new();
        let me = Uuid::new_v4();
        let first = manager.create_room(&[(me, "me".into())], &[]).await.unwrap();
        manager.close_waiting_rooms_of(me).await;
        assert!(manager.get_room(first).await.is_none());
        let mine = manager.create_room(&[(me, "me".into())], &[]).await.unwrap();
        assert_eq!(manager.rooms_of(me).await, vec![(mine, RoomState::Waiting, 1)]);
        assert!(manager.rooms_of(Uuid::new_v4()).await.is_empty());
        for _ in 1..MAX_ROOMS {
            manager.create_room(&[], &[]).await.unwrap();
        }
        assert_eq!(manager.create_room(&[], &[]).await, Err(RoomError::ServerFull));
        // Rooms nobody sits in are swept; the one with a held seat stays until it is old.
        manager.cleanup_stale_rooms(Duration::from_secs(1800)).await;
        assert!(manager.create_room(&[], &[]).await.is_ok());
        assert!(manager.get_room(mine).await.is_some());
        manager.cleanup_stale_rooms(Duration::ZERO).await;
        assert!(manager.get_room(mine).await.is_none());
    }

    #[tokio::test]
    async fn a_room_nobody_comes_to_is_swept_but_one_with_a_player_waiting_is_kept() {
        let manager = RoomManager::new();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let unvisited = manager.create_room(&[(a, "ann".into()), (b, "bob".into())], &[]).await.unwrap();
        let waited_in = manager.create_room(&[(a, "ann".into())], &[]).await.unwrap();
        let (tx, _rx) = mpsc::channel(EVENT_BUFFER);
        manager.get_room(waited_in).await.unwrap().lock().await.join(a, "ann", &deck(&DECK_A), tx).unwrap();
        let long_ago = Instant::now().checked_sub(UNVISITED_ROOM + Duration::from_secs(1)).expect("the clock is past start-up");
        for id in [unvisited, waited_in] {
            manager.get_room(id).await.unwrap().lock().await.created_at = long_ago;
        }
        manager.cleanup_stale_rooms(Duration::from_secs(1800)).await;
        assert!(manager.get_room(unvisited).await.is_none());
        assert!(manager.get_room(waited_in).await.is_some());
    }

    #[tokio::test]
    async fn one_account_and_one_network_hold_a_bounded_number_of_rooms() {
        let manager = RoomManager::new();
        let me = Uuid::new_v4();
        for _ in 0..MAX_ROOMS_PER_USER {
            manager.create_room(&[(me, "me".into())], &[]).await.unwrap();
        }
        assert_eq!(manager.create_room(&[(me, "me".into())], &[]).await, Err(RoomError::TooManyRooms));
        // A queue match for this account is refused too, whoever it is with.
        assert_eq!(
            manager.create_room(&[(Uuid::new_v4(), "other".into()), (me, "me".into())], &[]).await,
            Err(RoomError::TooManyRooms)
        );
        assert_eq!(manager.room_limit(me, "198.51.100.7").await, Err(RoomError::TooManyRooms));
        // A finished room no longer counts.
        let id = manager.rooms_of(me).await[0].0;
        {
            let room = manager.get_room(id).await.unwrap();
            let mut room = room.lock().await;
            room.state = RoomState::Completed;
            room.completed_at = Some(Instant::now());
        }
        assert!(manager.create_room(&[(me, "me".into())], &[]).await.is_ok());

        // Many accounts on one IPv6 /64 are one network.
        let net = address_key("2001:db8:1:2:aaaa::1");
        assert_eq!(net, address_key("2001:db8:1:2:ffff:ffff:ffff:ffff"));
        assert_ne!(net, address_key("2001:db8:1:3::1"));
        for _ in 0..MAX_ROOMS_PER_ADDRESS {
            manager.create_room(&[(Uuid::new_v4(), "someone".into())], std::slice::from_ref(&net)).await.unwrap();
        }
        let refused = manager.create_room(&[(Uuid::new_v4(), "next".into())], &[address_key("2001:db8:1:2:1234::9")]).await;
        assert_eq!(refused, Err(RoomError::TooManyFromAddress));
        assert!(manager.create_room(&[(Uuid::new_v4(), "elsewhere".into())], &[address_key("2001:db8:1:3::1")]).await.is_ok());
    }

    #[test]
    fn an_address_key_is_the_ipv4_address_or_the_ipv6_slash_64() {
        assert_eq!(address_key("203.0.113.7"), "203.0.113.7");
        assert_eq!(address_key("::ffff:203.0.113.7"), "203.0.113.7");
        assert_eq!(address_key("2001:db8:0:1::5"), "2001:db8:0:1::/64");
        assert_eq!(address_key("unknown"), "unknown");
    }

    #[test]
    fn a_paired_opponent_who_never_arrives_closes_the_room_and_says_so() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let mut room = GameRoom::new(Uuid::new_v4(), 5, &[(a, "ann".into()), (b, "bob".into())], Timing::default());
        let (tx, mut rx) = mpsc::channel(EVENT_BUFFER);
        let (_, fx) = room.join(a, "ann", &deck(&DECK_A), tx).unwrap();
        assert_eq!(fx, vec![Effect::ArrivalTimer]);
        drain(&mut rx);
        room.arrival_expired();
        let events = drain(&mut rx);
        assert!(matches!(&events[0], ServerEvent::Error { code: "opponent_absent", .. }), "{events:?}");
        // The waiting player's connection is let go, and the room takes nobody now.
        assert!(matches!(rx.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
        assert_eq!(room.join(b, "bob", &deck(&DECK_B), mpsc::channel(EVENT_BUFFER).0).unwrap_err(), RoomError::NotFound);
        assert!(!room.live());

        // When both arrive in time, the timer finds a match under way and does nothing.
        let mut room = GameRoom::new(Uuid::new_v4(), 5, &[(a, "ann".into()), (b, "bob".into())], Timing::default());
        let (tx_a, _rx_a) = mpsc::channel(EVENT_BUFFER);
        let (tx_b, _rx_b) = mpsc::channel(EVENT_BUFFER);
        room.join(a, "ann", &deck(&DECK_A), tx_a).unwrap();
        room.join(b, "bob", &deck(&DECK_B), tx_b).unwrap();
        room.arrival_expired();
        assert_eq!(room.state(), RoomState::InProgress);
        // A private room (one seat held) arms no such timer: a friend may take a while.
        let mut room = GameRoom::new(Uuid::new_v4(), 5, &[(a, "ann".into())], Timing::default());
        let (_, fx) = room.join(a, "ann", &deck(&DECK_A), mpsc::channel(EVENT_BUFFER).0).unwrap();
        assert!(fx.is_empty());
    }

    #[test]
    fn a_verse_with_a_character_the_server_cannot_read_is_refused_not_scored() {
        let mut t = table(1);
        let refused = t.room.submit(t.a, 0, "DC-001", "A line of mine\nAnd one more \u{0378} here");
        assert_eq!(refused, Err(RoomError::UnknownCharacter('\u{0378}')));
        assert!(drain(&mut t.rx_b).is_empty());
        assert!(RoomError::UnknownCharacter('\u{0378}').message().contains("U+0378"));
        assert_eq!(t.room.submit(t.a, 0, "DC-001", GOOD), Ok(vec![]));
    }

    #[test]
    fn events_are_tagged_snake_case_json() {
        let json = serde_json::to_value(ServerEvent::OpponentDisconnected { grace_seconds: 45 }).unwrap();
        assert_eq!(json, serde_json::json!({ "type": "opponent_disconnected", "grace_seconds": 45 }));
        let mut t = table(1);
        t.room.submit(t.a, 0, "DC-001", GOOD).unwrap();
        t.room.submit(t.b, 0, "MO-002", PLAIN).unwrap();
        let events = drain(&mut t.rx_a);
        let json = serde_json::to_value(events.iter().find(|e| matches!(e, ServerEvent::RoundResult(_))).unwrap()).unwrap();
        assert_eq!(json["type"], "round_result");
        assert_eq!(json["round"], 0);
        assert_eq!(json["you"]["char_id"], "DC-001");
        assert!(json["you"]["score"]["craft"].is_u64());
        assert!(json["you"]["score"]["form"]["checks"].is_array());
        assert!(json["criteria"]["wordplay"].is_string());
        // Malformed or oversized input is not an event.
        assert!(serde_json::from_str::<ClientEvent>(r#"{"type":"submit_verse","round":-1,"char_id":"x","text":"y"}"#).is_err());
        assert!(serde_json::from_str::<ClientEvent>(r#"{"type":"use_item","item_id":"x"}"#).is_err());
        assert!(serde_json::from_str::<ClientEvent>(r#"{"type":"join_room","room_id":"nope"}"#).is_err());
    }
}
