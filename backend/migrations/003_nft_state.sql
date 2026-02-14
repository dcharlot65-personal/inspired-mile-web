-- Add NFT minting state to owned_cards
ALTER TABLE owned_cards ADD COLUMN mint_address VARCHAR(64);
ALTER TABLE owned_cards ADD COLUMN mint_signature VARCHAR(128);
ALTER TABLE owned_cards ADD COLUMN minted_at TIMESTAMPTZ;
