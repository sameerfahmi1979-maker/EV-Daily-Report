import React from 'react';
import { Clock } from 'lucide-react';
import { HourlyPattern } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';

interface Props {
  data: HourlyPattern[];
}

export default function BestTimeToChargeChart({ data }: Props) {
  const maxCost = Math.max(...data.map(d => d.avgCost), 1);
  const maxEnergy = Math.max(...data.map(d => d.energy), 1);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const getCostColor = (cost: number) => {
    const percentage = (cost / maxCost) * 100;
    if (percentage < 33) return 'bg-green-500';
    if (percentage < 66) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-gray-900" />
        <h3 className="text-lg font-semibold text-gray-900">Best Time to Charge</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">Average cost and energy usage by hour</p>

      <div className="space-y-1">
        {data.map((hourData) => (
          <div key={hourData.hour} className="flex items-center gap-2 group hover:bg-gray-50 p-2 rounded transition-colors">
            <div className="w-16 text-xs text-gray-600 font-medium">
              {formatHour(hourData.hour)}
            </div>

            <div className="flex-1 relative">
              <div className="flex gap-1 h-6">
                <div className="flex-1 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${getCostColor(hourData.avgCost)} transition-all duration-300`}
                    style={{ width: `${(hourData.avgCost / maxCost) * 100}%` }}
                    title={`Avg Cost: ${formatJOD(hourData.avgCost)}`}
                  />
                </div>
                <div className="flex-1 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(hourData.energy / maxEnergy) * 100}%` }}
                    title={`Energy: ${hourData.energy.toFixed(2)} kWh`}
                  />
                </div>
              </div>
            </div>

            <div className="w-20 text-right">
              <div className="text-xs font-semibold text-gray-900">
                {hourData.sessions > 0 ? formatJOD(hourData.avgCost) : '-'}
              </div>
              <div className="text-xs text-gray-500">
                {hourData.sessions} session{hourData.sessions !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <div className="w-3 h-3 bg-red-500 rounded" />
          </div>
          <span className="text-gray-600">Cost Level</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-gray-600">Energy Usage</span>
        </div>
      </div>
    </div>
  );
}
