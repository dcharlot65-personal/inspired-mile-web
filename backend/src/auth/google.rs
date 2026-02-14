use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct GoogleTokenInfo {
    pub sub: String,
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub aud: String,
}

pub async fn verify_google_token(
    id_token: &str,
    expected_client_id: &str,
) -> Result<GoogleTokenInfo, String> {
    let client = Client::new();
    let resp = client
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("id_token", id_token)])
        .send()
        .await
        .map_err(|e| format!("Google verify request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err("Invalid Google token".into());
    }

    let info: GoogleTokenInfo = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google response: {e}"))?;

    if info.aud != expected_client_id {
        return Err("Token audience mismatch".into());
    }

    Ok(info)
}
