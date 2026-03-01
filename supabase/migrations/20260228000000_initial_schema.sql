-- ImpactTracker Initial Schema
-- Run this once in the Supabase SQL editor

-- Users table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  website TEXT,
  contact_email TEXT,
  mission TEXT,
  vision TEXT,
  annual_budget_range TEXT,
  target_population_focus TEXT,
  primary_funding_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Roles (links users to orgs)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'can_view' CHECK (role IN ('admin', 'can_edit', 'can_view', 'can_view_download')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Programs
CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'draft')),
  start_date DATE,
  end_date DATE,
  target_population TEXT,
  target_age_min INTEGER,
  target_age_max INTEGER,
  goals TEXT,
  cost_per_participant TEXT,
  locations TEXT,
  delivery_type TEXT,
  budget INTEGER,
  staff_count INTEGER,
  monthly_capacity INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Impact Metrics (per program)
CREATE TABLE IF NOT EXISTS impact_metrics (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  counts_as_participant BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Impact Entries (logged data)
CREATE TABLE IF NOT EXISTS impact_entries (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  geography_level TEXT NOT NULL CHECK (geography_level IN ('SPA', 'City', 'County', 'State')),
  geography_value TEXT NOT NULL,
  zip_code TEXT,
  geo_context JSONB,
  demographics TEXT,
  outcomes TEXT,
  metric_values JSONB NOT NULL,
  pct_completing_program DOUBLE PRECISION,
  pct_employment_gained DOUBLE PRECISION,
  pct_housing_secured DOUBLE PRECISION,
  pct_grade_improvement DOUBLE PRECISION,
  pct_recidivism_reduction DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Service Areas (org geographic footprint)
CREATE TABLE IF NOT EXISTS service_areas (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Census Cache (30-day ACS data cache)
CREATE TABLE IF NOT EXISTS census_cache (
  id SERIAL PRIMARY KEY,
  geography_level TEXT NOT NULL,
  geography_value TEXT NOT NULL,
  state_code TEXT,
  total_population INTEGER,
  poverty_count INTEGER,
  poverty_universe INTEGER,
  median_income INTEGER,
  data_year INTEGER NOT NULL,
  fetched_at TIMESTAMP DEFAULT NOW()
);
