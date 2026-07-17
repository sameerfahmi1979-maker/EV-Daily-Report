import React from 'react';
import { X, Clock, Zap, TrendingUp, Receipt, DollarSign } from 'lucide-react';
import { BillingBreakdown, formatJOD } from '../lib/billingService';

interface BillingBreakdownViewerProps {
  breakdown: BillingBreakdown;
  sessionInfo: {
    transactionId: string;
    startDateTime: string;
    endDateTime: string;
    totalEnergy: number;
    totalDuration: number;
  };
  onClose: () => void;
}

export default function BillingBreakdownViewer({ breakdown, sessionInfo, onClose }: BillingBreakdownViewerProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Billing Breakdown</h2>
            <p className="text-sm text-gray-600 mt-1">Transaction ID: {sessionInfo.transactionId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-blue-700 mb-2">
                <Clock size={18} />
                <span className="text-sm font-medium">Session Duration</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{sessionInfo.totalDuration} min</p>
              <p className="text-xs text-blue-600 mt-1">
                {new Date(sessionInfo.startDateTime).toLocaleString()} →
                {new Date(sessionInfo.endDateTime).toLocaleString()}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-green-700 mb-2">
                <Zap size={18} />
                <span className="text-sm font-medium">Total Energy</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{sessionInfo.totalEnergy.toFixed(3)} kWh</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-purple-700 mb-2">
                <DollarSign size={18} />
                <span className="text-sm font-medium">Total Amount</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">{formatJOD(breakdown.total)}</p>
              <p className="text-xs text-purple-600 mt-1">Including all charges</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Period Charges</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Period</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Duration</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Energy</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Rate/kWh</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Energy Charge</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Demand Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Demand Charge</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {breakdown.periodCharges.map((charge, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{charge.periodName}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{charge.duration} min</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{charge.energy.toFixed(3)} kWh</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{charge.ratePerKwh.toFixed(3)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{formatJOD(charge.energyCharge)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{charge.demandRate.toFixed(3)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{formatJOD(charge.demandCharge)}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        {formatJOD(charge.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={7} className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      Period Charges Subtotal:
                    </td>
                    <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatJOD(breakdown.periodCharges.reduce((sum, c) => sum + c.lineTotal, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {breakdown.fixedChargesList && breakdown.fixedChargesList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Fixed Charges</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {breakdown.fixedChargesList.map((charge, index) => (
                  <div key={index} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center space-x-2 text-gray-700">
                      <Receipt size={16} />
                      <span className="text-sm font-medium">{charge.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatJOD(charge.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Fixed Charges Total:</span>
                  <span className="text-sm font-bold text-gray-900">{formatJOD(breakdown.fixedCharges)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-lg">
                <span className="font-medium text-gray-700">Subtotal:</span>
                <span className="font-semibold text-gray-900">{formatJOD(breakdown.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-lg">
                <span className="font-medium text-gray-700">Taxes:</span>
                <span className="font-semibold text-gray-900">{formatJOD(breakdown.taxes)}</span>
              </div>
              <div className="border-t border-gray-300 pt-3 flex items-center justify-between text-2xl">
                <span className="font-bold text-gray-900">Total Amount:</span>
                <span className="font-bold text-blue-600">{formatJOD(breakdown.total)}</span>
              </div>
              <p className="text-xs text-gray-600 text-center mt-2">
                All amounts in Jordanian Dinar (JOD) with 3 decimal places
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
