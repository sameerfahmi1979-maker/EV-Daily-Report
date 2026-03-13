import { EnergyDataPoint, EnergyGroupBy } from '../lib/analyticsService';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Bar, ComposedChart,
} from 'recharts';

interface EnergyTrendChartProps {
  data: EnergyDataPoint[];
  groupBy: EnergyGroupBy;
}

const groupByLabels: Record<EnergyGroupBy, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
};

export default function EnergyTrendChart({ data, groupBy }: EnergyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-500">No energy data available for selected period</p>
      </div>
    );
  }

  const label = groupByLabels[groupBy];
  const totalEnergy = data.reduce((s, d) => s + d.energy, 0);
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Energy Consumption Trend</h3>
          <p className="text-sm text-gray-500 mt-0.5">{label} energy over selected period</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">{label}</span>
          <TrendingUp size={18} className="text-blue-600" />
        </div>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 13 }}
              formatter={(value: number, name: string) => [
                name === 'energy' ? `${value.toFixed(2)} kWh` : `${value}`,
                name === 'energy' ? 'Energy' : 'Sessions',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="energy"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#energyGrad)"
              name="Energy (kWh)"
            />
            <Bar yAxisId="right" dataKey="sessions" fill="#10b981" opacity={0.6} radius={[4, 4, 0, 0]} name="Sessions" barSize={20} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Total Energy: <span className="font-semibold text-gray-900">{totalEnergy.toFixed(2)} kWh</span>
        </span>
        <span className="text-gray-500">
          Total Sessions: <span className="font-semibold text-gray-900">{totalSessions}</span>
        </span>
      </div>
    </div>
  );
}
