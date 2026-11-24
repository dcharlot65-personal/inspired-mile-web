//! Unified Inspired Mile Digi-Physical Card & Joule State-Machine API (`/api/v1/digicards`).
//!
//! Bridges physical NTAG424 DNA / NFC collector cards and cross-mile digital progression across
//! First Mile (`sonnetman.inspiredmile.com`), Second Mile (`chessfighter.inspiredmile.com`),
//! and the Inspired Mile verifier (`inspiredmile.com/card`).
//!
//! Security & Physics Invariants:
//! - Monotonic `sun_tap_counter`: every state transition requires `sun_tap_counter` strictly
//!   greater than the card's last committed counter under a Postgres `FOR UPDATE` row lock,
//!   preventing NTAG424 DNA SUN / URL replay attacks even under concurrent requests.
//! - Server-authoritative Joule-State Yin/Yang accounting: clients never supply raw joule amounts.
//!   Deterministic engine loop work (`loop_microjoules`, Yang) and bounded AI compartment work
//!   (`compartment_microjoules`, Yin) are computed purely from validated transition receipts.
//! - Deterministic RFC 8032 Ed25519 signatures (`aws-lc-rs`) over canonical JSON state produce
//!   portable, offline-verifiable `IM2-<payload_b64url>.<sig_b64url>` tokens.

use aws_lc_rs::signature::{Ed25519KeyPair, KeyPair, UnparsedPublicKey, ED25519};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use hmac::{Hmac, KeyInit, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::authenticate_session;
use crate::config::Config;

pub const GENESIS_PREV_HASH: &str =
    "0000000000000000000000000000000000000000000000000000000000000000";

const JOURNEY_NAMES: [&str; 6] = [
    "Threshold",
    "Wonder",
    "Doubt",
    "Company",
    "Ascent",
    "Horizon",
];

// ---------------------------------------------------------------------------
// Thermodynamic Rarity & Journey Milestones
// ---------------------------------------------------------------------------

/// Thermodynamic rarity tier derived from total accumulated microjoules (`1 mJ = 1,000 µJ`).
pub fn rarity_tier_for_microjoules(total_uj: i64) -> &'static str {
    match total_uj {
        ..10_000 => "Unawakened",
        10_000..50_000 => "Tempered",
        50_000..250_000 => "Forged",
        250_000..1_000_000 => "Radiant",
        _ => "Sovereign",
    }
}

pub fn journey_milestone_name(stage: i16) -> &'static str {
    JOURNEY_NAMES
        .get(usize::try_from(stage.clamp(0, 5)).unwrap_or(0))
        .copied()
        .unwrap_or("Threshold")
}

/// Monotonic journey stage (`0..=5`, *Threshold → Horizon*).
pub fn compute_journey_stage(
    prev_stage: i16,
    wins: i32,
    losses: i32,
    sonnet_verses: i32,
    chess_captures: i32,
    chess_promotions: i32,
    total_uj: i64,
) -> i16 {
    let cross_mile = sonnet_verses > 0 && (chess_captures > 0 || chess_promotions > 0);
    let total_actions =
        i64::from(wins) + i64::from(losses) + i64::from(sonnet_verses) + i64::from(chess_captures) + i64::from(chess_promotions);

    let derived = if wins >= 10 && total_uj >= 1_000_000 && cross_mile {
        5 // Horizon
    } else if wins >= 5 && total_uj >= 250_000 {
        4 // Ascent
    } else if cross_mile || (wins >= 3 && total_uj >= 75_000) {
        3 // Company
    } else if total_actions >= 3 || total_uj >= 25_000 {
        2 // Doubt
    } else if total_actions >= 1 {
        1 // Wonder
    } else {
        0 // Threshold
    };
    prev_stage.clamp(0, 5).max(derived)
}

// ---------------------------------------------------------------------------
// Base64URL (RFC 4648 §5, unpadded) & Deterministic Ed25519 Signing
// ---------------------------------------------------------------------------

const B64URL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

pub fn base64url_encode(input: &[u8]) -> String {
    let mut out = String::with_capacity((input.len() * 4).div_ceil(3));
    let mut i = 0;
    while i + 3 <= input.len() {
        let n = (u32::from(input[i]) << 16) | (u32::from(input[i + 1]) << 8) | u32::from(input[i + 2]);
        out.push(B64URL[((n >> 18) & 63) as usize] as char);
        out.push(B64URL[((n >> 12) & 63) as usize] as char);
        out.push(B64URL[((n >> 6) & 63) as usize] as char);
        out.push(B64URL[(n & 63) as usize] as char);
        i += 3;
    }
    let rem = input.len() - i;
    if rem == 1 {
        let n = u32::from(input[i]) << 16;
        out.push(B64URL[((n >> 18) & 63) as usize] as char);
        out.push(B64URL[((n >> 12) & 63) as usize] as char);
    } else if rem == 2 {
        let n = (u32::from(input[i]) << 16) | (u32::from(input[i + 1]) << 8);
        out.push(B64URL[((n >> 18) & 63) as usize] as char);
        out.push(B64URL[((n >> 12) & 63) as usize] as char);
        out.push(B64URL[((n >> 6) & 63) as usize] as char);
    }
    out
}

pub fn base64url_decode(input: &str) -> Result<Vec<u8>, &'static str> {
    let clean = input.trim_end_matches('=');
    if clean.len() % 4 == 1 {
        return Err("invalid base64url length");
    }
    let val = |b: u8| -> Result<u32, &'static str> {
        match b {
            b'A'..=b'Z' => Ok(u32::from(b - b'A')),
            b'a'..=b'z' => Ok(u32::from(b - b'a' + 26)),
            b'0'..=b'9' => Ok(u32::from(b - b'0' + 52)),
            b'-' => Ok(62),
            b'_' => Ok(63),
            _ => Err("invalid base64url character"),
        }
    };
    let bytes = clean.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut i = 0;
    while i + 4 <= bytes.len() {
        let n = (val(bytes[i])? << 18)
            | (val(bytes[i + 1])? << 12)
            | (val(bytes[i + 2])? << 6)
            | val(bytes[i + 3])?;
        out.push(((n >> 16) & 0xFF) as u8);
        out.push(((n >> 8) & 0xFF) as u8);
        out.push((n & 0xFF) as u8);
        i += 4;
    }
    let rem = bytes.len() - i;
    if rem == 2 {
        let n = (val(bytes[i])? << 18) | (val(bytes[i + 1])? << 12);
        out.push(((n >> 16) & 0xFF) as u8);
    } else if rem == 3 {
        let n = (val(bytes[i])? << 18) | (val(bytes[i + 1])? << 12) | (val(bytes[i + 2])? << 6);
        out.push(((n >> 16) & 0xFF) as u8);
        out.push(((n >> 8) & 0xFF) as u8);
    }
    Ok(out)
}

/// Derive a dedicated 32-byte Ed25519 signing key from `jwt_secret`, domain-separated from
/// session tokens and email codes.
pub fn ed25519_keypair_from_secret(jwt_secret: &str) -> Ed25519KeyPair {
    let mut mac =
        Hmac::<Sha256>::new_from_slice(jwt_secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(b"inspired-mile:digicard-ed25519:v1\0");
    let seed = mac.finalize().into_bytes();
    Ed25519KeyPair::from_seed_unchecked(seed.as_slice())
        .expect("32-byte HMAC-SHA256 digest is a valid Ed25519 seed")
}

/// Canonical payload serialized deterministically inside every `IM2-` token and signed by Ed25519.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanonicalCardPayload {
    pub v: u8,
    pub uid: String,
    pub origin: String,
    pub arch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cat: Option<String>,
    pub stage: i16,
    pub rarity: String,
    pub elo: i32,
    pub w: i32,
    pub l: i32,
    pub verses: i32,
    pub captures: i32,
    pub promotions: i32,
    pub loop_uj: i64,
    pub comp_uj: i64,
    pub ctr: i64,
    pub prev: String,
}

#[derive(Clone, Debug)]
pub struct SignedArtifact {
    pub state_hash: String,
    pub ed25519_sig: String,
    pub ed25519_pubkey: String,
    pub im2_token: String,
}

pub fn sign_card_payload(payload: &CanonicalCardPayload, keypair: &Ed25519KeyPair) -> SignedArtifact {
    let canonical_bytes = serde_json::to_vec(payload).expect("canonical payload serializes");
    let state_hash = hex::encode(Sha256::digest(&canonical_bytes));
    let sig = keypair.sign(&canonical_bytes);
    let ed25519_sig = hex::encode(sig.as_ref());
    let ed25519_pubkey = hex::encode(keypair.public_key().as_ref());
    let im2_token = format!(
        "IM2-{}.{}",
        base64url_encode(&canonical_bytes),
        base64url_encode(sig.as_ref())
    );
    SignedArtifact {
        state_hash,
        ed25519_sig,
        ed25519_pubkey,
        im2_token,
    }
}

pub fn verify_im2_token(token: &str, pubkey_bytes: &[u8]) -> Result<CanonicalCardPayload, &'static str> {
    let body = token.strip_prefix("IM2-").ok_or("missing IM2- prefix")?;
    let (payload_b64, sig_b64) = body.split_once('.').ok_or("malformed IM2 token")?;
    let payload_bytes = base64url_decode(payload_b64)?;
    let sig_bytes = base64url_decode(sig_b64)?;
    UnparsedPublicKey::new(&ED25519, pubkey_bytes)
        .verify(&payload_bytes, &sig_bytes)
        .map_err(|_| "Ed25519 signature verification failed")?;
    let payload: CanonicalCardPayload =
        serde_json::from_slice(&payload_bytes).map_err(|_| "invalid IM2 JSON payload")?;
    if payload.v != 2 {
        return Err("unsupported IM2 payload version");
    }
    Ok(payload)
}

// ---------------------------------------------------------------------------
// Deterministic Transition Receipt & Yin/Yang Joule Physics
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MatchOutcome {
    Win,
    Loss,
    Draw,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TransitionEvent {
    /// First Mile (`sonnetman.inspiredmile.com`) verse-duel receipt.
    VerseDuel {
        outcome: MatchOutcome,
        rounds_played: u8,
        lines_scored: u16,
        craft_score: u16,
        #[serde(default = "default_ai_none")]
        ai_tier: String,
        #[serde(default)]
        ai_invocations: u8,
        #[serde(default)]
        opponent_elo: Option<i32>,
    },
    /// Second Mile (`chessfighter.inspiredmile.com`) real-time 3D capture duel receipt.
    ChessCapture {
        ply_count: u16,
        #[serde(default)]
        duel_ticks: u16,
        #[serde(default)]
        captured_piece: Option<String>,
        #[serde(default = "default_ai_none")]
        ai_tier: String,
        #[serde(default)]
        ai_invocations: u8,
    },
    /// Second Mile (`chessfighter.inspiredmile.com`) pawn promotion transition.
    ChessPromotion {
        ply_count: u16,
        #[serde(default)]
        duel_ticks: u16,
        #[serde(default)]
        promoted_to: Option<String>,
        #[serde(default = "default_ai_none")]
        ai_tier: String,
        #[serde(default)]
        ai_invocations: u8,
    },
    /// Second Mile (`chessfighter.inspiredmile.com`) checkmate / match crown receipt.
    ChessCrown {
        outcome: MatchOutcome,
        ply_count: u16,
        #[serde(default)]
        duel_ticks: u16,
        #[serde(default = "default_ai_none")]
        ai_tier: String,
        #[serde(default)]
        ai_invocations: u8,
        #[serde(default)]
        opponent_elo: Option<i32>,
    },
}

fn default_ai_none() -> String {
    "none".to_string()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ComputedDelta {
    pub game: &'static str,
    pub kind: &'static str,
    pub loop_uj: i64,
    pub comp_uj: i64,
    pub d_wins: i32,
    pub d_losses: i32,
    pub d_verses: i32,
    pub d_captures: i32,
    pub d_promotions: i32,
    pub elo_after: i32,
}

fn elo_step(current_elo: i32, opponent_elo: i32, outcome: MatchOutcome) -> i32 {
    let opp = opponent_elo.clamp(600, 2800);
    let diff = f64::from(opp - current_elo);
    let expected = 1.0 / (1.0 + 10.0_f64.powf(diff / 400.0));
    let actual = match outcome {
        MatchOutcome::Win => 1.0,
        MatchOutcome::Draw => 0.5,
        MatchOutcome::Loss => 0.0,
    };
    let next = f64::from(current_elo) + 24.0 * (actual - expected);
    (next.round() as i32).clamp(400, 3000)
}

fn sonnet_compartment_uj(tier: &str, invocations: u8) -> Result<i64, &'static str> {
    let calls = i64::from(invocations);
    match tier.trim().to_ascii_lowercase().as_str() {
        "" | "none" | "rules" | "human" => {
            if calls != 0 {
                return Err("ai_invocations must be 0 when ai_tier is none");
            }
            Ok(0)
        }
        "lite" => {
            if !(1..=6).contains(&calls) {
                return Err("sonnetman ai_invocations must be between 1 and 6");
            }
            Ok(8_500 * calls)
        }
        "standard" | "gemma" => {
            if !(1..=6).contains(&calls) {
                return Err("sonnetman ai_invocations must be between 1 and 6");
            }
            Ok(24_000 * calls)
        }
        "grand" => {
            if !(1..=6).contains(&calls) {
                return Err("sonnetman ai_invocations must be between 1 and 6");
            }
            Ok(45_000 * calls)
        }
        _ => Err("unknown sonnetman ai_tier"),
    }
}

fn chess_compartment_uj(tier: &str, invocations: u8) -> Result<i64, &'static str> {
    let calls = i64::from(invocations);
    match tier.trim().to_ascii_lowercase().as_str() {
        "" | "none" | "minimax" | "human" => {
            if calls != 0 {
                return Err("ai_invocations must be 0 when ai_tier is none");
            }
            Ok(0)
        }
        "tactical" | "lite" => {
            if !(1..=16).contains(&calls) {
                return Err("chessfighter ai_invocations must be between 1 and 16");
            }
            Ok(6_000 * calls)
        }
        "neural" | "standard" => {
            if !(1..=16).contains(&calls) {
                return Err("chessfighter ai_invocations must be between 1 and 16");
            }
            Ok(18_000 * calls)
        }
        "grandmaster" | "grand" => {
            if !(1..=16).contains(&calls) {
                return Err("chessfighter ai_invocations must be between 1 and 16");
            }
            Ok(36_000 * calls)
        }
        _ => Err("unknown chessfighter ai_tier"),
    }
}

pub fn evaluate_transition(current_elo: i32, event: &TransitionEvent) -> Result<ComputedDelta, &'static str> {
    match event {
        TransitionEvent::VerseDuel {
            outcome,
            rounds_played,
            lines_scored,
            craft_score,
            ai_tier,
            ai_invocations,
            opponent_elo,
        } => {
            if !(1..=5).contains(rounds_played) {
                return Err("rounds_played must be between 1 and 5");
            }
            if !(1..=40).contains(lines_scored) {
                return Err("lines_scored must be between 1 and 40");
            }
            if *craft_score > 100 {
                return Err("craft_score must be between 0 and 100");
            }
            let loop_uj = 2_400
                + i64::from(*rounds_played) * 1_800
                + i64::from(*lines_scored) * 350
                + i64::from(*craft_score) * 40;
            let comp_uj = sonnet_compartment_uj(ai_tier, *ai_invocations)?;
            let (d_wins, d_losses) = match outcome {
                MatchOutcome::Win => (1, 0),
                MatchOutcome::Loss => (0, 1),
                MatchOutcome::Draw => (0, 0),
            };
            let elo_after = elo_step(current_elo, opponent_elo.unwrap_or(1200), *outcome);
            Ok(ComputedDelta {
                game: "sonnetman",
                kind: "verse_duel",
                loop_uj,
                comp_uj,
                d_wins,
                d_losses,
                d_verses: i32::from(*rounds_played),
                d_captures: 0,
                d_promotions: 0,
                elo_after,
            })
        }
        TransitionEvent::ChessCapture {
            ply_count,
            duel_ticks,
            ai_tier,
            ai_invocations,
            ..
        } => {
            if !(1..=300).contains(ply_count) {
                return Err("ply_count must be between 1 and 300");
            }
            if *duel_ticks > 7_200 {
                return Err("duel_ticks must be at most 7200");
            }
            let loop_uj = 3_200 + i64::from(*ply_count) * 120 + i64::from(*duel_ticks) * 15;
            let comp_uj = chess_compartment_uj(ai_tier, *ai_invocations)?;
            Ok(ComputedDelta {
                game: "chessfighter",
                kind: "chess_capture",
                loop_uj,
                comp_uj,
                d_wins: 0,
                d_losses: 0,
                d_verses: 0,
                d_captures: 1,
                d_promotions: 0,
                elo_after: (current_elo + 2).clamp(400, 3000),
            })
        }
        TransitionEvent::ChessPromotion {
            ply_count,
            duel_ticks,
            promoted_to,
            ai_tier,
            ai_invocations,
        } => {
            if !(1..=300).contains(ply_count) {
                return Err("ply_count must be between 1 and 300");
            }
            if *duel_ticks > 7_200 {
                return Err("duel_ticks must be at most 7200");
            }
            if let Some(piece) = promoted_to {
                let p = piece.trim().to_ascii_lowercase();
                if !matches!(p.as_str(), "queen" | "rook" | "bishop" | "knight" | "q" | "r" | "b" | "n") {
                    return Err("invalid promoted_to piece");
                }
            }
            let loop_uj = 6_500 + i64::from(*ply_count) * 150 + i64::from(*duel_ticks) * 15;
            let comp_uj = chess_compartment_uj(ai_tier, *ai_invocations)?;
            Ok(ComputedDelta {
                game: "chessfighter",
                kind: "chess_promotion",
                loop_uj,
                comp_uj,
                d_wins: 0,
                d_losses: 0,
                d_verses: 0,
                d_captures: 0,
                d_promotions: 1,
                elo_after: (current_elo + 4).clamp(400, 3000),
            })
        }
        TransitionEvent::ChessCrown {
            outcome,
            ply_count,
            duel_ticks,
            ai_tier,
            ai_invocations,
            opponent_elo,
        } => {
            if !(1..=300).contains(ply_count) {
                return Err("ply_count must be between 1 and 300");
            }
            if *duel_ticks > 7_200 {
                return Err("duel_ticks must be at most 7200");
            }
            let loop_uj = 12_000 + i64::from(*ply_count) * 180 + i64::from(*duel_ticks) * 20;
            let comp_uj = chess_compartment_uj(ai_tier, *ai_invocations)?;
            let (d_wins, d_losses) = match outcome {
                MatchOutcome::Win => (1, 0),
                MatchOutcome::Loss => (0, 1),
                MatchOutcome::Draw => (0, 0),
            };
            let elo_after = elo_step(current_elo, opponent_elo.unwrap_or(1200), *outcome);
            Ok(ComputedDelta {
                game: "chessfighter",
                kind: "chess_crown",
                loop_uj,
                comp_uj,
                d_wins,
                d_losses,
                d_verses: 0,
                d_captures: 0,
                d_promotions: 0,
                elo_after,
            })
        }
    }
}

// ---------------------------------------------------------------------------
// Validation Helpers & HTTP Types
// ---------------------------------------------------------------------------

pub fn normalize_card_uid(raw: &str) -> Result<String, &'static str> {
    let trimmed = raw.trim();
    if trimmed.len() < 4 || trimmed.len() > 64 {
        return Err("card_uid must be 4 to 64 characters");
    }
    if !trimmed
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("card_uid may contain only ASCII letters, digits, '-' and '_'");
    }
    Ok(trimmed.to_ascii_uppercase())
}

fn validate_archetype(raw: &str) -> Result<String, &'static str> {
    let t = raw.trim();
    if t.is_empty() || t.len() > 64 {
        return Err("archetype must be 1 to 64 characters");
    }
    if t.chars().any(|c| c.is_control()) {
        return Err("archetype contains invalid characters");
    }
    Ok(t.to_string())
}

fn validate_catalog_id(raw: Option<&str>) -> Result<Option<String>, &'static str> {
    let Some(r) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if r.len() > 16 || !r.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') {
        return Err("catalog_card_id must be up to 16 ASCII alphanumeric or '-' characters");
    }
    Ok(Some(r.to_ascii_uppercase()))
}

#[derive(Serialize)]
pub struct JouleBreakdown {
    /// Yang: deterministic game-loop microjoules (`µJ`).
    pub loop_microjoules: i64,
    /// Yin: bounded AI-judge / neural compartment microjoules (`µJ`).
    pub compartment_microjoules: i64,
    pub total_microjoules: i64,
    pub total_millijoules: f64,
    /// Share of total energy from deterministic loop work (`0.0..=1.0`).
    pub yang_share: f64,
    /// Share of total energy from bounded AI compartment work (`0.0..=1.0`).
    pub yin_share: f64,
}

impl JouleBreakdown {
    pub fn from_uj(loop_uj: i64, comp_uj: i64) -> Self {
        let total = loop_uj.saturating_add(comp_uj);
        let (yang_share, yin_share) = if total > 0 {
            (loop_uj as f64 / total as f64, comp_uj as f64 / total as f64)
        } else {
            (1.0, 0.0)
        };
        Self {
            loop_microjoules: loop_uj,
            compartment_microjoules: comp_uj,
            total_microjoules: total,
            total_millijoules: (total as f64) / 1_000.0,
            yang_share,
            yin_share,
        }
    }
}

#[derive(Serialize)]
pub struct DigiCardStateResponse {
    pub card_uid: String,
    pub owner_bound: bool,
    pub is_caller_owner: bool,
    pub catalog_card_id: Option<String>,
    pub origin_game: String,
    pub archetype: String,
    pub journey_stage: i16,
    pub journey_milestone: &'static str,
    pub rarity_tier: &'static str,
    pub elo: i32,
    pub wins: i32,
    pub losses: i32,
    pub sonnet_verses: i32,
    pub chess_captures: i32,
    pub chess_promotions: i32,
    pub sun_tap_counter: i64,
    pub transition_count: i64,
    pub joules: JouleBreakdown,
    pub state_hash: String,
    pub ed25519_sig: String,
    pub ed25519_pubkey: String,
    pub im2_token: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct TransitionRequest {
    pub sun_tap_counter: i64,
    #[serde(default)]
    pub archetype: Option<String>,
    #[serde(default)]
    pub catalog_card_id: Option<String>,
    #[serde(default)]
    pub origin_game: Option<String>,
    #[serde(default)]
    pub claim_ownership: Option<bool>,
    /// Refused when present: joule amounts are computed deterministically by the server.
    #[serde(default)]
    pub microjoules: Option<serde_json::Value>,
    #[serde(default)]
    pub millijoules: Option<serde_json::Value>,
    pub event: TransitionEvent,
}

#[derive(Serialize)]
pub struct TransitionReceiptResponse {
    pub seq: i64,
    pub game: &'static str,
    pub kind: &'static str,
    pub delta_loop_microjoules: i64,
    pub delta_compartment_microjoules: i64,
    pub delta_millijoules: f64,
    pub prev_state_hash: String,
    pub im2_token: String,
    pub card: DigiCardStateResponse,
}

// ---------------------------------------------------------------------------
// Router & Handlers
// ---------------------------------------------------------------------------

pub fn public_router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/verify", post(verify_digicard_token))
        .route("/{card_uid}", get(get_digicard))
        .route("/{card_uid}/transition", post(transition_digicard))
}

#[derive(Deserialize)]
pub struct VerifyTokenRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct VerifyTokenResponse {
    pub valid: bool,
    pub state_hash: String,
    pub ed25519_pubkey: String,
    pub rarity_tier: &'static str,
    pub journey_milestone: &'static str,
    pub total_millijoules: f64,
    pub payload: CanonicalCardPayload,
}

async fn verify_digicard_token(
    State((_, config)): State<(PgPool, Config)>,
    Json(req): Json<VerifyTokenRequest>,
) -> Result<Json<VerifyTokenResponse>, (StatusCode, String)> {
    let keypair = ed25519_keypair_from_secret(&config.jwt_secret);
    let pubkey_bytes = keypair.public_key().as_ref();
    let payload = verify_im2_token(req.token.trim(), pubkey_bytes)
        .map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?;
    let canonical_bytes = serde_json::to_vec(&payload).map_err(crate::error::internal)?;
    let state_hash = hex::encode(Sha256::digest(&canonical_bytes));
    let total_uj = payload.loop_uj.saturating_add(payload.comp_uj);
    Ok(Json(VerifyTokenResponse {
        valid: true,
        state_hash,
        ed25519_pubkey: hex::encode(pubkey_bytes),
        rarity_tier: rarity_tier_for_microjoules(total_uj),
        journey_milestone: journey_milestone_name(payload.stage),
        total_millijoules: (total_uj as f64) / 1_000.0,
        payload,
    }))
}

fn has_json_content_type(headers: &HeaderMap) -> bool {
    headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| {
            v.split(';')
                .next()
                .unwrap_or("")
                .trim()
                .eq_ignore_ascii_case("application/json")
        })
        .unwrap_or(false)
}

async fn get_digicard(
    Path(raw_uid): Path<String>,
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<Json<DigiCardStateResponse>, (StatusCode, String)> {
    let card_uid = normalize_card_uid(&raw_uid).map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?;
    let caller_id = authenticate_session(&pool, &config, &jar)
        .await
        .ok()
        .map(|s| s.claims.sub);

    let row = sqlx::query(
        "SELECT c.card_uid, c.owner_id, c.catalog_card_id, c.origin_game, c.archetype,
                c.journey_stage, c.elo, c.wins, c.losses, c.sonnet_verses,
                c.chess_captures, c.chess_promotions, c.loop_microjoules,
                c.compartment_microjoules, c.sun_tap_counter, c.state_hash,
                c.ed25519_sig, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM digi_card_transitions t WHERE t.card_uid = c.card_uid) AS tx_count,
                (SELECT t.im2_token FROM digi_card_transitions t WHERE t.card_uid = c.card_uid ORDER BY t.seq DESC LIMIT 1) AS latest_token,
                (SELECT t.prev_state_hash FROM digi_card_transitions t WHERE t.card_uid = c.card_uid ORDER BY t.seq DESC LIMIT 1) AS latest_prev_hash
         FROM digi_cards c
         WHERE c.card_uid = $1",
    )
    .bind(&card_uid)
    .fetch_optional(&pool)
    .await
    .map_err(crate::error::internal)?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Digi-Physical card not found".into()))?;

    let owner_id: Option<Uuid> = row.get("owner_id");
    let catalog_card_id: Option<String> = row.get("catalog_card_id");
    let origin_game: String = row.get("origin_game");
    let archetype: String = row.get("archetype");
    let journey_stage: i16 = row.get("journey_stage");
    let elo: i32 = row.get("elo");
    let wins: i32 = row.get("wins");
    let losses: i32 = row.get("losses");
    let sonnet_verses: i32 = row.get("sonnet_verses");
    let chess_captures: i32 = row.get("chess_captures");
    let chess_promotions: i32 = row.get("chess_promotions");
    let loop_uj: i64 = row.get("loop_microjoules");
    let comp_uj: i64 = row.get("compartment_microjoules");
    let sun_tap_counter: i64 = row.get("sun_tap_counter");
    let state_hash: String = row.get("state_hash");
    let ed25519_sig: String = row.get("ed25519_sig");
    let tx_count: i64 = row.get("tx_count");
    let latest_token: Option<String> = row.get("latest_token");
    let latest_prev_hash: Option<String> = row.get("latest_prev_hash");

    let joules = JouleBreakdown::from_uj(loop_uj, comp_uj);
    let rarity_tier = rarity_tier_for_microjoules(joules.total_microjoules);
    let keypair = ed25519_keypair_from_secret(&config.jwt_secret);
    let ed25519_pubkey = hex::encode(keypair.public_key().as_ref());

    let im2_token = match latest_token {
        Some(tok) => tok,
        None => {
            let payload = CanonicalCardPayload {
                v: 2,
                uid: card_uid.clone(),
                origin: origin_game.clone(),
                arch: archetype.clone(),
                cat: catalog_card_id.clone(),
                stage: journey_stage,
                rarity: rarity_tier.to_string(),
                elo,
                w: wins,
                l: losses,
                verses: sonnet_verses,
                captures: chess_captures,
                promotions: chess_promotions,
                loop_uj,
                comp_uj,
                ctr: sun_tap_counter,
                prev: latest_prev_hash.unwrap_or_else(|| GENESIS_PREV_HASH.to_string()),
            };
            sign_card_payload(&payload, &keypair).im2_token
        }
    };

    Ok(Json(DigiCardStateResponse {
        card_uid,
        owner_bound: owner_id.is_some(),
        is_caller_owner: owner_id.is_some() && owner_id == caller_id,
        catalog_card_id,
        origin_game,
        archetype,
        journey_stage,
        journey_milestone: journey_milestone_name(journey_stage),
        rarity_tier,
        elo,
        wins,
        losses,
        sonnet_verses,
        chess_captures,
        chess_promotions,
        sun_tap_counter,
        transition_count: tx_count,
        joules,
        state_hash,
        ed25519_sig,
        ed25519_pubkey,
        im2_token,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

async fn transition_digicard(
    Path(raw_uid): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    Json(req): Json<TransitionRequest>,
) -> Result<Json<TransitionReceiptResponse>, (StatusCode, String)> {
    // Reject cross-site non-JSON form posts; cross-origin ecosystem calls (`chessfighter.inspiredmile.com`,
    // `inspiredmile.com`) pass CORS preflight with `Content-Type: application/json`.
    if !has_json_content_type(&headers) {
        return Err((StatusCode::FORBIDDEN, "JSON content-type required".into()));
    }
    if req.microjoules.is_some() || req.millijoules.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Joule amounts are computed deterministically by the server".into(),
        ));
    }
    if req.sun_tap_counter < 1 {
        return Err((
            StatusCode::BAD_REQUEST,
            "sun_tap_counter must be at least 1".into(),
        ));
    }

    let card_uid = normalize_card_uid(&raw_uid).map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?;
    let requested_cat =
        validate_catalog_id(req.catalog_card_id.as_deref()).map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?;

    let caller_id = authenticate_session(&pool, &config, &jar)
        .await
        .ok()
        .map(|s| s.claims.sub);

    // Pre-validate event physics before opening a database transaction.
    let probe_delta =
        evaluate_transition(1200, &req.event).map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?;

    let origin_default = match req.origin_game.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some("sonnetman") => "sonnetman",
        Some("chessfighter") => "chessfighter",
        Some("inspiredmile") => "inspiredmile",
        Some(_) => return Err((StatusCode::BAD_REQUEST, "Invalid origin_game".into())),
        None => probe_delta.game,
    };

    let default_archetype = match &req.archetype {
        Some(a) => validate_archetype(a).map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?,
        None => {
            if probe_delta.game == "chessfighter" {
                "Grandmaster Knight".to_string()
            } else {
                "First Mile Poet".to_string()
            }
        }
    };

    let keypair = ed25519_keypair_from_secret(&config.jwt_secret);
    let mut tx = pool.begin().await.map_err(crate::error::internal)?;

    // Ensure genesis row exists so concurrent first-taps serialize cleanly on `FOR UPDATE`.
    let claim_on_create = if req.claim_ownership.unwrap_or(true) {
        caller_id
    } else {
        None
    };
    sqlx::query(
        "INSERT INTO digi_cards (card_uid, owner_id, catalog_card_id, origin_game, archetype, state_hash, ed25519_sig)
         VALUES ($1, $2, $3, $4, $5, $6, '')
         ON CONFLICT (card_uid) DO NOTHING",
    )
    .bind(&card_uid)
    .bind(claim_on_create)
    .bind(&requested_cat)
    .bind(origin_default)
    .bind(&default_archetype)
    .bind(GENESIS_PREV_HASH)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::internal)?;

    let row = sqlx::query(
        "SELECT owner_id, catalog_card_id, origin_game, archetype, journey_stage,
                elo, wins, losses, sonnet_verses, chess_captures, chess_promotions,
                loop_microjoules, compartment_microjoules, sun_tap_counter, state_hash, created_at
         FROM digi_cards
         WHERE card_uid = $1
         FOR UPDATE",
    )
    .bind(&card_uid)
    .fetch_one(&mut *tx)
    .await
    .map_err(crate::error::internal)?;

    let current_owner: Option<Uuid> = row.get("owner_id");
    if let Some(owner) = current_owner
        && caller_id != Some(owner)
    {
        return Err((
            StatusCode::FORBIDDEN,
            "This Digi-Physical card is bound to another account".into(),
        ));
    }

    let prev_counter: i64 = row.get("sun_tap_counter");
    if req.sun_tap_counter <= prev_counter {
        return Err((
            StatusCode::CONFLICT,
            format!(
                "Replay rejected: sun_tap_counter {} must exceed committed counter {}",
                req.sun_tap_counter, prev_counter
            ),
        ));
    }

    let prev_elo: i32 = row.get("elo");
    let delta =
        evaluate_transition(prev_elo, &req.event).map_err(|m| (StatusCode::BAD_REQUEST, m.into()))?;

    let next_owner = match (current_owner, caller_id, req.claim_ownership.unwrap_or(true)) {
        (Some(o), _, _) => Some(o),
        (None, Some(uid), true) => Some(uid),
        _ => None,
    };

    let catalog_card_id: Option<String> = row
        .get::<Option<String>, _>("catalog_card_id")
        .or(requested_cat);
    let origin_game: String = row.get("origin_game");
    let archetype: String = row.get("archetype");
    let prev_stage: i16 = row.get("journey_stage");
    let wins = row.get::<i32, _>("wins") + delta.d_wins;
    let losses = row.get::<i32, _>("losses") + delta.d_losses;
    let sonnet_verses = row.get::<i32, _>("sonnet_verses") + delta.d_verses;
    let chess_captures = row.get::<i32, _>("chess_captures") + delta.d_captures;
    let chess_promotions = row.get::<i32, _>("chess_promotions") + delta.d_promotions;
    let loop_uj = row.get::<i64, _>("loop_microjoules") + delta.loop_uj;
    let comp_uj = row.get::<i64, _>("compartment_microjoules") + delta.comp_uj;
    let total_uj = loop_uj + comp_uj;
    let next_stage = compute_journey_stage(
        prev_stage,
        wins,
        losses,
        sonnet_verses,
        chess_captures,
        chess_promotions,
        total_uj,
    );
    let rarity_tier = rarity_tier_for_microjoules(total_uj);
    let prev_hash: String = row.get("state_hash");

    let payload = CanonicalCardPayload {
        v: 2,
        uid: card_uid.clone(),
        origin: origin_game.clone(),
        arch: archetype.clone(),
        cat: catalog_card_id.clone(),
        stage: next_stage,
        rarity: rarity_tier.to_string(),
        elo: delta.elo_after,
        w: wins,
        l: losses,
        verses: sonnet_verses,
        captures: chess_captures,
        promotions: chess_promotions,
        loop_uj,
        comp_uj,
        ctr: req.sun_tap_counter,
        prev: prev_hash.clone(),
    };
    let signed = sign_card_payload(&payload, &keypair);

    let updated_at: DateTime<Utc> = sqlx::query_scalar(
        "UPDATE digi_cards SET
            owner_id = $2,
            catalog_card_id = $3,
            journey_stage = $4,
            elo = $5,
            wins = $6,
            losses = $7,
            sonnet_verses = $8,
            chess_captures = $9,
            chess_promotions = $10,
            loop_microjoules = $11,
            compartment_microjoules = $12,
            sun_tap_counter = $13,
            state_hash = $14,
            ed25519_sig = $15,
            updated_at = NOW()
         WHERE card_uid = $1
         RETURNING updated_at",
    )
    .bind(&card_uid)
    .bind(next_owner)
    .bind(&catalog_card_id)
    .bind(next_stage)
    .bind(delta.elo_after)
    .bind(wins)
    .bind(losses)
    .bind(sonnet_verses)
    .bind(chess_captures)
    .bind(chess_promotions)
    .bind(loop_uj)
    .bind(comp_uj)
    .bind(req.sun_tap_counter)
    .bind(&signed.state_hash)
    .bind(&signed.ed25519_sig)
    .fetch_one(&mut *tx)
    .await
    .map_err(crate::error::internal)?;

    let seq: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM digi_card_transitions WHERE card_uid = $1",
    )
    .bind(&card_uid)
    .fetch_one(&mut *tx)
    .await
    .map_err(crate::error::internal)?;

    let receipt_json = serde_json::to_value(&req.event).unwrap_or_else(|_| serde_json::json!({}));

    sqlx::query(
        "INSERT INTO digi_card_transitions (
            card_uid, seq, actor_id, game, kind, sun_tap_counter,
            prev_state_hash, next_state_hash,
            delta_loop_microjoules, delta_compartment_microjoules,
            elo_before, elo_after, journey_stage_after,
            receipt_json, ed25519_sig, im2_token
         ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8,
            $9, $10,
            $11, $12, $13,
            $14, $15, $16
         )",
    )
    .bind(&card_uid)
    .bind(seq)
    .bind(caller_id)
    .bind(delta.game)
    .bind(delta.kind)
    .bind(req.sun_tap_counter)
    .bind(&prev_hash)
    .bind(&signed.state_hash)
    .bind(delta.loop_uj)
    .bind(delta.comp_uj)
    .bind(prev_elo)
    .bind(delta.elo_after)
    .bind(next_stage)
    .bind(sqlx::types::Json(receipt_json))
    .bind(&signed.ed25519_sig)
    .bind(&signed.im2_token)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::internal)?;

    tx.commit().await.map_err(crate::error::internal)?;

    let joules = JouleBreakdown::from_uj(loop_uj, comp_uj);
    let created_at: DateTime<Utc> = row.get("created_at");
    let card = DigiCardStateResponse {
        card_uid,
        owner_bound: next_owner.is_some(),
        is_caller_owner: next_owner.is_some() && next_owner == caller_id,
        catalog_card_id,
        origin_game,
        archetype,
        journey_stage: next_stage,
        journey_milestone: journey_milestone_name(next_stage),
        rarity_tier,
        elo: delta.elo_after,
        wins,
        losses,
        sonnet_verses,
        chess_captures,
        chess_promotions,
        sun_tap_counter: req.sun_tap_counter,
        transition_count: seq,
        joules,
        state_hash: signed.state_hash,
        ed25519_sig: signed.ed25519_sig,
        ed25519_pubkey: signed.ed25519_pubkey,
        im2_token: signed.im2_token.clone(),
        created_at,
        updated_at,
    };

    Ok(Json(TransitionReceiptResponse {
        seq,
        game: delta.game,
        kind: delta.kind,
        delta_loop_microjoules: delta.loop_uj,
        delta_compartment_microjoules: delta.comp_uj,
        delta_millijoules: ((delta.loop_uj + delta.comp_uj) as f64) / 1_000.0,
        prev_state_hash: prev_hash,
        im2_token: signed.im2_token,
        card,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "0123456789abcdef0123456789abcdef-digicard-test";

    #[test]
    fn base64url_round_trips_arbitrary_lengths() {
        for len in 0..=65 {
            let sample: Vec<u8> = (0..len).map(|i| (i as u8).wrapping_mul(37).wrapping_add(11)).collect();
            let enc = base64url_encode(&sample);
            assert!(!enc.contains('='), "unpadded RFC 4648 base64url");
            assert_eq!(base64url_decode(&enc).unwrap(), sample);
        }
    }

    #[test]
    fn ed25519_im2_token_signs_deterministically_and_rejects_tampering() {
        let kp = ed25519_keypair_from_secret(SECRET);
        let payload = CanonicalCardPayload {
            v: 2,
            uid: "04A1B2C3D4E5F6".into(),
            origin: "sonnetman".into(),
            arch: "Hamlet".into(),
            cat: Some("DC-001".into()),
            stage: 3,
            rarity: "Forged".into(),
            elo: 1248,
            w: 4,
            l: 1,
            verses: 9,
            captures: 2,
            promotions: 1,
            loop_uj: 42_000,
            comp_uj: 48_000,
            ctr: 7,
            prev: GENESIS_PREV_HASH.into(),
        };
        let a = sign_card_payload(&payload, &kp);
        let b = sign_card_payload(&payload, &kp);
        assert_eq!(a.state_hash, b.state_hash);
        assert_eq!(a.ed25519_sig, b.ed25519_sig);
        assert_eq!(a.ed25519_sig.len(), 128, "64-byte Ed25519 signature in hex");
        assert_eq!(a.ed25519_pubkey.len(), 64, "32-byte Ed25519 public key in hex");
        assert!(a.im2_token.starts_with("IM2-"));

        let pubkey_bytes = hex::decode(&a.ed25519_pubkey).unwrap();
        let verified = verify_im2_token(&a.im2_token, &pubkey_bytes).expect("signature verifies");
        assert_eq!(verified, payload);

        // Tamper with one character in payload -> Ed25519 verification must fail
        let mut chars: Vec<char> = a.im2_token.chars().collect();
        chars[8] = if chars[8] == 'A' { 'B' } else { 'A' };
        let tampered: String = chars.into_iter().collect();
        assert!(verify_im2_token(&tampered, &pubkey_bytes).is_err());

        // Different server secret -> verification under first pubkey must fail
        let other_kp = ed25519_keypair_from_secret("another-32-byte-secret-key-for-testing!!");
        let forged = sign_card_payload(&payload, &other_kp);
        assert!(verify_im2_token(&forged.im2_token, &pubkey_bytes).is_err());
    }

    #[test]
    fn thermodynamic_rarity_and_yin_yang_joule_transitions_are_deterministic() {
        assert_eq!(rarity_tier_for_microjoules(0), "Unawakened");
        assert_eq!(rarity_tier_for_microjoules(9_999), "Unawakened");
        assert_eq!(rarity_tier_for_microjoules(10_000), "Tempered");
        assert_eq!(rarity_tier_for_microjoules(50_000), "Forged");
        assert_eq!(rarity_tier_for_microjoules(250_000), "Radiant");
        assert_eq!(rarity_tier_for_microjoules(1_000_000), "Sovereign");

        // Sonnet Man duel with Gemma standard AI judge (Yin + Yang)
        let verse = evaluate_transition(
            1200,
            &TransitionEvent::VerseDuel {
                outcome: MatchOutcome::Win,
                rounds_played: 3,
                lines_scored: 12,
                craft_score: 85,
                ai_tier: "standard".into(),
                ai_invocations: 3,
                opponent_elo: Some(1200),
            },
        )
        .unwrap();
        assert_eq!(verse.game, "sonnetman");
        assert_eq!(verse.loop_uj, 2_400 + 3 * 1_800 + 12 * 350 + 85 * 40); // 15_400 µJ
        assert_eq!(verse.comp_uj, 72_000); // 3 * 24_000 µJ
        assert_eq!(verse.elo_after, 1212);
        assert_eq!(verse.d_wins, 1);
        assert_eq!(verse.d_verses, 3);

        // Rule-only Chess Fighter capture (100% Yang, 0 Yin)
        let cap = evaluate_transition(
            verse.elo_after,
            &TransitionEvent::ChessCapture {
                ply_count: 14,
                duel_ticks: 180,
                captured_piece: Some("rook".into()),
                ai_tier: "none".into(),
                ai_invocations: 0,
            },
        )
        .unwrap();
        assert_eq!(cap.game, "chessfighter");
        assert_eq!(cap.comp_uj, 0);
        assert_eq!(cap.loop_uj, 3_200 + 14 * 120 + 180 * 15);
        assert_eq!(cap.d_captures, 1);

        // Cross-mile bridge advances card directly to Stage 3 (Company)
        let stage = compute_journey_stage(
            1,
            1,
            0,
            verse.d_verses,
            cap.d_captures,
            0,
            verse.loop_uj + verse.comp_uj + cap.loop_uj,
        );
        assert_eq!(stage, 3);
        assert_eq!(journey_milestone_name(stage), "Company");
    }

    #[test]
    fn invalid_uid_and_compartment_bounds_are_rejected() {
        assert_eq!(normalize_card_uid(" 04a1b2c3d4e5f6 ").unwrap(), "04A1B2C3D4E5F6");
        assert!(normalize_card_uid("ab").is_err());
        assert!(normalize_card_uid("bad/uid").is_err());
        assert!(evaluate_transition(
            1200,
            &TransitionEvent::VerseDuel {
                outcome: MatchOutcome::Win,
                rounds_played: 3,
                lines_scored: 8,
                craft_score: 70,
                ai_tier: "none".into(),
                ai_invocations: 2, // inconsistent!
                opponent_elo: None,
            }
        )
        .is_err());
    }
}
