import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { operatorService } from '../lib/operatorService';
import { formatJOD } from '../lib/currency';
import { formatToJordanTime } from '../lib/datetime';
import {
  X,
  User,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Edit,
  Trash2,
  Loader2,
  Zap,
  DollarSign,
  Clock,
  Calendar,
  MapPin,
} from 'lucide-react';

type Operator = Database['public']['Tables']['operators']['Row'];

interface OperatorDetailsProps {
  operator: Operator;
  onClose: () => void;
  onEdit: (operator: Operator) => void;
  onDelete: (operator: Operator) => void;
}

export function OperatorDetails({ operator, onClose, onEdit, onDelete }: OperatorDetailsProps) {
  const [statistics, setStatistics] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOperatorData();
  }, [operator.id]);

  const loadOperatorData = async () => {
    try {
      setLoading(true);
      const [stats, sessions] = await Promise.all([
        operatorService.getStatistics(operator.id),
        operatorService.getRecentSessions(operator.id, 5),
      ]);
      setStatistics(stats);
      setRecentSessions(sessions);
    } catch (err) {
      console.error('Error loading operator data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusValue = status || 'active';
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[statusValue as keyof typeof styles] || styles.active}`}>
        {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Operator Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              {operator.photo_url ? (
                <img
                  src={operator.photo_url}
                  alt={operator.name}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{operator.name}</h3>
                  {getStatusBadge(operator.status)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(operator)}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(operator)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-600" />
                Contact Information
              </h4>
              <div className="space-y-3">
                {operator.phone_number && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{operator.phone_number}</p>
                    </div>
                  </div>
                )}
                {operator.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Email</p>
                      <p className="text-sm font-medium text-gray-900">{operator.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                Identification
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Card Number</p>
                    <p className="text-sm font-medium text-gray-900 font-mono">{operator.card_number}</p>
                  </div>
                </div>
                {operator.id_number && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">ID Number</p>
                      <p className="text-sm font-medium text-gray-900">{operator.id_number}</p>
                    </div>
                  </div>
                )}
                {operator.national_number && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">National Number</p>
                      <p className="text-sm font-medium text-gray-900">{operator.national_number}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {operator.notes && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Notes
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{operator.notes}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : statistics ? (
            <>
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Statistics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Zap className="w-5 h-5 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600">SESSIONS</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{statistics.totalSessions}</p>
                    <p className="text-sm text-blue-700">Total sessions</p>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Zap className="w-5 h-5 text-green-600" />
                      <span className="text-xs font-medium text-green-600">ENERGY</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {statistics.totalEnergy.toFixed(2)}
                    </p>
                    <p className="text-sm text-green-700">kWh consumed</p>
                  </div>

                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                      <span className="text-xs font-medium text-purple-600">REVENUE</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatJOD(statistics.totalRevenue)}
                    </p>
                    <p className="text-sm text-purple-700">Total cost</p>
                  </div>

                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <span className="text-xs font-medium text-orange-600">DURATION</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {Math.round(statistics.avgDuration)}
                    </p>
                    <p className="text-sm text-orange-700">Avg minutes</p>
                  </div>
                </div>
              </div>

              {recentSessions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Recent Sessions</h4>
                  <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              Station
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                              Energy
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                              Cost
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {recentSessions.map((session) => (
                            <tr key={session.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {formatToJordanTime(session.start_ts)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {session.stations?.name || session.station_code || 'Unknown'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                {session.energy_consumed_kwh.toFixed(2)} kWh
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                                {formatJOD(session.calculated_cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
            <p>Created: {formatToJordanTime(operator.created_at || '')}</p>
            {operator.updated_at && operator.updated_at !== operator.created_at && (
              <p>Last updated: {formatToJordanTime(operator.updated_at)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
