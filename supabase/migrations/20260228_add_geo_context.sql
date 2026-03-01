-- Add geo_context JSONB column to impact_entries
-- Stores the full geographic hierarchy resolved from a zip code
-- e.g. {"spa":"SPA 6","city":"Los Angeles","county":"Los Angeles County","state":"California"}
ALTER TABLE impact_entries
  ADD COLUMN IF NOT EXISTS geo_context jsonb;
