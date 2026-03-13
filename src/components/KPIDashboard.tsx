import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Zap, DollarSign, Clock,
  BarChart2, Sun, Loader2, ArrowUp, ArrowDown,
} from 'lucide-react';
import { getKPIs, KPIData } from '../lib/kpiService';
import { getStations } from '../lib/stationService';
import { formatJOD } from '../lib/billingService';
import { subDays, format } from 'date-fns';

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
         : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function GaugeChart({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 40, cx = 50, cy = 55;
  const circumference = Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="70" viewBox="0 0 100 70">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700" />
        <text x={cx} y={cy - 8} textAnchor="middle" className="text-lg font-bold" fill="currentColor" fontSize="16">
          {pct.toFixed(1)}%
        </text>
      </svg>
      <span className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{label}</span>
    </div>
  );
}

export default function KPIDashboard() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, s] = await Promise.all([
        getKPIs(startDate, endDate, stationFilter || undefined),
        getStations(),
      ]);
      setKpis(k);
      setStations(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [startDate, endDate, stationFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading || !kpis) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  const cards = [
    { label: 'Avg Session Duration', value: `${kpis.avgSessionDuration.toFixed(0)} min`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
    { label: 'Revenue / Charger', value: formatJOD(kpis.revenuePerCharger), icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Revenue / kWh', value: formatJOD(kpis.revenuePerKwh), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Avg kWh / Session', value: `${kpis.avgKwhPerSession.toFixed(1)}`, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Sessions / Day', value: kpis.sessionsPerDay.toFixed(1), icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: 'Peak Hour %', value: `${kpis.peakHourPercent.toFixed(0)}%`, icon: Sun, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">KPI Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Industry-standard performance indicators</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm h-[38px] dark:text-gray-200">
          <option value="">All Stations</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Gauge Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center">
          <GaugeChart value={kpis.utilizationRate} label="Utilization Rate" color="#3b82f6" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center">
          <GaugeChart value={kpis.stationUptime} label="Station Uptime" color="#10b981" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-emerald-600">{formatJOD(kpis.totalRevenue)}</p>
          <DeltaBadge value={kpis.revenueDelta} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Energy</p>
          <p className="text-xl font-bold text-blue-600">{kpis.totalEnergy.toFixed(1)} kWh</p>
          <DeltaBadge value={kpis.energyDelta} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon size={16} className={c.color} />
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
