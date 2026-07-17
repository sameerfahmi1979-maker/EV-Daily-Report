import { RevenueDataPoint } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-500">No revenue data available for selected period</p>
      </div>
    );
  }

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const chartData = data.map(d => ({
    name: d.station.length > 15 ? d.station.substring(0, 15) + '…' : d.station,
    fullName: d.station,
    revenue: d.revenue,
    sessions: d.sessions,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Revenue by Station</h3>
          <p className="text-sm text-gray-500 mt-0.5">Total revenue generated per station</p>
        </div>
        <span className="text-lg font-bold text-emerald-700">{formatJOD(totalRevenue)}</span>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatJOD(v)} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 13 }}
              formatter={(value: number) => [formatJOD(value), 'Revenue']}
              labelFormatter={(label) => {
                const item = chartData.find(d => d.name === label);
                return item?.fullName || label;
              }}
            />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={24}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
