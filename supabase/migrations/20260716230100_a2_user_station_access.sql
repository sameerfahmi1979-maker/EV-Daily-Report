-- EV-A2 Migration 2/6: user_station_access
-- STATUS: PREPARED — do not apply to live production without staging UAT.

CREATE TABLE IF NOT EXISTS public.user_station_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'standard'
    CHECK (access_level IN ('standard', 'manager', 'readonly')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.user_profiles(id),
  UNIQUE (user_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_user_station_access_user
  ON public.user_station_access(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_station_access_station
  ON public.user_station_access(station_id)
  WHERE is_active = true;

-- Backfill from legacy single station_id
INSERT INTO public.user_station_access (user_id, station_id, access_level, is_active, created_by)
SELECT up.id, up.station_id, 'manager', true, up.id
FROM public.user_profiles up
WHERE up.station_id IS NOT NULL
ON CONFLICT (user_id, station_id) DO NOTHING;

-- System / operations managers: all stations
INSERT INTO public.user_station_access (user_id, station_id, access_level, is_active, created_by)
SELECT up.id, s.id, 'manager', true, up.id
FROM public.user_profiles up
CROSS JOIN public.stations s
WHERE up.role IN ('system_admin', 'operations_manager', 'global_admin', 'company_manager')
  AND up.approval_status = 'approved'
ON CONFLICT (user_id, station_id) DO NOTHING;

-- Accountants: readonly all stations (current business: cross-station financial read)
INSERT INTO public.user_station_access (user_id, station_id, access_level, is_active, created_by)
SELECT up.id, s.id, 'readonly', true, up.id
FROM public.user_profiles up
CROSS JOIN public.stations s
WHERE up.role = 'accountant'
  AND up.approval_status = 'approved'
ON CONFLICT (user_id, station_id) DO NOTHING;

ALTER TABLE public.user_station_access ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_station_access IS
  'EV-A2 authoritative station scope for approved users';
