mod auth;
mod classroom;
mod config;
mod credits;
mod db;
mod digicard;
mod error;
mod inventory;
mod ledger;
mod marketplace;
mod migration;
mod multiplayer;
mod notice;
mod rate_limit;
mod referral;
mod request_task;
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

use config::Config;
use multiplayer::{RoomManager, MatchmakingQueue};

#[tokio::main]
async fn main() {
    // Load .env if present
    dotenvy::dotenv().ok();

    // The log: what RUST_LOG asks for (errors only when it is unset), plus the operator
    // notices of `notice.rs`, which are written whatever RUST_LOG says. Colour only on a
    // terminal: under launchd the log is a file, and an operator greps it for the notices.
    tracing_subscriber::fmt()
        .with_env_filter(notice::log_filter())
        .with_ansi(notice::colour_wanted())
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

    // Multiplayer shared state. Every room hands its finished match to the recorder, which
    // stores it (the leaderboard, rankings and tournament results come from nothing else).
    // A tournament room's report that a player waited for an absent opponent goes the same way.
    let (record_tx, record_rx) = tokio::sync::mpsc::unbounded_channel();
    let mut timing = multiplayer::game_room::Timing::default();
    if let Some(seconds) = config.tournament_arrival_seconds {
        // Only ever shorter than the 240 s (for the tests): the room takes the smaller.
        timing.tournament_arrival = std::time::Duration::from_secs(seconds);
    }
    let rooms = Arc::new(RoomManager::with_timing(timing).with_recorder(record_tx));
    let queue = Arc::new(MatchmakingQueue::new());
    tokio::spawn(multiplayer::results::run_recorder(pool.clone(), record_rx, rooms.unstored()));

    // The tournament scheduler: it draws brackets when registration closes, and decides a match
    // whose time to be played has passed (tournaments/scheduler.rs). It asks the rooms whether a
    // match is being played before it decides one.
    let scheduler_pool = pool.clone();
    let scheduler_rooms = rooms.clone();
    let scheduler_every = std::time::Duration::from_secs(config.tournament_check_seconds);
    tokio::spawn(async move {
        tournaments::scheduler::run_scheduler(scheduler_pool, scheduler_rooms, scheduler_every).await;
    });

    // Sweep the rooms: finished ones once their linger is over (the privacy policy's "up to two
    // minutes" rests on how often this runs: multiplayer::game_room::POLICY_AFTER_THE_END), and
    // rooms nobody came to or that are too old.
    let cleanup_rooms = rooms.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(multiplayer::game_room::SWEEP_EVERY).await;
            cleanup_rooms.cleanup_stale_rooms(multiplayer::game_room::MAX_ROOM_AGE).await;
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

    // Public routes (no auth required; digicards inspects session cookie optionally for ownership)
    let public_routes = Router::new()
        .route("/health", get(|| async { "ok" }))
        .nest("/auth", auth::router(auth_context))
        .nest("/stats", stats::public_router())
        .nest("/digicards", digicard::public_router());

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

    let allowed_origins: Vec<axum::http::HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(if allowed_origins.is_empty() {
            AllowOrigin::exact("http://localhost:4321".parse().unwrap())
        } else {
            AllowOrigin::list(allowed_origins)
        })
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
                // only from a trusted proxy, with PROXY_SECRET when it is set (auth/client_ip.rs).
                let client = auth::client_addr(req.headers(), peer, &trusted).limit_key();
                if limiter.check_key(&client).is_err() {
                    return (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
                }
                next.run(req).await
            }
        }))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        // Outermost: every request runs to its end, and learns when its client has gone
        // (request_task.rs).
        .layer(middleware::from_fn(request_task::run_to_completion))
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    // Both said once per start, at any RUST_LOG: the second is how an operator checks that
    // the site's proxy is trusted (see auth/client_ip.rs).
    tracing::info!(target: notice::TARGET, "Inspired Mile API listening on {addr}");
    tracing::info!(target: notice::TARGET, "{}", auth::trusted_proxies_notice(&config.trusted_proxies));

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
