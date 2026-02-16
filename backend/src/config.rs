use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub port: u16,
    pub cors_origin: String,
    pub llm_api_key: Option<String>,
    pub llm_api_url: String,
    pub google_client_id: String,
    pub db_max_connections: u32,
    pub launch_date: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/inspired_mile".into()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-in-production".into()),
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3849),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:4321".into()),
            llm_api_key: env::var("LLM_API_KEY").ok(),
            llm_api_url: env::var("LLM_API_URL")
                .unwrap_or_else(|_| "https://api.anthropic.com/v1/messages".into()),
            google_client_id: env::var("GOOGLE_CLIENT_ID")
                .unwrap_or_default(),
            db_max_connections: env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(25),
            launch_date: env::var("LAUNCH_DATE")
                .unwrap_or_else(|_| "2026-04-01".into()),
        }
    }
}
