/*
  # Add billing status flag to charging sessions

  1. Changes
    - Add `has_billing_calculation` boolean column to `charging_sessions` table
    - Default to false for new records
    - Update existing records based on whether they have billing calculations
    - Create index on the new column for fast filtering
    
  2. Purpose
    - Enable efficient filtering of sessions by billing status
    - Avoid loading all sessions into memory for filtering
*/

-- Add the column
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS has_billing_calculation boolean DEFAULT false;

-- Update existing records to reflect current billing status
UPDATE charging_sessions cs
SET has_billing_calculation = EXISTS (
  SELECT 1 
  FROM billing_calculations bc 
  WHERE bc.session_id = cs.id
);

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_sessions_has_billing 
ON charging_sessions(has_billing_calculation);

-- Create a function to automatically update the flag when billing is added/removed
CREATE OR REPLACE FUNCTION update_session_billing_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE charging_sessions 
    SET has_billing_calculation = true 
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE charging_sessions 
    SET has_billing_calculation = NOT EXISTS (
      SELECT 1 FROM billing_calculations 
      WHERE session_id = OLD.session_id
    )
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically maintain the flag
DROP TRIGGER IF EXISTS trg_update_session_billing_flag ON billing_calculations;
CREATE TRIGGER trg_update_session_billing_flag
AFTER INSERT OR DELETE ON billing_calculations
FOR EACH ROW
EXECUTE FUNCTION update_session_billing_flag();