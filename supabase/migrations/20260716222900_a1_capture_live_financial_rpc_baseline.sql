-- EV-A1: Capture catalog for live financial RPC baselines.
-- Capture date: 2026-07-16
-- Source project: qflxupfeyktdrpilctyo
--
-- IMPORTANT:
-- 1) Exact function bodies were snapshotted into schema a1_backup_20260716.rpc_definitions
--    before any A1 destructive work.
-- 2) Remote migration history already contains earlier CREATE FUNCTION migrations for these
--    RPCs (e.g. create_calculate_batch_billing_function_v2, create_delete_import_batch_function,
--    create_recalculate_shift_totals). Those SQL files are missing from this local repo
--    (schema drift). See docs/a1/EV_A1_SCHEMA_DRIFT.md.
-- 3) This migration records hashes so environments can verify they still match the capture.
-- 4) Bodies were NOT rewritten in A1. Tariff behavior intentionally unchanged.

CREATE TABLE IF NOT EXISTS public.a1_rpc_baseline_catalog (
  function_name text NOT NULL,
  identity_args text NOT NULL DEFAULT '',
  result_type text,
  security_mode text,
  def_md5 text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  capture_note text NOT NULL,
  PRIMARY KEY (function_name, identity_args)
);

ALTER TABLE public.a1_rpc_baseline_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access a1 rpc catalog" ON public.a1_rpc_baseline_catalog;
CREATE POLICY "Service role full access a1 rpc catalog"
  ON public.a1_rpc_baseline_catalog
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed known capture hashes from live 2026-07-16 inspection.
INSERT INTO public.a1_rpc_baseline_catalog (
  function_name, identity_args, result_type, security_mode, def_md5, capture_note
) VALUES
  ('calculate_batch_billing', 'p_batch_id uuid, p_station_id uuid', 'jsonb', 'SECURITY DEFINER',
   '7f2f259e610692d2dffa45c0603d3d67',
   'EV-A1 baseline; body unchanged; full SQL in a1_backup_20260716.rpc_definitions'),
  ('delete_import_batch', 'p_batch_id uuid', 'jsonb', 'SECURITY DEFINER',
   '67fea76cd9c249fb08def8a48676fb19',
   'EV-A1 baseline; body unchanged'),
  ('recalculate_shift_totals', 'p_shift_id uuid', 'json', 'SECURITY DEFINER',
   '65897713a84c803f0c590ee4c12f7fce',
   'EV-A1 baseline; body unchanged'),
  ('recalculate_all_shift_totals', '', 'json', 'SECURITY DEFINER',
   '00653252da9c0efcf63a9118bc51f3bf',
   'EV-A1 baseline; body unchanged'),
  ('turbo_bulk_calculate_billing', 'p_session_ids uuid[], p_recalculate boolean DEFAULT false', 'jsonb', 'SECURITY DEFINER',
   '6ed44ddffbccfc5d773ff4215aa357bb',
   'EV-A1 baseline companion capture; body unchanged'),
  ('turbo_calculate_all_pending', 'p_station_id uuid DEFAULT NULL, p_batch_size integer DEFAULT 500', 'jsonb', 'SECURITY DEFINER',
   '76cdd7a8daef49f185fdfbe4f85699da',
   'EV-A1 baseline companion capture; body unchanged')
ON CONFLICT (function_name, identity_args) DO UPDATE
SET def_md5 = EXCLUDED.def_md5,
    result_type = EXCLUDED.result_type,
    security_mode = EXCLUDED.security_mode,
    captured_at = now(),
    capture_note = EXCLUDED.capture_note;

-- Verify hashes when functions exist (skip cleanly if a function is absent in a partial env).
DO $$
DECLARE
  r RECORD;
  live_md5 text;
  live_args text;
BEGIN
  FOR r IN SELECT * FROM public.a1_rpc_baseline_catalog LOOP
    SELECT md5(pg_get_functiondef(p.oid)), pg_get_function_identity_arguments(p.oid)
      INTO live_md5, live_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = r.function_name
    LIMIT 1;

    IF live_md5 IS NULL THEN
      RAISE NOTICE 'EV-A1 RPC not present in this database (deferred recreate): %', r.function_name;
      CONTINUE;
    END IF;

    IF live_md5 <> r.def_md5 THEN
      RAISE EXCEPTION 'EV-A1 RPC hash mismatch for %: live=% catalog=%',
        r.function_name, live_md5, r.def_md5;
    END IF;
  END LOOP;
END $$;
