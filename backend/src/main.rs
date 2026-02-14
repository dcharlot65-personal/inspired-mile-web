mod auth;
mod config;
mod db;
mod inventory;
mod marketplace;
mod migration;
mod multiplayer;
mod nft;
mod stats;
mod tournaments;
mod variants;

use std::sync::Arc;
use axum::{
    middleware,
    routing::{get, post},
    Extension, Router,
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use config::Config;
use multiplayer::{RoomManager, MatchmakingQueue};

#[tokio::main]
async fn main() {
    // Load .env if present
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::fmt::init();

    let config = Config::from_env();
    let pool = db::create_pool(&config.database_url).await;
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

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(|| async { "ok" }))
        .nest("/auth", auth::router())
        .nest("/nft", nft::router());

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/auth/link-wallet", post(auth::link_wallet))
        .nest("/inventory", inventory::router())
        .nest("/variants", variants::router())
        .nest("/stats", stats::router())
        .nest("/migrate", migration::router())
        .nest("/multiplayer", multiplayer::router(rooms.clone(), queue.clone()))
        .nest("/marketplace", marketplace::router())
        .nest("/tournaments", tournaments::router())
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
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Inspired Mile API listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
