/*
  # Fix OCPP RLS Policies for Service Role Access

  ## Changes Made
  
  1. **Make user_id Nullable**: Allow OCPP server to create chargers without user_id
  2. **Add Service Role Policies**: Explicit policies for service role to bypass user ownership checks
  3. **Enable Direct OCPP Server Access**: Allow the OCPP server to write data using service role key
  
  ## Tables Updated
  - `ocpp_chargers` - Made user_id nullable, added service_role policies
  - `ocpp_connectors` - Added service_role policies  
  - `ocpp_charging_sessions` - Added service_role policies
  - `ocpp_meter_values` - Added service_role policies
  - `ocpp_messages` - Added service_role policies
  - `ocpp_configuration_keys` - Added service_role policies
  - `ocpp_firmware_updates` - Added service_role policies
  - `ocpp_reservations` - Added service_role policies
  - `ocpp_charger_availability` - Added service_role policies
  
  ## Security Notes
  - Service role has full access (needed for OCPP server operations)
  - Authenticated users still restricted to their own chargers
  - Chargers can now be created without user_id (for direct OCPP connections)
  - User_id can be assigned later when linking chargers to users in the dashboard
*/

-- Make user_id nullable in ocpp_chargers (chargers can be registered via OCPP before being assigned to users)
ALTER TABLE ocpp_chargers ALTER COLUMN user_id DROP NOT NULL;

-- Add service_role policies for all OCPP tables
-- These policies allow the OCPP server (using service role key) to perform all operations

-- ocpp_chargers service role policies
CREATE POLICY "Service role has full access to chargers"
  ON ocpp_chargers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_connectors service role policies
CREATE POLICY "Service role has full access to connectors"
  ON ocpp_connectors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_charging_sessions service role policies
CREATE POLICY "Service role has full access to sessions"
  ON ocpp_charging_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_meter_values service role policies
CREATE POLICY "Service role has full access to meter values"
  ON ocpp_meter_values FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_messages service role policies
CREATE POLICY "Service role has full access to messages"
  ON ocpp_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_remote_commands: Update existing policies to allow NULL user_id for service role
DROP POLICY IF EXISTS "Users can insert own commands" ON ocpp_remote_commands;
CREATE POLICY "Users and service can insert commands"
  ON ocpp_remote_commands FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own commands" ON ocpp_remote_commands;
CREATE POLICY "Users and service can view commands"
  ON ocpp_remote_commands FOR SELECT
  TO authenticated, service_role
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update own commands" ON ocpp_remote_commands;
CREATE POLICY "Users and service can update commands"
  ON ocpp_remote_commands FOR UPDATE
  TO authenticated, service_role
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can delete own commands" ON ocpp_remote_commands;
CREATE POLICY "Users and service can delete commands"
  ON ocpp_remote_commands FOR DELETE
  TO authenticated, service_role
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- ocpp_configuration_keys service role policies
CREATE POLICY "Service role has full access to config keys"
  ON ocpp_configuration_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_firmware_updates service role policies
CREATE POLICY "Service role has full access to firmware updates"
  ON ocpp_firmware_updates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_reservations service role policies
CREATE POLICY "Service role has full access to reservations"
  ON ocpp_reservations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ocpp_charger_availability service role policies
CREATE POLICY "Service role has full access to availability"
  ON ocpp_charger_availability FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update existing authenticated user policies to handle NULL user_id
DROP POLICY IF EXISTS "Users can view own chargers" ON ocpp_chargers;
CREATE POLICY "Users can view own chargers"
  ON ocpp_chargers FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chargers" ON ocpp_chargers;
CREATE POLICY "Users can update own chargers"
  ON ocpp_chargers FOR UPDATE
  TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chargers" ON ocpp_chargers;
CREATE POLICY "Users can delete own chargers"
  ON ocpp_chargers FOR DELETE
  TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chargers" ON ocpp_chargers;
CREATE POLICY "Users can insert own chargers"
  ON ocpp_chargers FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);
