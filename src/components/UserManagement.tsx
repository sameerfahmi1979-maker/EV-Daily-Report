import { useState, useEffect } from 'react';
import {
  Search, Shield, Building2,
  CheckCircle, XCircle, Loader2, X, User, Mail, AlertCircle,
} from 'lucide-react';
import {
  getAllUsers, updateUserProfile, UserProfile,
  ROLE_LABELS, ROLE_COLORS, UserRole, PERMISSIONS, hasPermission,
} from '../lib/userService';
import { getStations } from '../lib/stationService';
import { Database } from '../lib/database.types';

type Station = Database['public']['Tables']['stations']['Row'];

const ROLES: { key: UserRole; label: string; desc: string }[] = [
  { key: 'global_admin', label: 'Global Admin', desc: 'Full system access' },
  { key: 'company_manager', label: 'Company Manager', desc: 'Manage all stations and settings' },
  { key: 'station_manager', label: 'Station Manager', desc: 'Manage assigned station' },
  { key: 'accountant', label: 'Accountant', desc: 'Financial reports and views' },
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editRole, setEditRole] = useState<UserRole>('station_manager');
  const [editStation, setEditStation] = useState('');
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersData, stationsData] = await Promise.all([
        getAllUsers(),
        getStations(),
      ]);
      setUsers(usersData);
      setStations(stationsData);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(user: UserProfile) {
    setEditingUser(user);
    setEditRole(user.role);
    setEditStation(user.station_id || '');
    setEditActive(user.is_active);
    setError(null);
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(editingUser.id, {
        role: editRole,
        station_id: editStation || null,
        is_active: editActive,
      });
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  // Permission groups for the preview
  const PERM_GROUPS: { label: string; perms: string[] }[] = [
    { label: 'Views', perms: ['view_dashboard', 'view_analytics', 'view_reports'] },
    { label: 'Data', perms: ['upload_shift_data', 'delete_import_batch'] },
    { label: 'Shifts', perms: ['manage_shifts', 'update_handover'] },
    { label: 'Admin', perms: ['manage_stations', 'manage_operators', 'manage_rates', 'manage_users', 'edit_system_settings'] },
    { label: 'Export', perms: ['export_pdf', 'export_cdr'] },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <p className="text-gray-600 mt-1">Manage user roles, station assignments, and permissions</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role.key).length;
          const colors = ROLE_COLORS[role.key];
          return (
            <div key={role.key} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <Shield size={16} className={colors.text} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">{role.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Station</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Joined</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />Loading users...
              </td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No users found.</td></tr>
            ) : (
              filteredUsers.map(user => {
                const roleColors = ROLE_COLORS[user.role] || ROLE_COLORS.station_manager;
                const stationName = stations.find(s => s.id === user.station_id)?.name;
                return (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                          <User size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail size={10} /> {user.email || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${roleColors.bg} ${roleColors.text}`}>
                        <Shield size={10} />
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {stationName ? (
                        <span className="flex items-center gap-1 text-sm text-gray-700">
                          <Building2 size={12} className="text-gray-400" />
                          {stationName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">All Stations</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                          <CheckCircle size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(user)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ==================== EDIT USER MODAL ==================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Edit User</h3>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{editingUser.email} — {editingUser.full_name}</p>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-800">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => {
                    const colors = ROLE_COLORS[role.key];
                    return (
                      <button
                        key={role.key}
                        onClick={() => setEditRole(role.key)}
                        className={`p-3 rounded-lg text-left transition-all border ${
                          editRole === role.key
                            ? `${colors.bg} ${colors.text} ring-2 ring-blue-300 border-transparent`
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Shield size={14} />
                          <span className="text-sm font-medium">{role.label}</span>
                        </div>
                        <p className="text-xs mt-0.5 opacity-70">{role.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Station Assignment */}
              {editRole === 'station_manager' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Station</label>
                  <select
                    value={editStation}
                    onChange={(e) => setEditStation(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No specific station</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Account Active</p>
                  <p className="text-xs text-gray-500">Inactive users cannot log in</p>
                </div>
                <button
                  onClick={() => setEditActive(!editActive)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editActive ? 'bg-emerald-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${editActive ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Permission Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions for {ROLE_LABELS[editRole]}</label>
                <div className="space-y-2">
                  {PERM_GROUPS.map(group => (
                    <div key={group.label} className="flex items-start gap-3">
                      <span className="text-xs font-medium text-gray-500 w-16 pt-0.5">{group.label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.perms.map(perm => {
                          const allowed = hasPermission(editRole, perm);
                          return (
                            <span
                              key={perm}
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                allowed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-400 line-through'
                              }`}
                            >
                              {perm.replace(/_/g, ' ')}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
