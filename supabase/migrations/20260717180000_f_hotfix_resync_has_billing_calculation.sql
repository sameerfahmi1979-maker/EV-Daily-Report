-- Hotfix: one-time data repair for charging_sessions.has_billing_calculation.
--
-- 236 sessions were found with has_billing_calculation = false despite
-- having a real billing_calculations row (billing_source/calculation_engine_
-- version both NULL, created_at in Jan/Feb/May 2026 — legacy rows written
-- before the current replace_session_billing / calculate_session_billing_v2
-- RPCs existed, both of which correctly set this flag). The stale flag made
-- these sessions appear in "Pending" counts/filters even though they already
-- have billing, and fed the Billing page's server-side Pending filter.
--
-- This is a one-time resync, not a recurring job: both current billing RPCs
-- already keep the flag correct going forward.

UPDATE public.charging_sessions cs
SET has_billing_calculation = true,
    calculated_cost = bc.total_amount
FROM public.billing_calculations bc
WHERE bc.session_id = cs.id
  AND cs.has_billing_calculation = false;
