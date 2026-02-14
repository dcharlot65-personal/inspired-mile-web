use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;

#[derive(Serialize)]
pub struct OwnedVariant {
    pub id: Uuid,
    pub variant_id: String,
    pub base_card_id: String,
    pub acquired_at: DateTime<Utc>,
    pub source: String,
}

#[derive(Deserialize)]
pub struct UnlockVariantRequest {
    pub variant_id: String,
    pub base_card_id: String,
    pub source: String,
}

#[derive(Serialize)]
pub struct EligibleVariant {
    pub base_card_id: String,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_variants))
        .route("/unlock", post(unlock_variant))
        .route("/eligible", get(eligible_variants))
}

async fn list_variants(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<OwnedVariant>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, variant_id, base_card_id, acquired_at, source
         FROM owned_variants WHERE user_id = $1
         ORDER BY acquired_at",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let variants: Vec<OwnedVariant> = rows
        .iter()
        .map(|r| OwnedVariant {
            id: r.get("id"),
            variant_id: r.get("variant_id"),
            base_card_id: r.get("base_card_id"),
            acquired_at: r.get("acquired_at"),
            source: r.get("source"),
        })
        .collect();

    Ok(Json(variants))
}

async fn unlock_variant(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<UnlockVariantRequest>,
) -> Result<Json<OwnedVariant>, (StatusCode, String)> {
    // Verify user owns the base card
    let owns_row = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM owned_cards WHERE user_id = $1 AND card_id = $2) as exists",
    )
    .bind(claims.sub)
    .bind(&body.base_card_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let owns_base: bool = owns_row.get("exists");
    if !owns_base {
        return Err((StatusCode::FORBIDDEN, "You don't own the base card".into()));
    }

    let row = sqlx::query(
        "INSERT INTO owned_variants (user_id, variant_id, base_card_id, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, variant_id) DO NOTHING
         RETURNING id, variant_id, base_card_id, acquired_at, source",
    )
    .bind(claims.sub)
    .bind(&body.variant_id)
    .bind(&body.base_card_id)
    .bind(&body.source)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::CONFLICT, "Variant already unlocked".into()))?;

    update_variant_counts(&pool, claims.sub).await;

    Ok(Json(OwnedVariant {
        id: row.get("id"),
        variant_id: row.get("variant_id"),
        base_card_id: row.get("base_card_id"),
        acquired_at: row.get("acquired_at"),
        source: row.get("source"),
    }))
}

async fn eligible_variants(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<EligibleVariant>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT DISTINCT card_id FROM owned_cards WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let eligible: Vec<EligibleVariant> = rows
        .iter()
        .map(|r| EligibleVariant {
            base_card_id: r.get("card_id"),
        })
        .collect();

    Ok(Json(eligible))
}

async fn update_variant_counts(pool: &PgPool, user_id: Uuid) {
    let _ = sqlx::query(
        "UPDATE player_stats SET
           variants_unlocked = (SELECT COUNT(*)::int FROM owned_variants WHERE user_id = $1),
           updated_at = NOW()
         WHERE user_id = $1",
    )
    .bind(user_id)
    .execute(pool)
    .await;
}
