-- EV-C Migration 2/6: Operator card normalization + history audit

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS card_number_normalized text;

UPDATE public.operators
SET card_number_normalized = regexp_replace(upper(trim(card_number)), '[^0-9A-Z]', '', 'g')
WHERE card_number_normalized IS NULL;

CREATE OR REPLACE FUNCTION public.normalize_operator_card(p_card text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(upper(trim(COALESCE(p_card, ''))), '[^0-9A-Z]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.operators_set_card_normalized()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.card_number_normalized := public.normalize_operator_card(NEW.card_number);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operators_card_normalized ON public.operators;
CREATE TRIGGER trg_operators_card_normalized
  BEFORE INSERT OR UPDATE OF card_number ON public.operators
  FOR EACH ROW
  EXECUTE FUNCTION public.operators_set_card_normalized();

-- Soft uniqueness for active operators: one normalized full card per user tenant scope.
-- Keep existing (user_id, card_number) unique; add normalized index for lookups.
CREATE INDEX IF NOT EXISTS idx_operators_card_normalized
  ON public.operators (card_number_normalized)
  WHERE card_number_normalized IS NOT NULL AND status = 'active';

CREATE TABLE IF NOT EXISTS public.operator_card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  old_card_number text,
  new_card_number text,
  old_card_normalized text,
  new_card_normalized text,
  changed_by uuid,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_card_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operator_card_history_select ON public.operator_card_history;
CREATE POLICY operator_card_history_select ON public.operator_card_history
  FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

DROP POLICY IF EXISTS operator_card_history_insert ON public.operator_card_history;
CREATE POLICY operator_card_history_insert ON public.operator_card_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_approved()
    AND public.current_user_role() IN (
      'system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'
    )
  );

CREATE OR REPLACE FUNCTION public.operators_log_card_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.card_number IS DISTINCT FROM OLD.card_number THEN
    INSERT INTO public.operator_card_history (
      operator_id, old_card_number, new_card_number,
      old_card_normalized, new_card_normalized, changed_by, change_reason
    ) VALUES (
      NEW.id, OLD.card_number, NEW.card_number,
      OLD.card_number_normalized, NEW.card_number_normalized,
      auth.uid(), 'operator_card_update'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operators_log_card_change ON public.operators;
CREATE TRIGGER trg_operators_log_card_change
  AFTER UPDATE OF card_number ON public.operators
  FOR EACH ROW
  EXECUTE FUNCTION public.operators_log_card_change();

COMMENT ON TABLE public.operator_card_history IS 'EV-C audit trail for operator card reassignment';
COMMENT ON FUNCTION public.normalize_operator_card(text) IS 'EV-C normalize card tokens for match/conflict checks';
