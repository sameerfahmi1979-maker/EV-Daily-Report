// =============================================
// duplicateCheckService.ts
// Pre-upload duplicate detection
// =============================================
import { supabase } from './supabase';

export interface DuplicateCheckResult {
  totalRows: number;
  duplicateIds: string[];
  newCount: number;
  duplicateCount: number;
}

/**
 * Check for duplicate transaction_ids before inserting.
 * Pass the array of transaction IDs from the spreadsheet.
 * Returns which ones already exist in the database.
 */
export async function checkDuplicates(transactionIds: string[]): Promise<DuplicateCheckResult> {
  if (!transactionIds || transactionIds.length === 0) {
    return { totalRows: 0, duplicateIds: [], newCount: 0, duplicateCount: 0 };
  }

  // Supabase .in() has a limit, so batch in chunks of 200
  const chunks: string[][] = [];
  for (let i = 0; i < transactionIds.length; i += 200) {
    chunks.push(transactionIds.slice(i, i + 200));
  }

  const found: string[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('charging_sessions')
      .select('transaction_id')
      .in('transaction_id', chunk);

    if (error) throw error;
    if (data) {
      data.forEach((row: any) => {
        if (row.transaction_id) found.push(row.transaction_id);
      });
    }
  }

  const duplicateSet = new Set(found);
  return {
    totalRows: transactionIds.length,
    duplicateIds: Array.from(duplicateSet),
    newCount: transactionIds.length - duplicateSet.size,
    duplicateCount: duplicateSet.size,
  };
}
