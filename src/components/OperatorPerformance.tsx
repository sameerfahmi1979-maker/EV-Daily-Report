import { useState, useEffect, useCallback } from 'react';
import {
  Users, Zap, DollarSign, Clock, TrendingUp,
  Loader2, Trophy, Medal, Award,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { getOperatorPerformance, getOperatorTrend, OperatorMetric, OperatorTrend } from '../lib/operatorAnalyticsService';
import { getStations } from '../lib/stationService';
import { formatJOD } from '../lib/billingService';
import { subDays, format } from 'date-fns';

export default function OperatorPerformance() {
  const [metrics, setMetrics] = useState<OperatorMetric[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<OperatorTrend[]>([]);
  const [sortBy, setSortBy] = useState<'revenue' | 'kwh' | 'shifts'>('revenue');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        getOperatorPerformance(startDate, endDate, stationFilter || undefined),
        getStations(),
      ]);
      setMetrics(m);
      setStations(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, stationFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selectedOp) {
      getOperatorTrend(selectedOp, startDate, endDate).then(setTrendData).catch(console.error);
    }
  }, [selectedOp, startDate, endDate]);

  const totalKwh = metrics.reduce((s, m) => s + m.total_kwh, 0);
  const totalRev = metrics.reduce((s, m) => s + m.total_revenue, 0);
  const totalShifts = metrics.reduce((s, m) => s + m.total_shifts, 0);

  const sorted = [...metrics].sort((a, b) => {
    if (sortBy === 'kwh') return b.total_kwh - a.total_kwh;
    if (sortBy === 'shifts') return b.total_shifts - a.total_shifts;
    return b.total_revenue - a.total_revenue;
  });

  const RANK_ICONS = [Trophy, Medal, Award];
  const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

  // Chart data — top 10 operators
  const chartData = sorted.slice(0, 10).map(m => ({
    name: m.operator_name.length > 12 ? m.operator_name.slice(0, 12) + '…' : m.operator_name,
    kwh: Math.round(m.total_kwh * 100) / 100,
    revenue: Math.round(m.total_revenue * 100) / 100,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Operator Performance</h2>
        <p className="text-gray-600 mt-1">Productivity rankings and trends per operator</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm h-[38px]">
          <option value="">All Stations</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Operators', value: metrics.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Total Shifts', value: totalShifts, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Total Energy', value: `${totalKwh.toFixed(1)} kWh`, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Revenue', value: formatJOD(totalRev), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon size={16} className={kpi.color} />
                  </div>
                </div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Bar Chart — Top 10 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Top 10 Operators</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="kwh" name="Energy (kWh)" fill="#10b981" radius={[4,4,0,0]} />
                <Bar yAxisId="right" dataKey="revenue" name="Revenue (JOD)" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranking Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Ranking</h3>
              <div className="flex gap-1">
                {(['revenue', 'kwh', 'shifts'] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      sortBy === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s === 'revenue' ? 'Revenue' : s === 'kwh' ? 'Energy' : 'Shifts'}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {sorted.map((op, i) => {
                const RankIcon = RANK_ICONS[i] || null;
                const rankColor = RANK_COLORS[i] || 'text-gray-400';
                return (
                  <div key={op.operator_id}
                    onClick={() => setSelectedOp(selectedOp === op.operator_id ? null : op.operator_id)}
                    className={`px-5 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedOp === op.operator_id ? 'bg-blue-50' : ''
                    }`}>
                    <div className="w-8 text-center">
                      {RankIcon ? <RankIcon size={18} className={rankColor} /> : (
                        <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{op.operator_name}</p>
                      <p className="text-xs text-gray-400">{op.card_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatJOD(op.total_revenue)}</p>
                      <p className="text-xs text-gray-500">{op.total_kwh.toFixed(1)} kWh · {op.total_shifts} shifts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend Chart (when an operator is selected) */}
          {selectedOp && trendData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                Trend: {metrics.find(m => m.operator_id === selectedOp)?.operator_name}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="kwh" name="kWh" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" name="JOD" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
