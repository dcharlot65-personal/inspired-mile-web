mod auth;
mod classroom;
mod config;
mod credits;
mod db;
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

    // Sweep expired sign-in challenges and old email codes in the background
    let purge_pool = pool.clone();
    tokio::spawn(async move {
        loop {
            auth::purge_expired(&purge_pool).await;
            tokio::time::sleep(std::time::Duration::from_secs(600)).await;
        }
    });

    // Rate limiter
    let limiter = rate_limit::create_rate_limiter(config.rate_limit_per_minute);

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
        .layer(middleware::from_fn(auth::auth_middleware))
        .layer(Extension(config.jwt_secret.clone()));

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

    let app = Router::new()
        .nest("/api/v1", public_routes.merge(protected_routes))
        .layer(RequestBodyLimitLayer::new(1_048_576)) // 1MB max body
        .layer(middleware::from_fn(move |req: axum::http::Request<axum::body::Body>, next: middleware::Next| {
            let limiter = limiter.clone();
            async move {
                if limiter.check().is_err() {
                    return (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
                }
                next.run(req).await
            }
        }))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Inspired Mile API listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    // Connect info gives the email-code limiter a peer address when no proxy header is set.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .unwrap();
}
