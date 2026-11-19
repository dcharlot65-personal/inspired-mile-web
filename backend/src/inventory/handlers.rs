//! The cards an account holds on the server, and the only ways it gets more from here: the free
//! starter and daily packs, and packs bought with credits. Every pack is drawn on the server
//! with the server's randomness (`inspired_mile_api::economy::draw_pack`).
//!
//! Until 2026-11-19 `POST /inventory/add` inserted any card a client named, from any source, so
//! an account could hold, and field online, any character. That route is gone: cards come only
//! from the server (docs/ECONOMY.md). The starter characters (`starter_characters`) are held by
//! every account without a row: they cannot be sold, and need no grant.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use inspired_mile_api::economy::{self, RULES};
use inspired_mile_api::verse::cards::starter_characters;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;
use crate::ledger;

#[derive(Serialize)]
pub struct OwnedCard {
    pub id: Uuid,
    pub card_id: String,
    pub acquired_at: DateTime<Utc>,
    pub source: String,
    pub state: String,
    /// On sale in the market: it cannot be listed again, sold elsewhere or fielded online until
    /// the listing is cancelled.
    pub listed: bool,
}

#[derive(Serialize)]
pub struct InventoryStats {
    pub unique_cards: i64,
    pub total_cards: i64,
}

/// What the account may still claim, and what it holds besides its rows.
#[derive(Serialize)]
pub struct InventoryStatus {
    pub starter_claimed: bool,
    pub daily_available: bool,
    /// When the next daily pack can be claimed, if it cannot be now.
    pub next_daily_at: Option<DateTime<Utc>>,
    pub credits: i32,
    /// Characters every account holds without a row (they cannot be sold).
    pub starter_characters: Vec<String>,
}

#[derive(Deserialize)]
pub struct ClaimRequest {
    /// "starter" (once per account) or "daily" (once in every `daily_pack_every_hours`).
    pub kind: String,
}

#[derive(Deserialize)]
pub struct BuyPackRequest {
    pub tier: String,
    /// Refused when present: a pack costs what the server says.
    pub price: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct DrawnCard {
    pub id: Uuid,
    pub card_id: String,
}

#[derive(Serialize)]
pub struct PackResponse {
    pub cards: Vec<DrawnCard>,
    pub credits: i32,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(list_cards))
        .route("/stats", get(inventory_stats))
        .route("/status", get(inventory_status))
        .route("/claim", post(claim_pack))
        .route("/packs", post(buy_pack))
}

async fn list_cards(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<OwnedCard>>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, card_id, acquired_at, source, state
         FROM owned_cards WHERE user_id = $1
         ORDER BY acquired_at, id",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let cards: Vec<OwnedCard> = rows
        .iter()
        .map(|r| {
            let state: String = r.get("state");
            OwnedCard {
                id: r.get("id"),
                card_id: r.get("card_id"),
                acquired_at: r.get("acquired_at"),
                source: r.get("source"),
                listed: state == "listed",
                state,
            }
        })
        .collect();

    Ok(Json(cards))
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
    .map_err(crate::error::internal)?;

    Ok(Json(InventoryStats {
        unique_cards: row.get::<i64, _>("unique_cards"),
        total_cards: row.get::<i64, _>("total_cards"),
    }))
}

/// When the account last claimed a daily pack, if it ever did.
async fn last_daily(conn: &mut sqlx::PgConnection, user_id: Uuid) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    sqlx::query_scalar("SELECT MAX(claimed_at) FROM pack_claims WHERE user_id = $1 AND kind = 'daily'")
        .bind(user_id)
        .fetch_one(&mut *conn)
        .await
}

fn next_daily(last: Option<DateTime<Utc>>) -> Option<DateTime<Utc>> {
    let next = last? + chrono::Duration::hours(RULES.packs.daily_pack_every_hours);
    (next > Utc::now()).then_some(next)
}

async fn inventory_status(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<InventoryStatus>, (StatusCode, String)> {
    let mut conn = pool.acquire().await.map_err(crate::error::internal)?;
    let starter_claimed: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pack_claims WHERE user_id = $1 AND kind = 'starter')")
        .bind(claims.sub)
        .fetch_one(&mut *conn)
        .await
        .map_err(crate::error::internal)?;
    let next_daily_at = next_daily(last_daily(&mut conn, claims.sub).await.map_err(crate::error::internal)?);
    let credits: i32 = sqlx::query_scalar("SELECT credits FROM player_stats WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_optional(&mut *conn)
        .await
        .map_err(crate::error::internal)?
        .unwrap_or(0);
    Ok(Json(InventoryStatus {
        starter_claimed,
        daily_available: next_daily_at.is_none(),
        next_daily_at,
        credits,
        starter_characters: starter_characters(),
    }))
}

/// The server's own draw: `count` ordinary cards, or a tier's pack. Never a client's randomness.
fn draw(tier: Option<&economy::Tier>, count: usize) -> Vec<String> {
    let mut rng = rand::rng();
    let mut roll = |n: u32| rand::RngExt::random_range(&mut rng, 0..n);
    let cards = match tier {
        Some(t) => economy::draw_pack(t, &mut roll),
        None => economy::draw_free(count, &mut roll),
    };
    cards.into_iter().map(|c| c.id.clone()).collect()
}

/// A free pack: the starter pack once per account, the daily pack once in every
/// `daily_pack_every_hours`. Both checked and recorded under the account's lock.
async fn claim_pack(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<ClaimRequest>,
) -> Result<Json<PackResponse>, (StatusCode, String)> {
    let count = match body.kind.as_str() {
        "starter" => RULES.packs.starter_pack_cards,
        "daily" => RULES.packs.daily_pack_cards,
        _ => return Err((StatusCode::BAD_REQUEST, "Unknown pack".into())),
    };
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    let credits = ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    let taken = if body.kind == "starter" {
        sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM pack_claims WHERE user_id = $1 AND kind = 'starter')")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await
            .map_err(crate::error::internal)?
    } else {
        next_daily(last_daily(&mut tx, claims.sub).await.map_err(crate::error::internal)?).is_some()
    };
    if taken {
        return Err((StatusCode::CONFLICT, "Already claimed".into()));
    }
    sqlx::query("INSERT INTO pack_claims (user_id, kind) VALUES ($1, $2)")
        .bind(claims.sub)
        .bind(&body.kind)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    let drawn = draw(None, count);
    let source = if body.kind == "starter" { "starter_pack" } else { "daily_pack" };
    let rows = ledger::grant_cards(&mut tx, claims.sub, &drawn, source).await.map_err(crate::error::internal)?;
    ledger::count_pack(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;
    Ok(Json(PackResponse { cards: rows.into_iter().map(|(id, card_id)| DrawnCard { id, card_id }).collect(), credits }))
}

/// Buy a pack of a tier at the server's price: the credits are taken (a teen account within its
/// daily limit), the server draws the cards and the account holds them, in one transaction.
async fn buy_pack(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<BuyPackRequest>,
) -> Result<Json<PackResponse>, (StatusCode, String)> {
    if body.price.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Amounts are set by the server".into()));
    }
    let tier = economy::tier(&body.tier).ok_or((StatusCode::BAD_REQUEST, "Unknown pack".into()))?;
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    let source = format!("pack_{}", tier.tier);
    let credits = ledger::debit(&mut tx, claims.sub, tier.price, &source).await.map_err(ledger::Debit::refusal)?;
    let drawn = draw(Some(tier), tier.cards);
    let rows = ledger::grant_cards(&mut tx, claims.sub, &drawn, "pack").await.map_err(crate::error::internal)?;
    ledger::count_pack(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;
    tracing::info!(user_id = %claims.sub, tier = %tier.tier, "Pack bought");
    Ok(Json(PackResponse { cards: rows.into_iter().map(|(id, card_id)| DrawnCard { id, card_id }).collect(), credits }))
}
