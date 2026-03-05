/*
  # Fix Remaining Restrictive RLS Policies

  This migration removes the last remaining restrictive RLS policies to ensure
  ALL authenticated users have COMPLETE access to ALL data.

  ## Issues Found

  1. **ocpp_meter_values** - Had an old restrictive DELETE policy that checked user ownership
  2. **ocpp_remote_commands** - Had restrictive INSERT, UPDATE, DELETE policies that checked user_id

  ## Changes Made

  ### ocpp_meter_values Table
  - Remove old restrictive DELETE policy "Users can delete meter values of own chargers"
  - The unrestricted policy "All authenticated users can delete ocpp meter values" already exists

  ### ocpp_remote_commands Table
  - Replace restrictive INSERT policy with unrestricted access
  - Replace restrictive UPDATE policy with unrestricted access
  - Replace restrictive DELETE policy with unrestricted access
  - All authenticated users can now INSERT, UPDATE, DELETE any remote command

  ## Result

  After this migration, ALL authenticated users can:
  - View all data in all tables (SELECT)
  - Create new records in all tables (INSERT)
  - Modify any existing records (UPDATE)
  - Delete any records (DELETE)

  This is appropriate for a company environment where all users are trusted employees
  working with shared company data.
*/

-- ============================================================================
-- FIX ocpp_meter_values - Remove old restrictive policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete meter values of own chargers" ON ocpp_meter_values;

-- Note: The unrestricted policy "All authenticated users can delete ocpp meter values" already exists

-- ============================================================================
-- FIX ocpp_remote_commands - Replace all restrictive policies
-- ============================================================================

DROP POLICY IF EXISTS "Users and service can insert commands" ON ocpp_remote_commands;
DROP POLICY IF EXISTS "Users and service can update commands" ON ocpp_remote_commands;
DROP POLICY IF EXISTS "Users and service can delete commands" ON ocpp_remote_commands;

-- Create unrestricted policies for all operations
CREATE POLICY "All authenticated users can insert ocpp remote commands"
  ON ocpp_remote_commands FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update ocpp remote commands"
  ON ocpp_remote_commands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete ocpp remote commands"
  ON ocpp_remote_commands FOR DELETE TO authenticated USING (true);

-- Service role policy for ocpp_remote_commands is still needed for OCPP server
CREATE POLICY "Service role has full access to remote commands"
  ON ocpp_remote_commands FOR ALL TO service_role USING (true) WITH CHECK (true);