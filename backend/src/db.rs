use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::path::Path;
use std::time::Duration;

pub async fn create_pool(database_url: &str, max_connections: u32) -> PgPool {
    PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(2)
        .idle_timeout(Duration::from_secs(300))
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
        .expect("Failed to connect to PostgreSQL")
}

pub async fn run_migrations(pool: &PgPool) {
    // Run migrations from the migrations/ directory
    let migrator = sqlx::migrate::Migrator::new(Path::new("./migrations"))
        .await
        .expect("Failed to load migrations");
    migrator
        .run(pool)
        .await
        .expect("Failed to run database migrations");
}
