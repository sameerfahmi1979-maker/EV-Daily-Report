import React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

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
  const allCalculated = pendingCount === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-start space-x-3">
            {allCalculated ? (
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
            ) : (
              <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={24} />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm Bulk Recalculation
              </h3>
              <div className="mt-3 space-y-3">
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-2">Selected sessions breakdown:</p>
                  <div className="space-y-1.5 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total selected:</span>
                      <span className="font-semibold">{totalSelected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 text-blue-700">
                        <CheckCircle size={14} />
                        <span>Will be processed:</span>
                      </span>
                      <span className="font-semibold text-blue-700">{pendingCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 text-gray-600">
                        <XCircle size={14} />
                        <span>Will be skipped:</span>
                      </span>
                      <span className="font-semibold text-gray-600">{calculatedCount}</span>
                    </div>
                  </div>
                </div>

                {allCalculated ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      All selected sessions already have billing calculations and will be skipped.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      Only sessions without existing billing calculations will be processed.
                      Already-calculated sessions will be automatically skipped.
                    </p>
                  </div>
                )}
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
            disabled={allCalculated}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {allCalculated ? 'Nothing to Process' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
