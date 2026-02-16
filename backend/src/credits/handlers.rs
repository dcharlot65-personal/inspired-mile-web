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

    tracing::info!(user_id = %claims.sub, reason = %body.reason, amount = body.amount, "Credits spent");
    Ok(Json(CreditsResponse { credits: row.get("credits") }))
}
