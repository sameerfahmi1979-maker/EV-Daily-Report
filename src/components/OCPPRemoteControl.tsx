import { useEffect, useState } from 'react';
import {
  Sliders,
  Play,
  Square,
  Power,
  Unlock,
  XCircle,
  CheckCircle,
  Clock,
  Send,
  AlertCircle,
  Settings,
  RefreshCw,
  History,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService } from '../lib/ocppService';
import { operatorService } from '../lib/operatorService';
import { Database } from '../lib/database.types';
import { format } from 'date-fns';

type OcppCharger = Database['public']['Tables']['ocpp_chargers']['Row'];
type OcppConnector = Database['public']['Tables']['ocpp_connectors']['Row'];
type Operator = Database['public']['Tables']['operators']['Row'];
type RemoteCommand = Database['public']['Tables']['ocpp_remote_commands']['Row'];

interface ChargerWithConnectors extends OcppCharger {
  connectors: OcppConnector[];
}

interface CommandWithDetails extends RemoteCommand {
  charger: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  };
  connector: {
    connector_id: number;
    connector_type: string;
  } | null;
}

type CommandType =
  | 'RemoteStart'
  | 'RemoteStop'
  | 'UnlockConnector'
  | 'Reset'
  | 'ChangeAvailability'
  | 'ChangeConfiguration'
  | null;

export function OCPPRemoteControl() {
  const { user } = useAuth();
  const [chargers, setChargers] = useState<ChargerWithConnectors[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [commands, setCommands] = useState<CommandWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeCommand, setActiveCommand] = useState<CommandType>(null);
  const [selectedCharger, setSelectedCharger] = useState<ChargerWithConnectors | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<OcppConnector | null>(null);

  const [remoteStartForm, setRemoteStartForm] = useState({
    operatorId: '',
    connectorId: '',
  });

  const [remoteStopForm, setRemoteStopForm] = useState({
    transactionId: '',
  });

  const [resetForm, setResetForm] = useState({
    type: 'Soft' as 'Soft' | 'Hard',
  });

  const [availabilityForm, setAvailabilityForm] = useState({
    type: 'Operative' as 'Operative' | 'Inoperative',
    connectorId: '',
  });

  const [configForm, setConfigForm] = useState({
    key: '',
    value: '',
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [chargersData, operatorsData, commandsData] = await Promise.all([
        ocppService.getAllChargers(user.id),
        operatorService.getAll(),
        ocppService.getRemoteCommands(user.id, 20),
      ]);

      setChargers(chargersData);
      setOperators(operatorsData);
      setCommands(commandsData as CommandWithDetails[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleRemoteStart = async () => {
    if (!user || !selectedCharger || !remoteStartForm.connectorId || !remoteStartForm.operatorId)
      return;

    try {
      setSending(true);
      setError(null);

      const operator = operators.find((op) => op.id === remoteStartForm.operatorId);
      if (!operator || !operator.rfid_card_number) {
        throw new Error('Selected operator does not have an RFID card number');
      }

      const connector = selectedCharger.connectors.find(
        (c) => c.id === remoteStartForm.connectorId
      );
      if (!connector) {
        throw new Error('Selected connector not found');
      }

      await ocppService.remoteStartTransaction(
        user.id,
        selectedCharger.id,
        connector.id,
        operator.rfid_card_number
      );

      setSuccess('Remote Start command sent successfully');
      setActiveCommand(null);
      setSelectedCharger(null);
      setRemoteStartForm({ operatorId: '', connectorId: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to send Remote Start command');
    } finally {
      setSending(false);
    }
  };

  const handleRemoteStop = async () => {
    if (!user || !selectedCharger || !remoteStopForm.transactionId) return;

    try {
      setSending(true);
      setError(null);

      await ocppService.remoteStopTransaction(
        user.id,
        selectedCharger.id,
        parseInt(remoteStopForm.transactionId)
      );

      setSuccess('Remote Stop command sent successfully');
      setActiveCommand(null);
      setSelectedCharger(null);
      setRemoteStopForm({ transactionId: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to send Remote Stop command');
    } finally {
      setSending(false);
    }
  };

  const handleUnlock = async () => {
    if (!user || !selectedCharger || !selectedConnector) return;

    try {
      setSending(true);
      setError(null);

      await ocppService.unlockConnector(user.id, selectedCharger.id, selectedConnector.id);

      setSuccess('Unlock Connector command sent successfully');
      setActiveCommand(null);
      setSelectedCharger(null);
      setSelectedConnector(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to send Unlock command');
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    if (!user || !selectedCharger) return;

    try {
      setSending(true);
      setError(null);

      await ocppService.resetCharger(user.id, selectedCharger.id, resetForm.type);

      setSuccess(`${resetForm.type} Reset command sent successfully`);
      setActiveCommand(null);
      setSelectedCharger(null);
      setResetForm({ type: 'Soft' });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to send Reset command');
    } finally {
      setSending(false);
    }
  };

  const handleChangeAvailability = async () => {
    if (!user || !selectedCharger) return;

    try {
      setSending(true);
      setError(null);

      await ocppService.changeAvailability(
        user.id,
        selectedCharger.id,
        availabilityForm.connectorId || null,
        availabilityForm.type
      );

      setSuccess('Change Availability command sent successfully');
      setActiveCommand(null);
      setSelectedCharger(null);
      setAvailabilityForm({ type: 'Operative', connectorId: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to send Change Availability command');
    } finally {
      setSending(false);
    }
  };

  const handleChangeConfiguration = async () => {
    if (!user || !selectedCharger || !configForm.key) return;

    try {
      setSending(true);
      setError(null);

      await ocppService.changeConfiguration(
        user.id,
        selectedCharger.id,
        configForm.key,
        configForm.value
      );

      setSuccess('Change Configuration command sent successfully');
      setActiveCommand(null);
      setSelectedCharger(null);
      setConfigForm({ key: '', value: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to send Change Configuration command');
    } finally {
      setSending(false);
    }
  };

  const openCommandDialog = (
    command: CommandType,
    charger: ChargerWithConnectors,
    connector?: OcppConnector
  ) => {
    setActiveCommand(command);
    setSelectedCharger(charger);
    setSelectedConnector(connector || null);
    setError(null);
  };

  const closeCommandDialog = () => {
    setActiveCommand(null);
    setSelectedCharger(null);
    setSelectedConnector(null);
    setRemoteStartForm({ operatorId: '', connectorId: '' });
    setRemoteStopForm({ transactionId: '' });
    setResetForm({ type: 'Soft' });
    setAvailabilityForm({ type: 'Operative', connectorId: '' });
    setConfigForm({ key: '', value: '' });
    setError(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Pending: 'bg-yellow-100 text-yellow-800',
      Sent: 'bg-blue-100 text-blue-800',
      Accepted: 'bg-green-100 text-green-800',
      Rejected: 'bg-red-100 text-red-800',
      Error: 'bg-red-100 text-red-800',
      Timeout: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Sent':
        return <Clock className="w-4 h-4" />;
      case 'Accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'Rejected':
      case 'Error':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading remote control panel...</p>
        </div>
      </div>
    );
  }

  if (activeCommand && selectedCharger) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Sliders className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              {activeCommand === 'RemoteStart' && 'Remote Start Transaction'}
              {activeCommand === 'RemoteStop' && 'Remote Stop Transaction'}
              {activeCommand === 'UnlockConnector' && 'Unlock Connector'}
              {activeCommand === 'Reset' && 'Reset Charger'}
              {activeCommand === 'ChangeAvailability' && 'Change Availability'}
              {activeCommand === 'ChangeConfiguration' && 'Change Configuration'}
            </h2>
          </div>
          <p className="text-gray-600">
            Charger: {selectedCharger.charge_point_id}
            {selectedConnector && ` - Connector ${selectedConnector.connector_id}`}
          </p>
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            {activeCommand === 'RemoteStart' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Connector *
                  </label>
                  <select
                    value={remoteStartForm.connectorId}
                    onChange={(e) =>
                      setRemoteStartForm({ ...remoteStartForm, connectorId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Connector</option>
                    {selectedCharger.connectors
                      .filter((c) => c.status === 'Available')
                      .map((connector) => (
                        <option key={connector.id} value={connector.id}>
                          Connector {connector.connector_id} - {connector.connector_type} (
                          {connector.power_kw} kW)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Operator *
                  </label>
                  <select
                    value={remoteStartForm.operatorId}
                    onChange={(e) =>
                      setRemoteStartForm({ ...remoteStartForm, operatorId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Operator</option>
                    {operators
                      .filter((op) => op.rfid_card_number)
                      .map((operator) => (
                        <option key={operator.id} value={operator.id}>
                          {operator.name} ({operator.rfid_card_number})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {activeCommand === 'RemoteStop' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction ID *
                </label>
                <input
                  type="number"
                  value={remoteStopForm.transactionId}
                  onChange={(e) =>
                    setRemoteStopForm({ ...remoteStopForm, transactionId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter transaction ID"
                  required
                />
              </div>
            )}

            {activeCommand === 'UnlockConnector' && (
              <div className="text-center py-4">
                <p className="text-gray-700 mb-2">
                  This will unlock the connector and allow the cable to be removed.
                </p>
                <p className="text-sm text-gray-500">
                  Connector {selectedConnector?.connector_id} will be unlocked.
                </p>
              </div>
            )}

            {activeCommand === 'Reset' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reset Type *</label>
                <select
                  value={resetForm.type}
                  onChange={(e) =>
                    setResetForm({ ...resetForm, type: e.target.value as 'Soft' | 'Hard' })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="Soft">Soft Reset</option>
                  <option value="Hard">Hard Reset</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  {resetForm.type === 'Soft'
                    ? 'Soft reset restarts the charger software without cutting power.'
                    : 'Hard reset performs a power cycle reboot of the charger.'}
                </p>
              </div>
            )}

            {activeCommand === 'ChangeAvailability' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Availability Type *
                  </label>
                  <select
                    value={availabilityForm.type}
                    onChange={(e) =>
                      setAvailabilityForm({
                        ...availabilityForm,
                        type: e.target.value as 'Operative' | 'Inoperative',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="Operative">Operative</option>
                    <option value="Inoperative">Inoperative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Connector (optional)
                  </label>
                  <select
                    value={availabilityForm.connectorId}
                    onChange={(e) =>
                      setAvailabilityForm({ ...availabilityForm, connectorId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Entire Charger</option>
                    {selectedCharger.connectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        Connector {connector.connector_id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500">
                    Leave blank to change availability of the entire charger.
                  </p>
                </div>
              </div>
            )}

            {activeCommand === 'ChangeConfiguration' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Configuration Key *
                  </label>
                  <input
                    type="text"
                    value={configForm.key}
                    onChange={(e) => setConfigForm({ ...configForm, key: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HeartbeatInterval"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Value *</label>
                  <input
                    type="text"
                    value={configForm.value}
                    onChange={(e) => setConfigForm({ ...configForm, value: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 300"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={closeCommandDialog}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (activeCommand === 'RemoteStart') handleRemoteStart();
                else if (activeCommand === 'RemoteStop') handleRemoteStop();
                else if (activeCommand === 'UnlockConnector') handleUnlock();
                else if (activeCommand === 'Reset') handleReset();
                else if (activeCommand === 'ChangeAvailability') handleChangeAvailability();
                else if (activeCommand === 'ChangeConfiguration') handleChangeConfiguration();
              }}
              disabled={sending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Command'}
            </button>
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
            <Sliders className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Remote Control</h2>
        </div>
        <p className="text-gray-600">Send commands to chargers remotely</p>
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

      {chargers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Sliders className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Chargers Available</h3>
          <p className="text-gray-600">Register chargers to start using remote control features</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {chargers.map((charger) => (
            <div key={charger.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{charger.charge_point_id}</h3>
                    <p className="text-sm text-gray-600">
                      {charger.vendor} {charger.model}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      charger.connection_status === 'Online'
                        ? 'bg-green-100 text-green-800'
                        : charger.connection_status === 'Offline'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {charger.connection_status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {charger.connectors.map((connector) => (
                    <div
                      key={connector.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Connector {connector.connector_id}
                        </p>
                        <p className="text-xs text-gray-600">
                          {connector.connector_type} - {connector.power_kw} kW
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          connector.status === 'Available'
                            ? 'bg-green-100 text-green-800'
                            : connector.status === 'Charging'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {connector.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openCommandDialog('RemoteStart', charger)}
                    disabled={
                      charger.connection_status !== 'Online' ||
                      !charger.connectors.some((c) => c.status === 'Available')
                    }
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </button>
                  <button
                    onClick={() => openCommandDialog('RemoteStop', charger)}
                    disabled={
                      charger.connection_status !== 'Online' ||
                      !charger.connectors.some((c) => c.status === 'Charging')
                    }
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                  <button
                    onClick={() =>
                      openCommandDialog('UnlockConnector', charger, charger.connectors[0])
                    }
                    disabled={charger.connection_status !== 'Online'}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Unlock className="w-4 h-4" />
                    Unlock
                  </button>
                  <button
                    onClick={() => openCommandDialog('Reset', charger)}
                    disabled={charger.connection_status !== 'Online'}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Power className="w-4 h-4" />
                    Reset
                  </button>
                  <button
                    onClick={() => openCommandDialog('ChangeAvailability', charger)}
                    disabled={charger.connection_status !== 'Online'}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Availability
                  </button>
                  <button
                    onClick={() => openCommandDialog('ChangeConfiguration', charger)}
                    disabled={charger.connection_status !== 'Online'}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Config
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {commands.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-bold text-gray-900">Recent Commands</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {commands.map((command) => (
              <div key={command.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{command.command_type}</p>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(command.status)}`}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(command.status)}
                          {command.status}
                        </div>
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {command.charger.charge_point_id}
                      {command.connector && ` - Connector ${command.connector.connector_id}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(command.requested_at), 'PPp')}
                    </p>
                  </div>
                </div>
                {command.error_message && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {command.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
