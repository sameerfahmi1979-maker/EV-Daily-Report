-- EV-F Migration 9/9 (fix): historical_correction_queue.billing_id must not
-- block the A1-safe delete+insert pattern used by calculate_session_billing_v2
-- (apply's replace_billing_with_v2 path) or by rollback_historical_correction's
-- exact-restore delete+insert. A hard FK with NO ACTION on delete would raise
-- a foreign key violation the moment either path deletes the referenced
-- billing_calculations row. ON DELETE SET NULL preserves the queue/audit row
-- (session_id/comparison_snapshot/etc. are untouched) while allowing the
-- billing row's lifecycle to proceed; historical_correction_archive already
-- holds the full original row as an immutable jsonb snapshot regardless.

ALTER TABLE public.historical_correction_queue
  DROP CONSTRAINT IF EXISTS historical_correction_queue_billing_id_fkey;

ALTER TABLE public.historical_correction_queue
  ADD CONSTRAINT historical_correction_queue_billing_id_fkey
  FOREIGN KEY (billing_id) REFERENCES public.billing_calculations(id) ON DELETE SET NULL;
