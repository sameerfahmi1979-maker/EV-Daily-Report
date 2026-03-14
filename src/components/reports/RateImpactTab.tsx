import { useState } from 'react';
import { DollarSign, Zap, BarChart3 } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchRateStructureImpact } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, rateImpactColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Rate Structure', key: 'rate_structure' },
  { header: 'Sessions', key: 'sessions', align: 'right' },
  { header: 'Avg kWh', key: 'avg_kwh', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Avg Rev/Session', key: 'avg_revenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Total Revenue', key: 'total_revenue', align: 'right', format: (v: number) => v.toFixed(3) },
];

export default function RateImpactTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchRateStructureImpact({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setRows(result.rows);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `rate-impact-${filters.startDate}-to-${filters.endDate}`;
      const totalRev = rows.reduce((s, r) => s + r.total_revenue, 0);
      if (type === 'pdf') await exportGenericPDF('Rate Structure Impact', rows, rateImpactColumns, `Rate Structures: ${rows.length}  |  Total Revenue: ${totalRev.toFixed(3)} JOD`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, rateImpactColumns, `${fn}.xlsx`, 'Rate Impact');
      if (type === 'csv') exportGenericCSV(rows, rateImpactColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const totalRev = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const cards: SummaryCard[] = [
    { label: 'Rate Structures', value: rows.length, format: 'number', icon: BarChart3 },
    { label: 'Total Revenue', value: totalRev, format: 'currency', icon: DollarSign },
    { label: 'Avg Rev/Session', value: rows.length > 0 ? rows.reduce((s, r) => s + r.avg_revenue, 0) / rows.length : 0, format: 'currency', icon: Zap },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
