// =============================================
// kpiService.ts
// Industry-standard KPI calculations for CSMS
// =============================================
import { supabase } from './supabase';

export interface KPIData {
  utilizationRate: number;       // %
  avgSessionDuration: number;    // minutes
  revenuePerCharger: number;     // JOD
  revenuePerKwh: number;         // JOD
  avgKwhPerSession: number;      // kWh
  sessionsPerDay: number;        // count
  peakHourPercent: number;       // %
  stationUptime: number;         // %
  totalRevenue: number;
  totalEnergy: number;
  totalSessions: number;
  // Comparison deltas
  revenueDelta: number;          // % change vs previous period
  energyDelta: number;
  sessionsDelta: number;
}

export async function getKPIs(
  startDate: string,
  endDate: string,
  stationId?: string,
): Promise<KPIData> {
  // Current period sessions
  let q = supabase
    .from('charging_sessions')
    .select('energy_consumed_kwh, calculated_cost, duration_minutes, start_time, station_id')
    .gte('start_date', startDate)
    .lte('start_date', endDate);
  if (stationId) q = q.eq('station_id', stationId);
  const { data: sessions, error } = await q;
  if (error) throw error;

  const rows = sessions || [];
  const totalSessions = rows.length;
  const totalEnergy = rows.reduce((s, r: any) => s + Number(r.energy_consumed_kwh || 0), 0);
  const totalRevenue = rows.reduce((s, r: any) => s + Number(r.calculated_cost || 0), 0);
  const totalDuration = rows.reduce((s, r: any) => s + Number(r.duration_minutes || 0), 0);

  // Days in period
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);

  // Station count
  let stationCount = 1;
  if (!stationId) {
    const { count } = await supabase
      .from('stations')
      .select('*', { count: 'exact', head: true });
    stationCount = Math.max(1, count || 1);
  }

  // Peak hour (assume peak = 10:00–18:00)
  const peakSessions = rows.filter((r: any) => {
    const hour = parseInt(r.start_time?.split(':')[0] || '0');
    return hour >= 10 && hour < 18;
  }).length;

  // Maintenance downtime
  let downtimeHours = 0;
  let mq = supabase
    .from('maintenance_log')
    .select('downtime_hours')
    .gte('issue_date', startDate)
    .lte('issue_date', endDate);
  if (stationId) mq = mq.eq('station_id', stationId);
  const { data: maint } = await mq;
  downtimeHours = (maint || []).reduce((s, m: any) => s + Number(m.downtime_hours || 0), 0);
  const totalHours = days * 24 * stationCount;
  const uptimeHours = Math.max(0, totalHours - downtimeHours);

  // Previous period (same length, before start)
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  const ps = prevStart.toISOString().slice(0, 10);
  const pe = prevEnd.toISOString().slice(0, 10);

  let pq = supabase
    .from('charging_sessions')
    .select('energy_consumed_kwh, calculated_cost')
    .gte('start_date', ps)
    .lte('start_date', pe);
  if (stationId) pq = pq.eq('station_id', stationId);
  const { data: prevSessions } = await pq;
  const prevRows = prevSessions || [];
  const prevRevenue = prevRows.reduce((s, r: any) => s + Number(r.calculated_cost || 0), 0);
  const prevEnergy = prevRows.reduce((s, r: any) => s + Number(r.energy_consumed_kwh || 0), 0);
  const prevCount = prevRows.length;

  const pctChange = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

  return {
    utilizationRate: totalHours > 0 ? (totalDuration / 60 / totalHours) * 100 : 0,
    avgSessionDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
    revenuePerCharger: totalRevenue / stationCount,
    revenuePerKwh: totalEnergy > 0 ? totalRevenue / totalEnergy : 0,
    avgKwhPerSession: totalSessions > 0 ? totalEnergy / totalSessions : 0,
    sessionsPerDay: totalSessions / days,
    peakHourPercent: totalSessions > 0 ? (peakSessions / totalSessions) * 100 : 0,
    stationUptime: totalHours > 0 ? (uptimeHours / totalHours) * 100 : 0,
    totalRevenue,
    totalEnergy,
    totalSessions,
    revenueDelta: pctChange(totalRevenue, prevRevenue),
    energyDelta: pctChange(totalEnergy, prevEnergy),
    sessionsDelta: pctChange(totalSessions, prevCount),
  };
}
