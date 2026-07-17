-- EV-B Migration 1/6: Billing calculation metadata for engine v2
-- Does not recalculate historical rows.

DO $$
BEGIN
  IF to_regclass('public.billing_calculations') IS NULL THEN
    RAISE EXCEPTION 'EV-B precondition failed: billing_calculations missing';
  END IF;
END $$;

ALTER TABLE public.billing_calculations
  ADD COLUMN IF NOT EXISTS calculation_engine_version text,
  ADD COLUMN IF NOT EXISTS calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS calculation_method text,
  ADD COLUMN IF NOT EXISTS applied_rate_summary text,
  ADD COLUMN IF NOT EXISTS recalculation_reason text,
  ADD COLUMN IF NOT EXISTS recalculated_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS source_import_batch_id uuid REFERENCES public.import_batches(id),
  ADD COLUMN IF NOT EXISTS billing_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_calculations_billing_source_check'
  ) THEN
    ALTER TABLE public.billing_calculations
      ADD CONSTRAINT billing_calculations_billing_source_check
      CHECK (
        billing_source IS NULL
        OR billing_source IN ('import', 'manual_recalculate', 'historical_correction', 'preview')
      );
  END IF;
END $$;

ALTER TABLE public.billing_breakdown_items
  ADD COLUMN IF NOT EXISTS rate_structure_id uuid REFERENCES public.rate_structures(id),
  ADD COLUMN IF NOT EXISTS calculation_engine_version text;

COMMENT ON COLUMN public.billing_calculations.calculation_engine_version IS
  'EV-B: e.g. ev-b-v2.0.0';
COMMENT ON COLUMN public.billing_calculations.calculation_method IS
  'EV-B: proportional_duration_split';
COMMENT ON COLUMN public.billing_calculations.billing_source IS
  'EV-B: import | manual_recalculate | historical_correction | preview';
