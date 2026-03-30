-- Make current_step_index nullable so NULL can signal "no routine in progress".
-- Previously DEFAULT 0 with NOT NULL made 0 ambiguous (step 0 vs no routine).
-- NULL = no routine active; 0+ = step index within the active routine.
ALTER TABLE public.chat_sessions
  ALTER COLUMN current_step_index DROP NOT NULL,
  ALTER COLUMN current_step_index DROP DEFAULT;
