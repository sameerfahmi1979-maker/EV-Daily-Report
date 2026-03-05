import React from 'react';
import { Plug } from 'lucide-react';
import { ConnectorTypeMetrics } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';

interface Props {
  data: ConnectorTypeMetrics[];
}

export default function ConnectorTypeChart({ data }: Props) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  const getConnectorColor = (index: number) => {
    const colors = ['bg-blue-600', 'bg-green-600', 'bg-orange-600', 'bg-red-600', 'bg-purple-600', 'bg-teal-600'];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-6">
        <Plug className="w-5 h-5 text-gray-900" />
        <h3 className="text-lg font-semibold text-gray-900">Connector Type Comparison</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">Performance metrics by connector type</p>

      <div className="space-y-4">
        {data.map((connector, index) => (
          <div key={connector.connectorType} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getConnectorColor(index)}`} />
                <span className="font-medium text-gray-900">{connector.connectorType}</span>
                <span className="text-sm text-gray-500">({connector.sessions} sessions)</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-green-600">{formatJOD(connector.revenue)}</div>
                <div className="text-xs text-gray-500">{connector.energy.toFixed(2)} kWh</div>
              </div>
            </div>

            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${getConnectorColor(index)} transition-all duration-500`}
                style={{ width: `${(connector.revenue / maxRevenue) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Avg Energy</span>
                <div className="font-medium text-gray-900">{connector.avgEnergy.toFixed(2)} kWh</div>
              </div>
              <div>
                <span className="text-gray-500">CO2 Saved</span>
                <div className="font-medium text-green-600">{connector.co2Reduction.toFixed(1)} kg</div>
              </div>
              <div>
                <span className="text-gray-500">Avg Revenue</span>
                <div className="font-medium text-gray-900">
                  {formatJOD(connector.sessions > 0 ? connector.revenue / connector.sessions : 0)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No connector data available for this period
        </div>
      )}
    </div>
  );
}
