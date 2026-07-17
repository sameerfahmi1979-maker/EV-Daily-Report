import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  getConnectorsWithSessions,
  getLatestMeterValues,
  type OcppConnector,
  type ConnectorStatus,
} from '../lib/ocppService';
import SparklineChart from './SparklineChart';
import {
  Wifi, WifiOff, Zap, ZapOff, AlertTriangle, Clock, Activity,
  RefreshCw, Filter, Search,
} from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConnectorStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  Available:     { label: 'Idle',        bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', dot: 'bg-green-500' },
  Preparing:     { label: 'Preparing',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',  dot: 'bg-blue-400' },
  Charging:      { label: 'Charging',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',  dot: 'bg-blue-600' },
  SuspendedEV:   { label: 'EV Paused',   bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200',dot: 'bg-yellow-500' },
  SuspendedEVSE: { label: 'EVSE Paused', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200',dot: 'bg-yellow-500' },
  Finishing:     { label: 'Finishing',   bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200',dot: 'bg-purple-500' },
  Reserved:      { label: 'Reserved',    bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200',dot: 'bg-orange-500' },
  Unavailable:   { label: 'Unavailable', bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200',  dot: 'bg-gray-400' },
  Faulted:       { label: 'Faulted',     bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500' },
};

function formatDuration(startIso: string): string {
  const diff = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatEnergy(wh: number | null): string {
  if (wh == null) return '—';
  if (wh >= 1000) return `${(wh / 1000).toFixed(2)} kWh`;
  return `${wh.toFixed(0)} Wh`;
}

// ─── Mini chart hook ──────────────────────────────────────────────────────────

function usePowerSparkline(connectorDbId: string, sessionId: string | null): number[] {
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    if (!sessionId) { setValues([]); return; }

    getLatestMeterValues(connectorDbId, 'Power.Active.Import', 15)
      .then(mv => setValues(mv.map(v => v.value)));

    const ch = supabase
      .channel(`meter-${connectorDbId}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'ocpp_meter_values',
          filter: `connector_id=eq.${connectorDbId}` },
        (payload: any) => {
          if (payload.new?.measurand === 'Power.Active.Import') {
            setValues(prev => [...prev.slice(-14), payload.new.value as number]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [connectorDbId, sessionId]);

  return values;
}

// ─── Connector card ───────────────────────────────────────────────────────────

function ConnectorCard({ connector }: { connector: OcppConnector }) {
  const cfg = STATUS_CONFIG[connector.status] ?? STATUS_CONFIG.Unavailable;
  const session = connector.current_session;
  const charger = connector.charger as any;
  const stationName = charger?.station?.name ?? '—';
  const chargePointId = charger?.charge_point_id ?? '—';
  const isOnline = charger?.connection_status === 'Online';
  const powerValues = usePowerSparkline(connector.id, connector.current_session_id);
  const [, forceUpdate] = useState(0);

  // Re-render every second to refresh live duration counter
  useEffect(() => {
    if (connector.status !== 'Charging') return;
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [connector.status]);

  const lastPower = powerValues.length > 0 ? powerValues[powerValues.length - 1] : null;

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-3 transition-all hover:shadow-md`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.text} bg-white border ${cfg.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {connector.status === 'Charging' && (
              <span className="text-xs text-blue-600 font-medium animate-pulse">● LIVE</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">{chargePointId} · #{connector.connector_id}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isOnline
            ? <Wifi size={14} className="text-green-500" />
            : <WifiOff size={14} className="text-gray-400" />}
          {connector.status === 'Charging' && Number(connector.power_kw) > 0 && (
            <span className="text-xs font-bold text-blue-600 whitespace-nowrap">
              {Number(connector.power_kw).toFixed(1)} kW
            </span>
          )}
        </div>
      </div>

      {/* Station */}
      <p className="text-sm font-medium text-gray-800 truncate">{stationName}</p>

      {/* Session / connector info */}
      {connector.status === 'Charging' && session ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock size={12} />
            <span>{formatDuration(session.start_timestamp)}</span>
            <span className="mx-1 text-gray-300">·</span>
            <Zap size={12} />
            <span>{formatEnergy(session.energy_consumed_wh)}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">Tag: {session.id_tag}</p>
          {powerValues.length >= 2 && (
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-blue-500 flex-shrink-0" />
              <SparklineChart data={powerValues} color="#2563eb" width={100} height={24} />
              {lastPower != null && (
                <span className="text-xs font-medium text-blue-600">
                  {lastPower >= 1000 ? `${(lastPower / 1000).toFixed(1)} kW` : `${lastPower.toFixed(0)} W`}
                </span>
              )}
            </div>
          )}
        </div>
      ) : connector.status === 'Faulted' ? (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle size={12} />
          <span>{connector.error_code ?? connector.info ?? 'Fault'}</span>
        </div>
      ) : connector.status === 'Available' ? (
        <p className="text-xs text-green-600">Ready to charge</p>
      ) : (
        <p className="text-xs text-gray-400">{connector.info ?? 'No active session'}</p>
      )}

      {/* Connector type badge */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">
          {connector.connector_type}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(connector.last_status_update).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ connectors }: { connectors: OcppConnector[] }) {
  const counts = connectors.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const items = [
    { key: 'Charging',    label: 'Charging',    color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { key: 'Available',   label: 'Available',   color: 'text-green-600 bg-green-50 border-green-200' },
    { key: 'Faulted',     label: 'Faulted',     color: 'text-red-600 bg-red-50 border-red-200' },
    { key: 'Unavailable', label: 'Unavailable', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, label, color }) => (
        <span key={key} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
          {counts[key] ?? 0} {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-600">
        {connectors.length} Total
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChargerMonitor() {
  const [connectors, setConnectors] = useState<OcppConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConnectorStatus | 'all'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadConnectors = useCallback(async () => {
    try {
      setError(null);
      const data = await getConnectorsWithSessions();
      setConnectors(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load connector status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnectors();

    // Subscribe to connector status updates
    const connectorCh = supabase
      .channel('connector-status-live')
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'ocpp_connectors' },
        (payload: any) => {
          setConnectors(prev =>
            prev.map(c =>
              c.id === payload.new.id
                ? { ...c, ...payload.new }
                : c
            )
          );
          setLastRefresh(new Date());
        }
      )
      .subscribe();

    // Subscribe to charger online/offline updates
    const chargerCh = supabase
      .channel('charger-connection-live')
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'ocpp_chargers' },
        () => { loadConnectors(); }
      )
      .subscribe();

    // Subscribe to session energy updates — updates energy_consumed_wh live
    const sessionCh = supabase
      .channel('session-energy-live')
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'ocpp_charging_sessions',
          filter: 'session_status=eq.Active' },
        (payload: any) => {
          setConnectors(prev =>
            prev.map(c => {
              if (!c.current_session || c.current_session_id !== payload.new.id) return c;
              return {
                ...c,
                current_session: {
                  ...c.current_session,
                  energy_consumed_wh: payload.new.energy_consumed_wh,
                },
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(connectorCh);
      supabase.removeChannel(chargerCh);
      supabase.removeChannel(sessionCh);
    };
  }, [loadConnectors]);

  const filtered = connectors.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const charger = c.charger as any;
    return (
      (charger?.charge_point_id ?? '').toLowerCase().includes(q) ||
      (charger?.station?.name ?? '').toLowerCase().includes(q) ||
      c.connector_type.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connector Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time status · Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); loadConnectors(); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      <SummaryBar connectors={connectors} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search charge point, station..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
            {Object.keys(STATUS_CONFIG).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s as ConnectorStatus].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ZapOff size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No connectors found</p>
          <p className="text-sm mt-1">Try adjusting the search or status filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(connector => (
            <ConnectorCard key={connector.id} connector={connector} />
          ))}
        </div>
      )}
    </div>
  );
}
