import React from 'react';
import { PieChart } from 'lucide-react';
import { ChargerTypeMetrics } from '../lib/analyticsService';

interface Props {
  data: ChargerTypeMetrics[];
}

export default function ChargerTypeBreakdown({ data }: Props) {
  const colors = [
    { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
    { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
    { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500' },
    { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
    { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
    { bg: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-500' }
  ];

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-gray-900" />
        <h3 className="text-lg font-semibold text-gray-900">Charger Type Distribution</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">Session breakdown by connector type</p>

      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No charger data available for this period
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex h-4 rounded-full overflow-hidden">
              {data.map((item, index) => (
                <div
                  key={item.type}
                  className={`${colors[index % colors.length].bg} transition-all duration-500`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.type}: ${item.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {data.map((item, index) => {
              const colorScheme = colors[index % colors.length];

              return (
                <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${colorScheme.bg}`} />
                    <div>
                      <div className="font-medium text-gray-900">{item.type}</div>
                      <div className="text-xs text-gray-500">{item.count} sessions</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${colorScheme.text}`}>
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <div className="text-sm text-gray-600">
              Total Sessions: <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
