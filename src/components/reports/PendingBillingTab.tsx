import { useState } from 'react';
import { AlertTriangle, Zap, Hash } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchPendingBilling } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, pendingBillingColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Transaction ID', key: 'transaction_id' },
  { header: 'Station', key: 'station_name' },
  { header: 'Date', key: 'start_date' },
  { header: 'Start', key: 'start_time' },
  { header: 'End', key: 'end_time' },
  { header: 'Duration (min)', key: 'duration_minutes', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Energy (kWh)', key: 'energy_kwh', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Status', key: 'status' },
];

export default function PendingBillingTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchPendingBilling({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setRows(result.rows); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `pending-billing-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Unpaid / Pending Billing', rows, pendingBillingColumns, `Unbilled: ${totals.unbilledCount || 0} sessions  |  Energy: ${(totals.totalEnergy || 0).toFixed(2)} kWh`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, pendingBillingColumns, `${fn}.xlsx`, 'Pending');
      if (type === 'csv') exportGenericCSV(rows, pendingBillingColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Unbilled Sessions', value: totals.unbilledCount || 0, format: 'number', icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
    { label: 'Unbilled Energy', value: `${(totals.totalEnergy || 0).toFixed(2)} kWh`, format: 'string', icon: Zap },
    { label: 'Total Found', value: rows.length, format: 'number', icon: Hash },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
