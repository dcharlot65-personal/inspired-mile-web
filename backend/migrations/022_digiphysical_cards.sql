-- Inspired Mile Unified Digi-Physical Card & Joule State-Machine Ledger (additive migration).
-- Tracks canonical state, monotonic NTAG424 DNA SUN tap counters, and Yin/Yang Joule-State work
-- across First Mile (`sonnetman`) and Second Mile (`chessfighter`).

CREATE TABLE IF NOT EXISTS digi_cards (
    card_uid VARCHAR(64) PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    catalog_card_id VARCHAR(16),
    origin_game VARCHAR(32) NOT NULL CHECK (origin_game IN ('sonnetman', 'chessfighter', 'inspiredmile')),
    archetype VARCHAR(64) NOT NULL,
    journey_stage SMALLINT NOT NULL DEFAULT 0 CHECK (journey_stage BETWEEN 0 AND 5),
    elo INT NOT NULL DEFAULT 1200 CHECK (elo BETWEEN 100 AND 4000),
    wins INT NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses INT NOT NULL DEFAULT 0 CHECK (losses >= 0),
    sonnet_verses INT NOT NULL DEFAULT 0 CHECK (sonnet_verses >= 0),
    chess_captures INT NOT NULL DEFAULT 0 CHECK (chess_captures >= 0),
    chess_promotions INT NOT NULL DEFAULT 0 CHECK (chess_promotions >= 0),
    loop_microjoules BIGINT NOT NULL DEFAULT 0 CHECK (loop_microjoules >= 0),
    compartment_microjoules BIGINT NOT NULL DEFAULT 0 CHECK (compartment_microjoules >= 0),
    sun_tap_counter BIGINT NOT NULL DEFAULT 0 CHECK (sun_tap_counter >= 0),
    state_hash VARCHAR(64) NOT NULL,
    ed25519_sig VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digi_cards_owner ON digi_cards(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_digi_cards_origin ON digi_cards(origin_game, updated_at DESC);

CREATE TABLE IF NOT EXISTS digi_card_transitions (
    id BIGSERIAL PRIMARY KEY,
    card_uid VARCHAR(64) NOT NULL REFERENCES digi_cards(card_uid) ON DELETE CASCADE,
    seq BIGINT NOT NULL CHECK (seq >= 1),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    game VARCHAR(32) NOT NULL CHECK (game IN ('sonnetman', 'chessfighter')),
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('verse_duel', 'chess_capture', 'chess_promotion', 'chess_crown')),
    sun_tap_counter BIGINT NOT NULL CHECK (sun_tap_counter >= 1),
    prev_state_hash VARCHAR(64) NOT NULL,
    next_state_hash VARCHAR(64) NOT NULL,
    delta_loop_microjoules BIGINT NOT NULL CHECK (delta_loop_microjoules >= 0),
    delta_compartment_microjoules BIGINT NOT NULL CHECK (delta_compartment_microjoules >= 0),
    elo_before INT NOT NULL,
    elo_after INT NOT NULL,
    journey_stage_after SMALLINT NOT NULL CHECK (journey_stage_after BETWEEN 0 AND 5),
    receipt_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ed25519_sig VARCHAR(128) NOT NULL,
    im2_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (card_uid, seq),
    UNIQUE (card_uid, sun_tap_counter)
);

CREATE INDEX IF NOT EXISTS idx_digi_card_transitions_uid ON digi_card_transitions(card_uid, seq DESC);
