/*
  # Enable Full Authenticated Access to All Tables

  ## Overview
  This migration provides all authenticated users with complete access to all data across all tables.
  This ensures that any authenticated user can view, create, modify, and delete any records regardless of ownership.

  ## Changes Made

  ### Policy Updates for All Tables
  For each table, this migration:
  1. Drops all existing restrictive RLS policies
  2. Creates 4 simple policies (SELECT, INSERT, UPDATE, DELETE)
  3. Each policy only requires authentication - no ownership or user_id checks

  ### Tables Affected
  - stations
  - rate_structures
  - rate_periods
  - import_batches
  - charging_sessions
  - billing_calculations
  - billing_breakdown_items
  - fixed_charges
  - tax_configurations
  - operators
  - ocpp_chargers
  - ocpp_connectors
  - ocpp_charging_sessions
  - ocpp_meter_values
  - ocpp_messages
  - ocpp_remote_commands
  - ocpp_configuration_keys
  - ocpp_firmware_updates
  - ocpp_reservations
  - ocpp_charger_availability

  ## Security Model
  - All authenticated users have full read/write access to all tables
  - No user_id filtering or ownership restrictions
  - Designed for collaborative environments where all users need access to all data
*/

-- ============================================================================
-- STATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all stations" ON stations;
DROP POLICY IF EXISTS "Authenticated users can insert stations" ON stations;
DROP POLICY IF EXISTS "Authenticated users can update stations" ON stations;
DROP POLICY IF EXISTS "Authenticated users can delete stations" ON stations;
DROP POLICY IF EXISTS "Users can view their own stations" ON stations;
DROP POLICY IF EXISTS "Users can create stations" ON stations;
DROP POLICY IF EXISTS "Users can update their own stations" ON stations;
DROP POLICY IF EXISTS "Users can delete their own stations" ON stations;

CREATE POLICY "Authenticated users can view all stations"
  ON stations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stations"
  ON stations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stations"
  ON stations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete stations"
  ON stations FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- RATE_STRUCTURES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all rate_structures" ON rate_structures;
DROP POLICY IF EXISTS "Authenticated users can insert rate_structures" ON rate_structures;
DROP POLICY IF EXISTS "Authenticated users can update rate_structures" ON rate_structures;
DROP POLICY IF EXISTS "Authenticated users can delete rate_structures" ON rate_structures;

CREATE POLICY "Authenticated users can view all rate_structures"
  ON rate_structures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rate_structures"
  ON rate_structures FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rate_structures"
  ON rate_structures FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete rate_structures"
  ON rate_structures FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- RATE_PERIODS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all rate_periods" ON rate_periods;
DROP POLICY IF EXISTS "Authenticated users can insert rate_periods" ON rate_periods;
DROP POLICY IF EXISTS "Authenticated users can update rate_periods" ON rate_periods;
DROP POLICY IF EXISTS "Authenticated users can delete rate_periods" ON rate_periods;

CREATE POLICY "Authenticated users can view all rate_periods"
  ON rate_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rate_periods"
  ON rate_periods FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rate_periods"
  ON rate_periods FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete rate_periods"
  ON rate_periods FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- IMPORT_BATCHES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all import_batches" ON import_batches;
DROP POLICY IF EXISTS "Authenticated users can insert import_batches" ON import_batches;
DROP POLICY IF EXISTS "Authenticated users can update import_batches" ON import_batches;
DROP POLICY IF EXISTS "Authenticated users can delete import_batches" ON import_batches;

CREATE POLICY "Authenticated users can view all import_batches"
  ON import_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert import_batches"
  ON import_batches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update import_batches"
  ON import_batches FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete import_batches"
  ON import_batches FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- CHARGING_SESSIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all charging_sessions" ON charging_sessions;
DROP POLICY IF EXISTS "Authenticated users can insert charging_sessions" ON charging_sessions;
DROP POLICY IF EXISTS "Authenticated users can update charging_sessions" ON charging_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete charging_sessions" ON charging_sessions;

CREATE POLICY "Authenticated users can view all charging_sessions"
  ON charging_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert charging_sessions"
  ON charging_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update charging_sessions"
  ON charging_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete charging_sessions"
  ON charging_sessions FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- BILLING_CALCULATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all billing_calculations" ON billing_calculations;
DROP POLICY IF EXISTS "Authenticated users can insert billing_calculations" ON billing_calculations;
DROP POLICY IF EXISTS "Authenticated users can update billing_calculations" ON billing_calculations;
DROP POLICY IF EXISTS "Authenticated users can delete billing_calculations" ON billing_calculations;

CREATE POLICY "Authenticated users can view all billing_calculations"
  ON billing_calculations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert billing_calculations"
  ON billing_calculations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update billing_calculations"
  ON billing_calculations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete billing_calculations"
  ON billing_calculations FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- BILLING_BREAKDOWN_ITEMS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all billing_breakdown_items" ON billing_breakdown_items;
DROP POLICY IF EXISTS "Authenticated users can insert billing_breakdown_items" ON billing_breakdown_items;
DROP POLICY IF EXISTS "Authenticated users can update billing_breakdown_items" ON billing_breakdown_items;
DROP POLICY IF EXISTS "Authenticated users can delete billing_breakdown_items" ON billing_breakdown_items;

CREATE POLICY "Authenticated users can view all billing_breakdown_items"
  ON billing_breakdown_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert billing_breakdown_items"
  ON billing_breakdown_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update billing_breakdown_items"
  ON billing_breakdown_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete billing_breakdown_items"
  ON billing_breakdown_items FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- FIXED_CHARGES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all fixed_charges" ON fixed_charges;
DROP POLICY IF EXISTS "Authenticated users can insert fixed_charges" ON fixed_charges;
DROP POLICY IF EXISTS "Authenticated users can update fixed_charges" ON fixed_charges;
DROP POLICY IF EXISTS "Authenticated users can delete fixed_charges" ON fixed_charges;

CREATE POLICY "Authenticated users can view all fixed_charges"
  ON fixed_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fixed_charges"
  ON fixed_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fixed_charges"
  ON fixed_charges FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete fixed_charges"
  ON fixed_charges FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- TAX_CONFIGURATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all tax_configurations" ON tax_configurations;
DROP POLICY IF EXISTS "Authenticated users can insert tax_configurations" ON tax_configurations;
DROP POLICY IF EXISTS "Authenticated users can update tax_configurations" ON tax_configurations;
DROP POLICY IF EXISTS "Authenticated users can delete tax_configurations" ON tax_configurations;

CREATE POLICY "Authenticated users can view all tax_configurations"
  ON tax_configurations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tax_configurations"
  ON tax_configurations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tax_configurations"
  ON tax_configurations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tax_configurations"
  ON tax_configurations FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OPERATORS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all operators" ON operators;
DROP POLICY IF EXISTS "Authenticated users can insert operators" ON operators;
DROP POLICY IF EXISTS "Authenticated users can update operators" ON operators;
DROP POLICY IF EXISTS "Authenticated users can delete operators" ON operators;

CREATE POLICY "Authenticated users can view all operators"
  ON operators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert operators"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete operators"
  ON operators FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_CHARGERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_chargers" ON ocpp_chargers;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_chargers" ON ocpp_chargers;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_chargers" ON ocpp_chargers;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_chargers" ON ocpp_chargers;
DROP POLICY IF EXISTS "Service role can manage all ocpp_chargers" ON ocpp_chargers;

CREATE POLICY "Authenticated users can view all ocpp_chargers"
  ON ocpp_chargers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_chargers"
  ON ocpp_chargers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_chargers"
  ON ocpp_chargers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_chargers"
  ON ocpp_chargers FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_CONNECTORS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_connectors" ON ocpp_connectors;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_connectors" ON ocpp_connectors;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_connectors" ON ocpp_connectors;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_connectors" ON ocpp_connectors;
DROP POLICY IF EXISTS "Service role can manage all ocpp_connectors" ON ocpp_connectors;

CREATE POLICY "Authenticated users can view all ocpp_connectors"
  ON ocpp_connectors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_connectors"
  ON ocpp_connectors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_connectors"
  ON ocpp_connectors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_connectors"
  ON ocpp_connectors FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_CHARGING_SESSIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_charging_sessions" ON ocpp_charging_sessions;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_charging_sessions" ON ocpp_charging_sessions;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_charging_sessions" ON ocpp_charging_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_charging_sessions" ON ocpp_charging_sessions;
DROP POLICY IF EXISTS "Service role can manage all ocpp_charging_sessions" ON ocpp_charging_sessions;

CREATE POLICY "Authenticated users can view all ocpp_charging_sessions"
  ON ocpp_charging_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_charging_sessions"
  ON ocpp_charging_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_charging_sessions"
  ON ocpp_charging_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_charging_sessions"
  ON ocpp_charging_sessions FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_METER_VALUES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_meter_values" ON ocpp_meter_values;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_meter_values" ON ocpp_meter_values;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_meter_values" ON ocpp_meter_values;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_meter_values" ON ocpp_meter_values;
DROP POLICY IF EXISTS "Service role can manage all ocpp_meter_values" ON ocpp_meter_values;

CREATE POLICY "Authenticated users can view all ocpp_meter_values"
  ON ocpp_meter_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_meter_values"
  ON ocpp_meter_values FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_meter_values"
  ON ocpp_meter_values FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_meter_values"
  ON ocpp_meter_values FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_MESSAGES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_messages" ON ocpp_messages;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_messages" ON ocpp_messages;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_messages" ON ocpp_messages;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_messages" ON ocpp_messages;
DROP POLICY IF EXISTS "Service role can manage all ocpp_messages" ON ocpp_messages;

CREATE POLICY "Authenticated users can view all ocpp_messages"
  ON ocpp_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_messages"
  ON ocpp_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_messages"
  ON ocpp_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_messages"
  ON ocpp_messages FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_REMOTE_COMMANDS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_remote_commands" ON ocpp_remote_commands;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_remote_commands" ON ocpp_remote_commands;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_remote_commands" ON ocpp_remote_commands;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_remote_commands" ON ocpp_remote_commands;

CREATE POLICY "Authenticated users can view all ocpp_remote_commands"
  ON ocpp_remote_commands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_remote_commands"
  ON ocpp_remote_commands FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_remote_commands"
  ON ocpp_remote_commands FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_remote_commands"
  ON ocpp_remote_commands FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_CONFIGURATION_KEYS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_configuration_keys" ON ocpp_configuration_keys;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_configuration_keys" ON ocpp_configuration_keys;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_configuration_keys" ON ocpp_configuration_keys;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_configuration_keys" ON ocpp_configuration_keys;
DROP POLICY IF EXISTS "Service role can manage all ocpp_configuration_keys" ON ocpp_configuration_keys;

CREATE POLICY "Authenticated users can view all ocpp_configuration_keys"
  ON ocpp_configuration_keys FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_configuration_keys"
  ON ocpp_configuration_keys FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_configuration_keys"
  ON ocpp_configuration_keys FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_configuration_keys"
  ON ocpp_configuration_keys FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_FIRMWARE_UPDATES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_firmware_updates" ON ocpp_firmware_updates;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_firmware_updates" ON ocpp_firmware_updates;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_firmware_updates" ON ocpp_firmware_updates;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_firmware_updates" ON ocpp_firmware_updates;
DROP POLICY IF EXISTS "Service role can manage all ocpp_firmware_updates" ON ocpp_firmware_updates;

CREATE POLICY "Authenticated users can view all ocpp_firmware_updates"
  ON ocpp_firmware_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_firmware_updates"
  ON ocpp_firmware_updates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_firmware_updates"
  ON ocpp_firmware_updates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_firmware_updates"
  ON ocpp_firmware_updates FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_RESERVATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_reservations" ON ocpp_reservations;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_reservations" ON ocpp_reservations;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_reservations" ON ocpp_reservations;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_reservations" ON ocpp_reservations;
DROP POLICY IF EXISTS "Service role can manage all ocpp_reservations" ON ocpp_reservations;

CREATE POLICY "Authenticated users can view all ocpp_reservations"
  ON ocpp_reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_reservations"
  ON ocpp_reservations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_reservations"
  ON ocpp_reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_reservations"
  ON ocpp_reservations FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- OCPP_CHARGER_AVAILABILITY TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view all ocpp_charger_availability" ON ocpp_charger_availability;
DROP POLICY IF EXISTS "Authenticated users can insert ocpp_charger_availability" ON ocpp_charger_availability;
DROP POLICY IF EXISTS "Authenticated users can update ocpp_charger_availability" ON ocpp_charger_availability;
DROP POLICY IF EXISTS "Authenticated users can delete ocpp_charger_availability" ON ocpp_charger_availability;

CREATE POLICY "Authenticated users can view all ocpp_charger_availability"
  ON ocpp_charger_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ocpp_charger_availability"
  ON ocpp_charger_availability FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocpp_charger_availability"
  ON ocpp_charger_availability FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ocpp_charger_availability"
  ON ocpp_charger_availability FOR DELETE
  TO authenticated
  USING (true);