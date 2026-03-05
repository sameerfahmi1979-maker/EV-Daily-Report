import React from 'react';
import { StationUtilization } from '../lib/analyticsService';
import { MapPin } from 'lucide-react';

interface StationComparisonProps {
  data: StationUtilization[];
}

const colors = [
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-700' },
  { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-700' },
  { bg: 'bg-yellow-500', light: 'bg-yellow-100', text: 'text-yellow-700' }
];

export default function StationComparison({ data }: StationComparisonProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No station data available for selected period</p>
      </div>
    );
  }

  const totalEnergy = data.reduce((sum, s) => sum + s.energy, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Station Energy Distribution</h3>
          <p className="text-sm text-gray-600 mt-1">Energy consumption breakdown by station</p>
        </div>
        <div className="flex items-center space-x-2 text-gray-600">
          <MapPin size={20} />
          <span className="text-sm font-medium">{data.length} Stations</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex h-8 rounded-lg overflow-hidden">
          {data.map((station, index) => (
            <div
              key={index}
              className={`${colors[index % colors.length].bg} transition-all duration-300 hover:opacity-80`}
              style={{ width: `${station.percentage}%` }}
              title={`${station.name}: ${station.percentage.toFixed(1)}%`}
            />
          ))}
        </div>

        <div className="space-y-3">
          {data.map((station, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded ${colors[index % colors.length].bg}`} />
                <span className="text-sm font-medium text-gray-900">{station.name}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {station.energy.toFixed(2)} kWh
                </span>
                <span className="text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                  {station.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
        <span className="text-gray-600">Total Energy:</span>
        <span className="font-semibold text-gray-900">{totalEnergy.toFixed(2)} kWh</span>
      </div>
    </div>
  );
}
