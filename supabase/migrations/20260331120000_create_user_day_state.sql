-- Create user_day_state table to track daily session state
CREATE TABLE user_day_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,  -- YYYY-MM-DD format (client local date)
  day_started_at TIMESTAMPTZ,
  day_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_day_state ENABLE ROW LEVEL SECURITY;

-- Users can only access their own day state
CREATE POLICY "Users own their day state"
ON user_day_state FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX user_day_state_user_id_date_idx
ON user_day_state(user_id, date DESC);

CREATE INDEX user_day_state_user_id_open_idx
ON user_day_state(user_id) WHERE day_ended_at IS NULL;
