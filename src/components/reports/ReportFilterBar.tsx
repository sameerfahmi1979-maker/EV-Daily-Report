import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, X } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../../lib/supabase';

interface Station {
  id: string;
  name: string;
}

interface Operator {
  id: string;
  name: string;
  card_number: string;
}

export interface FilterConfig {
  showSearch?: boolean;
  showStation?: boolean;
  showOperator?: boolean;
  showShiftType?: boolean;
  showHandoverStatus?: boolean;
  showTimeRange?: boolean;
  showQuickDates?: boolean;
  showGranularity?: boolean;
  showStatus?: boolean;
  operatorRequired?: boolean;
  singleDate?: boolean;
}

export interface FilterValues {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  stationId: string;
  operatorId: string;
  cardNumber: string;
  search: string;
  shiftType: string;
  handoverStatus: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  status: string;
  stationName?: string;
  operatorName?: string;
}

const defaultFilters: FilterValues = {
  startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  startTime: '',
  endTime: '',
  stationId: '',
  operatorId: '',
  cardNumber: '',
  search: '',
  shiftType: 'all',
  handoverStatus: 'all',
  granularity: 'daily',
  status: 'all',
};

interface ReportFilterBarProps {
  config: FilterConfig;
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  onApply: () => void;
  loading?: boolean;
}

const quickDateOptions = [
  { label: 'Today', fn: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Yesterday', fn: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { label: 'Last 7 Days', fn: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'This Week', fn: () => ({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }) },
  { label: 'This Month', fn: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: 'Last 30 Days', fn: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
];

export { defaultFilters };

export default function ReportFilterBar({ config, filters, onChange, onApply, loading }: ReportFilterBarProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);

  useEffect(() => {
    if (config.showStation) {
      supabase.from('stations').select('id, name').order('name').then(({ data }) => {
        setStations(data || []);
      });
    }
    if (config.showOperator) {
      supabase.from('operators').select('id, name, card_number').order('name').then(({ data }) => {
        setOperators(data || []);
      });
    }
  }, [config.showStation, config.showOperator]);

  const update = (partial: Partial<FilterValues>) => {
    onChange({ ...filters, ...partial });
  };

  const handleQuickDate = (opt: typeof quickDateOptions[0]) => {
    const { start, end } = opt.fn();
    update({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    });
  };

  const handleOperatorChange = (opId: string) => {
    const op = operators.find((o) => o.id === opId);
    update({
      operatorId: opId,
      cardNumber: op?.card_number || '',
      operatorName: op?.name || '',
    });
  };

  const handleStationChange = (sid: string) => {
    const st = stations.find((s) => s.id === sid);
    update({
      stationId: sid,
      stationName: st?.name || '',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      {/* Quick date buttons */}
      {config.showQuickDates && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickDateOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleQuickDate(opt)}
              className="px-3 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {config.singleDate ? 'Date' : 'Start Date'}
          </label>
          <div className="relative">
            <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => update({
                startDate: e.target.value,
                ...(config.singleDate ? { endDate: e.target.value } : {}),
              })}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {!config.singleDate && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => update({ endDate: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Time range */}
        {config.showTimeRange && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Start Time</label>
              <div className="relative">
                <Clock className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={filters.startTime}
                  onChange={(e) => update({ startTime: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">End Time</label>
              <div className="relative">
                <Clock className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={filters.endTime}
                  onChange={(e) => update({ endTime: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </>
        )}

        {/* Station */}
        {config.showStation && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Station</label>
            <select
              value={filters.stationId}
              onChange={(e) => handleStationChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Operator */}
        {config.showOperator && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Operator {config.operatorRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              value={filters.operatorId}
              onChange={(e) => handleOperatorChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Operators</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.card_number})</option>
              ))}
            </select>
          </div>
        )}

        {/* Shift type */}
        {config.showShiftType && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Shift Type</label>
            <select
              value={filters.shiftType}
              onChange={(e) => update({ shiftType: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
            </select>
          </div>
        )}

        {/* Handover status */}
        {config.showHandoverStatus && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Handover Status</label>
            <select
              value={filters.handoverStatus}
              onChange={(e) => update({ handoverStatus: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="handed_over">Handed Over</option>
              <option value="deposited">Deposited</option>
            </select>
          </div>
        )}

        {/* Granularity */}
        {config.showGranularity && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Granularity</label>
            <select
              value={filters.granularity}
              onChange={(e) => update({ granularity: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}

        {/* Status */}
        {config.showStatus && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
            <select
              value={filters.status}
              onChange={(e) => update({ status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        )}

        {/* Search */}
        {config.showSearch && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="Search..."
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {filters.search && (
                <button onClick={() => update({ search: '' })} className="absolute right-2 top-2.5">
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Apply button */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={onApply}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
      </div>
    </div>
  );
}
