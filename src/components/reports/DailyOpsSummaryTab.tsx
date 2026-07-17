import { useState } from 'react';
import { Calendar, Users, Zap, DollarSign } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchDailyOpsSummary } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, dailyOpsShiftColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, singleDate: true };

const shiftTableColumns: TableColumn[] = [
  { header: 'Date', key: 'shift_date' },
  { header: 'Station', key: 'station_name' },
  { header: 'Operator', key: 'operator_name' },
  { header: 'Type', key: 'shift_type' },
  { header: 'Sessions', key: 'total_sessions', align: 'right' },
  { header: 'kWh', key: 'total_kwh', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_amount_jod', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Handover', key: 'handover_status' },
];

export default function DailyOpsSummaryTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchDailyOpsSummary({ startDate: new Date(filters.startDate), endDate: new Date(filters.startDate), stationId: filters.stationId || undefined });
      setData(result);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (!data) return;
    setExporting(true);
    try {
      const fn = `daily-ops-${data.date}`;
      if (type === 'pdf') await exportGenericPDF(`Daily Operations Summary — ${data.date}`, data.shifts, dailyOpsShiftColumns, `Shifts: ${data.dayTotals.shifts}  |  Operators: ${data.dayTotals.operators}  |  Sessions: ${data.dayTotals.sessions}  |  Energy: ${data.dayTotals.energy.toFixed(2)} kWh  |  Revenue: ${data.dayTotals.revenue.toFixed(3)} JOD`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(data.shifts, dailyOpsShiftColumns, `${fn}.xlsx`, 'Daily Ops');
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = data ? [
    { label: 'Date', value: data.date, format: 'string', icon: Calendar },
    { label: 'Shifts', value: data.dayTotals.shifts, format: 'number', icon: Users },
    { label: 'Sessions', value: data.dayTotals.sessions, format: 'number', icon: Zap },
    { label: 'Energy', value: data.dayTotals.energy, format: 'number', icon: Zap },
    { label: 'Revenue', value: data.dayTotals.revenue, format: 'currency', icon: DollarSign },
    { label: 'Operators', value: data.dayTotals.operators, format: 'number', icon: Users },
  ] : [];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {data && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('excel')} onPrint={() => window.print()} loading={exporting} />
        </>
      )}
      <ReportDataTable columns={shiftTableColumns} data={data?.shifts || []} loading={loading} emptyMessage="Select a date and apply to view daily operations." />
    </div>
  );
}
