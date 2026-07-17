-- EV-C Migration 4/6: Session source relationship fields

ALTER TABLE public.charging_sessions
  ADD COLUMN IF NOT EXISTS source_row_number integer,
  ADD COLUMN IF NOT EXISTS source_file_hash text,
  ADD COLUMN IF NOT EXISTS source_transaction_id text;

-- Backfill source_transaction_id from existing transaction_id where null
UPDATE public.charging_sessions
SET source_transaction_id = transaction_id
WHERE source_transaction_id IS NULL
  AND transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_charging_sessions_source_file_hash
  ON public.charging_sessions (source_file_hash)
  WHERE source_file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_charging_sessions_batch_row
  ON public.charging_sessions (import_batch_id, source_row_number)
  WHERE import_batch_id IS NOT NULL;

COMMENT ON COLUMN public.charging_sessions.source_row_number IS 'EV-C Excel/CSV 1-based data row number';
COMMENT ON COLUMN public.charging_sessions.source_file_hash IS 'EV-C SHA-256 of originating import file';
COMMENT ON COLUMN public.charging_sessions.source_transaction_id IS 'EV-C machine transaction id at import time';
