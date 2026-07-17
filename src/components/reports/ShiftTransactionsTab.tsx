import React, { useState } from 'react';
import { Clock, Zap, DollarSign, Users } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchShiftTransactions, type ShiftRow, type Totals } from '../../lib/reportDataService';
import { exportShiftTransactionsPDF, exportShiftTransactionsExcel, exportShiftTransactionsCSV } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showOperator: true, showShiftType: true, showQuickDates: true };

const tableColumns: TableColumn[] = [
  { header: 'Date', key: 'shift_date' },
  { header: 'Station', key: 'station_name' },
  { header: 'Operator', key: 'operator_name' },
  { header: 'Type', key: 'shift_type' },
  { header: 'Duration', key: 'shift_duration' },
  { header: 'Sessions', key: 'total_sessions', align: 'right' },
  { header: 'kWh', key: 'total_kwh', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_amount_jod', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Handover', key: 'handover_status' },
];

export default function ShiftTransactionsTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, energy: 0, revenue: 0, duration: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchShiftTransactions({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined, operatorId: filters.operatorId || undefined,
        shiftType: filters.shiftType,
      });
      setRows(result.rows); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      if (type === 'pdf') await exportShiftTransactionsPDF(rows, totals, filters);
      if (type === 'excel') exportShiftTransactionsExcel(rows, filters);
      if (type === 'csv') exportShiftTransactionsCSV(rows, filters);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Total Shifts', value: rows.length, format: 'number', icon: Clock },
    { label: 'Sessions', value: totals.sessions, format: 'number', icon: Users },
    { label: 'Energy (kWh)', value: totals.energy, format: 'number', icon: Zap },
    { label: 'Revenue', value: totals.revenue, format: 'currency', icon: DollarSign },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} />
        </>
      )}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
