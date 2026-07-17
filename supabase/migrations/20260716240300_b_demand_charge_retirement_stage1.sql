-- EV-B Migration 4/6: Demand charge stage-1 retirement (active path forces zero)
-- Does not drop columns. Does not recalculate historical billing rows.

UPDATE public.rate_periods
SET demand_charge_per_kw = 0
WHERE COALESCE(demand_charge_per_kw, 0) <> 0
  AND rate_structure_id IN (
    SELECT id FROM rate_structures WHERE COALESCE(is_active, false) = true
  );

COMMENT ON COLUMN public.rate_periods.demand_charge_per_kw IS
  'EV-B retired for Jordan billing: must remain 0 on active structures. Legacy column retained for soak.';
