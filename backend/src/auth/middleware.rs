use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use sqlx::PgPool;

use super::sessions;
use crate::config::Config;

/// Guard for every route outside `/auth`: the session cookie must carry a correctly signed
/// token AND that token's session must still be live on the server (not signed out, not
/// expired, its user not deleted). Injects `Claims` as a request extension.
pub async fn auth_middleware(
    State((pool, config)): State<(PgPool, Config)>,
    jar: CookieJar,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let session = sessions::authenticate(&pool, &config, &jar)
        .await
        .map_err(|e| e.status)?;
    request.extensions_mut().insert(session.claims);
    Ok(next.run(request).await)
}
