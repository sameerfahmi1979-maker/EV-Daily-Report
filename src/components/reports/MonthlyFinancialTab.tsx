import { useState } from 'react';
import { TrendingUp, DollarSign, Zap, BarChart3 } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchMonthlyFinancial } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, monthlyFinancialColumns } from '../../lib/reportExportService';
import { renderBarChart } from '../../lib/reportUtils';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Month', key: 'month' },
  { header: 'Sessions', key: 'sessions', align: 'right' },
  { header: 'Energy (kWh)', key: 'energy', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'revenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Avg Rev/Session', key: 'avgRevenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Growth %', key: 'growth', align: 'right', format: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
];

export default function MonthlyFinancialTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchMonthlyFinancial({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setData(result);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (!data) return;
    setExporting(true);
    try {
      const fn = `monthly-financial-${filters.startDate}-to-${filters.endDate}`;
      const chartImg = renderBarChart(data.monthlyData.map((m: any) => m.revenue), data.monthlyData.map((m: any) => m.month), 600, 180, '#1e3a8a');
      if (type === 'pdf') await exportGenericPDF('Monthly Financial Summary', data.monthlyData, monthlyFinancialColumns, `YTD Sessions: ${data.ytdTotals.sessions}  |  YTD Revenue: ${data.ytdTotals.revenue.toFixed(3)} JOD`, filters, `${fn}.pdf`, chartImg ? [{ title: 'Revenue Trend', image: chartImg }] : undefined);
      if (type === 'excel') exportGenericExcel(data.monthlyData, monthlyFinancialColumns, `${fn}.xlsx`, 'Monthly');
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = data ? [
    { label: 'YTD Sessions', value: data.ytdTotals.sessions, format: 'number', icon: BarChart3 },
    { label: 'YTD Energy', value: data.ytdTotals.energy, format: 'number', icon: Zap },
    { label: 'YTD Revenue', value: data.ytdTotals.revenue, format: 'currency', icon: DollarSign },
    { label: 'Latest Growth', value: data.monthlyData.length > 0 ? data.monthlyData[data.monthlyData.length - 1].growth : 0, format: 'percent', icon: TrendingUp },
  ] : [];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {data && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('excel')} onPrint={() => window.print()} loading={exporting} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <PerformanceChart type="bar" data={data.monthlyData.map((m: any) => m.revenue)} labels={data.monthlyData.map((m: any) => m.month)} title="Revenue Trend" color="#1e3a8a" />
            <PerformanceChart type="line" data={data.monthlyData.map((m: any) => m.energy)} labels={data.monthlyData.map((m: any) => m.month)} title="Energy Trend" color="#14b8a6" />
          </div>
        </>
      )}
      <ReportDataTable columns={tableColumns} data={data?.monthlyData || []} loading={loading} emptyMessage="Apply filters to generate monthly financial summary." />
    </div>
  );
}
