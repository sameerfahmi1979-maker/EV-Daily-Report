-- EV-C hotfix: lower() before stripping non-alnum in operator name match

CREATE OR REPLACE FUNCTION public.resolve_operator_match_status(
  p_selected_operator_id uuid,
  p_detected_card text,
  p_detected_operator_name text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op public.operators%ROWTYPE;
  v_card text;
  v_name_norm text;
  v_detected_norm text;
  v_card_owner uuid;
BEGIN
  IF p_selected_operator_id IS NULL THEN
    RETURN 'pending';
  END IF;

  SELECT * INTO v_op FROM public.operators WHERE id = p_selected_operator_id;
  IF NOT FOUND THEN
    RETURN 'pending';
  END IF;

  v_card := public.normalize_operator_card(p_detected_card);
  v_name_norm := regexp_replace(lower(coalesce(p_detected_operator_name, '')), '[^a-z0-9]+', '', 'g');
  v_detected_norm := regexp_replace(lower(coalesce(v_op.name, '')), '[^a-z0-9]+', '', 'g');

  IF v_card IS NULL THEN
    IF v_name_norm <> '' AND v_detected_norm <> '' AND position(v_name_norm in v_detected_norm) = 0
       AND position(v_detected_norm in v_name_norm) = 0 THEN
      RETURN 'warning';
    END IF;
    RETURN 'no_card';
  END IF;

  SELECT id INTO v_card_owner
  FROM public.operators
  WHERE card_number_normalized = v_card
    AND coalesce(status, 'active') = 'active'
  ORDER BY CASE WHEN id = p_selected_operator_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_card_owner IS NULL THEN
    RETURN 'unknown_card';
  END IF;

  IF v_card_owner <> p_selected_operator_id THEN
    RETURN 'conflict';
  END IF;

  IF v_name_norm <> '' AND v_detected_norm <> ''
     AND position(v_name_norm in v_detected_norm) = 0
     AND position(v_detected_norm in v_name_norm) = 0 THEN
    RETURN 'warning';
  END IF;

  RETURN 'match';
END;
$$;
