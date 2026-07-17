# EV-A1 Schema Drift Findings

**Date:** 2026-07-16  
**Live project:** `https://qflxupfeyktdrpilctyo.supabase.co`

## Summary

The hosted Supabase migration history contains many migrations that are **not present** as files under local `supabase/migrations/`. Local repo migrations start mid-stream (enhanced session fields) and omit core CREATE TABLE / early RPC migrations.

## Live migration versions missing from local repo (non-exhaustive)

Examples from `list_migrations` on the connected project:

- `20251220195834_create_core_tables`
- `20251220195836_create_core_tables_and_policies`
- `20251220200000_create_functions_and_triggers`
- `20260313222615_create_calculate_batch_billing_function_v2`
- `20260313222635_create_delete_import_batch_function`
- `20260313224216_phase1_create_shifts_table`
- `20260313224242_phase1_create_user_profiles_table`
- `20260314121213_create_turbo_bulk_calculate_billing`
- `20260314131520_create_recalculate_shift_totals`
- …and additional Phase-1 / turbo / cascade migrations

## A1 response (minimum safe)

1. Logical backup schema `a1_backup_20260716` with full copies of billing tables + RPC definitions.
2. RPC baseline catalog table `a1_rpc_baseline_catalog` with MD5 hashes.
3. Archive/dedupe/unique migrations added to the local repo under `supabase/migrations/` and `scripts/`.
4. Full recreation of every historical remote-only migration file is **deferred** to a follow-up reproducibility task (still a blocker for brand-new empty DB bootstrap from local files alone).

## Remaining deferred drift (blocker for clean-DB bootstrap)

| Object class | Status after A1 |
|---|---|
| Core tables (`stations`, `charging_sessions`, …) | Exist live; CREATE SQL not fully in local repo |
| Financial RPCs | Captured hashes + backup bodies; local CREATE SQL still incomplete for empty DB |
| OCPP | Present historically; later remote `drop_ocpp_tables`; deferred per plan |
| Open RLS policies | Unchanged in A1 (excluded scope) |

## Recommendation for A2 / housekeeping

Use Supabase CLI against a linked project (`supabase db pull` / migration repair) to import missing remote migration SQL into the repository before relying on clean disposable migration UAT from files alone.
