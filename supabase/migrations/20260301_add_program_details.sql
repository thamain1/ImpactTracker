-- Migration: Add Program Details fields (MOU — item 1)
-- delivery_type, budget, staff_count, monthly_capacity

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS delivery_type text,
  ADD COLUMN IF NOT EXISTS budget integer,
  ADD COLUMN IF NOT EXISTS staff_count integer,
  ADD COLUMN IF NOT EXISTS monthly_capacity integer;
