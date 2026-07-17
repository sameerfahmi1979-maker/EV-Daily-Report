import { useState } from 'react';
import { Zap, TrendingUp, Activity } from 'lucide-react';
import ReportFilterBar, { defaultFilters, type FilterValues, type FilterConfig } from './ReportFilterBar';
import ReportExportToolbar from './ReportExportToolbar';
import ReportDataTable, { type TableColumn } from './ReportDataTable';
import ReportSummaryCards, { type SummaryCard } from './ReportSummaryCards';
import PerformanceChart from './PerformanceChart';
import { fetchEnergyConsumption } from '../../lib/reportDataService';
import { exportGenericPDF, exportGenericExcel, exportGenericCSV, energyColumns } from '../../lib/reportExportService';

const filterConfig: FilterConfig = { showStation: true, showQuickDates: true };
const tableColumns: TableColumn[] = [
  { header: 'Station', key: 'name' },
  { header: 'Sessions', key: 'sessions', align: 'right' },
  { header: 'Total kWh', key: 'energy', align: 'right', format: (v: number) => v.toFixed(2) },
  { header: 'Max Demand (kW)', key: 'maxDemand', align: 'right', format: (v: number) => v.toFixed(2) },
];

export default function EnergyConsumptionTab() {
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchEnergyConsumption({ startDate: new Date(filters.startDate), endDate: new Date(filters.endDate), stationId: filters.stationId || undefined });
      setData(result);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    if (!data) return;
    setExporting(true);
    try {
      const fn = `energy-consumption-${filters.startDate}-to-${filters.endDate}`;
      if (type === 'pdf') await exportGenericPDF('Energy Consumption', data.byDate, energyColumns, `Total: ${data.totals.totalKwh.toFixed(2)} kWh  |  Avg/Day: ${data.totals.avgKwhPerDay.toFixed(2)} kWh  |  Peak Demand: ${data.totals.peakDemand.toFixed(2)} kW`, filters, `${fn}.pdf`);
      if (type === 'excel') exportGenericExcel(data.byDate, energyColumns, `${fn}.xlsx`, 'Energy');
      if (type === 'csv') exportGenericCSV(data.byDate, energyColumns, `${fn}.csv`);
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const cards: SummaryCard[] = data ? [
    { label: 'Total kWh', value: data.totals.totalKwh, format: 'number', icon: Zap },
    { label: 'Avg kWh/Day', value: data.totals.avgKwhPerDay, format: 'number', icon: TrendingUp },
    { label: 'Peak Demand (kW)', value: data.totals.peakDemand, format: 'number', icon: Activity },
    { label: 'Sessions', value: data.totals.totalSessions, format: 'number', icon: Zap },
  ] : [];

  return (
    <div>
      <ReportFilterBar config={filterConfig} filters={filters} onChange={setFilters} onApply={loadData} loading={loading} />
      {data && (
        <>
          <ReportSummaryCards cards={cards} />
          <ReportExportToolbar onExportPDF={() => handleExport('pdf')} onExportExcel={() => handleExport('excel')} onExportCSV={() => handleExport('csv')} onPrint={() => window.print()} loading={exporting} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <PerformanceChart type="line" data={data.byDate.map((d: any) => d.energy)} labels={data.byDate.map((d: any) => d.date.slice(5))} title="Daily Energy Consumption" color="#14b8a6" />
            <PerformanceChart type="bar" data={data.byStation.map((s: any) => s.energy)} labels={data.byStation.map((s: any) => s.name)} title="Energy by Station" color="#1e3a8a" />
          </div>
        </>
      )}
      <ReportDataTable columns={tableColumns} data={data?.byStation || []} loading={loading} emptyMessage="Apply filters to view energy consumption data." />
    </div>
  );
}
