import React, { useState } from 'react';
import { Banknote, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchHandoverHistory, type ShiftRow } from '../../lib/reportDataService';
import { exportHandoverPDF, exportHandoverExcel, exportHandoverCSV } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showOperator: true, showHandoverStatus: true, showQuickDates: true };

const tableColumns: TableColumn[] = [
  { header: 'Date', key: 'shift_date' },
  { header: 'Station', key: 'station_name' },
  { header: 'Operator', key: 'operator_name' },
  { header: 'Type', key: 'shift_type' },
  { header: 'Revenue (JOD)', key: 'total_amount_jod', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Status', key: 'handover_status' },
  { header: 'Bank Ref', key: 'bank_reference' },
  { header: 'Deposit Date', key: 'deposit_date' },
];

export default function HandoverHistoryTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchHandoverHistory({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined, operatorId: filters.operatorId || undefined,
        handoverStatus: filters.handoverStatus,
      });
      setRows(result.rows); setStatusSummary(result.statusSummary);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      if (type === 'pdf') await exportHandoverPDF(rows, statusSummary, filters);
      if (type === 'excel') exportHandoverExcel(rows, filters);
      if (type === 'csv') exportHandoverCSV(rows, filters);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const pending = statusSummary.pending || { count: 0, total: 0 };
  const handedOver = statusSummary.handed_over || { count: 0, total: 0 };
  const deposited = statusSummary.deposited || { count: 0, total: 0 };

  const cards: SummaryCard[] = [
    { label: 'Total Records', value: rows.length, format: 'number', icon: Banknote },
    { label: 'Pending', value: pending.count, format: 'number', icon: AlertTriangle, color: 'from-yellow-500 to-amber-600' },
    { label: 'Handed Over', value: handedOver.count, format: 'number', icon: Clock, color: 'from-green-500 to-emerald-600' },
    { label: 'Deposited', value: deposited.count, format: 'number', icon: CheckCircle, color: 'from-blue-500 to-indigo-600' },
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
