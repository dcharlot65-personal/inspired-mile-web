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
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;
use super::content_filter;
use super::game_room::{ClientEvent, RoomManager, RoomState, ServerEvent, AxisScores};
use super::judge;
use super::matchmaking::MatchmakingQueue;

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/ws", get(ws_handler))
        .route("/queue", post(join_queue))
        .route("/rooms", get(list_rooms))
        .route("/create-private", post(create_private_room))
        .route("/join/{token}", get(join_private_room))
        .route("/report", post(report_content))
}

// --- Content Report ---

#[derive(serde::Deserialize)]
struct ReportRequest {
    room_id: Uuid,
    reason: String,
}

#[derive(Serialize)]
struct ReportResponse {
    status: String,
}

async fn report_content(
    Extension(claims): Extension<Claims>,
    State((pool, _config)): State<(PgPool, Config)>,
    Json(body): Json<ReportRequest>,
) -> Result<Json<ReportResponse>, (StatusCode, String)> {
    if body.reason.is_empty() || body.reason.len() > 500 {
        return Err((StatusCode::BAD_REQUEST, "Reason must be 1-500 characters".into()));
    }

    sqlx::query(
        "INSERT INTO content_reports (reporter_id, room_id, reason) VALUES ($1, $2, $3)"
    )
    .bind(claims.sub)
    .bind(body.room_id.to_string())
    .bind(&body.reason)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to submit report: {e}")))?;

    tracing::warn!(
        reporter = %claims.sub,
        room_id = %body.room_id,
        reason = %body.reason,
        "Content report submitted"
    );

    Ok(Json(ReportResponse {
        status: "reported".into(),
    }))
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
                room.add_player(result.opponent_user_id, result.opponent_username);
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

// --- Challenge-a-Friend: Private Rooms ---

#[derive(Serialize)]
struct PrivateRoomResponse {
    room_id: Uuid,
    token: String,
}

async fn create_private_room(
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
) -> Result<Json<PrivateRoomResponse>, (StatusCode, String)> {
    let room_id = rooms.create_room(3).await;

    // Add the creator as the first player
    if let Some(room_arc) = rooms.get_room(room_id).await {
        let mut room = room_arc.lock().await;
        room.add_player(claims.sub, claims.username.clone());
    }

    // Use the room_id as the shareable token (simple but effective)
    let token = room_id.to_string();

    Ok(Json(PrivateRoomResponse { room_id, token }))
}

#[derive(Serialize)]
struct JoinPrivateResponse {
    room_id: Uuid,
    status: String,
}

async fn join_private_room(
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
    axum::extract::Path(token): axum::extract::Path<String>,
) -> Result<Json<JoinPrivateResponse>, (StatusCode, String)> {
    let room_id: Uuid = token.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid room token".into()))?;

    let room_arc = rooms.get_room(room_id).await
        .ok_or((StatusCode::NOT_FOUND, "Room not found or expired".into()))?;

    let mut room = room_arc.lock().await;
    if room.players.len() >= 2 {
        return Err((StatusCode::BAD_REQUEST, "Room is full".into()));
    }

    room.add_player(claims.sub, claims.username.clone());

    Ok(Json(JoinPrivateResponse {
        room_id,
        status: "joined".into(),
    }))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
    State((_pool, config)): State<(PgPool, Config)>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, claims, rooms, config))
}

async fn handle_socket(
    socket: WebSocket,
    claims: Claims,
    rooms: Arc<RoomManager>,
    config: Config,
) {
    let (ws_tx, mut ws_rx) = socket.split();
    let ws_tx = Arc::new(tokio::sync::Mutex::new(ws_tx));
    let mut current_room_id: Option<Uuid> = None;

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
                let _ = ws_tx.lock().await.send(Message::Text(serde_json::to_string(&err).unwrap().into())).await;
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
                        let _ = ws_tx.lock().await.send(Message::Text(serde_json::to_string(&err).unwrap().into())).await;
                        continue;
                    }
                };

                let mut room = room_arc.lock().await;
                room.add_player(claims.sub, claims.username.clone());
                current_room_id = Some(room_id);

                // Send join confirmation directly (before subscribing to avoid echo)
                let joined = ServerEvent::RoomJoined {
                    room_id,
                    opponent: room.get_opponent(claims.sub).map(|p| p.username.clone()).unwrap_or_default(),
                    round: room.current_round,
                    total_rounds: room.total_rounds,
                };
                let _ = ws_tx.lock().await.send(Message::Text(serde_json::to_string(&joined).unwrap().into())).await;

                // Subscribe to room broadcasts and forward to this player's WebSocket
                let mut rx = room.subscribe();
                let fwd_tx = ws_tx.clone();
                tokio::spawn(async move {
                    while let Ok(event) = rx.recv().await {
                        let json = serde_json::to_string(&event).unwrap();
                        if fwd_tx.lock().await.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    }
                });

                // If both players joined, broadcast round start (received by both via subscription)
                if room.players.len() == 2 {
                    room.broadcast(ServerEvent::RoundStart {
                        round: room.current_round,
                        total_rounds: room.total_rounds,
                    });
                }
            }

            ClientEvent::SubmitVerse { text: verse } => {
                // Input validation: verse length
                if verse.is_empty() || verse.len() > 2000 {
                    let err = ServerEvent::Error {
                        message: "Verse must be between 1 and 2000 characters".into(),
                    };
                    let _ = ws_tx.lock().await.send(Message::Text(serde_json::to_string(&err).unwrap().into())).await;
                    continue;
                }

                // Content moderation filter
                let filter_result = content_filter::check_content(&verse);
                if !filter_result.allowed {
                    let err = ServerEvent::Error {
                        message: filter_result.reason.unwrap_or_else(|| "Content rejected by moderation filter.".into()),
                    };
                    let _ = ws_tx.lock().await.send(Message::Text(serde_json::to_string(&err).unwrap().into())).await;
                    continue;
                }

                let room_id = match current_room_id {
                    Some(id) => id,
                    None => continue,
                };
                let room_arc = match rooms.get_room(room_id).await {
                    Some(r) => r,
                    None => continue,
                };

                let mut room = room_arc.lock().await;
                room.submit_verse(claims.sub, verse);
                room.broadcast(ServerEvent::OpponentSubmitted);

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
            }

            ClientEvent::Forfeit => {
                if let Some(room_id) = current_room_id {
                    if let Some(room_arc) = rooms.get_room(room_id).await {
                        let room = room_arc.lock().await;
                        let opponent = room.get_opponent(claims.sub)
                            .map(|p| p.username.clone())
                            .unwrap_or_default();

                        room.broadcast(ServerEvent::MatchComplete {
                            winner: opponent,
                            player_total: 0,
                            opponent_total: 3,
                        });
                        drop(room);
                        rooms.remove_room(room_id).await;
                        current_room_id = None;
                    }
                }
            }

            ClientEvent::UseItem { .. } => {
                // Item effects are applied client-side; no server-side action needed
            }
        }
    }

    // Player disconnected — notify opponent
    if let Some(room_id) = current_room_id {
        if let Some(room_arc) = rooms.get_room(room_id).await {
            let room = room_arc.lock().await;
            room.broadcast(ServerEvent::OpponentDisconnected);
        }
    }
}
