-- Add optional flag to impact_metrics
-- optional=FALSE (default) means the metric is auto-included on every check-in (no checkbox in kiosk)
-- optional=TRUE means it shows as a checkbox the participant can uncheck
ALTER TABLE impact_metrics ADD COLUMN IF NOT EXISTS optional BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark Girls Move Forward Transportation as optional
UPDATE impact_metrics SET optional = TRUE WHERE program_id = 21 AND name = 'Transportation';
