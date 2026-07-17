import { useState, useEffect } from 'react';
import { getActiveAlarms, type Alarm } from '../lib/ocppService';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Bell, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

function AlarmRow({ alarm, onAck }: { alarm: Alarm; onAck: (id: string) => void }) {
  const isFault = alarm.type === 'connector_fault';
  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isFault ? 'bg-red-50/20' : ''}`}>
      <td className="px-4 py-3">
        {isFault
          ? <AlertTriangle size={16} className="text-red-500" />
          : <Bell size={16} className="text-orange-400" />}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(alarm.timestamp).toLocaleString()}</td>
      <td className="px-4 py-3 font-mono text-xs text-gray-700">{alarm.chargePointId}</td>
      {alarm.connectorId !== undefined
        ? <td className="px-4 py-3 text-xs text-gray-600">Connector #{alarm.connectorId}</td>
        : <td className="px-4 py-3 text-xs text-gray-400">—</td>}
      <td className="px-4 py-3 text-xs text-gray-700">{alarm.description}</td>
      <td className="px-4 py-3 text-xs font-mono text-red-500">{alarm.errorCode ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isFault ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
          {isFault ? 'Fault' : 'Error'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onAck(alarm.id)}
          className="text-xs text-blue-600 hover:underline"
        >
          Acknowledge
        </button>
      </td>
    </tr>
  );
}

export default function AlarmManagement() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const data = await getActiveAlarms();
      setAlarms(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Re-query when connector status changes
    const ch = supabase
      .channel('alarm-connector-watch')
      .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'ocpp_connectors' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const ack = (id: string) => setDismissed(prev => new Set([...prev, id]));
  const visible = alarms.filter(a => !dismissed.has(a.id));
  const faultCount = visible.filter(a => a.type === 'connector_fault').length;
  const errorCount = visible.filter(a => a.type === 'message_error').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alarm Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Active faults and protocol errors</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${faultCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          <AlertTriangle size={14} /> {faultCount} Connector Fault{faultCount !== 1 ? 's' : ''}
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${errorCount > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          <Bell size={14} /> {errorCount} Message Error{errorCount !== 1 ? 's' : ''}
        </div>
        {dismissed.size > 0 && (
          <button onClick={() => setDismissed(new Set())} className="text-xs text-blue-600 hover:underline px-2">
            Show {dismissed.size} dismissed
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Charge Point</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Connector</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Error Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Checking for alarms...
              </td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                <CheckCircle size={40} className="mx-auto mb-3 text-green-400 opacity-60" />
                <p className="font-medium">No active alarms</p>
                <p className="text-sm mt-1">All charge points are operating normally</p>
              </td></tr>
            ) : (
              visible.map(alarm => (
                <AlarmRow key={alarm.id} alarm={alarm} onAck={ack} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
