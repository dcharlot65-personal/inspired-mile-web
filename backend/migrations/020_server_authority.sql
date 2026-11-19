-- The server is the authority over the economy and rankings (owner, 2026-11-19; docs/ECONOMY.md).
-- Like every migration here this only adds: an older binary keeps working against it.

-- Online results. battle_rooms (004) was never written until now: each match the server judged
-- is one row of it (multiplayer/results.rs), so tournament_matches.room_id, which references it,
-- points at a real result. The verses are not stored (the privacy policy's promise).
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS end_reason VARCHAR(16);
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS rounds_won_1 INT NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS rounds_won_2 INT NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS points_1 INT NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS points_2 INT NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS best_round_1 INT NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS best_round_2 INT NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_battle_rooms_player1_done ON battle_rooms(player1_id) WHERE state = 'completed';
CREATE INDEX IF NOT EXISTS idx_battle_rooms_player2_done ON battle_rooms(player2_id) WHERE state = 'completed';

-- A card on sale is locked to its listing (owned_cards.state = 'listed'), and a sale moves that
-- very row to the buyer. One active listing per card.
ALTER TABLE card_listings ADD COLUMN IF NOT EXISTS owned_card_id UUID REFERENCES owned_cards(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS card_listings_one_active_per_card ON card_listings(owned_card_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_owned_cards_held ON owned_cards(user_id, card_id, state);

-- The free packs the server gave: the starter pack once per account, the daily pack once in
-- every 24 hours.
CREATE TABLE IF NOT EXISTS pack_claims (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('starter', 'daily')),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS pack_claims_starter_once ON pack_claims(user_id) WHERE kind = 'starter';
CREATE INDEX IF NOT EXISTS idx_pack_claims_user ON pack_claims(user_id, kind, claimed_at);

-- Season rewards are claimed by each player (011 kept one flag per reward, for everyone).
CREATE TABLE IF NOT EXISTS season_reward_claims (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id INT NOT NULL REFERENCES seasons(id),
    level INT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, season_id, level)
);

-- XP is logged as credits are, so that its daily caps can be counted.
CREATE TABLE IF NOT EXISTS xp_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id INT NOT NULL REFERENCES seasons(id),
    amount INT NOT NULL,
    source VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_tx_user_source_date ON xp_transactions(user_id, source, created_at);

-- Daily caps count the credit log by source and day.
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_source_date ON credit_transactions(user_id, source, created_at);
