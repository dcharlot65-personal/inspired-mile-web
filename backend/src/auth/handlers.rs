use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::jwt::{create_token, Claims};
use crate::config::Config;

const COOKIE_NAME: &str = "im_token";

#[derive(Deserialize)]
pub struct RegisterRequest {
    username: String,
    email: String,
    password: String,
    display_name: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    id: Uuid,
    username: String,
    email: String,
    display_name: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    user: UserResponse,
}

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/me", get(me))
}

async fn register(
    State((pool, config)): State<(PgPool, Config)>,
    Json(body): Json<RegisterRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), (StatusCode, String)> {
    if body.username.len() < 3 || body.username.len() > 32 {
        return Err((StatusCode::BAD_REQUEST, "Username must be 3-32 characters".into()));
    }
    if body.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "Password must be at least 8 characters".into()));
    }

    let password_hash = hash_password(&body.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let row = sqlx::query(
        "INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, display_name",
    )
    .bind(&body.username)
    .bind(&body.email)
    .bind(&password_hash)
    .bind(&body.display_name)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, "Username or email already taken".into())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}"))
        }
    })?;

    let user_id: Uuid = row.get("id");
    let username: String = row.get("username");

    let _ = sqlx::query("INSERT INTO player_stats (user_id) VALUES ($1)")
        .bind(user_id)
        .execute(&pool)
        .await;

    let token = create_token(user_id, &username, &config.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let jar = CookieJar::new().add(build_cookie(token));

    Ok((jar, Json(AuthResponse {
        user: UserResponse {
            id: user_id,
            username,
            email: row.get("email"),
            display_name: row.get("display_name"),
        },
    })))
}

async fn login(
    State((pool, config)): State<(PgPool, Config)>,
    Json(body): Json<LoginRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT id, username, email, display_name, password_hash FROM users WHERE username = $1",
    )
    .bind(&body.username)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials".into()))?;

    let password_hash: String = row.get("password_hash");
    verify_password(&body.password, &password_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    let user_id: Uuid = row.get("id");
    let username: String = row.get("username");

    let token = create_token(user_id, &username, &config.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let jar = CookieJar::new().add(build_cookie(token));

    Ok((jar, Json(AuthResponse {
        user: UserResponse {
            id: user_id,
            username,
            email: row.get("email"),
            display_name: row.get("display_name"),
        },
    })))
}

async fn logout() -> CookieJar {
    let cookie = Cookie::build((COOKIE_NAME, ""))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::ZERO)
        .build();
    CookieJar::new().add(cookie)
}

async fn me(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT id, username, email, display_name FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".into()))?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: row.get("id"),
            username: row.get("username"),
            email: row.get("email"),
            display_name: row.get("display_name"),
        },
    }))
}

fn hash_password(password: &str) -> Result<String, String> {
    use argon2::{
        password_hash::{rand_core::OsRng, SaltString},
        Argon2, PasswordHasher,
    };
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Hash error: {e}"))
}

fn verify_password(password: &str, hash: &str) -> Result<(), String> {
    use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
    let parsed = PasswordHash::new(hash).map_err(|e| format!("Parse error: {e}"))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| "Invalid password".into())
}

// ---------------------------------------------------------------------------
// Wallet linking
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct LinkWalletRequest {
    wallet_address: String,
}

#[derive(Serialize)]
pub struct WalletResponse {
    wallet_address: Option<String>,
}

pub async fn link_wallet(
    Extension(claims): Extension<Claims>,
    State((pool, _)): State<(PgPool, Config)>,
    Json(body): Json<LinkWalletRequest>,
) -> Result<Json<WalletResponse>, (StatusCode, String)> {
    if body.wallet_address.len() < 32 || body.wallet_address.len() > 64 {
        return Err((StatusCode::BAD_REQUEST, "Invalid wallet address".into()));
    }

    sqlx::query("UPDATE users SET wallet_address = $1 WHERE id = $2")
        .bind(&body.wallet_address)
        .bind(claims.sub)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    Ok(Json(WalletResponse {
        wallet_address: Some(body.wallet_address),
    }))
}

fn build_cookie(token: String) -> Cookie<'static> {
    Cookie::build((COOKIE_NAME, token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build()
}
