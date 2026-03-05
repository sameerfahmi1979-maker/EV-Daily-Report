import { supabase } from './supabase';
import { Database } from './database.types';

type FixedCharge = Database['public']['Tables']['fixed_charges']['Row'];
type FixedChargeInsert = Database['public']['Tables']['fixed_charges']['Insert'];
type FixedChargeUpdate = Database['public']['Tables']['fixed_charges']['Update'];

export async function getFixedCharges(stationId?: string) {
  let query = supabase
    .from('fixed_charges')
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
  return data || [];
}

export async function getFixedCharge(id: string) {
  const { data, error } = await supabase
    .from('fixed_charges')
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

export async function createFixedCharge(fixedCharge: FixedChargeInsert) {
  const { data, error } = await supabase
    .from('fixed_charges')
    .insert([fixedCharge])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFixedCharge(id: string, updates: FixedChargeUpdate) {
  const { data, error } = await supabase
    .from('fixed_charges')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFixedCharge(id: string) {
  const { error } = await supabase
    .from('fixed_charges')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveFixedCharges(stationId: string, effectiveDate: Date) {
  const dateStr = effectiveDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('fixed_charges')
    .select('*')
    .eq('station_id', stationId)
    .eq('is_active', true)
    .or(`effective_from.is.null,effective_from.lte.${dateStr}`)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`);

  if (error) throw error;
  return data || [];
}

export const defaultJordanCharges = [
  {
    charge_name: 'Connection Fee',
    charge_type: 'per_session',
    amount: '2.000',
    is_active: true
  },
  {
    charge_name: 'Service Fee',
    charge_type: 'per_session',
    amount: '1.500',
    is_active: true
  }
];
