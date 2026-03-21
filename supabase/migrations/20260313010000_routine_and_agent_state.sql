-- Add routine and agent tracking to chat_sessions
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS active_routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS current_step_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_agent_id UUID; -- REFERENCES agents(id) added after table creation

-- Create AGENTS table
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  exit_trigger TEXT NOT NULL DEFAULT 'exit',
  system_prompt TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#a855f7',
  schema JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their agents" ON public.agents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX agents_user_id_idx ON public.agents(user_id);

-- Add ForeignKey to chat_sessions for active_agent_id
ALTER TABLE public.chat_sessions
ADD CONSTRAINT chat_sessions_active_agent_id_fkey 
FOREIGN KEY (active_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

-- Trigger for agents updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
