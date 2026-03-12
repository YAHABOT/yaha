-- Migration: create widgets table for customizable dashboard
-- 2026-03-12

CREATE TABLE IF NOT EXISTS public.widgets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('field_latest', 'field_average', 'field_total', 'correlator')),
  label           TEXT        NOT NULL,
  tracker_id      UUID        REFERENCES public.trackers(id) ON DELETE SET NULL,
  field_id        TEXT,
  correlation_id  UUID        REFERENCES public.correlations(id) ON DELETE SET NULL,
  days            INT         NOT NULL DEFAULT 7 CHECK (days >= 1 AND days <= 365),
  position        INT         NOT NULL DEFAULT 0,
  color           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their widgets"
  ON public.widgets
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast lookup by owner (list, reorder)
CREATE INDEX widgets_user_id_idx      ON public.widgets (user_id);
-- Ordered dashboard rendering
CREATE INDEX widgets_user_position_idx ON public.widgets (user_id, position);
