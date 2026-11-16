//! Operator notices: the few log lines an operator must see whatever `RUST_LOG` says.
//!
//! The log filter (`main.rs`) is `RUST_LOG` with one directive added after it:
//! `inspired_mile_api::notice=info`. With `RUST_LOG` unset the rest of the log shows errors
//! only, and with `RUST_LOG=off` nothing else at all, but a line logged with
//! `target: notice::TARGET` at info or above is always written. (A directive for the same
//! target in `RUST_LOG` is replaced by this one, so it cannot hide the notices either.)
//!
//! Why a directive and not a second filter beside `RUST_LOG`: a per-layer `Or` filter was
//! tried first, and tracing-subscriber 0.3.23 then dropped some notices at random. When the
//! registry turns an event away, the per-layer filter's thread-local "disabled" bit is left
//! set, and the next event from a callsite cached as always-enabled (a notice) reads it and
//! is dropped. The end-to-end test that looks for the start-up "listening" line caught it.
//!
//! Only lines an operator acts on belong here, and each must be bounded: said once at
//! start-up, or rate-limited by the code that logs it (see `client_ip::note_ignored_header`).
//! Today they are: which peers are trusted as proxies, where the API listens, a forwarding
//! header that was ignored because its peer is not a trusted proxy, and a site-wide ceiling
//! being hit (`auth/passkeys.rs`).

use tracing_subscriber::filter::{Directive, EnvFilter};

/// The tracing target of operator notices.
pub const TARGET: &str = "inspired_mile_api::notice";

/// A filter with operator notices turned on, whatever it said about them.
fn with_notices(filter: EnvFilter) -> EnvFilter {
    let directive: Directive = format!("{TARGET}=info").parse().expect("a valid directive");
    filter.add_directive(directive)
}

/// The log filter: what `RUST_LOG` asks for, with operator notices on whatever it asks for.
pub fn log_filter() -> EnvFilter {
    with_notices(EnvFilter::from_default_env())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tracing::Level;
    use tracing_subscriber::layer::SubscriberExt;

    /// Which levels of the notice target, and of the rest of the crate, a filter built from
    /// this RUST_LOG lets through. Checked on a real subscriber with a counting layer.
    fn written(rust_log: &str) -> (bool, bool) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Arc;
        struct Count(Arc<AtomicUsize>, Arc<AtomicUsize>);
        impl<S: tracing::Subscriber> tracing_subscriber::Layer<S> for Count {
            fn on_event(&self, event: &tracing::Event<'_>, _: tracing_subscriber::layer::Context<'_, S>) {
                if event.metadata().target() == TARGET {
                    self.0.fetch_add(1, Ordering::SeqCst);
                } else {
                    self.1.fetch_add(1, Ordering::SeqCst);
                }
            }
        }
        let (notices, others) = (Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0)));
        let filter = with_notices(EnvFilter::new(rust_log));
        let subscriber = tracing_subscriber::registry()
            .with(filter)
            .with(Count(notices.clone(), others.clone()));
        tracing::subscriber::with_default(subscriber, || {
            // A rejected event first: the case that dropped notices with a per-layer filter.
            tracing::event!(target: "inspired_mile_api::other", Level::INFO, "ordinary line");
            tracing::event!(target: "inspired_mile_api::notice", Level::INFO, "notice line");
            tracing::event!(target: "inspired_mile_api::notice", Level::INFO, "another notice line");
        });
        (notices.load(Ordering::SeqCst) == 2, others.load(Ordering::SeqCst) == 1)
    }

    #[test]
    fn notices_are_written_whatever_rust_log_says() {
        for rust_log in ["", "error", "off", "warn", "inspired_mile_api=off", "inspired_mile_api::notice=off"] {
            let (notices, _) = written(rust_log);
            assert!(notices, "RUST_LOG={rust_log:?}: both notices must be written");
        }
    }

    #[test]
    fn the_rest_of_the_log_still_follows_rust_log() {
        assert!(!written("").1, "unset: errors only");
        assert!(!written("off").1);
        assert!(!written("error").1);
        assert!(written("info").1);
        assert!(written("inspired_mile_api=info").1);
    }
}
