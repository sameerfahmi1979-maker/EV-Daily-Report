import { useState, useEffect } from 'react';
import { stationService } from '../lib/stationService';
import { Database } from '../lib/database.types';
import { formatJOD } from '../lib/currency';
import { X, Loader2, MapPin, Zap, Calendar, FileText, Edit, Trash2, TrendingUp, Activity, DollarSign, Clock } from 'lucide-react';

type Station = Database['public']['Tables']['stations']['Row'];

interface StationDetailsProps {
  station: Station;
  onClose: () => void;
  onEdit: (station: Station) => void;
  onDelete: (station: Station) => void;
}

export function StationDetails({ station, onClose, onEdit, onDelete }: StationDetailsProps) {
  const [statistics, setStatistics] = useState<{
    totalSessions: number;
    totalEnergy: number;
    totalRevenue: number;
    avgDuration: number;
  } | null>(null);
  const [rateStructures, setRateStructures] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStationData();
  }, [station.id]);

  const loadStationData = async () => {
    try {
      setLoading(true);
      const [stats, rates, sessions] = await Promise.all([
        stationService.getStatistics(station.id),
        stationService.getRateStructures(station.id),
        stationService.getRecentSessions(station.id, 5),
      ]);

      setStatistics(stats);
      setRateStructures(rates);
      setRecentSessions(sessions);
    } catch (err) {
      console.error('Error loading station data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status as keyof typeof styles] || styles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{station.name}</h2>
            {station.station_code && (
              <p className="text-sm text-gray-500 font-mono mt-1">{station.station_code}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6 border border-blue-100">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-semibold text-gray-900">{station.location || 'Not specified'}</p>
                </div>
              </div>

              {station.capacity_kw && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Capacity</p>
                    <p className="font-semibold text-gray-900">{station.capacity_kw} kW</p>
                  </div>
                </div>
              )}

              {station.installation_date && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Installed</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(station.installation_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="mt-1">{getStatusBadge(station.status || 'inactive')}</div>
                </div>
              </div>
            </div>

            {station.address && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Address</p>
                <p className="text-gray-900">{station.address}</p>
              </div>
            )}

            {station.notes && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Notes</p>
                    <p className="text-gray-900 text-sm">{station.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <>
              {statistics && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Sessions</p>
                          <p className="text-2xl font-bold text-gray-900">{statistics.totalSessions}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Zap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Energy</p>
                          <p className="text-2xl font-bold text-gray-900">{statistics.totalEnergy.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">kWh</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Revenue</p>
                          <p className="text-2xl font-bold text-gray-900">{formatJOD(statistics.totalRevenue)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Avg Duration</p>
                          <p className="text-2xl font-bold text-gray-900">{Math.round(statistics.avgDuration)}</p>
                          <p className="text-xs text-gray-500">minutes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rateStructures.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Structures</h3>
                  <div className="space-y-3">
                    {rateStructures.map((rate) => (
                      <div key={rate.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900">{rate.name}</h4>
                            {rate.description && (
                              <p className="text-sm text-gray-600 mt-1">{rate.description}</p>
                            )}
                          </div>
                          {rate.is_active && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Effective from: {new Date(rate.effective_from).toLocaleDateString()}
                          {rate.effective_to && ` to ${new Date(rate.effective_to).toLocaleDateString()}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recentSessions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Transaction ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Energy</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {recentSessions.map((session) => (
                          <tr key={session.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 font-mono">{session.transaction_id}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{session.energy_consumed_kwh.toFixed(2)} kWh</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formatJOD(session.calculated_cost)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(session.start_ts).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => onEdit(station)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Edit className="w-5 h-5" />
              Edit Station
            </button>
            <button
              onClick={() => {
                onClose();
                onDelete(station);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
