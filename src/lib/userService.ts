// =============================================
// userService.ts
// User profile management + RBAC utilities
// =============================================
import { supabase } from './supabase';

import {
  AppRole,
  ApprovalStatus,
  ROLE_LABELS as RBAC_ROLE_LABELS,
  hasPermission as rbacHasPermission,
  Permission,
} from './rbac';

/** @deprecated Prefer AppRole from rbac.ts — kept for compatibility */
export type UserRole = AppRole;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  station_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  approval_status?: ApprovalStatus | string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  disabled_at?: string | null;
  disabled_by?: string | null;
  disable_reason?: string | null;
  legacy_role?: string | null;
  must_change_password?: boolean;
  // Joined data
  stations?: { name: string } | null;
}

/**
 * Get the current user's profile (with station).
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, stations(name)')
    .eq('id', user.id)
    .single();

  if (error) {
    // If profile doesn't exist yet, create it
    if (error.code === 'PGRST116') {
      // EV-A2: new profiles are least-privilege + pending (server default after migration)
      const profile = await createUserProfile({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email || '',
        role: 'report_viewer',
      });
      return profile;
    }
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Get all user profiles (admin view).
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, stations(name)')
    .order('full_name');

  if (error) throw error;
  return (data || []) as UserProfile[];
}

/**
 * Get a user profile by ID.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, stations(name)')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as UserProfile;
}

/**
 * Create a user profile.
 */
export async function createUserProfile(input: {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  station_id?: string;
}): Promise<UserProfile> {
  const baseRow = {
    id: input.id,
    email: input.email,
    full_name: input.full_name,
    role: input.role,
    phone: input.phone || null,
    station_id: input.station_id || null,
    is_active: true,
  };

  // Prefer pending approval when A2 columns exist; fall back for pre-migration DBs
  let { data, error } = await supabase
    .from('user_profiles')
    .insert([{ ...baseRow, approval_status: 'pending' } as never])
    .select()
    .single();

  if (error && /approval_status|schema cache|column/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('user_profiles')
      .insert([baseRow as never])
      .select()
      .single());
  }

  if (error) throw error;
  return data as UserProfile;
}

/**
 * Update a user profile.
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    full_name?: string;
    role?: UserRole;
    phone?: string;
    is_active?: boolean;
    station_id?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Deactivate a user (soft delete).
 */
export async function deactivateUser(userId: string): Promise<void> {
  await updateUserProfile(userId, { is_active: false });
}

/**
 * Reactivate a user.
 */
export async function reactivateUser(userId: string): Promise<void> {
  await updateUserProfile(userId, { is_active: true });
}

// =============================================
// RBAC Permission Checks
// =============================================

/** Legacy shape retained for UserManagement UI; prefer rbac.hasPermission */
export const PERMISSIONS: Record<string, UserRole[]> = {
  upload_shift_data: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer'],
  delete_import_batch: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  view_dashboard: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer', 'accountant', 'report_viewer'],
  view_analytics: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'accountant'],
  view_reports: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer', 'accountant', 'report_viewer'],
  view_handover_reports: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'accountant'],
  view_audit_log: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'accountant'],
  manage_operators: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  manage_stations: ['system_admin', 'global_admin'],
  manage_rates: ['system_admin', 'global_admin'],
  manage_users: ['system_admin', 'global_admin'],
  approve_users: ['system_admin', 'global_admin'],
  edit_system_settings: ['system_admin', 'global_admin'],
  view_system_settings: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer', 'accountant', 'report_viewer'],
  export_pdf: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer', 'accountant', 'report_viewer'],
  export_cdr: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'accountant'],
  manage_shifts: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer'],
  update_handover: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  recalculate_billing: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  add_session_notes: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  view_session_notes: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'accountant'],
  manage_maintenance_log: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  view_maintenance_log: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  manage_roster: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager'],
  view_roster: ['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'station_manager', 'import_officer'],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return rbacHasPermission(role, permission as Permission);
}

export function canAccessStation(
  role: UserRole,
  userStationId: string | null,
  targetStationId: string
): boolean {
  if (role === 'system_admin' || role === 'global_admin' || role === 'operations_manager' || role === 'company_manager') {
    return true;
  }
  if (role === 'accountant') return true;
  return userStationId === targetStationId;
}

export function getAllowedRoles(permission: string): UserRole[] {
  return PERMISSIONS[permission] || [];
}

export const ROLE_LABELS: Record<string, string> = {
  ...RBAC_ROLE_LABELS,
};

export const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  system_admin: { bg: 'bg-red-50', text: 'text-red-700' },
  global_admin: { bg: 'bg-red-50', text: 'text-red-700' },
  operations_manager: { bg: 'bg-purple-50', text: 'text-purple-700' },
  company_manager: { bg: 'bg-purple-50', text: 'text-purple-700' },
  station_manager: { bg: 'bg-blue-50', text: 'text-blue-700' },
  import_officer: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  accountant: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  report_viewer: { bg: 'bg-slate-50', text: 'text-slate-700' },
};
