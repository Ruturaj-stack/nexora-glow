CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  enabled boolean NOT NULL DEFAULT true,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_id text NOT NULL DEFAULT '',
  runs integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  last_status text NOT NULL DEFAULT 'idle',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflows_all_own ON public.workflows FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER workflows_set_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX workflows_user_idx ON public.workflows(user_id, updated_at DESC);

CREATE TABLE public.workflow_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'manual',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers TO authenticated;
GRANT ALL ON public.workflow_triggers TO service_role;
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_triggers_all_own ON public.workflow_triggers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER workflow_triggers_set_updated_at BEFORE UPDATE ON public.workflow_triggers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX workflow_triggers_workflow_idx ON public.workflow_triggers(workflow_id);

CREATE TABLE public.workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  workflow_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'manual',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  duration_ms integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO authenticated;
GRANT ALL ON public.workflow_executions TO service_role;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_executions_all_own ON public.workflow_executions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workflow_executions_user_idx ON public.workflow_executions(user_id, created_at DESC);

CREATE TABLE public.plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '1.0.0',
  source text NOT NULL DEFAULT 'official',
  enabled boolean NOT NULL DEFAULT true,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plugin_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plugins TO authenticated;
GRANT ALL ON public.plugins TO service_role;
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY plugins_all_own ON public.plugins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER plugins_set_updated_at BEFORE UPDATE ON public.plugins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();