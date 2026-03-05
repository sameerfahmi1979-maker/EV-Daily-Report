import { useEffect, useState } from 'react';
import {
  Radio,
  Zap,
  Clock,
  DollarSign,
  Activity,
  Calendar,
  Filter,
  Search,
  Square,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  MapPin,
  TrendingUp,
  Battery,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService } from '../lib/ocppService';
import { operatorService } from '../lib/operatorService';
import { Database } from '../lib/database.types';
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { formatJOD } from '../lib/currency';

type OcppChargingSession = Database['public']['Tables']['ocpp_charging_sessions']['Row'];
type OcppCharger = Database['public']['Tables']['ocpp_chargers']['Row'];
type Operator = Database['public']['Tables']['operators']['Row'];

interface SessionWithDetails extends OcppChargingSession {
  charger: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  };
  connector: {
    connector_id: number;
    connector_type: string;
    power_kw: number | null;
  };
  operator: {
    name: string;
    email: string | null;
    phone: string | null;
    rfid_card_number: string | null;
  } | null;
}

interface SessionStats {
  total: number;
  active: number;
  completed: number;
  totalEnergy: number;
  totalDuration: number;
  totalRevenue: number;
  averageEnergy: number;
  averageDuration: number;
}

type ViewMode = 'active' | 'historical';

export function OCPPSessionsMonitor() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [activeSessions, setActiveSessions] = useState<SessionWithDetails[]>([]);
  const [historicalSessions, setHistoricalSessions] = useState<SessionWithDetails[]>([]);
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null);
  const [stopping, setStopping] = useState(false);

  const [filters, setFilters] = useState({
    chargerId: '',
    operatorId: '',
    startDate: '',
    endDate: '',
    status: '',
    searchQuery: '',
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [activeData, historicalData, chargersData, operatorsData, statsData] =
        await Promise.all([
          ocppService.getActiveSessions(user.id),
          ocppService.getHistoricalSessions(user.id, 100, {
            chargerId: filters.chargerId || undefined,
            operatorId: filters.operatorId || undefined,
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
            status: filters.status || undefined,
          }),
          ocppService.getAllChargers(user.id),
          operatorService.getAll(),
          ocppService.getSessionStatistics(user.id, 30),
        ]);

      setActiveSessions(activeData as SessionWithDetails[]);
      setHistoricalSessions(historicalData as SessionWithDetails[]);
      setChargers(chargersData.map((c) => ({ ...c, connectors: [] })));
      setOperators(operatorsData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, filters.chargerId, filters.operatorId, filters.startDate, filters.endDate, filters.status]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (viewMode === 'active') {
      const interval = setInterval(() => {
        if (user) {
          ocppService.getActiveSessions(user.id).then((data) => {
            setActiveSessions(data as SessionWithDetails[]);
          });
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [viewMode, user]);

  const handleStopSession = async (session: SessionWithDetails) => {
    if (!user) return;

    try {
      setStopping(true);
      setError(null);

      await ocppService.stopOCPPSession(user.id, session.id, 'Manual Stop');

      setSuccess('Stop command sent successfully');
      setSelectedSession(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to stop session');
    } finally {
      setStopping(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-green-100 text-green-800',
      Completed: 'bg-blue-100 text-blue-800',
      Stopped: 'bg-gray-100 text-gray-800',
      Error: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <Activity className="w-4 h-4" />;
      case 'Completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'Stopped':
        return <Square className="w-4 h-4" />;
      case 'Error':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const calculateCurrentDuration = (startTime: string) => {
    return differenceInMinutes(new Date(), new Date(startTime));
  };

  const filteredSessions = (sessions: SessionWithDetails[]) => {
    if (!filters.searchQuery) return sessions;

    const query = filters.searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.charger.charge_point_id.toLowerCase().includes(query) ||
        session.operator?.name.toLowerCase().includes(query) ||
        session.id_tag.toLowerCase().includes(query) ||
        session.transaction_id.toString().includes(query)
    );
  };

  const clearFilters = () => {
    setFilters({
      chargerId: '',
      operatorId: '',
      startDate: '',
      endDate: '',
      status: '',
      searchQuery: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading sessions data...</p>
        </div>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => setSelectedSession(null)}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            ← Back to Sessions
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Radio className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Session Details</h2>
          </div>
          <p className="text-gray-600">Transaction #{selectedSession.transaction_id}</p>
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

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Success</p>
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full flex items-center gap-2 ${getStatusColor(
                    selectedSession.session_status
                  )}`}
                >
                  {getStatusIcon(selectedSession.session_status)}
                  {selectedSession.session_status}
                </span>
                {selectedSession.remote_start && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800">
                    Remote Start
                  </span>
                )}
              </div>
              {selectedSession.session_status === 'Active' && (
                <button
                  onClick={() => handleStopSession(selectedSession)}
                  disabled={stopping}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Square className="w-4 h-4" />
                  {stopping ? 'Stopping...' : 'Stop Session'}
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Charger Information</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedSession.charger.charge_point_id}
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedSession.charger.vendor} {selectedSession.charger.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-900">
                        Connector {selectedSession.connector.connector_id}
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedSession.connector.connector_type} -{' '}
                        {selectedSession.connector.power_kw} kW
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Operator Information</h3>
                <div className="space-y-2">
                  {selectedSession.operator ? (
                    <>
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedSession.operator.name}
                          </p>
                          {selectedSession.operator.email && (
                            <p className="text-xs text-gray-600">{selectedSession.operator.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">
                            RFID: {selectedSession.operator.rfid_card_number || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-600">ID Tag: {selectedSession.id_tag}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">Guest / {selectedSession.id_tag}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Session Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-medium text-blue-600">Energy</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedSession.energy_consumed_wh
                      ? (selectedSession.energy_consumed_wh / 1000).toFixed(2)
                      : '0.00'}
                  </p>
                  <p className="text-xs text-gray-600">kWh</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-medium text-green-600">Duration</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedSession.session_status === 'Active'
                      ? calculateCurrentDuration(selectedSession.start_timestamp)
                      : selectedSession.duration_minutes || 0}
                  </p>
                  <p className="text-xs text-gray-600">minutes</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-medium text-purple-600">Cost</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatJOD(selectedSession.calculated_cost || 0)}
                  </p>
                  <p className="text-xs text-gray-600">total</p>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Battery className="w-4 h-4 text-orange-600" />
                    <p className="text-xs font-medium text-orange-600">Meter</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedSession.start_meter_value || 0}
                  </p>
                  <p className="text-xs text-gray-600">
                    to {selectedSession.end_meter_value || 'ongoing'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Session Started</p>
                    <p className="text-xs text-gray-600">
                      {format(new Date(selectedSession.start_timestamp), 'PPpp')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(selectedSession.start_timestamp), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                {selectedSession.end_timestamp && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Session Ended</p>
                      <p className="text-xs text-gray-600">
                        {format(new Date(selectedSession.end_timestamp), 'PPpp')}
                      </p>
                      {selectedSession.stop_reason && (
                        <p className="text-xs text-gray-500">
                          Reason: {selectedSession.stop_reason}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedSession.authorization_status && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Authorization</h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedSession.authorization_status === 'Accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedSession.authorization_status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Radio className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Sessions Monitor</h2>
        </div>
        <p className="text-gray-600">Track live and historical OCPP charging sessions</p>
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

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Success</p>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-sm text-gray-600">Active Sessions</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {(stats.totalEnergy / 1000).toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Total Energy (kWh)</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(stats.totalDuration / 60)}
                </p>
                <p className="text-sm text-gray-600">Total Hours</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatJOD(stats.totalRevenue)}
                </p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'active'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Active ({activeSessions.length})
              </button>
              <button
                onClick={() => setViewMode('historical')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'historical'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Historical
              </button>
            </div>
          </div>

          {viewMode === 'historical' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.searchQuery}
                      onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                      placeholder="Search sessions..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <select
                  value={filters.chargerId}
                  onChange={(e) => setFilters({ ...filters, chargerId: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Chargers</option>
                  {chargers.map((charger) => (
                    <option key={charger.id} value={charger.id}>
                      {charger.charge_point_id}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.operatorId}
                  onChange={(e) => setFilters({ ...filters, operatorId: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Operators</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <button
                  onClick={clearFilters}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="divide-y divide-gray-200">
          {viewMode === 'active' &&
            (activeSessions.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Sessions</h3>
                <p className="text-gray-600">
                  There are currently no active charging sessions
                </p>
              </div>
            ) : (
              filteredSessions(activeSessions).map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {session.charger.charge_point_id}
                        </h3>
                        <span className="text-sm text-gray-600">
                          Connector {session.connector.connector_id}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(
                            session.session_status
                          )}`}
                        >
                          {getStatusIcon(session.session_status)}
                          {session.session_status}
                        </span>
                        {session.remote_start && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            Remote
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {session.operator?.name || session.id_tag}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {calculateCurrentDuration(session.start_timestamp)} mins
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          {session.energy_consumed_wh
                            ? (session.energy_consumed_wh / 1000).toFixed(2)
                            : '0.00'}{' '}
                          kWh
                        </div>
                        {session.calculated_cost !== null && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {formatJOD(session.calculated_cost)}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Started {formatDistanceToNow(new Date(session.start_timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopSession(session);
                        }}
                        disabled={stopping}
                        className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ))}

          {viewMode === 'historical' &&
            (historicalSessions.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Sessions Found</h3>
                <p className="text-gray-600">
                  Try adjusting your filters to see historical sessions
                </p>
              </div>
            ) : (
              filteredSessions(historicalSessions).map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {session.charger.charge_point_id}
                        </h3>
                        <span className="text-sm text-gray-600">
                          Connector {session.connector.connector_id}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(
                            session.session_status
                          )}`}
                        >
                          {getStatusIcon(session.session_status)}
                          {session.session_status}
                        </span>
                        {session.remote_start && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            Remote
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {session.operator?.name || session.id_tag}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {session.duration_minutes || 0} mins
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          {session.energy_consumed_wh
                            ? (session.energy_consumed_wh / 1000).toFixed(2)
                            : '0.00'}{' '}
                          kWh
                        </div>
                        {session.calculated_cost !== null && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {formatJOD(session.calculated_cost)}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {format(new Date(session.start_timestamp), 'PPp')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
