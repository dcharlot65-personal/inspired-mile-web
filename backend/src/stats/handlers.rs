use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;

#[derive(Serialize)]
pub struct PlayerStats {
    pub battle_wins: i32,
    pub total_battles: i32,
    pub total_rounds: i32,
    pub highest_score: i32,
    pub trivia_correct: i32,
    pub trivia_perfect: i32,
    pub challenges_completed: i32,
    pub unique_cards: i32,
    pub total_cards: i32,
    pub packs_opened: i32,
    pub variants_unlocked: i32,
    pub unique_cities: i32,
}

#[derive(Deserialize)]
pub struct UpdateStatsRequest {
    pub battle_wins: Option<i32>,
    pub total_battles: Option<i32>,
    pub total_rounds: Option<i32>,
    pub highest_score: Option<i32>,
    pub trivia_correct: Option<i32>,
    pub trivia_perfect: Option<i32>,
    pub challenges_completed: Option<i32>,
    pub packs_opened: Option<i32>,
}

#[derive(Serialize)]
pub struct UnlockedAchievement {
    pub achievement_id: String,
    pub unlocked_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CheckAchievementsRequest {
    pub achievement_ids: Vec<String>,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(get_stats).post(update_stats))
        .route("/achievements", get(list_achievements).post(check_achievements))
}

pub fn public_router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/leaderboard", get(get_leaderboard))
}

#[derive(Serialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub battle_wins: i32,
    pub total_battles: i32,
    pub highest_score: i32,
}

async fn get_leaderboard(
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<LeaderboardEntry>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT u.id, u.username, u.avatar_url,
                ps.battle_wins, ps.total_battles, ps.highest_score
         FROM player_stats ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.battle_wins > 0
         ORDER BY ps.battle_wins DESC, ps.highest_score DESC
         LIMIT 50",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let entries: Vec<LeaderboardEntry> = rows
        .iter()
        .enumerate()
        .map(|(i, r)| {
            let id: uuid::Uuid = r.get("id");
            LeaderboardEntry {
                rank: (i + 1) as i32,
                user_id: id.to_string(),
                username: r.get("username"),
                avatar_url: r.get("avatar_url"),
                battle_wins: r.get("battle_wins"),
                total_battles: r.get("total_battles"),
                highest_score: r.get("highest_score"),
            }
        })
        .collect();

    Ok(Json(entries))
}

async fn get_stats(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<PlayerStats>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT battle_wins, total_battles, total_rounds, highest_score,
                trivia_correct, trivia_perfect, challenges_completed,
                unique_cards, total_cards, packs_opened,
                variants_unlocked, unique_cities
         FROM player_stats WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "No stats found".into()))?;

    Ok(Json(PlayerStats {
        battle_wins: row.get("battle_wins"),
        total_battles: row.get("total_battles"),
        total_rounds: row.get("total_rounds"),
        highest_score: row.get("highest_score"),
        trivia_correct: row.get("trivia_correct"),
        trivia_perfect: row.get("trivia_perfect"),
        challenges_completed: row.get("challenges_completed"),
        unique_cards: row.get("unique_cards"),
        total_cards: row.get("total_cards"),
        packs_opened: row.get("packs_opened"),
        variants_unlocked: row.get("variants_unlocked"),
        unique_cities: row.get("unique_cities"),
    }))
}

async fn update_stats(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<UpdateStatsRequest>,
) -> Result<Json<PlayerStats>, (StatusCode, String)> {
    // Input validation: all stat values must be non-negative and bounded
    let max_val = 999_999;
    for val in [body.battle_wins, body.total_battles, body.total_rounds, body.highest_score,
                body.trivia_correct, body.trivia_perfect, body.challenges_completed, body.packs_opened] {
        if let Some(v) = val {
            if v < 0 || v > max_val {
                return Err((StatusCode::BAD_REQUEST, format!("Stat values must be between 0 and {max_val}")));
            }
        }
    }

    let row = sqlx::query(
        "UPDATE player_stats SET
           battle_wins = GREATEST(battle_wins, COALESCE($2, battle_wins)),
           total_battles = GREATEST(total_battles, COALESCE($3, total_battles)),
           total_rounds = GREATEST(total_rounds, COALESCE($4, total_rounds)),
           highest_score = GREATEST(highest_score, COALESCE($5, highest_score)),
           trivia_correct = GREATEST(trivia_correct, COALESCE($6, trivia_correct)),
           trivia_perfect = GREATEST(trivia_perfect, COALESCE($7, trivia_perfect)),
           challenges_completed = GREATEST(challenges_completed, COALESCE($8, challenges_completed)),
           packs_opened = GREATEST(packs_opened, COALESCE($9, packs_opened)),
           updated_at = NOW()
         WHERE user_id = $1
         RETURNING battle_wins, total_battles, total_rounds, highest_score,
                   trivia_correct, trivia_perfect, challenges_completed,
                   unique_cards, total_cards, packs_opened,
                   variants_unlocked, unique_cities",
    )
    .bind(claims.sub)
    .bind(body.battle_wins)
    .bind(body.total_battles)
    .bind(body.total_rounds)
    .bind(body.highest_score)
    .bind(body.trivia_correct)
    .bind(body.trivia_perfect)
    .bind(body.challenges_completed)
    .bind(body.packs_opened)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    Ok(Json(PlayerStats {
        battle_wins: row.get("battle_wins"),
        total_battles: row.get("total_battles"),
        total_rounds: row.get("total_rounds"),
        highest_score: row.get("highest_score"),
        trivia_correct: row.get("trivia_correct"),
        trivia_perfect: row.get("trivia_perfect"),
        challenges_completed: row.get("challenges_completed"),
        unique_cards: row.get("unique_cards"),
        total_cards: row.get("total_cards"),
        packs_opened: row.get("packs_opened"),
        variants_unlocked: row.get("variants_unlocked"),
        unique_cities: row.get("unique_cities"),
    }))
}

async fn list_achievements(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<UnlockedAchievement>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT achievement_id, unlocked_at
         FROM unlocked_achievements WHERE user_id = $1
         ORDER BY unlocked_at",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let achievements: Vec<UnlockedAchievement> = rows
        .iter()
        .map(|r| UnlockedAchievement {
            achievement_id: r.get("achievement_id"),
            unlocked_at: r.get("unlocked_at"),
        })
        .collect();

    Ok(Json(achievements))
}

async fn check_achievements(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<CheckAchievementsRequest>,
) -> Result<Json<Vec<String>>, (StatusCode, String)> {
    // Input validation
    if body.achievement_ids.len() > 50 {
        return Err((StatusCode::BAD_REQUEST, "Maximum 50 achievements per request".into()));
    }
    for id in &body.achievement_ids {
        if id.len() > 32 || !id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err((StatusCode::BAD_REQUEST, format!("Invalid achievement ID: {id}")));
        }
    }

    let mut newly_unlocked = Vec::new();

    for achievement_id in &body.achievement_ids {
        let result = sqlx::query(
            "INSERT INTO unlocked_achievements (user_id, achievement_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, achievement_id) DO NOTHING
             RETURNING achievement_id",
        )
        .bind(claims.sub)
        .bind(achievement_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

        if let Some(row) = result {
            newly_unlocked.push(row.get::<String, _>("achievement_id"));
        }
    }

    Ok(Json(newly_unlocked))
}
