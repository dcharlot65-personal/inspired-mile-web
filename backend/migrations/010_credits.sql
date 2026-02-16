-- Credits system: in-game currency for the Inspired Mile economy
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 0;
