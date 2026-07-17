import { supabase } from './supabase';
import { Database } from './database.types';

type RateStructure = Database['public']['Tables']['rate_structures']['Row'];
type RateStructureInsert = Database['public']['Tables']['rate_structures']['Insert'];
type RateStructureUpdate = Database['public']['Tables']['rate_structures']['Update'];
type RatePeriod = Database['public']['Tables']['rate_periods']['Row'];
type RatePeriodInsert = Database['public']['Tables']['rate_periods']['Insert'];
type RatePeriodUpdate = Database['public']['Tables']['rate_periods']['Update'];

export async function getRateStructures(stationId?: string) {
  let query = supabase
    .from('rate_structures')
    .select(`
      *,
      stations (
        id,
        name,
        station_code
      )
    `)
    .order('created_at', { ascending: false });

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getRateStructure(id: string) {
  const { data, error } = await supabase
    .from('rate_structures')
    .select(`
      *,
      stations (
        id,
        name,
        station_code
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createRateStructure(rateStructure: RateStructureInsert) {
  const { data, error } = await supabase
    .from('rate_structures')
    .insert([rateStructure])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRateStructure(id: string, updates: RateStructureUpdate) {
  const { data, error } = await supabase
    .from('rate_structures')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRateStructure(id: string) {
  const { error } = await supabase
    .from('rate_structures')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateRateStructure(id: string, newName: string) {
  const original = await getRateStructure(id);
  if (!original) throw new Error('Rate structure not found');

  const periods = await getRatePeriods(id);

  const newStructure = await createRateStructure({
    station_id: original.station_id,
    name: newName,
    description: original.description,
    effective_from: original.effective_from,
    effective_to: original.effective_to,
    is_active: false
  });

  for (const period of periods) {
    await createRatePeriod({
      rate_structure_id: newStructure.id,
      period_name: period.period_name,
      start_time: period.start_time,
      end_time: period.end_time,
      days_of_week: period.days_of_week,
      season: period.season,
      energy_rate_per_kwh: period.energy_rate_per_kwh,
      demand_charge_per_kw: period.demand_charge_per_kw,
      priority: period.priority
    });
  }

  return newStructure;
}

export async function getRatePeriods(rateStructureId: string) {
  const { data, error } = await supabase
    .from('rate_periods')
    .select('*')
    .eq('rate_structure_id', rateStructureId)
    .order('priority', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createRatePeriod(ratePeriod: RatePeriodInsert) {
  const { data, error } = await supabase
    .from('rate_periods')
    .insert([ratePeriod])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRatePeriod(id: string, updates: RatePeriodUpdate) {
  const { data, error } = await supabase
    .from('rate_periods')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRatePeriod(id: string) {
  const { error } = await supabase
    .from('rate_periods')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveRateStructure(stationId: string, effectiveDate: Date) {
  const dateStr = effectiveDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('rate_structures')
    .select('*')
    .eq('station_id', stationId)
    .eq('is_active', true)
    .lte('effective_from', dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export const jordanTemplates = {
  edcoTOU: {
    name: 'Jordan EDCO TOU Rates',
    description: 'Standard Time-of-Use rates for Jordan EDCO',
    periods: [
      {
        period_name: 'Super Off-Peak',
        start_time: '00:00:00',
        end_time: '06:00:00',
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        season: 'all',
        energy_rate_per_kwh: '0.085',
        demand_charge_per_kw: '0.000',
        priority: 1
      },
      {
        period_name: 'Off-Peak',
        start_time: '06:00:00',
        end_time: '12:00:00',
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        season: 'all',
        energy_rate_per_kwh: '0.120',
        demand_charge_per_kw: '2.500',
        priority: 2
      },
      {
        period_name: 'Mid-Peak',
        start_time: '12:00:00',
        end_time: '18:00:00',
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        season: 'all',
        energy_rate_per_kwh: '0.165',
        demand_charge_per_kw: '8.000',
        priority: 3
      },
      {
        period_name: 'Peak',
        start_time: '18:00:00',
        end_time: '24:00:00',
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        season: 'summer',
        energy_rate_per_kwh: '0.220',
        demand_charge_per_kw: '18.000',
        priority: 4
      },
      {
        period_name: 'Peak',
        start_time: '18:00:00',
        end_time: '24:00:00',
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        season: 'winter',
        energy_rate_per_kwh: '0.180',
        demand_charge_per_kw: '12.000',
        priority: 4
      }
    ]
  },
  flatRate: {
    name: 'Flat Rate',
    description: 'Simple flat rate pricing for all times',
    periods: [
      {
        period_name: 'All Day',
        start_time: '00:00:00',
        end_time: '24:00:00',
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        season: 'all',
        energy_rate_per_kwh: '0.150',
        demand_charge_per_kw: '0.000',
        priority: 1
      }
    ]
  }
};

export async function applyTemplate(
  rateStructureId: string,
  templateKey: 'edcoTOU' | 'flatRate'
) {
  const template = jordanTemplates[templateKey];

  const existingPeriods = await getRatePeriods(rateStructureId);
  for (const period of existingPeriods) {
    await deleteRatePeriod(period.id);
  }

  for (const period of template.periods) {
    await createRatePeriod({
      ...period,
      rate_structure_id: rateStructureId
    });
  }
}
