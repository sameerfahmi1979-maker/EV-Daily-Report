import { ShiftMetrics } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';
import { Sun, Sunset, Moon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';

interface Props {
  data: ShiftMetrics[];
}

const SHIFT_COLORS: Record<string, string> = {
  Morning: '#eab308',
  Afternoon: '#f97316',
  Night: '#1e3a5f',
};

export default function ShiftComparisonChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shift Comparison</h3>
        <div className="text-center py-8 text-gray-500">No shift data available</div>
      </div>
    );
  }

  const getShiftIcon = (shift: string) => {
    switch (shift) {
      case 'Morning': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'Afternoon': return <Sunset className="w-4 h-4 text-orange-500" />;
      case 'Night': return <Moon className="w-4 h-4 text-indigo-400" />;
      default: return null;
    }
  };

  const chartData = data.map(d => ({
    shift: d.shift,
    'Energy (kWh)': Number(d.energy.toFixed(1)),
    'Revenue (JOD)': Number(d.revenue.toFixed(2)),
    sessions: d.sessions,
  }));

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Shift Comparison</h3>
      <p className="text-sm text-gray-500 mb-4">Energy usage and revenue by time of day</p>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="shift" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Energy (kWh)" radius={[4, 4, 0, 0]} barSize={28}>
              {chartData.map((entry, i) => <Cell key={i} fill={SHIFT_COLORS[entry.shift] || '#6b7280'} />)}
            </Bar>
            <Bar dataKey="Revenue (JOD)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Shift detail cards */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {data.map(shift => (
          <div key={shift.shift} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
            {getShiftIcon(shift.shift)}
            <div className="text-xs">
              <p className="font-medium text-gray-800">{shift.shift}</p>
              <p className="text-gray-500">{shift.sessions} sess · {formatJOD(shift.revenue)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
