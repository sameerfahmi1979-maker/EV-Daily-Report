/*
  # Clean Up Duplicate Billing Calculations

  1. Problem
    - Multiple billing calculations may exist for a single session
    - This causes errors when querying for a single calculation
    - Can happen when recalculation fails partway through
  
  2. Solution
    - Delete all but the most recent billing calculation for each session
    - Keep the one with the latest calculation_date
    - Also clean up associated billing_breakdown_items
  
  3. Changes
    - Delete duplicate billing_calculations records
    - Delete orphaned billing_breakdown_items records
*/

-- First, delete billing_breakdown_items for calculations that will be removed
DELETE FROM billing_breakdown_items
WHERE billing_calculation_id IN (
  SELECT bc.id
  FROM billing_calculations bc
  WHERE EXISTS (
    SELECT 1
    FROM billing_calculations bc2
    WHERE bc2.session_id = bc.session_id
    AND bc2.calculation_date > bc.calculation_date
  )
);

-- Then delete the duplicate billing calculations, keeping only the most recent one
DELETE FROM billing_calculations
WHERE id IN (
  SELECT bc.id
  FROM billing_calculations bc
  WHERE EXISTS (
    SELECT 1
    FROM billing_calculations bc2
    WHERE bc2.session_id = bc.session_id
    AND bc2.calculation_date > bc.calculation_date
  )
);
