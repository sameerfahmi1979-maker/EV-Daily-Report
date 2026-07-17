import { useState, useEffect, useCallback } from 'react';
import { getConnectors, type OcppConnector, type ConnectorStatus } from '../lib/ocppService';
import { supabase } from '../lib/supabase';
import { AlertTriangle, RefreshCw, Search, Filter, Loader2, Zap } from 'lucide-react';

const STATUS_BADGE: Record<ConnectorStatus, string> = {
  Available:     'bg-green-100 text-green-700 border-green-200',
  Preparing:     'bg-blue-100 text-blue-700 border-blue-200',
  Charging:      'bg-blue-100 text-blue-800 border-blue-300',
  SuspendedEV:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  SuspendedEVSE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Finishing:     'bg-purple-100 text-purple-700 border-purple-200',
  Reserved:      'bg-orange-100 text-orange-700 border-orange-200',
  Unavailable:   'bg-gray-100 text-gray-500 border-gray-200',
  Faulted:       'bg-red-100 text-red-700 border-red-200',
};

const CONNECTOR_TYPES = ['Type1', 'Type2', 'CCS', 'CCS1', 'CCS2', 'CHAdeMO', 'Tesla', 'NACS', 'GBT DC'];

export default function ConnectorList() {
  const [connectors, setConnectors] = useState<OcppConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConnectorStatus | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ connector_type: string; power_kw: string }>({ connector_type: '', power_kw: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConnectors();
      setConnectors(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const ch = supabase
      .channel('connector-list-live')
      .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'ocpp_connectors' }, (payload: any) => {
        setConnectors(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const startEdit = (c: OcppConnector) => {
    setEditingId(c.id);
    setEditForm({ connector_type: c.connector_type, power_kw: String(c.power_kw) });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('ocpp_connectors')
        .update({ connector_type: editForm.connector_type, power_kw: Number(editForm.power_kw) })
        .eq('id', editingId);
      if (error) throw error;
      setConnectors(prev => prev.map(c =>
        c.id === editingId
          ? { ...c, connector_type: editForm.connector_type, power_kw: Number(editForm.power_kw) }
          : c
      ));
      setEditingId(null);
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = connectors.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const charger = c.charger as any;
    return (
      (charger?.charge_point_id ?? '').toLowerCase().includes(q) ||
      c.connector_type.toLowerCase().includes(q) ||
      (charger?.station?.name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
          <p className="text-sm text-gray-500 mt-0.5">{connectors.length} total connectors</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search charge point, station, type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ConnectorStatus | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_BADGE).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Charge Point ID</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Connector</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Power</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Station</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Last Update</th>
              <th className="px-4 py-3 w-20 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Loading connectors...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                <Zap size={32} className="mx-auto mb-2 opacity-30" /><br />No connectors found
              </td></tr>
            ) : (
              filtered.map((c, i) => {
                const charger = c.charger as any;
                const isEditing = editingId === c.id;
                return (
                  <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${c.status === 'Faulted' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{charger?.charge_point_id ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">#{c.connector_id}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {c.status}
                      </span>
                      {c.error_code && c.error_code !== 'NoError' && (
                        <p className="text-xs text-red-500 mt-0.5">{c.error_code}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.connector_type}
                          onChange={e => setEditForm(f => ({ ...f, connector_type: e.target.value }))}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          {CONNECTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{c.connector_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editForm.power_kw}
                            onChange={e => setEditForm(f => ({ ...f, power_kw: e.target.value }))}
                            className="w-20 text-xs border border-gray-300 rounded px-2 py-1"
                          />
                          <span className="text-xs text-gray-400">kW</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">{c.power_kw > 0 ? `${c.power_kw} kW` : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{charger?.station?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(c.last_status_update).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(c)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
