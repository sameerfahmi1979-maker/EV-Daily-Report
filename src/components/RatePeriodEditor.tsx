import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Clock, Zap, DollarSign, Download, Info, Calendar } from 'lucide-react';
import {
  getRatePeriods,
  createRatePeriod,
  updateRatePeriod,
  deleteRatePeriod,
  applyTemplate,
  jordanTemplates
} from '../lib/rateService';
import { formatJOD } from '../lib/currency';
import { Database } from '../lib/database.types';

type RatePeriod = Database['public']['Tables']['rate_periods']['Row'];

interface RatePeriodEditorProps {
  rateStructureId: string;
  rateStructureName: string;
  onClose: () => void;
}

interface PeriodFormData {
  period_name: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  season: string;
  energy_rate_per_kwh: string;
  demand_charge_per_kw: string;
  priority: string;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SEASONS = ['all', 'summer', 'winter', 'spring', 'fall'];
const PERIOD_COLORS: Record<string, string> = {
  'Super Off-Peak': 'bg-blue-200 border-blue-400',
  'Off-Peak': 'bg-green-200 border-green-400',
  'Mid-Peak': 'bg-yellow-200 border-yellow-400',
  'Peak': 'bg-red-200 border-red-400',
  'All Day': 'bg-gray-200 border-gray-400'
};

export default function RatePeriodEditor({ rateStructureId, rateStructureName, onClose }: RatePeriodEditorProps) {
  const [periods, setPeriods] = useState<RatePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<RatePeriod | null>(null);
  const [formData, setFormData] = useState<PeriodFormData>({
    period_name: '',
    start_time: '00:00:00',
    end_time: '24:00:00',
    days_of_week: DAYS_OF_WEEK,
    season: 'all',
    energy_rate_per_kwh: '0.150',
    demand_charge_per_kw: '0.000',
    priority: '1'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPeriods();
  }, [rateStructureId]);

  async function loadPeriods() {
    try {
      setLoading(true);
      const data = await getRatePeriods(rateStructureId);
      setPeriods(data);
    } catch (err) {
      console.error('Failed to load periods:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyTemplate(templateKey: 'edcoTOU' | 'flatRate') {
    if (periods.length > 0) {
      if (!confirm('This will replace all existing periods. Continue?')) {
        return;
      }
    }

    try {
      await applyTemplate(rateStructureId, templateKey);
      await loadPeriods();
      alert('Template applied successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to apply template');
    }
  }

  function handleAddPeriod() {
    setEditingPeriod(null);
    setFormData({
      period_name: '',
      start_time: '00:00:00',
      end_time: '24:00:00',
      days_of_week: DAYS_OF_WEEK,
      season: 'all',
      energy_rate_per_kwh: '0.150',
      demand_charge_per_kw: '0.000',
      priority: String(periods.length + 1)
    });
    setErrors({});
    setShowForm(true);
  }

  function handleEditPeriod(period: RatePeriod) {
    setEditingPeriod(period);
    setFormData({
      period_name: period.period_name,
      start_time: period.start_time,
      end_time: period.end_time,
      days_of_week: period.days_of_week,
      season: period.season,
      energy_rate_per_kwh: String(period.energy_rate_per_kwh),
      demand_charge_per_kw: String(period.demand_charge_per_kw),
      priority: String(period.priority)
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleDeletePeriod(id: string, name: string) {
    if (!confirm(`Delete period "${name}"?`)) return;

    try {
      await deleteRatePeriod(id);
      await loadPeriods();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete period');
    }
  }

  function validatePeriodForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.period_name.trim()) {
      newErrors.period_name = 'Period name is required';
    }

    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required';
    }

    if (!formData.end_time) {
      newErrors.end_time = 'End time is required';
    }

    if (formData.days_of_week.length === 0) {
      newErrors.days_of_week = 'Select at least one day';
    }

    const energyRate = parseFloat(formData.energy_rate_per_kwh);
    if (isNaN(energyRate) || energyRate < 0) {
      newErrors.energy_rate_per_kwh = 'Invalid energy rate';
    }

    const demandCharge = parseFloat(formData.demand_charge_per_kw);
    if (isNaN(demandCharge) || demandCharge < 0) {
      newErrors.demand_charge_per_kw = 'Invalid demand charge';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmitPeriod(e: React.FormEvent) {
    e.preventDefault();

    if (!validatePeriodForm()) return;

    try {
      const periodData = {
        rate_structure_id: rateStructureId,
        period_name: formData.period_name,
        start_time: formData.start_time,
        end_time: formData.end_time,
        days_of_week: formData.days_of_week,
        season: formData.season,
        energy_rate_per_kwh: formData.energy_rate_per_kwh,
        demand_charge_per_kw: formData.demand_charge_per_kw,
        priority: parseInt(formData.priority)
      };

      if (editingPeriod) {
        await updateRatePeriod(editingPeriod.id, periodData);
      } else {
        await createRatePeriod(periodData);
      }

      await loadPeriods();
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save period');
    }
  }

  function timeToPercent(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return ((hours * 60 + minutes) / 1440) * 100;
  }

  function getPeriodColor(periodName: string): string {
    for (const [key, color] of Object.entries(PERIOD_COLORS)) {
      if (periodName.includes(key)) return color;
    }
    return 'bg-purple-200 border-purple-400';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configure Hourly Rates</h2>
          <p className="text-gray-600 mt-1">{rateStructureName}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
        <Clock className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
        <div className="text-sm text-green-900 flex-1">
          <p className="font-semibold mb-2">Daily Hour-Based Pricing</p>
          <p className="mb-2">These time periods define rates that <span className="font-medium">apply to every calendar day</span> during the validity period of this rate structure.</p>
          <div className="bg-white border border-green-200 rounded p-3 mt-2">
            <p className="text-xs font-semibold text-green-800 mb-1">Example:</p>
            <p className="text-xs text-green-800">If you set Peak rate for 18:00-24:00, every charging session during those hours (on any date) will use the Peak rate.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddPeriod}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            <span>Add Period</span>
          </button>

          <div className="border-l border-gray-300 pl-3 flex items-center space-x-2">
            <Download size={18} className="text-gray-600" />
            <span className="text-sm text-gray-600 font-medium">Templates:</span>
            <button
              onClick={() => handleApplyTemplate('edcoTOU')}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Jordan EDCO TOU
            </button>
            <button
              onClick={() => handleApplyTemplate('flatRate')}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Flat Rate
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">24-Hour Daily Schedule</h3>
            <p className="text-sm text-gray-600 mt-1">This schedule repeats every day during the validity period</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar size={16} />
            <span>Applies to all dates</span>
          </div>
        </div>

        <div className="relative h-32 bg-gray-50 rounded-lg border border-gray-300">
          <div className="absolute inset-0 flex">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div key={hour} className="flex-1 border-r border-gray-200 last:border-r-0">
                <div className="text-xs text-gray-500 text-center mt-1">{hour}</div>
              </div>
            ))}
          </div>

          <div className="absolute inset-0 top-8">
            {periods
              .filter((p) => p.season === 'all' || p.season === 'summer')
              .map((period) => {
                const start = timeToPercent(period.start_time);
                const end = timeToPercent(period.end_time);
                const width = end - start;
                const color = getPeriodColor(period.period_name);

                return (
                  <div
                    key={period.id}
                    className={`absolute h-8 border-2 rounded ${color} flex items-center justify-center text-xs font-medium overflow-hidden`}
                    style={{
                      left: `${start}%`,
                      width: `${width}%`,
                      top: period.season === 'summer' ? '0px' : '40px'
                    }}
                    title={`${period.period_name} (${period.start_time}-${period.end_time})`}
                  >
                    <span className="truncate px-2">{period.period_name}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {periods.some((p) => p.season === 'winter') && (
          <div className="mt-4 relative h-12 bg-gray-50 rounded-lg border border-gray-300">
            <div className="absolute left-2 top-2 text-xs font-medium text-gray-600">Winter</div>
            <div className="absolute inset-0 top-6">
              {periods
                .filter((p) => p.season === 'winter')
                .map((period) => {
                  const start = timeToPercent(period.start_time);
                  const end = timeToPercent(period.end_time);
                  const width = end - start;
                  const color = getPeriodColor(period.period_name);

                  return (
                    <div
                      key={period.id}
                      className={`absolute h-6 border-2 rounded ${color} flex items-center justify-center text-xs font-medium`}
                      style={{ left: `${start}%`, width: `${width}%` }}
                    >
                      <span className="truncate px-2">{period.period_name}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Period Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Season</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Energy Rate</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Demand Charge</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {periods.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Clock className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-gray-900 font-medium mb-2">No Hourly Periods Configured</p>
                  <p className="text-sm text-gray-600 mb-4">Define time-of-day rates that will apply to every calendar day.</p>
                  <p className="text-xs text-gray-500">Click "Add Period" above or use a pre-configured template to get started.</p>
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr key={period.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{period.period_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {period.start_time.substring(0, 5)} - {period.end_time.substring(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {period.days_of_week.length === 7 ? 'All Days' : `${period.days_of_week.length} days`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{period.season}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{formatJOD(Number(period.energy_rate_per_kwh))}/kWh</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{formatJOD(Number(period.demand_charge_per_kw))}/kW</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEditPeriod(period)}
                      className="text-blue-600 hover:text-blue-700 p-1"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeletePeriod(period.id, period.period_name)}
                      className="text-red-600 hover:text-red-700 p-1 ml-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {editingPeriod ? 'Edit Period' : 'Add Period'}
              </h3>

              <form onSubmit={handleSubmitPeriod} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-900">
                    <span className="font-semibold">Note:</span> This time period will apply to every calendar day during your rate structure's validity period.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Period Name</label>
                  <input
                    type="text"
                    value={formData.period_name}
                    onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg ${errors.period_name ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="e.g., Peak, Off-Peak, Mid-Peak"
                  />
                  {errors.period_name && <p className="text-red-600 text-sm mt-1">{errors.period_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Range <span className="text-xs text-gray-500">(applies daily)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg ${errors.start_time ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <p className="text-xs text-gray-500 mt-1">Start time</p>
                    </div>
                    <div>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg ${errors.end_time ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <p className="text-xs text-gray-500 mt-1">End time</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.days_of_week.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, days_of_week: [...formData.days_of_week, day] });
                            } else {
                              setFormData({
                                ...formData,
                                days_of_week: formData.days_of_week.filter((d) => d !== day)
                              });
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm capitalize">{day.substring(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                  {errors.days_of_week && <p className="text-red-600 text-sm mt-1">{errors.days_of_week}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
                  <select
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {SEASONS.map((season) => (
                      <option key={season} value={season}>
                        {season.charAt(0).toUpperCase() + season.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Energy Rate (JOD/kWh)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.energy_rate_per_kwh}
                      onChange={(e) => setFormData({ ...formData, energy_rate_per_kwh: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg ${errors.energy_rate_per_kwh ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.energy_rate_per_kwh && <p className="text-red-600 text-sm mt-1">{errors.energy_rate_per_kwh}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Demand Charge (JOD/kW)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.demand_charge_per_kw}
                      onChange={(e) => setFormData({ ...formData, demand_charge_per_kw: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg ${errors.demand_charge_per_kw ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingPeriod ? 'Update' : 'Add'} Period
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}
