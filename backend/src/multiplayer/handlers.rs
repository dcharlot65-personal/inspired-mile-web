use std::sync::Arc;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Extension, State, WebSocketUpgrade,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;
use super::game_room::{ClientEvent, GameRoom, RoomManager, RoomState, ServerEvent, AxisScores};
use super::judge;
use super::matchmaking::MatchmakingQueue;

/// App state that includes room manager and matchmaking queue.
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub rooms: Arc<RoomManager>,
    pub queue: Arc<MatchmakingQueue>,
}

pub fn router(rooms: Arc<RoomManager>, queue: Arc<MatchmakingQueue>) -> Router<(PgPool, Config)> {
    Router::new()
        .route("/ws", get(ws_handler))
        .route("/queue", post(join_queue))
        .route("/rooms", get(list_rooms))
}

#[derive(Serialize)]
struct QueueResponse {
    room_id: Option<Uuid>,
    position: usize,
    status: String,
}

async fn join_queue(
    Extension(claims): Extension<Claims>,
    Extension(queue): Extension<Arc<MatchmakingQueue>>,
    Extension(rooms): Extension<Arc<RoomManager>>,
) -> Result<Json<QueueResponse>, (StatusCode, String)> {
    let rx = queue.enqueue(claims.sub, claims.username.clone()).await;

    // Wait up to 30 seconds for a match
    match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => {
            // Create the room
            let room_id = rooms.create_room(3).await;
            if let Some(room) = rooms.get_room(room_id).await {
                let mut room = room.lock().await;
                room.add_player(claims.sub, claims.username.clone());
                room.add_player(Uuid::new_v4(), result.opponent_username); // placeholder
            }

            Ok(Json(QueueResponse {
                room_id: Some(result.room_id),
                position: 0,
                status: "matched".into(),
            }))
        }
        Ok(Err(_)) => Ok(Json(QueueResponse {
            room_id: None,
            position: 0,
            status: "cancelled".into(),
        })),
        Err(_) => {
            queue.dequeue(claims.sub).await;
            Ok(Json(QueueResponse {
                room_id: None,
                position: queue.size().await,
                status: "timeout".into(),
            }))
        }
    }
}

#[derive(Serialize)]
struct RoomInfo {
    id: Uuid,
    state: RoomState,
    player_count: usize,
}

async fn list_rooms(
    Extension(rooms): Extension<Arc<RoomManager>>,
) -> Json<Vec<RoomInfo>> {
    let list = rooms.list_rooms().await;
    Json(
        list.into_iter()
            .map(|(id, state, count)| RoomInfo {
                id,
                state,
                player_count: count,
            })
            .collect(),
    )
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
    State((pool, config)): State<(PgPool, Config)>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, claims, rooms, config))
}

async fn handle_socket(
    socket: WebSocket,
    claims: Claims,
    rooms: Arc<RoomManager>,
    config: Config,
) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    while let Some(Ok(msg)) = ws_rx.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let event: ClientEvent = match serde_json::from_str(&text) {
            Ok(e) => e,
            Err(_) => {
                let err = ServerEvent::Error {
                    message: "Invalid message format".into(),
                };
                let _ = ws_tx.send(Message::Text(serde_json::to_string(&err).unwrap().into())).await;
                continue;
            }
        };

        match event {
            ClientEvent::JoinRoom { room_id } => {
                let room_arc = match rooms.get_room(room_id).await {
                    Some(r) => r,
                    None => {
                        let err = ServerEvent::Error {
                            message: "Room not found".into(),
                        };
                        let _ = ws_tx.send(Message::Text(serde_json::to_string(&err).unwrap().into())).await;
                        continue;
                    }
                };

                let mut room = room_arc.lock().await;
                room.add_player(claims.sub, claims.username.clone());

                let opponent_name = room
                    .get_opponent(claims.sub)
                    .map(|p| p.username.clone())
                    .unwrap_or_default();

                let joined = ServerEvent::RoomJoined {
                    room_id,
                    opponent: opponent_name,
                    round: room.current_round,
                    total_rounds: room.total_rounds,
                };
                let _ = ws_tx.send(Message::Text(serde_json::to_string(&joined).unwrap().into())).await;

                if room.players.len() == 2 {
                    room.broadcast(ServerEvent::RoundStart {
                        round: room.current_round,
                        total_rounds: room.total_rounds,
                    });
                }
            }

            ClientEvent::SubmitVerse { text: verse } => {
                // Find which room this player is in (simplified — iterate all rooms)
                let all_rooms = rooms.list_rooms().await;
                for (rid, _, _) in &all_rooms {
                    if let Some(room_arc) = rooms.get_room(*rid).await {
                        let mut room = room_arc.lock().await;
                        if room.players.iter().any(|p| p.user_id == claims.sub) {
                            room.submit_verse(claims.sub, verse.clone());

                            // Notify opponent
                            room.broadcast(ServerEvent::OpponentSubmitted);

                            // If both submitted, judge
                            if room.both_submitted() {
                                let subs = room.take_submissions();
                                let s1 = &subs[0];
                                let s2 = &subs[1];

                                let result = match judge::judge_battle(&s1.text, &s2.text, &config).await {
                                    Ok(r) => r,
                                    Err(_) => judge::judge_fallback(),
                                };

                                // Update scores
                                for p in room.players.iter_mut() {
                                    if p.user_id == s1.user_id {
                                        if result.player1_wins { p.score += 1; }
                                    } else {
                                        if !result.player1_wins { p.score += 1; }
                                    }
                                }

                                let round = room.current_round;

                                // Send result to both (each player sees their own scores as "player")
                                room.broadcast(ServerEvent::RoundResult {
                                    round,
                                    player_score: AxisScores {
                                        wordplay: result.player1_score.wordplay,
                                        shakespeare: result.player1_score.shakespeare,
                                        flow: result.player1_score.flow,
                                        wit: result.player1_score.wit,
                                        total: result.player1_score.total,
                                    },
                                    opponent_score: AxisScores {
                                        wordplay: result.player2_score.wordplay,
                                        shakespeare: result.player2_score.shakespeare,
                                        flow: result.player2_score.flow,
                                        wit: result.player2_score.wit,
                                        total: result.player2_score.total,
                                    },
                                    player_wins: result.player1_wins,
                                    reason: result.reason,
                                });

                                room.advance_round();

                                if room.state == RoomState::Completed {
                                    let winner = room.players.iter()
                                        .max_by_key(|p| p.score)
                                        .map(|p| p.username.clone())
                                        .unwrap_or_default();

                                    room.broadcast(ServerEvent::MatchComplete {
                                        winner,
                                        player_total: room.players.first().map(|p| p.score).unwrap_or(0),
                                        opponent_total: room.players.last().map(|p| p.score).unwrap_or(0),
                                    });
                                } else {
                                    room.broadcast(ServerEvent::RoundStart {
                                        round: room.current_round,
                                        total_rounds: room.total_rounds,
                                    });
                                }
                            }
                            break;
                        }
                    }
                }
            }

            ClientEvent::Forfeit => {
                // Find and clean up the room
                let all_rooms = rooms.list_rooms().await;
                for (rid, _, _) in &all_rooms {
                    if let Some(room_arc) = rooms.get_room(*rid).await {
                        let room = room_arc.lock().await;
                        if room.players.iter().any(|p| p.user_id == claims.sub) {
                            let opponent = room.get_opponent(claims.sub)
                                .map(|p| p.username.clone())
                                .unwrap_or_default();

                            room.broadcast(ServerEvent::MatchComplete {
                                winner: opponent,
                                player_total: 0,
                                opponent_total: 3,
                            });
                            drop(room);
                            rooms.remove_room(*rid).await;
                            break;
                        }
                    }
                }
            }

            ClientEvent::UseItem { item_id } => {
                // Item effects are applied client-side to modifiers; server just acknowledges
            }
        }
    }
}
