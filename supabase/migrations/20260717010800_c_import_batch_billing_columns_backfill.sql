-- EV-C backfill: ensure Phase B import_batches billing columns exist
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
