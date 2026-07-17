-- EV-F rollback: disable historical audit/correction/payment-classification/
-- legacy-retirement workflows without destroying any data.
--
-- This is a feature-flag rollback only. It does NOT delete:
--   - historical_correction_queue / historical_correction_archive rows
--   - historical_payment_classification_queue rows
--   - engine_metadata_repair_log rows
-- All correction/audit history and archives are preserved exactly as-is;
-- disabling the flags simply stops new activity through the Phase F RPCs.
-- Any correction that already reached 'applied' remains applied (its
-- archived original values are still available for a manual rollback via
-- rollback_historical_correction, which itself is gated by
-- historical_correction_enabled — re-enable the flag temporarily if a
-- rollback is needed after this script has run).

UPDATE public.system_settings
SET value = 'false'
WHERE key IN (
  'historical_comparison_enabled',
  'historical_correction_enabled',
  'historical_payment_classification_enabled',
  'legacy_report_retirement_enabled'
);

SELECT key, value
FROM public.system_settings
WHERE key IN (
  'historical_comparison_enabled',
  'historical_correction_enabled',
  'historical_payment_classification_enabled',
  'legacy_report_retirement_enabled'
);
