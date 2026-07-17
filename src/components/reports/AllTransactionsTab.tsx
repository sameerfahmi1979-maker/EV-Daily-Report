import React, { useState } from 'react';
import { FileText, Zap, Clock, DollarSign } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchAllTransactions, type TransactionRow, type Totals } from '../../lib/reportDataService';
import {
  exportTransactionsPDF,
  exportTransactionsExcel,
  exportTransactionsCSV,
} from '../../lib/reportExportService';
import { formatJOD } from '../../lib/reportUtils';

const filterConfig: FilterConfig = {
  showSearch: true,
  showStation: true,
  showOperator: true,
  showTimeRange: true,
  showQuickDates: true,
};

const tableColumns: TableColumn[] = [
  { header: 'Transaction ID', key: 'transaction_id' },
  { header: 'Station', key: 'station_name' },
  { header: 'Date', key: 'start_date' },
  { header: 'Start', key: 'start_time' },
  { header: 'End', key: 'end_time' },
  { header: 'Duration (min)', key: 'duration_minutes', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Energy (kWh)', key: 'energy_kwh', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Max kW', key: 'max_demand_kw', align: 'right', format: (v: number | null) => v ? v.toFixed(2) : '—' },
  { header: 'Cost (JOD)', key: 'cost_jod', align: 'right', format: (v: number | null) => v !== null ? v.toFixed(3) : 'N/C' },
  { header: 'Status', key: 'status' },
];

export default function AllTransactionsTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, energy: 0, revenue: 0, duration: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchAllTransactions({
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
        startTime: filters.startTime || undefined,
        endTime: filters.endTime || undefined,
        stationId: filters.stationId || undefined,
        cardNumber: filters.cardNumber || undefined,
        search: filters.search || undefined,
      });
      setRows(result.rows);
      setTotals(result.totals);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      if (type === 'pdf') await exportTransactionsPDF(rows, totals, filters);
      if (type === 'excel') exportTransactionsExcel(rows, filters);
      if (type === 'csv') exportTransactionsCSV(rows, filters);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const cards: SummaryCard[] = [
    { label: 'Total Sessions', value: totals.sessions, format: 'number', icon: FileText },
    { label: 'Total Energy', value: totals.energy, format: 'number', icon: Zap },
    { label: 'Total Duration', value: `${totals.duration.toFixed(0)} min`, format: 'string', icon: Clock },
    { label: 'Total Revenue', value: totals.revenue, format: 'currency', icon: DollarSign },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            onExportCSV={() => handleExport('csv')}
            onPrint={() => window.print()}
            loading={exporting}
          />
        </>
      )}
      <ReportDataTable
        columns={tableColumns}
        data={rows}
        loading={loading}
        showTotals={true}
        totalsRow={{
          transaction_id: `${totals.sessions} records`,
          energy_kwh: totals.energy.toFixed(3),
          duration_minutes: totals.duration.toFixed(2),
          cost_jod: totals.revenue.toFixed(3),
        }}
      />
    </div>
  );
}
