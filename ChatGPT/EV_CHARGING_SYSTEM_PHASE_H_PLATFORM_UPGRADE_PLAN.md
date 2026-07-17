# EV Charging System — Phase H: Full Platform Upgrade Plan
**Based on:** Deep audit of console.cnpowercore.com (Powercore CPMS)  
**Audit Date:** 2026-07-18  
**Audited Account:** tariq@energy-stream.net / Kaveir Operator  
**Author:** AI Analysis  
**Status:** PLANNING — Ready for implementation prioritization

---

## Executive Summary

The Powercore platform is a mature, enterprise-grade OCPP Charging Point Management System (CPMS). Our current app shares the same database foundation but lacks ~70% of the operational and business management features that platform delivers. This plan documents every gap, prioritizes the work into phases, and provides implementation guidance for closing those gaps.

**Can we copy the app?**  
Functionally: **Yes — every feature is buildable.** Their stack is Vue.js + Element UI. Ours is React + Shadcn/Tailwind, which is more modern. We already have the OCPP server (Phase G), Supabase DB, billing engine, and import workflow. We need to build the management UI, RFID system, multi-tenant layer, and reporting/export layer on top of what we have.

---

## Platform Architecture Reference (Powercore)

```
Home Dashboard
├── Operation Monitoring
│   ├── Connector Real-Time Monitor   ← live card grid
│   └── Statistics                    ← charts + tables, 3 views
├── Station Management
│   ├── Charging Station              ← photo-based cards
│   ├── Charge Point                  ← device table + batch ops
│   ├── Connector                     ← connector-level table
│   └── Station Load Balance          ← power management
├── Business Management
│   ├── Charging Card (RFID)          ← 200 cards, bind to accounts
│   ├── Charging Strategy (Tariff)    ← time-based 3-component pricing
│   └── Comments                      ← ratings + responses
├── Customer Management
│   ├── Operator Management           ← multi-tenant hierarchy
│   └── User Management               ← RBAC + multi-role
├── Order Management
│   ├── Transaction                   ← 7,367 sessions, 14 filters
│   └── Recharge Order                ← wallet top-up tracking
├── Maintenance Management
│   ├── Firmware Management           ← 1,575 files, deploy remotely
│   ├── Diagnostics                   ← on-demand logs, 139 archives
│   └── Alarm Management              ← fault tracking + push alerts
├── OCPP Operation
│   ├── OCPP Message Log              ← protocol debugging
│   ├── Whitelist Management          ← per-device RFID allowlists
│   ├── Charging Profile              ← OCPP SmartCharging
│   └── Configuration                 ← OCPP config keys per device
└── System Settings
    └── Role Management               ← granular permission tree RBAC
```

---

## Current State vs. Target State

| Feature Domain | Current State | Target State | Gap |
|---|---|---|---|
| OCPP Server | ✅ Running (Railway) | ✅ Keep + enhance | Low |
| Session Import (Excel) | ✅ Working | ➡ Supplement with live | Low |
| Dashboard KPIs | ❌ None | 4 KPI cards + charts | High |
| Real-time Connector Monitor | ❌ None | Live card grid | High |
| Statistics / Analytics | ❌ None | 3-chart analytics panel | High |
| Charge Point Management | ⚠️ Basic OCPP UI | Full CRUD + batch ops | Medium |
| Connector Management | ⚠️ Basic | Granular table + power | Medium |
| RFID Card Management | ❌ None | 200-card inventory + bind | High |
| Charging Strategy (Tariff) | ✅ Rate period editor | Time-of-use 3-component | Medium |
| Multi-Tenant / Operators | ❌ None | Operator hierarchy | Medium |
| User RBAC | ⚠️ Basic roles | Granular permission tree | Medium |
| Transaction Management | ✅ Basic list | 14-filter table + export | Medium |
| Wallet / Recharge Orders | ❌ None | Balance tracking + top-up | High |
| Firmware Management | ❌ None | Upload + deploy to charger | High |
| Diagnostics | ❌ None | On-demand log pull + store | High |
| Alarm Management | ❌ None | Fault tracking + push alerts | High |
| OCPP Message Log | ⚠️ Partial (server logs) | Full UI message browser | Medium |
| Whitelist Management | ❌ None | Per-device RFID allowlist | Medium |
| Charging Profiles | ❌ None | OCPP SmartCharging | Low |
| OCPP Config Keys | ❌ None | UI to read/write config | Medium |
| Data Export (CSV/PDF) | ⚠️ Limited | Per-table + per-chart export | High |
| Comments / Ratings | ❌ None | Session ratings + responses | Low |
| Station Load Balance | ❌ None | Power limit distribution | Low |
| CO₂ / Environmental KPIs | ❌ None | CO₂ saved, tree equivalent | Low |

---

## Phase H Implementation Plan

Phases are ordered by business value and dependency chain.

---

### Phase H1 — Dashboard & Real-Time Monitoring
**Priority: CRITICAL**  
**Estimated effort: 2 weeks**

#### H1.1 — Dashboard KPI Cards

Replicate the 4-card + chart dashboard:

**KPI Cards to build:**
1. Total Energy (kWh) — today vs. all-time
2. Total Sessions — today vs. all-time
3. Total Revenue (JOD) — today vs. all-time
4. CO₂ Avoided (tonnes) — calculated at 0.7 kg CO₂/kWh

**Chart to build:**
- Dual-axis area chart: Sessions (left) + kWh (right)
- Date range selector: Day / Week / Month / Year
- Rendered with Recharts or Tremor

**Data sources:**
- `ocpp_charging_sessions` (OCPP live sessions)
- `billing_records` (imported sessions)
- Both must be unioned for accurate totals

**DB queries needed:**
```sql
-- Today's energy
SELECT COALESCE(SUM(energy_consumed_wh)/1000, 0) as kwh_today
FROM ocpp_charging_sessions
WHERE DATE(start_timestamp AT TIME ZONE 'Asia/Amman') = CURRENT_DATE;

-- Revenue via billing_records (existing)
SELECT COALESCE(SUM(total_amount), 0) as revenue_today
FROM billing_records
WHERE DATE(created_at) = CURRENT_DATE;
```

**CO₂ formula:** `kwh * 0.7 / 1000` = tonnes CO₂ avoided  
**Tree equivalent:** `co2_tonnes * 5` (one tree absorbs ~200kg CO₂/year)

---

#### H1.2 — Connector Real-Time Monitor

**What it is:** Grid of cards, one per connector, showing live status.

**Card fields:**
- Charge point ID + connector number
- Station name
- Connector type (CCS2, CHAdeMO, Type 2, GBT)
- Power rating (kW)
- Status (Idle / Charging / Offline / Faulted)
- Active session: RFID tag, energy so far, duration
- Action buttons: Start / Stop / Unlock

**Implementation:**
- Use Supabase Realtime subscriptions on `ocpp_connectors` and `ocpp_charging_sessions`
- Update cards without page reload
- Color coding: green = Idle, blue = Charging, gray = Offline, red = Faulted

**Component:** `ConnectorMonitorGrid.tsx`  
**Realtime table:** `ocpp_connectors` (status column), `ocpp_charging_sessions` (active sessions)

---

#### H1.3 — Statistics / Analytics Panel

**Three chart panels:**

1. **Energy (kWh)** — area chart by day/month/year
2. **Revenue (JOD)** — area chart by day/month/year
3. **Sessions (count)** — area chart by day/month/year

**Drill-down table tabs (below charts):**
- By Station
- By Charge Point
- By User/Account

**Columns per row:**
- Name | Business Start Date | Address | Energy (kWh) | Sessions | Revenue (JOD)

**Filters:**
- Operator dropdown
- Station dropdown
- Charge Point ID
- Date range (Month/Year/Period)
- User email

**Export:** CSV download button per chart + table

---

### Phase H2 — RFID Card Management
**Priority: HIGH**  
**Estimated effort: 1.5 weeks**

#### H2.1 — DB Schema

New table `rfid_cards`:
```sql
CREATE TABLE rfid_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT UNIQUE NOT NULL,        -- e.g. 20230100000113110
  operator_id UUID REFERENCES operators(id),
  account_id UUID REFERENCES user_profiles(id),
  cardholder_name TEXT,
  card_type TEXT DEFAULT 'standard',       -- standard | fleet | staff
  status TEXT DEFAULT 'unbound',           -- unbound | active | suspended
  expiration_date TIMESTAMPTZ DEFAULT '2099-01-01',
  max_count INTEGER DEFAULT 1,             -- max sessions per day
  balance NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### H2.2 — RFID Card Management UI

`RFIDCardManager.tsx`:
- Table with all columns
- Filters: Account, Card Number, Cardholder, Operator, Type, Status
- Actions: Add Card, Edit, Bind to Account, Suspend, Delete
- Bulk import via CSV
- Export card list to CSV

#### H2.3 — Card Binding Flow

When binding a card to an account:
1. Select card from inventory
2. Search user account by email
3. Bind → sets `account_id` and changes status to `active`
4. Card holder name auto-populated from user profile

#### H2.4 — OCPP Whitelist Sync

After binding/unbinding cards, sync the whitelist to relevant charge points:
- Insert OCPP `SendLocalList` command for affected charge points
- Track sync status per charge point

---

### Phase H3 — Enhanced Transaction Management
**Priority: HIGH**  
**Estimated effort: 1 week**

#### H3.1 — Upgrade Transaction List

Current `ReportTable.tsx` / transaction list needs these enhancements:

**Add missing filters (currently missing):**
- Order Number (exact search)
- Card Number
- Connector Type
- Charge Point Model
- Payment Model (RFID / App / Free)
- Stop Type (Remote / RFID / Timeout / Manual)
- Settlement Type

**Add missing columns:**
- Order Number (auto-generated UUID)
- Card Number used
- Connector Type
- Stop Type / Stop Reason
- Settlement Status

**Add actions per row:**
- **Fee Details** modal (shows electricity + service + parking breakdown)
- **Monitor** — opens real-time session view if still active
- **Manual Settlement** — for disputed/stuck sessions

#### H3.2 — Fee Details Modal

Shows exactly what Powercore shows per transaction:
- Start / Stop time
- Duration
- Energy (kWh)
- Electricity fee = kWh × tariff_electricity
- Service fee = kWh × tariff_service
- Parking fee = hours × tariff_parking (if applicable)
- Total charged
- Payment method

#### H3.3 — Export Enhancements

- Export selected rows (not just all)
- Export formats: CSV, Excel (.xlsx)
- Export includes all columns including computed fee breakdown

---

### Phase H4 — Wallet & Recharge Orders
**Priority: HIGH**  
**Estimated effort: 1.5 weeks**

**What Powercore has:** Users maintain a wallet balance. They "recharge" (top-up) the wallet. Charging sessions deduct from the wallet. All recharge events are logged in a separate `recharge_orders` table.

#### H4.1 — DB Schema

```sql
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) UNIQUE,
  balance NUMERIC(10,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'JOD',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recharge_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT REFERENCES rfid_cards(card_number),
  user_id UUID REFERENCES user_profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  operation_type TEXT,  -- 'top_up' | 'refund' | 'adjustment'
  balance_after NUMERIC(10,2),
  order_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES user_profiles(id)
);
```

#### H4.2 — Recharge Order UI

`RechargeOrderPanel.tsx`:
- KPI cards: Today, Yesterday, This Month, Cumulative
- Area chart of top-up amounts over time
- Filter table: Card Number, Date Range, Card Type, Operation Type, Account
- Export capability

---

### Phase H5 — Firmware & Diagnostics Management
**Priority: HIGH**  
**Estimated effort: 2 weeks**

#### H5.1 — Firmware Management

**DB Schema:**
```sql
CREATE TABLE firmware_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firmware_name TEXT NOT NULL,
  version TEXT NOT NULL,
  firmware_type TEXT,         -- 'OCPP-FW' | 'SECC-FW'
  file_url TEXT NOT NULL,     -- stored in Supabase Storage
  file_size_bytes BIGINT,
  sha256_signature TEXT,
  compatible_models TEXT[],   -- ['Verde-GBT150', 'Verde-C2250']
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE firmware_update_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firmware_id UUID REFERENCES firmware_packages(id),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  status TEXT DEFAULT 'pending',  -- pending | downloading | installing | success | failed
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**UI Features:**
- Upload firmware to Supabase Storage
- Table: Name, Version, Type, Signature (truncated), Upload Time, Creator
- Per-row: Apply (select target charger(s)), Download
- Bulk deploy to multiple chargers
- OCPP `UpdateFirmware` command dispatched via command poller

#### H5.2 — Diagnostics Management

**How it works (OCPP):**
1. Admin clicks "Get Diagnostics" for a charge point
2. Server sends OCPP `GetDiagnostics` request with an upload URL
3. Charger uploads a ZIP file to that URL
4. System stores file reference in DB

**DB Schema:**
```sql
CREATE TABLE diagnostic_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  filename TEXT,
  file_url TEXT,    -- Supabase Storage URL
  file_size_bytes BIGINT,
  requested_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  status TEXT DEFAULT 'requested',  -- requested | received | failed
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**UI Features:**
- Grid of diagnostic cards (like Powercore)
- Per-card: filename, charge_point_id, created_at, file_size, Download, Delete, Log Details
- Filter by Charge Point ID
- "Click to get log" → triggers OCPP GetDiagnostics
- 30-day auto-cleanup of old logs

---

### Phase H6 — Alarm Management
**Priority: HIGH**  
**Estimated effort: 1 week**

#### H6.1 — DB Schema

```sql
CREATE TABLE charger_alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  connector_id INTEGER,
  error_code TEXT,           -- OCPP error codes: ConnectorLockFailure, EVCommunicationError, etc.
  info TEXT,
  status TEXT,               -- 'Faulted' | 'SuspendedEV' | etc.
  vendor_error_code TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Alarm triggers:** Already captured in `handleStatusNotification` — extend to write to `charger_alarms` when `status = 'Faulted'` or `errorCode != 'NoError'`.

#### H6.2 — Alarm Management UI

`AlarmManager.tsx`:
- Tab: Alarm List | Push Strategy Settings
- Filters: Operator, Station, Charge Point, Error Code, Date Range, "Unsolved only" toggle
- Columns: Operator, Station, Charge Point, Model, Connector, Error Code, Module, Time, Actions
- Actions: Acknowledge / Mark Resolved
- Export to CSV/Excel

#### H6.3 — Push Notification Strategy

`AlarmPushStrategy.tsx`:
- Configure which alarm types trigger email/SMS/in-app alerts
- Configure recipient users per alarm type
- Per-operator configuration

---

### Phase H7 — OCPP Operations UI
**Priority: MEDIUM**  
**Estimated effort: 1.5 weeks**

#### H7.1 — OCPP Message Log Browser

`OcppMessageBrowser.tsx`:
- Table: Operation, UUID, Charge Point ID, Call Type (request/response), Payload, Timestamp
- Filters: Charge Point ID, UUID, Operation type, Date range
- Raw JSON viewer per message
- Export to CSV

**DB:** Already logging to `ocpp_messages` table — needs frontend UI.

#### H7.2 — Whitelist Management UI

`WhitelistManager.tsx`:
- Table of all charge points with whitelist card count
- Per charge point: open whitelist editor
  - Add/remove RFID cards
  - Set expiry per card
  - Sync now → dispatches OCPP `SendLocalList`
  - Clear all → dispatches OCPP `SendLocalList` with empty list
- Whitelist Templates: pre-defined lists that can be applied to multiple chargers at once

#### H7.3 — OCPP Configuration Key Editor

`OcppConfigEditor.tsx`:
- Table of all charge points
- Per charge point, expandable config key table
- Editable boolean toggles and text fields
- Save → dispatches OCPP `ChangeConfiguration`
- Read → dispatches OCPP `GetConfiguration` and refreshes display
- Batch edit: apply same config change across multiple chargers

**Key config keys to expose in UI:**
- `AllowOfflineTxForUnknownId` (bool)
- `AuthorizationCacheEnabled` (bool)
- `AuthorizeRemoteTxRequests` (bool)
- `HeartbeatInterval` (integer, seconds)
- `ConnectionTimeOut` (integer, seconds)
- `MeterValueSampleInterval` (integer, seconds)
- `StopTransactionOnEVSideDisconnect` (bool)
- `UnlockConnectorOnEVSideDisconnect` (bool)

#### H7.4 — Charging Profile Management

`ChargingProfileManager.tsx`:
- List of saved OCPP SmartCharging profiles
- Fields: Name, Stack Level, Purpose, Kind, Schedule periods
- Apply to charge point → dispatches OCPP `SetChargingProfile`
- Clear from charge point → dispatches OCPP `ClearChargingProfile`
- Primary use case: peak shaving, load management

---

### Phase H8 — Multi-Tenant Operator System
**Priority: MEDIUM**  
**Estimated effort: 2 weeks**

#### H8.1 — Operator Hierarchy

Powercore model: `PowerCore → Kaveir → Stream Energy`  
Our model: Flat (single operator today) → needs hierarchy.

**DB Schema:**
```sql
CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_operator_id UUID REFERENCES operators(id),
  country TEXT DEFAULT 'JO',
  region TEXT,
  contact_info TEXT,
  company_name TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Impact:** All asset tables (stations, charge points, connectors, sessions) gain `operator_id`. RLS policies enforce that users only see data belonging to their operator and sub-operators.

#### H8.2 — Operator Management UI

`OperatorManager.tsx`:
- Table: Operator Name, Parent, Country, Contact, Creator, Actions
- Add/Edit/Delete operators
- Asset recycling: reassign charge points / RFID cards between operators
- Operator scoped stats

---

### Phase H9 — Enhanced RBAC
**Priority: MEDIUM**  
**Estimated effort: 1 week**

Powercore has a granular permission tree. Our current RBAC has basic roles. We need to implement feature-level permission checking.

#### H9.1 — Permission Model

**Roles observed on Powercore (for reference):**
```
Customer
Operator
Maintenance
Charging Strategy
Disable Session (Parking Fee)
```

**Permission categories to implement:**
```
home.view
monitoring.view
monitoring.unlock_connector
monitoring.start_stop_charging
monitoring.set_availability
statistics.view
stations.view | stations.add | stations.edit | stations.delete
charge_points.view | charge_points.add | charge_points.edit | charge_points.delete | charge_points.reset | charge_points.cache
connectors.view | connectors.edit
rfid_cards.view | rfid_cards.add | rfid_cards.edit | rfid_cards.bind
tariffs.view | tariffs.add | tariffs.edit | tariffs.delete
users.view | users.add | users.edit | users.disable
operators.view | operators.add | operators.edit | operators.delete
transactions.view | transactions.export | transactions.manual_settle
firmware.view | firmware.upload | firmware.deploy
diagnostics.view | diagnostics.request | diagnostics.download
alarms.view | alarms.resolve | alarms.configure_push
ocpp_messages.view | ocpp_messages.export
whitelist.view | whitelist.edit | whitelist.sync
config_keys.view | config_keys.edit
charging_profiles.view | charging_profiles.add | charging_profiles.apply
```

#### H9.2 — Role Management UI

`RoleManager.tsx`:
- List of roles with edit/clone/delete
- Permission tree with expand/collapse all
- Checkbox per permission
- Save role
- Assign role to users

---

### Phase H10 — Station & Charge Point Enhancements
**Priority: MEDIUM**  
**Estimated effort: 1 week**

#### H10.1 — Station Management Enhancements

**Add to station records:**
- Photo upload (multiple photos, Supabase Storage)
- Operating hours (start/end time)
- Nearby settings (radius for app discovery)
- GPS coordinates (map pin)
- Contact phone

**UI:** Photo card grid like Powercore

#### H10.2 — Charge Point Enhancements

**Add to charge point view:**
- Batch operations dropdown (Reset All, Get Config, Deploy Firmware)
- QR code generation per charger (downloadable PNG)
- Agent assignment
- Cache management button → dispatches OCPP `ClearCache`
- Remote reset → dispatches OCPP `Reset` (Soft/Hard)
- Online time tracking (uptime display)

#### H10.3 — Station Load Balance

**What it does:** Limits total power draw at a station to a configured maximum. If total demand exceeds limit, individual charger limits are dynamically reduced via `SetChargingProfile`.

**Implementation:**
- `station_load_balance` table: `station_id`, `max_kw`, `enabled`
- Background job: monitor active sessions' power, compute total, throttle if needed
- UI: simple enable/disable + max_kw input per station

---

### Phase H11 — Comments & Ratings
**Priority: LOW**  
**Estimated effort: 0.5 weeks**

```sql
CREATE TABLE session_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ocpp_charging_sessions(id),
  user_id UUID REFERENCES user_profiles(id),
  station_id UUID REFERENCES stations(id),
  charge_point_id TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  response TEXT,
  responded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**UI:** Comments Management table with filter by operator/station, rating display, response editor.

---

## Data Export Strategy

Every major table must support export. Standard implementation:

```typescript
// Generic CSV export hook
const exportToCSV = (data: any[], filename: string) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
};

// Generic Excel export
const exportToXLSX = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
};
```

**Screens that need export buttons:**

| Screen | Export Format | Fields |
|---|---|---|
| Statistics (Energy chart) | CSV + PNG | Date, kWh |
| Statistics (Revenue chart) | CSV + PNG | Date, JOD |
| Statistics (Sessions chart) | CSV + PNG | Date, Count |
| Transaction List | CSV + Excel | All 14+ columns |
| Recharge Orders | CSV | All columns |
| Charge Points | CSV | All columns |
| Alarms | CSV | All columns |
| OCPP Messages | CSV | All columns |
| RFID Cards | CSV | All card fields |
| Diagnostic Logs | ZIP download | Per-file |
| Firmware Packages | Binary download | Per-file |

---

## Implementation Sequence (Recommended)

```
Phase H1: Dashboard + Real-Time Monitor    [Week 1-2]
Phase H2: RFID Card Management             [Week 3-4]
Phase H3: Enhanced Transactions            [Week 3]
Phase H4: Wallet / Recharge Orders         [Week 4-5]
Phase H5: Firmware + Diagnostics           [Week 5-6]
Phase H6: Alarm Management                 [Week 6]
Phase H7: OCPP Operations UI               [Week 7-8]
Phase H8: Multi-Tenant Operators           [Week 8-9]
Phase H9: Enhanced RBAC                    [Week 9]
Phase H10: Station/CP Enhancements         [Week 10]
Phase H11: Comments & Ratings              [Week 10]
```

Total estimated timeline: **10 weeks for full feature parity with Powercore platform**.

---

## Technology Choices

| Need | Choice | Reason |
|---|---|---|
| Charts | Recharts or Tremor | Already in React ecosystem, Tremor has dashboard components out of box |
| Real-time updates | Supabase Realtime | Already in stack, WebSocket subscriptions |
| Data tables | TanStack Table | Already used, powerful filtering/sorting |
| File storage | Supabase Storage | Already in stack, handles firmware + diagnostics |
| CSV export | PapaParse | Lightweight, browser-safe |
| Excel export | SheetJS (xlsx) | Already installed in project |
| QR codes | qrcode.react | Small, React-native |
| Maps | Mapbox GL or Leaflet | For station location pin |
| Push notifications | Supabase Edge Function + Resend email | Already using Resend pattern |

---

## Key DB Changes Required

All migrations to be added to `supabase/migrations/`:

1. `20260718_h1_dashboard_views.sql` — materialized views for dashboard KPIs
2. `20260718_h2_rfid_cards.sql` — rfid_cards, whitelist_entries tables
3. `20260718_h4_wallet_recharge.sql` — user_wallets, recharge_orders tables
4. `20260718_h5_firmware_diagnostics.sql` — firmware_packages, diagnostic_logs, update_jobs
5. `20260718_h6_alarms.sql` — charger_alarms table
6. `20260718_h8_operators.sql` — operators table + operator_id FK on all asset tables
7. `20260718_h9_rbac.sql` — permissions, role_permissions, user_permissions tables
8. `20260718_h10_station_photos.sql` — station_photos, station_load_balance tables

---

## OCPP Server Enhancements Required

The existing `ocpp-server/` needs these additions:

1. **`handlers/getConfiguration.ts`** — respond to `GetConfiguration` from server
2. **`handlers/changeConfiguration.ts`** — handle config change ACKs
3. **`handlers/updateFirmware.ts`** — track firmware update progress notifications
4. **`handlers/getDiagnostics.ts`** — receive diagnostic upload notifications
5. **`handlers/sendLocalList.ts`** — handle `SendLocalList` responses
6. **`handlers/setChargingProfile.ts`** — handle `SetChargingProfile` responses
7. **`commandPoller.ts`** — extend to support all new command types
8. **Alarm detection in `statusNotification.ts`** — write to `charger_alarms` when Faulted

---

## Summary of Findings vs. "Can We Copy It?"

**Legal/ethical:** You have a subscription and are building your own system. Feature parity is entirely legitimate — you cannot copy their source code, but implementing the same features is standard practice.

**Technical feasibility:** 100%. Every feature they have is implementable with our current stack (React, Supabase, Node.js OCPP server). Many DB tables already exist or closely map to what we need.

**Time to full parity:** ~10 weeks of focused development.

**Our advantages over Powercore:**
- Our stack (React 18 + Tailwind + Shadcn) is more modern than their Vue + Element UI
- Our billing engine (V2) is more sophisticated than theirs (per-interval rate periods)
- We have the Excel import pipeline as a fallback — they don't
- We control the full OCPP server — theirs is a black box to operators
- Our Supabase foundation is more extensible

**Start with Phase H1** (Dashboard + Real-Time Monitor) — highest visibility, highest business value, and directly builds on the OCPP connection we proved in Phase G.
