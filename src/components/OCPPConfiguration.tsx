import { useState, useEffect } from 'react';
import {
  getChargers, getConfigurationKeys, changeConfiguration, triggerGetConfiguration,
  type OcppCharger, type OcppConfigKey,
} from '../lib/ocppService';
import {
  Settings, RefreshCw, Download, Edit2, Save, X, Loader2,
  Lock, Unlock, Search,
} from 'lucide-react';

function KeyRow({ cfgKey, onSave }: { cfgKey: OcppConfigKey; onSave: (key: string, value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cfgKey.value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(cfgKey.key, draft);
      setEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5">
        {cfgKey.readonly
          ?       <Lock size={13} className="text-gray-300" />
          : <Unlock size={13} className="text-gray-400" />}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-700 font-medium">{cfgKey.key}</td>
      <td className="px-4 py-2.5">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="text-xs border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 w-full min-w-[180px]"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <span className="font-mono text-xs text-gray-600 break-all">{cfgKey.value ?? <span className="text-gray-300 italic">null</span>}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(cfgKey.updated_at).toLocaleDateString()}</td>
      <td className="px-4 py-2.5">
        {!cfgKey.readonly && (
          editing ? (
            <div className="flex items-center gap-1">
              <button onClick={save} disabled={saving}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50" title="Save">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              </button>
              <button onClick={() => { setEditing(false); setDraft(cfgKey.value ?? ''); }}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors" title="Cancel">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
              <Edit2 size={13} />
            </button>
          )
        )}
      </td>
    </tr>
  );
}

export default function OCPPConfiguration() {
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [keys, setKeys] = useState<OcppConfigKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [showReadonly, setShowReadonly] = useState(true);

  useEffect(() => {
    setLoading(true);
    getChargers().then(c => {
      setChargers(c);
      if (c.length > 0) setSelectedId(c[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    getConfigurationKeys(selectedId).then(k => { setKeys(k); setLoading(false); });
  }, [selectedId]);

  const handleSave = async (key: string, value: string) => {
    await changeConfiguration(selectedId, key, value);
    // Optimistically update local state
    setKeys(prev => prev.map(k => k.key === key ? { ...k, value } : k));
  };

  const handleFetch = async () => {
    setFetching(true);
    try {
      await triggerGetConfiguration(selectedId);
      alert('GetConfiguration command queued. Refresh in ~5 seconds once the charger responds.');
    } finally {
      setFetching(false);
    }
  };

  const filtered = keys.filter(k => {
    if (!showReadonly && k.readonly) return false;
    if (!search) return true;
    return k.key.toLowerCase().includes(search.toLowerCase()) ||
      (k.value ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const selectedCharger = chargers.find(c => c.id === selectedId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OCPP Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and change OCPP configuration keys per charge point</p>
        </div>
      </div>

      {/* Charger selector */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Charge Point</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {chargers.map(c => (
              <option key={c.id} value={c.id}>{c.charge_point_id} {c.connection_status === 'Offline' ? '(offline)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleFetch}
            disabled={!selectedId || fetching}
            title="Send GetConfiguration to fetch latest keys from charger"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {fetching ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Fetch from Charger
          </button>
          <button
            onClick={() => { setLoading(true); getConfigurationKeys(selectedId).then(k => { setKeys(k); setLoading(false); }); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {selectedCharger && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${selectedCharger.connection_status === 'Online' ? 'bg-green-500' : 'bg-gray-300'}`} />
            {selectedCharger.connection_status} · FW: {selectedCharger.firmware_version ?? '—'}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter keys or values..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showReadonly}
            onChange={e => setShowReadonly(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show read-only keys
        </label>
        <span className="text-xs text-gray-400">{filtered.length} key{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Key</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Value</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Updated</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Loading configuration...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-16 text-gray-400">
                <Settings size={32} className="mx-auto mb-2 opacity-30" /><br />
                {keys.length === 0
                  ? 'No keys cached yet — click "Fetch from Charger" to retrieve them'
                  : 'No keys match the filter'}
              </td></tr>
            ) : (
              filtered.map(k => (
                <KeyRow key={k.id} cfgKey={k} onSave={handleSave} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-700">
        <strong>Note:</strong> Changes are sent as{' '}
        <code className="font-mono text-xs bg-amber-100 px-1 rounded">ChangeConfiguration</code>{' '}
        OCPP commands. The charger may reject a change if the key is read-only or the value is invalid. Check the
        Charge Points command log to confirm acceptance.
      </div>
    </div>
  );
}
