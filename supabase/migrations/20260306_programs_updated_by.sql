-- Track who last edited a program via the Edit Program feature.
-- updated_at and updated_by are set on PUT /api/programs/:id.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
