-- EV-A2 Migration 1/6: User approval + role foundation
-- STATUS: PREPARED — do not apply to live production without staging UAT.
-- Capture date context: 2026-07-16

-- Preconditions:
--   * user_profiles exists
--   * A1 unique billing constraint exists (operational safety gate)

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    RAISE EXCEPTION 'EV-A2 precondition failed: user_profiles missing';
  END IF;
END $$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS disable_reason text,
  ADD COLUMN IF NOT EXISTS legacy_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_approval_status_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'disabled', 'rejected'));
  END IF;
END $$;

-- Preserve original role values before remap
UPDATE public.user_profiles
SET legacy_role = role
WHERE legacy_role IS NULL;

-- Drop legacy role check before remapping (old constraint only allows
-- global_admin/company_manager/station_manager/accountant).
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Explicit remap of known legacy roles (unknown values preserved)
UPDATE public.user_profiles
SET role = CASE role
  WHEN 'global_admin' THEN 'system_admin'
  WHEN 'company_manager' THEN 'operations_manager'
  ELSE role
END
WHERE role IN ('global_admin', 'company_manager');

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (
    role IN (
      'system_admin',
      'operations_manager',
      'station_manager',
      'import_officer',
      'accountant',
      'report_viewer',
      -- temporary compatibility for any unmapped leftovers
      'global_admin',
      'company_manager'
    )
  );

-- Approve only currently known legitimate active users (explicit allow-list)
UPDATE public.user_profiles
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, now()),
  is_active = true
WHERE email IN (
  'sameer@algt.net',
  'sameer@energy-stream.net',
  'tariq@energy-stream.net'
)
AND COALESCE(is_active, true) = true;

-- Default for future inserts: pending + least privilege role
ALTER TABLE public.user_profiles
  ALTER COLUMN role SET DEFAULT 'report_viewer';

ALTER TABLE public.user_profiles
  ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Validation: at least one approved system_admin
DO $$
DECLARE
  v_admins int;
BEGIN
  SELECT COUNT(*) INTO v_admins
  FROM public.user_profiles
  WHERE role = 'system_admin'
    AND approval_status = 'approved'
    AND COALESCE(is_active, true);

  IF v_admins < 1 THEN
    RAISE EXCEPTION 'EV-A2 validation failed: no approved system_admin remains';
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.approval_status IS
  'EV-A2: pending|approved|disabled|rejected';
COMMENT ON COLUMN public.user_profiles.legacy_role IS
  'EV-A2: original role before remap';
