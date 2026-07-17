-- EV-E Migration 5/6: Ensure mutable shift totals are never treated as an
-- authoritative financial source, and provide an explicit reconciliation check.

COMMENT ON COLUMN public.shifts.total_amount_jod IS
  'EV-E: OPERATIONAL AGGREGATE ONLY, refreshed by recalculate_shift_totals(). Not authoritative for financial closure/locked-handover reporting — use billing_calculations via report_operator_shift_summary()/report_shift_totals_reconciliation(), which also exposes this value labeled and reconciled against the authoritative sum.';

COMMENT ON COLUMN public.shifts.total_kwh IS
  'EV-E: OPERATIONAL AGGREGATE ONLY. See total_amount_jod comment.';

CREATE OR REPLACE FUNCTION public.report_shift_totals_reconciliation(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_billing_total numeric;
  v_energy numeric;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-E shift not found';
  END IF;

  PERFORM public.report_assert_access(v_shift.station_id);

  SELECT coalesce(sum(lb.total_amount), 0), coalesce(sum(cs.energy_consumed_kwh), 0)
  INTO v_billing_total, v_energy
  FROM public.charging_sessions cs
  LEFT JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE cs.shift_id = p_shift_id;

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'operational_total_amount_jod', public.round_jod3(coalesce(v_shift.total_amount_jod, 0)),
    'operational_total_kwh', public.round_jod3(coalesce(v_shift.total_kwh, 0)),
    'authoritative_billing_total', public.round_jod3(v_billing_total),
    'authoritative_energy_kwh', public.round_jod3(v_energy),
    'amount_reconciled', abs(coalesce(v_shift.total_amount_jod, 0) - v_billing_total) <= 0.001,
    'energy_reconciled', abs(coalesce(v_shift.total_kwh, 0) - v_energy) <= 0.001,
    'label', 'Operational aggregate — reconcile against authoritative billing before financial use'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_shift_totals_reconciliation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_shift_totals_reconciliation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_shift_totals_reconciliation(uuid) TO authenticated, service_role;
