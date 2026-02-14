use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::path::Path;

pub async fn create_pool(database_url: &str) -> PgPool {
    PgPoolOptions::new()
        .max_connections(10)
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
