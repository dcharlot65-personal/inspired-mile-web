//! Tournaments: create, register, the bracket and the standings, and the room each match is
//! played in. A match's result comes only from a room the server judged (`progress.rs`): no
//! participant names a winner.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::{ConnectInfo, Extension, Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;
use crate::multiplayer::RoomManager;

/// Players one tournament may take.
const MAX_PLAYERS: i32 = 64;
/// Characters a tournament's description may have.
const MAX_DESCRIPTION: usize = 1000;

#[derive(Serialize)]
pub struct TournamentResponse {
    id: Uuid,
    name: String,
    description: Option<String>,
    format: String,
    max_players: i32,
    status: String,
    player_count: i64,
    starts_at: String,
    created_at: String,
}

#[derive(Serialize)]
pub struct BracketMatch {
    id: Uuid,
    round: i32,
    match_order: i32,
    player1_id: Option<Uuid>,
    player1_name: Option<String>,
    player2_id: Option<Uuid>,
    player2_name: Option<String>,
    winner_id: Option<Uuid>,
    status: String,
    /// The stored result (`battle_rooms`) of the room that decided the match.
    room_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct LeaderboardEntry {
    user_id: Uuid,
    username: String,
    wins: i64,
    losses: i64,
    eliminated: bool,
}

#[derive(Deserialize)]
pub struct CreateTournamentRequest {
    name: String,
    description: Option<String>,
    format: Option<String>,
    max_players: Option<i32>,
    starts_at: String,
}

#[derive(Serialize)]
pub struct MatchRoomResponse {
    room_id: Uuid,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_tournaments))
        .route("/create", post(create_tournament))
        .route("/{id}", get(get_tournament))
        .route("/{id}/register", post(register_tournament))
        .route("/{id}/bracket", get(get_bracket))
        .route("/{id}/leaderboard", get(get_leaderboard))
        .route("/{id}/matches/{match_id}/room", post(open_match_room))
}

async fn list_tournaments(
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<TournamentResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT t.id, t.name, t.description, t.format, t.max_players, t.status, t.starts_at, t.created_at,
                (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id) as player_count
         FROM tournaments t
         ORDER BY t.starts_at DESC
         LIMIT 50",
    )
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let tournaments = rows.iter().map(|r| TournamentResponse {
        id: r.get("id"),
        name: r.get("name"),
        description: r.get("description"),
        format: r.get("format"),
        max_players: r.get("max_players"),
        status: r.get("status"),
        player_count: r.get("player_count"),
        starts_at: r.get::<chrono::DateTime<chrono::Utc>, _>("starts_at").to_rfc3339(),
        created_at: r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }).collect();

    Ok(Json(tournaments))
}

async fn get_tournament(
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<TournamentResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT t.id, t.name, t.description, t.format, t.max_players, t.status, t.starts_at, t.created_at,
                (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id) as player_count
         FROM tournaments t
         WHERE t.id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::NOT_FOUND, "Tournament not found".into()))?;

    Ok(Json(TournamentResponse {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        format: row.get("format"),
        max_players: row.get("max_players"),
        status: row.get("status"),
        player_count: row.get("player_count"),
        starts_at: row.get::<chrono::DateTime<chrono::Utc>, _>("starts_at").to_rfc3339(),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

async fn create_tournament(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<CreateTournamentRequest>,
) -> Result<Json<TournamentResponse>, (StatusCode, String)> {
    // Input validation
    if body.name.trim().is_empty() || body.name.chars().count() > 128 {
        return Err((StatusCode::BAD_REQUEST, "Tournament name must be between 1 and 128 characters".into()));
    }

    let format = body.format.unwrap_or_else(|| "single_elimination".into());
    if format != "single_elimination" && format != "round_robin" {
        return Err((StatusCode::BAD_REQUEST, "Format must be 'single_elimination' or 'round_robin'".into()));
    }
    let max_players = body.max_players.unwrap_or(16);
    if !(2..=MAX_PLAYERS).contains(&max_players) {
        return Err((StatusCode::BAD_REQUEST, "A tournament takes 2 to 64 players".into()));
    }
    if body.description.as_ref().is_some_and(|d| d.chars().count() > MAX_DESCRIPTION) {
        return Err((StatusCode::BAD_REQUEST, "Description too long".into()));
    }

    let starts_at: chrono::DateTime<chrono::Utc> = body.starts_at.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid starts_at datetime".into()))?;

    let row = sqlx::query(
        "INSERT INTO tournaments (name, description, format, max_players, starts_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&format)
    .bind(max_players)
    .bind(starts_at)
    .bind(claims.sub)
    .fetch_one(&pool)
    .await
    .map_err(crate::error::internal)?;

    Ok(Json(TournamentResponse {
        id: row.get("id"),
        name: body.name,
        description: body.description,
        format,
        max_players,
        status: "registration".into(),
        player_count: 0,
        starts_at: starts_at.to_rfc3339(),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

async fn register_tournament(
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    // Locked, so two registrations at once cannot both take the last place or the same seed.
    let tournament = sqlx::query("SELECT status, max_players FROM tournaments WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::NOT_FOUND, "Tournament not found".into()))?;

    let status: String = tournament.get("status");
    if status != "registration" {
        return Err((StatusCode::BAD_REQUEST, "Tournament is not accepting registrations".into()));
    }

    let max: i32 = tournament.get("max_players");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .map_err(crate::error::internal)?;

    if count >= max as i64 {
        return Err((StatusCode::BAD_REQUEST, "Tournament is full".into()));
    }

    sqlx::query(
        "INSERT INTO tournament_entries (tournament_id, user_id, seed)
         VALUES ($1, $2, $3)
         ON CONFLICT (tournament_id, user_id) DO NOTHING",
    )
    .bind(id)
    .bind(claims.sub)
    .bind((count + 1) as i32)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;

    Ok(Json(serde_json::json!({ "registered": true })))
}

async fn get_bracket(
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<BracketMatch>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT m.id, m.round, m.match_order, m.player1_id, m.player2_id, m.winner_id, m.status, m.room_id,
                u1.username as p1_name, u2.username as p2_name
         FROM tournament_matches m
         LEFT JOIN users u1 ON u1.id = m.player1_id
         LEFT JOIN users u2 ON u2.id = m.player2_id
         WHERE m.tournament_id = $1
         ORDER BY m.round, m.match_order",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let matches = rows.iter().map(|r| BracketMatch {
        id: r.get("id"),
        round: r.get("round"),
        match_order: r.get("match_order"),
        player1_id: r.get("player1_id"),
        player1_name: r.get("p1_name"),
        player2_id: r.get("player2_id"),
        player2_name: r.get("p2_name"),
        winner_id: r.get("winner_id"),
        status: r.get("status"),
        room_id: r.get("room_id"),
    }).collect();

    Ok(Json(matches))
}

async fn get_leaderboard(
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<LeaderboardEntry>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT u.id as user_id, u.username, e.eliminated,
                COUNT(CASE WHEN m.winner_id = u.id THEN 1 END) as wins,
                COUNT(CASE WHEN m.winner_id IS NOT NULL AND m.winner_id != u.id THEN 1 END) as losses
         FROM tournament_entries e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN tournament_matches m ON m.tournament_id = e.tournament_id
           AND (m.player1_id = u.id OR m.player2_id = u.id)
           AND m.status = 'completed'
         WHERE e.tournament_id = $1
         GROUP BY u.id, u.username, e.eliminated
         ORDER BY wins DESC, losses ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let entries = rows.iter().map(|r| LeaderboardEntry {
        user_id: r.get("user_id"),
        username: r.get("username"),
        wins: r.get("wins"),
        losses: r.get("losses"),
        eliminated: r.get("eliminated"),
    }).collect();

    Ok(Json(entries))
}

/// The room a tournament match is played in: the live one already open for it, or a new one
/// with both players' seats held. Either player may ask; the room is judged like any other, and
/// its result, stored by the server, is the match's result (`progress::from_room`).
async fn open_match_room(
    Extension(claims): Extension<Claims>,
    Extension(rooms): Extension<Arc<RoomManager>>,
    Path((tournament_id, match_id)): Path<(Uuid, Uuid)>,
    State((pool, config)): State<(PgPool, Config)>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Json<MatchRoomResponse>, (StatusCode, String)> {
    let m = sqlx::query(
        "SELECT m.player1_id, m.player2_id, m.status, u1.username AS p1_name, u2.username AS p2_name
         FROM tournament_matches m
         LEFT JOIN users u1 ON u1.id = m.player1_id
         LEFT JOIN users u2 ON u2.id = m.player2_id
         WHERE m.id = $1 AND m.tournament_id = $2",
    )
    .bind(match_id)
    .bind(tournament_id)
    .fetch_optional(&pool)
    .await
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::NOT_FOUND, "Match not found".into()))?;

    let status: String = m.get("status");
    if status != "pending" && status != "in_progress" {
        return Err((StatusCode::BAD_REQUEST, format!("Match is already {status}")));
    }
    let (p1, p2): (Option<Uuid>, Option<Uuid>) = (m.get("player1_id"), m.get("player2_id"));
    let (Some(p1), Some(p2)) = (p1, p2) else {
        return Err((StatusCode::BAD_REQUEST, "The opponent is not known yet".into()));
    };
    if claims.sub != p1 && claims.sub != p2 {
        return Err((StatusCode::FORBIDDEN, "Only match participants can play a match".into()));
    }
    let seats = [(p1, m.get::<String, _>("p1_name")), (p2, m.get::<String, _>("p2_name"))];
    let origin = crate::multiplayer::handlers::origin_of(&headers, peer, &config);
    let room_id = rooms
        .open_tournament_room(&seats, &origin, match_id)
        .await
        .map_err(crate::multiplayer::handlers::refused)?;
    sqlx::query("UPDATE tournament_matches SET status = 'in_progress' WHERE id = $1 AND status = 'pending'")
        .bind(match_id)
        .execute(&pool)
        .await
        .map_err(crate::error::internal)?;
    Ok(Json(MatchRoomResponse { room_id }))
}
