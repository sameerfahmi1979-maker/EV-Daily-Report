import { useState, useEffect, useCallback } from 'react';
import {
  Zap, DollarSign, Activity, MapPin, Download, Loader2, RefreshCw, Leaf, Clock,
} from 'lucide-react';
import DateRangeSelector from './DateRangeSelector';
import EnergyTrendChart from './EnergyTrendChart';
import RevenueChart from './RevenueChart';
import StationComparison from './StationComparison';
import RecentActivityTable from './RecentActivityTable';
import ShiftComparisonChart from './ShiftComparisonChart';
import ConnectorTypeChart from './ConnectorTypeChart';
import BestTimeToChargeChart from './BestTimeToChargeChart';
import DailyTransactionsChart from './DailyTransactionsChart';
import ChargerTypeBreakdown from './ChargerTypeBreakdown';
import PowerBITile from './PowerBITile';
import SparklineChart from './SparklineChart';
import EnvironmentalImpactPanel from './EnvironmentalImpactPanel';
import {
  DateRange, EnergyGroupBy, getDateRangePreset, getSummaryMetrics,
  getEnergyTrend, getRevenueByStation, getStationUtilization,
  getRecentActivity, getShiftComparison, getConnectorTypeComparison,
  getBestTimeToCharge, getDailyTransactionsByConnector,
  getChargerTypeBreakdown, exportToCSV,
} from '../lib/analyticsService';
import { calculateEnvironmentalImpact, EnvironmentalImpact } from '../lib/environmentalImpactService';
import { formatJOD } from '../lib/billingService';

// ── KPI Card (reused style) ─────────────────
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

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangePreset('last30days'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [metrics, setMetrics] = useState({ totalEnergy: 0, totalRevenue: 0, totalSessions: 0, activeStations: 0 });
  const [envImpact, setEnvImpact] = useState<EnvironmentalImpact | null>(null);
  const [energyData, setEnergyData] = useState<any[]>([]);
  const [energyGroupBy, setEnergyGroupBy] = useState<EnergyGroupBy>('month');
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [stationData, setStationData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [connectorData, setConnectorData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [dailyTransactions, setDailyTransactions] = useState<any[]>([]);
  const [chargerTypes, setChargerTypes] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsData, energyTrend, revenue, stations, activity, shifts, connectors, hourly, daily, chargers] = await Promise.all([
        getSummaryMetrics(dateRange),
        getEnergyTrend(dateRange),
        getRevenueByStation(dateRange),
        getStationUtilization(dateRange),
        getRecentActivity(dateRange, 10),
        getShiftComparison(dateRange),
        getConnectorTypeComparison(dateRange),
        getBestTimeToCharge(dateRange),
        getDailyTransactionsByConnector(dateRange),
        getChargerTypeBreakdown(dateRange),
      ]);
      setMetrics(metricsData);
      setEnergyData(energyTrend.data);
      setEnergyGroupBy(energyTrend.groupBy);
      setRevenueData(revenue);
      setStationData(stations);
      setActivityData(activity);
      setShiftData(shifts);
      setConnectorData(connectors);
      setHourlyData(hourly);
      setDailyTransactions(daily);
      setChargerTypes(chargers);
      setEnvImpact(calculateEnvironmentalImpact(metricsData.totalEnergy, metricsData.totalSessions));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  function handleRefresh() { setRefreshing(true); loadDashboardData(); }

  function handleExportMetrics() {
    exportToCSV([
      { metric: 'Total Energy', value: `${metrics.totalEnergy.toFixed(3)} kWh` },
      { metric: 'Total Revenue', value: formatJOD(metrics.totalRevenue) },
      { metric: 'Total Sessions', value: metrics.totalSessions },
      { metric: 'Active Stations', value: metrics.activeStations },
      { metric: 'CO₂ Avoided', value: `${envImpact?.co2Avoided.toFixed(1) ?? 0} kg` },
    ], 'analytics-summary.csv');
  }

  function handleExportEnergy() {
    exportToCSV(energyData.map(d => ({ date: d.date, energy_kwh: d.energy.toFixed(3), sessions: d.sessions })), 'energy-trend.csv');
  }

  function handleExportRevenue() {
    exportToCSV(revenueData.map(d => ({ station: d.station, revenue_jod: d.revenue.toFixed(3), sessions: d.sessions })), 'revenue-by-station.csv');
  }

  // Sparkline data
  const energySpark = energyData.map((d: any) => d.energy || 0);
  const revenueSpark = revenueData.map((d: any) => d.revenue || 0);
  const dailySpark = dailyTransactions.map((d: any) => {
    const vals = Object.values(d).filter(v => typeof v === 'number') as number[];
    return vals.reduce((s, v) => s + v, 0);
  });

  return (
    <div className="bg-[#1e1e2e] rounded-xl p-4 -mx-2 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#e0e0e8]">📊 Analytics Dashboard</h2>
          <p className="text-[11px] text-[#8888a0]">Deep-dive performance analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a3e] border border-[#3a3a4e] text-[#c0c0d0] rounded-lg text-xs hover:bg-[#3a3a4e] disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExportMetrics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4A90D9] text-white rounded-lg text-xs hover:bg-[#3A80C9]">
            <Download size={12} /> Export Summary
          </button>
        </div>
      </div>

      {/* Slicer Bar */}
      <div className="bg-[#2a2a3e] border border-[#3a3a4e] rounded-lg p-3 mb-4">
        <DateRangeSelector dateRange={dateRange} onChange={setDateRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#4A90D9]" />
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <KPICard label="Total Energy" value={metrics.totalEnergy >= 1000 ? `${(metrics.totalEnergy / 1000).toFixed(1)} MWh` : `${metrics.totalEnergy.toFixed(1)} kWh`} icon={Zap} color="#1ABC9C" sparkData={energySpark} />
            <KPICard label="Total Revenue" value={formatJOD(metrics.totalRevenue)} icon={DollarSign} color="#2ECC71" sparkData={revenueSpark} />
            <KPICard label="Sessions" value={metrics.totalSessions.toLocaleString()} icon={Activity} color="#4A90D9" sparkData={dailySpark} />
            <KPICard label="Stations" value={String(metrics.activeStations)} icon={MapPin} color="#9B59B6" />
            <KPICard label="CO₂ Avoided" value={envImpact ? (envImpact.co2Avoided >= 1000 ? `${(envImpact.co2Avoided / 1000).toFixed(1)} t` : `${envImpact.co2Avoided.toFixed(1)} kg`) : '0'} icon={Leaf} color="#2ECC71" />
          </div>

          {/* Row 1: Shift Comparison + Environmental Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <div className="lg:col-span-2">
              <PowerBITile title="Shift Comparison" icon={<Clock size={12} />}>
                <ShiftComparisonChart data={shiftData} />
              </PowerBITile>
            </div>
            <PowerBITile title="Environmental Impact" icon={<Leaf size={12} />}>
              {envImpact && <EnvironmentalImpactPanel impact={envImpact} />}
            </PowerBITile>
          </div>

          {/* Row 2: Connector Types + Charger Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <PowerBITile title="Connector Types" icon={<Activity size={12} />}>
              <ConnectorTypeChart data={connectorData} />
            </PowerBITile>
            <PowerBITile title="Charger Type Breakdown" icon={<Zap size={12} />}>
              <ChargerTypeBreakdown data={chargerTypes} />
            </PowerBITile>
          </div>

          {/* Row 3: Energy Trend + Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <PowerBITile title="Energy Trend" icon={<Zap size={12} />}>
              <div className="flex justify-end mb-2">
                <button onClick={handleExportEnergy}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-[#3a3a4e] text-[#c0c0d0] rounded hover:bg-[#4a4a5e]">
                  <Download size={10} /> CSV
                </button>
              </div>
              <EnergyTrendChart data={energyData} groupBy={energyGroupBy} />
            </PowerBITile>
            <PowerBITile title="Revenue by Station" icon={<DollarSign size={12} />}>
              <div className="flex justify-end mb-2">
                <button onClick={handleExportRevenue}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-[#3a3a4e] text-[#c0c0d0] rounded hover:bg-[#4a4a5e]">
                  <Download size={10} /> CSV
                </button>
              </div>
              <RevenueChart data={revenueData} />
            </PowerBITile>
          </div>

          {/* Row 4: Best Time + Daily Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <PowerBITile title="Best Time to Charge" icon={<Clock size={12} />}>
              <BestTimeToChargeChart data={hourlyData} />
            </PowerBITile>
            <PowerBITile title="Daily Transactions" icon={<Activity size={12} />}>
              <DailyTransactionsChart data={dailyTransactions} />
            </PowerBITile>
          </div>

          {/* Row 5: Station Comparison */}
          <div className="mb-3">
            <PowerBITile title="Station Utilization" icon={<MapPin size={12} />} span={3}>
              <StationComparison data={stationData} />
            </PowerBITile>
          </div>

          {/* Row 6: Recent Activity */}
          <PowerBITile title="Recent Activity" icon={<Activity size={12} />} span={3}>
            <RecentActivityTable data={activityData} />
          </PowerBITile>
        </>
      )}
    </div>
  );
}
