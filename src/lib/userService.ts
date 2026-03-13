// =============================================
// userService.ts
// User profile management + RBAC utilities
// =============================================
import { supabase } from './supabase';

export type UserRole = 'global_admin' | 'company_manager' | 'station_manager' | 'accountant';

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
      const profile = await createUserProfile({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email || '',
        role: 'station_manager',
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
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([{
      id: input.id,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      phone: input.phone || null,
      station_id: input.station_id || null,
      is_active: true,
    }])
    .select()
    .single();

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

export const PERMISSIONS: Record<string, UserRole[]> = {
  // Upload & Data Management
  'upload_shift_data': ['global_admin', 'station_manager'],
  'delete_import_batch': ['global_admin', 'station_manager'],

  // Views
  'view_dashboard': ['global_admin', 'company_manager', 'station_manager', 'accountant'],
  'view_analytics': ['global_admin', 'company_manager', 'station_manager', 'accountant'],
  'view_reports': ['global_admin', 'company_manager', 'station_manager', 'accountant'],
  'view_handover_reports': ['global_admin', 'company_manager', 'station_manager', 'accountant'],
  'view_audit_log': ['global_admin', 'company_manager'],

  // Management
  'manage_operators': ['global_admin', 'station_manager'],
  'manage_stations': ['global_admin'],
  'manage_rates': ['global_admin'],
  'manage_users': ['global_admin'],

  // System Settings
  'edit_system_settings': ['global_admin'],
  'view_system_settings': ['global_admin', 'company_manager', 'station_manager', 'accountant'],

  // Reports & Export
  'export_pdf': ['global_admin', 'company_manager', 'station_manager', 'accountant'],
  'export_cdr': ['global_admin', 'company_manager', 'station_manager', 'accountant'],

  // Shifts & Handover
  'manage_shifts': ['global_admin', 'station_manager'],
  'update_handover': ['global_admin', 'station_manager'],

  // Session Notes
  'add_session_notes': ['global_admin', 'station_manager'],
  'view_session_notes': ['global_admin', 'company_manager', 'station_manager', 'accountant'],

  // Maintenance
  'manage_maintenance_log': ['global_admin', 'station_manager'],
  'view_maintenance_log': ['global_admin', 'company_manager', 'station_manager'],

  // Roster
  'manage_roster': ['global_admin', 'station_manager'],
  'view_roster': ['global_admin', 'company_manager', 'station_manager'],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return PERMISSIONS[permission]?.includes(role) || false;
}

/**
 * Check if a role can access data for a specific station.
 * station_manager can only access their own station.
 * global_admin and company_manager can access all.
 */
export function canAccessStation(
  role: UserRole,
  userStationId: string | null,
  targetStationId: string
): boolean {
  if (role === 'global_admin' || role === 'company_manager') return true;
  if (role === 'accountant') return true; // accountants see financial data across all
  return userStationId === targetStationId;
}

/**
 * Get roles that are allowed for a given permission.
 */
export function getAllowedRoles(permission: string): UserRole[] {
  return PERMISSIONS[permission] || [];
}

/**
 * Role labels for UI display.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  global_admin: 'Global Admin',
  company_manager: 'Company Manager',
  station_manager: 'Station Manager',
  accountant: 'Accountant',
};

/**
 * Role colors for badges.
 */
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  global_admin: { bg: 'bg-red-50', text: 'text-red-700' },
  company_manager: { bg: 'bg-purple-50', text: 'text-purple-700' },
  station_manager: { bg: 'bg-blue-50', text: 'text-blue-700' },
  accountant: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
};
