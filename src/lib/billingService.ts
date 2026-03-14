import { supabase } from './supabase';
import { Database } from './database.types';
import { parseISO, format, addDays, startOfDay, endOfDay, differenceInMinutes, isAfter, isBefore, min as minDate } from 'date-fns';

type ChargingSession = Database['public']['Tables']['charging_sessions']['Row'];
type RateStructure = Database['public']['Tables']['rate_structures']['Row'];
type RatePeriod = Database['public']['Tables']['rate_periods']['Row'];
type FixedCharge = Database['public']['Tables']['fixed_charges']['Row'];
type BillingCalculation = Database['public']['Tables']['billing_calculations']['Row'];
type BillingCalculationInsert = Database['public']['Tables']['billing_calculations']['Insert'];
type BillingBreakdownItemInsert = Database['public']['Tables']['billing_breakdown_items']['Insert'];

export interface PeriodSegment {
  periodId: string;
  periodName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  ratePerKwh: number;
  demandChargePerKw: number;
  energyKwh?: number;
  season: string;
}

export interface PeriodCharge {
  periodName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  energy: number;
  ratePerKwh: number;
  energyCharge: number;
  demand: number;
  demandRate: number;
  demandCharge: number;
  lineTotal: number;
}

export interface BillingBreakdown {
  periodCharges: PeriodCharge[];
  subtotal: number;
  fixedCharges: number;
  fixedChargesList: Array<{ name: string; amount: number }>;
  taxes: number;
  total: number;
}

function determineSeason(date: Date): string {
  const month = date.getMonth() + 1;

  if (month >= 6 && month <= 9) return 'summer';
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  return 'fall';
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}

function getTimeInMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isApplicablePeriod(period: RatePeriod, date: Date): boolean {
  const dayOfWeek = format(date, 'EEEE').toLowerCase();
  const season = determineSeason(date);

  if (!period.days_of_week.includes(dayOfWeek)) {
    return false;
  }

  if (period.season !== 'all' && period.season !== season) {
    return false;
  }

  return true;
}

function findApplicablePeriod(periods: RatePeriod[], date: Date): RatePeriod | null {
  const timeInMinutes = getTimeInMinutes(date);

  for (const period of periods) {
    if (!isApplicablePeriod(period, date)) {
      continue;
    }

    const startMinutes = timeToMinutes(period.start_time);
    const endMinutes = timeToMinutes(period.end_time);

    if (endMinutes === 0 || endMinutes === 1440) {
      if (timeInMinutes >= startMinutes) {
        return period;
      }
    } else if (endMinutes > startMinutes) {
      if (timeInMinutes >= startMinutes && timeInMinutes < endMinutes) {
        return period;
      }
    } else {
      if (timeInMinutes >= startMinutes || timeInMinutes < endMinutes) {
        return period;
      }
    }
  }

  return null;
}

function getNextPeriodBoundary(currentTime: Date, period: RatePeriod): Date {
  const endMinutes = timeToMinutes(period.end_time);

  if (endMinutes === 0 || endMinutes === 1440) {
    const nextDay = addDays(startOfDay(currentTime), 1);
    return nextDay;
  }

  const currentMinutes = getTimeInMinutes(currentTime);
  const startMinutes = timeToMinutes(period.start_time);

  if (endMinutes > startMinutes) {
    const boundaryDate = new Date(currentTime);
    boundaryDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    return boundaryDate;
  } else {
    const nextDay = addDays(startOfDay(currentTime), 1);
    nextDay.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    return nextDay;
  }
}

export async function getActiveRateStructure(stationId: string, date: Date): Promise<RateStructure | null> {
  const { data, error } = await supabase
    .from('rate_structures')
    .select('*')
    .eq('station_id', stationId)
    .eq('is_active', true)
    .lte('effective_from', date.toISOString().split('T')[0])
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRatePeriods(rateStructureId: string): Promise<RatePeriod[]> {
  const { data, error } = await supabase
    .from('rate_periods')
    .select('*')
    .eq('rate_structure_id', rateStructureId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getActiveFixedCharges(stationId: string): Promise<FixedCharge[]> {
  const { data, error } = await supabase
    .from('fixed_charges')
    .select('*')
    .eq('station_id', stationId)
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

export async function splitSessionIntoPeriods(
  session: ChargingSession,
  ratePeriods: RatePeriod[]
): Promise<PeriodSegment[]> {
  const startTs = parseISO(session.start_ts);
  const endTs = parseISO(session.end_ts);

  const segments: PeriodSegment[] = [];
  let currentTime = startTs;

  while (isBefore(currentTime, endTs)) {
    const period = findApplicablePeriod(ratePeriods, currentTime);

    if (!period) {
      throw new Error(`No applicable rate period found for time: ${currentTime.toISOString()}`);
    }

    const periodEnd = getNextPeriodBoundary(currentTime, period);
    const segmentEnd = minDate([periodEnd, endTs]);

    const durationMin = differenceInMinutes(segmentEnd, currentTime);

    if (durationMin > 0) {
      segments.push({
        periodId: period.id,
        periodName: period.period_name,
        startTime: currentTime,
        endTime: segmentEnd,
        durationMinutes: durationMin,
        ratePerKwh: parseFloat(period.energy_rate_per_kwh),
        demandChargePerKw: parseFloat(period.demand_charge_per_kw),
        season: period.season
      });
    }

    currentTime = segmentEnd;
  }

  return segments;
}

export function allocateEnergyToSegments(
  totalEnergy: number,
  segments: PeriodSegment[]
): PeriodSegment[] {
  const totalDuration = segments.reduce((sum, s) => sum + s.durationMinutes, 0);

  return segments.map(segment => ({
    ...segment,
    energyKwh: totalEnergy * (segment.durationMinutes / totalDuration)
  }));
}

export async function calculateSessionBilling(
  sessionId: string
): Promise<{ breakdown: BillingBreakdown; rateStructureId: string }> {
  const { data: session, error: sessionError } = await supabase
    .from('charging_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('Session not found');
  }

  if (!session.station_id) {
    throw new Error('Session has no associated station');
  }

  const startTs = parseISO(session.start_ts);
  const rateStructure = await getActiveRateStructure(session.station_id, startTs);

  if (!rateStructure) {
    throw new Error('No active rate structure found for this station');
  }

  const ratePeriods = await getRatePeriods(rateStructure.id);

  if (ratePeriods.length === 0) {
    throw new Error('No rate periods found for this rate structure');
  }

  const segments = await splitSessionIntoPeriods(session, ratePeriods);
  const segmentsWithEnergy = allocateEnergyToSegments(
    parseFloat(session.energy_consumed_kwh),
    segments
  );

  const maxDemandKw = session.max_demand_kw ? parseFloat(session.max_demand_kw) : 0;

  const periodCharges: PeriodCharge[] = segmentsWithEnergy.map(segment => {
    const energyCharge = (segment.energyKwh || 0) * segment.ratePerKwh;
    const demandCharge = maxDemandKw * segment.demandChargePerKw;

    return {
      periodName: segment.periodName,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.durationMinutes,
      energy: segment.energyKwh || 0,
      ratePerKwh: segment.ratePerKwh,
      energyCharge,
      demand: maxDemandKw,
      demandRate: segment.demandChargePerKw,
      demandCharge,
      lineTotal: energyCharge + demandCharge
    };
  });

  const periodSubtotal = periodCharges.reduce((sum, p) => sum + p.lineTotal, 0);

  const fixedCharges = await getActiveFixedCharges(session.station_id);
  const fixedChargesTotal = fixedCharges.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const fixedChargesList = fixedCharges.map(c => ({
    name: c.charge_name,
    amount: parseFloat(c.amount)
  }));

  const subtotal = periodSubtotal + fixedChargesTotal;
  const taxTotal = 0;
  const total = subtotal;

  const breakdown: BillingBreakdown = {
    periodCharges,
    subtotal,
    fixedCharges: fixedChargesTotal,
    fixedChargesList,
    taxes: taxTotal,
    total
  };

  return { breakdown, rateStructureId: rateStructure.id };
}

export async function saveBillingCalculation(
  sessionId: string,
  rateStructureId: string,
  breakdown: BillingBreakdown
): Promise<BillingCalculation> {
  const billingData: BillingCalculationInsert = {
    session_id: sessionId,
    rate_structure_id: rateStructureId,
    breakdown: breakdown as any,
    subtotal: breakdown.subtotal.toFixed(3),
    taxes: breakdown.taxes.toFixed(3),
    fees: breakdown.fixedCharges.toFixed(3),
    total_amount: breakdown.total.toFixed(3),
    currency: 'JOD'
  };

  const { data: billing, error: billingError } = await supabase
    .from('billing_calculations')
    .insert([billingData])
    .select()
    .single();

  if (billingError) throw billingError;

  const breakdownItems: BillingBreakdownItemInsert[] = breakdown.periodCharges.map(pc => ({
    billing_calculation_id: billing.id,
    period_name: pc.periodName,
    start_time: pc.startTime.toISOString(),
    end_time: pc.endTime.toISOString(),
    duration_minutes: pc.duration,
    energy_kwh: pc.energy.toFixed(3),
    rate_per_kwh: pc.ratePerKwh.toFixed(3),
    demand_kw: pc.demand.toFixed(3),
    demand_charge: pc.demandCharge.toFixed(3),
    energy_charge: pc.energyCharge.toFixed(3),
    line_total: pc.lineTotal.toFixed(3)
  }));

  const { error: itemsError } = await supabase
    .from('billing_breakdown_items')
    .insert(breakdownItems);

  if (itemsError) throw itemsError;

  return billing;
}

export async function recalculateSession(sessionId: string): Promise<BillingCalculation> {
  const { data: existing } = await supabase
    .from('billing_calculations')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('billing_breakdown_items')
      .delete()
      .eq('billing_calculation_id', existing.id);

    await supabase
      .from('billing_calculations')
      .delete()
      .eq('id', existing.id);
  }

  const { breakdown, rateStructureId } = await calculateSessionBilling(sessionId);
  return await saveBillingCalculation(sessionId, rateStructureId, breakdown);
}

export interface BulkRecalculationResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ sessionId: string; error: string }>;
}

export interface CalculationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentSessionId?: string;
  errors: Array<{ sessionId: string; error: string }>;
}

export type ProgressCallback = (progress: CalculationProgress) => void;

export async function recalculateMultipleSessions(
  sessionIds: string[]
): Promise<BulkRecalculationResult> {
  const result: BulkRecalculationResult = {
    total: sessionIds.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  const { data: existingCalculations } = await supabase
    .from('billing_calculations')
    .select('session_id')
    .in('session_id', sessionIds);

  const calculatedSessionIds = new Set(
    (existingCalculations || []).map(calc => calc.session_id)
  );

  for (const sessionId of sessionIds) {
    if (calculatedSessionIds.has(sessionId)) {
      result.skipped++;
      continue;
    }

    try {
      await calculateAndSaveSessionBilling(sessionId);
      result.successful++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return result;
}

export async function recalculateStationSessions(
  stationId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<BulkRecalculationResult> {
  let query = supabase
    .from('charging_sessions')
    .select('id')
    .not('station_id', 'is', null);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  if (startDate) {
    query = query.gte('start_ts', startDate.toISOString());
  }

  if (endDate) {
    query = query.lte('start_ts', endDate.toISOString());
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const sessionIds = (sessions || []).map(s => s.id);
  return await recalculateMultipleSessions(sessionIds);
}

export async function countPendingSessions(filters?: SessionFilters): Promise<number> {
  let query = supabase
    .from('charging_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('has_billing_calculation', false);

  if (filters?.stationId) {
    query = query.eq('station_id', filters.stationId);
  }

  if (filters?.startDate) {
    query = query.gte('start_ts', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('start_ts', filters.endDate);
  }

  if (filters?.searchTerm) {
    const searchTerm = `%${filters.searchTerm}%`;
    query = query.or(`transaction_id.ilike.${searchTerm},card_number.ilike.${searchTerm},charge_id.ilike.${searchTerm}`);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

export async function getPendingSessionIds(filters?: SessionFilters): Promise<string[]> {
  const allIds: string[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  // Paginate to get ALL pending session IDs (PostgREST defaults to 1000 rows)
  while (hasMore) {
    let query = supabase
      .from('charging_sessions')
      .select('id')
      .eq('has_billing_calculation', false)
      .order('start_ts', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (filters?.stationId) {
      query = query.eq('station_id', filters.stationId);
    }

    if (filters?.startDate) {
      query = query.gte('start_ts', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('start_ts', filters.endDate);
    }

    if (filters?.searchTerm) {
      const searchTerm = `%${filters.searchTerm}%`;
      query = query.or(`transaction_id.ilike.${searchTerm},card_number.ilike.${searchTerm},charge_id.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allIds.push(...data.map(s => s.id));
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allIds;
}

export interface ValidationResult {
  canCalculate: number;
  missingRateStructure: number;
  missingStation: number;
  stationsWithoutRates: Array<{ stationId: string; stationName: string; sessionCount: number }>;
}

export async function validatePendingSessions(filters?: SessionFilters): Promise<ValidationResult> {
  let query = supabase
    .from('charging_sessions')
    .select(`
      id,
      station_id,
      start_ts,
      stations (
        id,
        name,
        station_code
      )
    `)
    .eq('has_billing_calculation', false);

  if (filters?.stationId) {
    query = query.eq('station_id', filters.stationId);
  }

  if (filters?.startDate) {
    query = query.gte('start_ts', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('start_ts', filters.endDate);
  }

  if (filters?.searchTerm) {
    const searchTerm = `%${filters.searchTerm}%`;
    query = query.or(`transaction_id.ilike.${searchTerm},card_number.ilike.${searchTerm},charge_id.ilike.${searchTerm}`);
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const result: ValidationResult = {
    canCalculate: 0,
    missingRateStructure: 0,
    missingStation: 0,
    stationsWithoutRates: []
  };

  if (!sessions || sessions.length === 0) {
    return result;
  }

  // Get all unique station IDs
  const uniqueStationIds = Array.from(new Set(sessions.map(s => s.station_id).filter(Boolean)));

  // Batch fetch all rate structures for these stations in ONE query
  const { data: rateStructures, error: rateError } = await supabase
    .from('rate_structures')
    .select('*')
    .in('station_id', uniqueStationIds)
    .eq('is_active', true)
    .order('effective_from', { ascending: false });

  if (rateError) {
    console.error('Error fetching rate structures:', rateError);
    throw rateError;
  }

  // Create a map of station -> rate structures for quick lookup
  const stationRateMap = new Map<string, RateStructure[]>();
  (rateStructures || []).forEach(rate => {
    if (rate.station_id) {
      if (!stationRateMap.has(rate.station_id)) {
        stationRateMap.set(rate.station_id, []);
      }
      stationRateMap.get(rate.station_id)!.push(rate);
    }
  });

  const stationSessionCounts = new Map<string, { name: string; count: number }>();

  // Now validate each session using the cached rate structures
  for (const session of sessions) {
    if (!session.station_id) {
      result.missingStation++;
      continue;
    }

    const startTs = parseISO(session.start_ts);
    const sessionDate = startTs.toISOString().split('T')[0];

    // Find applicable rate structure from cache
    const stationRates = stationRateMap.get(session.station_id) || [];
    const applicableRate = stationRates.find(rate =>
      rate.effective_from <= sessionDate
    );

    if (!applicableRate) {
      result.missingRateStructure++;
      const stationName = (session.stations as any)?.name || 'Unknown Station';
      const existing = stationSessionCounts.get(session.station_id);
      if (existing) {
        existing.count++;
      } else {
        stationSessionCounts.set(session.station_id, {
          name: stationName,
          count: 1
        });
      }
    } else {
      result.canCalculate++;
    }
  }

  result.stationsWithoutRates = Array.from(stationSessionCounts.entries()).map(([stationId, info]) => ({
    stationId,
    stationName: info.name,
    sessionCount: info.count
  }));

  return result;
}

export async function calculateAllPendingSessions(
  filters?: SessionFilters,
  onProgress?: ProgressCallback,
  batchSize: number = 50,
  skipMissingRates: boolean = false
): Promise<BulkRecalculationResult> {
  const sessionIds = await getPendingSessionIds(filters);

  const progress: CalculationProgress = {
    total: sessionIds.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  if (onProgress) {
    onProgress({ ...progress });
  }

  // Pre-fetch all rate structures and rate periods to avoid repeated database queries
  console.log(`[Billing] Fetching ${sessionIds.length} pending sessions...`);

  // Split sessionIds into chunks to avoid PostgreSQL's parameter limit
  const CHUNK_SIZE = 500;
  const allSessions: Array<{ id: string; station_id: string; start_ts: string }> = [];

  for (let i = 0; i < sessionIds.length; i += CHUNK_SIZE) {
    const chunk = sessionIds.slice(i, i + CHUNK_SIZE);
    console.log(`[Billing] Fetching chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(sessionIds.length / CHUNK_SIZE)} (${chunk.length} sessions)`);

    const { data: chunkSessions, error: chunkError } = await supabase
      .from('charging_sessions')
      .select('id, station_id, start_ts')
      .in('id', chunk);

    if (chunkError) {
      console.error(`[Billing] Error fetching sessions chunk:`, chunkError);
      throw chunkError;
    }

    if (chunkSessions && chunkSessions.length > 0) {
      allSessions.push(...chunkSessions);
    }
  }

  if (allSessions.length === 0) {
    console.log('[Billing] No sessions found');
    return {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  console.log(`[Billing] Successfully fetched ${allSessions.length} sessions`);

  // Get unique station IDs
  const uniqueStationIds = Array.from(new Set(allSessions.map(s => s.station_id).filter(Boolean)));
  console.log(`[Billing] Found ${uniqueStationIds.length} unique stations to process`);

  // Batch fetch all rate structures (with chunking for large station lists)
  console.log('[Billing] Fetching rate structures...');
  const rateStructures: RateStructure[] = [];

  if (uniqueStationIds.length > 0) {
    for (let i = 0; i < uniqueStationIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueStationIds.slice(i, i + CHUNK_SIZE);

      const { data: chunkRates, error: rateError } = await supabase
        .from('rate_structures')
        .select('*')
        .in('station_id', chunk)
        .eq('is_active', true)
        .order('effective_from', { ascending: false });

      if (rateError) {
        console.error('[Billing] Error fetching rate structures:', rateError);
        throw rateError;
      }

      if (chunkRates && chunkRates.length > 0) {
        rateStructures.push(...chunkRates);
      }
    }
  }

  console.log(`[Billing] Fetched ${rateStructures.length} rate structures`);

  // Batch fetch all rate periods for these rate structures (with chunking)
  const rateStructureIds = rateStructures.map(rs => rs.id);
  console.log('[Billing] Fetching rate periods...');
  const allRatePeriods: RatePeriod[] = [];

  if (rateStructureIds.length > 0) {
    for (let i = 0; i < rateStructureIds.length; i += CHUNK_SIZE) {
      const chunk = rateStructureIds.slice(i, i + CHUNK_SIZE);

      const { data: chunkPeriods, error: periodsError } = await supabase
        .from('rate_periods')
        .select('*')
        .in('rate_structure_id', chunk)
        .order('start_time', { ascending: true });

      if (periodsError) {
        console.error('[Billing] Error fetching rate periods:', periodsError);
        throw periodsError;
      }

      if (chunkPeriods && chunkPeriods.length > 0) {
        allRatePeriods.push(...chunkPeriods);
      }
    }
  }

  console.log(`[Billing] Fetched ${allRatePeriods.length} rate periods`);

  // Create lookup maps for fast access
  const stationRateMap = new Map<string, RateStructure[]>();
  rateStructures.forEach(rate => {
    if (rate.station_id) {
      if (!stationRateMap.has(rate.station_id)) {
        stationRateMap.set(rate.station_id, []);
      }
      stationRateMap.get(rate.station_id)!.push(rate);
    }
  });

  const ratePeriodsMap = new Map<string, RatePeriod[]>();
  allRatePeriods.forEach(period => {
    if (!ratePeriodsMap.has(period.rate_structure_id)) {
      ratePeriodsMap.set(period.rate_structure_id, []);
    }
    ratePeriodsMap.get(period.rate_structure_id)!.push(period);
  });

  console.log(`[Billing] Created cache: ${stationRateMap.size} stations with rate structures, ${ratePeriodsMap.size} rate structures with periods`);
  console.log('[Billing] Starting calculation process...');

  // Now process each session using cached data
  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];
    progress.currentSessionId = sessionId;

    try {
      await calculateAndSaveSessionBillingWithCache(sessionId, stationRateMap, ratePeriodsMap);
      progress.successful++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (skipMissingRates && errorMessage.includes('No active rate structure found')) {
        progress.skipped++;
      } else {
        progress.failed++;
        progress.errors.push({ sessionId, error: errorMessage });
      }
    }

    progress.processed++;

    if (onProgress && (i % batchSize === 0 || i === sessionIds.length - 1)) {
      onProgress({ ...progress });
    }
  }

  console.log(`[Billing] Calculation complete: ${progress.successful} successful, ${progress.failed} failed, ${progress.skipped} skipped`);

  return {
    total: progress.total,
    successful: progress.successful,
    failed: progress.failed,
    skipped: progress.skipped,
    errors: progress.errors
  };
}

export async function calculateAndSaveSessionBilling(sessionId: string): Promise<BillingCalculation> {
  const { breakdown, rateStructureId } = await calculateSessionBilling(sessionId);
  return await saveBillingCalculation(sessionId, rateStructureId, breakdown);
}

async function calculateAndSaveSessionBillingWithCache(
  sessionId: string,
  stationRateMap: Map<string, RateStructure[]>,
  ratePeriodsMap: Map<string, RatePeriod[]>
): Promise<BillingCalculation> {
  const { data: session, error: sessionError } = await supabase
    .from('charging_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.station_id) {
    throw new Error(`Session ${sessionId} has no associated station`);
  }

  const startTs = parseISO(session.start_ts);
  const sessionDate = startTs.toISOString().split('T')[0];

  // Find rate structure from cache
  const stationRates = stationRateMap.get(session.station_id) || [];
  const rateStructure = stationRates.find(rate => rate.effective_from <= sessionDate);

  if (!rateStructure) {
    throw new Error(`No active rate structure found for station ${session.station_id} on ${sessionDate}`);
  }

  // Get rate periods from cache
  const ratePeriods = ratePeriodsMap.get(rateStructure.id) || [];

  if (ratePeriods.length === 0) {
    throw new Error(`No rate periods found for rate structure ${rateStructure.id}`);
  }

  // Calculate billing using cached data
  const segments = await splitSessionIntoPeriods(session, ratePeriods);
  const segmentsWithEnergy = allocateEnergyToSegments(
    parseFloat(session.energy_consumed_kwh),
    segments
  );

  const maxDemandKw = session.max_demand_kw ? parseFloat(session.max_demand_kw) : 0;

  const periodCharges: PeriodCharge[] = segmentsWithEnergy.map(segment => {
    const energyCharge = (segment.energyKwh || 0) * segment.ratePerKwh;
    const demandCharge = maxDemandKw * segment.demandChargePerKw;

    return {
      periodName: segment.periodName,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.durationMinutes,
      energy: segment.energyKwh || 0,
      ratePerKwh: segment.ratePerKwh,
      energyCharge,
      demand: maxDemandKw,
      demandRate: segment.demandChargePerKw,
      demandCharge,
      lineTotal: energyCharge + demandCharge
    };
  });

  const periodSubtotal = periodCharges.reduce((sum, p) => sum + p.lineTotal, 0);

  const fixedCharges = await getActiveFixedCharges(session.station_id);
  const fixedChargesTotal = fixedCharges.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const fixedChargesList = fixedCharges.map(c => ({
    name: c.charge_name,
    amount: parseFloat(c.amount)
  }));

  const subtotal = periodSubtotal + fixedChargesTotal;
  const taxTotal = 0;
  const total = subtotal;

  const breakdown: BillingBreakdown = {
    periodCharges,
    subtotal,
    fixedCharges: fixedChargesTotal,
    fixedChargesList,
    taxes: taxTotal,
    total
  };

  return await saveBillingCalculation(sessionId, rateStructure.id, breakdown);
}

export async function getBillingCalculation(sessionId: string): Promise<BillingCalculation | null> {
  const { data, error } = await supabase
    .from('billing_calculations')
    .select('*')
    .eq('session_id', sessionId)
    .order('calculation_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getBillingBreakdownItems(billingCalculationId: string) {
  const { data, error } = await supabase
    .from('billing_breakdown_items')
    .select('*')
    .eq('billing_calculation_id', billingCalculationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export interface SessionFilters {
  stationId?: string;
  billingStatus?: 'all' | 'calculated' | 'pending';
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSessionsResult {
  sessions: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getSessionsWithBilling(stationId?: string) {
  let query = supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        id,
        name,
        station_code
      ),
      billing_calculations (
        id,
        total_amount,
        currency,
        calculation_date
      )
    `)
    .order('start_ts', { ascending: false });

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getSessionsWithBillingFiltered(filters: SessionFilters = {}): Promise<PaginatedSessionsResult> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const offset = (page - 1) * pageSize;

  let countQuery = supabase
    .from('charging_sessions')
    .select('id', { count: 'exact', head: true });

  let dataQuery = supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        id,
        name,
        station_code
      ),
      billing_calculations (
        id,
        total_amount,
        currency,
        calculation_date
      )
    `)
    .order('start_ts', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filters.stationId) {
    countQuery = countQuery.eq('station_id', filters.stationId);
    dataQuery = dataQuery.eq('station_id', filters.stationId);
  }

  if (filters.startDate) {
    countQuery = countQuery.gte('start_ts', filters.startDate);
    dataQuery = dataQuery.gte('start_ts', filters.startDate);
  }

  if (filters.endDate) {
    countQuery = countQuery.lte('start_ts', filters.endDate);
    dataQuery = dataQuery.lte('start_ts', filters.endDate);
  }

  if (filters.searchTerm) {
    const searchTerm = `%${filters.searchTerm}%`;
    countQuery = countQuery.or(`transaction_id.ilike.${searchTerm},card_number.ilike.${searchTerm},charge_id.ilike.${searchTerm}`);
    dataQuery = dataQuery.or(`transaction_id.ilike.${searchTerm},card_number.ilike.${searchTerm},charge_id.ilike.${searchTerm}`);
  }

  if (filters.billingStatus === 'calculated') {
    countQuery = countQuery.eq('has_billing_calculation', true);
    dataQuery = dataQuery.eq('has_billing_calculation', true);
  } else if (filters.billingStatus === 'pending') {
    countQuery = countQuery.eq('has_billing_calculation', false);
    dataQuery = dataQuery.eq('has_billing_calculation', false);
  }

  const [countResult, dataResult] = await Promise.all([
    countQuery,
    dataQuery
  ]);

  if (countResult.error) throw countResult.error;
  if (dataResult.error) throw dataResult.error;

  const sessions = dataResult.data || [];
  const totalCount = countResult.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    sessions,
    totalCount,
    page,
    pageSize,
    totalPages
  };
}

export function formatJOD(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(3) + ' JOD';
}

// =============================================
// CLIENT-SIDE Time-of-Use Billing (replaces server-side RPCs)
// Correctly splits each session across rate period time boundaries
// =============================================
export interface TurboBulkResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ sessionId: string; error: string }>;
  elapsed_ms: number;
}

/**
 * Recalculate billing for multiple sessions using correct TOU rate splitting.
 * Replaces old turbo_bulk_calculate_billing RPC that used flat rates.
 */
export async function turboBulkCalculateBilling(
  sessionIds: string[],
  recalculate: boolean = false
): Promise<TurboBulkResult> {
  console.log(`[TOU Billing] Starting client-side TOU calculation for ${sessionIds.length} sessions (recalculate: ${recalculate})`);
  const startTime = Date.now();

  const result: TurboBulkResult = {
    total: sessionIds.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    elapsed_ms: 0
  };

  for (const sessionId of sessionIds) {
    try {
      if (recalculate) {
        await recalculateSession(sessionId);
      } else {
        // Check if already calculated
        const existing = await getBillingCalculation(sessionId);
        if (existing) {
          result.skipped++;
          continue;
        }
        await calculateAndSaveSessionBilling(sessionId);
      }
      result.successful++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  result.elapsed_ms = Date.now() - startTime;
  console.log(`[TOU Billing] Complete in ${result.elapsed_ms}ms: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`);

  return result;
}

/**
 * Calculate all pending sessions using correct TOU rate splitting.
 * Replaces old turbo_calculate_all_pending RPC that used flat rates.
 */
export async function turboCalculateAllPending(
  filters?: SessionFilters
): Promise<TurboBulkResult> {
  console.log(`[TOU Billing] Starting client-side TOU calculation for all pending sessions`);
  const startTime = Date.now();

  // Use the correct client-side path with cached rate structures
  const clientResult = await calculateAllPendingSessions(
    filters,
    undefined, // no progress callback needed at this level
    50,         // batch size for progress reporting
    true        // skip missing rates
  );

  const elapsed = Date.now() - startTime;
  console.log(`[TOU Billing] All pending complete in ${elapsed}ms: ${clientResult.successful} successful, ${clientResult.failed} failed, ${clientResult.skipped} skipped`);

  return {
    total: clientResult.total,
    successful: clientResult.successful,
    failed: clientResult.failed,
    skipped: clientResult.skipped,
    errors: clientResult.errors,
    elapsed_ms: elapsed
  };
}

// =============================================
// LEGACY: Server-side batch billing via single RPC call (kept for backward compatibility)
// =============================================
export interface BatchBillingResult {
  total_kwh: number;
  total_amount: number;
  sessions_processed: number;
  sessions_skipped: number;
  rate_structure_found: boolean;
  fixed_charges_total: number;
}

export async function calculateBatchBilling(
  batchId: string,
  stationId: string
): Promise<BatchBillingResult> {
  const { data, error } = await supabase.rpc('calculate_batch_billing', {
    p_batch_id: batchId,
    p_station_id: stationId
  });

  if (error) {
    console.error('calculateBatchBilling RPC error:', error);
    throw new Error(`Batch billing failed: ${error.message}`);
  }

  return data as BatchBillingResult;
}

// =============================================
// Cascade delete an import batch and all related data
// Uses server-side RPC for atomicity (single transaction)
// =============================================
export interface DeleteBatchResult {
  batch_name: string;
  deleted_sessions: number;
  deleted_billings: number;
  deleted_breakdowns: number;
}

export async function deleteImportBatch(batchId: string): Promise<DeleteBatchResult> {
  const { data, error } = await supabase.rpc('delete_import_batch', {
    p_batch_id: batchId
  });

  if (error) {
    console.error('deleteImportBatch RPC error:', error);
    throw new Error(`Delete import batch failed: ${error.message}`);
  }

  return data as DeleteBatchResult;
}
