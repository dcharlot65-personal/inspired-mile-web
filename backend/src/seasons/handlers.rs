use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;

#[derive(Serialize)]
pub struct SeasonInfo {
    pub id: i32,
    pub name: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub max_level: i32,
}

#[derive(Serialize)]
pub struct SeasonProgress {
    pub season: SeasonInfo,
    pub xp: i32,
    pub level: i32,
    pub xp_to_next: i32,
}

#[derive(Serialize)]
pub struct SeasonReward {
    pub level: i32,
    pub reward_type: String,
    pub reward_value: String,
    pub is_premium: bool,
    pub claimed: bool,
}

#[derive(Deserialize)]
pub struct AddXpRequest {
    pub source: String,
    pub amount: Option<i32>,
}

/// XP rates by activity source
fn xp_for_source(source: &str) -> i32 {
    match source {
        "battle" => 100,
        "trivia" => 50,
        "challenge" => 40,
        "daily" => 25,
        _ => 10,
    }
}

/// XP needed to reach a given level (simple linear: level * 200)
fn xp_for_level(level: i32) -> i32 {
    level * 200
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/current", get(get_current_season))
        .route("/xp", post(add_xp))
        .route("/rewards", get(get_rewards))
        .route("/claim/{level}", post(claim_reward))
}

async fn get_current_season(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<SeasonProgress>, (StatusCode, String)> {
    let season = sqlx::query(
        "SELECT id, name, start_date, end_date, max_level FROM seasons WHERE active = TRUE LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");

    let progress = sqlx::query(
        "SELECT xp, level FROM season_progress WHERE user_id = $1 AND season_id = $2",
    )
    .bind(claims.sub)
    .bind(season_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let (xp, level) = progress
        .map(|r| (r.get::<i32, _>("xp"), r.get::<i32, _>("level")))
        .unwrap_or((0, 1));

    let max_level: i32 = season.get("max_level");
    let xp_to_next = if level >= max_level { 0 } else { xp_for_level(level + 1) - xp };

    Ok(Json(SeasonProgress {
        season: SeasonInfo {
            id: season_id,
            name: season.get("name"),
            start_date: season.get("start_date"),
            end_date: season.get("end_date"),
            max_level,
        },
        xp,
        level,
        xp_to_next: xp_to_next.max(0),
    }))
}

async fn add_xp(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<AddXpRequest>,
) -> Result<Json<SeasonProgress>, (StatusCode, String)> {
    let season = sqlx::query("SELECT id, name, start_date, end_date, max_level FROM seasons WHERE active = TRUE LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");
    let max_level: i32 = season.get("max_level");
    let xp_earned = body.amount.unwrap_or_else(|| xp_for_source(&body.source));

    if xp_earned <= 0 || xp_earned > 1000 {
        return Err((StatusCode::BAD_REQUEST, "Invalid XP amount".into()));
    }

    // Upsert progress
    let row = sqlx::query(
        "INSERT INTO season_progress (user_id, season_id, xp, level)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, season_id) DO UPDATE SET
           xp = season_progress.xp + $3,
           updated_at = NOW()
         RETURNING xp, level",
    )
    .bind(claims.sub)
    .bind(season_id)
    .bind(xp_earned)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let xp: i32 = row.get("xp");
    let mut level: i32 = row.get("level");

    // Level up check
    while level < max_level && xp >= xp_for_level(level + 1) {
        level += 1;
    }

    // Update level if changed
    let current_level: i32 = row.get("level");
    if level != current_level {
        sqlx::query("UPDATE season_progress SET level = $3 WHERE user_id = $1 AND season_id = $2")
            .bind(claims.sub)
            .bind(season_id)
            .bind(level)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
    }

    let xp_to_next = if level >= max_level { 0 } else { xp_for_level(level + 1) - xp };

    Ok(Json(SeasonProgress {
        season: SeasonInfo {
            id: season_id,
            name: season.get("name"),
            start_date: season.get("start_date"),
            end_date: season.get("end_date"),
            max_level,
        },
        xp,
        level,
        xp_to_next: xp_to_next.max(0),
    }))
}

async fn get_rewards(
    Extension(_claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<SeasonReward>>, (StatusCode, String)> {
    let season = sqlx::query("SELECT id FROM seasons WHERE active = TRUE LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");

    let rows = sqlx::query(
        "SELECT level, reward_type, reward_value, is_premium, claimed
         FROM season_rewards WHERE season_id = $1
         ORDER BY level",
    )
    .bind(season_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let rewards: Vec<SeasonReward> = rows
        .iter()
        .map(|r| SeasonReward {
            level: r.get("level"),
            reward_type: r.get("reward_type"),
            reward_value: r.get("reward_value"),
            is_premium: r.get("is_premium"),
            claimed: r.get("claimed"),
        })
        .collect();

    Ok(Json(rewards))
}

async fn claim_reward(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Path(level): Path<i32>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let season = sqlx::query("SELECT id FROM seasons WHERE active = TRUE LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");

    // Check player has reached this level
    let progress = sqlx::query(
        "SELECT level FROM season_progress WHERE user_id = $1 AND season_id = $2",
    )
    .bind(claims.sub)
    .bind(season_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::BAD_REQUEST, "No season progress found".into()))?;

    let player_level: i32 = progress.get("level");
    if player_level < level {
        return Err((StatusCode::BAD_REQUEST, "Level not yet reached".into()));
    }

    // Mark reward as claimed
    let result = sqlx::query(
        "UPDATE season_rewards SET claimed = TRUE
         WHERE season_id = $1 AND level = $2 AND claimed = FALSE
         RETURNING reward_type, reward_value",
    )
    .bind(season_id)
    .bind(level)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::BAD_REQUEST, "Reward already claimed or not found".into()))?;

    let reward_type: String = result.get("reward_type");
    let reward_value: String = result.get("reward_value");

    // Grant reward based on type
    if reward_type == "credits" {
        if let Ok(amount) = reward_value.parse::<i32>() {
            sqlx::query("UPDATE player_stats SET credits = credits + $2 WHERE user_id = $1")
                .bind(claims.sub)
                .bind(amount)
                .execute(&pool)
                .await
                .ok();
        }
    }

    Ok(Json(serde_json::json!({
        "claimed": true,
        "reward_type": reward_type,
        "reward_value": reward_value,
    })))
}
