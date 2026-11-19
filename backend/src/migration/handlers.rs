//! The one-time move of a device's own collection into an account.
//!
//! A signed-out player collects cards in the browser for solo play. On an account's first
//! sign-in (within `import.window_hours` of the account being made: 403 after) the page may offer
//! that collection once: the server takes one copy of each different
//! card, the rarest first, at most `import.max_cards` and at most `import.max_by_rarity` of a
//! rarity (backend/data/economy.json; `inspired_mile_api::economy::choose_import`), and never
//! again for that account. A device's collection is whatever its storage says, so the cap is the
//! most a forged one can bring (docs/ECONOMY.md).
//!
//! Until 2026-11-19 `POST /migrate/sync` copied every card, stat, achievement and variant the
//! browser named, as often as asked, with any source string: a 500 for a card id over 16
//! characters or a source over 32. Stats and achievements now stay on the device; variants too.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use inspired_mile_api::economy::{self, RULES};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;
use crate::ledger;

/// The most DIFFERENT card ids one import request may name (the catalogue has 71). A device holds
/// a row per card it collected, so the same card many times: duplicates are dropped before this
/// is counted. Until the third check of 2026-11-19 the rows were counted, and a device with more
/// than 500 (about 500 solo wins signed out) could never bring its cards over.
const MAX_ASKED: usize = 500;

#[derive(Deserialize)]
pub struct ImportRequest {
    /// The card ids the device holds (duplicates allowed; one copy of each is taken).
    pub cards: Vec<String>,
}

#[derive(Serialize)]
pub struct MigrationStatus {
    pub migrated: bool,
    pub migrated_at: Option<DateTime<Utc>>,
    pub cards_count: Option<i32>,
    pub achievements_count: Option<i32>,
    /// The most cards an import takes.
    pub max_cards: usize,
    /// Whether this account may still import: it has not, and it was made less than
    /// `import.window_hours` ago (its first sign-in).
    pub open: bool,
    /// Until when it may (None once it has imported).
    pub open_until: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct ImportResult {
    /// The card ids the account now holds from this device.
    pub imported: Vec<String>,
    /// Different cards named and not taken (over a cap, unknown, or a starter character).
    pub left_out: usize,
    pub max_cards: usize,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/import", post(import_cards))
        .route("/status", get(migration_status))
}

/// Until when an account made at `created` may import.
fn import_closes(created: DateTime<Utc>) -> DateTime<Utc> {
    created + chrono::Duration::hours(RULES.import.window_hours)
}

async fn migration_status(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<MigrationStatus>, (StatusCode, String)> {
    let created: DateTime<Utc> = sqlx::query_scalar("SELECT created_at FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .map_err(crate::error::internal)?;
    let closes = import_closes(created);
    let row = sqlx::query(
        "SELECT migrated_at, cards_count, achievements_count
         FROM migration_log WHERE user_id = $1
         ORDER BY migrated_at DESC LIMIT 1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(crate::error::internal)?;

    let max_cards = RULES.import.max_cards;
    Ok(Json(match row {
        Some(r) => MigrationStatus {
            migrated: true,
            migrated_at: r.get("migrated_at"),
            cards_count: r.get("cards_count"),
            achievements_count: r.get("achievements_count"),
            max_cards,
            open: false,
            open_until: None,
        },
        None => MigrationStatus {
            migrated: false,
            migrated_at: None,
            cards_count: None,
            achievements_count: None,
            max_cards,
            open: Utc::now() < closes,
            open_until: Some(closes),
        },
    }))
}

async fn import_cards(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<ImportRequest>,
) -> Result<Json<ImportResult>, (StatusCode, String)> {
    // A card id is at most 16 ASCII letters, digits and dashes (owned_cards.card_id): anything
    // else is a bad request, not a database error.
    if body.cards.iter().any(|id| id.is_empty() || id.len() > 16 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')) {
        return Err((StatusCode::BAD_REQUEST, "Invalid card ID".into()));
    }
    // One of each: a device's rows name the same card many times.
    let mut seen = std::collections::HashSet::new();
    let distinct: Vec<String> = body.cards.into_iter().filter(|id| seen.insert(id.clone())).collect();
    if distinct.len() > MAX_ASKED {
        return Err((StatusCode::BAD_REQUEST, "Too many cards".into()));
    }
    let choice = economy::choose_import(&distinct);

    let mut tx = pool.begin().await.map_err(crate::error::internal)?;
    ledger::lock_account(&mut tx, claims.sub).await.map_err(crate::error::internal)?;
    // On the account's first sign-in only: within `import.window_hours` of its being made.
    let created: DateTime<Utc> = sqlx::query_scalar("SELECT created_at FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    if Utc::now() >= import_closes(created) {
        return Err((
            StatusCode::FORBIDDEN,
            format!("A device's cards come over only in an account's first {} hours", RULES.import.window_hours),
        ));
    }
    let done: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM migration_log WHERE user_id = $1)")
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    if done {
        return Err((StatusCode::CONFLICT, "Already imported".into()));
    }
    ledger::grant_cards(&mut tx, claims.sub, &choice.take, "import").await.map_err(crate::error::internal)?;
    sqlx::query("INSERT INTO migration_log (user_id, cards_count, achievements_count) VALUES ($1, $2, 0)")
        .bind(claims.sub)
        .bind(choice.take.len() as i32)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::internal)?;
    tx.commit().await.map_err(crate::error::internal)?;
    tracing::info!(user_id = %claims.sub, imported = choice.take.len(), left_out = choice.left_out, "A device's cards were imported");
    Ok(Json(ImportResult { imported: choice.take, left_out: choice.left_out, max_cards: RULES.import.max_cards }))
}
