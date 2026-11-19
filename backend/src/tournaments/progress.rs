//! How a tournament moves on. A match is decided only by a room the server judged
//! (`from_room`, called by multiplayer/results.rs inside the transaction that stores the room's
//! result) or by a bye (`complete_bye`, when the scheduler draws the bracket). No participant can
//! name a winner: until 2026-11-19 `POST /tournaments/{id}/matches/{match_id}/complete` let either
//! player name either player the winner, and pointed `room_id` at whatever id it was sent.
//!
//! Single elimination: the loser is out and the winner goes on to the next round (the match of
//! round r, order k feeds round r + 1, order (k + 1) / 2). A drawn match is played again. Round
//! robin: every pairing is played once and nobody is eliminated or advanced; a draw stands.

use sqlx::{PgConnection, Row};
use uuid::Uuid;

/// The result of a room opened for tournament match `match_id`. Does nothing when the match has
/// been decided since, or is not between the room's two players.
pub async fn from_room(
    conn: &mut PgConnection,
    match_id: Uuid,
    room_id: Uuid,
    players: [Uuid; 2],
    winner: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    let Some(tournament_id) = sqlx::query_scalar::<_, Uuid>("SELECT tournament_id FROM tournament_matches WHERE id = $1")
        .bind(match_id)
        .fetch_optional(&mut *conn)
        .await?
    else {
        return Ok(());
    };
    // The tournament first, then the match: the scheduler and every result lock in this order.
    let format: String = sqlx::query_scalar("SELECT format FROM tournaments WHERE id = $1 FOR UPDATE")
        .bind(tournament_id)
        .fetch_one(&mut *conn)
        .await?;
    let m = sqlx::query("SELECT player1_id, player2_id, status FROM tournament_matches WHERE id = $1 FOR UPDATE")
        .bind(match_id)
        .fetch_one(&mut *conn)
        .await?;
    let status: String = m.get("status");
    let (p1, p2): (Option<Uuid>, Option<Uuid>) = (m.get("player1_id"), m.get("player2_id"));
    let same_players = matches!((p1, p2), (Some(x), Some(y)) if (x == players[0] && y == players[1]) || (x == players[1] && y == players[0]));
    if !matches!(status.as_str(), "pending" | "in_progress") || !same_players {
        return Ok(());
    }
    if winner.is_none() && format == "single_elimination" {
        // Somebody has to go through: the match is open to be played again.
        sqlx::query("UPDATE tournament_matches SET status = 'pending', room_id = $2 WHERE id = $1")
            .bind(match_id)
            .bind(room_id)
            .execute(&mut *conn)
            .await?;
        return Ok(());
    }
    complete(&mut *conn, tournament_id, &format, match_id, winner, Some(room_id), "completed").await
}

/// A first-round match with one player: that player goes through.
pub async fn complete_bye(conn: &mut PgConnection, tournament_id: Uuid, format: &str, match_id: Uuid, player: Uuid) -> Result<(), sqlx::Error> {
    complete(conn, tournament_id, format, match_id, Some(player), None, "bye").await
}

/// Record the match's result, then the bracket's next step, then whether the tournament is over.
/// The caller holds the tournament's row locked.
async fn complete(
    conn: &mut PgConnection,
    tournament_id: Uuid,
    format: &str,
    match_id: Uuid,
    winner: Option<Uuid>,
    room_id: Option<Uuid>,
    status: &str,
) -> Result<(), sqlx::Error> {
    let m = sqlx::query(
        "UPDATE tournament_matches SET winner_id = $2, status = $3, room_id = $4, completed_at = NOW()
         WHERE id = $1 RETURNING round, match_order, player1_id, player2_id",
    )
    .bind(match_id)
    .bind(winner)
    .bind(status)
    .bind(room_id)
    .fetch_one(&mut *conn)
    .await?;
    let round: i32 = m.get("round");
    let match_order: i32 = m.get("match_order");
    let (p1, p2): (Option<Uuid>, Option<Uuid>) = (m.get("player1_id"), m.get("player2_id"));

    if format == "single_elimination" {
        if let Some(winner) = winner {
            let loser = if Some(winner) == p1 { p2 } else { p1 };
            if let Some(loser) = loser {
                sqlx::query("UPDATE tournament_entries SET eliminated = TRUE WHERE tournament_id = $1 AND user_id = $2")
                    .bind(tournament_id)
                    .bind(loser)
                    .execute(&mut *conn)
                    .await?;
            }
            advance(&mut *conn, tournament_id, round, match_order, winner).await?;
        }
    }

    let remaining: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = $1 AND status IN ('pending', 'in_progress')",
    )
    .bind(tournament_id)
    .fetch_one(&mut *conn)
    .await?;
    if remaining == 0 {
        sqlx::query("UPDATE tournaments SET status = 'completed', completed_at = NOW() WHERE id = $1 AND status <> 'completed'")
            .bind(tournament_id)
            .execute(&mut *conn)
            .await?;
    }
    Ok(())
}

/// Put the winner of (round, order) into the next round's match, creating it if this is the
/// first of the two to arrive. The final has no next match.
async fn advance(conn: &mut PgConnection, tournament_id: Uuid, round: i32, match_order: i32, winner: Uuid) -> Result<(), sqlx::Error> {
    let in_round: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = $1 AND round = $2")
        .bind(tournament_id)
        .bind(round)
        .fetch_one(&mut *conn)
        .await?;
    if in_round <= 1 {
        return Ok(()); // the final
    }
    let (next_round, next_order) = next_slot(round, match_order);
    let first_slot = match_order % 2 == 1;
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tournament_matches WHERE tournament_id = $1 AND round = $2 AND match_order = $3 FOR UPDATE",
    )
    .bind(tournament_id)
    .bind(next_round)
    .bind(next_order)
    .fetch_optional(&mut *conn)
    .await?;
    match existing {
        // Two literal statements, not a formatted column name: sqlx 0.9 refuses dynamic SQL.
        Some(id) => {
            sqlx::query(if first_slot {
                "UPDATE tournament_matches SET player1_id = $1 WHERE id = $2"
            } else {
                "UPDATE tournament_matches SET player2_id = $1 WHERE id = $2"
            })
            .bind(winner)
            .bind(id)
            .execute(&mut *conn)
            .await?;
        }
        None => {
            let (p1, p2) = if first_slot { (Some(winner), None) } else { (None, Some(winner)) };
            sqlx::query(
                "INSERT INTO tournament_matches (tournament_id, round, match_order, player1_id, player2_id, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')",
            )
            .bind(tournament_id)
            .bind(next_round)
            .bind(next_order)
            .bind(p1)
            .bind(p2)
            .execute(&mut *conn)
            .await?;
        }
    }
    Ok(())
}

/// Where the winner of (round, order) plays next: pairs fold, 1 and 2 into 1, 3 and 4 into 2.
pub fn next_slot(round: i32, match_order: i32) -> (i32, i32) {
    (round + 1, (match_order + 1) / 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn winners_fold_into_the_next_round_in_pairs() {
        assert_eq!(next_slot(1, 1), (2, 1));
        assert_eq!(next_slot(1, 2), (2, 1));
        assert_eq!(next_slot(1, 3), (2, 2));
        assert_eq!(next_slot(2, 4), (3, 2));
    }
}
