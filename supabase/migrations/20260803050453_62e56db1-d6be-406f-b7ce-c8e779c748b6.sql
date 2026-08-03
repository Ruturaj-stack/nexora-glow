-- Devices
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  platform text NOT NULL DEFAULT '',
  connector text NOT NULL DEFAULT 'generic',
  connection text NOT NULL DEFAULT 'local',
  status text NOT NULL DEFAULT 'offline',
  battery smallint,
  charging boolean NOT NULL DEFAULT false,
  signal smallint,
  firmware text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  capabilities text[] NOT NULL DEFAULT '{}',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  favorite boolean NOT NULL DEFAULT false,
  device_group text NOT NULL DEFAULT 'Ungrouped',
  revoked boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  paired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY devices_all_own ON public.devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX devices_user_idx ON public.devices(user_id, created_at DESC);

-- Encrypted credentials: server-only, never readable by the browser
CREATE TABLE public.device_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id)
);
GRANT ALL ON public.device_credentials TO service_role;
ALTER TABLE public.device_credentials ENABLE ROW LEVEL SECURITY;

-- Pairing requests awaiting explicit user approval
CREATE TABLE public.device_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  method text NOT NULL DEFAULT 'code',
  name text NOT NULL DEFAULT 'New device',
  type text NOT NULL DEFAULT 'custom',
  connector text NOT NULL DEFAULT 'generic',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_pairings TO authenticated;
GRANT ALL ON public.device_pairings TO service_role;
ALTER TABLE public.device_pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_pairings_all_own ON public.device_pairings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Streamed device events
CREATE TABLE public.device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  device_name text NOT NULL DEFAULT '',
  type text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_events TO authenticated;
GRANT ALL ON public.device_events TO service_role;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_events_all_own ON public.device_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX device_events_user_idx ON public.device_events(user_id, created_at DESC);

-- Audit trail for every device action
CREATE TABLE public.device_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  device_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  detail text NOT NULL DEFAULT '',
  duration_ms integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_history TO authenticated;
GRANT ALL ON public.device_history TO service_role;
ALTER TABLE public.device_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_history_all_own ON public.device_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX device_history_user_idx ON public.device_history(user_id, created_at DESC);