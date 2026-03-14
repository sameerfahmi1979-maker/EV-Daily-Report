// =============================================
// reportDataService.ts
// Data-fetching service for all 19 report tabs.
// Each function accepts typed filters and returns
// typed results. All queries use fetchAllRows()
// for unlimited pagination.
// =============================================

import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from './supabase';
import { fetchAllRows } from './reportUtils';

// ─── Shared types ───────────────────────────────────────────────────

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
}

export interface BaseFilter extends DateRangeFilter {
  stationId?: string;
  operatorId?: string;
  cardNumber?: string;
}

export interface TransactionFilter extends BaseFilter {
  search?: string;
}

export interface ShiftFilter extends BaseFilter {
  shiftType?: string;
}

export interface HandoverFilter extends BaseFilter {
  handoverStatus?: string;
  bankReference?: string;
}

export interface PerformanceFilter extends BaseFilter {
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export interface BillingFilter extends BaseFilter {
  rateStructureId?: string;
  amountMin?: number;
  amountMax?: number;
}

export interface MaintenanceFilter extends BaseFilter {
  status?: string;
}

export interface EnergyFilter extends BaseFilter {
  chargerType?: string;
  timeOfDay?: string;
}

// ─── Result types ───────────────────────────────────────────────────

export interface Totals {
  sessions: number;
  energy: number;
  revenue: number;
  duration: number;
}

export interface TransactionRow {
  id: string;
  transaction_id: string;
  charge_id: string;
  card_number: string;
  station_name: string;
  station_code: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  duration_minutes: number;
  energy_kwh: number;
  max_demand_kw: number | null;
  cost_jod: number | null;
  status: string;
  user_identifier: string;
}

export interface ShiftRow {
  id: string;
  shift_date: string;
  station_name: string;
  station_code: string;
  operator_name: string;
  card_number: string;
  shift_type: string;
  shift_duration: string;
  total_sessions: number;
  total_kwh: number;
  total_amount_jod: number;
  handover_status: string;
  bank_reference: string;
  deposit_date: string;
}

export interface StationStat {
  station_id: string;
  station_name: string;
  station_code: string;
  total_sessions: number;
  total_energy: number;
  total_revenue: number;
  avg_duration: number;
  avg_energy_per_session: number;
}

export interface OperatorStat {
  operator_id: string;
  operator_name: string;
  card_number: string;
  total_shifts: number;
  total_sessions: number;
  total_energy: number;
  total_revenue: number;
  avg_sessions_per_shift: number;
  handover_rate: number;
}

export interface TimeSeriesPoint {
  label: string;
  date: string;
  sessions: number;
  energy: number;
  revenue: number;
}

// ─── Helper: build timestamp from date + optional time ──────────────

function buildTimestamp(date: Date, time?: string, end = false): string {
  if (time) return `${format(date, 'yyyy-MM-dd')}T${time}:${end ? '59' : '00'}`;
  return `${format(date, 'yyyy-MM-dd')}T${end ? '23:59:59' : '00:00:00'}`;
}

// ─── Helper: compute totals from sessions ────────────────────────────

function computeTotals(sessions: any[]): Totals {
  return {
    sessions: sessions.length,
    energy: sessions.reduce((s, r) => s + (parseFloat(r.energy_consumed_kwh) || 0), 0),
    revenue: sessions.reduce((s, r) => {
      const b = r.billing_calculations?.[0];
      return s + (b ? parseFloat(b.total_amount) : 0);
    }, 0),
    duration: sessions.reduce((s, r) => s + (parseFloat(r.duration_minutes) || 0), 0),
  };
}

function computeShiftTotals(shifts: any[]): Totals {
  return {
    sessions: shifts.reduce((s, sh) => s + Number(sh.total_sessions || 0), 0),
    energy: shifts.reduce((s, sh) => s + Number(sh.total_kwh || 0), 0),
    revenue: shifts.reduce((s, sh) => s + Number(sh.total_amount_jod || 0), 0),
    duration: shifts.length,
  };
}

// ─── Helper: map raw session ─────────────────────────────────────────

function mapSession(s: any): TransactionRow {
  return {
    id: s.id,
    transaction_id: s.transaction_id || '',
    charge_id: s.charge_id || '',
    card_number: s.card_number || '',
    station_name: s.stations?.name || 'Unknown',
    station_code: s.stations?.station_code || '',
    start_date: s.start_date || '',
    start_time: s.start_ts ? format(new Date(s.start_ts), 'HH:mm:ss') : '',
    end_date: s.end_date || '',
    end_time: s.end_ts ? format(new Date(s.end_ts), 'HH:mm:ss') : '',
    duration_minutes: parseFloat(s.duration_minutes) || 0,
    energy_kwh: parseFloat(s.energy_consumed_kwh) || 0,
    max_demand_kw: s.max_demand_kw ? parseFloat(s.max_demand_kw) : null,
    cost_jod: s.billing_calculations?.[0]?.total_amount
      ? parseFloat(s.billing_calculations[0].total_amount)
      : null,
    status: s.billing_calculations?.length ? 'Calculated' : 'Pending',
    user_identifier: s.user_identifier || '',
  };
}

function mapShift(sh: any): ShiftRow {
  return {
    id: sh.id,
    shift_date: sh.shift_date || '',
    station_name: sh.stations?.name || '—',
    station_code: sh.stations?.station_code || '',
    operator_name: sh.operators?.name || '—',
    card_number: sh.operators?.card_number || '',
    shift_type: sh.shift_type || '—',
    shift_duration: sh.shift_duration || '—',
    total_sessions: Number(sh.total_sessions || 0),
    total_kwh: Number(sh.total_kwh || 0),
    total_amount_jod: Number(sh.total_amount_jod || 0),
    handover_status: sh.handover_status || '—',
    bank_reference: sh.bank_reference || '',
    deposit_date: sh.deposit_date || '',
  };
}

// =====================================================================
// TAB 1: ALL TRANSACTIONS
// =====================================================================

export async function fetchAllTransactions(filters: TransactionFilter) {
  const startTs = buildTimestamp(filters.startDate, filters.startTime);
  const endTs = buildTimestamp(filters.endDate, filters.endTime, true);

  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(name, station_code), billing_calculations(total_amount)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      if (filters.cardNumber) q = q.eq('card_number', filters.cardNumber);
      return q;
    }
  );

  let rows = sessions.map(mapSession);

  // Client-side search filter
  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.transaction_id.toLowerCase().includes(term) ||
        r.station_name.toLowerCase().includes(term) ||
        r.card_number.toLowerCase().includes(term)
    );
  }

  return { rows, totals: computeTotals(sessions) };
}

// =====================================================================
// TAB 2: SHIFT TRANSACTIONS
// =====================================================================

export async function fetchShiftTransactions(filters: ShiftFilter) {
  // Use string dates directly to avoid timezone-shift when parsing Date
  const startStr = typeof filters.startDate === 'string' ? filters.startDate : format(filters.startDate, 'yyyy-MM-dd');
  const endStr = typeof filters.endDate === 'string' ? filters.endDate : format(filters.endDate, 'yyyy-MM-dd');

  let allShifts: any[] = [];
  let from = 0;
  const PAGE = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('shifts')
      .select('*, stations(name, station_code), operators(name, card_number)')
      .gte('shift_date', startStr)
      .lte('shift_date', endStr)
      .order('shift_date', { ascending: false })
      .range(from, from + PAGE - 1);

    if (filters.stationId) query = query.eq('station_id', filters.stationId);
    if (filters.operatorId) query = query.eq('operator_id', filters.operatorId);
    if (filters.shiftType && filters.shiftType !== 'all') query = query.eq('shift_type', filters.shiftType);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) { hasMore = false; break; }
    allShifts = allShifts.concat(data);
    from += PAGE;
    if (data.length < PAGE) hasMore = false;
  }

  const rows = allShifts.map(mapShift);
  return { rows, totals: computeShiftTotals(allShifts) };
}

// =====================================================================
// TAB 3: OPERATOR TRANSACTIONS
// =====================================================================

export async function fetchOperatorTransactions(filters: TransactionFilter) {
  if (!filters.cardNumber) return { rows: [], totals: { sessions: 0, energy: 0, revenue: 0, duration: 0 } };

  const startTs = buildTimestamp(filters.startDate, filters.startTime);
  const endTs = buildTimestamp(filters.endDate, filters.endTime, true);

  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(name, station_code), billing_calculations(total_amount)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs).eq('card_number', filters.cardNumber!);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  return { rows: sessions.map(mapSession), totals: computeTotals(sessions) };
}

// =====================================================================
// TAB 4: HANDOVER HISTORY
// =====================================================================

export async function fetchHandoverHistory(filters: HandoverFilter) {
  const startStr = format(filters.startDate, 'yyyy-MM-dd');
  const endStr = format(filters.endDate, 'yyyy-MM-dd');

  let query = supabase
    .from('shifts')
    .select('*, stations(name, station_code), operators(name, card_number)')
    .gte('shift_date', startStr)
    .lte('shift_date', endStr)
    .order('shift_date', { ascending: false });

  if (filters.stationId) query = query.eq('station_id', filters.stationId);
  if (filters.operatorId) query = query.eq('operator_id', filters.operatorId);
  if (filters.handoverStatus && filters.handoverStatus !== 'all') {
    query = query.eq('handover_status', filters.handoverStatus);
  }

  const { data: shifts, error } = await query;
  if (error) throw error;

  let rows = (shifts || []).map(mapShift);

  // Client-side bank reference filter
  if (filters.bankReference) {
    const ref = filters.bankReference.toLowerCase();
    rows = rows.filter((r) => r.bank_reference.toLowerCase().includes(ref));
  }

  // Status summary
  const statusSummary: Record<string, { count: number; total: number }> = {};
  for (const row of rows) {
    const status = row.handover_status || 'unknown';
    if (!statusSummary[status]) statusSummary[status] = { count: 0, total: 0 };
    statusSummary[status].count++;
    statusSummary[status].total += row.total_amount_jod;
  }

  return { rows, statusSummary, totals: computeShiftTotals(shifts || []) };
}

// =====================================================================
// TAB 5: STATION PERFORMANCE
// =====================================================================

export async function fetchStationPerformance(filters: BaseFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);

  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(id, name, station_code), billing_calculations(total_amount)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  // Group by station
  const stationMap: Record<string, { sessions: any[]; station: any }> = {};
  for (const s of sessions) {
    const sid = s.station_id || 'unknown';
    if (!stationMap[sid]) stationMap[sid] = { sessions: [], station: s.stations };
    stationMap[sid].sessions.push(s);
  }

  const stationStats: StationStat[] = Object.entries(stationMap).map(([id, { sessions: ss, station }]) => {
    const totals = computeTotals(ss);
    return {
      station_id: id,
      station_name: station?.name || 'Unknown',
      station_code: station?.station_code || '',
      total_sessions: totals.sessions,
      total_energy: totals.energy,
      total_revenue: totals.revenue,
      avg_duration: totals.sessions > 0 ? totals.duration / totals.sessions : 0,
      avg_energy_per_session: totals.sessions > 0 ? totals.energy / totals.sessions : 0,
    };
  });

  stationStats.sort((a, b) => b.total_revenue - a.total_revenue);

  return { stationStats, totals: computeTotals(sessions) };
}

// =====================================================================
// TAB 6: OPERATOR PERFORMANCE
// =====================================================================

export async function fetchOperatorPerformance(filters: BaseFilter) {
  const startStr = typeof filters.startDate === 'string' ? filters.startDate : format(filters.startDate, 'yyyy-MM-dd');
  const endStr = typeof filters.endDate === 'string' ? filters.endDate : format(filters.endDate, 'yyyy-MM-dd');

  let allShifts: any[] = [];
  let from = 0;
  const PAGE = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('shifts')
      .select('*, stations(name), operators(id, name, card_number)')
      .gte('shift_date', startStr)
      .lte('shift_date', endStr)
      .order('shift_date', { ascending: false })
      .range(from, from + PAGE - 1);

    if (filters.stationId) query = query.eq('station_id', filters.stationId);
    if (filters.operatorId) query = query.eq('operator_id', filters.operatorId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) { hasMore = false; break; }
    allShifts = allShifts.concat(data);
    from += PAGE;
    if (data.length < PAGE) hasMore = false;
  }

  // Group by operator
  const opMap: Record<string, { shifts: any[]; operator: any }> = {};
  for (const sh of allShifts) {
    const oid = sh.operator_id || 'unknown';
    if (!opMap[oid]) opMap[oid] = { shifts: [], operator: (sh as any).operators };
    opMap[oid].shifts.push(sh);
  }

  const operatorStats: OperatorStat[] = Object.entries(opMap).map(([id, { shifts: ss, operator }]) => {
    const totalSh = ss.length;
    const totalSessions = ss.reduce((s: number, sh: any) => s + Number(sh.total_sessions || 0), 0);
    const totalEnergy = ss.reduce((s: number, sh: any) => s + Number(sh.total_kwh || 0), 0);
    const totalRevenue = ss.reduce((s: number, sh: any) => s + Number(sh.total_amount_jod || 0), 0);
    const handedOver = ss.filter((sh: any) => sh.handover_status === 'handed_over' || sh.handover_status === 'deposited').length;

    return {
      operator_id: id,
      operator_name: operator?.name || 'Unknown',
      card_number: operator?.card_number || '',
      total_shifts: totalSh,
      total_sessions: totalSessions,
      total_energy: totalEnergy,
      total_revenue: totalRevenue,
      avg_sessions_per_shift: totalSh > 0 ? totalSessions / totalSh : 0,
      handover_rate: totalSh > 0 ? (handedOver / totalSh) * 100 : 0,
    };
  });

  operatorStats.sort((a, b) => b.total_revenue - a.total_revenue);

  return { operatorStats, totals: computeShiftTotals(allShifts) };
}

// =====================================================================
// TAB 7: FULL PERFORMANCE
// =====================================================================

export async function fetchFullPerformance(filters: PerformanceFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);

  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(id, name, station_code), billing_calculations(total_amount)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      if (filters.cardNumber) q = q.eq('card_number', filters.cardNumber);
      return q;
    }
  );

  // Build time series
  const granularity = filters.granularity || 'daily';
  let intervals: Date[];
  let labelFn: (d: Date) => string;

  if (granularity === 'monthly') {
    intervals = eachMonthOfInterval({ start: filters.startDate, end: filters.endDate });
    labelFn = (d) => format(d, 'MMM yyyy');
  } else if (granularity === 'weekly') {
    intervals = eachWeekOfInterval({ start: filters.startDate, end: filters.endDate });
    labelFn = (d) => format(d, 'dd MMM');
  } else {
    intervals = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
    labelFn = (d) => format(d, 'dd/MM');
  }

  const timeSeries: TimeSeriesPoint[] = intervals.map((d) => {
    let periodStart: Date, periodEnd: Date;
    if (granularity === 'monthly') {
      periodStart = startOfMonth(d);
      periodEnd = endOfMonth(d);
    } else if (granularity === 'weekly') {
      periodStart = startOfWeek(d);
      periodEnd = endOfWeek(d);
    } else {
      periodStart = d;
      periodEnd = d;
    }

    const startStr = format(periodStart, 'yyyy-MM-dd');
    const endStr = format(periodEnd, 'yyyy-MM-dd');

    const periodSessions = sessions.filter((s: any) => {
      const sDate = s.start_date;
      return sDate >= startStr && sDate <= endStr;
    });

    const pt = computeTotals(periodSessions);
    return {
      label: labelFn(d),
      date: startStr,
      sessions: pt.sessions,
      energy: pt.energy,
      revenue: pt.revenue,
    };
  });

  // Station breakdown
  const stationMap: Record<string, any[]> = {};
  sessions.forEach((s: any) => {
    const name = s.stations?.name || 'Unknown';
    if (!stationMap[name]) stationMap[name] = [];
    stationMap[name].push(s);
  });

  const stationBreakdown = Object.entries(stationMap).map(([name, ss]) => ({
    name,
    ...computeTotals(ss),
  }));
  stationBreakdown.sort((a, b) => b.revenue - a.revenue);

  // Operator breakdown (from shifts)
  const startStr = format(filters.startDate, 'yyyy-MM-dd');
  const endStr = format(filters.endDate, 'yyyy-MM-dd');
  let shiftQuery = supabase
    .from('shifts')
    .select('*, operators(name, card_number)')
    .gte('shift_date', startStr)
    .lte('shift_date', endStr);
  if (filters.stationId) shiftQuery = shiftQuery.eq('station_id', filters.stationId);

  const { data: shifts } = await shiftQuery;
  const opMap: Record<string, { name: string; revenue: number; sessions: number }> = {};
  for (const sh of (shifts || [])) {
    const name = (sh as any).operators?.name || 'Unknown';
    if (!opMap[name]) opMap[name] = { name, revenue: 0, sessions: 0 };
    opMap[name].revenue += Number(sh.total_amount_jod || 0);
    opMap[name].sessions += Number(sh.total_sessions || 0);
  }
  const operatorBreakdown = Object.values(opMap).sort((a, b) => b.revenue - a.revenue);

  return {
    timeSeries,
    stationBreakdown,
    operatorBreakdown,
    totals: computeTotals(sessions),
  };
}

// =====================================================================
// TAB 8: PEAK HOURS / UTILIZATION
// =====================================================================

export async function fetchPeakHoursUtilization(filters: BaseFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);

  const sessions = await fetchAllRows(
    'charging_sessions',
    'start_ts, energy_consumed_kwh',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  // Build 24×7 heatmap (hour × day-of-week)
  const heatmapData: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0));
  const energyByHour: number[] = Array(24).fill(0);

  for (const s of sessions) {
    const d = new Date(s.start_ts);
    const hour = d.getHours();
    const day = d.getDay(); // 0=Sun, 6=Sat
    heatmapData[hour][day]++;
    energyByHour[hour] += parseFloat(s.energy_consumed_kwh) || 0;
  }

  // Find peak
  let peakHour = 0,
    peakDay = 0,
    maxCount = 0;
  for (let h = 0; h < 24; h++) {
    for (let d = 0; d < 7; d++) {
      if (heatmapData[h][d] > maxCount) {
        maxCount = heatmapData[h][d];
        peakHour = h;
        peakDay = d;
      }
    }
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    heatmapData,
    energyByHour,
    peakHour,
    peakDay: dayNames[peakDay],
    busiestDay: dayNames[peakDay],
    totalSessions: sessions.length,
  };
}

// =====================================================================
// TAB 9: OPERATOR ATTENDANCE
// =====================================================================

export async function fetchOperatorAttendance(filters: BaseFilter) {
  const startStr = format(filters.startDate, 'yyyy-MM-dd');
  const endStr = format(filters.endDate, 'yyyy-MM-dd');

  // Fetch actual shifts
  let query = supabase
    .from('shifts')
    .select('*, operators(id, name, card_number)')
    .gte('shift_date', startStr)
    .lte('shift_date', endStr)
    .order('shift_date', { ascending: false });

  if (filters.stationId) query = query.eq('station_id', filters.stationId);
  if (filters.operatorId) query = query.eq('operator_id', filters.operatorId);

  const { data: shifts, error } = await query;
  if (error) throw error;

  // Group by operator
  const opMap: Record<string, { operator: any; shifts: any[] }> = {};
  for (const sh of (shifts || [])) {
    const oid = sh.operator_id || 'unknown';
    if (!opMap[oid]) opMap[oid] = { operator: (sh as any).operators, shifts: [] };
    opMap[oid].shifts.push(sh);
  }

  // Calculate days in range for estimated scheduled shifts
  const daysInRange = Math.ceil(
    (filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const rows = Object.entries(opMap).map(([_id, { operator, shifts: ss }]) => ({
    operator_name: operator?.name || 'Unknown',
    card_number: operator?.card_number || '',
    actual_shifts: ss.length,
    estimated_scheduled: daysInRange, // simplified—1 per day
    missed_shifts: Math.max(0, daysInRange - ss.length),
    attendance_pct: Math.min(100, (ss.length / Math.max(daysInRange, 1)) * 100),
    total_sessions: ss.reduce((s: number, sh: any) => s + Number(sh.total_sessions || 0), 0),
    total_revenue: ss.reduce((s: number, sh: any) => s + Number(sh.total_amount_jod || 0), 0),
  }));

  rows.sort((a, b) => b.attendance_pct - a.attendance_pct);

  return { rows, totals: computeShiftTotals(shifts || []) };
}

// =====================================================================
// TAB 10: REVENUE BREAKDOWN
// =====================================================================

export async function fetchRevenueBreakdown(filters: BillingFilter) {
  const startStr = format(filters.startDate, 'yyyy-MM-dd');
  const endStr = format(filters.endDate, 'yyyy-MM-dd');

  // Fetch billing calculations with breakdown items
  let query = supabase
    .from('billing_calculations')
    .select('*, billing_breakdown_items(*), charging_sessions!inner(station_id, stations(name))')
    .gte('calculation_date', startStr)
    .lte('calculation_date', endStr);

  if (filters.stationId) {
    query = query.eq('charging_sessions.station_id', filters.stationId);
  }

  const { data: billings, error } = await query;
  if (error) throw error;

  // Aggregate by period
  const byPeriod: Record<string, { sessions: number; energy: number; revenue: number }> = {};
  let totalFixed = 0;

  for (const bill of (billings || [])) {
    const items = bill.billing_breakdown_items || [];
    for (const item of items) {
      const period = item.period_name || 'Standard';
      if (!byPeriod[period]) byPeriod[period] = { sessions: 0, energy: 0, revenue: 0 };
      byPeriod[period].energy += parseFloat(item.energy_kwh) || 0;
      byPeriod[period].revenue += parseFloat(item.line_total) || 0;
    }
    if (byPeriod[Object.keys(byPeriod)[0]]) {
      // count session once
    }

    // Fixed charges from breakdown JSON
    const breakdown = bill.breakdown as any;
    const fixedCharges = breakdown?.fixedChargesList || [];
    for (const fc of fixedCharges) {
      totalFixed += parseFloat(fc.amount) || 0;
    }
  }

  const rows = Object.entries(byPeriod).map(([period, data]) => ({
    category: period,
    ...data,
  }));

  if (totalFixed > 0) {
    rows.push({ category: 'Fixed Charges', sessions: 0, energy: 0, revenue: totalFixed });
  }

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const rowsWithPct = rows.map((r) => ({
    ...r,
    pct_of_total: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
  }));

  return {
    rows: rowsWithPct,
    totals: {
      sessions: (billings || []).length,
      energy: rows.reduce((s, r) => s + r.energy, 0),
      revenue: totalRevenue,
      duration: 0,
      fixedCharges: totalFixed,
      energyCharges: totalRevenue - totalFixed,
    },
  };
}

// =====================================================================
// TAB 11: INVOICE HISTORY
// =====================================================================

export async function fetchInvoiceHistory(filters: BillingFilter) {
  const startStr = format(filters.startDate, 'yyyy-MM-dd');
  const endStr = format(filters.endDate, 'yyyy-MM-dd');

  let query = supabase
    .from('billing_calculations')
    .select('*, charging_sessions!inner(transaction_id, station_id, stations(name))')
    .gte('calculation_date', startStr)
    .lte('calculation_date', endStr)
    .order('calculation_date', { ascending: false });

  if (filters.stationId) {
    query = query.eq('charging_sessions.station_id', filters.stationId);
  }

  const { data: billings, error } = await query;
  if (error) throw error;

  let rows = (billings || []).map((b: any) => ({
    id: b.id,
    transaction_id: b.charging_sessions?.transaction_id || '',
    station_name: b.charging_sessions?.stations?.name || 'Unknown',
    date: b.calculation_date,
    subtotal: parseFloat(b.subtotal) || 0,
    fixed_charges: parseFloat(b.total_amount) - parseFloat(b.subtotal) || 0,
    total_amount: parseFloat(b.total_amount) || 0,
    currency: 'JOD',
  }));

  // Amount range filter
  if (filters.amountMin !== undefined) {
    rows = rows.filter((r) => r.total_amount >= filters.amountMin!);
  }
  if (filters.amountMax !== undefined) {
    rows = rows.filter((r) => r.total_amount <= filters.amountMax!);
  }

  const totalInvoiced = rows.reduce((s, r) => s + r.total_amount, 0);

  return {
    rows,
    totals: {
      count: rows.length,
      totalInvoiced,
      avgAmount: rows.length > 0 ? totalInvoiced / rows.length : 0,
    },
  };
}

// =====================================================================
// TAB 12: UNPAID / PENDING BILLING
// =====================================================================

export async function fetchPendingBilling(filters: BaseFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);

  // Fetch sessions without billing_calculations
  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(name, station_code), billing_calculations(id)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  // Filter to only unbilled
  const unbilled = sessions.filter(
    (s: any) => !s.billing_calculations || s.billing_calculations.length === 0
  );

  const rows = unbilled.map(mapSession);
  const totalEnergy = unbilled.reduce((s: number, r: any) => s + (parseFloat(r.energy_consumed_kwh) || 0), 0);

  return {
    rows,
    totals: {
      unbilledCount: rows.length,
      totalEnergy,
      estimatedLoss: 0, // Would need rate data to estimate
    },
  };
}

// =====================================================================
// TAB 13: MONTHLY FINANCIAL SUMMARY
// =====================================================================

export async function fetchMonthlyFinancial(filters: PerformanceFilter) {
  // Determine the 12-month window
  const endMonth = typeof filters.endDate === 'string' ? new Date(filters.endDate + 'T12:00:00') : filters.endDate;
  const months: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    months.push(subMonths(endMonth, i));
  }

  // Single query for the entire 12-month span
  const rangeStart = startOfMonth(months[0]);
  const rangeEnd = endOfMonth(months[months.length - 1]);
  const startTs = buildTimestamp(rangeStart);
  const endTs = buildTimestamp(rangeEnd, undefined, true);

  const allSessions = await fetchAllRows(
    'charging_sessions',
    'start_ts, start_date, energy_consumed_kwh, billing_calculations(total_amount)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  // Group by month key (yyyy-MM)
  const byMonth: Record<string, any[]> = {};
  for (const s of allSessions) {
    const d = new Date(s.start_ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(s);
  }

  const monthlyData: Array<{
    month: string;
    monthDate: string;
    sessions: number;
    energy: number;
    revenue: number;
    avgRevenue: number;
    growth: number;
  }> = [];

  let prevRevenue = 0;
  for (const month of months) {
    const key = format(month, 'yyyy-MM');
    const monthSessions = byMonth[key] || [];
    const totals = computeTotals(monthSessions);
    const growth = prevRevenue > 0 ? ((totals.revenue - prevRevenue) / prevRevenue) * 100 : 0;

    monthlyData.push({
      month: format(month, 'MMM yyyy'),
      monthDate: key,
      sessions: totals.sessions,
      energy: totals.energy,
      revenue: totals.revenue,
      avgRevenue: totals.sessions > 0 ? totals.revenue / totals.sessions : 0,
      growth,
    });

    prevRevenue = totals.revenue;
  }

  // YTD totals
  const ytd = monthlyData.reduce(
    (acc, m) => ({
      sessions: acc.sessions + m.sessions,
      energy: acc.energy + m.energy,
      revenue: acc.revenue + m.revenue,
    }),
    { sessions: 0, energy: 0, revenue: 0 }
  );

  return { monthlyData, ytdTotals: ytd };
}

// =====================================================================
// TAB 14: STATION PROFITABILITY
// =====================================================================

export async function fetchStationProfitability(filters: BaseFilter) {
  // Reuse station performance data
  const { stationStats, totals } = await fetchStationPerformance(filters);

  // Fetch rate structures for cost estimation
  const { data: rates } = await supabase
    .from('rate_structures')
    .select('station_id, rate_per_kwh');

  const rateMap: Record<string, number> = {};
  for (const r of (rates || [])) {
    rateMap[r.station_id] = parseFloat(r.rate_per_kwh) || 0;
  }

  const rows = stationStats.map((s) => {
    // Rough cost estimate: avg cost rate × energy
    const costRate = rateMap[s.station_id] || 0.05; // fallback
    const estimatedCost = s.total_energy * costRate * 0.6; // operator's cost ratio estimate
    const grossMargin = s.total_revenue - estimatedCost;
    const marginPct = s.total_revenue > 0 ? (grossMargin / s.total_revenue) * 100 : 0;

    return {
      ...s,
      estimated_cost: estimatedCost,
      gross_margin: grossMargin,
      margin_pct: marginPct,
    };
  });

  rows.sort((a, b) => b.gross_margin - a.gross_margin);

  return { rows, totals };
}

// =====================================================================
// TAB 15: RATE STRUCTURE IMPACT
// =====================================================================

export async function fetchRateStructureImpact(filters: BillingFilter) {
  const startStr = format(filters.startDate, 'yyyy-MM-dd');
  const endStr = format(filters.endDate, 'yyyy-MM-dd');

  // Fetch billings with rate structure info
  const { data: billings, error } = await supabase
    .from('billing_calculations')
    .select('*, charging_sessions!inner(station_id, energy_consumed_kwh), billing_breakdown_items(*)')
    .gte('calculation_date', startStr)
    .lte('calculation_date', endStr);

  if (error) throw error;

  if (filters.stationId) {
    // filter client-side since inner join already done
  }

  // Group by rate structure (via breakdown items)
  const rateMap: Record<string, {
    period: string;
    sessions: number;
    totalKwh: number;
    totalRevenue: number;
  }> = {};

  for (const bill of (billings || [])) {
    const items = bill.billing_breakdown_items || [];
    for (const item of items) {
      const key = `${item.period_name || 'Standard'}|${item.rate_per_kwh || 0}`;
      if (!rateMap[key]) rateMap[key] = { period: item.period_name || 'Standard', sessions: 0, totalKwh: 0, totalRevenue: 0 };
      rateMap[key].sessions++;
      rateMap[key].totalKwh += parseFloat(item.energy_kwh) || 0;
      rateMap[key].totalRevenue += parseFloat(item.line_total) || 0;
    }
  }

  const rows = Object.entries(rateMap).map(([_key, data]) => ({
    rate_structure: data.period,
    sessions: data.sessions,
    avg_kwh: data.sessions > 0 ? data.totalKwh / data.sessions : 0,
    avg_revenue: data.sessions > 0 ? data.totalRevenue / data.sessions : 0,
    total_revenue: data.totalRevenue,
  }));

  rows.sort((a, b) => b.total_revenue - a.total_revenue);

  return { rows };
}

// =====================================================================
// TAB 16: DAILY OPERATIONS SUMMARY
// =====================================================================

export async function fetchDailyOpsSummary(filters: BaseFilter) {
  const dateStr = format(filters.startDate, 'yyyy-MM-dd');
  const startTs = `${dateStr}T00:00:00`;
  const endTs = `${dateStr}T23:59:59`;

  // Fetch shifts for the day
  let shiftQuery = supabase
    .from('shifts')
    .select('*, stations(name), operators(name, card_number)')
    .eq('shift_date', dateStr)
    .order('shift_type');

  if (filters.stationId) shiftQuery = shiftQuery.eq('station_id', filters.stationId);
  const { data: shifts } = await shiftQuery;

  // Fetch sessions for the day
  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(name), billing_calculations(total_amount)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  const dayTotals = {
    shifts: (shifts || []).length,
    operators: new Set((shifts || []).map((sh: any) => sh.operator_id)).size,
    ...computeTotals(sessions),
  };

  return {
    shifts: (shifts || []).map(mapShift),
    sessions: sessions.map(mapSession),
    dayTotals,
    date: dateStr,
  };
}

// =====================================================================
// TAB 17: ENERGY CONSUMPTION
// =====================================================================

export async function fetchEnergyConsumption(filters: EnergyFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);

  const sessions = await fetchAllRows(
    'charging_sessions',
    '*, stations(name, station_code)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  // Group by station
  const byStation: Record<string, { name: string; sessions: number; energy: number; maxDemand: number }> = {};
  for (const s of sessions) {
    const name = s.stations?.name || 'Unknown';
    if (!byStation[name]) byStation[name] = { name, sessions: 0, energy: 0, maxDemand: 0 };
    byStation[name].sessions++;
    byStation[name].energy += parseFloat(s.energy_consumed_kwh) || 0;
    const demand = parseFloat(s.max_demand_kw) || 0;
    if (demand > byStation[name].maxDemand) byStation[name].maxDemand = demand;
  }

  // Group by date for trend
  const byDate: Record<string, { sessions: number; energy: number }> = {};
  for (const s of sessions) {
    const date = s.start_date || format(new Date(s.start_ts), 'yyyy-MM-dd');
    if (!byDate[date]) byDate[date] = { sessions: 0, energy: 0 };
    byDate[date].sessions++;
    byDate[date].energy += parseFloat(s.energy_consumed_kwh) || 0;
  }

  // Time of day distribution
  const byTimeOfDay: number[] = Array(24).fill(0);
  for (const s of sessions) {
    const hour = new Date(s.start_ts).getHours();
    byTimeOfDay[hour] += parseFloat(s.energy_consumed_kwh) || 0;
  }

  const totalEnergy = sessions.reduce((sum: number, s: any) => sum + (parseFloat(s.energy_consumed_kwh) || 0), 0);
  const daysInRange = Math.max(1, Math.ceil((filters.endDate.getTime() - filters.startDate.getTime()) / 86400000));

  return {
    byStation: Object.values(byStation).sort((a, b) => b.energy - a.energy),
    byDate: Object.entries(byDate).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
    byTimeOfDay,
    totals: {
      totalKwh: totalEnergy,
      avgKwhPerDay: totalEnergy / daysInRange,
      peakDemand: sessions.reduce((max: number, s: any) => Math.max(max, parseFloat(s.max_demand_kw) || 0), 0),
      totalSessions: sessions.length,
    },
  };
}

// =====================================================================
// TAB 18: CHARGER UPTIME / DOWNTIME
// =====================================================================

export async function fetchChargerUptime(filters: BaseFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);
  const daysInRange = Math.max(1, Math.ceil((filters.endDate.getTime() - filters.startDate.getTime()) / 86400000));
  const totalHours = daysInRange * 24;

  // Fetch sessions grouped by station
  const sessions = await fetchAllRows(
    'charging_sessions',
    'station_id, duration_minutes, stations(name, station_code)',
    (q: any) => {
      q = q.gte('start_ts', startTs).lte('start_ts', endTs);
      if (filters.stationId) q = q.eq('station_id', filters.stationId);
      return q;
    }
  );

  // Group by station
  const stationMap: Record<string, { name: string; code: string; activeMinutes: number; sessionCount: number }> = {};
  for (const s of sessions) {
    const sid = s.station_id;
    if (!stationMap[sid]) {
      stationMap[sid] = {
        name: s.stations?.name || 'Unknown',
        code: s.stations?.station_code || '',
        activeMinutes: 0,
        sessionCount: 0,
      };
    }
    stationMap[sid].activeMinutes += parseFloat(s.duration_minutes) || 0;
    stationMap[sid].sessionCount++;
  }

  // Try to fetch maintenance logs if the table exists
  let maintenanceEvents: any[] = [];
  try {
    const { data: logs } = await supabase
      .from('maintenance_logs' as any)
      .select('*')
      .gte('created_at', buildTimestamp(filters.startDate))
      .lte('created_at', endTs);
    maintenanceEvents = logs || [];
  } catch {
    // Table may not exist yet
  }

  const rows = Object.entries(stationMap).map(([_id, data]) => {
    const activeHours = data.activeMinutes / 60;
    const uptimePct = Math.min(100, (activeHours / totalHours) * 100);
    return {
      station_name: data.name,
      station_code: data.code,
      total_hours: totalHours,
      active_hours: activeHours,
      downtime_hours: totalHours - activeHours,
      uptime_pct: uptimePct,
      session_count: data.sessionCount,
      maintenance_events: 0,
    };
  });

  rows.sort((a, b) => b.uptime_pct - a.uptime_pct);

  return {
    rows,
    maintenanceEvents,
    avgUptime: rows.length > 0 ? rows.reduce((s, r) => s + r.uptime_pct, 0) / rows.length : 0,
  };
}

// =====================================================================
// TAB 19: MAINTENANCE REPORT
// =====================================================================

export async function fetchMaintenanceReport(filters: MaintenanceFilter) {
  const startTs = buildTimestamp(filters.startDate);
  const endTs = buildTimestamp(filters.endDate, undefined, true);

  let rows: any[] = [];
  try {
    let query = supabase
      .from('maintenance_logs' as any)
      .select('*, stations(name)')
      .gte('created_at', startTs)
      .lte('created_at', endTs)
      .order('created_at', { ascending: false });

    if (filters.stationId) query = query.eq('station_id', filters.stationId);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    rows = (data || []).map((log: any) => ({
      id: log.id,
      date: log.created_at ? format(new Date(log.created_at), 'yyyy-MM-dd') : '',
      station_name: log.stations?.name || 'Unknown',
      description: log.description || '',
      reported_by: log.reported_by || '',
      status: log.status || 'open',
      resolution_date: log.resolved_at || '',
      duration_hours: log.resolved_at && log.created_at
        ? Math.round((new Date(log.resolved_at).getTime() - new Date(log.created_at).getTime()) / 3600000)
        : null,
    }));
  } catch {
    // maintenance_logs table may not exist yet
  }

  const statusSummary = {
    total: rows.length,
    open: rows.filter((r) => r.status === 'open').length,
    resolved: rows.filter((r) => r.status === 'resolved').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    avgResolutionTime: 0,
  };

  const resolved = rows.filter((r) => r.duration_hours !== null);
  if (resolved.length > 0) {
    statusSummary.avgResolutionTime = resolved.reduce((s, r) => s + r.duration_hours, 0) / resolved.length;
  }

  return { rows, statusSummary };
}
