import { useState } from 'react';
import { Wrench, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchMaintenanceReport } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, maintenanceColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showStatus: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Date', key: 'date' },
  { header: 'Station', key: 'station_name' },
  { header: 'Description', key: 'description' },
  { header: 'Reported By', key: 'reported_by' },
  { header: 'Status', key: 'status' },
  { header: 'Resolution Date', key: 'resolution_date' },
  { header: 'Hours', key: 'duration_hours', align: 'right' },
];

export default function MaintenanceReportTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchMaintenanceReport({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined, status: filters.status });
      setRows(result.rows); setSummary(result.statusSummary);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `maintenance-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Maintenance Report', rows, maintenanceColumns, `Total: ${summary.total || 0}  |  Open: ${summary.open || 0}  |  Resolved: ${summary.resolved || 0}  |  Avg Resolution: ${(summary.avgResolutionTime || 0).toFixed(1)}h`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, maintenanceColumns, `${fn}.xlsx`, 'Maintenance');
      if (type === 'csv') exportGenericCSV(rows, maintenanceColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Total Issues', value: summary.total || 0, format: 'number', icon: Wrench },
    { label: 'Open', value: summary.open || 0, format: 'number', icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
    { label: 'Resolved', value: summary.resolved || 0, format: 'number', icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
    { label: 'Avg Resolution', value: `${(summary.avgResolutionTime || 0).toFixed(1)}h`, format: 'string', icon: Clock },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} emptyMessage="No maintenance records found. This feature requires a maintenance_logs table." />
    </div>
  );
}
