# EV-A2 Role Mapping (pre-migration)

**Inventory date:** 2026-07-16  
**Environment:** `https://qflxupfeyktdrpilctyo.supabase.co`  
**Live apply status:** NOT APPLIED — awaiting disposable/staging environment

## Current users (`user_profiles`)

| Email | Current role | Active | Station | Proposed role | Proposed approval |
|---|---|---|---|---|---|
| sameer@algt.net | `global_admin` | true | null | `system_admin` | `approved` |
| sameer@energy-stream.net | `global_admin` | true | null | `system_admin` | `approved` |
| tariq@energy-stream.net | `global_admin` | true | null | `system_admin` | `approved` |

`auth.users` count: **3** (matches profiles).

## Role mapping table

| Legacy role | Target A2 role | Notes |
|---|---|---|
| `global_admin` | `system_admin` | Exact match for 3 live users |
| `company_manager` | `operations_manager` | None currently in DB |
| `station_manager` | `station_manager` | Unchanged name |
| `accountant` | `accountant` | Unchanged name |
| _(new)_ | `import_officer` | New role |
| _(new)_ | `report_viewer` | New role; default for newly registered pending users |
| Unknown values | preserve + flag | Do not auto-grant broad access |

## Station access

| Station ID | Name | Code |
|---|---|---|
| `48f00127-09e8-47f6-8f6a-c3a331b332be` | Ein al basha | STATION-1 |

**Model:** `user_station_access` join table (supports multi-station).  
**Backfill plan:** grant all three system admins active access to `STATION-1` (and any future stations via admin UI).  
Legacy `user_profiles.station_id` retained for compatibility; join table is authoritative for scope checks after migration.

## Lockout prevention

Before enforcing RLS/approval:

1. Confirm the three `system_admin` rows are `approval_status = approved` and `is_active = true`.
2. Confirm at least one admin can `SELECT`/`UPDATE` `user_profiles`.
3. Do not approve unknown future users automatically.
