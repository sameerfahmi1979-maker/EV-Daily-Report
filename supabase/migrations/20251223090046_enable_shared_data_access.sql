/*
  # Enable Shared Data Access Across All Users

  This migration updates Row Level Security (RLS) policies to allow all authenticated users
  to view all company data (rate structures, charging stations, operators, and fixed charges).
  
  ## Changes Made
  
  1. **Stations Table**
     - Drop existing user-specific SELECT policy
     - Create new policy allowing all authenticated users to view all stations
     - Maintain user-specific policies for INSERT, UPDATE, DELETE for data integrity
  
  2. **Rate Structures Table**
     - Drop existing user-specific SELECT policy
     - Create new policy allowing all authenticated users to view all rate structures
     - Maintain user-specific policies for INSERT, UPDATE, DELETE for data integrity
  
  3. **Operators Table**
     - Drop existing user-specific SELECT policy
     - Create new policy allowing all authenticated users to view all operators
     - Maintain user-specific policies for INSERT, UPDATE, DELETE for data integrity
  
  4. **Fixed Charges Table**
     - Drop existing user-specific SELECT policy
     - Create new policy allowing all authenticated users to view all fixed charges
     - Maintain user-specific policies for INSERT, UPDATE, DELETE for data integrity
  
  ## Security Notes
  
  - All tables still have RLS enabled
  - Write operations (INSERT, UPDATE, DELETE) remain restricted to the user who created the record
  - Only SELECT operations are shared across all authenticated users
  - Unauthenticated users still have no access to any data
*/

-- ============================================================================
-- Stations Table - Enable Shared Read Access
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own stations" ON stations;

-- Create new shared SELECT policy
CREATE POLICY "All authenticated users can view all stations"
  ON stations
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Rate Structures Table - Enable Shared Read Access
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view rate structures for own stations" ON rate_structures;

-- Create new shared SELECT policy
CREATE POLICY "All authenticated users can view all rate structures"
  ON rate_structures
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Operators Table - Enable Shared Read Access
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own operators" ON operators;

-- Create new shared SELECT policy
CREATE POLICY "All authenticated users can view all operators"
  ON operators
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Fixed Charges Table - Enable Shared Read Access
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view fixed charges for own stations" ON fixed_charges;

-- Create new shared SELECT policy
CREATE POLICY "All authenticated users can view all fixed charges"
  ON fixed_charges
  FOR SELECT
  TO authenticated
  USING (true);