//! World-card variants the account holds on the server. Variants are earned and used in solo play
//! on the device (src/lib/variants.ts); online play has none. Until 2026-11-19
//! `POST /variants/unlock` gave the account any variant a client named (of a base card it held),
//! from any source: like every other grant a client could name, it is gone (docs/ECONOMY.md).

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
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

#[derive(Serialize)]
pub struct EligibleVariant {
    pub base_card_id: String,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_variants))
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
    .map_err(crate::error::internal)?;

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
    .map_err(crate::error::internal)?;

    let eligible: Vec<EligibleVariant> = rows
        .iter()
        .map(|r| EligibleVariant {
            base_card_id: r.get("card_id"),
        })
        .collect();

    Ok(Json(eligible))
}
