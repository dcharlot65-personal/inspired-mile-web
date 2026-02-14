use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

/// A player waiting in the matchmaking queue.
pub struct QueueEntry {
    pub user_id: Uuid,
    pub username: String,
    pub tx: oneshot::Sender<MatchResult>,
}

/// Result sent back to a queued player when matched.
pub struct MatchResult {
    pub room_id: Uuid,
    pub opponent_username: String,
}

/// In-memory FIFO matchmaking queue.
pub struct MatchmakingQueue {
    queue: Mutex<Vec<QueueEntry>>,
}

impl MatchmakingQueue {
    pub fn new() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
        }
    }

    /// Add a player to the queue. Returns a oneshot receiver that will fire when matched.
    pub async fn enqueue(&self, user_id: Uuid, username: String) -> oneshot::Receiver<MatchResult> {
        let (tx, rx) = oneshot::channel();
        let mut q = self.queue.lock().await;

        // Check if there's already someone waiting
        if let Some(opponent) = q.pop() {
            // We have a match!
            let room_id = Uuid::new_v4();

            // Notify the waiting player
            let _ = opponent.tx.send(MatchResult {
                room_id,
                opponent_username: username.clone(),
            });

            // Notify the new player immediately via the receiver
            let (tx2, rx2) = oneshot::channel();
            let _ = tx2.send(MatchResult {
                room_id,
                opponent_username: opponent.username,
            });

            // Drop the original tx (unused) and return the matched rx
            drop(tx);
            return rx2;
        }

        // No one waiting — queue up
        q.push(QueueEntry { user_id, username, tx });
        rx
    }

    /// Remove a player from the queue (e.g., on disconnect).
    pub async fn dequeue(&self, user_id: Uuid) {
        let mut q = self.queue.lock().await;
        q.retain(|e| e.user_id != user_id);
    }

    /// Get the current queue size.
    pub async fn size(&self) -> usize {
        self.queue.lock().await.len()
    }
}
