CREATE TABLE IF NOT EXISTS builder_sessions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  messages   JSONB   NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_sessions_user_id    ON builder_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_builder_sessions_updated_at ON builder_sessions(updated_at);
