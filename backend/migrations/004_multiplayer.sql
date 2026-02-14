-- Multiplayer battle rooms and turns
CREATE TABLE battle_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(20) NOT NULL DEFAULT 'waiting',
    player1_id UUID REFERENCES users(id),
    player2_id UUID REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    total_rounds INT NOT NULL DEFAULT 3,
    current_round INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE battle_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES battle_rooms(id) ON DELETE CASCADE,
    round INT NOT NULL,
    player_id UUID NOT NULL REFERENCES users(id),
    verse TEXT NOT NULL,
    wordplay INT,
    shakespeare INT,
    flow INT,
    wit INT,
    total INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add multiplayer stats to player_stats
ALTER TABLE player_stats ADD COLUMN mp_wins INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN mp_losses INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN mp_rating INT NOT NULL DEFAULT 1000;
