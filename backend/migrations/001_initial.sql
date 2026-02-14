-- Inspired Mile V2: Initial schema

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE owned_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(32) NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'owned'
);

CREATE INDEX idx_owned_cards_user ON owned_cards(user_id);
CREATE INDEX idx_owned_cards_card ON owned_cards(user_id, card_id);

CREATE TABLE owned_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id VARCHAR(32) NOT NULL,
    base_card_id VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(32) NOT NULL,
    UNIQUE(user_id, variant_id)
);

CREATE INDEX idx_owned_variants_user ON owned_variants(user_id);
CREATE INDEX idx_owned_variants_base ON owned_variants(user_id, base_card_id);

CREATE TABLE player_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    battle_wins INT NOT NULL DEFAULT 0,
    total_battles INT NOT NULL DEFAULT 0,
    total_rounds INT NOT NULL DEFAULT 0,
    highest_score INT NOT NULL DEFAULT 0,
    trivia_correct INT NOT NULL DEFAULT 0,
    trivia_perfect INT NOT NULL DEFAULT 0,
    challenges_completed INT NOT NULL DEFAULT 0,
    unique_cards INT NOT NULL DEFAULT 0,
    total_cards INT NOT NULL DEFAULT 0,
    packs_opened INT NOT NULL DEFAULT 0,
    variants_unlocked INT NOT NULL DEFAULT 0,
    unique_cities INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE unlocked_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(32) NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_achievements_user ON unlocked_achievements(user_id);

CREATE TABLE migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    cards_count INT DEFAULT 0,
    achievements_count INT DEFAULT 0
);

CREATE INDEX idx_migration_user ON migration_log(user_id);
