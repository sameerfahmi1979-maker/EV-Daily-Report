import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, DollarSign, Activity, MapPin, Leaf, Calculator, Database,
  Loader2, CheckCircle, AlertCircle, RefreshCw, Download, Clock,
  AlertTriangle, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  DateRange, getDateRangePreset, getSummaryMetrics, getEnergyTrend,
  getRevenueByStation, getConnectorTypeComparison, getBestTimeToCharge,
  getDailyTransactionsByConnector, getRecentActivity, EnergyGroupBy,
} from '../lib/analyticsService';
import { countPendingSessions, formatJOD } from '../lib/billingService';
import { calculateEnvironmentalImpact, EnvironmentalImpact } from '../lib/environmentalImpactService';
import { supabase } from '../lib/supabase';
import { subDays, format } from 'date-fns';
import DateRangeSelector from './DateRangeSelector';
import EnergyTrendChart from './EnergyTrendChart';
import RevenueChart from './RevenueChart';
import ConnectorTypeChart from './ConnectorTypeChart';
import BestTimeToChargeChart from './BestTimeToChargeChart';
import DailyTransactionsChart from './DailyTransactionsChart';
import PowerBITile from './PowerBITile';
import SparklineChart from './SparklineChart';
import EnvironmentalImpactPanel from './EnvironmentalImpactPanel';

// ── Heatmap ──────────────────────────────────
async function fetchHeatmapData() {
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
    grid[d.getDay()][d.getHours()] += 1;
  });
  const result: { day: number; hour: number; count: number }[] = [];
  for (let day = 0; day < 7; day++)
    for (let hour = 0; hour < 24; hour++)
      result.push({ day, hour, count: grid[day][hour] });
  return result;
}

function HeatmapGrid({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const getCell = (day: number, hour: number) => data.find(d => d.day === day && d.hour === hour)?.count ?? 0;
  if (data.length === 0) return <div className="h-40 flex items-center justify-center text-[#8888a0] text-sm">No data</div>;
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-0">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '36px repeat(24, minmax(10px, 1fr))', gridTemplateRows: 'repeat(8, 20px)' }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[8px] text-[#8888a0] flex items-center justify-center">{h}</div>
          ))}
          {dayNames.map((name, day) => (
            <React.Fragment key={day}>
              <div className="text-[10px] text-[#8888a0] flex items-center pr-1">{name}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = getCell(day, hour);
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const intensity = pct === 0 ? 0 : Math.max(20, 20 + (pct / 100) * 80);
                return (
                  <div key={hour} className="rounded-sm"
                    style={{ backgroundColor: `rgba(74, 144, 217, ${intensity / 100})` }}
                    title={`${name} ${hour}:00 – ${count} session(s)`} />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1 text-[9px] text-[#8888a0]">
          <span>Less</span>
          {[0, 25, 50, 75, 100].map(p => (
            <div key={p} className="w-3 h-2 rounded-sm" style={{ backgroundColor: `rgba(74, 144, 217, ${p / 100})` }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

// ── World Clock ──────────────────────────────
const WORLD_CITIES = [
  { name: 'Amman', timeZone: 'Asia/Amman' },
  { name: 'Dubai', timeZone: 'Asia/Dubai' },
  { name: 'Riyadh', timeZone: 'Asia/Riyadh' },
  { name: 'London', timeZone: 'Europe/London' },
  { name: 'New York', timeZone: 'America/New_York' },
];
function WorldClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="grid grid-cols-5 gap-2">
      {WORLD_CITIES.map(({ name, timeZone }) => (
        <div key={timeZone} className="bg-[#1a1a2e] rounded-lg p-2 text-center border border-[#3a3a4e]">
          <p className="text-[9px] text-[#8888a0] uppercase tracking-wider">{name}</p>
          <p className="text-sm font-bold text-[#e0e0e8] mt-0.5 font-mono">
            {now.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color, sparkData }: {
  label: string; value: string; sub?: string; icon: any; color: string; sparkData?: number[];
}) {
  return (
    <div className="bg-[#2a2a3e] border border-[#3a3a4e] rounded-lg p-3 hover:border-[#5a5a6e] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-[#8888a0]">{label}</p>
          <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
          {sub && <p className="text-[10px] text-[#8888a0]">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Icon size={16} style={{ color }} />
          {sparkData && sparkData.length > 1 && (
            <SparklineChart data={sparkData} color={color} width={50} height={16} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────
interface HomeDashboardProps {
  onNavigate: (view: string) => void;
  onNavigateToPendingBilling: () => void;
  hasData: boolean;
  loading: boolean;
  onSeedData: () => Promise<void>;
  seeding: boolean;
  seedMessage: { type: 'success' | 'error'; text: string } | null;
}

export default function HomeDashboard({
  onNavigate, hasData, loading: initialLoading, onSeedData, seeding, seedMessage,
}: HomeDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangePreset('last30days'));
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({ totalEnergy: 0, totalRevenue: 0, totalSessions: 0, activeStations: 0 });
  const [envImpact, setEnvImpact] = useState<EnvironmentalImpact | null>(null);
  const [pendingBilling, setPendingBilling] = useState(0);
  const [energyData, setEnergyData] = useState<any[]>([]);
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
      const [summary, pending, energyTrend, revenue, connectors, hourly, daily, activity] = await Promise.all([
        getSummaryMetrics(dateRange),
        countPendingSessions({
          startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
          endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
          billingStatus: 'pending',
          stationId: '',
          searchTerm: '',
          page: 1,
          pageSize: 50,
        }),
        getEnergyTrend(dateRange),
        getRevenueByStation(dateRange),
        getConnectorTypeComparison(dateRange),
        getBestTimeToCharge(dateRange),
        getDailyTransactionsByConnector(dateRange),
        getRecentActivity(dateRange, 8),
      ]);
      setMetrics(summary);
      setPendingBilling(pending);
      setEnergyData(energyTrend.data);
      setEnergyGroupBy(energyTrend.groupBy);
      setRevenueData(revenue);
      setConnectorData(connectors);
      setHourlyData(hourly);
      setDailyTransactions(daily);
      setRecentActivity(activity);
      setEnvImpact(calculateEnvironmentalImpact(summary.totalEnergy, summary.totalSessions));
      const heatmap = await fetchHeatmapData();
      setHeatmapData(heatmap);
    } catch (err) { console.error('Dashboard load error:', err); }
    finally { setDashboardLoading(false); setRefreshing(false); }
  }, [dateRange]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleRefresh = () => { setRefreshing(true); loadDashboard(); };
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { exportToCSV } = await import('../lib/analyticsService');
      exportToCSV([
        { metric: 'Sessions', value: metrics.totalSessions },
        { metric: 'Energy (kWh)', value: metrics.totalEnergy.toFixed(2) },
        { metric: 'Revenue (JOD)', value: formatJOD(metrics.totalRevenue) },
        { metric: 'Stations', value: metrics.activeStations },
        { metric: 'CO₂ Avoided (kg)', value: envImpact?.co2Avoided.toFixed(1) ?? '0' },
      ], `dashboard-${format(dateRange.startDate, 'yyyy-MM-dd')}.csv`);
    } catch (e) { console.error(e); }
    finally { setIsExportingPdf(false); }
  };

  const loading = initialLoading || dashboardLoading;

  // Sparkline data from daily transactions
  const dailySpark = dailyTransactions.map((d: any) => {
    const vals = Object.values(d).filter(v => typeof v === 'number') as number[];
    return vals.reduce((s, v) => s + v, 0);
  });
  const energySpark = energyData.map((d: any) => d.energy || 0);
  const revenueSpark = revenueData.map((d: any) => d.revenue || 0);

  return (
    <div className="bg-[#1e1e2e] rounded-xl p-4 -mx-2 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#e0e0e8]">⚡ EV Charging Dashboard</h2>
          <p className="text-[11px] text-[#8888a0]">Real-time operations overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a3e] border border-[#3a3a4e] text-[#c0c0d0] rounded-lg text-xs hover:bg-[#3a3a4e] disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExportPdf} disabled={isExportingPdf || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4A90D9] text-white rounded-lg text-xs hover:bg-[#3A80C9] disabled:opacity-50">
            {isExportingPdf ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export
          </button>
        </div>
      </div>

      {/* Slicer Bar */}
      <div className="bg-[#2a2a3e] border border-[#3a3a4e] rounded-lg p-3 mb-4">
        <DateRangeSelector dateRange={dateRange} onChange={setDateRange} />
      </div>

      {/* Empty state */}
      {!initialLoading && !hasData && (
        <div className="p-5 bg-[#1a3a1a] border border-[#2a5a2a] rounded-xl mb-4">
          <h4 className="font-semibold text-[#4ADE80] mb-2 flex items-center gap-2">
            <Database size={16} /> Sample Data Available
          </h4>
          <p className="text-xs text-[#8888a0] mb-3">Load sample stations, rates, and charges to test the system</p>
          {seedMessage && (
            <div className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-xs ${seedMessage.type === 'success' ? 'bg-[#1a4a1a] text-[#4ADE80]' : 'bg-[#4a1a1a] text-[#F87171]'}`}>
              {seedMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {seedMessage.text}
            </div>
          )}
          <button onClick={onSeedData} disabled={seeding}
            className="bg-[#2ECC71] text-[#1e1e2e] py-2 px-4 rounded-lg text-sm font-semibold hover:bg-[#27AE60] disabled:opacity-50 flex items-center gap-2">
            {seeding ? <><Loader2 size={14} className="animate-spin" /> Loading...</> : <><Database size={14} /> Load Sample Data</>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="text-[#4A90D9] animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <KPICard label="Sessions" value={metrics.totalSessions.toLocaleString()} icon={Activity} color="#4A90D9" sparkData={dailySpark} />
            <KPICard label="Energy" value={metrics.totalEnergy >= 1000 ? `${(metrics.totalEnergy / 1000).toFixed(1)} MWh` : `${metrics.totalEnergy.toFixed(1)} kWh`} icon={Zap} color="#1ABC9C" sparkData={energySpark} />
            <KPICard label="Revenue" value={formatJOD(metrics.totalRevenue)} icon={DollarSign} color="#2ECC71" sparkData={revenueSpark} />
            <KPICard label="Stations" value={String(metrics.activeStations)} icon={MapPin} color="#9B59B6" />
            <KPICard label="CO₂ Saved" value={envImpact ? (envImpact.co2Avoided >= 1000 ? `${(envImpact.co2Avoided / 1000).toFixed(1)} t` : `${envImpact.co2Avoided.toFixed(1)} kg`) : '0'} icon={Leaf} color="#2ECC71" />
            <KPICard label="Pending" value={String(pendingBilling)} sub={pendingBilling > 0 ? 'Need billing' : 'All clear'} icon={Calculator} color={pendingBilling > 0 ? '#F1C40F' : '#8888a0'} />
          </div>

          {/* World Clock */}
          <div className="mb-4">
            <PowerBITile title="World Time" icon={<Clock size={12} />} span={3}>
              <WorldClock />
            </PowerBITile>
          </div>

          {/* Row 1: Revenue Summary + Environmental Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <PowerBITile title="Revenue Summary" icon={<DollarSign size={12} />}>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-[#1a1a2e] rounded-lg p-3 text-center border border-[#3a3a4e]">
                  <p className="text-[9px] text-[#8888a0] uppercase">Total</p>
                  <p className="text-lg font-bold text-[#2ECC71]">{formatJOD(metrics.totalRevenue)}</p>
                </div>
                <div className="bg-[#1a1a2e] rounded-lg p-3 text-center border border-[#3a3a4e]">
                  <p className="text-[9px] text-[#8888a0] uppercase">Sessions</p>
                  <p className="text-lg font-bold text-[#4A90D9]">{metrics.totalSessions}</p>
                </div>
                <div className="bg-[#1a1a2e] rounded-lg p-3 text-center border border-[#3a3a4e]">
                  <p className="text-[9px] text-[#8888a0] uppercase">Avg/Session</p>
                  <p className="text-lg font-bold text-[#F1C40F]">
                    {metrics.totalSessions > 0 ? formatJOD(metrics.totalRevenue / metrics.totalSessions) : '—'}
                  </p>
                </div>
              </div>
              <RevenueChart data={revenueData} />
            </PowerBITile>
            <PowerBITile title="Environmental Impact" icon={<Leaf size={12} />}>
              {envImpact && <EnvironmentalImpactPanel impact={envImpact} />}
            </PowerBITile>
          </div>

          {/* Row 2: Energy Trend (full width) */}
          <div className="mb-3">
            <PowerBITile title="Energy Trend" icon={<Zap size={12} />} span={3}>
              <EnergyTrendChart data={energyData} groupBy={energyGroupBy} />
            </PowerBITile>
          </div>

          {/* Row 3: Connector Donut + Best Time */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <PowerBITile title="Connector Types" icon={<Activity size={12} />}>
              <ConnectorTypeChart data={connectorData} />
            </PowerBITile>
            <PowerBITile title="Best Time to Charge" icon={<Clock size={12} />}>
              <BestTimeToChargeChart data={hourlyData} />
            </PowerBITile>
          </div>

          {/* Row 4: Daily Transactions + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <PowerBITile title="Daily Transactions" icon={<Activity size={12} />}>
              <DailyTransactionsChart data={dailyTransactions} />
            </PowerBITile>
            <PowerBITile title="Activity Heatmap" icon={<MapPin size={12} />}>
              <HeatmapGrid data={heatmapData} />
            </PowerBITile>
          </div>

          {/* Row 5: Quick Actions */}
          {pendingBilling > 0 && (
            <div className="bg-[#2a2a3e] border border-[#F1C40F]/30 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-[#F1C40F]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#e0e0e8]">{pendingBilling} session(s) pending billing</p>
                  <p className="text-[10px] text-[#8888a0]">Click to process</p>
                </div>
                <button onClick={() => onNavigate('billing')} className="px-3 py-1.5 bg-[#F1C40F] text-[#1e1e2e] rounded-lg text-xs font-semibold hover:bg-[#F39C12]">
                  Open Billing
                </button>
              </div>
            </div>
          )}

          {/* Row 6: Recent Activity */}
          <PowerBITile title="Recent Activity" icon={<Activity size={12} />} span={3}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#3a3a4e]">
                    {['Transaction', 'Station', 'Energy', 'Cost', 'Time', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-medium text-[#8888a0] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((row: any) => (
                    <tr key={row.id} className="border-b border-[#3a3a4e]/50 hover:bg-[#3a3a4e]/30">
                      <td className="px-3 py-2 text-[#e0e0e8] font-medium">{row.transactionId || '—'}</td>
                      <td className="px-3 py-2 text-[#c0c0d0]">{row.station || '—'}</td>
                      <td className="px-3 py-2 text-[#1ABC9C] font-medium">{row.energy != null ? `${Number(row.energy).toFixed(2)} kWh` : '—'}</td>
                      <td className="px-3 py-2 text-[#2ECC71] font-medium">{row.cost != null ? formatJOD(row.cost) : '—'}</td>
                      <td className="px-3 py-2 text-[#8888a0] whitespace-nowrap">{row.startTime ? new Date(row.startTime).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${row.hasBilling ? 'bg-[#2ECC71]/20 text-[#2ECC71]' : 'bg-[#F1C40F]/20 text-[#F1C40F]'}`}>
                          {row.hasBilling ? 'Calculated' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentActivity.length === 0 && (
                <div className="text-center py-8 text-[#8888a0] text-xs">No recent activity</div>
              )}
            </div>
          </PowerBITile>
        </>
      )}
    </div>
  );
}
