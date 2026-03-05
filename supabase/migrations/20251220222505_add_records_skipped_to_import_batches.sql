/*
  # Add records_skipped column to import_batches
  
  This migration adds support for tracking skipped records during import.
  
  ## Changes
  1. Add `records_skipped` column to track records that were skipped (e.g., duplicates)
  2. Column is nullable integer with default value of 0
  
  ## Purpose
  - Distinguish between failed imports and skipped duplicates
  - Provide better visibility into import results
  - Allow re-importing the same file without treating duplicates as errors
  
  ## Notes
  - Skipped records are those that already exist in the database (by charge_id)
  - This is different from failed records which have validation or insert errors
*/

-- Add records_skipped column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_batches' AND column_name = 'records_skipped'
  ) THEN
    ALTER TABLE import_batches ADD COLUMN records_skipped integer DEFAULT 0;
  END IF;
END $$;
