import { supabase } from './supabase';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays } from 'date-fns';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SummaryMetrics {
  totalEnergy: number;
  totalRevenue: number;
  totalSessions: number;
  activeStations: number;
  energyChange?: number;
  revenueChange?: number;
  sessionsChange?: number;
}

export type EnergyGroupBy = 'day' | 'week' | 'month';

export interface EnergyTrendResult {
  data: EnergyDataPoint[];
  groupBy: EnergyGroupBy;
}

export interface EnergyDataPoint {
  date: string;
  energy: number;
  sessions: number;
}

export function determineGroupBy(dateRange: DateRange): EnergyGroupBy {
  const days = differenceInDays(dateRange.endDate, dateRange.startDate);
  if (days <= 7) return 'day';
  if (days <= 28) return 'week';
  return 'month';
}

export interface RevenueDataPoint {
  station: string;
  stationCode: string;
  revenue: number;
  sessions: number;
}

export interface StationUtilization {
  name: string;
  energy: number;
  sessions: number;
  percentage: number;
}

export interface RecentActivity {
  id: string;
  transactionId: string;
  station: string;
  energy: number;
  cost: number;
  startTime: string;
  hasBilling: boolean;
}

export interface ShiftMetrics {
  shift: string;
  energy: number;
  revenue: number;
  sessions: number;
  co2Reduction: number;
  avgDuration: number;
}

export interface ConnectorTypeMetrics {
  connectorType: string;
  energy: number;
  revenue: number;
  sessions: number;
  avgEnergy: number;
  co2Reduction: number;
}

export interface ChargerTypeMetrics {
  type: string;
  count: number;
  percentage: number;
}

export interface HourlyPattern {
  hour: number;
  energy: number;
  sessions: number;
  avgCost: number;
}

export interface DailyTransaction {
  date: string;
  [key: string]: string | number;
}

export function getDateRangePreset(preset: string): DateRange {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: endOfDay(now) };

    case 'yesterday': {
      const yesterday = subDays(today, 1);
      return { startDate: yesterday, endDate: endOfDay(yesterday) };
    }

    case 'last7days':
      return { startDate: subDays(today, 6), endDate: endOfDay(now) };

    case 'last30days':
      return { startDate: subDays(today, 29), endDate: endOfDay(now) };

    case 'thisMonth':
      return { startDate: startOfMonth(now), endDate: endOfDay(now) };

    case 'lastMonth': {
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      return { startDate: lastMonthStart, endDate: lastMonthEnd };
    }

    default:
      return { startDate: subDays(today, 29), endDate: endOfDay(now) };
  }
}

function formatDateParams(dateRange: DateRange) {
  return {
    p_start: format(dateRange.startDate, 'yyyy-MM-dd'),
    p_end: format(dateRange.endDate, 'yyyy-MM-dd')
  };
}

export async function getSummaryMetrics(dateRange: DateRange): Promise<SummaryMetrics> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_analytics_summary', params);
  if (error) throw error;

  return {
    totalEnergy: data?.totalEnergy || 0,
    totalRevenue: data?.totalRevenue || 0,
    totalSessions: data?.totalSessions || 0,
    activeStations: data?.activeStations || 0
  };
}

export async function getEnergyTrend(dateRange: DateRange): Promise<EnergyTrendResult> {
  const groupBy = determineGroupBy(dateRange);
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_energy_trend', {
    ...params,
    p_group_by: groupBy
  });
  if (error) throw error;

  const rows: { period: string; energy: number; sessions: number }[] = data || [];

  const formatted = rows.map(row => {
    const d = parseISO(row.period);
    let label: string;

    switch (groupBy) {
      case 'day':
        label = format(d, 'MMM dd');
        break;
      case 'week':
        label = format(d, "'W'w MMM dd");
        break;
      case 'month':
        label = format(d, 'MMM yyyy');
        break;
    }

    return {
      date: label,
      energy: row.energy || 0,
      sessions: row.sessions || 0
    };
  });

  return { data: formatted, groupBy };
}

export async function getRevenueByStation(dateRange: DateRange): Promise<RevenueDataPoint[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_revenue_by_station', params);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    station: row.station,
    stationCode: row.station_code || '',
    revenue: row.revenue || 0,
    sessions: row.sessions || 0
  }));
}

export async function getStationUtilization(dateRange: DateRange): Promise<StationUtilization[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_station_utilization', params);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    name: row.name,
    energy: row.energy || 0,
    sessions: row.sessions || 0,
    percentage: row.percentage || 0
  }));
}

export async function getRecentActivity(dateRange: DateRange, limit: number = 10): Promise<RecentActivity[]> {
  const { startDate, endDate } = dateRange;
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('charging_sessions')
    .select(`
      id,
      transaction_id,
      energy_consumed_kwh,
      start_ts,
      start_date,
      stations (
        name
      ),
      billing_calculations (
        id,
        total_amount
      )
    `)
    .gte('start_date', startDateStr)
    .lte('start_date', endDateStr)
    .order('start_ts', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data?.map((session: any) => ({
    id: session.id,
    transactionId: session.transaction_id,
    station: session.stations?.name || 'Unknown',
    energy: parseFloat(session.energy_consumed_kwh || '0'),
    cost: session.billing_calculations?.[0]?.total_amount
      ? parseFloat(session.billing_calculations[0].total_amount)
      : 0,
    startTime: session.start_ts,
    hasBilling: !!session.billing_calculations?.[0]
  })) || [];
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function getShiftComparison(dateRange: DateRange): Promise<ShiftMetrics[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_shift_comparison', params);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    shift: row.shift,
    energy: row.energy || 0,
    revenue: row.revenue || 0,
    sessions: row.sessions || 0,
    co2Reduction: row.co2_reduction || 0,
    avgDuration: row.avg_duration || 0
  }));
}

export async function getConnectorTypeComparison(dateRange: DateRange): Promise<ConnectorTypeMetrics[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_connector_type_comparison', params);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    connectorType: row.connector_type,
    energy: row.energy || 0,
    revenue: row.revenue || 0,
    sessions: row.sessions || 0,
    avgEnergy: row.avg_energy || 0,
    co2Reduction: row.co2_reduction || 0
  }));
}

export async function getChargerTypeBreakdown(dateRange: DateRange): Promise<ChargerTypeMetrics[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_charger_type_breakdown', params);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    type: row.type,
    count: row.count || 0,
    percentage: row.percentage || 0
  }));
}

export async function getBestTimeToCharge(dateRange: DateRange): Promise<HourlyPattern[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_best_time_to_charge', params);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    hour: row.hour,
    energy: row.energy || 0,
    sessions: row.sessions || 0,
    avgCost: row.avg_cost || 0
  }));
}

export async function getCO2ImpactMetrics(dateRange: DateRange) {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_co2_impact', params);
  if (error) throw error;

  return {
    totalCO2Reduction: data?.totalCO2Reduction || 0,
    treesEquivalent: data?.treesEquivalent || 0,
    kmDrivenEquivalent: data?.kmDrivenEquivalent || 0,
    energyUsed: data?.energyUsed || 0
  };
}

export async function getDailyTransactionsByConnector(dateRange: DateRange): Promise<DailyTransaction[]> {
  const params = formatDateParams(dateRange);

  const { data, error } = await supabase.rpc('get_daily_transactions_by_connector', params);
  if (error) throw error;

  const rows: { date: string; connector_type: string; count: number }[] = data || [];

  const allTypes = new Set<string>();
  rows.forEach(r => allTypes.add(r.connector_type));

  const dailyMap = new Map<string, Map<string, number>>();
  rows.forEach(row => {
    if (!dailyMap.has(row.date)) {
      dailyMap.set(row.date, new Map());
    }
    dailyMap.get(row.date)!.set(row.connector_type, row.count);
  });

  return Array.from(dailyMap.entries()).map(([date, typeMap]) => {
    const result: DailyTransaction = { date: format(parseISO(date), 'MMM dd') };
    allTypes.forEach(type => {
      result[type] = typeMap.get(type) || 0;
    });
    return result;
  });
}
