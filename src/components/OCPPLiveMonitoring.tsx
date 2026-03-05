import { useEffect, useState } from 'react';
import { Activity, Plug, Zap, AlertTriangle, RefreshCw, MapPin, Clock, Battery } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService, SystemHealth } from '../lib/ocppService';
import { formatDistanceToNow } from 'date-fns';
import { Database } from '../lib/database.types';

type OcppCharger = Database['public']['Tables']['ocpp_chargers']['Row'];
type OcppConnector = Database['public']['Tables']['ocpp_connectors']['Row'];

interface ChargerWithConnectors extends OcppCharger {
  connectors: OcppConnector[];
  station?: {
    id: string;
    name: string;
    station_code: string | null;
  };
}

interface ActiveSessionWithDetails {
  id: string;
  transaction_id: number | null;
  start_timestamp: string;
  energy_consumed_wh: number | null;
  duration_minutes: number | null;
  charger: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  };
  connector: {
    connector_id: number;
    connector_type: string;
  };
  operator: {
    name: string;
    rfid_card_number: string | null;
  } | null;
}

export function OCPPLiveMonitoring() {
  const { user } = useAuth();
  const [chargers, setChargers] = useState<ChargerWithConnectors[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionWithDetails[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [chargersData, sessionsData, healthData] = await Promise.all([
        ocppService.getAllChargers(user.id),
        ocppService.getActiveSessions(user.id),
        ocppService.getSystemHealth(user.id),
      ]);

      setChargers(chargersData);
      setActiveSessions(sessionsData);
      setHealth(healthData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Online: 'bg-green-100 text-green-800 border-green-200',
      Offline: 'bg-gray-100 text-gray-800 border-gray-200',
      Unknown: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[status] || colors.Unknown;
  };

  const getConnectorStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Available: 'bg-green-500',
      Preparing: 'bg-blue-500',
      Charging: 'bg-blue-600',
      SuspendedEV: 'bg-yellow-500',
      SuspendedEVSE: 'bg-yellow-600',
      Finishing: 'bg-orange-500',
      Reserved: 'bg-purple-500',
      Unavailable: 'bg-gray-400',
      Faulted: 'bg-red-500',
    };
    return colors[status] || colors.Unavailable;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading chargers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">OCPP Live Monitoring</h2>
          </div>
          <p className="text-gray-600">Real-time charger status and active sessions</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error loading data</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Chargers</p>
                <p className="text-3xl font-bold text-gray-900">{health.totalChargers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {health.onlineChargers} online • {health.offlineChargers} offline
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Plug className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Sessions</p>
                <p className="text-3xl font-bold text-gray-900">{health.activeSessions}</p>
                <p className="text-xs text-gray-500 mt-1">Currently charging</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Connectors</p>
                <p className="text-3xl font-bold text-gray-900">{health.totalConnectors}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {health.availableConnectors} available • {health.chargingConnectors} charging
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Battery className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">System Health</p>
                <p className="text-3xl font-bold text-gray-900">
                  {health.totalChargers > 0
                    ? Math.round((health.onlineChargers / health.totalChargers) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {health.faultedConnectors > 0 ? `${health.faultedConnectors} faulted` : 'All operational'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Chargers Overview</h3>
            <p className="text-sm text-gray-600 mt-1">All registered charging stations</p>
          </div>
          <div className="p-6">
            {chargers.length === 0 ? (
              <div className="text-center py-8">
                <Plug className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No chargers registered yet</p>
                <p className="text-sm text-gray-500 mt-1">Chargers will appear here once connected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chargers.map((charger) => (
                  <div key={charger.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{charger.charge_point_id}</h4>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                              charger.connection_status
                            )}`}
                          >
                            {charger.connection_status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {charger.vendor} {charger.model}
                        </p>
                        {charger.station && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-500">{charger.station.name}</p>
                          </div>
                        )}
                        {charger.last_heartbeat_at && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-500">
                              Last seen {formatDistanceToNow(new Date(charger.last_heartbeat_at))} ago
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {charger.connectors.map((connector) => (
                        <div
                          key={connector.id}
                          className="flex-1 p-2 border border-gray-200 rounded bg-gray-50"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getConnectorStatusColor(connector.status)}`} />
                            <p className="text-xs font-medium text-gray-700">
                              Connector {connector.connector_id}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600">{connector.connector_type}</p>
                          <p className="text-xs text-gray-500">{connector.status}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Active Sessions</h3>
            <p className="text-sm text-gray-600 mt-1">Currently charging vehicles</p>
          </div>
          <div className="p-6">
            {activeSessions.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No active charging sessions</p>
                <p className="text-sm text-gray-500 mt-1">Sessions will appear here when charging starts</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {session.charger.charge_point_id} - Connector {session.connector.connector_id}
                        </h4>
                        <p className="text-sm text-gray-600">{session.connector.connector_type}</p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    {session.operator && (
                      <p className="text-sm text-gray-700 mb-2">
                        Operator: {session.operator.name}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Duration</p>
                        <p className="font-medium text-gray-900">
                          {session.duration_minutes
                            ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m`
                            : formatDistanceToNow(new Date(session.start_timestamp))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Energy</p>
                        <p className="font-medium text-gray-900">
                          {session.energy_consumed_wh
                            ? `${(session.energy_consumed_wh / 1000).toFixed(2)} kWh`
                            : '0.00 kWh'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
