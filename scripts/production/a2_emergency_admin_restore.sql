-- EV-A2 emergency admin restore (production)
-- Run via service-role / SQL editor if admins are locked out after A2.
-- Does NOT change passwords. Does NOT delete audit evidence.

-- 1) Ensure approval/role columns exist (no-op if already present)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_role text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2) Force allow-listed admins to approved system_admin
UPDATE public.user_profiles
SET
  role = 'system_admin',
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, now()),
  is_active = true,
  disabled_at = NULL,
  disabled_by = NULL,
  disable_reason = NULL
WHERE email IN (
  'sameer@algt.net',
  'sameer@energy-stream.net',
  'tariq@energy-stream.net'
);

-- 3) Ensure station access for admins (all stations)
INSERT INTO public.user_station_access (user_id, station_id, access_level, is_active, created_by)
SELECT up.id, s.id, 'manager', true, up.id
FROM public.user_profiles up
CROSS JOIN public.stations s
WHERE up.email IN (
  'sameer@algt.net',
  'sameer@energy-stream.net',
  'tariq@energy-stream.net'
)
ON CONFLICT (user_id, station_id) DO UPDATE
SET is_active = true, access_level = 'manager';

-- 4) Validate
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v
  FROM public.user_profiles
  WHERE role = 'system_admin' AND approval_status = 'approved' AND COALESCE(is_active, true);
  IF v < 1 THEN
    RAISE EXCEPTION 'Emergency restore failed: no approved system_admin';
  END IF;
END $$;
