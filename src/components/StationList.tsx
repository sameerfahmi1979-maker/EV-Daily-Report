import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { stationService } from '../lib/stationService';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, MapPin, Zap, Calendar, Edit, Trash2, Eye, Loader2, AlertCircle, AlertTriangle, DollarSign } from 'lucide-react';

type Station = Database['public']['Tables']['stations']['Row'];

interface StationListProps {
  onAddStation: () => void;
  onEditStation: (station: Station) => void;
  onViewStation: (station: Station) => void;
}

export function StationList({ onAddStation, onEditStation, onViewStation }: StationListProps) {
  const { user } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stationRateStatus, setStationRateStatus] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (user) {
      loadStations();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStations(stations);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = stations.filter(
        (station) =>
          station.name.toLowerCase().includes(query) ||
          station.location?.toLowerCase().includes(query) ||
          station.station_code?.toLowerCase().includes(query)
      );
      setFilteredStations(filtered);
    }
  }, [searchQuery, stations]);

  const checkRateStructures = async (stationIds: string[]) => {
    try {
      const { data } = await supabase
        .from('rate_structures')
        .select('station_id')
        .in('station_id', stationIds)
        .eq('is_active', true);

      const statusMap = new Map<string, boolean>();
      stationIds.forEach(id => statusMap.set(id, false));

      if (data) {
        data.forEach(rate => {
          if (rate.station_id) {
            statusMap.set(rate.station_id, true);
          }
        });
      }

      setStationRateStatus(statusMap);
    } catch (err) {
      console.error('Failed to check rate structures:', err);
    }
  };

  const loadStations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await stationService.getAll();
      setStations(data);
      setFilteredStations(data);

      if (data.length > 0) {
        await checkRateStructures(data.map(s => s.id));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this station? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await stationService.delete(id, user.id);
      await loadStations();
    } catch (err: any) {
      alert('Error deleting station: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Charging Stations</h2>
          <p className="text-gray-600 mt-1">Manage your EV charging stations</p>
        </div>
        <button
          onClick={onAddStation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Station
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search stations by name, location, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {filteredStations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? 'No stations found' : 'No stations yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Get started by adding your first charging station'}
          </p>
          {!searchQuery && (
            <button
              onClick={onAddStation}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Your First Station
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStations.map((station) => (
            <div
              key={station.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{station.name}</h3>
                    {station.station_code && (
                      <p className="text-sm text-gray-500 font-mono">{station.station_code}</p>
                    )}
                  </div>
                  {getStatusBadge(station.status || 'inactive')}
                </div>

                <div className="space-y-2 mb-4">
                  {station.location && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{station.location}</span>
                    </div>
                  )}
                  {station.capacity_kw && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Zap className="w-4 h-4 flex-shrink-0" />
                      <span>{station.capacity_kw} kW</span>
                    </div>
                  )}
                  {station.installation_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>{new Date(station.installation_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    {stationRateStatus.get(station.id) ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <DollarSign className="w-4 h-4 flex-shrink-0" />
                        <span>Rate structure configured</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>No rate structure</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => onViewStation(station)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => onEditStation(station)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(station.id)}
                    disabled={deletingId === station.id}
                    className="flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === station.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredStations.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-600">
          Showing {filteredStations.length} of {stations.length} stations
        </div>
      )}
    </div>
  );
}
