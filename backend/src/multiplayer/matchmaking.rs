//! The quick-match queue: first come, first paired.
//!
//! A player who asks for a match either meets someone already waiting, or waits. When two
//! meet, one room is made with a seat held for each, and both are told its id.

use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use super::game_room::{RoomError, RoomManager};

struct QueueEntry {
    user_id: Uuid,
    username: String,
    /// The network they asked from (`game_room::address_key`).
    origin: String,
    /// Fires with the room's id when this player is paired. Dropped if they are removed.
    tx: oneshot::Sender<Uuid>,
}

/// What asking for a match gave.
pub enum Enqueued {
    /// Someone was waiting: the room is ready.
    Matched(Uuid),
    /// Nobody was waiting. The receiver fires when someone arrives, and fails if this
    /// player leaves the queue or asks again from somewhere else.
    Waiting(oneshot::Receiver<Uuid>),
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
                .create_room(
                    &[(waiting.user_id, waiting.username.clone()), (user_id, username.clone())],
                    &[waiting.origin.clone(), origin.clone()],
                )
                .await
            {
                Ok(id) => id,
                Err(refusal) => {
                    // The one who waited keeps their place.
                    q.insert(0, waiting);
                    return Err(refusal);
                }
            };
            if waiting.tx.send(room_id).is_ok() {
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
        assert_eq!(rx.try_recv(), Ok(room_id));
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
}
