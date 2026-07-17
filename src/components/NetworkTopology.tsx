import { useState, useEffect } from 'react';
import { getTopology, type TopologyNode, type ConnectorStatus } from '../lib/ocppService';
import {
  Building2, Zap, Cable, ChevronDown, ChevronRight,
  Wifi, WifiOff, AlertTriangle, CheckCircle, Loader2, RefreshCw,
} from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function ConnectorBadge({ status }: { status: ConnectorStatus }) {
  const colors: Record<ConnectorStatus, string> = {
    Available:     'bg-green-100 text-green-700',
    Preparing:     'bg-blue-100 text-blue-700',
    Charging:      'bg-blue-200 text-blue-800',
    SuspendedEV:   'bg-yellow-100 text-yellow-700',
    SuspendedEVSE: 'bg-yellow-100 text-yellow-700',
    Finishing:     'bg-purple-100 text-purple-700',
    Reserved:      'bg-orange-100 text-orange-700',
    Unavailable:   'bg-gray-100 text-gray-500',
    Faulted:       'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function chargerStatusSummary(connectors: TopologyNode['stations'][0]['chargers'][0]['connectors']): 'ok' | 'warning' | 'error' {
  if (connectors.some(c => c.status === 'Faulted')) return 'error';
  if (connectors.some(c => c.status === 'Unavailable')) return 'warning';
  return 'ok';
}

// ─── Tree nodes ───────────────────────────────────────────────────────────────

function ConnectorNode({ conn }: { conn: TopologyNode['stations'][0]['chargers'][0]['connectors'][0] }) {
  return (
    <div className="flex items-center gap-2 pl-14 py-1.5">
      <Cable size={12} className="text-gray-300 flex-shrink-0" />
      <span className="text-xs text-gray-600 font-mono">#{conn.connectorId}</span>
      <span className="text-xs text-gray-400">{conn.connectorType}</span>
      {conn.powerKw > 0 && <span className="text-xs text-gray-400">{conn.powerKw} kW</span>}
      <ConnectorBadge status={conn.status} />
    </div>
  );
}

function ChargerNode({ charger }: { charger: TopologyNode['stations'][0]['chargers'][0] }) {
  const [open, setOpen] = useState(false);
  const summary = chargerStatusSummary(charger.connectors);
  const isOnline = charger.connectionStatus === 'Online';

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 pl-8 pr-4 py-2 text-left hover:bg-gray-50 rounded transition-colors group`}
      >
        <span className="flex-shrink-0 text-gray-300">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <Zap size={13} className={isOnline ? 'text-blue-500' : 'text-gray-300'} />
        <span className="text-sm text-gray-700 font-mono flex-1 truncate">{charger.chargePointId}</span>
        <div className="flex items-center gap-1.5">
          {isOnline ? <Wifi size={11} className="text-green-500" /> : <WifiOff size={11} className="text-gray-300" />}
          {summary === 'error' && <AlertTriangle size={11} className="text-red-500" />}
          {summary === 'ok' && <CheckCircle size={11} className="text-green-400" />}
          <span className="text-xs text-gray-400">{charger.connectors.length} conn.</span>
        </div>
      </button>
      {open && charger.connectors.map(conn => (
        <ConnectorNode key={conn.connectorDbId} conn={conn} />
      ))}
    </div>
  );
}

function StationNode({ station }: { station: TopologyNode['stations'][0] }) {
  const [open, setOpen] = useState(true);
  const onlineCount = station.chargers.filter(c => c.connectionStatus === 'Online').length;
  const faultCount = station.chargers.reduce((n, c) => n + c.connectors.filter(x => x.status === 'Faulted').length, 0);

  return (
    <div className="border-l-2 border-gray-100 ml-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 pl-4 pr-4 py-2.5 text-left hover:bg-gray-50 rounded transition-colors"
      >
        <span className="flex-shrink-0 text-gray-400">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <Building2 size={14} className="text-indigo-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{station.stationName}</span>
        {station.stationLocation && (
          <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[200px]">{station.stationLocation}</span>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500">{onlineCount}/{station.chargers.length} online</span>
          {faultCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
              {faultCount} fault{faultCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>
      {open && station.chargers.map(ch => (
        <ChargerNode key={ch.chargerId} charger={ch} />
      ))}
    </div>
  );
}

function OperatorNode({ node }: { node: TopologyNode }) {
  const [open, setOpen] = useState(true);
  const totalChargers = node.stations.reduce((n, s) => n + s.chargers.length, 0);
  const onlineChargers = node.stations.reduce(
    (n, s) => n + s.chargers.filter(c => c.connectionStatus === 'Online').length, 0
  );
  const totalConnectors = node.stations.reduce(
    (n, s) => n + s.chargers.reduce((m, c) => m + c.connectors.length, 0), 0
  );
  const chargingConnectors = node.stations.reduce(
    (n, s) => n + s.chargers.reduce((m, c) => m + c.connectors.filter(x => x.status === 'Charging').length, 0), 0
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex-shrink-0 text-gray-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900">{node.operatorName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {node.stations.length} station{node.stations.length !== 1 ? 's' : ''} ·{' '}
            {totalChargers} charge point{totalChargers !== 1 ? 's' : ''} ·{' '}
            {totalConnectors} connectors
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${onlineChargers > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            <Wifi size={10} />
            {onlineChargers} online
          </span>
          {chargingConnectors > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
              <Zap size={10} />
              {chargingConnectors} charging
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-2 pb-3 border-t border-gray-100 bg-gray-50/50">
          {node.stations.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center italic">No stations</p>
          ) : (
            node.stations.map(st => (
              <StationNode key={st.stationId} station={st} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function TopologySummary({ nodes }: { nodes: TopologyNode[] }) {
  const totalStations = nodes.reduce((n, op) => n + op.stations.length, 0);
  const totalChargers = nodes.reduce((n, op) => n + op.stations.reduce((m, s) => m + s.chargers.length, 0), 0);
  const onlineChargers = nodes.reduce(
    (n, op) => n + op.stations.reduce((m, s) => m + s.chargers.filter(c => c.connectionStatus === 'Online').length, 0), 0
  );
  const totalConnectors = nodes.reduce(
    (n, op) => n + op.stations.reduce((m, s) => m + s.chargers.reduce((k, c) => k + c.connectors.length, 0), 0), 0
  );
  const chargingNow = nodes.reduce(
    (n, op) => n + op.stations.reduce(
      (m, s) => m + s.chargers.reduce((k, c) => k + c.connectors.filter(x => x.status === 'Charging').length, 0), 0
    ), 0
  );
  const faulted = nodes.reduce(
    (n, op) => n + op.stations.reduce(
      (m, s) => m + s.chargers.reduce((k, c) => k + c.connectors.filter(x => x.status === 'Faulted').length, 0), 0
    ), 0
  );

  const stats = [
    { label: 'Operators', value: nodes.length, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: 'Stations', value: totalStations, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { label: 'Charge Points', value: `${onlineChargers}/${totalChargers}`, color: 'text-green-600 bg-green-50 border-green-200' },
    { label: 'Connectors', value: totalConnectors, color: 'text-gray-600 bg-gray-50 border-gray-200' },
    { label: 'Charging Now', value: chargingNow, color: 'text-blue-700 bg-blue-100 border-blue-300' },
    ...(faulted > 0 ? [{ label: 'Faulted', value: faulted, color: 'text-red-600 bg-red-50 border-red-200' }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {stats.map(({ label, value, color }) => (
        <div key={label} className={`flex flex-col items-center px-4 py-2 rounded-xl border ${color} min-w-[80px]`}>
          <span className="text-xl font-bold">{value}</span>
          <span className="text-xs font-medium mt-0.5">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NetworkTopology() {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTopology();
      setNodes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Network Topology</h1>
          <p className="text-sm text-gray-500 mt-0.5">Operator → Station → Charge Point → Connector hierarchy</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No network data</p>
          <p className="text-sm mt-1">Register charge points via the OCPP server to see topology</p>
        </div>
      ) : (
        <>
          <TopologySummary nodes={nodes} />
          <div className="space-y-4">
            {nodes.map(node => (
              <OperatorNode key={node.operatorId} node={node} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
