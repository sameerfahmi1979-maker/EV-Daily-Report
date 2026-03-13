import { useState, useEffect, useCallback } from 'react';
import {
  Download, Loader2, FileSpreadsheet, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getStations } from '../lib/stationService';
import { formatJOD } from '../lib/billingService';
import { subDays, format } from 'date-fns';

interface CDR {
  cdr_id: string;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  energy_kwh: number;
  cost_jod: number;
  station_name: string;
  connector: string;
  card_number: string;
  operator_name: string;
  shift_type: string;
}

export default function CDRExport() {
  const [cdrs, setCdrs] = useState<CDR[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stationFilter, setStationFilter] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { getStations().then(setStations).catch(console.error); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('charging_sessions')
        .select('id, start_ts, end_ts, duration_minutes, energy_consumed_kwh, calculated_cost, connector_type, card_number, station_id, stations(name), operators(name), shifts(shift_type)')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_ts', { ascending: false })
        .limit(500);
      if (stationFilter) q = q.eq('station_id', stationFilter);
      const { data, error } = await q;
      if (error) throw error;

      setCdrs((data || []).map((row: any) => ({
        cdr_id: row.id,
        start_datetime: row.start_ts,
        end_datetime: row.end_ts,
        duration_minutes: row.duration_minutes,
        energy_kwh: row.energy_consumed_kwh,
        cost_jod: row.calculated_cost,
        station_name: row.stations?.name || '—',
        connector: row.connector_type || '—',
        card_number: row.card_number ? `****${row.card_number.slice(-4)}` : '—',
        operator_name: row.operators?.name || '—',
        shift_type: row.shifts?.shift_type || '—',
      })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [startDate, endDate, stationFilter]);

  useEffect(() => { load(); }, [load]);

  function exportCSV() {
    const headers = ['CDR_ID','Start_DateTime','End_DateTime','Duration_Min','Energy_kWh','Cost_JOD','Station','Connector','Card','Operator','Shift'];
    const rows = cdrs.map(c => [c.cdr_id, c.start_datetime, c.end_datetime, c.duration_minutes, c.energy_kwh.toFixed(2), c.cost_jod.toFixed(3), c.station_name, c.connector, c.card_number, c.operator_name, c.shift_type]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sName = stations.find(s => s.id === stationFilter)?.name || 'All';
    a.download = `CDR_${sName}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalKwh = cdrs.reduce((s, c) => s + c.energy_kwh, 0);
  const totalRev = cdrs.reduce((s, c) => s + c.cost_jod, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CDR Export</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Charge Detail Records — standardized export</p>
        </div>
        <button onClick={exportCSV} disabled={cdrs.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-end">
        <Filter size={16} className="text-gray-400" />
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm h-[38px] dark:text-gray-200">
          <option value="">All Stations</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{cdrs.length}</p>
          <p className="text-xs text-gray-500">Records</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalKwh.toFixed(1)} kWh</p>
          <p className="text-xs text-gray-500">Total Energy</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{formatJOD(totalRev)}</p>
          <p className="text-xs text-gray-500">Total Revenue</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Charge Detail Records</h3>
        </div>
        {loading ? (
          <div className="py-12 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
        ) : cdrs.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                  {['Station','Start','End','Duration','kWh','Cost','Connector','Card','Operator','Shift'].map(h => (
                    <th key={h} className="px-3 py-2 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {cdrs.slice(0, 100).map(c => (
                  <tr key={c.cdr_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-200">{c.station_name}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(c.start_datetime).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(c.end_datetime).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.duration_minutes} min</td>
                    <td className="px-3 py-2 font-medium text-emerald-600">{c.energy_kwh.toFixed(2)}</td>
                    <td className="px-3 py-2 font-medium text-amber-600">{formatJOD(c.cost_jod)}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.connector}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.card_number}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.operator_name}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.shift_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
