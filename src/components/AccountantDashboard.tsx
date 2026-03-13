import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, AlertTriangle, CheckCircle, Clock, Loader2,
  TrendingUp, Banknote, Building2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  getPendingDeposits, getPendingHandovers, getDailyRevenue,
  getFinancialSummary, PendingShift,
} from '../lib/accountingService';
import { formatJOD } from '../lib/billingService';
import { subDays, format } from 'date-fns';

export default function AccountantDashboard() {
  const [pending, setPending] = useState<PendingShift[]>([]);
  const [handovers, setHandovers] = useState<PendingShift[]>([]);
  const [dailyRev, setDailyRev] = useState<{ date: string; revenue: number }[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h, d, s] = await Promise.all([
        getPendingDeposits(),
        getPendingHandovers(),
        getDailyRevenue(startDate, endDate),
        getFinancialSummary(startDate, endDate),
      ]);
      setPending(p);
      setHandovers(h);
      setDailyRev(d);
      setSummary(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  const pendingTotal = pending.reduce((s, p) => s + p.total_amount_jod, 0);
  const handoverTotal = handovers.reduce((s, p) => s + p.total_amount_jod, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Accountant Dashboard</h2>
        <p className="text-gray-600 mt-1">Financial overview — deposits, handovers, and revenue</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue (30d)', value: formatJOD(summary?.totalRevenue || 0), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Deposits', value: `${pending.length} (${formatJOD(pendingTotal)})`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Awaiting Handover', value: `${handovers.length} (${formatJOD(handoverTotal)})`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: summary?.handedOverCount || 0, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-500" /> Daily Revenue (30 days)
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dailyRev}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => formatJOD(Number(v))} />
            <Bar dataKey="revenue" name="Revenue (JOD)" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pending Deposits */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Banknote size={16} className="text-red-500" />
          <h3 className="text-sm font-semibold text-gray-900">Pending Deposits ({pending.length})</h3>
          <span className="ml-auto text-sm font-bold text-red-600">{formatJOD(pendingTotal)}</span>
        </div>
        {pending.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">No pending deposits 🎉</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map(sh => (
              <div key={sh.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{sh.station_name}</p>
                  <p className="text-xs text-gray-500">{sh.operator_name} · {sh.shift_type} · {sh.shift_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatJOD(sh.total_amount_jod)}</p>
                  {sh.hours_pending > 24 && (
                    <p className="text-xs text-red-600 font-medium">⚠ {sh.hours_pending}h ago</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Awaiting Handover */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Building2 size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900">Awaiting Handover to Accounts ({handovers.length})</h3>
          <span className="ml-auto text-sm font-bold text-amber-600">{formatJOD(handoverTotal)}</span>
        </div>
        {handovers.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">All handovers completed ✅</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {handovers.map(sh => (
              <div key={sh.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{sh.station_name}</p>
                  <p className="text-xs text-gray-500">{sh.operator_name} · {sh.shift_type} · {sh.shift_date}</p>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatJOD(sh.total_amount_jod)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
