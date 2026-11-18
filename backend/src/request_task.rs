//! Every request runs to its end in a task of its own; a handler that waits on its client can
//! still learn that the client has gone (`ClientGone`).
//!
//! Why run to the end: when a client goes away (a page navigates with a request in flight, a
//! connection drops), the server drops the handler's future wherever it is waiting. A handler
//! dropped between a statement and its commit is rolled back by sqlx, which is fine; but one
//! end-to-end run of fix/backend-security (2026-11-16) showed a sign-in whose session row could
//! not be seen by the next request, in the same second as Postgres logged "there is already a
//! transaction in progress". Reading sqlx 0.9.0's `PgTransactionManager::begin`, a future
//! dropped while `BEGIN` is awaited leaves the connection in a transaction that its depth
//! counter does not know about, so the rollback guard does nothing and the next borrower's
//! writes sit uncommitted. THAT CAUSE IS A READING OF THE CODE, NOT A REPRODUCTION: 600
//! requests reset mid-flight did not strand a connection, with or without this layer.
//!
//! What `run_to_completion` does regardless: the rest of the stack runs in its own task, so
//! nothing above it can cancel it part-way and a transaction that begins also commits or rolls
//! back. The cost is that work for a client that has left is finished rather than abandoned.
//!
//! That cost is wrong for a request whose work IS the waiting: a quick-match request holds its
//! player's place in the queue for as long as it waits (multiplayer/matchmaking.rs skips a
//! waiting player whose request has ended). Run to its end, a request whose client had gone
//! kept that place for the whole wait, and the next player was paired with nobody (the
//! integration checker's probe P1, 2026-11-17). So the layer also hands every request a
//! `ClientGone`, which resolves when the client has gone; a handler that waits on its client
//! selects on it and gives up. Nothing that holds a transaction may do that.

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use tokio::sync::watch;

/// Resolves when the client of a request has gone: the connection closed before the answer
/// was sent. Put in every request's extensions by `run_to_completion`.
#[derive(Clone)]
pub struct ClientGone(watch::Receiver<()>);

/// Held for as long as the client waits for its answer. Dropping it tells `ClientGone`.
pub struct ClientPresent(#[allow(dead_code)] watch::Sender<()>);

impl ClientGone {
    /// A signal, and the guard whose dropping fires it.
    pub fn new() -> (ClientPresent, ClientGone) {
        let (present, gone) = watch::channel(());
        (ClientPresent(present), ClientGone(gone))
    }

    /// Wait until the client has gone. Never resolves while it is still there.
    pub async fn wait(&self) {
        let mut gone = self.0.clone();
        // Nothing is ever sent on the channel: `changed` returns an error once the guard is
        // dropped, and only then.
        while gone.changed().await.is_ok() {}
    }
}

/// Run every request to its end, whether or not the client is still there, and tell it when
/// the client has gone (see the top of this file). The outermost layer.
pub async fn run_to_completion(mut req: Request<Body>, next: Next) -> Response {
    let (present, gone) = ClientGone::new();
    req.extensions_mut().insert(gone);
    // This future is what the server drops when the client goes; `present` goes with it.
    let answer = tokio::spawn(next.run(req)).await;
    drop(present);
    match answer {
        Ok(response) => response,
        Err(e) => {
            tracing::error!("request task failed: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, crate::error::INTERNAL_MESSAGE).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{middleware, routing::get, Extension, Router};
    use std::time::Duration;
    use tokio::io::AsyncWriteExt;
    use tokio::sync::mpsc;

    /// The real server, with the layer, on a port of its own. Each handler reports what
    /// happened to it on `seen`.
    async fn serve(seen: mpsc::UnboundedSender<&'static str>) -> std::net::SocketAddr {
        let waits = seen.clone();
        let works = seen;
        let app = Router::new()
            // Waits on its client, as the quick-match request does.
            .route(
                "/wait",
                get(move |Extension(gone): Extension<ClientGone>| {
                    let waits = waits.clone();
                    async move {
                        tokio::select! {
                            () = gone.wait() => { let _ = waits.send("gone"); }
                            () = tokio::time::sleep(Duration::from_secs(10)) => { let _ = waits.send("waited it out"); }
                        }
                        "done"
                    }
                }),
            )
            // Work that must finish whether or not anyone reads the answer.
            .route(
                "/work",
                get(move || {
                    let works = works.clone();
                    async move {
                        tokio::time::sleep(Duration::from_millis(400)).await;
                        let _ = works.send("finished");
                        "done"
                    }
                }),
            )
            .layer(middleware::from_fn(run_to_completion));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        addr
    }

    /// Send a request and hang up `after` without reading the answer.
    async fn ask_and_leave(addr: std::net::SocketAddr, path: &str, after: Duration) {
        let mut conn = tokio::net::TcpStream::connect(addr).await.unwrap();
        conn.write_all(format!("GET {path} HTTP/1.1\r\nHost: test\r\n\r\n").as_bytes()).await.unwrap();
        tokio::time::sleep(after).await;
        drop(conn);
    }

    async fn next(seen: &mut mpsc::UnboundedReceiver<&'static str>) -> Option<&'static str> {
        tokio::time::timeout(Duration::from_secs(5), seen.recv()).await.ok().flatten()
    }

    #[tokio::test]
    async fn a_handler_that_waits_on_its_client_learns_that_it_has_gone() {
        let (tx, mut seen) = mpsc::unbounded_channel();
        let addr = serve(tx).await;
        ask_and_leave(addr, "/wait", Duration::from_millis(200)).await;
        assert_eq!(next(&mut seen).await, Some("gone"), "the handler was not told that its client had gone");
    }

    #[tokio::test]
    async fn work_goes_on_to_its_end_after_the_client_has_gone() {
        let (tx, mut seen) = mpsc::unbounded_channel();
        let addr = serve(tx).await;
        ask_and_leave(addr, "/work", Duration::from_millis(50)).await;
        assert_eq!(next(&mut seen).await, Some("finished"), "the work was abandoned with its client");
    }

    #[tokio::test]
    async fn a_client_that_stays_is_not_taken_for_gone() {
        let (present, gone) = ClientGone::new();
        let waited = tokio::time::timeout(Duration::from_millis(200), gone.wait()).await;
        assert!(waited.is_err(), "ClientGone fired while the client was there");
        drop(present);
        tokio::time::timeout(Duration::from_millis(200), gone.wait()).await.expect("ClientGone fires once the guard is dropped");
    }
}
