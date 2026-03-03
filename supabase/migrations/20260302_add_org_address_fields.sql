-- Split address into structured fields + zip for geographic default resolution
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_city   TEXT,
  ADD COLUMN IF NOT EXISTS address_state  TEXT,
  ADD COLUMN IF NOT EXISTS address_zip    TEXT;
