-- Migration: Add Org Context fields (MOU — item 2)
-- annual_budget_range, target_population_focus, primary_funding_type

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS annual_budget_range text,
  ADD COLUMN IF NOT EXISTS target_population_focus text,
  ADD COLUMN IF NOT EXISTS primary_funding_type text;
