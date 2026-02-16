use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;

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
    pub packs_granted: i32,
}

fn generate_referral_code() -> String {
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
    (0..8).map(|_| chars[rng.gen_range(0..chars.len())]).collect()
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
    // Get or create referral code for this user
    let existing = sqlx::query("SELECT id, code FROM referral_codes WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

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
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
        (row.get::<i32, _>("id"), row.get::<String, _>("code"))
    };

    let count: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM referral_redemptions WHERE code_id = $1")
        .bind(code_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

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
    let code = body.code.trim().to_uppercase();
    if code.len() != 8 {
        return Err((StatusCode::BAD_REQUEST, "Invalid referral code".into()));
    }

    // Find the referral code
    let code_row = sqlx::query("SELECT id, user_id FROM referral_codes WHERE code = $1")
        .bind(&code)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
        .ok_or((StatusCode::NOT_FOUND, "Referral code not found".into()))?;

    let code_id: i32 = code_row.get("id");
    let referrer_id: uuid::Uuid = code_row.get("user_id");

    // Can't redeem your own code
    if referrer_id == claims.sub {
        return Err((StatusCode::BAD_REQUEST, "Cannot redeem your own referral code".into()));
    }

    // Try to insert redemption (unique constraint prevents double-redeem)
    let result = sqlx::query(
        "INSERT INTO referral_redemptions (code_id, redeemed_by) VALUES ($1, $2)
         ON CONFLICT (redeemed_by) DO NOTHING
         RETURNING id",
    )
    .bind(code_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    if result.is_none() {
        return Ok(Json(RedeemResponse {
            success: false,
            message: "You have already redeemed a referral code".into(),
            packs_granted: 0,
        }));
    }

    // Grant 100 credits to the referrer
    sqlx::query("UPDATE player_stats SET credits = credits + 100 WHERE user_id = $1")
        .bind(referrer_id)
        .execute(&pool)
        .await
        .ok();

    tracing::info!(referrer = %referrer_id, redeemed_by = %claims.sub, "Referral code redeemed");

    Ok(Json(RedeemResponse {
        success: true,
        message: "Referral code redeemed! You get 5 free packs!".into(),
        packs_granted: 5,
    }))
}
