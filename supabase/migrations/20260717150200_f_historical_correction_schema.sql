-- EV-F Migration 3/9: Historical correction queue + immutable archive.

CREATE TABLE IF NOT EXISTS public.historical_correction_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.charging_sessions(id),
  billing_id uuid REFERENCES public.billing_calculations(id),
  station_id uuid REFERENCES public.stations(id),
  classification text NOT NULL CHECK (classification IN (
    'v2_verified', 'v2_metadata_missing', 'legacy_calculated', 'legacy_unknown',
    'missing_billing', 'breakdown_mismatch', 'tariff_mismatch', 'non_zero_demand',
    'non_zero_tax', 'duplicate_billing', 'orphan_breakdown', 'operator_relationship_issue',
    'station_relationship_issue', 'payment_unassigned', 'handover_unavailable', 'cannot_compare'
  )),
  exception_types text[] NOT NULL DEFAULT '{}',
  current_amount numeric(14,3),
  proposed_amount numeric(14,3),
  difference numeric(14,3),
  match_tier text CHECK (match_tier IN ('exact', 'rounding_only', 'minor', 'material', 'cannot_compare')),
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  risk text NOT NULL DEFAULT 'medium' CHECK (risk IN ('low', 'medium', 'high')),
  proposed_action text NOT NULL CHECK (proposed_action IN (
    'replace_billing_with_v2', 'repair_metadata_only', 'no_action_required', 'defer', 'manual_review'
  )),
  status text NOT NULL DEFAULT 'identified' CHECK (status IN (
    'identified', 'review_required', 'approved', 'rejected', 'deferred',
    'applying', 'applied', 'failed', 'rolled_back'
  )),
  comparison_snapshot jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  rejection_reason text,
  defer_reason text,
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  applied_by uuid,
  applied_at timestamptz,
  rolled_back_by uuid,
  rolled_back_at timestamptz,
  failure_reason text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hcq_session ON public.historical_correction_queue (session_id);
CREATE INDEX IF NOT EXISTS idx_hcq_status ON public.historical_correction_queue (status);
CREATE INDEX IF NOT EXISTS idx_hcq_station_status ON public.historical_correction_queue (station_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hcq_active_session
  ON public.historical_correction_queue (session_id)
  WHERE status IN ('identified', 'review_required', 'approved', 'applying');

CREATE TABLE IF NOT EXISTS public.historical_correction_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id uuid NOT NULL REFERENCES public.historical_correction_queue(id),
  session_id uuid NOT NULL,
  original_billing_calculation jsonb,
  original_breakdown_items jsonb,
  comparison_snapshot jsonb,
  approval_snapshot jsonb,
  applied_result jsonb,
  rollback_result jsonb,
  archived_event text NOT NULL CHECK (archived_event IN ('pre_apply', 'post_apply', 'post_rollback')),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hca_correction ON public.historical_correction_archive (correction_id);
CREATE INDEX IF NOT EXISTS idx_hca_session ON public.historical_correction_archive (session_id);

ALTER TABLE public.historical_correction_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_correction_archive ENABLE ROW LEVEL SECURITY;

-- Read policies (station-scoped); all mutation via RPC only (grants revoked below).
DROP POLICY IF EXISTS hcq_select ON public.historical_correction_queue;
CREATE POLICY hcq_select ON public.historical_correction_queue
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      public.current_user_is_system_admin()
      OR public.current_user_is_operations_manager()
      OR (
        public.current_user_role() IN ('accountant', 'station_manager', 'import_officer', 'report_viewer')
        AND (station_id IS NULL OR public.current_user_has_station_access(station_id))
      )
    )
  );

DROP POLICY IF EXISTS hca_select ON public.historical_correction_archive;
CREATE POLICY hca_select ON public.historical_correction_archive
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      public.current_user_is_system_admin()
      OR public.current_user_is_operations_manager()
      OR public.current_user_role() = 'accountant'
    )
  );

-- No INSERT/UPDATE/DELETE policies exist for authenticated on either table —
-- combined with the grant revocation below, all mutation must go through the
-- SECURITY DEFINER correction-workflow RPCs (submit/approve/reject/defer/apply/rollback).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.historical_correction_queue FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.historical_correction_archive FROM anon, authenticated;

COMMENT ON TABLE public.historical_correction_queue IS
  'EV-F: governed queue for proposed historical billing corrections. RPC-only mutation; no correction runs unless status=approved.';
COMMENT ON TABLE public.historical_correction_archive IS
  'EV-F: immutable archive of original billing/breakdown/comparison/approval/applied/rollback snapshots. RPC-only writes, no update/delete for any role.';
