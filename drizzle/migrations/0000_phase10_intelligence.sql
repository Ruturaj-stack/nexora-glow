CREATE TABLE public.scheduled_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'reminder',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  due_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  recurrence jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  snooze_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_reminders TO authenticated;
GRANT ALL ON public.scheduled_reminders TO service_role;
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_reminders_all_own ON public.scheduled_reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER scheduled_reminders_set_updated_at BEFORE UPDATE ON public.scheduled_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX scheduled_reminders_user_due_idx ON public.scheduled_reminders(user_id, status, due_at);

CREATE TABLE public.mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  transport text NOT NULL DEFAULT 'streamable-http',
  auth_header_name text NOT NULL DEFAULT '',
  auth_token_encrypted text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'disconnected',
  last_error text NOT NULL DEFAULT '',
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_servers TO authenticated;
GRANT ALL ON public.mcp_servers TO service_role;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_servers_all_own ON public.mcp_servers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mcp_servers_set_updated_at BEFORE UPDATE ON public.mcp_servers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX mcp_servers_user_idx ON public.mcp_servers(user_id, updated_at DESC);

CREATE TABLE public.mcp_tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  decision text NOT NULL DEFAULT 'ask',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, server_id, tool_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_tool_permissions TO authenticated;
GRANT ALL ON public.mcp_tool_permissions TO service_role;
ALTER TABLE public.mcp_tool_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_tool_permissions_all_own ON public.mcp_tool_permissions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mcp_tool_permissions_set_updated_at BEFORE UPDATE ON public.mcp_tool_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'connected',
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY connected_accounts_all_own ON public.connected_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER connected_accounts_set_updated_at BEFORE UPDATE ON public.connected_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX connected_accounts_user_idx ON public.connected_accounts(user_id);

CREATE TABLE public.web_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query text NOT NULL,
  provider text NOT NULL DEFAULT 'firecrawl',
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.web_searches TO authenticated;
GRANT ALL ON public.web_searches TO service_role;
ALTER TABLE public.web_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY web_searches_select_own ON public.web_searches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY web_searches_insert_own ON public.web_searches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY web_searches_delete_own ON public.web_searches FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX web_searches_user_idx ON public.web_searches(user_id, created_at DESC);