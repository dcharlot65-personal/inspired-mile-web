//! Delivery of sign-in codes: Resend's HTTP API, or the log in test mode.

use std::time::Duration;

use serde_json::json;

use super::email_code::CODE_TTL_MINUTES;
use crate::config::{Config, EmailMode};

const RESEND_SEND_URL: &str = "https://api.resend.com/emails";

/// The marker tests look for. Only ever written when `DEV_EMAIL_LOG` is on and no key is set.
pub fn dev_log_line(email: &str, code: &str) -> String {
    format!("DEV_EMAIL_LOG sign-in code for {email} is {code}")
}

/// The JSON body of Resend's `POST /emails`
/// (https://resend.com/docs/api-reference/emails/send-email).
pub fn resend_body(from: &str, to: &str, code: &str) -> serde_json::Value {
    let text = format!(
        "Your Sonnet Man sign-in code is {code}\n\n\
         It works once and expires in {CODE_TTL_MINUTES} minutes.\n\
         If you did not ask for it, ignore this email: nobody can sign in without the code.\n"
    );
    let html = format!(
        "<div style=\"font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:24px;color:#1a1a1a\">\
         <p style=\"font-size:16px;margin:0 0 16px\">Your Sonnet Man sign-in code is</p>\
         <p style=\"font-size:34px;font-weight:bold;letter-spacing:6px;margin:0 0 16px;color:#8a6508\">{code}</p>\
         <p style=\"font-size:14px;margin:0 0 8px\">It works once and expires in {CODE_TTL_MINUTES} minutes.</p>\
         <p style=\"font-size:13px;color:#555;margin:0\">If you did not ask for it, ignore this email: \
         nobody can sign in without the code.</p></div>"
    );
    json!({
        "from": from,
        "to": [to],
        "subject": format!("{code} is your Sonnet Man sign-in code"),
        "text": text,
        "html": html,
    })
}

/// Send the code. `Err` carries a description for the log; it never contains the code.
pub async fn send_code(
    http: &reqwest::Client,
    config: &Config,
    email: &str,
    code: &str,
) -> Result<(), String> {
    match &config.email_mode {
        EmailMode::Disabled => Err("email sign-in is not configured".into()),
        EmailMode::DevLog => {
            // Straight to stderr so it shows whatever RUST_LOG says.
            eprintln!("{}", dev_log_line(email, code));
            Ok(())
        }
        EmailMode::Resend(key) => {
            let response = http
                .post(RESEND_SEND_URL)
                .bearer_auth(key)
                .timeout(Duration::from_secs(10))
                .json(&resend_body(&config.email_from, email, code))
                .send()
                .await
                .map_err(|e| format!("Resend request failed: {e}"))?;
            let status = response.status();
            if status.is_success() {
                return Ok(());
            }
            let body = response.text().await.unwrap_or_default();
            let detail: String = body.chars().take(500).collect();
            Err(format!("Resend answered {status}: {detail}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resend_body_has_the_documented_fields() {
        let body = resend_body("Sonnet Man <signin@inspiredmile.com>", "viola@example.com", "042917");
        assert_eq!(body["from"], "Sonnet Man <signin@inspiredmile.com>");
        assert_eq!(body["to"], json!(["viola@example.com"]));
        assert_eq!(body["subject"], "042917 is your Sonnet Man sign-in code");
        assert!(body["text"].as_str().unwrap().contains("042917"));
        assert!(body["html"].as_str().unwrap().contains("042917"));
        assert!(body["text"].as_str().unwrap().contains("10 minutes"));
    }

    #[test]
    fn dev_log_line_is_what_the_tests_grep_for() {
        assert_eq!(
            dev_log_line("viola@example.com", "042917"),
            "DEV_EMAIL_LOG sign-in code for viola@example.com is 042917"
        );
    }
}
