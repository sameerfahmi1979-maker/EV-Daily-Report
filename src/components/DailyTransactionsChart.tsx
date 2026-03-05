import React from 'react';
import { BarChart3 } from 'lucide-react';
import { DailyTransaction } from '../lib/analyticsService';

interface Props {
  data: DailyTransaction[];
}

const MAX_RECORDS = 10;

export default function DailyTransactionsChart({ data }: Props) {
  const displayData = data.slice(0, MAX_RECORDS);

  if (displayData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Transactions by Connector</h3>
        <div className="text-center py-8 text-gray-500">
          No transaction data available for this period
        </div>
      </div>
    );
  }

  const connectorTypes = Object.keys(displayData[0]).filter(key => key !== 'date');

  const connectorColors: { [key: string]: string } = {
    'GBT DC': 'bg-blue-600',
    'CCS1': 'bg-green-600',
    'CCS2': 'bg-orange-600',
    'CHAdeMO': 'bg-red-600',
    'Type 2': 'bg-purple-600',
    'Unknown': 'bg-gray-400'
  };

  const getConnectorColor = (type: string) => {
    return connectorColors[type] || 'bg-gray-500';
  };

  const maxTotal = Math.max(
    ...displayData.map(day =>
      connectorTypes.reduce((sum, type) => sum + (Number(day[type]) || 0), 0)
    ),
    1
  );

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-gray-900" />
        <h3 className="text-lg font-semibold text-gray-900">Daily Transactions by Connector</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">Transaction volume breakdown by connector type</p>

      <div className="space-y-3">
        {displayData.map((day) => {
          const total = connectorTypes.reduce((sum, type) => sum + (Number(day[type]) || 0), 0);

          return (
            <div key={day.date} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{day.date}</span>
                <span className="text-gray-600">{total} transactions</span>
              </div>

              <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100">
                {connectorTypes.map(type => {
                  const count = Number(day[type]) || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;

                  if (count === 0) return null;

                  return (
                    <div
                      key={type}
                      className={`${getConnectorColor(type)} flex items-center justify-center text-white text-xs font-medium transition-all duration-300 hover:opacity-80`}
                      style={{ width: `${percentage}%` }}
                      title={`${type}: ${count} (${percentage.toFixed(1)}%)`}
                    >
                      {percentage > 10 && count}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-3">
          {connectorTypes.map(type => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${getConnectorColor(type)}`} />
              <span className="text-xs text-gray-600">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
