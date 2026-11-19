//! Credits, XP and cards as the server moves them.
//!
//! Every movement happens inside the caller's transaction, after the account it touches is
//! locked (`lock_account`: its `player_stats` row, `FOR UPDATE`), so two requests of one account
//! are never both past a cap, a balance check or a once-only check. Every credit movement is
//! logged in `credit_transactions` and every XP movement in `xp_transactions`, and the daily
//! caps are counted from those logs. Every amount comes from `inspired_mile_api::economy::RULES`;
//! nothing here takes an amount from a client.
//!
//! "Today" is the UTC calendar day (`today_utc!`), for every cap and for the teen spending limit.

use axum::http::StatusCode;
use inspired_mile_api::economy::{self, Rate, RULES};
use sqlx::{PgConnection, Row};
use uuid::Uuid;

/// The start of the current UTC day, as SQL. A macro so the statements stay literals.
macro_rules! today_utc {
    () => {
        "(date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')"
    };
}

/// Lock the account's economy row and return its balance. Creates the row if an older account
/// has none. Every function below expects the account locked in the same transaction.
pub async fn lock_account(conn: &mut PgConnection, user_id: Uuid) -> Result<i32, sqlx::Error> {
    sqlx::query("INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query_scalar("SELECT credits FROM player_stats WHERE user_id = $1 FOR UPDATE")
        .bind(user_id)
        .fetch_one(&mut *conn)
        .await
}

/// Lock two accounts, always in the same order, so two transactions that lock the same pair
/// cannot wait on each other.
pub async fn lock_accounts(conn: &mut PgConnection, a: Uuid, b: Uuid) -> Result<(), sqlx::Error> {
    let (first, second) = if a < b { (a, b) } else { (b, a) };
    lock_account(&mut *conn, first).await?;
    if second != first {
        lock_account(&mut *conn, second).await?;
    }
    Ok(())
}

/// Credits earned today from `source`, counted in rows.
pub async fn earnings_today(conn: &mut PgConnection, user_id: Uuid, source: &str) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(concat!(
        "SELECT COUNT(*) FROM credit_transactions
         WHERE user_id = $1 AND direction = 'earn' AND source = $2 AND created_at >= ",
        today_utc!()
    ))
    .bind(user_id)
    .bind(source)
    .fetch_one(&mut *conn)
    .await
}

/// Credits the account has spent today, in credits.
pub async fn spent_today(conn: &mut PgConnection, user_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(concat!(
        "SELECT COALESCE(SUM(amount), 0)::BIGINT FROM credit_transactions
         WHERE user_id = $1 AND direction = 'spend' AND created_at >= ",
        today_utc!()
    ))
    .bind(user_id)
    .fetch_one(&mut *conn)
    .await
}

/// Add `amount` credits, logged as earned from `source`. Returns the new balance.
pub async fn credit(conn: &mut PgConnection, user_id: Uuid, amount: i32, source: &str) -> Result<i32, sqlx::Error> {
    let balance: i32 = sqlx::query_scalar(
        "UPDATE player_stats SET credits = credits + $2, updated_at = NOW() WHERE user_id = $1 RETURNING credits",
    )
    .bind(user_id)
    .bind(amount)
    .fetch_one(&mut *conn)
    .await?;
    log(&mut *conn, user_id, amount, "earn", source).await?;
    Ok(balance)
}

/// Why credits could not be taken.
#[derive(Debug)]
pub enum Debit {
    Insufficient,
    /// A teen account would pass its daily limit: what it has spent today.
    TeenLimit(i64),
    Db(sqlx::Error),
}

impl From<sqlx::Error> for Debit {
    fn from(e: sqlx::Error) -> Self {
        Self::Db(e)
    }
}

impl Debit {
    /// The answer, in the words `src/lib/api-errors.ts` knows.
    pub fn refusal(self) -> (StatusCode, String) {
        match self {
            Self::Insufficient => (StatusCode::BAD_REQUEST, "Insufficient credits".into()),
            Self::TeenLimit(spent) => (
                StatusCode::FORBIDDEN,
                format!(
                    "Daily spending limit reached ({}/{} credits/day for players under 18)",
                    spent, RULES.teen_daily_spend
                ),
            ),
            Self::Db(e) => crate::error::internal(e),
        }
    }
}

/// Take `amount` credits for `source`: refused when the balance is short, or when a teen account
/// would pass its daily limit. Returns the new balance.
pub async fn debit(conn: &mut PgConnection, user_id: Uuid, amount: i32, source: &str) -> Result<i32, Debit> {
    let age_tier: String = sqlx::query_scalar("SELECT age_tier FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&mut *conn)
        .await?
        .unwrap_or_else(|| "unknown".into());
    if age_tier == "teen" {
        let spent = spent_today(&mut *conn, user_id).await?;
        if !economy::teen_allows(spent, amount) {
            return Err(Debit::TeenLimit(spent));
        }
    }
    let balance: Option<i32> = sqlx::query_scalar(
        "UPDATE player_stats SET credits = credits - $2, updated_at = NOW()
         WHERE user_id = $1 AND credits >= $2 RETURNING credits",
    )
    .bind(user_id)
    .bind(amount)
    .fetch_optional(&mut *conn)
    .await?;
    let balance = balance.ok_or(Debit::Insufficient)?;
    log(&mut *conn, user_id, amount, "spend", source).await?;
    Ok(balance)
}

async fn log(conn: &mut PgConnection, user_id: Uuid, amount: i32, direction: &str, source: &str) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO credit_transactions (user_id, amount, direction, source) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(amount)
        .bind(direction)
        .bind(source)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// What a capped grant came to.
#[derive(Debug, Clone, Copy)]
pub struct Granted {
    /// What was added now: the rate's amount, or 0 once today's cap is reached.
    pub granted: i32,
    /// Grants from this source today, this one included.
    pub today: i64,
    /// The new total (the balance, or the season's XP).
    pub total: i32,
}

/// Pay `rate` in credits for `source`, unless the account has been paid for it `rate.per_day`
/// times today.
pub async fn credit_capped(conn: &mut PgConnection, user_id: Uuid, source: &str, rate: Rate) -> Result<Granted, sqlx::Error> {
    let before = earnings_today(&mut *conn, user_id, source).await?;
    if before >= rate.per_day {
        let total: i32 = sqlx::query_scalar("SELECT credits FROM player_stats WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&mut *conn)
            .await?;
        return Ok(Granted { granted: 0, today: before, total });
    }
    let total = credit(&mut *conn, user_id, rate.amount, source).await?;
    Ok(Granted { granted: rate.amount, today: before + 1, total })
}

/// The season being played, if any: its id and highest level.
pub async fn active_season(conn: &mut PgConnection) -> Result<Option<(i32, i32)>, sqlx::Error> {
    let row = sqlx::query("SELECT id, max_level FROM seasons WHERE active = TRUE ORDER BY id LIMIT 1")
        .fetch_optional(&mut *conn)
        .await?;
    Ok(row.map(|r| (r.get("id"), r.get("max_level"))))
}

/// XP needed to reach `level` (level 1 at nothing).
pub fn xp_for_level(level: i32) -> i32 {
    level * 200
}

/// The level `xp` reaches in a season of `max_level`.
pub fn level_for(xp: i32, max_level: i32) -> i32 {
    let mut level = 1;
    while level < max_level && xp >= xp_for_level(level + 1) {
        level += 1;
    }
    level
}

/// Pay `rate` in XP for `source` in `season`, unless paid `rate.per_day` times today.
/// Returns what was granted and the season's XP after it.
pub async fn xp_capped(
    conn: &mut PgConnection,
    user_id: Uuid,
    (season_id, max_level): (i32, i32),
    source: &str,
    rate: Rate,
) -> Result<Granted, sqlx::Error> {
    let before: i64 = sqlx::query_scalar(concat!(
        "SELECT COUNT(*) FROM xp_transactions WHERE user_id = $1 AND source = $2 AND created_at >= ",
        today_utc!()
    ))
    .bind(user_id)
    .bind(source)
    .fetch_one(&mut *conn)
    .await?;
    let granted = if before >= rate.per_day { 0 } else { rate.amount };
    let xp: i32 = sqlx::query_scalar(
        "INSERT INTO season_progress (user_id, season_id, xp, level) VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, season_id) DO UPDATE SET xp = season_progress.xp + $3, updated_at = NOW()
         RETURNING xp",
    )
    .bind(user_id)
    .bind(season_id)
    .bind(granted)
    .fetch_one(&mut *conn)
    .await?;
    sqlx::query("UPDATE season_progress SET level = $3 WHERE user_id = $1 AND season_id = $2")
        .bind(user_id)
        .bind(season_id)
        .bind(level_for(xp, max_level))
        .execute(&mut *conn)
        .await?;
    if granted > 0 {
        sqlx::query("INSERT INTO xp_transactions (user_id, season_id, amount, source) VALUES ($1, $2, $3, $4)")
            .bind(user_id)
            .bind(season_id)
            .bind(granted)
            .bind(source)
            .execute(&mut *conn)
            .await?;
    }
    Ok(Granted { granted, today: before + i64::from(granted > 0), total: xp })
}

/// Give the account these cards (catalogue ids, checked by the caller), from `source`.
/// Returns each new row's id with its card id.
pub async fn grant_cards(conn: &mut PgConnection, user_id: Uuid, cards: &[String], source: &str) -> Result<Vec<(Uuid, String)>, sqlx::Error> {
    let mut rows = Vec::with_capacity(cards.len());
    for card_id in cards {
        let id: Uuid = sqlx::query_scalar("INSERT INTO owned_cards (user_id, card_id, source) VALUES ($1, $2, $3) RETURNING id")
            .bind(user_id)
            .bind(card_id)
            .bind(source)
            .fetch_one(&mut *conn)
            .await?;
        rows.push((id, card_id.clone()));
    }
    update_card_counts(&mut *conn, user_id).await?;
    Ok(rows)
}

/// Count one more pack the server opened for the account.
pub async fn count_pack(conn: &mut PgConnection, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE player_stats SET packs_opened = packs_opened + 1, updated_at = NOW() WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// Keep `player_stats`' card counts equal to what `owned_cards` holds.
pub async fn update_card_counts(conn: &mut PgConnection, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE player_stats SET
           unique_cards = (SELECT COUNT(DISTINCT card_id) FROM owned_cards WHERE user_id = $1)::int,
           total_cards = (SELECT COUNT(*) FROM owned_cards WHERE user_id = $1)::int,
           updated_at = NOW()
         WHERE user_id = $1",
    )
    .bind(user_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_follow_the_curve_and_stop_at_the_top() {
        assert_eq!(level_for(0, 30), 1);
        assert_eq!(level_for(399, 30), 1);
        assert_eq!(level_for(400, 30), 2);
        assert_eq!(level_for(1_000_000, 30), 30);
    }
}
