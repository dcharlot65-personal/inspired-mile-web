use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;

use super::jwt::verify_token;

const COOKIE_NAME: &str = "im_token";

/// Extract and verify JWT from the `im_token` cookie.
/// Injects `Claims` as a request extension for downstream handlers.
pub async fn auth_middleware(
    jar: CookieJar,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = jar
        .get(COOKIE_NAME)
        .map(|c| c.value().to_string())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Get JWT secret from app state
    let secret = request
        .extensions()
        .get::<String>()
        .cloned()
        .unwrap_or_default();

    let claims = verify_token(&token, &secret).map_err(|_| StatusCode::UNAUTHORIZED)?;

    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}
