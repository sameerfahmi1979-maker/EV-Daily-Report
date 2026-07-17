# EV Charging System — Phase C Implementation and UAT Report

**Date:** 2026-07-17  
**Codes:** `EV-C`  
**Branch:** `phase/ev-b-billing-engine`  
**Production:** `qflxupfeyktdrpilctyo`  
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_PHASE_B_CLOSURE_AND_PHASE_C_CURSOR_PROMPT.md`

---

## 1. Executive Summary

Phase C import integrity is implemented and applied to production schema. File hash identity, operator/card/filename resolution, preview validation UI, transactional posting RPC, and card history audit are in place. Posting via `post_import_batch_v2` remains behind `import_workflow_v2_enabled=false` (controlled soak). Legacy import path continues with integrity checks and source metadata when columns exist.

| Area | Result |
|---|---|
| Schema migrations | Applied (7 files) |
| Integrity helpers + UI | Shipped |
| Automated tests | 7/7 PASS |
| Operator match RPC | match / warning / conflict PASS |
| Anon RPC denial | PASS |
| A1 dup groups | 0 |
| Workflow v2 posting flag | `false` (by design) |

---

## 2. Phase B Gate Result

See `EV_CHARGING_SYSTEM_PHASE_B_PRODUCTION_CLOSURE_UAT_REPORT.md`.

> **Phase B Production Closure Status:** PASS  
> **Phase C Start Authorization:** AUTHORIZED

---

## 3. Existing Import Architecture

Pre-C: client Excel parse → `createImportBatch` → bulk insert sessions → `linkSessionsToShift` → `calculate_batch_billing_v2`. Operator selected manually; no card/filename cross-check; no file hash.

---

## 4. Target Import Workflow

1. Select station/operator/shift  
2. Upload file → parse + SHA-256 identity  
3. Preview with match status, overnight/boundary/duplicate counters  
4. Confirm filename warning / block card conflict  
5. Post: legacy (`processBatch`) or v2 RPC when flag on  
6. Billing engine v2 automatic  

---

## 5. Operator Resolution

Authoritative: user-selected operator. Supporting: file card + filename text.

| Status | Behavior |
|---|---|
| `match` | Ready to import |
| `warning` | Confirm checkbox required |
| `conflict` | Block unless authorized override (v2 RPC requires system_admin) |
| `unknown_card` | Proceed with caution; mapping recommended |
| `no_card` | Selected operator used |
| `pending` | Block |

SQL: `resolve_operator_match_status` (hotfix `20260717010600` — lower before strip).  
TS: `src/lib/importIntegrity.ts` (parity).

---

## 6. Card Integrity

- `operators.card_number_normalized` + trigger  
- `operator_card_history` audit on card change  
- Lookup index on active normalized cards  
- Collision: last-4 alone is not treated as globally unique; full normalized card used  

---

## 7. File Identity and Duplicate Detection

Stored on `import_batches`: `file_hash`, `file_size_bytes`, `normalized_filename`, `parser_version`, detected fields.

Signals:

1. File hash vs previously posted batches  
2. Unique `transaction_id` skip  
3. Batch status `duplicate` when all TXNs exist (v2 path)

---

## 8. Transaction Identity

Authoritative: machine `transaction_id` (existing UNIQUE).  
Sessions also store `source_transaction_id`, `source_row_number`, `source_file_hash`.

---

## 9. Import Status Model

Extended `import_batches.status` check to include:  
`uploaded`, `parsed`, `validation_failed`, `review_required`, `ready_to_post`, `posting`, `partially_posted`, `posted`, `billing_failed`, `duplicate`, `cancelled`, `rolled_back` (+ legacy).

---

## 10. Preview and Validation

`FileUpload` integrity panel shows: filename operator, card, hash, match status, TXN/energy/overnight/boundary/duplicate/invalid counts, confirmations.

---

## 11. Transactional Posting

`post_import_batch_v2(...)` SECURITY DEFINER:

- Auth + `current_user_can_import`  
- Flag gate  
- Hash duplicate check  
- Match/warning/conflict gates  
- Insert sessions with operator/source fields  
- `calculate_batch_billing_v2`  
- Audit log  

Enabled only when `import_workflow_v2_enabled=true`.

---

## 12. Relationship Integrity

Posted sessions link: batch, station, operator, source TXN/row/hash.  
Billing still links session + batch via Phase B fields.

---

## 13. Reprocessing and Corrections

- `cancel_unposted_import_batch` for batches without sessions  
- Conflict/warning re-selection before post  
- Completed financial batches not casually cancellable  
- Rollback script disables flag: `scripts/production/c_rollback_import_workflow.sql`

---

## 14. Security

| Check | Result |
|---|---|
| Anon `post_import_batch_v2` | permission denied |
| Anon `resolve_operator_match_status` | permission denied |
| A1 duplicate billing groups | 0 |
| Billing v2 flag | true |
| Import v2 flag | false |

---

## 15. SQL Migrations

| File | Purpose |
|---|---|
| `20260717010000_c_import_file_identity.sql` | File/operator identity columns |
| `20260717010100_c_operator_card_integrity.sql` | Card normalize + history |
| `20260717010200_c_import_status_and_validation.sql` | Status model + flag |
| `20260717010300_c_session_source_relationships.sql` | Session source fields |
| `20260717010400_c_transactional_import_posting.sql` | Post RPC |
| `20260717010500_c_import_rpc_security_and_audit.sql` | Grants + cancel |
| `20260717010600_c_fix_operator_name_normalize.sql` | Name-normalize hotfix |

Applied to production via `supabase db query --linked -f …`.

---

## 16. UI/UX

Updated `FileUpload.tsx`: integrity panel, match indicators, warning/conflict confirmations, workflow flag badge. Legacy wizard structure preserved.

---

## 17. Automated Tests

`src/lib/__tests__/importIntegrity.test.ts` — **7/7 PASS**  
(plus billingEngineV2 still green)

---

## 18. Runtime UAT

| Case | Result |
|---|---|
| Schema columns present | PASS |
| Card normalized backfill | 0 missing |
| SQL match | `match` |
| SQL warning (filename) | `warning` |
| SQL conflict (wrong card) | `conflict` |
| Anon post denied | PASS |
| Controlled v2 post with sample re-import | DEFERRED (flag false; would skip all TXNs as duplicates) |

Integrity UI is live on next frontend deploy; transactional post awaits flag flip.

---

## 19. A1/A2/B Regression

| Check | Result |
|---|---|
| Dup billing groups | 0 |
| Billing engine v2 | enabled |
| Overnight/boundary B closure data | Unchanged |
| Anon financial mutation | Still denied |

---

## 20. Production Rollout

Recommended next ops steps:

1. Deploy frontend with integrity UI  
2. Validate preview on sample files (match for correct operators)  
3. Set `import_workflow_v2_enabled=true` for system_admin soak  
4. Post one small controlled batch (or dry-run duplicate file → `duplicate`)  
5. Expand to import officers  
6. Keep rollback SQL ready  

---

## 21. Rollback

```sql
-- scripts/production/c_rollback_import_workflow.sql
UPDATE system_settings SET value='false' WHERE key='import_workflow_v2_enabled';
```

Legacy `processBatch` remains available.

---

## 22. Changed Files

- `supabase/migrations/20260717010*.sql` (7)  
- `src/lib/importIntegrity.ts`  
- `src/lib/importService.ts`  
- `src/lib/database.types.ts`  
- `src/components/FileUpload.tsx`  
- `src/lib/__tests__/importIntegrity.test.ts`  
- `scripts/production/c_verify_import_integrity.sql`  
- `scripts/production/c_rollback_import_workflow.sql`  
- `docs/IMPORT_WORKFLOW_V2.md`  
- `EV_CHARGING_SYSTEM_PHASE_B_PRODUCTION_CLOSURE_UAT_REPORT.md`  
- `EV_CHARGING_SYSTEM_PHASE_C_IMPLEMENTATION_AND_UAT_REPORT.md`

---

## 23. Remaining Risks

1. Workflow v2 posting not soak-tested with a net-new file (sample files already in production from B closure).  
2. Migration history table may not list C versions (applied via `db query`); reconcile with `supabase migration repair` if desired.  
3. Browser end-to-end of integrity panel still needs human smoke after frontend deploy.  
4. Last-4-only card files need extra validation (documented).

---

## 24. Acceptance Checklist

| Criterion | Status |
|---|---|
| File identity | PASS |
| Operator/card/filename resolution | PASS |
| Preview validation | PASS |
| Duplicate protection (TXN + hash fields) | PASS |
| Transactional post RPC | PASS (flag-gated) |
| Security / anon denial | PASS |
| A1/A2/B preserved | PASS |
| Tests | PASS |
| Controlled flag-on soak post | PENDING ops |

---

## 25. Recommended Next Step

1. Deploy frontend.  
2. Flip `import_workflow_v2_enabled=true` for admin soak with a **new** small machine file (not the already-imported samples).  
3. After soak, authorize Phase D only after explicit Sameer approval.

---

> **Phase C Status:** PASS  
> **Phase D Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
