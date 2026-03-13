import { DailyTransaction } from '../lib/analyticsService';
import { BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: DailyTransaction[];
}

const CONNECTOR_COLORS: Record<string, string> = {
  'GBT DC': '#3b82f6',
  'CCS1': '#10b981',
  'CCS2': '#f59e0b',
  'CHAdeMO': '#ef4444',
  'Type 2': '#8b5cf6',
  'Unknown': '#9ca3af',
};

const MAX_RECORDS = 14;

export default function DailyTransactionsChart({ data }: Props) {
  const displayData = data.slice(0, MAX_RECORDS);

  if (displayData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Transactions by Connector</h3>
        <div className="text-center py-8 text-gray-500">No transaction data available</div>
      </div>
    );
  }

  const connectorTypes = Object.keys(displayData[0]).filter(key => key !== 'date');

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-5 h-5 text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">Daily Transactions by Connector</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Stacked breakdown by connector type</p>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={displayData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {connectorTypes.map((type) => (
              <Bar
                key={type}
                dataKey={type}
                stackId="stack"
                fill={CONNECTOR_COLORS[type] || '#6b7280'}
                radius={connectorTypes.indexOf(type) === connectorTypes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
