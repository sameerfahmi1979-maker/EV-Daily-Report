import React from 'react';
import { RevenueDataPoint } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';
import { DollarSign } from 'lucide-react';

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No revenue data available for selected period</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Revenue by Station</h3>
          <p className="text-sm text-gray-600 mt-1">Total revenue generated per station</p>
        </div>
        <div className="flex items-center space-x-2 text-green-600">
          <DollarSign size={20} />
          <span className="text-sm font-medium">JOD</span>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((point, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium text-gray-900">
                {point.station}
                {point.stationCode && (
                  <span className="text-gray-500 ml-2">({point.stationCode})</span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">
                  {point.sessions} {point.sessions === 1 ? 'session' : 'sessions'}
                </span>
                <span className="font-semibold text-green-700 min-w-[100px] text-right">
                  {formatJOD(point.revenue)}
                </span>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
        <span className="text-sm text-gray-600">Total Revenue:</span>
        <span className="text-lg font-bold text-green-700">{formatJOD(totalRevenue)}</span>
      </div>
    </div>
  );
}
