use uuid::Uuid;

/// Generate single-elimination bracket matches from a list of player IDs.
/// Returns (round, match_order, player1, player2) tuples.
/// Handles byes when player count is not a power of 2.
pub fn generate_single_elimination(
    players: &[Uuid],
) -> Vec<(i32, i32, Option<Uuid>, Option<Uuid>)> {
    let n = players.len();
    if n < 2 {
        return vec![];
    }

    // Find next power of 2
    let bracket_size = n.next_power_of_two();
    let byes = bracket_size - n;

    let mut matches = Vec::new();
    let mut match_order: i32 = 0;

    // First round — pair up, assign byes to top seeds
    for i in (0..bracket_size).step_by(2) {
        let p1 = if i < n { Some(players[i]) } else { None };
        let p2 = if i + 1 < n { Some(players[i + 1]) } else { None };
        match_order += 1;
        matches.push((1, match_order, p1, p2));
    }

    matches
}

/// Generate round-robin schedule.
/// Returns (round, match_order, player1, player2) tuples.
pub fn generate_round_robin(
    players: &[Uuid],
) -> Vec<(i32, i32, Option<Uuid>, Option<Uuid>)> {
    let n = players.len();
    if n < 2 {
        return vec![];
    }

    let mut matches = Vec::new();
    let mut round: i32 = 1;
    let mut match_order: i32 = 0;

    for i in 0..n {
        for j in (i + 1)..n {
            match_order += 1;
            matches.push((round, match_order, Some(players[i]), Some(players[j])));

            // Advance round every n/2 matches
            if match_order % (n as i32 / 2).max(1) == 0 {
                round += 1;
            }
        }
    }

    matches
}
