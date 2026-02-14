use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::Rng;
use sqlx::PgPool;

const NONCE_LENGTH: usize = 32;

/// Generate a random nonce, store it, return the signable message string.
pub async fn create_nonce(pool: &PgPool, wallet_address: &str) -> Result<String, String> {
    let nonce: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(NONCE_LENGTH)
        .map(char::from)
        .collect();

    // Upsert: replace any existing nonce for this wallet
    sqlx::query(
        "INSERT INTO wallet_nonces (wallet_address, nonce, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (wallet_address) DO UPDATE SET nonce = $2, created_at = NOW()",
    )
    .bind(wallet_address)
    .bind(&nonce)
    .execute(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    Ok(format_message(&nonce))
}

/// Verify a signed nonce.
pub async fn verify_wallet_signature(
    pool: &PgPool,
    wallet_address: &str,
    signature_bs58: &str,
) -> Result<(), String> {
    // Fetch nonce from DB (valid for 5 minutes)
    let nonce: String = sqlx::query_scalar(
        "SELECT nonce FROM wallet_nonces
         WHERE wallet_address = $1
           AND created_at > NOW() - INTERVAL '5 minutes'",
    )
    .bind(wallet_address)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?
    .ok_or_else(|| "No valid nonce found for this wallet".to_string())?;

    let expected_message = format_message(&nonce);

    // Decode wallet address (base58) -> 32-byte public key
    let pubkey_bytes: [u8; 32] = bs58::decode(wallet_address)
        .into_vec()
        .map_err(|e| format!("Invalid wallet address: {e}"))?
        .try_into()
        .map_err(|_| "Wallet address must decode to 32 bytes".to_string())?;

    let verifying_key =
        VerifyingKey::from_bytes(&pubkey_bytes).map_err(|e| format!("Invalid public key: {e}"))?;

    // Decode signature (base58) -> 64-byte ed25519 signature
    let sig_bytes: [u8; 64] = bs58::decode(signature_bs58)
        .into_vec()
        .map_err(|e| format!("Invalid signature encoding: {e}"))?
        .try_into()
        .map_err(|_| "Signature must decode to 64 bytes".to_string())?;

    let signature = Signature::from_bytes(&sig_bytes);

    // Verify
    verifying_key
        .verify(expected_message.as_bytes(), &signature)
        .map_err(|_| "Signature verification failed".to_string())?;

    // Delete used nonce
    let _ = sqlx::query("DELETE FROM wallet_nonces WHERE wallet_address = $1")
        .bind(wallet_address)
        .execute(pool)
        .await;

    Ok(())
}

/// Periodic cleanup of expired nonces.
pub async fn cleanup_expired_nonces(pool: &PgPool) {
    let _ = sqlx::query("DELETE FROM wallet_nonces WHERE created_at < NOW() - INTERVAL '10 minutes'")
        .execute(pool)
        .await;
}

fn format_message(nonce: &str) -> String {
    format!("Sign this message to authenticate with Inspired Mile.\n\nNonce: {nonce}")
}
