import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange, getDateRangePreset } from '../lib/analyticsService';

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onChange: (dateRange: DateRange) => void;
}

function getPresetFromRange(dateRange: DateRange): string {
  const start = dateRange.startDate.getTime();
  const end = dateRange.endDate.getTime();
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = new Date().setHours(23, 59, 59, 999);
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayEnd - 86400000;
  const last7Start = todayStart - 6 * 86400000;
  const last30Start = todayStart - 29 * 86400000;
  if (start >= todayStart && end >= todayEnd) return 'today';
  if (start >= yesterdayStart && end <= yesterdayEnd) return 'yesterday';
  if (start >= last7Start && end >= todayEnd) return 'last7days';
  if (start >= last30Start && end >= todayEnd) return 'last30days';
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  if (start >= thisMonthStart && end >= todayEnd) return 'thisMonth';
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59).getTime();
  if (start >= lastMonthStart && end <= lastMonthEnd) return 'lastMonth';
  return 'custom';
}

export default function DateRangeSelector({ dateRange, onChange }: DateRangeSelectorProps) {
  const [preset, setPreset] = useState(() => getPresetFromRange(dateRange));
  const [showCustom, setShowCustom] = useState(() => getPresetFromRange(dateRange) === 'custom');

  useEffect(() => {
    const next = getPresetFromRange(dateRange);
    setPreset(next);
    setShowCustom(next === 'custom');
  }, [dateRange.startDate.getTime(), dateRange.endDate.getTime()]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      const range = getDateRangePreset(value);
      onChange(range);
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (!value) return;

    const date = new Date(value);
    if (isNaN(date.getTime())) return;

    if (type === 'start') {
      onChange({ startDate: date, endDate: dateRange.endDate });
    } else {
      onChange({ startDate: dateRange.startDate, endDate: date });
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Calendar className="text-gray-500" size={20} />
        <label className="text-sm font-medium text-gray-700">Date Range:</label>
      </div>

      <select
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      >
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7days">Last 7 Days</option>
        <option value="last30days">Last 30 Days</option>
        <option value="thisMonth">This Month</option>
        <option value="lastMonth">Last Month</option>
        <option value="custom">Custom Range</option>
      </select>

      {showCustom && (
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={format(dateRange.startDate, 'yyyy-MM-dd')}
            onChange={(e) => handleCustomDateChange('start', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={format(dateRange.endDate, 'yyyy-MM-dd')}
            onChange={(e) => handleCustomDateChange('end', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      )}
    </div>
  );
}
