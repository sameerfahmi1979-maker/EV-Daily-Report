import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  DollarSign,
  Activity,
  MapPin,
  Leaf,
  Calculator,
  Database,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { DateRange, getDateRangePreset, getSummaryMetrics, getCO2ImpactMetrics, getEnergyTrend, getRevenueByStation, getConnectorTypeComparison, getBestTimeToCharge, getDailyTransactionsByConnector, getRecentActivity } from '../lib/analyticsService';
import { countPendingSessions, formatJOD } from '../lib/billingService';
import { supabase } from '../lib/supabase';
import { subDays } from 'date-fns';
import DateRangeSelector from './DateRangeSelector';
import CO2ImpactCard from './CO2ImpactCard';
import EnergyTrendChart from './EnergyTrendChart';
import RevenueChart from './RevenueChart';
import ConnectorTypeChart from './ConnectorTypeChart';
import BestTimeToChargeChart from './BestTimeToChargeChart';
import DailyTransactionsChart from './DailyTransactionsChart';
import { EnergyGroupBy } from '../lib/analyticsService';
import { format } from 'date-fns';

async function fetchHeatmapData(): Promise<{ day: number; hour: number; count: number }[]> {
  const end = new Date();
  const start = subDays(end, 30);
  const { data, error } = await supabase
    .from('charging_sessions')
    .select('start_ts')
    .gte('start_ts', start.toISOString())
    .lte('start_ts', end.toISOString())
    .not('start_ts', 'is', null);
  if (error || !data || data.length === 0) return [];
  const grid: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  data.forEach((row: { start_ts: string }) => {
    const d = new Date(row.start_ts);
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour] += 1;
  });
  const result: { day: number; hour: number; count: number }[] = [];
  for (let day = 0; day < 7; day++) for (let hour = 0; hour < 24; hour++) result.push({ day, hour, count: grid[day][hour] });
  return result;
}

function HeatmapGrid({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const getCell = (day: number, hour: number) => data.find(d => d.day === day && d.hour === hour)?.count ?? 0;
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No session data for last 30 days</div>;
  }
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-0">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '40px repeat(24, minmax(12px, 1fr))', gridTemplateRows: 'repeat(8, 24px)' }}>
          <div className="text-xs text-gray-500 font-medium flex items-center" />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-gray-500 flex items-center justify-center" title={`${h}:00`}>{h}</div>
          ))}
          {dayNames.map((name, day) => (
            <React.Fragment key={day}>
              <div className="text-xs text-gray-600 flex items-center pr-1">{name}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = getCell(day, hour);
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const intensity = pct === 0 ? 0 : Math.max(20, 20 + (pct / 100) * 80);
                return (
                  <div
                    key={hour}
                    className="rounded-sm border border-gray-100 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: `rgba(34, 197, 94, ${intensity / 100})` }}
                    title={`${name} ${hour}:00 – ${count} session(s)`}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0, 25, 50, 75, 100].map((p) => (
              <div key={p} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(34, 197, 94, ${p / 100})` }} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

const WORLD_CITIES: { name: string; timeZone: string }[] = [
  { name: 'Amman', timeZone: 'Asia/Amman' },
  { name: 'Dubai', timeZone: 'Asia/Dubai' },
  { name: 'Riyadh', timeZone: 'Asia/Riyadh' },
  { name: 'London', timeZone: 'Europe/London' },
  { name: 'New York', timeZone: 'America/New_York' },
];

function WorldClockDigital() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">World time</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Current time in key locations</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {WORLD_CITIES.map(({ name, timeZone }) => (
          <div key={timeZone} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{name}</p>
            <p className="text-lg font-bold text-gray-900 mt-1 font-mono">
              {now.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {now.toLocaleDateString('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HomeDashboardProps {
  onNavigate: (view: string) => void;
  hasData: boolean;
  loading: boolean;
  onSeedData: () => Promise<void>;
  seeding: boolean;
  seedMessage: { type: 'success' | 'error'; text: string } | null;
}

export default function HomeDashboard({
  onNavigate,
  hasData,
  loading: initialLoading,
  onSeedData,
  seeding,
  seedMessage,
}: HomeDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangePreset('last30days'));
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    totalEnergy: 0,
    totalRevenue: 0,
    totalSessions: 0,
    activeStations: 0,
  });
  const [co2, setCo2] = useState({
    totalCO2Reduction: 0,
    treesEquivalent: 0,
    kmDrivenEquivalent: 0,
    energyUsed: 0,
  });
  const [pendingBilling, setPendingBilling] = useState(0);
  const [energyData, setEnergyData] = useState<{ date: string; energy: number; sessions: number }[]>([]);
  const [energyGroupBy, setEnergyGroupBy] = useState<EnergyGroupBy>('month');
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [connectorData, setConnectorData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [dailyTransactions, setDailyTransactions] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<{ day: number; hour: number; count: number }[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const [summary, co2Metrics, pending, energyTrend, revenue, connectors, hourly, daily, activity] = await Promise.all([
        getSummaryMetrics(dateRange),
        getCO2ImpactMetrics(dateRange),
        countPendingSessions(),
        getEnergyTrend(dateRange),
        getRevenueByStation(dateRange),
        getConnectorTypeComparison(dateRange),
        getBestTimeToCharge(dateRange),
        getDailyTransactionsByConnector(dateRange),
        getRecentActivity(dateRange, 10),
      ]);
      setMetrics(summary);
      setCo2(co2Metrics);
      setPendingBilling(pending);
      setEnergyData(energyTrend.data);
      setEnergyGroupBy(energyTrend.groupBy);
      setRevenueData(revenue);
      setConnectorData(connectors);
      setHourlyData(hourly);
      setDailyTransactions(daily);
      setRecentActivity(activity);
      const heatmap = await fetchHeatmapData();
      setHeatmapData(heatmap);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setDashboardLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { exportToCSV } = await import('../lib/analyticsService');
      const data = [
        { metric: 'Sessions', value: metrics.totalSessions },
        { metric: 'Energy (kWh)', value: metrics.totalEnergy.toFixed(2) },
        { metric: 'Revenue (JOD)', value: formatJOD(metrics.totalRevenue) },
        { metric: 'Active Stations', value: metrics.activeStations },
        { metric: 'CO2 Saved (kg)', value: co2.totalCO2Reduction.toFixed(1) },
        { metric: 'Pending Billing', value: pendingBilling },
      ];
      exportToCSV(data, `dashboard-summary-${format(dateRange.startDate, 'yyyy-MM-dd')}-to-${format(dateRange.endDate, 'yyyy-MM-dd')}.csv`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const loading = initialLoading || dashboardLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Overview of charging operations and performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export summary
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <DateRangeSelector dateRange={dateRange} onChange={setDateRange} />
      </div>

      {/* Empty state / Sample data (Phase 1) */}
      {!initialLoading && !hasData && (
        <div className="p-6 bg-green-50 border-2 border-green-200 rounded-xl">
          <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Sample Data Available
          </h4>
          <p className="text-sm text-green-800 mb-4">
            Load sample stations, Jordan TOU rates, and fixed charges to test the system
          </p>
          {seedMessage && (
            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${seedMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {seedMessage.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="text-sm">{seedMessage.text}</span>
            </div>
          )}
          <button
            onClick={onSeedData}
            disabled={seeding}
            className="w-full sm:w-auto bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {seeding ? <><Loader2 className="w-5 h-5 animate-spin" /> Loading Sample Data...</> : <><Database className="w-5 h-5" /> Load Sample Data</>}
          </button>
          <p className="text-xs text-green-700 mt-3">Creates: 3 stations, Jordan EDCO TOU rate structure, 2 fixed charges</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI strip (Phase 1) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sessions</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics.totalSessions}</p>
                </div>
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Energy</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics.totalEnergy.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">kWh</p>
                </div>
                <div className="p-2.5 bg-cyan-100 rounded-xl">
                  <Zap className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatJOD(metrics.totalRevenue)}</p>
                </div>
                <div className="p-2.5 bg-green-100 rounded-xl">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active stations</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics.activeStations}</p>
                </div>
                <div className="p-2.5 bg-slate-100 rounded-xl">
                  <MapPin className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">CO₂ saved</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{co2.totalCO2Reduction.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">kg</p>
                </div>
                <div className="p-2.5 bg-teal-100 rounded-xl">
                  <Leaf className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending billing</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{pendingBilling}</p>
                </div>
                <div className="p-2.5 bg-amber-100 rounded-xl">
                  <Calculator className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Phase 2: World clock */}
          <WorldClockDigital />

          {/* Phase 2: Income + Environment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Revenue summary</h3>
              </div>
              <p className="text-blue-100 text-sm mb-4">Income for selected period</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-blue-100 text-xs font-medium mb-1">Total revenue</p>
                  <p className="text-2xl font-bold">{formatJOD(metrics.totalRevenue)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-blue-100 text-xs font-medium mb-1">Sessions</p>
                  <p className="text-2xl font-bold">{metrics.totalSessions}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-blue-100 text-xs font-medium mb-1">Avg per session</p>
                  <p className="text-2xl font-bold">
                    {metrics.totalSessions > 0 ? formatJOD(metrics.totalRevenue / metrics.totalSessions) : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <CO2ImpactCard
                totalCO2Reduction={co2.totalCO2Reduction}
                treesEquivalent={co2.treesEquivalent}
                kmDrivenEquivalent={co2.kmDrivenEquivalent}
                energyUsed={co2.energyUsed}
              />
            </div>
          </div>

          {/* Phase 3: Hero chart */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Energy trend</h3>
            <p className="text-sm text-gray-500 mb-4">Energy consumption over selected period</p>
            <EnergyTrendChart data={energyData} groupBy={energyGroupBy} />
          </div>

          {/* Phase 3: Revenue by station + Connector mix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue by station</h3>
              <p className="text-sm text-gray-500 mb-4">Top stations by revenue</p>
              <RevenueChart data={revenueData} />
            </div>
            <div>
              <ConnectorTypeChart data={connectorData} />
            </div>
          </div>

          {/* Phase 3: Best time to charge + Daily transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <BestTimeToChargeChart data={hourlyData} />
            </div>
            <div>
              <DailyTransactionsChart data={dailyTransactions} />
            </div>
          </div>

          {/* Phase 4: Activity heatmap */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity heatmap</h3>
            <p className="text-sm text-gray-500 mb-4">Sessions by day of week and hour (last 30 days)</p>
            <HeatmapGrid data={heatmapData} />
          </div>

          {/* Phase 4: Alerts / Quick actions */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingBilling > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <Calculator className="w-8 h-8 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{pendingBilling} session(s) pending billing</p>
                    <p className="text-sm text-gray-500">Go to Billing to calculate</p>
                  </div>
                  <button onClick={() => onNavigate('billing')} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
                    Open Billing
                  </button>
                </div>
              )}
              {metrics.totalSessions === 0 && !loading && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <AlertTriangle className="w-8 h-8 text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">No data in selected period</p>
                    <p className="text-sm text-gray-500">Change date range or load sample data</p>
                  </div>
                </div>
              )}
              {pendingBilling === 0 && metrics.totalSessions > 0 && (
                <p className="text-gray-500 col-span-full sm:col-span-3">No pending actions. All clear.</p>
              )}
            </div>
          </div>

          {/* Phase 4: Recent activity table */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent activity</h3>
              <button onClick={() => onNavigate('billing')} className="text-sm font-medium text-blue-600 hover:text-blue-700">View all →</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Energy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentActivity.map((row: any) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.transactionId || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.station || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.energy != null ? `${Number(row.energy).toFixed(2)} kWh` : '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.cost != null ? formatJOD(row.cost) : '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.startTime ? new Date(row.startTime).toLocaleString() : '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${row.hasBilling ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {row.hasBilling ? 'Calculated' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentActivity.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">No recent activity in selected period</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
