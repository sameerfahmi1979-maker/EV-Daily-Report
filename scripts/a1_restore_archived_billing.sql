-- EV-A1 rollback helper: restore archived non-authoritative billing rows.
-- WARNING: Must drop/disable UNIQUE(session_id) before restoring duplicates.
-- Keep archive tables until Phase F closure.

-- 1) Drop unique protection
-- ALTER TABLE public.billing_calculations DROP CONSTRAINT IF EXISTS billing_calculations_one_per_session_key;

-- 2) Restore one archived billing row (example)
-- INSERT INTO billing_calculations (
--   id, session_id, rate_structure_id, calculation_date, breakdown,
--   subtotal, taxes, fees, total_amount, currency, created_at
-- )
-- SELECT
--   (original_row->>'id')::uuid,
--   session_id,
--   NULLIF(original_row->>'rate_structure_id','')::uuid,
--   original_calculation_date,
--   original_row->'breakdown',
--   (original_row->>'subtotal')::numeric,
--   COALESCE((original_row->>'taxes')::numeric, 0),
--   COALESCE((original_row->>'fees')::numeric, 0),
--   (original_row->>'total_amount')::numeric,
--   COALESCE(original_row->>'currency', 'JOD'),
--   original_created_at
-- FROM billing_calculations_duplicate_archive
-- WHERE archive_id = '<archive_id>';

-- Preferred full restore: use schema a1_backup_20260716.* tables created before cleanup.
