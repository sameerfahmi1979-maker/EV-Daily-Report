import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange, getDateRangePreset } from '../lib/analyticsService';

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onChange: (dateRange: DateRange) => void;
}

export default function DateRangeSelector({ dateRange, onChange }: DateRangeSelectorProps) {
  const [preset, setPreset] = useState('last30days');
  const [showCustom, setShowCustom] = useState(false);

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
