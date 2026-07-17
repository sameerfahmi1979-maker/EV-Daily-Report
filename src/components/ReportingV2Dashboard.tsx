import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Banknote, CreditCard, Smartphone, AlertTriangle, Lock,
  RefreshCw, Download, FileText, ChevronRight, X, Info,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { getStations } from '../lib/stationService';
import { operatorService } from '../lib/operatorService';
import {
  isReportingV2Enabled,
  fetchRevenueSummary,
  fetchPaymentMethodSummary,
  fetchPaymentReconciliation,
  fetchStationDailySummary,
  fetchOperatorShiftSummary,
  fetchCashHandoverSummary,
  fetchHandoverDetail,
  fetchLockedHandoverSnapshot,
  fetchImportReconciliation,
  fetchBillingReconciliation,
  fetchExceptionSummary,
  fetchHistoricalEngineComparison,
  REPORT_MAX_RANGE_DAYS,
  type ReportFilters,
  type RevenueSummaryRow,
  type PaymentMethodSummary,
  type PaymentReconciliationRow,
  type StationDailySummaryRow,
  type OperatorShiftSummaryRow,
  type CashHandoverSummaryRow,
  type ImportReconciliationRow,
  type BillingReconciliationRow,
  type ExceptionRow,
  type HistoricalEngineRow,
} from '../lib/reportingV2Service';
import { exportFinancialReconciliationExcel, exportCashHandoverPdf } from '../lib/reportingV2ExportService';
import {
  isHistoricalComparisonEnabled,
  fetchHistoricalInventorySummary,
  fetchCorrectionQueue,
  type CorrectionQueueRow,
} from '../lib/historicalAuditService';

type Tab =
  | 'revenue' | 'payment' | 'station' | 'shifts' | 'handovers'
  | 'import' | 'billing' | 'exceptions' | 'historical' | 'audit';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'payment', label: 'Payment Reconciliation' },
  { key: 'station', label: 'Daily Station Summary' },
  { key: 'shifts', label: 'Operator Shift Report' },
  { key: 'handovers', label: 'Cash Handover Report' },
  { key: 'import', label: 'Import Reconciliation' },
  { key: 'billing', label: 'Billing Reconciliation' },
  { key: 'exceptions', label: 'Exceptions' },
  { key: 'historical', label: 'Historical / Legacy' },
  { key: 'audit', label: 'Historical Audit (Phase F)' },
];

function money(v: number | null | undefined): string {
  return (Number(v) || 0).toFixed(3);
}

function KpiCard({
  label, value, sub, tone = 'default', icon,
}: { label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' | 'warn'; icon?: React.ReactNode }) {
  const toneClass = {
    default: 'bg-white border-slate-200',
    good: 'bg-emerald-50 border-emerald-200',
    bad: 'bg-red-50 border-red-200',
    warn: 'bg-amber-50 border-amber-200',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ReportingV2Dashboard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('revenue');

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [stationId, setStationId] = useState<string>('');
  const [operatorId, setOperatorId] = useState<string>('');
  const [stations, setStations] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);

  const [revenue, setRevenue] = useState<RevenueSummaryRow[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentMethodSummary | null>(null);
  const [paymentReconciliation, setPaymentReconciliation] = useState<PaymentReconciliationRow[]>([]);
  const [stationDaily, setStationDaily] = useState<StationDailySummaryRow[]>([]);
  const [operatorShift, setOperatorShift] = useState<OperatorShiftSummaryRow[]>([]);
  const [handovers, setHandovers] = useState<CashHandoverSummaryRow[]>([]);
  const [importRecon, setImportRecon] = useState<ImportReconciliationRow[]>([]);
  const [billingRecon, setBillingRecon] = useState<BillingReconciliationRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [historical, setHistorical] = useState<HistoricalEngineRow[]>([]);

  const [auditEnabled, setAuditEnabled] = useState<boolean | null>(null);
  const [inventorySummary, setInventorySummary] = useState<Record<string, unknown> | null>(null);
  const [correctionQueue, setCorrectionQueue] = useState<CorrectionQueueRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [selectedHandover, setSelectedHandover] = useState<CashHandoverSummaryRow | null>(null);
  const [handoverDetail, setHandoverDetail] = useState<any>(null);
  const [lockedSnapshot, setLockedSnapshot] = useState<any>(null);

  useEffect(() => {
    isReportingV2Enabled().then(setEnabled);
    getStations().then(setStations).catch(() => setStations([]));
    operatorService.getAll().then(setOperators).catch(() => setOperators([]));
  }, []);

  const filters: ReportFilters = useMemo(
    () => ({ startDate, endDate, stationId: stationId || null, operatorId: operatorId || null }),
    [startDate, endDate, stationId, operatorId]
  );

  const rangeDays = useMemo(() => {
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    return Math.round((e - s) / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [rev, pay, payRecon, stDaily, opShift, ho, imp, bill, exc, hist] = await Promise.all([
        fetchRevenueSummary(filters),
        fetchPaymentMethodSummary(filters),
        fetchPaymentReconciliation(filters),
        fetchStationDailySummary(filters),
        fetchOperatorShiftSummary(filters),
        fetchCashHandoverSummary(filters),
        fetchImportReconciliation(filters),
        fetchBillingReconciliation(filters),
        fetchExceptionSummary(filters),
        fetchHistoricalEngineComparison(filters),
      ]);
      setRevenue(rev);
      setPaymentSummary(pay);
      setPaymentReconciliation(payRecon);
      setStationDaily(stDaily);
      setOperatorShift(opShift);
      setHandovers(ho);
      setImportRecon(imp);
      setBillingRecon(bill);
      setExceptions(exc);
      setHistorical(hist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reporting v2 data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (enabled) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, startDate, endDate, stationId, operatorId]);

  async function loadAudit() {
    setAuditLoading(true);
    try {
      const on = await isHistoricalComparisonEnabled();
      setAuditEnabled(on);
      if (!on) return;
      const [summary, queue] = await Promise.all([
        fetchHistoricalInventorySummary(startDate, endDate, stationId || null),
        fetchCorrectionQueue({ stationId: stationId || null, pageSize: 20 }),
      ]);
      setInventorySummary(summary);
      setCorrectionQueue(queue);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load historical audit data');
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (enabled && tab === 'audit') loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tab, startDate, endDate, stationId]);

  async function openHandover(h: CashHandoverSummaryRow) {
    setSelectedHandover(h);
    setHandoverDetail(null);
    setLockedSnapshot(null);
    try {
      const detail = await fetchHandoverDetail(h.handover_id);
      setHandoverDetail(detail);
      if (h.status === 'locked') {
        const snap = await fetchLockedHandoverSnapshot(h.handover_id);
        setLockedSnapshot(snap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load handover detail');
    }
  }

  const kpis = useMemo(() => {
    const unreconciledHandovers = handovers.filter((h) => h.unassigned_count > 0 && !['cancelled', 'rejected'].includes(h.status)).length;
    const lockedCount = handovers.filter((h) => h.status === 'locked').length;
    const pendingApproval = handovers.filter((h) => ['submitted', 'under_review', 'reopened'].includes(h.status)).length;
    const totalShortage = handovers.reduce((s, h) => s + Number(h.shortage_amount || 0), 0);
    const totalSurplus = handovers.reduce((s, h) => s + Number(h.surplus_amount || 0), 0);
    const totalAdjustments = handovers.reduce((s, h) => s + Number(h.net_adjustments || 0), 0);
    const billingFailures = exceptions.filter((e) => e.exception_type === 'billing_failure' || e.exception_type === 'missing_billing').length;
    const importExceptions = exceptions.filter((e) => e.exception_type.startsWith('missing') || e.exception_type === 'billing_failure').length;
    return {
      unreconciledHandovers, lockedCount, pendingApproval, totalShortage, totalSurplus, totalAdjustments,
      billingFailures, importExceptions,
    };
  }, [handovers, exceptions]);

  if (enabled === null) {
    return <div className="p-6 text-slate-500">Loading Reporting v2…</div>;
  }

  if (!enabled) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-semibold text-amber-900">Reporting v2 is not enabled</h3>
            <p className="text-sm text-amber-800 mt-1">
              This authoritative reporting layer is behind the <code>reporting_v2_enabled</code> feature flag.
              Ask a System Administrator to enable it, or use the existing Reports / Analytics pages in the meantime.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-blue-600" />
            Authoritative Financial Reporting (v2)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Every figure below derives from billing_calculations / session_payment_allocations / cash_handovers — never from mutable shift totals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={() =>
              exportFinancialReconciliationExcel(
                { startDate, endDate, stationName: stations.find((s) => s.id === stationId)?.name },
                {
                  revenue, paymentSummary: paymentSummary!, paymentReconciliation, stationDaily,
                  operatorShift, handovers, importReconciliation: importRecon, billingReconciliation: billingRecon,
                  exceptions,
                }
              )
            }
            disabled={loading || !paymentSummary}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-800 disabled:opacity-50"
          >
            <Download size={14} /> Export Excel (all sections)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Station</label>
          <select value={stationId} onChange={(e) => setStationId(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm min-w-[160px]">
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Operator</label>
          <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm min-w-[160px]">
            <option value="">All operators</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        {rangeDays > REPORT_MAX_RANGE_DAYS && (
          <span className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
            Range exceeds {REPORT_MAX_RANGE_DAYS} days — server will reject this query
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
      )}

      {/* KPI cards */}
      {paymentSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Energy (kWh)" value={money(revenue.reduce((s, r) => s + Number(r.energy_kwh), 0))} />
          <KpiCard label="Total Billed Revenue" value={money(paymentSummary.billing_total)} icon={<Banknote size={12} />} />
          <KpiCard label="Cash Revenue" value={money(paymentSummary.cash_total)} tone="good" icon={<Banknote size={12} />} />
          <KpiCard label="Card Revenue" value={money(paymentSummary.card_total)} icon={<CreditCard size={12} />} />
          <KpiCard label="CliQ Revenue" value={money(paymentSummary.cliq_total)} icon={<Smartphone size={12} />} />
          <KpiCard label="Unassigned Payments" value={money(paymentSummary.unassigned_total)} sub={`${paymentSummary.unassigned_count} sessions`} tone="warn" />
          <KpiCard label="Expected Cash" value={money(handovers.reduce((s, h) => s + Number(h.expected_cash), 0))} />
          <KpiCard label="Actual Cash Received" value={money(handovers.reduce((s, h) => s + Number(h.actual_cash_received || 0), 0))} />
          <KpiCard label="Shortage" value={money(kpis.totalShortage)} tone={kpis.totalShortage > 0 ? 'bad' : 'good'} />
          <KpiCard label="Surplus" value={money(kpis.totalSurplus)} tone={kpis.totalSurplus > 0 ? 'warn' : 'good'} />
          <KpiCard label="Approved Adjustments (net)" value={money(kpis.totalAdjustments)} />
          <KpiCard label="Unreconciled Handovers" value={String(kpis.unreconciledHandovers)} tone={kpis.unreconciledHandovers > 0 ? 'warn' : 'good'} icon={<AlertTriangle size={12} />} />
          <KpiCard label="Billing Failure Count" value={String(kpis.billingFailures)} tone={kpis.billingFailures > 0 ? 'bad' : 'good'} />
          <KpiCard label="Import Exception Count" value={String(kpis.importExceptions)} tone={kpis.importExceptions > 0 ? 'warn' : 'good'} />
          <KpiCard label="Locked Handover Count" value={String(kpis.lockedCount)} icon={<Lock size={12} />} />
          <KpiCard label="Pending Approval Count" value={String(kpis.pendingApproval)} tone={kpis.pendingApproval > 0 ? 'warn' : 'good'} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && tab === 'revenue' && (
        <TableBlock
          rows={revenue}
          columns={[
            ['report_date', 'Date'], ['station_name', 'Station'], ['session_count', 'Sessions'],
            ['energy_kwh', 'Energy (kWh)'], ['billing_total', 'Billing Total'], ['v2_count', 'v2 Engine'], ['legacy_count', 'Legacy/Unknown'],
          ]}
        />
      )}

      {!loading && tab === 'payment' && (
        <TableBlock
          rows={paymentReconciliation}
          columns={[
            ['report_date', 'Date'], ['station_name', 'Station'], ['billing_total', 'Billing'], ['cash_total', 'Cash'],
            ['card_total', 'Card'], ['cliq_total', 'CliQ'], ['unassigned_total', 'Unassigned'], ['difference', 'Diff'],
            ['reconciled', 'Reconciled'],
          ]}
          renderCell={(key, val) => (key === 'reconciled' ? (val ? '✅ Yes' : '❌ No') : undefined)}
        />
      )}

      {!loading && tab === 'station' && (
        <TableBlock
          rows={stationDaily}
          columns={[
            ['report_date', 'Date'], ['station_name', 'Station'], ['session_count', 'Sessions'], ['energy_kwh', 'Energy'],
            ['billing_total', 'Billing'], ['expected_cash', 'Expected Cash'], ['actual_cash', 'Actual Cash'],
            ['shortage', 'Shortage'], ['surplus', 'Surplus'], ['handover_count', 'Handovers'], ['locked_handover_count', 'Locked'],
          ]}
        />
      )}

      {!loading && tab === 'shifts' && (
        <TableBlock
          rows={operatorShift}
          columns={[
            ['shift_date', 'Date'], ['operator_name', 'Operator'], ['station_name', 'Station'], ['session_count', 'Sessions'],
            ['billing_total', 'Billing'], ['cash_total', 'Cash'], ['card_total', 'Card'], ['cliq_total', 'CliQ'],
            ['handover_number', 'Handover #'], ['handover_status', 'Handover Status'],
            ['operational_total_amount_jod', 'Operational Aggregate'], ['operational_reconciled', 'Reconciled?'],
          ]}
          renderCell={(key, val) => (key === 'operational_reconciled' ? (val ? '✅' : '⚠️ drift') : undefined)}
        />
      )}

      {!loading && tab === 'handovers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                {['Handover #', 'Date', 'Station', 'Operator', 'Status', 'Billing', 'Cash', 'Card', 'CliQ', 'Expected', 'Actual', 'Shortage', 'Surplus', ''].map((h) => (
                  <th key={h} className="p-2 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {handovers.map((h) => (
                <tr key={h.handover_id} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs">{h.handover_number}</td>
                  <td className="p-2">{h.shift_date}</td>
                  <td className="p-2">{h.station_name}</td>
                  <td className="p-2">{h.operator_name}</td>
                  <td className="p-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${h.status === 'locked' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>
                      {h.status}{h.status === 'locked' && <Lock size={10} className="inline ml-1" />}
                    </span>
                  </td>
                  <td className="p-2">{money(h.billing_total)}</td>
                  <td className="p-2">{money(h.cash_total)}</td>
                  <td className="p-2">{money(h.card_total)}</td>
                  <td className="p-2">{money(h.cliq_total)}</td>
                  <td className="p-2">{money(h.expected_cash)}</td>
                  <td className="p-2">{h.actual_cash_received != null ? money(h.actual_cash_received) : '—'}</td>
                  <td className={`p-2 ${Number(h.shortage_amount) > 0 ? 'text-red-700 font-medium' : ''}`}>{money(h.shortage_amount)}</td>
                  <td className={`p-2 ${Number(h.surplus_amount) > 0 ? 'text-amber-700 font-medium' : ''}`}>{money(h.surplus_amount)}</td>
                  <td className="p-2">
                    <button onClick={() => openHandover(h)} className="text-blue-600 hover:underline flex items-center gap-1">
                      Detail <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {handovers.length === 0 && (
                <tr><td colSpan={14} className="p-4 text-center text-slate-400">No handovers in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'import' && (
        <TableBlock
          rows={importRecon}
          columns={[
            ['filename', 'File'], ['station_name', 'Station'], ['operator_name', 'Operator'],
            ['operator_match_status', 'Match'], ['status', 'Status'], ['records_total', 'Total'],
            ['records_success', 'Success'], ['records_failed', 'Failed'], ['records_skipped', 'Skipped'],
            ['billed_count', 'Billed'], ['billing_failed_count', 'Billing Failed'],
          ]}
        />
      )}

      {!loading && tab === 'billing' && (
        <TableBlock
          rows={billingRecon}
          columns={[
            ['transaction_id', 'Transaction'], ['engine_version', 'Engine'], ['billing_total', 'Billing'],
            ['breakdown_sum', 'Breakdown Sum'], ['difference', 'Diff'], ['demand_charge_sum', 'Demand'],
            ['taxes', 'Tax'], ['payment_method', 'Payment'], ['handover_number', 'Handover'], ['exception_status', 'Status'],
          ]}
        />
      )}

      {!loading && tab === 'exceptions' && (
        <TableBlock
          rows={exceptions}
          columns={[
            ['exception_type', 'Type'], ['occurred_on', 'Date'], ['transaction_id', 'Transaction'],
            ['detail', 'Detail'], ['amount', 'Amount'],
          ]}
        />
      )}

      {!loading && tab === 'historical' && (
        <TableBlock
          rows={historical}
          columns={[
            ['engine_label', 'Engine'], ['session_count', 'Sessions'], ['billing_total', 'Billing Total'], ['avg_amount', 'Avg Amount'],
          ]}
        />
      )}

      {tab === 'audit' && (
        <div className="space-y-4">
          {auditLoading && <div className="text-sm text-slate-500">Loading historical audit…</div>}
          {!auditLoading && auditEnabled === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Historical audit/comparison is behind the <code>historical_comparison_enabled</code> feature flag
              and is currently disabled. Ask a System Administrator to enable it to browse the inventory
              summary and governed correction queue here.
            </div>
          )}
          {!auditLoading && auditEnabled && (
            <>
              {inventorySummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Total sessions" value={String(inventorySummary.total_sessions ?? 0)} />
                  <KpiCard label="Missing billing" value={String(inventorySummary.missing_billing_count ?? 0)} tone="warn" />
                  <KpiCard label="Legacy/unknown engine" value={String(inventorySummary.legacy_or_unknown_engine_count ?? 0)} tone="warn" />
                  <KpiCard label="Unassigned payments" value={String(inventorySummary.unassigned_payment_count ?? 0)} tone="warn" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Correction queue (latest 20)</h4>
                <TableBlock
                  rows={correctionQueue as unknown as Record<string, unknown>[]}
                  columns={[
                    ['classification', 'Classification'], ['match_tier', 'Match Tier'], ['current_amount', 'Current'],
                    ['proposed_amount', 'Proposed'], ['difference', 'Difference'], ['risk', 'Risk'], ['status', 'Status'],
                  ]}
                />
                <p className="text-xs text-slate-500 mt-2">
                  No correction is applied automatically. Every row requires explicit submit → approve → apply,
                  with a non-admin submitter unable to approve their own submission. See
                  docs/PHASE_F_LEGACY_REPORT_RETIREMENT_MATRIX.md and the Phase F implementation report for the full workflow.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Handover detail drawer */}
      {selectedHandover && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {selectedHandover.handover_number}
                {selectedHandover.status === 'locked' && (
                  <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded flex items-center gap-1">
                    <Lock size={10} /> Locked Financial Snapshot
                  </span>
                )}
              </h3>
              <button onClick={() => setSelectedHandover(null)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            {lockedSnapshot?.warning && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-center gap-2">
                <AlertTriangle size={16} /> {lockedSnapshot.warning}
              </div>
            )}

            {handoverDetail && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>Status: <strong>{handoverDetail.header.status}</strong></div>
                  <div>Version: <strong>{handoverDetail.header.version}</strong></div>
                  <div>Billing: <strong>{money(handoverDetail.header.billing_total)}</strong></div>
                  <div>Expected Cash: <strong>{money(handoverDetail.header.expected_cash)}</strong></div>
                  <div>Actual Cash: <strong>{handoverDetail.header.actual_cash_received != null ? money(handoverDetail.header.actual_cash_received) : '—'}</strong></div>
                  <div>Shortage: <strong>{money(handoverDetail.header.shortage_amount)}</strong></div>
                  <div>Surplus: <strong>{money(handoverDetail.header.surplus_amount)}</strong></div>
                  <div>Adjustments: <strong>{money(handoverDetail.header.net_adjustments)}</strong></div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">Sessions</h4>
                  <div className="max-h-40 overflow-y-auto border rounded text-xs">
                    {(handoverDetail.sessions || []).map((s: any) => (
                      <div key={s.session_id} className="flex justify-between px-2 py-1 border-b">
                        <span className="font-mono">{s.transaction_id}</span>
                        <span>{s.payment_method}</span>
                        <span>{money(s.amount_jod)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(handoverDetail.adjustments || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Adjustments</h4>
                    <div className="text-xs space-y-1">
                      {handoverDetail.adjustments.map((a: any) => (
                        <div key={a.id} className="flex justify-between border-b py-1">
                          <span>{a.cash_impact} {money(a.amount_jod)} — {a.reason}</span>
                          <span className="uppercase">{a.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-1">Status History</h4>
                  <div className="text-xs space-y-1">
                    {(handoverDetail.events || []).map((e: any) => (
                      <div key={e.id} className="flex justify-between border-b py-1">
                        <span>{e.from_status || '—'} → {e.to_status} ({e.action})</span>
                        <span>{format(new Date(e.created_at), 'yyyy-MM-dd HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    exportCashHandoverPdf(
                      { ...selectedHandover, station_name: selectedHandover.station_name, operator_name: selectedHandover.operator_name },
                      handoverDetail.sessions || [],
                      handoverDetail.adjustments || [],
                      handoverDetail.events || []
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm"
                >
                  <FileText size={14} /> Export PDF
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TableBlock({
  rows, columns, renderCell,
}: {
  rows: Record<string, any>[];
  columns: Array<[string, string]>;
  renderCell?: (key: string, value: any) => string | undefined;
}) {
  const moneyKeys = new Set([
    'energy_kwh', 'billing_total', 'cash_total', 'card_total', 'cliq_total', 'unassigned_total',
    'difference', 'expected_cash', 'actual_cash', 'shortage', 'surplus', 'breakdown_sum',
    'demand_charge_sum', 'taxes', 'avg_amount', 'amount', 'operational_total_amount_jod',
  ]);
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            {columns.map(([, label]) => (
              <th key={label} className="p-2 font-medium text-slate-600 whitespace-nowrap">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t hover:bg-slate-50">
              {columns.map(([key]) => {
                const custom = renderCell?.(key, row[key]);
                const val = custom !== undefined ? custom : moneyKeys.has(key) ? money(row[key]) : String(row[key] ?? '—');
                return <td key={key} className="p-2 whitespace-nowrap">{val}</td>;
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="p-4 text-center text-slate-400">No data in this range</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
