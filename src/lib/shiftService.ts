// =============================================
// shiftService.ts
// CRUD + aggregation for shifts table
// =============================================
import { supabase } from './supabase';

export interface Shift {
  id: string;
  station_id: string | null;
  operator_id: string | null;
  shift_duration: '8h' | '12h';
  shift_type: 'morning' | 'evening' | 'night' | 'extended_day' | 'extended_night';
  shift_date: string;
  start_time: string;
  end_time: string;
  import_batch_id: string | null;
  total_kwh: number;
  total_amount_jod: number;
  handover_status: 'pending' | 'printed' | 'deposited' | 'handed_over';
  bank_deposit_slip: string | null;
  bank_deposit_date: string | null;
  bank_deposit_reference: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined data
  stations?: { name: string } | null;
  operators?: { name: string; card_number: string } | null;
}

export interface CreateShiftInput {
  station_id: string;
  operator_id: string;
  shift_duration: '8h' | '12h';
  shift_type: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  import_batch_id?: string;
  notes?: string;
}

// Shift type definitions for time calculations
export const SHIFT_TYPES: Record<string, { label: string; duration: '8h' | '12h'; defaultStart: string; defaultEnd: string }> = {
  morning:        { label: 'Morning (08:00–16:00)',       duration: '8h',  defaultStart: '08:00', defaultEnd: '16:00' },
  evening:        { label: 'Evening (16:00–00:00)',       duration: '8h',  defaultStart: '16:00', defaultEnd: '00:00' },
  night:          { label: 'Night (00:00–08:00)',         duration: '8h',  defaultStart: '00:00', defaultEnd: '08:00' },
  extended_day:   { label: 'Extended Day (08:00–20:00)',  duration: '12h', defaultStart: '08:00', defaultEnd: '20:00' },
  extended_night: { label: 'Extended Night (20:00–08:00)', duration: '12h', defaultStart: '20:00', defaultEnd: '08:00' },
};

/**
 * Create a new shift record.
 */
export async function createShift(input: CreateShiftInput): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert([{
      station_id: input.station_id,
      operator_id: input.operator_id,
      shift_duration: input.shift_duration,
      shift_type: input.shift_type,
      shift_date: input.shift_date,
      start_time: input.start_time,
      end_time: input.end_time,
      import_batch_id: input.import_batch_id || null,
      notes: input.notes || null,
      handover_status: 'pending',
      total_kwh: 0,
      total_amount_jod: 0,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Shift;
}

/**
 * Get shifts with optional filters.
 */
export async function getShifts(filters?: {
  station_id?: string;
  operator_id?: string;
  date_from?: string;
  date_to?: string;
  handover_status?: string;
}): Promise<Shift[]> {
  let query = supabase
    .from('shifts')
    .select('*, stations(name), operators(name, card_number)')
    .order('shift_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (filters?.station_id) {
    query = query.eq('station_id', filters.station_id);
  }
  if (filters?.operator_id) {
    query = query.eq('operator_id', filters.operator_id);
  }
  if (filters?.date_from) {
    query = query.gte('shift_date', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('shift_date', filters.date_to);
  }
  if (filters?.handover_status) {
    query = query.eq('handover_status', filters.handover_status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Shift[];
}

/**
 * Get a single shift by ID with related data.
 */
export async function getShiftById(id: string): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*, stations(name), operators(name, card_number)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Shift;
}

/**
 * Update shift totals (called after billing calculation).
 */
export async function updateShiftTotals(
  shiftId: string,
  totalKwh: number,
  totalAmountJod: number
): Promise<void> {
  const { error } = await supabase
    .from('shifts')
    .update({
      total_kwh: totalKwh,
      total_amount_jod: totalAmountJod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shiftId);

  if (error) throw error;
}

/**
 * Update handover status with optional bank deposit info.
 */
export async function updateHandoverStatus(
  shiftId: string,
  status: 'pending' | 'printed' | 'deposited' | 'handed_over',
  depositInfo?: {
    bank_deposit_slip?: string;
    bank_deposit_date?: string;
    bank_deposit_reference?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    handover_status: status,
    updated_at: new Date().toISOString(),
  };

  if (depositInfo) {
    if (depositInfo.bank_deposit_slip !== undefined) {
      updateData.bank_deposit_slip = depositInfo.bank_deposit_slip;
    }
    if (depositInfo.bank_deposit_date !== undefined) {
      updateData.bank_deposit_date = depositInfo.bank_deposit_date;
    }
    if (depositInfo.bank_deposit_reference !== undefined) {
      updateData.bank_deposit_reference = depositInfo.bank_deposit_reference;
    }
  }

  const { error } = await supabase
    .from('shifts')
    .update(updateData)
    .eq('id', shiftId);

  if (error) throw error;
}

/**
 * Upload bank deposit slip to storage.
 */
export async function uploadDepositSlip(shiftId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `deposit-slips/${shiftId}/slip.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('company-assets')
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Link sessions to a shift by updating their shift_id and operator_id.
 */
export async function linkSessionsToShift(
  batchId: string,
  shiftId: string,
  operatorId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('charging_sessions')
    .update({
      shift_id: shiftId,
      operator_id: operatorId,
      updated_at: new Date().toISOString(),
    })
    .eq('import_batch_id', batchId)
    .select('id');

  if (error) throw error;
  return data?.length || 0;
}

/**
 * Delete a shift (does not delete sessions — only unlinks).
 */
export async function deleteShift(shiftId: string): Promise<void> {
  // Unlink sessions first
  await supabase
    .from('charging_sessions')
    .update({ shift_id: null })
    .eq('shift_id', shiftId);

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', shiftId);

  if (error) throw error;
}

/**
 * Get shift summary stats for dashboard.
 */
export async function getShiftSummary(stationId?: string, dateFrom?: string, dateTo?: string): Promise<{
  totalShifts: number;
  totalKwh: number;
  totalRevenue: number;
  pendingHandovers: number;
}> {
  let query = supabase
    .from('shifts')
    .select('total_kwh, total_amount_jod, handover_status');

  if (stationId) query = query.eq('station_id', stationId);
  if (dateFrom) query = query.gte('shift_date', dateFrom);
  if (dateTo) query = query.lte('shift_date', dateTo);

  const { data, error } = await query;
  if (error) throw error;

  const shifts = data || [];
  return {
    totalShifts: shifts.length,
    totalKwh: shifts.reduce((sum, s) => sum + (Number(s.total_kwh) || 0), 0),
    totalRevenue: shifts.reduce((sum, s) => sum + (Number(s.total_amount_jod) || 0), 0),
    pendingHandovers: shifts.filter(s => s.handover_status === 'pending').length,
  };
}
