// =============================================
// operatorAnalyticsService.ts
// Data queries for operator performance metrics
// =============================================
import { supabase } from './supabase';

export interface OperatorMetric {
  operator_id: string;
  operator_name: string;
  card_number: string;
  total_shifts: number;
  total_sessions: number;
  total_kwh: number;
  total_revenue: number;
  avg_kwh_per_shift: number;
  avg_revenue_per_shift: number;
}

export async function getOperatorPerformance(
  startDate: string,
  endDate: string,
  stationId?: string,
): Promise<OperatorMetric[]> {
  let query = supabase
    .from('shifts')
    .select('operator_id, total_kwh, total_amount_jod, operators(name, card_number)')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);

  if (stationId) query = query.eq('station_id', stationId);

  const { data, error } = await query;
  if (error) throw error;

  // Group by operator
  const map = new Map<string, OperatorMetric>();
  for (const sh of (data || []) as any[]) {
    const id = sh.operator_id;
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        operator_id: id,
        operator_name: sh.operators?.name || 'Unknown',
        card_number: sh.operators?.card_number || '',
        total_shifts: 0,
        total_sessions: 0,
        total_kwh: 0,
        total_revenue: 0,
        avg_kwh_per_shift: 0,
        avg_revenue_per_shift: 0,
      });
    }
    const m = map.get(id)!;
    m.total_shifts++;
    m.total_kwh += Number(sh.total_kwh || 0);
    m.total_revenue += Number(sh.total_amount_jod || 0);
  }

  // Calculate averages
  for (const m of map.values()) {
    m.avg_kwh_per_shift = m.total_shifts > 0 ? m.total_kwh / m.total_shifts : 0;
    m.avg_revenue_per_shift = m.total_shifts > 0 ? m.total_revenue / m.total_shifts : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.total_revenue - a.total_revenue);
}

export interface OperatorTrend {
  date: string;
  kwh: number;
  revenue: number;
}

export async function getOperatorTrend(
  operatorId: string,
  startDate: string,
  endDate: string,
): Promise<OperatorTrend[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('shift_date, total_kwh, total_amount_jod')
    .eq('operator_id', operatorId)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date');

  if (error) throw error;

  return (data || []).map((sh: any) => ({
    date: sh.shift_date,
    kwh: Number(sh.total_kwh || 0),
    revenue: Number(sh.total_amount_jod || 0),
  }));
}
