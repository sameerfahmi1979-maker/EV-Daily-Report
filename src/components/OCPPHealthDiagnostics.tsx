import { useEffect, useState } from 'react';
import {
  Heart,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  WifiOff,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Server,
  Gauge,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService } from '../lib/ocppService';
import { formatDistanceToNow, format } from 'date-fns';

interface SystemHealth {
  totalChargers: number;
  onlineChargers: number;
  offlineChargers: number;
  errorChargers: number;
  totalConnectors: number;
  availableConnectors: number;
  chargingConnectors: number;
  faultedConnectors: number;
  activeSessions: number;
  systemUptime: number;
  averageResponseTime: number;
}

interface ChargerHealth {
  id: string;
  chargePointId: string;
  vendor: string | null;
  model: string | null;
  connectionStatus: string;
  lastHeartbeat: string | null;
  hasRecentHeartbeat: boolean;
  firmwareVersion: string | null;
  totalConnectors: number;
  availableConnectors: number;
  chargingConnectors: number;
  faultedConnectors: number;
  activeSessions: number;
  recentErrors: number;
  uptimeMinutes: number;
  healthStatus: 'healthy' | 'warning' | 'error' | 'offline';
}

interface ErrorLog {
  id: string;
  charger_id: string;
  message_type: string;
  action: string;
  timestamp: string;
  error_code: string | null;
  error_description: string | null;
  charger: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  } | null;
}

export function OCPPHealthDiagnostics() {
  const { user } = useAuth();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [chargerHealthList, setChargerHealthList] = useState<ChargerHealth[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChargerId, setExpandedChargerId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [health, chargers, errors] = await Promise.all([
        ocppService.getSystemHealth(user.id),
        ocppService.getChargerHealthDetails(user.id),
        ocppService.getErrorLog(user.id, 20),
      ]);

      setSystemHealth(health);
      setChargerHealthList(chargers);
      setErrorLog(errors as ErrorLog[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (user) {
          ocppService.getSystemHealth(user.id).then(setSystemHealth);
          ocppService.getChargerHealthDetails(user.id).then(setChargerHealthList);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, user]);

  const getHealthStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      healthy: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
      error: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      offline: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
    };
    return colors[status] || colors.offline;
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'offline':
        return <WifiOff className="w-5 h-5 text-gray-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatUptime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading health diagnostics...</p>
        </div>
      </div>
    );
  }

  if (!systemHealth) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Health & Diagnostics</h2>
          </div>
          <p className="text-gray-600">System health monitoring and troubleshooting</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">
            Add chargers to your system to see health and diagnostic information.
          </p>
        </div>
      </div>
    );
  }

  const systemHealthStatus =
    systemHealth.errorChargers > 0
      ? 'error'
      : systemHealth.offlineChargers > systemHealth.onlineChargers
      ? 'warning'
      : 'healthy';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Health & Diagnostics</h2>
            </div>
            <p className="text-gray-600">System health monitoring and troubleshooting</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                autoRefresh ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </button>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div
          className={`rounded-xl shadow-sm border-2 p-6 ${
            getHealthStatusColor(systemHealthStatus).border
          } ${getHealthStatusColor(systemHealthStatus).bg}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {getHealthStatusIcon(systemHealthStatus)}
              <div>
                <h3 className="text-xl font-bold text-gray-900">System Status</h3>
                <p className="text-sm text-gray-600 capitalize">{systemHealthStatus}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                {systemHealth.systemUptime.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">System Uptime</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-gray-500" />
                <p className="text-xs text-gray-600">Total Chargers</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.totalChargers}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-xs text-gray-600">Online</p>
              </div>
              <p className="text-2xl font-bold text-green-900">{systemHealth.onlineChargers}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <WifiOff className="w-4 h-4 text-gray-600" />
                <p className="text-xs text-gray-600">Offline</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.offlineChargers}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-xs text-gray-600">Errors</p>
              </div>
              <p className="text-2xl font-bold text-red-900">{systemHealth.errorChargers}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-gray-500" />
                <p className="text-xs text-gray-600">Charging</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {systemHealth.chargingConnectors}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-gray-500" />
                <p className="text-xs text-gray-600">Active Sessions</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.activeSessions}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">
                Avg Response Time: {systemHealth.averageResponseTime.toFixed(0)}ms
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">
                Connectors: {systemHealth.availableConnectors}/{systemHealth.totalConnectors}{' '}
                available
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Charger Health Status</h3>
            <p className="text-sm text-gray-600">Individual charger monitoring</p>
          </div>

          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {chargerHealthList.length === 0 ? (
              <div className="p-8 text-center">
                <Server className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No chargers registered</p>
              </div>
            ) : (
              chargerHealthList.map((charger) => {
                const isExpanded = expandedChargerId === charger.id;
                const statusColors = getHealthStatusColor(charger.healthStatus);

                return (
                  <div key={charger.id}>
                    <div
                      onClick={() =>
                        setExpandedChargerId(isExpanded ? null : charger.id)
                      }
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {getHealthStatusIcon(charger.healthStatus)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">
                                {charger.chargePointId}
                              </h4>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors.bg} ${statusColors.text}`}
                              >
                                {charger.healthStatus}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {charger.vendor} {charger.model}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {charger.availableConnectors}/{charger.totalConnectors}
                            </p>
                            <p className="text-xs text-gray-600">Available</p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {!isExpanded && charger.recentErrors > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          {charger.recentErrors} errors in last 24h
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Connection Status</p>
                            <p className="text-sm font-medium text-gray-900">
                              {charger.connectionStatus}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Last Heartbeat</p>
                            <p className="text-sm font-medium text-gray-900">
                              {charger.lastHeartbeat
                                ? formatDistanceToNow(new Date(charger.lastHeartbeat), {
                                    addSuffix: true,
                                  })
                                : 'Never'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Firmware</p>
                            <p className="text-sm font-medium text-gray-900">
                              {charger.firmwareVersion || 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Uptime</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatUptime(charger.uptimeMinutes)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Active Sessions</p>
                            <p className="text-sm font-medium text-gray-900">
                              {charger.activeSessions}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Charging Connectors</p>
                            <p className="text-sm font-medium text-gray-900">
                              {charger.chargingConnectors}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Faulted Connectors</p>
                            <p className="text-sm font-medium text-gray-900">
                              {charger.faultedConnectors}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Recent Errors (24h)</p>
                            <p className="text-sm font-medium text-red-900">
                              {charger.recentErrors}
                            </p>
                          </div>
                        </div>

                        {!charger.hasRecentHeartbeat && charger.connectionStatus === 'Online' && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-600" />
                              <p className="text-sm text-yellow-900">
                                No heartbeat received in the last 5 minutes
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Recent Errors & Issues</h3>
            <p className="text-sm text-gray-600">Latest system errors and warnings</p>
          </div>

          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {errorLog.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600">No recent errors</p>
                <p className="text-sm text-gray-500 mt-1">System is running smoothly</p>
              </div>
            ) : (
              errorLog.map((errorItem) => (
                <div key={errorItem.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {errorItem.action}
                        </h4>
                        {errorItem.error_code && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            {errorItem.error_code}
                          </span>
                        )}
                      </div>
                      {errorItem.charger && (
                        <p className="text-sm text-gray-600 mb-1">
                          {errorItem.charger.charge_point_id}
                        </p>
                      )}
                      {errorItem.error_description && (
                        <p className="text-sm text-gray-700 mb-2">
                          {errorItem.error_description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(errorItem.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Performance</p>
              <p className="text-xl font-bold text-gray-900">
                {systemHealth.averageResponseTime < 100 ? 'Excellent' : systemHealth.averageResponseTime < 500 ? 'Good' : 'Needs Attention'}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Response Time</span>
              <span className="font-medium text-gray-900">
                {systemHealth.averageResponseTime.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Message Success Rate</span>
              <span className="font-medium text-gray-900">
                {(
                  ((systemHealth.onlineChargers - systemHealth.errorChargers) /
                    Math.max(systemHealth.onlineChargers, 1)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Capacity</p>
              <p className="text-xl font-bold text-gray-900">
                {systemHealth.totalConnectors > 0
                  ? `${Math.round(
                      (systemHealth.chargingConnectors / systemHealth.totalConnectors) * 100
                    )}%`
                  : '0%'}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Connectors</span>
              <span className="font-medium text-gray-900">{systemHealth.totalConnectors}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">In Use</span>
              <span className="font-medium text-gray-900">
                {systemHealth.chargingConnectors}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                systemHealth.faultedConnectors > 0 ? 'bg-red-100' : 'bg-green-100'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  systemHealth.faultedConnectors > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-gray-600">System Health</p>
              <p className="text-xl font-bold text-gray-900 capitalize">{systemHealthStatus}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Faulted Connectors</span>
              <span className="font-medium text-red-900">{systemHealth.faultedConnectors}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Error Chargers</span>
              <span className="font-medium text-red-900">{systemHealth.errorChargers}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
