-- EV-C production verification queries
-- Run via: supabase db query --linked -f scripts/production/c_verify_import_integrity.sql

-- Feature flags
SELECT key, value FROM public.system_settings
WHERE key IN ('billing_engine_v2_enabled', 'import_workflow_v2_enabled');

-- Schema presence
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'import_batches'
  AND column_name IN (
    'file_hash', 'operator_match_status', 'selected_operator_id',
    'validation_summary', 'workflow_version', 'station_id'
  )
ORDER BY 1;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'charging_sessions'
  AND column_name IN ('source_row_number', 'source_file_hash', 'source_transaction_id')
ORDER BY 1;

-- RPC exists + anon cannot execute (expect privilege missing for anon)
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('post_import_batch_v2', 'resolve_operator_match_status', 'cancel_unposted_import_batch');

-- A1 uniqueness still held
SELECT count(*)::int AS duplicate_billing_groups
FROM (
  SELECT session_id
  FROM public.billing_calculations
  GROUP BY session_id
  HAVING count(*) > 1
) d;

-- Operator card normalized backfill
SELECT count(*)::int AS operators_missing_normalized
FROM public.operators
WHERE card_number_normalized IS NULL
  AND card_number IS NOT NULL;
