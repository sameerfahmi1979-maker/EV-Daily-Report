/*
  # Fix Charging Sessions Unique Constraints
  
  This migration removes the incorrect unique constraint on transaction_id
  and ensures only charge_id remains unique.
  
  ## Problem
  - Both transaction_id and charge_id had unique constraints
  - This prevented re-importing the same file even when charge_ids were duplicates
  - Transaction IDs can legitimately repeat (same transaction, different charges)
  
  ## Changes
  1. Drop the unique constraint on transaction_id
  2. Keep the unique constraint on charge_id (correct behavior)
  
  ## Result
  - Only charge_id must be unique
  - Same charge cannot be imported twice
  - But same transaction can have multiple charge records
  
  ## Notes
  - This allows the import process to detect duplicates by charge_id only
  - Import logic will be updated to skip existing charge_ids gracefully
*/

-- Drop the unique constraint on transaction_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' 
    AND constraint_name = 'charging_sessions_transaction_id_key'
  ) THEN
    ALTER TABLE charging_sessions DROP CONSTRAINT charging_sessions_transaction_id_key;
  END IF;
END $$;

-- Verify charge_id unique constraint still exists (should already be there)
-- This is just a safety check, not creating a new constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' 
    AND constraint_name = 'charging_sessions_charge_id_key'
  ) THEN
    -- If for some reason it doesn't exist, create it
    ALTER TABLE charging_sessions ADD CONSTRAINT charging_sessions_charge_id_key UNIQUE (charge_id);
  END IF;
END $$;
