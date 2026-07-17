-- EV-E direct SQL reconciliation evidence.
-- Run via: supabase db query --linked -f scripts/production/e_reconciliation_verification.sql

-- 1. Overall production scale (for report_revenue_summary parity check)
SELECT count(*)::int AS total_sessions FROM charging_sessions;
SELECT count(*)::int AS total_billing_rows FROM billing_calculations;

-- 2. Direct SQL revenue total for a wide date range (compare to report_revenue_summary sum)
SELECT
  round(coalesce(sum(lb.total_amount), 0)::numeric, 3) AS direct_billing_total,
  count(*)::int AS direct_session_count
FROM charging_sessions cs
JOIN (
  SELECT DISTINCT ON (session_id) session_id, total_amount
  FROM billing_calculations
  ORDER BY session_id, calculated_at DESC NULLS LAST, created_at DESC
) lb ON lb.session_id = cs.id
WHERE cs.start_date BETWEEN '2020-01-01' AND '2030-12-31';

-- 3. Payment method direct totals (compare to report_payment_method_summary)
SELECT
  coalesce(spa.payment_method, 'UNASSIGNED') AS method,
  round(coalesce(sum(lb.total_amount), 0)::numeric, 3) AS total,
  count(*)::int AS cnt
FROM charging_sessions cs
JOIN (
  SELECT DISTINCT ON (session_id) session_id, total_amount
  FROM billing_calculations
  ORDER BY session_id, calculated_at DESC NULLS LAST, created_at DESC
) lb ON lb.session_id = cs.id
LEFT JOIN session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
GROUP BY 1
ORDER BY 1;

-- 4. Cash handover reconciliation: billing_total = cash+card+cliq (0.001 tolerance)
SELECT
  h.id, h.handover_number, h.status,
  h.billing_total, h.cash_total, h.card_total, h.cliq_total,
  round((h.billing_total - (h.cash_total + h.card_total + h.cliq_total))::numeric, 3) AS difference
FROM cash_handovers h
ORDER BY h.created_at DESC;

-- 5. A1/A2/B/C/D regression: duplicate billing groups
SELECT count(*)::int AS dup_billing_groups
FROM (SELECT session_id FROM billing_calculations GROUP BY session_id HAVING count(*) > 1) d;

-- 6. Non-zero demand/tax check (should be 0 rows)
SELECT count(*)::int AS non_zero_tax_rows FROM billing_calculations WHERE taxes > 0;
SELECT count(*)::int AS non_zero_demand_rows
FROM billing_breakdown_items WHERE demand_charge > 0;

-- 7. Flags
SELECT key, value FROM system_settings
WHERE key IN (
  'billing_engine_v2_enabled', 'import_workflow_v2_enabled',
  'payment_workflow_v1_enabled', 'handover_workflow_v1_enabled', 'reporting_v2_enabled'
) ORDER BY 1;
