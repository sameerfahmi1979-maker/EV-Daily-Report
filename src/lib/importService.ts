import * as XLSX from 'xlsx';
import { parse, isValid, format } from 'date-fns';
import { toZonedTime, fromZonedTime, getTimezoneOffset } from 'date-fns-tz';
import { supabase } from './supabase';
import { Database } from './database.types';

type ImportBatch = Database['public']['Tables']['import_batches']['Row'];
type ImportBatchInsert = Database['public']['Tables']['import_batches']['Insert'];
type ChargingSessionInsert = Database['public']['Tables']['charging_sessions']['Insert'];

const TIMEZONE = 'Asia/Amman';

export interface ParsedSession {
  transactionId: string;
  chargeId: string;
  cardNumber: string;
  startDateTime: string;
  endDateTime: string;
  energyKwh: number;
  cost?: number;
  stationCode?: string;
  maxDemandKw?: number;
  userIdentifier?: string;
  connectorNumber?: string;
  connectorType?: string;
  durationText?: string;
  co2ReductionKg?: number;
  startSocPercent?: number;
  endSocPercent?: number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface ImportResult {
  batchId: string;
  totalRecords: number;
  successCount: number;
  skippedCount: number;
  failureCount: number;
  errors: Array<{
    row: number;
    session: ParsedSession;
    errors: string[];
  }>;
  skipped: Array<{
    row: number;
    session: ParsedSession;
    reason: string;
  }>;
}

function normalizeSubscriptCharacters(text: string): string {
  return text
    .replace(/₀/g, '0')
    .replace(/₁/g, '1')
    .replace(/₂/g, '2')
    .replace(/₃/g, '3')
    .replace(/₄/g, '4')
    .replace(/₅/g, '5')
    .replace(/₆/g, '6')
    .replace(/₇/g, '7')
    .replace(/₈/g, '8')
    .replace(/₉/g, '9');
}

function parseConnectorString(connectorStr: string): { number: string; type: string } | null {
  try {
    const cleaned = connectorStr.trim();

    const dashMatch = cleaned.match(/^(\d+)\s*-\s*(.+)$/);
    if (dashMatch) {
      return {
        number: dashMatch[1],
        type: dashMatch[2].trim()
      };
    }

    const spaceMatch = cleaned.match(/^connector\s+(\d+)\s+(.+)$/i);
    if (spaceMatch) {
      return {
        number: spaceMatch[1],
        type: spaceMatch[2].trim()
      };
    }

    const numMatch = cleaned.match(/^(\d+)\s+(.+)$/);
    if (numMatch) {
      return {
        number: numMatch[1],
        type: numMatch[2].trim()
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

function parseDateTimeString(dateTimeStr: string): { date: string; time: string; timestamp: string } | null {
  try {
    let cleanedStr = dateTimeStr.trim();

    const timezoneMatch = cleanedStr.match(/\s*\([^)]+\)\s*$/);
    if (timezoneMatch) {
      cleanedStr = cleanedStr.replace(timezoneMatch[0], '').trim();
    }

    const parsed = parse(cleanedStr, 'yyyy-MM-dd HH:mm:ss', new Date());

    if (!isValid(parsed)) {
      return null;
    }

    const date = format(parsed, 'yyyy-MM-dd');
    const time = format(parsed, 'HH:mm:ss');

    const offsetMinutes = getTimezoneOffset(TIMEZONE, parsed) / (1000 * 60);
    const offsetHours = Math.floor(offsetMinutes / 60);
    const sign = offsetHours >= 0 ? '+' : '-';
    const absHours = Math.abs(offsetHours);
    const offsetStr = `${sign}${String(absHours).padStart(2, '0')}:00`;

    const timestamp = `${date}T${time}${offsetStr}`;

    return {
      date: date,
      time: time,
      timestamp: timestamp
    };
  } catch (error) {
    return null;
  }
}

export function validateSession(session: ParsedSession, rowNumber: number): string[] {
  const errors: string[] = [];

  if (!session.transactionId || session.transactionId.trim() === '') {
    errors.push('Transaction ID is required');
  }

  if (!session.chargeId || session.chargeId.trim() === '') {
    errors.push('Charge ID is required');
  }

  if (!session.cardNumber || session.cardNumber.trim() === '') {
    errors.push('Card Number is required');
  }

  if (!session.startDateTime || session.startDateTime.trim() === '') {
    errors.push('Start DateTime is required');
  } else {
    const parsed = parseDateTimeString(session.startDateTime);
    if (!parsed) {
      errors.push(`Invalid Start DateTime format. Expected: YYYY-MM-DD HH:MM:SS`);
    }
  }

  if (!session.endDateTime || session.endDateTime.trim() === '') {
    errors.push('End DateTime is required');
  } else {
    const parsed = parseDateTimeString(session.endDateTime);
    if (!parsed) {
      errors.push(`Invalid End DateTime format. Expected: YYYY-MM-DD HH:MM:SS`);
    }
  }

  if (session.startDateTime && session.endDateTime) {
    const start = parseDateTimeString(session.startDateTime);
    const end = parseDateTimeString(session.endDateTime);

    if (start && end) {
      const startMs = new Date(start.timestamp).getTime();
      const endMs = new Date(end.timestamp).getTime();

      if (endMs <= startMs) {
        errors.push('End DateTime must be after Start DateTime');
      }

      const durationMin = (endMs - startMs) / (1000 * 60);
      // Allow any duration — no minimum requirement
      if (durationMin > 1440) {
        errors.push('Session duration cannot exceed 24 hours');
      }
    }
  }

  if (session.energyKwh === undefined || session.energyKwh === null) {
    errors.push('Energy (kWh) is required');
  } else if (typeof session.energyKwh !== 'number' || session.energyKwh <= 0) {
    errors.push('Energy must be a positive number');
  }

  if (session.cost !== undefined && session.cost !== null) {
    if (typeof session.cost !== 'number' || session.cost < 0) {
      errors.push('Cost must be a non-negative number');
    }
  }

  if (session.maxDemandKw !== undefined && session.maxDemandKw !== null) {
    if (typeof session.maxDemandKw !== 'number' || session.maxDemandKw < 0) {
      errors.push('Max Demand must be a non-negative number');
    }
  }

  if (session.startSocPercent !== undefined && session.startSocPercent !== null) {
    if (typeof session.startSocPercent !== 'number' || session.startSocPercent < 0 || session.startSocPercent > 100) {
      errors.push('Start SOC must be between 0 and 100');
    }
  }

  if (session.endSocPercent !== undefined && session.endSocPercent !== null) {
    if (typeof session.endSocPercent !== 'number' || session.endSocPercent < 0 || session.endSocPercent > 100) {
      errors.push('End SOC must be between 0 and 100');
    }
  }

  if (session.co2ReductionKg !== undefined && session.co2ReductionKg !== null) {
    if (typeof session.co2ReductionKg !== 'number' || session.co2ReductionKg < 0) {
      errors.push('CO2 Reduction must be a non-negative number');
    }
  }

  return errors;
}

export async function parseExcelFile(file: File): Promise<ParsedSession[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          reject(new Error('File must contain at least a header row and one data row'));
          return;
        }

        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
        const normalizedHeaders = headers.map(h => normalizeSubscriptCharacters(h));
        const sessions: ParsedSession[] = [];

        const requiredColumns = [
          'transaction',
          'card',
          'energy'
        ];

        for (const required of requiredColumns) {
          if (!headers.some(h => h.includes(required.toLowerCase()))) {
            reject(new Error(`Missing required column containing: ${required}`));
            return;
          }
        }

        const hasChargeId = headers.some(h => h.includes('charge') && (h.includes('id') || h.includes('point')));
        const hasStartTime = headers.some(h => h.includes('start'));
        const hasEndTime = headers.some(h => h.includes('end') || h.includes('stop'));

        if (!hasChargeId) {
          reject(new Error('Missing required column: Charge ID or Charge Point ID'));
          return;
        }

        if (!hasStartTime) {
          reject(new Error('Missing required column: Start Time or Start DateTime'));
          return;
        }

        if (!hasEndTime) {
          reject(new Error('Missing required column: End Time, Stop Time, or End DateTime'));
          return;
        }

        const columnMap: Record<string, number> = {};
        headers.forEach((header, index) => {
          const normalized = normalizedHeaders[index];
          if (header.includes('transaction')) columnMap.transactionId = index;
          if (header.includes('charge') && (header.includes('point') || (header.includes('id') && !header.includes('card')))) columnMap.chargeId = index;
          if (header.includes('card')) columnMap.cardNumber = index;
          if (header.includes('start') && !header.includes('soc')) columnMap.startDateTime = index;
          if (header.includes('stop') || (header.includes('end') && !header.includes('soc'))) columnMap.endDateTime = index;
          if (header.includes('energy') && !normalized.includes('co2')) columnMap.energyKwh = index;
          if (header.includes('cost')) columnMap.cost = index;
          if (header.includes('station') && header.includes('code')) columnMap.stationCode = index;
          if (header.includes('demand')) columnMap.maxDemandKw = index;
          if (header.includes('user') && (header.includes('id') || header.includes('identifier'))) columnMap.userIdentifier = index;
          if (header.includes('connector') && !header.includes('type')) columnMap.connector = index;
          if (header.includes('duration') && !header.includes('minute')) columnMap.duration = index;
          if (normalized.includes('co2') || normalized.includes('emission') || normalized.includes('reduction')) columnMap.co2 = index;
          if (header.includes('start') && header.includes('soc')) columnMap.startSoc = index;
          if (header.includes('end') && header.includes('soc')) columnMap.endSoc = index;
        });

        console.log('Column mapping:', {
          co2Index: columnMap.co2,
          co2HeaderOriginal: columnMap.co2 !== undefined ? headers[columnMap.co2] : 'NOT FOUND',
          co2HeaderNormalized: columnMap.co2 !== undefined ? normalizedHeaders[columnMap.co2] : 'NOT FOUND',
          allHeaders: headers
        });

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];

          if (!row || row.length === 0 || row.every((cell: any) => cell === undefined || cell === null || cell === '')) {
            continue;
          }

          const connectorStr = columnMap.connector !== undefined ? String(row[columnMap.connector] || '').trim() : '';
          let connectorNumber: string | undefined;
          let connectorType: string | undefined;

          if (connectorStr) {
            const parsed = parseConnectorString(connectorStr);
            if (parsed) {
              connectorNumber = parsed.number;
              connectorType = parsed.type;
            }
          }

          const costValue = columnMap.cost !== undefined && row[columnMap.cost] !== undefined && row[columnMap.cost] !== null && row[columnMap.cost] !== ''
            ? parseFloat(row[columnMap.cost])
            : undefined;

          const co2Value = columnMap.co2 !== undefined && row[columnMap.co2] !== undefined && row[columnMap.co2] !== null && row[columnMap.co2] !== ''
            ? parseFloat(String(row[columnMap.co2]).trim())
            : undefined;

          const session: ParsedSession = {
            transactionId: row[columnMap.transactionId] ? String(row[columnMap.transactionId]).trim() : '',
            chargeId: row[columnMap.chargeId] ? String(row[columnMap.chargeId]).trim() : '',
            cardNumber: row[columnMap.cardNumber] ? String(row[columnMap.cardNumber]).trim() : '',
            startDateTime: row[columnMap.startDateTime] ? String(row[columnMap.startDateTime]).trim() : '',
            endDateTime: row[columnMap.endDateTime] ? String(row[columnMap.endDateTime]).trim() : '',
            energyKwh: parseFloat(row[columnMap.energyKwh]),
            cost: costValue,
            stationCode: columnMap.stationCode !== undefined ? String(row[columnMap.stationCode] || '').trim() : undefined,
            maxDemandKw: columnMap.maxDemandKw !== undefined && row[columnMap.maxDemandKw] ? parseFloat(row[columnMap.maxDemandKw]) : undefined,
            userIdentifier: columnMap.userIdentifier !== undefined ? String(row[columnMap.userIdentifier] || '').trim() : undefined,
            connectorNumber,
            connectorType,
            durationText: columnMap.duration !== undefined ? String(row[columnMap.duration] || '').trim() : undefined,
            co2ReductionKg: co2Value !== undefined && !isNaN(co2Value) ? co2Value : undefined,
            startSocPercent: columnMap.startSoc !== undefined && row[columnMap.startSoc] ? parseFloat(row[columnMap.startSoc]) : undefined,
            endSocPercent: columnMap.endSoc !== undefined && row[columnMap.endSoc] ? parseFloat(row[columnMap.endSoc]) : undefined
          };

          if (columnMap.co2 !== undefined) {
            console.log(`Row ${i + 1} CO2:`, {
              rawValue: row[columnMap.co2],
              parsedValue: co2Value,
              finalValue: session.co2ReductionKg,
              isValid: co2Value !== undefined && !isNaN(co2Value)
            });
          }

          sessions.push(session);
        }

        resolve(sessions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}

export async function createImportBatch(filename: string, totalRecords: number, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('import_batches')
    .insert([{
      filename,
      records_total: totalRecords,
      records_success: 0,
      records_failed: 0,
      status: 'processing',
      user_id: userId
    }])
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateImportBatch(
  batchId: string,
  successCount: number,
  skippedCount: number,
  failureCount: number,
  status: string,
  skippedLog: any,
  errorLog: any
) {
  const combinedLog = {
    skipped: skippedLog || [],
    errors: errorLog || []
  };

  const { error } = await supabase
    .from('import_batches')
    .update({
      records_success: successCount,
      records_skipped: skippedCount,
      records_failed: failureCount,
      status,
      error_log: combinedLog
    })
    .eq('id', batchId);

  if (error) throw error;
}

// =============================================
// OPTIMIZED: Prepare a single session row for bulk insert
// No HTTP calls — all done in-memory using cached rate data
// =============================================
function prepareSessionRow(
  session: ParsedSession,
  batchId: string,
  stationId?: string
): ChargingSessionInsert | null {
  const start = parseDateTimeString(session.startDateTime);
  const end = parseDateTimeString(session.endDateTime);

  if (!start || !end) return null;
  if (typeof session.energyKwh !== 'number' || isNaN(session.energyKwh)) return null;

  const startMs = new Date(start.timestamp).getTime();
  const endMs = new Date(end.timestamp).getTime();
  const durationMinutes = Math.round((endMs - startMs) / (1000 * 60));

  // Cost will be calculated server-side via RPC — use temporary fallback
  const calculatedCost = session.cost ?? session.energyKwh * 0.150;

  return {
    transaction_id: session.transactionId,
    charge_id: session.chargeId,
    card_number: session.cardNumber,
    start_date: start.date,
    start_time: start.time,
    start_ts: start.timestamp,
    end_date: end.date,
    end_time: end.time,
    end_ts: end.timestamp,
    duration_minutes: durationMinutes,
    energy_consumed_kwh: session.energyKwh,
    calculated_cost: calculatedCost,
    station_code: session.stationCode || null,
    max_demand_kw: session.maxDemandKw ?? null,
    user_identifier: session.userIdentifier || null,
    import_batch_id: batchId,
    station_id: stationId || null,
    connector_number: session.connectorNumber || null,
    connector_type: session.connectorType || null,
    duration_text: session.durationText || null,
    co2_reduction_kg: session.co2ReductionKg ?? null,
    start_soc_percent: session.startSocPercent ?? null,
    end_soc_percent: session.endSocPercent ?? null
  };
}

// =============================================
// OPTIMIZED: Pre-check duplicates in ONE query
// =============================================
async function checkDuplicateTransactionIds(transactionIds: string[]): Promise<Set<string>> {
  const duplicates = new Set<string>();
  // Query in chunks of 500 to stay within Supabase limits
  const CHUNK = 500;
  for (let i = 0; i < transactionIds.length; i += CHUNK) {
    const chunk = transactionIds.slice(i, i + CHUNK);
    const { data } = await supabase
      .from('charging_sessions')
      .select('transaction_id')
      .in('transaction_id', chunk);
    if (data) {
      data.forEach(row => duplicates.add(row.transaction_id));
    }
  }
  return duplicates;
}

// =============================================
// OPTIMIZED: Bulk insert in 250-row chunks
// =============================================
const BULK_CHUNK_SIZE = 250;

async function bulkInsertSessions(
  rows: ChargingSessionInsert[],
  onChunkDone?: (inserted: number) => void
): Promise<{ inserted: number; errors: Array<{ index: number; error: string }> }> {
  let totalInserted = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + BULK_CHUNK_SIZE);
    const { error } = await supabase
      .from('charging_sessions')
      .insert(chunk);

    if (error) {
      console.error(`Bulk insert error at chunk ${i / BULK_CHUNK_SIZE}:`, error);
      // Fallback: try one-by-one for this chunk to identify bad rows
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowError } = await supabase
          .from('charging_sessions')
          .insert([chunk[j]]);
        if (rowError) {
          errors.push({ index: i + j, error: rowError.message });
        } else {
          totalInserted++;
        }
      }
    } else {
      totalInserted += chunk.length;
    }

    if (onChunkDone) onChunkDone(totalInserted);
  }

  return { inserted: totalInserted, errors };
}

async function validatePreImportConditions(stationId?: string): Promise<string[]> {
  const errors: string[] = [];

  if (stationId) {
    const { data: station, error } = await supabase
      .from('stations')
      .select('id, name')
      .eq('id', stationId)
      .maybeSingle();

    if (error) {
      errors.push(`Database error checking station: ${error.message}`);
    } else if (!station) {
      errors.push(`Station with ID ${stationId} not found. Please select a valid station.`);
    } else {
      console.log(`Station validated: ${station.name} (${station.id})`);
    }
  }

  return errors;
}

export interface CancelToken {
  cancelled: boolean;
}

export async function processBatch(
  sessions: ParsedSession[],
  batchId: string,
  stationId?: string,
  onProgress?: (current: number, total: number) => void,
  cancelToken?: CancelToken
): Promise<ImportResult> {
  const preImportErrors = await validatePreImportConditions(stationId);

  if (preImportErrors.length > 0) {
    console.error('Pre-import validation failed:', preImportErrors);
    await updateImportBatch(batchId, 0, 0, sessions.length, 'failed', [], [
      { row: 0, session: {} as ParsedSession, errors: preImportErrors }
    ]);

    return {
      batchId,
      totalRecords: sessions.length,
      successCount: 0,
      skippedCount: 0,
      failureCount: sessions.length,
      skipped: [],
      errors: [{ row: 0, session: {} as ParsedSession, errors: preImportErrors }]
    };
  }

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const errors: Array<{ row: number; session: ParsedSession; errors: string[] }> = [];
  const skipped: Array<{ row: number; session: ParsedSession; reason: string }> = [];
  let co2Count = 0;
  let totalCo2 = 0;

  // ── STEP 1: Validate all rows (client-side, instant) ──
  if (onProgress) onProgress(0, sessions.length);
  const validSessions: { index: number; session: ParsedSession }[] = [];

  for (let i = 0; i < sessions.length; i++) {
    if (cancelToken?.cancelled) break;
    const session = sessions[i];
    const rowNumber = i + 2;
    const validationErrors = validateSession(session, rowNumber);

    if (validationErrors.length > 0) {
      failCount++;
      errors.push({ row: rowNumber, session, errors: validationErrors });
    } else {
      validSessions.push({ index: i, session });
    }
  }

  if (cancelToken?.cancelled || validSessions.length === 0) {
    const status = cancelToken?.cancelled ? 'cancelled' : (failCount > 0 ? 'failed' : 'completed');
    await updateImportBatch(batchId, 0, 0, failCount, status, [], errors);
    return { batchId, totalRecords: sessions.length, successCount: 0, skippedCount: 0, failureCount: failCount, skipped: [], errors };
  }

  // ── STEP 2: Pre-check duplicates in ONE query (not N queries) ──
  const allTransactionIds = validSessions.map(v => v.session.transactionId);
  const existingIds = await checkDuplicateTransactionIds(allTransactionIds);

  // Separate duplicates from new rows
  const newSessions: { index: number; session: ParsedSession }[] = [];
  for (const item of validSessions) {
    if (existingIds.has(item.session.transactionId)) {
      skipCount++;
      skipped.push({
        row: item.index + 2,
        session: item.session,
        reason: `Transaction ID ${item.session.transactionId} already exists in database`
      });
    } else {
      newSessions.push(item);
    }
  }

  if (onProgress) onProgress(Math.floor(sessions.length * 0.3), sessions.length);

  // ── STEP 3: Prepare all rows for bulk insert (in-memory, no HTTP) ──
  const rowsToInsert: ChargingSessionInsert[] = [];
  const rowSessionMap: { index: number; session: ParsedSession }[] = [];

  for (const item of newSessions) {
    if (cancelToken?.cancelled) break;
    const row = prepareSessionRow(item.session, batchId, stationId);
    if (row) {
      rowsToInsert.push(row);
      rowSessionMap.push(item);

      if (item.session.co2ReductionKg !== undefined && item.session.co2ReductionKg !== null) {
        co2Count++;
        totalCo2 += item.session.co2ReductionKg;
      }
    } else {
      failCount++;
      errors.push({ row: item.index + 2, session: item.session, errors: ['Failed to prepare session data'] });
    }
  }

  if (onProgress) onProgress(Math.floor(sessions.length * 0.5), sessions.length);

  // ── STEP 4: Bulk insert in 250-row chunks ──
  if (rowsToInsert.length > 0 && !cancelToken?.cancelled) {
    console.log(`Bulk inserting ${rowsToInsert.length} sessions in ${Math.ceil(rowsToInsert.length / BULK_CHUNK_SIZE)} chunks...`);
    const bulkResult = await bulkInsertSessions(rowsToInsert, (inserted) => {
      if (onProgress) {
        const progress = Math.floor(sessions.length * 0.5) + Math.floor((inserted / rowsToInsert.length) * sessions.length * 0.3);
        onProgress(Math.min(progress, sessions.length), sessions.length);
      }
    });

    successCount = bulkResult.inserted;

    for (const err of bulkResult.errors) {
      const mapped = rowSessionMap[err.index];
      if (mapped) {
        failCount++;
        errors.push({ row: mapped.index + 2, session: mapped.session, errors: [err.error] });
      }
    }
  }

  // ── STEP 5: Server-side billing via RPC (1 call for entire batch) ──
  if (successCount > 0 && stationId && !cancelToken?.cancelled) {
    try {
      console.log(`Calling calculate_batch_billing RPC for batch ${batchId}...`);
      const { data: billingResult, error: billingError } = await supabase.rpc('calculate_batch_billing', {
        p_batch_id: batchId,
        p_station_id: stationId
      });

      if (billingError) {
        console.warn('Batch billing RPC warning (non-fatal):', billingError.message);
      } else {
        console.log('Batch billing completed:', billingResult);
      }
    } catch (billingErr) {
      console.warn('Batch billing RPC failed (non-fatal):', billingErr);
    }
  }

  if (onProgress) onProgress(sessions.length, sessions.length);

  // ── STEP 6: Finalize ──
  let status: string;
  if (cancelToken?.cancelled) {
    status = 'cancelled';
  } else if (failCount > 0) {
    status = successCount > 0 ? 'completed_with_errors' : 'failed';
  } else {
    status = 'completed';
  }

  console.log('Import completed:', {
    totalRecords: sessions.length,
    successCount,
    skipCount,
    failCount,
    co2Stats: {
      sessionsWithCO2: co2Count,
      totalCO2Reduction: totalCo2.toFixed(2) + ' kg'
    }
  });

  await updateImportBatch(batchId, successCount, skipCount, failCount, status, skipped, errors);

  return {
    batchId,
    totalRecords: sessions.length,
    successCount,
    skippedCount: skipCount,
    failureCount: failCount,
    skipped,
    errors
  };
}

export async function getImportBatches(): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('upload_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getImportBatch(batchId: string): Promise<ImportBatch | null> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function cancelImportBatch(batchId: string): Promise<void> {
  const batch = await getImportBatch(batchId);

  if (!batch) {
    throw new Error('Import batch not found');
  }

  if (batch.status !== 'processing') {
    throw new Error('Can only cancel imports with "processing" status');
  }

  const existingLog = (batch.error_log as any) || { skipped: [], errors: [] };
  const updatedLog = {
    ...existingLog,
    cancellation: {
      timestamp: new Date().toISOString(),
      reason: 'Manually stopped by user'
    }
  };

  const { error } = await supabase
    .from('import_batches')
    .update({
      status: 'cancelled',
      error_log: updatedLog
    })
    .eq('id', batchId);

  if (error) throw error;
}

export function generateSampleCSV(): string {
  const headers = [
    'Transaction_ID',
    'Charge Point ID',
    'Card Number',
    'Start_Time',
    'Stop_Time',
    'Energy (kWh)',
    'Connector',
    'Duration',
    'Station Code',
    'Max Demand (kW)',
    'CO2 Emissions Reduction(kg)',
    'Start_SOC',
    'End_SOC'
  ];

  const sampleRows = [
    ['TXN-001', 'CHG-001', '1234-5678-9012', '2025-01-15 08:30:00 (UTC+03:00)', '2025-01-15 09:15:00 (UTC+03:00)', '25.5', '1-GBT DC', '0h 45m', 'STATION-A1', '7.2', '12.5', '20', '85'],
    ['TXN-002', 'CHG-002', '2345-6789-0123', '2025-01-15 14:20:00 (UTC+03:00)', '2025-01-15 15:45:00 (UTC+03:00)', '38.2', '2-CCS2', '1h 25m', 'STATION-B2', '11.5', '18.8', '15', '92'],
    ['TXN-003', 'CHG-003', '3456-7890-1234', '2025-01-15 19:00:00 (UTC+03:00)', '2025-01-15 20:30:00 (UTC+03:00)', '42.8', '1-GBT DC', '1h 30m', 'STATION-A1', '22.0', '21.0', '10', '95']
  ];

  const csvLines = [headers.join(',')];
  sampleRows.forEach(row => {
    csvLines.push(row.join(','));
  });

  return csvLines.join('\n');
}

export function downloadSampleTemplate() {
  const csv = generateSampleCSV();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'charging-sessions-template.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Cascade-delete an import batch and ALL related records.
 * Deletes in dependency order:
 *   billing_breakdown_items → billing_calculations → charging_sessions → shifts → import_batch
 */
export async function deleteImportBatchCascade(batchId: string): Promise<{
  success: boolean;
  filename: string;
  billing_deleted: number;
  sessions_deleted: number;
  shifts_deleted: number;
}> {
  // 1. Get batch info (for filename)
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('filename')
    .eq('id', batchId)
    .single();

  if (batchError) throw batchError;
  const filename = batch?.filename || 'unknown';

  // 2. Get all session IDs for this batch
  const { data: sessions, error: sessError } = await supabase
    .from('charging_sessions')
    .select('id')
    .eq('import_batch_id', batchId);

  if (sessError) throw sessError;
  const sessionIds = (sessions || []).map(s => s.id);

  let billingDeleted = 0;

  if (sessionIds.length > 0) {
    // 3. Get all billing calculation IDs for these sessions
    const { data: billingCalcs, error: bcError } = await supabase
      .from('billing_calculations')
      .select('id')
      .in('session_id', sessionIds);

    if (bcError) throw bcError;
    const billingIds = (billingCalcs || []).map(b => b.id);

    if (billingIds.length > 0) {
      // 4. Delete billing_breakdown_items first (FK to billing_calculations)
      const { error: bbiError } = await supabase
        .from('billing_breakdown_items')
        .delete()
        .in('billing_calculation_id', billingIds);

      if (bbiError) {
        console.warn('billing_breakdown_items delete warning:', bbiError.message);
        // Continue — table may not exist or may have no matching rows
      }

      // 5. Delete billing_calculations
      const { error: bcDelError } = await supabase
        .from('billing_calculations')
        .delete()
        .in('session_id', sessionIds);

      if (bcDelError) throw bcDelError;
      billingDeleted = billingIds.length;
    }

    // 6. Delete charging_sessions
    const { error: sessDelError } = await supabase
      .from('charging_sessions')
      .delete()
      .eq('import_batch_id', batchId);

    if (sessDelError) throw sessDelError;
  }

  // 7. Delete shifts linked to this batch
  const { data: deletedShifts, error: shiftError } = await supabase
    .from('shifts')
    .delete()
    .eq('import_batch_id', batchId)
    .select('id');

  if (shiftError) throw shiftError;

  // 8. Delete the import batch itself
  const { error: batchDelError } = await supabase
    .from('import_batches')
    .delete()
    .eq('id', batchId);

  if (batchDelError) throw batchDelError;

  console.log(`[Cascade Delete] Batch "${filename}": ${billingDeleted} billing, ${sessionIds.length} sessions, ${deletedShifts?.length || 0} shifts deleted`);

  return {
    success: true,
    filename,
    billing_deleted: billingDeleted,
    sessions_deleted: sessionIds.length,
    shifts_deleted: deletedShifts?.length || 0,
  };
}
