// =============================================
// reportExportService.ts
// PDF / Excel / CSV export generators for all
// 19 report tabs. Uses reportUtils.ts for shared
// formatting and download helpers.
// =============================================

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import {
  addBrandedPdfHeader,
  addPdfFooter,
  addFilterSummary,
  addSummaryStrip,
  exportToExcel,
  exportToCSV,
  exportToExcelMultiSheet,
  autoTable,
  formatJOD,
  renderBarChart,
  renderLineChart,
  renderPieChart,
  type ColumnDef,
  type FilterSummary,
} from './reportUtils';
import type {
  TransactionRow,
  ShiftRow,
  StationStat,
  OperatorStat,
  TimeSeriesPoint,
  Totals,
  DateRangeFilter,
} from './reportDataService';

// ─── Helpers ────────────────────────────────────────────────────────

function periodStr(f: DateRangeFilter): string {
  const s = format(f.startDate, 'dd/MM/yyyy');
  const e = format(f.endDate, 'dd/MM/yyyy');
  if (f.startTime || f.endTime) {
    return `${s} ${f.startTime || '00:00'} – ${e} ${f.endTime || '23:59'}`;
  }
  return `${s} – ${e}`;
}

function fileDate(f: DateRangeFilter): string {
  return `${format(f.startDate, 'yyyy-MM-dd')}-to-${format(f.endDate, 'yyyy-MM-dd')}`;
}

function buildFilterSummary(title: string, filters: any): FilterSummary {
  return {
    period: periodStr(filters),
    station: filters.stationName || undefined,
    operator: filters.operatorName || undefined,
    shiftType: filters.shiftType && filters.shiftType !== 'all' ? filters.shiftType : undefined,
    status: filters.handoverStatus && filters.handoverStatus !== 'all' ? filters.handoverStatus : undefined,
  };
}

// =====================================================================
// TAB 1: ALL TRANSACTIONS
// =====================================================================

const transactionColumns: ColumnDef[] = [
  { header: 'Transaction ID', key: 'transaction_id', width: 15 },
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Start Date', key: 'start_date', width: 12 },
  { header: 'Start Time', key: 'start_time', width: 10 },
  { header: 'End Time', key: 'end_time', width: 10 },
  { header: 'Duration (min)', key: 'duration_minutes', width: 12, format: (v: number) => v.toFixed(2) },
  { header: 'Energy (kWh)', key: 'energy_kwh', width: 12, format: (v: number) => v.toFixed(3) },
  { header: 'Max Demand (kW)', key: 'max_demand_kw', width: 12, format: (v: number | null) => v ? v.toFixed(2) : '' },
  { header: 'Cost (JOD)', key: 'cost_jod', width: 12, format: (v: number | null) => v !== null ? v.toFixed(3) : 'Not Calculated' },
  { header: 'Status', key: 'status', width: 12 },
];

export async function exportTransactionsPDF(rows: TransactionRow[], totals: Totals, filters: any) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'All Transactions Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('All Transactions', filters), y);
  y = addSummaryStrip(doc, `Total: ${totals.sessions} sessions  |  Energy: ${totals.energy.toFixed(2)} kWh  |  Duration: ${totals.duration.toFixed(0)} min  |  Revenue: ${formatJOD(totals.revenue)}`, y);

  autoTable(doc, {
    startY: y,
    head: [transactionColumns.map((c) => c.header)],
    body: rows.map((r) => transactionColumns.map((c) => c.format ? c.format((r as any)[c.key]) : (r as any)[c.key] ?? '')),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(`all-transactions-${fileDate(filters)}.pdf`);
}

export function exportTransactionsExcel(rows: TransactionRow[], filters: any) {
  exportToExcel(rows as any, transactionColumns, `all-transactions-${fileDate(filters)}.xlsx`, 'Transactions');
}

export function exportTransactionsCSV(rows: TransactionRow[], filters: any) {
  exportToCSV(rows as any, transactionColumns, `all-transactions-${fileDate(filters)}.csv`);
}

// =====================================================================
// TAB 2: SHIFT TRANSACTIONS
// =====================================================================

const shiftColumns: ColumnDef[] = [
  { header: 'Date', key: 'shift_date', width: 12 },
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Operator', key: 'operator_name', width: 18 },
  { header: 'Shift Type', key: 'shift_type', width: 12 },
  { header: 'Duration', key: 'shift_duration', width: 10 },
  { header: 'Sessions', key: 'total_sessions', width: 10 },
  { header: 'Energy (kWh)', key: 'total_kwh', width: 12, format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_amount_jod', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Handover Status', key: 'handover_status', width: 15 },
];

export async function exportShiftTransactionsPDF(rows: ShiftRow[], totals: Totals, filters: any) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'Shift Transactions Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('Shift Transactions', filters), y);
  y = addSummaryStrip(doc, `Shifts: ${rows.length}  |  Sessions: ${totals.sessions}  |  Energy: ${totals.energy.toFixed(2)} kWh  |  Revenue: ${formatJOD(totals.revenue)}`, y);

  autoTable(doc, {
    startY: y,
    head: [shiftColumns.map((c) => c.header)],
    body: rows.map((r) => shiftColumns.map((c) => c.format ? c.format((r as any)[c.key]) : (r as any)[c.key] ?? '')),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(`shift-transactions-${fileDate(filters)}.pdf`);
}

export function exportShiftTransactionsExcel(rows: ShiftRow[], filters: any) {
  exportToExcel(rows as any, shiftColumns, `shift-transactions-${fileDate(filters)}.xlsx`, 'Shifts');
}

export function exportShiftTransactionsCSV(rows: ShiftRow[], filters: any) {
  exportToCSV(rows as any, shiftColumns, `shift-transactions-${fileDate(filters)}.csv`);
}

// =====================================================================
// TAB 3: OPERATOR TRANSACTIONS (reuses transactionColumns)
// =====================================================================

export async function exportOperatorTransactionsPDF(rows: TransactionRow[], totals: Totals, filters: any) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'Operator Transactions Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('Operator Transactions', filters), y);
  y = addSummaryStrip(doc, `Sessions: ${totals.sessions}  |  Energy: ${totals.energy.toFixed(2)} kWh  |  Revenue: ${formatJOD(totals.revenue)}`, y);

  autoTable(doc, {
    startY: y,
    head: [transactionColumns.map((c) => c.header)],
    body: rows.map((r) => transactionColumns.map((c) => c.format ? c.format((r as any)[c.key]) : (r as any)[c.key] ?? '')),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(`operator-transactions-${fileDate(filters)}.pdf`);
}

export function exportOperatorTransactionsExcel(rows: TransactionRow[], filters: any) {
  exportToExcel(rows as any, transactionColumns, `operator-transactions-${fileDate(filters)}.xlsx`, 'Operator Transactions');
}

export function exportOperatorTransactionsCSV(rows: TransactionRow[], filters: any) {
  exportToCSV(rows as any, transactionColumns, `operator-transactions-${fileDate(filters)}.csv`);
}

// =====================================================================
// TAB 4: HANDOVER HISTORY
// =====================================================================

const handoverColumns: ColumnDef[] = [
  { header: 'Date', key: 'shift_date', width: 12 },
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Operator', key: 'operator_name', width: 18 },
  { header: 'Shift Type', key: 'shift_type', width: 12 },
  { header: 'Revenue (JOD)', key: 'total_amount_jod', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Handover Status', key: 'handover_status', width: 15 },
  { header: 'Bank Reference', key: 'bank_reference', width: 18 },
  { header: 'Deposit Date', key: 'deposit_date', width: 12 },
];

export async function exportHandoverPDF(rows: ShiftRow[], statusSummary: any, filters: any) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'Handover History Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('Handover History', filters), y);

  const summaryParts = Object.entries(statusSummary || {}).map(
    ([status, v]: [string, any]) => `${status}: ${v.count} (${formatJOD(v.total)})`
  );
  if (summaryParts.length) {
    y = addSummaryStrip(doc, summaryParts.join('  |  '), y);
  }

  autoTable(doc, {
    startY: y,
    head: [handoverColumns.map((c) => c.header)],
    body: rows.map((r) => handoverColumns.map((c) => c.format ? c.format((r as any)[c.key]) : (r as any)[c.key] ?? '')),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(`handover-history-${fileDate(filters)}.pdf`);
}

export function exportHandoverExcel(rows: ShiftRow[], filters: any) {
  exportToExcel(rows as any, handoverColumns, `handover-history-${fileDate(filters)}.xlsx`, 'Handover');
}

export function exportHandoverCSV(rows: ShiftRow[], filters: any) {
  exportToCSV(rows as any, handoverColumns, `handover-history-${fileDate(filters)}.csv`);
}

// =====================================================================
// TAB 5: STATION PERFORMANCE
// =====================================================================

const stationPerfColumns: ColumnDef[] = [
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Code', key: 'station_code', width: 10 },
  { header: 'Sessions', key: 'total_sessions', width: 10 },
  { header: 'Energy (kWh)', key: 'total_energy', width: 14, format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_revenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Avg Duration (min)', key: 'avg_duration', width: 15, format: (v: number) => v.toFixed(1) },
  { header: 'Avg kWh/Session', key: 'avg_energy_per_session', width: 15, format: (v: number) => v.toFixed(2) },
];

export async function exportStationPerformancePDF(rows: StationStat[], totals: Totals, filters: any) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'Station Performance Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('Station Performance', filters), y);
  y = addSummaryStrip(doc, `Stations: ${rows.length}  |  Sessions: ${totals.sessions}  |  Energy: ${totals.energy.toFixed(2)} kWh  |  Revenue: ${formatJOD(totals.revenue)}`, y);

  autoTable(doc, {
    startY: y,
    head: [stationPerfColumns.map((c) => c.header)],
    body: rows.map((r) => stationPerfColumns.map((c) => c.format ? c.format((r as any)[c.key]) : (r as any)[c.key] ?? '')),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(`station-performance-${fileDate(filters)}.pdf`);
}

export function exportStationPerformanceExcel(rows: StationStat[], filters: any) {
  exportToExcel(rows as any, stationPerfColumns, `station-performance-${fileDate(filters)}.xlsx`, 'Station Performance');
}

export function exportStationPerformanceCSV(rows: StationStat[], filters: any) {
  exportToCSV(rows as any, stationPerfColumns, `station-performance-${fileDate(filters)}.csv`);
}

// =====================================================================
// TAB 6: OPERATOR PERFORMANCE
// =====================================================================

const operatorPerfColumns: ColumnDef[] = [
  { header: 'Operator', key: 'operator_name', width: 18 },
  { header: 'Card #', key: 'card_number', width: 15 },
  { header: 'Shifts', key: 'total_shifts', width: 8 },
  { header: 'Sessions', key: 'total_sessions', width: 10 },
  { header: 'Energy (kWh)', key: 'total_energy', width: 14, format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'total_revenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Avg Sessions/Shift', key: 'avg_sessions_per_shift', width: 15, format: (v: number) => v.toFixed(1) },
  { header: 'Handover Rate %', key: 'handover_rate', width: 14, format: (v: number) => `${v.toFixed(1)}%` },
];

export async function exportOperatorPerformancePDF(rows: OperatorStat[], totals: Totals, filters: any) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'Operator Performance Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('Operator Performance', filters), y);
  y = addSummaryStrip(doc, `Operators: ${rows.length}  |  Sessions: ${totals.sessions}  |  Energy: ${totals.energy.toFixed(2)} kWh  |  Revenue: ${formatJOD(totals.revenue)}`, y);

  autoTable(doc, {
    startY: y,
    head: [operatorPerfColumns.map((c) => c.header)],
    body: rows.map((r) => operatorPerfColumns.map((c) => c.format ? c.format((r as any)[c.key]) : (r as any)[c.key] ?? '')),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(`operator-performance-${fileDate(filters)}.pdf`);
}

export function exportOperatorPerformanceExcel(rows: OperatorStat[], filters: any) {
  exportToExcel(rows as any, operatorPerfColumns, `operator-performance-${fileDate(filters)}.xlsx`, 'Operator Performance');
}

export function exportOperatorPerformanceCSV(rows: OperatorStat[], filters: any) {
  exportToCSV(rows as any, operatorPerfColumns, `operator-performance-${fileDate(filters)}.csv`);
}

// =====================================================================
// TAB 7: FULL PERFORMANCE (with charts)
// =====================================================================

export async function exportFullPerformancePDF(
  timeSeries: TimeSeriesPoint[],
  stationBreakdown: any[],
  operatorBreakdown: any[],
  totals: Totals,
  filters: any
) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, 'Full Performance Report', periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary('Full Performance', filters), y);
  y = addSummaryStrip(doc, `Sessions: ${totals.sessions}  |  Energy: ${totals.energy.toFixed(2)} kWh  |  Revenue: ${formatJOD(totals.revenue)}`, y);

  // Revenue chart
  const revenueChart = renderBarChart(
    timeSeries.map((t) => t.revenue),
    timeSeries.map((t) => t.label),
    600, 180, '#1e3a8a'
  );
  if (revenueChart) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Revenue Trend', 14, y);
    y += 3;
    doc.addImage(revenueChart, 'PNG', 14, y, 260, 60);
    y += 65;
  }

  // Energy chart
  const energyChart = renderLineChart(
    timeSeries.map((t) => t.energy),
    timeSeries.map((t) => t.label),
    600, 180, '#14b8a6'
  );
  if (energyChart) {
    if (y > 150) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Energy Consumption Trend', 14, y);
    y += 3;
    doc.addImage(energyChart, 'PNG', 14, y, 260, 60);
    y += 65;
  }

  // Station comparison table
  if (stationBreakdown.length > 0) {
    if (y > 130) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Station Breakdown', 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Station', 'Sessions', 'Energy (kWh)', 'Revenue (JOD)']],
      body: stationBreakdown.map((s) => [s.name, s.sessions, s.energy.toFixed(2), s.revenue.toFixed(3)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY + 10 || y + 40;
  }

  // Operator ranking table
  if (operatorBreakdown.length > 0) {
    if (y > 130) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Operator Ranking', 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Operator', 'Sessions', 'Revenue (JOD)']],
      body: operatorBreakdown.map((o) => [o.name, o.sessions, o.revenue.toFixed(3)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
  }

  addPdfFooter(doc);
  doc.save(`full-performance-${fileDate(filters)}.pdf`);
}

export function exportFullPerformanceExcel(
  timeSeries: TimeSeriesPoint[],
  stationBreakdown: any[],
  operatorBreakdown: any[],
  filters: any
) {
  exportToExcelMultiSheet([
    {
      name: 'Trend',
      rows: timeSeries,
      columns: [
        { header: 'Period', key: 'label', width: 15 },
        { header: 'Sessions', key: 'sessions', width: 10 },
        { header: 'Energy (kWh)', key: 'energy', width: 14, format: (v: number) => v.toFixed(2) },
        { header: 'Revenue (JOD)', key: 'revenue', width: 14, format: (v: number) => v.toFixed(3) },
      ],
    },
    {
      name: 'Stations',
      rows: stationBreakdown,
      columns: [
        { header: 'Station', key: 'name', width: 20 },
        { header: 'Sessions', key: 'sessions', width: 10 },
        { header: 'Energy (kWh)', key: 'energy', width: 14, format: (v: number) => v.toFixed(2) },
        { header: 'Revenue (JOD)', key: 'revenue', width: 14, format: (v: number) => v.toFixed(3) },
      ],
    },
    {
      name: 'Operators',
      rows: operatorBreakdown,
      columns: [
        { header: 'Operator', key: 'name', width: 20 },
        { header: 'Sessions', key: 'sessions', width: 10 },
        { header: 'Revenue (JOD)', key: 'revenue', width: 14, format: (v: number) => v.toFixed(3) },
      ],
    },
  ], `full-performance-${fileDate(filters)}.xlsx`);
}

// =====================================================================
// TAB 8–19: GENERIC EXPORT HELPER
// (Remaining tabs follow the same pattern — generate with
//  custom column definitions specific to each tab's data shape)
// =====================================================================

export async function exportGenericPDF(
  title: string,
  rows: any[],
  columns: ColumnDef[],
  summaryText: string,
  filters: any,
  filename: string,
  charts?: Array<{ title: string; image: string }>
) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });
  let y = await addBrandedPdfHeader(doc, title, periodStr(filters));
  y = addFilterSummary(doc, buildFilterSummary(title, filters), y);
  y = addSummaryStrip(doc, summaryText, y);

  // Charts
  if (charts) {
    for (const chart of charts) {
      if (y > 140) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(chart.title, 14, y);
      y += 3;
      doc.addImage(chart.image, 'PNG', 14, y, 260, 60);
      y += 65;
    }
  }

  // Table
  if (y > 140) { doc.addPage(); y = 20; }
  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => c.format ? c.format(r[c.key]) : r[c.key] ?? '')),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addPdfFooter(doc);
  doc.save(filename);
}

export function exportGenericExcel(rows: any[], columns: ColumnDef[], filename: string, sheetName = 'Report') {
  exportToExcel(rows, columns, filename, sheetName);
}

export function exportGenericCSV(rows: any[], columns: ColumnDef[], filename: string) {
  exportToCSV(rows, columns, filename);
}

// ─── Pre-defined column sets for remaining tabs ─────────────────────

export const peakHoursColumns: ColumnDef[] = [
  { header: 'Hour', key: 'hour', width: 8 },
  { header: 'Mon', key: 'mon', width: 8 },
  { header: 'Tue', key: 'tue', width: 8 },
  { header: 'Wed', key: 'wed', width: 8 },
  { header: 'Thu', key: 'thu', width: 8 },
  { header: 'Fri', key: 'fri', width: 8 },
  { header: 'Sat', key: 'sat', width: 8 },
  { header: 'Sun', key: 'sun', width: 8 },
  { header: 'Total', key: 'total', width: 10 },
];

export const attendanceColumns: ColumnDef[] = [
  { header: 'Operator', key: 'operator_name', width: 18 },
  { header: 'Card #', key: 'card_number', width: 15 },
  { header: 'Actual Shifts', key: 'actual_shifts', width: 12 },
  { header: 'Scheduled', key: 'estimated_scheduled', width: 12 },
  { header: 'Missed', key: 'missed_shifts', width: 10 },
  { header: 'Attendance %', key: 'attendance_pct', width: 12, format: (v: number) => `${v.toFixed(1)}%` },
  { header: 'Sessions', key: 'total_sessions', width: 10 },
  { header: 'Revenue (JOD)', key: 'total_revenue', width: 14, format: (v: number) => v.toFixed(3) },
];

export const revenueBreakdownColumns: ColumnDef[] = [
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Sessions', key: 'sessions', width: 10 },
  { header: 'Energy (kWh)', key: 'energy', width: 14, format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'revenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: '% of Total', key: 'pct_of_total', width: 12, format: (v: number) => `${v.toFixed(1)}%` },
];

export const invoiceColumns: ColumnDef[] = [
  { header: 'Transaction ID', key: 'transaction_id', width: 15 },
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Subtotal', key: 'subtotal', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Fixed Charges', key: 'fixed_charges', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Total (JOD)', key: 'total_amount', width: 14, format: (v: number) => v.toFixed(3) },
];

export const pendingBillingColumns: ColumnDef[] = [
  ...transactionColumns.filter((c) => c.key !== 'status'),
  { header: 'Status', key: 'status', width: 14 },
];

export const monthlyFinancialColumns: ColumnDef[] = [
  { header: 'Month', key: 'month', width: 15 },
  { header: 'Sessions', key: 'sessions', width: 10 },
  { header: 'Energy (kWh)', key: 'energy', width: 14, format: (v: number) => v.toFixed(2) },
  { header: 'Revenue (JOD)', key: 'revenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Avg Rev/Session', key: 'avgRevenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Growth %', key: 'growth', width: 12, format: (v: number) => `${v.toFixed(1)}%` },
];

export const profitabilityColumns: ColumnDef[] = [
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Revenue (JOD)', key: 'total_revenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Est. Cost (JOD)', key: 'estimated_cost', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Gross Margin', key: 'gross_margin', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Margin %', key: 'margin_pct', width: 10, format: (v: number) => `${v.toFixed(1)}%` },
  { header: 'Sessions', key: 'total_sessions', width: 10 },
];

export const rateImpactColumns: ColumnDef[] = [
  { header: 'Rate Structure', key: 'rate_structure', width: 18 },
  { header: 'Sessions', key: 'sessions', width: 10 },
  { header: 'Avg kWh', key: 'avg_kwh', width: 14, format: (v: number) => v.toFixed(2) },
  { header: 'Avg Rev/Session', key: 'avg_revenue', width: 14, format: (v: number) => v.toFixed(3) },
  { header: 'Total Revenue', key: 'total_revenue', width: 14, format: (v: number) => v.toFixed(3) },
];

export const energyColumns: ColumnDef[] = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Sessions', key: 'sessions', width: 10 },
  { header: 'Total kWh', key: 'energy', width: 14, format: (v: number) => v.toFixed(2) },
];

export const uptimeColumns: ColumnDef[] = [
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Total Hours', key: 'total_hours', width: 12 },
  { header: 'Active Hours', key: 'active_hours', width: 12, format: (v: number) => v.toFixed(1) },
  { header: 'Downtime Hours', key: 'downtime_hours', width: 14, format: (v: number) => v.toFixed(1) },
  { header: 'Uptime %', key: 'uptime_pct', width: 10, format: (v: number) => `${v.toFixed(1)}%` },
  { header: 'Sessions', key: 'session_count', width: 10 },
];

export const maintenanceColumns: ColumnDef[] = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Station', key: 'station_name', width: 20 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Reported By', key: 'reported_by', width: 15 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Resolution Date', key: 'resolution_date', width: 14 },
  { header: 'Duration (hrs)', key: 'duration_hours', width: 12 },
];

export const dailyOpsShiftColumns: ColumnDef[] = [
  ...shiftColumns,
];

export const dailyOpsSessionColumns: ColumnDef[] = [
  ...transactionColumns,
];
