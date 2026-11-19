use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use inspired_mile_api::economy::{self, RULES};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;
use crate::ledger;

#[derive(Serialize)]
pub struct CreditsResponse {
    pub credits: i32,
}

/// A solo activity the browser says happened. The server cannot see solo play, so it pays a
/// fixed amount per source, at most `per_day` times a UTC day (backend/data/economy.json). The
/// client names the source and nothing else: a body that names an amount is refused.
#[derive(Deserialize)]
pub struct EarnCreditsRequest {
    pub source: String,
    /// Refused when present. Until 2026-11-19 the server added whatever amount (1 to 1,000) a
    /// client named here.
    pub amount: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct EarnResponse {
    /// The balance after this.
    pub credits: i32,
    /// Credits added now: the source's amount, or 0 once today's cap is reached.
    pub granted: i32,
    pub source: String,
    /// Payments from this source today, this one included.
    pub earned_today: i64,
    pub per_day: i64,
}

#[derive(Deserialize)]
pub struct AgeTierRequest {
    pub age_tier: String, // "adult" or "teen"
}

#[derive(Serialize)]
pub struct AgeTierResponse {
    /// "ok" when the stored tier equals the one sent; "unchanged" when it does not. Either
    /// way nothing was written.
    pub status: String,
    /// The account's tier.
    pub age_tier: String,
}

#[derive(Serialize)]
pub struct LimitsResponse {
    pub daily_limit: Option<i32>,
    pub spent_today: i32,
}

/// Credits are spent only by what the server sells at its own price (packs, the market), so
/// there is no route that takes credits for a reason the client names.
pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(get_credits))
        .route("/earn", post(earn_credits))
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
        .map_err(crate::error::internal)?;

    let credits = row.map(|r| r.get::<i32, _>("credits")).unwrap_or(0);
    Ok(Json(CreditsResponse { credits }))
}

async fn earn_credits(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<EarnCreditsRequest>,
) -> Result<Json<EarnResponse>, (StatusCode, String)> {
    if body.amount.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Amounts are set by the server".into()));
    }
    let rate = economy::solo_credits(&body.source).ok_or((StatusCode::BAD_REQUEST, "Unknown source".into()))?;
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    let paid = ledger::credit_capped(&mut tx, claims.sub, &body.source, rate).await.map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;
    tracing::info!(user_id = %claims.sub, source = %body.source, granted = paid.granted, "Credits earned");
    Ok(Json(EarnResponse {
        credits: paid.total,
        granted: paid.granted,
        source: body.source,
        earned_today: paid.today,
        per_day: rate.per_day,
    }))
}

// ---------------------------------------------------------------------------
// Age tier verification
// ---------------------------------------------------------------------------

/// The old automatic sync. Until 2026-11-16 the page posted the browser's stored age-gate
/// answer here on every load, and this wrote it to the account: on a shared browser,
/// whoever answered the gate last decided the tier of every account signed in there.
///
/// It no longer writes anything. It stays, answering with the account's tier, because a
/// page cached before the change (the service worker keeps pages) still calls it on every
/// load. Only the signed-in user's explicit answer changes a tier: `POST /auth/age-tier`,
/// with the rules in `auth/age.rs`.
async fn age_verify(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<AgeTierRequest>,
) -> Result<Json<AgeTierResponse>, (StatusCode, String)> {
    if !matches!(body.age_tier.as_str(), "adult" | "teen") {
        return Err((StatusCode::BAD_REQUEST, "Invalid age tier".into()));
    }
    let stored: String = sqlx::query_scalar("SELECT age_tier FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::UNAUTHORIZED, "Sign in first.".to_string()))?;
    let status = if stored == body.age_tier { "ok" } else { "unchanged" };
    Ok(Json(AgeTierResponse { status: status.into(), age_tier: stored }))
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
        .map_err(crate::error::internal)?
        .unwrap_or_else(|| "unknown".into());

    let mut conn = pool.acquire().await.map_err(crate::error::internal)?;
    let spent_today = ledger::spent_today(&mut conn, claims.sub).await.map_err(crate::error::internal)?;

    let daily_limit = if age_tier == "teen" { Some(RULES.teen_daily_spend) } else { None };

    Ok(Json(LimitsResponse { daily_limit, spent_today: spent_today.min(i64::from(i32::MAX)) as i32 }))
}
