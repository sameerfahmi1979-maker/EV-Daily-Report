import React, { useState, useEffect } from 'react';
import { X, Save, Info, Clock, Calendar } from 'lucide-react';
import { createRateStructure, updateRateStructure } from '../lib/rateService';
import { getStations } from '../lib/stationService';
import { Database } from '../lib/database.types';
import RatePeriodEditor from './RatePeriodEditor';

type RateStructure = Database['public']['Tables']['rate_structures']['Row'];
type Station = Database['public']['Tables']['stations']['Row'];

interface RateStructureFormProps {
  rateStructure?: RateStructure & {
    stations?: {
      id: string;
      name: string;
      station_code: string | null;
    };
  };
  onClose: () => void;
  onSave: () => void;
}

export default function RateStructureForm({ rateStructure, onClose, onSave }: RateStructureFormProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [formData, setFormData] = useState({
    name: rateStructure?.name || '',
    description: rateStructure?.description || '',
    station_id: rateStructure?.station_id || '',
    effective_from: rateStructure?.effective_from || new Date().toISOString().split('T')[0],
    effective_to: rateStructure?.effective_to || '',
    is_active: rateStructure?.is_active ?? true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPeriodEditor, setShowPeriodEditor] = useState(false);
  const [createdStructure, setCreatedStructure] = useState<RateStructure | null>(null);

  useEffect(() => {
    loadStations();
  }, []);

  async function loadStations() {
    try {
      const data = await getStations();
      setStations(data);
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.station_id) {
      newErrors.station_id = 'Station is required';
    }

    if (!formData.effective_from) {
      newErrors.effective_from = 'Effective from date is required';
    }

    if (formData.effective_to && formData.effective_from) {
      if (new Date(formData.effective_to) <= new Date(formData.effective_from)) {
        newErrors.effective_to = 'Effective to date must be after effective from date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const dataToSave = {
        ...formData,
        effective_to: formData.effective_to || null
      };

      if (rateStructure) {
        await updateRateStructure(rateStructure.id, dataToSave);
        onSave();
        onClose();
      } else {
        const newStructure = await createRateStructure(dataToSave);
        if (newStructure) {
          setCreatedStructure(newStructure);
          setShowPeriodEditor(true);
          return;
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save rate structure');
    } finally {
      setSaving(false);
    }
  }

  const activeStructure = createdStructure || rateStructure;

  if (showPeriodEditor && activeStructure) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <RatePeriodEditor
            rateStructureId={activeStructure.id}
            rateStructureName={activeStructure.name}
            onClose={() => {
              onSave();
              onClose();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {rateStructure ? 'Edit Rate Structure' : 'Create Rate Structure'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
            <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Government Time-of-Use Pricing</p>
              <p>This rate structure defines <span className="font-medium">hour-based pricing that applies to every calendar day</span> during the validity period. You'll configure the hourly rates in the next step.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Structure Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Jordan EDCO TOU Rates 2024"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional description of this rate structure..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Station <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.station_id}
              onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.station_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a station...</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} {station.station_code ? `(${station.station_code})` : ''}
                </option>
              ))}
            </select>
            {errors.station_id && <p className="text-red-600 text-sm mt-1">{errors.station_id}</p>}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center space-x-2 mb-3">
              <Calendar className="text-gray-600" size={18} />
              <h3 className="text-sm font-semibold text-gray-900">Pricing Schedule Validity Period</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Specify when this pricing schedule becomes active. The hourly rates you configure will apply to every day within this date range.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valid From <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.effective_from ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.effective_from && (
                  <p className="text-red-600 text-sm mt-1">{errors.effective_from}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Start date of this pricing schedule</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valid To <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.effective_to}
                  onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.effective_to ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.effective_to && (
                  <p className="text-red-600 text-sm mt-1">{errors.effective_to}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Leave blank for ongoing validity</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <div className="flex space-x-3">
              {rateStructure && (
                <button
                  type="button"
                  onClick={() => setShowPeriodEditor(true)}
                  className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Clock size={18} />
                  <span>Configure Hourly Rates</span>
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rateStructure ? (
                  <>
                    <Save size={18} />
                    <span>{saving ? 'Updating...' : 'Update Structure'}</span>
                  </>
                ) : (
                  <>
                    <Clock size={18} />
                    <span>{saving ? 'Saving...' : 'Next: Configure Hourly Rates'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
