import { useState, useEffect } from 'react';
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
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = new Date().setHours(23, 59, 59, 999);
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayEnd - 86400000;
  const last7Start = todayStart - 6 * 86400000;
  const last30Start = todayStart - 29 * 86400000;
  if (Math.abs(start - todayStart) < 60000 && end >= todayEnd) return 'today';
  if (Math.abs(start - yesterdayStart) < 60000 && Math.abs(end - yesterdayEnd) < 60000) return 'yesterday';
  if (Math.abs(start - last7Start) < 60000 && end >= todayEnd) return 'last7days';
  if (Math.abs(start - last30Start) < 60000 && end >= todayEnd) return 'last30days';
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  if (Math.abs(start - thisMonthStart) < 60000 && end >= todayEnd) return 'thisMonth';
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59).getTime();
  if (Math.abs(start - lastMonthStart) < 60000 && Math.abs(end - lastMonthEnd) < 60000) return 'lastMonth';
  return 'custom';
}

export default function DateRangeSelector({ dateRange, onChange }: DateRangeSelectorProps) {
  const [preset, setPreset] = useState(() => getPresetFromRange(dateRange));
  const [showCustom, setShowCustom] = useState(() => getPresetFromRange(dateRange) === 'custom');
  // Hold custom dates locally so typing doesn't trigger reload on every keystroke
  const [customStart, setCustomStart] = useState(format(dateRange.startDate, 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(dateRange.endDate, 'yyyy-MM-dd'));

  useEffect(() => {
    const next = getPresetFromRange(dateRange);
    setPreset(next);
    setShowCustom(next === 'custom');
    setCustomStart(format(dateRange.startDate, 'yyyy-MM-dd'));
    setCustomEnd(format(dateRange.endDate, 'yyyy-MM-dd'));
  }, [dateRange.startDate.getTime(), dateRange.endDate.getTime()]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value === 'custom') {
      setShowCustom(true);
      // Don't fire onChange — keep current range until user picks dates
    } else {
      setShowCustom(false);
      setHasUnapplied(false);
      const range = getDateRangePreset(value);
      onChange(range);
    }
  };

  const applyCustomRange = () => {
    const s = new Date(customStart + 'T00:00:00');
    const e = new Date(customEnd + 'T23:59:59');
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    if (s > e) return;
    onChange({ startDate: s, endDate: e });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="text-[#8888a0]" size={16} />
        <label className="text-xs font-medium text-[#c0c0d0]">Date Range:</label>
      </div>

      <select
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="px-3 py-1.5 bg-[#1a1a2e] border border-[#3a3a4e] text-[#e0e0e8] rounded-lg text-xs focus:ring-2 focus:ring-[#4A90D9] focus:border-transparent"
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
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1.5 bg-[#1a1a2e] border border-[#3a3a4e] text-[#e0e0e8] rounded-lg text-xs focus:ring-2 focus:ring-[#4A90D9]"
          />
          <span className="text-[#8888a0] text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1.5 bg-[#1a1a2e] border border-[#3a3a4e] text-[#e0e0e8] rounded-lg text-xs focus:ring-2 focus:ring-[#4A90D9]"
          />
          <button
            onClick={applyCustomRange}
            className="px-3 py-1.5 bg-[#4A90D9] text-white rounded-lg text-xs font-medium hover:bg-[#3A80C9]"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
