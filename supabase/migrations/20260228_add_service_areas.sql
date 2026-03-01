-- Service Areas table
-- Named geographic regions scoped per organization, used for map geocoding in reports.
-- Add coordinates for any city, county, SPA, or custom region — Nominatim fallback
-- is used only when a location name is NOT found in this table.

CREATE TABLE IF NOT EXISTS service_areas (
  id          SERIAL PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_areas_org_id ON service_areas(org_id);
