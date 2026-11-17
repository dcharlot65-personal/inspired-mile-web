//! The quick-match queue: first come, first paired.
//!
//! A player who asks for a match either meets someone already waiting, or waits. When two
//! meet, one room is made with a seat held for each, and both are told its id.
//!
//! A limit is the business of the player who reached it. The requester is checked before
//! anything else. A waiting player who has since reached a limit (they opened rooms while
//! they waited) is told so and leaves the queue; the requester goes on to the next player,
//! or waits.

use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use super::game_room::{Refusal, RoomError, RoomManager};

/// What a waiting player is told: the room they were paired into, or why they cannot be.
pub type Pairing = Result<Uuid, RoomError>;

struct QueueEntry {
    user_id: Uuid,
    username: String,
    /// The network they asked from (`game_room::address_key`).
    origin: String,
    /// Fires when this player is paired, or refused. Dropped if they are removed.
    tx: oneshot::Sender<Pairing>,
}

/// What asking for a match gave.
pub enum Enqueued {
    /// Someone was waiting: the room is ready.
    Matched(Uuid),
    /// Nobody was waiting. The receiver fires when someone arrives (or with the limit this
    /// player has reached by then), and fails if this player leaves the queue or asks again
    /// from somewhere else.
    Waiting(oneshot::Receiver<Pairing>),
}

/// In-memory FIFO matchmaking queue.
pub struct MatchmakingQueue {
    queue: Mutex<Vec<QueueEntry>>,
}

impl MatchmakingQueue {
    pub fn new() -> Self {
        Self { queue: Mutex::new(Vec::new()) }
    }

    /// Pair this player with the longest-waiting other player, or put them in the queue.
    /// `origin` is the network they ask from (`game_room::address_key`). A player who
    /// already holds as many rooms as they may (or whose network does) is refused at once.
    pub async fn enqueue(&self, user_id: Uuid, username: String, origin: String, rooms: &RoomManager) -> Result<Enqueued, RoomError> {
        rooms.room_limit(user_id, &origin).await?;
        let mut q = self.queue.lock().await;
        // One place in the queue per player: asking again replaces the earlier request,
        // so a player with two tabs open is never paired with themselves.
        q.retain(|e| e.user_id != user_id);

        while !q.is_empty() {
            let waiting = q.remove(0);
            // Their request ended (timed out, cancelled, connection gone): not a player.
            if waiting.tx.is_closed() {
                continue;
            }
            let room_id = match rooms
                .open_room(
                    &[(waiting.user_id, waiting.username.clone()), (user_id, username.clone())],
                    &[waiting.origin.clone(), origin.clone()],
                )
                .await
            {
                Ok(id) => id,
                Err(Refusal::ServerFull) => {
                    // Nobody's limit: the one who waited keeps their place.
                    q.insert(0, waiting);
                    return Err(RoomError::ServerFull);
                }
                Err(Refusal::Over(over)) => {
                    let theirs = over.first().cloned().flatten();
                    let mine = over.get(1).cloned().flatten();
                    match (theirs, mine) {
                        // The waiting player has reached a limit since they asked: they are told
                        // why, and leave the queue. It is not the requester's to answer for:
                        // the requester goes on to the next player, or waits.
                        (Some(why), None) => {
                            let _ = waiting.tx.send(Err(why));
                            continue;
                        }
                        // Both (one network over its limit, say): both are told.
                        (Some(why), Some(mine)) => {
                            let _ = waiting.tx.send(Err(why));
                            return Err(mine);
                        }
                        // Only the requester: the one who waited keeps their place.
                        (None, Some(mine)) => {
                            q.insert(0, waiting);
                            return Err(mine);
                        }
                        (None, None) => {
                            q.insert(0, waiting);
                            return Err(Refusal::Over(over).error());
                        }
                    }
                }
            };
            if waiting.tx.send(Ok(room_id)).is_ok() {
                return Ok(Enqueued::Matched(room_id));
            }
            // They left between the check and the send: the room was for nobody.
            rooms.remove_room(room_id).await;
        }

        let (tx, rx) = oneshot::channel();
        q.push(QueueEntry { user_id, username, origin, tx });
        Ok(Enqueued::Waiting(rx))
    }

    /// Remove a player from the queue (they gave up, or their wait timed out).
    pub async fn dequeue(&self, user_id: Uuid) {
        let mut q = self.queue.lock().await;
        q.retain(|e| e.user_id != user_id);
    }

    /// Players waiting right now, not counting requests that have ended.
    pub async fn size(&self) -> usize {
        self.queue.lock().await.iter().filter(|e| !e.tx.is_closed()).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multiplayer::game_room::RoomState;

    #[tokio::test]
    async fn two_players_are_paired_into_one_room_with_both_seats_held() {
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let Enqueued::Waiting(mut rx) = queue.enqueue(a, "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("the first player waits")
        };
        assert_eq!(queue.size().await, 1);
        let Enqueued::Matched(room_id) = queue.enqueue(b, "bob".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("the second player is matched")
        };
        // Both are told the same room, and it exists with a seat for each.
        assert_eq!(rx.try_recv(), Ok(Ok(room_id)));
        assert_eq!(queue.size().await, 0);
        assert_eq!(rooms.rooms_of(a).await, vec![(room_id, RoomState::Waiting, 2)]);
        assert_eq!(rooms.rooms_of(b).await, vec![(room_id, RoomState::Waiting, 2)]);
    }

    #[tokio::test]
    async fn a_player_is_never_paired_with_themselves_or_with_someone_who_left() {
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        // The same player asks twice: the first request is cancelled, and they still wait.
        let Enqueued::Waiting(mut first) = queue.enqueue(a, "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else { panic!() };
        let Enqueued::Waiting(second) = queue.enqueue(a, "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("a player is not matched with themselves")
        };
        assert!(first.try_recv().is_err());
        assert_eq!(queue.size().await, 1);
        // Their request ends without a word (the connection went): they are skipped.
        drop(second);
        let Enqueued::Waiting(mut rx_b) = queue.enqueue(b, "bob".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("nobody real was waiting")
        };
        assert!(rooms.rooms_of(a).await.is_empty(), "no room was left behind for the player who went");
        // Bob leaves the queue; Cy then waits rather than being paired with him.
        queue.dequeue(b).await;
        assert!(rx_b.try_recv().is_err());
        assert!(matches!(queue.enqueue(c, "cy".into(), "203.0.113.1".into(), &rooms).await.unwrap(), Enqueued::Waiting(_)));
    }
    /// Ann holds two rooms, asks for a match and waits; while she waits she opens a third.
    async fn ann_waits_holding_the_limit(rooms: &RoomManager, queue: &MatchmakingQueue, ann: Uuid, net: &str) -> oneshot::Receiver<Pairing> {
        use crate::multiplayer::game_room::MAX_ROOMS_PER_USER;
        for _ in 0..MAX_ROOMS_PER_USER - 1 {
            rooms.create_room(&[(ann, "ann".into())], &[net.to_string()]).await.unwrap();
        }
        let Enqueued::Waiting(rx) = queue.enqueue(ann, "ann".into(), net.into(), rooms).await.unwrap() else {
            panic!("nobody else is waiting")
        };
        rooms.create_room(&[(ann, "ann".into())], &[net.to_string()]).await.unwrap();
        rx
    }

    #[tokio::test]
    async fn a_waiting_player_who_reaches_a_limit_is_told_and_does_not_block_or_blame_the_next() {
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (ann, cy, dee) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let mut ann_rx = ann_waits_holding_the_limit(&rooms, &queue, ann, "203.0.113.1").await;
        // Cy holds no room. He is not refused for Ann's rooms: he waits, and Ann is told why
        // she was not paired.
        let cy_asks = queue.enqueue(cy, "cy".into(), "198.51.100.2".into(), &rooms).await;
        assert!(matches!(cy_asks, Ok(Enqueued::Waiting(_))), "Cy was refused for Ann's rooms");
        assert_eq!(ann_rx.try_recv(), Ok(Err(RoomError::TooManyRooms)));
        assert!(rooms.rooms_of(cy).await.is_empty());
        // And the next player is paired with Cy.
        let Ok(Enqueued::Waiting(cy_rx)) = cy_asks else { unreachable!() };
        let Enqueued::Matched(room) = queue.enqueue(dee, "dee".into(), "198.51.100.3".into(), &rooms).await.unwrap() else {
            panic!("Dee is paired with Cy")
        };
        assert_eq!(cy_rx.await, Ok(Ok(room)));
    }

    #[tokio::test]
    async fn a_waiting_player_whose_network_reaches_its_limit_is_told_and_the_next_is_not_blamed() {
        use crate::multiplayer::game_room::MAX_ROOMS_PER_ADDRESS;
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (ann, cy) = (Uuid::new_v4(), Uuid::new_v4());
        let school = "203.0.113.9";
        let Enqueued::Waiting(mut ann_rx) = queue.enqueue(ann, "ann".into(), school.into(), &rooms).await.unwrap() else { panic!() };
        // While Ann waits, her network fills up with other players' rooms.
        for _ in 0..MAX_ROOMS_PER_ADDRESS {
            rooms.create_room(&[(Uuid::new_v4(), "pupil".into())], &[school.to_string()]).await.unwrap();
        }
        let cy_asks = queue.enqueue(cy, "cy".into(), "198.51.100.2".into(), &rooms).await;
        assert!(matches!(cy_asks, Ok(Enqueued::Waiting(_))), "Cy was refused for Ann's network");
        assert_eq!(ann_rx.try_recv(), Ok(Err(RoomError::TooManyFromAddress)));
    }

    #[tokio::test]
    async fn a_requester_over_a_limit_is_refused_and_the_waiting_player_keeps_their_place() {
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (ann, bob, cy) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let Enqueued::Waiting(mut ann_rx) = queue.enqueue(ann, "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else { panic!() };
        // Bob holds as many rooms as he may: he is refused, and Ann still waits, first in line.
        for _ in 0..crate::multiplayer::game_room::MAX_ROOMS_PER_USER {
            rooms.create_room(&[(bob, "bob".into())], &["198.51.100.7".to_string()]).await.unwrap();
        }
        let refused = queue.enqueue(bob, "bob".into(), "198.51.100.7".into(), &rooms).await;
        assert!(matches!(refused, Err(RoomError::TooManyRooms)));
        assert!(ann_rx.try_recv().is_err(), "Ann is neither paired nor refused");
        assert_eq!(queue.size().await, 1);
        let Enqueued::Matched(room) = queue.enqueue(cy, "cy".into(), "192.0.2.4".into(), &rooms).await.unwrap() else { panic!() };
        assert_eq!(ann_rx.await, Ok(Ok(room)));
    }
}
