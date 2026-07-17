// =============================================
// maintenanceService.ts
// CRUD for station maintenance records
// =============================================
import { supabase } from './supabase';

export type IssueType = 'maintenance' | 'breakdown' | 'software' | 'power_outage' | 'other';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export interface MaintenanceRecord {
  id: string;
  station_id: string;
  reported_by: string | null;
  issue_date: string;
  issue_type: IssueType;
  description: string;
  resolution: string | null;
  downtime_hours: number;
  status: IssueStatus;
  resolved_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  stations?: { name: string } | null;
  user_profiles?: { full_name: string } | null;
}

export async function getMaintenanceRecords(filters: {
  stationId?: string;
  status?: IssueStatus;
  startDate?: string;
  endDate?: string;
}): Promise<MaintenanceRecord[]> {
  let query = supabase
    .from('maintenance_log')
    .select('*, stations(name), user_profiles:reported_by(full_name)')
    .order('issue_date', { ascending: false });

  if (filters.stationId) query = query.eq('station_id', filters.stationId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.startDate) query = query.gte('issue_date', filters.startDate);
  if (filters.endDate) query = query.lte('issue_date', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as MaintenanceRecord[];
}

export async function createMaintenanceRecord(input: {
  station_id: string;
  issue_date: string;
  issue_type: IssueType;
  description: string;
  downtime_hours?: number;
}): Promise<MaintenanceRecord> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('maintenance_log')
    .insert([{
      station_id: input.station_id,
      reported_by: user?.id || null,
      issue_date: input.issue_date,
      issue_type: input.issue_type,
      description: input.description,
      downtime_hours: input.downtime_hours || 0,
      status: 'open',
    }])
    .select()
    .single();

  if (error) throw error;
  return data as MaintenanceRecord;
}

export async function updateMaintenanceRecord(
  id: string,
  updates: {
    status?: IssueStatus;
    resolution?: string;
    resolved_date?: string;
    downtime_hours?: number;
    description?: string;
    issue_type?: IssueType;
  }
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_log')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMaintenanceRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_log')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getOpenIssueCount(): Promise<number> {
  const { count, error } = await supabase
    .from('maintenance_log')
    .select('*', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress']);
  if (error) return 0;
  return count || 0;
}
