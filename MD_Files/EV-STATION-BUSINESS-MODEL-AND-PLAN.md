# EV Charging Station — Business Model & Enhancement Plan

**Document Version:** 1.7 (Final Reviewed)  
**Date:** 2026-03-13  
**Status:** 🟡 AWAITING REVIEW — DO NOT IMPLEMENT  

---

## 1. Current System Overview (As-Is Analysis)

### 1.1 Technology Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 + TailwindCSS 3 |
| Backend/DB | Supabase (PostgreSQL 17, hosted `ap-northeast-1`) |
| Auth | Supabase Auth (email/password) |
| Excel Parsing | `xlsx` library (SheetJS) |
| PDF Generation | `jsPDF` + `jspdf-autotable` |
| Date/Time | `date-fns` + `date-fns-tz` (timezone: `Asia/Amman`) |
| Currency | JOD (Jordanian Dinar), 3 decimal places |
| Icons | `lucide-react` |

### 1.2 Database Schema (20 tables in Supabase)

**Core Business Tables:**
| Table | Rows | Purpose |
|---|---|---|
| `stations` | 1 | Charging station master data |
| `operators` | 5 | Operator profiles (linked via `card_number`) |
| `charging_sessions` | 56,832 | Individual charging session records |
| `import_batches` | 245 | Upload history/audit trail |
| `billing_calculations` | 19,972 | Calculated billing per session |
| `billing_breakdown_items` | 21,073 | Itemized billing by rate period |
| `rate_structures` | 1 | Time-of-use rate definition |
| `rate_periods` | 4 | Rate periods within a structure |
| `fixed_charges` | 0 | Station-level fixed charges |
| `tax_configurations` | 0 | Tax setup (not integrated) |

**OCPP Tables (placeholder, unused):** `ocpp_chargers`, `ocpp_connectors`, `ocpp_charging_sessions`, `ocpp_meter_values`, `ocpp_messages`, `ocpp_remote_commands`, `ocpp_configuration_keys`, `ocpp_firmware_updates`, `ocpp_reservations`, `ocpp_charger_availability`

### 1.3 Current Application Flow

```
┌─────────────┐      ┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│  Login      │ ──→  │  Dashboard   │ ──→  │  Import Excel  │ ──→  │  Billing     │
│  (Supabase  │      │  (KPIs,      │      │  (Select       │      │  Calculate   │
│   Auth)     │      │   Charts)    │      │   Station,     │      │  from Rates  │
└─────────────┘      └──────────────┘      │   Upload File) │      └──────────────┘
                                           └────────────────┘
```

### 1.4 Current Upload Flow (KEY GAPS IDENTIFIED)

**What it does now:**
1. User selects a station from dropdown
2. User drags/drops or browses an Excel file
3. System parses the file and inserts rows **directly into the database**
4. Validation errors are shown as a summary count only (e.g. "3 failed")
5. No way to see which rows failed in context of the spreadsheet
6. No way to correct errors and re-submit — must fix the original file and re-upload
7. No shift assignment — sessions are not linked to shifts or operators during upload
8. No printable shift handover reports

### 1.5 Current Sidebar Navigation

| Section | Items |
|---|---|
| Main | Dashboard, Analytics, Reports |
| Operations | Stations, Operators, Import, Billing, Rates, Fixed Charges |

**Planned Sidebar (after all phases):**
| Section | Items |
|---|---|
| Main | Dashboard, Analytics, Reports |
| Operations | Stations, Operators, Import, Shift History, Billing, Rates |
| Tools | Operator Roster, Import History, Maintenance Log |
| Financial | Accountant Dashboard |
| Admin | Users, Audit Log, System Settings |

### 1.6 Current Operator Model
- Operators have: name, phone, ID number, national number, **card_number** (key link), email, photo, status
- Sessions are matched to operators via `card_number` field on `charging_sessions`
- No shift tracking, no money handover, no schedule management

---

## 2. Business Model — Your Station Operations

### 2.1 Station Setup
- **Location:** Jordan
- **Timezone:** `Asia/Amman` (EET/EEST, UTC+2/+3)
- **Currency:** JOD (Jordanian Dinar, 3 decimal places)
- **Operators:** Multiple operators rotating across shifts

### 2.2 Shift Schedule

**Station manager selects shift duration during upload: 8 hours or 12 hours.**

**Standard 8-hour shifts (3 operators):**
| Shift | Name | Start | End | Duration |
|---|---|---|---|---|
| Shift 1 | Morning | 08:00 | 16:00 | 8 hours |
| Shift 2 | Evening | 16:00 | 00:00 | 8 hours |
| Shift 3 | Night | 00:00 | 08:00 | 8 hours |

**Extended 12-hour shifts (off-day scenario — station manager chooses during upload):**
| Shift | Name | Start | End | Duration |
|---|---|---|---|---|
| Option A | Day Extended | 08:00 | 20:00 | 12 hours |
| Option B | Night Extended | 20:00 | 08:00 | 12 hours |

### 2.3 End-of-Shift Workflow

```
Operator finishes shift
        │
        ▼
Export data from machine (Excel)
        │
        ▼
Station Manager opens the system
        │
        ▼
Upload Excel file → Select Operator → Select Shift
        │
        ▼
System validates & shows preview as spreadsheet
        │
    ┌───┴───┐
    │ OK?   │
    │       │
   YES     NO ──→ Highlight errors in RED in the spreadsheet
    │              Manager corrects inline
    │              Press "Finish Upload"
    ▼              │
System saves to DB ◄┘
        │
        ▼
kWh & money calculated per session
        │
        ▼
Print: 1. Shift Session Report
       2. Money Handover Letter
```

---

## 3. Proposed Changes — Feature-by-Feature

### 3.1 🔄 Enhanced File Upload with In-App Spreadsheet Preview

**Current:** File is parsed → inserted directly → errors shown as text summary.  
**Proposed:** File is parsed → shown as an **in-app editable spreadsheet** → errors marked in **red** → manager corrects → presses "Finish Upload" → saved to DB.

#### New Workflow:
1. Manager selects: **Station**, **Operator**, **Shift** (from dropdown with time range)
2. Manager uploads the Excel file
3. System parses the file and shows a **spreadsheet-like table** inside the app
4. Each row is validated. Invalid rows are:
   - Highlighted in **red background**
   - An error icon + tooltip shows the specific error for each cell
5. Manager can **edit cell values inline** to correct errors
6. Manager presses **"Finish Upload to Database"** button
7. System re-validates, then inserts all valid sessions into the database
8. Each session is tagged with: `operator_id`, `shift_id`, `import_batch_id`

#### Technical Approach:
- No new library needed — build a custom `<table>` with editable `<input>` cells
- Error state is managed as a map of `{ rowIndex: { fieldName: errorMessage } }`
- Red highlighting via conditional CSS classes
- "Finish Upload" button triggers re-validation → bulk insert

---

### 3.2 ⏰ Shift Management System

**New database table: `shifts`**
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| station_id | uuid FK | Which station |
| operator_id | uuid FK | Which operator worked this shift |
| shift_duration | text | '8h' / '12h' |
| shift_type | text | 'morning' / 'evening' / 'night' / 'extended_day' / 'extended_night' |
| shift_date | date | The date of the shift |
| start_time | timestamptz | Actual shift start |
| end_time | timestamptz | Actual shift end |
| import_batch_id | uuid FK | Link to the imported data batch |
| total_kwh | numeric | Calculated total kWh for this shift |
| total_amount_jod | numeric(12,3) | Total money collected this shift |
| handover_status | text | 'pending' / 'printed' / 'deposited' / 'handed_over' |
| bank_deposit_slip | text | URL/reference to bank deposit slip (uploaded image/PDF) |
| bank_deposit_date | date | Date money was deposited at bank |
| bank_deposit_reference | text | Bank deposit reference number |
| notes | text | Optional notes |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

**Add `shift_id` and `operator_id` columns to `charging_sessions` table** to link each session to a shift and operator.

**Operator-session linking:** Sessions continue to be matched to operators via `card_number` field (confirmed by user).

---

### 3.3 💰 kWh Calculation & Money Collection

**Current:** Billing is calculated later via the Billing page (batch process).  
**Proposed:** Billing is calculated **immediately during upload** for each session, so the shift report can show kWh and JOD amounts right away.

#### Calculation logic:
- Each session's cost is calculated using the station's active rate structure (TOU rates)
- If no rate structure exists, a fallback flat rate is used (currently 0.150 JOD/kWh)
- Total per shift = sum of all session costs
- This total is the amount the operator must hand over to the manager

#### Money Handover Workflow (detailed by user):
```
Shift upload complete → kWh & JOD calculated
        │
        ▼
Station Manager collects money from operator
        │
        ▼
Station Manager deposits money at bank
        │
        ▼
Station Manager uploads deposit slip to the system
  (photo/scan of bank deposit slip + reference number)
        │
        ▼
Station Manager attaches deposit slip to the shift record
  along with: session list + money handover letter
        │
        ▼
Station Manager hands over documents to Accounts department:
  • Bank deposit slip
  • Shift session report
  • Money handover letter
        │
        ▼
System marks shift as "Handed Over"
```

**Shift handover statuses:**
| Status | Meaning |
|---|---|
| `pending` | Shift uploaded, money not yet collected |
| `printed` | Reports printed, money collected from operator |
| `deposited` | Money deposited at bank, slip uploaded |
| `handed_over` | All documents handed to Accounts — complete |

---

### 3.4 📄 PDF Reports & Export (with Dynamic Branding)

After each successful shift upload, the system offers **downloadable & printable PDF documents**.

> ❗ **All PDFs use the company branding from System Settings (Section 3.28):**
> - Company logo (uploaded image)
> - Company name
> - Company address, phone, email
> - Custom footer text

#### PDF Generation Rules:
- **Proper page fitting** — tables that span multiple pages handle page breaks cleanly
- **No data split mid-row** — rows never break across pages; if a row doesn't fit, it moves to the next page
- **Repeating header** — table header row repeats on every page
- **Page numbers** — "Page X of Y" in the footer
- **Branded header on every page** — company logo + name + report title
- **Export formats** — Download as PDF, or Print directly from browser
- **Library:** `jspdf` + `jspdf-autotable` for proper table pagination

#### Report 1: Shift Session List
```
╔══════════════════════════════════════════════════════════╗
║  [COMPANY LOGO]    [Company Name]                      ║
║                    [Company Address]                    ║
║                    [Phone] | [Email]                    ║
║                                                        ║
║        EV CHARGING STATION - SHIFT SESSION REPORT      ║
║                                                        ║
║  Station: [Station Name]          Date: [Date]         ║
║  Operator: [Operator Name]        Shift: [Shift Type]  ║
║  Shift Time: [Start] - [End]      Duration: [8h/12h]   ║
╠══════════════════════════════════════════════════════════╣
║  # │ Transaction │ Start  │ End   │ kWh    │ Amount JOD ║
║  1 │ TXN-001     │ 08:12  │ 09:45 │ 25.340 │  3.801     ║
║  2 │ TXN-002     │ 08:30  │ 10:15 │ 42.150 │  6.323     ║
║ .. │ ...         │ ...    │ ...   │ ...    │  ...       ║
╠══════════════════════════════════════════════════════════╣
║  TOTAL                           │ 285.60 │ 42.840 JOD ║
╚══════════════════════════════════════════════════════════╝
              [Custom Footer Text]       Page 1 of 3
```

#### Report 2: Money Handover Letter
```
╔══════════════════════════════════════════════════════════╗
║  [COMPANY LOGO]    [Company Name]                      ║
║                    [Company Address]                    ║
║                    [Phone] | [Email]                    ║
║                                                        ║
║              MONEY HANDOVER ACKNOWLEDGEMENT             ║
║                                                        ║
║  Date: [Date]                                          ║
║  Station: [Station Name]                               ║
║                                                        ║
║  Operator: [Operator Name]                             ║
║  National ID: [ID Number]                              ║
║  Shift: [Morning/Evening/Night] ([Start] - [End])      ║
║                                                        ║
║  Total Sessions: [Count]                               ║
║  Total Energy Delivered: [kWh] kWh                     ║
║  ─────────────────────────────────────────────          ║
║  TOTAL AMOUNT TO HANDOVER: [Amount] JOD                ║
║  ─────────────────────────────────────────────          ║
║                                                        ║
║  Operator Signature: _______________                   ║
║                                                        ║
║  Manager Signature:  _______________                   ║
║                                                        ║
║  Date & Time: _______________                          ║
║                                                        ║
║              [Custom Footer Text]                       ║
╚══════════════════════════════════════════════════════════╝
```

#### All PDF Reports in the System:
Every report across the entire system uses the same branded PDF template:
| Report | Location | Details |
|---|---|---|
| Shift Session List | Post-upload + Shift History | Per-shift session table with totals |
| Money Handover Letter | Post-upload + Shift History | Handover acknowledgement with signatures |
| Weekly Summary Report | Reports page | All shifts grouped by day |
| Monthly Summary Report | Reports page | All shifts grouped by week |
| Operator Summary Report | Reports page | All shifts for a specific operator |
| Station Summary Report | Reports page | All shifts for a specific station |
| CDR Export | Reports page | Charging Detail Records (CSV/Excel + PDF) |
| Roster Print | Operator Roster | Weekly/monthly schedule |
| Audit Export | Audit Log page | Activity log (CSV + PDF) |

---

### 3.5 📊 Dashboard Enhancement

**Current:** Basic KPI cards + canvas-based charts (no charting library).  
**Proposed:** Modern, visually stunning dashboard using a proper charting library.

#### Changes:
1. **Add `recharts` library** — a React-native charting library for modern, animated, responsive charts
2. **Replace all canvas-based charts** with Recharts components:
   - Energy Trend → animated `AreaChart` with gradient fill
   - Revenue by Station → `BarChart` with rounded bars and tooltips
   - Connector Type → `PieChart` with animated segments
   - Best Time to Charge → `BarChart` with gradient colors by hour
   - Daily Transactions → `BarChart` with stacked connectors
   - Shift Comparison → `BarChart` comparing shifts
   - Station Utilization → `RadialBarChart`
3. **New dashboard widgets:**
   - Shift Overview card (today's shifts, who's on duty, status)
   - Operator Performance ranking (top operators by sessions/revenue)
   - Live Amman clock (already exists, enhance styling)
4. **Modern styling:**
   - Glassmorphism card effects (backdrop-blur, translucent backgrounds)
   - Gradient backgrounds on KPI cards
   - Smooth hover animations and transitions
   - Dark mode accent gradients

---

### 3.6 📈 Analytics Dashboard Enhancement

**Current:** MetricCards + basic canvas charts.  
**Proposed:** All charts replaced with Recharts. Add new analytics:
- **Operator Performance Analytics** — sessions, kWh, revenue per operator over time
- **Shift Analytics** — compare morning vs evening vs night shifts
- **Revenue Trend** — line chart with area fill
- **Peak Hours Heatmap** — enhanced with modern colors and tooltips

---

### 3.7 📋 Reports & Analytics Enhancement

**Current:** Export page with date range → PDF/Excel/CSV export.  
**Proposed:** Add these new report types:
1. **Shift Report** — filter by date, operator, shift type
2. **Operator Report** — all shifts for an operator in a period
3. **Daily Summary Report** — all shifts for a day
4. **Money Handover History** — list of all handovers with status
5. **Monthly Summary** — totals by month with trend comparison

---

### 3.8 👥 Users Module

**Current:** Only Supabase Auth (email/password), no user management UI.  
**Proposed:** A Users module accessible from the sidebar.

> ℹ️ **Confirmed by user:** Operators do NOT get login accounts. Only station managers, accountants, company managers, and global admin have accounts.

#### User Roles (4 roles, confirmed by user):
| Role | Who | Permissions |
|---|---|---|
| `global_admin` | System administrator | Full access: manage everything including users, all stations, rates, system settings |
| `company_manager` | Company owner/director | View all dashboards, analytics, reports across all stations. Read-only for settings. |
| `station_manager` | Station-level manager | Upload shift data, print reports, manage operators, view own station dashboard/analytics |
| `accountant` | Finance/accounts team | View money handover reports, bank deposit tracking, financial reports. Cannot upload shift data. |

#### New Database Table: `user_profiles`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | = auth.users.id |
| email | text | User email |
| full_name | text | Display name |
| role | text | 'global_admin' / 'company_manager' / 'station_manager' / 'accountant' |
| phone | text | Phone number |
| is_active | boolean | Account status |
| station_id | uuid FK | Assigned station (for station_manager). NULL for global roles. |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

#### Role-Based Access Control:
| Feature | Global Admin | Company Manager | Station Manager | Accountant |
|---|---|---|---|---|
| Dashboard | ✅ All stations | ✅ All stations | ✅ Own station | ✅ Financial only |
| Upload shift data | ✅ | ❌ | ✅ Own station | ❌ |
| Print/export PDF reports | ✅ | ✅ | ✅ Own station | ✅ |
| Manage operators | ✅ | ❌ | ✅ Own station | ❌ |
| Manage stations | ✅ | ❌ | ❌ | ❌ |
| Manage rates | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| View handover/deposit reports | ✅ | ✅ | ✅ Own station | ✅ |
| Analytics | ✅ All stations | ✅ All stations | ✅ Own station | ✅ Financial |
| Audit Log | ✅ View/export | ✅ View | ❌ | ❌ |
| System Settings | ✅ Edit | ❌ Read-only | ❌ Read-only | ❌ Read-only |
| Operator Roster | ✅ All stations | ✅ View | ✅ Own station | ❌ |
| Session Notes | ✅ Add/view | ✅ View | ✅ Add/view | ✅ View |
| CDR Export | ✅ | ✅ | ✅ Own station | ✅ |
| Delete import batch | ✅ | ❌ | ✅ Own station | ❌ |
| Maintenance Log | ✅ All stations | ✅ View | ✅ Own station | ❌ |

#### Users Module UI:
- User list with role badges and station assignment
- Add/Edit user form with role selection
- Activate/deactivate users
- Role assignment
- Station assignment (for station_manager role)
- Password reset (via Supabase Auth)

---

### 3.9 🚀 Performance Optimization — Upload Speed, Billing Speed & Large File Support

> ⚠️ **THIS IS A CRITICAL FIX** — You reported that uploading and billing are currently very slow. Here is a deep analysis of why, and the solutions we will implement.

#### 3.9.1 Root Cause Analysis — Why It's Slow

I analyzed every line of code in `importService.ts` and `billingService.ts`. Here are the **3 major bottlenecks**:

**Bottleneck 1: Upload inserts sessions ONE BY ONE (400+ HTTP calls for 100 rows)**

```
Current code in processBatch() (line 615):
  for (let i = 0; i < sessions.length; i++) {
      await insertSession(session, batchId, stationId);  ← 1 HTTP call per row
  }

Inside insertSession() (line 508):
  await calculateCostFromRates(...)  ← 3 more DB calls per row:
      • getActiveRateStructure()     ← 1 HTTP request
      • getRatePeriods()             ← 1 HTTP request  
      • getActiveFixedCharges()      ← 1 HTTP request
  
  await supabase.from('charging_sessions').insert([sessionData])  ← 1 HTTP request

TOTAL for 100 rows = 100 × (3 rate queries + 1 insert) = 400 HTTP round-trips!
TOTAL for 300 rows = 1,200 HTTP round-trips!
```

**Bottleneck 2: Billing calculates ONE BY ONE (3+ HTTP calls per session)**

```
Current code in recalculateMultipleSessions() (line 420):
  for (const sessionId of sessionIds) {
      await calculateAndSaveSessionBilling(sessionId);  ← Each call:
          • Fetches the session from DB    ← 1 HTTP request
          • Fetches rate structure          ← 1 HTTP request (cached in some flows)
          • Fetches fixed charges           ← 1 HTTP request
          • Inserts billing_calculation     ← 1 HTTP request
          • Inserts breakdown_items         ← 1 HTTP request
  }

TOTAL for 100 sessions = 100 × 5 = 500 HTTP round-trips!
```

**Bottleneck 3: No batch/bulk insert support**

The current code passes a **single-element array** `[sessionData]` to `.insert()`. Supabase's API actually supports inserting **multiple rows in one call**:
```typescript
// CURRENT (slow): inserts 1 row per HTTP call
await supabase.from('charging_sessions').insert([sessionData]);  // 1 row at a time

// PROPOSED (fast): inserts 250 rows per HTTP call
await supabase.from('charging_sessions').insert(allSessionsArray);  // 250+ rows at once
```

---

#### 3.9.2 Solution: 3-Layer Speed Optimization

**Layer 1: Client-Side — Bulk Array Insert (10x faster upload)**

Instead of inserting rows one-by-one, we will:
1. **Parse all rows first** (already done — this is fast, pure JavaScript)
2. **Validate all rows** (client-side, no DB needed)
3. **Fetch rate structure ONCE** before the batch (1 query instead of N)
4. **Calculate cost for all rows in memory** using the cached rate data
5. **Bulk-insert all valid rows in one Supabase call** using `.insert(arrayOf250Rows)`

```
BEFORE: 100 rows × 4 HTTP calls = 400 round-trips (~30–60 seconds)
AFTER:  3 HTTP calls total (1 rate query + 1 bulk insert + 1 batch update) = ~2–3 seconds
```

**How we handle 1000+ rows:** Supabase REST API has a payload size limit (~2MB). For large files, we chunk into batches of 250 rows:
```typescript
// Proposed approach:
const CHUNK_SIZE = 250;
for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
        .from('charging_sessions')
        .insert(chunk);  // 250 rows in ONE HTTP call
}
// 1000 rows = 4 HTTP calls instead of 4000!
```

**Layer 2: Server-Side — PostgreSQL Stored Procedure for Billing (100x faster)**

Instead of calculating billing row-by-row from the frontend, we will create a **PostgreSQL function** that runs directly in the database. This eliminates ALL HTTP round-trips for billing:

```sql
-- New PostgreSQL function: calculate_batch_billing
CREATE OR REPLACE FUNCTION calculate_batch_billing(
    p_batch_id UUID,
    p_station_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_rate_structure RECORD;
    v_rate_periods RECORD[];
    v_session RECORD;
    v_total_kwh NUMERIC := 0;
    v_total_amount NUMERIC := 0;
BEGIN
    -- 1. Get rate structure ONCE
    SELECT * INTO v_rate_structure FROM rate_structures
    WHERE station_id = p_station_id AND is_active = true LIMIT 1;

    -- 2. Get rate periods ONCE
    -- 3. Loop through sessions IN THE DATABASE (no HTTP calls)
    FOR v_session IN 
        SELECT * FROM charging_sessions 
        WHERE import_batch_id = p_batch_id
    LOOP
        -- Calculate billing using rate periods
        -- Insert billing_calculation + breakdown_items
        -- All happens inside PostgreSQL — zero HTTP overhead
    END LOOP;

    RETURN jsonb_build_object(
        'total_kwh', v_total_kwh,
        'total_amount', v_total_amount,
        'sessions_processed', count
    );
END;
$$ LANGUAGE plpgsql;
```

Then from the frontend, just ONE call:
```typescript
// Proposed: 1 HTTP call does ALL billing for the entire batch
const { data } = await supabase.rpc('calculate_batch_billing', {
    p_batch_id: batchId,
    p_station_id: stationId
});
// Returns: { total_kwh: 285.60, total_amount: 42.840, sessions_processed: 100 }
```

```
BEFORE: 100 sessions × 5 HTTP calls = 500 round-trips (~40–90 seconds)
AFTER:  1 RPC call total (~1–2 seconds, all computation in PostgreSQL)
```

**Layer 3: Optimized Import + Billing Pipeline (combined)**

The new upload flow combines both optimizations into a single fast pipeline:

```
Step 1: Parse Excel file (client-side, instant)
Step 2: Show spreadsheet preview (client-side, instant)
Step 3: Manager corrects errors & clicks "Finish Upload"
Step 4: Fetch rate structure ONCE (1 HTTP call)
Step 5: Calculate cost for all rows in memory (instant)
Step 6: Bulk insert all sessions (1-4 HTTP calls for 250-1000 rows)
Step 7: Call calculate_batch_billing() RPC (1 HTTP call)
Step 8: Create shift record (1 HTTP call)
Step 9: Show results + print reports

TOTAL for 1000 rows: ~7 HTTP calls (~3-5 seconds)
vs CURRENT for 100 rows: ~400 HTTP calls (~30-60 seconds)
```

---

#### 3.9.3 Speed Comparison Summary

| Scenario | Current Speed | After Optimization | Improvement |
|---|---|---|---|
| Upload 100 rows | ~30-60 sec | ~2-3 sec | **15-20x faster** |
| Upload 300 rows | ~90-180 sec | ~3-4 sec | **30-45x faster** |
| Upload 1000 rows | ❌ Times out | ~5-7 sec | **Works now** |
| Upload 2000 rows | ❌ Impossible | ~10-12 sec | **Works now** |
| Billing for 100 sessions | ~40-90 sec | ~1-2 sec | **40-90x faster** |
| Billing for 1000 sessions | ~400-900 sec | ~3-5 sec | **100x+ faster** |

#### 3.9.4 Handling 1000+ Records — Supabase Limits & Solutions

| Constraint | Limit | Our Solution |
|---|---|---|
| Supabase REST payload size | ~2MB per request | Chunk inserts into batches of 250 rows |
| Supabase row limit per insert | ~1000 rows | Chunk into 250-row batches (safe margin) |
| Excel file size | Currently 10MB max | Keep 10MB limit (supports ~10,000+ rows) |
| Statement timeout | 120s default | RPC function is faster; increase if needed |
| Duplicate detection | Currently via unique constraint error | Pre-check transaction_ids via `.in()` query before insert |

#### 3.9.5 New Files for Performance Optimization

| File | Purpose |
|---|---|
| `supabase/migrations/XXXXXX_create_bulk_billing_function.sql` | [NEW] PostgreSQL function for batch billing calculation |
| `supabase/migrations/XXXXXX_create_bulk_import_function.sql` | [NEW] PostgreSQL function for bulk session import with duplicate handling |
| `src/lib/importService.ts` | [MODIFY] Replace one-by-one insert loop with bulk insert + RPC call |
| `src/lib/billingService.ts` | [MODIFY] Add `calculateBatchBilling()` that calls the RPC function |

---

### 3.10 🗑️ Import Batch Deletion (Cascade Delete)

**New feature:** Station manager can delete an uploaded file (import batch). When deleted, **all related records are automatically removed** from the database.

#### Cascade Delete Chain:
```
Station Manager clicks "Delete Import" on an import batch
        │
        ▼
Confirmation dialog: "This will permanently delete X sessions,
  Y billing calculations, and the associated shift record.
  This action cannot be undone. Are you sure?"
        │
        ▼
  YES → System deletes in this order (respecting FK constraints):
        1. billing_breakdown_items (where billing_calculation_id IN batch)
        2. billing_calculations (where session_id IN batch sessions)
        3. charging_sessions (where import_batch_id = batch)
        4. shifts (where import_batch_id = batch)
        5. import_batches (the batch record itself)
        │
        ▼
  Dashboard refreshes, data is gone
```

#### Technical Approach — PostgreSQL CASCADE Function:

We will create a stored procedure that handles the entire cascade in a **single database transaction** (all-or-nothing):

```sql
CREATE OR REPLACE FUNCTION delete_import_batch(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_session_ids UUID[];
    v_billing_ids UUID[];
    v_deleted_sessions INT;
    v_deleted_billings INT;
    v_deleted_breakdowns INT;
BEGIN
    -- Get all session IDs for this batch
    SELECT ARRAY_AGG(id) INTO v_session_ids
    FROM charging_sessions WHERE import_batch_id = p_batch_id;

    -- Get all billing IDs for these sessions
    SELECT ARRAY_AGG(id) INTO v_billing_ids
    FROM billing_calculations WHERE session_id = ANY(v_session_ids);

    -- Delete in correct order
    DELETE FROM billing_breakdown_items WHERE billing_calculation_id = ANY(v_billing_ids);
    DELETE FROM billing_calculations WHERE session_id = ANY(v_session_ids);
    DELETE FROM charging_sessions WHERE import_batch_id = p_batch_id;
    DELETE FROM shifts WHERE import_batch_id = p_batch_id;
    DELETE FROM import_batches WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'deleted_sessions', array_length(v_session_ids, 1),
        'deleted_billings', array_length(v_billing_ids, 1)
    );
END;
$$ LANGUAGE plpgsql;
```

From the frontend — one RPC call:
```typescript
const { data } = await supabase.rpc('delete_import_batch', {
    p_batch_id: batchId
});
// Returns: { deleted_sessions: 85, deleted_billings: 85 }
```

#### UI Location:
- **Import History list** — each import batch row gets a 🗑️ Delete button
- **Shift History** — delete option on each shift record
- Only `station_manager` and `global_admin` roles can delete
- Confirmation dialog with exact counts before deletion

#### New Files:
| File | Purpose |
|---|---|
| `supabase/migrations/XXXXXX_create_delete_batch_function.sql` | [NEW] PostgreSQL cascade delete function |

---

### 3.11 📱 Mobile-Responsive Upload

**Problem:** Station managers often upload data from a tablet or phone on-site.  
**Solution:** Ensure the entire upload flow (spreadsheet preview, shift selector, print buttons) is fully responsive:
- Spreadsheet preview with horizontal scroll on small screens
- Touch-friendly cell editing (larger tap targets)
- Responsive shift/operator selector cards
- Print buttons accessible on mobile
- Upload drag-and-drop replaced with a large "Tap to Upload" button on mobile

---

### 3.12 🔍 Import History with Search & Filter

**Problem:** 245+ import batches exist with no dedicated browsing UI.  
**Solution:** Add an **Import History** page with:

| Feature | Description |
|---|---|
| Search | By filename, operator name, date range |
| Filter | By station, status (processing/completed/failed), date |
| Columns | Date, filename, operator, shift type, sessions count, total kWh, total JOD, status |
| Actions | View details, re-print reports, delete batch (cascade) |
| Pagination | 25 records per page with page navigation |
| Sort | By date (default), by kWh, by amount |

#### New Files:
| File | Purpose |
|---|---|
| `src/components/ImportHistory.tsx` | [NEW] Searchable/filterable import history page |

---

### 3.13 ⚠️ Anomaly Detection During Upload

**Problem:** Meter errors, data entry mistakes, and outlier sessions are not flagged before saving.  
**Solution:** During spreadsheet preview, flag suspicious sessions with **yellow warnings** (not red errors — manager can still approve):

| Anomaly | Rule | Warning Message |
|---|---|---|
| Energy too high | kWh > 200 per session | "Unusually high energy — verify meter reading" |
| Duration mismatch | kWh / duration ratio abnormal | "Energy doesn't match session duration" |
| Out-of-shift | Session start/end outside shift time window | "Session is outside the selected shift hours" |
| Negative values | Energy < 0 or cost < 0 | "Negative value detected" |
| Zero energy | kWh = 0 but duration > 0 | "Zero energy reported for active session" |
| Very short session | Duration < 2 minutes | "Session may be too short to be valid" |

- Warnings shown as **yellow background** rows with ⚠️ icon
- Tooltip explains the specific warning
- Manager can dismiss warnings and proceed with upload
- Warning count shown on the "Finish Upload" button

---

### 3.14 💳 Operator Performance Dashboard

**Problem:** No visibility into individual operator productivity or trends.  
**Solution:** A dedicated operator analytics view showing:

- **KPI Cards:** Total sessions, total kWh, total revenue, average session duration per operator
- **Ranking Table:** Operators ranked by sessions/kWh/revenue (daily/weekly/monthly)
- **Trend Chart:** Line chart showing each operator's kWh/revenue over time
- **Comparison Bar Chart:** Side-by-side operator comparison
- **Filter:** By station, date range, shift type

#### New Files:
| File | Purpose |
|---|---|
| `src/components/OperatorPerformance.tsx` | [NEW] Operator performance dashboard with charts |
| `src/lib/operatorAnalyticsService.ts` | [NEW] Data queries for operator metrics |

---

### 3.15 📊 Shift Comparison Report

**Problem:** No way to compare shift performance to identify patterns or scheduling issues.  
**Solution:** A shift analytics view with:

- **Morning vs Evening vs Night** — bar chart comparing total kWh and revenue
- **Weekday vs Weekend** — comparative chart
- **Shift Efficiency:** Average kWh per hour by shift type
- **Best/Worst Shifts:** Ranking by total revenue
- **Trend Over Time:** How each shift type trends weekly/monthly
- **Filter:** By station, date range

Integrated into the Analytics Dashboard as a new tab.

---

### 3.16 🧾 Accountant Dashboard

**Problem:** The `accountant` role has no dedicated view for financial tracking.  
**Solution:** A purpose-built dashboard for the accountant role:

| Widget | Description |
|---|---|
| Pending Deposits | Shifts where `handover_status` = 'pending' or 'printed' (money collected but not deposited) |
| Pending Handovers | Shifts where `handover_status` = 'deposited' (deposited but docs not handed to accounts) |
| Deposit History | Table of all deposits with bank reference, date, amount, slip image |
| Daily Revenue | Bar chart of revenue by day |
| Weekly/Monthly Summary | Revenue totals with comparison to previous period |
| Outstanding Alerts | Red badges for shifts pending > 24 hours |
| Export | One-click export to Excel for accounting records |

#### New Files:
| File | Purpose |
|---|---|
| `src/components/AccountantDashboard.tsx` | [NEW] Financial tracking dashboard for accountants |
| `src/lib/accountingService.ts` | [NEW] Queries for financial data, pending deposits, summaries |

---

### 3.17 📋 Batch Weekly/Monthly Report Export

**Problem:** Currently only individual shift reports can be printed. No combined period reports.  
**Solution:** One-click generation of combined PDF reports:

- **Weekly Report:** All shifts for a week — grouped by day, totals per day and grand total
- **Monthly Report:** All shifts for a month — grouped by week, with monthly comparison
- **Operator Summary Report:** All shifts for a specific operator over a period
- **Station Summary Report:** All shifts for a specific station over a period
- **Format:** Professional PDF with company header, table of shifts, totals, and signature line
- **Export Options:** PDF and Excel

Added to the Reports page as new report types.

---

### 3.18 🌙 Dark Mode

**Problem:** No dark theme for nighttime use (night shift operators and managers).  
**Solution:** System-wide dark mode toggle:

- Toggle button in the sidebar header or top bar
- User preference saved to `localStorage` and optionally to `user_profiles`
- Dark color palette matching the existing brand colors
- All components, charts, and modals adapt to dark theme
- Glassmorphism effects enhanced in dark mode (glowing borders, subtle gradients)
- Respects system `prefers-color-scheme` on first visit

---

### 3.19 🔔 Notification System

**Problem:** No in-app alerts for important events.  
**Solution:** In-app notification center:

| Event | Notification |
|---|---|
| Shift upload completed | "85 sessions uploaded for Morning Shift — JOD 42.840 total" |
| Deposit pending > 24h | "⚠️ Morning Shift (Mar 12) deposit pending for 26 hours" |
| Billing calculation done | "Billing calculated for 85 sessions" |
| Import batch deleted | "Import batch 'file_march12.xlsx' deleted (85 sessions removed)" |
| Anomaly detected | "⚠️ 3 anomalies detected in last upload" |

- Bell icon 🔔 in the top bar with badge count
- Dropdown panel showing recent notifications
- Notifications stored in a new `notifications` table
- Mark as read / dismiss
- Auto-cleanup after 30 days

#### New Database Table: `notifications`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| user_id | uuid FK | Target user |
| type | text | 'upload' / 'deposit_pending' / 'billing' / 'deletion' / 'anomaly' |
| title | text | Short message |
| body | text | Detailed message |
| is_read | boolean | Read status |
| metadata | jsonb | Related IDs (batch_id, shift_id, etc.) |
| created_at | timestamptz | Auto |

#### New Files:
| File | Purpose |
|---|---|
| `src/components/NotificationBell.tsx` | [NEW] Bell icon with dropdown panel |
| `src/lib/notificationService.ts` | [NEW] CRUD for notifications + auto-generation triggers |
| `supabase/migrations/XXXXXX_create_notifications.sql` | [NEW] Notifications table DDL |

---

### 3.20 🔄 Duplicate Preview Before Upload

**Problem:** Duplicates are only detected during insert (constraint violation), making it unclear before upload.  
**Solution:** Before "Finish Upload", check for existing `transaction_id`s:

```
Manager clicks "Finish Upload"
        │
        ▼
System queries: SELECT transaction_id FROM charging_sessions
  WHERE transaction_id IN (...all IDs from the spreadsheet...)
        │
        ▼
  ┌─────────────┐
  │ Duplicates?  │
  │             │
  NO           YES → Show modal: "12 of 100 rows already exist in the database.
  │                   These will be SKIPPED during upload:
  │                   [list of duplicate transaction IDs]
  │                   Continue with remaining 88 rows?"
  │                        │
  ▼                       YES → Upload 88 rows
 Upload all 100             NO → Cancel, review spreadsheet
```

- Duplicate rows highlighted in **blue** in the spreadsheet
- Clear count: "88 new / 12 duplicates"
- Fast — single `.in()` query before insert

---

### 3.21 📈 Revenue Forecasting

**Problem:** No forward-looking analytics for planning.  
**Solution:** Based on historical data, show projected revenue:

- **7-Day Forecast:** Line chart extending current revenue trend
- **30-Day Forecast:** Monthly projection based on rolling averages
- **Algorithm:** Simple moving average of last 30/90 days
- **Display:** Dashed line extending from actual data on the revenue chart
- **Confidence Band:** Light shaded area showing min/max expected range
- Available for `company_manager` and `global_admin` roles

Integrated into the Dashboard as a new widget and in Analytics as a detailed view.

---

### 3.22 🛠️ Station Maintenance Log

**Problem:** No tracking of station downtime, maintenance, or issues.  
**Solution:** Simple maintenance log per station:

| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| station_id | uuid FK | Which station |
| reported_by | uuid FK | User who reported |
| issue_date | date | When the issue occurred |
| issue_type | text | 'maintenance' / 'breakdown' / 'software' / 'power_outage' / 'other' |
| description | text | What happened |
| resolution | text | How it was fixed |
| downtime_hours | numeric | Hours of downtime |
| status | text | 'open' / 'in_progress' / 'resolved' |
| resolved_date | date | When resolved |
| created_at | timestamptz | Auto |

#### UI:
- Maintenance log tab on the Station detail page
- Add/edit issue form
- Filter by status, date range
- Dashboard widget showing open issues count
- Impact on analytics: downtime hours shown in station utilization reports

#### New Files:
| File | Purpose |
|---|---|
| `src/components/MaintenanceLog.tsx` | [NEW] Station maintenance log UI |
| `src/lib/maintenanceService.ts` | [NEW] CRUD for maintenance records |
| `supabase/migrations/XXXXXX_create_maintenance_log.sql` | [NEW] Maintenance log table DDL |

---

### 3.23 📋 Audit Trail / Activity Log

**Source:** Industry standard across all commercial CSMS platforms (Driivz, ChargePoint, AmpControl).  
**Problem:** No record of who did what, when. Critical for accountability and compliance.

**Solution:** Log every significant action in the system:

#### Events Tracked:
| Event | Data Recorded |
|---|---|
| File uploaded | Who, when, filename, station, row count |
| Batch deleted | Who, when, batch ID, sessions removed count |
| Report printed | Who, when, report type, shift/batch ID |
| Rate structure changed | Who, when, old values, new values |
| User role changed | Who changed it, target user, old role, new role |
| Operator created/edited | Who, when, what changed |
| Shift handover status changed | Who, when, from status, to status |
| User login / logout | Who, when, IP address |
| Session notes added | Who, when, session ID, note content |
| Deposit slip uploaded | Who, when, shift ID, reference number |

#### New Database Table: `audit_log`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| user_id | uuid FK | Who performed the action |
| action | text | 'upload' / 'delete' / 'print' / 'rate_change' / 'role_change' / 'login' / etc. |
| entity_type | text | 'import_batch' / 'shift' / 'operator' / 'user' / 'rate_structure' / etc. |
| entity_id | uuid | ID of the affected record |
| details | jsonb | Full details of the action (old/new values, counts, etc.) |
| ip_address | text | Source IP |
| created_at | timestamptz | When it happened |

#### UI:
- **Audit Log page** — visible to `global_admin` and `company_manager` only
- Searchable by user, action type, date range, entity
- Exportable to CSV for compliance
- Chronological timeline view with user avatars

#### New Files:
| File | Purpose |
|---|---|
| `src/components/AuditLog.tsx` | [NEW] Audit trail viewer page |
| `src/lib/auditService.ts` | [NEW] Audit log recording + querying |
| `supabase/migrations/XXXXXX_create_audit_log.sql` | [NEW] Audit log table DDL |

---

### 3.24 📊 Industry-Standard KPI Dashboard

**Source:** Driivz, AmpUp, AmpControl, EVBahan — standard metrics across all CSMS platforms (2025 best practices).  
**Problem:** Current dashboard shows basic stats. Missing key business intelligence metrics.

**Solution:** Add industry-standard KPI widgets to the Home Dashboard:

| KPI | Formula | Visual | Why It Matters |
|---|---|---|---|
| **Utilization Rate** | Active charging hours ÷ Total available hours × 100 | Gauge chart (%) | Shows if station is earning or idle |
| **Avg Session Duration** | Sum of all session durations ÷ Total sessions | Number card (minutes) | Identifies charging patterns |
| **Revenue per Charger** | Total revenue ÷ Number of active chargers | Bar chart | Profitability per hardware unit |
| **Revenue per kWh** | Total revenue ÷ Total kWh delivered | Number card (JOD) | Margin efficiency |
| **Avg kWh per Session** | Total kWh ÷ Total sessions | Number card | Energy delivery per session |
| **Sessions per Day** | Total sessions ÷ Days in period | Trend line | Station traffic volume |
| **Peak Hour Utilization** | % of sessions during peak tariff hours | Pie chart | Understand tariff impact |
| **Station Uptime** | (Total hours - maintenance downtime) ÷ Total hours | Gauge chart (%) | Reliability metric (target: 97%+) |

- KPIs filterable by station, date range, shift type
- Comparison to previous period (↑ +12% or ↓ -5%)
- Integrated into `HomeDashboard.tsx` as a new KPI row

---

### 3.25 📑 Charging Detail Records (CDR) Export

**Source:** Industry standard format used by ChargePoint, OCPI protocol, regulatory bodies.  
**Problem:** No standardized export format for compliance or partner data sharing.

**Solution:** Add a CDR Export button to the Reports page:

#### CDR Fields (per session):
| Field | Source |
|---|---|
| CDR_ID | `charging_sessions.id` |
| Start_DateTime | `start_time` (ISO 8601) |
| End_DateTime | `end_time` (ISO 8601) |
| Duration_Minutes | Calculated |
| Energy_kWh | `kwh_consumed` |
| Cost_JOD | Calculated billing total |
| Tariff_Applied | Peak / Off-Peak / Partial-Peak |
| Station_ID | `station_id` |
| Station_Name | From stations table |
| Connector_ID | `connector_id` |
| Card_Number | `card_number` (masked: ****1234) |
| Operator_Name | From operators table |
| Shift_Type | From shift record |
| Import_Batch | `import_batch_id` |

#### Export Options:
- **Date range** filter
- **Station** filter
- **Format:** CSV and Excel
- **File naming:** `CDR_[Station]_[StartDate]_[EndDate].csv`
- Useful for: tax filing, regulatory reports, partner data exchange

---

### 3.26 📅 Operator Schedule / Roster Calendar

**Source:** PulseEnergy, Driivz fleet management features.  
**Problem:** No advance planning for operator shifts. Scheduling done informally.

**Solution:** Visual calendar component for planning operator schedules:

#### Features:
- **Monthly calendar view** — shows which operator is on which shift each day
- **Color-coded** — each operator gets a unique color
- **Drag-and-drop** scheduling — assign operators to shifts
- **Day-off marking** — flag days off, system auto-suggests 12-hour coverage
- **Conflict detection** — warn if an operator is double-booked
- **Week/Month views** — toggle between views
- **Print roster** — generate printable weekly/monthly roster PDF

#### New Database Table: `operator_schedules`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| station_id | uuid FK | Which station |
| operator_id | uuid FK | Which operator |
| schedule_date | date | The date |
| shift_duration | text | '8h' / '12h' |
| shift_type | text | 'morning' / 'evening' / 'night' / 'extended_day' / 'extended_night' |
| is_day_off | boolean | True if day off |
| notes | text | Optional notes |
| created_by | uuid FK | Station manager who created this |
| created_at | timestamptz | Auto |

#### New Files:
| File | Purpose |
|---|---|
| `src/components/OperatorRoster.tsx` | [NEW] Calendar-based roster UI |
| `src/lib/rosterService.ts` | [NEW] CRUD for operator schedules |
| `supabase/migrations/XXXXXX_create_operator_schedules.sql` | [NEW] Operator schedules table DDL |

---

### 3.27 📝 Session Notes / Comments

**Source:** Common in commercial CSMS for dispute tracking and auditing.  
**Problem:** No way to annotate individual sessions with context.

**Solution:** Station manager can add notes to any charging session:

- **Where:** Session detail view + session table (notes icon indicator)
- **Use cases:**
  - Flag meter reading disputes
  - Note hardware issues during a session
  - Mark sessions for special billing treatment
  - Record customer complaints
  - Explain anomalies
- **Who can add:** `station_manager`, `global_admin`
- **Who can view:** All roles
- **Storage:** Add `notes` column (text, nullable) to `charging_sessions` table
- **UI:** Click note icon → modal with text area → save
- **In reports:** Notes shown as footnotes when present

#### Database Change:
- **ALTER** `charging_sessions` ADD COLUMN `notes` text NULL

---

### 3.28 ⚙️ System Settings (Company Branding & Configuration)

**Problem:** Company name, logo, and details are hardcoded or not shown on PDFs/reports.  
**Solution:** A System Settings page where `global_admin` configures the company identity.

#### Settings Categories:

**Company Branding:**
| Setting | Type | Description |
|---|---|---|
| Company Name | text | Displayed on all PDF headers |
| Company Logo | image upload | Logo file (PNG/JPG, max 500KB). Stored in Supabase Storage bucket. |
| Company Address | text | Full address for reports |
| Company Phone | text | Contact phone |
| Company Email | text | Contact email |
| Report Footer Text | text | Custom text shown at bottom of all PDFs (e.g. "Thank you for choosing our services") |
| Currency Symbol | text | Default: 'JOD' |
| Currency Decimals | number | Default: 3 (Jordanian Dinar uses 3 decimals) |

**Station Defaults:**
| Setting | Type | Description |
|---|---|---|
| Default Timezone | text | Default: 'Asia/Amman' |
| Default Shift Duration | text | '8h' or '12h' — pre-selected during upload |
| Max Upload File Size | number | Default: 10 MB |
| Bulk Insert Chunk Size | number | Default: 250 rows |

**PDF Layout Settings:**
| Setting | Type | Description |
|---|---|---|
| Paper Size | select | A4 (default) / Letter |
| Logo Position | select | Left / Center |
| Show Company Address | boolean | Default: true |
| Show Page Numbers | boolean | Default: true |

#### New Database Table: `system_settings`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| key | text UNIQUE | Setting key (e.g. 'company_name', 'company_logo_url') |
| value | text | Setting value |
| category | text | 'branding' / 'station_defaults' / 'pdf_layout' |
| updated_by | uuid FK | Last user who changed this |
| updated_at | timestamptz | When last changed |

#### Logo Storage:
- Uses **Supabase Storage** bucket `company-assets`
- Logo uploaded via `SystemSettings` page
- URL saved in `system_settings` with key `company_logo_url`
- All PDF generation functions fetch settings before rendering

#### How It Works with Reports:
```typescript
// Every PDF generator fetches settings first:
const settings = await settingsService.getAll();
const logo = settings.company_logo_url;  // Supabase Storage URL
const companyName = settings.company_name;
const footer = settings.report_footer_text;

// Then passes to the PDF template:
generatePDF({
  header: { logo, companyName, address: settings.company_address },
  footer: { text: footer, showPageNumbers: true },
  data: shiftSessions,
  paperSize: settings.paper_size || 'A4',
});
```

#### Access:
- **Only `global_admin`** can modify system settings
- All other roles can read settings (for PDF generation)
- Changes logged in audit trail

#### New Files:
| File | Purpose |
|---|---|
| `src/components/SystemSettings.tsx` | [NEW] Settings page UI with tabs (Branding, Defaults, PDF Layout) |
| `src/lib/settingsService.ts` | [NEW] CRUD for system_settings + Supabase Storage upload |
| `src/lib/pdfTemplate.ts` | [NEW] Shared branded PDF template used by ALL report generators |
| `supabase/migrations/XXXXXX_create_system_settings.sql` | [NEW] System settings table DDL |
| `supabase/migrations/XXXXXX_create_storage_bucket.sql` | [NEW] Create company-assets storage bucket |

## 4. Implementation Phases

### Phase 0: ⚡ Performance Optimization (HIGHEST PRIORITY)
1. Create `calculate_batch_billing` PostgreSQL stored procedure (Supabase RPC)
2. Create `bulk_import_sessions` PostgreSQL stored procedure for server-side duplicate handling
3. Rewrite `importService.ts` — replace one-by-one insert with bulk insert (250-row chunks)
4. Rewrite `billingService.ts` — add `calculateBatchBilling()` calling the RPC function
5. Remove per-row `calculateCostFromRates()` calls — replace with single rate cache fetch
6. Pre-check duplicate `transaction_id`s before bulk insert

### Phase 0.5: 🗑️ OCPP Cleanup
1. Drop 10 OCPP database tables via migration
2. Delete 11 OCPP frontend files (7 components + 2 services + 2 related)
3. Delete `ocpp-server/` directory
4. Delete 12 OCPP markdown documentation files
5. Remove OCPP references from `Dashboard.tsx`, `Sidebar.tsx`, `database.types.ts`
6. Verify app still builds and runs clean

### Phase 1: Foundation (Database + Shifts)
1. Create `shifts` table migration (with bank deposit fields)
2. Create `user_profiles` table migration (4 roles: global_admin, company_manager, station_manager, accountant)
3. Create `system_settings` table migration + storage bucket for company assets
4. Add `shift_id` and `operator_id` columns to `charging_sessions`
5. Seed default system settings (company name placeholder, default timezone, etc.)
6. Set up RLS policies for new tables

### Phase 2: Enhanced Upload Flow
1. Redesign `FileUpload.tsx` with spreadsheet preview
2. Add operator & shift selection to upload form (8h/12h duration picker, shift type selector)
3. Build inline editing with red error highlighting
4. Implement "Finish Upload" with re-validation
5. Auto-calculate billing during upload (using bulk optimized pipeline)
6. Create shift record on successful upload
7. Add bank deposit slip upload (image/PDF) to shift record
8. Add import batch deletion with cascade delete (PostgreSQL function + confirmation UI)

### Phase 3: PDF Reports & Export
1. Create shared branded PDF template (`pdfTemplate.ts`) that reads system settings
2. Build Shift Session Report PDF generator with proper table pagination (jspdf-autotable)
3. Build Money Handover Letter PDF generator
4. Add PDF download + print buttons to post-upload success screen
5. Add Shift Reports to the Reports page
6. Ensure all PDFs: repeating headers, no mid-row page breaks, page X of Y footer

### Phase 4: Dashboard & Charts Overhaul
1. Install and integrate `recharts`
2. Replace all canvas charts with Recharts
3. Add new dashboard widgets (shift overview, operator ranking)
4. Apply modern styling (glassmorphism, gradients, animations)

### Phase 5: Analytics & Reports Enhancement
1. Add operator performance analytics
2. Add shift analytics
3. Enhance Reports page with new report types
4. Add filtering by operator and shift

### Phase 6: Users Module
1. Build user list and management UI
2. Implement role-based access control
3. Add Users to sidebar navigation
4. Restrict pages based on user role

### Phase 7: 🆕 Enhancements I (Core UX)
1. Mobile-responsive upload flow (touch-friendly, responsive spreadsheet)
2. Import History page with search, filter, pagination
3. Anomaly detection during upload (yellow warnings)
4. Duplicate preview before upload (blue highlighted rows)
5. Notification system (bell icon, notification table, auto-triggers)
6. Dark mode toggle with system preference detection

### Phase 8: 🆕 Enhancements II (Analytics & Reporting)
1. Operator Performance dashboard (KPIs, ranking, trend charts)
2. Shift Comparison analytics (morning/evening/night comparison, weekday/weekend)
3. Accountant Dashboard (pending deposits, deposit history, revenue summaries)
4. Batch weekly/monthly report export (combined PDF/Excel)
5. Revenue Forecasting (7/30-day projections on dashboard)
6. Station Maintenance Log (issue tracking, downtime hours, open issues widget)

### Phase 9: 🆕 Enhancements III (Industry Features)
1. System Settings page (company branding, logo upload, PDF layout config)
2. Audit Trail / Activity Log (audit_log table, viewer page, auto-recording)
3. Industry KPI Dashboard widgets (utilization rate, revenue per charger, uptime, etc.)
4. CDR Export (standardized CSV/Excel export for compliance)
5. Operator Schedule / Roster Calendar (visual calendar, drag-and-drop scheduling)
6. Session Notes (add notes to individual sessions, display in reports)

---

## 5. Files That Will Be Modified or Created

### Modified Files:
| File | Changes |
|---|---|
| `src/components/FileUpload.tsx` | Complete redesign with spreadsheet preview, operator/shift selection, inline editing |
| `src/components/Dashboard.tsx` | Add new views for users module, updated sidebar routing |
| `src/components/Sidebar.tsx` | Add Users nav item, possible shift upload shortcut |
| `src/components/HomeDashboard.tsx` | Replace canvas charts with Recharts, add shift overview widget, add industry KPI widgets row |
| `src/components/AnalyticsDashboard.tsx` | Replace canvas charts, add operator/shift analytics |
| `src/components/ExportPage.tsx` | Add shift reports, operator reports, money handover history, CDR export |
| `src/lib/importService.ts` | Add shift/operator linking, modify to support staged upload |
| `src/lib/billingService.ts` | Add immediate billing during upload |
| `src/lib/reportService.ts` | Add shift report PDF, money handover letter PDF, weekly/monthly reports |
| `src/lib/database.types.ts` | Add new table types |
| `src/index.css` | Add glassmorphism styles, dark gradient accents, dark mode variables |
| `src/components/SessionsTable.tsx` (or equivalent) | Add notes icon + inline note editing |

### New Files:
| File | Purpose |
|---|---|
| `src/components/SpreadsheetPreview.tsx` | [NEW] Editable spreadsheet table with error highlighting |
| `src/components/ShiftUploadFlow.tsx` | [NEW] Enhanced upload with shift/operator/station selection |
| `src/components/ShiftReportPrint.tsx` | [NEW] Shift session list printable view |
| `src/components/MoneyHandoverLetter.tsx` | [NEW] Money handover letter component |
| `src/components/UserList.tsx` | [NEW] Users management list page |
| `src/components/UserForm.tsx` | [NEW] Add/edit user form |
| `src/components/ShiftHistory.tsx` | [NEW] Past shifts and handover tracking |
| `src/lib/shiftService.ts` | [NEW] CRUD operations for shifts table |
| `src/lib/userService.ts` | [NEW] User profile management |
| `supabase/migrations/XXXXXX_create_shifts_table.sql` | [NEW] Shifts table DDL |
| `supabase/migrations/XXXXXX_create_user_profiles.sql` | [NEW] User profiles DDL |
| `supabase/migrations/XXXXXX_add_shift_operator_to_sessions.sql` | [NEW] Alter sessions table |
| `supabase/migrations/XXXXXX_create_bulk_billing_function.sql` | [NEW] PostgreSQL stored procedure for batch billing via RPC |
| `supabase/migrations/XXXXXX_create_bulk_import_function.sql` | [NEW] PostgreSQL function for bulk import with duplicate handling |
| `supabase/migrations/XXXXXX_create_notifications.sql` | [NEW] Notifications table DDL |
| `supabase/migrations/XXXXXX_create_maintenance_log.sql` | [NEW] Maintenance log table DDL |
| `src/components/ImportHistory.tsx` | [NEW] Searchable/filterable import history page |
| `src/components/OperatorPerformance.tsx` | [NEW] Operator performance dashboard with charts |
| `src/components/AccountantDashboard.tsx` | [NEW] Financial tracking dashboard for accountants |
| `src/components/NotificationBell.tsx` | [NEW] Bell icon with dropdown notification panel |
| `src/components/MaintenanceLog.tsx` | [NEW] Station maintenance log UI |
| `src/lib/operatorAnalyticsService.ts` | [NEW] Operator performance data queries |
| `src/lib/accountingService.ts` | [NEW] Financial data queries for accountant view |
| `src/lib/notificationService.ts` | [NEW] Notification CRUD + auto-generation |
| `src/lib/maintenanceService.ts` | [NEW] Maintenance log CRUD |
| `src/components/AuditLog.tsx` | [NEW] Audit trail viewer page |
| `src/lib/auditService.ts` | [NEW] Audit log recording + querying |
| `supabase/migrations/XXXXXX_create_audit_log.sql` | [NEW] Audit log table DDL |
| `src/components/OperatorRoster.tsx` | [NEW] Calendar-based roster UI |
| `src/lib/rosterService.ts` | [NEW] CRUD for operator schedules |
| `supabase/migrations/XXXXXX_create_operator_schedules.sql` | [NEW] Operator schedules table DDL |
| `src/components/SystemSettings.tsx` | [NEW] Settings page UI (Branding, Defaults, PDF Layout) |
| `src/lib/settingsService.ts` | [NEW] System settings CRUD + Supabase Storage upload |
| `src/lib/pdfTemplate.ts` | [NEW] Shared branded PDF template for all reports |
| `supabase/migrations/XXXXXX_create_system_settings.sql` | [NEW] System settings table DDL |
| `supabase/migrations/XXXXXX_create_storage_bucket.sql` | [NEW] Company assets storage bucket |
| `supabase/migrations/XXXXXX_create_delete_batch_function.sql` | [NEW] PostgreSQL cascade delete function |
| `src/lib/cdrExportService.ts` | [NEW] CDR export formatting and file generation |

---

## 6. Confirmed Decisions (User Answers)

> ✅ **All questions answered — decisions confirmed:**

| # | Question | Decision |
|---|---|---|
| 1 | Shift flexibility | Station manager chooses **8 hours or 12 hours** during upload. Fixed shift time slots based on duration choice. |
| 2 | Off-day scheduling | **Station manager picks** the 12-hour shift slot during upload (08:00–20:00 or 20:00–08:00). |
| 3 | Operator-session linking | Keep **card_number** linking. Sessions matched to operators via card_number field. |
| 4 | Money handover workflow | Full workflow: **collect → deposit at bank → upload slip → attach to shift → handover docs to Accounts**. |
| 5 | Multiple stations | **Yes** — building more stations. System must support multi-station from day one. |
| 6 | User accounts | **No operator accounts.** Roles: station_manager, accountant, company_manager, global_admin. |
| 7 | Chart library | **Approved** — `recharts` will be added. |
| 8 | OCPP cleanup | **Delete all** — 10 DB tables, 7 components, 2 services, 1 server directory, 12 markdown docs. |

---

## 7. OCPP Cleanup Scope

> 🗑️ **All OCPP-related code, tables, and documentation will be removed.**

### Database Tables to DROP (10 tables):
- `ocpp_chargers`
- `ocpp_connectors`
- `ocpp_charging_sessions`
- `ocpp_meter_values`
- `ocpp_messages`
- `ocpp_remote_commands`
- `ocpp_configuration_keys`
- `ocpp_firmware_updates`
- `ocpp_reservations`
- `ocpp_charger_availability`

### Frontend Files to DELETE (9 files):
| File | Type |
|---|---|
| `src/components/OCPPChargerManagement.tsx` | Component |
| `src/components/OCPPConfiguration.tsx` | Component |
| `src/components/OCPPHealthDiagnostics.tsx` | Component |
| `src/components/OCPPLiveMonitoring.tsx` | Component |
| `src/components/OCPPMessageLogs.tsx` | Component |
| `src/components/OCPPRemoteControl.tsx` | Component |
| `src/components/OCPPSessionsMonitor.tsx` | Component |
| `src/components/BulkChargerRegistration.tsx` | Component |
| `src/lib/ocppService.ts` | Service |
| `src/lib/bulkChargerService.ts` | Service |
| `src/lib/productionReadinessService.ts` | Service (contains OCPP refs) |

### Backend Directory to DELETE:
- `ocpp-server/` (entire directory)

### Documentation Files to DELETE (12 files):
- `OCPP-DIRECT-CONNECTION-SETUP.md`
- `OCPP-IMPLEMENTATION-PLAN.md`
- `OCPP-SERVER-SETUP.md`
- `START-OCPP-SERVER.md`
- `PHASE-1-OCPP-COMPLETE.md` through `PHASE-9-OCPP-COMPLETE.md`

### Files to MODIFY (remove OCPP references):
- `src/components/Dashboard.tsx` — remove OCPP view routing if present
- `src/components/Sidebar.tsx` — remove OCPP nav items if present
- `src/lib/database.types.ts` — remove OCPP table types

---

## 8. No Changes Until Approved

> ⛔ **This document is for review only.**  
> No code, database, or UI changes will be made until you explicitly say **"implement"**.  
> Please review the updated plan. Once you approve it, implementation will follow the phases above.
