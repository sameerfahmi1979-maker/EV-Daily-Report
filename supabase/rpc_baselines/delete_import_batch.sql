-- EV-A1 baseline snapshot (verbatim live definition). Do not improve in A1.
-- MD5: 67fea76cd9c249fb08def8a48676fb19
CREATE OR REPLACE FUNCTION public.delete_import_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_session_ids UUID[];
    v_billing_ids UUID[];
    v_deleted_sessions INT := 0;
    v_deleted_billings INT := 0;
    v_deleted_breakdowns INT := 0;
    v_batch_name TEXT;
BEGIN
    SELECT filename INTO v_batch_name
    FROM import_batches
    WHERE id = p_batch_id;

    IF v_batch_name IS NULL THEN
        RAISE EXCEPTION 'Import batch % not found', p_batch_id;
    END IF;

    SELECT ARRAY_AGG(id) INTO v_session_ids
    FROM charging_sessions
    WHERE import_batch_id = p_batch_id;

    IF v_session_ids IS NOT NULL THEN
        SELECT ARRAY_AGG(id) INTO v_billing_ids
        FROM billing_calculations
        WHERE session_id = ANY(v_session_ids);

        IF v_billing_ids IS NOT NULL THEN
            DELETE FROM billing_breakdown_items
            WHERE billing_calculation_id = ANY(v_billing_ids);
            GET DIAGNOSTICS v_deleted_breakdowns = ROW_COUNT;

            DELETE FROM billing_calculations
            WHERE session_id = ANY(v_session_ids);
            GET DIAGNOSTICS v_deleted_billings = ROW_COUNT;
        END IF;

        DELETE FROM charging_sessions
        WHERE import_batch_id = p_batch_id;
        GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;
    END IF;

    DELETE FROM import_batches
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'batch_name', v_batch_name,
        'deleted_sessions', COALESCE(v_deleted_sessions, 0),
        'deleted_billings', COALESCE(v_deleted_billings, 0),
        'deleted_breakdowns', COALESCE(v_deleted_breakdowns, 0)
    );
END;
$function$;
