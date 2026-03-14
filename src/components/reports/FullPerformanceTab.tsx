import React, { useState } from 'react';
import { TrendingUp, Zap, DollarSign, BarChart3 } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchFullPerformance, type Totals } from '../../lib/reportDataService';
import { exportFullPerformancePDF, exportFullPerformanceExcel } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showOperator: true, showGranularity: true, showQuickDates: true };

export default function FullPerformanceTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [data, setData] = useState<any>(null);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, energy: 0, revenue: 0, duration: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchFullPerformance({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined, cardNumber: filters.cardNumber || undefined,
        granularity: filters.granularity,
      });
      setData(result); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (!data) return;
    setExporting(true);
    try {
      if (type === 'pdf') await exportFullPerformancePDF(data.timeSeries, data.stationBreakdown, data.operatorBreakdown, totals, filters);
      if (type === 'excel') exportFullPerformanceExcel(data.timeSeries, data.stationBreakdown, data.operatorBreakdown, filters);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Total Sessions', value: totals.sessions, format: 'number', icon: BarChart3 },
    { label: 'Total Energy', value: totals.energy, format: 'number', icon: Zap },
    { label: 'Total Revenue', value: totals.revenue, format: 'currency', icon: DollarSign },
    { label: 'Avg Rev/Session', value: totals.sessions > 0 ? totals.revenue / totals.sessions : 0, format: 'currency', icon: TrendingUp },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {data && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            onExportCSV={() => handleExport('excel')}
            onPrint={() => window.print()}
            loading={exporting}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <PerformanceChart
              type="bar"
              data={data.timeSeries.map((t: any) => t.revenue)}
              labels={data.timeSeries.map((t: any) => t.label)}
              title="Revenue Trend"
              color="#1e3a8a"
            />
            <PerformanceChart
              type="line"
              data={data.timeSeries.map((t: any) => t.energy)}
              labels={data.timeSeries.map((t: any) => t.label)}
              title="Energy Consumption"
              color="#14b8a6"
            />
            <PerformanceChart
              type="bar"
              data={data.timeSeries.map((t: any) => t.sessions)}
              labels={data.timeSeries.map((t: any) => t.label)}
              title="Sessions Count"
              color="#f59e0b"
            />
            {data.stationBreakdown.length > 1 && (
              <PerformanceChart
                type="bar"
                data={data.stationBreakdown.map((s: any) => s.revenue)}
                labels={data.stationBreakdown.map((s: any) => s.name)}
                title="Station Comparison (Revenue)"
                color="#8b5cf6"
              />
            )}
          </div>

          {data.operatorBreakdown.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Operator Ranking</h3>
              <div className="space-y-2">
                {data.operatorBreakdown.slice(0, 10).map((op: any, idx: number) => (
                  <div key={op.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{op.name}</span>
                    <span className="text-sm text-gray-500">{op.sessions} sessions</span>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{op.revenue.toFixed(3)} JOD</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {!data && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
          Apply filters to generate the full performance dashboard.
        </div>
      )}
    </div>
  );
}
