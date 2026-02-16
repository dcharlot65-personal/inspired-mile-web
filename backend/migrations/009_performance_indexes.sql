-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_player_stats_wins ON player_stats(battle_wins DESC);
CREATE INDEX IF NOT EXISTS idx_card_listings_status ON card_listings(status);
CREATE INDEX IF NOT EXISTS idx_card_listings_seller ON card_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
