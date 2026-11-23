//! Referrals, for adult accounts only (owner, 2026-11-19): only an adult account gets a code or
//! redeems one, and only an adult referrer is paid for it. Redeeming a code gives the redeemer
//! nothing; the referrer receives a fixed amount a few times a day at most (docs/ECONOMY.md).

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::{adults_only, is_adult, Claims};
use crate::config::Config;
use crate::ledger;
use inspired_mile_api::economy::RULES;

#[derive(Serialize)]
pub struct ReferralInfo {
    pub code: String,
    pub referral_count: i64,
}

#[derive(Deserialize)]
pub struct RedeemRequest {
    pub code: String,
}

#[derive(Serialize)]
pub struct RedeemResponse {
    pub success: bool,
    pub message: String,
    /// Always 0: redeeming a code gives the redeemer nothing. Until 2026-11-19 the answer said
    /// "You get 5 free packs!" and granted none.
    pub packs_granted: i32,
    /// What the player who invited them received for it (0 once that player has had
    /// `referral.rewards_per_day` today).
    pub referrer_credits: i32,
}

fn generate_referral_code() -> String {
    let mut rng = rand::rng();
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
    (0..8).map(|_| chars[rng.random_range(0..chars.len())]).collect()
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(get_referral_code))
        .route("/redeem", post(redeem_code))
}

async fn get_referral_code(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<ReferralInfo>, (StatusCode, String)> {
    {
        let mut conn = pool.acquire().await.map_err(crate::error::internal)?;
        if !is_adult(&mut conn, claims.sub).await.map_err(crate::error::internal)? {
            return Err(adults_only());
        }
    }
    // Get or create referral code for this user
    let existing = sqlx::query("SELECT id, code FROM referral_codes WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?;

    let (code_id, code) = if let Some(row) = existing {
        (row.get::<i32, _>("id"), row.get::<String, _>("code"))
    } else {
        let code = generate_referral_code();
        let row = sqlx::query(
            "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) RETURNING id, code",
        )
        .bind(claims.sub)
        .bind(&code)
        .fetch_one(&pool)
        .await
        .map_err(crate::error::internal)?;
        (row.get::<i32, _>("id"), row.get::<String, _>("code"))
    };

    let count: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM referral_redemptions WHERE code_id = $1")
        .bind(code_id)
        .fetch_one(&pool)
        .await
        .map_err(crate::error::internal)?;

    Ok(Json(ReferralInfo {
        code,
        referral_count: count,
    }))
}

async fn redeem_code(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<RedeemRequest>,
) -> Result<Json<RedeemResponse>, (StatusCode, String)> {
    {
        let mut conn = pool.acquire().await.map_err(crate::error::internal)?;
        if !is_adult(&mut conn, claims.sub).await.map_err(crate::error::internal)? {
            return Err(adults_only());
        }
    }
    let code = body.code.trim().to_uppercase();
    if code.len() != 8 {
        return Err((StatusCode::BAD_REQUEST, "Invalid referral code".into()));
    }

    // Find the referral code
    let code_row = sqlx::query("SELECT id, user_id FROM referral_codes WHERE code = $1")
        .bind(&code)
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .ok_or((StatusCode::NOT_FOUND, "Referral code not found".into()))?;

    let code_id: i32 = code_row.get("id");
    let referrer_id: uuid::Uuid = code_row.get("user_id");

    // Can't redeem your own code
    if referrer_id == claims.sub {
        return Err((StatusCode::BAD_REQUEST, "Cannot redeem your own referral code".into()));
    }

    // The redemption and the referrer's reward in one transaction: both or neither.
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    let result = sqlx::query(
        "INSERT INTO referral_redemptions (code_id, redeemed_by) VALUES ($1, $2)
         ON CONFLICT (redeemed_by) DO NOTHING
         RETURNING id",
    )
    .bind(code_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await
    .map_err(crate::error::internal)?;

    if result.is_none() {
        return Ok(Json(RedeemResponse {
            success: false,
            message: "You have already redeemed a referral code".into(),
            packs_granted: 0,
            referrer_credits: 0,
        }));
    }

    // The referrer is paid a fixed amount, logged, at most `rewards_per_day` times a day: new
    // accounts redeeming one code are not a source of unlimited credits.
    ledger::lock_account(&mut tx, referrer_id).await.map_err(crate::error::internal)?;
    let rate = inspired_mile_api::economy::Rate { amount: RULES.referral.referrer_credits, per_day: RULES.referral.rewards_per_day };
    // A referrer whose account is no longer an adult one is not paid.
    let paid = if is_adult(&mut tx, referrer_id).await.map_err(crate::error::internal)? {
        ledger::credit_capped(&mut tx, referrer_id, "referral", rate).await.map_err(crate::error::internal)?.granted
    } else {
        0
    };
    tx.commit().await.map_err(crate::error::internal)?;

    tracing::info!(referrer = %referrer_id, redeemed_by = %claims.sub, paid, "Referral code redeemed");

    Ok(Json(RedeemResponse {
        success: true,
        message: "Referral code redeemed.".into(),
        packs_granted: 0,
        referrer_credits: paid,
    }))
}
