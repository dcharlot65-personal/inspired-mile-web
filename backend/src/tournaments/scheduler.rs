use std::sync::Arc;

use inspired_mile_api::economy::RULES;
use sqlx::PgPool;
use uuid::Uuid;

use super::{bracket, progress};
use crate::multiplayer::RoomManager;

/// The most overdue matches one look decides; the rest wait for the next look.
const OVERDUE_PER_LOOK: i64 = 100;

/// Background task, every `every`:
///   1. a tournament whose start time has passed and that has two or more entrants gets its
///      bracket, and its byes go through at once;
///   2. a match whose time to be played (`play_by`) has passed with no result, and for which no
///      room is open, is decided by who came to play (`progress::decide_overdue`).
///
/// It opens no rooms: a match is played in a room either player opens
/// (`POST /tournaments/{id}/matches/{match_id}/room`), and that room's result decides it
/// (`progress.rs`).
pub async fn run_scheduler(pool: PgPool, rooms: Arc<RoomManager>, every: std::time::Duration) {
    loop {
        if let Err(e) = check_tournaments(&pool).await {
            tracing::error!("Tournament scheduler error: {e}");
        }
        if let Err(e) = decide_overdue_matches(&pool, &rooms).await {
            tracing::error!("Tournament scheduler error (overdue matches): {e}");
        }
        tokio::time::sleep(every).await;
    }
}

async fn check_tournaments(pool: &PgPool) -> Result<(), sqlx::Error> {
    let due: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM tournaments WHERE status = 'registration' AND starts_at <= NOW()")
        .fetch_all(pool)
        .await?;
    for tournament_id in due {
        start(pool, tournament_id).await?;
    }
    Ok(())
}

/// Decide each match past its time, one transaction each. A match whose room is open (being
/// played, or a player waiting in it) is left to that room.
async fn decide_overdue_matches(pool: &PgPool, rooms: &RoomManager) -> Result<(), sqlx::Error> {
    let due: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT tournament_id, id FROM tournament_matches
         WHERE status IN ('pending', 'in_progress') AND play_by <= NOW()
           AND player1_id IS NOT NULL AND player2_id IS NOT NULL
         ORDER BY play_by
         LIMIT $1",
    )
    .bind(OVERDUE_PER_LOOK)
    .fetch_all(pool)
    .await?;
    for (tournament_id, match_id) in due {
        let mut tx = pool.begin().await?;
        if progress::decide_overdue(&mut tx, rooms, tournament_id, match_id).await? {
            tracing::info!(%tournament_id, %match_id, "a tournament match past its time was decided");
        }
        tx.commit().await?;
    }
    Ok(())
}

/// Draw one tournament's bracket, all or nothing.
async fn start(pool: &PgPool, tournament_id: Uuid) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(format) = sqlx::query_scalar::<_, String>("SELECT format FROM tournaments WHERE id = $1 AND status = 'registration' FOR UPDATE")
        .bind(tournament_id)
        .fetch_optional(&mut *tx)
        .await?
    else {
        return tx.commit().await; // started meanwhile
    };
    let player_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM tournament_entries WHERE tournament_id = $1 AND NOT eliminated ORDER BY registered_at, seed",
    )
    .bind(tournament_id)
    .fetch_all(&mut *tx)
    .await?;
    if player_ids.len() < 2 {
        return tx.commit().await; // not enough players yet
    }
    let round_robin = format == "round_robin";
    let matches = if round_robin {
        bracket::generate_round_robin(&player_ids)
    } else {
        bracket::generate_single_elimination(&player_ids)
    };
    sqlx::query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1")
        .bind(tournament_id)
        .execute(&mut *tx)
        .await?;
    let mut byes = Vec::new();
    for (round, order, p1, p2) in &matches {
        // A match with both players known is to be played within the hours of the file: a round
        // robin's round r within r times them, so its rounds come one after another; a later
        // single-elimination match gets its time when its second player is known (progress.rs).
        // A bye goes in as pending with no time, and `complete_bye` decides it below: a match is
        // taken for decided only once its player has gone on (`progress::advance` settles the next
        // round's match when both its feeders are decided).
        let hours = RULES.tournaments.match_hours * if round_robin { *round } else { 1 };
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, status, play_by)
             VALUES ($1, $2, $3, $4, $5, 'pending', CASE WHEN $4::uuid IS NOT NULL AND $5::uuid IS NOT NULL THEN NOW() + make_interval(hours => $6) END)
             RETURNING id",
        )
        .bind(tournament_id)
        .bind(round)
        .bind(order)
        .bind(p1)
        .bind(p2)
        .bind(hours)
        .fetch_one(&mut *tx)
        .await?;
        if let (Some(player), None) | (None, Some(player)) = (p1, p2) {
            byes.push((id, *player));
        }
    }
    for (match_id, player) in byes {
        progress::complete_bye(&mut tx, tournament_id, &format, match_id, player).await?;
    }
    tx.commit().await?;
    tracing::info!("Tournament {tournament_id} started with {} matches", matches.len());
    Ok(())
}
