//! How a tournament moves on. A match is decided by a room the server judged (`from_room`,
//! called by multiplayer/results.rs inside the transaction that stores the room's result), by a
//! bye (`complete_bye`, when the scheduler draws the bracket), or, once its deadline has passed
//! with no result, by who came to play (`decide_overdue`, called by the scheduler). No
//! participant can name a winner: until 2026-11-19 `POST /tournaments/{id}/matches/{match_id}/complete`
//! let either player name either player the winner, and pointed `room_id` at whatever id it was sent.
//!
//! Single elimination: the loser is out and the winner goes on to the next round (the match of
//! round r, order k feeds round r + 1, order (k + 1) / 2), up to the final, which has no next
//! match. The final is the round where the first round has folded down to one match: with `f`
//! first-round matches (always a power of two, `bracket::generate_single_elimination`), round
//! log2(f) + 1 (`final_round`). Until the second check of 2026-11-19 the final was taken to be any
//! round with one match so far; a later round's matches are made only as their feeder matches
//! end, so the winner of a round-two match played before its sibling existed was taken for the
//! champion, and the real final waited for ever with one player. A drawn match is played again.
//! Round robin: every pairing is played once and nobody is eliminated or advanced; a draw stands.
//!
//! Deadlines (backend/data/economy.json `tournaments.match_hours`; docs/ECONOMY.md): a match is to
//! be played by `play_by`, set when both its players are known (a round robin's round r gets r
//! times the hours, so its rounds come one after another). When that passes with no result and no
//! room open for it, a player who sat ready in the match's room until its time to arrive ran out,
//! while the other never came (`note_no_show`), goes through; if neither or both did, a
//! single-elimination match is decided by lot, drawn by the server, and a round-robin match stands
//! unplayed. `decided_by` says which: room, bye, no_show, lot or unplayed.

use inspired_mile_api::economy::RULES;
use sqlx::{PgConnection, Row};
use uuid::Uuid;

use crate::multiplayer::RoomManager;

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
    complete(&mut *conn, tournament_id, &format, match_id, Decision { winner, room_id: Some(room_id), status: "completed", by: "room" }).await
}

/// A first-round match with one player: that player goes through.
pub async fn complete_bye(conn: &mut PgConnection, tournament_id: Uuid, format: &str, match_id: Uuid, player: Uuid) -> Result<(), sqlx::Error> {
    complete(conn, tournament_id, format, match_id, Decision { winner: Some(player), room_id: None, status: "bye", by: "bye" }).await
}

/// A player sat ready in the match's room until its time to arrive ran out, and the other never
/// came. Kept for the match's deadline; it decides nothing now.
pub async fn note_no_show(conn: &mut PgConnection, match_id: Uuid, present: Uuid) -> Result<(), sqlx::Error> {
    // Two literal statements, not a formatted column name: sqlx 0.9 refuses dynamic SQL.
    for statement in [
        "UPDATE tournament_matches SET waited_1 = NOW(), status = 'pending'
         WHERE id = $1 AND player1_id = $2 AND status IN ('pending', 'in_progress')",
        "UPDATE tournament_matches SET waited_2 = NOW(), status = 'pending'
         WHERE id = $1 AND player2_id = $2 AND status IN ('pending', 'in_progress')",
    ] {
        sqlx::query(statement).bind(match_id).bind(present).execute(&mut *conn).await?;
    }
    Ok(())
}

/// How a match whose deadline has passed with no result is decided: a player who waited for an
/// absent opponent wins; otherwise a single-elimination match goes to the player the lot names
/// (`lot_for_player1`), and a round-robin match stands unplayed.
pub fn overdue_ruling(
    single_elimination: bool,
    players: [Uuid; 2],
    waited: [bool; 2],
    lot_for_player1: bool,
) -> (Option<Uuid>, &'static str) {
    match waited {
        [true, false] => (Some(players[0]), "no_show"),
        [false, true] => (Some(players[1]), "no_show"),
        _ if single_elimination => (Some(if lot_for_player1 { players[0] } else { players[1] }), "lot"),
        _ => (None, "unplayed"),
    }
}

/// Decide one match whose deadline has passed, if it is still undecided and no room for it is
/// open (a match being played, or a player waiting for the other, is left to its room). Returns
/// whether it decided.
///
/// The rooms are asked after the match is locked: the match's room is opened under the same
/// lock (`handlers::open_match_room`), so a room opened at the same moment is either seen here, or
/// finds the match decided and is not opened.
pub async fn decide_overdue(conn: &mut PgConnection, rooms: &RoomManager, tournament_id: Uuid, match_id: Uuid) -> Result<bool, sqlx::Error> {
    // The tournament first, then the match, as every result locks them.
    let Some(format) = sqlx::query_scalar::<_, String>("SELECT format FROM tournaments WHERE id = $1 AND status = 'in_progress' FOR UPDATE")
        .bind(tournament_id)
        .fetch_optional(&mut *conn)
        .await?
    else {
        return Ok(false);
    };
    let Some(m) = sqlx::query(
        "SELECT player1_id, player2_id, waited_1 IS NOT NULL AS w1, waited_2 IS NOT NULL AS w2
         FROM tournament_matches
         WHERE id = $1 AND tournament_id = $2 AND status IN ('pending', 'in_progress') AND play_by <= NOW()
         FOR UPDATE",
    )
    .bind(match_id)
    .bind(tournament_id)
    .fetch_optional(&mut *conn)
    .await?
    else {
        return Ok(false);
    };
    let (Some(p1), Some(p2)) = (m.get::<Option<Uuid>, _>("player1_id"), m.get::<Option<Uuid>, _>("player2_id")) else {
        return Ok(false);
    };
    if rooms.tournament_room_live(match_id).await {
        return Ok(false);
    }
    let (winner, by) = overdue_ruling(format == "single_elimination", [p1, p2], [m.get("w1"), m.get("w2")], rand::random::<bool>());
    complete(&mut *conn, tournament_id, &format, match_id, Decision { winner, room_id: None, status: "completed", by }).await?;
    Ok(true)
}

/// How a match was decided, for `complete`.
struct Decision<'a> {
    winner: Option<Uuid>,
    /// The stored result (`battle_rooms`) of the room that decided it.
    room_id: Option<Uuid>,
    status: &'a str,
    /// room, bye, no_show, lot or unplayed.
    by: &'a str,
}

/// Record the match's result, then the bracket's next step, then whether the tournament is over.
/// The caller holds the tournament's row locked.
async fn complete(conn: &mut PgConnection, tournament_id: Uuid, format: &str, match_id: Uuid, decision: Decision<'_>) -> Result<(), sqlx::Error> {
    let m = sqlx::query(
        "UPDATE tournament_matches SET winner_id = $2, status = $3, room_id = $4, decided_by = $5, completed_at = NOW()
         WHERE id = $1 RETURNING round, match_order, player1_id, player2_id",
    )
    .bind(match_id)
    .bind(decision.winner)
    .bind(decision.status)
    .bind(decision.room_id)
    .bind(decision.by)
    .fetch_one(&mut *conn)
    .await?;
    let round: i32 = m.get("round");
    let match_order: i32 = m.get("match_order");
    let (p1, p2): (Option<Uuid>, Option<Uuid>) = (m.get("player1_id"), m.get("player2_id"));

    if format == "single_elimination" {
        if let Some(winner) = decision.winner {
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

/// The round that is the final of a single-elimination bracket whose first round has this many
/// matches (a power of two; one match means the first round is the final).
pub fn final_round(first_round_matches: i64) -> i32 {
    let f = u64::try_from(first_round_matches.max(1)).unwrap_or(1).next_power_of_two();
    f.trailing_zeros() as i32 + 1
}

/// Put the winner of (round, order) into the next round's match, creating it if this is the
/// first of the two to arrive. The final has no next match.
async fn advance(conn: &mut PgConnection, tournament_id: Uuid, round: i32, match_order: i32, winner: Uuid) -> Result<(), sqlx::Error> {
    // The first round is drawn whole, so its size is the bracket's: the later rounds are not
    // there yet when an early match ends, and cannot say where the final is.
    let first_round: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = $1 AND round = 1")
        .bind(tournament_id)
        .fetch_one(&mut *conn)
        .await?;
    if round >= final_round(first_round) {
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
        // The second player is known: the match's time to be played starts now.
        // Two literal statements, not a formatted column name: sqlx 0.9 refuses dynamic SQL.
        Some(id) => {
            sqlx::query(if first_slot {
                "UPDATE tournament_matches SET player1_id = $1, play_by = NOW() + make_interval(hours => $3) WHERE id = $2"
            } else {
                "UPDATE tournament_matches SET player2_id = $1, play_by = NOW() + make_interval(hours => $3) WHERE id = $2"
            })
            .bind(winner)
            .bind(id)
            .bind(RULES.tournaments.match_hours)
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
    use crate::tournaments::bracket::generate_single_elimination;

    #[test]
    fn winners_fold_into_the_next_round_in_pairs() {
        assert_eq!(next_slot(1, 1), (2, 1));
        assert_eq!(next_slot(1, 2), (2, 1));
        assert_eq!(next_slot(1, 3), (2, 2));
        assert_eq!(next_slot(2, 4), (3, 2));
    }

    #[test]
    fn the_final_follows_from_the_size_of_the_first_round() {
        assert_eq!(final_round(1), 1);
        assert_eq!(final_round(2), 2);
        assert_eq!(final_round(4), 3);
        assert_eq!(final_round(32), 6);
        // For every field of players, folding the first round pair by pair reaches one match in
        // the final round, and not before.
        for n in 2usize..=64 {
            let players: Vec<Uuid> = (0..n).map(|_| Uuid::new_v4()).collect();
            let first = generate_single_elimination(&players).len() as i64;
            let (mut round, mut matches) = (1, first);
            while matches > 1 {
                assert!(round < final_round(first), "{n} players: round {round} has {matches} matches, not the final");
                matches /= 2;
                round += 1;
            }
            assert_eq!(round, final_round(first), "{n} players");
        }
    }

    #[test]
    fn an_overdue_match_goes_to_whoever_waited_or_else_to_the_lot() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        for single in [true, false] {
            assert_eq!(overdue_ruling(single, [a, b], [true, false], false), (Some(a), "no_show"));
            assert_eq!(overdue_ruling(single, [a, b], [false, true], true), (Some(b), "no_show"));
        }
        for waited in [[false, false], [true, true]] {
            assert_eq!(overdue_ruling(true, [a, b], waited, true), (Some(a), "lot"));
            assert_eq!(overdue_ruling(true, [a, b], waited, false), (Some(b), "lot"));
            assert_eq!(overdue_ruling(false, [a, b], waited, true), (None, "unplayed"));
        }
    }
}
