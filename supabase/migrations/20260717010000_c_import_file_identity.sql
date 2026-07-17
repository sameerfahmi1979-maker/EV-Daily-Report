-- EV-C Migration 1/6: Import file identity + operator resolution fields

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS normalized_filename text,
  ADD COLUMN IF NOT EXISTS sheet_name text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS selected_operator_id uuid REFERENCES public.operators(id),
  ADD COLUMN IF NOT EXISTS detected_card_id text,
  ADD COLUMN IF NOT EXISTS detected_operator_name text,
  ADD COLUMN IF NOT EXISTS operator_match_status text,
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES public.stations(id);

CREATE INDEX IF NOT EXISTS idx_import_batches_file_hash
  ON public.import_batches (file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_batches_selected_operator
  ON public.import_batches (selected_operator_id)
  WHERE selected_operator_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_operator_match_status_check'
  ) THEN
    ALTER TABLE public.import_batches
      ADD CONSTRAINT import_batches_operator_match_status_check
      CHECK (
        operator_match_status IS NULL
        OR operator_match_status IN (
          'match', 'warning', 'conflict', 'unknown_card', 'no_card', 'pending'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.import_batches.file_hash IS 'EV-C SHA-256 of uploaded file bytes';
COMMENT ON COLUMN public.import_batches.operator_match_status IS 'EV-C selected vs card vs filename resolution';
