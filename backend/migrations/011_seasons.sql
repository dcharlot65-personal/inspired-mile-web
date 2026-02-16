-- Battle Pass / Season System
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    max_level INT NOT NULL DEFAULT 30,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS season_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    season_id INT NOT NULL REFERENCES seasons(id),
    xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, season_id)
);

CREATE TABLE IF NOT EXISTS season_rewards (
    id SERIAL PRIMARY KEY,
    season_id INT NOT NULL REFERENCES seasons(id),
    level INT NOT NULL,
    reward_type VARCHAR(32) NOT NULL, -- 'credits', 'pack', 'card', 'title'
    reward_value VARCHAR(128) NOT NULL,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    claimed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_season_progress_user ON season_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_season_progress_season ON season_progress(season_id);
