CREATE TABLE IF NOT EXISTS early_access_submissions (
  id                SERIAL PRIMARY KEY,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  role              TEXT NOT NULL,
  email             TEXT NOT NULL,
  program_count     TEXT NOT NULL,
  tracking_method   TEXT NOT NULL,
  biggest_challenge TEXT NOT NULL,
  submitted_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_early_access_email       ON early_access_submissions(email);
CREATE INDEX IF NOT EXISTS idx_early_access_submitted_at ON early_access_submissions(submitted_at DESC);
