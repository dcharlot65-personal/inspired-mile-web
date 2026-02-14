use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;

use super::bracket;
use crate::multiplayer::RoomManager;

/// Background task that checks tournament schedules every 30 seconds.
/// Auto-generates brackets when registration closes and advances winners.
pub async fn run_scheduler(pool: PgPool, rooms: Arc<RoomManager>) {
    loop {
        if let Err(e) = check_tournaments(&pool, &rooms).await {
            tracing::error!("Tournament scheduler error: {e}");
        }
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
    }
}

async fn check_tournaments(pool: &PgPool, rooms: &Arc<RoomManager>) -> Result<(), String> {
    // Find tournaments that should start (registration period ended)
    let rows = sqlx::query(
        "SELECT id, format, max_players FROM tournaments
         WHERE status = 'registration' AND starts_at <= NOW()",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    for row in &rows {
        let tournament_id: Uuid = sqlx::Row::get(row, "id");
        let format: String = sqlx::Row::get(row, "format");

        // Get registered players
        let entries = sqlx::query(
            "SELECT user_id FROM tournament_entries
             WHERE tournament_id = $1 AND NOT eliminated
             ORDER BY registered_at",
        )
        .bind(tournament_id)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?;

        let player_ids: Vec<Uuid> = entries.iter().map(|r| sqlx::Row::get(r, "user_id")).collect();

        if player_ids.len() < 2 {
            continue; // Not enough players
        }

        // Generate bracket
        let matches = match format.as_str() {
            "round_robin" => bracket::generate_round_robin(&player_ids),
            _ => bracket::generate_single_elimination(&player_ids),
        };

        // Insert matches
        for (round, order, p1, p2) in &matches {
            let status = if p1.is_none() || p2.is_none() { "bye" } else { "pending" };

            sqlx::query(
                "INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(tournament_id)
            .bind(round)
            .bind(order)
            .bind(p1)
            .bind(p2)
            .bind(status)
            .execute(pool)
            .await
            .ok();
        }

        // Update tournament status
        sqlx::query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1")
            .bind(tournament_id)
            .execute(pool)
            .await
            .ok();

        tracing::info!("Tournament {tournament_id} started with {} matches", matches.len());
    }

    Ok(())
}
