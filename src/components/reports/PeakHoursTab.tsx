import React, { useState } from 'react';
import { Clock, Zap, TrendingUp } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchPeakHoursUtilization } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, peakHoursColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PeakHoursTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchPeakHoursUtilization({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined,
      });
      setData(result);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // Convert heatmap to table rows
  const tableRows = data ? Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    mon: data.heatmapData[h][1],
    tue: data.heatmapData[h][2],
    wed: data.heatmapData[h][3],
    thu: data.heatmapData[h][4],
    fri: data.heatmapData[h][5],
    sat: data.heatmapData[h][6],
    sun: data.heatmapData[h][0],
    total: data.heatmapData[h].reduce((s: number, v: number) => s + v, 0),
  })) : [];

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `peak-hours-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Peak Hours / Utilization', tableRows, peakHoursColumns, `Peak Hour: ${data?.peakHour}:00  |  Busiest Day: ${data?.busiestDay}  |  Total Sessions: ${data?.totalSessions}`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(tableRows, peakHoursColumns, `${fn}.xlsx`, 'Peak Hours');
      if (type === 'csv') exportGenericCSV(tableRows, peakHoursColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = data ? [
    { label: 'Peak Hour', value: `${data.peakHour}:00`, format: 'string', icon: Clock },
    { label: 'Busiest Day', value: data.busiestDay, format: 'string', icon: TrendingUp },
    { label: 'Total Sessions', value: data.totalSessions, format: 'number', icon: Zap },
  ] : [];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {data && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} />
          <div className="mb-4">
            <PerformanceChart type="heatmap" data={[]} labels={[]} heatmapData={data.heatmapData} title="Sessions by Hour & Day of Week" width={700} height={550} />
          </div>
        </>
      )}
      {!data && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
          Apply filters to view peak hours utilization heatmap.
        </div>
      )}
    </div>
  );
}
