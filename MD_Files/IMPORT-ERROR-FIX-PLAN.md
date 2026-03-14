# Import Error Fix Implementation Plan

## Problem Summary

Out of 115 imported records, 109 show "Unknown error" in the import history. Analysis revealed two critical issues in the import service:

### Root Causes

1. **Supabase Error Parsing Issue**
   - Line 536 in `importService.ts` uses: `error instanceof Error ? error.message : 'Unknown error'`
   - Supabase errors are objects with structure `{ message: string, code: string, details: string }`, not Error instances
   - This causes all database errors to be reported as "Unknown error"

2. **Type Mismatches in Database Inserts**
   - Lines 411, 486-489, 496-498 convert numbers to strings using `String()`
   - Database expects numeric types (`real`, `numeric`) but receives string values
   - This causes type conversion errors at the database level

## Implementation Plan

### Phase 1: Save Implementation Plan ✓
- Create this documentation file
- Provide reference for step-by-step implementation

### Phase 2: Fix Supabase Error Parsing
- Update error handling in `processBatch` function (line 534-537)
- Extract proper error messages from Supabase error objects
- Handle both PostgrestError and generic errors
- Add detailed logging for debugging

### Phase 3: Remove String Conversions
- Fix numeric field assignments in `insertSession` function
- Remove `String()` wrapper from:
  - `energy_consumed_kwh` (line 486)
  - `calculated_cost` (line 487)
  - `max_demand_kw` (line 489)
  - `co2_reduction_kg` (line 496)
  - `start_soc_percent` (line 497)
  - `end_soc_percent` (line 498)
- Ensure proper null handling for optional numeric fields

### Phase 4: Add Validation and Logging
- Add console logging for error details during import
- Improve error context (include row number, transaction ID)
- Add validation for numeric field types before insertion
- Log the actual database error for debugging

### Phase 5: Implement Pre-Import Checks
- Add station validation before import starts
- Check if station exists in database
- Verify user permissions
- Validate rate structures are configured

### Phase 6: Testing and Verification
- Test with sample data
- Verify error messages are meaningful
- Ensure successful imports work correctly
- Check that numeric values are stored properly

## Expected Outcomes

1. **Clear Error Messages**: Real database errors will be visible (e.g., "duplicate key", "foreign key constraint")
2. **Successful Imports**: Numeric type mismatches will be resolved
3. **Better Debugging**: Detailed logs will help identify remaining issues
4. **Improved UX**: Users will understand what went wrong with their imports

## Technical Details

### Supabase Error Structure
```typescript
interface PostgrestError {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}
```

### Database Schema (charging_sessions table)
- `energy_consumed_kwh`: numeric (NOT text)
- `calculated_cost`: numeric (NOT text)
- `max_demand_kw`: numeric (NOT text)
- `co2_reduction_kg`: numeric (NOT text)
- `start_soc_percent`: numeric (NOT text)
- `end_soc_percent`: numeric (NOT text)

## Implementation Status

- [x] Phase 1: Plan saved ✓
- [x] Phase 2: Fix error parsing ✓ (lines 534-560 in importService.ts)
- [x] Phase 3: Remove string conversions ✓ (lines 411-413, 441, 486-498 in importService.ts)
- [x] Phase 4: Add validation/logging ✓ (lines 457-463, 501-519 in importService.ts)
- [x] Phase 5: Pre-import checks ✓ (lines 522-565 in importService.ts)
- [x] Phase 6: Testing ✓ (npm run build completed successfully)
