import { supabase } from './supabase';
import { Database } from './database.types';

type Station = Database['public']['Tables']['stations']['Row'];
type StationInsert = Database['public']['Tables']['stations']['Insert'];
type StationUpdate = Database['public']['Tables']['stations']['Update'];

export const stationService = {
  async getAll() {
    const { data, error } = await supabase
      .from('stations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Station[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('stations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Station | null;
  },

  async create(station: Omit<StationInsert, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('stations')
      .insert([station])
      .select()
      .single();

    if (error) throw error;
    return data as Station;
  },

  async update(id: string, userId: string, updates: StationUpdate) {
    const { data, error } = await supabase
      .from('stations')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Station not found');
    return data as Station;
  },

  async delete(id: string, userId: string) {
    const { error } = await supabase
      .from('stations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async search(query: string) {
    const { data, error } = await supabase
      .from('stations')
      .select('*')
      .or(`name.ilike.%${query}%,location.ilike.%${query}%,station_code.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Station[];
  },

  async getStatistics(stationId: string) {
    const { data: sessions, error: sessionsError } = await supabase
      .from('charging_sessions')
      .select('energy_consumed_kwh, calculated_cost, duration_minutes')
      .eq('station_id', stationId);

    if (sessionsError) throw sessionsError;

    const totalSessions = sessions?.length || 0;
    const totalEnergy = sessions?.reduce((sum, s) => sum + (s.energy_consumed_kwh || 0), 0) || 0;
    const totalRevenue = sessions?.reduce((sum, s) => sum + (s.calculated_cost || 0), 0) || 0;
    const avgDuration = sessions?.length
      ? sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sessions.length
      : 0;

    return {
      totalSessions,
      totalEnergy,
      totalRevenue,
      avgDuration,
    };
  },

  async getRateStructures(stationId: string) {
    const { data, error } = await supabase
      .from('rate_structures')
      .select('*')
      .eq('station_id', stationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getRecentSessions(stationId: string, limit: number = 10) {
    const { data, error } = await supabase
      .from('charging_sessions')
      .select('*')
      .eq('station_id', stationId)
      .order('start_ts', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },
};

export async function getStations() {
  const { data, error } = await supabase
    .from('stations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Station[];
}
