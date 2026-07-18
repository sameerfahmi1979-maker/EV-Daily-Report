# ChargeOS — Independent SaaS EV Charging Management Platform
## Phase 0: Platform Blueprint & Architecture Plan

**Product Name:** ChargeOS (working title — white-labelable)  
**Vision:** A fully independent, multi-tenant, white-label SaaS EV Charging Management Platform  
**Scope:** New standalone app — entirely new database, new codebase, new infrastructure  
**Based on:** Powercore CPMS audit + cnchargepoint firmware deep analysis + current system lessons  
**Last Updated:** 2026-07-18  
**Status:** PHASE 0 — Blueprint Complete, Ready for Implementation

---

## Executive Summary

**ChargeOS** is a new, standalone SaaS product — not an upgrade of the existing app. It is built from scratch with a fresh database (integer primary keys, not UUIDs), a multi-tenant architecture, white-label capability, and native mobile apps for operators, customers, and managers.

The platform can be:
- **Sold as a SaaS** to any EV charging station operator via monthly subscription
- **White-labeled** so each customer runs it under their own brand, domain, and colors
- **Self-hosted** for enterprise operators who want full control
- **Mobile-first** with dedicated React Native apps for every user role

This plan is **Phase 0** of ChargeOS — the complete technical blueprint before a single line of code is written.

### Platform Goals

| Goal | Description |
|---|---|
| **New App, New DB** | Entirely new codebase. Fresh Supabase project. Integer primary keys (BIGSERIAL) throughout. No legacy data structures. |
| **SaaS Multi-Tenant** | One platform instance serves unlimited customers (tenants). Complete data isolation per tenant via RLS. Monthly subscription billing. |
| **White-Label Ready** | Each tenant gets their own logo, brand colors, app name, custom domain, and OCPP server namespace. The app looks like it belongs to them. |
| **Mobile-First** | Three dedicated React Native (Expo) mobile apps: Operator, Customer, Manager. Web app is fully mobile-responsive. |
| **OCPP-Native** | All session data captured automatically via OCPP 1.6, 1.6J, and 2.0.1. Protocol detected at handshake. |
| **Auto-Discovery** | Chargers connecting to OCPP server auto-fingerprinted, auto-registered, connectors auto-created. Zero manual entry. |
| **Station Hierarchy** | Tenant → Organization → Station → Charger → Connector. All reports, permissions, billing follow this hierarchy. |
| **Automated Financials** | Every session bills automatically. Shifts tracked per officer. Cash handover PDF generated and signed digitally. |
| **Region-Aware** | Auto-detect region, currency, decimal places, timezone, language (Arabic/English). Per-tenant override. |
| **Real-Time Everything** | Zero-polling dashboard. All status changes delivered via Supabase Realtime WebSocket. |
| **Full History** | Every session, meter value, alarm, config change, command, heartbeat stored and queryable forever. |

---

## Platform Architecture

### High-Level System Overview

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                    ChargeOS — SaaS EV Charging Platform                        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐   ║
║  │                     MULTI-TENANT LAYER                                   │   ║
║  │  Tenant A (AcmeEV)  │  Tenant B (GreenCharge)  │  Tenant C (YourBrand) │   ║
║  │  tenant_id = 1       │  tenant_id = 2            │  tenant_id = 3        │   ║
║  │  domain: acmeev.com  │  domain: greencharge.io   │  white-label domain   │   ║
║  └─────────────────────────────────────────────────────────────────────────┘   ║
║                                    │                                             ║
║              ┌─────────────────────┼──────────────────────┐                    ║
║              │                     │                        │                    ║
║  ┌───────────▼──────┐  ┌───────────▼──────────┐  ┌────────▼─────────────────┐ ║
║  │   OCPP SERVER    │  │  SUPABASE (Postgres)  │  │    EDGE FUNCTIONS        │ ║
║  │  (Railway/VPS)   │  │                       │  │  shift-close             │ ║
║  │                  │  │  tenant_id on ALL     │  │  billing-calc            │ ║
║  │  ocpp1.6 ✓       │──▶  tables (RLS isolates)│  │  handover-pdf            │ ║
║  │  ocpp1.6J ✓      │  │                       │  │  alarm-notify            │ ║
║  │  ocpp2.0.1 ▶     │  │  Sessions · Billing   │  │  firmware-deploy         │ ║
║  │                  │◀──  Realtime WebSocket    │  │  subscription-check      │ ║
║  └──────────────────┘  └───────────────────────┘  └──────────────────────────┘ ║
║                                    │                                             ║
║         ┌──────────────────────────┼───────────────────────────┐               ║
║         │                          │                            │               ║
║  ┌──────▼────────┐  ┌──────────────▼──────────┐  ┌────────────▼─────────────┐ ║
║  │  WEB APP      │  │  OPERATOR MOBILE APP     │  │  CUSTOMER MOBILE APP     │ ║
║  │  React + Vite │  │  React Native (Expo)     │  │  React Native (Expo)     │ ║
║  │  Tailwind CSS │  │                          │  │                          │ ║
║  │  Mobile-Ready │  │  - View shift status     │  │  - Find stations (map)   │ ║
║  │  White-label  │  │  - Start/stop sessions   │  │  - Scan QR to charge     │ ║
║  │  branding     │  │  - Submit cash handover  │  │  - Pay & track session   │ ║
║  │               │  │  - View alarms           │  │  - View history          │ ║
║  └───────────────┘  └──────────────────────────┘  └──────────────────────────┘ ║
║                                                                                  ║
║  ┌───────────────────────────────────────────────────────────────────────────┐  ║
║  │  MANAGER MOBILE APP (React Native / Expo)                                 │  ║
║  │  Live dashboard · Reports · Approve handovers · Manage chargers · Alerts  │  ║
║  └───────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                  ║
║  ┌───────────────────────────────────────────────────────────────────────────┐  ║
║  │  PHYSICAL CHARGERS (per tenant, auto-discovered)                          │  ║
║  │  Station A → Charger 1 (Gun 1, Gun 2)   Station B → Charger 1, Charger 2 │  ║
║  └───────────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

### Technology Stack Decision

| Layer | Technology | Reason |
|---|---|---|
| **Database** | Supabase (Postgres) — new project | Fresh schema, integer IDs, clean RLS |
| **Primary Keys** | `BIGSERIAL` (integer auto-increment) | Human-readable IDs (1, 2, 3…), faster joins, smaller indexes |
| **Backend API** | Supabase PostgREST + Edge Functions | Zero backend code for CRUD, serverless for complex logic |
| **OCPP Server** | Node.js + TypeScript (Railway or VPS) | Existing, battle-tested, extend for multi-tenant |
| **Web Frontend** | React + Vite + Tailwind CSS | Existing expertise, fast build, white-label theming |
| **Mobile Apps** | React Native + Expo (Managed Workflow) | One codebase → iOS + Android, shared types with web |
| **Auth** | Supabase Auth | JWT with tenant_id claim, RLS integration |
| **Push Notifications** | Expo Push Notifications | Unified iOS/Android push |
| **Maps** | React Native Maps + Google Maps API | Station finder, charger locations |
| **Payments** | Stripe (or Tap Payments for MENA) | Customer app payments |
| **PDF** | jsPDF + arabicReshaper.ts | Existing, proven Arabic support |
| **Subscription Billing** | Stripe Billing | Per-tenant monthly subscriptions |

---

## Part 1: OCPP Multi-Protocol Server

### 1.1 Protocol Detection Architecture

The OCPP server must support three protocol versions. Version is detected at the WebSocket handshake level via the `Sec-WebSocket-Protocol` header.

```typescript
// ocpp-server/src/server.ts — Protocol detection
const handleProtocols = (protocols: Set<string>): string => {
  if (protocols.has('ocpp2.0.1')) return 'ocpp2.0.1';
  if (protocols.has('ocpp1.6'))   return 'ocpp1.6';
  if (protocols.has('ocpp1.5'))   return 'ocpp1.5';
  return '';  // reject
};

// Store protocol version per charger connection
registry.set(chargePointId, {
  ws,
  protocol: negotiatedProtocol,  // 'ocpp1.6' | 'ocpp2.0.1'
  connectedAt: new Date()
});
```

**URL Structure:**
- OCPP 1.6J: `wss://ws.energy-stream.net/ocpp/<chargePointId>`
- OCPP 2.0.1: `wss://ws.energy-stream.net/ocpp20/<chargePointId>`
- Or detected via subprotocol on the same path

### 1.2 OCPP 1.6J Message Handler (Existing — Enhance)

Current handlers in `ocpp-server/src/handlers/`:

| Handler File | OCPP Action | Status |
|---|---|---|
| `bootNotification.ts` | BootNotification | ✅ Exists |
| `heartbeat.ts` | Heartbeat | ✅ Exists |
| `statusNotification.ts` | StatusNotification | ✅ Exists |
| `authorize.ts` | Authorize | ✅ Exists |
| `startTransaction.ts` | StartTransaction | ✅ Exists |
| `stopTransaction.ts` | StopTransaction | ✅ Exists |
| `meterValues.ts` | MeterValues | ✅ Exists |
| `getConfiguration.ts` | GetConfiguration | ❌ Add |
| `changeConfiguration.ts` | ChangeConfiguration response | ❌ Add |
| `updateFirmware.ts` | FirmwareStatusNotification | ❌ Add |
| `getDiagnostics.ts` | DiagnosticsStatusNotification | ❌ Add |
| `sendLocalList.ts` | SendLocalList response | ❌ Add |
| `setChargingProfile.ts` | SetChargingProfile response | ❌ Add |
| `dataTransfer.ts` | DataTransfer (vendor extension) | ❌ Add |
| `triggerMessage.ts` | TriggerMessage response | ❌ Add |

### 1.3 OCPP 2.0.1 Message Handler (New)

OCPP 2.0.1 uses a different message structure and action set:

```typescript
// OCPP 2.0.1 message format
// Call:    [2, "messageId", "Action", {payload}]
// CallResult: [3, "messageId", {payload}]
// CallError:  [4, "messageId", "errorCode", "desc", {details}]

// Key OCPP 2.0.1 actions to handle:
const OCPP20_HANDLERS = {
  'BootNotification':      handle20BootNotification,   // Different payload structure
  'Heartbeat':             handle20Heartbeat,
  'StatusNotification':    handle20StatusNotification,  // Uses EVSE + connector model
  'TransactionEvent':      handle20TransactionEvent,    // Replaces Start/StopTransaction
  'MeterValues':           handle20MeterValues,
  'Authorize':             handle20Authorize,
  'NotifyReport':          handle20NotifyReport,        // Replaces GetConfiguration response
  'NotifyEvent':           handle20NotifyEvent,         // Replaces StatusNotification faults
  'NotifyEVChargingNeeds': handle20NotifyEVChargingNeeds,
  'ReportChargingProfiles':handle20ReportChargingProfiles,
  'SecurityEventNotification': handle20SecurityEvent,
};
```

**Key OCPP 2.0.1 Differences to Handle:**

| 1.6J | 2.0.1 | Notes |
|---|---|---|
| StartTransaction + StopTransaction | TransactionEvent (Started/Updated/Ended) | Single event type |
| GetConfiguration | GetVariables + NotifyReport | Component/variable model |
| ChangeConfiguration | SetVariables | Same concept, different API |
| GetDiagnostics | GetLog | More flexible |
| UpdateFirmware | UpdateFirmware (enhanced) | Adds checksums, security |
| StatusNotification | StatusNotification (per EVSE) | EVSE-centric model |
| Authorize (idTag) | Authorize (idToken with type) | Multiple auth methods |

### 1.4 Auto-Discovery Engine

When any charger connects, the server performs automatic fingerprinting:

```typescript
// ocpp-server/src/autoDiscovery.ts

async function fingerprintCharger(chargePointId: string, bootPayload: any, protocol: string) {
  // 1. Parse BootNotification for identity
  const identity = protocol === 'ocpp2.0.1'
    ? extractOcpp20Identity(bootPayload)
    : extractOcpp16Identity(bootPayload);

  // 2. Check if already registered
  const existing = await supabase
    .from('ocpp_chargers')
    .select('*')
    .eq('charge_point_id', chargePointId)
    .single();

  if (!existing.data) {
    // 3. Auto-register as unassigned charger
    await supabase.from('ocpp_chargers').insert({
      charge_point_id: chargePointId,
      vendor: identity.vendor,
      model: identity.model,
      serial_number: identity.serialNumber,
      firmware_version: identity.firmwareVersion,
      ocpp_protocol: protocol,           // 'ocpp1.6' | 'ocpp2.0.1'
      connection_status: 'online',
      station_id: null,                  // Unassigned — admin must assign to station
      auto_discovered: true,
      first_seen_at: new Date().toISOString(),
    });

    // 4. Alert admin of new unassigned charger
    await notifyAdminsNewCharger(chargePointId, identity);
  }

  // 5. Query charger for its connector count
  await sendGetConfiguration(chargePointId, ['NumberOfConnectors', 'SupportedFeatureProfiles']);

  // 6. Trigger StatusNotification for all connectors
  await sendTriggerMessage(chargePointId, 'StatusNotification');
}

function extractOcpp16Identity(payload: any) {
  return {
    vendor: payload.chargePointVendor,      // e.g. "com.cnchargepoint"
    model: payload.chargePointModel,
    serialNumber: payload.chargePointSerialNumber,
    firmwareVersion: payload.firmwareVersion,
    iccid: payload.iccid,
    imsi: payload.imsi,
  };
}

function extractOcpp20Identity(payload: any) {
  return {
    vendor: payload.chargingStation?.vendorName,
    model: payload.chargingStation?.model,
    serialNumber: payload.chargingStation?.serialNumber,
    firmwareVersion: payload.chargingStation?.firmwareVersion,
    modem: payload.chargingStation?.modem,
  };
}
```

**GetConfiguration response handler — auto-create connectors:**

```typescript
// After GetConfiguration returns NumberOfConnectors
async function onGetConfigurationResponse(chargePointId: string, keys: ConfigKey[]) {
  const numConnectors = parseInt(keys.find(k => k.key === 'NumberOfConnectors')?.value || '1');
  const features = keys.find(k => k.key === 'SupportedFeatureProfiles')?.value || '';

  // Update charger record with discovered capabilities
  await supabase.from('ocpp_chargers').update({
    num_connectors: numConnectors,
    supported_features: features.split(',').map(f => f.trim()),
    smart_charging_supported: features.includes('SmartCharging'),
    reservation_supported: features.includes('Reservation'),
    local_auth_supported: features.includes('LocalAuthListManagement'),
  }).eq('charge_point_id', chargePointId);

  // Auto-create connector records if they don't exist
  for (let i = 1; i <= numConnectors; i++) {
    await supabase.from('ocpp_connectors').upsert({
      charge_point_id: chargePointId,
      connector_id: i,
      status: 'Unknown',
      connector_type: null,   // Will be filled from StatusNotification vendorErrorCode or manual entry
    }, { onConflict: 'charge_point_id,connector_id' });
  }
}
```

---

## Part 2: Complete Database Schema

All migrations in `supabase/migrations/`.

### 2.1 Organization Hierarchy

```sql
-- Organizations (top-level tenants)
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  country     TEXT DEFAULT 'AE',
  currency    TEXT DEFAULT 'AED',
  logo_url    TEXT,
  timezone    TEXT DEFAULT 'Asia/Dubai',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Operators (belong to an organization, can manage stations)
CREATE TABLE operators (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  parent_operator_id UUID REFERENCES operators(id),
  name               TEXT NOT NULL,
  contact_email      TEXT,
  contact_phone      TEXT,
  region             TEXT,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Stations (physical locations, belong to operator)
CREATE TABLE stations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     UUID REFERENCES operators(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'AE',
  lat             NUMERIC(10,7),
  lng             NUMERIC(10,7),
  timezone        TEXT DEFAULT 'Asia/Dubai',
  max_power_kw    NUMERIC(10,2),       -- Station-level power limit
  contact_phone   TEXT,
  operating_hours_start  TIME DEFAULT '00:00:00',
  operating_hours_end    TIME DEFAULT '23:59:59',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Station photos
CREATE TABLE station_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  UUID REFERENCES stations(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  is_primary  BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Charger & Connector Tables (Enhanced)

```sql
-- Chargers (physical OCPP charge points)
CREATE TABLE ocpp_chargers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id       TEXT UNIQUE NOT NULL,          -- OCPP identity (e.g. "244801000001")
  station_id            UUID REFERENCES stations(id),  -- NULL = unassigned
  operator_id           UUID REFERENCES operators(id),
  -- Hardware identity (auto-filled on first connect)
  vendor                TEXT,                          -- e.g. "com.cnchargepoint"
  model                 TEXT,
  serial_number         TEXT,
  firmware_version      TEXT,
  ocpp_protocol         TEXT DEFAULT 'ocpp1.6',        -- 'ocpp1.6' | 'ocpp2.0.1'
  num_connectors        INTEGER DEFAULT 1,
  -- Capabilities (auto-filled after GetConfiguration)
  supported_features    TEXT[],
  smart_charging_supported  BOOLEAN DEFAULT false,
  reservation_supported     BOOLEAN DEFAULT false,
  local_auth_supported      BOOLEAN DEFAULT false,
  -- Connection state
  connection_status     TEXT DEFAULT 'offline',        -- 'online' | 'offline'
  last_heartbeat_at     TIMESTAMPTZ,
  last_boot_at          TIMESTAMPTZ,
  local_ip_address      TEXT,                          -- Filled if discoverable
  -- Discovery metadata
  auto_discovered       BOOLEAN DEFAULT false,
  first_seen_at         TIMESTAMPTZ DEFAULT now(),
  -- Config (last known values from GetConfiguration)
  last_config           JSONB,                         -- Full config key-value map
  -- Physical info
  location_notes        TEXT,
  power_type            TEXT DEFAULT 'AC',             -- 'AC' | 'DC'
  max_power_kw          NUMERIC(10,2),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Connectors (physical dispensers/guns on a charger)
CREATE TABLE ocpp_connectors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id) ON DELETE CASCADE,
  connector_id    INTEGER NOT NULL,
  -- Physical info
  connector_type  TEXT,                -- 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'CCS1' | 'NACS'
  max_power_kw    NUMERIC(10,2),
  -- Live state
  status          TEXT DEFAULT 'Unavailable',
  power_kw        NUMERIC(10,2) DEFAULT 0,
  voltage_v       NUMERIC(10,2),
  current_a       NUMERIC(10,2),
  -- Active session ref
  current_session_id  UUID,           -- FK added after sessions table
  -- Fault state
  error_code      TEXT,
  vendor_error    TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(charge_point_id, connector_id)
);
```

### 2.3 Session & Billing Tables

```sql
-- OCPP charging sessions (auto-created by OCPP server)
CREATE TABLE ocpp_charging_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  transaction_id        INTEGER,                   -- OCPP transaction ID
  charge_point_id       TEXT REFERENCES ocpp_chargers(charge_point_id),
  connector_id          INTEGER NOT NULL,
  station_id            UUID REFERENCES stations(id),
  operator_id           UUID REFERENCES operators(id),
  -- Auth
  id_tag                TEXT,                      -- RFID tag or remote ID
  rfid_card_id          UUID,                      -- FK to rfid_cards if matched
  auth_method           TEXT DEFAULT 'rfid',       -- 'rfid' | 'remote' | 'free' | 'app' | 'pos'
  -- Timing
  start_timestamp       TIMESTAMPTZ NOT NULL,
  stop_timestamp        TIMESTAMPTZ,
  duration_seconds      INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (stop_timestamp - start_timestamp))::INTEGER
  ) STORED,
  -- Energy
  meter_start_wh        NUMERIC(15,3) DEFAULT 0,
  meter_stop_wh         NUMERIC(15,3),
  energy_consumed_wh    NUMERIC(15,3) GENERATED ALWAYS AS (
    COALESCE(meter_stop_wh - meter_start_wh, 0)
  ) STORED,
  -- Live readings
  power_kw              NUMERIC(10,3) DEFAULT 0,
  -- Stop info
  stop_reason           TEXT,                      -- 'Remote' | 'Local' | 'EVDisconnected' | 'DeAuthorized' | 'Other'
  -- Billing
  tariff_id             UUID,                      -- FK to tariffs
  unit_price            NUMERIC(10,4),             -- Price per kWh at session start
  billing_amount        NUMERIC(10,3),             -- Auto-calculated on stop
  billing_currency      TEXT DEFAULT 'AED',
  billing_status        TEXT DEFAULT 'pending',    -- 'pending' | 'calculated' | 'paid' | 'disputed'
  -- Shift tracking
  shift_id              UUID,                      -- FK to shifts table
  -- Protocol
  ocpp_protocol         TEXT DEFAULT 'ocpp1.6',
  -- State
  status                TEXT DEFAULT 'active',     -- 'active' | 'completed' | 'error'
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Meter value history (all readings during a session)
CREATE TABLE session_meter_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES ocpp_charging_sessions(id) ON DELETE CASCADE,
  charge_point_id TEXT,
  connector_id    INTEGER,
  timestamp       TIMESTAMPTZ NOT NULL,
  measurand       TEXT NOT NULL,    -- 'Energy.Active.Import.Register' | 'Power.Active.Import' | 'Voltage' | etc.
  value           NUMERIC(15,4),
  unit            TEXT,             -- 'kWh' | 'W' | 'kW' | 'V' | 'A' | '%'
  phase           TEXT,             -- 'L1' | 'L2' | 'L3' | NULL (for DC)
  context         TEXT DEFAULT 'Sample.Periodic'
);

-- Tariff / pricing plans
CREATE TABLE tariffs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     UUID REFERENCES operators(id),
  name            TEXT NOT NULL,
  description     TEXT,
  -- Simple flat rate
  price_per_kwh   NUMERIC(10,4) NOT NULL,    -- e.g. 0.193
  currency        TEXT DEFAULT 'AED',
  -- Optional time-of-use
  tou_enabled     BOOLEAN DEFAULT false,
  tou_config      JSONB,                     -- Array of {start_hour, end_hour, price_per_kwh, days[]}
  -- Optional session fee
  session_fee     NUMERIC(10,2) DEFAULT 0,   -- Flat fee per session regardless of energy
  -- Optional parking/idle fee (after session ends)
  idle_fee_per_min NUMERIC(10,4) DEFAULT 0,
  idle_grace_minutes INTEGER DEFAULT 15,
  -- Validity
  valid_from      TIMESTAMPTZ DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Billing records (final calculated bill per session)
CREATE TABLE billing_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES ocpp_charging_sessions(id) UNIQUE,
  station_id      UUID REFERENCES stations(id),
  operator_id     UUID REFERENCES operators(id),
  shift_id        UUID,
  -- Session summary
  charge_point_id TEXT,
  connector_id    INTEGER,
  id_tag          TEXT,
  start_time      TIMESTAMPTZ,
  stop_time       TIMESTAMPTZ,
  duration_min    NUMERIC(10,2),
  energy_kwh      NUMERIC(10,4),
  -- Billing breakdown
  tariff_id       UUID REFERENCES tariffs(id),
  unit_price      NUMERIC(10,4),
  energy_amount   NUMERIC(10,3),
  session_fee     NUMERIC(10,2) DEFAULT 0,
  idle_fee        NUMERIC(10,3) DEFAULT 0,
  total_amount    NUMERIC(10,3) NOT NULL,
  currency        TEXT DEFAULT 'AED',
  -- Payment
  payment_method  TEXT DEFAULT 'cash',      -- 'cash' | 'card' | 'rfid_wallet' | 'free'
  payment_status  TEXT DEFAULT 'pending',   -- 'pending' | 'paid' | 'waived' | 'disputed'
  payment_at      TIMESTAMPTZ,
  -- Source
  source          TEXT DEFAULT 'ocpp',      -- 'ocpp' | 'import'
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 2.4 Shift & Handover Tables

```sql
-- Shift definitions (per station, time-based)
CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id      UUID REFERENCES stations(id) ON DELETE CASCADE,
  operator_id     UUID REFERENCES operators(id),
  name            TEXT NOT NULL,           -- e.g. "Morning Shift", "Night Shift"
  start_time      TIME NOT NULL,           -- e.g. 08:00:00
  end_time        TIME NOT NULL,           -- e.g. 20:00:00
  days            INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7],  -- 1=Mon ... 7=Sun
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Shift instances (actual running shifts)
CREATE TABLE shift_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID REFERENCES shifts(id),
  station_id      UUID REFERENCES stations(id),
  operator_id     UUID REFERENCES operators(id),
  -- Assigned officer
  officer_id      UUID REFERENCES user_profiles(id),
  officer_name    TEXT,
  -- Timing
  shift_date      DATE NOT NULL,
  planned_start   TIMESTAMPTZ NOT NULL,
  planned_end     TIMESTAMPTZ NOT NULL,
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  -- Status
  status          TEXT DEFAULT 'upcoming', -- 'upcoming' | 'active' | 'closing' | 'closed' | 'disputed'
  -- Financials (auto-calculated on close)
  total_sessions  INTEGER DEFAULT 0,
  total_energy_kwh NUMERIC(12,4) DEFAULT 0,
  total_revenue   NUMERIC(12,3) DEFAULT 0,
  cash_collected  NUMERIC(12,3) DEFAULT 0,
  card_collected  NUMERIC(12,3) DEFAULT 0,
  free_sessions   INTEGER DEFAULT 0,
  -- Discrepancy
  expected_cash   NUMERIC(12,3) DEFAULT 0,
  actual_cash_submitted NUMERIC(12,3),
  discrepancy     NUMERIC(12,3) GENERATED ALWAYS AS (
    COALESCE(actual_cash_submitted, 0) - expected_cash
  ) STORED,
  discrepancy_reason TEXT,
  -- Handover
  handover_pdf_url TEXT,
  handover_signed  BOOLEAN DEFAULT false,
  handover_signed_at TIMESTAMPTZ,
  handover_signed_by UUID REFERENCES user_profiles(id),
  -- Notes
  opening_notes   TEXT,
  closing_notes   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Cash handover acknowledgment
CREATE TABLE handover_acknowledgments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_instance_id UUID REFERENCES shift_instances(id) UNIQUE,
  -- Submitted by officer
  submitted_by    UUID REFERENCES user_profiles(id),
  submitted_at    TIMESTAMPTZ DEFAULT now(),
  cash_amount     NUMERIC(12,3) NOT NULL,
  denominations   JSONB,                   -- {1000:2, 500:5, 100:10, ...}
  notes           TEXT,
  -- Verified by supervisor
  verified_by     UUID REFERENCES user_profiles(id),
  verified_at     TIMESTAMPTZ,
  is_accepted     BOOLEAN,
  rejection_reason TEXT,
  -- PDF
  pdf_url         TEXT,
  pdf_generated_at TIMESTAMPTZ
);
```

### 2.5 RFID & Auth Tables

```sql
-- RFID card inventory
CREATE TABLE rfid_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     UUID REFERENCES operators(id),
  card_number     TEXT UNIQUE NOT NULL,
  cardholder_name TEXT,
  card_type       TEXT DEFAULT 'standard',   -- 'standard' | 'fleet' | 'staff' | 'maintenance'
  status          TEXT DEFAULT 'inactive',   -- 'inactive' | 'active' | 'suspended' | 'expired'
  -- Binding
  user_id         UUID REFERENCES user_profiles(id),
  -- Limits
  expiration_date TIMESTAMPTZ DEFAULT '2099-12-31',
  max_sessions_per_day INTEGER,
  -- Balance (if prepaid)
  balance         NUMERIC(10,2) DEFAULT 0,
  currency        TEXT DEFAULT 'AED',
  -- Metadata
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Local auth list entries (per charger whitelist)
CREATE TABLE local_auth_list (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id) ON DELETE CASCADE,
  id_tag          TEXT NOT NULL,
  status          TEXT DEFAULT 'Accepted',  -- 'Accepted' | 'Blocked' | 'Expired' | 'Invalid'
  expiry_date     TIMESTAMPTZ,
  parent_id_tag   TEXT,
  -- Sync tracking
  synced_at       TIMESTAMPTZ,
  sync_version    INTEGER DEFAULT 1,
  UNIQUE(charge_point_id, id_tag)
);
```

### 2.6 OCPP Operations Tables

```sql
-- Remote commands queue
CREATE TABLE ocpp_remote_commands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  connector_id    INTEGER,
  command_type    TEXT NOT NULL,    -- 'RemoteStartTransaction' | 'RemoteStopTransaction' |
                                   -- 'Reset' | 'ChangeConfiguration' | 'GetConfiguration' |
                                   -- 'UpdateFirmware' | 'GetDiagnostics' | 'SendLocalList' |
                                   -- 'SetChargingProfile' | 'ClearChargingProfile' |
                                   -- 'TriggerMessage' | 'UnlockConnector' | 'ClearCache'
  payload         JSONB NOT NULL,
  status          TEXT DEFAULT 'pending',   -- 'pending' | 'sent' | 'accepted' | 'rejected' | 'error' | 'timeout'
  response        JSONB,
  created_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '5 minutes')
);

-- OCPP message log (all messages in/out)
CREATE TABLE ocpp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT,
  direction       TEXT NOT NULL,    -- 'inbound' | 'outbound'
  message_type    INTEGER,          -- 2=Call, 3=CallResult, 4=CallError
  message_id      TEXT,
  action          TEXT,
  payload         JSONB,
  ocpp_protocol   TEXT DEFAULT 'ocpp1.6',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ocpp_messages_cp ON ocpp_messages(charge_point_id, created_at DESC);

-- Config key store (last known values per charger)
CREATE TABLE charger_config_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  value           TEXT,
  readonly        BOOLEAN DEFAULT false,
  last_read_at    TIMESTAMPTZ DEFAULT now(),
  last_written_at TIMESTAMPTZ,
  UNIQUE(charge_point_id, key)
);

-- Alarms / faults
CREATE TABLE charger_alarms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  connector_id    INTEGER,
  station_id      UUID REFERENCES stations(id),
  operator_id     UUID REFERENCES operators(id),
  -- Fault details
  error_code      TEXT,
  error_name      TEXT,             -- Human-readable from error dictionary
  vendor_error    TEXT,
  info            TEXT,
  status          TEXT,             -- OCPP status at time of fault
  -- Resolution
  is_resolved     BOOLEAN DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES user_profiles(id),
  resolution_notes TEXT,
  -- Notification
  notifications_sent BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 2.7 Firmware & Diagnostics Tables

```sql
-- Firmware packages (stored in Supabase Storage)
CREATE TABLE firmware_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     UUID REFERENCES operators(id),
  firmware_name   TEXT NOT NULL,
  version         TEXT NOT NULL,
  firmware_type   TEXT DEFAULT 'NotSecc',   -- 'NotSecc' | 'Secc' | 'All' (from charger firmware)
  compatible_vendors TEXT[],                -- ['com.cnchargepoint']
  compatible_models  TEXT[],               -- ['Verde150', 'Verde250']
  ocpp_protocol   TEXT DEFAULT 'ocpp1.6',
  file_url        TEXT NOT NULL,
  file_size_bytes BIGINT,
  sha256          TEXT,
  release_notes   TEXT,
  uploaded_by     UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Firmware update jobs
CREATE TABLE firmware_update_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firmware_id     UUID REFERENCES firmware_packages(id),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  -- Tracking
  status          TEXT DEFAULT 'pending',
  -- Status sequence (from FirmwareStatusNotification):
  -- pending → sent → Downloading → Downloaded → Installing → Installed
  -- or: DownloadFailed | InstallationFailed
  ocpp_status     TEXT,
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Diagnostic log requests
CREATE TABLE diagnostic_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_point_id TEXT REFERENCES ocpp_chargers(charge_point_id),
  operator_id     UUID REFERENCES operators(id),
  -- OCPP DiagnosticsStatusNotification sequence:
  -- requested → Uploading → Uploaded | UploadFailed
  status          TEXT DEFAULT 'requested',
  ocpp_status     TEXT,
  filename        TEXT,
  file_url        TEXT,                      -- Supabase Storage URL
  file_size_bytes BIGINT,
  requested_by    UUID REFERENCES user_profiles(id),
  requested_at    TIMESTAMPTZ DEFAULT now(),
  received_at     TIMESTAMPTZ
);
```

---

## Part 3: Automated Data Pipeline

### 3.1 Philosophy: OCPP is the Primary Source

```
OLD WAY (manual):   Officer exports Excel → Admin imports → Billing calculates
NEW WAY (automated): OCPP StartTransaction → Session created → OCPP MeterValues → Live data
                     OCPP StopTransaction → Session closed → Billing auto-calculated → Shift updated
```

The Excel import remains as a **fallback** for:
- Historical data migration
- Chargers not yet connected to OCPP server
- Dispute resolution with manual override

### 3.2 Session Lifecycle (Fully Automated)

```
Charger plugged in
      │
      ▼
StatusNotification(Preparing)
      │
      ▼
Authorize(idTag) ──────────────────────► Supabase: check rfid_cards table
      │                                            return Accepted/Blocked
      ▼
StartTransaction(idTag, connectorId, meterStart)
      │
      ▼
OCPP Server:
  1. Creates ocpp_charging_sessions record
  2. Links to rfid_cards if tag found
  3. Assigns current shift_id if shift is active
  4. Looks up active tariff for station → stores unit_price
  5. Returns transactionId
      │
      ▼
MeterValues (every N seconds, configured by MeterValueSampleInterval)
      │
      ▼
OCPP Server:
  1. Updates ocpp_connectors.power_kw (live display)
  2. Updates ocpp_charging_sessions.energy_consumed_wh
  3. Inserts into session_meter_values (full history)
  4. Pushes via Supabase Realtime → frontend updates in <1 second
      │
      ▼
StopTransaction(transactionId, meterStop, reason)
      │
      ▼
OCPP Server:
  1. Closes ocpp_charging_sessions (sets stop_timestamp, meter_stop_wh)
  2. Calculates billing_amount = energy_kwh × unit_price + session_fee + idle_fee
  3. Creates billing_records entry
  4. Updates shift_instances totals (total_sessions++, total_energy_kwh+=, total_revenue+=)
  5. Clears connector power_kw to 0
  6. StatusNotification(Available) follows automatically
```

### 3.3 Billing Auto-Calculation (Edge Function)

```typescript
// supabase/functions/calculate-billing/index.ts
// Triggered by session stop, or manually for disputed sessions

export async function calculateBilling(sessionId: string) {
  const { data: session } = await supabase
    .from('ocpp_charging_sessions')
    .select('*, tariffs(*)')
    .eq('id', sessionId)
    .single();

  const energyKwh = session.energy_consumed_wh / 1000;
  const tariff = session.tariffs;

  let energyAmount = 0;

  if (tariff.tou_enabled && tariff.tou_config) {
    // Time-of-use: calculate per interval using session_meter_values
    energyAmount = await calculateTouBilling(session, tariff.tou_config);
  } else {
    // Simple flat rate
    energyAmount = energyKwh * parseFloat(tariff.price_per_kwh);
  }

  // Session fee (flat per session)
  const sessionFee = parseFloat(tariff.session_fee || '0');

  // Idle fee (if charger plugged in after session ended)
  const idleFee = await calculateIdleFee(session, tariff);

  const totalAmount = energyAmount + sessionFee + idleFee;

  await supabase.from('billing_records').upsert({
    session_id: sessionId,
    energy_kwh: energyKwh,
    unit_price: tariff.price_per_kwh,
    energy_amount: energyAmount.toFixed(3),
    session_fee: sessionFee.toFixed(2),
    idle_fee: idleFee.toFixed(3),
    total_amount: totalAmount.toFixed(3),
    billing_status: 'calculated',
  }, { onConflict: 'session_id' });
}
```

---

## Part 4: Automated Shift Management

### 4.1 Shift Assignment Logic

Every session automatically inherits the active shift:

```typescript
// In startTransaction handler
async function getActiveShift(stationId: string, timestamp: Date): Promise<string | null> {
  const dayOfWeek = timestamp.getDay() || 7; // 1=Mon, 7=Sun
  const timeStr = timestamp.toTimeString().slice(0, 8);

  const { data: shift } = await supabase
    .from('shift_instances')
    .select('id')
    .eq('station_id', stationId)
    .eq('status', 'active')
    .lte('planned_start', timestamp.toISOString())
    .gte('planned_end', timestamp.toISOString())
    .single();

  return shift?.id || null;
}
```

### 4.2 Shift Auto-Close

A scheduled Edge Function (cron, every 5 minutes) checks for shifts past their end time and closes them:

```typescript
// supabase/functions/shift-auto-close/index.ts
export async function autoCloseShifts() {
  const { data: expiredShifts } = await supabase
    .from('shift_instances')
    .select('*')
    .eq('status', 'active')
    .lt('planned_end', new Date().toISOString());

  for (const shift of expiredShifts || []) {
    // Calculate totals from billing_records in this shift
    const { data: records } = await supabase
      .from('billing_records')
      .select('total_amount, payment_method, energy_kwh')
      .eq('shift_id', shift.id);

    const totals = records?.reduce((acc, r) => ({
      total_sessions: acc.total_sessions + 1,
      total_energy_kwh: acc.total_energy_kwh + parseFloat(r.energy_kwh || '0'),
      total_revenue: acc.total_revenue + parseFloat(r.total_amount || '0'),
      cash_collected: acc.cash_collected + (r.payment_method === 'cash' ? parseFloat(r.total_amount || '0') : 0),
      card_collected: acc.card_collected + (r.payment_method === 'card' ? parseFloat(r.total_amount || '0') : 0),
    }), { total_sessions: 0, total_energy_kwh: 0, total_revenue: 0, cash_collected: 0, card_collected: 0 });

    await supabase.from('shift_instances').update({
      status: 'closing',
      actual_end: new Date().toISOString(),
      ...totals,
      expected_cash: totals.cash_collected,
    }).eq('id', shift.id);

    // Trigger handover PDF generation
    await generateHandoverPDF(shift.id);
  }
}
```

### 4.3 Automated Cash Handover PDF

```typescript
// supabase/functions/generate-handover/index.ts
// Generates a PDF handover report and sends to officer for acknowledgment

export async function generateHandoverPDF(shiftInstanceId: string) {
  const { data: shift } = await supabase
    .from('shift_instances')
    .select('*, stations(*), operators(*), user_profiles!officer_id(*)')
    .eq('id', shiftInstanceId)
    .single();

  const { data: sessions } = await supabase
    .from('billing_records')
    .select('*')
    .eq('shift_id', shiftInstanceId)
    .order('created_at');

  // Build PDF using jsPDF (same library as existing pdfReportService.ts)
  // Sections:
  // 1. Header: Company logo, station name, shift date/time, officer name
  // 2. Summary table: Total sessions, total kWh, total revenue, cash, card
  // 3. Session detail table: Time, duration, energy, amount, payment method
  // 4. Cash denominations table (filled by officer on submission)
  // 5. Signature block (officer + supervisor)
  // 6. Arabic acknowledgment text (using arabicReshaper.ts)

  // Upload PDF to Supabase Storage
  const pdfBuffer = await buildHandoverPdf(shift, sessions);
  const filename = `handover-${shiftInstanceId}.pdf`;

  await supabase.storage
    .from('handover-pdfs')
    .upload(filename, pdfBuffer, { contentType: 'application/pdf' });

  const { data: publicUrl } = supabase.storage
    .from('handover-pdfs')
    .getPublicUrl(filename);

  await supabase.from('shift_instances').update({
    handover_pdf_url: publicUrl.publicUrl,
    status: 'closing',
  }).eq('id', shiftInstanceId);

  // Notify officer to submit cash
  await notifyOfficerHandoverReady(shift.officer_id, shiftInstanceId, publicUrl.publicUrl);
}
```

### 4.4 Officer Cash Submission UI Flow

```
Shift ends (auto or manual)
      │
      ▼
Officer receives notification (in-app + email):
"Your shift has ended. Please submit cash handover."
      │
      ▼
Officer opens ShiftHandoverScreen.tsx:
  - Shows shift summary (sessions, energy, revenue)
  - Shows expected cash amount
  - Officer enters actual cash by denomination (1000, 500, 100, 50, 20, 10, 5, 1)
  - System calculates total from denominations
  - Officer adds notes (any discrepancy explanation)
  - Officer clicks "Submit Handover"
      │
      ▼
System:
  1. Creates handover_acknowledgments record
  2. Regenerates PDF with denominations filled
  3. Marks shift as 'closed'
  4. Notifies supervisor for verification
      │
      ▼
Supervisor opens HandoverVerifyScreen.tsx:
  - Sees submitted amount vs expected
  - Sees discrepancy (if any)
  - Clicks "Accept" or "Reject with reason"
  - System finalizes shift status: 'closed' or 'disputed'
```

---

## Part 5: Frontend Application

### 5.1 Application Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx           — Sidebar + header with org/station context
│   │   ├── StationSelector.tsx    — Global station context switcher
│   │   └── NotificationBell.tsx
│   ├── dashboard/
│   │   ├── KpiCards.tsx           — Energy, Sessions, Revenue, CO₂
│   │   ├── SessionChart.tsx       — Dual-axis area chart
│   │   └── RecentAlarms.tsx
│   ├── monitor/
│   │   ├── ConnectorGrid.tsx      — Live card grid, one card per connector
│   │   ├── ConnectorCard.tsx      — Single connector live card
│   │   └── SessionDetailDrawer.tsx
│   ├── stations/
│   │   ├── StationMap.tsx         — Map view of all stations
│   │   ├── StationList.tsx
│   │   ├── StationForm.tsx
│   │   └── StationDetail.tsx      — Station + all its chargers
│   ├── chargers/
│   │   ├── ChargerList.tsx        — Per-station charger table
│   │   ├── ChargerDetail.tsx      — Single charger: connectors, config, commands
│   │   ├── ChargerDiscoveryBanner.tsx  — "3 new chargers discovered" alert
│   │   └── ConnectorTypeEditor.tsx
│   ├── sessions/
│   │   ├── SessionTable.tsx       — Full filter table with 14+ filters
│   │   ├── SessionDetailModal.tsx — Per session: billing breakdown, meter values chart
│   │   └── MeterValueChart.tsx    — Power/energy over time for a session
│   ├── shifts/
│   │   ├── ShiftCalendar.tsx      — Week/month view of shifts
│   │   ├── ShiftList.tsx          — Active + upcoming + past shifts
│   │   ├── ShiftDetail.tsx        — Shift sessions + billing breakdown
│   │   ├── HandoverSubmitForm.tsx — Officer cash denomination entry
│   │   └── HandoverVerifyPanel.tsx
│   ├── rfid/
│   │   ├── RfidCardTable.tsx
│   │   ├── RfidCardForm.tsx
│   │   └── WhitelistManager.tsx
│   ├── tariffs/
│   │   ├── TariffList.tsx
│   │   ├── TariffForm.tsx         — Flat + TOU editor
│   │   └── TariffAssignment.tsx   — Assign tariff to station/charger
│   ├── ocpp/
│   │   ├── MessageBrowser.tsx     — Raw OCPP message log
│   │   ├── ConfigKeyEditor.tsx    — All 50+ config keys with proper controls
│   │   ├── RemoteCommandPanel.tsx — Send commands, see response
│   │   ├── ChargingProfileEditor.tsx
│   │   └── QrCodeManager.tsx      — Per-connector QR code management
│   ├── firmware/
│   │   ├── FirmwareList.tsx
│   │   ├── FirmwareUpload.tsx
│   │   └── UpdateJobTracker.tsx
│   ├── diagnostics/
│   │   ├── DiagnosticList.tsx
│   │   └── LogViewer.tsx
│   ├── alarms/
│   │   ├── AlarmList.tsx
│   │   └── AlarmDetail.tsx
│   ├── analytics/
│   │   ├── EnergyChart.tsx
│   │   ├── RevenueChart.tsx
│   │   ├── SessionChart.tsx
│   │   └── DrillDownTable.tsx
│   └── admin/
│       ├── UserManagement.tsx
│       ├── OperatorManagement.tsx
│       └── RolePermissionEditor.tsx
```

### 5.2 Route Structure

```
/                              → Dashboard (KPIs + monitor)
/monitor                       → Full-screen connector grid
/stations                      → Station list/map
/stations/:id                  → Station detail + chargers
/stations/:id/chargers/:cpId   → Charger detail
/sessions                      → Session table
/sessions/:id                  → Session detail
/shifts                        → Shift calendar
/shifts/:id                    → Shift detail
/shifts/:id/handover           → Handover submit/verify
/rfid                          → RFID card management
/rfid/whitelist                → Per-charger whitelist
/tariffs                       → Tariff management
/analytics                     → Charts and drill-down
/ocpp/messages                 → OCPP message log
/ocpp/config                   → Config key editor
/ocpp/commands                 → Remote command panel
/ocpp/profiles                 → Charging profiles
/ocpp/qrcodes                  → QR code manager
/firmware                      → Firmware packages
/diagnostics                   → Diagnostic logs
/alarms                        → Alarm management
/admin/users                   → User management
/admin/operators               → Operator management
/admin/roles                   → RBAC role editor
```

---

## Part 6: OCPP Config Key Editor — Complete Specification

Derived directly from charger firmware source (`configurations.js`). Every key type is mapped to the correct UI control.

### 6.1 Config Key UI Controls

| Key | Control Type | Range/Options |
|---|---|---|
| `AllowOfflineTxForUnknownId` | Toggle | true/false |
| `AuthorizationCacheEnabled` | Toggle | true/false |
| `AuthorizeRemoteTxRequests` | Toggle | **Set false to allow remote start without RFID** |
| `LocalAuthorizeOffline` | Toggle | true/false |
| `LocalPreAuthorize` | Toggle | true/false |
| `LocalAuthListEnabled` | Toggle | true/false |
| `LocalAuthListMaxLength` | Read-only tag | integer |
| `HeartbeatInterval` | Number input | 1–10000 sec |
| `WebSocketPingInterval` | Number input | 0–10000 sec |
| `ResetRetries` | Number input | 0–10000 |
| `ConnectionTimeOut` | Number input | 0–10000 sec |
| `MeterValueSampleInterval` | Number input | 0–10000 sec | 
| `MeterValuesSampledData` | Multi-select | Voltage, Current.Import, Energy.Active.Import.Register, Power.Active.Import, SoC, Temperature, Frequency, + 15 more |
| `MeterValuesAlignedData` | Multi-select | Same 22 measurands |
| `ClockAlignedDataInterval` | Number input | 0–86400 sec |
| `StopTransactionOnEVSideDisconnect` | Toggle | true/false |
| `StopTransactionOnInvalidId` | Toggle | true/false |
| `UnlockConnectorOnEVSideDisconnect` | Toggle | true/false |
| `TransactionMessageAttempts` | Number input | 0–10000 |
| `TransactionMessageRetryInterval` | Number input | 0–10000 sec |
| `NumberOfConnectors` | Read-only tag | integer |
| `SupportedFeatureProfiles` | Read-only tag list | Core, FirmwareManagement, etc. |
| `ConnectorPhaseRotation` | Multi-select with labels | RST, RTS, SRT, STR, TRS, TSR, NotApplicable, Unknown |
| `ChargeBoxId` | Text input | **Change charger ID remotely** |
| `OcppBackendUrl` | Text input | **Change OCPP server URL remotely** |
| `ServerDomain` | Text input | |
| `QrCodeOfConnector1` | Textarea | URL or text shown as QR on screen |
| `QrCodeOfConnector2` | Textarea | URL or text shown as QR on screen |
| `QrCodeOfConnector3` | Textarea | URL or text shown as QR on screen |
| `EnergyPrecision` | Number input | 0–9 decimal places |
| `RfidAuthorizationEnabled` | Toggle | **false = free charging mode (no RFID)** |
| `RfidCardType` | Radio | Serial Number (1) / Custom Card Number (0) |
| `AdminPassword` | Text input | **Remote PIN change for machine screen** |
| `OperatorModeEnabled` | Radio | business / non-business |
| `MaxSoCAllowed` | Number input | 1–100% |
| `ChargingStopAllByScreen` | Toggle | true/false |
| `ChargingStartModeEnabled` | Toggle | true/false |
| `StartChargingImmediatelyAfterPlugEnabled` | Toggle | Auto-start on plug |
| `EvidAuthorizationEnabled` | Toggle | EV ID authorization |
| `EvidIdtagPrefix` | Text input | Prefix for EV ID tags |
| `AuthorizationKey` | Text input | Authorization security key |
| `CustomIdleFeeAfterStop` | Toggle | Enable occupancy/idle fee |
| `StopTxWhenOfflineTimeout` | Number input | Seconds offline before stop |
| `MaxOfflineChargeCount` | Number input | Max offline sessions |
| `SmartChargingStartInterval` | Number input | seconds |
| `ReplugAfterStoppedEnabled` | Toggle | Allow replug after session |
| `EnableCcsPlugToCommunicate` | Toggle | CCS communication on plug |
| `MinimumStatusDuration` | Number input | 0–10000 sec |
| `ChargeCoreApiVersion` | Read-only tag | API version |
| `ChargeCoreChipId` | Read-only tag | Hardware chip ID |
| `AdPlaceInfo` | Read-only tag | Configured ad places |

### 6.2 Config Key Editor Implementation

```typescript
// src/components/ocpp/ConfigKeyEditor.tsx
// Reads live values via GetConfiguration, updates via ChangeConfiguration

const ConfigKeyEditor = ({ chargePointId }: { chargePointId: string }) => {
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  const loadConfig = async () => {
    // Send GetConfiguration command → response stored in charger_config_keys table
    await sendOcppCommand(chargePointId, 'GetConfiguration', { key: [] });
    // Poll charger_config_keys after 3 seconds
    setTimeout(async () => {
      const { data } = await supabase
        .from('charger_config_keys')
        .select('key, value, readonly')
        .eq('charge_point_id', chargePointId);
      setConfigValues(Object.fromEntries(data?.map(r => [r.key, r.value]) || []));
    }, 3000);
  };

  const saveKey = async (key: string, value: string) => {
    await sendOcppCommand(chargePointId, 'ChangeConfiguration', { key, value });
    // Update local cache
    await supabase.from('charger_config_keys')
      .upsert({ charge_point_id: chargePointId, key, value, last_written_at: new Date() },
               { onConflict: 'charge_point_id,key' });
  };
};
```

---

## Part 7: Alarm Error Code Dictionary

Full dictionary extracted from charger firmware (`Script.js` in Xapp). Used to display human-readable alarm names instead of raw error codes.

```typescript
// src/lib/alarmDictionary.ts
export const ALARM_CODES: Record<string, string> = {
  // Environmental
  'E1085': 'High Temperature',
  'E1086': 'High Humidity',
  'E1087': 'Ground Failure',
  'E1088': 'Over Current',
  'E1089': 'Over Voltage',
  'E1090': 'Over Voltage Warning',
  'E1091': 'Under Voltage',
  'E1092': 'Under Voltage Warning',
  // Safety
  'E1094': 'Emergency Stop Triggered',
  'E1095': 'Fan Failure',
  'E1096': 'Smoke Alarm',
  'E1097': 'Flood Sensor Triggered',
  'E1098': 'Door Access Detected',
  'E1099': 'Tamper Detection',
  'E1100': 'Charger Tilted',
  // Connector
  'E1101': 'Temperature Failure',
  'E1103': 'BMS Communication Timeout',
  'E1104': 'Left Door Access Detected',
  'E1105': 'Right Door Access Detected',
  'E1106': 'Middle Door Access Detected',
  'E1110': 'Unlock Failure',
  'E1111': 'Lock Failure',
  'E1113': 'Connector Over Temperature',
  'E1116': 'Connector Temperature Failure',
  // Power Module
  'E1156': 'Power Module Communication Loss',
  'E1157': 'Power Module Partial Lost Contact',
  'E1158': 'Power Module Address Conflict',
  'E1159': 'Power Module Address Conflict',
  'E1160': 'Output Over Voltage',
  'E1161': 'Output Under Voltage',
  'E1162': 'Output Over Current',
  'E1163': 'Power Module High Temperature',
  'E1164': 'Internal Communication',
  'E1165': 'Power Module Fan Failure',
  'E1166': 'Power Module PFC',
  'E1168': 'Power Module Input Phase Error',
  'E1169': 'Input Over Voltage',
  'E1170': 'Input Under Voltage',
  'E1171': 'No Power Module Found',
  'E1174': 'Power Module Position Error',
  'E1175': 'Power Module Not Plugged In',
  'E1176': 'Power Module Check Meter Error',
  // AC/DC
  'E1186': 'AC Meter Communication Loss',
  'E1187': 'AC Meter Communication Quality',
  'E1188': 'AC Meter Data Mismatch',
  'E1192': 'DC Meter Communication Loss',
  'E1193': 'DC Meter Communication Quality',
  'E1194': 'DC Meter Data Mismatch',
  'E1197': 'DC Parallel Contactor Error',
  'E1199': 'DC Output Contactor Error',
  'E1209': 'AC Contactor Error',
  'E1212': 'MCCB Error',
  // Insulation
  'E1225': 'PE Earth Fault',
  'E1228': 'Insulation Monitor Communication Loss',
  'E1229': 'Insulation Monitor Message Error',
  'E1230': 'Insulation Failure',
  'E1231': 'Insulation Detector Insulation Alarm',
  'E1232': 'Insulation Detector Detection Timeout',
  // System
  'E1127': 'Internal Error',
  'E1131': 'Data Mismatch',
  'E1132': 'SD Card Device Error',
  'E1133': 'Screen Communication Loss',
  'E1135': 'RTC Device Failure',
  'E1136': 'MAC Address Error',
  'E1137': 'Invalid Configuration File Format',
  'E1238': 'RFID Reader Communication Loss',
  'E1241': 'Credit Reader Communication Loss',
  // Liquid Cooling
  'E1244': 'Liquid Cooling System Communication Loss',
  'E1245': 'Liquid Level Alarm',
  'E1246': 'Pump Failure',
  'E1248': 'Temperature Sensor Failure',
  'E1249': 'Liquid Connector High Temperature',
  // Network
  'E1265': 'Home Meter Communication Loss',
  'E1266': 'Home Meter Overload',
  'E1269': 'Station Meter Communication Loss',
  'E1272': 'Expansion Unit Communication Loss',
  'E1273': 'GD Communication Loss',
  'E1274': 'HV Board Communication Loss',
  'E1278': 'Logo LED Communication Loss',
  'E1283': 'Unknown Error Code',
};

// Standard OCPP 1.6 error codes
export const OCPP_ERROR_CODES: Record<string, string> = {
  'ConnectorLockFailure': 'Connector Lock Failure',
  'EVCommunicationError': 'EV Communication Error',
  'GroundFailure': 'Ground Failure',
  'HighTemperature': 'High Temperature',
  'InternalError': 'Internal Error',
  'LocalListConflict': 'Local List Conflict',
  'NoError': 'No Error',
  'OtherError': 'Other Error',
  'OverCurrentFailure': 'Over Current Failure',
  'OverVoltage': 'Over Voltage',
  'PowerMeterFailure': 'Power Meter Failure',
  'PowerSwitchFailure': 'Power Switch Failure',
  'ReaderFailure': 'Reader Failure',
  'ResetFailure': 'Reset Failure',
  'UnderVoltage': 'Under Voltage',
  'WeakSignal': 'Weak Signal',
};
```

---

## Part 8: QR Code Screen Management

A new capability discovered in the firmware firmware (`QrCodeOfConnector1/2/3` config keys).

### 8.1 What it Does

The charger's physical touchscreen can display QR codes on each connector's panel. The QR code content is set remotely via OCPP `ChangeConfiguration`. This enables:
- Scan-to-pay workflow (QR → user's phone → payment app)
- Scan-to-start (deep link to pre-authorized session)
- Station info display (address, contact, hours)

### 8.2 QR Code Manager Component

```typescript
// src/components/ocpp/QrCodeManager.tsx
const QrCodeManager = ({ chargePointId, numConnectors }: Props) => {
  const connectors = Array.from({ length: numConnectors }, (_, i) => i + 1);

  const updateQrCode = async (connectorNum: number, url: string) => {
    const key = `QrCodeOfConnector${connectorNum}`;
    // Validate URL
    if (!url.startsWith('http')) throw new Error('Must be a valid URL');
    // Send ChangeConfiguration
    await sendOcppCommand(chargePointId, 'ChangeConfiguration', { key, value: url });
  };

  // Suggested URL template:
  // https://app.energy-stream.net/charge?cp={chargePointId}&cn={connectorNum}
  const suggestUrl = (cpId: string, cn: number) =>
    `https://app.energy-stream.net/charge?cp=${cpId}&cn=${cn}`;

  return (
    // Per-connector: current QR URL, editable text field, QR code preview, Save button
  );
};
```

---

## Part 9: Charger Auto-Discovery UI

### 9.1 Discovery Banner

```typescript
// src/components/chargers/ChargerDiscoveryBanner.tsx
// Shown at top of Chargers page when unassigned chargers exist

const unassigned = chargers.filter(c => !c.station_id && c.auto_discovered);

// Shows: "3 new chargers discovered and waiting for assignment"
// Lists: charge_point_id | vendor | model | firmware | first seen
// Action per row: "Assign to Station" → opens station picker
```

### 9.2 Auto-Discovery Notification

When a brand new charger connects for the first time:
1. OCPP server creates charger record with `auto_discovered: true`, `station_id: null`
2. Edge Function triggers notification to all admin users
3. Admin sees banner on next page load
4. Admin assigns charger to station → connector records created → charger appears in monitor

---

## Part 10: Phase Implementation Sequence

### Phase H1 — Dashboard & Real-Time Monitor (Week 1–2)
**Priority: CRITICAL**

#### H1.1 — KPI Dashboard Cards
- Total Energy (kWh): today / this month / all-time
- Total Sessions: today / this month / all-time  
- Total Revenue (AED): today / this month / all-time
- CO₂ Avoided: `kWh × 0.7 / 1000` tonnes, also shown as tree equivalent
- Data source: Union of `ocpp_charging_sessions` (OCPP-live) + `billing_records` (both OCPP and import)

#### H1.2 — Connector Real-Time Monitor Grid
- One card per connector, updated via Supabase Realtime
- Card shows: station name, charger ID, connector number, connector type, status, power (kW), session duration, energy delivered, ID tag
- Action buttons: Remote Stop (if charging), Remote Start, Unlock Connector
- Color: green=Available, blue=Charging, gray=Offline, red=Faulted, orange=Reserved

#### H1.3 — Statistics Panel
- Three area charts: Energy / Revenue / Sessions
- Date granularity: Day / Week / Month / Year
- Drill-down table below: by Station / by Charger / by Operator
- Export each chart and table as CSV or PNG

#### H1.4 — Real-Time Dashboard (Zero Polling)
- **No manual refresh required** — all status changes arrive via Supabase Realtime WebSocket
- Charger online/offline: instant toast notification + status dot color change
- Connector status (Available → Charging → Finishing → Available): live card update
- Live kW and kWh on active sessions: updates every 1–5 seconds as meter values arrive
- New alarm: persistent red banner with human-readable fault description
- Auto-discovered charger: purple banner "New charger connected!"
- KPI cards increment live; full DB sync every 60 seconds as safety net
- Session duration counter: local JS timer (increments every second, zero server calls)

#### H1.5 — First-Run Setup Wizard & Region Auto-Detection
- Wizard shown on first launch (no organization configured)
- **Auto-detect region**: Browser Geolocation → IP geolocation fallback → browser locale fallback
- Detect and pre-fill: country, currency, decimal places, timezone, date format
- User confirms or overrides in an intuitive dialog
- Wizard covers: Region → Organization → Station → Connect Charger → Set Tariff → Done

#### H1.6 — Regional Settings Admin Panel
- **Currency selector**: dropdown of all supported currencies (AED, SAR, JOD, KWD, EUR, GBP, USD, …)
- **Decimal places for amounts** (0–4): controls all price/revenue displays site-wide
- **Decimal places for energy** (1–3): controls kWh displays
- **Decimal places for price/kWh** (2–4): e.g. `0.193` vs `0.19`
- **Timezone & date format**: affects all date/time displays and shift scheduling
- **Language**: English / Arabic (RTL layout switch)
- When energy decimal changes → auto-sends `ChangeConfiguration(EnergyPrecision)` to all online chargers
- Global `useFormatters()` hook — every number in the UI formatted from one source of truth

---

### Phase H2 — Auto-Discovery & Charger Management (Week 2–3)
**Priority: CRITICAL**

#### H2.1 — OCPP Server Auto-Discovery
- `fingerprintCharger()` function on every BootNotification
- Auto-create charger record if new
- Auto-query `NumberOfConnectors` via GetConfiguration
- Auto-create connector records
- Notify admins of new unassigned chargers

#### H2.2 — Station & Charger Management UI
- Station CRUD: name, address, GPS, photos, operating hours, power limit
- Charger list per station: auto-discovered info pre-filled
- Assign unassigned chargers to stations
- Per-charger: view connectors, set connector types, view config, send commands
- Batch operations: Reset All, Get Config All, Deploy Firmware All

---

### Phase H3 — Automated Shift & Handover (Week 3–4)
**Priority: CRITICAL**

#### H3.1 — Shift Configuration
- Shift templates: name, time range, days, station
- Officer assignment per shift instance
- Auto-instantiation: cron creates next 7 days of shift instances daily

#### H3.2 — Shift Dashboard
- Calendar view: see upcoming shifts per station
- Active shift indicator: currently running shifts with live session count and revenue
- Officer view: their current shift, sessions in it, expected cash

#### H3.3 — Automated Shift Close & Handover PDF
- Auto-close on planned_end time (Edge Function cron)
- Calculate totals from billing_records.shift_id
- Generate PDF with header, summary, session table, denomination table, signature block
- Arabic support in PDF using existing `arabicReshaper.ts`
- Email PDF to officer and supervisor

#### H3.4 — Officer Cash Submission Form
- `HandoverSubmitForm.tsx`: denomination entry (AED 1000, 500, 200, 100, 50, 20, 10, 5, 1)
- Auto-total from denominations
- Show expected vs actual
- Notes field for discrepancy reason
- Submit → creates `handover_acknowledgments` record

#### H3.5 — Supervisor Verification
- `HandoverVerifyPanel.tsx`: shows submission, discrepancy highlight
- Accept / Reject with reason
- If disputed: flag for manual review

---

### Phase H4 — RFID Card Management (Week 4)
**Priority: HIGH**

#### H4.1 — RFID Card Inventory
- Full CRUD for rfid_cards
- Card types: standard, fleet, staff, maintenance
- Bulk import from CSV
- Card status management: activate, suspend, expire

#### H4.2 — Card-User Binding
- Bind card to registered user account
- Balance management (prepaid top-up)

#### H4.3 — Whitelist Sync
- Per-charger whitelist editor
- "Sync Now" → dispatches SendLocalList via OCPP
- Sync status tracking per charger

---

### Phase H5 — Enhanced Transaction Management (Week 4–5)
**Priority: HIGH**

#### H5.1 — Session Table Upgrade
- 14+ filters: time range, station, charger, connector, ID tag, card number, session status, stop reason, payment method, energy range, amount range, shift, operator
- Columns: session ID, station, charger, connector, start/stop, duration, energy (kWh), unit price, total (AED), ID tag, stop reason, payment method, shift, billing status
- Per-row actions: View Details, Fee Breakdown, Manual Settle, Download Receipt
- Export: CSV / Excel with all columns

#### H5.2 — Session Detail Modal
- Full billing breakdown: energy fee + session fee + idle fee = total
- Meter values chart: power (kW) and energy (kWh) over session duration
- Raw OCPP events timeline
- Manual adjustment (admin only): override amount with reason

---

### Phase H6 — Automated Billing Engine Upgrade (Week 5)
**Priority: HIGH**

#### H6.1 — Tariff Management
- Flat rate: price per kWh + optional session fee
- Time-of-use: time bands with different rates (peak/off-peak)
- Tariff assignment: per station or per charger or per user type
- Tariff history: audit trail of rate changes

#### H6.2 — Wallet & Prepaid System
- User wallet balance (AED)
- Top-up (recharge) orders
- Auto-deduct from wallet on session end
- Low balance notification

---

### Phase H7 — Firmware & Diagnostics Management (Week 6)
**Priority: HIGH**

#### H7.1 — Firmware Management
- Upload firmware package to Supabase Storage
- Specify compatible models and `firmware_type` (NotSecc/Secc/All)
- Deploy to single charger or multiple chargers
- Job tracker: pending → Downloading → Downloaded → Installing → Installed
- Handle reboot gap: mark charger as "Updating" during 3-minute disconnect window

#### H7.2 — Diagnostics Management
- Request diagnostic logs (GetDiagnostics → GetDiagnostics response → charger uploads ZIP)
- View uploaded log files
- Note: charger logs are SQLite files (`log.db`) — viewer should handle SQLite export
- 30-day auto-cleanup cron

---

### Phase H8 — Alarm Management (Week 7)
**Priority: HIGH**

#### H8.1 — Alarm Capture (OCPP Server)
- Extend `statusNotification.ts`: when `status = 'Faulted'` or `errorCode != 'NoError'`, write to `charger_alarms`
- Use `ALARM_CODES` dictionary for human-readable name
- Link to session if active at time of fault

#### H8.2 — Alarm UI
- Filter: station, charger, error code, date range, unresolved only
- Color-coded severity: critical (red) / warning (orange) / info (blue)
- Resolve with notes
- Export to CSV

#### H8.3 — Push Notifications
- Configure per alarm type: email / in-app
- Severity threshold: only alert on critical alarms
- Uses Supabase Edge Function + Resend email

---

### Phase H9 — OCPP Operations UI (Week 7–8)
**Priority: MEDIUM**

#### H9.1 — OCPP Message Log Browser
- All messages in/out from `ocpp_messages` table
- Filter: charger, action type, direction, date range
- Raw JSON payload viewer per message
- Dual-channel display: operation channel + maintenance channel

#### H9.2 — Config Key Editor
- Full 50+ key editor (spec in Part 6 above)
- Read live values from charger via GetConfiguration
- Save via ChangeConfiguration
- Batch apply same key change to multiple chargers

#### H9.3 — Remote Command Panel
- Send: RemoteStart, RemoteStop, Reset (Soft/Hard), ClearCache, UnlockConnector, TriggerMessage
- See response inline
- Full command history log

#### H9.4 — Charging Profile Manager
- OCPP SmartCharging profiles
- Set per charger: max power (kW) or max current (A) per time period
- Used for station load balancing

#### H9.5 — QR Code Manager
- Per-connector QR URL editor (Part 8 above)
- QR code preview
- Push via ChangeConfiguration

---

### Phase H10 — Multi-Tenant & RBAC (Week 8–9)
**Priority: MEDIUM**

#### H10.1 — Operator Management
- Operator hierarchy (Organization → Operator → Sub-operator)
- Each operator sees only their stations/chargers/sessions
- RLS policies on all tables enforce isolation

#### H10.2 — Enhanced RBAC
- Granular permission tree (Part 5 permissions list)
- Role builder UI: checkbox per permission
- Assign multiple roles per user
- Per-operator role definitions

---

### Phase H11 — Station Load Balancing (Week 9)
**Priority: MEDIUM**

- Station max power limit configuration
- Background job monitors active sessions' total power
- If total exceeds limit: distribute available power evenly via SetChargingProfile
- Dashboard indicator: station load bar (current kW / max kW)

---

### Phase H12 — Dual OCPP Maintenance Channel (Week 10)
**Priority: LOW**

- Deploy second lightweight OCPP server on Railway for maintenance channel
- Chargers configured with `maintanceUrl` pointing to this server
- All messages logged but no business logic executed
- Feed into OCPP Message Log as separate source
- Useful for debugging without touching production command flow

---

### Phase H13 — Comments, Ratings & Extras (Week 10)
**Priority: LOW**

- Post-session ratings (1–5 stars + comment) — submitted via QR code link or app
- Admin response UI
- CO₂ / sustainability dashboard
- Station comparison charts

---

### Phase H14 — SaaS Tenancy & White-Label (Week 10–11)
**Priority: CRITICAL for commercial launch**

#### H14.1 — Multi-Tenant Foundation
- `tenant_id BIGINT` on all tables, RLS `tenant_isolation` policy on every table
- Tenant slug → OCPP URL namespace (`/acme-ev/charger-id`)
- Custom OCPP domain support (CNAME to Railway server)
- JWT custom claim injection: `tenant_id` from `user_profiles`

#### H14.2 — Subscription Plans & Billing
- `subscription_plans` table seeded (Starter $49/mo, Pro $149/mo, Enterprise custom)
- Stripe integration: create customer + subscription on tenant creation
- Stripe webhook: `invoice.payment_succeeded` → activate, `invoice.payment_failed` → grace period
- Feature gate: `requireFeature()` checks plan flags before premium actions
- Charger limit trigger: `check_charger_limit()` enforces `max_chargers` from plan
- Trial: 14-day trial for new tenants, countdown banner in UI

#### H14.3 — White-Label Customization
- `tenant_branding` table (logo, colors, domain, PDF header, app name)
- Branding editor UI: live preview panel
- CSS custom properties applied at runtime from DB
- Custom web domain: CNAME setup instructions + SSL auto-provisioning (Cloudflare)
- PDF reports use tenant logo and colors
- `app_name` shown in browser title, emails, app store listings

#### H14.4 — Super-Admin Panel
- `/super-admin` route, accessible only to `super_admin` role
- Tenant list: plan, status, charger count, revenue, last active
- MRR dashboard: total monthly recurring revenue across all tenants
- Manual plan override, tenant suspension
- Platform health: OCPP connections, DB query time, Edge Function errors

---

### Phase H15 — Mobile Apps (Week 12–15)
**Priority: HIGH**

#### H15.1 — Monorepo Setup
- Turborepo workspace: `apps/web`, `apps/operator`, `apps/customer`, `apps/manager`
- Shared packages: `packages/types`, `packages/api-hooks`, `packages/ui`, `packages/utils`
- CI: build all apps on PR, type-check shared packages first

#### H15.2 — Operator App (Expo)
- Shift home screen: current shift, live revenue, session count
- Charger monitor: live status grid from Supabase Realtime
- Remote start/stop from phone
- Cash handover submission with denomination keyboard
- Alarm acknowledgment with photo attachment
- Offline mode: MMKV cache, sync on reconnect
- Biometric auth (FaceID / Fingerprint)
- Push notifications: alarm alerts, session events

#### H15.3 — Customer App (Expo)
- Station map (React Native Maps + Google Maps)
- QR code scanner to start session
- Live charging tracker: kW, kWh, cost (Realtime)
- Stripe / Tap Payments integration
- Session history + downloadable receipts
- RFID card registration
- Push: session started, session complete with receipt

#### H15.4 — Manager App (Expo)
- Live dashboard KPI cards (Realtime)
- Charger status grid
- Handover approval queue (view PDF, approve/reject)
- Report viewer with export
- Alarm response
- Staff management (approve registrations, assign shifts)
- Push: critical alarms, pending approvals

#### H15.5 — App Store Submission
- TestFlight (iOS) + Play Store Internal Testing
- App icons, screenshots, descriptions
- White-label build pipeline for enterprise tenants (custom bundle ID, icon, name)

#### H15.6 — PWA (Web Mobile)
- Service worker for offline dashboard
- `manifest.json` with tenant branding
- "Add to Home Screen" prompt
- All web pages pass mobile usability test (min 44px tap targets, responsive tables)

---

## Part 11: Technology Stack Summary

| Layer | Technology | Reason |
|---|---|---|
| **Web Frontend** | React 18 + Vite + TypeScript | Fast dev, existing expertise |
| **UI Components** | Shadcn/ui + Tailwind CSS | Existing, modern, themeable via CSS vars |
| **Charts** | Recharts | React ecosystem, existing |
| **Tables** | TanStack Table | Powerful, existing |
| **Forms** | React Hook Form + Zod | Validation, existing |
| **Mobile Apps** | React Native + Expo (Managed) | One codebase → iOS + Android |
| **Mobile UI** | NativeWind (Tailwind for RN) | Same design system as web |
| **Mobile Maps** | React Native Maps | Station finder |
| **Monorepo** | Turborepo | Share code across web + 3 mobile apps |
| **Real-time** | Supabase Realtime | Already connected, zero polling |
| **Database** | Supabase (Postgres) — new project | Clean schema, integer IDs, RLS |
| **Primary Keys** | BIGSERIAL (integer) | Readable, fast, small indexes |
| **Auth** | Supabase Auth | JWT, RLS integration |
| **File Storage** | Supabase Storage | PDFs, photos, firmware, logos |
| **Edge Functions** | Supabase Edge Functions (Deno) | Shift close, billing, PDF generation |
| **OCPP Server** | Node.js + TypeScript + ws | Multi-tenant, Railway deployment |
| **Push Notifications** | Expo Push Notifications | Unified iOS + Android push |
| **Subscription Billing** | Stripe + Stripe Billing | Per-tenant monthly subscriptions |
| **Customer Payments** | Stripe or Tap Payments (MENA) | Customer app in-app payments |
| **PDF Generation** | jsPDF + arabicReshaper.ts | Arabic support, branded reports |
| **CI/CD** | GitHub Actions | Build, type-check, lint on PR |
| **Deployment (OCPP)** | Railway | WebSocket support, auto-deploy |
| **Deployment (Web)** | Vercel or Cloudflare Pages | Auto-deploy, edge CDN |
| **Custom Domains** | Cloudflare (CNAME + SSL) | White-label web + OCPP domains |
| OCPP Server | Node.js + TypeScript + ws library | Already running on Railway |
| PDF Generation | jsPDF + arabicReshaper | Already built, supports Arabic |
| CSV Export | PapaParse | Lightweight |
| Excel Export | SheetJS (xlsx) | Already installed |
| QR Code | qrcode.react | Small, React-native |
| Maps | Leaflet | Open source, station map |
| Email | Resend | Already integrated |
| Cron | Supabase pg_cron | Already available |

---

## Part 12: OCPP Server File Structure (Final)

```
ocpp-server/
├── src/
│   ├── server.ts              — WebSocket server, protocol detection, charger registration
│   ├── supabase.ts            — Supabase client
│   ├── registry.ts            — Connected charger map (chargePointId → {ws, protocol})
│   ├── types.ts               — OCPP message types (1.6 + 2.0)
│   ├── autoDiscovery.ts       — Fingerprint + auto-register new chargers
│   ├── commandPoller.ts       — Poll ocpp_remote_commands, dispatch to charger
│   ├── ocppHandler.ts         — Route incoming messages to handlers
│   ├── ocpp20Handler.ts       — OCPP 2.0.1 message router
│   ├── handlers/
│   │   ├── bootNotification.ts
│   │   ├── heartbeat.ts
│   │   ├── statusNotification.ts  — + alarm detection
│   │   ├── authorize.ts           — Check rfid_cards table
│   │   ├── startTransaction.ts    — Create session, assign shift, lock tariff
│   │   ├── stopTransaction.ts     — Close session, calculate billing, update shift
│   │   ├── meterValues.ts         — Update live power, insert meter history
│   │   ├── getConfiguration.ts    — Store response in charger_config_keys
│   │   ├── changeConfiguration.ts — Update charger_config_keys on ACK
│   │   ├── firmwareStatus.ts      — Update firmware_update_jobs
│   │   ├── diagnosticsStatus.ts   — Update diagnostic_logs
│   │   ├── dataTransfer.ts        — Handle vendor extensions
│   │   ├── sendLocalList.ts       — Update local_auth_list sync status
│   │   ├── setChargingProfile.ts  — Confirm profile applied
│   │   └── triggerMessage.ts      — Handle TriggerMessage response
│   └── handlers20/
│       ├── bootNotification20.ts
│       ├── transactionEvent.ts    — Replaces Start/Stop in OCPP 2.0
│       ├── statusNotification20.ts
│       ├── meterValues20.ts
│       ├── authorize20.ts
│       └── notifyReport.ts        — Replaces GetConfiguration response
```

---

## Part 13: DB Migrations Sequence

```
supabase/migrations/
├── 20260718_h1_organization_hierarchy.sql        — organizations, operators
├── 20260718_h2_stations_enhanced.sql             — stations, station_photos
├── 20260718_h3_chargers_enhanced.sql             — ocpp_chargers enhanced + ocpp_connectors enhanced
├── 20260718_h4_sessions_billing.sql              — sessions enhanced, session_meter_values, tariffs, billing_records
├── 20260718_h5_shifts_handover.sql               — shifts, shift_instances, handover_acknowledgments
├── 20260718_h6_rfid.sql                          — rfid_cards, local_auth_list
├── 20260718_h7_ocpp_operations.sql               — ocpp_messages, charger_config_keys, charger_alarms
├── 20260718_h8_firmware_diagnostics.sql          — firmware_packages, firmware_update_jobs, diagnostic_logs
├── 20260718_h9_wallets.sql                       — user_wallets, recharge_orders
├── 20260718_h10_rbac.sql                         — permissions, role_permissions, user_permissions
├── 20260718_h11_station_load_balance.sql         — station_load_balance
├── 20260718_h12_session_ratings.sql              — session_ratings
└── 20260718_h13_rls_policies.sql                 — All RLS policies for multi-tenant isolation
```

---

## Implementation Timeline

```
Week 1–2:   Phase H1  — Dashboard + Real-Time Monitor
Week 2–3:   Phase H2  — Auto-Discovery + Charger/Station Management
Week 3–4:   Phase H3  — Shift Management + Automated Cash Handover
Week 4:     Phase H4  — RFID Card Management
Week 4–5:   Phase H5  — Enhanced Transaction Management
Week 5:     Phase H6  — Billing Engine + Wallet
Week 6:     Phase H7  — Firmware + Diagnostics
Week 7:     Phase H8  — Alarm Management
Week 7–8:   Phase H9  — OCPP Operations UI (Config, Commands, QR)
Week 8–9:   Phase H10 — Multi-Tenant + RBAC
Week 9:     Phase H11 — Station Load Balancing
Week 10:    H12 + H13 — Maintenance Channel + Ratings

Total: ~10 weeks for complete independent platform
```

---

## Part 14: Regional Settings — Auto-Discovery, Currency & Decimal Places

### 14.1 Region Auto-Discovery

When a user first opens the platform (or when a new organization is set up), the system automatically detects and suggests the correct region settings. Users can accept or override.

**Detection Sources (in priority order):**

```typescript
// src/lib/regionDetection.ts

export async function detectRegion(): Promise<RegionSettings> {
  // 1. Try browser Geolocation API (most accurate, needs permission)
  const geoPosition = await getBrowserGeolocation().catch(() => null);
  if (geoPosition) {
    return resolveFromCoordinates(geoPosition.coords.lat, geoPosition.coords.lng);
  }

  // 2. Try IP-based geolocation (no permission needed, ~city accuracy)
  const ipGeo = await fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => null);
  if (ipGeo?.country_code) {
    return resolveFromCountryCode(ipGeo.country_code, ipGeo.timezone);
  }

  // 3. Try browser locale
  const locale = navigator.language || 'en-US';
  return resolveFromLocale(locale);
}

export function resolveFromCountryCode(countryCode: string, timezone?: string): RegionSettings {
  const REGION_MAP: Record<string, RegionSettings> = {
    'AE': { country: 'UAE',          currency: 'AED', locale: 'en-AE', timezone: 'Asia/Dubai',   decimalPlaces: 3, currencySymbol: 'AED', thousandsSep: ',', decimalSep: '.' },
    'SA': { country: 'Saudi Arabia', currency: 'SAR', locale: 'ar-SA', timezone: 'Asia/Riyadh',  decimalPlaces: 2, currencySymbol: 'SAR', thousandsSep: ',', decimalSep: '.' },
    'JO': { country: 'Jordan',       currency: 'JOD', locale: 'ar-JO', timezone: 'Asia/Amman',   decimalPlaces: 3, currencySymbol: 'JOD', thousandsSep: ',', decimalSep: '.' },
    'KW': { country: 'Kuwait',       currency: 'KWD', locale: 'ar-KW', timezone: 'Asia/Kuwait',  decimalPlaces: 3, currencySymbol: 'KWD', thousandsSep: ',', decimalSep: '.' },
    'BH': { country: 'Bahrain',      currency: 'BHD', locale: 'ar-BH', timezone: 'Asia/Bahrain', decimalPlaces: 3, currencySymbol: 'BHD', thousandsSep: ',', decimalSep: '.' },
    'QA': { country: 'Qatar',        currency: 'QAR', locale: 'ar-QA', timezone: 'Asia/Qatar',   decimalPlaces: 2, currencySymbol: 'QAR', thousandsSep: ',', decimalSep: '.' },
    'OM': { country: 'Oman',         currency: 'OMR', locale: 'ar-OM', timezone: 'Asia/Muscat',  decimalPlaces: 3, currencySymbol: 'OMR', thousandsSep: ',', decimalSep: '.' },
    'EG': { country: 'Egypt',        currency: 'EGP', locale: 'ar-EG', timezone: 'Africa/Cairo', decimalPlaces: 2, currencySymbol: 'EGP', thousandsSep: ',', decimalSep: '.' },
    'GB': { country: 'UK',           currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London',decimalPlaces: 2, currencySymbol: '£',   thousandsSep: ',', decimalSep: '.' },
    'DE': { country: 'Germany',      currency: 'EUR', locale: 'de-DE', timezone: 'Europe/Berlin',decimalPlaces: 2, currencySymbol: '€',   thousandsSep: '.', decimalSep: ',' },
    'US': { country: 'USA',          currency: 'USD', locale: 'en-US', timezone: 'America/New_York', decimalPlaces: 2, currencySymbol: '$', thousandsSep: ',', decimalSep: '.' },
  };

  const defaults = REGION_MAP[countryCode] || REGION_MAP['AE'];
  return { ...defaults, timezone: timezone || defaults.timezone };
}
```

### 14.2 Region Settings DB Schema

```sql
-- Per-organization regional settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  region_settings JSONB DEFAULT '{
    "currency": "AED",
    "currency_symbol": "AED",
    "locale": "en-AE",
    "timezone": "Asia/Dubai",
    "decimal_places_amount": 3,
    "decimal_places_energy": 3,
    "decimal_places_price": 4,
    "thousands_separator": ",",
    "decimal_separator": ".",
    "date_format": "DD/MM/YYYY",
    "time_format": "HH:mm"
  }'::jsonb;

-- Per-operator can override organization settings
ALTER TABLE operators ADD COLUMN IF NOT EXISTS
  region_override JSONB;

-- System-wide supported currencies
CREATE TABLE supported_currencies (
  code          TEXT PRIMARY KEY,   -- 'AED', 'JOD', 'SAR', etc.
  name          TEXT NOT NULL,      -- 'UAE Dirham'
  symbol        TEXT NOT NULL,      -- 'AED', '£', '€'
  default_decimals INTEGER DEFAULT 2,
  country_code  TEXT
);

INSERT INTO supported_currencies VALUES
  ('AED', 'UAE Dirham',       'AED', 3, 'AE'),
  ('SAR', 'Saudi Riyal',      'SAR', 2, 'SA'),
  ('JOD', 'Jordanian Dinar',  'JOD', 3, 'JO'),
  ('KWD', 'Kuwaiti Dinar',    'KWD', 3, 'KW'),
  ('BHD', 'Bahraini Dinar',   'BHD', 3, 'BH'),
  ('QAR', 'Qatari Riyal',     'QAR', 2, 'QA'),
  ('OMR', 'Omani Rial',       'OMR', 3, 'OM'),
  ('EGP', 'Egyptian Pound',   'EGP', 2, 'EG'),
  ('GBP', 'British Pound',    '£',   2, 'GB'),
  ('EUR', 'Euro',             '€',   2, NULL),
  ('USD', 'US Dollar',        '$',   2, 'US');
```

### 14.3 Region Settings UI

```typescript
// src/components/admin/RegionSettingsPanel.tsx

const RegionSettingsPanel = () => {
  // On first load, auto-detect and show confirmation dialog
  useEffect(() => {
    detectRegion().then(detected => {
      if (!orgSettings.region_configured) {
        setDetectedRegion(detected);
        setShowConfirmDialog(true);  // "We detected you are in UAE. Use AED, 3 decimals?"
      }
    });
  }, []);

  return (
    <Form>
      {/* Currency */}
      <Field label="Currency">
        <Select options={supportedCurrencies}>
          {/* Shows: AED — UAE Dirham, JOD — Jordanian Dinar, etc. */}
        </Select>
      </Field>

      {/* Decimal Places — Amount */}
      <Field label="Decimal places for amounts" hint="e.g. 3 = 0.193 AED">
        <Select options={[
          { value: 0, label: '0 — Whole numbers only (e.g. 5)' },
          { value: 2, label: '2 — Standard (e.g. 5.25)' },
          { value: 3, label: '3 — High precision (e.g. 5.193)' },
          { value: 4, label: '4 — Maximum (e.g. 5.1930)' },
        ]} />
      </Field>

      {/* Decimal Places — Energy */}
      <Field label="Decimal places for energy (kWh)" hint="e.g. 3 = 12.543 kWh">
        <Select options={[
          { value: 1, label: '1 — Low (e.g. 12.5 kWh)' },
          { value: 2, label: '2 — Standard (e.g. 12.54 kWh)' },
          { value: 3, label: '3 — High precision (e.g. 12.543 kWh)' },
        ]} />
      </Field>

      {/* Decimal Places — Price per kWh */}
      <Field label="Decimal places for price per kWh" hint="e.g. 4 = 0.1930 AED/kWh">
        <Select options={[
          { value: 2, label: '2 — (e.g. 0.19 AED/kWh)' },
          { value: 3, label: '3 — (e.g. 0.193 AED/kWh)' },
          { value: 4, label: '4 — (e.g. 0.1930 AED/kWh)' },
        ]} />
      </Field>

      {/* Timezone */}
      <Field label="Timezone">
        <TimezoneSelect />  {/* Searchable timezone dropdown */}
      </Field>

      {/* Date/Time Format */}
      <Field label="Date format">
        <Select options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} />
      </Field>

      {/* Language */}
      <Field label="Display language">
        <Select options={[
          { value: 'en', label: 'English' },
          { value: 'ar', label: 'العربية (Arabic)' },
        ]} />
      </Field>
    </Form>
  );
};
```

### 14.4 Global Formatting Utility

All number/currency displays across the platform use a single formatter:

```typescript
// src/lib/formatters.ts

import { useOrganizationSettings } from '@/contexts/OrganizationContext';

export function useFormatters() {
  const { regionSettings } = useOrganizationSettings();

  const formatAmount = (value: number): string => {
    return value.toFixed(regionSettings.decimal_places_amount)
      + ' ' + regionSettings.currency_symbol;
    // e.g. "5.193 AED" or "£5.25"
  };

  const formatEnergy = (wh: number): string => {
    const kwh = wh / 1000;
    return kwh.toFixed(regionSettings.decimal_places_energy) + ' kWh';
    // e.g. "12.543 kWh"
  };

  const formatPrice = (pricePerKwh: number): string => {
    return pricePerKwh.toFixed(regionSettings.decimal_places_price)
      + ' ' + regionSettings.currency_symbol + '/kWh';
    // e.g. "0.1930 AED/kWh"
  };

  const formatDateTime = (iso: string): string => {
    return new Date(iso).toLocaleString(regionSettings.locale, {
      timeZone: regionSettings.timezone,
      // Uses date_format and time_format settings
    });
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return { formatAmount, formatEnergy, formatPrice, formatDateTime, formatDuration };
}
```

### 14.5 Charger-Level Decimal Sync

The charger's own `EnergyPrecision` OCPP config key (0–9 decimal places) should match the platform's energy decimal setting. When the admin changes decimal places in region settings, the platform automatically sends `ChangeConfiguration` to all online chargers:

```typescript
// When admin saves region settings with new energy decimal places:
const syncEnergyPrecisionToChargers = async (decimalPlaces: number) => {
  const { data: onlineChargers } = await supabase
    .from('ocpp_chargers')
    .select('charge_point_id')
    .eq('connection_status', 'online');

  for (const charger of onlineChargers || []) {
    await supabase.from('ocpp_remote_commands').insert({
      charge_point_id: charger.charge_point_id,
      command_type: 'ChangeConfiguration',
      payload: { key: 'EnergyPrecision', value: String(decimalPlaces) },
    });
  }
};
```

---

## Part 15: Real-Time Dashboard Auto-Update

### 15.1 Architecture: Zero-Polling, Event-Driven

The dashboard never polls. All updates arrive via Supabase Realtime (PostgreSQL logical replication → WebSocket → React state). Any change in the database — charger connects, session starts, fault occurs, meter value updates — appears on screen in under 1 second.

```
Charger ──OCPP──► Railway OCPP Server ──► Supabase DB (UPDATE/INSERT)
                                                    │
                                           Supabase Realtime
                                                    │
                                        WebSocket (already open)
                                                    │
                                         React state update
                                                    │
                                          UI re-renders < 1s
```

### 15.2 Realtime Subscriptions Map

```typescript
// src/hooks/useRealtimeDashboard.ts

export function useRealtimeDashboard() {
  const [chargerStatuses, setChargerStatuses] = useState<ChargerStatus[]>([]);
  const [connectorStates, setConnectorStates] = useState<ConnectorState[]>([]);
  const [activeSessionCounts, setActiveSessionCounts] = useState<Record<string, number>>({});
  const [activeAlarms, setActiveAlarms] = useState<Alarm[]>([]);
  const [todayKpis, setTodayKpis] = useState<DashboardKpis | null>(null);

  useEffect(() => {
    const channel = supabase.channel('dashboard-realtime');

    // 1. Charger online/offline status
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ocpp_chargers',
      filter: `connection_status=neq.${prevStatus}`,  // any status change
    }, (payload) => {
      setChargerStatuses(prev =>
        prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
      );
      // Show toast: "Charger 244801000001 is now ONLINE"
      if (payload.new.connection_status === 'online' && payload.old.connection_status === 'offline') {
        toast.success(`Charger ${payload.new.charge_point_id} came online`);
      }
      if (payload.new.connection_status === 'offline' && payload.old.connection_status === 'online') {
        toast.error(`Charger ${payload.new.charge_point_id} went offline`);
      }
    });

    // 2. Connector status changes (Available → Charging → Finishing → Available)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ocpp_connectors',
    }, (payload) => {
      setConnectorStates(prev =>
        prev.map(c =>
          c.charge_point_id === payload.new.charge_point_id &&
          c.connector_id === payload.new.connector_id
            ? { ...c, ...payload.new }
            : c
        )
      );
    });

    // 3. Live power/energy during active sessions
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ocpp_charging_sessions',
      filter: 'status=eq.active',
    }, (payload) => {
      // Update live kW and kWh on the connector card
      updateSessionLiveData(payload.new);
    });

    // 4. New session started → KPI cards update
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ocpp_charging_sessions',
    }, (payload) => {
      incrementTodaySessionCount();
    });

    // 5. Session ended → update totals
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'billing_records',
    }, (payload) => {
      // Update today's revenue KPI
      refreshTodayRevenue();
    });

    // 6. New alarm → show alert banner + update alarm count
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'charger_alarms',
    }, (payload) => {
      setActiveAlarms(prev => [payload.new as Alarm, ...prev]);
      // Show persistent alert banner for critical alarms
      if (isCriticalAlarm(payload.new.error_code)) {
        showAlarmBanner(payload.new);
      }
    });

    // 7. New charger auto-discovered → show discovery banner
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ocpp_chargers',
      filter: 'auto_discovered=eq.true',
    }, (payload) => {
      showNewChargerDiscoveryBanner(payload.new);
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
}
```

### 15.3 Connector Card Status Indicator

Each connector card on the monitor dashboard shows its live status with color and animation:

```typescript
// src/components/monitor/ConnectorCard.tsx

const STATUS_CONFIG = {
  Available:     { color: 'bg-green-500',  label: 'Available',  pulse: false },
  Preparing:     { color: 'bg-blue-400',   label: 'Preparing',  pulse: true  },
  Charging:      { color: 'bg-blue-600',   label: 'Charging',   pulse: true  },
  SuspendedEV:   { color: 'bg-yellow-500', label: 'Suspended',  pulse: false },
  SuspendedEVSE: { color: 'bg-yellow-600', label: 'Suspended',  pulse: false },
  Finishing:     { color: 'bg-blue-300',   label: 'Finishing',  pulse: true  },
  Reserved:      { color: 'bg-orange-500', label: 'Reserved',   pulse: false },
  Unavailable:   { color: 'bg-gray-400',   label: 'Unavailable',pulse: false },
  Faulted:       { color: 'bg-red-600',    label: 'Faulted',    pulse: true  },
  Offline:       { color: 'bg-gray-600',   label: 'Offline',    pulse: false },
};

// Live duration counter (increments every second using local timer)
// Live kW display (updates via Realtime subscription)
// Live kWh display (updates via Realtime subscription)
// Session elapsed time (local JS timer, no server calls)
```

### 15.4 Dashboard KPI Auto-Refresh

KPI cards use a hybrid approach: Realtime for incremental updates, full refresh every 60 seconds as a safety net:

```typescript
// src/components/dashboard/KpiCards.tsx

const KpiCards = () => {
  const [kpis, setKpis] = useState<DashboardKpis>(initialKpis);

  // Realtime: increment on new session or billing record
  useRealtimeKpiUpdates(setKpis);

  // Safety net: full refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(refreshKpisFromDb, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard title="Total Energy Today" value={formatEnergy(kpis.energyWh)} icon={<Zap/>} trend={kpis.energyTrend} />
      <KpiCard title="Sessions Today"     value={kpis.sessionCount}           icon={<Activity/>} trend={kpis.sessionTrend} />
      <KpiCard title="Revenue Today"      value={formatAmount(kpis.revenue)}  icon={<DollarSign/>} trend={kpis.revenueTrend} />
      <KpiCard title="CO₂ Avoided"        value={formatCo2(kpis.energyWh)}   icon={<Leaf/>} />
      {/* Charger status summary */}
      <KpiCard title="Online Chargers"    value={`${kpis.onlineCount} / ${kpis.totalCount}`} icon={<Wifi/>} color={kpis.onlineCount > 0 ? 'green' : 'red'} />
      <KpiCard title="Active Sessions"    value={kpis.activeSessionCount}     icon={<BatteryCharging/>} color="blue" />
      <KpiCard title="Faulted"            value={kpis.faultedCount}           icon={<AlertTriangle/>} color={kpis.faultedCount > 0 ? 'red' : 'green'} />
      <KpiCard title="Unresolved Alarms"  value={kpis.unresolvedAlarmCount}   icon={<Bell/>}  color={kpis.unresolvedAlarmCount > 0 ? 'orange' : 'green'} />
    </div>
  );
};
```

### 15.5 Charger Status Summary Widget

A mini-grid shown on the dashboard showing all chargers with live status dots:

```typescript
// src/components/dashboard/ChargerStatusGrid.tsx
// Shows a compact grid: one dot per charger, colored by status
// Click → opens full ConnectorMonitor for that charger
// Updates in real-time via Supabase Realtime (no refresh)

// Status dot legend:
// 🟢 Online + All Available
// 🔵 Online + Charging (number shown: how many active sessions)
// 🟡 Online + Partially unavailable
// 🔴 Faulted
// ⚫ Offline
```

### 15.6 Live Notification System

```typescript
// src/components/layout/NotificationBell.tsx

// Realtime events that generate in-app notifications:
const NOTIFICATION_EVENTS = [
  { table: 'ocpp_chargers',         filter: 'connection_status',  type: 'charger_status' },
  { table: 'charger_alarms',        event: 'INSERT',              type: 'new_alarm'       },
  { table: 'ocpp_charging_sessions',event: 'INSERT',              type: 'session_started' },
  { table: 'shift_instances',       filter: 'status=eq.closing',  type: 'handover_ready' },
  { table: 'ocpp_chargers',         filter: 'auto_discovered=true',type: 'new_charger'   },
];

// Notification types and their display:
// charger_status:  "Charger 244801000001 went offline" [red]
// new_alarm:       "FAULT: Emergency Stop on Station A / Charger 1" [red, persistent]
// session_started: "New session on Station B / Gun 2 — RFID: A3F5..." [blue]
// handover_ready:  "Your shift has ended. Submit cash handover." [orange, action button]
// new_charger:     "New charger discovered: com.cnchargepoint / Verde150" [purple]
```

---

## Part 16: First-Run Setup Wizard

When the platform is first opened (no organization configured), a setup wizard guides through:

```
Step 1: Region & Currency
  ├── Auto-detected: "We detected UAE. Use AED (3 decimals)?"
  ├── Accept or choose different country
  ├── Set currency, decimal places, timezone, date format
  └── Can be changed later in Settings

Step 2: Organization
  ├── Organization name
  ├── Logo upload
  └── Contact info

Step 3: First Station
  ├── Station name
  ├── Address (with map pin)
  └── Operating hours

Step 4: Connect First Charger
  ├── "Your OCPP server URL is: wss://ws.energy-stream.net/ocpp/"
  ├── "Set this URL in your charger's web admin at http://<charger-IP>/"
  ├── "Default credentials: admin / 123456"
  └── Waiting indicator: "Listening for charger connection..."
      → When charger connects: "✓ Charger 244801000001 connected!"

Step 5: Set Tariff
  ├── Price per kWh (e.g. 0.193)
  ├── Currency auto-filled from Step 1
  └── Optional: session fee, idle fee

Step 6: Done
  └── Opens dashboard with live monitor
```

---

## Part 17: SaaS Multi-Tenancy Architecture

### 17.1 Core Principle — `tenant_id` on Everything

Every table in the database has a `tenant_id BIGINT NOT NULL` column. Supabase RLS policies ensure a logged-in user can only ever see rows that belong to their tenant. There is no application-level filtering — the database enforces it at the row level.

```sql
-- Every table follows this pattern:
CREATE TABLE stations (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- ... other columns
);

-- RLS policy (identical pattern on every table):
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON stations
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
```

### 17.2 Tenant Table

```sql
CREATE TABLE tenants (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,         -- 'acme-ev', used in URLs and OCPP namespace
  name              TEXT NOT NULL,                -- 'AcmeEV Charging'
  plan_id           BIGINT REFERENCES subscription_plans(id),
  subscription_status TEXT DEFAULT 'trial',      -- 'trial' | 'active' | 'past_due' | 'cancelled'
  trial_ends_at     TIMESTAMPTZ,
  stripe_customer_id TEXT,
  max_chargers      INTEGER DEFAULT 10,           -- from subscription plan
  max_stations      INTEGER DEFAULT 3,
  created_at        TIMESTAMPTZ DEFAULT now(),
  is_active         BOOLEAN DEFAULT true
);
```

### 17.3 OCPP Namespace Per Tenant

Each tenant's chargers connect using their tenant slug as URL prefix. The OCPP server reads it to set `tenant_id` on all DB writes:

```
wss://ocpp.chargeOS.io/acme-ev/244801000001    → tenant_id = 1
wss://ocpp.chargeOS.io/green-charge/GCEV-001   → tenant_id = 2
wss://ocpp.chargeOS.io/your-brand/EV-CUSTOM-1  → tenant_id = 3
```

Or with custom domain (white-label):
```
wss://ocpp.acmeev.com/244801000001             → tenant_id = 1 (via domain lookup)
```

```typescript
// ocpp-server/src/server.ts — tenant resolution
const resolveTenant = async (url: string, host: string): Promise<number> => {
  // 1. Try slug from URL path: /acme-ev/charger-id
  const slugMatch = url.match(/^\/([a-z0-9-]+)\//);
  if (slugMatch) {
    const { data } = await supabase.from('tenants').select('id').eq('slug', slugMatch[1]).single();
    if (data) return data.id;
  }
  // 2. Try custom OCPP domain
  const { data } = await supabase.from('tenant_branding').select('tenant_id').eq('ocpp_domain', host).single();
  if (data) return data.tenant_id;
  throw new Error(`Unknown tenant for host: ${host}, url: ${url}`);
};
```

### 17.4 Super-Admin vs Tenant Users

```
Role Hierarchy:
  super_admin      → sees ALL tenants, manages subscriptions, platform health
  tenant_admin     → full access within their tenant
  station_manager  → manages assigned stations only
  officer          → their shift and its sessions only
  customer         → their own sessions only
```

```sql
CREATE TABLE user_profiles (
  id          BIGSERIAL PRIMARY KEY,
  auth_id     UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  tenant_id   BIGINT REFERENCES tenants(id),   -- NULL for super_admin
  role        TEXT NOT NULL,  -- 'super_admin' | 'tenant_admin' | 'station_manager' | 'officer' | 'customer'
  full_name   TEXT,
  phone       TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## Part 18: White-Label Customization

### 18.1 Branding Table

```sql
CREATE TABLE tenant_branding (
  id               BIGSERIAL PRIMARY KEY,
  tenant_id        BIGINT UNIQUE NOT NULL REFERENCES tenants(id),

  -- Identity
  app_name         TEXT DEFAULT 'ChargeOS',         -- shown in browser tab, emails, app store
  company_name     TEXT,
  tagline          TEXT,

  -- Visuals
  logo_url         TEXT,                            -- stored in Supabase Storage
  logo_dark_url    TEXT,
  favicon_url      TEXT,
  primary_color    TEXT DEFAULT '#3B82F6',          -- hex, used for buttons, links, etc.
  secondary_color  TEXT DEFAULT '#10B981',
  text_color       TEXT DEFAULT '#111827',
  background_color TEXT DEFAULT '#FFFFFF',
  dark_mode_primary TEXT,

  -- Domains
  web_domain       TEXT UNIQUE,                     -- 'app.acmeev.com' (CNAME to chargeOS)
  ocpp_domain      TEXT UNIQUE,                     -- 'ocpp.acmeev.com' (CNAME to Railway)
  api_domain       TEXT UNIQUE,                     -- 'api.acmeev.com'

  -- Emails
  support_email    TEXT,
  from_email       TEXT,                            -- 'no-reply@acmeev.com'
  smtp_host        TEXT,                            -- optional custom SMTP
  smtp_port        INTEGER,

  -- PDF branding
  pdf_header_text  TEXT,
  pdf_footer_text  TEXT,
  pdf_logo_url     TEXT,

  -- App store (mobile white-label)
  ios_bundle_id    TEXT,                            -- 'com.acmeev.driver'
  android_package  TEXT,                            -- 'com.acmeev.driver'
  app_store_url    TEXT,
  play_store_url   TEXT,

  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

### 18.2 Runtime Theme Loading

The web app fetches branding on startup and applies it as CSS custom properties:

```typescript
// src/lib/branding.ts
export async function loadTenantBranding(tenantSlug: string): Promise<void> {
  const { data } = await supabase
    .from('tenant_branding')
    .select('*')
    .eq('tenant_id', getTenantIdFromSlug(tenantSlug))
    .single();

  if (!data) return; // use defaults

  const root = document.documentElement;
  root.style.setProperty('--color-primary',    data.primary_color);
  root.style.setProperty('--color-secondary',  data.secondary_color);
  root.style.setProperty('--color-text',       data.text_color);
  root.style.setProperty('--color-bg',         data.background_color);

  // Update title, favicon, meta
  document.title = data.app_name || 'ChargeOS';
  if (data.favicon_url) updateFavicon(data.favicon_url);
}
```

### 18.3 Mobile App White-Label

Mobile apps read branding from the API on launch, applying the same colors/logo:

```typescript
// React Native: app startup
const { data: branding } = await supabase.from('tenant_branding').select('*').single();
ThemeProvider.setTheme({
  primary:   branding.primary_color,
  secondary: branding.secondary_color,
  logo:      branding.logo_url,
  appName:   branding.app_name,
});
```

For fully custom-branded mobile apps (different app name on App Store/Play Store), the Expo project is re-built with the tenant's `app.config.js` values (bundle ID, app name, icon). This is an enterprise-tier feature.

---

## Part 19: Subscription Plans & SaaS Billing

### 19.1 Subscription Plans Table

```sql
CREATE TABLE subscription_plans (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,       -- 'Starter', 'Pro', 'Enterprise'
  price_monthly     NUMERIC(10,2),       -- USD per month
  price_yearly      NUMERIC(10,2),       -- USD per year (discounted)
  currency          TEXT DEFAULT 'USD',
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,

  -- Feature limits
  max_chargers      INTEGER DEFAULT 5,
  max_stations      INTEGER DEFAULT 1,
  max_operators     INTEGER DEFAULT 3,
  max_rfid_cards    INTEGER DEFAULT 50,
  history_retention_days INTEGER DEFAULT 365,

  -- Feature flags
  feature_white_label       BOOLEAN DEFAULT false,
  feature_custom_domain     BOOLEAN DEFAULT false,
  feature_mobile_apps       BOOLEAN DEFAULT false,
  feature_api_access        BOOLEAN DEFAULT false,
  feature_advanced_reports  BOOLEAN DEFAULT false,
  feature_firmware_mgmt     BOOLEAN DEFAULT false,
  feature_multi_currency    BOOLEAN DEFAULT false,
  feature_ocpp_20           BOOLEAN DEFAULT false,
  feature_customer_app      BOOLEAN DEFAULT false,
  feature_custom_smtp       BOOLEAN DEFAULT false,

  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Seeded plans
INSERT INTO subscription_plans (name, price_monthly, price_yearly, max_chargers, max_stations, max_operators,
  feature_white_label, feature_custom_domain, feature_mobile_apps, feature_api_access) VALUES
  ('Starter',    49,  490,  5,   1,  3,  false, false, false, false),
  ('Pro',       149, 1490,  25,  5,  10, true,  true,  true,  true ),
  ('Enterprise', 0,    0,   -1,  -1, -1, true,  true,  true,  true );
  -- Enterprise: unlimited (-1), custom pricing, dedicated support
```

### 19.2 Plan Enforcement

Feature flags checked at every relevant action:

```typescript
// src/lib/featureGate.ts
export async function requireFeature(feature: keyof SubscriptionPlan): Promise<void> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('subscription_plans(*)')
    .single();

  if (!tenant?.subscription_plans?.[feature]) {
    throw new UpgradeRequiredError(
      `Your ${tenant.subscription_plans.name} plan does not include ${feature}. Upgrade to access this feature.`
    );
  }
}

// Usage:
await requireFeature('feature_white_label');       // before showing white-label settings
await requireFeature('feature_firmware_mgmt');     // before firmware update UI
await requireFeature('feature_advanced_reports');  // before export button
```

### 19.3 Usage Metering (Charger Count Gate)

```sql
-- Prevent adding chargers beyond plan limit
CREATE OR REPLACE FUNCTION check_charger_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_count INTEGER;
  max_allowed   INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM ocpp_chargers WHERE tenant_id = NEW.tenant_id;

  SELECT sp.max_chargers INTO max_allowed
  FROM tenants t JOIN subscription_plans sp ON t.plan_id = sp.id
  WHERE t.id = NEW.tenant_id;

  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'Charger limit reached (%). Upgrade your plan.', max_allowed;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_charger_limit
  BEFORE INSERT ON ocpp_chargers
  FOR EACH ROW EXECUTE FUNCTION check_charger_limit();
```

### 19.4 Super-Admin Dashboard

A separate `/super-admin` route (not accessible to tenants) for platform management:

```
Super-Admin Panel:
  ├── Tenants list: all tenants, plan, status, charger count, last active
  ├── Create/edit tenant
  ├── Override subscription plan manually
  ├── Platform KPIs: total sessions, total energy, total revenue (across all tenants)
  ├── Server health: OCPP connections, DB load, Edge Function errors
  └── Subscription analytics: MRR, churn, trial conversions
```

---

## Part 20: Database Design — Integer IDs

### 20.1 Why Integer IDs (BIGSERIAL) Instead of UUIDs

| Factor | UUID | BIGSERIAL (Integer) |
|---|---|---|
| **Readability** | `a3f5-bc12-...` hard to remember | `1042` easy for support tickets |
| **Storage** | 16 bytes | 8 bytes (50% smaller) |
| **Index size** | Large B-tree | Compact, cache-friendly |
| **Join performance** | Slower (larger comparisons) | Faster integer joins |
| **URL friendliness** | `/sessions/a3f5bc12-...` | `/sessions/1042` |
| **OCPP compatibility** | Must stringify for OCPP | Native int, stringify when needed |
| **Distributed generation** | No DB needed | Sequential, needs DB |
| **Tenant isolation** | UUIDs hard to guess (minor security) | RLS handles isolation, IDs not secret |

**Decision: Use `BIGSERIAL` for all primary keys.** Tenant isolation is enforced by RLS, not by obscure IDs.

### 20.2 Core Schema with Integer IDs

```sql
-- ─── TENANTS ────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  plan_id       BIGINT REFERENCES subscription_plans(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  id            BIGSERIAL PRIMARY KEY,
  auth_id       UUID UNIQUE NOT NULL,  -- Supabase Auth still uses UUID (keep as FK to auth.users)
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
  role          TEXT NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  is_approved   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── STATIONS ───────────────────────────────────────────────────────────────
CREATE TABLE stations (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  country       TEXT DEFAULT 'AE',
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  timezone      TEXT DEFAULT 'Asia/Dubai',
  is_public     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── CHARGERS ───────────────────────────────────────────────────────────────
CREATE TABLE chargers (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  station_id        BIGINT REFERENCES stations(id),
  charge_point_id   TEXT NOT NULL,         -- from OCPP BootNotification
  vendor            TEXT,
  model             TEXT,
  serial_number     TEXT,
  firmware_version  TEXT,
  ocpp_protocol     TEXT DEFAULT 'ocpp1.6j',
  connection_status TEXT DEFAULT 'offline',
  last_heartbeat    TIMESTAMPTZ,
  auto_discovered   BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, charge_point_id)
);

-- ─── CONNECTORS ─────────────────────────────────────────────────────────────
CREATE TABLE connectors (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  charger_id        BIGINT NOT NULL REFERENCES chargers(id),
  connector_number  INTEGER NOT NULL,     -- 1, 2, 3...
  connector_type    TEXT,                 -- 'CCS2', 'CHAdeMO', 'Type2', 'GB/T'
  max_power_kw      NUMERIC(6,2),
  status            TEXT DEFAULT 'Unavailable',
  power_kw          NUMERIC(8,3) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(charger_id, connector_number)
);

-- ─── SESSIONS ───────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  charger_id        BIGINT NOT NULL REFERENCES chargers(id),
  connector_id      BIGINT NOT NULL REFERENCES connectors(id),
  shift_id          BIGINT REFERENCES shifts(id),
  tariff_id         BIGINT REFERENCES tariffs(id),

  transaction_id    BIGINT,               -- OCPP transaction_id
  id_tag            TEXT,                 -- RFID/token used
  customer_id       BIGINT REFERENCES user_profiles(id),

  started_at        TIMESTAMPTZ,
  stopped_at        TIMESTAMPTZ,
  duration_seconds  INTEGER GENERATED ALWAYS AS
                    (EXTRACT(EPOCH FROM stopped_at - started_at)::INTEGER) STORED,

  energy_wh         NUMERIC(12,3) DEFAULT 0,
  start_meter_wh    NUMERIC(12,3),
  stop_meter_wh     NUMERIC(12,3),

  unit_price        NUMERIC(12,4),        -- price/kWh at session start (locked in)
  session_fee       NUMERIC(10,4) DEFAULT 0,
  idle_fee          NUMERIC(10,4) DEFAULT 0,
  amount_due        NUMERIC(12,3),
  amount_paid       NUMERIC(12,3),

  status            TEXT DEFAULT 'active', -- 'active' | 'completed' | 'error'
  stop_reason       TEXT,
  billing_status    TEXT DEFAULT 'pending', -- 'pending' | 'billed' | 'void'

  source            TEXT DEFAULT 'ocpp',  -- 'ocpp' | 'import'
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── BILLING RECORDS ────────────────────────────────────────────────────────
CREATE TABLE billing_records (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  session_id        BIGINT UNIQUE NOT NULL REFERENCES sessions(id),
  shift_id          BIGINT REFERENCES shifts(id),

  energy_kwh        NUMERIC(12,3),
  unit_price        NUMERIC(12,4),
  energy_amount     NUMERIC(12,3),
  session_fee       NUMERIC(10,4) DEFAULT 0,
  idle_fee          NUMERIC(10,4) DEFAULT 0,
  tax_amount        NUMERIC(10,3) DEFAULT 0,
  total_amount      NUMERIC(12,3),

  currency          TEXT DEFAULT 'AED',
  payment_method    TEXT DEFAULT 'cash',  -- 'cash' | 'card' | 'app' | 'rfid_prepaid'
  payment_status    TEXT DEFAULT 'pending',

  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── SHIFTS ─────────────────────────────────────────────────────────────────
CREATE TABLE shifts (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  station_id        BIGINT NOT NULL REFERENCES stations(id),
  officer_id        BIGINT REFERENCES user_profiles(id),

  planned_start     TIMESTAMPTZ NOT NULL,
  planned_end       TIMESTAMPTZ NOT NULL,
  actual_start      TIMESTAMPTZ,
  actual_end        TIMESTAMPTZ,

  status            TEXT DEFAULT 'scheduled', -- 'scheduled'|'active'|'closing'|'closed'

  -- Financials (computed at close)
  total_sessions    INTEGER DEFAULT 0,
  total_energy_wh   NUMERIC(14,3) DEFAULT 0,
  expected_cash     NUMERIC(12,3) DEFAULT 0,
  submitted_cash    NUMERIC(12,3),
  discrepancy       NUMERIC(12,3),
  discrepancy_reason TEXT,

  handover_pdf_url  TEXT,
  supervisor_id     BIGINT REFERENCES user_profiles(id),
  approved_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── TARIFFS ────────────────────────────────────────────────────────────────
CREATE TABLE tariffs (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  name              TEXT NOT NULL,
  currency          TEXT DEFAULT 'AED',
  price_per_kwh     NUMERIC(12,4) NOT NULL,
  session_fee       NUMERIC(10,4) DEFAULT 0,
  idle_fee_per_min  NUMERIC(10,4) DEFAULT 0,
  is_default        BOOLEAN DEFAULT false,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── RFID CARDS ─────────────────────────────────────────────────────────────
CREATE TABLE rfid_cards (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  tag               TEXT NOT NULL,
  label             TEXT,
  owner_id          BIGINT REFERENCES user_profiles(id),
  card_type         TEXT DEFAULT 'standard', -- 'standard'|'operator'|'master'
  status            TEXT DEFAULT 'active',   -- 'active'|'blocked'|'expired'
  balance           NUMERIC(10,3),           -- for prepaid cards
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tag)
);

-- ─── ALARMS ─────────────────────────────────────────────────────────────────
CREATE TABLE alarms (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  charger_id        BIGINT NOT NULL REFERENCES chargers(id),
  connector_id      BIGINT REFERENCES connectors(id),
  error_code        TEXT NOT NULL,
  error_description TEXT,
  human_description TEXT,   -- from ALARM_CODES dictionary
  severity          TEXT DEFAULT 'warning', -- 'info'|'warning'|'critical'
  status            TEXT DEFAULT 'open',    -- 'open'|'resolved'
  occurred_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       BIGINT REFERENCES user_profiles(id)
);

-- ─── OCPP REMOTE COMMANDS ───────────────────────────────────────────────────
CREATE TABLE remote_commands (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
  charger_id        BIGINT NOT NULL REFERENCES chargers(id),
  command_type      TEXT NOT NULL,
  payload           JSONB,
  status            TEXT DEFAULT 'pending',
  response_payload  JSONB,
  created_by        BIGINT REFERENCES user_profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  executed_at       TIMESTAMPTZ
);
```

---

## Part 21: Mobile App Specifications

### 21.1 Operator App

**Purpose:** Field staff use this during their shift to monitor chargers, assist customers, and submit cash handover.

**Platform:** React Native (Expo) — iOS + Android  
**Auth:** Same Supabase Auth as web, role = `officer`

#### Screens:

```
Operator App Navigation:
├── Home (My Shift)
│   ├── Current shift info: station, start time, elapsed, session count
│   ├── Live revenue for this shift (updates via Realtime)
│   └── Quick action: Start Shift / End Shift
│
├── Chargers (Live Monitor)
│   ├── List of chargers at my station
│   ├── Each charger: status dot, connector cards
│   ├── Connector card: status, power kW, session duration
│   └── Tap → Remote Start / Remote Stop / Unlock
│
├── Sessions (Today's Sessions)
│   ├── List of sessions in my current shift
│   ├── Filter: all / active / completed
│   └── Tap → Session details (duration, kWh, amount)
│
├── Handover
│   ├── "End Shift & Submit Cash" button
│   ├── Cash denomination entry (500, 200, 100, 50, 20, 10, 5, 1, 0.5)
│   ├── Total submitted vs expected (color-coded)
│   ├── Discrepancy note (Arabic keyboard supported)
│   ├── Digital signature pad
│   └── Submit → generates PDF, notifies supervisor
│
├── Alarms
│   ├── Active alarms at my station
│   ├── Tap → acknowledge + add note
│   └── Push notification on new critical alarm
│
└── Profile
    ├── My info, language setting
    └── Logout
```

#### Key Technical Features:
- **Offline mode**: Shift and session data cached locally (SQLite via Expo SQLite or MMKV). If connectivity lost, caches locally and syncs when restored.
- **Push notifications**: Expo Push → new alarm, session started/stopped, supervisor message
- **Biometric auth**: FaceID/Fingerprint to unlock app
- **QR scanner**: Scan charger QR code to quickly navigate to that charger's control panel

### 21.2 Customer App

**Purpose:** EV drivers find charging stations, start/stop sessions, pay, and view history.

**Platform:** React Native (Expo) — iOS + Android  
**Auth:** Supabase Auth, role = `customer` — can self-register

#### Screens:

```
Customer App Navigation:
├── Map (Station Finder)
│   ├── Full-screen map (React Native Maps / Google Maps)
│   ├── Pins for all public stations (color = availability)
│   ├── Tap pin → Station card (name, available chargers, live status)
│   ├── "Navigate" → opens Google Maps / Waze
│   └── Filter: connector type, power level, available now
│
├── Charge (Active Session)
│   ├── Shown when a session is active
│   ├── Live kW, kWh, duration (via Realtime)
│   ├── Estimated cost so far
│   ├── "Stop Charging" button → sends RemoteStop command
│   └── "View Receipt" when session ends
│
├── Start Charging
│   ├── Scan QR code on charger → auto-select station + connector
│   ├── OR: select station → charger → connector manually
│   ├── Select tariff (shown with price)
│   ├── Payment method (card via Stripe/Tap, RFID, app balance)
│   └── "Start Charging" → authorization + RemoteStart
│
├── History
│   ├── List of all past sessions
│   ├── Filter: date range, station
│   ├── Tap → Session receipt with kWh, duration, amount, charger
│   └── Download PDF receipt
│
├── Wallet
│   ├── Prepaid balance
│   ├── Top-up (Stripe / Tap Payments)
│   └── Transaction history
│
├── RFID Cards
│   ├── Register RFID card
│   ├── Link/unlink cards
│   └── Set card as default
│
└── Profile
    ├── Name, email, phone, car model
    ├── Language (Arabic / English)
    └── Notification preferences
```

#### Key Technical Features:
- **QR code scan to start**: Camera permission → decode connector QR → one-tap start
- **Real-time session tracking**: Supabase Realtime subscription for live kW/kWh/cost
- **In-app payments**: Stripe (global) or Tap Payments (MENA) for card payments
- **Push notifications**: Session started, session complete with receipt, station availability alerts
- **Map clustering**: Group nearby stations at low zoom levels
- **Guest flow**: Start a session without account (pay by card), create account post-session

### 21.3 Manager App

**Purpose:** Station managers and tenant admins monitor operations, approve handovers, review reports, and manage incidents — from their phone.

**Platform:** React Native (Expo) — iOS + Android  
**Auth:** Supabase Auth, role = `tenant_admin` or `station_manager`

#### Screens:

```
Manager App Navigation:
├── Dashboard
│   ├── KPI cards: Online chargers, Active sessions, Today revenue, Alarms
│   ├── Charger status grid (colored dots, live via Realtime)
│   ├── Mini chart: sessions this week
│   └── Notification bell: pending approvals, critical alarms
│
├── Stations
│   ├── List of all stations
│   ├── Tap → Station detail: chargers, live status, today's sessions
│   └── Quick actions: Reset all, Download report
│
├── Shifts & Handover
│   ├── Active shifts: officer, start time, sessions, expected cash
│   ├── Pending approvals: submitted handovers awaiting review
│   ├── Tap → View handover details, PDF, discrepancy
│   ├── Approve / Reject with note
│   └── History: all past shifts with status
│
├── Reports
│   ├── Revenue: today / this week / this month / custom range
│   ├── Energy: kWh delivered, CO₂ avoided
│   ├── Sessions: count, average duration, peak hours
│   ├── Per station / per charger breakdown
│   └── Export: PDF or CSV via email
│
├── Alarms
│   ├── All active and resolved alarms across all stations
│   ├── Filter: station, severity, status
│   ├── Tap → assign, resolve, add note
│   └── Push: immediate alert on critical alarm
│
├── Operators (Staff)
│   ├── All operator accounts
│   ├── Approve new registrations
│   ├── Assign shifts
│   └── View operator performance (sessions per shift, discrepancies)
│
└── Settings
    ├── Station settings, tariffs, RFID cards
    ├── Subscription plan info
    └── White-label branding preview
```

### 21.4 Shared Mobile Architecture

```
Mobile Apps Shared Code:
├── packages/
│   ├── shared-types/     → TypeScript interfaces (Session, Charger, Shift, etc.)
│   ├── shared-api/       → Supabase client hooks (useSession, useCharger, etc.)
│   ├── shared-ui/        → Shared components (StatusBadge, KpiCard, etc.)
│   └── shared-utils/     → formatters, regionDetection, arabicText
│
├── apps/
│   ├── operator/         → Expo operator app
│   ├── customer/         → Expo customer app
│   ├── manager/          → Expo manager app
│   └── web/              → React + Vite web app
```

**Monorepo tool:** Turborepo or nx (preferred: Turborepo — simpler setup)

```
chargeOS/
├── apps/
│   ├── web/              (React + Vite)
│   ├── operator/         (Expo)
│   ├── customer/         (Expo)
│   └── manager/          (Expo)
├── packages/
│   ├── types/
│   ├── api-hooks/
│   ├── ui-components/
│   └── utils/
├── ocpp-server/          (Node.js)
├── supabase/
│   └── migrations/
└── turbo.json
```

### 21.5 Push Notifications Architecture

```typescript
// Expo push token stored per user device
CREATE TABLE push_tokens (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES user_profiles(id),
  tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
  expo_push_token TEXT NOT NULL,
  platform        TEXT,  -- 'ios' | 'android'
  created_at      TIMESTAMPTZ DEFAULT now()
);

// Edge Function: send push notification
// supabase/functions/send-push/index.ts
const sendPush = async (userId: number, title: string, body: string, data?: object) => {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);

  const messages = tokens.map(t => ({
    to: t.expo_push_token,
    sound: 'default',
    title,
    body,
    data,
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
};
```

---

## Part 22: Mobile-Ready Web Application

### 22.1 Responsive Design Strategy

The web app is **mobile-first** — designed to work on a 375px screen and scale up, not the other way around. All pages must be usable on a phone browser.

```
Breakpoints (Tailwind):
  sm: 640px  → tablet portrait
  md: 768px  → tablet landscape
  lg: 1024px → laptop
  xl: 1280px → desktop
  2xl: 1536px → wide desktop
```

### 22.2 Navigation on Mobile

```typescript
// Mobile: bottom navigation bar (like a native app)
// Desktop: left sidebar

const Navigation = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <BottomNav /> : <Sidebar />;
};

// Bottom nav items (mobile):
// [Dashboard] [Chargers] [Sessions] [Shifts] [More]
```

### 22.3 Mobile-Specific UI Patterns

- **Touch targets**: All buttons/taps minimum 44×44px
- **Cards instead of tables**: On mobile, data tables convert to card stacks automatically
- **Pull-to-refresh**: On mobile session and charger lists
- **Swipe actions**: Swipe left on session card → Stop Charging | Swipe right → View Details
- **Native date pickers**: Use device native date picker on mobile
- **Haptic feedback**: On successful actions (session started/stopped)
- **App install prompt**: Progressive Web App (PWA) support — "Add to Home Screen" banner

### 22.4 PWA Configuration

```json
// public/manifest.json
{
  "name": "ChargeOS",
  "short_name": "ChargeOS",
  "theme_color": "#3B82F6",
  "background_color": "#FFFFFF",
  "display": "standalone",
  "start_url": "/dashboard",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

PWA allows the web app to be installed on a phone like a native app, used as fallback for operators/managers who don't want to install from the app store.

---

## Part 23: Phase 0 — New App Bootstrap Checklist

This is the exact sequence to start the new ChargeOS app from zero:

```
Phase 0.1 — Infrastructure Setup (Day 1)
  ✓ Create new Supabase project (production-chargeOS)
  ✓ Create new Supabase project (staging-chargeOS)
  ✓ Initialize Turborepo monorepo: apps/web, apps/operator, apps/customer, apps/manager
  ✓ Configure shared packages: types, api-hooks, ui-components, utils
  ✓ Set up ocpp-server as workspace package
  ✓ Configure GitHub Actions CI: build + type-check + lint on PR
  ✓ Deploy OCPP server to Railway with multi-tenant URL schema
  ✓ Configure Railway environment variables

Phase 0.2 — Database Foundation (Day 1-2)
  ✓ Apply migration 0001: tenants, subscription_plans
  ✓ Apply migration 0002: user_profiles (integer id + UUID auth_id)
  ✓ Apply migration 0003: tenant_branding, supported_currencies
  ✓ Apply migration 0004: stations, chargers, connectors
  ✓ Apply migration 0005: tariffs, rfid_cards
  ✓ Apply migration 0006: sessions, billing_records, shifts
  ✓ Apply migration 0007: alarms, remote_commands, push_tokens
  ✓ Apply migration 0008: RLS policies — tenant_isolation on ALL tables
  ✓ Apply migration 0009: subscription plan enforcement triggers

Phase 0.3 — Auth & Tenancy (Day 2-3)
  ✓ Supabase Auth configured (email + phone OTP)
  ✓ user_profiles auto-created on auth.users INSERT (trigger)
  ✓ JWT custom claim: tenant_id injected via auth hook
  ✓ First-run wizard: creates tenant + branding + first station
  ✓ Super-admin seeded (your personal account)

Phase 0.4 — Web App Scaffold (Day 3-5)
  ✓ Vite + React + Tailwind + shadcn/ui
  ✓ White-label theme loader (CSS custom properties)
  ✓ Region auto-detection + settings
  ✓ Mobile-responsive layout (Sidebar ↔ BottomNav)
  ✓ Auth flow: login, register, approve, first-run wizard
  ✓ Dashboard skeleton with Realtime subscriptions
  ✓ PWA manifest + service worker

Phase 0.5 — OCPP Server Multi-Tenant (Day 5-6)
  ✓ Tenant resolution from URL slug + custom domain
  ✓ All DB writes include tenant_id
  ✓ Auto-discovery: BootNotification → fingerprint → create charger + connectors
  ✓ Health endpoint returns tenant connection counts

Phase 0.6 — Core Features (Week 2)
  ✓ Charger management (CRUD + live status)
  ✓ Session management (live + history)
  ✓ Tariff management
  ✓ RFID card management
  ✓ Shift + handover flow (with Arabic PDF)
  ✓ Alarm management

Phase 0.7 — Mobile Apps (Week 3-4)
  ✓ Operator app: shift home, charger monitor, handover submit
  ✓ Manager app: dashboard, approvals, reports
  ✓ Customer app: map, QR scan, session tracking, payment
  ✓ Push notifications: Expo Push setup
  ✓ Submit to App Store + Play Store (TestFlight / Internal Testing)

Phase 0.8 — SaaS Layer (Week 4-5)
  ✓ Subscription plans seeded
  ✓ Stripe integration: create customer, subscription, webhook
  ✓ Feature gate enforcement on all premium features
  ✓ Super-admin panel: tenant management, MRR dashboard
  ✓ White-label: branding editor, custom domain instructions

Phase 0.9 — First Customer Onboarding
  ✓ Create tenant for first external customer
  ✓ Onboarding email flow (welcome, charger setup guide)
  ✓ First charger connected under their tenant
  ✓ Invoice generated via Stripe
```

---

## Platform Advantages Over Any Existing System

| Feature | ChargeOS | Generic CPMS |
|---|---|---|
| **SaaS multi-tenancy** | Full tenant isolation via RLS, one instance serves unlimited customers | Single tenant or expensive enterprise |
| **White-label** | Per-tenant logo, colors, domain, app name, branded PDFs | Not available or costly add-on |
| **Monthly subscription model** | Starter / Pro / Enterprise plans, Stripe billing, feature flags | License fee or revenue share |
| **Super-admin panel** | Platform-wide health, tenant management, MRR dashboard | Not applicable |
| **Integer primary keys** | BIGSERIAL — readable IDs (1, 2, 3…), fast joins, small indexes | UUID everywhere |
| **New standalone app** | Fresh codebase, clean schema, no legacy baggage | Usually upgrades of old systems |
| **Operator mobile app** | React Native: shift home, live monitor, cash handover submission | Web-only or non-existent |
| **Customer mobile app** | Map finder, QR scan to charge, live tracking, Stripe payments | Not available in most CPMS |
| **Manager mobile app** | Live dashboard, handover approvals, reports, alarm response | Non-existent |
| **Mobile-ready web** | Mobile-first Tailwind, bottom nav on phone, PWA installable | Desktop-only or poor mobile |
| **Push notifications** | Expo Push: alarm alerts, session events, handover requests | Email only |
| **OCPP 1.6 + 1.6J + 2.0.1** | All three from day one, protocol auto-detected per charger | Usually single version |
| **Auto-discovery** | Charger plugs in → auto-fingerprinted, registered, connectors created | Manual registration always |
| **Auto region detection** | IP/GPS/locale → currency, decimals, timezone, language pre-filled | Manual config only |
| **Configurable decimal places** | 0.193 AED or 5.25 GBP — per tenant, synced to charger firmware | Fixed 2 decimal places |
| **Multi-currency** | 11+ currencies, per-tenant setting, global formatter | Single currency per install |
| **Zero-polling real-time dashboard** | All updates via Supabase Realtime WebSocket, < 1 second | Polling every 30–60s |
| **Shift-based cash handover** | Denomination tracking, digital signature, discrepancy reason | Not available |
| **Arabic PDF + RTL support** | Canvas-based shaping, correct ligatures, right-to-left layout | Rare |
| **Deep firmware intelligence** | All 50+ config keys typed, alarm codes dictionary, QR management | Generic |
| **Monorepo with shared types** | Turborepo: web + 3 mobile apps share types, hooks, components | Separate codebases |
| **Open stack, self-hostable** | Supabase + Railway, no vendor lock-in | SaaS-only |
| **Dual OCPP channel** | operation + maintenance URLs from firmware analysis | Not documented |
