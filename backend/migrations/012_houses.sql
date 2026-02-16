-- House Allegiance system
ALTER TABLE users ADD COLUMN IF NOT EXISTS house_allegiance VARCHAR(32);

CREATE TABLE IF NOT EXISTS house_leaderboard (
    id SERIAL PRIMARY KEY,
    house VARCHAR(32) NOT NULL,
    week_start DATE NOT NULL,
    total_xp BIGINT NOT NULL DEFAULT 0,
    total_wins INT NOT NULL DEFAULT 0,
    member_count INT NOT NULL DEFAULT 0,
    UNIQUE(house, week_start)
);

CREATE INDEX IF NOT EXISTS idx_house_leaderboard_week ON house_leaderboard(week_start DESC);
