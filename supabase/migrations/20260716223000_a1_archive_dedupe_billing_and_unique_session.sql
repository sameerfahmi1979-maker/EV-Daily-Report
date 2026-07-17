-- EV-A1: Archive duplicate billing_calculations, keep one authoritative row per session,
-- add UNIQUE(session_id). Does NOT recalculate tariffs.
-- Applied remotely as migration: a1_archive_dedupe_billing_and_unique_session_v2
-- Prerequisite: logical backup schema a1_backup_20260716 verified (counts match live).

CREATE TABLE IF NOT EXISTS public.billing_calculations_duplicate_archive (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_billing_id uuid NOT NULL,
  session_id uuid NOT NULL,
  selection_group_id uuid NOT NULL,
  selected_authoritative_billing_id uuid,
  archive_reason text NOT NULL,
  classification text NOT NULL,
  selection_score integer,
  original_row jsonb NOT NULL,
  breakdown_items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_calculation_date timestamptz,
  original_created_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by text NOT NULL DEFAULT 'migration:a1_archive_dedupe_billing_and_unique_session_v2',
  source_environment text NOT NULL DEFAULT 'qflxupfeyktdrpilctyo',
  restore_status text NOT NULL DEFAULT 'archived'
    CHECK (restore_status IN ('archived','restored','manual_review'))
);

CREATE INDEX IF NOT EXISTS idx_billing_dup_archive_session
  ON public.billing_calculations_duplicate_archive(session_id);
CREATE INDEX IF NOT EXISTS idx_billing_dup_archive_original
  ON public.billing_calculations_duplicate_archive(original_billing_id);
CREATE INDEX IF NOT EXISTS idx_billing_dup_archive_group
  ON public.billing_calculations_duplicate_archive(selection_group_id);

CREATE TABLE IF NOT EXISTS public.billing_breakdown_items_duplicate_archive (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_archive_id uuid NOT NULL
    REFERENCES public.billing_calculations_duplicate_archive(archive_id) ON DELETE CASCADE,
  original_breakdown_item_id uuid,
  original_billing_calculation_id uuid NOT NULL,
  original_row jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_duplicate_conflict_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  selection_group_id uuid NOT NULL,
  classification text NOT NULL,
  selected_billing_id uuid,
  discarded_billing_ids uuid[] NOT NULL,
  min_total numeric,
  max_total numeric,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_calculations_duplicate_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_breakdown_items_duplicate_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_duplicate_conflict_report ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access billing dup archive"
  ON public.billing_calculations_duplicate_archive;
CREATE POLICY "Service role full access billing dup archive"
  ON public.billing_calculations_duplicate_archive
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access billing breakdown dup archive"
  ON public.billing_breakdown_items_duplicate_archive;
CREATE POLICY "Service role full access billing breakdown dup archive"
  ON public.billing_breakdown_items_duplicate_archive
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access billing conflict report"
  ON public.billing_duplicate_conflict_report;
CREATE POLICY "Service role full access billing conflict report"
  ON public.billing_duplicate_conflict_report
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
DECLARE
  v_dup_groups int;
  v_remaining int;
  v_deleted int;
BEGIN
  IF EXISTS (SELECT 1 FROM billing_calculations WHERE session_id IS NULL) THEN
    RAISE EXCEPTION 'EV-A1 precondition failed: NULL session_id values exist';
  END IF;

  SELECT COUNT(*) INTO v_dup_groups
  FROM (SELECT session_id FROM billing_calculations GROUP BY session_id HAVING COUNT(*) > 1) d;

  CREATE TEMP TABLE tmp_a1_dup_scored ON COMMIT DROP AS
  WITH item_stats AS (
    SELECT
      billing_calculation_id,
      COUNT(*) AS item_cnt,
      COALESCE(SUM(line_total), 0) AS item_sum,
      BOOL_OR(period_name IS DISTINCT FROM 'Off-Peak'
              AND period_name IS DISTINCT FROM 'Flat Rate') AS has_non_offpeak
    FROM billing_breakdown_items
    GROUP BY billing_calculation_id
  ),
  base AS (
    SELECT
      bc.*,
      COALESCE(i.item_cnt, 0) AS item_cnt,
      COALESCE(i.item_sum, 0) AS item_sum,
      COALESCE(i.has_non_offpeak, false) AS has_non_offpeak,
      COUNT(*) OVER (PARTITION BY bc.session_id) AS grp_cnt
    FROM billing_calculations bc
    LEFT JOIN item_stats i ON i.billing_calculation_id = bc.id
  ),
  grp AS (
    SELECT
      session_id,
      COUNT(DISTINCT total_amount) AS distinct_totals,
      SUM(CASE WHEN item_cnt > 0 THEN 1 ELSE 0 END) AS rows_with_items,
      SUM(CASE WHEN item_cnt = 0 THEN 1 ELSE 0 END) AS rows_without_items
    FROM base
    WHERE grp_cnt > 1
    GROUP BY session_id
  ),
  scored AS (
    SELECT
      b.*,
      g.distinct_totals,
      g.rows_with_items,
      g.rows_without_items,
      md5(b.session_id::text)::uuid AS selection_group_id,
      CASE
        WHEN g.distinct_totals > 1 THEN 'MATERIAL_TOTAL_CONFLICT'
        WHEN g.rows_with_items > 0 AND g.rows_without_items > 0 THEN 'SAME_TOTAL_MIXED_BREAKDOWN'
        WHEN g.rows_with_items = 0 THEN 'SAME_TOTAL_NO_BREAKDOWN_ITEMS'
        ELSE 'SAME_TOTAL_WITH_BREAKDOWN'
      END AS classification,
      (
        CASE WHEN b.item_cnt > 0 THEN 1000 ELSE 0 END
        + CASE WHEN b.rate_structure_id IS NOT NULL THEN 100 ELSE 0 END
        + CASE WHEN b.item_cnt > 0 AND ABS(b.total_amount - b.item_sum) <= 0.001 THEN 50 ELSE 0 END
        + CASE WHEN b.breakdown IS NOT NULL THEN 10 ELSE 0 END
        + CASE WHEN b.has_non_offpeak THEN 5 ELSE 0 END
      ) AS selection_score
    FROM base b
    JOIN grp g ON g.session_id = b.session_id
    WHERE b.grp_cnt > 1
  )
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY session_id
      ORDER BY selection_score DESC,
               calculation_date DESC NULLS LAST,
               created_at DESC NULLS LAST,
               id DESC
    ) AS rn
  FROM scored;

  CREATE TEMP TABLE tmp_a1_keepers ON COMMIT DROP AS
  SELECT session_id, id AS keeper_id, selection_group_id, classification, selection_score
  FROM tmp_a1_dup_scored WHERE rn = 1;

  CREATE TEMP TABLE tmp_a1_losers ON COMMIT DROP AS
  SELECT s.*, k.keeper_id
  FROM tmp_a1_dup_scored s
  JOIN tmp_a1_keepers k ON k.session_id = s.session_id
  WHERE s.rn > 1;

  INSERT INTO public.billing_duplicate_conflict_report (
    session_id, selection_group_id, classification, selected_billing_id,
    discarded_billing_ids, min_total, max_total, details
  )
  SELECT
    k.session_id,
    k.selection_group_id,
    k.classification,
    k.keeper_id,
    COALESCE(ARRAY(SELECT l.id FROM tmp_a1_losers l WHERE l.session_id = k.session_id), ARRAY[]::uuid[]),
    (SELECT MIN(total_amount) FROM tmp_a1_dup_scored s WHERE s.session_id = k.session_id),
    (SELECT MAX(total_amount) FROM tmp_a1_dup_scored s WHERE s.session_id = k.session_id),
    jsonb_build_object(
      'note', CASE WHEN k.classification = 'MATERIAL_TOTAL_CONFLICT'
                   THEN 'Materially different totals; keeper chosen by non-recalc evidence rules; review required'
                   ELSE 'Duplicate group resolved by evidence rules'
              END,
      'keeper_score', k.selection_score
    )
  FROM tmp_a1_keepers k
  WHERE k.classification IN (
          'MATERIAL_TOTAL_CONFLICT',
          'SAME_TOTAL_MIXED_BREAKDOWN',
          'SAME_TOTAL_NO_BREAKDOWN_ITEMS'
        )
     OR EXISTS (
          SELECT 1 FROM charging_sessions cs
          JOIN shifts sh ON sh.id = cs.shift_id
          WHERE cs.id = k.session_id AND sh.handover_status = 'handed_over'
        );

  WITH inserted AS (
    INSERT INTO public.billing_calculations_duplicate_archive (
      original_billing_id, session_id, selection_group_id, selected_authoritative_billing_id,
      archive_reason, classification, selection_score, original_row, breakdown_items_snapshot,
      original_calculation_date, original_created_at, restore_status
    )
    SELECT
      l.id,
      l.session_id,
      l.selection_group_id,
      l.keeper_id,
      'Non-authoritative duplicate removed during EV-A1 dedupe',
      l.classification,
      l.selection_score,
      to_jsonb(bc),
      COALESCE((
        SELECT jsonb_agg(to_jsonb(bbi) ORDER BY bbi.start_time, bbi.id)
        FROM billing_breakdown_items bbi
        WHERE bbi.billing_calculation_id = l.id
      ), '[]'::jsonb),
      l.calculation_date,
      l.created_at,
      CASE WHEN l.classification = 'MATERIAL_TOTAL_CONFLICT' THEN 'manual_review' ELSE 'archived' END
    FROM tmp_a1_losers l
    JOIN billing_calculations bc ON bc.id = l.id
    RETURNING archive_id, original_billing_id
  )
  INSERT INTO public.billing_breakdown_items_duplicate_archive (
    billing_archive_id, original_breakdown_item_id, original_billing_calculation_id, original_row
  )
  SELECT i.archive_id, bbi.id, bbi.billing_calculation_id, to_jsonb(bbi)
  FROM inserted i
  JOIN billing_breakdown_items bbi ON bbi.billing_calculation_id = i.original_billing_id;

  DELETE FROM billing_breakdown_items bbi
  USING tmp_a1_losers l
  WHERE bbi.billing_calculation_id = l.id;

  DELETE FROM billing_calculations bc
  USING tmp_a1_losers l
  WHERE bc.id = l.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT COUNT(*) INTO v_remaining
  FROM (SELECT session_id FROM billing_calculations GROUP BY session_id HAVING COUNT(*) > 1) x;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'EV-A1 postcondition failed: % duplicate session groups remain', v_remaining;
  END IF;

  RAISE NOTICE 'EV-A1 dedupe complete. initial_groups=% deleted_billing_rows=%', v_dup_groups, v_deleted;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_calculations_one_per_session_key'
  ) THEN
    ALTER TABLE public.billing_calculations
      ADD CONSTRAINT billing_calculations_one_per_session_key UNIQUE (session_id);
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.billing_calculations ALTER COLUMN session_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'session_id NOT NULL skipped: %', SQLERRM;
END $$;

COMMENT ON CONSTRAINT billing_calculations_one_per_session_key ON public.billing_calculations IS
  'EV-A1: one authoritative billing_calculations row per charging session';
