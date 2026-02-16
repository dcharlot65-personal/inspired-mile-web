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
pub struct OwnedCard {
    pub id: Uuid,
    pub card_id: String,
    pub acquired_at: DateTime<Utc>,
    pub source: String,
    pub state: String,
}

#[derive(Deserialize)]
pub struct AddCardRequest {
    pub card_id: String,
    pub source: String,
}

#[derive(Serialize)]
pub struct InventoryStats {
    pub unique_cards: i64,
    pub total_cards: i64,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_cards))
        .route("/add", post(add_card))
        .route("/stats", get(inventory_stats))
}

async fn list_cards(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<OwnedCard>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, card_id, acquired_at, source, state
         FROM owned_cards WHERE user_id = $1
         ORDER BY acquired_at",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let cards: Vec<OwnedCard> = rows
        .iter()
        .map(|r| OwnedCard {
            id: r.get("id"),
            card_id: r.get("card_id"),
            acquired_at: r.get("acquired_at"),
            source: r.get("source"),
            state: r.get("state"),
        })
        .collect();

    Ok(Json(cards))
}

async fn add_card(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<AddCardRequest>,
) -> Result<Json<OwnedCard>, (StatusCode, String)> {
    if body.card_id.len() > 20 || !body.card_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err((StatusCode::BAD_REQUEST, "Invalid card_id format".into()));
    }
    let row = sqlx::query(
        "INSERT INTO owned_cards (user_id, card_id, source)
         VALUES ($1, $2, $3)
         RETURNING id, card_id, acquired_at, source, state",
    )
    .bind(claims.sub)
    .bind(&body.card_id)
    .bind(&body.source)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    update_card_counts(&pool, claims.sub).await;

    Ok(Json(OwnedCard {
        id: row.get("id"),
        card_id: row.get("card_id"),
        acquired_at: row.get("acquired_at"),
        source: row.get("source"),
        state: row.get("state"),
    }))
}

async fn inventory_stats(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<InventoryStats>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT COUNT(DISTINCT card_id) as unique_cards, COUNT(*) as total_cards
         FROM owned_cards WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    Ok(Json(InventoryStats {
        unique_cards: row.get::<i64, _>("unique_cards"),
        total_cards: row.get::<i64, _>("total_cards"),
    }))
}

async fn update_card_counts(pool: &PgPool, user_id: Uuid) {
    let _ = sqlx::query(
        "UPDATE player_stats SET
           unique_cards = (SELECT COUNT(DISTINCT card_id) FROM owned_cards WHERE user_id = $1)::int,
           total_cards = (SELECT COUNT(*) FROM owned_cards WHERE user_id = $1)::int,
           updated_at = NOW()
         WHERE user_id = $1",
    )
    .bind(user_id)
    .execute(pool)
    .await;
}
