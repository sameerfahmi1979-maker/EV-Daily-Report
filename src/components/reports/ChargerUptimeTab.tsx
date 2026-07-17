import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchChargerUptime } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, uptimeColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Station', key: 'station_name' },
  { header: 'Total Hours', key: 'total_hours', align: 'right' },
  { header: 'Active Hours', key: 'active_hours', align: 'right', format: (v: number) => v.toFixed(1) },
  { header: 'Downtime', key: 'downtime_hours', align: 'right', format: (v: number) => v.toFixed(1) },
  { header: 'Uptime %', key: 'uptime_pct', align: 'right', format: (v: number) => `${v.toFixed(1)}%` },
  { header: 'Sessions', key: 'session_count', align: 'right' },
];

export default function ChargerUptimeTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchChargerUptime({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setData(result);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    if (!data) return;
    setExporting(true);
    try {
      const fn = `charger-uptime-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Charger Uptime / Downtime', data.rows, uptimeColumns, `Avg Uptime: ${data.avgUptime.toFixed(1)}%  |  Stations: ${data.rows.length}`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(data.rows, uptimeColumns, `${fn}.xlsx`, 'Uptime');
      if (type === 'csv') exportGenericCSV(data.rows, uptimeColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = data ? [
    { label: 'Avg Uptime', value: data.avgUptime, format: 'percent', icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
    { label: 'Stations', value: data.rows.length, format: 'number', icon: Activity },
    { label: 'Below 90%', value: data.rows.filter((r: any) => r.uptime_pct < 90).length, format: 'number', icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
  ] : [];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {data && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} />
          <div className="mb-4">
            <PerformanceChart type="bar" data={data.rows.map((r: any) => r.uptime_pct)} labels={data.rows.map((r: any) => r.station_name)} title="Uptime % by Station" color="#14b8a6" />
          </div>
        </>
      )}
      <ReportDataTable columns={tableColumns} data={data?.rows || []} loading={loading} emptyMessage="Apply filters to view charger uptime data." />
    </div>
  );
}
