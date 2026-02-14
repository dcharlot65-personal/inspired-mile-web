use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::auth::Claims;
use crate::config::Config;

#[derive(Deserialize)]
pub struct MigrationPayload {
    pub cards: Vec<MigrateCard>,
    pub stats: MigrateStats,
    pub achievements: Vec<String>,
    pub variants: Option<Vec<MigrateVariant>>,
}

#[derive(Deserialize)]
pub struct MigrateCard {
    pub card_id: String,
    pub acquired_at: Option<i64>,
    pub source: String,
}

#[derive(Deserialize)]
pub struct MigrateStats {
    pub battle_wins: i32,
    pub total_battles: i32,
    pub total_rounds: i32,
    pub highest_score: i32,
    pub trivia_correct: i32,
    pub trivia_perfect: i32,
    pub challenges_completed: i32,
    pub unique_cards: i32,
    pub total_cards: i32,
    pub packs_opened: i32,
}

#[derive(Deserialize)]
pub struct MigrateVariant {
    pub variant_id: String,
    pub base_card_id: String,
    pub acquired_at: Option<i64>,
    pub source: String,
}

#[derive(Serialize)]
pub struct MigrationStatus {
    pub migrated: bool,
    pub migrated_at: Option<DateTime<Utc>>,
    pub cards_count: Option<i32>,
    pub achievements_count: Option<i32>,
}

#[derive(Serialize)]
pub struct MigrationResult {
    pub cards_synced: i32,
    pub achievements_synced: i32,
    pub variants_synced: i32,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/sync", post(sync_migration))
        .route("/status", get(migration_status))
}

async fn migration_status(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<MigrationStatus>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT migrated_at, cards_count, achievements_count
         FROM migration_log WHERE user_id = $1
         ORDER BY migrated_at DESC LIMIT 1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    match row {
        Some(r) => Ok(Json(MigrationStatus {
            migrated: true,
            migrated_at: r.get("migrated_at"),
            cards_count: r.get("cards_count"),
            achievements_count: r.get("achievements_count"),
        })),
        None => Ok(Json(MigrationStatus {
            migrated: false,
            migrated_at: None,
            cards_count: None,
            achievements_count: None,
        })),
    }
}

async fn sync_migration(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(payload): Json<MigrationPayload>,
) -> Result<Json<MigrationResult>, (StatusCode, String)> {
    let mut cards_synced = 0i32;
    let mut achievements_synced = 0i32;
    let mut variants_synced = 0i32;

    // Sync cards (additive)
    for card in &payload.cards {
        let ts = card
            .acquired_at
            .and_then(DateTime::from_timestamp_millis)
            .unwrap_or_else(Utc::now);

        let result = sqlx::query(
            "INSERT INTO owned_cards (user_id, card_id, acquired_at, source)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING id",
        )
        .bind(claims.sub)
        .bind(&card.card_id)
        .bind(ts)
        .bind(&card.source)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

        if result.is_some() {
            cards_synced += 1;
        }
    }

    // Sync stats (GREATEST — take the max)
    sqlx::query(
        "UPDATE player_stats SET
           battle_wins = GREATEST(battle_wins, $2),
           total_battles = GREATEST(total_battles, $3),
           total_rounds = GREATEST(total_rounds, $4),
           highest_score = GREATEST(highest_score, $5),
           trivia_correct = GREATEST(trivia_correct, $6),
           trivia_perfect = GREATEST(trivia_perfect, $7),
           challenges_completed = GREATEST(challenges_completed, $8),
           unique_cards = GREATEST(unique_cards, $9),
           total_cards = GREATEST(total_cards, $10),
           packs_opened = GREATEST(packs_opened, $11),
           updated_at = NOW()
         WHERE user_id = $1",
    )
    .bind(claims.sub)
    .bind(payload.stats.battle_wins)
    .bind(payload.stats.total_battles)
    .bind(payload.stats.total_rounds)
    .bind(payload.stats.highest_score)
    .bind(payload.stats.trivia_correct)
    .bind(payload.stats.trivia_perfect)
    .bind(payload.stats.challenges_completed)
    .bind(payload.stats.unique_cards)
    .bind(payload.stats.total_cards)
    .bind(payload.stats.packs_opened)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    // Sync achievements (union)
    for achievement_id in &payload.achievements {
        let result = sqlx::query(
            "INSERT INTO unlocked_achievements (user_id, achievement_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, achievement_id) DO NOTHING
             RETURNING id",
        )
        .bind(claims.sub)
        .bind(achievement_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

        if result.is_some() {
            achievements_synced += 1;
        }
    }

    // Sync variants if present
    if let Some(variants) = &payload.variants {
        for v in variants {
            let ts = v
                .acquired_at
                .and_then(DateTime::from_timestamp_millis)
                .unwrap_or_else(Utc::now);

            let result = sqlx::query(
                "INSERT INTO owned_variants (user_id, variant_id, base_card_id, acquired_at, source)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, variant_id) DO NOTHING
                 RETURNING id",
            )
            .bind(claims.sub)
            .bind(&v.variant_id)
            .bind(&v.base_card_id)
            .bind(ts)
            .bind(&v.source)
            .fetch_optional(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

            if result.is_some() {
                variants_synced += 1;
            }
        }
    }

    // Log the migration
    let _ = sqlx::query(
        "INSERT INTO migration_log (user_id, cards_count, achievements_count)
         VALUES ($1, $2, $3)",
    )
    .bind(claims.sub)
    .bind(cards_synced)
    .bind(achievements_synced)
    .execute(&pool)
    .await;

    Ok(Json(MigrationResult {
        cards_synced,
        achievements_synced,
        variants_synced,
    }))
}
