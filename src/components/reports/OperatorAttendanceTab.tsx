import React, { useState } from 'react';
import { Users, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import { fetchOperatorAttendance } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, attendanceColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showOperator: true, showQuickDates: true };

const tableColumns: TableColumn[] = [
  { header: 'Operator', key: 'operator_name' },
  { header: 'Card #', key: 'card_number' },
  { header: 'Actual Shifts', key: 'actual_shifts', align: 'right' },
  { header: 'Scheduled', key: 'estimated_scheduled', align: 'right' },
  { header: 'Missed', key: 'missed_shifts', align: 'right' },
  { header: 'Attendance %', key: 'attendance_pct', align: 'right', format: (v: number) => `${v.toFixed(1)}%` },
  { header: 'Sessions', key: 'total_sessions', align: 'right' },
  { header: 'Revenue (JOD)', key: 'total_revenue', align: 'right', format: (v: number) => v.toFixed(3) },
];

export default function OperatorAttendanceTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchOperatorAttendance({
        startDate: new Date(filters.startDate), endDate: new Date(filters.endDate),
        stationId: filters.stationId || undefined, operatorId: filters.operatorId || undefined,
      });
      setRows(result.rows);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(true);
    try {
      const fn = `operator-attendance-${filters.startDate}-to-${filters.endDate}`;
      const avgAtt = rows.length > 0 ? rows.reduce((s, r) => s + r.attendance_pct, 0) / rows.length : 0;
      if (type === 'pdf') await exportGenericPDF('Operator Attendance', rows, attendanceColumns, `Operators: ${rows.length}  |  Avg Attendance: ${avgAtt.toFixed(1)}%`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(rows, attendanceColumns, `${fn}.xlsx`, 'Attendance');
      if (type === 'csv') exportGenericCSV(rows, attendanceColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const avgAttendance = rows.length > 0 ? rows.reduce((s, r) => s + r.attendance_pct, 0) / rows.length : 0;
  const totalActual = rows.reduce((s, r) => s + r.actual_shifts, 0);
  const totalMissed = rows.reduce((s, r) => s + r.missed_shifts, 0);

  const cards: SummaryCard[] = [
    { label: 'Operators', value: rows.length, format: 'number', icon: Users },
    { label: 'Avg Attendance', value: avgAttendance, format: 'percent', icon: CheckCircle },
    { label: 'Total Shifts', value: totalActual, format: 'number', icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
    { label: 'Missed Shifts', value: totalMissed, format: 'number', icon: XCircle, color: 'from-red-500 to-rose-600' },
  ];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {rows.length > 0 && (<><ReportSummaryCards cards={cards} /><ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} /></>)}
      <ReportDataTable columns={tableColumns} data={rows} loading={loading} />
    </div>
  );
}
