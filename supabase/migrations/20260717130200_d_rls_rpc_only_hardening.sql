-- EV-D-FINAL-CLOSURE Migration 3/4: force all Phase D mutation through SECURITY DEFINER RPCs.
--
-- Gap found during final closure UAT: Phase D tables were created in a Supabase project where
-- table-level GRANTs to anon/authenticated are broad by default. RLS policies restricted rows,
-- but did not fully replicate RPC-level role and lock checks, allowing a direct client
-- .update()/.insert()/.delete() call to bypass those checks (e.g. approve/lock a handover
-- without the right role, or mutate a payment allocation on a locked session).
--
-- Fix: revoke INSERT/UPDATE/DELETE/TRUNCATE from anon and authenticated on every Phase D
-- table. All mutation now happens exclusively via SECURITY DEFINER RPCs (owned by the
-- migration role, which bypasses grants as table owner). SELECT remains, scoped by existing
-- station/role-aware RLS policies.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cash_handovers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cash_handover_sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cash_handover_adjustments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cash_handover_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.session_payment_allocations FROM anon, authenticated;

-- Drop the overly broad mutate policies; keep the existing scoped SELECT policies as-is.
DROP POLICY IF EXISTS ch_insert ON public.cash_handovers;
DROP POLICY IF EXISTS ch_update ON public.cash_handovers;
DROP POLICY IF EXISTS cha_all ON public.cash_handover_adjustments;
DROP POLICY IF EXISTS spa_mutate ON public.session_payment_allocations;

-- Explicit restrictive policies (defense-in-depth even if grants are ever restored):
-- no INSERT/UPDATE/DELETE policy exists for authenticated on these tables, so RLS denies by
-- default in addition to the revoked grants.

COMMENT ON TABLE public.cash_handovers IS
  'EV-D: read via RLS-scoped SELECT only. All writes go through SECURITY DEFINER RPCs (create_handover_draft, submit_handover, approve_handover, reject_handover, lock_handover, reopen_handover).';
COMMENT ON TABLE public.session_payment_allocations IS
  'EV-D: read via RLS-scoped SELECT only. All writes go through assign_session_payment_method / apply_batch_default_payment_method RPCs.';
COMMENT ON TABLE public.cash_handover_adjustments IS
  'EV-D: read via RLS-scoped SELECT only. All writes go through create/approve/reject_handover_adjustment RPCs.';
