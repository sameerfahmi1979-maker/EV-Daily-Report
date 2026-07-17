import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { stationService } from '../lib/stationService';
import { Database } from '../lib/database.types';
import { X, Loader2, AlertCircle, Save } from 'lucide-react';

type Station = Database['public']['Tables']['stations']['Row'];

interface StationFormProps {
  station?: Station | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StationForm({ station, onClose, onSuccess }: StationFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    capacity_kw: '',
    station_code: '',
    status: 'active',
    installation_date: '',
    notes: '',
  });

  useEffect(() => {
    if (station) {
      setFormData({
        name: station.name || '',
        location: station.location || '',
        address: station.address || '',
        capacity_kw: station.capacity_kw?.toString() || '',
        station_code: station.station_code || '',
        status: station.status || 'active',
        installation_date: station.installation_date || '',
        notes: station.notes || '',
      });
    }
  }, [station]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!formData.name.trim()) {
      setError('Station name is required');
      return;
    }

    if (formData.capacity_kw && parseFloat(formData.capacity_kw) <= 0) {
      setError('Capacity must be a positive number');
      return;
    }

    setLoading(true);

    try {
      const stationData = {
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        address: formData.address.trim() || null,
        capacity_kw: formData.capacity_kw ? parseFloat(formData.capacity_kw) : null,
        station_code: formData.station_code.trim() || null,
        status: formData.status,
        installation_date: formData.installation_date || null,
        notes: formData.notes.trim() || null,
        user_id: user.id,
      };

      if (station) {
        await stationService.update(station.id, user.id, stationData);
      } else {
        await stationService.create(stationData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {station ? 'Edit Station' : 'Add New Station'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Station Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Downtown Amman Station"
                disabled={loading}
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Downtown Amman"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="station_code" className="block text-sm font-medium text-gray-700 mb-2">
                  Station Code
                </label>
                <input
                  id="station_code"
                  type="text"
                  value={formData.station_code}
                  onChange={(e) => setFormData({ ...formData, station_code: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., STATION-A1"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Enter full address"
                disabled={loading}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <label htmlFor="capacity_kw" className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity (kW)
                </label>
                <input
                  id="capacity_kw"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.capacity_kw}
                  onChange={(e) => setFormData({ ...formData, capacity_kw: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="150"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label htmlFor="installation_date" className="block text-sm font-medium text-gray-700 mb-2">
                  Installation Date
                </label>
                <input
                  id="installation_date"
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Additional notes or information"
                disabled={loading}
              />
            </div>
          </div>

          <div className="mt-8 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {station ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {station ? 'Update Station' : 'Create Station'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
