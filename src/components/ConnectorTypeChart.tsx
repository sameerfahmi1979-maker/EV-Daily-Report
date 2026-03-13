import { ConnectorTypeMetrics } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';
import { Plug } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: ConnectorTypeMetrics[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ConnectorTypeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Connector Type Comparison</h3>
        <div className="text-center py-8 text-gray-500">No connector data available</div>
      </div>
    );
  }

  const pieData = data.map((d, i) => ({
    name: d.connectorType,
    value: d.sessions,
    revenue: d.revenue,
    energy: d.energy,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Plug className="w-5 h-5 text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">Connector Type Comparison</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Sessions distribution by connector type</p>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 13 }}
              formatter={(value: number, _name: string, props: any) => {
                const item = props.payload;
                return [
                  `${value} sessions · ${item.energy.toFixed(1)} kWh · ${formatJOD(item.revenue)}`,
                  item.name,
                ];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-2 mt-2">
        {data.map((c, i) => (
          <div key={c.connectorType} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-sm font-medium text-gray-800">{c.connectorType}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>{c.sessions} sess</span>
              <span>{c.energy.toFixed(1)} kWh</span>
              <span className="font-medium text-emerald-700">{formatJOD(c.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
