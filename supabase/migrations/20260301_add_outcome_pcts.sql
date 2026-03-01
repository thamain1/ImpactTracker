-- Migration: Add Outcome Percentage fields to impact_entries (MOU — item 4)
-- pct_completing_program, pct_employment_gained, pct_housing_secured,
-- pct_grade_improvement, pct_recidivism_reduction

ALTER TABLE impact_entries
  ADD COLUMN IF NOT EXISTS pct_completing_program double precision,
  ADD COLUMN IF NOT EXISTS pct_employment_gained double precision,
  ADD COLUMN IF NOT EXISTS pct_housing_secured double precision,
  ADD COLUMN IF NOT EXISTS pct_grade_improvement double precision,
  ADD COLUMN IF NOT EXISTS pct_recidivism_reduction double precision;
