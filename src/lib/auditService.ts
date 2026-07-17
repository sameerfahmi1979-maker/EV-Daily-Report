// =============================================
// auditService.ts
// Activity log recording + querying
// =============================================
import { supabase } from './supabase';

export interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
  // Joined
  user_profiles?: { full_name: string; email: string } | null;
}

/**
 * Record an audit entry.
 */
export async function logAudit(input: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('audit_log').insert([{
    user_id: user?.id || null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id || null,
    details: input.details || {},
  }]);
  if (error) console.error('Audit log insert failed:', error);
}

/**
 * Query audit log with filters.
 */
export async function getAuditLog(filters: {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AuditEntry[]; count: number }> {
  let query = supabase
    .from('audit_log')
    .select('*, user_profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.action) query = query.eq('action', filters.action);
  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.startDate) query = query.gte('created_at', filters.startDate);
  if (filters.endDate) query = query.lte('created_at', filters.endDate);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data || []) as AuditEntry[], count: count || 0 };
}

/** Get distinct actions for filter dropdown */
export async function getDistinctActions(): Promise<string[]> {
  const { data } = await supabase
    .from('audit_log')
    .select('action')
    .order('action');
  const unique = new Set((data || []).map((d: any) => d.action));
  return Array.from(unique);
}

/** Get distinct entity types for filter dropdown */
export async function getDistinctEntityTypes(): Promise<string[]> {
  const { data } = await supabase
    .from('audit_log')
    .select('entity_type')
    .order('entity_type');
  const unique = new Set((data || []).map((d: any) => d.entity_type));
  return Array.from(unique);
}
