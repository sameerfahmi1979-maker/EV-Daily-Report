import { useState } from 'react';
import { Plus, Trash2, Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { bulkChargerService, type BulkChargerData } from '../lib/bulkChargerService';
import { stationService } from '../lib/stationService';

export default function BulkChargerRegistration() {
  const { user } = useAuth();
  const [chargers, setChargers] = useState<BulkChargerData[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  useState(() => {
    if (user) {
      stationService.getAll().then(setStations).catch(console.error);
    }
  });

  const addCharger = () => {
    const newCharger = bulkChargerService.createChargerTemplate(
      'LOC',
      chargers.length + 1
    );
    setChargers([...chargers, newCharger]);
  };

  const removeCharger = (index: number) => {
    setChargers(chargers.filter((_, i) => i !== index));
  };

  const updateCharger = (index: number, field: string, value: any) => {
    const updated = [...chargers];
    if (field.startsWith('connector')) {
      const [, connIndex, connField] = field.split('.');
      updated[index].connectors[parseInt(connIndex)] = {
        ...updated[index].connectors[parseInt(connIndex)],
        [connField]: value,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setChargers(updated);
  };

  const generateTemplate = () => {
    const locationCode = prompt('Enter location code (e.g., LOC001):');
    if (!locationCode) return;

    const count = parseInt(prompt('How many chargers to generate?') || '1');
    if (isNaN(count) || count < 1 || count > 20) {
      alert('Please enter a number between 1 and 20');
      return;
    }

    const newChargers: BulkChargerData[] = [];
    for (let i = 1; i <= count; i++) {
      newChargers.push(bulkChargerService.createChargerTemplate(locationCode, i));
    }

    setChargers(newChargers);
  };

  const handleRegister = async () => {
    if (!user) return;

    if (chargers.length === 0) {
      alert('Please add at least one charger');
      return;
    }

    if (!confirm(`Register ${chargers.length} charger(s)?`)) {
      return;
    }

    setLoading(true);
    setShowResults(false);

    try {
      const registrationResults = await bulkChargerService.registerMultipleChargers(
        user.id,
        chargers
      );

      setResults(registrationResults);
      setShowResults(true);

      const successCount = registrationResults.filter((r) => r.success).length;
      const failCount = registrationResults.length - successCount;

      if (failCount === 0) {
        alert(`Successfully registered all ${successCount} chargers!`);
        setChargers([]);
      } else {
        alert(`Registered ${successCount} chargers. ${failCount} failed - see results below.`);
      }
    } catch (error: any) {
      alert(`Error during registration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Charge Point ID',
      'Vendor',
      'Model',
      'Serial Number',
      'Firmware',
      'Station ID',
      'IP Address',
      'Connector 1 Type',
      'Connector 1 Power',
      'Connector 2 Type',
      'Connector 2 Power',
    ].join(',');

    const rows = chargers.map((c) => [
      c.chargePointId,
      c.vendor,
      c.model,
      c.serialNumber,
      c.firmwareVersion || '',
      c.stationId || '',
      c.ipAddress || '',
      c.connectors[0]?.connectorType || '',
      c.connectors[0]?.powerKw || '',
      c.connectors[1]?.connectorType || '',
      c.connectors[1]?.powerKw || '',
    ].map((val) => `"${val}"`).join(','));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chargers-bulk-registration-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Bulk Charger Registration</h2>
        <div className="flex gap-2">
          <button
            onClick={generateTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Generate Template
          </button>
          <button
            onClick={addCharger}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Charger
          </button>
        </div>
      </div>

      {chargers.length > 0 && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Pre-Registration</h3>
                <p className="text-sm text-blue-700">
                  Register chargers in the system before physical installation. They will show as
                  "Offline" until they connect via OCPP.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {chargers.map((charger, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Charger #{index + 1}
                  </h3>
                  <button
                    onClick={() => removeCharger(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Charge Point ID *
                    </label>
                    <input
                      type="text"
                      value={charger.chargePointId}
                      onChange={(e) => updateCharger(index, 'chargePointId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="CV-LOC001-CP01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serial Number *
                    </label>
                    <input
                      type="text"
                      value={charger.serialNumber}
                      onChange={(e) => updateCharger(index, 'serialNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="SN-LOC-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor *
                    </label>
                    <input
                      type="text"
                      value={charger.vendor}
                      onChange={(e) => updateCharger(index, 'vendor', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ChargeCore Verde"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model *
                    </label>
                    <input
                      type="text"
                      value={charger.model}
                      onChange={(e) => updateCharger(index, 'model', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Verde-22"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firmware Version
                    </label>
                    <input
                      type="text"
                      value={charger.firmwareVersion || ''}
                      onChange={(e) => updateCharger(index, 'firmwareVersion', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="1.0.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Station (Optional)
                    </label>
                    <select
                      value={charger.stationId || ''}
                      onChange={(e) => updateCharger(index, 'stationId', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Not Linked</option>
                      {stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IP Address
                    </label>
                    <input
                      type="text"
                      value={charger.ipAddress || ''}
                      onChange={(e) => updateCharger(index, 'ipAddress', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Installation Date
                    </label>
                    <input
                      type="date"
                      value={charger.installationDate || ''}
                      onChange={(e) => updateCharger(index, 'installationDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Connectors</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {charger.connectors.map((connector, connIndex) => (
                      <div key={connIndex} className="border border-gray-200 rounded-lg p-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Connector {connector.connectorId}
                        </h5>
                        <div className="space-y-2">
                          <select
                            value={connector.connectorType}
                            onChange={(e) =>
                              updateCharger(
                                index,
                                `connector.${connIndex}.connectorType`,
                                e.target.value
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Type2">Type 2</option>
                            <option value="CCS">CCS</option>
                            <option value="CHAdeMO">CHAdeMO</option>
                            <option value="Type1">Type 1</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={connector.powerKw}
                              onChange={(e) =>
                                updateCharger(
                                  index,
                                  `connector.${connIndex}.powerKw`,
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              step="0.1"
                              min="0"
                            />
                            <span className="text-sm text-gray-600">kW</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export to CSV
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setChargers([])}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Clear All
              </button>
              <button
                onClick={handleRegister}
                disabled={loading || chargers.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {loading ? 'Registering...' : `Register ${chargers.length} Charger(s)`}
              </button>
            </div>
          </div>
        </>
      )}

      {chargers.length === 0 && !showResults && (
        <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-600 mb-4">No chargers added yet</p>
          <button
            onClick={generateTemplate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Generate Template
          </button>
        </div>
      )}

      {showResults && results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Results</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-medium text-gray-900">{result.chargePointId}</span>
                </div>
                {result.error && (
                  <span className="text-sm text-red-600">{result.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowResults(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Close Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
