-- A tournament match nobody plays no longer stops its tournament (docs/ECONOMY.md, "Tournaments").
-- Like every migration here this only adds: an older binary keeps working against it.
--
-- play_by: when the match is to have been played, set once both its players are known
--   (backend/data/economy.json tournaments.match_hours; a round robin's round r gets r times that).
-- waited_1 / waited_2: when player 1 or 2 sat ready in the match's room until its time to arrive
--   ran out while the other never came (multiplayer/results.rs, tournaments/progress.rs).
-- decided_by: how the match was decided: room, bye, no_show, lot or unplayed.
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS play_by TIMESTAMPTZ;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS waited_1 TIMESTAMPTZ;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS waited_2 TIMESTAMPTZ;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS decided_by VARCHAR(16);

-- The scheduler's look for matches past their time.
CREATE INDEX IF NOT EXISTS idx_tournament_matches_due ON tournament_matches(play_by)
    WHERE status IN ('pending', 'in_progress');
