/**
 * EV-E Reporting v2 — Excel and PDF export built exclusively on authoritative
 * report_* RPC results (never on shifts.total_* / calculated_cost).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  addBrandedPdfHeader,
  addFilterSummary,
  addSummaryStrip,
  addPdfFooter,
  downloadPdf,
  exportToExcelMultiSheet,
  type ColumnDef,
} from './reportUtils';
import type {
  BillingReconciliationRow,
  CashHandoverSummaryRow,
  ExceptionRow,
  ImportReconciliationRow,
  OperatorShiftSummaryRow,
  PaymentMethodSummary,
  PaymentReconciliationRow,
  RevenueSummaryRow,
  StationDailySummaryRow,
} from './reportingV2Service';

function money(v: number | null | undefined): string {
  return (Number(v) || 0).toFixed(3);
}

interface ExportScope {
  startDate: string;
  endDate: string;
  stationName?: string;
  generatedBy?: string;
}

export function exportFinancialReconciliationExcel(
  scope: ExportScope,
  data: {
    revenue: RevenueSummaryRow[];
    paymentSummary: PaymentMethodSummary;
    paymentReconciliation: PaymentReconciliationRow[];
    stationDaily: StationDailySummaryRow[];
    operatorShift: OperatorShiftSummaryRow[];
    handovers: CashHandoverSummaryRow[];
    importReconciliation: ImportReconciliationRow[];
    billingReconciliation: BillingReconciliationRow[];
    exceptions: ExceptionRow[];
  }
) {
  const summaryRows = [
    { label: 'Report', value: 'EV-E Authoritative Financial Reconciliation' },
    { label: 'Date range (Asia/Amman)', value: `${scope.startDate} to ${scope.endDate}` },
    { label: 'Station', value: scope.stationName || 'All stations' },
    { label: 'Generated', value: format(new Date(), 'yyyy-MM-dd HH:mm') + ' (local browser time)' },
    { label: 'Currency', value: 'JOD (3 decimal places)' },
    { label: 'Billing total', value: money(data.paymentSummary.billing_total) },
    { label: 'Cash total', value: money(data.paymentSummary.cash_total) },
    { label: 'Card total', value: money(data.paymentSummary.card_total) },
    { label: 'CliQ total', value: money(data.paymentSummary.cliq_total) },
    { label: 'Unassigned total', value: money(data.paymentSummary.unassigned_total) },
    { label: 'Sessions', value: String(data.paymentSummary.session_count) },
    { label: 'Demand Charge', value: '0.000 (not applicable — retired)' },
    { label: 'Tax', value: '0.000 (not applicable)' },
  ];

  exportToExcelMultiSheet(
    [
      {
        name: 'Summary',
        rows: summaryRows,
        columns: [
          { header: 'Field', key: 'label', width: 30 },
          { header: 'Value', key: 'value', width: 40 },
        ],
      },
      {
        name: 'Revenue by Day',
        rows: data.revenue,
        columns: [
          { header: 'Date', key: 'report_date', width: 12 },
          { header: 'Station', key: 'station_name', width: 20 },
          { header: 'Sessions', key: 'session_count', width: 10 },
          { header: 'Energy (kWh)', key: 'energy_kwh', width: 14, format: money },
          { header: 'Billing Total (JOD)', key: 'billing_total', width: 16, format: money },
          { header: 'v2 Engine Count', key: 'v2_count', width: 14 },
          { header: 'Legacy/Unknown Count', key: 'legacy_count', width: 16 },
        ] as ColumnDef[],
      },
      {
        name: 'Payment Reconciliation',
        rows: data.paymentReconciliation,
        columns: [
          { header: 'Date', key: 'report_date', width: 12 },
          { header: 'Station', key: 'station_name', width: 20 },
          { header: 'Billing Total', key: 'billing_total', width: 14, format: money },
          { header: 'Cash', key: 'cash_total', width: 12, format: money },
          { header: 'Card', key: 'card_total', width: 12, format: money },
          { header: 'CliQ', key: 'cliq_total', width: 12, format: money },
          { header: 'Unassigned', key: 'unassigned_total', width: 12, format: money },
          { header: 'Difference', key: 'difference', width: 12, format: money },
          { header: 'Reconciled', key: 'reconciled', width: 12, format: (v) => (v ? 'YES' : 'NO') },
        ] as ColumnDef[],
      },
      {
        name: 'Station Daily',
        rows: data.stationDaily,
        columns: [
          { header: 'Date', key: 'report_date', width: 12 },
          { header: 'Station', key: 'station_name', width: 20 },
          { header: 'Sessions', key: 'session_count', width: 10 },
          { header: 'Energy (kWh)', key: 'energy_kwh', width: 14, format: money },
          { header: 'Billing Total', key: 'billing_total', width: 14, format: money },
          { header: 'Expected Cash', key: 'expected_cash', width: 14, format: money },
          { header: 'Actual Cash', key: 'actual_cash', width: 14, format: money },
          { header: 'Shortage', key: 'shortage', width: 12, format: money },
          { header: 'Surplus', key: 'surplus', width: 12, format: money },
          { header: 'Handovers', key: 'handover_count', width: 10 },
          { header: 'Locked', key: 'locked_handover_count', width: 10 },
        ] as ColumnDef[],
      },
      {
        name: 'Operator Shifts',
        rows: data.operatorShift,
        columns: [
          { header: 'Date', key: 'shift_date', width: 12 },
          { header: 'Operator', key: 'operator_name', width: 20 },
          { header: 'Station', key: 'station_name', width: 18 },
          { header: 'Sessions', key: 'session_count', width: 10 },
          { header: 'Energy (kWh)', key: 'energy_kwh', width: 14, format: money },
          { header: 'Billing Total', key: 'billing_total', width: 14, format: money },
          { header: 'Cash', key: 'cash_total', width: 10, format: money },
          { header: 'Card', key: 'card_total', width: 10, format: money },
          { header: 'CliQ', key: 'cliq_total', width: 10, format: money },
          { header: 'Unassigned', key: 'unassigned_total', width: 12, format: money },
          { header: 'Handover #', key: 'handover_number', width: 16 },
          { header: 'Handover Status', key: 'handover_status', width: 14 },
          { header: 'Operational Total (aggregate)', key: 'operational_total_amount_jod', width: 18, format: money },
          { header: 'Operational Reconciled?', key: 'operational_reconciled', width: 16, format: (v) => (v ? 'YES' : 'NO') },
        ] as ColumnDef[],
      },
      {
        name: 'Cash Handovers',
        rows: data.handovers,
        columns: [
          { header: 'Handover #', key: 'handover_number', width: 18 },
          { header: 'Date', key: 'shift_date', width: 12 },
          { header: 'Station', key: 'station_name', width: 18 },
          { header: 'Operator', key: 'operator_name', width: 18 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Version', key: 'version', width: 8 },
          { header: 'Billing Total', key: 'billing_total', width: 12, format: money },
          { header: 'Cash', key: 'cash_total', width: 10, format: money },
          { header: 'Card', key: 'card_total', width: 10, format: money },
          { header: 'CliQ', key: 'cliq_total', width: 10, format: money },
          { header: 'Expected Cash', key: 'expected_cash', width: 12, format: money },
          { header: 'Actual Cash', key: 'actual_cash_received', width: 12, format: money },
          { header: 'Shortage', key: 'shortage_amount', width: 10, format: money },
          { header: 'Surplus', key: 'surplus_amount', width: 10, format: money },
          { header: 'Adjustments', key: 'net_adjustments', width: 12, format: money },
          { header: 'Discrepancy Reason', key: 'discrepancy_reason', width: 30 },
        ] as ColumnDef[],
      },
      {
        name: 'Import Reconciliation',
        rows: data.importReconciliation,
        columns: [
          { header: 'Filename', key: 'filename', width: 28 },
          { header: 'File Hash', key: 'file_hash', width: 20 },
          { header: 'Station', key: 'station_name', width: 16 },
          { header: 'Operator', key: 'operator_name', width: 16 },
          { header: 'Match Status', key: 'operator_match_status', width: 12 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Total', key: 'records_total', width: 8 },
          { header: 'Success', key: 'records_success', width: 8 },
          { header: 'Failed', key: 'records_failed', width: 8 },
          { header: 'Skipped', key: 'records_skipped', width: 8 },
          { header: 'Billed', key: 'billed_count', width: 8 },
          { header: 'Billing Failed', key: 'billing_failed_count', width: 12 },
        ] as ColumnDef[],
      },
      {
        name: 'Billing Reconciliation',
        rows: data.billingReconciliation,
        columns: [
          { header: 'Transaction ID', key: 'transaction_id', width: 16 },
          { header: 'Engine', key: 'engine_version', width: 14 },
          { header: 'Billing Total', key: 'billing_total', width: 12, format: money },
          { header: 'Breakdown Sum', key: 'breakdown_sum', width: 12, format: money },
          { header: 'Difference', key: 'difference', width: 10, format: money },
          { header: 'Demand', key: 'demand_charge_sum', width: 10, format: money },
          { header: 'Tax', key: 'taxes', width: 8, format: money },
          { header: 'Payment Method', key: 'payment_method', width: 14 },
          { header: 'Handover #', key: 'handover_number', width: 16 },
          { header: 'Status', key: 'exception_status', width: 16 },
        ] as ColumnDef[],
      },
      {
        name: 'Exceptions',
        rows: data.exceptions,
        columns: [
          { header: 'Type', key: 'exception_type', width: 20 },
          { header: 'Date', key: 'occurred_on', width: 12 },
          { header: 'Transaction ID', key: 'transaction_id', width: 16 },
          { header: 'Detail', key: 'detail', width: 40 },
          { header: 'Amount', key: 'amount', width: 12, format: money },
        ] as ColumnDef[],
      },
    ],
    `EV-E_Financial_Reconciliation_${scope.startDate}_to_${scope.endDate}.xlsx`
  );
}

/** Cash Handover PDF — states "Locked Financial Snapshot" when the handover is locked. */
export async function exportCashHandoverPdf(handover: {
  handover_number: string;
  station_name?: string;
  operator_name?: string;
  shift_date: string;
  status: string;
  version: number;
  billing_total: number;
  cash_total: number;
  card_total: number;
  cliq_total: number;
  expected_cash: number;
  actual_cash_received: number | null;
  shortage_amount: number;
  surplus_amount: number;
  net_adjustments: number;
  discrepancy_reason?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  locked_at?: string | null;
  reopened_at?: string | null;
}, sessions: Array<{ transaction_id: string; start_ts: string; amount_jod: number; payment_method: string }>,
   adjustments: Array<{ cash_impact: string; amount_jod: number; status: string; reason: string }>,
   events: Array<{ from_status: string | null; to_status: string; action: string; actor_id: string | null; created_at: string; reason?: string | null }>
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const isLocked = handover.status === 'locked';

  let y = await addBrandedPdfHeader(
    doc,
    isLocked ? 'Locked Financial Snapshot' : 'Cash Handover Report',
    `Handover ${handover.handover_number} — v${handover.version}`
  );

  y = addFilterSummary(
    doc,
    {
      period: handover.shift_date,
      station: handover.station_name,
      operator: handover.operator_name,
      status: handover.status.toUpperCase(),
    },
    y
  );

  if (isLocked) {
    doc.setFillColor(255, 244, 214);
    doc.rect(14, y - 2, doc.internal.pageSize.width - 28, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(140, 90, 0);
    doc.text('LOCKED FINANCIAL SNAPSHOT — values below are frozen at lock time', 18, y + 3);
    doc.setTextColor(0);
    y += 12;
  }

  y = addSummaryStrip(
    doc,
    `Billing: ${money(handover.billing_total)} JOD  |  Cash: ${money(handover.cash_total)}  |  Card: ${money(handover.card_total)}  |  CliQ: ${money(handover.cliq_total)}`,
    y
  );

  autoTable(doc, {
    startY: y + 2,
    head: [['Field', 'Value']],
    body: [
      ['Expected Cash', money(handover.expected_cash) + ' JOD'],
      ['Actual Cash Received', handover.actual_cash_received != null ? money(handover.actual_cash_received) + ' JOD' : '—'],
      ['Shortage', money(handover.shortage_amount) + ' JOD'],
      ['Surplus', money(handover.surplus_amount) + ' JOD'],
      ['Approved Adjustments (net)', money(handover.net_adjustments) + ' JOD'],
      ['Discrepancy Reason', handover.discrepancy_reason || '—'],
      ['Demand Charge', '0.000 (not applicable)'],
      ['Tax', '0.000 (not applicable)'],
      ['Submitted', handover.submitted_at ? format(new Date(handover.submitted_at), 'yyyy-MM-dd HH:mm') : '—'],
      ['Approved', handover.approved_at ? format(new Date(handover.approved_at), 'yyyy-MM-dd HH:mm') : '—'],
      ['Locked', handover.locked_at ? format(new Date(handover.locked_at), 'yyyy-MM-dd HH:mm') : '—'],
      ['Reopened', handover.reopened_at ? format(new Date(handover.reopened_at), 'yyyy-MM-dd HH:mm') : '—'],
    ],
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138] },
  });

  let afterTableY = (doc as any).lastAutoTable.finalY + 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Included Sessions (snapshot)', 14, afterTableY);
  autoTable(doc, {
    startY: afterTableY + 3,
    head: [['Transaction ID', 'Start', 'Payment Method', 'Amount (JOD)']],
    body: sessions.map((s) => [
      s.transaction_id,
      format(new Date(s.start_ts), 'yyyy-MM-dd HH:mm'),
      s.payment_method,
      money(s.amount_jod),
    ]),
    theme: 'striped',
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 58, 138] },
    margin: { bottom: 20 },
  });

  afterTableY = (doc as any).lastAutoTable.finalY + 6;

  if (adjustments.length) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Adjustments', 14, afterTableY);
    autoTable(doc, {
      startY: afterTableY + 3,
      head: [['Direction', 'Amount (JOD)', 'Status', 'Reason']],
      body: adjustments.map((a) => [a.cash_impact, money(a.amount_jod), a.status, a.reason]),
      theme: 'striped',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 58, 138] },
    });
    afterTableY = (doc as any).lastAutoTable.finalY + 6;
  }

  if (events.length) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Audit / Status History', 14, afterTableY);
    autoTable(doc, {
      startY: afterTableY + 3,
      head: [['When', 'From', 'To', 'Action', 'Reason']],
      body: events.map((e) => [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm'),
        e.from_status || '—',
        e.to_status,
        e.action,
        e.reason || '—',
      ]),
      theme: 'striped',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 58, 138] },
    });
  }

  addPdfFooter(doc, isLocked ? 'Locked Financial Snapshot' : undefined);
  downloadPdf(doc, `EV-E_Handover_${handover.handover_number}.pdf`);
}
