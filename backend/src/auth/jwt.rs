use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,       // user_id
    pub username: String,
    pub exp: i64,
    pub iat: i64,
}

pub fn create_token(user_id: Uuid, username: &str, secret: &str) -> Result<String, String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        exp: (now + Duration::days(7)).timestamp(),
        iat: now.timestamp(),
    };

    let key = EncodingKey::from_secret(secret.as_bytes())
        .map_err(|e| format!("JWT key error: {e}"))?;
    encode(&Header::default(), &claims, &key)
    .map_err(|e| format!("JWT encode error: {e}"))
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, String> {
    let key = DecodingKey::from_secret(secret.as_bytes())
        .map_err(|e| format!("JWT key error: {e}"))?;
    decode::<Claims>(token, &key, &Validation::default())
    .map(|data| data.claims)
    .map_err(|e| format!("JWT verify error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_round_trips_and_rejects_a_wrong_secret() {
        let id = Uuid::new_v4();
        let token = create_token(id, "hamlet", "secret-a").expect("token is created");
        let claims = verify_token(&token, "secret-a").expect("token verifies");
        assert_eq!(claims.sub, id);
        assert_eq!(claims.username, "hamlet");
        assert!(verify_token(&token, "secret-b").is_err());
        assert!(verify_token("not-a-token", "secret-a").is_err());
    }
}
