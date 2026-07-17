/*
  # Add Enhanced Charging Session Fields
  
  This migration adds new fields to support charging machine Excel import format:
  
  1. New Fields Added to charging_sessions:
    - `connector_number` (text) - Connector port number (e.g., "1", "2")
    - `connector_type` (text) - Connector type (e.g., "GBT DC", "CCS1", "CCS2")
    - `duration_text` (text) - Original duration string from machine
    - `co2_reduction_kg` (decimal) - CO2 emissions reduction in kg
    - `start_soc_percent` (decimal) - Starting State of Charge percentage (0-100)
    - `end_soc_percent` (decimal) - Ending State of Charge percentage (0-100)
  
  2. Schema Changes:
    - All new fields are nullable for backward compatibility
    - No changes to existing datetime structure (date/time/ts columns maintained)
    - Existing data remains unchanged
  
  3. Notes:
    - Connector data parsed from machine's "Connector" column format (e.g., "1-GBT DC")
    - CO2 and SOC fields stored for future analytics
    - Duration text stored as reference, duration_minutes remains calculated
*/

-- Add connector fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charging_sessions' AND column_name = 'connector_number'
  ) THEN
    ALTER TABLE charging_sessions ADD COLUMN connector_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charging_sessions' AND column_name = 'connector_type'
  ) THEN
    ALTER TABLE charging_sessions ADD COLUMN connector_type text;
  END IF;
END $$;

-- Add duration text field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charging_sessions' AND column_name = 'duration_text'
  ) THEN
    ALTER TABLE charging_sessions ADD COLUMN duration_text text;
  END IF;
END $$;

-- Add CO2 reduction field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charging_sessions' AND column_name = 'co2_reduction_kg'
  ) THEN
    ALTER TABLE charging_sessions ADD COLUMN co2_reduction_kg decimal;
  END IF;
END $$;

-- Add State of Charge fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charging_sessions' AND column_name = 'start_soc_percent'
  ) THEN
    ALTER TABLE charging_sessions ADD COLUMN start_soc_percent decimal;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charging_sessions' AND column_name = 'end_soc_percent'
  ) THEN
    ALTER TABLE charging_sessions ADD COLUMN end_soc_percent decimal;
  END IF;
END $$;

-- Add check constraints for SOC percentages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' AND constraint_name = 'check_start_soc_range'
  ) THEN
    ALTER TABLE charging_sessions 
    ADD CONSTRAINT check_start_soc_range 
    CHECK (start_soc_percent IS NULL OR (start_soc_percent >= 0 AND start_soc_percent <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' AND constraint_name = 'check_end_soc_range'
  ) THEN
    ALTER TABLE charging_sessions 
    ADD CONSTRAINT check_end_soc_range 
    CHECK (end_soc_percent IS NULL OR (end_soc_percent >= 0 AND end_soc_percent <= 100));
  END IF;
END $$;

-- Add check constraint for CO2 reduction (non-negative)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'charging_sessions' AND constraint_name = 'check_co2_non_negative'
  ) THEN
    ALTER TABLE charging_sessions 
    ADD CONSTRAINT check_co2_non_negative 
    CHECK (co2_reduction_kg IS NULL OR co2_reduction_kg >= 0);
  END IF;
END $$;