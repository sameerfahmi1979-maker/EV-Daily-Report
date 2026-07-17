-- Restore pre-A2 open execute grants on financial RPCs (emergency only)
GRANT EXECUTE ON FUNCTION public.calculate_batch_billing(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_import_batch(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_shift_totals(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_shift_totals() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.turbo_bulk_calculate_billing(uuid[], boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.turbo_calculate_all_pending(uuid, integer) TO anon, authenticated, service_role;
