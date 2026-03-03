CREATE TABLE IF NOT EXISTS survey_responses (
  id               SERIAL PRIMARY KEY,
  program_id       INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  respondent_type  TEXT    NOT NULL,
  resource_selected TEXT,
  email            TEXT,
  sex              TEXT,
  age_range        TEXT,
  family_size      INTEGER,
  household_income TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);
