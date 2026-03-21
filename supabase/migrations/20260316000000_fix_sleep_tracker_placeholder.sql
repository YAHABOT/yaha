-- Migration: fix placeholder UUID in routine steps
-- Replaces 'SLEEP_TRACKER_ID_PLACEHOLDER' in routines.steps with the real
-- sleep tracker id for each user.  Safe to run multiple times (idempotent).

UPDATE routines r
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN (step->>'trackerId') = 'SLEEP_TRACKER_ID_PLACEHOLDER'
      THEN jsonb_set(
        step,
        '{trackerId}',
        to_jsonb((
          SELECT id::text
          FROM trackers
          WHERE user_id = r.user_id
            AND LOWER(name) LIKE '%sleep%'
          LIMIT 1
        ))
      )
      ELSE step
    END
  )
  FROM jsonb_array_elements(r.steps) AS step
)
WHERE steps::text LIKE '%SLEEP_TRACKER_ID_PLACEHOLDER%';
