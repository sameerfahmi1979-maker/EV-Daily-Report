import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { createFixedCharge, updateFixedCharge } from '../lib/fixedChargeService';
import { getStations } from '../lib/stationService';
import { Database } from '../lib/database.types';

type FixedCharge = Database['public']['Tables']['fixed_charges']['Row'];
type Station = Database['public']['Tables']['stations']['Row'];

interface FixedChargesFormProps {
  fixedCharge?: FixedCharge & {
    stations?: {
      id: string;
      name: string;
      station_code: string | null;
    };
  };
  onClose: () => void;
  onSave: () => void;
}

const CHARGE_TYPES = [
  { value: 'per_session', label: 'Per Session' },
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' }
];

export default function FixedChargesForm({ fixedCharge, onClose, onSave }: FixedChargesFormProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [formData, setFormData] = useState({
    charge_name: fixedCharge?.charge_name || '',
    charge_type: fixedCharge?.charge_type || 'per_session',
    amount: fixedCharge?.amount ? String(fixedCharge.amount) : '0.000',
    station_id: fixedCharge?.station_id || '',
    effective_from: fixedCharge?.effective_from || '',
    effective_to: fixedCharge?.effective_to || '',
    is_active: fixedCharge?.is_active ?? true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

    if (!formData.charge_name.trim()) {
      newErrors.charge_name = 'Charge name is required';
    }

    if (!formData.station_id) {
      newErrors.station_id = 'Station is required';
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < 0) {
      newErrors.amount = 'Amount must be a positive number';
    }

    if (formData.effective_from && formData.effective_to) {
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
        charge_name: formData.charge_name,
        charge_type: formData.charge_type,
        amount: formData.amount,
        station_id: formData.station_id,
        effective_from: formData.effective_from || null,
        effective_to: formData.effective_to || null,
        is_active: formData.is_active
      };

      if (fixedCharge) {
        await updateFixedCharge(fixedCharge.id, dataToSave);
      } else {
        await createFixedCharge(dataToSave);
      }

      onSave();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save fixed charge');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {fixedCharge ? 'Edit Fixed Charge' : 'Add Fixed Charge'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Charge Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.charge_name}
              onChange={(e) => setFormData({ ...formData, charge_name: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.charge_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Connection Fee, Service Fee"
            />
            {errors.charge_name && <p className="text-red-600 text-sm mt-1">{errors.charge_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Charge Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.charge_type}
              onChange={(e) => setFormData({ ...formData, charge_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CHARGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (JOD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.000"
            />
            {errors.amount && <p className="text-red-600 text-sm mt-1">{errors.amount}</p>}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Effective From <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                type="date"
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Effective To <span className="text-gray-500 text-xs">(Optional)</span>
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

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={18} />
              <span>{saving ? 'Saving...' : fixedCharge ? 'Update' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
