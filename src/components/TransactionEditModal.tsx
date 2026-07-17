import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getStations } from '../lib/stationService';
import { Database } from '../lib/database.types';
import { format as formatDate, parseISO, differenceInMinutes } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

type Station = Database['public']['Tables']['stations']['Row'];

interface TransactionEditModalProps {
  transaction: {
    id: string;
    transaction_id: string;
    charge_id: string;
    card_number: string;
    start_ts: string;
    end_ts: string;
    energy_consumed_kwh: string;
    max_demand_kw: string | null;
    station_id: string | null;
    stations?: {
      id: string;
      name: string;
      station_code: string | null;
    };
  };
  onClose: () => void;
  onSave: () => void;
}

const TIMEZONE = 'Asia/Amman';

export default function TransactionEditModal({ transaction, onClose, onSave }: TransactionEditModalProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = toZonedTime(parseISO(transaction.start_ts), TIMEZONE);
  const endDate = toZonedTime(parseISO(transaction.end_ts), TIMEZONE);

  const [formData, setFormData] = useState({
    card_number: transaction.card_number,
    start_date: formatInTimeZone(startDate, TIMEZONE, 'yyyy-MM-dd'),
    start_time: formatInTimeZone(startDate, TIMEZONE, 'HH:mm'),
    end_date: formatInTimeZone(endDate, TIMEZONE, 'yyyy-MM-dd'),
    end_time: formatInTimeZone(endDate, TIMEZONE, 'HH:mm'),
    energy_consumed_kwh: transaction.energy_consumed_kwh,
    max_demand_kw: transaction.max_demand_kw || '',
    station_id: transaction.station_id || '',
  });

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const startDateTime = `${formData.start_date} ${formData.start_time}:00`;
      const endDateTime = `${formData.end_date} ${formData.end_time}:00`;

      const startParsed = parseISO(startDateTime);
      const endParsed = parseISO(endDateTime);

      if (isNaN(startParsed.getTime())) {
        throw new Error('Invalid start date/time');
      }
      if (isNaN(endParsed.getTime())) {
        throw new Error('Invalid end date/time');
      }
      if (endParsed <= startParsed) {
        throw new Error('End date/time must be after start date/time');
      }

      const durationMinutes = differenceInMinutes(endParsed, startParsed);
      const energyKwh = parseFloat(formData.energy_consumed_kwh);

      if (isNaN(energyKwh) || energyKwh <= 0) {
        throw new Error('Energy consumed must be a positive number');
      }

      if (!formData.station_id) {
        throw new Error('Please select a station');
      }

      const updates: any = {
        card_number: formData.card_number.trim(),
        start_ts: startDateTime,
        end_ts: endDateTime,
        duration_minutes: durationMinutes,
        energy_consumed_kwh: energyKwh.toString(),
        station_id: formData.station_id,
      };

      if (formData.max_demand_kw) {
        const maxDemand = parseFloat(formData.max_demand_kw);
        if (isNaN(maxDemand) || maxDemand < 0) {
          throw new Error('Max demand must be a non-negative number');
        }
        updates.max_demand_kw = maxDemand.toString();
      } else {
        updates.max_demand_kw = null;
      }

      const { error: updateError } = await supabase
        .from('charging_sessions')
        .update(updates)
        .eq('id', transaction.id);

      if (updateError) throw updateError;

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update transaction');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Transaction</h2>
            <p className="text-sm text-gray-600 mt-1">
              Transaction ID: {transaction.transaction_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="card_number"
                value={formData.card_number}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Station <span className="text-red-500">*</span>
              </label>
              <select
                name="station_id"
                value={formData.station_id}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select station...</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name} {station.station_code ? `(${station.station_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Start Date & Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">End Date & Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Energy & Demand</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Energy Consumed (kWh) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="energy_consumed_kwh"
                  value={formData.energy_consumed_kwh}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Demand (kW)
                </label>
                <input
                  type="number"
                  name="max_demand_kw"
                  value={formData.max_demand_kw}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
