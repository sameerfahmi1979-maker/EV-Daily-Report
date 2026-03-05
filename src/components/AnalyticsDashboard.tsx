import React, { useState, useEffect, useCallback } from 'react';
import { Zap, DollarSign, Activity, MapPin, Download, Loader2, RefreshCw, Leaf } from 'lucide-react';
import MetricCard from './MetricCard';
import DateRangeSelector from './DateRangeSelector';
import EnergyTrendChart from './EnergyTrendChart';
import RevenueChart from './RevenueChart';
import StationComparison from './StationComparison';
import RecentActivityTable from './RecentActivityTable';
import ShiftComparisonChart from './ShiftComparisonChart';
import ConnectorTypeChart from './ConnectorTypeChart';
import BestTimeToChargeChart from './BestTimeToChargeChart';
import CO2ImpactCard from './CO2ImpactCard';
import DailyTransactionsChart from './DailyTransactionsChart';
import ChargerTypeBreakdown from './ChargerTypeBreakdown';
import {
  DateRange,
  EnergyGroupBy,
  getDateRangePreset,
  getSummaryMetrics,
  getEnergyTrend,
  getRevenueByStation,
  getStationUtilization,
  getRecentActivity,
  getShiftComparison,
  getConnectorTypeComparison,
  getBestTimeToCharge,
  getCO2ImpactMetrics,
  getDailyTransactionsByConnector,
  getChargerTypeBreakdown,
  exportToCSV
} from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangePreset('last30days'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [metrics, setMetrics] = useState({
    totalEnergy: 0,
    totalRevenue: 0,
    totalSessions: 0,
    activeStations: 0
  });

  const [energyData, setEnergyData] = useState<any[]>([]);
  const [energyGroupBy, setEnergyGroupBy] = useState<EnergyGroupBy>('month');
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [stationData, setStationData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [connectorData, setConnectorData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [co2Data, setCo2Data] = useState({
    totalCO2Reduction: 0,
    treesEquivalent: 0,
    kmDrivenEquivalent: 0,
    energyUsed: 0
  });
  const [dailyTransactions, setDailyTransactions] = useState<any[]>([]);
  const [chargerTypes, setChargerTypes] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        metricsData,
        energyTrend,
        revenue,
        stations,
        activity,
        shifts,
        connectors,
        hourly,
        co2,
        daily,
        chargers
      ] = await Promise.all([
        getSummaryMetrics(dateRange),
        getEnergyTrend(dateRange),
        getRevenueByStation(dateRange),
        getStationUtilization(dateRange),
        getRecentActivity(dateRange, 10),
        getShiftComparison(dateRange),
        getConnectorTypeComparison(dateRange),
        getBestTimeToCharge(dateRange),
        getCO2ImpactMetrics(dateRange),
        getDailyTransactionsByConnector(dateRange),
        getChargerTypeBreakdown(dateRange)
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
      setCo2Data(co2);
      setDailyTransactions(daily);
      setChargerTypes(chargers);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboardData();
  }

  function handleExportMetrics() {
    const data = [
      {
        metric: 'Total Energy',
        value: `${metrics.totalEnergy.toFixed(3)} kWh`
      },
      {
        metric: 'Total Revenue',
        value: formatJOD(metrics.totalRevenue)
      },
      {
        metric: 'Total Sessions',
        value: metrics.totalSessions
      },
      {
        metric: 'Active Stations',
        value: metrics.activeStations
      }
    ];
    exportToCSV(data, 'summary-metrics.csv');
  }

  function handleExportEnergy() {
    const data = energyData.map(d => ({
      date: d.date,
      energy_kwh: d.energy.toFixed(3),
      sessions: d.sessions
    }));
    exportToCSV(data, 'energy-trend.csv');
  }

  function handleExportRevenue() {
    const data = revenueData.map(d => ({
      station: d.station,
      station_code: d.stationCode,
      revenue_jod: d.revenue.toFixed(3),
      sessions: d.sessions
    }));
    exportToCSV(data, 'revenue-by-station.csv');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600 mt-1">Monitor your charging station performance and revenue</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <DateRangeSelector dateRange={dateRange} onChange={setDateRange} />

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={handleExportMetrics}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={18} />
              <span>Export Summary</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard
              title="Total Energy Consumed"
              value={metrics.totalEnergy.toFixed(2)}
              unit="kWh"
              icon={Zap}
              color="blue"
            />
            <MetricCard
              title="Total Revenue"
              value={metrics.totalRevenue.toFixed(3)}
              unit="JOD"
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Total Sessions"
              value={metrics.totalSessions}
              icon={Activity}
              color="orange"
            />
            <MetricCard
              title="Active Stations"
              value={metrics.activeStations}
              icon={MapPin}
              color="red"
            />
            <MetricCard
              title="CO2 Reduction"
              value={co2Data.totalCO2Reduction.toFixed(1)}
              unit="kg"
              icon={Leaf}
              color="teal"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ShiftComparisonChart data={shiftData} />
            </div>
            <div>
              <CO2ImpactCard
                totalCO2Reduction={co2Data.totalCO2Reduction}
                treesEquivalent={co2Data.treesEquivalent}
                kmDrivenEquivalent={co2Data.kmDrivenEquivalent}
                energyUsed={co2Data.energyUsed}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConnectorTypeChart data={connectorData} />
            <ChargerTypeBreakdown data={chargerTypes} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleExportEnergy}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download size={16} />
                  <span>Export</span>
                </button>
              </div>
              <EnergyTrendChart data={energyData} groupBy={energyGroupBy} />
            </div>

            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleExportRevenue}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download size={16} />
                  <span>Export</span>
                </button>
              </div>
              <RevenueChart data={revenueData} />
            </div>
          </div>

          <BestTimeToChargeChart data={hourlyData} />

          <DailyTransactionsChart data={dailyTransactions} />

          <StationComparison data={stationData} />

          <RecentActivityTable data={activityData} />
        </>
      )}
    </div>
  );
}
