import React from 'react';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';

interface BulkRecalculateConfirmDialogProps {
  totalSelected: number;
  pendingCount: number;
  calculatedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BulkRecalculateConfirmDialog({
  totalSelected,
  pendingCount,
  calculatedCount,
  onConfirm,
  onCancel
}: BulkRecalculateConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-start space-x-3">
            <Zap className="text-orange-600 flex-shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                ⚡ Turbo Bulk Recalculation
              </h3>
              <div className="mt-3 space-y-3">
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-2">Selected sessions breakdown:</p>
                  <div className="space-y-1.5 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total selected:</span>
                      <span className="font-semibold">{totalSelected}</span>
                    </div>
                    {pendingCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-1.5 text-blue-700">
                          <CheckCircle size={14} />
                          <span>New calculations:</span>
                        </span>
                        <span className="font-semibold text-blue-700">{pendingCount}</span>
                      </div>
                    )}
                    {calculatedCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-1.5 text-orange-700">
                          <AlertCircle size={14} />
                          <span>Will be re-calculated:</span>
                        </span>
                        <span className="font-semibold text-orange-700">{calculatedCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm text-orange-800">
                    <strong>Turbo Mode:</strong> All {totalSelected} sessions will be processed server-side in a single operation.
                    {calculatedCount > 0 && ' Existing billing data will be replaced with fresh calculations.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center space-x-2"
          >
            <Zap size={16} />
            <span>⚡ Turbo Recalculate</span>
          </button>
        </div>
      </div>
    </div>
  );
}
