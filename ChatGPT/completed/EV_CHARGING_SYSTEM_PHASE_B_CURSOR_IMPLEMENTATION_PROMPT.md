# CURSOR IMPLEMENTATION PROMPT — EV CHARGING SYSTEM PHASE B

## Phase Code

`EV-B`

## Phase Name

**Authoritative Tariff and Billing Engine, Overnight and Next-Day Handling, Tariff Timeline Correction, Demand Charge Retirement, Zero-Tax Enforcement, and JOD Precision**

## Repository

`C:\dev\EV-DR\EV-Daily-Report`

## Governing Files

Read and follow:

- `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`
- `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_A2_PRODUCTION_DEPLOYMENT_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`
- `EV_CHARGING_SYSTEM_STAGING_SUPABASE_SETUP_AND_UAT_REPORT.md`

## Sample Files

Use all machine files in:

`C:\dev\EV-DR\EV-Daily-Report\sample files`

Pay special attention to:

- `2026-07-16+abo saleh.xlsx`
- `2026-07-16+mohammad.xlsx`

Do not import them into production unless this prompt explicitly reaches the approved UAT step and only after all safety gates pass.

---

# 1. Execution Instruction

Read this prompt carefully before modifying anything.

Phase B changes financial calculation logic and therefore must be treated as a high-risk financial implementation.

Do not make broad refactors.

Do not change payment methods.

Do not implement handover.

Do not change historical billing automatically.

Do not activate OCPP.

Do not modify unrelated reports except where required to consume the authoritative billing result.

Do not leave two competing financial engines active.

Do not keep the current broken import-time tariff calculation.

Do not use browser-local time implicitly.

Do not reintroduce anonymous RPC execution.

Do not weaken the Phase A2 RLS or RPC security.

Do not break the Phase A1 unique billing protection.

All implementation must be:

- Migration-driven
- Backward-compatible where reasonably possible
- Server-authoritative
- Idempotent
- Auditable
- Versioned
- Reversible
- Tested with real sample files
- Verified at tariff boundaries
- Verified across midnight and next-day completion
- Safe for production rollout
- Fully documented

---

# 2. Mandatory Phase A Closure Gate

Before Phase B implementation, verify:

1. Phase A1 unique billing constraint exists.
2. Duplicate billing groups remain zero.
3. `replace_session_billing` exists.
4. A1 archives remain intact.
5. Phase A2 production RLS is active.
6. Anonymous financial RPC execution is blocked.
7. Existing System Administrators can still access production.
8. Role and station scope are functioning.
9. Current Git branch and worktree are safe.
10. Verified production backup or PITR checkpoint exists.
11. The current production project reference is exactly:

```text
qflxupfeyktdrpilctyo
```

12. The browser UI smoke test for A2 has been completed by Sameer or explicitly accepted as a remaining manual item.

If any critical item fails, stop and create a blocker report.

---

# 3. Confirmed Business Rules

## 3.1 Government Tariff

Use only these four active Jordan government periods:

| Period | Start | End | Rate |
|---|---|---|---:|
| Off-Peak | 05:00 | 14:00 | 0.183 JOD/kWh |
| Mid-Peak | 14:00 | 17:00 | 0.193 JOD/kWh |
| Peak | 17:00 | 23:00 | 0.213 JOD/kWh |
| MID | 23:00 | 05:00 | 0.193 JOD/kWh |

Rules:

- Exactly one active tariff covers every minute.
- Start time is inclusive.
- End time is exclusive.
- No overlap.
- No gap.
- Timezone is `Asia/Amman`.
- Midnight and next-day completion must work correctly.
- Tariff effective dates must be respected.

## 3.2 Demand Charge

Demand Charge is not used.

Remove or retire it from the active Jordan workflow.

The application must use only:

```text
Energy Charge = Energy Consumed (kWh) × Applicable Government Energy Rate
```

Demand Charge must never affect:

- Transaction amount
- Billing total
- Breakdown
- Reports
- Dashboard
- Excel
- PDF
- Import preview
- Recalculation

## 3.3 Tax

Tax is zero.

The active Jordan billing path must use:

```text
Tax = 0
```

Do not apply tax lines.

Do not leave tax as an unresolved business decision.

## 3.4 JOD Precision

Use three decimal places for JOD.

The engine must use a single explicit rounding policy.

Preferred:

```text
ROUND_HALF_UP to 3 decimals
```

Document the exact SQL and TypeScript implementation and ensure parity.

---

# 4. Critical Decision — Cross-Period Sessions

The current client-side engine proportionally allocates total energy by duration across tariff periods.

This prompt requires Cursor to inspect the existing implementation and implement the approved rule.

If Sameer has not separately confirmed a different rule, use:

```text
Option B — Proportional duration split
```

For a session spanning multiple periods:

```text
Energy allocated to segment
= Total session energy × Segment duration / Total session duration
```

Then:

```text
Segment charge
= Segment energy × Segment tariff rate
```

Important:

- The imported files contain total session energy only.
- They do not contain interval meter readings.
- Therefore, the split is a controlled estimate.
- Persist the billing engine version so the method is auditable.
- Do not hide this methodology.

If Cursor finds a clear legal or contractual rule requiring start-time tariff, stop and document the conflict instead of silently overriding.

---

# 5. Phase Objective

Implement one authoritative tariff and billing engine that:

1. Applies the correct tariff automatically at import/posting.
2. Correctly handles overnight sessions.
3. Correctly handles sessions finishing on the next day.
4. Correctly handles tariff boundary crossings.
5. Respects tariff effective dates.
6. Uses `Asia/Amman`.
7. Uses JOD three-decimal precision.
8. Uses Demand Charge = 0.
9. Uses Tax = 0.
10. Stores a deterministic calculation breakdown.
11. Stores calculation version and timestamp.
12. Uses one server-side authoritative persistence path.
13. Keeps client logic for preview only and verifies parity.
14. Prevents manual Bulk Recalculate from being required after normal import.
15. Keeps Bulk Recalculate as an authorized correction tool using the same engine.
16. Fixes the tariff timeline overflow and overnight rendering bug.
17. Prevents invalid tariff coverage from being activated.
18. Produces a detailed implementation and UAT report.

---

# 6. Known Root Cause to Remove

The live `calculate_batch_billing` currently selects:

```sql
ORDER BY rp.priority DESC
LIMIT 1
```

without matching transaction time.

All current priorities are equal, so the RPC can choose an arbitrary rate, commonly Off-Peak `0.183`.

The import path also contains a hardcoded fallback:

```text
energy_kwh × 0.150
```

Phase B must eliminate both defects from active financial calculation.

Do not merely patch the UI.

Do not require users to Bulk Recalculate every import.

---

# 7. Target Architecture

Use:

```text
PostgreSQL RPC / database function
```

as the authoritative persisted billing engine.

The TypeScript calculator may remain for:

- Preview
- Unit tests
- Client-side display before approval

But it must not be the final financial authority.

Both implementations must use shared fixtures and produce matching results.

Recommended engine functions:

- `calculate_session_billing_v2(session_id uuid)`
- `calculate_batch_billing_v2(batch_id uuid, station_id uuid)`
- `recalculate_session_billing_v2(session_id uuid, reason text)`
- `recalculate_batch_billing_v2(batch_id uuid, reason text)`

Names may differ if repository conventions require, but the design must remain clear.

Do not overwrite the existing v1 function without preserving a rollback baseline.

---

# 8. Tariff Data Validation

Before activating a tariff structure, validate:

- Complete 24-hour coverage
- No overlap
- No gaps
- Valid effective dates
- Valid start/end times
- Valid day-of-week coverage
- Valid season handling
- Positive energy rate
- Demand Charge = 0
- Tax = 0
- One applicable structure per station/date
- Overnight periods handled correctly

Implement deterministic validation.

Represent time intervals using minute-of-day or second-of-day.

Use half-open intervals.

For overnight periods:

```text
23:00–05:00
```

logically expands to:

```text
23:00–24:00
00:00–05:00
```

for validation and rendering.

Do not create two database tariff records for the same logical overnight period.

---

# 9. Overnight and Next-Day Session Handling

Mandatory example:

```text
Start: 2026-07-20 23:40:00 Asia/Amman
End:   2026-07-21 00:30:00 Asia/Amman
```

Required:

- Start date remains 20 July.
- End date remains 21 July.
- Duration = 50 minutes.
- No negative duration.
- No date collapse.
- Both segments fall within MID under current tariff.
- Full session billed at MID 0.193 unless a tariff version changes at midnight.
- Daily operational reporting must not lose or double-count the session.

Additional mandatory cases:

```text
22:50 → 23:10
```

Crosses Peak → MID.

```text
04:50 → 05:10
```

Crosses MID → Off-Peak.

```text
13:50 → 17:10
```

Crosses Off-Peak → Mid-Peak → Peak.

```text
23:50 on last day of month → 00:20 next month
```

```text
23:50 on 31 December → 00:20 on 1 January
```

Use full timestamps, not time-only values.

---

# 10. Tariff Effective-Date Handling

If a new tariff structure becomes effective at midnight while a charging session is active:

- Split at the effective-date boundary.
- Use the old tariff before midnight.
- Use the new tariff after midnight.
- Store both tariff structure IDs and period IDs in the breakdown.
- Preserve one authoritative billing calculation for the session.

Do not select tariff version using only session start date.

---

# 11. Billing Breakdown Design

Persist enough detail to explain every result.

Each billing breakdown item should include:

- Billing calculation ID
- Session ID if useful
- Tariff structure ID
- Tariff period ID
- Period name snapshot
- Segment start timestamp
- Segment end timestamp
- Segment duration
- Segment energy
- Applied energy rate
- Energy charge
- Demand charge = 0 or removed
- Tax = 0
- Line total
- Calculation engine version
- Created timestamp

The total must reconcile to the sum of breakdown items within 0.001 JOD.

---

# 12. Billing Calculation Metadata

Add or verify:

- `calculation_engine_version`
- `calculated_at`
- `calculation_method`
- `tariff_structure_id`
- `applied_rate_summary`
- `recalculation_reason`
- `recalculated_by`
- `source_import_batch_id`
- `source = import | manual_recalculate | historical_correction`

Do not store only the final total.

---

# 13. Demand Charge Retirement

Implement the safe two-stage strategy.

## Stage 1 — Phase B Active Retirement

- Hide Demand Charge fields in UI.
- Remove from active forms.
- Remove from templates.
- Force existing active values to zero.
- Ignore in all billing calculations.
- Write zero to legacy fields if they still exist.
- Remove from reports and exports.
- Update types and validation.
- Add tests proving Demand Charge never changes total.

## Stage 2 — Later Cleanup

Do not drop columns immediately if active code still depends on them.

Prepare a later migration to remove obsolete columns after soak and verification.

Potential fields:

- `rate_periods.demand_charge_per_kw`
- `billing_breakdown_items.demand_kw`
- `billing_breakdown_items.demand_charge`

Classify `max_demand_kw` separately.

Keep it only if useful for technical analytics.

Never use it in customer billing.

---

# 14. Tax Zero Enforcement

The active engine must:

- Not query active tax configuration for Jordan billing.
- Persist tax total = 0 if column remains.
- Not create tax breakdown lines.
- Not show tax in active transaction billing UI.
- Not show tax in reports or exports.
- Add tests proving tax does not affect total.

The generic tax table may remain inactive for future use.

---

# 15. JOD Precision and Rounding

Use PostgreSQL numeric types suitable for money, for example:

```text
numeric(14,6) for internal segment math
numeric(14,3) for stored JOD totals
```

Document actual schema choice.

Do not use floating-point for authoritative SQL money calculations.

In TypeScript:

- Avoid uncontrolled IEEE-754 accumulation.
- Use a decimal library or integer minor units if needed.
- Ensure preview matches SQL.
- Add parity tests.

Rounding rules must specify:

- Segment energy precision
- Segment charge rounding
- Subtotal rounding
- Final total rounding
- Report display rounding
- Excel/PDF rounding

---

# 16. Import Integration

Update the import workflow so that after validated session posting:

1. Session is inserted.
2. Correct station and timestamps are available.
3. Authoritative billing engine is called.
4. Billing and breakdown are persisted transactionally.
5. Tariff failure blocks financial completion.
6. Import batch receives billing status.
7. User sees clear success or exception state.
8. No manual Bulk Recalculate is needed.

Remove financial meaning from:

```text
charging_sessions.calculated_cost = energy × 0.150
```

Options:

- Stop writing it.
- Set it from authoritative billing total.
- Deprecate reads and migrate reports away from it.

Recommend the safest option.

---

# 17. Bulk Recalculate

Keep Bulk Recalculate only as an authorized correction tool.

Required:

- Uses the same authoritative v2 engine.
- Requires permission.
- Requires reason.
- Writes audit event.
- Is idempotent.
- Does not create duplicate billing.
- Is blocked for locked handovers in future-compatible checks.
- Does not silently change already finalized financial records.

In Phase B, if handover locking does not yet exist, prepare the guard interface without implementing Phase D.

---

# 18. Tariff Timeline UI Correction

Inspect the actual timeline component.

Current problem:

```text
left = start / 1440 × 100
width = (end - start) / 1440 × 100
```

For `23:00–05:00`, width becomes negative or renders outside the timeline.

Target:

- One DB record
- Two visual segments
- Same record ID
- `23:00–24:00`
- `00:00–05:00`
- No overflow
- No negative width
- Responsive
- Accessible
- Shared rendering logic
- Gap/overlap indicators
- Complete-coverage badge

Likely create a shared utility such as:

```text
src/lib/tariffIntervalUtils.ts
```

Use it in:

- Tariff editor
- Tariff preview
- Validation
- Tests

---

# 19. SQL Migration Plan

Create controlled migrations, likely:

1. `*_b_billing_engine_metadata.sql`
2. `*_b_tariff_coverage_validation.sql`
3. `*_b_billing_engine_v2.sql`
4. `*_b_demand_charge_retirement_stage1.sql`
5. `*_b_import_billing_status.sql`
6. `*_b_billing_rpc_grants_and_audit.sql`

For each migration include:

- Preconditions
- Forward operations
- Data backfill
- Constraints
- Indexes
- RLS compatibility
- Grants
- Verification SQL
- Rollback/compensation
- Production risk

Do not automatically recalculate all historical rows.

---

# 20. Security Requirements

Preserve Phase A2 controls.

Every new RPC must:

- Reject anonymous
- Require approved user
- Validate role
- Validate station scope
- Use safe `search_path`
- Restrict PUBLIC execute
- Grant only required roles
- Write audit events
- Avoid SQL injection
- Avoid trusting client-provided station IDs without verification

Do not weaken current policies.

---

# 21. Automated Test Plan

Add comprehensive tests.

## Boundary Times

- 04:59:59
- 05:00:00
- 13:59:59
- 14:00:00
- 16:59:59
- 17:00:00
- 22:59:59
- 23:00:00
- 23:59:59
- 00:00:00

## Overnight

- 23:40 Day 1 → 00:30 Day 2
- 22:50 → 23:10
- 04:50 → 05:10
- Month-end
- Year-end

## Multi-Period

- 13:50 → 17:10
- Long session crossing 3 periods

## Tariff Version

- Effective-date change at midnight
- Missing active tariff
- Overlapping tariff
- Gap
- Inactive structure

## Billing

- One period
- Two periods
- Three periods
- Zero demand charge
- Zero tax
- JOD rounding
- SQL/TS parity
- Recalculation idempotency
- Unique billing preserved

## Timeline UI

- Overnight split
- No overflow
- No negative width
- Coverage complete
- Gap detected
- Overlap detected

---

# 22. Real Sample File UAT

Use the two new sample files only after test environment and backup gates pass.

## ABO SALEH

File:

```text
2026-07-16+abo saleh.xlsx
```

Critical transaction:

```text
1573323579
Start: 2026-07-15 23:53:32
Stop:  2026-07-16 00:37:05
Energy: 38.000 kWh
Expected: Entirely MID @ 0.193
```

Expected total before rounding:

```text
38.000 × 0.193 = 7.334 JOD
```

Verify:

- Correct next-day end date
- Correct duration
- One logical MID charge unless version changes
- No negative duration
- No manual Bulk Recalculate

## MOHAMMAD

File:

```text
2026-07-16+mohammad.xlsx
```

Boundary transactions include:

- `1409778499`
- `1613808371`
- `445488588`
- `1201532186`
- `696086752`
- `2046279491`

Verify proportional splitting across 14:00.

Use exact timestamps and energy from the file.

Produce expected calculation tables.

---

# 23. Runtime UAT

Run:

## UAT-B-01 — Tariff Coverage

- Activate only valid 24-hour structure.
- Reject gap.
- Reject overlap.

## UAT-B-02 — Timeline

- MID displays as two linked segments.
- No block extends beyond 24:00.

## UAT-B-03 — Import Billing

- Import sample file.
- Billing generated automatically.
- Correct rates applied.
- No manual Bulk Recalculate.

## UAT-B-04 — Overnight

- Verify TXN `1573323579`.

## UAT-B-05 — Boundary Split

- Verify Mohammad boundary transactions.

## UAT-B-06 — Recalculate

- Run authorized recalculation twice.
- One billing row remains.
- Same result both times.
- Audit entries created.

## UAT-B-07 — Security Regression

- Anonymous RPC denied.
- Unauthorized role denied.
- Authorized admin/ops allowed within scope.

## UAT-B-08 — A1/A2 Regression

- Duplicate groups remain zero.
- RLS remains enforced.
- Existing admin access remains.

---

# 24. Historical Data

Do not recalculate historical billing in Phase B.

Instead create a read-only comparison utility or report that can later identify:

- Legacy engine rows
- Missing engine version
- Wrong rate
- Non-zero demand charge
- Non-zero tax
- Differences between old and v2 result

Historical correction belongs to Phase F after approval.

---

# 25. Production Rollout Strategy

Use staged activation even on production.

Recommended:

1. Deploy schema and engine v2.
2. Keep old engine available for rollback.
3. Feature flag new imports to v2.
4. Test one controlled batch.
5. Verify billing, breakdown, reports, and audit.
6. Enable v2 for all new imports.
7. Disable old import billing path.
8. Keep rollback baseline.
9. Do not recalculate history.

Document the exact feature flag or switch.

---

# 26. Required Deliverable

Create:

`EV_CHARGING_SYSTEM_PHASE_B_IMPLEMENTATION_AND_UAT_REPORT.md`

Required structure:

## 1. Executive Summary

- What changed
- What did not change
- Production touched?
- New engine status
- Overnight status
- Timeline status
- Demand Charge status
- Tax status
- Historical billing status

## 2. Phase A Prerequisite Verification

## 3. Current Defect Confirmation

## 4. Target Architecture

## 5. Tariff Validation Design

## 6. Overnight and Next-Day Handling

## 7. Cross-Period Calculation Method

## 8. SQL Migrations

## 9. Billing Engine v2

## 10. Import Integration

## 11. Bulk Recalculate Integration

## 12. Demand Charge Retirement

## 13. Zero-Tax Enforcement

## 14. JOD Precision

## 15. Timeline UI Correction

## 16. Security and RPC Authorization

## 17. Automated Tests

## 18. Sample File UAT

## 19. Runtime UAT

## 20. A1/A2 Regression

## 21. Historical Comparison Readiness

## 22. Rollback Plan

## 23. Changed Files

## 24. Remaining Risks

Especially:

- Payment methods not yet implemented
- Handover not yet implemented
- Historical billing not corrected
- Reports may still need Phase E reconciliation

## 25. Acceptance Checklist

## 26. Recommended Next Step

State whether Phase B may close and whether Phase C may begin.

---

# 27. Acceptance Criteria

Phase B is complete only when:

1. Correct tariff applies automatically at import.
2. Bulk Recalculate is no longer required for normal imports.
3. One authoritative server-side engine persists billing.
4. SQL and TypeScript preview results match.
5. `Asia/Amman` is enforced.
6. Overnight next-day sessions work.
7. Cross-period sessions follow the approved proportional rule.
8. Tariff effective-date changes at midnight work.
9. Complete 24-hour coverage is enforced.
10. Overlaps and gaps are rejected.
11. Timeline renders overnight periods correctly.
12. Demand Charge contributes zero and is removed from active UI.
13. Tax contributes zero and is removed from active billing UI.
14. JOD values reconcile to 0.001.
15. Billing uniqueness remains intact.
16. Anonymous and unauthorized RPC execution remains blocked.
17. Sample file UAT passes.
18. A1 and A2 regressions pass.
19. No historical recalculation occurs.
20. Implementation report is complete.

---

# 28. Stop Conditions

Stop and report if:

- Phase A1 uniqueness is broken.
- Phase A2 security is broken.
- Backup cannot be verified.
- Tariff structure has unresolved overlap or gap.
- Cross-period business rule is not approved.
- SQL and TS calculations disagree.
- Sample file timestamps parse inconsistently.
- New engine changes historical rows unintentionally.
- Timeline fix requires unrelated redesign.
- Admin access breaks.
- RPC authorization fails.
- Any migration changes payment or handover data.

Do not bypass these conditions.

---

# 29. Final Instruction

Implement Phase B only.

Do not start Phase C.

Do not implement payment methods.

Do not implement handover.

Do not recalculate historical billing.

Do not activate OCPP.

End the report with:

> **Phase B Status:** PASS / FAIL / BLOCKED  
> **Phase C Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
