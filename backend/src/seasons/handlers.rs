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
use crate::ledger::{self, xp_for_level};
use inspired_mile_api::economy;

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

/// A solo activity the browser says happened: the source and nothing else. XP per source is
/// fixed and capped per UTC day (backend/data/economy.json); online matches pay XP when the
/// server records them (multiplayer/results.rs).
#[derive(Deserialize)]
pub struct AddXpRequest {
    pub source: String,
    /// Refused when present. Until 2026-11-19 the server added whatever amount (1 to 1,000) a
    /// client named here.
    pub amount: Option<serde_json::Value>,
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
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");

    let progress = sqlx::query(
        "SELECT xp, level FROM season_progress WHERE user_id = $1 AND season_id = $2",
    )
    .bind(claims.sub)
    .bind(season_id)
    .fetch_optional(&pool)
    .await
    .map_err(crate::error::internal)?;

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
    if body.amount.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Amounts are set by the server".into()));
    }
    let rate = economy::solo_xp(&body.source).ok_or((StatusCode::BAD_REQUEST, "Unknown source".into()))?;
    let season = sqlx::query("SELECT id, name, start_date, end_date, max_level FROM seasons WHERE active = TRUE ORDER BY id LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");
    let max_level: i32 = season.get("max_level");

    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    let paid = ledger::xp_capped(&mut tx, claims.sub, (season_id, max_level), &body.source, rate)
        .await
        .map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;

    let xp = paid.total;
    let level = ledger::level_for(xp, max_level);
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
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<SeasonReward>>, (StatusCode, String)> {
    let season = sqlx::query("SELECT id FROM seasons WHERE active = TRUE ORDER BY id LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;

    let season_id: i32 = season.get("id");

    // `claimed` is this player's: each player claims each level once (season_reward_claims).
    let rows = sqlx::query(
        "SELECT r.level, r.reward_type, r.reward_value, r.is_premium,
                EXISTS (SELECT 1 FROM season_reward_claims c
                        WHERE c.user_id = $2 AND c.season_id = r.season_id AND c.level = r.level) AS claimed
         FROM season_rewards r WHERE r.season_id = $1
         ORDER BY r.level",
    )
    .bind(season_id)
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

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

/// Claim this player's reward for a level reached, once. Until 2026-11-19 `claimed` was a flag
/// of the reward row, so the first player to claim a level claimed it for everyone, and only a
/// credits reward granted anything. Now each player claims each level once, and the grant is
/// made in the same transaction: credits (logged), a pack opened by the server, or a card.
/// A premium reward is not granted: nothing sells premium.
async fn claim_reward(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Path(level): Path<i32>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let season = sqlx::query("SELECT id FROM seasons WHERE active = TRUE ORDER BY id LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::NOT_FOUND, "No active season".into()))?;
    let season_id: i32 = season.get("id");

    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;

    let player_level: i32 = sqlx::query_scalar("SELECT level FROM season_progress WHERE user_id = $1 AND season_id = $2")
        .bind(claims.sub)
        .bind(season_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::BAD_REQUEST, "No season progress found".into()))?;
    if player_level < level {
        return Err((StatusCode::BAD_REQUEST, "Level not yet reached".into()));
    }

    let reward = sqlx::query(
        "SELECT reward_type, reward_value FROM season_rewards
         WHERE season_id = $1 AND level = $2 AND NOT is_premium ORDER BY id LIMIT 1",
    )
    .bind(season_id)
    .bind(level)
    .fetch_optional(&mut *tx)
    .await
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::BAD_REQUEST, "Reward already claimed or not found".into()))?;

    let fresh = sqlx::query(
        "INSERT INTO season_reward_claims (user_id, season_id, level) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING",
    )
    .bind(claims.sub)
    .bind(season_id)
    .bind(level)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::internal)?;
    if fresh.rows_affected() == 0 {
        return Err((StatusCode::BAD_REQUEST, "Reward already claimed or not found".into()));
    }

    let reward_type: String = reward.get("reward_type");
    let reward_value: String = reward.get("reward_value");
    let mut cards: Vec<String> = Vec::new();
    match reward_type.as_str() {
        "credits" => {
            let amount = reward_value.trim().parse::<i32>().ok().filter(|n| *n > 0).ok_or_else(|| {
                crate::error::internal(format!("season {season_id} level {level}: credits reward {reward_value:?} is not a number"))
            })?;
            ledger::credit(&mut tx, claims.sub, amount, "season_reward").await.map_err(crate::error::internal)?;
        }
        "pack" => {
            let tier = economy::tier(reward_value.trim())
                .ok_or_else(|| crate::error::internal(format!("season {season_id} level {level}: no pack tier {reward_value:?}")))?;
            let drawn: Vec<String> = {
                let mut rng = rand::rng();
                let mut roll = |n: u32| rand::RngExt::random_range(&mut rng, 0..n);
                economy::draw_pack(tier, &mut roll).into_iter().map(|c| c.id.clone()).collect()
            };
            ledger::grant_cards(&mut tx, claims.sub, &drawn, "season_reward").await.map_err(crate::error::internal)?;
            ledger::count_pack(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
            cards = drawn;
        }
        "card" => {
            let card = economy::catalogue_card(reward_value.trim())
                .ok_or_else(|| crate::error::internal(format!("season {season_id} level {level}: no card {reward_value:?}")))?;
            cards = vec![card.id.clone()];
            ledger::grant_cards(&mut tx, claims.sub, &cards, "season_reward").await.map_err(crate::error::internal)?;
        }
        // A title is recorded as claimed; nothing in the game shows titles yet.
        _ => {}
    }
    tx.commit().await.map_err(crate::error::internal)?;

    Ok(Json(serde_json::json!({
        "claimed": true,
        "reward_type": reward_type,
        "reward_value": reward_value,
        "cards": cards,
    })))
}
