import React from 'react';
import { RecentActivity } from '../lib/analyticsService';
import { formatJOD } from '../lib/billingService';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface RecentActivityTableProps {
  data: RecentActivity[];
}

export default function RecentActivityTable({ data }: RecentActivityTableProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <Clock size={20} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">Latest charging sessions</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Station
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Energy
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date & Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((activity) => (
              <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {activity.transactionId}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {activity.station}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-700">
                  {activity.energy.toFixed(3)} kWh
                </td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                  {activity.hasBilling ? formatJOD(activity.cost) : '-'}
                </td>
                <td className="px-6 py-4">
                  {activity.hasBilling ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle size={14} />
                      <span>Billed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <AlertCircle size={14} />
                      <span>Pending</span>
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {new Date(activity.startTime).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
