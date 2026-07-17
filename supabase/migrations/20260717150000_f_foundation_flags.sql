-- EV-F Migration 1/9: Feature flags for historical audit/correction/payment-classification/legacy-retirement.

INSERT INTO public.system_settings (key, value, category)
SELECT v.key, v.value, 'import'
FROM (VALUES
  ('historical_comparison_enabled', 'false'),
  ('historical_correction_enabled', 'false'),
  ('historical_payment_classification_enabled', 'false'),
  ('legacy_report_retirement_enabled', 'false')
) AS v(key, value)
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings s WHERE s.key = v.key);

-- Shared EV-F authorization gate, mirroring report_assert_access but for the
-- historical-audit/correction workflows specifically (broader role set for
-- read-only inventory access, narrower for mutation RPCs which check role
-- explicitly inside their own bodies).
CREATE OR REPLACE FUNCTION public.f_assert_flag_enabled(p_flag_key text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_value text;
BEGIN
  SELECT value INTO v_value FROM public.system_settings WHERE key = p_flag_key;
  IF coalesce(v_value, 'false') <> 'true' THEN
    RAISE EXCEPTION 'EV-F denied: % is not true', p_flag_key USING ERRCODE = '55000';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.f_assert_flag_enabled(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_assert_flag_enabled(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_assert_flag_enabled(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.f_assert_flag_enabled(text) IS
  'EV-F: shared feature-flag gate for historical audit/correction/payment-classification/legacy-retirement RPCs.';
