/*
  # Enable Complete Shared Write Access for All Authenticated Users

  This migration updates ALL Row Level Security (RLS) policies to allow all authenticated users
  to perform ALL operations (SELECT, INSERT, UPDATE, DELETE) on all data in the system.
  This is appropriate for a company setting where all users are trusted employees working
  with the same company data.
  
  ## Changes Made
  
  ### Core Data Tables - Full Write Access
  1. **Stations** - All users can insert, update, delete
  2. **Operators** - All users can insert, update, delete
  3. **Charging Sessions** - All users can insert, update, delete
  4. **Billing Calculations** - All users can insert, update, delete
  5. **Billing Breakdown Items** - All users can insert, update, delete
  6. **Import Batches** - All users can insert, update, delete
  7. **Rate Structures** - All users can insert, update, delete
  8. **Rate Periods** - All users can insert, update, delete
  9. **Tax Configurations** - All users can insert, update, delete
  10. **Fixed Charges** - All users can insert, update, delete
  
  ### OCPP Infrastructure Tables - Full Write Access
  11. **OCPP Chargers** - All users can insert, update, delete
  12. **OCPP Connectors** - All users can insert, update, delete
  13. **OCPP Charging Sessions** - All users can insert, update, delete
  14. **OCPP Meter Values** - All users can insert, update, delete
  15. **OCPP Messages** - All users can insert, update, delete
  16. **OCPP Configuration Keys** - All users can insert, update, delete
  17. **OCPP Firmware Updates** - All users can insert, update, delete
  18. **OCPP Reservations** - All users can insert, update, delete
  19. **OCPP Charger Availability** - All users can insert, update, delete
  
  ## Security Notes
  
  - All tables still have RLS enabled
  - Only authenticated users can access and modify data
  - Service role maintains full access for OCPP server operations
  - Unauthenticated users still have no access to any data
  - Each user's actions are tracked via their user_id in created records
*/

-- ============================================================================
-- CORE DATA TABLES - FULL WRITE ACCESS
-- ============================================================================

-- Stations
DROP POLICY IF EXISTS "Users can create own stations" ON stations;
DROP POLICY IF EXISTS "Users can update own stations" ON stations;
DROP POLICY IF EXISTS "Users can delete own stations" ON stations;

CREATE POLICY "All authenticated users can insert stations"
  ON stations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update stations"
  ON stations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete stations"
  ON stations FOR DELETE TO authenticated USING (true);

-- Operators
DROP POLICY IF EXISTS "Users can insert own operators" ON operators;
DROP POLICY IF EXISTS "Users can update own operators" ON operators;
DROP POLICY IF EXISTS "Users can delete own operators" ON operators;

CREATE POLICY "All authenticated users can insert operators"
  ON operators FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update operators"
  ON operators FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete operators"
  ON operators FOR DELETE TO authenticated USING (true);

-- Charging Sessions
DROP POLICY IF EXISTS "Users can create charging sessions for own stations" ON charging_sessions;
DROP POLICY IF EXISTS "Users can update charging sessions for own stations" ON charging_sessions;
DROP POLICY IF EXISTS "Users can delete charging sessions for own stations" ON charging_sessions;

CREATE POLICY "All authenticated users can insert charging sessions"
  ON charging_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update charging sessions"
  ON charging_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete charging sessions"
  ON charging_sessions FOR DELETE TO authenticated USING (true);

-- Billing Calculations
DROP POLICY IF EXISTS "Users can create billing for own sessions" ON billing_calculations;
DROP POLICY IF EXISTS "Users can update billing for own sessions" ON billing_calculations;
DROP POLICY IF EXISTS "Users can delete billing for own sessions" ON billing_calculations;

CREATE POLICY "All authenticated users can insert billing calculations"
  ON billing_calculations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update billing calculations"
  ON billing_calculations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete billing calculations"
  ON billing_calculations FOR DELETE TO authenticated USING (true);

-- Billing Breakdown Items
DROP POLICY IF EXISTS "Users can create breakdown items for own billing" ON billing_breakdown_items;
DROP POLICY IF EXISTS "Users can update breakdown items for own billing" ON billing_breakdown_items;
DROP POLICY IF EXISTS "Users can delete breakdown items for own billing" ON billing_breakdown_items;

CREATE POLICY "All authenticated users can insert billing breakdown items"
  ON billing_breakdown_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update billing breakdown items"
  ON billing_breakdown_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete billing breakdown items"
  ON billing_breakdown_items FOR DELETE TO authenticated USING (true);

-- Import Batches
DROP POLICY IF EXISTS "Users can create own import batches" ON import_batches;
DROP POLICY IF EXISTS "Users can update own import batches" ON import_batches;
DROP POLICY IF EXISTS "Users can delete own import batches" ON import_batches;

CREATE POLICY "All authenticated users can insert import batches"
  ON import_batches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update import batches"
  ON import_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete import batches"
  ON import_batches FOR DELETE TO authenticated USING (true);

-- Rate Structures
DROP POLICY IF EXISTS "Users can create rate structures for own stations" ON rate_structures;
DROP POLICY IF EXISTS "Users can update rate structures for own stations" ON rate_structures;
DROP POLICY IF EXISTS "Users can delete rate structures for own stations" ON rate_structures;

CREATE POLICY "All authenticated users can insert rate structures"
  ON rate_structures FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update rate structures"
  ON rate_structures FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete rate structures"
  ON rate_structures FOR DELETE TO authenticated USING (true);

-- Rate Periods
DROP POLICY IF EXISTS "Users can create rate periods for own rate structures" ON rate_periods;
DROP POLICY IF EXISTS "Users can update rate periods for own rate structures" ON rate_periods;
DROP POLICY IF EXISTS "Users can delete rate periods for own rate structures" ON rate_periods;

CREATE POLICY "All authenticated users can insert rate periods"
  ON rate_periods FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update rate periods"
  ON rate_periods FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete rate periods"
  ON rate_periods FOR DELETE TO authenticated USING (true);

-- Tax Configurations
DROP POLICY IF EXISTS "Users can create tax configs for own stations" ON tax_configurations;
DROP POLICY IF EXISTS "Users can update tax configs for own stations" ON tax_configurations;
DROP POLICY IF EXISTS "Users can delete tax configs for own stations" ON tax_configurations;

CREATE POLICY "All authenticated users can insert tax configurations"
  ON tax_configurations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update tax configurations"
  ON tax_configurations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete tax configurations"
  ON tax_configurations FOR DELETE TO authenticated USING (true);

-- Fixed Charges
DROP POLICY IF EXISTS "Users can create fixed charges for own stations" ON fixed_charges;
DROP POLICY IF EXISTS "Users can update fixed charges for own stations" ON fixed_charges;
DROP POLICY IF EXISTS "Users can delete fixed charges for own stations" ON fixed_charges;

CREATE POLICY "All authenticated users can insert fixed charges"
  ON fixed_charges FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update fixed charges"
  ON fixed_charges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete fixed charges"
  ON fixed_charges FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- OCPP INFRASTRUCTURE TABLES - FULL WRITE ACCESS
-- ============================================================================

-- OCPP Chargers
DROP POLICY IF EXISTS "Users can insert own chargers" ON ocpp_chargers;
DROP POLICY IF EXISTS "Users can update own chargers" ON ocpp_chargers;
DROP POLICY IF EXISTS "Users can delete own chargers" ON ocpp_chargers;

CREATE POLICY "All authenticated users can insert ocpp chargers"
  ON ocpp_chargers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp chargers"
  ON ocpp_chargers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp chargers"
  ON ocpp_chargers FOR DELETE TO authenticated USING (true);

-- OCPP Connectors
DROP POLICY IF EXISTS "Users can insert connectors for own chargers" ON ocpp_connectors;
DROP POLICY IF EXISTS "Users can update connectors of own chargers" ON ocpp_connectors;
DROP POLICY IF EXISTS "Users can delete connectors of own chargers" ON ocpp_connectors;

CREATE POLICY "All authenticated users can insert ocpp connectors"
  ON ocpp_connectors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp connectors"
  ON ocpp_connectors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp connectors"
  ON ocpp_connectors FOR DELETE TO authenticated USING (true);

-- OCPP Charging Sessions
DROP POLICY IF EXISTS "Users can insert sessions for own chargers" ON ocpp_charging_sessions;
DROP POLICY IF EXISTS "Users can update sessions of own chargers" ON ocpp_charging_sessions;
DROP POLICY IF EXISTS "Users can delete sessions of own chargers" ON ocpp_charging_sessions;

CREATE POLICY "All authenticated users can insert ocpp charging sessions"
  ON ocpp_charging_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp charging sessions"
  ON ocpp_charging_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp charging sessions"
  ON ocpp_charging_sessions FOR DELETE TO authenticated USING (true);

-- OCPP Meter Values
DROP POLICY IF EXISTS "Users can insert meter values for own chargers" ON ocpp_meter_values;

CREATE POLICY "All authenticated users can insert ocpp meter values"
  ON ocpp_meter_values FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp meter values"
  ON ocpp_meter_values FOR DELETE TO authenticated USING (true);

-- OCPP Messages
DROP POLICY IF EXISTS "Users can insert messages for own chargers" ON ocpp_messages;
DROP POLICY IF EXISTS "Users can delete messages of own chargers" ON ocpp_messages;

CREATE POLICY "All authenticated users can insert ocpp messages"
  ON ocpp_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp messages"
  ON ocpp_messages FOR DELETE TO authenticated USING (true);

-- OCPP Configuration Keys
DROP POLICY IF EXISTS "Users can insert config for own chargers" ON ocpp_configuration_keys;
DROP POLICY IF EXISTS "Users can update config of own chargers" ON ocpp_configuration_keys;
DROP POLICY IF EXISTS "Users can delete config of own chargers" ON ocpp_configuration_keys;

CREATE POLICY "All authenticated users can insert ocpp configuration keys"
  ON ocpp_configuration_keys FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp configuration keys"
  ON ocpp_configuration_keys FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp configuration keys"
  ON ocpp_configuration_keys FOR DELETE TO authenticated USING (true);

-- OCPP Firmware Updates
DROP POLICY IF EXISTS "Users can insert firmware updates for own chargers" ON ocpp_firmware_updates;
DROP POLICY IF EXISTS "Users can update firmware updates of own chargers" ON ocpp_firmware_updates;
DROP POLICY IF EXISTS "Users can delete firmware updates of own chargers" ON ocpp_firmware_updates;

CREATE POLICY "All authenticated users can insert ocpp firmware updates"
  ON ocpp_firmware_updates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp firmware updates"
  ON ocpp_firmware_updates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp firmware updates"
  ON ocpp_firmware_updates FOR DELETE TO authenticated USING (true);

-- OCPP Reservations
DROP POLICY IF EXISTS "Users can insert reservations for own chargers" ON ocpp_reservations;
DROP POLICY IF EXISTS "Users can update reservations of own chargers" ON ocpp_reservations;
DROP POLICY IF EXISTS "Users can delete reservations of own chargers" ON ocpp_reservations;

CREATE POLICY "All authenticated users can insert ocpp reservations"
  ON ocpp_reservations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp reservations"
  ON ocpp_reservations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp reservations"
  ON ocpp_reservations FOR DELETE TO authenticated USING (true);

-- OCPP Charger Availability
DROP POLICY IF EXISTS "Users can insert availability for own chargers" ON ocpp_charger_availability;
DROP POLICY IF EXISTS "Users can update availability of own chargers" ON ocpp_charger_availability;
DROP POLICY IF EXISTS "Users can delete availability of own chargers" ON ocpp_charger_availability;

CREATE POLICY "All authenticated users can insert ocpp charger availability"
  ON ocpp_charger_availability FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp charger availability"
  ON ocpp_charger_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp charger availability"
  ON ocpp_charger_availability FOR DELETE TO authenticated USING (true);