/*
  # Make Transaction ID the Only Unique Field
  
  This migration reverses the previous constraint logic to make transaction_id
  the ONLY unique field in charging_sessions table, allowing all other columns
  including charge_id to contain duplicate values.
  
  ## Changes Made
  
  1. **Drop charge_id unique constraint**
     - Removes the charging_sessions_charge_id_key constraint
     - Allows multiple records with the same charge_id
  
  2. **Add transaction_id unique constraint**
     - Creates charging_sessions_transaction_id_key constraint
     - Makes transaction_id the only unique identifier for charging sessions
  
  3. **Add performance indexes**
     - Creates idx_charging_sessions_charge_id for query performance on charge_id
     - Creates idx_charging_sessions_created_at for sorting duplicate entries
  
  ## Purpose
  
  - Allow importing charging data that may contain duplicate charge_ids
  - Ensure transaction_id uniqueness as the true unique identifier from equipment
  - Enable full data import without duplicate charge_id errors
  - Maintain query performance with appropriate indexes
  
  ## Security
  
  - No RLS policy changes required
  - All existing policies remain functional
  - Users continue to access only their own charging sessions
  
  ## Notes
  
  - charge_id can now have duplicate values across multiple records
  - transaction_id must remain unique across all records
  - The import process will skip only duplicate transaction_ids
  - All other validations (required fields, data types) remain unchanged
*/

-- Drop the unique constraint on charge_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' 
    AND constraint_name = 'charging_sessions_charge_id_key'
  ) THEN
    ALTER TABLE charging_sessions DROP CONSTRAINT charging_sessions_charge_id_key;
  END IF;
END $$;

-- Add unique constraint on transaction_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' 
    AND constraint_name = 'charging_sessions_transaction_id_key'
  ) THEN
    ALTER TABLE charging_sessions ADD CONSTRAINT charging_sessions_transaction_id_key UNIQUE (transaction_id);
  END IF;
END $$;

-- Create index on charge_id for query performance (non-unique)
CREATE INDEX IF NOT EXISTS idx_charging_sessions_charge_id ON charging_sessions(charge_id);

-- Create index on created_at for sorting duplicate entries
CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at ON charging_sessions(created_at);