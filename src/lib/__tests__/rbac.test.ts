import { describe, expect, it } from 'vitest';
import {
  canAccessStationClient,
  hasPermission,
  isOperationallyAllowed,
  normalizeRole,
} from '../rbac';

describe('EV-A2 RBAC', () => {
  it('maps legacy roles to A2 roles', () => {
    expect(normalizeRole('global_admin')).toBe('system_admin');
    expect(normalizeRole('company_manager')).toBe('operations_manager');
    expect(normalizeRole('station_manager')).toBe('station_manager');
  });

  it('grants tariff management only to system admin', () => {
    expect(hasPermission('system_admin', 'manage_rates')).toBe(true);
    expect(hasPermission('global_admin', 'manage_rates')).toBe(true);
    expect(hasPermission('station_manager', 'manage_rates')).toBe(false);
    expect(hasPermission('accountant', 'manage_rates')).toBe(false);
  });

  it('allows import for import_officer and station_manager', () => {
    expect(hasPermission('import_officer', 'upload_shift_data')).toBe(true);
    expect(hasPermission('station_manager', 'upload_shift_data')).toBe(true);
    expect(hasPermission('report_viewer', 'upload_shift_data')).toBe(false);
    expect(hasPermission('accountant', 'upload_shift_data')).toBe(false);
  });

  it('enforces station isolation for scoped roles', () => {
    expect(canAccessStationClient('station_manager', ['station-a'], 'station-a')).toBe(true);
    expect(canAccessStationClient('station_manager', ['station-a'], 'station-b')).toBe(false);
    expect(canAccessStationClient('system_admin', [], 'station-b')).toBe(true);
  });

  it('blocks pending/disabled/rejected operational access', () => {
    expect(isOperationallyAllowed('pending', true)).toBe(false);
    expect(isOperationallyAllowed('rejected', true)).toBe(false);
    expect(isOperationallyAllowed('disabled', true)).toBe(false);
    expect(isOperationallyAllowed('approved', true)).toBe(true);
    expect(isOperationallyAllowed('approved', false)).toBe(false);
    // pre-migration compatibility
    expect(isOperationallyAllowed(null, true)).toBe(true);
  });
});
