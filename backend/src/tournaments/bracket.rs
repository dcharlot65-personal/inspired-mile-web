use uuid::Uuid;

/// Generate single-elimination bracket matches from a list of player IDs.
/// Returns (round, match_order, player1, player2) tuples.
///
/// The bracket is the next power of two; the first players in the list (the earliest to
/// register) take the byes, one per match, and the rest are paired in order. No first-round match
/// is empty: until 2026-11-19 five players made a match with nobody in it, and its slot in round
/// two waited for ever.
pub fn generate_single_elimination(
    players: &[Uuid],
) -> Vec<(i32, i32, Option<Uuid>, Option<Uuid>)> {
    let n = players.len();
    if n < 2 {
        return vec![];
    }
    let byes = n.next_power_of_two() - n;
    let mut matches = Vec::new();
    let mut order: i32 = 0;
    for p in &players[..byes] {
        order += 1;
        matches.push((1, order, Some(*p), None));
    }
    for pair in players[byes..].chunks(2) {
        order += 1;
        matches.push((1, order, Some(pair[0]), pair.get(1).copied()));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bracket_has_no_empty_match_and_one_slot_per_player() {
        for n in 2usize..=33 {
            let players: Vec<Uuid> = (0..n).map(|_| Uuid::new_v4()).collect();
            let matches = generate_single_elimination(&players);
            assert_eq!(matches.len(), n.next_power_of_two() / 2, "{n} players");
            assert!(matches.iter().all(|(_, _, a, _)| a.is_some()), "{n} players: an empty match");
            let seated: Vec<Uuid> = matches.iter().flat_map(|(_, _, a, b)| [*a, *b]).flatten().collect();
            assert_eq!(seated.len(), n, "{n} players: everyone has one slot");
            let orders: Vec<i32> = matches.iter().map(|m| m.1).collect();
            assert_eq!(orders, (1..=matches.len() as i32).collect::<Vec<_>>());
        }
    }
}
