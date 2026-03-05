import React from 'react';
import { Sun, Sunset, Moon } from 'lucide-react';
import { ShiftMetrics } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';

interface Props {
  data: ShiftMetrics[];
}

export default function ShiftComparisonChart({ data }: Props) {
  const getShiftIcon = (shift: string) => {
    switch (shift) {
      case 'Morning': return <Sun className="w-5 h-5" />;
      case 'Afternoon': return <Sunset className="w-5 h-5" />;
      case 'Night': return <Moon className="w-5 h-5" />;
      default: return null;
    }
  };

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case 'Morning': return 'bg-yellow-500';
      case 'Afternoon': return 'bg-orange-500';
      case 'Night': return 'bg-blue-900';
      default: return 'bg-gray-500';
    }
  };

  const maxEnergy = Math.max(...data.map(d => d.energy), 1);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Shift Comparison</h3>
      <p className="text-sm text-gray-600 mb-6">Energy usage and revenue by time of day</p>

      <div className="space-y-6">
        {data.map((shift) => (
          <div key={shift.shift} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getShiftIcon(shift.shift)}
                <span className="font-medium text-gray-900">{shift.shift}</span>
                <span className="text-sm text-gray-500">({shift.sessions} sessions)</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{shift.energy.toFixed(2)} kWh</div>
                <div className="text-sm text-green-600">{formatJOD(shift.revenue)}</div>
              </div>
            </div>

            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${getShiftColor(shift.shift)} transition-all duration-500`}
                style={{ width: `${(shift.energy / maxEnergy) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Avg Duration</span>
                <div className="font-medium text-gray-900">{shift.avgDuration.toFixed(0)} min</div>
              </div>
              <div>
                <span className="text-gray-500">CO2 Saved</span>
                <div className="font-medium text-green-600">{shift.co2Reduction.toFixed(1)} kg</div>
              </div>
              <div>
                <span className="text-gray-500">Avg/Session</span>
                <div className="font-medium text-gray-900">
                  {shift.sessions > 0 ? (shift.energy / shift.sessions).toFixed(2) : '0.00'} kWh
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
