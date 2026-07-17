import React, { useState } from 'react';
import { BarChart3, Zap, DollarSign, Clock } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchStationPerformance, type StationStat, type Totals } from '../../lib/reportDataService';
import { exportStationPerformancePDF, exportStationPerformanceExcel, exportStationPerformanceCSV } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };

const tableColumns: TableColumn[] = [
  { header: 'Station', key: 'station_name' },
  { header: 'Code', key: 'station_code' },
  { header: 'Sessions', key: 'total_sessions', align: 'right' },
  { header: 'Energy (kWh)', key: 'total_energy', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_revenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Avg Duration', key: 'avg_duration', align: 'right', format: (v: number) => `${v.toFixed(1)} min` },
  { header: 'Avg kWh/Session', key: 'avg_energy_per_session', align: 'right', format: (v: number) => v.toFixed(2) },
];

export default function StationPerformanceTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<StationStat[]>([]);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, energy: 0, revenue: 0, duration: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchStationPerformance({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined,
      });
      setRows(result.stationStats); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      if (type === 'pdf') await exportStationPerformancePDF(rows, totals, filters);
      if (type === 'excel') exportStationPerformanceExcel(rows, filters);
      if (type === 'csv') exportStationPerformanceCSV(rows, filters);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Stations', value: rows.length, format: 'number', icon: BarChart3 },
    { label: 'Total Sessions', value: totals.sessions, format: 'number', icon: Clock },
    { label: 'Total Energy', value: totals.energy, format: 'number', icon: Zap },
    { label: 'Total Revenue', value: totals.revenue, format: 'currency', icon: DollarSign },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
