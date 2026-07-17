-- EV-D Migration 1: Payment allocations (Cash | Card | CliQ)

CREATE TABLE IF NOT EXISTS public.session_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.charging_sessions(id) ON DELETE CASCADE,
  billing_calculation_id uuid REFERENCES public.billing_calculations(id) ON DELETE SET NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'CliQ')),
  amount_jod numeric(14,3) NOT NULL,
  currency text NOT NULL DEFAULT 'JOD',
  assignment_source text NOT NULL DEFAULT 'manual_override'
    CHECK (assignment_source IN ('import_default', 'manual_override', 'correction', 'batch_default')),
  payment_reference text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_payment_active
  ON public.session_payment_allocations (session_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_spa_method ON public.session_payment_allocations (payment_method)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_spa_session ON public.session_payment_allocations (session_id);

ALTER TABLE public.session_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spa_select ON public.session_payment_allocations;
CREATE POLICY spa_select ON public.session_payment_allocations
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND EXISTS (
      SELECT 1 FROM public.charging_sessions cs
      WHERE cs.id = session_id
        AND public.current_user_has_station_access(cs.station_id)
    )
  );

DROP POLICY IF EXISTS spa_mutate ON public.session_payment_allocations;
CREATE POLICY spa_mutate ON public.session_payment_allocations
  FOR ALL TO authenticated
  USING (
    public.current_user_is_approved()
    AND public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager',
      'station_manager','import_officer','accountant'
    )
  )
  WITH CHECK (
    public.current_user_is_approved()
    AND public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager',
      'station_manager','import_officer','accountant'
    )
  );

COMMENT ON TABLE public.session_payment_allocations IS 'EV-D active payment method per billable session';
