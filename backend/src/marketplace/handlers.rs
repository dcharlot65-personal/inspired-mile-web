use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;

#[derive(Serialize)]
pub struct ListingResponse {
    id: Uuid,
    seller_id: Uuid,
    seller_username: String,
    card_id: String,
    listing_type: String,
    price_credits: Option<i32>,
    wanted_card_ids: Vec<String>,
    status: String,
    created_at: String,
}

#[derive(Deserialize)]
pub struct CreateListingRequest {
    card_id: String,
    listing_type: String, // "sale" or "trade"
    price_credits: Option<i32>,
    wanted_card_ids: Option<Vec<String>>,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(browse_listings))
        .route("/list", post(create_listing))
        .route("/my", get(my_listings))
        .route("/{id}", get(get_listing))
        .route("/{id}/cancel", post(cancel_listing))
        .route("/{id}/buy", post(buy_listing))
}

async fn browse_listings(
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<ListingResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT l.id, l.seller_id, u.username, l.card_id, l.listing_type, l.price_credits, l.wanted_card_ids, l.status, l.created_at
         FROM card_listings l
         JOIN users u ON u.id = l.seller_id
         WHERE l.status = 'active'
         ORDER BY l.created_at DESC
         LIMIT 100",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let listings = rows.iter().map(|r| ListingResponse {
        id: r.get("id"),
        seller_id: r.get("seller_id"),
        seller_username: r.get("username"),
        card_id: r.get("card_id"),
        listing_type: r.get("listing_type"),
        price_credits: r.get("price_credits"),
        wanted_card_ids: r.get::<Vec<String>, _>("wanted_card_ids"),
        status: r.get("status"),
        created_at: r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }).collect();

    Ok(Json(listings))
}

async fn create_listing(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<CreateListingRequest>,
) -> Result<Json<ListingResponse>, (StatusCode, String)> {
    // Verify the user owns the card
    let owns = sqlx::query("SELECT 1 FROM owned_cards WHERE user_id = $1 AND card_id = $2 LIMIT 1")
        .bind(claims.sub)
        .bind(&body.card_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    if owns.is_none() {
        return Err((StatusCode::BAD_REQUEST, "You don't own this card".into()));
    }

    let wanted = body.wanted_card_ids.unwrap_or_default();

    let row = sqlx::query(
        "INSERT INTO card_listings (seller_id, card_id, listing_type, price_credits, wanted_card_ids)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at",
    )
    .bind(claims.sub)
    .bind(&body.card_id)
    .bind(&body.listing_type)
    .bind(body.price_credits)
    .bind(&wanted)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    Ok(Json(ListingResponse {
        id: row.get("id"),
        seller_id: claims.sub,
        seller_username: claims.username,
        card_id: body.card_id,
        listing_type: body.listing_type,
        price_credits: body.price_credits,
        wanted_card_ids: wanted,
        status: "active".into(),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

async fn get_listing(
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<ListingResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT l.id, l.seller_id, u.username, l.card_id, l.listing_type, l.price_credits, l.wanted_card_ids, l.status, l.created_at
         FROM card_listings l
         JOIN users u ON u.id = l.seller_id
         WHERE l.id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "Listing not found".into()))?;

    Ok(Json(ListingResponse {
        id: row.get("id"),
        seller_id: row.get("seller_id"),
        seller_username: row.get("username"),
        card_id: row.get("card_id"),
        listing_type: row.get("listing_type"),
        price_credits: row.get("price_credits"),
        wanted_card_ids: row.get::<Vec<String>, _>("wanted_card_ids"),
        status: row.get("status"),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

async fn my_listings(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<ListingResponse>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT l.id, l.seller_id, u.username, l.card_id, l.listing_type, l.price_credits, l.wanted_card_ids, l.status, l.created_at
         FROM card_listings l
         JOIN users u ON u.id = l.seller_id
         WHERE l.seller_id = $1
         ORDER BY l.created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let listings = rows.iter().map(|r| ListingResponse {
        id: r.get("id"),
        seller_id: r.get("seller_id"),
        seller_username: r.get("username"),
        card_id: r.get("card_id"),
        listing_type: r.get("listing_type"),
        price_credits: r.get("price_credits"),
        wanted_card_ids: r.get::<Vec<String>, _>("wanted_card_ids"),
        status: r.get("status"),
        created_at: r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }).collect();

    Ok(Json(listings))
}

async fn cancel_listing(
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = sqlx::query(
        "UPDATE card_listings SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND seller_id = $2 AND status = 'active'",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Listing not found or not yours".into()));
    }

    Ok(Json(serde_json::json!({ "status": "cancelled" })))
}

async fn buy_listing(
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Get listing
    let listing = sqlx::query(
        "SELECT seller_id, card_id, listing_type, status FROM card_listings WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "Listing not found".into()))?;

    let status: String = listing.get("status");
    if status != "active" {
        return Err((StatusCode::BAD_REQUEST, "Listing is no longer active".into()));
    }

    let seller_id: Uuid = listing.get("seller_id");
    if seller_id == claims.sub {
        return Err((StatusCode::BAD_REQUEST, "Cannot buy your own listing".into()));
    }

    let card_id: String = listing.get("card_id");

    // Transfer card: add to buyer, mark listing as sold
    sqlx::query(
        "INSERT INTO owned_cards (user_id, card_id, source, state)
         VALUES ($1, $2, 'purchase', 'owned')",
    )
    .bind(claims.sub)
    .bind(&card_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    sqlx::query("UPDATE card_listings SET status = 'sold', updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    // Record trade
    sqlx::query(
        "INSERT INTO trades (listing_id, buyer_id) VALUES ($1, $2)",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&pool)
    .await
    .ok();

    Ok(Json(serde_json::json!({ "status": "purchased", "card_id": card_id })))
}
