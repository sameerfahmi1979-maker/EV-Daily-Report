-- EV-B Migration 6/6: Harden grants for v2 billing RPCs (preserve A2 anon denial)

REVOKE ALL ON FUNCTION public.calculate_session_billing_v2(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_session_billing_v2(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.calculate_session_billing_v2(uuid, text, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.calculate_batch_billing_v2(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_batch_billing_v2(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calculate_batch_billing_v2(uuid, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.recalculate_session_billing_v2(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_session_billing_v2(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalculate_session_billing_v2(uuid, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.b_validate_rate_structure_coverage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.b_validate_rate_structure_coverage(uuid) FROM anon;

COMMENT ON FUNCTION public.calculate_session_billing_v2(uuid, text, text) IS
  'EV-B authoritative session billing (Asia/Amman, proportional split, demand=0, tax=0)';
COMMENT ON FUNCTION public.calculate_batch_billing_v2(uuid, uuid) IS
  'EV-B import batch billing using calculate_session_billing_v2';
