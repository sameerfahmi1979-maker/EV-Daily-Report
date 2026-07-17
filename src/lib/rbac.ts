/**
 * EV-A2 RBAC helpers (UI + client-side secondary checks).
 * Server RLS/RPC authorization remains authoritative.
 */

export type AppRole =
  | 'system_admin'
  | 'operations_manager'
  | 'station_manager'
  | 'import_officer'
  | 'accountant'
  | 'report_viewer'
  // legacy aliases still accepted until DB remap is applied
  | 'global_admin'
  | 'company_manager';

export type ApprovalStatus = 'pending' | 'approved' | 'disabled' | 'rejected';

export const LEGACY_ROLE_MAP: Record<string, AppRole> = {
  global_admin: 'system_admin',
  company_manager: 'operations_manager',
  system_admin: 'system_admin',
  operations_manager: 'operations_manager',
  station_manager: 'station_manager',
  import_officer: 'import_officer',
  accountant: 'accountant',
  report_viewer: 'report_viewer',
};

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  return LEGACY_ROLE_MAP[role] ?? null;
}

export function isPrivilegedAdmin(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === 'system_admin' || r === 'operations_manager';
}

export type Permission =
  | 'upload_shift_data'
  | 'delete_import_batch'
  | 'view_dashboard'
  | 'view_analytics'
  | 'view_reports'
  | 'view_handover_reports'
  | 'view_audit_log'
  | 'manage_operators'
  | 'manage_stations'
  | 'manage_rates'
  | 'manage_users'
  | 'approve_users'
  | 'edit_system_settings'
  | 'view_system_settings'
  | 'export_pdf'
  | 'export_cdr'
  | 'manage_shifts'
  | 'update_handover'
  | 'recalculate_billing'
  | 'add_session_notes'
  | 'view_session_notes'
  | 'manage_maintenance_log'
  | 'view_maintenance_log'
  | 'manage_roster'
  | 'view_roster';

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  system_admin: [
    'upload_shift_data', 'delete_import_batch', 'view_dashboard', 'view_analytics', 'view_reports',
    'view_handover_reports', 'view_audit_log', 'manage_operators', 'manage_stations', 'manage_rates',
    'manage_users', 'approve_users', 'edit_system_settings', 'view_system_settings', 'export_pdf',
    'export_cdr', 'manage_shifts', 'update_handover', 'recalculate_billing', 'add_session_notes',
    'view_session_notes', 'manage_maintenance_log', 'view_maintenance_log', 'manage_roster', 'view_roster',
  ],
  operations_manager: [
    'upload_shift_data', 'delete_import_batch', 'view_dashboard', 'view_analytics', 'view_reports',
    'view_handover_reports', 'view_audit_log', 'manage_operators', 'view_system_settings', 'export_pdf',
    'export_cdr', 'manage_shifts', 'update_handover', 'recalculate_billing', 'add_session_notes',
    'view_session_notes', 'manage_maintenance_log', 'view_maintenance_log', 'manage_roster', 'view_roster',
  ],
  station_manager: [
    'upload_shift_data', 'delete_import_batch', 'view_dashboard', 'view_analytics', 'view_reports',
    'view_handover_reports', 'manage_operators', 'view_system_settings', 'export_pdf', 'export_cdr',
    'manage_shifts', 'update_handover', 'recalculate_billing', 'add_session_notes', 'view_session_notes',
    'manage_maintenance_log', 'view_maintenance_log', 'manage_roster', 'view_roster',
  ],
  import_officer: [
    'upload_shift_data', 'view_dashboard', 'view_reports', 'view_system_settings', 'export_pdf',
    'manage_shifts', 'view_session_notes', 'view_roster',
  ],
  accountant: [
    'view_dashboard', 'view_analytics', 'view_reports', 'view_handover_reports', 'view_audit_log',
    'view_system_settings', 'export_pdf', 'export_cdr', 'view_session_notes',
  ],
  report_viewer: [
    'view_dashboard', 'view_reports', 'view_system_settings', 'export_pdf',
  ],
  // legacy aliases mirror targets
  global_admin: [],
  company_manager: [],
};

// Fill legacy aliases from mapped roles
ROLE_PERMISSIONS.global_admin = ROLE_PERMISSIONS.system_admin;
ROLE_PERMISSIONS.company_manager = ROLE_PERMISSIONS.operations_manager;

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return ROLE_PERMISSIONS[normalized]?.includes(permission) ?? false;
}

export function canAccessStationClient(
  role: string | null | undefined,
  assignedStationIds: string[] | null | undefined,
  targetStationId: string
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized === 'system_admin' || normalized === 'operations_manager') return true;
  if (!assignedStationIds || assignedStationIds.length === 0) return false;
  return assignedStationIds.includes(targetStationId);
}

export function isOperationallyAllowed(approvalStatus: ApprovalStatus | string | null | undefined, isActive: boolean | null | undefined): boolean {
  if (isActive === false) return false;
  const status = (approvalStatus ?? 'approved') as ApprovalStatus;
  // Backward compatible: if approval_status column not yet migrated, treat as approved when active
  if (approvalStatus == null) return isActive !== false;
  return status === 'approved';
}

export const ROLE_LABELS: Record<AppRole, string> = {
  system_admin: 'System Administrator',
  operations_manager: 'Operations Manager',
  station_manager: 'Station Manager',
  import_officer: 'Import Officer',
  accountant: 'Accountant',
  report_viewer: 'Report Viewer',
  global_admin: 'System Administrator',
  company_manager: 'Operations Manager',
};
