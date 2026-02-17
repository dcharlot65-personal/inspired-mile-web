use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;

/// Daily spending limit for teen accounts (in credits).
const TEEN_DAILY_SPEND_LIMIT: i32 = 200;

#[derive(Serialize)]
pub struct CreditsResponse {
    pub credits: i32,
}

#[derive(Deserialize)]
pub struct EarnCreditsRequest {
    pub source: String, // "battle_win", "trivia", "challenge", "daily"
    pub amount: Option<i32>,
}

#[derive(Deserialize)]
pub struct SpendCreditsRequest {
    pub amount: i32,
    pub reason: String,
}

#[derive(Deserialize)]
pub struct AgeTierRequest {
    pub age_tier: String, // "adult" or "teen"
}

#[derive(Serialize)]
pub struct AgeTierResponse {
    pub status: String,
}

#[derive(Serialize)]
pub struct LimitsResponse {
    pub daily_limit: Option<i32>,
    pub spent_today: i32,
}

/// Credit earning rates by source
fn earn_amount(source: &str) -> i32 {
    match source {
        "battle_win" => 50,
        "trivia" => 30,
        "challenge" => 20,
        "daily" => 10,
        _ => 0,
    }
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(get_credits))
        .route("/earn", post(earn_credits))
        .route("/spend", post(spend_credits))
        .route("/age-verify", post(age_verify))
        .route("/limits", get(get_limits))
}

async fn get_credits(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<CreditsResponse>, (StatusCode, String)> {
    let row = sqlx::query("SELECT credits FROM player_stats WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let credits = row.map(|r| r.get::<i32, _>("credits")).unwrap_or(0);
    Ok(Json(CreditsResponse { credits }))
}

async fn earn_credits(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<EarnCreditsRequest>,
) -> Result<Json<CreditsResponse>, (StatusCode, String)> {
    let amount = body.amount.unwrap_or_else(|| earn_amount(&body.source));
    if amount <= 0 || amount > 1000 {
        return Err((StatusCode::BAD_REQUEST, "Invalid credit amount".into()));
    }

    let row = sqlx::query(
        "UPDATE player_stats SET credits = credits + $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING credits",
    )
    .bind(claims.sub)
    .bind(amount)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    // Log transaction
    log_transaction(&pool, claims.sub, amount, "earn", &body.source).await;

    tracing::info!(user_id = %claims.sub, source = %body.source, amount, "Credits earned");
    Ok(Json(CreditsResponse { credits: row.get("credits") }))
}

async fn spend_credits(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<SpendCreditsRequest>,
) -> Result<Json<CreditsResponse>, (StatusCode, String)> {
    if body.amount <= 0 || body.amount > 100_000 {
        return Err((StatusCode::BAD_REQUEST, "Invalid spend amount".into()));
    }

    // Check teen daily spending limit
    let age_tier: String = sqlx::query_scalar("SELECT age_tier FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .unwrap_or_else(|| "unknown".into());

    if age_tier == "teen" {
        let spent_today = get_spent_today(&pool, claims.sub).await;
        if spent_today + body.amount > TEEN_DAILY_SPEND_LIMIT {
            return Err((
                StatusCode::FORBIDDEN,
                format!(
                    "Daily spending limit reached ({}/{} credits/day for players under 18)",
                    spent_today, TEEN_DAILY_SPEND_LIMIT
                ),
            ));
        }
    }

    let row = sqlx::query(
        "UPDATE player_stats SET credits = credits - $2, updated_at = NOW()
         WHERE user_id = $1 AND credits >= $2
         RETURNING credits",
    )
    .bind(claims.sub)
    .bind(body.amount)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::BAD_REQUEST, "Insufficient credits".into()))?;

    // Log transaction
    log_transaction(&pool, claims.sub, body.amount, "spend", &body.reason).await;

    tracing::info!(user_id = %claims.sub, reason = %body.reason, amount = body.amount, "Credits spent");
    Ok(Json(CreditsResponse { credits: row.get("credits") }))
}

// ---------------------------------------------------------------------------
// Age tier verification
// ---------------------------------------------------------------------------

async fn age_verify(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<AgeTierRequest>,
) -> Result<Json<AgeTierResponse>, (StatusCode, String)> {
    let tier = match body.age_tier.as_str() {
        "adult" | "teen" => &body.age_tier,
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid age tier".into())),
    };

    sqlx::query("UPDATE users SET age_tier = $2 WHERE id = $1")
        .bind(claims.sub)
        .bind(tier)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    tracing::info!(user_id = %claims.sub, age_tier = %tier, "Age tier updated");
    Ok(Json(AgeTierResponse { status: "ok".into() }))
}

// ---------------------------------------------------------------------------
// Spending limits
// ---------------------------------------------------------------------------

async fn get_limits(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<LimitsResponse>, (StatusCode, String)> {
    let age_tier: String = sqlx::query_scalar("SELECT age_tier FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .unwrap_or_else(|| "unknown".into());

    let spent_today = get_spent_today(&pool, claims.sub).await;

    let daily_limit = if age_tier == "teen" {
        Some(TEEN_DAILY_SPEND_LIMIT)
    } else {
        None
    };

    Ok(Json(LimitsResponse { daily_limit, spent_today }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn get_spent_today(pool: &PgPool, user_id: uuid::Uuid) -> i32 {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM credit_transactions
         WHERE user_id = $1 AND direction = 'spend' AND created_at >= CURRENT_DATE",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0i64) as i32
}

async fn log_transaction(pool: &PgPool, user_id: uuid::Uuid, amount: i32, direction: &str, source: &str) {
    let _ = sqlx::query(
        "INSERT INTO credit_transactions (user_id, amount, direction, source) VALUES ($1, $2, $3, $4)",
    )
    .bind(user_id)
    .bind(amount)
    .bind(direction)
    .bind(source)
    .execute(pool)
    .await;
}
