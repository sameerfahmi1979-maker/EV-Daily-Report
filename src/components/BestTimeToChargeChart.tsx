import { HourlyPattern } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';
import { Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: HourlyPattern[];
}

export default function BestTimeToChargeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Best Time to Charge</h3>
        <div className="text-center py-8 text-gray-500">No data available</div>
      </div>
    );
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  const chartData = data.map(d => ({
    hour: formatHour(d.hour),
    'Avg Cost (JOD)': Number(d.avgCost.toFixed(3)),
    'Energy (kWh)': Number(d.energy.toFixed(1)),
    sessions: d.sessions,
  }));

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-5 h-5 text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">Best Time to Charge</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Average cost and energy usage by hour of day</p>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 13 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="Avg Cost (JOD)" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={12} />
            <Bar yAxisId="right" dataKey="Energy (kWh)" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
