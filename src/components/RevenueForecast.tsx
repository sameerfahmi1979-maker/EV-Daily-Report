import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Loader2, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Area, ComposedChart, Line,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { getStations } from '../lib/stationService';
import { formatJOD } from '../lib/billingService';
import { subDays, format, addDays } from 'date-fns';

interface DayData {
  date: string;
  revenue: number;
}

function simpleMovingAverage(data: number[], window: number): number {
  if (data.length === 0) return 0;
  const slice = data.slice(-window);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

export default function RevenueForecast() {
  const [daily, setDaily] = useState<DayData[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [stationFilter, setStationFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState(7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s] = await Promise.all([getStations()]);
      setStations(s);

      // Fetch last 90 days of daily revenue
      const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      let q = supabase
        .from('charging_sessions')
        .select('start_date, calculated_cost')
        .gte('start_date', from)
        .order('start_date');
      if (stationFilter) q = q.eq('station_id', stationFilter);
      const { data, error } = await q;
      if (error) throw error;

      // Aggregate by day
      const dayMap: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const d = r.start_date;
        dayMap[d] = (dayMap[d] || 0) + Number(r.calculated_cost || 0);
      });

      const sorted = Object.entries(dayMap)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDaily(sorted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [stationFilter]);

  useEffect(() => { load(); }, [load]);

  // Generate forecast
  const revenues = daily.map(d => d.revenue);
  const sma30 = simpleMovingAverage(revenues, 30);
  const sma7 = simpleMovingAverage(revenues, 7);

  // Min/max for confidence band
  const recent30 = revenues.slice(-30);
  const stdDev = recent30.length > 1
    ? Math.sqrt(recent30.reduce((s, v) => s + (v - sma30) ** 2, 0) / recent30.length)
    : sma30 * 0.15;

  const lastDate = daily.length > 0 ? daily[daily.length - 1].date : format(new Date(), 'yyyy-MM-dd');

  const forecastData = [];
  for (let i = 1; i <= forecastDays; i++) {
    const d = format(addDays(new Date(lastDate), i), 'yyyy-MM-dd');
    const predicted = forecastDays <= 7 ? sma7 : sma30;
    forecastData.push({
      date: d,
      forecast: Math.max(0, predicted),
      upper: Math.max(0, predicted + stdDev),
      lower: Math.max(0, predicted - stdDev),
    });
  }

  // Combine for chart
  const chartData = [
    ...daily.slice(-30).map(d => ({
      date: d.date.slice(5), // MM-DD
      actual: d.revenue,
      forecast: null as number | null,
      upper: null as number | null,
      lower: null as number | null,
    })),
    ...forecastData.map(d => ({
      date: d.date.slice(5),
      actual: null as number | null,
      forecast: d.forecast,
      upper: d.upper,
      lower: d.lower,
    })),
  ];

  const totalForecast = forecastData.reduce((s, d) => s + d.forecast, 0);
  const avgDailyActual = revenues.length > 0 ? revenues.reduce((s, v) => s + v, 0) / revenues.length : 0;
  const forecastChange = avgDailyActual > 0 ? ((sma7 - avgDailyActual) / avgDailyActual) * 100 : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Revenue Forecast</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Projected revenue based on historical trends</p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Forecast Period</label>
          <select value={forecastDays} onChange={e => setForecastDays(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200">
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm h-[38px] dark:text-gray-200">
          <option value="">All Stations</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Daily (90d)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatJOD(avgDailyActual)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">7-Day SMA</p>
          <p className="text-xl font-bold text-blue-600">{formatJOD(sma7)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Projected ({forecastDays}d Total)</p>
          <p className="text-xl font-bold text-emerald-600">{formatJOD(totalForecast)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Trend</p>
          <p className={`text-xl font-bold flex items-center gap-1 ${forecastChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {forecastChange >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            {Math.abs(forecastChange).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" />
          Actual vs Forecast
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => formatJOD(Number(v))} />
            {/* Confidence band */}
            <Area dataKey="upper" stroke="none" fill="#3b82f6" fillOpacity={0.08} name="Upper Bound" />
            <Area dataKey="lower" stroke="none" fill="white" fillOpacity={0.9} name="Lower Bound" />
            {/* Actual line */}
            <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual Revenue" />
            {/* Forecast line (dashed) */}
            <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Forecast" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Actual
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-blue-500 inline-block" style={{ borderTop: '2px dashed #3b82f6' }} /> Forecast
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-2 bg-blue-500/10 inline-block rounded" /> Confidence
          </span>
        </div>
      </div>
    </div>
  );
}
