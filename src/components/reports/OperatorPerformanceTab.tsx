import React, { useState } from 'react';
import { Users, Zap, DollarSign, Award } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchOperatorPerformance, type OperatorStat, type Totals } from '../../lib/reportDataService';
import { exportOperatorPerformancePDF, exportOperatorPerformanceExcel, exportOperatorPerformanceCSV } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showOperator: true, showQuickDates: true };

const tableColumns: TableColumn[] = [
  { header: 'Operator', key: 'operator_name' },
  { header: 'Card #', key: 'card_number' },
  { header: 'Shifts', key: 'total_shifts', align: 'right' },
  { header: 'Sessions', key: 'total_sessions', align: 'right' },
  { header: 'Energy (kWh)', key: 'total_energy', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_revenue', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Avg Sess/Shift', key: 'avg_sessions_per_shift', align: 'right', format: (v: number) => v.toFixed(1) },
  { header: 'Handover %', key: 'handover_rate', align: 'right', format: (v: number) => `${v.toFixed(1)}%` },
];

export default function OperatorPerformanceTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<OperatorStat[]>([]);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, energy: 0, revenue: 0, duration: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchOperatorPerformance({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined, operatorId: filters.operatorId || undefined,
      });
      setRows(result.operatorStats); setTotals(result.totals);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      if (type === 'pdf') await exportOperatorPerformancePDF(rows, totals, filters);
      if (type === 'excel') exportOperatorPerformanceExcel(rows, filters);
      if (type === 'csv') exportOperatorPerformanceCSV(rows, filters);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = [
    { label: 'Operators', value: rows.length, format: 'number', icon: Users },
    { label: 'Total Sessions', value: totals.sessions, format: 'number', icon: Award },
    { label: 'Total Energy', value: totals.energy, format: 'number', icon: Zap },
    { label: 'Total Revenue', value: totals.revenue, format: 'currency', icon: DollarSign },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
