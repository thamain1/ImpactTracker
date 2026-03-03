-- Program-level zip code override (falls back to org zip when not set)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS zip_code TEXT;
