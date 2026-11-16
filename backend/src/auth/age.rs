//! An account's age tier, and who may change it.
//!
//! The tier limits what a teen account may spend (`credits`), and an account of unknown age
//! may not give an email address. NOTHING HERE VERIFIES ANYONE'S AGE. The tier is what the
//! visitor typed into the age gate; a child who claims to be an adult when creating an
//! account gets an adult account, and a self-declared gate cannot prevent that. The rules
//! below only decide who may change a tier once it is set, and when.
//!
//! THE RULES
//!
//!   1. Creation. An account gets the gate's answer that its browser sends with the sign-up
//!      (`age_tier_from`), as both its tier (`age_tier`) and its declared tier
//!      (`age_tier_declared`).
//!   2. Only an explicit answer from the signed-in user changes it afterwards: the age
//!      question that the account menu opens, posted to `POST /auth/age-tier` by the page
//!      only when that person answers it. The page no longer posts the browser's stored
//!      gate answer on load; and `POST /credits/age-verify`, which a page cached before
//!      this change still calls on every load, answers but never writes. So a family
//!      browser where a teen once answered the gate cannot turn the adult's account into a
//!      teen one by itself.
//!   3. With an explicit answer (`decide_age_tier`):
//!      - an account of unknown age (older than the gate) takes the first answer, which
//!        also becomes its declared tier;
//!      - `adult` may become `teen` at any time;
//!      - `teen` may become `adult` again ONLY when the account was declared `adult` (it was
//!        created as an adult account, and its owner later made it teen), and only with a
//!        fresh proof: a passkey check or an emailed code in the last five minutes
//!        (`sessions::FRESH_AUTH_MINUTES`). That undoes the owner's own change; it gives the
//!        account nothing its creation did not.
//!      - An account declared `teen` (created as a teen's, or whose first answer was teen)
//!        stays teen. There is no way back in the product, because the person asking would
//!        be the teen. If an adult ends up with such an account (for example by creating it
//!        on a shared browser whose stored answer was a teen's), the operator can change it
//!        at their request:
//!          UPDATE users SET age_tier = 'adult', age_tier_declared = 'adult' WHERE id = '<id>';
//!        Nothing verifies the request either; that is the operator's judgement.

use axum::{body::Bytes, extract::State, http::HeaderMap, http::StatusCode, Json};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use super::error::ApiError;
use super::handlers::session;
use super::sessions;
use crate::config::Config;

/// What an explicit answer does to an account's tier.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AgeTierDecision {
    /// The tier already is the one asked for.
    Unchanged,
    /// Write these: the new tier, and the declared tier (changed only for an account of
    /// unknown age).
    Set { tier: &'static str, declared: &'static str },
    /// Back to adult needs a proof of the last few minutes first.
    NeedsFreshProof,
    /// Back to adult is not possible for an account declared teen.
    Locked,
}

fn known(tier: &str) -> Option<&'static str> {
    match tier {
        "adult" => Some("adult"),
        "teen" => Some("teen"),
        _ => None,
    }
}

/// The rules at the top of this file. `stored` is the tier now, `declared` the declared one,
/// `requested` the answer ("adult" or "teen"), `fresh` whether the session proved who it
/// is in the last few minutes. Anything that is not a known tier changes nothing.
pub fn decide_age_tier(stored: &str, declared: &str, requested: &str, fresh: bool) -> AgeTierDecision {
    let Some(requested) = known(requested) else {
        return AgeTierDecision::Unchanged;
    };
    match (known(stored), requested) {
        (Some(now), wanted) if now == wanted => AgeTierDecision::Unchanged,
        // Older than the gate: the first answer counts as the declaration.
        (None, wanted) => AgeTierDecision::Set { tier: wanted, declared: wanted },
        (Some("adult"), "teen") => AgeTierDecision::Set { tier: "teen", declared: known(declared).unwrap_or("adult") },
        (Some("teen"), "adult") if declared == "adult" => {
            if fresh {
                AgeTierDecision::Set { tier: "adult", declared: "adult" }
            } else {
                AgeTierDecision::NeedsFreshProof
            }
        }
        (Some("teen"), "adult") => AgeTierDecision::Locked,
        _ => AgeTierDecision::Unchanged,
    }
}

#[derive(Deserialize)]
pub struct AgeTierBody {
    age_tier: String,
}

#[derive(Serialize)]
pub struct AgeTierAnswer {
    /// The account's tier after the request.
    age_tier: String,
    /// Whether this request changed it.
    changed: bool,
}

/// `POST /auth/age-tier`: the signed-in user's own answer to the age question.
///
/// The body is read by hand, after the same-site check: a JSON extractor would answer a
/// form posted from another site itself (415) before that check could say why it is refused.
pub async fn set_age_tier(
    jar: CookieJar,
    headers: HeaderMap,
    State((pool, config)): State<(PgPool, Config)>,
    body: Bytes,
) -> Result<Json<AgeTierAnswer>, ApiError> {
    if !sessions::is_same_site_json(&headers) {
        return Err(sessions::cross_site_refused());
    }
    let session = session(&jar, &pool, &config).await?;
    let user_id = session.claims.sub;
    let body: AgeTierBody = serde_json::from_slice(&body)
        .map_err(|_| ApiError::bad_request("invalid_age_tier", "The age tier is adult or teen."))?;
    if known(&body.age_tier).is_none() {
        return Err(ApiError::bad_request("invalid_age_tier", "The age tier is adult or teen."));
    }
    let row = sqlx::query("SELECT age_tier, age_tier_declared FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(ApiError::unauthorized)?;
    let stored: String = row.get("age_tier");
    let declared: String = row.get("age_tier_declared");
    let fresh = sessions::is_fresh(session.verified_at, chrono::Utc::now());
    match decide_age_tier(&stored, &declared, &body.age_tier, fresh) {
        AgeTierDecision::Unchanged => Ok(Json(AgeTierAnswer { age_tier: stored, changed: false })),
        AgeTierDecision::NeedsFreshProof => Err(sessions::reauth_required()),
        AgeTierDecision::Locked => {
            tracing::info!(%user_id, "age tier not loosened: the account was declared teen");
            Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "age_tier_locked",
                "This account was made for someone under 18, and stays that way.",
            ))
        }
        AgeTierDecision::Set { tier, declared: new_declared } => {
            // Written only if nothing changed since it was read, so two answers cannot race.
            let written = sqlx::query(
                "UPDATE users SET age_tier = $2, age_tier_declared = $3, updated_at = NOW()
                 WHERE id = $1 AND age_tier = $4 AND age_tier_declared = $5",
            )
            .bind(user_id)
            .bind(tier)
            .bind(new_declared)
            .bind(&stored)
            .bind(&declared)
            .execute(&pool)
            .await?
            .rows_affected();
            if written == 0 {
                return Err(ApiError::new(StatusCode::CONFLICT, "age_tier_changed", "Please try again."));
            }
            tracing::info!(%user_id, from = %stored, to = tier, "age tier changed by its owner");
            Ok(Json(AgeTierAnswer { age_tier: tier.to_string(), changed: true }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use AgeTierDecision::*;

    #[test]
    fn an_answer_that_is_already_the_tier_changes_nothing() {
        for fresh in [true, false] {
            assert_eq!(decide_age_tier("adult", "adult", "adult", fresh), Unchanged);
            assert_eq!(decide_age_tier("teen", "teen", "teen", fresh), Unchanged);
            assert_eq!(decide_age_tier("teen", "adult", "teen", fresh), Unchanged);
        }
    }

    #[test]
    fn an_adult_account_can_always_be_made_teen() {
        assert_eq!(decide_age_tier("adult", "adult", "teen", false), Set { tier: "teen", declared: "adult" });
        assert_eq!(decide_age_tier("adult", "adult", "teen", true), Set { tier: "teen", declared: "adult" });
    }

    #[test]
    fn an_account_declared_adult_can_go_back_with_a_fresh_proof_only() {
        assert_eq!(decide_age_tier("teen", "adult", "adult", false), NeedsFreshProof);
        assert_eq!(decide_age_tier("teen", "adult", "adult", true), Set { tier: "adult", declared: "adult" });
    }

    #[test]
    fn an_account_declared_teen_never_becomes_adult() {
        for fresh in [true, false] {
            assert_eq!(decide_age_tier("teen", "teen", "adult", fresh), Locked);
            // An account from before the gate whose first answer was teen: the same.
            assert_eq!(decide_age_tier("teen", "unknown", "adult", fresh), Locked);
        }
    }

    #[test]
    fn an_account_older_than_the_gate_takes_its_first_answer_as_its_declaration() {
        assert_eq!(decide_age_tier("unknown", "unknown", "adult", false), Set { tier: "adult", declared: "adult" });
        assert_eq!(decide_age_tier("unknown", "unknown", "teen", false), Set { tier: "teen", declared: "teen" });
    }

    #[test]
    fn nothing_else_is_a_tier() {
        for junk in ["", "unknown", "child", "Adult", "blocked", "teen-consented"] {
            for stored in ["adult", "teen", "unknown"] {
                assert_eq!(decide_age_tier(stored, stored, junk, true), Unchanged, "{stored} <- {junk:?}");
            }
        }
    }
}
