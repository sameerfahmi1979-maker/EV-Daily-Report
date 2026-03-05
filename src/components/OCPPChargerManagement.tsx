import { useEffect, useState } from 'react';
import { Plug, Plus, Edit2, Trash2, X, Save, MapPin, Calendar, Info, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ocppService } from '../lib/ocppService';
import { stationService } from '../lib/stationService';
import { Database } from '../lib/database.types';
import { format } from 'date-fns';

type OcppCharger = Database['public']['Tables']['ocpp_chargers']['Row'];
type OcppConnector = Database['public']['Tables']['ocpp_connectors']['Row'];
type Station = Database['public']['Tables']['stations']['Row'];

interface ChargerWithConnectors extends OcppCharger {
  connectors: OcppConnector[];
  station?: {
    id: string;
    name: string;
    station_code: string | null;
  };
}

type ViewMode = 'list' | 'add' | 'edit' | 'view';

export function OCPPChargerManagement() {
  const { user } = useAuth();
  const [chargers, setChargers] = useState<ChargerWithConnectors[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCharger, setSelectedCharger] = useState<ChargerWithConnectors | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    charge_point_id: '',
    vendor: 'ChargeCore Verde',
    model: '',
    serial_number: '',
    firmware_version: '',
    protocol_version: '1.6J',
    station_id: '',
    location_latitude: '',
    location_longitude: '',
    installation_date: '',
    notes: '',
    connectors: [
      { connector_id: 1, connector_type: 'Type2', power_kw: 7.4 },
      { connector_id: 2, connector_type: 'Type2', power_kw: 7.4 },
    ],
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      setError(null);
      const [chargersData, stationsData] = await Promise.all([
        ocppService.getAllChargers(user.id),
        stationService.getAll(),
      ]);

      setChargers(chargersData);
      setStations(stationsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAddNew = () => {
    setFormData({
      charge_point_id: '',
      vendor: 'ChargeCore Verde',
      model: '',
      serial_number: '',
      firmware_version: '',
      protocol_version: '1.6J',
      station_id: '',
      location_latitude: '',
      location_longitude: '',
      installation_date: '',
      notes: '',
      connectors: [
        { connector_id: 1, connector_type: 'Type2', power_kw: 7.4 },
        { connector_id: 2, connector_type: 'Type2', power_kw: 7.4 },
      ],
    });
    setViewMode('add');
  };

  const handleEdit = (charger: ChargerWithConnectors) => {
    setSelectedCharger(charger);
    setFormData({
      charge_point_id: charger.charge_point_id,
      vendor: charger.vendor || 'ChargeCore Verde',
      model: charger.model || '',
      serial_number: charger.serial_number || '',
      firmware_version: charger.firmware_version || '',
      protocol_version: charger.protocol_version || '1.6J',
      station_id: charger.station_id || '',
      location_latitude: charger.location_latitude?.toString() || '',
      location_longitude: charger.location_longitude?.toString() || '',
      installation_date: charger.installation_date || '',
      notes: charger.notes || '',
      connectors: charger.connectors.map(c => ({
        connector_id: c.connector_id,
        connector_type: c.connector_type,
        power_kw: c.power_kw || 0,
      })),
    });
    setViewMode('edit');
  };

  const handleView = (charger: ChargerWithConnectors) => {
    setSelectedCharger(charger);
    setViewMode('view');
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);

      if (viewMode === 'add') {
        const charger = await ocppService.createCharger(user.id, {
          charge_point_id: formData.charge_point_id,
          vendor: formData.vendor,
          model: formData.model,
          serial_number: formData.serial_number || undefined,
          firmware_version: formData.firmware_version || undefined,
          protocol_version: formData.protocol_version,
          station_id: formData.station_id || undefined,
          location_latitude: formData.location_latitude ? parseFloat(formData.location_latitude) : undefined,
          location_longitude: formData.location_longitude ? parseFloat(formData.location_longitude) : undefined,
          installation_date: formData.installation_date || undefined,
          notes: formData.notes || undefined,
        });

        for (const connector of formData.connectors) {
          await ocppService.createConnector(charger.id, connector);
        }
      } else if (viewMode === 'edit' && selectedCharger) {
        await ocppService.updateCharger(selectedCharger.id, user.id, {
          charge_point_id: formData.charge_point_id,
          vendor: formData.vendor,
          model: formData.model,
          serial_number: formData.serial_number || undefined,
          firmware_version: formData.firmware_version || undefined,
          protocol_version: formData.protocol_version,
          station_id: formData.station_id || undefined,
          location_latitude: formData.location_latitude ? parseFloat(formData.location_latitude) : undefined,
          location_longitude: formData.location_longitude ? parseFloat(formData.location_longitude) : undefined,
          installation_date: formData.installation_date || undefined,
          notes: formData.notes || undefined,
        });

        for (let i = 0; i < formData.connectors.length; i++) {
          const connectorData = formData.connectors[i];
          const existingConnector = selectedCharger.connectors[i];

          if (existingConnector) {
            await ocppService.updateConnector(existingConnector.id, {
              connector_type: connectorData.connector_type,
              power_kw: connectorData.power_kw,
            });
          }
        }
      }

      await fetchData();
      setViewMode('list');
    } catch (err: any) {
      setError(err.message || 'Failed to save charger');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (chargerId: string) => {
    if (!user) return;

    try {
      setError(null);
      await ocppService.deleteCharger(chargerId, user.id);
      await fetchData();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete charger');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Online: 'bg-green-100 text-green-800 border-green-200',
      Offline: 'bg-gray-100 text-gray-800 border-gray-200',
      Unknown: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[status] || colors.Unknown;
  };

  const getRegistrationColor = (status: string) => {
    const colors: Record<string, string> = {
      Accepted: 'bg-green-100 text-green-800 border-green-200',
      Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      Rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || colors.Pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading chargers...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'add' || viewMode === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plug className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              {viewMode === 'add' ? 'Register New Charger' : 'Edit Charger'}
            </h2>
          </div>
          <p className="text-gray-600">Configure charger details and connectors</p>
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
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Charger Information</h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Charge Point ID *
                </label>
                <input
                  type="text"
                  value={formData.charge_point_id}
                  onChange={(e) => setFormData({ ...formData, charge_point_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="CP-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor *
                </label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model *
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Verde 7.4kW"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firmware Version
                </label>
                <input
                  type="text"
                  value={formData.firmware_version}
                  onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1.0.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Protocol Version *
                </label>
                <select
                  value={formData.protocol_version}
                  onChange={(e) => setFormData({ ...formData, protocol_version: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="1.6J">OCPP 1.6J</option>
                  <option value="2.0">OCPP 2.0</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Station
                </label>
                <select
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Station</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Installation Date
                </label>
                <input
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.location_latitude}
                  onChange={(e) => setFormData({ ...formData, location_latitude: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="40.7128"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.location_longitude}
                  onChange={(e) => setFormData({ ...formData, location_longitude: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="-74.0060"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional notes about this charger..."
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Connectors</h4>
              <div className="space-y-4">
                {formData.connectors.map((connector, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Connector ID
                        </label>
                        <input
                          type="number"
                          value={connector.connector_id}
                          onChange={(e) => {
                            const newConnectors = [...formData.connectors];
                            newConnectors[index].connector_id = parseInt(e.target.value);
                            setFormData({ ...formData, connectors: newConnectors });
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          readOnly={viewMode === 'edit'}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Type
                        </label>
                        <select
                          value={connector.connector_type}
                          onChange={(e) => {
                            const newConnectors = [...formData.connectors];
                            newConnectors[index].connector_type = e.target.value;
                            setFormData({ ...formData, connectors: newConnectors });
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Type2">Type 2</option>
                          <option value="CCS">CCS</option>
                          <option value="CHAdeMO">CHAdeMO</option>
                          <option value="Type1">Type 1</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Power (kW)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={connector.power_kw}
                          onChange={(e) => {
                            const newConnectors = [...formData.connectors];
                            newConnectors[index].power_kw = parseFloat(e.target.value);
                            setFormData({ ...formData, connectors: newConnectors });
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setViewMode('list')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.charge_point_id || !formData.vendor || !formData.model}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : viewMode === 'add' ? 'Register Charger' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'view' && selectedCharger) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plug className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Charger Details</h2>
          </div>
          <p className="text-gray-600">{selectedCharger.charge_point_id}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(
                  selectedCharger.connection_status
                )}`}
              >
                {selectedCharger.connection_status}
              </span>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full border ${getRegistrationColor(
                  selectedCharger.registration_status
                )}`}
              >
                {selectedCharger.registration_status}
              </span>
            </div>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Vendor</p>
                <p className="font-medium text-gray-900">{selectedCharger.vendor || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Model</p>
                <p className="font-medium text-gray-900">{selectedCharger.model || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Serial Number</p>
                <p className="font-medium text-gray-900">{selectedCharger.serial_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Firmware Version</p>
                <p className="font-medium text-gray-900">{selectedCharger.firmware_version || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Protocol Version</p>
                <p className="font-medium text-gray-900">{selectedCharger.protocol_version || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Station</p>
                <p className="font-medium text-gray-900">
                  {selectedCharger.station ? selectedCharger.station.name : 'Not Linked'}
                </p>
              </div>
              {selectedCharger.installation_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Installation Date</p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(selectedCharger.installation_date), 'PPP')}
                  </p>
                </div>
              )}
              {selectedCharger.last_heartbeat_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Last Heartbeat</p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(selectedCharger.last_heartbeat_at), 'PPp')}
                  </p>
                </div>
              )}
              {(selectedCharger.location_latitude && selectedCharger.location_longitude) && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Location</p>
                  <p className="font-medium text-gray-900">
                    {selectedCharger.location_latitude}, {selectedCharger.location_longitude}
                  </p>
                </div>
              )}
            </div>

            {selectedCharger.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-gray-900">{selectedCharger.notes}</p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Connectors</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCharger.connectors.map((connector) => (
                  <div key={connector.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-gray-900">Connector {connector.connector_id}</h5>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        connector.status === 'Available' ? 'bg-green-100 text-green-800' :
                        connector.status === 'Charging' ? 'bg-blue-100 text-blue-800' :
                        connector.status === 'Faulted' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {connector.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type:</span>
                        <span className="font-medium text-gray-900">{connector.connector_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Power:</span>
                        <span className="font-medium text-gray-900">{connector.power_kw} kW</span>
                      </div>
                      {connector.last_status_update && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Updated:</span>
                          <span className="font-medium text-gray-900">
                            {format(new Date(connector.last_status_update), 'PPp')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-between">
            <button
              onClick={() => setViewMode('list')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to List
            </button>
            <button
              onClick={() => handleEdit(selectedCharger)}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit Charger
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plug className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Charger Management</h2>
          </div>
          <p className="text-gray-600">Register and configure OCPP chargers</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Register Charger
        </button>
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

      {chargers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Plug className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Chargers Registered</h3>
          <p className="text-gray-600 mb-6">
            Get started by registering your first OCPP charger
          </p>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Register Your First Charger
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chargers.map((charger) => (
            <div key={charger.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{charger.charge_point_id}</h3>
                    <p className="text-sm text-gray-600">
                      {charger.vendor} {charger.model}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                        charger.connection_status
                      )}`}
                    >
                      {charger.connection_status}
                    </span>
                  </div>
                </div>

                {charger.station && (
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-600">{charger.station.name}</p>
                  </div>
                )}

                {charger.installation_date && (
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Installed: {format(new Date(charger.installation_date), 'PP')}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  {charger.connectors.map((connector) => (
                    <div
                      key={connector.id}
                      className="flex-1 p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <p className="text-xs font-medium text-gray-700 mb-1">
                        Connector {connector.connector_id}
                      </p>
                      <p className="text-xs text-gray-600">{connector.connector_type}</p>
                      <p className="text-xs text-gray-500">{connector.power_kw} kW</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleView(charger)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Info className="w-4 h-4" />
                    Details
                  </button>
                  <button
                    onClick={() => handleEdit(charger)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  {deleteConfirm === charger.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(charger.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(charger.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
