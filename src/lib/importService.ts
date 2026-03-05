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
      if (durationMin < 1) {
        errors.push('Session duration must be at least 1 minute');
      }
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

async function calculateCostFromRates(
  startTs: string,
  endTs: string,
  energyKwh: number,
  stationId: string,
  maxDemandKw?: number
): Promise<number> {
  try {
    const { getActiveRateStructure, getRatePeriods, getActiveFixedCharges } = await import('./billingService');

    const startDate = new Date(startTs);
    const rateStructure = await getActiveRateStructure(stationId, startDate);

    if (!rateStructure) {
      return energyKwh * 0.150;
    }

    const ratePeriods = await getRatePeriods(rateStructure.id);
    if (ratePeriods.length === 0) {
      return energyKwh * 0.150;
    }

    const tempSession = {
      id: '',
      station_id: stationId,
      transaction_id: '',
      charge_id: '',
      card_number: '',
      start_date: '',
      start_time: '',
      start_ts: startTs,
      end_date: '',
      end_time: '',
      end_ts: endTs,
      duration_minutes: 0,
      energy_consumed_kwh: energyKwh,
      calculated_cost: 0,
      max_demand_kw: maxDemandKw ?? null,
      station_code: null,
      user_identifier: null,
      import_batch_id: null,
      connector_number: null,
      connector_type: null,
      duration_text: null,
      co2_reduction_kg: null,
      start_soc_percent: null,
      end_soc_percent: null,
      created_at: null,
      updated_at: null
    };

    const { splitSessionIntoPeriods, allocateEnergyToSegments } = await import('./billingService');
    const segments = await splitSessionIntoPeriods(tempSession, ratePeriods);
    const segmentsWithEnergy = allocateEnergyToSegments(energyKwh, segments);

    const demandKw = maxDemandKw || 0;
    let totalCost = 0;

    for (const segment of segmentsWithEnergy) {
      const energyCharge = (segment.energyKwh || 0) * segment.ratePerKwh;
      const demandCharge = demandKw * segment.demandChargePerKw;
      totalCost += energyCharge + demandCharge;
    }

    const fixedCharges = await getActiveFixedCharges(stationId);
    const fixedChargesTotal = fixedCharges.reduce((sum, c) => sum + c.amount, 0);

    return totalCost + fixedChargesTotal;
  } catch (error) {
    return energyKwh * 0.150;
  }
}

async function insertSession(session: ParsedSession, batchId: string, stationId?: string): Promise<void> {
  const start = parseDateTimeString(session.startDateTime);
  const end = parseDateTimeString(session.endDateTime);

  if (!start || !end) {
    throw new Error('Invalid datetime format');
  }

  if (typeof session.energyKwh !== 'number' || isNaN(session.energyKwh)) {
    throw new Error(`Invalid energy value: ${session.energyKwh}`);
  }

  if (session.maxDemandKw !== undefined && (typeof session.maxDemandKw !== 'number' || isNaN(session.maxDemandKw))) {
    throw new Error(`Invalid max demand value: ${session.maxDemandKw}`);
  }

  const startMs = new Date(start.timestamp).getTime();
  const endMs = new Date(end.timestamp).getTime();
  const durationMinutes = Math.round((endMs - startMs) / (1000 * 60));

  let calculatedCost = session.cost;

  if (calculatedCost === undefined && stationId) {
    calculatedCost = await calculateCostFromRates(
      start.timestamp,
      end.timestamp,
      session.energyKwh,
      stationId,
      session.maxDemandKw
    );
  } else if (calculatedCost === undefined) {
    calculatedCost = session.energyKwh * 0.150;
  }

  const sessionData: ChargingSessionInsert = {
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

  console.log('Inserting session:', {
    transaction_id: sessionData.transaction_id,
    energy_kwh: sessionData.energy_consumed_kwh,
    cost: sessionData.calculated_cost,
    types: {
      energy: typeof sessionData.energy_consumed_kwh,
      cost: typeof sessionData.calculated_cost,
      maxDemand: typeof sessionData.max_demand_kw
    }
  });

  const { error } = await supabase
    .from('charging_sessions')
    .insert([sessionData]);

  if (error) {
    console.error('Database insert error:', error);
    throw error;
  }
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

  for (let i = 0; i < sessions.length; i++) {
    if (cancelToken?.cancelled) {
      console.log('Import cancelled by user');
      break;
    }

    const session = sessions[i];
    const rowNumber = i + 2;

    const validationErrors = validateSession(session, rowNumber);

    if (validationErrors.length > 0) {
      failCount++;
      errors.push({ row: rowNumber, session, errors: validationErrors });
      if (onProgress) onProgress(i + 1, sessions.length);
      continue;
    }

    try {
      await insertSession(session, batchId, stationId);
      successCount++;

      if (session.co2ReductionKg !== undefined && session.co2ReductionKg !== null) {
        co2Count++;
        totalCo2 += session.co2ReductionKg;
      }
    } catch (error) {
      // Check if this is a transaction_id unique constraint violation
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        // Unique constraint violation
        if ('message' in error && typeof error.message === 'string' && error.message.includes('transaction_id')) {
          skipCount++;
          const reason = `Transaction ID ${session.transactionId} already exists in database`;
          skipped.push({
            row: rowNumber,
            session,
            reason
          });
          console.log(`Skipping row ${rowNumber}: ${reason}`);
          if (onProgress) onProgress(i + 1, sessions.length);
          continue;
        }
      }

      // For all other errors, treat as failure
      failCount++;
      let errorMessage = 'Unknown error';

      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;

          if ('code' in error && error.code) {
            errorMessage += ` (code: ${error.code})`;
          }

          if ('details' in error && error.details) {
            errorMessage += ` - ${error.details}`;
          }

          if ('hint' in error && error.hint) {
            errorMessage += ` (hint: ${error.hint})`;
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      console.error(`Import error at row ${rowNumber}:`, errorMessage, error);
      errors.push({ row: rowNumber, session, errors: [errorMessage] });
    }

    if (onProgress) onProgress(i + 1, sessions.length);
  }

  let status: string;
  if (cancelToken?.cancelled) {
    status = 'cancelled';
  } else if (failCount > 0) {
    status = successCount > 0 ? 'completed_with_errors' : 'failed';
  } else {
    status = 'completed';
  }

  console.log('Import completed - CO2 Statistics:', {
    sessionsWithCO2: co2Count,
    totalSessions: successCount,
    totalCO2Reduction: totalCo2.toFixed(2) + ' kg',
    averageCO2PerSession: co2Count > 0 ? (totalCo2 / co2Count).toFixed(2) + ' kg' : 'N/A',
    percentageWithCO2: successCount > 0 ? ((co2Count / successCount) * 100).toFixed(1) + '%' : 'N/A'
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
