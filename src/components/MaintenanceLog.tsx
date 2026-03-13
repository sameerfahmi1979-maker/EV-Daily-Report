import { useState, useEffect } from 'react';
import {
  Search, Wrench, Zap, Wifi, Power, AlertTriangle,
  Plus, CheckCircle, Loader2, X, Clock, Building2,
  Trash2,
} from 'lucide-react';
import {
  getMaintenanceRecords, createMaintenanceRecord,
  updateMaintenanceRecord, deleteMaintenanceRecord,
  MaintenanceRecord, IssueType, IssueStatus,
} from '../lib/maintenanceService';
import { getStations } from '../lib/stationService';
import { Database } from '../lib/database.types';

type Station = Database['public']['Tables']['stations']['Row'];

const ISSUE_ICONS: Record<IssueType, any> = {
  maintenance: Wrench,
  breakdown: AlertTriangle,
  software: Wifi,
  power_outage: Power,
  other: Zap,
};

const STATUS_STYLES: Record<IssueStatus, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-red-50', text: 'text-red-700', label: 'Open' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Progress' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Resolved' },
};

const ISSUE_LABELS: Record<IssueType, string> = {
  maintenance: 'Maintenance',
  breakdown: 'Breakdown',
  software: 'Software',
  power_outage: 'Power Outage',
  other: 'Other',
};

export default function MaintenanceLog() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStation, setFilterStation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // New record form
  const [formStation, setFormStation] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formType, setFormType] = useState<IssueType>('maintenance');
  const [formDesc, setFormDesc] = useState('');
  const [formDowntime, setFormDowntime] = useState('0');

  // Resolve modal
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    loadData();
  }, [filterStation, filterStatus]);

  async function loadData() {
    setLoading(true);
    try {
      const [recs, stns] = await Promise.all([
        getMaintenanceRecords({
          stationId: filterStation || undefined,
          status: (filterStatus as IssueStatus) || undefined,
        }),
        getStations(),
      ]);
      setRecords(recs);
      setStations(stns);
    } catch (err) {
      console.error('Failed to load maintenance:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formStation || !formDesc.trim()) return;
    setSaving(true);
    try {
      await createMaintenanceRecord({
        station_id: formStation,
        issue_date: formDate,
        issue_type: formType,
        description: formDesc,
        downtime_hours: parseFloat(formDowntime) || 0,
      });
      setShowForm(false);
      setFormDesc('');
      setFormDowntime('0');
      await loadData();
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve() {
    if (!resolvingId) return;
    setSaving(true);
    try {
      await updateMaintenanceRecord(resolvingId, {
        status: 'resolved',
        resolution,
        resolved_date: new Date().toISOString().slice(0, 10),
      });
      setResolvingId(null);
      setResolution('');
      await loadData();
    } catch (err) {
      console.error('Resolve failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetInProgress(id: string) {
    await updateMaintenanceRecord(id, { status: 'in_progress' });
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this maintenance record?')) return;
    await deleteMaintenanceRecord(id);
    await loadData();
  }

  const filtered = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.description.toLowerCase().includes(q) ||
      (r.resolution || '').toLowerCase().includes(q) ||
      (r.stations?.name || '').toLowerCase().includes(q)
    );
  });

  const openCount = records.filter(r => r.status === 'open').length;
  const inProgressCount = records.filter(r => r.status === 'in_progress').length;
  const resolvedCount = records.filter(r => r.status === 'resolved').length;
  const totalDowntime = records.reduce((sum, r) => sum + Number(r.downtime_hours || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Maintenance Log</h2>
          <p className="text-gray-600 mt-1">Track station issues, downtime, and resolutions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Report Issue
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: openCount, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'In Progress', value: inProgressCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Resolved', value: resolvedCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Downtime (hrs)', value: totalDowntime.toFixed(1), color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStation}
          onChange={(e) => setFilterStation(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">All Stations</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Records */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
            No maintenance records found.
          </div>
        ) : (
          filtered.map(record => {
            const IconComp = ISSUE_ICONS[record.issue_type] || Wrench;
            const statusStyle = STATUS_STYLES[record.status] || STATUS_STYLES.open;
            return (
              <div key={record.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    record.status === 'resolved' ? 'bg-emerald-50' : record.status === 'in_progress' ? 'bg-amber-50' : 'bg-red-50'
                  }`}>
                    <IconComp size={18} className={
                      record.status === 'resolved' ? 'text-emerald-600' : record.status === 'in_progress' ? 'text-amber-600' : 'text-red-600'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {ISSUE_LABELS[record.issue_type]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{record.description}</p>
                    {record.resolution && (
                      <p className="text-xs text-emerald-700 mt-1 bg-emerald-50 px-2 py-1 rounded">
                        ✅ {record.resolution}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Building2 size={10} /> {record.stations?.name || '—'}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {record.issue_date}</span>
                      {record.downtime_hours > 0 && (
                        <span className="text-red-500 font-medium">{record.downtime_hours}h downtime</span>
                      )}
                      {record.resolved_date && (
                        <span className="text-emerald-500">Resolved: {record.resolved_date}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {record.status === 'open' && (
                      <button
                        onClick={() => handleSetInProgress(record.id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        In Progress
                      </button>
                    )}
                    {(record.status === 'open' || record.status === 'in_progress') && (
                      <button
                        onClick={() => { setResolvingId(record.id); setResolution(''); }}
                        className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ==================== NEW ISSUE FORM ==================== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Report New Issue</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
                <select value={formStation} onChange={(e) => setFormStation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select station...</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as IssueType)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm">
                    {Object.entries(ISSUE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3}
                  placeholder="Describe the issue..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Downtime (hours)</label>
                <input type="number" step="0.5" min="0" value={formDowntime} onChange={(e) => setFormDowntime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !formStation || !formDesc.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESOLVE MODAL ==================== */}
      {resolvingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setResolvingId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Resolve Issue</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
                <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3}
                  placeholder="How was this resolved?"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setResolvingId(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleResolve} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {saving ? 'Resolving...' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
