import { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2 } from 'lucide-react';
import { getSchedules, upsertSchedule, deleteSchedule, ScheduleEntry } from '../lib/rosterService';
import { getStations } from '../lib/stationService';
import { supabase } from '../lib/supabase';

const SHIFT_COLORS: Record<string, string> = {
  morning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  evening: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  night: 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
  extended_day: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  extended_night: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  day_off: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const OPERATOR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function OperatorRoster() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [stations, setStations] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [stationId, setStationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [formOp, setFormOp] = useState('');
  const [formShift, setFormShift] = useState('morning');
  const [formDayOff, setFormDayOff] = useState(false);

  useEffect(() => {
    Promise.all([
      getStations(),
      supabase.from('operators').select('id, name').then(r => r.data || []),
    ]).then(([s, o]) => {
      setStations(s);
      setOperators(o);
      if (s.length > 0 && !stationId) setStationId(s[0].id);
    }).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    if (!stationId) return;
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
    try {
      const data = await getSchedules(stationId, start, end);
      setSchedules(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [stationId, year, month]);

  useEffect(() => { load(); }, [load]);

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  async function handleSave() {
    if (!formOp || !selectedDate || !stationId) return;
    await upsertSchedule({
      station_id: stationId,
      operator_id: formOp,
      schedule_date: selectedDate,
      shift_duration: '12h',
      shift_type: formShift,
      is_day_off: formDayOff,
    });
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    await deleteSchedule(id);
    load();
  }

  const days = getMonthDays(year, month);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build operator color map
  const opColorMap = new Map<string, string>();
  operators.forEach((op: any, i: number) => opColorMap.set(op.id, OPERATOR_COLORS[i % OPERATOR_COLORS.length]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Operator Roster</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Schedule operators for shifts across the month</p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-center">
        <select value={stationId} onChange={e => setStationId(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200">
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={prev} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={18} /></button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button onClick={next} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              if (day === null) return <div key={`e${i}`} className="min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/30" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div key={dateStr}
                  className={`min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700/50 p-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  onClick={() => { setSelectedDate(dateStr); setShowForm(true); setFormDayOff(false); setFormShift('morning'); }}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>{day}</div>
                  {daySchedules.map(s => (
                    <div key={s.id}
                      className={`text-[10px] px-1 py-0.5 rounded mb-0.5 flex items-center gap-1 ${s.is_day_off ? SHIFT_COLORS.day_off : (SHIFT_COLORS[s.shift_type] || SHIFT_COLORS.morning)}`}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: opColorMap.get(s.operator_id) || '#999' }} />
                      <span className="truncate">{s.operator_name?.split(' ')[0]}</span>
                      <button onClick={e => { e.stopPropagation(); handleDelete(s.id); }} className="ml-auto hover:text-red-600"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-blue-500" /> Schedule — {selectedDate}
            </h3>
            <div className="space-y-3">
              <select value={formOp} onChange={e => setFormOp(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200">
                <option value="">Select Operator</option>
                {operators.map((op: any) => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
              <select value={formShift} onChange={e => setFormShift(e.target.value)} disabled={formDayOff}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200 disabled:opacity-50">
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
                <option value="extended_day">Extended Day</option>
                <option value="extended_night">Extended Night</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={formDayOff} onChange={e => setFormDayOff(e.target.checked)} className="rounded" />
                Day Off
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={!formOp}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                <Plus size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Legend</h4>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SHIFT_COLORS).map(([k, cls]) => (
            <span key={k} className={`text-[10px] px-2 py-1 rounded ${cls}`}>
              {k === 'day_off' ? 'Day Off' : k.replace('_',' ')}
            </span>
          ))}
          {operators.slice(0, 8).map((op: any, i: number) => (
            <span key={op.id} className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: OPERATOR_COLORS[i % OPERATOR_COLORS.length] }} />
              {op.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
