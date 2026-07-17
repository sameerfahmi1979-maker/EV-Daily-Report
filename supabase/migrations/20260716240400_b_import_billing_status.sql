-- EV-B Migration 5/6: Import batch billing status + feature flag

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS billing_engine_version text,
  ADD COLUMN IF NOT EXISTS billing_status text,
  ADD COLUMN IF NOT EXISTS billing_error_log jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_billing_status_check'
  ) THEN
    ALTER TABLE public.import_batches
      ADD CONSTRAINT import_batches_billing_status_check
      CHECK (
        billing_status IS NULL
        OR billing_status IN ('pending', 'billed', 'billed_with_errors', 'skipped_legacy', 'failed')
      );
  END IF;
END $$;

-- Ensure billing category is allowed (legacy check only had branding/station_defaults/pdf_layout)
ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_category_check;
ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_category_check
  CHECK (category = ANY (ARRAY['branding'::text, 'station_defaults'::text, 'pdf_layout'::text, 'billing'::text]));

INSERT INTO public.system_settings (key, value, category)
SELECT 'billing_engine_v2_enabled', 'true', 'billing'
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE key = 'billing_engine_v2_enabled'
);

-- Replace batch function now that columns exist
CREATE OR REPLACE FUNCTION public.calculate_batch_billing_v2(
  p_batch_id uuid,
  p_station_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_ok int := 0;
  v_fail int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-B denied: authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_can_import(p_station_id)
     AND NOT public.current_user_can_recalculate_billing(p_station_id) THEN
    RAISE EXCEPTION 'EV-B denied: not permitted for station' USING ERRCODE = '42501';
  END IF;

  FOR v_session IN
    SELECT id FROM charging_sessions
    WHERE import_batch_id = p_batch_id
      AND station_id = p_station_id
  LOOP
    BEGIN
      v_result := public.calculate_session_billing_v2(v_session.id, 'import', 'import_batch_billing_v2');
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'session_id', v_session.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  UPDATE import_batches
  SET
    billing_engine_version = 'ev-b-v2.0.0',
    billing_status = CASE
      WHEN v_ok = 0 AND v_fail > 0 THEN 'failed'
      WHEN v_fail = 0 THEN 'billed'
      ELSE 'billed_with_errors'
    END,
    billing_error_log = CASE WHEN v_fail = 0 THEN NULL ELSE v_errors END
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'billed', v_ok,
    'failed', v_fail,
    'errors', v_errors,
    'engine', 'ev-b-v2.0.0'
  );
END;
$$;
