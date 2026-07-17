import { useState, useEffect, useCallback } from 'react';
import {
  getChargers, getConnectors, getRecentCommands, sendRemoteCommand,
  deleteCharger,
  type OcppCharger, type OcppConnector, type OcppRemoteCommand, type CommandType,
} from '../lib/ocppService';
import {
  Wifi, WifiOff, Zap, ChevronDown, ChevronRight, RefreshCw,
  Play, Square, RotateCcw, Unlock, Terminal, Trash2, AlertTriangle,
  CheckCircle, Clock, XCircle, Loader2, Search, Activity,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function onlineDuration(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_DOT: Record<string, string> = {
  Available:   'bg-green-500',
  Charging:    'bg-blue-500 animate-pulse',
  Faulted:     'bg-red-500',
  Unavailable: 'bg-gray-400',
  Preparing:   'bg-blue-400',
  Finishing:   'bg-purple-500',
  Reserved:    'bg-orange-500',
};

const CMD_STATUS: Record<string, { color: string; icon: React.FC<any> }> = {
  Pending:  { color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  Sent:     { color: 'text-blue-600 bg-blue-50',     icon: Loader2 },
  Accepted: { color: 'text-green-600 bg-green-50',   icon: CheckCircle },
  Rejected: { color: 'text-red-600 bg-red-50',       icon: XCircle },
  Error:    { color: 'text-red-600 bg-red-50',        icon: XCircle },
  Timeout:  { color: 'text-orange-600 bg-orange-50', icon: Clock },
};

// ─── Remote Command Panel ─────────────────────────────────────────────────────

function RemoteCommandPanel({ charger, connectors }: { charger: OcppCharger; connectors: OcppConnector[] }) {
  const [commands, setCommands] = useState<OcppRemoteCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // For RemoteStart
  const [startConnectorId, setStartConnectorId] = useState(connectors[0]?.connector_id?.toString() ?? '1');
  const [startIdTag, setStartIdTag] = useState('');

  // For RemoteStop
  const [stopTransactionId, setStopTransactionId] = useState('');

  // For Unlock
  const [unlockConnectorId, setUnlockConnectorId] = useState(connectors[0]?.connector_id?.toString() ?? '1');

  const loadCommands = useCallback(async () => {
    setLoading(true);
    const data = await getRecentCommands(charger.id, 8);
    setCommands(data);
    setLoading(false);
  }, [charger.id]);

  useEffect(() => { loadCommands(); }, [loadCommands]);

  // Find active session transaction ID for convenience
  const activeSession = connectors.find(c => c.current_session_id && c.status === 'Charging')?.current_session;
  useEffect(() => {
    if (activeSession && 'transaction_id' in activeSession) {
      setStopTransactionId(String(activeSession.transaction_id));
    }
  }, [activeSession]);

  async function dispatch(type: CommandType, params: Record<string, unknown>, connectorId?: number) {
    setSending(type);
    setFeedback(null);
    try {
      await sendRemoteCommand(charger.id, type, params, connectorId);
      setFeedback({ type: 'success', msg: `${type} queued — awaiting charger response` });
      setTimeout(loadCommands, 1000);
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.message ?? 'Command failed' });
    } finally {
      setSending(null);
    }
  }

  const isOffline = charger.connection_status !== 'Online';

  return (
    <div className="space-y-5">
      {isOffline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm">
          <WifiOff size={14} />
          Charger is offline — commands will queue until reconnection
        </div>
      )}

      {feedback && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {feedback.msg}
        </div>
      )}

      {/* Remote Start */}
      <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Play size={14} className="text-green-600" /> Remote Start</p>
        <div className="flex gap-2 flex-wrap">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Connector</label>
            <select
              value={startConnectorId}
              onChange={e => setStartConnectorId(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {connectors.map(c => (
                <option key={c.id} value={c.connector_id}>{c.connector_id} — {c.connector_type}</option>
              ))}
              {connectors.length === 0 && <option value="1">1</option>}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 mb-1 block">RFID Tag / ID Tag</label>
            <input
              type="text"
              placeholder="e.g. 202404000004445"
              value={startIdTag}
              onChange={e => setStartIdTag(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              disabled={!startIdTag.trim() || sending === 'RemoteStartTransaction'}
              onClick={() => dispatch('RemoteStartTransaction', { idTag: startIdTag.trim() }, Number(startConnectorId))}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending === 'RemoteStartTransaction' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Start
            </button>
          </div>
        </div>
      </div>

      {/* Remote Stop */}
      <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Square size={14} className="text-red-600" /> Remote Stop</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Transaction ID</label>
            <input
              type="text"
              placeholder="e.g. 1234"
              value={stopTransactionId}
              onChange={e => setStopTransactionId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            disabled={!stopTransactionId.trim() || sending === 'RemoteStopTransaction'}
            onClick={() => dispatch('RemoteStopTransaction', { transactionId: Number(stopTransactionId) })}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending === 'RemoteStopTransaction' ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
            Stop
          </button>
        </div>
      </div>

      {/* Reset + Unlock */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><RotateCcw size={14} className="text-orange-600" /> Reset</p>
          <div className="flex gap-2">
            <button
              disabled={!!sending}
              onClick={() => dispatch('Reset', { type: 'Soft' })}
              className="flex-1 text-xs font-medium py-1.5 rounded border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              {sending === 'Reset' ? <Loader2 size={11} className="animate-spin inline" /> : null} Soft
            </button>
            <button
              disabled={!!sending}
              onClick={() => { if (confirm('Hard reset will interrupt all active sessions. Continue?')) dispatch('Reset', { type: 'Hard' }); }}
              className="flex-1 text-xs font-medium py-1.5 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              Hard
            </button>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Unlock size={14} className="text-purple-600" /> Unlock</p>
          <div className="flex gap-2 items-end">
            <select
              value={unlockConnectorId}
              onChange={e => setUnlockConnectorId(e.target.value)}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
            >
              {connectors.map(c => (
                <option key={c.id} value={c.connector_id}>#{c.connector_id}</option>
              ))}
              {connectors.length === 0 && <option value="1">1</option>}
            </select>
            <button
              disabled={!!sending}
              onClick={() => dispatch('UnlockConnector', {}, Number(unlockConnectorId))}
              className="text-xs font-medium px-3 py-1.5 rounded border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>

      {/* Command history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Terminal size={14} className="text-gray-500" /> Recent Commands
          </p>
          <button onClick={loadCommands} className="text-xs text-blue-600 hover:underline">Refresh</button>
        </div>
        {loading ? (
          <div className="text-center py-4"><Loader2 size={16} className="animate-spin inline text-gray-400" /></div>
        ) : commands.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">No commands sent yet</p>
        ) : (
          <div className="space-y-1.5">
            {commands.map(cmd => {
              const st = CMD_STATUS[cmd.status] ?? CMD_STATUS.Error;
              const Icon = st.icon;
              return (
                <div key={cmd.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded border border-gray-100 bg-white">
                  <span className="font-mono text-gray-700">{cmd.command_type}</span>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                      <Icon size={10} className={cmd.status === 'Sent' ? 'animate-spin' : ''} />
                      {cmd.status}
                    </span>
                    <span className="text-gray-400">{timeAgo(cmd.requested_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Charger row ─────────────────────────────────────────────────────────────

function ChargerRow({ charger, onDelete }: { charger: OcppCharger; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [connectors, setConnectors] = useState<OcppConnector[]>([]);
  const [loadingConn, setLoadingConn] = useState(false);

  const loadConnectors = useCallback(async () => {
    setLoadingConn(true);
    try {
      const data = await getConnectors(charger.id);
      setConnectors(data);
    } finally {
      setLoadingConn(false);
    }
  }, [charger.id]);

  const handleExpand = () => {
    if (!expanded) loadConnectors();
    setExpanded(v => !v);
  };

  const stationName = (charger as any).station?.name ?? '—';
  const isOnline = charger.connection_status === 'Online';

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expanded ? 'bg-blue-50/50' : ''}`}>
        <td className="px-4 py-3">
          <button onClick={handleExpand} className="text-gray-400 hover:text-blue-600 transition-colors">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="font-mono text-sm font-medium text-gray-800">{charger.charge_point_id}</span>
          </div>
          {charger.model && <p className="text-xs text-gray-400 mt-0.5 ml-4">{charger.vendor} {charger.model}</p>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{stationName}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            {charger.connection_status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(charger.last_heartbeat_at)}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{isOnline ? onlineDuration(charger.last_heartbeat_at) : '—'}</td>
        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{charger.firmware_version ?? '—'}</td>
        <td className="px-4 py-3">
          <button
            onClick={() => { if (confirm(`Delete charger ${charger.charge_point_id}?`)) onDelete(charger.id); }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete charger"
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-blue-100">
          <td colSpan={8} className="px-4 py-0">
            <div className="py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Connector status */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Activity size={14} /> Connectors
                  {loadingConn && <Loader2 size={12} className="animate-spin text-gray-400" />}
                </h4>
                <div className="space-y-2">
                  {connectors.map(c => (
                    <div key={c.id} className="flex items-center gap-3 text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[c.status] ?? 'bg-gray-300'}`} />
                      <span className="font-medium text-gray-700">#{c.connector_id}</span>
                      <span className="text-gray-500">{c.connector_type}</span>
                      <span className="text-gray-400">{c.power_kw} kW</span>
                      <span className="ml-auto font-medium text-gray-600">{c.status}</span>
                    </div>
                  ))}
                  {!loadingConn && connectors.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No connectors registered</p>
                  )}
                </div>
              </div>

              {/* Remote commands */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Terminal size={14} /> Remote Control
                </h4>
                <RemoteCommandPanel charger={charger} connectors={connectors} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChargePointList() {
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getChargers();
      setChargers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await deleteCharger(id);
      setChargers(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  const filtered = chargers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.charge_point_id.toLowerCase().includes(q) ||
      ((c as any).station?.name ?? '').toLowerCase().includes(q) ||
      (c.model ?? '').toLowerCase().includes(q)
    );
  });

  const online = chargers.filter(c => c.connection_status === 'Online').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charge Points</h1>
          <p className="text-sm text-gray-500 mt-0.5">{online} online · {chargers.length} total</p>
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

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by charge point ID, station, model..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Charge Point ID</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Station</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Last Heartbeat</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Online Time</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Firmware</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Loading charge points...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                <Zap size={32} className="mx-auto mb-2 opacity-30" /><br />
                {chargers.length === 0 ? 'No charge points registered' : 'No results match your search'}
              </td></tr>
            ) : (
              filtered.map(charger => (
                <ChargerRow key={charger.id} charger={charger} onDelete={handleDelete} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
