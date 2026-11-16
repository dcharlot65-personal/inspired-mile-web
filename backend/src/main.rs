mod auth;
mod classroom;
mod config;
mod credits;
mod db;
mod error;
mod inventory;
mod marketplace;
mod migration;
mod multiplayer;
mod rate_limit;
mod referral;
mod seasons;
mod stats;
mod tournaments;
mod variants;

use std::sync::Arc;
use axum::{
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::get,
    Extension, Router,
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use config::Config;
use multiplayer::{RoomManager, MatchmakingQueue};

/// Run every request to its end, whether or not the client is still there.
///
/// Why: when a client goes away (a page navigates with a request in flight, a connection
/// drops), the server drops the handler's future wherever it is waiting. A handler dropped
/// between a statement and its commit is rolled back by sqlx, which is fine; but one
/// end-to-end run on this branch (2026-11-16) showed a sign-in whose session row could not
/// be seen by the next request, in the same second as Postgres logged "there is already a
/// transaction in progress". Reading sqlx 0.9.0's `PgTransactionManager::begin`, a future
/// dropped while `BEGIN` is awaited leaves the connection in a transaction that its
/// depth counter does not know about, so the rollback guard does nothing and the next
/// borrower's writes sit uncommitted. THAT CAUSE IS A READING OF THE CODE, NOT A
/// REPRODUCTION: 600 requests reset mid-flight did not strand a connection, with or
/// without this layer.
///
/// What this does regardless: the rest of the stack runs in its own task, so nothing above
/// it can cancel it part-way and a transaction that begins also commits or rolls back.
/// The cost is that work for a client that has left is finished rather than abandoned.
async fn run_to_completion(
    req: axum::http::Request<axum::body::Body>,
    next: middleware::Next,
) -> axum::response::Response {
    match tokio::spawn(next.run(req)).await {
        Ok(response) => response,
        Err(e) => {
            tracing::error!("request task failed: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, error::INTERNAL_MESSAGE).into_response()
        }
    }
}

#[tokio::main]
async fn main() {
    // Load .env if present
    dotenvy::dotenv().ok();

    // Initialize tracing with env filter
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let (config, config_warnings) = match Config::from_env() {
        Ok(loaded) => loaded,
        Err(e) => {
            eprintln!("FATAL: invalid configuration: {e}");
            std::process::exit(2);
        }
    };
    // Loud on purpose, and on stderr as well as the log: with RUST_LOG unset the log only
    // shows errors, and these must not be missed.
    for warning in &config_warnings {
        let bar = "!".repeat(72);
        eprintln!("\n{bar}\nWARNING: {warning}\n{bar}\n");
        tracing::error!("CONFIGURATION WARNING: {warning}");
    }
    if !config.email_mode.is_available() {
        tracing::warn!(
            "RESEND_API_KEY is not set: email sign-in is off (the email endpoints answer 503)"
        );
    }
    let auth_context = match auth::AuthContext::new(&config) {
        Ok(ctx) => Arc::new(ctx),
        Err(e) => {
            eprintln!("FATAL: {e}");
            std::process::exit(2);
        }
    };
    let pool = db::create_pool(&config.database_url, config.db_max_connections).await;
    db::run_migrations(&pool).await;

    tracing::info!("Database connected and migrations applied");

    let state = (pool.clone(), config.clone());

    // Multiplayer shared state
    let rooms = Arc::new(RoomManager::new());
    let queue = Arc::new(MatchmakingQueue::new());

    // Start tournament scheduler background task
    let scheduler_pool = pool.clone();
    let scheduler_rooms = rooms.clone();
    tokio::spawn(async move {
        tournaments::scheduler::run_scheduler(scheduler_pool, scheduler_rooms).await;
    });

    // Start room cleanup background task
    let cleanup_rooms = rooms.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            cleanup_rooms.cleanup_stale_rooms(std::time::Duration::from_secs(1800)).await;
        }
    });

    // Sweep expired sign-in challenges, old email codes, ended sessions and passkey-only
    // accounts that never played, in the background
    let purge_pool = pool.clone();
    let limiter = rate_limit::create_rate_limiter(config.rate_limit_per_minute);
    let purge_limiter = limiter.clone();
    let purge_days = config.unused_account_purge_days;
    let purge_every = std::time::Duration::from_secs(config.maintenance_interval_seconds);
    tokio::spawn(async move {
        loop {
            auth::purge_expired(&purge_pool).await;
            auth::purge_unused_accounts(&purge_pool, purge_days).await;
            purge_limiter.retain_recent();
            tokio::time::sleep(purge_every).await;
        }
    });

    // (The rate limiter, one allowance per client address, is created above.)

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(|| async { "ok" }))
        .nest("/auth", auth::router(auth_context))
        .nest("/stats", stats::public_router());

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .nest("/inventory", inventory::router())
        .nest("/variants", variants::router())
        .nest("/stats", stats::router())
        .nest("/migrate", migration::router())
        .nest("/multiplayer", multiplayer::router())
        .nest("/marketplace", marketplace::router())
        .nest("/tournaments", tournaments::router())
        .nest("/credits", credits::router())
        .nest("/seasons", seasons::router())
        .nest("/classroom", classroom::router())
        .nest("/referral", referral::router())
        .layer(Extension(rooms))
        .layer(Extension(queue))
        // Every protected request is checked against its server-side session row.
        .layer(middleware::from_fn_with_state(state.clone(), auth::auth_middleware));

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(
            config.cors_origin.parse().unwrap_or_else(|_| "http://localhost:4321".parse().unwrap()),
        ))
        .allow_credentials(true)
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ]);

    let trusted_proxies = Arc::new(config.trusted_proxies.clone());
    let app = Router::new()
        .nest("/api/v1", public_routes.merge(protected_routes))
        .layer(RequestBodyLimitLayer::new(1_048_576)) // 1MB max body
        .layer(middleware::from_fn(move |req: axum::http::Request<axum::body::Body>, next: middleware::Next| {
            let limiter = limiter.clone();
            let trusted = trusted_proxies.clone();
            async move {
                let peer = req
                    .extensions()
                    .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
                    .map(|info| info.0);
                // One allowance per IPv4 address or IPv6 /64; proxy headers are believed
                // only from a trusted proxy (auth/client_ip.rs).
                let client = auth::client_addr(req.headers(), peer, &trusted).limit_key();
                if limiter.check_key(&client).is_err() {
                    return (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
                }
                next.run(req).await
            }
        }))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        // Outermost: see `run_to_completion`.
        .layer(middleware::from_fn(run_to_completion))
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Inspired Mile API listening on {addr}");
    tracing::info!(
        "client addresses are taken from proxy headers only for these peers: {:?}",
        config.trusted_proxies
    );

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    // Connect info gives every limiter the socket peer: the client address itself unless
    // the peer is a trusted proxy.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .unwrap();
}
