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
    /// "ok" when the stored tier now equals the one sent; "unchanged" when the request
    /// would have loosened it and was not applied.
    pub status: String,
    /// The tier the account has after this request.
    pub age_tier: String,
}

/// What a client may do to an account's stored age tier.
///
/// The tier is set when the account is created (sign-up sends the age gate's answer).
/// After that the client can only make it stricter: `unknown` (accounts older than the
/// gate) may be set once, `adult` may become `teen`, and `teen` stays `teen` whatever is
/// sent. Before this, any signed-in account could post "adult" and lift the teen spending
/// limit from itself; the page did exactly that on every load from whatever localStorage
/// held.
///
/// None of this verifies anyone's age. The tier is what the visitor typed into the age
/// gate; a child who claims to be an adult when creating an account gets an adult account,
/// and a self-declared gate cannot prevent that. The rule here only stops an account that
/// was declared a teen's from undeclaring it.
pub fn resolve_age_tier(stored: &str, requested: &str) -> Option<&'static str> {
    match (stored, requested) {
        ("teen", _) => None,
        (_, "teen") => Some("teen"),
        ("adult", "adult") => None,
        (_, "adult") => Some("adult"),
        _ => None,
    }
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
        .map_err(crate::error::internal)?;

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
    .map_err(crate::error::internal)?;

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
        .map_err(crate::error::internal)?
        .unwrap_or_else(|| "unknown".into());

    if age_tier == "teen" {
        // If today's spending cannot be read, the limit cannot be checked: refuse.
        let spent_today = get_spent_today(&pool, claims.sub).await.map_err(crate::error::internal)?;
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
    .map_err(crate::error::internal)?
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
    let requested = match body.age_tier.as_str() {
        "adult" => "adult",
        "teen" => "teen",
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid age tier".into())),
    };

    // The row is locked while the rule is applied, so two requests cannot race past it.
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    let stored: String = sqlx::query_scalar("SELECT age_tier FROM users WHERE id = $1 FOR UPDATE")
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::UNAUTHORIZED, "Sign in first.".to_string()))?;

    let Some(new_tier) = resolve_age_tier(&stored, requested) else {
        // Already that tier, or the request would loosen it: nothing is written.
        let status = if stored == requested { "ok" } else { "unchanged" };
        if status == "unchanged" {
            tracing::info!(user_id = %claims.sub, stored = %stored, requested, "Age tier not loosened");
        }
        return Ok(Json(AgeTierResponse { status: status.into(), age_tier: stored }));
    };
    sqlx::query("UPDATE users SET age_tier = $2 WHERE id = $1")
        .bind(claims.sub)
        .bind(new_tier)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;

    tracing::info!(user_id = %claims.sub, age_tier = %new_tier, "Age tier updated");
    Ok(Json(AgeTierResponse { status: "ok".into(), age_tier: new_tier.into() }))
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

    let spent_today = get_spent_today(&pool, claims.sub).await.map_err(crate::error::internal)?;

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

async fn get_spent_today(pool: &PgPool, user_id: uuid::Uuid) -> Result<i32, sqlx::Error> {
    let spent: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM credit_transactions
         WHERE user_id = $1 AND direction = 'spend' AND created_at >= CURRENT_DATE",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(spent.min(i64::from(i32::MAX)) as i32)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_teen_account_cannot_be_made_adult() {
        assert_eq!(resolve_age_tier("teen", "adult"), None);
        assert_eq!(resolve_age_tier("teen", "teen"), None);
    }

    #[test]
    fn the_tier_only_moves_towards_the_stricter_value() {
        // An adult account may be marked teen.
        assert_eq!(resolve_age_tier("adult", "teen"), Some("teen"));
        assert_eq!(resolve_age_tier("adult", "adult"), None);
        // An account from before the age gate takes the first answer it is given.
        assert_eq!(resolve_age_tier("unknown", "adult"), Some("adult"));
        assert_eq!(resolve_age_tier("unknown", "teen"), Some("teen"));
        // Nothing else is a tier.
        for junk in ["", "unknown", "child", "Adult", "blocked"] {
            assert_eq!(resolve_age_tier("adult", junk), None, "{junk:?}");
            assert_eq!(resolve_age_tier("unknown", junk), None, "{junk:?}");
            assert_eq!(resolve_age_tier("teen", junk), None, "{junk:?}");
        }
    }
}
