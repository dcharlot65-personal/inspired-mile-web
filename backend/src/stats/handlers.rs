//! What the server knows of a player: the online matches it judged, and the cards and packs it
//! gave. Nothing here is raised by a client.
//!
//! Until 2026-11-19 `POST /stats` raised the counters to whatever the client sent, those
//! counters (solo rounds won, self-reported) were the public leaderboard, and
//! `POST /stats/achievements` unlocked any achievement named. Solo play stays on the device
//! (src/lib/achievements.ts); the leaderboard and the account's record are the matches the server
//! judged (`battle_rooms`, written by multiplayer/results.rs), and account achievements are only
//! those the server can verify (backend/data/economy.json, `account_achievements`).

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use inspired_mile_api::economy::{self, Metrics};
use inspired_mile_api::verse::cards::starter_characters;
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::Config;

/// One account's record of server-judged online matches.
#[derive(Serialize, Default)]
pub struct OnlineRecord {
    pub wins: i64,
    pub losses: i64,
    pub draws: i64,
    pub matches: i64,
    pub rounds: i64,
    /// The best total of one round.
    pub best_round: i64,
}

#[derive(Serialize)]
pub struct PlayerStats {
    pub online: OnlineRecord,
    /// Different cards held on the server, the starter characters included.
    pub unique_cards: i64,
    /// Card rows held on the server (the starter characters are not rows).
    pub total_cards: i64,
    /// Packs the server opened for the account.
    pub packs_opened: i64,
    pub credits: i32,
}

#[derive(Serialize)]
pub struct UnlockedAchievement {
    pub achievement_id: String,
    pub unlocked_at: DateTime<Utc>,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/", get(get_stats))
        .route("/achievements", get(list_achievements))
}

pub fn public_router() -> Router<(PgPool, Config)> {
    Router::new().route("/leaderboard", get(get_leaderboard))
}

/// One row of the public leaderboard. The field names are the old ones, so a page cached before
/// 2026-11-19 still draws it; they now mean online matches the server judged: `battle_wins` is
/// matches won (a match, not a round), `total_battles` matches finished, `highest_score` the best
/// total of one round.
#[derive(Serialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub battle_wins: i64,
    pub total_battles: i64,
    pub highest_score: i64,
}

/// Each finished match seen from each of its two players. A macro so that the statements that
/// use it stay literals.
macro_rules! sides {
    () => {
        "(SELECT player1_id AS user_id, winner_id, total_rounds, best_round_1 AS best FROM battle_rooms
           WHERE state = 'completed' AND player1_id IS NOT NULL AND player2_id IS NOT NULL
          UNION ALL
          SELECT player2_id, winner_id, total_rounds, best_round_2 FROM battle_rooms
           WHERE state = 'completed' AND player1_id IS NOT NULL AND player2_id IS NOT NULL) s"
    };
}

async fn get_leaderboard(State((pool, _)): State<(PgPool, Config)>) -> Result<Json<Vec<LeaderboardEntry>>, (StatusCode, String)> {
    let rows = sqlx::query(concat!(
        "SELECT u.id, u.username, u.avatar_url,
                COUNT(*) FILTER (WHERE s.winner_id = s.user_id) AS wins,
                COUNT(*) AS matches,
                COALESCE(MAX(s.best), 0)::BIGINT AS best
         FROM ",
        sides!(),
        " JOIN users u ON u.id = s.user_id
         GROUP BY u.id, u.username, u.avatar_url
         HAVING COUNT(*) FILTER (WHERE s.winner_id = s.user_id) > 0
         ORDER BY wins DESC, best DESC, matches ASC, u.username
         LIMIT 50"
    ))
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;

    let entries = rows
        .iter()
        .enumerate()
        .map(|(i, r)| {
            let id: Uuid = r.get("id");
            LeaderboardEntry {
                rank: (i + 1) as i32,
                user_id: id.to_string(),
                username: r.get("username"),
                avatar_url: r.get("avatar_url"),
                battle_wins: r.get("wins"),
                total_battles: r.get("matches"),
                highest_score: r.get("best"),
            }
        })
        .collect();
    Ok(Json(entries))
}

/// The account's server-judged online record.
pub async fn online_record(pool: &PgPool, user_id: Uuid) -> Result<OnlineRecord, sqlx::Error> {
    let row = sqlx::query(concat!(
        "SELECT COUNT(*) FILTER (WHERE s.winner_id = s.user_id) AS wins,
                COUNT(*) FILTER (WHERE s.winner_id IS NOT NULL AND s.winner_id <> s.user_id) AS losses,
                COUNT(*) FILTER (WHERE s.winner_id IS NULL) AS draws,
                COUNT(*) AS matches,
                COALESCE(SUM(s.total_rounds), 0)::BIGINT AS rounds,
                COALESCE(MAX(s.best), 0)::BIGINT AS best
         FROM ",
        sides!(),
        " WHERE s.user_id = $1"
    ))
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(OnlineRecord {
        wins: row.get("wins"),
        losses: row.get("losses"),
        draws: row.get("draws"),
        matches: row.get("matches"),
        rounds: row.get("rounds"),
        best_round: row.get("best"),
    })
}

/// Different cards the account holds on the server, the starter characters included.
async fn unique_cards(pool: &PgPool, user_id: Uuid) -> Result<(i64, i64), sqlx::Error> {
    let held: Vec<String> = sqlx::query_scalar("SELECT DISTINCT card_id FROM owned_cards WHERE user_id = $1")
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM owned_cards WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    let mut ids = held;
    for id in starter_characters() {
        if !ids.contains(&id) {
            ids.push(id);
        }
    }
    Ok((ids.len() as i64, total))
}

async fn get_stats(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<PlayerStats>, (StatusCode, String)> {
    let online = online_record(&pool, claims.sub).await.map_err(crate::error::internal)?;
    let (unique, total) = unique_cards(&pool, claims.sub).await.map_err(crate::error::internal)?;
    let row = sqlx::query("SELECT packs_opened, credits FROM player_stats WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?;
    let (packs_opened, credits) = row.map(|r| (i64::from(r.get::<i32, _>("packs_opened")), r.get::<i32, _>("credits"))).unwrap_or((0, 0));
    Ok(Json(PlayerStats { online, unique_cards: unique, total_cards: total, packs_opened, credits }))
}

/// The account achievements the server can verify, worked out now from what it holds; each is
/// recorded the first time it is seen reached, which is the time given for it.
async fn list_achievements(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<Vec<UnlockedAchievement>>, (StatusCode, String)> {
    let online = online_record(&pool, claims.sub).await.map_err(crate::error::internal)?;
    let (unique, _) = unique_cards(&pool, claims.sub).await.map_err(crate::error::internal)?;
    let packs: i32 = sqlx::query_scalar("SELECT packs_opened FROM player_stats WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await
        .map_err(crate::error::internal)?
        .unwrap_or(0);
    let metrics = Metrics {
        online_wins: online.wins,
        online_matches: online.matches,
        online_rounds: online.rounds,
        best_round: online.best_round,
        unique_cards: unique,
        packs_opened: i64::from(packs),
    };
    let reached: Vec<String> = economy::reached(&metrics).into_iter().map(String::from).collect();
    sqlx::query(
        "INSERT INTO unlocked_achievements (user_id, achievement_id)
         SELECT $1, id FROM UNNEST($2::TEXT[]) AS id
         ON CONFLICT (user_id, achievement_id) DO NOTHING",
    )
    .bind(claims.sub)
    .bind(&reached)
    .execute(&pool)
    .await
    .map_err(crate::error::internal)?;

    // Only verifiable ones are account achievements: a row written by the old claim-by-id route
    // that the account's record does not bear out is not shown.
    let rows = sqlx::query(
        "SELECT achievement_id, unlocked_at FROM unlocked_achievements
         WHERE user_id = $1 AND achievement_id = ANY($2)
         ORDER BY unlocked_at, achievement_id",
    )
    .bind(claims.sub)
    .bind(&reached)
    .fetch_all(&pool)
    .await
    .map_err(crate::error::internal)?;
    Ok(Json(
        rows.iter()
            .map(|r| UnlockedAchievement { achievement_id: r.get("achievement_id"), unlocked_at: r.get("unlocked_at") })
            .collect(),
    ))
}
