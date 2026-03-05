import React from 'react';
import { EnergyDataPoint, EnergyGroupBy } from '../lib/analyticsService';
import { TrendingUp } from 'lucide-react';

interface EnergyTrendChartProps {
  data: EnergyDataPoint[];
  groupBy: EnergyGroupBy;
}

const groupByLabels: Record<EnergyGroupBy, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly'
};

export default function EnergyTrendChart({ data, groupBy }: EnergyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No energy data available for selected period</p>
      </div>
    );
  }

  const maxEnergy = Math.max(...data.map(d => d.energy), 1);
  const label = groupByLabels[groupBy];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Energy Consumption Trend</h3>
          <p className="text-sm text-gray-600 mt-1">{label} energy consumption over selected period</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{label}</span>
          <TrendingUp size={20} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-600">kWh</span>
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {data.map((point, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className="w-24 text-sm text-gray-700 font-medium shrink-0">{point.date}</div>
            <div className="flex-1 flex items-center space-x-2">
              <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                  style={{ width: `${Math.max((point.energy / maxEnergy) * 100, point.energy > 0 ? 8 : 0)}%` }}
                >
                  {point.energy > 0 && (
                    <span className="text-xs font-semibold text-white whitespace-nowrap">
                      {point.energy.toFixed(1)} kWh
                    </span>
                  )}
                </div>
              </div>
              <div className="w-20 text-sm text-gray-600 text-right shrink-0">
                {point.sessions} {point.sessions === 1 ? 'session' : 'sessions'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Total Energy: <span className="font-semibold text-gray-900">
              {data.reduce((sum, d) => sum + d.energy, 0).toFixed(2)} kWh
            </span>
          </div>
          <div className="text-gray-600">
            Total Sessions: <span className="font-semibold text-gray-900">
              {data.reduce((sum, d) => sum + d.sessions, 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
