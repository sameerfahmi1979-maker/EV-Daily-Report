// =============================================
// accountingService.ts
// Financial data for accountant dashboard
// =============================================
import { supabase } from './supabase';

export interface PendingShift {
  id: string;
  shift_date: string;
  shift_type: string;
  total_amount_jod: number;
  handover_status: string;
  station_name: string;
  operator_name: string;
  hours_pending: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  sessions: number;
}

export async function getPendingDeposits(): Promise<PendingShift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, shift_date, shift_type, total_amount_jod, handover_status, created_at, stations(name), operators(name)')
    .in('handover_status', ['pending', 'printed'])
    .order('shift_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((sh: any) => {
    const created = new Date(sh.created_at);
    const hours = (Date.now() - created.getTime()) / 3600000;
    return {
      id: sh.id,
      shift_date: sh.shift_date,
      shift_type: sh.shift_type,
      total_amount_jod: Number(sh.total_amount_jod || 0),
      handover_status: sh.handover_status || 'pending',
      station_name: sh.stations?.name || '—',
      operator_name: sh.operators?.name || '—',
      hours_pending: Math.round(hours),
    };
  });
}

export async function getPendingHandovers(): Promise<PendingShift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, shift_date, shift_type, total_amount_jod, handover_status, created_at, stations(name), operators(name)')
    .eq('handover_status', 'deposited')
    .order('shift_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((sh: any) => ({
    id: sh.id,
    shift_date: sh.shift_date,
    shift_type: sh.shift_type,
    total_amount_jod: Number(sh.total_amount_jod || 0),
    handover_status: sh.handover_status || 'deposited',
    station_name: sh.stations?.name || '—',
    operator_name: sh.operators?.name || '—',
    hours_pending: 0,
  }));
}

export async function getDailyRevenue(startDate: string, endDate: string): Promise<DailyRevenue[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('shift_date, total_amount_jod')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date');

  if (error) throw error;

  // Group by date
  const map = new Map<string, DailyRevenue>();
  for (const sh of (data || []) as any[]) {
    const d = sh.shift_date;
    if (!map.has(d)) map.set(d, { date: d, revenue: 0, sessions: 0 });
    const entry = map.get(d)!;
    entry.revenue += Number(sh.total_amount_jod || 0);
    entry.sessions++;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getFinancialSummary(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('shifts')
    .select('total_amount_jod, total_kwh, handover_status')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);

  if (error) throw error;

  const shifts = data || [];
  const totalRevenue = shifts.reduce((s: number, sh: any) => s + Number(sh.total_amount_jod || 0), 0);
  const totalKwh = shifts.reduce((s: number, sh: any) => s + Number(sh.total_kwh || 0), 0);
  const pendingCount = shifts.filter((sh: any) => sh.handover_status === 'pending' || sh.handover_status === 'printed').length;
  const depositedCount = shifts.filter((sh: any) => sh.handover_status === 'deposited').length;
  const handedOverCount = shifts.filter((sh: any) => sh.handover_status === 'handed_over').length;

  return { totalRevenue, totalKwh, totalShifts: shifts.length, pendingCount, depositedCount, handedOverCount };
}
