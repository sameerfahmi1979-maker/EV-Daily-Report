import React, { useState } from 'react';
import { DollarSign, Zap, PieChart } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchRevenueBreakdown } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, revenueBreakdownColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Category', key: 'category' },
  { header: 'Sessions', key: 'sessions', align: 'right' },
  { header: 'Energy (kWh)', key: 'energy', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'revenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: '% of Total', key: 'pct_of_total', align: 'right', format: (v: number) => `${v.toFixed(1)}%` },
];

export default function RevenueBreakdownTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchRevenueBreakdown({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setRows(result.rows); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `revenue-breakdown-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Revenue Breakdown', rows, revenueBreakdownColumns, `Total Revenue: ${(totals.revenue || 0).toFixed(3)} JOD  |  Energy Charges: ${(totals.energyCharges || 0).toFixed(3)} JOD  |  Fixed Charges: ${(totals.fixedCharges || 0).toFixed(3)} JOD`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, revenueBreakdownColumns, `${fn}.xlsx`, 'Revenue');
      if (type === 'csv') exportGenericCSV(rows, revenueBreakdownColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Total Revenue', value: totals.revenue || 0, format: 'currency', icon: DollarSign },
    { label: 'Energy Charges', value: totals.energyCharges || 0, format: 'currency', icon: Zap },
    { label: 'Fixed Charges', value: totals.fixedCharges || 0, format: 'currency', icon: DollarSign, color: 'from-amber-500 to-orange-600' },
    { label: 'Calculations', value: totals.sessions || 0, format: 'number', icon: PieChart },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} />
          <div className="mb-4">
            <PerformanceChart type="pie" data={rows.map(r => r.revenue)} labels={rows.map(r => r.category)} title="Revenue by Category" width={400} height={350} />
          </div>
        </>
      )}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
