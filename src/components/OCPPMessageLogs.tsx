import { useEffect, useState } from 'react';
import {
  MessageSquare,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Calendar,
  Filter,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Copy,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService } from '../lib/ocppService';
import { Database } from '../lib/database.types';
import { format, formatDistanceToNow } from 'date-fns';

type OcppMessage = Database['public']['Tables']['ocpp_messages']['Row'];
type OcppCharger = Database['public']['Tables']['ocpp_chargers']['Row'];

interface MessageWithDetails extends OcppMessage {
  charger: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  } | null;
}

interface MessageStats {
  total: number;
  incoming: number;
  outgoing: number;
  calls: number;
  callResults: number;
  callErrors: number;
  success: number;
  errors: number;
  successRate: number;
}

export function OCPPMessageLogs() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithDetails | null>(null);
  const [expandedPayload, setExpandedPayload] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [filters, setFilters] = useState({
    chargerId: '',
    messageType: '',
    action: '',
    direction: '',
    processingStatus: '',
    startDate: '',
    endDate: '',
    searchQuery: '',
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [messagesData, chargersData, statsData] = await Promise.all([
        ocppService.getMessages(user.id, 100, {
          chargerId: filters.chargerId || undefined,
          messageType: filters.messageType || undefined,
          action: filters.action || undefined,
          direction: filters.direction || undefined,
          processingStatus: filters.processingStatus || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        }),
        ocppService.getAllChargers(user.id),
        ocppService.getMessageStatistics(user.id, 7),
      ]);

      setMessages(messagesData as MessageWithDetails[]);
      setChargers(chargersData.map((c) => ({ ...c, connectors: [] })));
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load message logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    user,
    filters.chargerId,
    filters.messageType,
    filters.direction,
    filters.processingStatus,
    filters.startDate,
    filters.endDate,
  ]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (autoRefresh && !selectedMessage) {
      const interval = setInterval(() => {
        if (user) {
          ocppService
            .getMessages(user.id, 100, {
              chargerId: filters.chargerId || undefined,
              messageType: filters.messageType || undefined,
              action: filters.action || undefined,
              direction: filters.direction || undefined,
              processingStatus: filters.processingStatus || undefined,
              startDate: filters.startDate || undefined,
              endDate: filters.endDate || undefined,
            })
            .then((data) => {
              setMessages(data as MessageWithDetails[]);
            });
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, user, selectedMessage, filters]);

  const handleClearOldMessages = async () => {
    if (!user) return;
    if (!confirm('Delete messages older than 30 days?')) return;

    try {
      setError(null);
      const count = await ocppService.clearOldMessages(user.id, 30);
      setSuccess(`Deleted ${count} old messages`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to clear old messages');
    }
  };

  const handleCopyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setSuccess('Payload copied to clipboard');
  };

  const getMessageTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Call: 'bg-blue-100 text-blue-800',
      CallResult: 'bg-green-100 text-green-800',
      CallError: 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'Incoming' ? (
      <ArrowDown className="w-4 h-4 text-green-600" />
    ) : (
      <ArrowUp className="w-4 h-4 text-blue-600" />
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'Pending':
        return <Activity className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredMessages = messages.filter((message) => {
    if (!filters.searchQuery) return true;

    const query = filters.searchQuery.toLowerCase();
    return (
      message.action.toLowerCase().includes(query) ||
      message.message_id.toLowerCase().includes(query) ||
      message.charger?.charge_point_id.toLowerCase().includes(query) ||
      (message.error_code && message.error_code.toLowerCase().includes(query))
    );
  });

  const clearFilters = () => {
    setFilters({
      chargerId: '',
      messageType: '',
      action: '',
      direction: '',
      processingStatus: '',
      startDate: '',
      endDate: '',
      searchQuery: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading message logs...</p>
        </div>
      </div>
    );
  }

  if (selectedMessage) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              setSelectedMessage(null);
              setExpandedPayload(false);
            }}
            className="text-cyan-600 hover:text-cyan-700 mb-4 flex items-center gap-2"
          >
            ← Back to Messages
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-cyan-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Message Details</h2>
          </div>
          <p className="text-gray-600">{selectedMessage.action}</p>
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${getMessageTypeColor(
                    selectedMessage.message_type
                  )}`}
                >
                  {selectedMessage.message_type}
                </span>
                <div className="flex items-center gap-2">
                  {getDirectionIcon(selectedMessage.direction)}
                  <span className="text-sm font-medium text-gray-700">
                    {selectedMessage.direction}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedMessage.processing_status)}
                  <span className="text-sm font-medium text-gray-700">
                    {selectedMessage.processing_status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCopyPayload(selectedMessage.payload)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Payload
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Message Information</h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Message ID</p>
                    <p className="text-sm font-mono text-gray-900">
                      {selectedMessage.message_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Action</p>
                    <p className="text-sm font-medium text-gray-900">{selectedMessage.action}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Timestamp</p>
                    <p className="text-sm text-gray-900">
                      {format(new Date(selectedMessage.timestamp), 'PPpp')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(selectedMessage.timestamp), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Charger Information</h3>
                <div className="space-y-2">
                  {selectedMessage.charger ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Charge Point ID</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedMessage.charger.charge_point_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Vendor & Model</p>
                        <p className="text-sm text-gray-900">
                          {selectedMessage.charger.vendor} {selectedMessage.charger.model}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">System message (no charger)</p>
                  )}
                </div>
              </div>
            </div>

            {(selectedMessage.error_code || selectedMessage.error_description) && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Error Information</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                  {selectedMessage.error_code && (
                    <div>
                      <p className="text-xs text-red-600 font-medium">Error Code</p>
                      <p className="text-sm font-mono text-red-900">
                        {selectedMessage.error_code}
                      </p>
                    </div>
                  )}
                  {selectedMessage.error_description && (
                    <div>
                      <p className="text-xs text-red-600 font-medium">Description</p>
                      <p className="text-sm text-red-900">{selectedMessage.error_description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">Message Payload</h3>
                <button
                  onClick={() => setExpandedPayload(!expandedPayload)}
                  className="flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-700"
                >
                  {expandedPayload ? (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      Expand
                    </>
                  )}
                </button>
              </div>
              <div
                className={`bg-gray-900 rounded-lg p-4 overflow-auto ${
                  expandedPayload ? 'max-h-[600px]' : 'max-h-[300px]'
                }`}
              >
                <pre className="text-sm text-green-400 font-mono">
                  {JSON.stringify(selectedMessage.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-cyan-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Message Logs</h2>
        </div>
        <p className="text-gray-600">View OCPP protocol message exchanges</p>
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
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Messages</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.incoming}</p>
                <p className="text-sm text-gray-600">Incoming</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.outgoing}</p>
                <p className="text-sm text-gray-600">Outgoing</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.successRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Success Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  autoRefresh
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'text-gray-600 hover:bg-gray-100'
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
            <button
              onClick={handleClearOldMessages}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Old
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                    placeholder="Search messages..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={filters.chargerId}
                onChange={(e) => setFilters({ ...filters, chargerId: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">All Chargers</option>
                {chargers.map((charger) => (
                  <option key={charger.id} value={charger.id}>
                    {charger.charge_point_id}
                  </option>
                ))}
              </select>

              <select
                value={filters.messageType}
                onChange={(e) => setFilters({ ...filters, messageType: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="Call">Call</option>
                <option value="CallResult">CallResult</option>
                <option value="CallError">CallError</option>
              </select>

              <select
                value={filters.direction}
                onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">All Directions</option>
                <option value="Incoming">Incoming</option>
                <option value="Outgoing">Outgoing</option>
              </select>

              <select
                value={filters.processingStatus}
                onChange={(e) => setFilters({ ...filters, processingStatus: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="Success">Success</option>
                <option value="Error">Error</option>
                <option value="Pending">Pending</option>
              </select>

              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />

              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredMessages.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Messages Found</h3>
              <p className="text-gray-600">
                {filters.searchQuery || filters.chargerId || filters.messageType
                  ? 'Try adjusting your filters to see messages'
                  : 'No OCPP messages have been logged yet'}
              </p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                onClick={() => setSelectedMessage(message)}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getDirectionIcon(message.direction)}
                      <h3 className="text-lg font-bold text-gray-900">{message.action}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getMessageTypeColor(
                          message.message_type
                        )}`}
                      >
                        {message.message_type}
                      </span>
                      {getStatusIcon(message.processing_status)}
                      {message.error_code && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          {message.error_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      {message.charger && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {message.charger.charge_point_id}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                      </div>
                      <div className="font-mono text-xs text-gray-500">
                        {message.message_id.substring(0, 8)}...
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
