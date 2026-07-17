import React, { useState } from 'react';
import { FileText, DollarSign, Hash } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchInvoiceHistory } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, invoiceColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Transaction ID', key: 'transaction_id' },
  { header: 'Station', key: 'station_name' },
  { header: 'Date', key: 'date' },
  { header: 'Subtotal', key: 'subtotal', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Fixed Charges', key: 'fixed_charges', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Total (JOD)', key: 'total_amount', align: 'right', format: (v: number) => v.toFixed(3) },
];

export default function InvoiceHistoryTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchInvoiceHistory({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setRows(result.rows); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `invoice-history-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Invoice History', rows, invoiceColumns, `Invoices: ${totals.count || 0}  |  Total: ${(totals.totalInvoiced || 0).toFixed(3)} JOD  |  Avg: ${(totals.avgAmount || 0).toFixed(3)} JOD`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, invoiceColumns, `${fn}.xlsx`, 'Invoices');
      if (type === 'csv') exportGenericCSV(rows, invoiceColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Invoice Count', value: totals.count || 0, format: 'number', icon: Hash },
    { label: 'Total Invoiced', value: totals.totalInvoiced || 0, format: 'currency', icon: DollarSign },
    { label: 'Avg Amount', value: totals.avgAmount || 0, format: 'currency', icon: FileText },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
