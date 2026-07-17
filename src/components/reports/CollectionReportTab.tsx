import { useState } from 'react';
import { Wallet, Banknote, Smartphone, CreditCard, Receipt } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchCashHandoverSummary, type CashHandoverSummaryRow } from '../../lib/reportingV2Service';
import {
  exportCollectionReportPDF,
  exportGenericExcel,
  exportGenericCSV,
  collectionReportColumns,
  type CollectionDailyRow,
} from '../../lib/reportExportService';
import { renderPieChart, renderBarChart, formatJOD } from '../../lib/reportUtils';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };

// Only handovers whose Cash/CliQ/Card totals have been finalized count as
// "collected" — drafts/rejected/cancelled totals can still change or are void.
const SETTLED_STATUSES = ['submitted', 'under_review', 'approved', 'locked'];

const tableColumns: TableColumn[] = [
  { header: 'Date', key: 'date' },
  { header: 'Cash (JOD)', key: 'cash', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'CliQ (JOD)', key: 'cliq', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Card (JOD)', key: 'card', align: 'right', format: (v: number) => v.toFixed(3) },
  { header: 'Total (JOD)', key: 'total', align: 'right', format: (v: number) => v.toFixed(3) },
];

export default function CollectionReportTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [rows, setRows] = useState<CashHandoverSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchCashHandoverSummary({
        startDate: filters.startDate,
        endDate: filters.endDate,
        stationId: filters.stationId || undefined,
      });
      setRows((result || []).filter((r) => SETTLED_STATUSES.includes(r.status)));
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load collection report:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce(
    (acc, r) => {
      acc.cash += Number(r.cash_total) || 0;
      acc.cliq += Number(r.cliq_total) || 0;
      acc.card += Number(r.card_total) || 0;
      acc.shortage += Number(r.shortage_amount) || 0;
      acc.surplus += Number(r.surplus_amount) || 0;
      acc.count += 1;
      return acc;
    },
    { cash: 0, cliq: 0, card: 0, shortage: 0, surplus: 0, count: 0 }
  );
  const totalCollected = totals.cash + totals.cliq + totals.card;

  const dailyMap = new Map<string, CollectionDailyRow>();
  for (const r of rows) {
    const d = r.shift_date;
    if (!dailyMap.has(d)) dailyMap.set(d, { date: d, cash: 0, cliq: 0, card: 0, total: 0 });
    const entry = dailyMap.get(d)!;
    entry.cash += Number(r.cash_total) || 0;
    entry.cliq += Number(r.cliq_total) || 0;
    entry.card += Number(r.card_total) || 0;
    entry.total = entry.cash + entry.cliq + entry.card;
  }
  const dailyRows = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const pct = (v: number) => (totalCollected > 0 ? (v / totalCollected) * 100 : 0);
  const dominant = [
    { name: 'Cash', value: totals.cash },
    { name: 'CliQ', value: totals.cliq },
    { name: 'Card', value: totals.card },
  ].reduce((a, b) => (b.value > a.value ? b : a), { name: '—', value: -1 });

  const analysisLines = loaded
    ? [
        `A total of ${formatJOD(totalCollected)} JOD was collected across ${totals.count} settled handover(s) between ${filters.startDate} and ${filters.endDate}.`,
        totalCollected > 0
          ? `${dominant.name} was the leading collection method at ${pct(dominant.value).toFixed(1)}% of total collections (Cash ${pct(totals.cash).toFixed(1)}%, CliQ ${pct(totals.cliq).toFixed(1)}%, Card ${pct(totals.card).toFixed(1)}%).`
          : 'No collections were recorded for the selected period.',
        `Average collection per handover: ${formatJOD(totals.count > 0 ? totalCollected / totals.count : 0)} JOD, across ${dailyRows.length} day(s) with activity.`,
        totals.shortage > 0.0005 || totals.surplus > 0.0005
          ? `Net cash variance for the period: ${
              totals.shortage > totals.surplus
                ? `shortage of ${formatJOD(totals.shortage - totals.surplus)}`
                : `surplus of ${formatJOD(totals.surplus - totals.shortage)}`
            } JOD (see Handover History for details).`
          : 'No unresolved cash shortages or surpluses were recorded in this period.',
      ]
    : [];

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    if (!loaded) return;
    setExporting(true);
    try {
      const fn = `collection-report-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') {
        const pieImg = renderPieChart(
          [totals.cash, totals.cliq, totals.card],
          ['Cash', 'CliQ', 'Card'],
          340, 260,
          ['#1e3a8a', '#14b8a6', '#f59e0b']
        );
        const barImg = renderBarChart(
          dailyRows.map((r) => r.total),
          dailyRows.map((r) => r.date),
          340, 260,
          '#1e3a8a'
        );
        await exportCollectionReportPDF(
          {
            cash: totals.cash, cliq: totals.cliq, card: totals.card, total: totalCollected,
            shortage: totals.shortage, surplus: totals.surplus, count: totals.count,
          },
          dailyRows,
          filters,
          `${fn}.pdf`,
          [
            ...(pieImg ? [{ title: 'Collections by Method', image: pieImg }] : []),
            ...(barImg ? [{ title: 'Daily Collection Trend', image: barImg }] : []),
          ],
          analysisLines
        );
      } else if (type === 'excel') {
        exportGenericExcel(dailyRows, collectionReportColumns, `${fn}.xlsx`, 'Collections');
      } else {
        exportGenericCSV(dailyRows, collectionReportColumns, `${fn}.csv`);
      }
    } catch (err) {
      console.error('Failed to export collection report:', err);
    } finally {
      setExporting(false);
    }
  };

  const cards: SummaryCard[] = loaded ? [
    { label: 'Total Collected', value: totalCollected, format: 'currency', icon: Wallet, color: 'from-blue-500 to-blue-600' },
    { label: 'Cash', value: totals.cash, format: 'currency', icon: Banknote, color: 'from-emerald-500 to-teal-600' },
    { label: 'CliQ', value: totals.cliq, format: 'currency', icon: Smartphone, color: 'from-violet-500 to-purple-600' },
    { label: 'Card', value: totals.card, format: 'currency', icon: CreditCard, color: 'from-amber-500 to-orange-600' },
    { label: 'Handovers', value: totals.count, format: 'number', icon: Receipt, color: 'from-cyan-500 to-blue-600' },
  ] : [];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />

      {loaded && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            onExportCSV={() => handleExport('csv')}
            onPrint={() => window.print()}
            loading={exporting}
            disabled={!loaded}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <PerformanceChart
              type="pie"
              data={[totals.cash, totals.cliq, totals.card]}
              labels={['Cash', 'CliQ', 'Card']}
              title="Collections by Payment Method"
              colors={['#1e3a8a', '#14b8a6', '#f59e0b']}
            />
            <PerformanceChart
              type="bar"
              data={dailyRows.map((r) => r.total)}
              labels={dailyRows.map((r) => r.date)}
              title="Daily Collection Trend"
              color="#1e3a8a"
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Analysis</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              {analysisLines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        </>
      )}

      <ReportDataTable
        columns={tableColumns}
        data={dailyRows}
        loading={loading}
        emptyMessage="Apply filters to generate the collection report."
        showTotals={loaded && dailyRows.length > 0}
        totalsRow={{
          cash: totals.cash.toFixed(3),
          cliq: totals.cliq.toFixed(3),
          card: totals.card.toFixed(3),
          total: totalCollected.toFixed(3),
        }}
      />
    </div>
  );
}
