-- EV-D Migration 2: Cash handover tables

CREATE TABLE IF NOT EXISTS public.cash_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_number text NOT NULL,
  station_id uuid NOT NULL REFERENCES public.stations(id),
  operator_id uuid NOT NULL REFERENCES public.operators(id),
  shift_id uuid REFERENCES public.shifts(id),
  shift_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft','ready_to_submit','submitted','under_review',
      'approved','locked','rejected','reopened','cancelled'
    )),
  currency text NOT NULL DEFAULT 'JOD',
  billing_total numeric(14,3) NOT NULL DEFAULT 0,
  cash_total numeric(14,3) NOT NULL DEFAULT 0,
  card_total numeric(14,3) NOT NULL DEFAULT 0,
  cliq_total numeric(14,3) NOT NULL DEFAULT 0,
  expected_cash numeric(14,3) NOT NULL DEFAULT 0,
  actual_cash_received numeric(14,3),
  shortage_amount numeric(14,3) NOT NULL DEFAULT 0,
  surplus_amount numeric(14,3) NOT NULL DEFAULT 0,
  net_adjustments numeric(14,3) NOT NULL DEFAULT 0,
  unassigned_count integer NOT NULL DEFAULT 0,
  submitted_by uuid,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  locked_by uuid,
  locked_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  reopened_by uuid,
  reopened_at timestamptz,
  reopen_reason text,
  version integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_handovers_number ON public.cash_handovers (handover_number);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_shift ON public.cash_handovers (shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_status ON public.cash_handovers (status);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_station_date ON public.cash_handovers (station_id, shift_date);

CREATE TABLE IF NOT EXISTS public.cash_handover_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.cash_handovers(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.charging_sessions(id),
  billing_calculation_id uuid,
  payment_allocation_id uuid,
  payment_method text NOT NULL,
  amount_jod numeric(14,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (handover_id, session_id)
);

CREATE TABLE IF NOT EXISTS public.cash_handover_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.cash_handovers(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  cash_impact text NOT NULL CHECK (cash_impact IN ('increase', 'decrease')),
  amount_jod numeric(14,3) NOT NULL CHECK (amount_jod > 0),
  reason text NOT NULL,
  evidence_reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cash_handover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.cash_handovers(id) ON DELETE CASCADE,
  from_status text,
  to_status text,
  action text NOT NULL,
  actor_id uuid,
  reason text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_handover_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_handover_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_handover_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ch_select ON public.cash_handovers;
CREATE POLICY ch_select ON public.cash_handovers
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      public.current_user_is_system_admin()
      OR public.current_user_is_operations_manager()
      OR public.current_user_role() IN ('accountant','station_manager','import_officer','report_viewer')
    )
    AND public.current_user_has_station_access(station_id)
  );

DROP POLICY IF EXISTS ch_insert ON public.cash_handovers;
CREATE POLICY ch_insert ON public.cash_handovers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_approved()
    AND public.current_user_can_import(station_id)
  );

DROP POLICY IF EXISTS ch_update ON public.cash_handovers;
CREATE POLICY ch_update ON public.cash_handovers
  FOR UPDATE TO authenticated
  USING (
    public.current_user_is_approved()
    AND public.current_user_has_station_access(station_id)
    AND status NOT IN ('locked')
  )
  WITH CHECK (public.current_user_has_station_access(station_id));

DROP POLICY IF EXISTS chs_select ON public.cash_handover_sessions;
CREATE POLICY chs_select ON public.cash_handover_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cash_handovers h
      WHERE h.id = handover_id
        AND public.current_user_has_station_access(h.station_id)
    )
  );

DROP POLICY IF EXISTS cha_all ON public.cash_handover_adjustments;
CREATE POLICY cha_all ON public.cash_handover_adjustments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cash_handovers h
      WHERE h.id = handover_id
        AND public.current_user_has_station_access(h.station_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cash_handovers h
      WHERE h.id = handover_id
        AND public.current_user_has_station_access(h.station_id)
    )
  );

DROP POLICY IF EXISTS che_select ON public.cash_handover_events;
CREATE POLICY che_select ON public.cash_handover_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cash_handovers h
      WHERE h.id = handover_id
        AND public.current_user_has_station_access(h.station_id)
    )
  );
