import { useState } from 'react';
import { DollarSign, TrendingUp, Award } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchStationProfitability } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, profitabilityColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Station', key: 'station_name' },
  { header: 'Revenue (JOD)', key: 'total_revenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Est. Cost', key: 'estimated_cost', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Gross Margin', key: 'gross_margin', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Margin %', key: 'margin_pct', align: 'right', format: (v: number) => `${v.toFixed(1)}%` },
  { header: 'Sessions', key: 'total_sessions', align: 'right' },
];

export default function StationProfitabilityTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchStationProfitability({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setRows(result.rows); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `station-profitability-${filters.startDate}-to-${filters.endDate}`;
      const totalRev = rows.reduce((s, r) => s + r.total_revenue, 0);
      const totalMargin = rows.reduce((s, r) => s + r.gross_margin, 0);
      if (type === 'pdf') await exportGenericPDF('Station Profitability', rows, profitabilityColumns, `Revenue: ${totalRev.toFixed(3)} JOD  |  Net Margin: ${totalMargin.toFixed(3)} JOD`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, profitabilityColumns, `${fn}.xlsx`, 'Profitability');
      if (type === 'csv') exportGenericCSV(rows, profitabilityColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const totalRev = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalMargin = rows.reduce((s, r) => s + (r.gross_margin || 0), 0);
  const topStation = rows.length > 0 ? rows[0].station_name : '—';

  const cards: SummaryCard[] = [
    { label: 'Total Revenue', value: totalRev, format: 'currency', icon: DollarSign },
    { label: 'Net Margin', value: totalMargin, format: 'currency', icon: TrendingUp },
    { label: 'Most Profitable', value: topStation, format: 'string', icon: Award },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} />
          <div className="mb-4">
            <PerformanceChart type="bar" data={rows.map(r => r.gross_margin)} labels={rows.map(r => r.station_name)} title="Gross Margin by Station" color="#14b8a6" />
          </div>
        </>
      )}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
