-- Invoice QR Verification
--
-- Adds a random, unguessable verification token to each billing calculation
-- (one invoice = one billing_calculations row) and a public RPC that looks an
-- invoice up by that token only. This backs a QR code printed on the invoice
-- PDF: scanning it opens a public page showing the full invoice for
-- verification, with no login required.
--
-- Security model: this is a "possession of the link" model (like a Stripe/
-- PayPal receipt link), not role-based access. The token is a random uuid
-- (122 bits of entropy) — infeasible to guess/enumerate. The RPC is
-- SECURITY DEFINER and returns a hand-built JSON object (not `SELECT *`), so
-- it never exposes more than the fields listed here even though it bypasses
-- RLS internally. No existing RLS policy or grant is weakened by this
-- migration; billing_calculations/charging_sessions remain fully locked down
-- for direct table access.

ALTER TABLE public.billing_calculations
  ADD COLUMN IF NOT EXISTS verification_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_calculations_verification_token
  ON public.billing_calculations (verification_token);

COMMENT ON COLUMN public.billing_calculations.verification_token IS
  'Invoice QR Verification: random public lookup key printed as a QR code on the invoice PDF. Not a secret in the cryptographic sense — do not use for anything requiring stronger guarantees than "possession of the printed/emailed invoice".';

CREATE OR REPLACE FUNCTION public.verify_invoice_public(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing public.billing_calculations%ROWTYPE;
  v_session public.charging_sessions%ROWTYPE;
  v_station_name text;
  v_station_code text;
  v_operator_name text;
  v_breakdown jsonb;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing verification token');
  END IF;

  SELECT * INTO v_billing FROM billing_calculations WHERE verification_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found or link is invalid');
  END IF;

  SELECT * INTO v_session FROM charging_sessions WHERE id = v_billing.session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Underlying session not found');
  END IF;

  SELECT name, station_code INTO v_station_name, v_station_code
  FROM stations WHERE id = v_session.station_id;

  SELECT name INTO v_operator_name
  FROM operators WHERE id = v_session.operator_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'period_name', bi.period_name,
    'duration_minutes', bi.duration_minutes,
    'energy_kwh', bi.energy_kwh,
    'rate_per_kwh', bi.rate_per_kwh,
    'energy_charge', bi.energy_charge,
    'demand_kw', bi.demand_kw,
    'demand_charge', bi.demand_charge,
    'line_total', bi.line_total
  ) ORDER BY bi.period_name), '[]'::jsonb)
  INTO v_breakdown
  FROM billing_breakdown_items bi
  WHERE bi.billing_calculation_id = v_billing.id;

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_number', 'INV-' || v_session.transaction_id,
    'invoice_date', v_billing.calculation_date,
    'verified_at', now(),
    'session', jsonb_build_object(
      'transaction_id', v_session.transaction_id,
      'charge_id', v_session.charge_id,
      'card_number', v_session.card_number,
      'start_ts', v_session.start_ts,
      'end_ts', v_session.end_ts,
      'duration_minutes', v_session.duration_minutes,
      'energy_consumed_kwh', v_session.energy_consumed_kwh
    ),
    'billing', jsonb_build_object(
      'subtotal', v_billing.subtotal,
      'fees', v_billing.fees,
      'taxes', v_billing.taxes,
      'total_amount', v_billing.total_amount,
      'currency', coalesce(v_billing.currency, 'JOD'),
      'calculation_date', v_billing.calculation_date
    ),
    'breakdown', v_breakdown,
    'fixed_charges', coalesce(v_billing.breakdown -> 'fixedChargesList', '[]'::jsonb),
    'station', jsonb_build_object(
      'name', coalesce(v_station_name, 'Unknown Station'),
      'station_code', v_station_code
    ),
    'operator', jsonb_build_object('name', v_operator_name)
  );
END;
$$;

-- Intentionally public: no auth.uid() / role check inside the function body.
REVOKE ALL ON FUNCTION public.verify_invoice_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_invoice_public(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.verify_invoice_public(uuid) IS
  'Invoice QR Verification: intentionally public/anonymous lookup by verification_token. Returns a hand-built JSON projection of one invoice (session + billing + breakdown + fixed charges + station/operator name) — never a raw table row. No RLS/role gate by design.';
