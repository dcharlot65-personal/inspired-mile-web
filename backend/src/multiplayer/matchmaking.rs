//! The quick-match queue: first come, first paired.
//!
//! A player who asks for a match either meets someone already waiting, or waits. When two
//! meet, one room is made with a seat held for each, and both are told its id.
//!
//! The queue knows nothing of sessions. A waiting player may have signed out since they asked
//! (here, or on every device elsewhere): `Enqueued::Matched` names the partner and the session
//! they asked with, and the requester's handler checks it before answering (handlers.rs
//! `join_queue`). A waiting player whose request has ended (their client went: closed tab,
//! page left, connection lost) is skipped here; with every request run to its end
//! (request_task.rs), the handler ends it itself when its client goes.
//!
//! A limit is the business of the player who reached it. The requester is checked before
//! anything else. A waiting player who has since reached a limit (they opened rooms while
//! they waited) is told so and leaves the queue; the requester goes on to the next player,
//! or waits.
//!
//! **Quick match is switched off** while `quick_match_open()` is false: online duels are then
//! played by private room only, for everyone (owner decision D-02, 2026-11-19). The switch is
//! `quickMatch` in `backend/data/online-play.json`, the one file the server and the page both read;
//! `join_queue` refuses at once (403, `QUICK_MATCH_CLOSED` in handlers.rs), and the page hides
//! quick match and says why. Private rooms are not touched by it.

use std::sync::LazyLock;

use serde::Deserialize;
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use super::game_room::{Refusal, RoomError, RoomManager};

/// Who may meet whom online, as `backend/data/online-play.json` says. Compiled in: the API is
/// rebuilt when it changes.
#[derive(Deserialize)]
struct OnlinePlay {
    #[serde(rename = "quickMatch")]
    quick_match: bool,
}
const ONLINE_PLAY_JSON: &str = include_str!("../../data/online-play.json");
static ONLINE_PLAY: LazyLock<OnlinePlay> =
    LazyLock::new(|| serde_json::from_str(ONLINE_PLAY_JSON).expect("backend/data/online-play.json says whether quick match is open"));

/// Whether a player may ask for a quick match. False at launch (D-02): before it is turned on
/// again, the matchmaker must pair adult accounts only, which it does not do yet (it never reads
/// the age tier), and reports must be read every day.
pub fn quick_match_open() -> bool {
    ONLINE_PLAY.quick_match
}

/// What a waiting player is told: the room they were paired into, or why they cannot be.
pub type Pairing = Result<Uuid, RoomError>;

struct QueueEntry {
    user_id: Uuid,
    /// The session they asked with.
    sid: Uuid,
    username: String,
    /// The network they asked from (`handlers::origin_of`).
    origin: String,
    /// Fires when this player is paired, or refused. Dropped if they are removed.
    tx: oneshot::Sender<Pairing>,
}

/// The player a requester was paired with, and the session they asked with.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Partner {
    pub user_id: Uuid,
    pub sid: Uuid,
}

/// What asking for a match gave.
pub enum Enqueued {
    /// Someone was waiting: the room is ready, with a seat for each, and they have been told.
    /// They asked up to a wait ago: whether their session is still live is the caller's to
    /// check (the queue holds no database).
    Matched { room_id: Uuid, partner: Partner },
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
    /// `sid` is the session they ask with, `origin` the network they ask from
    /// (`handlers::origin_of`). A player who already holds as many rooms as they may (or whose
    /// network does) is refused at once.
    pub async fn enqueue(&self, user_id: Uuid, sid: Uuid, username: String, origin: String, rooms: &RoomManager) -> Result<Enqueued, RoomError> {
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
            let partner = Partner { user_id: waiting.user_id, sid: waiting.sid };
            if waiting.tx.send(Ok(room_id)).is_ok() {
                return Ok(Enqueued::Matched { room_id, partner });
            }
            // They left between the check and the send: the room was for nobody.
            rooms.remove_room(room_id).await;
        }

        let (tx, rx) = oneshot::channel();
        q.push(QueueEntry { user_id, sid, username, origin, tx });
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

    #[test]
    fn the_switch_is_read_from_the_file_the_page_reads() {
        let file: serde_json::Value = serde_json::from_str(ONLINE_PLAY_JSON).unwrap();
        assert_eq!(Some(quick_match_open()), file["quickMatch"].as_bool());
        // A file that does not say is not read as either answer.
        assert!(serde_json::from_str::<OnlinePlay>(r#"{"about": "no switch"}"#).is_err());
        assert!(serde_json::from_str::<OnlinePlay>(r#"{"quickMatch": "no"}"#).is_err());
    }

    /// A session for a request; the queue only passes it on.
    fn sid() -> Uuid {
        Uuid::new_v4()
    }

    #[tokio::test]
    async fn two_players_are_paired_into_one_room_with_both_seats_held() {
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let ann_sid = sid();
        let Enqueued::Waiting(mut rx) = queue.enqueue(a, ann_sid, "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("the first player waits")
        };
        assert_eq!(queue.size().await, 1);
        let Enqueued::Matched { room_id, partner } = queue.enqueue(b, sid(), "bob".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("the second player is matched")
        };
        // The requester is told who they were paired with, and the session that player asked
        // with, so the handler can check it is still live.
        assert_eq!(partner, Partner { user_id: a, sid: ann_sid });
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
        let Enqueued::Waiting(mut first) = queue.enqueue(a, sid(), "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else { panic!() };
        let Enqueued::Waiting(second) = queue.enqueue(a, sid(), "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("a player is not matched with themselves")
        };
        assert!(first.try_recv().is_err());
        assert_eq!(queue.size().await, 1);
        // Their request ends without a word (the connection went): they are skipped.
        drop(second);
        let Enqueued::Waiting(mut rx_b) = queue.enqueue(b, sid(), "bob".into(), "203.0.113.1".into(), &rooms).await.unwrap() else {
            panic!("nobody real was waiting")
        };
        assert!(rooms.rooms_of(a).await.is_empty(), "no room was left behind for the player who went");
        // Bob leaves the queue; Cy then waits rather than being paired with him.
        queue.dequeue(b).await;
        assert!(rx_b.try_recv().is_err());
        assert!(matches!(queue.enqueue(c, sid(), "cy".into(), "203.0.113.1".into(), &rooms).await.unwrap(), Enqueued::Waiting(_)));
    }
    /// Ann holds two rooms, asks for a match and waits; while she waits she opens a third.
    async fn ann_waits_holding_the_limit(rooms: &RoomManager, queue: &MatchmakingQueue, ann: Uuid, net: &str) -> oneshot::Receiver<Pairing> {
        use crate::multiplayer::game_room::MAX_ROOMS_PER_USER;
        for _ in 0..MAX_ROOMS_PER_USER - 1 {
            rooms.create_room(&[(ann, "ann".into())], &[net.to_string()]).await.unwrap();
        }
        let Enqueued::Waiting(rx) = queue.enqueue(ann, sid(), "ann".into(), net.into(), rooms).await.unwrap() else {
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
        let cy_asks = queue.enqueue(cy, sid(), "cy".into(), "198.51.100.2".into(), &rooms).await;
        assert!(matches!(cy_asks, Ok(Enqueued::Waiting(_))), "Cy was refused for Ann's rooms");
        assert_eq!(ann_rx.try_recv(), Ok(Err(RoomError::TooManyRooms)));
        assert!(rooms.rooms_of(cy).await.is_empty());
        // And the next player is paired with Cy.
        let Ok(Enqueued::Waiting(cy_rx)) = cy_asks else { unreachable!() };
        let Enqueued::Matched { room_id: room, .. } = queue.enqueue(dee, sid(), "dee".into(), "198.51.100.3".into(), &rooms).await.unwrap() else {
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
        let Enqueued::Waiting(mut ann_rx) = queue.enqueue(ann, sid(), "ann".into(), school.into(), &rooms).await.unwrap() else { panic!() };
        // While Ann waits, her network fills up with other players' rooms.
        for _ in 0..MAX_ROOMS_PER_ADDRESS {
            rooms.create_room(&[(Uuid::new_v4(), "pupil".into())], &[school.to_string()]).await.unwrap();
        }
        let cy_asks = queue.enqueue(cy, sid(), "cy".into(), "198.51.100.2".into(), &rooms).await;
        assert!(matches!(cy_asks, Ok(Enqueued::Waiting(_))), "Cy was refused for Ann's network");
        assert_eq!(ann_rx.try_recv(), Ok(Err(RoomError::TooManyFromAddress)));
    }

    #[tokio::test]
    async fn a_requester_over_a_limit_is_refused_and_the_waiting_player_keeps_their_place() {
        let (rooms, queue) = (RoomManager::new(), MatchmakingQueue::new());
        let (ann, bob, cy) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let Enqueued::Waiting(mut ann_rx) = queue.enqueue(ann, sid(), "ann".into(), "203.0.113.1".into(), &rooms).await.unwrap() else { panic!() };
        // Bob holds as many rooms as he may: he is refused, and Ann still waits, first in line.
        for _ in 0..crate::multiplayer::game_room::MAX_ROOMS_PER_USER {
            rooms.create_room(&[(bob, "bob".into())], &["198.51.100.7".to_string()]).await.unwrap();
        }
        let refused = queue.enqueue(bob, sid(), "bob".into(), "198.51.100.7".into(), &rooms).await;
        assert!(matches!(refused, Err(RoomError::TooManyRooms)));
        assert!(ann_rx.try_recv().is_err(), "Ann is neither paired nor refused");
        assert_eq!(queue.size().await, 1);
        let Enqueued::Matched { room_id: room, .. } = queue.enqueue(cy, sid(), "cy".into(), "192.0.2.4".into(), &rooms).await.unwrap() else { panic!() };
        assert_eq!(ann_rx.await, Ok(Ok(room)));
    }
}
