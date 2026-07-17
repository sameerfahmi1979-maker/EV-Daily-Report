// =============================================
// rosterService.ts
// CRUD for operator schedule / roster
// =============================================
import { supabase } from './supabase';

export interface ScheduleEntry {
  id: string;
  station_id: string;
  operator_id: string;
  schedule_date: string;
  shift_duration: string;
  shift_type: string;
  is_day_off: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  operator_name?: string;
}

export async function getSchedules(
  stationId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduleEntry[]> {
  const { data, error } = await supabase
    .from('operator_schedules')
    .select('*, operators(name)')
    .eq('station_id', stationId)
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)
    .order('schedule_date');

  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    operator_name: row.operators?.name || 'Unknown',
  }));
}

export async function upsertSchedule(entry: {
  station_id: string;
  operator_id: string;
  schedule_date: string;
  shift_duration: string;
  shift_type: string;
  is_day_off: boolean;
  notes?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('operator_schedules')
    .upsert([{
      ...entry,
      created_by: user?.id,
    }], { onConflict: 'station_id,operator_id,schedule_date' });

  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('operator_schedules')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
