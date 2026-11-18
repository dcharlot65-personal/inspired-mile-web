//! Delivery of sign-in codes: Resend's HTTP API, or the log in test mode.

use std::time::Duration;

use serde_json::json;

use super::email_code::CODE_TTL_MINUTES;
use crate::config::{Config, EmailMode};

const RESEND_SEND_URL: &str = "https://api.resend.com/emails";

/// A code that signs its holder in (creating the account if the address is new).
pub const LOGIN: &str = "login";
/// A code that makes the address the recovery email of an account that is already signed in.
pub const ADD: &str = "add";

/// The marker tests look for. Only ever written when `DEV_EMAIL_LOG` is on and no key is set.
pub fn dev_log_line(email: &str, code: &str) -> String {
    format!("DEV_EMAIL_LOG sign-in code for {email} is {code}")
}

/// The JSON body of Resend's `POST /emails`
/// (https://resend.com/docs/api-reference/emails/send-email).
///
/// The two purposes read differently on purpose. An `add` code does not sign anyone in: it
/// hands recovery of somebody's account to this mailbox. If the two emails looked alike, a
/// signed-in stranger could have one sent to a victim, ask them to "read out the sign-in
/// code", and bind the victim's address to the stranger's account.
pub fn resend_body(from: &str, to: &str, code: &str, purpose: &str) -> serde_json::Value {
    if purpose == ADD {
        let text = format!(
            "Someone signed in to Sonnet Man asked to make this address the recovery email of \
             their account. Their code is {code}\n\n\
             Only enter it yourself, on the Sonnet Man page where you asked for it. It works once \
             and expires in {CODE_TTL_MINUTES} minutes.\n\
             If you did not ask for this, do nothing, and do not give the code to anyone who \
             asks for it: it would tie your email address to their account.\n"
        );
        let html = format!(
            "<div style=\"font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:24px;color:#1a1a1a\">\
             <p style=\"font-size:16px;margin:0 0 16px\">Someone signed in to Sonnet Man asked to make this \
             address the recovery email of their account. Their code is</p>\
             <p style=\"font-size:34px;font-weight:bold;letter-spacing:6px;margin:0 0 16px;color:#8a6508\">{code}</p>\
             <p style=\"font-size:14px;margin:0 0 8px\">Only enter it yourself, on the Sonnet Man page where \
             you asked for it. It works once and expires in {CODE_TTL_MINUTES} minutes.</p>\
             <p style=\"font-size:13px;color:#555;margin:0\">If you did not ask for this, do nothing, and do \
             not give the code to anyone who asks for it: it would tie your email address to their \
             account.</p></div>"
        );
        return json!({
            "from": from,
            "to": [to],
            "subject": format!("{code} confirms this address as a Sonnet Man recovery email"),
            "text": text,
            "html": html,
        });
    }
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
    purpose: &str,
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
                .json(&resend_body(&config.email_from, email, code, purpose))
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
        let body = resend_body("Sonnet Man <signin@inspiredmile.com>", "viola@example.com", "042917", LOGIN);
        assert_eq!(body["from"], "Sonnet Man <signin@inspiredmile.com>");
        assert_eq!(body["to"], json!(["viola@example.com"]));
        assert_eq!(body["subject"], "042917 is your Sonnet Man sign-in code");
        assert!(body["text"].as_str().unwrap().contains("042917"));
        assert!(body["html"].as_str().unwrap().contains("042917"));
        assert!(body["text"].as_str().unwrap().contains("10 minutes"));
    }

    #[test]
    fn the_add_email_says_what_it_does_and_does_not_read_as_a_sign_in_code() {
        let body = resend_body("Sonnet Man <signin@inspiredmile.com>", "viola@example.com", "042917", ADD);
        let subject = body["subject"].as_str().unwrap();
        let text = body["text"].as_str().unwrap();
        let html = body["html"].as_str().unwrap();
        assert!(subject.contains("042917") && subject.contains("recovery email"), "{subject}");
        assert!(!subject.contains("sign-in code"), "{subject}");
        for part in [text, html] {
            assert!(part.contains("042917"));
            assert!(part.contains("recovery email of"), "it names what the code will do");
            assert!(part.contains("do not give the code to anyone") || part.contains("not give the code to anyone"));
            assert!(!part.contains("sign-in code"));
            assert!(part.contains("10 minutes"));
        }
        // The sign-in email is unchanged and different.
        let login = resend_body("Sonnet Man <signin@inspiredmile.com>", "viola@example.com", "042917", LOGIN);
        assert_ne!(login["subject"], body["subject"]);
        assert_ne!(login["text"], body["text"]);
    }

    #[test]
    fn dev_log_line_is_what_the_tests_grep_for() {
        assert_eq!(
            dev_log_line("viola@example.com", "042917"),
            "DEV_EMAIL_LOG sign-in code for viola@example.com is 042917"
        );
    }
}
