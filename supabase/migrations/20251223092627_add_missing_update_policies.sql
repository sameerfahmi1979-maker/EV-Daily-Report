/*
  # Add Missing UPDATE Policies

  This migration adds missing UPDATE policies for tables that only had
  SELECT, INSERT, and DELETE policies.

  ## Tables Fixed

  1. **ocpp_messages** - Missing UPDATE policy for authenticated users
  2. **ocpp_meter_values** - Missing UPDATE policy for authenticated users

  ## Changes Made

  - Add UPDATE policy for ocpp_messages allowing all authenticated users
  - Add UPDATE policy for ocpp_meter_values allowing all authenticated users

  ## Result

  All 20 tables now have complete CRUD policies (SELECT, INSERT, UPDATE, DELETE)
  for all authenticated users with no restrictions.
*/

-- Add UPDATE policy for ocpp_messages
CREATE POLICY "All authenticated users can update ocpp messages"
  ON ocpp_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Add UPDATE policy for ocpp_meter_values
CREATE POLICY "All authenticated users can update ocpp meter values"
  ON ocpp_meter_values FOR UPDATE TO authenticated USING (true) WITH CHECK (true);