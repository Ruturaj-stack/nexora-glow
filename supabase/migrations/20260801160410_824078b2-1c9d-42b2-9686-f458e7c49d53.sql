CREATE TABLE public.tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  decision text NOT NULL DEFAULT 'ask',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_permissions TO authenticated;
GRANT ALL ON public.tool_permissions TO service_role;
ALTER TABLE public.tool_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_permissions_all_own ON public.tool_permissions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tool_permissions_set_updated_at BEFORE UPDATE ON public.tool_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  category text NOT NULL DEFAULT 'system',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  error_code text,
  duration_ms integer NOT NULL DEFAULT 0,
  permission text NOT NULL DEFAULT 'none',
  runtime text NOT NULL DEFAULT 'browser',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_executions TO authenticated;
GRANT ALL ON public.tool_executions TO service_role;
ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_executions_all_own ON public.tool_executions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX tool_executions_user_created_idx ON public.tool_executions (user_id, created_at DESC);