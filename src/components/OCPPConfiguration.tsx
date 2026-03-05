import { useEffect, useState } from 'react';
import {
  Settings,
  Server,
  Key,
  Users,
  Package,
  RefreshCw,
  Edit,
  Save,
  X,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService } from '../lib/ocppService';
import { formatDistanceToNow } from 'date-fns';

interface ConfigKey {
  id: string;
  charger_id: string;
  key_name: string;
  value: string;
  readonly: boolean;
  last_updated: string;
  charger?: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  };
}

interface ConfigSummary {
  totalChargers: number;
  chargersWithConfig: number;
  totalKeys: number;
  commonKeys: { keyName: string; count: number }[];
}

interface FirmwareVersion {
  version: string;
  count: number;
  chargers: string[];
}

interface Operator {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rfid_card_number: string | null;
  status: string;
}

export function OCPPConfiguration() {
  const { user } = useAuth();
  const [chargers, setChargers] = useState<any[]>([]);
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [configKeys, setConfigKeys] = useState<ConfigKey[]>([]);
  const [configSummary, setConfigSummary] = useState<ConfigSummary | null>(null);
  const [firmwareVersions, setFirmwareVersions] = useState<FirmwareVersion[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSection, setExpandedSection] = useState<string>('config');
  const [filterCharger, setFilterCharger] = useState<string>('all');

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [chargerList, summary, firmware, operatorList] = await Promise.all([
        ocppService.getAllChargers(user.id),
        ocppService.getConfigurationKeySummary(user.id),
        ocppService.getFirmwareVersions(user.id),
        ocppService.getAuthorizationList(user.id),
      ]);

      setChargers(chargerList);
      setConfigSummary(summary);
      setFirmwareVersions(firmware);
      setOperators(operatorList);

      if (chargerList.length > 0 && !selectedChargerId) {
        setSelectedChargerId(chargerList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigKeys = async () => {
    if (!user) return;

    try {
      if (selectedChargerId) {
        const keys = await ocppService.getConfigurationKeys(user.id, selectedChargerId);
        setConfigKeys(keys);
      } else {
        const allKeys = await ocppService.getAllConfigurationKeys(user.id);
        setConfigKeys(allKeys);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration keys');
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (user && expandedSection === 'config') {
      fetchConfigKeys();
    }
  }, [user, selectedChargerId, expandedSection]);

  const handleRefreshConfig = async () => {
    if (!user || !selectedChargerId) return;

    try {
      setRefreshing(true);
      setError(null);
      await ocppService.refreshConfigurationKeys(user.id, selectedChargerId);
      setTimeout(() => {
        fetchConfigKeys();
        setRefreshing(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh configuration');
      setRefreshing(false);
    }
  };

  const handleEditKey = (key: ConfigKey) => {
    setEditingKey(key.id);
    setEditValue(key.value);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleSaveKey = async (key: ConfigKey) => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);
      await ocppService.updateConfigurationKey(
        user.id,
        key.charger_id,
        key.key_name,
        editValue
      );
      setEditingKey(null);
      setEditValue('');
      setTimeout(() => {
        fetchConfigKeys();
        setSaving(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update configuration');
      setSaving(false);
    }
  };

  const filteredConfigKeys = configKeys.filter((key) => {
    const matchesSearch =
      key.key_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.value.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCharger =
      filterCharger === 'all' ||
      key.charger_id === filterCharger;
    return matchesSearch && matchesCharger;
  });

  const groupedConfigKeys: Record<string, ConfigKey[]> = {};
  filteredConfigKeys.forEach((key) => {
    const chargerId = key.charger?.charge_point_id || 'Unknown';
    if (!groupedConfigKeys[chargerId]) {
      groupedConfigKeys[chargerId] = [];
    }
    groupedConfigKeys[chargerId].push(key);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!configSummary || chargers.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-gray-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">OCPP Configuration</h2>
          </div>
          <p className="text-gray-600">Configure OCPP server settings and charger parameters</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Chargers Available</h3>
          <p className="text-gray-600">
            Add chargers to your system to view and manage configuration settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">OCPP Configuration</h2>
            </div>
            <p className="text-gray-600">Configure OCPP server settings and charger parameters</p>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Chargers</p>
              <p className="text-2xl font-bold text-gray-900">{configSummary.totalChargers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Configured</p>
              <p className="text-2xl font-bold text-gray-900">
                {configSummary.chargersWithConfig}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Config Keys</p>
              <p className="text-2xl font-bold text-gray-900">{configSummary.totalKeys}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Authorized Users</p>
              <p className="text-2xl font-bold text-gray-900">{operators.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div
            onClick={() => setExpandedSection(expandedSection === 'config' ? '' : 'config')}
            className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSection === 'config' ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <Key className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Configuration Keys</h3>
                  <p className="text-sm text-gray-600">
                    View and manage OCPP configuration parameters
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-800 rounded-full">
                {filteredConfigKeys.length}
              </span>
            </div>
          </div>

          {expandedSection === 'config' && (
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search configuration keys..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                </div>

                <select
                  value={selectedChargerId || 'all'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedChargerId(value === 'all' ? null : value);
                    setFilterCharger(value);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="all">All Chargers</option>
                  {chargers.map((charger) => (
                    <option key={charger.id} value={charger.id}>
                      {charger.charge_point_id}
                    </option>
                  ))}
                </select>

                {selectedChargerId && (
                  <button
                    onClick={handleRefreshConfig}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                )}
              </div>

              {filteredConfigKeys.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    {searchTerm
                      ? 'No configuration keys match your search'
                      : 'No configuration keys available'}
                  </p>
                  {selectedChargerId && !searchTerm && (
                    <button
                      onClick={handleRefreshConfig}
                      className="mt-4 text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                      Refresh configuration from charger
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedConfigKeys).map(([chargerName, keys]) => (
                    <div key={chargerName}>
                      {!selectedChargerId && (
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Server className="w-4 h-4" />
                          {chargerName}
                        </h4>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Key Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Value
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Last Updated
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {keys.map((key) => (
                              <tr key={key.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono text-gray-900">
                                      {key.key_name}
                                    </code>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {editingKey === key.id ? (
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:border-transparent font-mono text-sm"
                                      autoFocus
                                    />
                                  ) : (
                                    <code className="text-sm font-mono text-gray-700">
                                      {key.value}
                                    </code>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {key.readonly ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                      <Lock className="w-3 h-3" />
                                      Read-only
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                      <Unlock className="w-3 h-3" />
                                      Writable
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {formatDistanceToNow(new Date(key.last_updated), {
                                    addSuffix: true,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {editingKey === key.id ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleSaveKey(key)}
                                        disabled={saving || editValue === key.value}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                        className="p-1 text-gray-600 hover:bg-gray-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleEditKey(key)}
                                      disabled={key.readonly}
                                      className="p-1 text-gray-600 hover:bg-gray-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={key.readonly ? 'Read-only key' : 'Edit value'}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {refreshing && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                    <p className="text-sm text-blue-900">
                      Requesting configuration from charger... This may take a few seconds.
                    </p>
                  </div>
                </div>
              )}

              {saving && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
                    <p className="text-sm text-green-900">
                      Sending configuration change to charger...
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div
            onClick={() =>
              setExpandedSection(expandedSection === 'firmware' ? '' : 'firmware')
            }
            className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSection === 'firmware' ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <Package className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Firmware Versions</h3>
                  <p className="text-sm text-gray-600">
                    View firmware versions across chargers
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                {firmwareVersions.length}
              </span>
            </div>
          </div>

          {expandedSection === 'firmware' && (
            <div className="p-6">
              {firmwareVersions.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No firmware information available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {firmwareVersions.map((fw, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Package className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-gray-900">{fw.version}</h4>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {fw.count} {fw.count === 1 ? 'charger' : 'chargers'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 ml-8">
                          {fw.chargers.map((chargerName, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-white border border-gray-200 text-gray-700 rounded"
                            >
                              {chargerName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div
            onClick={() => setExpandedSection(expandedSection === 'auth' ? '' : 'auth')}
            className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSection === 'auth' ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <Shield className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Authorization List</h3>
                  <p className="text-sm text-gray-600">
                    Active RFID tags authorized to use chargers
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800 rounded-full">
                {operators.length}
              </span>
            </div>
          </div>

          {expandedSection === 'auth' && (
            <div className="p-6">
              {operators.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No authorized operators</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          RFID Card
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {operators.map((operator) => (
                        <tr key={operator.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{operator.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-sm font-mono text-gray-700">
                              {operator.rfid_card_number || 'N/A'}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {operator.email || operator.phone || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              {operator.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
