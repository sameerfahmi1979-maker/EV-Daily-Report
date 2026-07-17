import { useState, useEffect, useCallback } from 'react';
import {
  getFirmwareUpdates, getChargers, scheduleFirmwareUpdate,
  type OcppFirmwareUpdate, type OcppCharger,
} from '../lib/ocppService';
import {
  Upload, Plus, RefreshCw, Loader2, AlertTriangle,
  CheckCircle, Clock, X, HardDrive,
} from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  Scheduled:          'bg-blue-100 text-blue-700',
  Downloading:        'bg-yellow-100 text-yellow-700 animate-pulse',
  Downloaded:         'bg-cyan-100 text-cyan-700',
  Installing:         'bg-purple-100 text-purple-700 animate-pulse',
  Installed:          'bg-green-100 text-green-700',
  InstallationFailed: 'bg-red-100 text-red-700',
};

const STATUS_ICON: Record<string, React.FC<any>> = {
  Scheduled:          Clock,
  Downloading:        Loader2,
  Downloaded:         CheckCircle,
  Installing:         Loader2,
  Installed:          CheckCircle,
  InstallationFailed: AlertTriangle,
};

function ScheduleModal({ chargers, onSchedule, onClose }: {
  chargers: OcppCharger[];
  onSchedule: (chargerId: string, url: string, date: string) => Promise<void>;
  onClose: () => void;
}) {
  const [chargerId, setChargerId] = useState(chargers[0]?.id ?? '');
  const [url, setUrl] = useState('');
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const [retrieveDate, setRetrieveDate] = useState(now.toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) { setError('Firmware URL is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSchedule(chargerId, url.trim(), new Date(retrieveDate).toISOString());
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Schedule Firmware Update</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charge Point *</label>
            <select value={chargerId} onChange={e => setChargerId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {chargers.map(c => <option key={c.id} value={c.id}>{c.charge_point_id}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firmware URL *</label>
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://firmware.example.com/v2.1.0.bin"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retrieve Date *</label>
            <input
              type="datetime-local"
              required
              value={retrieveDate}
              onChange={e => setRetrieveDate(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Charger will begin downloading at this time</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Schedule Update
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FirmwareManagement() {
  const [updates, setUpdates] = useState<OcppFirmwareUpdate[]>([]);
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([getFirmwareUpdates(), getChargers()]);
      setUpdates(u);
      setChargers(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSchedule = async (chargerId: string, url: string, date: string) => {
    await scheduleFirmwareUpdate(chargerId, url, date);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Firmware Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule and track OTA firmware updates</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={chargers.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={15} /> Schedule Update
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Charge Point</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Firmware URL</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Retrieve Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Scheduled At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Loading firmware history...
              </td></tr>
            ) : updates.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-16 text-gray-400">
                <HardDrive size={32} className="mx-auto mb-2 opacity-30" /><br />No firmware updates scheduled
              </td></tr>
            ) : (
              updates.map(u => {
                const Icon = STATUS_ICON[u.status] ?? Clock;
                return (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{u.charger?.charge_point_id ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-blue-600 truncate max-w-xs">
                      <a href={u.firmware_url} target="_blank" rel="noreferrer" className="hover:underline">{u.firmware_url}</a>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(u.retrieve_date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[u.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        <Icon size={10} className={u.status.includes('ing') ? 'animate-spin' : ''} />
                        {u.status}
                      </span>
                      {u.error_log && <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs">{u.error_log}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ScheduleModal
          chargers={chargers}
          onSchedule={handleSchedule}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
