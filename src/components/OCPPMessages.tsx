import { useState, useEffect, useCallback } from 'react';
import { getOcppMessages, getChargers, type OcppMessage, type OcppCharger } from '../lib/ocppService';
import {
  MessageSquare, ArrowRight, ArrowLeft,
  RefreshCw, Search, X, Filter, Loader2,
} from 'lucide-react';

function DirectionIcon({ direction }: { direction: string }) {
  return direction === 'Incoming'
    ? <ArrowLeft size={13} className="text-blue-500" />
    : <ArrowRight size={13} className="text-green-600" />;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Success: 'bg-green-100 text-green-700',
    Error:   'bg-red-100 text-red-700',
    Pending: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function PayloadModal({ msg, onClose }: { msg: OcppMessage; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <p className="font-bold text-gray-900">{msg.action ?? msg.message_type}</p>
            <p className="text-xs text-gray-500 mt-0.5">{msg.charger?.charge_point_id ?? 'Unknown charger'} · {new Date(msg.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono">
            {JSON.stringify(msg.payload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function OCPPMessages() {
  const [messages, setMessages] = useState<OcppMessage[]>([]);
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<'all' | 'Incoming' | 'Outgoing'>('all');
  const [chargerFilter, setChargerFilter] = useState('all');
  const [selected, setSelected] = useState<OcppMessage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [msgs, chs] = await Promise.all([
        getOcppMessages(chargerFilter === 'all' ? undefined : chargerFilter, 200),
        getChargers(),
      ]);
      setMessages(msgs);
      setChargers(chs);
    } finally {
      setLoading(false);
    }
  }, [chargerFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = messages.filter(m => {
    if (dirFilter !== 'all' && m.direction !== dirFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.action ?? '').toLowerCase().includes(q) ||
      (m.charger?.charge_point_id ?? '').toLowerCase().includes(q) ||
      m.message_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OCPP Messages</h1>
          <p className="text-sm text-gray-500 mt-0.5">Protocol message log between chargers and central system</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search action, charger..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={chargerFilter} onChange={e => setChargerFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Chargers</option>
            {chargers.map(c => <option key={c.id} value={c.id}>{c.charge_point_id}</option>)}
          </select>
          <select value={dirFilter} onChange={e => setDirFilter(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Directions</option>
            <option value="Incoming">Incoming (↑)</option>
            <option value="Outgoing">Outgoing (↓)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Charger</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Loading messages...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" /><br />No messages found
              </td></tr>
            ) : (
              filtered.map(msg => (
                <tr
                  key={msg.id}
                  onClick={() => setSelected(msg)}
                  className={`border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors ${msg.processing_status === 'Error' ? 'bg-red-50/20' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <DirectionIcon direction={msg.direction} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {msg.charger?.charge_point_id ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-xs text-gray-800">
                    {msg.action ?? '—'}
                    {msg.error_code && <span className="ml-2 text-xs text-red-500 font-normal">{msg.error_code}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{msg.message_type}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={msg.processing_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && <PayloadModal msg={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
