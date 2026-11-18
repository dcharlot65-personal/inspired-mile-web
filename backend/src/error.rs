//! Failures the caller cannot fix, for the routes that answer in plain text.

use axum::http::StatusCode;

/// What the client is told when the server fails. Nothing about the failure itself.
pub const INTERNAL_MESSAGE: &str = "Something went wrong on our side. Please try again.";

/// Turn a database (or other internal) error into a 500. The detail goes to the log and
/// never to the client: sqlx's text names tables, columns and constraints.
pub fn internal(error: impl std::fmt::Display) -> (StatusCode, String) {
    tracing::error!("internal error: {error}");
    (StatusCode::INTERNAL_SERVER_ERROR, INTERNAL_MESSAGE.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_client_never_sees_the_detail() {
        let detail = "error returned from database: relation \"player_stats\" does not exist";
        let (status, body) = internal(detail);
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body, INTERNAL_MESSAGE);
        assert!(!body.contains("player_stats"));
        assert!(!body.contains("database"));
    }
}
