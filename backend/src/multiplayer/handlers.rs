//! The multiplayer routes: the quick-match queue, private rooms, reports, and the
//! WebSocket a match is played over.
//!
//! The socket carries the small protocol in `game_room.rs`. A connection can do three
//! things: join a room with a deck, submit a verse for the round being played, forfeit.
//! Everything else, scores above all, is decided in the room.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Extension, Path, State, WebSocketUpgrade,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures::{stream::SplitSink, SinkExt, StreamExt};
use serde::Serialize;
use sqlx::PgPool;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

use super::game_room::{
    run_effects, ClientEvent, GameRoom, RoomError, RoomManager, RoomState, ServerEvent, EVENT_BUFFER,
};
use super::matchmaking::{Enqueued, MatchmakingQueue};
use crate::auth::Claims;
use crate::config::Config;

/// Largest WebSocket message accepted. The largest honest one is a verse of
/// `MAX_VERSE_BYTES` in a small JSON envelope; a JSON string can at worst double it.
pub const MAX_MESSAGE_BYTES: usize = 6 * 1024;
/// A connection that has joined no room by then is closed.
const JOIN_WITHIN: Duration = Duration::from_secs(30);
/// No connection outlives the oldest room it could be in.
const MAX_CONNECTION: Duration = Duration::from_secs(45 * 60);
/// Messages one connection may send in a window before it is closed. A match needs a
/// handful in total.
const MESSAGES_PER_WINDOW: u32 = 30;
const MESSAGE_WINDOW: Duration = Duration::from_secs(10);
/// How long a quick-match request waits for another player before answering "timeout".
const QUEUE_WAIT: Duration = Duration::from_secs(30);

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/ws", get(ws_handler))
        .route("/queue", post(join_queue).delete(leave_queue))
        .route("/rooms", get(list_rooms))
        .route("/create-private", post(create_private_room))
        .route("/join/{token}", get(join_private_room))
        .route("/report", post(report_content))
}

fn refused(error: RoomError) -> (StatusCode, String) {
    let status = match error {
        RoomError::NotFound => StatusCode::NOT_FOUND,
        RoomError::ServerFull => StatusCode::SERVICE_UNAVAILABLE,
        _ => StatusCode::BAD_REQUEST,
    };
    (status, error.message())
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

    sqlx::query("INSERT INTO content_reports (reporter_id, room_id, reason) VALUES ($1, $2, $3)")
        .bind(claims.sub)
        .bind(body.room_id)
        .bind(&body.reason)
        .execute(&pool)
        .await
        .map_err(|e| {
            // The database's words stay in the log, not in the answer.
            tracing::error!(error = %e, "Could not store a content report");
            (StatusCode::INTERNAL_SERVER_ERROR, "The report could not be saved. Please try again.".to_string())
        })?;

    tracing::warn!(
        reporter = %claims.sub,
        room_id = %body.room_id,
        reason = %body.reason,
        "Content report submitted"
    );

    Ok(Json(ReportResponse { status: "reported".into() }))
}

// --- Quick match ---

#[derive(Serialize)]
struct QueueResponse {
    room_id: Option<Uuid>,
    position: usize,
    status: String,
}

fn queue_answer(room_id: Option<Uuid>, position: usize, status: &str) -> Json<QueueResponse> {
    Json(QueueResponse { room_id, position, status: status.into() })
}

/// Ask for a match and wait up to `QUEUE_WAIT` for one. The answer is "matched" with the
/// room to join, "timeout", or "cancelled" (the player left the queue or asked again from
/// another tab).
async fn join_queue(
    Extension(claims): Extension<Claims>,
    Extension(queue): Extension<Arc<MatchmakingQueue>>,
    Extension(rooms): Extension<Arc<RoomManager>>,
) -> Result<Json<QueueResponse>, (StatusCode, String)> {
    let mut rx = match queue.enqueue(claims.sub, claims.username.clone(), &rooms).await.map_err(refused)? {
        Enqueued::Matched(room_id) => return Ok(queue_answer(Some(room_id), 0, "matched")),
        Enqueued::Waiting(rx) => rx,
    };
    match tokio::time::timeout(QUEUE_WAIT, &mut rx).await {
        Ok(Ok(room_id)) => Ok(queue_answer(Some(room_id), 0, "matched")),
        Ok(Err(_)) => Ok(queue_answer(None, 0, "cancelled")),
        Err(_) => {
            queue.dequeue(claims.sub).await;
            // Someone may have arrived in the instant between the timeout and leaving the
            // queue; the room made for the two of them must not be left with one player.
            match rx.try_recv() {
                Ok(room_id) => Ok(queue_answer(Some(room_id), 0, "matched")),
                Err(_) => Ok(queue_answer(None, queue.size().await, "timeout")),
            }
        }
    }
}

async fn leave_queue(
    Extension(claims): Extension<Claims>,
    Extension(queue): Extension<Arc<MatchmakingQueue>>,
) -> StatusCode {
    queue.dequeue(claims.sub).await;
    StatusCode::NO_CONTENT
}

#[derive(Serialize)]
struct RoomInfo {
    id: Uuid,
    state: RoomState,
    player_count: usize,
}

/// The caller's own rooms. A room's id is also the token that lets a player into a private
/// room, so nobody is shown anyone else's.
async fn list_rooms(Extension(claims): Extension<Claims>, Extension(rooms): Extension<Arc<RoomManager>>) -> Json<Vec<RoomInfo>> {
    let list = rooms.rooms_of(claims.sub).await;
    Json(list.into_iter().map(|(id, state, player_count)| RoomInfo { id, state, player_count }).collect())
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
    // One open invitation per player: a new one withdraws the last.
    rooms.close_waiting_rooms_of(claims.sub).await;
    let room_id = rooms.create_room(&[(claims.sub, claims.username.clone())]).await.map_err(refused)?;
    // The room's id is the token a friend joins with: 122 random bits, shown to nobody else.
    Ok(Json(PrivateRoomResponse { room_id, token: room_id.to_string() }))
}

#[derive(Serialize)]
struct JoinPrivateResponse {
    room_id: Uuid,
    status: String,
}

/// Check an invitation before connecting: the room exists and has a seat for the caller.
/// The seat itself is taken when the player joins over the WebSocket with a deck.
async fn join_private_room(
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
    Path(token): Path<String>,
) -> Result<Json<JoinPrivateResponse>, (StatusCode, String)> {
    let room_id: Uuid = token.parse().map_err(|_| (StatusCode::BAD_REQUEST, "Invalid room token".to_string()))?;
    let room_arc = rooms.get_room(room_id).await.ok_or_else(|| refused(RoomError::NotFound))?;
    let room = room_arc.lock().await;
    if !room.has_player(claims.sub) && !room.has_open_seat() {
        return Err(refused(RoomError::Full));
    }
    Ok(Json(JoinPrivateResponse { room_id, status: "ok".into() }))
}

// --- The WebSocket ---

/// A browser sends the page's origin with a WebSocket handshake, and sends the session
/// cookie whatever page opened the socket. Only this site's own pages may open one.
fn origin_allowed(headers: &HeaderMap, config: &Config) -> bool {
    let Some(origin) = headers.get(header::ORIGIN) else {
        // Not a browser. Without the session cookie it would not have got this far.
        return true;
    };
    let Ok(origin) = origin.to_str() else { return false };
    origin == config.cors_origin || config.webauthn_origins.iter().any(|o| o.origin().ascii_serialization() == origin)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
    State((_pool, config)): State<(PgPool, Config)>,
) -> Response {
    if !origin_allowed(&headers, &config) {
        return (StatusCode::FORBIDDEN, "This page may not open a game connection.").into_response();
    }
    ws.max_message_size(MAX_MESSAGE_BYTES)
        .max_frame_size(MAX_MESSAGE_BYTES)
        .on_upgrade(move |socket| handle_socket(socket, claims, rooms))
}

/// The room a connection has joined.
struct Joined {
    room: Arc<Mutex<GameRoom>>,
    /// The number the room gave this connection.
    conn: u64,
    /// Events from the room. It closes when the room drops this connection: the player
    /// joined again from elsewhere, or this connection fell too far behind.
    rx: mpsc::Receiver<ServerEvent>,
}

async fn next_event(joined: &mut Option<Joined>) -> Option<ServerEvent> {
    match joined {
        Some(j) => j.rx.recv().await,
        None => std::future::pending().await,
    }
}

async fn send(sink: &mut SplitSink<WebSocket, Message>, event: &ServerEvent) -> Result<(), axum::Error> {
    let json = serde_json::to_string(event).expect("server events serialise");
    sink.send(Message::Text(json.into())).await
}

fn error(code: &'static str, message: &str) -> ServerEvent {
    ServerEvent::Error { code, message: message.into() }
}

async fn handle_socket(socket: WebSocket, claims: Claims, rooms: Arc<RoomManager>) {
    let (mut sink, mut stream) = socket.split();
    let mut joined: Option<Joined> = None;
    let join_deadline = tokio::time::sleep(JOIN_WITHIN);
    let lifetime = tokio::time::sleep(MAX_CONNECTION);
    tokio::pin!(join_deadline, lifetime);
    let mut window_started = Instant::now();
    let mut in_window = 0u32;

    loop {
        let waiting_to_join = joined.is_none();
        tokio::select! {
            event = next_event(&mut joined) => match event {
                Some(event) => {
                    if send(&mut sink, &event).await.is_err() {
                        break;
                    }
                    // The match is over and the player has been told: nothing more to say.
                    if matches!(event, ServerEvent::MatchComplete { .. }) {
                        break;
                    }
                }
                None => {
                    let _ = send(&mut sink, &error("connection_replaced", "This game is open in another window, or the connection fell behind.")).await;
                    break;
                }
            },
            _ = &mut join_deadline, if waiting_to_join => {
                let _ = send(&mut sink, &error("join_timeout", "No room was joined in time.")).await;
                break;
            }
            _ = &mut lifetime => break,
            message = stream.next() => {
                let text = match message {
                    Some(Ok(Message::Text(text))) => text,
                    // Pings are answered by the library; binary frames mean nothing here.
                    Some(Ok(Message::Ping(_) | Message::Pong(_) | Message::Binary(_))) => continue,
                    // Closed, broken, or a message over the size limit.
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                };
                if window_started.elapsed() > MESSAGE_WINDOW {
                    window_started = Instant::now();
                    in_window = 0;
                }
                in_window += 1;
                if in_window > MESSAGES_PER_WINDOW {
                    let _ = send(&mut sink, &error("too_many_messages", "Too many messages. The connection is closed.")).await;
                    break;
                }
                let event: ClientEvent = match serde_json::from_str(text.as_str()) {
                    Ok(event) => event,
                    Err(_) => {
                        if send(&mut sink, &error("bad_message", "Invalid message format")).await.is_err() {
                            break;
                        }
                        continue;
                    }
                };
                if let Some(problem) = handle_event(event, &claims, &rooms, &mut joined).await {
                    if send(&mut sink, &problem).await.is_err() {
                        break;
                    }
                }
            }
        }
    }

    if let Some(j) = joined {
        let effects = j.room.lock().await.disconnect(claims.sub, j.conn);
        run_effects(&j.room, effects);
    }
    let _ = sink.close().await;
}

/// Act on one message. Returns the error to tell the player, if the room refused it.
async fn handle_event(
    event: ClientEvent,
    claims: &Claims,
    rooms: &RoomManager,
    joined: &mut Option<Joined>,
) -> Option<ServerEvent> {
    match event {
        ClientEvent::JoinRoom { room_id, deck } => {
            if joined.is_some() {
                return Some(error("already_in_room", "This connection is already in a room."));
            }
            let Some(room) = rooms.get_room(room_id).await else {
                return Some(RoomError::NotFound.event());
            };
            let (tx, rx) = mpsc::channel(EVENT_BUFFER);
            let outcome = room.lock().await.join(claims.sub, &claims.username, &deck, tx);
            match outcome {
                Ok((conn, effects)) => {
                    run_effects(&room, effects);
                    *joined = Some(Joined { room, conn, rx });
                    None
                }
                Err(refusal) => Some(refusal.event()),
            }
        }
        ClientEvent::SubmitVerse { round, char_id, text } => {
            let Some(j) = joined else {
                return Some(RoomError::NotInRoom.event());
            };
            let outcome = j.room.lock().await.submit(claims.sub, round, &char_id, &text);
            match outcome {
                Ok(effects) => {
                    run_effects(&j.room, effects);
                    None
                }
                Err(refusal) => Some(refusal.event()),
            }
        }
        ClientEvent::Forfeit => {
            if let Some(j) = joined {
                j.room.lock().await.forfeit(claims.sub);
            }
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(pairs: &[(&str, &str)]) -> Config {
        let lookup = |name: &str| {
            let given = pairs.iter().find(|(k, _)| *k == name).map(|(_, v)| v.to_string());
            given.or_else(|| (name == "JWT_SECRET").then(|| "a-test-secret-that-is-long-enough-0123456789abcdef".to_string()))
        };
        Config::from_lookup(lookup).expect("a valid configuration").0
    }

    fn with_origin(origin: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(header::ORIGIN, origin.parse().unwrap());
        headers
    }

    #[test]
    fn only_this_sites_pages_may_open_the_game_socket() {
        let c = config(&[
            ("CORS_ORIGIN", "http://localhost:4399"),
            ("WEBAUTHN_RP_ID", "localhost"),
            ("WEBAUTHN_ORIGIN", "http://localhost:4399,http://localhost:4398"),
        ]);
        assert!(origin_allowed(&with_origin("http://localhost:4399"), &c));
        assert!(origin_allowed(&with_origin("http://localhost:4398"), &c));
        assert!(!origin_allowed(&with_origin("http://localhost:9999"), &c));
        assert!(!origin_allowed(&with_origin("https://evil.example"), &c));
        assert!(!origin_allowed(&with_origin("null"), &c));
        // No Origin header: not a browser.
        assert!(origin_allowed(&HeaderMap::new(), &c));

        let production = config(&[]);
        assert!(origin_allowed(&with_origin("https://sonnetman.inspiredmile.com"), &production));
        assert!(!origin_allowed(&with_origin("https://inspiredmile.com.evil.example"), &production));
    }

    #[test]
    fn the_message_limit_holds_the_largest_honest_verse() {
        // Every byte of a verse escaped as two, plus the envelope.
        assert!(MAX_MESSAGE_BYTES >= 2 * super::super::game_room::MAX_VERSE_BYTES + 200);
    }
}
