-- EV-D-FINAL-CLOSURE Migration 4/4: extend locked-handover guards beyond billing_calculations
-- to breakdown items, session relationships, shift reassignment, and import batch deletion.
-- These are table-level triggers so they apply regardless of which RPC or client path
-- attempts the mutation (defense-in-depth, "denied server-side").

CREATE OR REPLACE FUNCTION public.d_guard_locked_breakdown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT session_id INTO v_session_id FROM billing_calculations WHERE id = OLD.billing_calculation_id;
    IF v_session_id IS NOT NULL AND public.session_in_locked_handover(v_session_id) THEN
      RAISE EXCEPTION 'EV-D denied: billing breakdown locked by cash handover' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  SELECT session_id INTO v_session_id FROM billing_calculations WHERE id = NEW.billing_calculation_id;
  IF v_session_id IS NOT NULL AND public.session_in_locked_handover(v_session_id) THEN
    RAISE EXCEPTION 'EV-D denied: billing breakdown locked by cash handover' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_d_guard_locked_breakdown ON public.billing_breakdown_items;
CREATE TRIGGER trg_d_guard_locked_breakdown
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_breakdown_items
  FOR EACH ROW EXECUTE FUNCTION public.d_guard_locked_breakdown();

-- Charging sessions: deny any UPDATE or DELETE (operator/shift reassignment, deletion,
-- energy/cost edits, etc.) while the session belongs to a locked handover.
CREATE OR REPLACE FUNCTION public.d_guard_locked_session_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.session_in_locked_handover(OLD.id) THEN
      RAISE EXCEPTION 'EV-D denied: session locked by cash handover' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF public.session_in_locked_handover(OLD.id) THEN
    RAISE EXCEPTION 'EV-D denied: session locked by cash handover' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_d_guard_locked_session_mutation ON public.charging_sessions;
CREATE TRIGGER trg_d_guard_locked_session_mutation
  BEFORE UPDATE OR DELETE ON public.charging_sessions
  FOR EACH ROW EXECUTE FUNCTION public.d_guard_locked_session_mutation();

-- Import batches: deny deletion if any of its sessions belongs to a locked handover.
CREATE OR REPLACE FUNCTION public.d_guard_locked_import_batch_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.charging_sessions cs
    WHERE cs.import_batch_id = OLD.id
      AND public.session_in_locked_handover(cs.id)
  ) THEN
    RAISE EXCEPTION 'EV-D denied: batch has sessions locked by cash handover' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_d_guard_locked_import_batch_delete ON public.import_batches;
CREATE TRIGGER trg_d_guard_locked_import_batch_delete
  BEFORE DELETE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.d_guard_locked_import_batch_delete();

-- Shifts: deny operator/station reassignment or deletion while a locked handover references
-- the shift. Bank-deposit/handover_status fields (legacy operational workflow) remain editable.
CREATE OR REPLACE FUNCTION public.d_guard_locked_shift_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_locked boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.cash_handovers h
    WHERE h.shift_id = OLD.id AND h.status = 'locked'
  ) INTO v_locked;

  IF NOT v_locked THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'EV-D denied: shift locked by cash handover' USING ERRCODE = '55000';
  END IF;

  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id
     OR NEW.station_id IS DISTINCT FROM OLD.station_id
     OR NEW.import_batch_id IS DISTINCT FROM OLD.import_batch_id THEN
    RAISE EXCEPTION 'EV-D denied: shift locked by cash handover' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_d_guard_locked_shift_mutation ON public.shifts;
CREATE TRIGGER trg_d_guard_locked_shift_mutation
  BEFORE UPDATE OR DELETE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.d_guard_locked_shift_mutation();

COMMENT ON FUNCTION public.d_guard_locked_breakdown() IS 'EV-D-FINAL-CLOSURE locked handover guard for billing_breakdown_items';
COMMENT ON FUNCTION public.d_guard_locked_session_mutation() IS 'EV-D-FINAL-CLOSURE locked handover guard for charging_sessions';
COMMENT ON FUNCTION public.d_guard_locked_import_batch_delete() IS 'EV-D-FINAL-CLOSURE locked handover guard for import_batches deletion';
COMMENT ON FUNCTION public.d_guard_locked_shift_mutation() IS 'EV-D-FINAL-CLOSURE locked handover guard for shifts reassignment/deletion';
