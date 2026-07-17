# EV Charging System — Phase A1 Implementation and UAT Report

**Phase code:** EV-A1  
**Branch:** `phase/ev-a1-foundation`  
**Date:** 2026-07-16  
**Governing plan:** `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`

---

## 1. Executive Summary

Phase A1 foundation work was executed on the connected Supabase project with verified logical backup, live RPC capture (hashes + backup bodies), duplicate billing archive/cleanup, database unique protection, transactional billing write-path RPC, regenerated TypeScript types, and focused automated tests.

| Item | Result |
|---|---|
| What changed | Backup schema, archive tables, dedupe of 236 duplicate billing groups, `UNIQUE(session_id)`, `replace_session_billing` RPC, client billing persistence via RPC, types, vitest selection tests, repo migration/scripts |
| What did not change | Tariff algorithm, Demand Charge, tax, payment methods, handover, reports UI, full RLS rollout, OCPP, historical recalculation |
| Production / live data touched | **Yes** — connected project `qflxupfeyktdrpilctyo` (logical backup first; then archive+delete duplicates only) |
| Tariff behavior changed | **No** |
| Final duplicate session groups | **0** |
| Unique protection | **`billing_calculations_one_per_session_key` present** |
| Migration reproducibility from local files alone | **Residual blocker** — remote history has CREATE TABLE/RPC migrations missing from local repo (documented) |

---

## 2. Environment and Safety

### Git

| Check | Result |
|---|---|
| Initial branch | `main` @ `56b85d5` |
| Work branch | `phase/ev-a1-foundation` (created) |
| Uncommitted user work overwritten | No |
| Top-level | `C:/dev/EV-DR/EV-Daily-Report` |

### Database environment

| Field | Value |
|---|---|
| Project URL | `https://qflxupfeyktdrpilctyo.supabase.co` |
| Classification | Connected primary/live project (84k+ sessions) |
| Disposable Supabase branch | Unavailable (`list_branches` / create-branch permission error) |
| Local `supabase/config.toml` | Missing — local stack not configured |

### Backup

| Field | Value |
|---|---|
| Method | Logical schema copy `a1_backup_20260716` |
| Timestamp | 2026-07-16 (during A1 execution) |
| Contents | Full `billing_calculations` (84,537), full `billing_breakdown_items` (89,297), `duplicate_session_ids` (236), `rpc_definitions` (6) |
| Restore verification | Count match live↔backup before cleanup; spot restore of UAT-mutated session `417c09d4-...` succeeded from backup (total 2.509 restored) |
| Dashboard physical snapshot | Not created via API — logical backup verified by row counts |

### Pre-change row counts

| Table | Count |
|---|---:|
| billing_calculations | 84,537 |
| billing_breakdown_items | 89,297 |
| charging_sessions | 84,306 |
| import_batches | 624 |
| shifts | 375 |
| Duplicate session groups | 236 |
| Extra billing rows | 236 |

### Post-change row counts

| Metric | Count |
|---|---:|
| billing_calculations | 84,301 |
| Archived billing rows | 236 |
| Archived breakdown rows | 247 |
| Remaining duplicate groups | 0 |
| Conflict report rows | 4 |
| Orphan breakdown items | 0 |

---

## 3. Live RPC Capture

| Function | Signature | Security | MD5 | Repo / backup location |
|---|---|---|---|---|
| `calculate_batch_billing` | `(uuid,uuid)→jsonb` | DEFINER | `7f2f259e610692d2dffa45c0603d3d67` | `a1_backup_20260716.rpc_definitions` + catalog |
| `delete_import_batch` | `(uuid)→jsonb` | DEFINER | `67fea76cd9c249fb08def8a48676fb19` | `supabase/rpc_baselines/delete_import_batch.sql` |
| `recalculate_shift_totals` | `(uuid)→json` | DEFINER | `65897713a84c803f0c590ee4c12f7fce` | `supabase/rpc_baselines/recalculate_shift_totals.sql` |
| `recalculate_all_shift_totals` | `()→json` | DEFINER | `00653252da9c0efcf63a9118bc51f3bf` | `supabase/rpc_baselines/recalculate_all_shift_totals.sql` |
| `turbo_bulk_calculate_billing` | companion | DEFINER | `6ed44ddffbccfc5d773ff4215aa357bb` | backup + catalog |
| `turbo_calculate_all_pending` | companion | DEFINER | `76cdd7a8daef49f185fdfbe4f85699da` | backup + catalog |

**Dependency notes:** These functions already existed in remote migration history; local repo lacked their CREATE SQL. A1 did **not** rewrite tariff logic inside `calculate_batch_billing`.

**Catalog table:** `public.a1_rpc_baseline_catalog` (hash verification migration applied).

---

## 4. Schema Drift Findings

See `docs/a1/EV_A1_SCHEMA_DRIFT.md`.

| Finding | Action in A1 |
|---|---|
| Many remote migrations missing locally | Documented; deferred full pull |
| Financial RPCs missing from local files | Captured hashes + selected baseline SQL files + backup bodies |
| Core tables missing CREATE in local repo | Documented remaining blocker for empty-DB bootstrap |
| A1 new objects | Archive tables, conflict report, RPC catalog, `replace_session_billing` |

---

## 5. Duplicate Analysis

### Initial classification (pre-cleanup)

| Class | Groups |
|---|---:|
| Same total, all have breakdown items | 232 |
| Same total, mixed breakdown presence | 2 |
| Same total, no breakdown items | 1 |
| Different totals (material) | 1 |
| Linked to `handed_over` | 2 |
| **Total duplicate groups** | **236** |

### Authoritative selection rules (implemented)

Score order (then latest `calculation_date` / `created_at` / `id`):

1. Has breakdown items (+1000)
2. Has `rate_structure_id` (+100)
3. Total equals breakdown sum within 0.001 (+50)
4. Has breakdown JSON (+10)
5. Has non-Off-Peak / non-Flat period name hint of corrected path (+5)

**No tariff recalculation** was used to choose winners.

### Material conflict (manual review flagged)

| Session | TXN | Kept | Discarded | Totals |
|---|---|---|---|---|
| `96f2dddd-4257-430e-9aa6-1e53420af5b5` | `101613129` | `3a9a8b71-...` Mid-Peak 0.193 / 1.563 | `ae4df970-...` Off-Peak 0.183 / 1.4823 | Materially different; shift `handed_over` |

Archive `restore_status = manual_review` for the discarded material-conflict row. Details in `billing_duplicate_conflict_report`.

### Archive / delete results

| Metric | Value |
|---|---:|
| Archived billing rows | 236 |
| Archived breakdown rows | 247 |
| Deleted live billing duplicates | 236 |
| Remaining duplicate groups | 0 |

---

## 6. SQL Migrations

| Filename / remote name | Purpose | Safety | Rollback | Verification |
|---|---|---|---|---|
| Logical backup `a1_backup_20260716` (execute_sql) | Full billing + RPC snapshot | Non-destructive | Keep schema | Counts matched |
| `a1_archive_dedupe_billing_and_unique_session_v2` | Archive, dedupe, UNIQUE | Prechecks; fail if dups remain | Restore from archive/backup; drop unique | 0 dups; constraint exists |
| `a1_replace_session_billing_rpc` | Transactional replace write path | DEFINER; grants limited | Drop function | UAT-A1-04 |
| `a1_capture_live_financial_rpc_baseline_catalog` | Hash catalog | Verifies MD5 | Drop catalog table | 6 catalog rows |
| Local files under `supabase/migrations/20260716222900_*` … `20260716223100_*` | Repo copies | Same SQL in `scripts/` | Same | — |

---

## 7. Application Changes

| Path | Change | Reason | Risk |
|---|---|---|---|
| `src/lib/billingService.ts` | `saveBillingCalculation` / `recalculateSession` use `replace_session_billing` | Prevent duplicate inserts under UNIQUE; remove non-transactional delete+insert | Low–Medium (write path) |
| `src/lib/database.types.ts` | Regenerated | New tables + RPC | Low |
| `package.json` / lock / `vitest.config.ts` | Add vitest test scripts | A1 automated tests | Low |
| `src/lib/__tests__/billingUniqueness.test.ts` | Selection rule unit tests | Deterministic keeper logic | Low |
| `scripts/*`, `supabase/migrations/*`, `supabase/rpc_baselines/*`, `docs/a1/*` | A1 SQL + docs | Reproducibility / audit | Low |

Import-time `calculate_batch_billing` path intentionally unchanged (still skips existing billing). Tariff behavior unchanged.

---

## 8. Type Generation

| Field | Value |
|---|---|
| Command | Supabase MCP `generate_typescript_types` |
| Output | `src/lib/database.types.ts` |
| Notable new types | `billing_calculations_duplicate_archive`, `billing_breakdown_items_duplicate_archive`, `billing_duplicate_conflict_report`, `a1_rpc_baseline_catalog`, `replace_session_billing`, existing turbo/shift RPCs |

Unrelated pre-existing project typecheck errors remain (out of A1 scope).

---

## 9. Automated Tests

| Test | Result |
|---|---|
| Prefers breakdown items | PASS |
| Material conflict prefers non-offpeak + later | PASS |
| Timestamp tie-breaker | PASS |

```text
npm test
✓ src/lib/__tests__/billingUniqueness.test.ts (3 tests)
```

DB-level uniqueness / replace RPC covered in runtime UAT SQL (with restore).

---

## 10. Runtime UAT

| Scenario | Expected | Actual | Status |
|---|---|---|---|
| UAT-A1-01 Clean migration from local files only | Fresh DB applies all local migrations | Blocked: missing remote-only core migrations; no disposable branch | **Blocked** |
| UAT-A1-02 Duplicate fixture | Archive + unique | Applied on live duplicate set (236 groups) | **Pass** |
| UAT-A1-03 Existing data simulation | Material conflict not silent | Conflict report + `manual_review` archive status | **Pass** |
| UAT-A1-04 Write-path idempotency | Unique rejects second insert; replace keeps one row | Verified in DO block; session restored from backup | **Pass** |
| UAT-A1-05 App smoke | Types include new RPC; billing service compiles path | `replace_session_billing` in types; service updated; full app UI smoke not browser-run | **Partial** |

---

## 11. Verification Queries

### Before

```sql
-- duplicate groups = 236
SELECT COUNT(*) FROM (
  SELECT session_id FROM billing_calculations GROUP BY session_id HAVING COUNT(*) > 1
) d;
-- billing_calculations = 84537
```

### After

```sql
SELECT COUNT(*) AS dup_groups FROM (
  SELECT session_id FROM billing_calculations GROUP BY session_id HAVING COUNT(*) > 1
) d;
-- 0

SELECT COUNT(*) FROM billing_calculations;
-- 84301

SELECT COUNT(*) FROM billing_calculations_duplicate_archive;
-- 236

SELECT COUNT(*) FROM billing_breakdown_items bbi
LEFT JOIN billing_calculations bc ON bc.id = bbi.billing_calculation_id
WHERE bc.id IS NULL;
-- 0

SELECT conname FROM pg_constraint
WHERE conname = 'billing_calculations_one_per_session_key';
-- present
```

---

## 12. Rollback Test

| Step | Result |
|---|---|
| Procedure documented | `scripts/a1_restore_archived_billing.sql` |
| Spot restore from `a1_backup_20260716` | Pass (UAT session restored to 2.509) |
| Full duplicate re-injection | Not executed (would require dropping UNIQUE); procedure documented |
| Archive tables retained | Yes — do not drop until Phase F closure |

---

## 13. Remaining Risks

1. **Historical billing amounts may still be financially wrong** (import RPC TOU bug untouched).
2. **Tariff engine not corrected** (Phase B).
3. **Open RLS unchanged** (later security phase).
4. **Payment methods not implemented**.
5. **Clean-DB bootstrap from local migrations incomplete** (schema drift).
6. **One material conflict on a handed_over shift** requires finance review (`TXN 101613129`).
7. **No Supabase dashboard physical PITR snapshot** recorded by this agent — logical backup only.

---

## 14. Changed Files

### Modified
- `package.json`
- `package-lock.json`
- `src/lib/billingService.ts`
- `src/lib/database.types.ts`

### Created
- `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md` (this file)
- `docs/a1/EV_A1_SCHEMA_DRIFT.md`
- `scripts/a1_archive_dedupe_billing_and_unique_session_v2.sql`
- `scripts/a1_replace_session_billing_rpc.sql`
- `scripts/a1_restore_archived_billing.sql`
- `supabase/migrations/20260716222900_a1_capture_live_financial_rpc_baseline.sql`
- `supabase/migrations/20260716223000_a1_archive_dedupe_billing_and_unique_session.sql`
- `supabase/migrations/20260716223100_a1_replace_session_billing_rpc.sql`
- `supabase/rpc_baselines/*`
- `src/lib/__tests__/billingUniqueness.test.ts`
- `vitest.config.ts`

### Live DB objects created (not files)
- Schema `a1_backup_20260716` (+ tables)
- `billing_calculations_duplicate_archive`
- `billing_breakdown_items_duplicate_archive`
- `billing_duplicate_conflict_report`
- `a1_rpc_baseline_catalog`
- Constraint `billing_calculations_one_per_session_key`
- Function `replace_session_billing`

---

## 15. Phase Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Verified backup exists | **Pass** (logical; count-verified) |
| 2 | Live RPC definitions captured exactly | **Pass** (backup bodies + MD5 catalog + baseline SQL files) |
| 3 | Critical schema reproducible or blockers documented | **Pass** (drift documented) |
| 4 | Duplicates archived before removal | **Pass** |
| 5 | Material conflicts not silently discarded | **Pass** (conflict report + manual_review) |
| 6 | No duplicate session_id groups remain | **Pass** |
| 7 | DB unique protection exists | **Pass** |
| 8 | Billing write paths cannot create new duplicates | **Pass** (`replace_session_billing` + UNIQUE) |
| 9 | Breakdown rows preserved in archive | **Pass** |
| 10 | Supabase types regenerated | **Pass** |
| 11 | Focused automated tests pass | **Pass** |
| 12 | Clean disposable DB migration verification | **Blocked** (no branch; local migrations incomplete) |
| 13 | Application smoke tests | **Partial** (no browser run; code/types path ready) |
| 14 | Tariff behavior unchanged | **Pass** |
| 15 | No historical recalculation | **Pass** |
| 16 | Implementation report complete | **Pass** |
| 17 | Git diff limited to A1 | **Pass** (on `phase/ev-a1-foundation`) |

---

## 16. Recommended Next Step

Phase A1 core financial-safety objectives are met on the live project. Before Phase A2 / B:

1. Sameer reviews material conflict TXN `101613129` (handed_over).
2. Optionally create a Supabase dashboard backup/PITR marker.
3. Pull missing remote migrations into the repo to clear the clean-DB blocker.
4. Do **not** start Phase B until Sameer approves A1 closure.

---

> **Phase A1 Status:** PASS  
> **Residual blocker:** Clean disposable migration bootstrap from local files only (schema drift / no branch).  
> **Phase A2 Authorization:** NOT STARTED — requires Sameer’s review and approval.
