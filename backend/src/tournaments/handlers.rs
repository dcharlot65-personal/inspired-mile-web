use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;

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
}

#[derive(Serialize)]
pub struct LeaderboardEntry {
    user_id: Uuid,
    username: String,
    wins: i64,
    losses: i64,
}

#[derive(Deserialize)]
pub struct CreateTournamentRequest {
    name: String,
    description: Option<String>,
    format: Option<String>,
    max_players: Option<i32>,
    starts_at: String,
}

#[derive(Deserialize)]
pub struct CompleteMatchRequest {
    winner_id: Uuid,
    battle_room_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct MatchCompletionResponse {
    match_id: Uuid,
    winner_id: Uuid,
    tournament_completed: bool,
    next_match_id: Option<Uuid>,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_tournaments))
        .route("/create", post(create_tournament))
        .route("/{id}", get(get_tournament))
        .route("/{id}/register", post(register_tournament))
        .route("/{id}/bracket", get(get_bracket))
        .route("/{id}/leaderboard", get(get_leaderboard))
        .route("/{id}/matches/{match_id}/complete", post(complete_match))
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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
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
    if body.name.is_empty() || body.name.len() > 128 {
        return Err((StatusCode::BAD_REQUEST, "Tournament name must be between 1 and 128 characters".into()));
    }

    let format = body.format.unwrap_or_else(|| "single_elimination".into());
    if format != "single_elimination" && format != "round_robin" {
        return Err((StatusCode::BAD_REQUEST, "Format must be 'single_elimination' or 'round_robin'".into()));
    }
    let max_players = body.max_players.unwrap_or(16);

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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

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
    // Check tournament exists and is in registration
    let tournament = sqlx::query("SELECT status, max_players FROM tournaments WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .ok_or((StatusCode::NOT_FOUND, "Tournament not found".into()))?;

    let status: String = tournament.get("status");
    if status != "registration" {
        return Err((StatusCode::BAD_REQUEST, "Tournament is not accepting registrations".into()));
    }

    let max: i32 = tournament.get("max_players");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

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
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    Ok(Json(serde_json::json!({ "registered": true })))
}

async fn get_bracket(
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<BracketMatch>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT m.id, m.round, m.match_order, m.player1_id, m.player2_id, m.winner_id, m.status,
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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

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
    }).collect();

    Ok(Json(matches))
}

async fn get_leaderboard(
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<LeaderboardEntry>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT u.id as user_id, u.username,
                COUNT(CASE WHEN m.winner_id = u.id THEN 1 END) as wins,
                COUNT(CASE WHEN m.winner_id IS NOT NULL AND m.winner_id != u.id THEN 1 END) as losses
         FROM tournament_entries e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN tournament_matches m ON m.tournament_id = e.tournament_id
           AND (m.player1_id = u.id OR m.player2_id = u.id)
           AND m.status = 'completed'
         WHERE e.tournament_id = $1
         GROUP BY u.id, u.username
         ORDER BY wins DESC, losses ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let entries = rows.iter().map(|r| LeaderboardEntry {
        user_id: r.get("user_id"),
        username: r.get("username"),
        wins: r.get("wins"),
        losses: r.get("losses"),
    }).collect();

    Ok(Json(entries))
}

async fn complete_match(
    Extension(claims): Extension<Claims>,
    Path((tournament_id, match_id)): Path<(Uuid, Uuid)>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<CompleteMatchRequest>,
) -> Result<Json<MatchCompletionResponse>, (StatusCode, String)> {
    // Fetch the match
    let m = sqlx::query(
        "SELECT id, round, match_order, player1_id, player2_id, winner_id, status
         FROM tournament_matches WHERE id = $1 AND tournament_id = $2",
    )
    .bind(match_id)
    .bind(tournament_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "Match not found".into()))?;

    let status: String = m.get("status");
    if status != "pending" && status != "in_progress" {
        return Err((StatusCode::BAD_REQUEST, format!("Match is already {status}")));
    }

    let p1: Option<Uuid> = m.get("player1_id");
    let p2: Option<Uuid> = m.get("player2_id");

    // Authorization: only a match participant can complete the match
    if Some(claims.sub) != p1 && Some(claims.sub) != p2 {
        return Err((StatusCode::FORBIDDEN, "Only match participants can complete a match".into()));
    }

    if Some(body.winner_id) != p1 && Some(body.winner_id) != p2 {
        return Err((StatusCode::BAD_REQUEST, "winner_id must be player1 or player2".into()));
    }

    let round: i32 = m.get("round");
    let match_order: i32 = m.get("match_order");

    // Determine loser
    let loser_id = if Some(body.winner_id) == p1 { p2 } else { p1 };

    // Update the match as completed
    sqlx::query(
        "UPDATE tournament_matches
         SET winner_id = $1, status = 'completed', room_id = $2, completed_at = NOW()
         WHERE id = $3",
    )
    .bind(body.winner_id)
    .bind(body.battle_room_id)
    .bind(match_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    // Mark loser as eliminated
    if let Some(loser) = loser_id {
        sqlx::query(
            "UPDATE tournament_entries SET eliminated = true
             WHERE tournament_id = $1 AND user_id = $2",
        )
        .bind(tournament_id)
        .bind(loser)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
    }

    // Bracket advancement: slot winner into next round
    let next_round = round + 1;
    let next_match_order = (match_order + 1) / 2; // pairs fold: 1,2→1  3,4→2  etc.
    let is_first_slot = match_order % 2 == 1; // odd match_order → player1, even → player2

    // Check if a next-round match already exists
    let next_match = sqlx::query(
        "SELECT id, player1_id, player2_id FROM tournament_matches
         WHERE tournament_id = $1 AND round = $2 AND match_order = $3",
    )
    .bind(tournament_id)
    .bind(next_round)
    .bind(next_match_order)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let next_match_id: Option<Uuid> = if let Some(nm) = next_match {
        let nm_id: Uuid = nm.get("id");
        // Update existing next-round match with the winner
        let col = if is_first_slot { "player1_id" } else { "player2_id" };
        sqlx::query(&format!(
            "UPDATE tournament_matches SET {col} = $1 WHERE id = $2"
        ))
        .bind(body.winner_id)
        .bind(nm_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
        Some(nm_id)
    } else {
        // Check if this was the final match (no more matches expected in next round)
        // Count total matches in the current round
        let matches_in_round: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = $1 AND round = $2",
        )
        .bind(tournament_id)
        .bind(round)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

        if matches_in_round > 1 {
            // More matches in this round → create next-round match
            let (p1_val, p2_val): (Option<Uuid>, Option<Uuid>) = if is_first_slot {
                (Some(body.winner_id), None)
            } else {
                (None, Some(body.winner_id))
            };

            let row = sqlx::query(
                "INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')
                 RETURNING id",
            )
            .bind(tournament_id)
            .bind(next_round)
            .bind(next_match_order)
            .bind(p1_val)
            .bind(p2_val)
            .fetch_one(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
            Some(row.get("id"))
        } else {
            None // This was the final — no next match
        }
    };

    // Check if tournament is complete (no pending/in_progress matches remain)
    let remaining: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tournament_matches
         WHERE tournament_id = $1 AND status IN ('pending', 'in_progress')",
    )
    .bind(tournament_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let tournament_completed = remaining == 0;
    if tournament_completed {
        sqlx::query(
            "UPDATE tournaments SET status = 'completed', completed_at = NOW() WHERE id = $1",
        )
        .bind(tournament_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
    }

    Ok(Json(MatchCompletionResponse {
        match_id,
        winner_id: body.winner_id,
        tournament_completed,
        next_match_id,
    }))
}
