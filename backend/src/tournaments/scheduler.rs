use sqlx::PgPool;
use uuid::Uuid;

use super::{bracket, progress};

/// Background task that starts tournaments whose registration has closed: every `every`, a
/// tournament whose start time has passed and that has two or more entrants gets its bracket,
/// and its byes go through at once. It opens no rooms: a match is played in a room either player
/// opens (`POST /tournaments/{id}/matches/{match_id}/room`), and only that room's result decides
/// it (`progress.rs`).
pub async fn run_scheduler(pool: PgPool, every: std::time::Duration) {
    loop {
        if let Err(e) = check_tournaments(&pool).await {
            tracing::error!("Tournament scheduler error: {e}");
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
    let matches = match format.as_str() {
        "round_robin" => bracket::generate_round_robin(&player_ids),
        _ => bracket::generate_single_elimination(&player_ids),
    };
    sqlx::query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1")
        .bind(tournament_id)
        .execute(&mut *tx)
        .await?;
    let mut byes = Vec::new();
    for (round, order, p1, p2) in &matches {
        let status = if p1.is_none() || p2.is_none() { "bye" } else { "pending" };
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        )
        .bind(tournament_id)
        .bind(round)
        .bind(order)
        .bind(p1)
        .bind(p2)
        .bind(status)
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
