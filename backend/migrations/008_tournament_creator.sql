-- Track tournament creator for ownership and accountability
ALTER TABLE tournaments ADD COLUMN created_by UUID REFERENCES users(id);
