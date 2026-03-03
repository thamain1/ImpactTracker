-- Extend impact_metrics with allocation + inventory fields
ALTER TABLE impact_metrics
  ADD COLUMN IF NOT EXISTS item_type            TEXT    NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS unit_cost            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS inventory_total      INTEGER,
  ADD COLUMN IF NOT EXISTS inventory_remaining  INTEGER,
  ADD COLUMN IF NOT EXISTS allocation_type      TEXT    NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS allocation_base_qty  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allocation_threshold  INTEGER,
  ADD COLUMN IF NOT EXISTS allocation_bonus_qty  INTEGER,
  ADD COLUMN IF NOT EXISTS custom_question_prompt TEXT;

-- Extend survey_responses with metric link + quantity
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS metric_id          INTEGER REFERENCES impact_metrics(id),
  ADD COLUMN IF NOT EXISTS quantity_delivered  INTEGER DEFAULT 1;
