/*
  # Enable Complete Shared Data Access Across All Users

  This migration updates ALL remaining Row Level Security (RLS) policies to allow all authenticated users
  to view all company data across the entire system. This is the complete solution for shared company data.
  
  ## Changes Made
  
  ### Core Data Tables
  1. **Charging Sessions** - Allow all users to view all sessions
  2. **Billing Calculations** - Allow all users to view all billing data
  3. **Billing Breakdown Items** - Allow all users to view all breakdown items
  4. **Import Batches** - Allow all users to view all import history
  5. **Rate Periods** - Allow all users to view all rate periods
  6. **Tax Configurations** - Allow all users to view all tax configs
  
  ### OCPP Infrastructure Tables
  7. **OCPP Chargers** - Allow all users to view all chargers
  8. **OCPP Connectors** - Allow all users to view all connectors
  9. **OCPP Charging Sessions** - Allow all users to view all OCPP sessions
  10. **OCPP Meter Values** - Allow all users to view all meter readings
  11. **OCPP Messages** - Allow all users to view all messages
  12. **OCPP Remote Commands** - Allow all users to view all commands
  13. **OCPP Configuration Keys** - Allow all users to view all configurations
  14. **OCPP Firmware Updates** - Allow all users to view all firmware updates
  15. **OCPP Reservations** - Allow all users to view all reservations
  16. **OCPP Charger Availability** - Allow all users to view all availability records
  
  ## Security Notes
  
  - All tables still have RLS enabled
  - Write operations (INSERT, UPDATE, DELETE) remain restricted to the user who created the record
  - Only SELECT operations are shared across all authenticated users
  - Service role maintains full access for OCPP server operations
  - Unauthenticated users still have no access to any data
*/

-- ============================================================================
-- CORE DATA TABLES
-- ============================================================================

-- Charging Sessions
DROP POLICY IF EXISTS "Users can view charging sessions for own stations" ON charging_sessions;
CREATE POLICY "All authenticated users can view all charging sessions"
  ON charging_sessions FOR SELECT TO authenticated USING (true);

-- Billing Calculations
DROP POLICY IF EXISTS "Users can view billing for own sessions" ON billing_calculations;
CREATE POLICY "All authenticated users can view all billing calculations"
  ON billing_calculations FOR SELECT TO authenticated USING (true);

-- Billing Breakdown Items
DROP POLICY IF EXISTS "Users can view breakdown items for own billing" ON billing_breakdown_items;
CREATE POLICY "All authenticated users can view all billing breakdown items"
  ON billing_breakdown_items FOR SELECT TO authenticated USING (true);

-- Import Batches
DROP POLICY IF EXISTS "Users can view own import batches" ON import_batches;
CREATE POLICY "All authenticated users can view all import batches"
  ON import_batches FOR SELECT TO authenticated USING (true);

-- Rate Periods
DROP POLICY IF EXISTS "Users can view rate periods for own rate structures" ON rate_periods;
CREATE POLICY "All authenticated users can view all rate periods"
  ON rate_periods FOR SELECT TO authenticated USING (true);

-- Tax Configurations
DROP POLICY IF EXISTS "Users can view tax configs for own stations" ON tax_configurations;
CREATE POLICY "All authenticated users can view all tax configurations"
  ON tax_configurations FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- OCPP INFRASTRUCTURE TABLES
-- ============================================================================

-- OCPP Chargers
DROP POLICY IF EXISTS "Users can view own chargers" ON ocpp_chargers;
CREATE POLICY "All authenticated users can view all ocpp chargers"
  ON ocpp_chargers FOR SELECT TO authenticated USING (true);

-- OCPP Connectors
DROP POLICY IF EXISTS "Users can view connectors of own chargers" ON ocpp_connectors;
CREATE POLICY "All authenticated users can view all ocpp connectors"
  ON ocpp_connectors FOR SELECT TO authenticated USING (true);

-- OCPP Charging Sessions
DROP POLICY IF EXISTS "Users can view sessions of own chargers" ON ocpp_charging_sessions;
CREATE POLICY "All authenticated users can view all ocpp charging sessions"
  ON ocpp_charging_sessions FOR SELECT TO authenticated USING (true);

-- OCPP Meter Values
DROP POLICY IF EXISTS "Users can view meter values of own chargers" ON ocpp_meter_values;
CREATE POLICY "All authenticated users can view all ocpp meter values"
  ON ocpp_meter_values FOR SELECT TO authenticated USING (true);

-- OCPP Messages
DROP POLICY IF EXISTS "Users can view messages of own chargers" ON ocpp_messages;
CREATE POLICY "All authenticated users can view all ocpp messages"
  ON ocpp_messages FOR SELECT TO authenticated USING (true);

-- OCPP Remote Commands
DROP POLICY IF EXISTS "Users and service can view commands" ON ocpp_remote_commands;
CREATE POLICY "All authenticated users can view all ocpp remote commands"
  ON ocpp_remote_commands FOR SELECT TO authenticated USING (true);

-- OCPP Configuration Keys
DROP POLICY IF EXISTS "Users can view config of own chargers" ON ocpp_configuration_keys;
CREATE POLICY "All authenticated users can view all ocpp configuration keys"
  ON ocpp_configuration_keys FOR SELECT TO authenticated USING (true);

-- OCPP Firmware Updates
DROP POLICY IF EXISTS "Users can view firmware updates of own chargers" ON ocpp_firmware_updates;
CREATE POLICY "All authenticated users can view all ocpp firmware updates"
  ON ocpp_firmware_updates FOR SELECT TO authenticated USING (true);

-- OCPP Reservations
DROP POLICY IF EXISTS "Users can view reservations of own chargers" ON ocpp_reservations;
CREATE POLICY "All authenticated users can view all ocpp reservations"
  ON ocpp_reservations FOR SELECT TO authenticated USING (true);

-- OCPP Charger Availability
DROP POLICY IF EXISTS "Users can view availability of own chargers" ON ocpp_charger_availability;
CREATE POLICY "All authenticated users can view all ocpp charger availability"
  ON ocpp_charger_availability FOR SELECT TO authenticated USING (true);