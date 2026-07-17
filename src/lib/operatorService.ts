import { supabase } from './supabase';
import { Database } from './database.types';

type Operator = Database['public']['Tables']['operators']['Row'];
type OperatorInsert = Database['public']['Tables']['operators']['Insert'];
type OperatorUpdate = Database['public']['Tables']['operators']['Update'];

export const operatorService = {
  async getAll() {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Operator[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Operator | null;
  },

  async getByCardNumber(cardNumber: string) {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('card_number', cardNumber)
      .maybeSingle();

    if (error) throw error;
    return data as Operator | null;
  },

  async create(operator: Omit<OperatorInsert, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('operators')
      .insert([operator])
      .select()
      .single();

    if (error) throw error;
    return data as Operator;
  },

  async update(id: string, userId: string, updates: OperatorUpdate) {
    const { data, error } = await supabase
      .from('operators')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Operator not found');
    return data as Operator;
  },

  async delete(id: string, userId: string) {
    const { error } = await supabase
      .from('operators')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async search(query: string) {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,card_number.ilike.%${query}%,email.ilike.%${query}%`)
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Operator[];
  },

  async getStatistics(operatorId: string) {
    const operator = await supabase
      .from('operators')
      .select('card_number, user_id')
      .eq('id', operatorId)
      .maybeSingle();

    if (operator.error || !operator.data) throw operator.error || new Error('Operator not found');

    const { data: sessions, error: sessionsError } = await supabase
      .from('charging_sessions')
      .select('energy_consumed_kwh, calculated_cost, duration_minutes')
      .eq('card_number', operator.data.card_number);

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

  async getRecentSessions(operatorId: string, limit: number = 10) {
    const operator = await supabase
      .from('operators')
      .select('card_number')
      .eq('id', operatorId)
      .maybeSingle();

    if (operator.error || !operator.data) throw operator.error || new Error('Operator not found');

    const { data, error } = await supabase
      .from('charging_sessions')
      .select('*, stations(name)')
      .eq('card_number', operator.data.card_number)
      .order('start_ts', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },
};
