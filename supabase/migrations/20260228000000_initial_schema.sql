-- ImpactTracker Initial Schema
-- Run this in the Supabase SQL editor after creating the project.
-- No RLS needed — backend uses service role key, auth enforced in Express middleware.

-- Users table (mirrors auth.users UUIDs)
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Roles (multi-tenant membership)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'can_view' CHECK (role IN ('admin', 'can_edit', 'can_view', 'can_view_download')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Programs
CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- Impact Metrics (per-program metric definitions)
CREATE TABLE IF NOT EXISTS impact_metrics (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  counts_as_participant BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Impact Entries (logged data points)
CREATE TABLE IF NOT EXISTS impact_entries (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  geography_level TEXT NOT NULL CHECK (geography_level IN ('SPA', 'City', 'County', 'State')),
  geography_value TEXT NOT NULL,
  zip_code TEXT,
  demographics TEXT,
  outcomes TEXT,
  metric_values JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Census Cache (30-day cached Census Bureau data)
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

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON user_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_programs_org_id ON programs(org_id);
CREATE INDEX IF NOT EXISTS idx_impact_metrics_program_id ON impact_metrics(program_id);
CREATE INDEX IF NOT EXISTS idx_impact_entries_program_id ON impact_entries(program_id);
CREATE INDEX IF NOT EXISTS idx_census_cache_geo ON census_cache(geography_level, geography_value);
