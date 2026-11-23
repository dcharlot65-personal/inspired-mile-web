//! Storing the matches the server judged.
//!
//! A room hands its finished match here once (`game_room::MatchRecord`). Each is written in one
//! transaction: a `battle_rooms` row (the two accounts, who won and how, rounds and points per
//! side; never a verse, which the privacy policy promises is not stored), the rewards an online
//! match pays (credits to the winner and XP to both, within their daily caps,
//! backend/data/economy.json), and, for a room opened for a tournament match, that match's
//! result and the bracket's next step (`tournaments::progress`).
//!
//! These rows are the public leaderboard, every account's online record, account achievements
//! and tournament results (stats/handlers.rs). Nothing a client says is among them.
//!
//! A tournament room whose opponent never came reports who waited (`RoomReport::NoShow`); that is
//! kept on the match (`tournaments::progress::note_no_show`) for its deadline.

use inspired_mile_api::economy::{self, Rate, RULES};
use sqlx::{PgPool, Postgres, Transaction};
use tokio::sync::mpsc;
use uuid::Uuid;

use super::game_room::{MatchRecord, RoomReport, Unstored};
use crate::ledger;

/// Write each report as it comes. A write that fails is tried again a few times; one that
/// still fails is logged in full, so an operator can enter it by hand. Once a report about a
/// tournament match is written (or given up), `unstored` is told: until then the match's deadline
/// waits for it (`RoomManager::tournament_room_live`).
pub async fn run_recorder(pool: PgPool, mut rx: mpsc::UnboundedReceiver<RoomReport>, unstored: Unstored) {
    while let Some(report) = rx.recv().await {
        let mut attempt = 0;
        loop {
            attempt += 1;
            let written = match &report {
                RoomReport::Match(record) => record_match(&pool, record).await,
                RoomReport::NoShow { tournament_match, present, .. } => record_no_show(&pool, *tournament_match, *present).await,
            };
            let room_id = match &report {
                RoomReport::Match(record) => record.room_id,
                RoomReport::NoShow { room_id, .. } => *room_id,
            };
            match written {
                Ok(()) => break,
                Err(e) if attempt < 4 => {
                    tracing::warn!(%room_id, attempt, "could not store a room's report yet: {e}");
                    tokio::time::sleep(std::time::Duration::from_millis(500 * attempt)).await;
                }
                Err(e) => {
                    tracing::error!(%room_id, ?report, "a room's report was NOT stored: {e}");
                    break;
                }
            }
        }
        if let Some(m) = report.tournament_match() {
            unstored.end(m);
        }
    }
}

/// A player waited out a tournament room's time to arrive and the opponent never came.
async fn record_no_show(pool: &PgPool, tournament_match: Uuid, present: Uuid) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    crate::tournaments::progress::note_no_show(&mut tx, tournament_match, present).await?;
    tx.commit().await
}

/// Store one finished match, its rewards and its tournament result, all or nothing. A match
/// already stored (the same room) is not stored or paid twice.
pub async fn record_match(pool: &PgPool, record: &MatchRecord) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    let [a, b] = record.players;
    let winner = record.winner.map(|seat| record.players[seat]);
    let fresh = sqlx::query(
        "INSERT INTO battle_rooms (id, state, player1_id, player2_id, winner_id, total_rounds, current_round,
                                   created_at, completed_at, end_reason, rounds_won_1, rounds_won_2,
                                   points_1, points_2, best_round_1, best_round_2, started_at)
         VALUES ($1, 'completed', $2, $3, $4, $5, $5, COALESCE($14, $6), $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(record.room_id)
    .bind(a)
    .bind(b)
    .bind(winner)
    .bind(record.rounds_played as i32)
    .bind(record.ended_at)
    .bind(record.reason.as_str())
    .bind(record.rounds_won[0] as i32)
    .bind(record.rounds_won[1] as i32)
    .bind(record.points[0] as i32)
    .bind(record.points[1] as i32)
    .bind(record.best_round[0] as i32)
    .bind(record.best_round[1] as i32)
    .bind(record.started_at)
    .execute(&mut *tx)
    .await?;
    if fresh.rows_affected() == 0 {
        return tx.commit().await;
    }

    pay(&mut tx, record, winner).await?;

    if let Some(match_id) = record.tournament_match {
        crate::tournaments::progress::from_room(&mut tx, match_id, record.room_id, [a, b], winner).await?;
    }
    tx.commit().await
}

/// What an online match pays: XP to both players (a win pays more), and credits to the winner,
/// each within its caps (a day's matches for XP, and a day's matches against the same opponent;
/// a day's wins for credits, and a day's wins over the same opponent).
async fn pay(tx: &mut Transaction<'_, Postgres>, record: &MatchRecord, winner: Option<Uuid>) -> Result<(), sqlx::Error> {
    let [a, b] = record.players;
    ledger::lock_accounts(&mut *tx, a, b).await?;
    let online = &RULES.online;
    if let Some(winner) = winner {
        let loser = if winner == a { b } else { a };
        let paid_today = ledger::earnings_today(&mut *tx, winner, "online_win").await?;
        // Wins over this opponent today, this one aside (it is stored already): at most
        // `win_credits_per_opponent_per_day` of them pay.
        let against: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM battle_rooms
             WHERE state = 'completed' AND winner_id = $1 AND id <> $3
               AND (player1_id = $2 OR player2_id = $2)
               AND completed_at >= (date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
        )
        .bind(winner)
        .bind(loser)
        .bind(record.room_id)
        .fetch_one(&mut **tx)
        .await?;
        if economy::online_win_pays(paid_today, against) {
            ledger::credit(&mut *tx, winner, online.win_credits, "online_win").await?;
        }
    }
    if let Some(season) = ledger::active_season(&mut *tx).await? {
        // Matches between these two today, this one aside: at most
        // `xp_matches_per_opponent_per_day` of them pay XP, so an account that forfeits to its own
        // second account pays it 300 XP a day, not 2,000 (third check of 2026-11-19).
        let together: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM battle_rooms
             WHERE state = 'completed' AND id <> $3
               AND ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
               AND completed_at >= (date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
        )
        .bind(a)
        .bind(b)
        .bind(record.room_id)
        .fetch_one(&mut **tx)
        .await?;
        if economy::online_xp_pays(together) {
            for player in [a, b] {
                let amount = if Some(player) == winner { online.xp_win } else { online.xp_other };
                let rate = Rate { amount, per_day: online.xp_matches_per_day };
                // Wins and other matches share one daily count ("online_match").
                ledger::xp_capped(&mut *tx, player, season, "online_match", rate).await?;
            }
        }
    }
    Ok(())
}
