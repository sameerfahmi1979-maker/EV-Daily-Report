-- EV-C Migration 3/6: Import status model + validation summary + feature flag

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS validation_summary jsonb,
  ADD COLUMN IF NOT EXISTS posting_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS posting_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by uuid,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS workflow_version text;

-- Expand status vocabulary while keeping legacy statuses valid
ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_status_check'
  ) THEN
    ALTER TABLE public.import_batches
      ADD CONSTRAINT import_batches_status_check
      CHECK (
        status IS NULL
        OR status IN (
          'pending',
          'processing',
          'completed',
          'completed_with_errors',
          'failed',
          'cancelled',
          'uploaded',
          'parsed',
          'validation_failed',
          'review_required',
          'ready_to_post',
          'posting',
          'partially_posted',
          'posted',
          'billing_failed',
          'duplicate',
          'rolled_back'
        )
      );
  END IF;
END $$;

ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_category_check;
ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_category_check
  CHECK (category = ANY (ARRAY[
    'branding'::text,
    'station_defaults'::text,
    'pdf_layout'::text,
    'billing'::text,
    'import'::text
  ]));

INSERT INTO public.system_settings (key, value, category)
SELECT 'import_workflow_v2_enabled', 'false', 'import'
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE key = 'import_workflow_v2_enabled'
);

COMMENT ON COLUMN public.import_batches.validation_summary IS 'EV-C preview/validation counters and exception codes';
COMMENT ON COLUMN public.import_batches.workflow_version IS 'EV-C parser/workflow version stamp e.g. ev-c-v1.0.0';
