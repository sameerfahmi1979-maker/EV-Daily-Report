import React, { useState } from 'react';
import { FileText, Zap, DollarSign, Clock } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchOperatorTransactions, type TransactionRow, type Totals } from '../../lib/reportDataService';
import { exportOperatorTransactionsPDF, exportOperatorTransactionsExcel, exportOperatorTransactionsCSV } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showOperator: true, showTimeRange: true, showQuickDates: true, operatorRequired: true };

const tableColumns: TableColumn[] = [
  { header: 'Transaction ID', key: 'transaction_id' },
  { header: 'Station', key: 'station_name' },
  { header: 'Date', key: 'start_date' },
  { header: 'Start', key: 'start_time' },
  { header: 'End', key: 'end_time' },
  { header: 'Duration (min)', key: 'duration_minutes', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Energy (kWh)', key: 'energy_kwh', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Cost (JOD)', key: 'cost_jod', align: 'right', format: (v: number | null) => v !== null ? v.toFixed(3) : 'N/C' },
];

export default function OperatorTransactionsTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, energy: 0, revenue: 0, duration: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    if (!filters.cardNumber) { alert('Please select an operator'); return; }
    setLoading(true);
    try {
      const result = await fetchOperatorTransactions({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        startTime: filters.startTime || undefined, endTime: filters.endTime || undefined,
        stationId: filters.stationId || undefined, cardNumber: filters.cardNumber,
      });
      setRows(result.rows); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const ef = { ...filters, operatorName: filters.operatorName };
      if (type === 'pdf') await exportOperatorTransactionsPDF(rows, totals, ef);
      if (type === 'excel') exportOperatorTransactionsExcel(rows, ef);
      if (type === 'csv') exportOperatorTransactionsCSV(rows, ef);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Sessions', value: totals.sessions, format: 'number', icon: FileText },
    { label: 'Energy', value: totals.energy, format: 'number', icon: Zap },
    { label: 'Duration', value: `${totals.duration.toFixed(0)} min`, format: 'string', icon: Clock },
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
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} emptyMessage="Select an operator and apply filters to load transactions." />
    </div>
  );
}
