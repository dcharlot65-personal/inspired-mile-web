//! The card market. A listing locks one card the seller holds (`owned_cards.state = 'listed'`):
//! it cannot be listed twice, sold elsewhere or fielded online while listed, and a cancel unlocks
//! it. A purchase is one transaction: an active listing that is not the buyer's own, the buyer's
//! balance (and a teen buyer's daily limit) checked, the price moved from buyer to seller, and
//! that very card moved to the buyer.
//!
//! Until 2026-11-19 a purchase marked the listing sold and gave the buyer a new copy of the card:
//! no credits moved and the seller kept the card. Only sales are offered: a trade listing (a card
//! for cards) needs the buyer's card moved too, which is not built (docs/ECONOMY.md).

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
use crate::ledger;
use inspired_mile_api::economy::{self, RULES};

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
    // A listing from before cards were locked to listings (no owned_card_id) cannot be bought.
    let rows = sqlx::query(
        "SELECT l.id, l.seller_id, u.username, l.card_id, l.listing_type, l.price_credits, l.wanted_card_ids, l.status, l.created_at
         FROM card_listings l
         JOIN users u ON u.id = l.seller_id
         WHERE l.status = 'active' AND l.owned_card_id IS NOT NULL
         ORDER BY l.created_at DESC
         LIMIT 100",
    )
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let listings = rows.iter().map(|r| ListingResponse {
        id: r.get("id"),
        seller_id: r.get("seller_id"),
        seller_username: r.get("username"),
        card_id: r.get("card_id"),
        listing_type: r.get("listing_type"),
        price_credits: r.get("price_credits"),
        wanted_card_ids: r.get::<Option<Vec<String>>, _>("wanted_card_ids").unwrap_or_default(),
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
    // Input validation: a catalogue card id (at most 16 characters, as owned_cards holds it).
    if economy::catalogue_card(&body.card_id).is_none() {
        return Err((StatusCode::BAD_REQUEST, "Invalid card ID".into()));
    }
    if body.listing_type != "sale" {
        return Err((StatusCode::BAD_REQUEST, "Only sales are offered".into()));
    }
    let price = body.price_credits.ok_or((StatusCode::BAD_REQUEST, "Price must be between 1 and 100000".into()))?;
    if price < RULES.market.price_min || price > RULES.market.price_max {
        return Err((StatusCode::BAD_REQUEST, "Price must be between 1 and 100000".into()));
    }

    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    // One copy the seller holds and has not listed. The starter characters are no rows: they
    // cannot be sold.
    let owned: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM owned_cards WHERE user_id = $1 AND card_id = $2 AND state = 'owned'
         ORDER BY acquired_at, id LIMIT 1 FOR UPDATE",
    )
    .bind(claims.sub)
    .bind(&body.card_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(crate::error::internal)?;
    let Some(owned_card_id) = owned else {
        return Err((StatusCode::BAD_REQUEST, "You don't own this card".into()));
    };
    sqlx::query("UPDATE owned_cards SET state = 'listed' WHERE id = $1")
        .bind(owned_card_id)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    let row = sqlx::query(
        "INSERT INTO card_listings (seller_id, card_id, listing_type, price_credits, wanted_card_ids, owned_card_id)
         VALUES ($1, $2, 'sale', $3, '{}', $4)
         RETURNING id, created_at",
    )
    .bind(claims.sub)
    .bind(&body.card_id)
    .bind(price)
    .bind(owned_card_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;

    Ok(Json(ListingResponse {
        id: row.get("id"),
        seller_id: claims.sub,
        seller_username: claims.username,
        card_id: body.card_id,
        listing_type: "sale".into(),
        price_credits: Some(price),
        wanted_card_ids: Vec::new(),
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
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::NOT_FOUND, "Listing not found".into()))?;

    Ok(Json(ListingResponse {
        id: row.get("id"),
        seller_id: row.get("seller_id"),
        seller_username: row.get("username"),
        card_id: row.get("card_id"),
        listing_type: row.get("listing_type"),
        price_credits: row.get("price_credits"),
        wanted_card_ids: row.get::<Option<Vec<String>>, _>("wanted_card_ids").unwrap_or_default(),
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
    .map_err(crate::error::internal)?;

    let listings = rows.iter().map(|r| ListingResponse {
        id: r.get("id"),
        seller_id: r.get("seller_id"),
        seller_username: r.get("username"),
        card_id: r.get("card_id"),
        listing_type: r.get("listing_type"),
        price_credits: r.get("price_credits"),
        wanted_card_ids: r.get::<Option<Vec<String>>, _>("wanted_card_ids").unwrap_or_default(),
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
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    let owned: Option<Option<Uuid>> = sqlx::query_scalar(
        "UPDATE card_listings SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND seller_id = $2 AND status = 'active'
         RETURNING owned_card_id",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await
    .map_err(crate::error::internal)?;
    let Some(owned) = owned else {
        return Err((StatusCode::NOT_FOUND, "Listing not found or not yours".into()));
    };
    // The card is the seller's to list, sell or field again.
    if let Some(owned_card_id) = owned {
        sqlx::query("UPDATE owned_cards SET state = 'owned' WHERE id = $1 AND user_id = $2 AND state = 'listed'")
            .bind(owned_card_id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await
            .map_err(crate::error::internal)?;
    }
    tx.commit().await.map_err(crate::error::internal)?;

    Ok(Json(serde_json::json!({ "status": "cancelled" })))
}

async fn buy_listing(
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    // The listing first, locked: of two buyers, the second waits here and then finds it sold.
    let listing = sqlx::query(
        "SELECT seller_id, card_id, listing_type, status, price_credits, owned_card_id
         FROM card_listings WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(crate::error::internal)?
    .ok_or((StatusCode::NOT_FOUND, "Listing not found".into()))?;

    let status: String = listing.get("status");
    if status != "active" {
        return Err((StatusCode::BAD_REQUEST, "Listing is no longer active".into()));
    }
    let seller_id: Uuid = listing.get("seller_id");
    if seller_id == claims.sub {
        return Err((StatusCode::BAD_REQUEST, "Cannot buy your own listing".into()));
    }
    let listing_type: String = listing.get("listing_type");
    let price: Option<i32> = listing.get("price_credits");
    let owned_card_id: Option<Uuid> = listing.get("owned_card_id");
    // A trade, a sale without a price, or a listing from before cards were locked: nothing a
    // purchase can complete.
    let (Some(price), Some(owned_card_id), "sale") = (price, owned_card_id, listing_type.as_str()) else {
        return Err((StatusCode::CONFLICT, "Listing is no longer active".into()));
    };
    let card_id: String = listing.get("card_id");

    ledger::lock_accounts(&mut tx, claims.sub, seller_id).await.map_err(crate::error::internal)?;
    let buyer_balance = ledger::debit(&mut tx, claims.sub, price, "market_buy").await.map_err(ledger::Debit::refusal)?;
    ledger::credit(&mut tx, seller_id, price, "market_sale").await.map_err(crate::error::internal)?;

    // That very card goes to the buyer.
    let moved = sqlx::query(
        "UPDATE owned_cards SET user_id = $2, state = 'owned', source = 'purchase', acquired_at = NOW()
         WHERE id = $1 AND user_id = $3 AND state = 'listed'",
    )
    .bind(owned_card_id)
    .bind(claims.sub)
    .bind(seller_id)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::internal)?;
    if moved.rows_affected() != 1 {
        // The listing's card is not where it should be. Nothing is changed.
        return Err((StatusCode::CONFLICT, "Listing is no longer active".into()));
    }
    sqlx::query("UPDATE card_listings SET status = 'sold', updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    sqlx::query("INSERT INTO trades (listing_id, buyer_id) VALUES ($1, $2)")
        .bind(id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    ledger::update_card_counts(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    ledger::update_card_counts(&mut tx, seller_id).await.map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;

    tracing::info!(buyer = %claims.sub, seller = %seller_id, listing = %id, price, "Market sale");
    Ok(Json(serde_json::json!({ "status": "purchased", "card_id": card_id, "price": price, "credits": buyer_balance })))
}
