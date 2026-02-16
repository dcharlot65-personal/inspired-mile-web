use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Room lifecycle states.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoomState {
    Waiting,
    InProgress,
    Completed,
}

/// A player in a game room.
#[derive(Clone, Debug, Serialize)]
pub struct RoomPlayer {
    pub user_id: Uuid,
    pub username: String,
    pub score: i32,
}

/// Server → Client events.
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerEvent {
    RoomJoined {
        room_id: Uuid,
        opponent: String,
        round: u32,
        total_rounds: u32,
    },
    RoundStart {
        round: u32,
        total_rounds: u32,
    },
    OpponentSubmitted,
    RoundResult {
        round: u32,
        player_score: AxisScores,
        opponent_score: AxisScores,
        player_wins: bool,
        reason: String,
    },
    MatchComplete {
        winner: String,
        player_total: i32,
        opponent_total: i32,
    },
    OpponentDisconnected,
    Error {
        message: String,
    },
}

/// Client → Server events.
#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientEvent {
    JoinRoom { room_id: Uuid },
    SubmitVerse { text: String },
    #[allow(dead_code)] // Field exists in wire protocol for future use
    UseItem { item_id: String },
    Forfeit,
}

/// 4-axis scoring.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct AxisScores {
    pub wordplay: i32,
    pub shakespeare: i32,
    pub flow: i32,
    pub wit: i32,
    pub total: i32,
}

/// A round's submissions.
#[derive(Clone, Debug)]
pub struct RoundSubmission {
    pub user_id: Uuid,
    pub text: String,
}

/// A game room.
pub struct GameRoom {
    pub state: RoomState,
    pub players: Vec<RoomPlayer>,
    pub current_round: u32,
    pub total_rounds: u32,
    pub submissions: Vec<RoundSubmission>,
    pub tx: broadcast::Sender<ServerEvent>,
}

impl GameRoom {
    pub fn new(total_rounds: u32) -> Self {
        let (tx, _) = broadcast::channel(64);
        Self {
            state: RoomState::Waiting,
            players: Vec::new(),
            current_round: 1,
            total_rounds,
            submissions: Vec::new(),
            tx,
        }
    }

    pub fn add_player(&mut self, user_id: Uuid, username: String) -> bool {
        if self.players.len() >= 2 {
            return false;
        }
        self.players.push(RoomPlayer { user_id, username, score: 0 });
        if self.players.len() == 2 {
            self.state = RoomState::InProgress;
        }
        true
    }

    pub fn submit_verse(&mut self, user_id: Uuid, text: String) -> bool {
        if self.state != RoomState::InProgress {
            return false;
        }
        // Check if already submitted this round
        if self.submissions.iter().any(|s| s.user_id == user_id) {
            return false;
        }
        self.submissions.push(RoundSubmission { user_id, text });
        true
    }

    pub fn both_submitted(&self) -> bool {
        self.submissions.len() >= 2
    }

    pub fn take_submissions(&mut self) -> Vec<RoundSubmission> {
        std::mem::take(&mut self.submissions)
    }

    pub fn advance_round(&mut self) {
        self.current_round += 1;
        if self.current_round > self.total_rounds {
            self.state = RoomState::Completed;
        }
    }

    pub fn get_opponent(&self, user_id: Uuid) -> Option<&RoomPlayer> {
        self.players.iter().find(|p| p.user_id != user_id)
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ServerEvent> {
        self.tx.subscribe()
    }

    pub fn broadcast(&self, event: ServerEvent) {
        let _ = self.tx.send(event);
    }
}

/// Registry of active game rooms.
pub struct RoomManager {
    rooms: Mutex<HashMap<Uuid, Arc<Mutex<GameRoom>>>>,
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: Mutex::new(HashMap::new()),
        }
    }

    pub async fn create_room(&self, total_rounds: u32) -> Uuid {
        let id = Uuid::new_v4();
        let room = GameRoom::new(total_rounds);
        self.rooms.lock().await.insert(id, Arc::new(Mutex::new(room)));
        id
    }

    pub async fn get_room(&self, id: Uuid) -> Option<Arc<Mutex<GameRoom>>> {
        self.rooms.lock().await.get(&id).cloned()
    }

    pub async fn remove_room(&self, id: Uuid) {
        self.rooms.lock().await.remove(&id);
    }

    pub async fn list_rooms(&self) -> Vec<(Uuid, RoomState, usize)> {
        let rooms = self.rooms.lock().await;
        rooms.iter().map(|(id, room_arc)| {
            match room_arc.try_lock() {
                Ok(room) => (*id, room.state.clone(), room.players.len()),
                Err(_) => (*id, RoomState::InProgress, 2), // locked = active battle
            }
        }).collect()
    }
}
