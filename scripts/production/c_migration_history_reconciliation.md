# Phase C Migration History Reconciliation

**Project:** `qflxupfeyktdrpilctyo`  
**Date:** 2026-07-17

## Before

| Local version | Production objects | History (`schema_migrations`) |
|---|---|---|
| `20260717010000` … `20260717010600` | Present (columns/RPCs verified) | **Missing** (applied via `db query -f`) |
| `20260716240000` … `20260716240500` | Partially present (RPCs yes; some batch billing columns missing) | **Missing** |

## Evidence (objects)

- `import_batches.file_hash`, `operator_match_status`, `workflow_version`, …
- `operators.card_number_normalized`, `operator_card_history`
- `charging_sessions.source_row_number`, `source_file_hash`, `source_transaction_id`
- RPCs: `post_import_batch_v2`, `resolve_operator_match_status`, `cancel_unposted_import_batch`, `normalize_operator_card`
- Billing v2 RPCs present; soak billed with `ev-b-v2.0.0`

## Repair actions

```text
supabase migration repair --status applied --linked --yes \
  20260717010000 20260717010100 20260717010200 20260717010300 \
  20260717010400 20260717010500 20260717010600 20260717010700

supabase migration repair --status applied --linked --yes \
  20260716240000 20260716240100 20260716240200 20260716240300 \
  20260716240400 20260716240500
```

Additional backfills applied and repaired:

- `20260717010700_c_admin_only_post_gate.sql`
- `20260717010800_c_import_batch_billing_columns_backfill.sql` (restored missing `billing_*` on `import_batches`)

## After

C/B versions above recorded as **applied** in remote migration history.  
No unapplied migration was marked applied without object evidence.
