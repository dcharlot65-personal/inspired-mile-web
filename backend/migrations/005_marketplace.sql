-- Card marketplace listings and trades
CREATE TABLE card_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id),
    card_id VARCHAR(16) NOT NULL,
    listing_type VARCHAR(10) NOT NULL DEFAULT 'sale', -- 'sale' or 'trade'
    price_credits INT, -- internal currency price for sales
    wanted_card_ids TEXT[], -- card IDs wanted in trade
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, sold, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES card_listings(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    offered_card_id VARCHAR(16),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_status ON card_listings(status);
CREATE INDEX idx_listings_seller ON card_listings(seller_id);
